import express from 'express';
import { requireAuth, requireAdmin } from '../middleware/auth';
import { priceOverrideService } from '../services/priceOverrideService';

const router = express.Router();

router.post('/sync', requireAuth, requireAdmin, async (_req, res) => {
    try {
        const summary = await priceOverrideService.exportOverrides();
        res.json({
            ok: true,
            message: `Zapisano ${summary.total} zmian (rury: ${summary.rury}, studnie: ${summary.studnie}, preco: ${summary.preco})`,
            ...summary
        });
    } catch (err: unknown) {
        const message = err instanceof Error ? err.message : 'Unknown error';
        res.status(500).json({ error: message });
    }
});

export default router;
