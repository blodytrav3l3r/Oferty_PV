import express from 'express';
import { requireAuth, requireAdmin } from '../middleware/auth';
import { priceOverrideService } from '../services/priceOverrideService';
import { createModuleLock } from '../middleware/writeLock';
import { PRICELIST_WRITE_LIMITER } from '../middleware/rateLimiters';
import { logger } from '../utils/logger';

const router = express.Router();
const { runWithLock } = createModuleLock();

router.post(
    '/save-defaults',
    requireAuth,
    requireAdmin,
    PRICELIST_WRITE_LIMITER,
    async (_req, res) => {
        try {
            const result = await runWithLock(async () => {
                const summary = await priceOverrideService.saveDefaults();
                const total =
                    summary.rury +
                    summary.studnie +
                    summary.precoKonfig +
                    summary.precoKinety +
                    summary.precoZakresy;
                return {
                    ok: true,
                    message: `Zapisano ${total} pozycji jako domyślne (rury: ${summary.rury}, studnie: ${summary.studnie}, preco: ${summary.precoKonfig + summary.precoKinety + summary.precoZakresy})`,
                    savedAt: new Date().toISOString(),
                    ...summary
                };
            });
            if (!result.acquired) {
                res.status(429).json({ error: 'Zapis w toku, spróbuj ponownie za chwilę' });
                return;
            }
            res.json(result.value);
        } catch (err: unknown) {
            const message = err instanceof Error ? err.message : 'Unknown error';
            logger.error('PriceOverrides', 'Błąd serwera', message);
            res.status(500).json({ error: 'Wewnętrzny błąd serwera' });
        }
    }
);

export default router;
