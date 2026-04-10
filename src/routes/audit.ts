import express from 'express';
import prisma from '../prismaClient';
import { requireAuth } from '../middleware/auth';

const router = express.Router();

const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 100;

// GET /api/audit/:entityType/:entityId?limit=20&offset=0
router.get('/:entityType/:entityId', requireAuth as any, async (req, res) => {
  try {
    const { entityType, entityId } = req.params;
    const limit = Math.min(parseInt(req.query.limit as string) || DEFAULT_LIMIT, MAX_LIMIT);
    const offset = Math.max(parseInt(req.query.offset as string) || 0, 0);

    // Total count
    const total = await prisma.audit_logs.count({
      where: { entityType, entityId },
    });

    // Get page of results
    const logs = await prisma.audit_logs.findMany({
      where: { entityType, entityId },
      orderBy: { createdAt: 'desc' },
      take: limit,
      skip: offset,
    });

    const mapped = logs.map((l: any) => {
      let oldData: any = null;
      let newData: any = null;
      try {
        if (l.oldData) oldData = JSON.parse(l.oldData);
      } catch (_e) {
        oldData = { _parseError: true, raw: l.oldData };
      }
      try {
        if (l.newData) newData = JSON.parse(l.newData);
      } catch (_e) {
        newData = { _parseError: true, raw: l.newData };
      }
      return {
        id: l.id,
        entityType: l.entityType,
        entityId: l.entityId,
        userId: l.userId,
        userName: null, // Would need user join
        action: l.action,
        oldData,
        newData,
        createdAt: l.createdAt,
      };
    });

    res.json({ data: mapped, total, limit, offset });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// GET /api/audit/rebuild/:entityType/:entityId/:logId
router.get('/rebuild/:entityType/:entityId/:logId', requireAuth as any, async (req, res) => {
  try {
    const { entityType, entityId, logId } = req.params;

    // 1. Get target log
    const targetLog = await prisma.audit_logs.findFirst({
      where: { id: logId, entityType, entityId },
    });
    if (!targetLog) return res.status(404).json({ error: 'Nie znaleziono wpisu historycznego.' });

    // 2. Find base snapshot (full record from before/at target log time)
    const baseLogs = await prisma.audit_logs.findMany({
      where: {
        entityType,
        entityId,
        createdAt: { lte: targetLog.createdAt },
      },
      orderBy: { createdAt: 'desc' },
    });

    let baseLogRow: any = null;
    for (const log of baseLogs) {
      if (log.action === 'create' || log.action === 'delete') {
        baseLogRow = log;
        break;
      }
      if (log.action === 'update' && log.newData) {
        try {
          const parsed = JSON.parse(log.newData);
          if (!parsed._diffMode) {
            baseLogRow = log;
            break;
          }
        } catch (_e) {
          // If JSON parse fails, treat as full snapshot
          baseLogRow = log;
          break;
        }
      }
    }

    if (!baseLogRow) {
      return res.status(404).json({ error: 'Brak wczesnego pełnego zapisu, aby zrekonstruować ofertę.' });
    }

    // 3. Start from base state
    let currentState: any = {};
    try {
      if (baseLogRow.action === 'delete' && baseLogRow.oldData) {
        currentState = JSON.parse(baseLogRow.oldData);
      } else if (baseLogRow.newData) {
        currentState = JSON.parse(baseLogRow.newData);
      }
    } catch (_e) {
      return res.status(500).json({ error: 'Błąd deserializacji zapisu bazowego.' });
    }

    if (baseLogRow.id === targetLog.id) {
      return res.json({ data: currentState });
    }

    // 4. Get all diff logs between base and target
    const forwardLogs = await prisma.audit_logs.findMany({
      where: {
        entityType,
        entityId,
        createdAt: {
          gt: baseLogRow.createdAt,
          lte: targetLog.createdAt,
        },
      },
      orderBy: { createdAt: 'asc' },
    });

    // 5. Apply patches chronologically
    for (const log of forwardLogs) {
      if (!log.newData) continue;
      try {
        const patch = JSON.parse(log.newData);
        delete patch._diffMode;
        currentState = { ...currentState, ...patch };
      } catch (_e) {
        console.warn('[Audit Rebuild] Pominięto uszkodzony JSON w logu:', log.id);
      }
    }

    res.json({ data: currentState });
  } catch (e: any) {
    console.error('[Audit Rebuild] Błąd:', e);
    res.status(500).json({ error: e.message });
  }
});

export default router;