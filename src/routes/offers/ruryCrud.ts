import express from 'express';
import prisma from '../../prismaClient';
import { logAudit } from '../../services/auditService';
import { requireAuth, AuthenticatedRequest } from '../../middleware/auth';
import crypto from 'crypto';
import { buildRoleWhereClause } from '../../utils/roleFilter';
import { logger } from '../../utils/logger';
import { validateData } from '../../validators/authSchema';
import { WRITE_LIMITER } from '../../middleware/rateLimiters';
import { canReadDoc, canWriteDoc, resolveWriteUserId } from '../../utils/ownership';
import { paginationQuerySchema } from '../../validators/offerSchemas';
import { offersBatchSchema } from '../../validators/rurySchemas';
import {
    ALLOWED_SORT_COLS,
    ALLOWED_SORT_DIRS,
    parseOfferDate,
    mapOffersWithItems,
    createOfferItems
} from '../../services/ruryOfferService';

const router = express.Router();
const uuidv4 = crypto.randomUUID.bind(crypto);
const writeOffersLimiter = WRITE_LIMITER;

router.get('/', requireAuth, async (req, res) => {
    const authReq = req as AuthenticatedRequest;
    try {
        const pq = paginationQuerySchema.parse(req.query);
        const roleClause = authReq.user ? buildRoleWhereClause(authReq.user) : undefined;
        const sortCol = ALLOWED_SORT_COLS[pq.sort || 'createdAt'] || 'createdAt';
        const sortDir = ALLOWED_SORT_DIRS[pq.order] || 'desc';
        const orderBy = { [sortCol]: sortDir };
        const [offers, totalCount] = await Promise.all([
            prisma.offers_rel.findMany({
                where: roleClause,
                skip: pq.skip,
                take: pq.limit,
                orderBy
            }),
            prisma.offers_rel.count({ where: roleClause })
        ]);

        const mapped = await mapOffersWithItems(offers as unknown as Record<string, unknown>[]);
        res.json({ data: mapped, totalCount, skip: pq.skip, limit: pq.limit });
    } catch (e: unknown) {
        const message = e instanceof Error ? e.message : 'Unknown error';
        res.status(500).json({ error: message });
    }
});

router.post(
    '/',
    requireAuth,
    writeOffersLimiter,
    validateData(offersBatchSchema),
    async (req, res) => {
        const authReq = req as AuthenticatedRequest;
        try {
            const incoming = req.body.data || [req.body];
            const results: Record<string, unknown>[] = [];

            for (const o of incoming) {
                let docId = o.id;
                if (!docId) docId = uuidv4();

                let newHistory: unknown[] = [];
                const old = await prisma.offers_rel.findUnique({ where: { id: docId } });

                let effectiveUserId: string;
                if (old) {
                    if (!canWriteDoc(authReq.user, old.userId)) {
                        return res
                            .status(403)
                            .json({ error: 'Brak uprawnień do modyfikacji tej oferty' });
                    }
                    effectiveUserId = old.userId || authReq.user?.id || '';
                } else {
                    const resolved = resolveWriteUserId(authReq.user, o.userId);
                    if (!resolved.allowed) {
                        return res.status(403).json({
                            error: 'Brak uprawnień do utworzenia oferty dla tego użytkownika'
                        });
                    }
                    effectiveUserId = resolved.effectiveUserId;
                }

                if (old) {
                    try {
                        newHistory = JSON.parse(old.history || '[]');
                    } catch {}
                    const oldItems = await prisma.offer_items_rel.findMany({
                        where: { offerId: docId }
                    });
                    const snapshot = {
                        updatedAt: old.updatedAt || old.createdAt,
                        state: old.state,
                        transportCost: old.transportCost,
                        items: oldItems.map((i) => ({
                            productId: i.productId,
                            quantity: i.quantity,
                            discount: i.discount,
                            price: i.price
                        }))
                    };
                    newHistory.unshift(snapshot);
                    if (newHistory.length > 5) newHistory = newHistory.slice(0, 5);
                    logAudit(
                        'offer',
                        docId,
                        authReq.user?.id || '',
                        'update',
                        {
                            state: o.status === 'active' ? 'final' : 'draft',
                            transportCost: o.transportCost,
                            items: o.items
                        },
                        snapshot
                    );
                } else {
                    logAudit('offer', docId, authReq.user?.id || '', 'create', {
                        state: o.status === 'active' ? 'final' : 'draft',
                        transportCost: o.transportCost,
                        items: o.items
                    });
                }

                const state = o.status === 'active' ? 'final' : 'draft';
                const created = parseOfferDate(o.createdAt);
                const updated = new Date().toISOString();
                const offerNumber = o.offer_number || o.number || '';
                const dataStr = JSON.stringify(o);

                await prisma.offers_rel.upsert({
                    where: { id: docId },
                    create: {
                        id: docId,
                        userId: effectiveUserId,
                        offer_number: offerNumber,
                        state,
                        createdAt: created,
                        updatedAt: updated,
                        transportCost: o.transportCost || 0,
                        history: JSON.stringify(newHistory),
                        data: dataStr
                    },
                    update: {
                        userId: effectiveUserId,
                        offer_number: offerNumber,
                        state,
                        updatedAt: updated,
                        transportCost: o.transportCost || 0,
                        history: JSON.stringify(newHistory),
                        data: dataStr
                    }
                });

                await prisma.offer_items_rel.deleteMany({ where: { offerId: docId } });
                await createOfferItems(docId, o.items || [], uuidv4);
                results.push({ id: docId, ok: true });
            }

            logger.info(
                'Offers',
                `Zapisano ${results.length} ofert rury przez ${authReq.user?.username}`
            );
            res.json({ ok: true, results });
        } catch (e: unknown) {
            const message = e instanceof Error ? e.message : 'Unknown error';
            logger.error('Offers', 'Błąd POST offers', message);
            res.status(500).json({ error: message });
        }
    }
);

