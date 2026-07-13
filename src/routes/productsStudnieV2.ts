import express from 'express';
import { requireAuth, requireAdmin } from '../middleware/auth';
import { logger } from '../utils/logger';
import { validateData } from '../validators/authSchema';
import { PRICELIST_WRITE_LIMITER } from '../middleware/rateLimiters';
import { pricelistDataSchema, productStudniePatchSchema } from '../validators/offerSchemas';
import { readPricelist, writePricelist } from '../services/pricelistService';
import prisma from '../prismaClient';
import {
    ALLOWED_FIELDS,
    toLegacy,
    PRICELIST_CONFIG_STUDNIE
} from '../services/studnieProductHelpers';
import { initStudnieProductsTable } from '../services/studnieProductInit';

const router = express.Router();
const writeLimiter = PRICELIST_WRITE_LIMITER;

export { initStudnieProductsTable };

router.get('/', requireAuth, async (_req, res) => {
    try {
        const products = await prisma.productsStudnie.findMany({
            orderBy: [{ category: 'asc' }, { componentType: 'asc' }, { id: 'asc' }]
        });
        res.json({ data: products.map(toLegacy) });
    } catch (err: unknown) {
        const message = err instanceof Error ? err.message : 'Unknown error';
        logger.error('ProductsStudnieV2', 'GET error', message);
        res.status(500).json({ error: message });
    }
});

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
                const uniqueKeys = new Map<
                    string,
                    { name: string; componentType: string | null }
                >();
                for (const item of arr) {
                    const name = String(item.category ?? '');
                    if (!name) continue;
                    const compType = item.componentType != null ? String(item.componentType) : null;
                    uniqueKeys.set(name, { name, componentType: compType });
                }
                let orderIdx = 0;
                for (const entry of uniqueKeys.values()) {
                    await tx.categoriesStudnie.upsert({
                        where: { name: entry.name },
                        update: { componentType: entry.componentType },
                        create: {
                            name: entry.name,
                            componentType: entry.componentType,
                            order: orderIdx
                        }
                    });
                    orderIdx++;
                }

                await tx.productsStudnie.deleteMany();

                for (const item of arr) {
                    await tx.productsStudnie.create({
                        data: {
                            id: String(item.id),
                            name: String(item.name ?? ''),
                            category: String(item.category ?? ''),
                            componentType: String(item.componentType ?? ''),
                            dn: item.dn != null ? String(item.dn) : null,
                            height: item.height != null ? Number(item.height) : null,
                            weight: item.weight != null ? Number(item.weight) : null,
                            price: Number(item.price ?? 0),
                            area: item.area != null ? Number(item.area) : null,
                            areaExt: item.areaExt != null ? Number(item.areaExt) : null,
                            transport: item.transport != null ? Number(item.transport) : null,
                            magazynWL: item.magazynWL != null ? Boolean(item.magazynWL) : false,
                            magazynKLB: item.magazynKLB != null ? Boolean(item.magazynKLB) : false,
                            formaStandardowa:
                                item.formaStandardowa != null
                                    ? Boolean(item.formaStandardowa)
                                    : false,
                            formaStandardowaKLB:
                                item.formaStandardowaKLB != null
                                    ? Boolean(item.formaStandardowaKLB)
                                    : false,
                            active: item.active != null ? Boolean(item.active) : false,
                            zapasDol: item.zapasDol != null ? Number(item.zapasDol) : null,
                            zapasGora: item.zapasGora != null ? Number(item.zapasGora) : null,
                            zapasDolMin: item.zapasDolMin != null ? Number(item.zapasDolMin) : null,
                            zapasGoraMin:
                                item.zapasGoraMin != null ? Number(item.zapasGoraMin) : null,
                            spocznikH: item.spocznikH != null ? String(item.spocznikH) : null,
                            hMin1: item.hMin1 != null ? Number(item.hMin1) : null,
                            hMax1: item.hMax1 != null ? Number(item.hMax1) : null,
                            cena1: item.cena1 != null ? Number(item.cena1) : null,
                            hMin2: item.hMin2 != null ? Number(item.hMin2) : null,
                            hMax2: item.hMax2 != null ? Number(item.hMax2) : null,
                            cena2: item.cena2 != null ? Number(item.cena2) : null,
                            hMin3: item.hMin3 != null ? Number(item.hMin3) : null,
                            hMax3: item.hMax3 != null ? Number(item.hMax3) : null,
                            cena3: item.cena3 != null ? Number(item.cena3) : null,
                            doplataPEHD: item.doplataPEHD != null ? Number(item.doplataPEHD) : null,
                            doplataZelbet:
                                item.doplataZelbet != null ? Number(item.doplataZelbet) : null,
                            doplataDrabNierdzewna:
                                item.doplataDrabNierdzewna != null
                                    ? Number(item.doplataDrabNierdzewna)
                                    : null,
                            malowanieWewnetrzne:
                                item.malowanieWewnetrzne != null
                                    ? Number(item.malowanieWewnetrzne)
                                    : null,
                            malowanieZewnetrzne:
                                item.malowanieZewnetrzne != null
                                    ? Number(item.malowanieZewnetrzne)
                                    : null
                        }
                    });
                }
            });

            res.json({ ok: true, count: arr.length });
        } catch (err: unknown) {
            const message = err instanceof Error ? err.message : 'Unknown error';
            logger.error('ProductsStudnieV2', 'PUT error', message);
            res.status(500).json({ error: message });
        }
    }
);

router.patch(
    '/:id',
    requireAuth,
    requireAdmin,
    writeLimiter,
    validateData(productStudniePatchSchema),
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

            const updated = await prisma.productsStudnie.update({ where: { id }, data });
            res.json({ ok: true, data: toLegacy(updated) });
        } catch (err: unknown) {
            const message = err instanceof Error ? err.message : 'Unknown error';
            logger.error('ProductsStudnieV2', 'PATCH error', message);
            res.status(500).json({ error: message });
        }
    }
);

router.delete('/:id', requireAuth, requireAdmin, writeLimiter, async (req, res) => {
    try {
        const { id } = req.params;
        await prisma.productsStudnie.delete({ where: { id } });
        res.json({ ok: true });
    } catch (err: unknown) {
        const message = err instanceof Error ? err.message : 'Unknown error';
        logger.error('ProductsStudnieV2', 'DELETE error', message);
        res.status(500).json({ error: message });
    }
});

router.get('/default', requireAuth, async (_req, res) => {
    try {
        const config = PRICELIST_CONFIG_STUDNIE;
        const data = await readPricelist(config.keyDefault);
        if (data.length === 0) {
            const products = await prisma.productsStudnie.findMany({
                orderBy: [{ category: 'asc' }, { componentType: 'asc' }, { id: 'asc' }]
            });
            const mapped = products.map(toLegacy);
            await writePricelist(config.keyDefault, mapped as unknown as Record<string, unknown>[]);
            res.json({ data: mapped });
            return;
        }
        res.json({ data });
    } catch (err: unknown) {
        const message = err instanceof Error ? err.message : 'Unknown error';
        logger.error('ProductsStudnieV2', 'GET /default error', message);
        res.json({ data: [] });
    }
});

export default router;
