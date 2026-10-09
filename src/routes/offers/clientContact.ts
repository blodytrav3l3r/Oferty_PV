import crypto from 'node:crypto';
import express from 'express';
import { z } from 'zod';
import prisma from '../../prismaClient';
import { requireAuth, AuthenticatedRequest } from '../../middleware/auth';
import { WRITE_LIMITER } from '../../middleware/rateLimiters';
import { validateData } from '../../validators/authSchema';
import { canWriteDoc } from '../../utils/ownership';
import { logger } from '../../utils/logger';
import { mapPrismaError } from '../../utils/prismaErrors';
import { searchCache } from '../../utils/searchCache';

const router = express.Router();

// Kontakt do klienta oferty: wiele osób [{name, phone, email}] w blobie
// `data.clientContacts` (schemaless, bez migracji, max 10). Pierwszy wpis
// mirrorowany do kluczy legacy (contactPerson/clientPhone/clientEmail) —
// PDF/search/DOCX czytają je jak dotąd. Samotne pola legacy w body zachowane
// dla kompatybilności (używane tylko gdy brak `contacts`).
// clients_rel celowo nie ruszane (PUT /api/clients to batch-sync z full-wipe).
const MAX_CONTACTS = 10;

const emailField = z
    .string()
    .max(200)
    .nullish()
    .refine((v) => v == null || v.trim() === '' || /.+@.+\..+/.test(v.trim()), {
        message: 'Nieprawidłowy adres e-mail'
    });

const contactEntrySchema = z.object({
    name: z.string().max(200).nullish(),
    phone: z.string().max(50).nullish(),
    email: emailField
});

const clientContactSchema = z.object({
    contactPerson: z.string().max(200).nullish(),
    clientPhone: z.string().max(50).nullish(),
    clientEmail: emailField,
    contacts: z.array(contactEntrySchema).max(MAX_CONTACTS).nullish()
});

type ClientContactBody = z.infer<typeof clientContactSchema>;

interface ContactEntry {
    name: string;
    phone: string;
    email: string;
}

function normalizeEntries(raw: unknown): ContactEntry[] {
    if (!Array.isArray(raw)) return [];
    const out: ContactEntry[] = [];
    for (const r of raw as Array<Record<string, unknown>>) {
        if (!r || typeof r !== 'object') continue;
        const name = String(r.name ?? '')
            .trim()
            .slice(0, 200);
        const phone = String(r.phone ?? '')
            .trim()
            .slice(0, 50);
        const email = String(r.email ?? '')
            .trim()
            .slice(0, 200);
        if (!name && !phone && !email) continue;
        out.push({ name, phone, email });
        if (out.length >= MAX_CONTACTS) break;
    }
    return out;
}

function checkKind(kind: string): kind is 'rury' | 'studnie' {
    return kind === 'rury' || kind === 'studnie';
}

router.put(
    '/:kind/:id/client-contact',
    requireAuth,
    WRITE_LIMITER,
    validateData(clientContactSchema),
    async (req, res) => {
        const authReq = req as AuthenticatedRequest;
        try {
            const { kind, id } = req.params;
            if (!checkKind(kind)) {
                return res
                    .status(400)
                    .json({ error: 'Nieprawidłowy typ oferty', code: 'INVALID_KIND' });
            }
            const offer =
                kind === 'rury'
                    ? await prisma.offers_rel.findUnique({
                          where: { id },
                          select: { id: true, userId: true, data: true }
                      })
                    : await prisma.offers_studnie_rel.findUnique({
                          where: { id },
                          select: { id: true, userId: true, data: true }
                      });
            if (!offer) {
                return res.status(404).json({ error: 'Oferta nie istnieje', code: 'NOT_FOUND' });
            }
            if (!canWriteDoc(authReq.user, offer.userId)) {
                return res
                    .status(403)
                    .json({ error: 'Brak uprawnień do zapisu', code: 'FORBIDDEN' });
            }
            const body = req.body as ClientContactBody;
            const norm = (v: string | null | undefined): string | null => {
                const t = (v ?? '').trim();
                return t === '' ? null : t;
            };
            const entries = body.contacts ? normalizeEntries(body.contacts) : null;
            const first = entries ? entries[0] : null;
            const patch = {
                contactPerson: first ? first.name || null : norm(body.contactPerson),
                clientPhone: first ? first.phone || null : norm(body.clientPhone),
                clientEmail: first
                    ? first.email || null
                    : body.clientEmail == null
                      ? null
                      : norm(body.clientEmail)
            };
            const now = new Date().toISOString();
            let blob: Record<string, unknown> = {};
            try {
                if (offer.data) blob = JSON.parse(offer.data);
            } catch {
                blob = {};
            }
            const oldContact = {
                contactPerson: (blob.contactPerson as string) ?? null,
                clientPhone: (blob.clientPhone as string) ?? null,
                clientEmail: (blob.clientEmail as string) ?? null,
                clientContacts: Array.isArray(blob.clientContacts) ? blob.clientContacts : []
            };
            if (entries) {
                if (entries.length > 0) blob.clientContacts = entries;
                else delete blob.clientContacts;
            }
            for (const [k, v] of Object.entries(patch)) {
                if (v === null) delete blob[k];
                else blob[k] = v;
            }
            // Rury: PDF/DOCX czytają kontakt z `clientContact` — gdy pusty,
            // a podano telefon, telefon go wypełnia (nigdy nie nadpisuje).
            if (patch.clientPhone && !String(blob.clientContact ?? '').trim()) {
                blob.clientContact = patch.clientPhone;
            }
            const newData = JSON.stringify(blob);
            await prisma.$transaction(async (tx) => {
                if (kind === 'rury') {
                    await tx.offers_rel.updateMany({
                        where: { id },
                        data: { data: newData, updatedAt: now, version: { increment: 1 } }
                    });
                } else {
                    await tx.offers_studnie_rel.updateMany({
                        where: { id },
                        data: { data: newData, updatedAt: now, version: { increment: 1 } }
                    });
                }
                await tx.audit_logs.create({
                    data: {
                        id: crypto.randomUUID(),
                        entityType: kind === 'rury' ? 'offer' : 'studnia_oferta',
                        entityId: id,
                        userId: authReq.user?.id ?? null,
                        action: 'update-client-contact',
                        oldData: JSON.stringify(oldContact),
                        newData: JSON.stringify({ ...patch, contacts: entries ?? undefined }),
                        createdAt: now
                    }
                });
            });
            searchCache.invalidateAll();
            return res.json({ ok: true, id });
        } catch (e) {
            if (mapPrismaError(res, e)) return;
            logger.error('ClientContact', 'Błąd zapisu kontaktu klienta', {
                error: e instanceof Error ? e.message : String(e)
            });
            return res.status(500).json({ error: 'Wewnętrzny błąd serwera' });
        }
    }
);

export default router;
