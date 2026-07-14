import express from 'express';
import prisma from '../prismaClient';
import { requireAuth, requireAdmin, AuthenticatedRequest } from '../middleware/auth';
import { logger } from '../utils/logger';
import { validateData } from '../validators/authSchema';
import { marketplaceSearchSchema, marketplaceModerateSchema } from '../validators/offerSchemas';
import { buildRoleWhereClause } from '../utils/roleFilter';

const router = express.Router();

/**
 * SZUKAJ: Wyszukiwanie ofert
 */
router.post('/search', requireAuth, validateData(marketplaceSearchSchema), async (req, res) => {
    const authReq = req as AuthenticatedRequest;
    const { query, limit = 50, skip = 0 } = req.body;

    try {
        const roleFilter = authReq.user ? buildRoleWhereClause(authReq.user) : undefined;
        const whereClause: Record<string, unknown> = {
            ...roleFilter
        };
        if (query) {
            whereClause.offer_number = { contains: query };
        }

        // Pobierz oferty z bazy (z filtratem po numerze oferty)
        const offers = await prisma.offers_rel.findMany({
            where: whereClause,
            skip,
            take: limit
        });

        if (offers.length === 0) {
            res.json({ docs: [], bookmark: null });
            return;
        }

        // Pobierz WSZYSTKIE itemy dla tych ofert jednym zapytaniem (N+1 fix)
        const offerIds = offers.map((o) => o.id);
        const allItems = await prisma.offer_items_rel.findMany({
            where: { offerId: { in: offerIds } }
        });

        // Zmapuj itemy do ofert
        const itemsByOfferId = new Map<string, typeof allItems>();
        for (const item of allItems) {
            if (!item.offerId) continue;
            if (!itemsByOfferId.has(item.offerId)) {
                itemsByOfferId.set(item.offerId, []);
            }
            itemsByOfferId.get(item.offerId)!.push(item);
        }

        // Mapuj do oczekiwanego formatu
        const docs = offers.map((offer) => {
            const items = itemsByOfferId.get(offer.id) || [];
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
router.post(
    '/moderate/:offerId',
    requireAuth,
    requireAdmin,
    validateData(marketplaceModerateSchema),
    async (req, res) => {
        const authReq = req as AuthenticatedRequest;
        if (authReq.user?.role !== 'admin') {
            return res.status(403).json({ error: 'Tylko administratorzy mogą moderować oferty' });
        }

        const { action, reason: _reason } = req.body;
        const docId = req.params.offerId;

        try {
            const actionMap: Record<string, string> = {
                approve: 'final',
                reject: 'blocked',
                hide: 'blocked'
            };
            const newState = actionMap[action] || 'draft';
            await prisma.offers_rel.update({
                where: { id: docId },
                data: { state: newState }
            });

            res.json({ ok: true, status: newState });
        } catch (_err) {
            res.status(500).json({ error: 'Moderacja nie powiodła się' });
        }
    }
);

export default router;