router.put(
    '/',
    requireAuth,
    writeOffersLimiter,
    validateData(offersBatchSchema),
    async (req, res) => {
        const authReq = req as AuthenticatedRequest;
        try {
            const docId = req.body.id;
            if (docId) {
                const existing = await prisma.offers_rel.findUnique({
                    where: { id: docId },
                    select: { userId: true }
                });
                if (existing && !canWriteDoc(authReq.user, existing.userId)) {
                    return res.status(403).json({ error: 'Forbidden' });
                }
            }

            const incoming = req.body.data || [];
            const incomingIds: string[] = incoming
                .map((o: any) => (typeof o.id === 'string' ? o.id : ''))
                .filter(Boolean);
            if (incomingIds.length > 0) {
                const existingDocs =
                    (await prisma.offers_rel.findMany({
                        where: { id: { in: incomingIds } },
                        select: { id: true, userId: true }
                    })) || [];
                const forbidden = existingDocs.some(
                    (d) => d.userId && !canWriteDoc(authReq.user, d.userId)
                );
                if (forbidden) {
                    return res.status(403).json({
                        error: 'Forbidden — nie masz uprawnień do modyfikacji jednej z ofert'
                    });
                }
            }

            for (const o of incoming) {
                let docId = o.id;
                if (!docId) docId = crypto.randomUUID();

                const state = o.status === 'active' ? 'final' : 'draft';
                const created = parseOfferDate(o.createdAt);
                const dataStr = JSON.stringify(o);

                await prisma.offers_rel.upsert({
                    where: { id: docId },
                    create: {
                        id: docId,
                        userId: authReq.user?.id,
                        state,
                        createdAt: created,
                        transportCost: o.transportCost || 0,
                        data: dataStr
                    },
                    update: {
                        userId: authReq.user?.id,
                        state,
                        createdAt: created,
                        transportCost: o.transportCost || 0,
                        data: dataStr
                    }
                });

                await prisma.offer_items_rel.deleteMany({ where: { offerId: docId } });
                await createOfferItems(docId, o.items || [], uuidv4);
            }

            res.json({ ok: true });
        } catch (e: unknown) {
            const message = e instanceof Error ? e.message : 'Unknown error';
            res.status(500).json({ error: message });
        }
    }
);

router.post('/:id/duplicate', requireAuth, writeOffersLimiter, async (req, res) => {
    const authReq = req as AuthenticatedRequest;
    try {
        const { id } = req.params;
        const source = await prisma.offers_rel.findUnique({ where: { id } });
        if (!source) return res.status(404).json({ error: 'Oferta źródłowa nie istnieje' });
        if (!canReadDoc(authReq.user, source.userId))
            return res.status(403).json({ error: 'Brak uprawnień do odczytu oferty źródłowej' });

        const sourceItems = await prisma.offer_items_rel.findMany({ where: { offerId: id } });
        const newId = uuidv4();
        const resolved = resolveWriteUserId(authReq.user, undefined);
        if (!resolved.allowed)
            return res.status(403).json({ error: 'Brak uprawnień do utworzenia oferty' });

        await prisma.offers_rel.create({
            data: {
                id: newId,
                userId: resolved.effectiveUserId,
                offer_number: source.offer_number ? `${source.offer_number}-KOPIA` : '',
                state: 'draft',
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString(),
                transportCost: source.transportCost ?? 0,
                history: '[]',
                data: source.data || '{}'
            }
        });

        await createOfferItems(
            newId,
            sourceItems.map((i) => ({
                id: undefined,
                productId: i.productId ?? '',
                quantity: i.quantity ?? 0,
                discount: i.discount ?? 0,
                price: i.price ?? 0,
                unitPrice: i.price ?? 0
            })),
            uuidv4
        );

        logAudit('offer', newId, authReq.user?.id || '', 'duplicate', null, { sourceId: id });
        logger.info(
            'Offers',
            `Oferta ${id} zduplikowana jako ${newId} przez ${authReq.user?.username}`
        );
        return res.json({ ok: true, data: { id: newId } });
    } catch (e: unknown) {
        const message = e instanceof Error ? e.message : 'Unknown error';
        logger.error('Offers', 'Błąd POST /:id/duplicate', message);
        res.status(500).json({ error: message });
    }
});

export default router;
