import express from 'express';
import { requireAuth } from '../middleware/auth';
import { logger } from '../utils/logger';
import { validateData } from '../validators/authSchema';
import { PRICELIST_WRITE_LIMITER } from '../middleware/rateLimiters';
import { pricelistDataSchema, productStudniePatchSchema } from '../validators/offerSchemas';
import {
    ensureProductsSeeded,
    readPricelist,
    writePricelist,
    PricelistConfig
} from '../services/pricelistService';
import prisma from '../prismaClient';
import type { ProductsStudnie } from '../../generated/prisma';

const router = express.Router();
const writeLimiter = PRICELIST_WRITE_LIMITER;

const config: PricelistConfig = {
    keyCurrent: 'pricelist_studnie',
    keyDefault: 'pricelist_studnie_default',
    seedPath: 'data/seed_studnie.json',
    label: 'studnie'
};

export async function initStudnieProductsTable() {
    await ensureProductsSeeded(config);

    // Usuń przejścia z prefiksem "W +" (pozostałości po starym UI)
    try {
        const wCount = await prisma.productsStudnie.deleteMany({
            where: { componentType: 'przejscie', category: { startsWith: 'W +' } }
        });
        if (wCount.count > 0) {
            await prisma.categoriesStudnie.deleteMany({
                where: { name: { startsWith: 'W +' } }
            });
            logger.info('ProductsStudnieV2', `Usunięto ${wCount.count} produktów W+ z bazy`);
        }
    } catch (e) {
        logger.warn(
            'ProductsStudnieV2',
            'Błąd czyszczenia W+:',
            e instanceof Error ? e.message : e
        );
    }

    try {
        const cnt = await prisma.productsStudnie.count();
        if (cnt > 0) return;
        const data = await readPricelist(config.keyCurrent);
        if (!Array.isArray(data) || data.length === 0) return;

        // Walidacja: wykryj stare polskie klucze, które powinny być już skonwertowane
        const STALE_KEYS = [
            'Pow. wewn. m²',
            'Pow. zewn. m²',
            'Dopłata Żelbet',
            'Wys. spocznika',
            'Hmin 1 mm',
            'Hmax 1 mm',
            'Cena 1 PLN',
            'Hmin 2 mm',
            'Hmax 2 mm',
            'Cena 2 PLN',
            'Hmin 3 mm',
            'Hmax 3 mm',
            'Cena 3 PLN'
        ];
        const staleProducts = (data as Record<string, unknown>[]).filter((p) =>
            STALE_KEYS.some((k) => p[k] !== undefined && p[k] !== null)
        );
        if (staleProducts.length > 0) {
            const sample = staleProducts
                .slice(0, 5)
                .map((p) => p.id)
                .join(', ');
            const msg = `Seed studni zawiera ${staleProducts.length} produktów ze starymi polskimi kluczami (np. ${sample}...). Uruchom: node scripts/normalize-seed-studnie.mjs --apply`;
            logger.error('ProductsStudnieV2', msg);
            throw new Error(msg);
        }

        // Kategorie — osobna, mała transakcja
        await prisma.$transaction(
            async (tx) => {
                const uniqueKeys = new Map<
                    string,
                    { name: string; componentType: string | null }
                >();
                for (const item of data) {
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
            },
            { timeout: 30000 }
        );

        // Czyszczenie poza transakcją
        await prisma.productsStudnie.deleteMany();

        // Produkty w batchach po 25 — każda partia w osobnej transakcji
        const CHUNK = 25;
        for (let i = 0; i < data.length; i += CHUNK) {
            const chunk = data.slice(i, i + CHUNK);
            await prisma.$transaction(
                async (tx) => {
                    for (const item of chunk) {
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
                                magazynKLB:
                                    item.magazynKLB != null ? Boolean(item.magazynKLB) : false,
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
                                zapasDolMin:
                                    item.zapasDolMin != null ? Number(item.zapasDolMin) : null,
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
                                doplataPEHD:
                                    item.doplataPEHD != null ? Number(item.doplataPEHD) : null,
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
                },
                { timeout: 30000 }
            );
        }

        logger.info(
            'ProductsStudnieV2',
            `Zainicjalizowano productsStudnie (${data.length} produktów) z seed`
        );
    } catch (err: unknown) {
        const message = err instanceof Error ? err.message : 'Unknown error';
        logger.warn('ProductsStudnieV2', 'Seed tabeli productsStudnie pominięty:', message);
    }
}

const ALLOWED_FIELDS = [
    'name',
    'category',
    'componentType',
    'dn',
    'height',
    'weight',
    'price',
    'area',
    'areaExt',
    'transport',
    'magazynWL',
    'magazynKLB',
    'formaStandardowa',
    'formaStandardowaKLB',
    'active',
    'zapasDol',
    'zapasGora',
    'zapasDolMin',
    'zapasGoraMin',
    'spocznikH',
    'hMin1',
    'hMax1',
    'cena1',
    'hMin2',
    'hMax2',
    'cena2',
    'hMin3',
    'hMax3',
    'cena3',
    'doplataPEHD',
    'doplataZelbet',
    'doplataDrabNierdzewna',
    'malowanieWewnetrzne',
    'malowanieZewnetrzne'
] as const;

type StudnieProductRaw = ProductsStudnie;

interface StudnieProductLegacy {
    id: string;
    name: string;
    category: string;
    componentType: string;
    dn: number | string | null;
    height: number | null;
    weight: number | null;
    price: number;
    area: number | null;
    areaExt: number | null;
    transport: number | null;
    magazynWL: number;
    magazynKLB: number;
    formaStandardowa: number;
    formaStandardowaKLB: number;
    active: number;
    zapasDol: number | null;
    zapasGora: number | null;
    zapasDolMin: number | null;
    zapasGoraMin: number | null;
    spocznikH: string | null;
    hMin1: number | null;
    hMax1: number | null;
    cena1: number | null;
    hMin2: number | null;
    hMax2: number | null;
    cena2: number | null;
    hMin3: number | null;
    hMax3: number | null;
    cena3: number | null;
    doplataPEHD: number | null;
    doplataZelbet: number | null;
    doplataDrabNierdzewna: number | null;
    malowanieWewnetrzne: number | null;
    malowanieZewnetrzne: number | null;
}

function toLegacy(p: StudnieProductRaw): StudnieProductLegacy {
    const dnVal: number | string | null =
        p.dn != null ? (isNaN(Number(p.dn)) ? p.dn : Number(p.dn)) : null;
    return {
        id: p.id,
        name: p.name,
        category: p.category,
        componentType: p.componentType,
        dn: dnVal,
        height: p.height,
        weight: p.weight,
        price: p.price,
        area: p.area,
        areaExt: p.areaExt,
        transport: p.transport,
        magazynWL: p.magazynWL ? 1 : 0,
        magazynKLB: p.magazynKLB ? 1 : 0,
        formaStandardowa: p.formaStandardowa ? 1 : 0,
        formaStandardowaKLB: p.formaStandardowaKLB ? 1 : 0,
        active: p.active ? 1 : 0,
        zapasDol: p.zapasDol,
        zapasGora: p.zapasGora,
        zapasDolMin: p.zapasDolMin,
        zapasGoraMin: p.zapasGoraMin,
        spocznikH: p.spocznikH,
        hMin1: p.hMin1,
        hMax1: p.hMax1,
        cena1: p.cena1,
        hMin2: p.hMin2,
        hMax2: p.hMax2,
        cena2: p.cena2,
        hMin3: p.hMin3,
        hMax3: p.hMax3,
        cena3: p.cena3,
        doplataPEHD: p.doplataPEHD,
        doplataZelbet: p.doplataZelbet,
        doplataDrabNierdzewna: p.doplataDrabNierdzewna,
        malowanieWewnetrzne: p.malowanieWewnetrzne,
        malowanieZewnetrzne: p.malowanieZewnetrzne
    };
}

// ──────────────────────────────────────────
// GET / — wszystkie produkty z ProductsStudnie
// ──────────────────────────────────────────
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

// ──────────────────────────────────────────
// PUT / — bulk save (usuń wszystko + utwórz)
// ──────────────────────────────────────────
router.put('/', requireAuth, writeLimiter, validateData(pricelistDataSchema), async (req, res) => {
    try {
        const arr: Record<string, unknown>[] = req.body.data;

        await prisma.$transaction(async (tx) => {
            const uniqueKeys = new Map<string, { name: string; componentType: string | null }>();
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
                            item.formaStandardowa != null ? Boolean(item.formaStandardowa) : false,
                        formaStandardowaKLB:
                            item.formaStandardowaKLB != null
                                ? Boolean(item.formaStandardowaKLB)
                                : false,
                        active: item.active != null ? Boolean(item.active) : false,
                        zapasDol: item.zapasDol != null ? Number(item.zapasDol) : null,
                        zapasGora: item.zapasGora != null ? Number(item.zapasGora) : null,
                        zapasDolMin: item.zapasDolMin != null ? Number(item.zapasDolMin) : null,
                        zapasGoraMin: item.zapasGoraMin != null ? Number(item.zapasGoraMin) : null,
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
});

// ──────────────────────────────────────────
// PATCH /:id — edytuj jeden produkt
// ──────────────────────────────────────────
router.patch(
    '/:id',
    requireAuth,
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

// ──────────────────────────────────────────
// DELETE /:id — usuń jeden produkt
// ──────────────────────────────────────────
router.delete('/:id', requireAuth, writeLimiter, async (req, res) => {
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

// ──────────────────────────────────────────
// GET /default — fallback do settings lub re-seed z DB
// ──────────────────────────────────────────
router.get('/default', requireAuth, async (_req, res) => {
    try {
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
