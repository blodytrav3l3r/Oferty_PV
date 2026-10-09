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

// Katalog osób do kontaktu klienta: wiele kontaktów per klient.
// Limity jak kanon ofertowy (clientContact.ts): max 10, e-mail /.+@.+\..+/.
// Puste wiersze wypadają po normalizacji; sync = pełny zestaw albo nic
// (brak na liście = usuń) w 1 tx + audyt w tx + mirror [0]/primary do
// clients_rel.contact/phone/email (kompatybilność starego popupu i PDF).
// Sync NIE rusza snapshotów ofert (tylko katalog).
const MAX_CONTACTS = 10;

const emailField = z
    .string()
    .max(200)
    .nullish()
    .refine((v) => v == null || v.trim() === '' || /.+@.+\..+/.test(v.trim()), {
        message: 'Nieprawidłowy adres e-mail'
    });

const contactEntrySchema = z.object({
    id: z.string().max(100).nullish(),
    name: z.string().max(200).nullish(),
    phone: z.string().max(50).nullish(),
    email: emailField,
    position: z.string().max(200).nullish(),
    isPrimary: z.boolean().nullish()
});

const contactsSyncSchema = z.object({
    contacts: z.array(contactEntrySchema).max(MAX_CONTACTS),
    clientUpdatedAt: z.string().nullish()
});

type ContactsSyncBody = z.infer<typeof contactsSyncSchema>;

interface NormalizedContact {
    id: string | null;
    name: string;
    phone: string | null;
    email: string | null;
    position: string;
    isPrimary: boolean;
}

function normalizeEntries(raw: unknown): NormalizedContact[] {
    if (!Array.isArray(raw)) return [];
    const out: NormalizedContact[] = [];
    for (const r of raw as Array<Record<string, unknown>>) {
        if (!r || typeof r !== 'object') continue;
        const name = String(r.name ?? '')
            .trim()
            .slice(0, 200);
        const phone =
            String(r.phone ?? '')
                .trim()
                .slice(0, 50) || null;
        const email =
            String(r.email ?? '')
                .trim()
                .slice(0, 200) || null;
        const position = String(r.position ?? '')
            .trim()
            .slice(0, 200);
        if (!name && !phone && !email && !position) continue;
        const rawId = typeof r.id === 'string' && r.id.trim() !== '' ? r.id.trim() : null;
        out.push({ id: rawId, name, phone, email, position, isPrimary: r.isPrimary === true });
    }
    return out;
}

router.get('/:clientId/contacts', requireAuth, async (req, res) => {
    try {
        const { clientId } = req.params;
        const client = await prisma.clients_rel.findUnique({ where: { id: clientId } });
        if (!client) {
            return res.status(404).json({ error: 'Klient nie istnieje', code: 'NOT_FOUND' });
        }
        const items = await prisma.client_contacts_rel.findMany({
            where: { clientId },
            orderBy: [{ isPrimary: 'desc' }, { createdAt: 'asc' }]
        });
        return res.json({ ok: true, items });
    } catch (e) {
        if (mapPrismaError(res, e)) return;
        logger.error('ClientContacts', 'Błąd odczytu kontaktów klienta', {
            error: e instanceof Error ? e.message : String(e)
        });
        return res.status(500).json({ error: 'Wewnętrzny błąd serwera' });
    }
});

