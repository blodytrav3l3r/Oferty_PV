import express from 'express';
import prisma from '../../prismaClient';
import { logAudit } from '../../db';
import { requireAuth, AuthenticatedRequest } from '../../middleware/auth';
import { logger } from '../../utils/logger';
import { createRateLimiter } from '../../middleware/rateLimiter';

const router = express.Router();

const writeOffersLimiter = createRateLimiter({
    windowMs: 60 * 1000,
    maxHits: 60,
    message: 'Zbyt wiele operacji na ofertach. Odczekaj minutę.'
});

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

            if (authReq.user?.role !== 'admin' && offer.userId !== authReq.user?.id) {
                return res.status(403).json({ error: 'Brak uprawnień do odczytu tej oferty' });
            }

            let parsedData: Record<string, unknown> = {};
            try {
                if (offer.data) parsedData = JSON.parse(offer.data);
            } catch (_e) {}

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
                    history: JSON.parse(offer.history || '[]')
                }
            });
        }

        const offer = await prisma.offers_rel.findUnique({
            where: { id }
        });
        if (!offer) return res.status(404).json({ error: 'Oferta nie istnieje' });

        if (authReq.user?.role !== 'admin' && offer.userId !== authReq.user?.id) {
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

        res.json({
            data: {
                id: offer.id,
                type: 'offer',
                userId: offer.userId,
                title: `Oferta ${offer.offer_number || offer.id}`,
                price: items.reduce((sum, i) => sum + (i.price ?? 0) * (i.quantity ?? 0), 0),
                status: offer.state === 'final' ? 'active' : 'draft',
                createdAt: offer.createdAt,
                updatedAt: offer.updatedAt || offer.createdAt,
                lastEditedBy: offer.userId,
                items: items,
                transportCost: offer.transportCost || 0,
                history: JSON.parse(offer.history || '[]'),
                ...(offer.data ? JSON.parse(offer.data) : {})
            }
        });
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

            await prisma.offers_studnie_rel.delete({ where: { id } });

            logger.info('Offers', `Oferta studnie ${id} usunięta przez ${authReq.user?.username}`);
            return res.json({ ok: true });
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

        await prisma.offer_items_rel.deleteMany({
            where: { offerId: id }
        });
        await prisma.offers_rel.delete({
            where: { id }
        });

        logger.info('Offers', `Oferta rury ${id} usunięta przez ${authReq.user?.username}`);
        res.json({ ok: true });
    } catch (e: unknown) {
        const message = e instanceof Error ? e.message : 'Unknown error';
        res.status(500).json({ error: message });
    }
});

export default router;
