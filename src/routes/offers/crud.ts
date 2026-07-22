import express from 'express';
import prisma from '../../prismaClient';
import { logAudit } from '../../services/auditService';
import { requireAuth, AuthenticatedRequest } from '../../middleware/auth';
import { logger } from '../../utils/logger';
import { WRITE_LIMITER } from '../../middleware/rateLimiters';
import { canReadDoc } from '../../utils/ownership';
import { searchCache } from '../../utils/searchCache';
import { removeFts5 } from '../../utils/fts5Sync';

const router = express.Router();

const writeOffersLimiter = WRITE_LIMITER;

router.get('/:id', requireAuth, async (req, res) => {
    const authReq = req as AuthenticatedRequest;
    try {
        const { id } = req.params;

        if (id === 'studnie') return res.status(400).json({ error: 'Nieprawidłowe ID oferty' });

        if (id.startsWith('offer_studnie_')) {
            const offer = await prisma.offers_studnie_rel.findUnique({
                where: { id }
            });
            if (!offer) return res.status(404).json({ error: 'Oferta studni nie istnieje' });

            if (!canReadDoc(authReq.user, offer.userId)) {
                return res.status(403).json({ error: 'Brak uprawnień do odczytu tej oferty' });
            }

            let parsedData: Record<string, unknown> = {};
            try {
                if (offer.data) parsedData = JSON.parse(offer.data);
            } catch (_e) {}

            let studnieHistory: unknown[] = [];
            try {
                studnieHistory = JSON.parse(offer.history || '[]');
            } catch {
                studnieHistory = [];
            }

            return res.json({
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
                    history: studnieHistory
                }
            });
        }

        const offer = await prisma.offers_rel.findUnique({
            where: { id }
        });
        if (!offer) return res.status(404).json({ error: 'Oferta nie istnieje' });

        if (!canReadDoc(authReq.user, offer.userId)) {
            return res.status(403).json({ error: 'Brak uprawnień do odczytu tej oferty' });
        }

        const itemsRaw = await prisma.offer_items_rel.findMany({
            where: { offerId: offer.id }
        });
        const items = itemsRaw.map((i) => ({
            id: i.id,
            productId: i.productId,
            quantity: i.quantity,
            discount: i.discount,
            price: i.price,
            unitPrice: i.price
        }));

        let ruryHistory: unknown[] = [];
        try {
            ruryHistory = JSON.parse(offer.history || '[]');
        } catch {
            ruryHistory = [];
        }
        let rurySpread: Record<string, unknown> = {};
        if (offer.data) {
            try {
                rurySpread = JSON.parse(offer.data);
            } catch {
                rurySpread = {};
            }
        }

        // items z offer_items_rel (podstawowe pola), rozszerzone o autoAdded z JSON bloba
        const { items: blobItems, ...cleanSpread } = rurySpread;
        const hasBlobItems = Array.isArray(blobItems) && blobItems.length > 0;
        let mergedItems: Record<string, unknown>[];
        if (hasBlobItems) {
            // Użyj pełnych itemów z JSON bloba (zawierają uid, autoAdded, pehdType itp.)
            mergedItems = blobItems as Record<string, unknown>[];
        } else {
            // Fallback: itemy z offer_items_rel bez autoAdded
            mergedItems = items.map((i) => ({ ...i, autoAdded: false }));
        }

        const responseData = {
            id: offer.id,
            type: 'offer',
            userId: offer.userId,
            title: `Oferta ${offer.offer_number || offer.id}`,
            price: items.reduce((sum, i) => sum + (i.price ?? 0) * (i.quantity ?? 0), 0),
            status: offer.state === 'final' ? 'active' : 'draft',
            createdAt: offer.createdAt,
            updatedAt: offer.updatedAt || offer.createdAt,
            lastEditedBy: offer.userId,
            items: mergedItems,
            transportCost: offer.transportCost || 0,
            history: ruryHistory,
            ...cleanSpread
        };

        // Nie nadpisuj items z cleanSpread (może zawierać nieaktualne dane),
        // ale zachowaj pozostałe pola z JSON bloba
        responseData.items = mergedItems;

        res.json({ data: responseData });
    } catch (e: unknown) {
        const message = e instanceof Error ? e.message : 'Unknown error';
        res.status(500).json({ error: message });
    }
});

router.delete('/:id', requireAuth, writeOffersLimiter, async (req, res) => {
    const authReq = req as AuthenticatedRequest;
    try {
        const { id } = req.params;

        if (id.startsWith('offer_studnie_')) {
            logger.info('Offers', 'DELETE /:id (studnie) start', { id, userId: authReq.user?.id });

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

            await removeFts5('studnie', id);
            await prisma.offers_studnie_rel.delete({ where: { id } });

            logger.info('Offers', `Oferta studnie ${id} usunięta przez ${authReq.user?.username}`);
            searchCache.invalidateAll();
            res.json({ ok: true });
            return;
        }

        const offer = await prisma.offers_rel.findUnique({
            where: { id }
        });
        if (!offer) return res.status(404).json({ error: 'Oferta nie istnieje' });

        if (authReq.user?.role !== 'admin' && offer.userId !== authReq.user?.id) {
            return res.status(403).json({ error: 'Brak uprawnien do usuniecia tej oferty' });
        }

        const oldItems = await prisma.offer_items_rel.findMany({
            where: { offerId: id }
        });
        const oldSnapshot = {
            offer_number: offer.offer_number,
            state: offer.state,
            transportCost: offer.transportCost,
            items: oldItems.map((i) => ({
                productId: i.productId,
                quantity: i.quantity,
                discount: i.discount,
                price: i.price
            }))
        };
        logAudit('offer', id, authReq.user?.id || '', 'delete', null, oldSnapshot);

        await removeFts5('rury', id);
        await prisma.offer_items_rel.deleteMany({
            where: { offerId: id }
        });
        await prisma.offers_rel.delete({
            where: { id }
        });

        logger.info('Offers', `Oferta rury ${id} usunięta przez ${authReq.user?.username}`);
        searchCache.invalidateAll();
        res.json({ ok: true });
        return;
    } catch (e: unknown) {
        const message = e instanceof Error ? e.message : 'Unknown error';
        res.status(500).json({ error: message });
    }
});

export default router;
