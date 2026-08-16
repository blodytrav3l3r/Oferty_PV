import express from 'express';
import { requireAuth, requireAdmin } from '../middleware/auth';
import { priceOverrideService } from '../services/priceOverrideService';
import { createModuleLock, LockHandle } from '../middleware/writeLock';
import { PRICELIST_WRITE_LIMITER } from '../middleware/rateLimiters';
import { logger } from '../utils/logger';

const router = express.Router();
const { acquireLock } = createModuleLock();

router.post(
    '/save-defaults',
    requireAuth,
    requireAdmin,
    PRICELIST_WRITE_LIMITER,
    async (_req, res) => {
        let lock: LockHandle | null = null;
        try {
            lock = await acquireLock();
            if (!lock) {
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
            logger.error('PriceOverrides', 'Błąd serwera', message);
            res.status(500).json({ error: 'Wewnętrzny błąd serwera' });
        } finally {
            lock?.release();
        }
    }
);

export default router;
