import express from 'express';
import prisma from '../prismaClient';
import { logAudit } from '../db';
import { requireAuth, AuthenticatedRequest } from '../middleware/auth';
import crypto from 'crypto';
import { generateOfferRuryPDF, generateOfferStudniePDF } from '../services/pdfGenerator';
import { generateOfferRuryDOCX, generateOfferStudnieDOCX } from '../services/docxGenerator';

const router = express.Router();
const uuidv4 = crypto.randomUUID.bind(crypto);

/* ===== OFFERS (RURY + STUDNIE) ===== */

// GET /api/offers-rury - Pobiera oferty rur
router.get('/', requireAuth as any, async (req, res) => {
    const authReq = req as AuthenticatedRequest;
    try {
        let offers: any[];
        if (authReq.user?.role === 'admin') {
            offers = await prisma.offers_rel.findMany();
        } else if (authReq.user?.role === 'pro') {
            const allowedIds = [authReq.user?.id, ...(authReq.user?.subUsers || [])];
            offers = await prisma.offers_rel.findMany({
                where: { userId: { in: allowedIds } }
            });
        } else {
            offers = await prisma.offers_rel.findMany({
                where: { userId: authReq.user?.id }
            });
        }

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

// GET /api/offers/studnie - Pobiera oferty typu 'studnia_oferta'
router.get('/studnie', requireAuth as any, async (req, res) => {
    const authReq = req as AuthenticatedRequest;
    try {
        let offers: any[];
        if (authReq.user?.role === 'admin') {
            offers = await prisma.offers_studnie_rel.findMany();
        } else if (authReq.user?.role === 'pro') {
            const allowedIds = [authReq.user?.id, ...(authReq.user?.subUsers || [])];
            offers = await prisma.offers_studnie_rel.findMany({
                where: { userId: { in: allowedIds } }
            });
        } else {
            offers = await prisma.offers_studnie_rel.findMany({
                where: { userId: authReq.user?.id }
            });
        }

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

// POST /api/offers-rury - Zapis pojedynczej oferty Rury
router.post('/', requireAuth as any, async (req, res) => {
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

        console.log(`[POST] Zapisano ${results.length} ofert rury przez ${authReq.user?.username}`);
        res.json({ ok: true, results });
    } catch (e: any) {
        console.error('[POST offers] Error:', e.message);
        res.status(500).json({ error: e.message });
    }
});

// POST /api/offers-studnie - Zapis pojedynczej oferty Studnie
router.post('/studnie', requireAuth as any, async (req, res) => {
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

        console.log(
            `[POST] Zapisano ${results.length} ofert studnie przez ${authReq.user?.username}`
        );
        res.json({ ok: true, results });
    } catch (e: any) {
        console.error('[POST offers/studnie] Error:', e.message);
        res.status(500).json({ error: e.message });
    }
});

// PUT /api/offers - Masowy zapis (rury)
router.put('/', requireAuth as any, async (req, res) => {
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

// PUT /api/offers/studnie - Masowy zapis Studni
router.put('/studnie', requireAuth as any, async (req, res) => {
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

// DELETE /api/offers-rury/:id - Usuwanie oferty Rury
router.delete('/:id', requireAuth as any, async (req, res) => {
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

        console.log(`[DELETE] Oferta rury ${id} usunieta przez ${authReq.user?.username}`);
        res.json({ ok: true });
    } catch (e: any) {
        res.status(500).json({ error: e.message });
    }
});

// DELETE /api/offers-studnie/:id - Usuwanie oferty Studnie
router.delete('/studnie/:id', requireAuth as any, async (req, res) => {
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

        console.log(`[DELETE] Oferta studnie ${id} usunieta przez ${authReq.user?.username}`);
        res.json({ ok: true });
    } catch (e: any) {
        res.status(500).json({ error: e.message });
    }
});

/* ===== EXPORT ENDPOINTS ===== */

// GET /api/offers-rury/:id/export-pdf
router.get('/:id/export-pdf', requireAuth as any, async (req, res) => {
    try {
        const { id } = req.params;
        const pdfBuffer = await generateOfferRuryPDF(id);
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `attachment; filename="oferta_rury_${id}.pdf"`);
        res.send(pdfBuffer);
    } catch (e: any) {
        console.error('[PDF Export Error]', e.message);
        res.status(500).json({ error: e.message });
    }
});

// GET /api/offers-studnie/:id/export-pdf
router.get('/studnie/:id/export-pdf', requireAuth as any, async (req, res) => {
    try {
        const { id } = req.params;
        const pdfBuffer = await generateOfferStudniePDF(id);
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `attachment; filename="oferta_studnie_${id}.pdf"`);
        res.send(pdfBuffer);
    } catch (e: any) {
        console.error('[PDF Export Error]', e.message);
        res.status(500).json({ error: e.message });
    }
});

// GET /api/offers-rury/:id/export-docx
router.get('/:id/export-docx', requireAuth as any, async (req, res) => {
    try {
        const { id } = req.params;
        const docxBuffer = await generateOfferRuryDOCX(id);
        res.setHeader(
            'Content-Type',
            'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
        );
        res.setHeader('Content-Disposition', `attachment; filename="oferta_rury_${id}.docx"`);
        res.send(docxBuffer);
    } catch (e: any) {
        console.error('[DOCX Export Error]', e.message);
        res.status(500).json({ error: e.message });
    }
});

// GET /api/offers-studnie/:id/export-docx
router.get('/studnie/:id/export-docx', requireAuth as any, async (req, res) => {
    try {
        const { id } = req.params;
        const docxBuffer = await generateOfferStudnieDOCX(id);
        res.setHeader(
            'Content-Type',
            'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
        );
        res.setHeader('Content-Disposition', `attachment; filename="oferta_studnie_${id}.docx"`);
        res.send(docxBuffer);
    } catch (e: any) {
        console.error('[DOCX Export Error]', e.message);
        res.status(500).json({ error: e.message });
    }
});

export default router;
