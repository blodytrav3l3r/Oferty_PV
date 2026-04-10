import express from 'express';
import prisma from '../prismaClient';
import { requireAuth, AuthenticatedRequest } from '../middleware/auth';
import crypto from 'crypto';

const router = express.Router();

// POST /api/telemetry/override
router.post('/override', requireAuth as any, (req, res) => {
  const authReq = req as AuthenticatedRequest;
  try {
    const { originalConfig, finalConfig, overrideReason } = req.body;
    const userId = authReq.user?.id;

    if (!originalConfig || !finalConfig || !overrideReason) {
      return res.status(400).json({ error: 'Brak wymaganych danych telemetrycznych' });
    }

    const id = crypto.randomUUID();

    prisma.ai_telemetry_logs
      .create({
        data: {
          id,
          userId: userId || '',
          original_auto_config: JSON.stringify(originalConfig),
          final_user_config: JSON.stringify(finalConfig),
          override_reason: overrideReason,
        },
      })
      .then(() => {
        return res.json({ success: true, id });
      })
      .catch((e: any) => {
        console.error('[Telemetry] Błąd zapisu:', e);
        return res.status(500).json({ error: 'Wewnętrzny błąd telemetryczny' });
      });
  } catch (e: any) {
    console.error('[Telemetry] Błąd zapisu:', e);
    return res.status(500).json({ error: 'Wewnętrzny błąd telemetryczny' });
  }
});

// GET /api/telemetry/logs (Admin only)
router.get('/logs', requireAuth as any, (req, res) => {
  const authReq = req as AuthenticatedRequest;
  if (authReq.user?.role !== 'admin') {
    return res.status(403).json({ error: 'Brak uprawnień' });
  }

  prisma.ai_telemetry_logs
    .findMany({
      orderBy: { createdAt: 'desc' },
      take: 100,
    })
    .then((logs) => {
      // Deserialize JSON for admin view
      logs.forEach((l: any) => {
        try {
          l.original_auto_config = JSON.parse(l.original_auto_config);
          l.final_user_config = JSON.parse(l.final_user_config);
        } catch (_e) {}
      });

      return res.json(logs);
    })
    .catch((_e) => {
      return res.status(500).json({ error: 'Błąd bazy' });
    });
});

export default router;