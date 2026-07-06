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
import {
    OfferMapped
} from '../../types/models';
import {
    offersBatchSchema
} from '../../validators/offerSchemas';

const router = express.Router();
const uuidv4 = crypto.randomUUID.bind(crypto);

const writeOffersLimiter = WRITE_LIMITER;

router.get('/', requireAuth, async (req, res) => {
    const authReq = req as AuthenticatedRequest;
    try {
        const roleClause = authReq.user ? buildRoleWhereClause(authReq.user) : undefined;
        const offers = await prisma.offers_rel.findMany({
            where: roleClause
        });

        const offerIds = offers.map(o => o.id);
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

            let ruryHistory: unknown[] = [];
            try { ruryHistory = JSON.parse(offer.history || '[]'); } catch { ruryHistory = []; }
            let rurySpread: Record<string, unknown> = {};
            if (offer.data) {
                try { rurySpread = JSON.parse(offer.data); } catch { rurySpread = {}; }
            }

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
                ...rurySpread,
                items: items,
                transportCost: offer.transportCost || 0,
                history: ruryHistory,
            });
        }

        res.json({ data: mapped });
    } catch (e: unknown) {
        const message = e instanceof Error ? e.message : 'Unknown error';
        res.status(500).json({ error: message });
    }
});

router.post('/', requireAuth, writeOffersLimiter, validateData(offersBatchSchema), async (req, res) => {
    const authReq = req as AuthenticatedRequest;
    try {
        const incoming = req.body.data || [req.body];

        const results: Record<string, unknown>[] = [];
        for (const o of incoming) {
            let docId = o.id;
            if (!docId) docId = uuidv4();

            let newHistory: unknown[] = [];
            const old = await prisma.offers_rel.findUnique({
                where: { id: docId }
            });

            let effectiveUserId: string;
            if (old) {
                if (!canWriteDoc(authReq.user, old.userId)) {
                    return res.status(403).json({ error: 'Brak uprawnień do modyfikacji tej oferty' });
                }
                effectiveUserId = old.userId || authReq.user?.id || '';
            } else {
                const resolved = resolveWriteUserId(authReq.user, o.userId);
                if (!resolved.allowed) {
                    return res.status(403).json({ error: 'Brak uprawnień do utworzenia oferty dla tego użytkownika' });
                }
                effectiveUserId = resolved.effectiveUserId;
            }

            if (old) {
                try {
                    newHistory = JSON.parse(old.history || '[]');
                } catch (_e) {}
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
            const updated = new Date().toISOString();
            const offerNumber = o.offer_number || o.number || '';
            const dataStr = JSON.stringify(o);

            await prisma.offers_rel.upsert({
                where: { id: docId },
                create: {
                    id: docId,
                    userId: effectiveUserId,
                    offer_number: offerNumber,
                    state: state,
                    createdAt: created,
                    updatedAt: updated,
                    transportCost: o.transportCost || 0,
                    history: JSON.stringify(newHistory),
                    data: dataStr
                },
                update: {
                    userId: effectiveUserId,
                    offer_number: offerNumber,
                    state: state,
                    updatedAt: updated,
                    transportCost: o.transportCost || 0,
                    history: JSON.stringify(newHistory),
                    data: dataStr
                }
            });

            await prisma.offer_items_rel.deleteMany({
                where: { offerId: docId }
            });
            const items = o.items || [];
            for (const item of items) {
                const itemId = item.id || uuidv4();
                const itemPrice = item.unitPrice !== undefined ? item.unitPrice : item.price || 0;
                await prisma.offer_items_rel.create({
                    data: {
                        id: itemId,
                        offerId: docId,
                        productId: item.productId,
                        quantity: item.quantity || 0,
                        discount: item.discount || 0,
                        price: itemPrice
                    }
                });
            }
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
});

router.put('/', requireAuth, writeOffersLimiter, validateData(offersBatchSchema), async (req, res) => {
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

        for (const o of incoming) {
            let docId = o.id;
            if (!docId) {
                docId = crypto.randomUUID();
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
            const dataStr = JSON.stringify(o);

            await prisma.offers_rel.upsert({
                where: { id: docId },
                create: {
                    id: docId,
                    userId: authReq.user?.id,
                    state: state,
                    createdAt: created,
                    transportCost: o.transportCost || 0,
                    data: dataStr
                },
                update: {
                    userId: authReq.user?.id,
                    state: state,
                    createdAt: created,
                    transportCost: o.transportCost || 0,
                    data: dataStr
                }
            });

            await prisma.offer_items_rel.deleteMany({
                where: { offerId: docId }
            });
            const items = o.items || [];
            for (const item of items) {
                const itemId = item.id || uuidv4();
                const itemPrice = item.unitPrice !== undefined ? item.unitPrice : item.price || 0;
                await prisma.offer_items_rel.create({
                    data: {
                        id: itemId,
                        offerId: docId,
                        productId: item.productId,
                        quantity: item.quantity || 0,
                        discount: item.discount || 0,
                        price: itemPrice
                    }
                });
            }
        }

        res.json({ ok: true });
    } catch (e: unknown) {
        const message = e instanceof Error ? e.message : 'Unknown error';
        res.status(500).json({ error: message });
    }
});

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

        for (const item of sourceItems) {
            await prisma.offer_items_rel.create({
                data: {
                    id: uuidv4(),
                    offerId: newId,
                    productId: item.productId,
                    quantity: item.quantity,
                    discount: item.discount,
                    price: item.price
                }
            });
        }

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
