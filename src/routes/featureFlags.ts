import express from 'express';
import { z } from 'zod';
import prisma from '../prismaClient';
import { logAudit } from '../services/auditService';
import { requireAuth, requireAdmin, AuthenticatedRequest } from '../middleware/auth';
import { logger } from '../utils/logger';
import { AI_ML_FLAG_KEY, isAiMlFlagOn } from '../middleware/aiMlGuard';

const router = express.Router();

router.get('/', requireAuth, async (_req, res) => {
    try {
        const [importExport, pzStableId, aiMl] = await Promise.all([
            prisma.settings.findUnique({ where: { key: 'feature_import_export_enabled' } }),
            prisma.settings.findUnique({ where: { key: 'feature_pz_stable_id' } }),
            prisma.settings.findUnique({ where: { key: AI_ML_FLAG_KEY } })
        ]);
        const flagOn = (v: { value: string | null } | null) =>
            v?.value === '"1"' || v?.value === '1';
        res.json({
            import_export_enabled: flagOn(importExport),
            pz_stable_id: pzStableId ? flagOn(pzStableId) : true,
            ai_ml_enabled: isAiMlFlagOn(aiMl)
        });
    } catch {
        res.json({ import_export_enabled: false, pz_stable_id: true, ai_ml_enabled: true });
    }
});

router.put('/import-export', requireAuth, requireAdmin, async (req, res) => {
    try {
        const enabled = req.body.enabled === true;
        await prisma.settings.upsert({
            where: { key: 'feature_import_export_enabled' },
            create: { key: 'feature_import_export_enabled', value: enabled ? '"1"' : '"0"' },
            update: { value: enabled ? '"1"' : '"0"' }
        });

        const authReq = req as AuthenticatedRequest;
        logAudit(
            'settings',
            'feature_import_export_enabled',
            authReq.user?.id || '',
            'feature_flag.changed',
            {
                newValue: enabled,
                key: 'feature_import_export_enabled'
            }
        );

        res.json({ success: true, enabled });
    } catch (e: unknown) {
        const message = e instanceof Error ? e.message : 'Unknown error';
        logger.error('FeatureFlags', 'Błąd serwera', message);
        res.status(500).json({ error: 'Wewnętrzny błąd serwera' });
    }
});

router.put('/ai-ml', requireAuth, requireAdmin, async (req, res) => {
    try {
        const parsed = z.object({ enabled: z.boolean() }).safeParse(req.body);
        if (!parsed.success) {
            res.status(400).json({
                error: 'Pole enabled musi byc typem boolean',
                details: parsed.error.issues
            });
            return;
        }
        const enabled = parsed.data.enabled;
        const old = await prisma.settings.findUnique({
            where: { key: AI_ML_FLAG_KEY }
        });
        const oldValue = isAiMlFlagOn(old);
        await prisma.settings.upsert({
            where: { key: AI_ML_FLAG_KEY },
            create: { key: AI_ML_FLAG_KEY, value: enabled ? '"1"' : '"0"' },
            update: { value: enabled ? '"1"' : '"0"' }
        });

        const authReq = req as AuthenticatedRequest;
        logAudit(
            'settings',
            AI_ML_FLAG_KEY,
            authReq.user?.id || '',
            'feature_flag.changed',
            { newValue: enabled, key: AI_ML_FLAG_KEY },
            { oldValue }
        );

        res.json({ success: true, enabled });
    } catch (e: unknown) {
        const message = e instanceof Error ? e.message : 'Unknown error';
        logger.error('FeatureFlags', 'Błąd serwera', message);
        res.status(500).json({ error: 'Wewnętrzny błąd serwera' });
    }
});

router.post('/audit', requireAuth, requireAdmin, async (req, res) => {
    try {
        const authReq = req as AuthenticatedRequest;
        const { entityType, entityId, action, details } = req.body;
        if (!entityType || !entityId || !action) {
            return res
                .status(400)
                .json({ error: 'Brak wymaganych pól: entityType, entityId, action' });
        }
        await logAudit(entityType, entityId, authReq.user?.id || '', action, details || {});
        res.json({ ok: true });
    } catch (e: unknown) {
        const message = e instanceof Error ? e.message : 'Unknown error';
        logger.error('FeatureFlags', 'Błąd serwera', message);
        res.status(500).json({ error: 'Wewnętrzny błąd serwera' });
    }
});

export default router;
