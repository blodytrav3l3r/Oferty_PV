import express from 'express';
import prisma from '../prismaClient';
import { requireAuth, AuthenticatedRequest } from '../middleware/auth';
import crypto from 'crypto';
import { logger } from '../utils/logger';
import { validateData } from '../validators/authSchema';
import { telemetryOverrideSchema } from '../validators/offerSchemas';

const router = express.Router();

// POST /api/telemetry/override
router.post('/override', requireAuth, validateData(telemetryOverrideSchema), (req, res) => {
    const authReq = req as AuthenticatedRequest;
    try {
        const { originalConfig, finalConfig, overrideReason } = req.body;
        const userId = authReq.user?.id;

        const id = crypto.randomUUID();

        prisma.ai_telemetry_logs
            .create({
                data: {
                    id,
                    userId: userId || '',
                    original_auto_config: JSON.stringify(originalConfig),
                    final_user_config: JSON.stringify(finalConfig),
                    override_reason: overrideReason
                }
            })
            .then(() => {
                return res.json({ success: true, id });
            })
            .catch((e: unknown) => {
                logger.error('Telemetry', 'Błąd zapisu', e);
                return res.status(500).json({ error: 'Wewnętrzny błąd telemetryczny' });
            });
    } catch (e: unknown) {
        logger.error('Telemetry', 'Błąd zapisu', e);
        return res.status(500).json({ error: 'Wewnętrzny błąd telemetryczny' });
    }
});

// GET /api/telemetry/logs (Tylko administrator)
router.get('/logs', requireAuth, (req, res) => {
    const authReq = req as AuthenticatedRequest;
    if (authReq.user?.role !== 'admin') {
        return res.status(403).json({ error: 'Brak uprawnień' });
    }

    prisma.ai_telemetry_logs
        .findMany({
            orderBy: { createdAt: 'desc' },
            take: 100
        })
        .then((logs) => {
            // Deserializacja JSON dla widoku administratora
            logs.forEach((l: Record<string, unknown>) => {
                try {
                    const orig = l.original_auto_config;
                    const final = l.final_user_config;
                    if (typeof orig === 'string') {
                        l.original_auto_config = JSON.parse(orig);
                    }
                    if (typeof final === 'string') {
                        l.final_user_config = JSON.parse(final);
                    }
                } catch (_e) {}
            });

            return res.json(logs);
        })
        .catch((_e) => {
            return res.status(500).json({ error: 'Błąd bazy' });
        });
});

export default router;
