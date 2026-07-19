import express from 'express';
import prisma from '../prismaClient';
import { logAudit } from '../services/auditService';
import { requireAuth, requireAdmin, AuthenticatedRequest } from '../middleware/auth';

const router = express.Router();

/**
 * @openapi
 * /api/feature-flags:
 *   get:
 *     tags: [Settings]
 *     summary: Pobranie stanu feature flagów
 *     security:
 *       - cookieAuth: []
 *     responses:
 *       200:
 *         description: Stan flag (np. import_export_enabled)
 */
router.get('/', requireAuth, async (_req, res) => {
    try {
        const flag = await prisma.settings.findUnique({
            where: { key: 'feature_import_export_enabled' }
        });
        const enabled = flag?.value === '"1"' || flag?.value === '1';
        res.json({ import_export_enabled: enabled });
    } catch {
        res.json({ import_export_enabled: false });
    }
});

/**
 * @openapi
 * /api/feature-flags/import-export:
 *   put:
 *     tags: [Settings]
 *     summary: Włącz/wyłącz funkcję importu/eksportu (admin)
 *     security:
 *       - cookieAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               enabled: { type: boolean }
 *     responses:
 *       200:
 *         description: Status flagi zmieniony
 */
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
        res.status(500).json({ error: message });
    }
});

/**
 * @openapi
 * /api/feature-flags/audit:
 *   post:
 *     tags: [Settings]
 *     summary: Zapisanie zdarzenia audytowego
 *     security:
 *       - cookieAuth: []
 *     responses:
 *       200:
 *         description: Zdarzenie zapisane
 */
router.post('/audit', requireAuth, async (req, res) => {
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
        res.status(500).json({ error: message });
    }
});

export default router;
