import express from 'express';
import { z } from 'zod';
import prisma from '../prismaClient';
import { requireAuth, AuthenticatedRequest } from '../middleware/auth';
import { getCareQueue, getCareSummary, CareScope, clampCareLimit } from '../services/careService';
import { getFollowUpState } from '../utils/careStatus';
import { logger } from '../utils/logger';

const router = express.Router();

const scopeSchema = z.enum(['mine', 'team', 'all']);
const queueQuerySchema = z.object({
    scope: scopeSchema.optional(),
    cursor: z.string().max(2000).optional(),
    limit: z.coerce.number().int().min(1).max(100).optional()
});
const summaryQuerySchema = z.object({
    scope: scopeSchema.optional()
});

function toScope(v: unknown): CareScope {
    return v === 'team' || v === 'all' ? v : 'mine';
}

router.get('/summary', requireAuth, async (req, res) => {
    const authReq = req as AuthenticatedRequest;
    try {
        const user = authReq.user;
        if (!user) return res.status(401).json({ error: 'Nieautoryzowany' });
        const parsed = summaryQuerySchema.safeParse(req.query);
        if (!parsed.success) return res.status(400).json({ error: 'Nieprawidłowe parametry' });
        const scope = toScope(parsed.data.scope);
        const nowIso = new Date().toISOString();
        const counts = await getCareSummary(prisma, user, scope, nowIso);
        return res.json({ ok: true, scope, now: nowIso, ...counts });
    } catch (e) {
        if ((e as { status?: number }).status === 403) {
            return res.status(403).json({ error: 'Brak uprawnień do zakresu' });
        }
        logger.warn('Care', 'Błąd summary', String(e));
        return res.status(500).json({ error: 'Błąd serwera' });
    }
});

router.get('/queue', requireAuth, async (req, res) => {
    const authReq = req as AuthenticatedRequest;
    try {
        const user = authReq.user;
        if (!user) return res.status(401).json({ error: 'Nieautoryzowany' });
        const parsed = queueQuerySchema.safeParse(req.query);
        if (!parsed.success) return res.status(400).json({ error: 'Nieprawidłowe parametry' });
        const scope = toScope(parsed.data.scope);
        const nowIso = new Date().toISOString();
        const limit = clampCareLimit(parsed.data.limit);
        const result = await getCareQueue(prisma, user, {
            scope,
            nowIso,
            cursor: parsed.data.cursor ?? null,
            limit
        });
        const items = result.items.map((r) => {
            const state = getFollowUpState(
                { outcome: r.outcome, nextContactAt: r.nextContactAt },
                '',
                nowIso
            );
            return {
                offerKind: r.offerKind,
                offerId: r.offerId,
                outcome: r.outcome,
                nextContactAt: r.nextContactAt,
                lastContactAt: r.lastContactAt,
                status: state.status,
                slaBucket: state.slaBucket,
                overdueDays: state.overdueDays
            };
        });
        return res.json({
            ok: true,
            scope,
            now: nowIso,
            items,
            nextCursor: result.nextCursor,
            totalCount: result.totalCount
        });
    } catch (e) {
        if ((e as { status?: number }).status === 403) {
            return res.status(403).json({ error: 'Brak uprawnień do zakresu' });
        }
        logger.warn('Care', 'Błąd queue', String(e));
        return res.status(500).json({ error: 'Błąd serwera' });
    }
});

export default router;
