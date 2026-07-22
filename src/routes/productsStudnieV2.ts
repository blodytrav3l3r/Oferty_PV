import express from 'express';
import { requireAuth, requireAdmin } from '../middleware/auth';
import { logger } from '../utils/logger';
import { validateData } from '../validators/authSchema';
import { PRICELIST_WRITE_LIMITER } from '../middleware/rateLimiters';
import { pricelistDataSchema, productStudniePatchSchema } from '../validators/offerSchemas';
import prisma from '../prismaClient';

const router = express.Router();
const writeLimiter = PRICELIST_WRITE_LIMITER;

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

type StudnieProductRaw = {
    id: string;
    name: string;
    category: string;
    componentType: string;
    dn: string | null;
    height: number | null;
    weight: number | null;
    price: number;
    area: number | null;
    areaExt: number | null;
    transport: number | null;
    magazynWL: boolean;
    magazynKLB: boolean;
    formaStandardowa: boolean;
    formaStandardowaKLB: boolean;
    active: boolean;
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
};

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

function fromLegacy(p: Record<string, unknown>): Record<string, unknown> {
    return {
        id: String(p.id ?? ''),
        name: String(p.name ?? ''),
        category: String(p.category ?? ''),
        componentType: String(p.componentType ?? ''),
        dn: p.dn != null ? String(p.dn) : null,
        height: p.height != null ? Number(p.height) : null,
        weight: p.weight != null ? Number(p.weight) : null,
        price: Number(p.price ?? 0),
        area: p.area != null ? Number(p.area) : null,
        areaExt: p.areaExt != null ? Number(p.areaExt) : null,
        transport: p.transport != null ? Number(p.transport) : null,
        magazynWL: p.magazynWL === 1 || p.magazynWL === true,
        magazynKLB: p.magazynKLB === 1 || p.magazynKLB === true,
        formaStandardowa: p.formaStandardowa === 1 || p.formaStandardowa === true,
        formaStandardowaKLB: p.formaStandardowaKLB === 1 || p.formaStandardowaKLB === true,
        active: p.active === 1 || p.active === true,
        zapasDol: p.zapasDol != null ? Number(p.zapasDol) : null,
        zapasGora: p.zapasGora != null ? Number(p.zapasGora) : null,
        zapasDolMin: p.zapasDolMin != null ? Number(p.zapasDolMin) : null,
        zapasGoraMin: p.zapasGoraMin != null ? Number(p.zapasGoraMin) : null,
        spocznikH: p.spocznikH != null ? String(p.spocznikH) : null,
        hMin1: p.hMin1 != null ? Number(p.hMin1) : null,
        hMax1: p.hMax1 != null ? Number(p.hMax1) : null,
        cena1: p.cena1 != null ? Number(p.cena1) : null,
        hMin2: p.hMin2 != null ? Number(p.hMin2) : null,
        hMax2: p.hMax2 != null ? Number(p.hMax2) : null,
        cena2: p.cena2 != null ? Number(p.cena2) : null,
        hMin3: p.hMin3 != null ? Number(p.hMin3) : null,
        hMax3: p.hMax3 != null ? Number(p.hMax3) : null,
        cena3: p.cena3 != null ? Number(p.cena3) : null,
        doplataPEHD: p.doplataPEHD != null ? Number(p.doplataPEHD) : null,
        doplataZelbet: p.doplataZelbet != null ? Number(p.doplataZelbet) : null,
        doplataDrabNierdzewna:
            p.doplataDrabNierdzewna != null ? Number(p.doplataDrabNierdzewna) : null,
        malowanieWewnetrzne: p.malowanieWewnetrzne != null ? Number(p.malowanieWewnetrzne) : null,
        malowanieZewnetrzne: p.malowanieZewnetrzne != null ? Number(p.malowanieZewnetrzne) : null
    };
}

function fromLegacyPatch(patch: Record<string, unknown>): Record<string, unknown> {
    const result: Record<string, unknown> = {};
    const booleanFields = [
        'magazynWL',
        'magazynKLB',
        'formaStandardowa',
        'formaStandardowaKLB',
        'active'
    ];
    for (const [key, value] of Object.entries(patch)) {
        if (booleanFields.includes(key)) {
            result[key] = value === 1 || value === true;
        } else {
            result[key] = value;
        }
    }
    return result;
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
                await tx.productsStudnie.deleteMany();
                const mapped = arr.map(fromLegacy);
                await tx.productsStudnie.createMany({ data: mapped as never[] });
            });

            res.json({ ok: true, count: arr.length });
        } catch (err: unknown) {
            const message = err instanceof Error ? err.message : 'Unknown error';
            logger.error('ProductsStudnieV2', 'PUT error', message);
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

            const converted = fromLegacyPatch(data);
            const updated = await prisma.productsStudnie.update({
                where: { id },
                data: converted as never
            });
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

// ──────────────────────────────────────────
// GET /default — domyślne produkty z ProductsStudnieDefault
// ──────────────────────────────────────────
router.get('/default', requireAuth, async (_req, res) => {
    try {
        const products = await prisma.productsStudnieDefault.findMany({
            orderBy: [{ category: 'asc' }, { componentType: 'asc' }, { id: 'asc' }]
        });
        res.json({ data: products.map(toLegacy) });
    } catch (err: unknown) {
        const message = err instanceof Error ? err.message : 'Unknown error';
        logger.error('ProductsStudnieV2', 'GET /default error', message);
        res.json({ data: [] });
    }
});

export default router;
