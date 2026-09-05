import express from 'express';
import prisma from '../../prismaClient';
import { logAudit } from '../../services/auditService';
import { requireAuth, AuthenticatedRequest } from '../../middleware/auth';
import crypto from 'crypto';
import { normalizeDate } from '../../helpers';
import { searchCache } from '../../utils/searchCache';
import { syncFts5 } from '../../utils/fts5Sync';
import { buildRoleWhereClauseWithShares } from '../../utils/roleFilter';
import { logger } from '../../utils/logger';
import { validateData } from '../../validators/authSchema';
import { WRITE_LIMITER } from '../../middleware/rateLimiters';
import { canReadDoc, canWriteDoc, resolveWriteUserId } from '../../utils/ownership';
import { OfferMapped } from '../../types/models';
import { offersBatchSchema, paginationQuerySchema } from '../../validators/offerSchemas';

const router = express.Router();
const uuidv4 = crypto.randomUUID.bind(crypto);

const writeOffersLimiter = WRITE_LIMITER;

router.get('/', requireAuth, async (req, res) => {
    const authReq = req as AuthenticatedRequest;
    try {
        const pq = paginationQuerySchema.parse(req.query);
        const roleClause = authReq.user
            ? await buildRoleWhereClauseWithShares(authReq.user, 'offer')
            : undefined;
        const orderBy = pq.sort ? { [pq.sort]: pq.order } : { createdAt: 'desc' as const };
        const [offers, totalCount] = await Promise.all([
            prisma.offers_rel.findMany({
                where: roleClause,
                skip: pq.skip,
                take: pq.limit,
                orderBy,
                select: {
                    id: true,
                    userId: true,
                    offer_number: true,
                    state: true,
                    createdAt: true,
                    updatedAt: true,
                    transportCost: true,
                    clientName: true,
                    investName: true,
                    clientNumber: true
                }
            }),
            prisma.offers_rel.count({ where: roleClause })
        ]);

        const offerIds = offers.map((o) => o.id);
        const allItemsRaw = await prisma.offer_items_rel.findMany({
            where: { offerId: { in: offerIds } }
        });
        const itemsByOffer = new Map<string, typeof allItemsRaw>();
        for (const item of allItemsRaw) {
            if (!item.offerId) continue;
            const arr = itemsByOffer.get(item.offerId) || [];
            arr.push(item);
            itemsByOffer.set(item.offerId, arr);
        }

        const mapped: OfferMapped[] = [];
        for (const offer of offers) {
            const itemsRaw = itemsByOffer.get(offer.id) || [];
            const items = itemsRaw.map((i) => ({
                id: i.id,
                productId: i.productId,
                quantity: i.quantity,
                discount: i.discount,
                price: i.price,
                unitPrice: i.price ?? 0
            }));

            mapped.push({
                id: offer.id,
                type: 'offer',
                userId: offer.userId,
                title: `Oferta ${offer.offer_number || offer.id}`,
                price: items.reduce((sum, i) => sum + (i.price ?? 0) * (i.quantity ?? 0), 0),
                status: offer.state === 'final' ? 'active' : 'draft',
                createdAt: offer.createdAt || null,
                updatedAt: offer.updatedAt || offer.createdAt || null,
                lastEditedBy: offer.userId,
                clientName: offer.clientName,
                investName: offer.investName,
                clientNumber: offer.clientNumber,
                items: items,
                transportCost: offer.transportCost || 0
            });
        }

        res.json({ data: mapped, totalCount, skip: pq.skip, limit: pq.limit });
    } catch (e: unknown) {
        const message = e instanceof Error ? e.message : 'Unknown error';
        logger.error('Offers', 'Błąd serwera', message);
        res.status(500).json({ error: 'Wewnętrzny błąd serwera' });
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

            // P4-P0: prefetch jednym findMany zamiast N+1 findUnique/findMany w pętli.
            const incomingIds: string[] = incoming
                .map((o: { id?: unknown }) => o.id)
                .filter((id: unknown): id is string => typeof id === 'string' && id.length > 0);
            const oldOffers =
                incomingIds.length > 0
                    ? (await prisma.offers_rel.findMany({ where: { id: { in: incomingIds } } })) ||
                      []
                    : [];
            const oldById = new Map(oldOffers.map((o) => [o.id, o]));
            const oldItemsRows =
                oldOffers.length > 0
                    ? (await prisma.offer_items_rel.findMany({
                          where: { offerId: { in: oldOffers.map((o) => o.id) } }
                      })) || []
                    : [];
            const oldItemsByOffer = new Map<string, typeof oldItemsRows>();
            for (const row of oldItemsRows) {
                if (!row.offerId) continue;
                const arr = oldItemsByOffer.get(row.offerId);
                if (arr) arr.push(row);
                else oldItemsByOffer.set(row.offerId, [row]);
            }

            const results: Record<string, unknown>[] = [];
            const pendingWrites: Array<{
                docId: string;
                effectiveUserId: string;
                offerNumber: string;
                state: string;
                clientName: string | null;
                investName: string | null;
                clientNip: string | null;
                clientNumber: string | null;
                created: string | null;
                updated: string;
                historyStr: string;
                dataStr: string;
                transportCost: number;
                items: unknown[];
                fts: {
                    id: string;
                    offer_number: string;
                    clientName: string | null;
                    investName: string | null;
                    clientNumber: string | null;
                };
            }> = [];

            for (const o of incoming) {
                let docId = o.id;
                if (!docId) docId = uuidv4();

                let newHistory: unknown[] = [];
                const old = oldById.get(docId);

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
                    } catch (_e) {
                        logger.warn(
                            'Offers',
                            'Uszkodzony JSON history podczas zapisu oferty rur',
                            docId
                        );
                    }
                    const oldItems = oldItemsByOffer.get(docId) || [];
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
                const clientName = o.clientName || null;
                const investName = o.investName || null;
                const clientNip = o.clientNip || null;
                const clientNumber = o.clientNumber || null;
                const created = normalizeDate(o.createdAt, { exactMs: true });
                const updated = new Date().toISOString();
                const offerNumber = o.offer_number || o.number || '';
                const dataStr = JSON.stringify(o);

                pendingWrites.push({
                    docId,
                    effectiveUserId,
                    offerNumber,
                    state,
                    clientName,
                    investName,
                    clientNip,
                    clientNumber,
                    created,
                    updated,
                    historyStr: JSON.stringify(newHistory),
                    dataStr,
                    transportCost: o.transportCost || 0,
                    items: o.items || [],
                    fts: {
                        id: docId,
                        offer_number: offerNumber,
                        clientName,
                        investName,
                        clientNumber
                    }
                });
                results.push({ id: docId, ok: true });
            }

            await prisma.$transaction(async (tx) => {
                for (const w of pendingWrites) {
                    await tx.offers_rel.upsert({
                        where: { id: w.docId },
                        create: {
                            id: w.docId,
                            userId: w.effectiveUserId,
                            offer_number: w.offerNumber,
                            state: w.state,
                            clientName: w.clientName,
                            investName: w.investName,
                            clientNip: w.clientNip,
                            clientNumber: w.clientNumber,
                            createdAt: w.created,
                            updatedAt: w.updated,
                            transportCost: w.transportCost,
                            history: w.historyStr,
                            data: w.dataStr
                        },
                        update: {
                            userId: w.effectiveUserId,
                            offer_number: w.offerNumber,
                            state: w.state,
                            clientName: w.clientName,
                            investName: w.investName,
                            clientNip: w.clientNip,
                            clientNumber: w.clientNumber,
                            updatedAt: w.updated,
                            transportCost: w.transportCost,
                            history: w.historyStr,
                            data: w.dataStr
                        }
                    });

                    await tx.offer_items_rel.deleteMany({
                        where: { offerId: w.docId }
                    });
                    if (w.items.length > 0) {
                        await tx.offer_items_rel.createMany({
                            data: (
                                w.items as Array<{
                                    id?: string;
                                    unitPrice?: number;
                                    price?: number;
                                    productId: string;
                                    quantity: number;
                                    discount: number;
                                }>
                            ).map((item) => ({
                                id: item.id || uuidv4(),
                                offerId: w.docId,
                                productId: item.productId,
                                quantity: item.quantity || 0,
                                discount: item.discount || 0,
                                price:
                                    item.unitPrice !== undefined ? item.unitPrice : item.price || 0
                            }))
                        });
                    }
                }
            });
            for (const w of pendingWrites) {
                await syncFts5('rury', w.fts);
            }

            logger.info(
                'Offers',
                `Zapisano ${results.length} ofert rury przez ${authReq.user?.username}`
            );
            searchCache.invalidateAll();
            res.json({ ok: true, results });
        } catch (e: unknown) {
            const message = e instanceof Error ? e.message : 'Unknown error';
            logger.error('Offers', 'Błąd POST offers', message);
            res.status(500).json({ error: 'Wewnętrzny błąd serwera' });
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
                .map((o: { id?: unknown }) => (typeof o.id === 'string' ? o.id : ''))
                .filter(Boolean);
            if (incomingIds.length > 0) {
                const existingDocs =
                    (await prisma.offers_rel.findMany({
                        where: { id: { in: incomingIds } },
                        select: { id: true, userId: true }
                    })) || [];
                const forbidden = existingDocs.some(
                    (d: { id: string; userId: string | null }) =>
                        d.userId && !canWriteDoc(authReq.user, d.userId)
                );
                if (forbidden) {
                    return res.status(403).json({
                        error: 'Forbidden — nie masz uprawnień do modyfikacji jednej z ofert'
                    });
                }
            }

            const pendingPut: Array<{
                docId: string;
                state: string;
                clientName: string | null;
                investName: string | null;
                clientNip: string | null;
                clientNumber: string | null;
                created: string | null;
                dataStr: string;
                transportCost: number;
                items: unknown[];
                fts: {
                    id: string;
                    offer_number: string | null;
                    clientName: string | null;
                    investName: string | null;
                    clientNumber: string | null;
                };
            }> = [];
            for (const o of incoming) {
                let docId = o.id;
                if (!docId) {
                    docId = crypto.randomUUID();
                }

                const state = o.status === 'active' ? 'final' : 'draft';
                const clientName = o.clientName || null;
                const investName = o.investName || null;
                const clientNip = o.clientNip || null;
                const clientNumber = o.clientNumber || null;
                const created = normalizeDate(o.createdAt, { exactMs: true });
                const dataStr = JSON.stringify(o);

                pendingPut.push({
                    docId,
                    state,
                    clientName,
                    investName,
                    clientNip,
                    clientNumber,
                    created,
                    dataStr,
                    transportCost: o.transportCost || 0,
                    items: o.items || [],
                    fts: {
                        id: docId,
                        offer_number: o.offer_number || null,
                        clientName,
                        investName,
                        clientNumber
                    }
                });
            }

            await prisma.$transaction(async (tx) => {
                for (const w of pendingPut) {
                    await tx.offers_rel.upsert({
                        where: { id: w.docId },
                        create: {
                            id: w.docId,
                            userId: authReq.user?.id,
                            state: w.state,
                            clientName: w.clientName,
                            investName: w.investName,
                            clientNip: w.clientNip,
                            clientNumber: w.clientNumber,
                            createdAt: w.created,
                            transportCost: w.transportCost,
                            data: w.dataStr
                        },
                        update: {
                            userId: authReq.user?.id,
                            state: w.state,
                            clientName: w.clientName,
                            investName: w.investName,
                            clientNip: w.clientNip,
                            clientNumber: w.clientNumber,
                            createdAt: w.created,
                            transportCost: w.transportCost,
                            data: w.dataStr
                        }
                    });

                    await tx.offer_items_rel.deleteMany({
                        where: { offerId: w.docId }
                    });
                    if (w.items.length > 0) {
                        await tx.offer_items_rel.createMany({
                            data: (
                                w.items as Array<{
                                    id?: string;
                                    unitPrice?: number;
                                    price?: number;
                                    productId: string;
                                    quantity: number;
                                    discount: number;
                                }>
                            ).map((item) => ({
                                id: item.id || uuidv4(),
                                offerId: w.docId,
                                productId: item.productId,
                                quantity: item.quantity || 0,
                                discount: item.discount || 0,
                                price:
                                    item.unitPrice !== undefined ? item.unitPrice : item.price || 0
                            }))
                        });
                    }
                }
            });
            for (const w of pendingPut) {
                await syncFts5('rury', w.fts);
            }

            searchCache.invalidateAll();
            res.json({ ok: true });
        } catch (e: unknown) {
            const message = e instanceof Error ? e.message : 'Unknown error';
            logger.error('Offers', 'Błąd PUT offers', message);
            res.status(500).json({ error: 'Wewnętrzny błąd serwera' });
        }
    }
);

