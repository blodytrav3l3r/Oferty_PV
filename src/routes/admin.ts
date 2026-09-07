import express from 'express';
import { requireAuth, requireAdmin } from '../middleware/auth';
import { logger } from '../utils/logger';
import { ftsSyncStatus, rebuildFts5 } from '../utils/fts5Sync';

const router = express.Router();

/* P1-B: FTS to dane pochodne — status i rebuild wyłącznie dla admina. */

// GET /api/admin/fts-status — szybka kontrola spójności (tylko odczyty).
router.get('/fts-status', requireAuth, requireAdmin, async (_req, res) => {
    try {
        res.json(await ftsSyncStatus());
    } catch (e: unknown) {
        const message = e instanceof Error ? e.message : 'Unknown error';
        logger.error('Admin', 'Błąd fts-status', message);
        res.status(500).json({ error: 'Wewnętrzny błąd serwera' });
    }
});

// POST /api/admin/fts-rebuild — pełna przebudowa z tabel biznesowych.
// Wyłącznie na żądanie (nigdy automatycznie): długi zapis na dużej bazie.
router.post('/fts-rebuild', requireAuth, requireAdmin, async (_req, res) => {
    try {
        let done = 0;
        const total = await rebuildFts5((n) => {
            done = n;
        });
        res.json({ ok: true, rows: total, lastProgress: done });
    } catch (e: unknown) {
        const message = e instanceof Error ? e.message : 'Unknown error';
        logger.error('Admin', 'Błąd fts-rebuild', message);
        res.status(500).json({ error: 'Wewnętrzny błąd serwera' });
    }
});

export default router;
