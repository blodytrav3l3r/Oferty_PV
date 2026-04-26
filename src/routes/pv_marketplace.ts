import express from 'express';
import prisma from '../prismaClient';
import { requireAuth, requireAdmin, AuthenticatedRequest } from '../middleware/auth';
import { logger } from '../utils/logger';

const router = express.Router();

/**
 * SZUKAJ: Wyszukiwanie ofert
 */
router.post('/search', async (req, res) => {
    const {
        query,
        category: _category,
        region: _region,
        minPrice: _minPrice,
        maxPrice: _maxPrice,
        limit = 50,
        skip = 0
    } = req.body;

    try {
        const offers = await prisma.offers_rel.findMany();

        // Filtruj w pamięci dla zachowania kompatybilności wstecznej
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

        // Mapuj do oczekiwanego formatu
        const docsPromises = filtered.slice(skip, skip + limit).map(async (offer) => {
            const items = await prisma.offer_items_rel.findMany({
                where: { offerId: offer.id }
            });
            return {
                id: offer.id,
                type: 'offer',
                userId: offer.userId,
                title: `Oferta ${offer.offer_number || offer.id}`,
                price: items.reduce((sum, i) => sum + (i.price ?? 0) * (i.quantity ?? 0), 0),
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
    } catch (err: unknown) {
        const message = err instanceof Error ? err.message : 'Unknown error';
        logger.error('PvMarketplace', 'Błąd wyszukiwania', message);
        res.status(500).json({ error: 'Usługa wyszukiwania niedostępna' });
    }
});

/**
 * MODERACJA: Akcje administratora
 */
router.post('/moderate/:offerId', requireAuth, requireAdmin, async (req, res) => {
    const authReq = req as AuthenticatedRequest;
    if (authReq.user?.role !== 'admin') {
        return res.status(403).json({ error: 'Tylko administratorzy mogą moderować oferty' });
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
        res.status(500).json({ error: 'Moderacja nie powiodła się' });
    }
});

export default router;