router.post('/:id/duplicate', requireAuth, writeOffersLimiter, async (req, res) => {
    const authReq = req as AuthenticatedRequest;
    try {
        const { id } = req.params;

        const source = await prisma.offers_rel.findUnique({ where: { id } });
        if (!source) {
            return res.status(404).json({ error: 'Oferta źródłowa nie istnieje' });
        }
        if (!canReadDoc(authReq.user, source.userId)) {
            return res.status(403).json({ error: 'Brak uprawnień do odczytu oferty źródłowej' });
        }

        const sourceItems = await prisma.offer_items_rel.findMany({ where: { offerId: id } });

        const newId = uuidv4();
        const resolved = resolveWriteUserId(authReq.user, undefined);
        if (!resolved.allowed) {
            return res.status(403).json({ error: 'Brak uprawnień do utworzenia oferty' });
        }

        let dupClientName: string | null = null;
        let dupInvestName: string | null = null;
        let dupClientNumber: string | null = null;
        try {
            const srcData = JSON.parse(source.data || '{}');
            dupClientName = srcData.clientName || null;
            dupInvestName = srcData.investName || null;
            dupClientNumber = srcData.clientNumber || null;
        } catch {
            logger.warn('Offers', 'Uszkodzony JSON data przy kopiowaniu oferty rur', id);
        }

        await prisma.offers_rel.create({
            data: {
                id: newId,
                userId: resolved.effectiveUserId,
                offer_number: source.offer_number ? `${source.offer_number}-KOPIA` : '',
                state: 'draft',
                clientName: dupClientName,
                investName: dupInvestName,
                clientNumber: dupClientNumber,
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString(),
                transportCost: source.transportCost ?? 0,
                history: '[]',
                data: source.data || '{}'
            }
        });

        await syncFts5('rury', {
            id: newId,
            offer_number: source.offer_number ? `${source.offer_number}-KOPIA` : '',
            clientName: dupClientName,
            investName: dupInvestName,
            clientNumber: dupClientNumber
        });

        if (sourceItems.length > 0) {
            await prisma.offer_items_rel.createMany({
                data: sourceItems.map((item) => ({
                    id: uuidv4(),
                    offerId: newId,
                    productId: item.productId,
                    quantity: item.quantity,
                    discount: item.discount,
                    price: item.price
                }))
            });
        }

        logAudit('offer', newId, authReq.user?.id || '', 'duplicate', null, { sourceId: id });

        logger.info(
            'Offers',
            `Oferta ${id} zduplikowana jako ${newId} przez ${authReq.user?.username}`
        );

        searchCache.invalidateAll();
        return res.json({ ok: true, data: { id: newId } });
    } catch (e: unknown) {
        const message = e instanceof Error ? e.message : 'Unknown error';
        logger.error('Offers', 'Błąd POST /:id/duplicate', message);
        res.status(500).json({ error: 'Wewnętrzny błąd serwera' });
    }
});

export default router;