router.put(
    '/:clientId/contacts/sync',
    requireAuth,
    WRITE_LIMITER,
    validateData(contactsSyncSchema),
    async (req, res) => {
        const authReq = req as AuthenticatedRequest;
        try {
            const { clientId } = req.params;
            const client = await prisma.clients_rel.findUnique({ where: { id: clientId } });
            if (!client) {
                return res.status(404).json({ error: 'Klient nie istnieje', code: 'NOT_FOUND' });
            }
            // Parity clients.ts: baza wspólna (Wariant A), zapis wymaga
            // canWriteDoc względem właściciela; bezpański (userId null,
            // legacy) fail-closed — tylko admin (ownership.ts).
            if (!canWriteDoc(authReq.user, client.userId)) {
                return res
                    .status(403)
                    .json({ error: 'Brak uprawnień do zapisu kontaktów', code: 'FORBIDDEN' });
            }
            const body = req.body as ContactsSyncBody;
            if (
                body.clientUpdatedAt != null &&
                body.clientUpdatedAt !== '' &&
                client.updatedAt != null &&
                body.clientUpdatedAt !== client.updatedAt
            ) {
                return res.status(409).json({
                    error: 'Dane klienta zmieniły się w międzyczasie — odśwież i spróbuj ponownie',
                    code: 'CONFLICT',
                    updatedAt: client.updatedAt
                });
            }
            const entries = normalizeEntries(body.contacts);
            for (const c of entries) {
                if (!c.name) {
                    return res.status(400).json({
                        error: 'Nazwa kontaktu jest wymagana',
                        code: 'VALIDATION_ERROR'
                    });
                }
            }
            const existing = await prisma.client_contacts_rel.findMany({
                where: { clientId }
            });
            const existingIds = new Set(existing.map((c) => c.id));
            for (const c of entries) {
                // IDOR: id spoza klienta (np. z klienta B) to 404, nie 403 —
                // celowo jak loadFollowUp (mismatch = brak zasobu dla klienta).
                if (c.id !== null && !existingIds.has(c.id)) {
                    return res
                        .status(404)
                        .json({ error: 'Kontakt nie istnieje', code: 'NOT_FOUND' });
                }
            }
            const now = new Date().toISOString();
            const incomingIds = new Set(
                entries.filter((c) => c.id !== null).map((c) => c.id as string)
            );
            const toDelete = existing.filter((c) => !incomingIds.has(c.id)).map((c) => c.id);
            // Max-jeden główny: pierwszy oznaczony wygrywa (id nowe mintujemy
            // z góry, żeby zerowanie reszty było jawne w tej samej tx).
            const newIds = new Map<number, string>();
            entries.forEach((c, i) => {
                if (c.id === null) newIds.set(i, crypto.randomUUID());
            });
            const idOf = (i: number): string => entries[i].id ?? (newIds.get(i) as string);
            const primaryIdx = entries.findIndex((c) => c.isPrimary);
            const primaryId = primaryIdx === -1 ? null : idOf(primaryIdx);
            const news = entries
                .map((c, i) => ({ c, i }))
                .filter(({ c }) => c.id === null)
                .map(({ c, i }) => ({
                    id: idOf(i),
                    clientId,
                    name: c.name,
                    phone: c.phone,
                    email: c.email,
                    position: c.position,
                    isPrimary: primaryId !== null && idOf(i) === primaryId ? 1 : 0,
                    createdByUserId: authReq.user?.id ?? null,
                    createdAt: now,
                    updatedAt: now
                }));
            const updates = entries
                .filter((c) => c.id !== null)
                .map((c) => ({
                    id: c.id as string,
                    data: {
                        name: c.name,
                        phone: c.phone,
                        email: c.email,
                        position: c.position,
                        isPrimary: primaryId !== null && c.id === primaryId ? 1 : 0,
                        updatedAt: now
                    }
                }));
            // Mirror kompatybilności: primary ?? [0] → clients_rel.
            const all = [...updates.map((u) => ({ ...u.data, id: u.id })), ...news];
            const mirrorSource =
                (primaryId !== null ? all.find((c) => c.id === primaryId) : null) ?? all[0] ?? null;
            const oldList = [...existing].sort((a, b) => String(a.id).localeCompare(String(b.id)));
            await prisma.$transaction(async (tx) => {
                if (toDelete.length > 0) {
                    await tx.client_contacts_rel.deleteMany({ where: { id: { in: toDelete } } });
                }
                for (const u of updates) {
                    await tx.client_contacts_rel.update({ where: { id: u.id }, data: u.data });
                }
                for (const n of news) {
                    await tx.client_contacts_rel.create({ data: n });
                }
                await tx.clients_rel.update({
                    where: { id: clientId },
                    data: {
                        contact: mirrorSource ? mirrorSource.name : '',
                        phone: mirrorSource?.phone ?? '',
                        email: mirrorSource?.email ?? '',
                        updatedAt: now
                    }
                });
                await tx.audit_logs.create({
                    data: {
                        id: crypto.randomUUID(),
                        entityType: 'client_contact',
                        entityId: clientId,
                        userId: authReq.user?.id ?? null,
                        action: 'sync',
                        oldData: JSON.stringify(oldList),
                        newData: JSON.stringify(
                            [...updates.map((u) => ({ ...u.data, id: u.id })), ...news].sort(
                                (a, b) => String(a.id).localeCompare(String(b.id))
                            )
                        ),
                        createdAt: now
                    }
                });
            });
            searchCache.invalidateAll();
            return res.json({ ok: true, clientId, count: entries.length, updatedAt: now });
        } catch (e) {
            if (mapPrismaError(res, e)) return;
            logger.error('ClientContacts', 'Błąd synchronizacji kontaktów klienta', {
                error: e instanceof Error ? e.message : String(e)
            });
            return res.status(500).json({ error: 'Wewnętrzny błąd serwera' });
        }
    }
);

export default router;
