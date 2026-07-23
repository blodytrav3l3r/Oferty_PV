import express from 'express';
import { requireAuth, requireAdmin } from '../middleware/auth';
import { logger } from '../utils/logger';
import { validateData } from '../validators/authSchema';
import { PRICELIST_WRITE_LIMITER } from '../middleware/rateLimiters';
import { pricelistDataSchema, productPatchSchema } from '../validators/offerSchemas';
import { createModuleLock } from '../middleware/writeLock';
import prisma from '../prismaClient';

const router = express.Router();
const writeLimiter = PRICELIST_WRITE_LIMITER;

const ALLOWED_FIELDS = ['name', 'category', 'price', 'transport', 'weight', 'area'] as const;

const { acquireLock, releaseLock } = createModuleLock();

// ──────────────────────────────────────────
// GET / — wszystkie produkty z ProductsRury
// ──────────────────────────────────────────
router.get('/', requireAuth, async (_req, res) => {
    try {
        const products = await prisma.productsRury.findMany({
            orderBy: [{ category: 'asc' }, { id: 'asc' }]
        });
        res.json({ data: products });
    } catch (err: unknown) {
        const message = err instanceof Error ? err.message : 'Unknown error';
        logger.error('ProductsV2', 'GET error', message);
        res.status(500).json({ error: message });
    }
});

// ──────────────────────────────────────────
// PUT / — bulk save (usuń wszystko + utwórz)
// ──────────────────────────────────────────
router.put(
    '/',
    requireAuth,
    requireAdmin,
    writeLimiter,
    validateData(pricelistDataSchema),
    async (req, res) => {
        try {
            const lockAcquired = await acquireLock();
            if (!lockAcquired) {
                res.status(429).json({ error: 'Zapis w toku, spróbuj ponownie za chwilę' });
                return;
            }

            const arr: Record<string, unknown>[] = req.body.data;
            const mapped = arr.map((item) => ({
                id: String(item.id),
                name: String(item.name ?? ''),
                category: String(item.category ?? ''),
                price: Number(item.price ?? 0),
                transport: item.transport != null ? Number(item.transport) : null,
                weight: item.weight != null ? Number(item.weight) : null,
                area: item.area != null ? Number(item.area) : null
            }));

            await prisma.$transaction([
                prisma.productsRury.deleteMany(),
                prisma.productsRury.createMany({ data: mapped })
            ]);

            res.json({ ok: true, count: arr.length });
        } catch (err: unknown) {
            const message = err instanceof Error ? err.message : 'Unknown error';
            logger.error('ProductsV2', 'PUT error', message);
            res.status(500).json({ error: message });
        } finally {
            releaseLock();
        }
    }
);

// ──────────────────────────────────────────
// PATCH /:id — edytuj jeden produkt
// ──────────────────────────────────────────
router.patch(
    '/:id',
    requireAuth,
    requireAdmin,
    writeLimiter,
    validateData(productPatchSchema),
    async (req, res) => {
        try {
            const lockAcquired = await acquireLock();
            if (!lockAcquired) {
                res.status(429).json({ error: 'Zapis w toku, spróbuj ponownie za chwilę' });
                return;
            }

            const { id } = req.params;
            const data: Record<string, unknown> = {};
            for (const key of ALLOWED_FIELDS) {
                if (req.body[key] !== undefined) {
                    data[key] = req.body[key];
                }
            }
            if (Object.keys(data).length === 0) {
                res.status(400).json({ error: 'Brak pól do aktualizacji' });
                return;
            }

            const updated = await prisma.productsRury.update({ where: { id }, data });
            res.json({ ok: true, data: updated });
        } catch (err: unknown) {
            const message = err instanceof Error ? err.message : 'Unknown error';
            logger.error('ProductsV2', 'PATCH error', message);
            res.status(500).json({ error: message });
        } finally {
            releaseLock();
        }
    }
);

// ──────────────────────────────────────────
// DELETE /:id — usuń jeden produkt
// ──────────────────────────────────────────
router.delete('/:id', requireAuth, requireAdmin, writeLimiter, async (req, res) => {
    try {
        const lockAcquired = await acquireLock();
        if (!lockAcquired) {
            res.status(429).json({ error: 'Zapis w toku, spróbuj ponownie za chwilę' });
            return;
        }

        const { id } = req.params;
        await prisma.productsRury.delete({ where: { id } });
        res.json({ ok: true });
    } catch (err: unknown) {
        const message = err instanceof Error ? err.message : 'Unknown error';
        logger.error('ProductsV2', 'DELETE error', message);
        res.status(500).json({ error: message });
    } finally {
        releaseLock();
    }
});

// ──────────────────────────────────────────
// GET /default — domyślny cennik
// ──────────────────────────────────────────
router.get('/default', requireAuth, async (_req, res) => {
    try {
        const products = await prisma.productsRuryDefault.findMany({
            orderBy: [{ category: 'asc' }, { id: 'asc' }]
        });
        res.json({ data: products });
    } catch (err: unknown) {
        const message = err instanceof Error ? err.message : 'Unknown error';
        logger.error('ProductsV2', 'GET /default error', message);
        res.status(500).json({ error: message });
    }
});

export default router;
