import express from 'express';
import fs from 'fs';
import path from 'path';
import { requireAuth } from '../middleware/auth';
import { logger } from '../utils/logger';
import { PRECO_PRICING_LIMITER } from '../middleware/rateLimiters';
import { validateData } from '../validators/authSchema';
import { precoPricingUpdateSchema, precoPricingPatchSchema } from '../validators/offerSchemas';
import { readPricelist, writePricelist } from '../services/pricelistService';
import prisma from '../prismaClient';

const router = express.Router();
const writeLimiter = PRECO_PRICING_LIMITER;

const SETTINGS_KEY = 'preco_pricing';
const SETTINGS_KEY_DEFAULT = 'preco_pricing_default';

type PrecoEntry = Record<string, unknown>;

const RANGE_TYPES = ['spadekKineta', 'spadekMufa', 'uniesienie', 'redukcja'] as const;

// Seed PRECO przy starcie jeśli puste
(async function seedPrecoTables() {
    try {
        const existing = await prisma.settings.findUnique({
            where: { key: SETTINGS_KEY }
        });
        if (existing) return;

        const seedPath = path.resolve('data/seed_preco.json');
        if (!fs.existsSync(seedPath)) return;
        const raw = fs.readFileSync(seedPath, 'utf-8');
        const data = JSON.parse(raw);
        if (!Array.isArray(data) || data.length === 0) return;
        const json = JSON.stringify(data);
        await prisma.settings.upsert({
            where: { key: SETTINGS_KEY },
            update: { value: json },
            create: { key: SETTINGS_KEY, value: json }
        });
        await prisma.settings.upsert({
            where: { key: SETTINGS_KEY_DEFAULT },
            update: { value: json },
            create: { key: SETTINGS_KEY_DEFAULT, value: json }
        });
        logger.info('PrecoPricingV2', 'Zainicjalizowano PRECO z seed');
    } catch (err: unknown) {
        const message = err instanceof Error ? err.message : 'Unknown error';
        logger.warn('PrecoPricingV2', 'Seed PRECO skipped:', message);
    }
})();

// ──────────────────────────────────────────
// GET / — pełna struktura PRECO z settings
// ──────────────────────────────────────────
router.get('/', requireAuth, async (_req, res) => {
    try {
        const data = await readPricelist(SETTINGS_KEY);
        if (Array.isArray(data) && data.length > 0) {
            res.json({ data });
        } else {
            res.json({ data: [{}] });
        }
    } catch (err: unknown) {
        const message = err instanceof Error ? err.message : 'Unknown error';
        logger.error('PrecoPricingV2', 'GET error', message);
        res.status(500).json({ error: message });
    }
});

// ──────────────────────────────────────────
// PUT / — pełny zapis struktury PRECO
// ──────────────────────────────────────────
router.put(
    '/',
    requireAuth,
    writeLimiter,
    validateData(precoPricingUpdateSchema),
    async (req, res) => {
        try {
            const raw = req.body.data;
            let input: PrecoEntry;

            if (Array.isArray(raw) && raw.length > 0 && typeof raw[0] === 'object') {
                input = raw[0] as PrecoEntry;
            } else if (raw && typeof raw === 'object' && !Array.isArray(raw)) {
                input = raw as PrecoEntry;
            } else {
                res.status(400).json({ error: 'Nieprawidłowy format danych' });
                return;
            }

            await writePricelist(SETTINGS_KEY, [input]);
            res.json({ ok: true });
        } catch (err: unknown) {
            const message = err instanceof Error ? err.message : 'Unknown error';
            logger.error('PrecoPricingV2', 'PUT error', message);
            res.status(500).json({ error: message });
        }
    }
);

// ──────────────────────────────────────────
// PATCH / — częściowa aktualizacja
// Body: { data: { "1000": { skrzynkaWlazowa: 500 }, "spadekKineta": [...] } }
// ──────────────────────────────────────────
router.patch(
    '/',
    requireAuth,
    writeLimiter,
    validateData(precoPricingPatchSchema),
    async (req, res) => {
        try {
            const patch = req.body.data;
            if (!patch || typeof patch !== 'object') {
                res.status(400).json({ error: 'Nieprawidłowy format danych' });
                return;
            }

            const current = await readPricelist(SETTINGS_KEY);
            const entry: PrecoEntry = current.length > 0 ? { ...(current[0] as PrecoEntry) } : {};

            for (const [key, value] of Object.entries(patch)) {
                const dnStudni = Number(key);
                if (!isNaN(dnStudni) && typeof value === 'object' && value !== null) {
                    // Deep-merge DN entry
                    const existing = (entry[key] as Record<string, unknown>) || {};
                    entry[key] = { ...existing, ...(value as Record<string, unknown>) };
                } else if (RANGE_TYPES.includes(key as (typeof RANGE_TYPES)[number])) {
                    entry[key] = value;
                }
            }

            await writePricelist(SETTINGS_KEY, [entry]);
            res.json({ ok: true });
        } catch (err: unknown) {
            const message = err instanceof Error ? err.message : 'Unknown error';
            logger.error('PrecoPricingV2', 'PATCH error', message);
            res.status(500).json({ error: message });
        }
    }
);

// ──────────────────────────────────────────
// GET /default — fabryczne wartości PRECO
// ──────────────────────────────────────────
router.get('/default', requireAuth, async (_req, res) => {
    try {
        const data = await readPricelist(SETTINGS_KEY_DEFAULT);
        if (Array.isArray(data) && data.length > 0) {
            res.json({ data });
            return;
        }
        const liveData = await readPricelist(SETTINGS_KEY);
        if (Array.isArray(liveData) && liveData.length > 0) {
            await writePricelist(
                SETTINGS_KEY_DEFAULT,
                liveData as unknown as Record<string, unknown>[]
            );
            res.json({ data: liveData });
        } else {
            res.json({ data: [] });
        }
    } catch (err: unknown) {
        const message = err instanceof Error ? err.message : 'Unknown error';
        logger.error('PrecoPricingV2', 'GET /default error', message);
        res.json({ data: [] });
    }
});

export default router;
