import express from 'express';
import prisma from '../prismaClient';
import { requireAuth, AuthenticatedRequest } from '../middleware/auth';
import { logger } from '../utils/logger';

const router = express.Router();

const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 100;

/**
 * Buduje WHERE clause dla audit_logs respektujący rolę:
 *  - admin: widzi wszystko
 *  - pro:   widzi logi swoje + swoich subUsers
 *  - user:  widzi tylko swoje
 */
function buildAuditUserFilter(user: { role: string; id: string; subUsers?: string[] }): {
    userId?: { in: string[] } | string;
} {
    if (user.role === 'admin') return {};
    if (user.role === 'pro') {
        const ids = [user.id, ...(user.subUsers || [])].filter(
            (id): id is string => typeof id === 'string' && id.length > 0
        );
        return { userId: { in: ids } };
    }
    return { userId: user.id };
}

/**
 * @openapi
 * /api/audit/{entityType}/{entityId}:
 *   get:
 *     tags: [Audit]
 *     summary: Pobranie logów audytowych dla encji
 *     security:
 *       - cookieAuth: []
 *     parameters:
 *       - in: path
 *         name: entityType
 *         required: true
 *         schema: { type: string }
 *       - in: path
 *         name: entityId
 *         required: true
 *         schema: { type: string }
 *       - in: query
 *         name: limit
 *         schema: { type: integer, default: 20 }
 *       - in: query
 *         name: offset
 *         schema: { type: integer, default: 0 }
 *     responses:
 *       200:
 *         description: Lista logów audytowych z paginacją
 */
// GET /api/audit/:entityType/:entityId?limit=20&offset=0
router.get('/:entityType/:entityId', requireAuth, async (req, res) => {
    const authReq = req as AuthenticatedRequest;
    try {
        const { entityType, entityId } = req.params;
        const limit = Math.min(parseInt(req.query.limit as string) || DEFAULT_LIMIT, MAX_LIMIT);
        const offset = Math.max(parseInt(req.query.offset as string) || 0, 0);

        const userFilter = authReq.user
            ? buildAuditUserFilter(authReq.user)
            : { userId: '__none__' };
        const where = { entityType, entityId, ...userFilter };

        const total = await prisma.audit_logs.count({ where });

        const logs = await prisma.audit_logs.findMany({
            where,
            orderBy: { createdAt: 'desc' },
            take: limit,
            skip: offset
        });

        const userIds = [...new Set(logs.map((l) => l.userId).filter(Boolean) as string[])];
        const users = userIds.length
            ? await prisma.users.findMany({
                  where: { id: { in: userIds } },
                  select: { id: true, username: true, firstName: true, lastName: true }
              })
            : [];
        const usersById = new Map(
            users.map((u) => [
                u.id,
                [u.firstName, u.lastName].filter(Boolean).join(' ') || u.username
            ])
        );

        const mapped = logs.map((l) => {
            let oldData: unknown = null;
            let newData: unknown = null;
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
                userName: l.userId ? usersById.get(l.userId) || l.userId : 'System',
                action: l.action,
                oldData,
                newData,
                createdAt: l.createdAt
            };
        });

        res.json({ data: mapped, total, limit, offset });
    } catch (e: unknown) {
        const message = e instanceof Error ? e.message : 'Unknown error';
        res.status(500).json({ error: message });
    }
});

/**
 * @openapi
 * /api/audit/rebuild/{entityType}/{entityId}/{logId}:
 *   get:
 *     tags: [Audit]
 *     summary: Rekonstrukcja stanu encji z logów audytowych
 *     security:
 *       - cookieAuth: []
 *     parameters:
 *       - in: path
 *         name: entityType
 *         required: true
 *         schema: { type: string }
 *       - in: path
 *         name: entityId
 *         required: true
 *         schema: { type: string }
 *       - in: path
 *         name: logId
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: Zrekonstruowany stan encji
 */
// GET /api/audit/rebuild/:entityType/:entityId/:logId
router.get('/rebuild/:entityType/:entityId/:logId', requireAuth, async (req, res) => {
    const authReq = req as AuthenticatedRequest;
    try {
        const { entityType, entityId, logId } = req.params;

        const userFilter = authReq.user
            ? buildAuditUserFilter(authReq.user)
            : { userId: '__none__' };

        const targetLog = await prisma.audit_logs.findFirst({
            where: { id: logId, entityType, entityId, ...userFilter }
        });
        if (!targetLog)
            return res.status(404).json({ error: 'Nie znaleziono wpisu historycznego.' });

        const baseLogs = await prisma.audit_logs.findMany({
            where: {
                entityType,
                entityId,
                ...userFilter,
                createdAt: { lte: targetLog.createdAt ?? undefined }
            },
            orderBy: { createdAt: 'desc' }
        });

        let baseLogRow: (typeof baseLogs)[number] | null = null;
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
                    baseLogRow = log;
                    break;
                }
            }
        }

        if (!baseLogRow) {
            return res
                .status(404)
                .json({ error: 'Brak wczesnego pelnego zapisu, aby zrekonstruowac dokument.' });
        }

        let currentState: Record<string, unknown> = {};
        try {
            if (baseLogRow.action === 'delete' && baseLogRow.oldData) {
                currentState = JSON.parse(baseLogRow.oldData);
            } else if (baseLogRow.newData) {
                currentState = JSON.parse(baseLogRow.newData);
            }
        } catch (_e) {
            return res.status(500).json({ error: 'Blad deserializacji zapisu bazowego.' });
        }

        if (baseLogRow.id === targetLog.id) {
            return res.json({ data: currentState });
        }

        const forwardLogs = await prisma.audit_logs.findMany({
            where: {
                entityType,
                entityId,
                ...userFilter,
                createdAt: {
                    gt: baseLogRow.createdAt ?? undefined,
                    lte: targetLog.createdAt ?? undefined
                }
            },
            orderBy: { createdAt: 'asc' }
        });

        for (const log of forwardLogs) {
            if (!log.newData) continue;
            try {
                const patch = JSON.parse(log.newData);
                delete patch._diffMode;
                currentState = { ...currentState, ...patch };
            } catch (_e) {
                logger.warn('AuditRebuild', `Pominieto uszkodzony JSON w logu: ${log.id}`);
            }
        }

        res.json({ data: currentState });
    } catch (e: unknown) {
        const message = e instanceof Error ? e.message : 'Unknown error';
        logger.error('AuditRebuild', 'Blad', e);
        res.status(500).json({ error: message });
    }
});

export default router;
