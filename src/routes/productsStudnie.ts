import express from 'express';
import { requireAuth } from '../middleware/auth';
import { logger } from '../utils/logger';
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
    } catch (err: any) {
        logger.error('ProductsStudnie', 'GET error', err.message);
        res.status(500).json({ error: err.message });
    }
});

// ──────────────────────────────────────────
// PUT /api/products-studnie → Zapisuje bieżący cennik studni
// ──────────────────────────────────────────
router.put('/', requireAuth, async (req, res) => {
    try {
        const arr = req.body.data;
        if (!Array.isArray(arr)) {
            return res.status(400).json({ error: 'Dane muszą być tablicą' });
        }

        const count = await writePricelist(config.keyCurrent, arr);
        res.json({ ok: true, count });
    } catch (err: any) {
        logger.error('ProductsStudnie', 'PUT error', err.message);
        res.status(500).json({ error: err.message });
    }
});

// ──────────────────────────────────────────
// GET /api/products-studnie/default → Pobiera wartości fabryczne studni
// ──────────────────────────────────────────
router.get('/default', async (_req, res) => {
    try {
        const data = await readPricelist(config.keyDefault);
        res.json({ data });
    } catch (err: any) {
        logger.error('ProductsStudnie', 'GET default error', err.message);
        res.json({ data: [] });
    }
});

// ──────────────────────────────────────────
// PUT /api/products-studnie/default → Zapisuje wartości fabryczne studni
// ──────────────────────────────────────────
router.put('/default', requireAuth, async (req, res) => {
    try {
        const arr = req.body.data || [];
        const count = await writePricelist(config.keyDefault, arr);
        res.json({ ok: true, count });
    } catch (err: any) {
        logger.error('ProductsStudnie', 'PUT default error', err.message);
        res.status(500).json({ error: err.message });
    }
});

export default router;
