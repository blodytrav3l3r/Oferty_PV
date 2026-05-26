import express from 'express';
import prisma from '../../prismaClient';
import { logAudit } from '../../db';
import { requireAuth, AuthenticatedRequest } from '../../middleware/auth';
import crypto from 'crypto';
import { buildRoleWhereClause } from '../../utils/roleFilter';
import { logger } from '../../utils/logger';
import { validateData } from '../../validators/authSchema';
import { createRateLimiter } from '../../middleware/rateLimiter';
import {
    OfferMapped
} from '../../types/models';
import {
    offersBatchSchema
} from '../../validators/offerSchemas';

const router = express.Router();
const uuidv4 = crypto.randomUUID.bind(crypto);

const writeOffersLimiter = createRateLimiter({
    windowMs: 60 * 1000,
    maxHits: 60,
    message: 'Zbyt wiele operacji na ofertach. Odczekaj minutę.'
});

router.get('/', requireAuth, async (req, res) => {
    const authReq = req as AuthenticatedRequest;
    try {
        const roleClause = authReq.user ? buildRoleWhereClause(authReq.user) : undefined;
        const offers = await prisma.offers_rel.findMany({
            where: roleClause
        });

        const mapped: OfferMapped[] = [];
        for (const offer of offers) {
            const itemsRaw = await prisma.offer_items_rel.findMany({
                where: { offerId: offer.id }
            });
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
                items: items,
                transportCost: offer.transportCost || 0,
                history: JSON.parse(offer.history || '[]')
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

            await prisma.offers_rel.upsert({
                where: { id: docId },
                create: {
                    id: docId,
                    userId: o.userId || authReq.user?.id,
                    offer_number: offerNumber,
                    state: state,
                    createdAt: created,
                    updatedAt: updated,
                    transportCost: o.transportCost || 0,
                    history: JSON.stringify(newHistory)
                },
                update: {
                    userId: o.userId || authReq.user?.id,
                    offer_number: offerNumber,
                    state: state,
                    updatedAt: updated,
                    transportCost: o.transportCost || 0,
                    history: JSON.stringify(newHistory)
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

            await prisma.offers_rel.upsert({
                where: { id: docId },
                create: {
                    id: docId,
                    userId: authReq.user?.id,
                    state: state,
                    createdAt: created,
                    transportCost: o.transportCost || 0
                },
                update: {
                    userId: authReq.user?.id,
                    state: state,
                    createdAt: created,
                    transportCost: o.transportCost || 0
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

export default router;
