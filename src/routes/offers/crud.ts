import express from 'express';
import prisma from '../../prismaClient';
import { logAudit } from '../../db';
import { requireAuth, AuthenticatedRequest } from '../../middleware/auth';
import crypto from 'crypto';
import { buildRoleWhereClause } from '../../utils/roleFilter';
import { logger } from '../../utils/logger';

const router = express.Router();
const uuidv4 = crypto.randomUUID.bind(crypto);

/* ===== OFFERS RURY — GET ===== */

router.get('/', requireAuth, async (req, res) => {
    const authReq = req as AuthenticatedRequest;
    try {
        const roleClause = authReq.user ? buildRoleWhereClause(authReq.user) : undefined;
        const offers = await prisma.offers_rel.findMany({
            where: roleClause
        });

        const mapped: any[] = [];
        for (const offer of offers) {
            const itemsRaw = await prisma.offer_items_rel.findMany({
                where: { offerId: offer.id }
            });
            const items = itemsRaw.map((i: any) => ({
                id: i.id,
                productId: i.productId,
                quantity: i.quantity,
                discount: i.discount,
                price: i.price,
                unitPrice: i.price
            }));

            mapped.push({
                id: offer.id,
                type: 'offer',
                userId: offer.userId,
                title: `Oferta ${offer.offer_number || offer.id}`,
                price: items.reduce((sum: number, i: any) => sum + i.price * i.quantity, 0),
                status: offer.state === 'final' ? 'active' : 'draft',
                createdAt: offer.createdAt,
                updatedAt: offer.updatedAt || offer.createdAt,
                lastEditedBy: offer.userId,
                items: items,
                transportCost: offer.transportCost || 0,
                history: JSON.parse(offer.history || '[]')
            });
        }

        res.json({ data: mapped });
    } catch (e: any) {
        res.status(500).json({ error: e.message });
    }
});

/* ===== OFFERS STUDNIE — GET ===== */

router.get('/studnie', requireAuth, async (req, res) => {
    const authReq = req as AuthenticatedRequest;
    try {
        const roleClause = authReq.user ? buildRoleWhereClause(authReq.user) : undefined;
        const offers = await prisma.offers_studnie_rel.findMany({
            where: roleClause
        });

        const mapped = offers.map((offer) => {
            let parsedData: any = {};
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
                createdAt: offer.createdAt,
                updatedAt: offer.updatedAt || offer.createdAt,
                lastEditedBy: offer.userId,
                data: parsedData,
                history: JSON.parse(offer.history || '[]')
            };
        });

        res.json({ data: mapped });
    } catch (e: any) {
        res.status(500).json({ error: e.message });
    }
});

/* ===== OFFERS RURY — POST (single) ===== */

