import express from 'express';
import prisma from '../prismaClient';
import { requireAuth, requireAdmin, AuthenticatedRequest } from '../middleware/auth';

const router = express.Router();

/**
 * SEARCH: Wyszukiwanie ofert
 */
router.post('/search', async (req, res) => {
    const { query, category: _category, region: _region, minPrice: _minPrice, maxPrice: _maxPrice, limit = 50, skip = 0 } = req.body;

    try {
        let offers: any[];
        offers = await prisma.offers_rel.findMany();

        // Filter in memory for backward compatibility
        const filtered = offers.filter((offer) => {
            if (query) {
                const q = query.toLowerCase();
                const offerNum = String(offer.offer_number || '').toLowerCase();
                if (!offerNum.includes(q)) {
                    return false;
                }
            }
            return true;
        });

        // Map to expected format
        const docsPromises = filtered.slice(skip, skip + limit).map(async (offer) => {
            const items = await prisma.offer_items_rel.findMany({
                where: { offerId: offer.id }
            });
            return {
                id: offer.id,
                type: 'offer',
                userId: offer.userId,
                title: `Oferta ${offer.offer_number || offer.id}`,
                price: items.reduce((sum: number, i: any) => sum + i.price * i.quantity, 0),
                status: offer.state === 'final' ? 'active' : 'draft',
                createdAt: offer.createdAt,
                updatedAt: offer.updatedAt || offer.createdAt,
                items: items,
                transportCost: offer.transportCost || 0
            };
        });

        const docs = await Promise.all(docsPromises);

        res.json({
            docs,
            bookmark: null
        });
    } catch (err: any) {
        console.error('[PV Search] Error:', err.message);
        res.status(500).json({ error: 'Search service unavailable' });
    }
});

/**
 * MODERACJA: Akcje administratora
 */
router.post('/moderate/:offerId', requireAuth as any, requireAdmin as any, async (req, res) => {
    const authReq = req as AuthenticatedRequest;
    if (authReq.user?.role !== 'admin') {
        return res.status(403).json({ error: 'Only admins can moderate offers' });
    }

    const { action, reason: _reason } = req.body;
    const docId = req.params.offerId;

    try {
        const newState = action === 'block' ? 'blocked' : 'final';
        await prisma.offers_rel.update({
            where: { id: docId },
            data: { state: newState }
        });

        res.json({ ok: true, status: newState });
    } catch (_err) {
        res.status(500).json({ error: 'Moderation failed' });
    }
});

export default router;
