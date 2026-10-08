import crypto from 'node:crypto';
import express from 'express';
import { z } from 'zod';
import prisma from '../../prismaClient';
import { requireAuth, AuthenticatedRequest } from '../../middleware/auth';
import { WRITE_LIMITER } from '../../middleware/rateLimiters';
import { validateData } from '../../validators/authSchema';
import { canReadWithShare, canWriteDoc } from '../../utils/ownership';
import { logger } from '../../utils/logger';
import { mapPrismaError } from '../../utils/prismaErrors';
import { searchCache } from '../../utils/searchCache';

const router = express.Router();

const writeFollowUpLimiter = WRITE_LIMITER;

// Stany terminalne: ponowny zapis tylko z jawna flaga reopen (409 bez niej).
const TERMINAL_OUTCOMES = ['WON', 'LOST_COMPETITION', 'LOST_OTHER', 'ABANDONED'] as const;

function isTerminal(outcome: string): boolean {
    return (TERMINAL_OUTCOMES as readonly string[]).includes(outcome);
}

// Ścisły kontrakt dat: pełne ISO-8601 z czasem i strefą (FE wysyła
// toISOString). Sam Date.parse jest liberalny (łyka '10/10/2026',
// 'Oct 10 2026'), więc regex + zakresy kalendarzowe + Date.parse.
const ISO_DATETIME_RE =
    /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2})(?:\.(\d{1,3}))?)?(Z|[+-](\d{2}):?(\d{2}))$/;

function isStrictIsoDateTime(s: string): boolean {
    const m = ISO_DATETIME_RE.exec(s);
    if (!m) return false;
    const y = Number(m[1]);
    const mo = Number(m[2]);
    const d = Number(m[3]);
    const hh = Number(m[4]);
    const mi = Number(m[5]);
    const ss = m[6] === undefined ? 0 : Number(m[6]);
    if (mo < 1 || mo > 12 || d < 1) return false;
    const leap = (y % 4 === 0 && y % 100 !== 0) || y % 400 === 0;
    const dim = [31, leap ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31][mo - 1];
    if (d > dim) return false;
    if (hh > 23 || mi > 59 || ss > 59) return false;
    if (m[8] !== 'Z') {
        if (Number(m[9]) > 23 || Number(m[10]) > 59) return false;
    }
    return Number.isFinite(Date.parse(s));
}

const isoDateTime = z.string().refine(isStrictIsoDateTime, {
    message: 'Nieprawidłowa data ISO-8601 (wymagane RRRR-MM-DDTHH:MM:SS ze strefą)'
});

export const followUpCreateSchema = z
    .object({
        channel: z.enum(['PHONE', 'EMAIL', 'SMS', 'WHATSAPP', 'MEETING', 'OTHER']),
        result: z.enum(['CONTACTED', 'NO_ANSWER', 'BUSY', 'CALLBACK_REQUESTED', 'WRONG_NUMBER']),
        contactedAt: isoDateTime,
        durationMin: z.number().int().min(0).max(480).nullish(),
        note: z.string().max(2000).nullish(),
        nextContactAt: isoDateTime.nullish(),
        outcome: z
            .enum(['OPEN', 'WON', 'LOST_COMPETITION', 'LOST_OTHER', 'ABANDONED'])
            .default('OPEN'),
        loseReason: z.string().max(200).nullish(),
        competitor: z.string().max(200).nullish(),
        competitorPrice: z.number().finite().min(0).nullish(),
        reopen: z.boolean().default(false)
    })
    // P2 twarde domknięcie: LOST_* wymaga powodu (miękkie z P0/P1 zaostrzone).
    .superRefine((v, ctx) => {
        if (
            (v.outcome === 'LOST_COMPETITION' || v.outcome === 'LOST_OTHER') &&
            !v.loseReason?.trim()
        ) {
            ctx.addIssue({
                code: 'custom',
                path: ['loseReason'],
                message: 'Podaj powód utraty oferty'
            });
        }
    });

type FollowUpCreate = z.infer<typeof followUpCreateSchema>;

function checkKind(kind: string): kind is 'rury' | 'studnie' {
    return kind === 'rury' || kind === 'studnie';
}

async function loadOffer(kind: 'rury' | 'studnie', id: string) {
    if (kind === 'rury') {
        return prisma.offers_rel.findUnique({ where: { id } });
    }
    return prisma.offers_studnie_rel.findUnique({ where: { id } });
}

function shareType(kind: 'rury' | 'studnie'): string {
    return kind === 'rury' ? 'offer' : 'offer_studnie';
}

