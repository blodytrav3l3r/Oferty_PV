import express from 'express';
import prisma from '../../prismaClient';
import { logAudit } from '../../db';
import { requireAuth, AuthenticatedRequest } from '../../middleware/auth';
import crypto from 'crypto';
import { logger } from '../../utils/logger';
import { validateData } from '../../validators/authSchema';
import { WRITE_LIMITER } from '../../middleware/rateLimiters';
import {
    offersStudnieBatchSchema
} from '../../validators/offerSchemas';

const router = express.Router();
const uuidv4 = crypto.randomUUID.bind(crypto);

const writeOffersLimiter = WRITE_LIMITER;

const isValidId = (id: string): boolean => typeof id === 'string' && id.length > 0 && id.length < 100 && /^[a-zA-Z0-9_-]+$/.test(id);

router.get('/studnie', requireAuth, async (req, res) => {
    const authReq = req as AuthenticatedRequest;
    try {
        let whereSql = '';
        if (authReq.user?.role !== 'admin' && authReq.user) {
            if (authReq.user.role === 'pro') {
                const allowedIds = [authReq.user.id, ...(authReq.user.subUsers || [])]
                    .filter(isValidId)
                    .map(id => `'${id.replace(/'/g, "''")}'`)
                    .join(',');
                whereSql = `WHERE "userId" IN (${allowedIds})`;
            } else {
                const safeId = isValidId(authReq.user.id) ? authReq.user.id.replace(/'/g, "''") : '__invalid__';
                whereSql = `WHERE "userId" = '${safeId}'`;
            }
        }

        logger.debug('Offers', 'GET /studnie', { userId: authReq.user?.id, role: authReq.user?.role, whereSql });

        const offers = await prisma.$queryRawUnsafe<
            Array<{
                id: string;
                userId: string | null;
                offer_number: string | null;
                state: string | null;
                data: string | null;
                history: string | null;
                createdAt: string | null;
                updatedAt: string | null;
            }>
        >(`SELECT id, "userId", "offer_number", state, data, history,
            CASE WHEN "createdAt" GLOB '[0-9][0-9][0-9][0-9][0-9][0-9][0-9][0-9][0-9][0-9][0-9][0-9][0-9]'
                THEN datetime(CAST("createdAt" AS INTEGER)/1000, 'unixepoch')
                ELSE "createdAt" END as "createdAt",
            CASE WHEN "updatedAt" GLOB '[0-9][0-9][0-9][0-9][0-9][0-9][0-9][0-9][0-9][0-9][0-9][0-9][0-9]'
                THEN datetime(CAST("updatedAt" AS INTEGER)/1000, 'unixepoch')
                ELSE "updatedAt" END as "updatedAt"
         FROM offers_studnie_rel ${whereSql}`);

        const mapped = offers.map((offer) => {
            let parsedData: Record<string, unknown> = {};
            try {
                if (offer.data) parsedData = JSON.parse(offer.data);
            } catch (_e) {}

            return {
                id: offer.id,
                type: 'studnia_oferta',
                userId: offer.userId,
                title: `Oferta Studnia ${offer.offer_number || offer.id}`,
                price: parsedData.totalPrice || 0,
                status: offer.state === 'final' ? 'active' : 'draft',
                createdAt: offer.createdAt || new Date().toISOString(),
                updatedAt: offer.updatedAt || offer.createdAt || new Date().toISOString(),
                lastEditedBy: offer.userId,
                data: parsedData,
                history: JSON.parse(offer.history || '[]'),
                ...(offer.data ? JSON.parse(offer.data) : {})
            };
        });

        logger.debug('Offers', 'GET /studnie wynik', { count: mapped.length, ids: mapped.map(o => o.id) });
        res.json({ data: mapped });
    } catch (e: unknown) {
        const message = e instanceof Error ? e.message : 'Unknown error';
        logger.error('Offers', 'Błąd GET /studnie', message);
        res.status(500).json({ error: message });
    }
});

router.get('/studnie/:id', requireAuth, async (req, res) => {
    const authReq = req as AuthenticatedRequest;
    try {
        const { id } = req.params;

        const offer = await prisma.offers_studnie_rel.findUnique({
            where: { id }
        });
        if (!offer) return res.status(404).json({ error: 'Oferta studni nie istnieje' });

        if (authReq.user?.role !== 'admin' && offer.userId !== authReq.user?.id) {
            return res.status(403).json({ error: 'Brak uprawnień do odczytu tej oferty' });
        }

        let parsedData: Record<string, unknown> = {};
        try {
            if (offer.data) parsedData = JSON.parse(offer.data);
        } catch (_e) {}

        res.json({
            data: {
                id: offer.id,
                type: 'studnia_oferta',
                userId: offer.userId,
                title: `Oferta Studnia ${offer.offer_number || offer.id}`,
                price: (parsedData.totalPrice as number) || 0,
                status: offer.state === 'final' ? 'active' : 'draft',
                createdAt: offer.createdAt || new Date().toISOString(),
                updatedAt: offer.updatedAt || offer.createdAt || new Date().toISOString(),
                lastEditedBy: offer.userId,
                data: parsedData,
                history: JSON.parse(offer.history || '[]')
            }
        });
    } catch (e: unknown) {
        const message = e instanceof Error ? e.message : 'Unknown error';
        res.status(500).json({ error: message });
    }
});

router.post('/studnie', requireAuth, writeOffersLimiter, validateData(offersStudnieBatchSchema), async (req, res) => {
    const authReq = req as AuthenticatedRequest;
    try {
        const incoming = req.body.data || [req.body];

        const results: Record<string, unknown>[] = [];
        for (const o of incoming) {
            let docId = o.id;
            if (!docId) docId = uuidv4();

            let newHistory: unknown[] = [];
            const old = await prisma.offers_studnie_rel.findUnique({
                where: { id: docId },
                select: { history: true, data: true, state: true }
            });
            if (old) {
                try {
                    newHistory = JSON.parse(old.history || '[]');
                } catch (_e) {}
                const snapshot = {
                    timestamp: new Date().toISOString(),
                    state: old.state,
                    data: JSON.parse(old.data || '{}')
                };
                newHistory.unshift(snapshot);
                if (newHistory.length > 5) newHistory = newHistory.slice(0, 5);

                logAudit(
                    'studnia_oferta',
                    docId,
                    authReq.user?.id || '',
                    'update',
                    o,
                    JSON.parse(old.data || '{}')
                );
            } else {
                logAudit('studnia_oferta', docId, authReq.user?.id || '', 'create', o);
            }

            const state = o.status === 'active' ? 'final' : 'draft';
            const created = (() => {
                const raw = o.createdAt;
                if (typeof raw === 'number') return new Date(raw).toISOString();
                if (raw instanceof Date) return raw.toISOString();
                if (typeof raw === 'string') {
                    if (/^\d{13}$/.test(raw)) return new Date(Number(raw)).toISOString();
                    if (/^\d+$/.test(raw)) return new Date(Number(raw)).toISOString();
                    return raw;
                }
                return new Date().toISOString();
            })();
            const updated = new Date().toISOString();
            const offerNumber = o.number || o.offer_number || '';
            const userId = o.userId || authReq.user?.id || '';
            const dataStr = JSON.stringify(o);
            const historyStr = JSON.stringify(newHistory);

            await prisma.offers_studnie_rel.upsert({
                where: { id: docId },
                create: {
                    id: docId,
                    userId: userId,
                    offer_number: offerNumber,
                    state: state,
                    createdAt: created,
                    updatedAt: updated,
                    data: dataStr,
                    history: historyStr
                },
                update: {
                    userId: userId,
                    offer_number: offerNumber,
                    state: state,
                    updatedAt: updated,
                    data: dataStr,
                    history: historyStr
                }
            });
            results.push({ id: docId, ok: true });
        }

        logger.info(
            'Offers',
            `Zapisano ${results.length} ofert studnie przez ${authReq.user?.username}`
        );
        res.json({ ok: true, results });
    } catch (e: unknown) {
        const message = e instanceof Error ? e.message : 'Unknown error';
        logger.error('Offers', 'Błąd POST offers/studnie', message);
        res.status(500).json({ error: message });
    }
});

router.put('/studnie', requireAuth, writeOffersLimiter, validateData(offersStudnieBatchSchema), async (req, res) => {
    const authReq = req as AuthenticatedRequest;
    try {
        const incoming = req.body.data || [];

        for (const o of incoming) {
            let docId = o.id;
            if (!docId) {
                docId = Date.now().toString() + '_' + Math.random().toString(36).substr(2, 5);
            }

            const state = o.status === 'active' ? 'final' : 'draft';
            const created = (() => {
                const raw = o.createdAt;
                if (typeof raw === 'number') return new Date(raw).toISOString();
                if (raw instanceof Date) return raw.toISOString();
                if (typeof raw === 'string') {
                    if (/^\d{13}$/.test(raw)) return new Date(Number(raw)).toISOString();
                    return raw;
                }
                return new Date().toISOString();
            })();

            await prisma.offers_studnie_rel.upsert({
                where: { id: docId },
                create: {
                    id: docId,
                    userId: authReq.user?.id,
                    state: state,
                    createdAt: created,
                    data: o.data ? JSON.stringify(o.data) : '{}'
                },
                update: {
                    userId: authReq.user?.id,
                    state: state,
                    createdAt: created,
                    data: o.data ? JSON.stringify(o.data) : '{}'
                }
            });
        }

        res.json({ ok: true });
    } catch (e: unknown) {
        const message = e instanceof Error ? e.message : 'Unknown error';
        res.status(500).json({ error: message });
    }
});

router.delete('/studnie/:id', requireAuth, writeOffersLimiter, async (req, res) => {
    const authReq = req as AuthenticatedRequest;
    try {
        const { id } = req.params;
        logger.info('Offers', 'DELETE /studnie/:id start', { id, userId: authReq.user?.id });

        const offer = await prisma.offers_studnie_rel.findUnique({
            where: { id },
            select: { id: true, userId: true, data: true }
        });
        if (!offer) {
            logger.warn('Offers', 'Oferta studni nie istnieje', { id });
            return res.status(404).json({ error: 'Oferta studni nie istnieje' });
        }

        if (authReq.user?.role !== 'admin' && offer.userId !== authReq.user?.id) {
            return res.status(403).json({ error: 'Brak uprawnien do usuniecia tej oferty' });
        }

        let oldData: Record<string, unknown> = {};
        try {
            oldData = JSON.parse(offer.data || '{}');
        } catch (_e) {}
        logAudit('studnia_oferta', id, authReq.user?.id || '', 'delete', null, oldData);

        await prisma.offers_studnie_rel.delete({ where: { id } });

        logger.info('Offers', `Oferta studnie ${req.params.id} usunięta przez ${authReq.user?.username}`);
        res.json({ ok: true });
    } catch (e: unknown) {
        const message = e instanceof Error ? e.message : 'Unknown error';
        logger.error('Offers', `Błąd DELETE /studnie/:id (${req.params.id})`, message);
        res.status(500).json({ error: message });
    }
});

export default router;