router.post('/', requireAuth, async (req, res) => {
    const authReq = req as AuthenticatedRequest;
    try {
        const incoming = req.body.data || [req.body];

        const results: any[] = [];
        for (const o of incoming) {
            let docId = o.id;
            if (!docId) docId = uuidv4();

            // Snapshot current state for history
            let newHistory: any[] = [];
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
                    items: oldItems.map((i: any) => ({
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
            const created = o.createdAt || new Date().toISOString();
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

            // Delete old items and insert new ones
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

        logger.info('Offers', `Zapisano ${results.length} ofert rury przez ${authReq.user?.username}`);
        res.json({ ok: true, results });
    } catch (e: any) {
        logger.error('Offers', 'POST offers error', e.message);
        res.status(500).json({ error: e.message });
    }
});

/* ===== OFFERS STUDNIE — POST (single) ===== */

router.post('/studnie', requireAuth, async (req, res) => {
    const authReq = req as AuthenticatedRequest;
    try {
        const incoming = req.body.data || [req.body];

        const results: any[] = [];
        for (const o of incoming) {
            let docId = o.id;
            if (!docId) docId = uuidv4();

            let newHistory: any[] = [];
            const old = await prisma.offers_studnie_rel.findUnique({
                where: { id: docId },
                select: { history: true, updatedAt: true, createdAt: true, data: true, state: true }
            });
            if (old) {
                try {
                    newHistory = JSON.parse(old.history || '[]');
                } catch (_e) {}
                const snapshot = {
                    updatedAt: old.updatedAt || old.createdAt,
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
            const created = o.createdAt || new Date().toISOString();
            const updated = new Date().toISOString();
            const offerNumber = o.number || o.offer_number || '';

            await prisma.offers_studnie_rel.upsert({
                where: { id: docId },
                create: {
                    id: docId,
                    userId: o.userId || authReq.user?.id,
                    offer_number: offerNumber,
                    state: state,
                    createdAt: created,
                    updatedAt: updated,
                    data: JSON.stringify(o),
                    history: JSON.stringify(newHistory)
                },
                update: {
                    userId: o.userId || authReq.user?.id,
                    offer_number: offerNumber,
                    state: state,
                    updatedAt: updated,
                    data: JSON.stringify(o),
                    history: JSON.stringify(newHistory)
                }
            });
            results.push({ id: docId, ok: true });
        }

        logger.info('Offers', `Zapisano ${results.length} ofert studnie przez ${authReq.user?.username}`);
        res.json({ ok: true, results });
    } catch (e: any) {
        logger.error('Offers', 'POST offers/studnie error', e.message);
        res.status(500).json({ error: e.message });
    }
});

/* ===== OFFERS RURY — PUT (bulk) ===== */

router.put('/', requireAuth, async (req, res) => {
    const authReq = req as AuthenticatedRequest;
    try {
        const incoming = req.body.data || [];

        for (const o of incoming) {
            let docId = o.id;
            if (!docId) {
                docId = Date.now().toString() + '_' + Math.random().toString(36).substr(2, 5);
            }

            const state = o.status === 'active' ? 'final' : 'draft';
            const created = o.createdAt || new Date().toISOString();

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

            // Refresh items
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
    } catch (e: any) {
        res.status(500).json({ error: e.message });
    }
});

/* ===== OFFERS STUDNIE — PUT (bulk) ===== */

router.put('/studnie', requireAuth, async (req, res) => {
    const authReq = req as AuthenticatedRequest;
    try {
        const incoming = req.body.data || [];

        for (const o of incoming) {
            let docId = o.id;
            if (!docId) {
                docId = Date.now().toString() + '_' + Math.random().toString(36).substr(2, 5);
            }

            const state = o.status === 'active' ? 'final' : 'draft';
            const created = o.createdAt || new Date().toISOString();

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
    } catch (e: any) {
        res.status(500).json({ error: e.message });
    }
});

/* ===== DELETE ===== */

router.delete('/:id', requireAuth, async (req, res) => {
    const authReq = req as AuthenticatedRequest;
    try {
        const { id } = req.params;

        const offer = await prisma.offers_rel.findUnique({
            where: { id }
        });
        if (!offer) return res.status(404).json({ error: 'Oferta nie istnieje' });

        if (authReq.user?.role !== 'admin' && offer.userId !== authReq.user?.id) {
            return res.status(403).json({ error: 'Brak uprawnien do usuniecia tej oferty' });
        }

        // Audit: zachowaj snapshot przed usunieciem
        const oldItems = await prisma.offer_items_rel.findMany({
            where: { offerId: id }
        });
        const oldSnapshot = {
            offer_number: offer.offer_number,
            state: offer.state,
            transportCost: offer.transportCost,
            items: oldItems.map((i: any) => ({
                productId: i.productId,
                quantity: i.quantity,
                discount: i.discount,
                price: i.price
            }))
        };
        logAudit('offer', id, authReq.user?.id || '', 'delete', null, oldSnapshot);

        await prisma.offer_items_rel.deleteMany({
            where: { offerId: id }
        });
        await prisma.offers_rel.delete({
            where: { id }
        });

        logger.info('Offers', `Oferta rury ${id} usunięta przez ${authReq.user?.username}`);
        res.json({ ok: true });
    } catch (e: any) {
        res.status(500).json({ error: e.message });
    }
});

router.delete('/studnie/:id', requireAuth, async (req, res) => {
    const authReq = req as AuthenticatedRequest;
    try {
        const { id } = req.params;

        const offer = await prisma.offers_studnie_rel.findUnique({
            where: { id }
        });
        if (!offer) return res.status(404).json({ error: 'Oferta studni nie istnieje' });

        if (authReq.user?.role !== 'admin' && offer.userId !== authReq.user?.id) {
            return res.status(403).json({ error: 'Brak uprawnien do usuniecia tej oferty' });
        }

        // Audit
        let oldData: any = {};
        try {
            oldData = JSON.parse(offer.data || '{}');
        } catch (_e) {}
        logAudit('studnia_oferta', id, authReq.user?.id || '', 'delete', null, oldData);

        await prisma.offers_studnie_rel.delete({
            where: { id }
        });

        logger.info('Offers', `Oferta studnie ${id} usunięta przez ${authReq.user?.username}`);
        res.json({ ok: true });
    } catch (e: any) {
        res.status(500).json({ error: e.message });
    }
});

export default router;
