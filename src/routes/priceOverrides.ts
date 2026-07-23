import express from 'express';
import { requireAuth, requireAdmin } from '../middleware/auth';
import { priceOverrideService } from '../services/priceOverrideService';
import { createModuleLock } from '../middleware/writeLock';
import { PRICELIST_WRITE_LIMITER } from '../middleware/rateLimiters';

const router = express.Router();
const { acquireLock, releaseLock } = createModuleLock();

router.post('/sync', requireAuth, requireAdmin, PRICELIST_WRITE_LIMITER, async (_req, res) => {
    try {
        const lockAcquired = await acquireLock();
        if (!lockAcquired) {
            res.status(429).json({ error: 'Zasób zablokowany, spróbuj ponownie' });
            return;
        }
        const summary = await priceOverrideService.exportOverrides();
        res.json({
            ok: true,
            message: `Zapisano ${summary.total} zmian (rury: ${summary.rury}, preco: ${summary.preco})`,
            ...summary
        });
    } catch (err: unknown) {
        const message = err instanceof Error ? err.message : 'Unknown error';
        res.status(500).json({ error: message });
    } finally {
        releaseLock();
    }
});

router.post(
    '/save-defaults',
    requireAuth,
    requireAdmin,
    PRICELIST_WRITE_LIMITER,
    async (_req, res) => {
        try {
            const lockAcquired = await acquireLock();
            if (!lockAcquired) {
                res.status(429).json({ error: 'Zasób zablokowany, spróbuj ponownie' });
                return;
            }
            const summary = await priceOverrideService.saveDefaults();
            const total =
                summary.rury +
                summary.studnie +
                summary.precoKonfig +
                summary.precoKinety +
                summary.precoZakresy;
            res.json({
                ok: true,
                message: `Zapisano ${total} pozycji jako domyślne (rury: ${summary.rury}, studnie: ${summary.studnie}, preco: ${summary.precoKonfig + summary.precoKinety + summary.precoZakresy})`,
                savedAt: new Date().toISOString(),
                ...summary
            });
        } catch (err: unknown) {
            const message = err instanceof Error ? err.message : 'Unknown error';
            res.status(500).json({ error: message });
        } finally {
            releaseLock();
        }
    }
);

export default router;
