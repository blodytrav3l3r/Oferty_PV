import express from 'express';
import { requireAuth, requireAdmin } from '../middleware/auth';
import { logger } from '../utils/logger';
import { validateData } from '../validators/authSchema';
import { PRICELIST_WRITE_LIMITER } from '../middleware/rateLimiters';
import { pricelistDataSchema, productPatchSchema } from '../validators/offerSchemas';
import {
    ensureProductsSeeded,
    readPricelist,
    writePricelist,
    PricelistConfig
} from '../services/pricelistService';
import prisma from '../prismaClient';

const router = express.Router();
const writeLimiter = PRICELIST_WRITE_LIMITER;

const config: PricelistConfig = {
    keyCurrent: 'pricelist_rury',
    keyDefault: 'pricelist_rury_default',
    seedPath: 'data/seed_rury.json',
    label: 'rury'
};

export async function initRuryProductsTable() {
    await ensureProductsSeeded(config);
    try {
        const cnt = await prisma.productsRury.count();
        if (cnt > 0) return;
        const data = await readPricelist(config.keyCurrent);
        if (!Array.isArray(data) || data.length === 0) return;
        await prisma.$transaction(
            async (tx) => {
                const cats = [...new Set(data.map((p) => String(p.category)).filter(Boolean))];
                for (let i = 0; i < cats.length; i++) {
                    await tx.categoriesRury.upsert({
                        where: { name: cats[i] },
                        update: {},
                        create: { name: cats[i], order: i }
                    });
                }
                await tx.productsRury.deleteMany();
                for (const item of data) {
                    await tx.productsRury.create({
                        data: {
                            id: String(item.id),
                            name: String(item.name ?? ''),
                            category: String(item.category ?? ''),
                            price: Number(item.price ?? 0),
                            transport: item.transport != null ? Number(item.transport) : null,
                            weight: item.weight != null ? Number(item.weight) : null,
                            area: item.area != null ? Number(item.area) : null
                        }
                    });
                }
            },
            { timeout: 120000 }
        );
        logger.info(
            'ProductsV2',
            `Zainicjalizowano productsRury (${data.length} produktów) z seed`
        );
    } catch (err: unknown) {
        const message = err instanceof Error ? err.message : 'Unknown error';
        logger.warn('ProductsV2', 'Seed tabeli productsRury pominięty:', message);
    }
}

const ALLOWED_FIELDS = ['name', 'category', 'price', 'transport', 'weight', 'area'] as const;

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
            const arr: Record<string, unknown>[] = req.body.data;

            await prisma.$transaction(async (tx) => {
                const cats = [...new Set(arr.map((p) => String(p.category)).filter(Boolean))];
                for (let i = 0; i < cats.length; i++) {
                    await tx.categoriesRury.upsert({
                        where: { name: cats[i] },
                        update: {},
                        create: { name: cats[i], order: i }
                    });
                }

                await tx.productsRury.deleteMany();

                for (const item of arr) {
                    await tx.productsRury.create({
                        data: {
                            id: String(item.id),
                            name: String(item.name ?? ''),
                            category: String(item.category ?? ''),
                            price: Number(item.price ?? 0),
                            transport: item.transport != null ? Number(item.transport) : null,
                            weight: item.weight != null ? Number(item.weight) : null,
                            area: item.area != null ? Number(item.area) : null
                        }
                    });
                }
            });

            res.json({ ok: true, count: arr.length });
        } catch (err: unknown) {
            const message = err instanceof Error ? err.message : 'Unknown error';
            logger.error('ProductsV2', 'PUT error', message);
            res.status(500).json({ error: message });
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
        }
    }
);

// ──────────────────────────────────────────
// DELETE /:id — usuń jeden produkt
// ──────────────────────────────────────────
router.delete('/:id', requireAuth, requireAdmin, writeLimiter, async (req, res) => {
    try {
        const { id } = req.params;
        await prisma.productsRury.delete({ where: { id } });
        res.json({ ok: true });
    } catch (err: unknown) {
        const message = err instanceof Error ? err.message : 'Unknown error';
        logger.error('ProductsV2', 'DELETE error', message);
        res.status(500).json({ error: message });
    }
});

// ──────────────────────────────────────────
// GET /default — fallback do settings lub re-seed z DB
// ──────────────────────────────────────────
router.get('/default', requireAuth, async (_req, res) => {
    try {
        const data = await readPricelist(config.keyDefault);
        if (data.length === 0) {
            const products = await prisma.productsRury.findMany({
                orderBy: [{ category: 'asc' }, { id: 'asc' }]
            });
            await writePricelist(config.keyDefault, products);
            res.json({ data: products });
            return;
        }
        res.json({ data });
    } catch (err: unknown) {
        const message = err instanceof Error ? err.message : 'Unknown error';
        logger.error('ProductsV2', 'GET /default error', message);
        res.json({ data: [] });
    }
});

export default router;