router.post(
    '/:kind/:id/followups',
    requireAuth,
    writeFollowUpLimiter,
    validateData(followUpCreateSchema),
    async (req, res) => {
        const authReq = req as AuthenticatedRequest;
        try {
            const { kind, id } = req.params;
            if (!checkKind(kind)) {
                return res
                    .status(400)
                    .json({ error: 'Nieprawidłowy typ oferty', code: 'INVALID_KIND' });
            }

            const offer = await loadOffer(kind, id);
            if (!offer) {
                return res.status(404).json({ error: 'Oferta nie istnieje', code: 'NOT_FOUND' });
            }
            // P4.3 kontrakt: udostępnienie = read-only. Odczyt timeline idzie
            // przez canReadWithShare, ale zapis celowo wymaga canWriteDoc —
            // kontakt dopisuje historię cudzej oferty, więc share nie wystarcza.
            if (!canWriteDoc(authReq.user, offer.userId)) {
                return res
                    .status(403)
                    .json({ error: 'Brak uprawnień do zapisu kontaktu', code: 'FORBIDDEN' });
            }

            const body = req.body as FollowUpCreate;
            const latest = await prisma.offer_follow_ups.findFirst({
                where: { offerKind: kind, offerId: id },
                orderBy: [{ contactedAt: 'desc' }, { createdAt: 'desc' }, { id: 'desc' }]
            });
            if (latest && isTerminal(latest.outcome) && !body.reopen) {
                return res.status(409).json({
                    error: 'Oferta jest zamknięta — ponowne otwarcie wymaga flagi reopen',
                    code: 'TERMINAL_OUTCOME'
                });
            }

            // Cykle obsługi: reopen po terminalnym starcie nowy cykl (nr+1),
            // historia zostaje. Limit DB (uq_fu_terminal_per_cycle) dopuszcza
            // max 1 terminal na cykl i rozstrzyga wyścigi równoległych POST.
            const latestCycle =
                latest && typeof (latest as { cycle?: unknown }).cycle === 'number'
                    ? ((latest as { cycle?: number }).cycle as number)
                    : 0;
            const cycle = latest && isTerminal(latest.outcome) ? latestCycle + 1 : latestCycle;

            const now = new Date().toISOString();
            const fuId = crypto.randomUUID();
            const record = {
                id: fuId,
                offerKind: kind,
                offerId: id,
                cycle,
                createdByUserId: authReq.user?.id ?? '',
                createdAt: now,
                contactedAt: new Date(body.contactedAt).toISOString(),
                channel: body.channel,
                result: body.result,
                durationMin: body.durationMin ?? null,
                note: body.note ?? null,
                nextContactAt: body.nextContactAt
                    ? new Date(body.nextContactAt).toISOString()
                    : null,
                outcome: body.outcome,
                loseReason: body.loseReason ?? null,
                competitor: body.competitor ?? null,
                competitorPrice: body.competitorPrice ?? null
            };

            // Audyt bezpośrednio przez tx (rzuca przy błędzie → rollback całości).
            // logAudit celowo pominięty: ma semantykę warn-only i nie cofa biznesu.
            await prisma.$transaction(async (tx) => {
                await tx.offer_follow_ups.create({ data: record });
                await tx.audit_logs.create({
                    data: {
                        id: crypto.randomUUID(),
                        entityType: 'offer_followup',
                        entityId: fuId,
                        userId: authReq.user?.id ?? null,
                        action: body.reopen ? 'reopen' : 'create',
                        oldData: null,
                        newData: JSON.stringify(record),
                        createdAt: now
                    }
                });
            });

            // P4.1: follow-up zmienia projekcję search (badge LOS) —
            // jak każdy CRUD ofert, czyścimy cache po sukcesie (nie w tx).
            searchCache.invalidateAll();

            return res.json({ ok: true, id: fuId });
        } catch (e) {
            // Wyścig dwóch terminalnych POST w tym samym cyklu rozstrzyga
            // constraint uq_fu_terminal_per_cycle (legacy: ..._per_offer).
            // Mapuj TYLKO te indexy na 409 — inny P2002 idzie ścieżką
            // mapPrismaError (409 UNIQUE_CONFLICT).
            if ((e as { code?: string })?.code === 'P2002') {
                const target = JSON.stringify((e as { meta?: unknown })?.meta ?? '');
                if (
                    target.includes('uq_fu_terminal_per_cycle') ||
                    target.includes('uq_fu_terminal_per_offer')
                ) {
                    return res.status(409).json({
                        error: 'Oferta została w międzyczasie zamknięta',
                        code: 'TERMINAL_OUTCOME'
                    });
                }
            }
            if (mapPrismaError(res, e)) return;
            logger.error('FollowUps', 'Błąd zapisu kontaktu', {
                error: e instanceof Error ? e.message : String(e)
            });
            return res.status(500).json({ error: 'Wewnętrzny błąd serwera' });
        }
    }
);

router.get('/:kind/:id/followups', requireAuth, async (req, res) => {
    const authReq = req as AuthenticatedRequest;
    try {
        const { kind, id } = req.params;
        if (!checkKind(kind)) {
            return res
                .status(400)
                .json({ error: 'Nieprawidłowy typ oferty', code: 'INVALID_KIND' });
        }

        const offer = await loadOffer(kind, id);
        if (!offer) {
            return res.status(404).json({ error: 'Oferta nie istnieje', code: 'NOT_FOUND' });
        }
        if (!(await canReadWithShare(authReq.user, offer.userId, shareType(kind), id))) {
            return res
                .status(403)
                .json({ error: 'Brak uprawnień do odczytu kontaktów', code: 'FORBIDDEN' });
        }

        const items = await prisma.offer_follow_ups.findMany({
            where: { offerKind: kind, offerId: id },
            orderBy: [{ contactedAt: 'desc' }, { createdAt: 'desc' }, { id: 'desc' }]
        });
        return res.json({ ok: true, items });
    } catch (e) {
        if (mapPrismaError(res, e)) return;
        logger.error('FollowUps', 'Błąd odczytu kontaktów', {
            error: e instanceof Error ? e.message : String(e)
        });
        return res.status(500).json({ error: 'Wewnętrzny błąd serwera' });
    }
});

export default router;
