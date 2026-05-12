import express from 'express';
import { requireAuth } from '../middleware/auth';
import { logger } from '../utils/logger';
import { createRateLimiter } from '../middleware/rateLimiter';
import { readPricelist, writePricelist } from '../services/pricelistService';

const router = express.Router();

const writeLimiter = createRateLimiter({
    windowMs: 60 * 1000,
    maxHits: 30,
    message: 'Zbyt wiele operacji na cenniku PRECO. Odczekaj minutę.'
});

const SETTINGS_KEY = 'preco_pricing';

// ──────────────────────────────────────────
// GET /api/preco-pricing → Pobiera cennik PRECO
// ──────────────────────────────────────────
router.get('/', async (_req, res) => {
    try {
        const data = await readPricelist(SETTINGS_KEY);
        res.json({ data });
    } catch (err: unknown) {
        const message = err instanceof Error ? err.message : 'Unknown error';
        logger.error('PrecoPricing', 'Błąd pobierania (GET)', message);
        res.status(500).json({ error: message });
    }
});

// ──────────────────────────────────────────
// PUT /api/preco-pricing → Zapisuje cennik PRECO
// ──────────────────────────────────────────
router.put('/', requireAuth, writeLimiter, async (req, res) => {
    try {
        const data = req.body.data;
        if (!data || typeof data !== 'object') {
            res.status(400).json({ error: 'Brak danych do zapisu' });
            return;
        }
        // Zapisujemy jako tablicę jednoelementową z obiektem (kompatybilność z pricelistService)
        const count = await writePricelist(SETTINGS_KEY, [data]);
        res.json({ ok: true, count });
    } catch (err: unknown) {
        const message = err instanceof Error ? err.message : 'Unknown error';
        logger.error('PrecoPricing', 'Błąd zapisu (PUT)', message);
        res.status(500).json({ error: message });
    }
});

export default router;
