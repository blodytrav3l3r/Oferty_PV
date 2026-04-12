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
    } catch (err: any) {
        logger.error('Products', 'Błąd pobierania (GET)', err.message);
        res.status(500).json({ error: err.message });
    }
});

// ──────────────────────────────────────────
// PUT /api/products → Zapisuje bieżący cennik rur
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
        logger.error('Products', 'Błąd zapisu (PUT)', err.message);
        res.status(500).json({ error: err.message });
    }
});

// ──────────────────────────────────────────
// GET /api/products/default → Pobiera wartości fabryczne rur
// ──────────────────────────────────────────
router.get('/default', async (_req, res) => {
    try {
        const data = await readPricelist(config.keyDefault);
        res.json({ data });
    } catch (err: any) {
        logger.error('Products', 'Błąd pobierania domyślnych (GET default)', err.message);
        res.json({ data: [] });
    }
});

// ──────────────────────────────────────────
// PUT /api/products/default → Zapisuje wartości fabryczne rur
// ──────────────────────────────────────────
router.put('/default', requireAuth, async (req, res) => {
    try {
        const arr = req.body.data || [];
        const count = await writePricelist(config.keyDefault, arr);
        res.json({ ok: true, count });
    } catch (err: any) {
        logger.error('Products', 'Błąd zapisu domyślnych (PUT default)', err.message);
        res.status(500).json({ error: err.message });
    }
});

export default router;
