import express from 'express';
import { requireAuth } from '../middleware/auth';
import { logger } from '../utils/logger';
import { validateData } from '../validators/authSchema';
import { pricelistDataSchema } from '../validators/offerSchemas';
import {
    migrateFromLegacyIfNeeded,
    readPricelist,
    writePricelist,
    PricelistConfig
} from '../services/pricelistService';

const router = express.Router();

/* ===== CENNIK STUDNI — zapis/odczyt z tabeli settings (JSON) ===== */

const config: PricelistConfig = {
    keyCurrent: 'pricelist_studnie',
    keyDefault: 'pricelist_studnie_default',
    legacyTable: 'products_studnie_rel',
    legacyDefaultKey: 'default_studnie',
    label: 'studnie'
};

// Uruchom migrację przy starcie
migrateFromLegacyIfNeeded(config);

// ──────────────────────────────────────────
// GET /api/products-studnie → Pobiera bieżący cennik studni
// ──────────────────────────────────────────
router.get('/', async (_req, res) => {
    try {
        const data = await readPricelist(config.keyCurrent);
        res.json({ data });
    } catch (err: unknown) {
        const message = err instanceof Error ? err.message : 'Unknown error';
        logger.error('ProductsStudnie', 'Błąd pobierania (GET)', message);
        res.status(500).json({ error: message });
    }
});

// ──────────────────────────────────────────
// PUT /api/products-studnie → Zapisuje bieżący cennik studni
// ──────────────────────────────────────────
router.put('/', requireAuth, validateData(pricelistDataSchema), async (req, res) => {
    try {
        const arr = req.body.data;
        const count = await writePricelist(config.keyCurrent, arr);
        res.json({ ok: true, count });
    } catch (err: unknown) {
        const message = err instanceof Error ? err.message : 'Unknown error';
        logger.error('ProductsStudnie', 'Błąd zapisu (PUT)', message);
        res.status(500).json({ error: message });
    }
});

// ──────────────────────────────────────────
// GET /api/products-studnie/default → Pobiera wartości fabryczne studni
// ──────────────────────────────────────────
router.get('/default', async (_req, res) => {
    try {
        const data = await readPricelist(config.keyDefault);
        res.json({ data });
    } catch (err: unknown) {
        const message = err instanceof Error ? err.message : 'Unknown error';
        logger.error('ProductsStudnie', 'Błąd pobierania domyślnych (GET default)', message);
        res.json({ data: [] });
    }
});

// ──────────────────────────────────────────
// PUT /api/products-studnie/default → Zapisuje wartości fabryczne studni
// ──────────────────────────────────────────
router.put('/default', requireAuth, validateData(pricelistDataSchema), async (req, res) => {
    try {
        const arr = req.body.data || [];
        const count = await writePricelist(config.keyDefault, arr);
        res.json({ ok: true, count });
    } catch (err: unknown) {
        const message = err instanceof Error ? err.message : 'Unknown error';
        logger.error('ProductsStudnie', 'Błąd zapisu domyślnych (PUT default)', message);
        res.status(500).json({ error: message });
    }
});

export default router;
