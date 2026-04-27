import express from 'express';
import { requireAuth } from '../middleware/auth';
import { logger } from '../utils/logger';
import { validateData } from '../validators/authSchema';
import { createRateLimiter } from '../middleware/rateLimiter';
import { pricelistDataSchema } from '../validators/offerSchemas';
import {
    migrateFromLegacyIfNeeded,
    readPricelist,
    writePricelist,
    PricelistConfig
} from '../services/pricelistService';

const router = express.Router();

// Rate limiter dla operacji na cennikach (30 zapytań na minutę)
const writePricelistLimiter = createRateLimiter({
    windowMs: 60 * 1000,
    maxHits: 30,
    message: 'Zbyt wiele operacji na cennikach. Odczekaj minutę.'
});

/* ===== CENNIK RURY — zapis/odczyt z tabeli settings (JSON) ===== */

const config: PricelistConfig = {
    keyCurrent: 'pricelist_rury',
    keyDefault: 'pricelist_rury_default',
    legacyTable: 'products_rury_rel',
    legacyDefaultKey: 'default_rury',
    label: 'rury'
};

// Uruchom migrację przy starcie
migrateFromLegacyIfNeeded(config);

// ──────────────────────────────────────────
// GET /api/products → Pobiera bieżący cennik rur
// ──────────────────────────────────────────
router.get('/', async (_req, res) => {
    try {
        const data = await readPricelist(config.keyCurrent);
        res.json({ data });
    } catch (err: unknown) {
        const message = err instanceof Error ? err.message : 'Unknown error';
        logger.error('Products', 'Błąd pobierania (GET)', message);
        res.status(500).json({ error: message });
    }
});

// ──────────────────────────────────────────
// PUT /api/products → Zapisuje bieżący cennik rur
// ──────────────────────────────────────────
router.put('/', requireAuth, writePricelistLimiter, validateData(pricelistDataSchema), async (req, res) => {
    try {
        const arr = req.body.data;
        const count = await writePricelist(config.keyCurrent, arr);
        res.json({ ok: true, count });
    } catch (err: unknown) {
        const message = err instanceof Error ? err.message : 'Unknown error';
        logger.error('Products', 'Błąd zapisu (PUT)', message);
        res.status(500).json({ error: message });
    }
});

// ──────────────────────────────────────────
// GET /api/products/default → Pobiera wartości fabryczne rur
// ──────────────────────────────────────────
router.get('/default', async (_req, res) => {
    try {
        const data = await readPricelist(config.keyDefault);
        res.json({ data });
    } catch (err: unknown) {
        const message = err instanceof Error ? err.message : 'Unknown error';
        logger.error('Products', 'Błąd pobierania domyślnych (GET default)', message);
        res.json({ data: [] });
    }
});

// ──────────────────────────────────────────
// PUT /api/products/default → Zapisuje wartości fabryczne rur
// ──────────────────────────────────────────
router.put('/default', requireAuth, writePricelistLimiter, validateData(pricelistDataSchema), async (req, res) => {
    try {
        const arr = req.body.data || [];
        const count = await writePricelist(config.keyDefault, arr);
        res.json({ ok: true, count });
    } catch (err: unknown) {
        const message = err instanceof Error ? err.message : 'Unknown error';
        logger.error('Products', 'Błąd zapisu domyślnych (PUT default)', message);
        res.status(500).json({ error: message });
    }
});

export default router;
