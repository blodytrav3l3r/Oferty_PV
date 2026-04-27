import express from 'express';
import prisma from '../../prismaClient';
import { logAudit } from '../../db';
import { requireAuth, AuthenticatedRequest } from '../../middleware/auth';
import { parseJsonField } from '../../helpers';
import { validateData } from '../../validators/authSchema';
import { createRateLimiter } from '../../middleware/rateLimiter';
import { studnieOrdersBatchSchema, studnieOrderUpdateSchema } from '../../validators/offerSchemas';

const router = express.Router();

// Rate limiter dla operacji na zamówieniach (60 zapytań na minutę)
const writeOrdersLimiter = createRateLimiter({
    windowMs: 60 * 1000,
    maxHits: 60,
    message: 'Zbyt wiele operacji na zamówieniach. Odczekaj minutę.'
});

/* ===== ZAMÓWIENIA STUDNIE ===== */

// Buduje SQL WHERE clause na podstawie roli użytkownika
function buildRoleWhereSql(user: { role: string; id: string; subUsers?: string[] }): string {
    if (user.role === 'admin') return '';
    if (user.role === 'pro') {
        const allowedIds = [user.id, ...(user.subUsers || [])].map(id => `'${id}'`).join(',');
        return `WHERE "userId" IN (${allowedIds})`;
    }
    return `WHERE "userId" = '${user.id}'`;
}

router.get('/', requireAuth, async (req, res) => {
    const authReq = req as AuthenticatedRequest;
    try {
        const whereSql = authReq.user ? buildRoleWhereSql(authReq.user) : '';
        const orders = await prisma.$queryRawUnsafe<
            Array<{
                id: string;
                userId: string | null;
                offerStudnieId: string | null;
                status: string | null;
                createdAt: string | null;
                data: string | null;
            }>
        >(`SELECT id, "userId", "offerStudnieId", status, data,
            CASE WHEN "createdAt" GLOB '[0-9][0-9][0-9][0-9][0-9][0-9][0-9][0-9][0-9][0-9][0-9][0-9][0-9]'
                THEN datetime(CAST("createdAt" AS INTEGER)/1000, 'unixepoch')
                ELSE "createdAt" END as "createdAt"
         FROM orders_studnie_rel ${whereSql}`);

        const mapped = orders.map((o) => {
            const parsedData = parseJsonField<Record<string, unknown>>(o.data, {});
            return {
                id: o.id,
                type: 'order',
                userId: o.userId,
                offerStudnieId: o.offerStudnieId,
                status: o.status,
                createdAt: o.createdAt,
                ...parsedData
            };
        });

        res.json({ data: mapped });
    } catch (e: unknown) {
        const message = e instanceof Error ? e.message : 'Unknown error';
        res.status(500).json({ error: message });
    }
});

router.put('/', requireAuth, writeOrdersLimiter, validateData(studnieOrdersBatchSchema), async (req, res) => {
    const authReq = req as AuthenticatedRequest;
    try {
        const incoming = req.body.data || [];

        for (const o of incoming) {
            let docId = o.id;
            if (!docId) {
                docId = Date.now().toString() + '_' + Math.random().toString(36).substr(2, 5);
            }

            const {
                id: _id,
                type: _type,
                userId: _userId,
                offerStudnieId,
                createdAt: createdAtRaw,
                status,
                ...rest
            } = o;
            const dataStr = JSON.stringify(rest).replace(/'/g, "''");

            // Konwersja daty
            const convertDate = (raw: unknown): string => {
                if (typeof raw === 'number') return new Date(raw).toISOString();
                if (raw instanceof Date) return raw.toISOString();
                if (typeof raw === 'string') {
                    if (/^\d+$/.test(raw)) return new Date(Number(raw)).toISOString();
                    return raw;
                }
                return new Date().toISOString();
            };
            const createdAt = convertDate(createdAtRaw);

            // Użyj raw query dla find
            const oldRows = await prisma.$queryRawUnsafe<
                Array<{ data: string | null }>
            >(`SELECT data FROM orders_studnie_rel WHERE id = '${docId}'`);
            const old = oldRows[0];
            const newData = { ...rest };

            if (old) {
                logAudit(
                    'order',
                    docId,
                    authReq.user?.id || '',
                    'update',
                    newData,
                    parseJsonField<Record<string, unknown>>(old.data, {})
                );
            } else {
                logAudit('order', docId, authReq.user?.id || '', 'create', newData);
            }

            // Użyj raw query dla INSERT/UPDATE
            const updateResult = await prisma.$executeRawUnsafe(
                `UPDATE orders_studnie_rel SET "userId" = '${authReq.user?.id || ''}', ` +
                `"offerStudnieId" = '${offerStudnieId || ''}', "createdAt" = '${createdAt}', ` +
                `status = '${status || 'new'}', data = '${dataStr}' WHERE id = '${docId}'`
            );
            if (updateResult === 0) {
                await prisma.$executeRawUnsafe(
                    `INSERT INTO orders_studnie_rel (id, "userId", "offerStudnieId", "createdAt", status, data) ` +
                    `VALUES ('${docId}', '${authReq.user?.id || ''}', '${offerStudnieId || ''}', ` +
                    `'${createdAt}', '${status || 'new'}', '${dataStr}')`
                );
            }
        }

        res.json({ ok: true });
    } catch (e: unknown) {
        const message = e instanceof Error ? e.message : 'Unknown error';
        res.status(500).json({ error: message });
    }
});

/* ===== ZAMÓWIENIE PO ID (ZAMÓWIENIE) ===== */

router.get('/:id', requireAuth, async (req, res) => {
    const authReq = req as AuthenticatedRequest;
    try {
        const docId = req.params.id;

        const rows = await prisma.$queryRawUnsafe<
            Array<{
                id: string;
                userId: string | null;
                offerStudnieId: string | null;
                status: string | null;
                createdAt: string | null;
                data: string | null;
            }>
        >(`SELECT id, "userId", "offerStudnieId", status, data,
            CASE WHEN "createdAt" GLOB '[0-9][0-9][0-9][0-9][0-9][0-9][0-9][0-9][0-9][0-9][0-9][0-9][0-9]'
                THEN datetime(CAST("createdAt" AS INTEGER)/1000, 'unixepoch')
                ELSE "createdAt" END as "createdAt"
         FROM orders_studnie_rel WHERE id = '${docId}'`);
        const o = rows[0];
        if (!o || (authReq.user?.role !== 'admin' && o.userId !== authReq.user?.id)) {
            return res.status(404).json({ error: 'Zamówienie nie znalezione' });
        }

        const parsedData = parseJsonField<Record<string, unknown>>(o.data, {});

        res.json({
            data: {
                id: o.id,
                type: 'order',
                userId: o.userId,
                offerStudnieId: o.offerStudnieId,
                status: o.status,
                createdAt: o.createdAt,
                ...parsedData
            }
        });
    } catch (_e: unknown) {
        res.status(404).json({ error: 'Zamówienie nie znalezione' });
    }
});

router.patch('/:id', requireAuth, writeOrdersLimiter, validateData(studnieOrderUpdateSchema), async (req, res) => {
    const authReq = req as AuthenticatedRequest;
    try {
        const docId = req.params.id;

        const rows = await prisma.$queryRawUnsafe<
            Array<{ id: string; userId: string | null; status: string | null; data: string | null }>
        >(`SELECT id, "userId", status, data FROM orders_studnie_rel WHERE id = '${docId}'`);
        const o = rows[0];
        const isOwner = o && o.userId === authReq.user?.id;
        const isProParent =
            o &&
            authReq.user?.role === 'pro' &&
            (authReq.user?.subUsers || []).includes(o.userId || '');
        if (!o || (authReq.user?.role !== 'admin' && !isOwner && !isProParent)) {
            return res.status(404).json({ error: 'Zamówienie nie znalezione' });
        }

        const oldData = parseJsonField<Record<string, unknown>>(o.data, {});
        const updatedData = { ...oldData, ...req.body };
        delete updatedData.id;
        delete updatedData.type;
        delete updatedData.userId;
        delete updatedData.offerStudnieId;
        delete updatedData.status;
        delete updatedData.createdAt;

        const newStatus = req.body.status || o.status;
        const newUserId = req.body.userId || o.userId;
        const dataStr = JSON.stringify(updatedData).replace(/'/g, "''");

        await prisma.$executeRawUnsafe(
            `UPDATE orders_studnie_rel SET status = '${newStatus}', "userId" = '${newUserId}', ` +
            `data = '${dataStr}' WHERE id = '${docId}'`
        );

        logAudit('order', docId, authReq.user?.id || '', 'update', updatedData, oldData);

        res.json({ ok: true });
    } catch (e: unknown) {
        const message = e instanceof Error ? e.message : 'Unknown error';
        res.status(500).json({ error: message });
    }
});

router.delete('/:id', requireAuth, writeOrdersLimiter, async (req, res) => {
    const authReq = req as AuthenticatedRequest;
    try {
        const docId = req.params.id;

        const rows = await prisma.$queryRawUnsafe<
            Array<{ id: string; userId: string | null; data: string | null }>
        >(`SELECT id, "userId", data FROM orders_studnie_rel WHERE id = '${docId}'`);
        const existing = rows[0];
        if (!existing) return res.json({ ok: true });

        const oldData = parseJsonField<Record<string, unknown>>(existing.data, {});
        const offerId = oldData.offerId || '';

        if (offerId) {
            const allPOs = await prisma.$queryRawUnsafe<
                Array<{ data: string | null }>
            >(`SELECT data FROM production_orders_rel`);
            const acceptedPOs = allPOs.filter((po) => {
                const poData = parseJsonField<Record<string, unknown>>(po.data, {});
                return poData.offerId === offerId && poData.status === 'accepted';
            });

            if (acceptedPOs.length > 0) {
                return res.status(403).json({
                    error: 'Nie można usunąć zamówienia — zawiera zaakceptowane zlecenia produkcyjne. Najpierw cofnij ich akceptację.'
                });
            }
        }

        logAudit('order', docId, authReq.user?.id || '', 'delete', null, oldData);

        if (authReq.user?.role === 'admin') {
            await prisma.$executeRawUnsafe(`DELETE FROM orders_studnie_rel WHERE id = '${docId}'`);
        } else {
            await prisma.$executeRawUnsafe(`DELETE FROM orders_studnie_rel WHERE id = '${docId}' AND "userId" = '${authReq.user?.id}'`);
        }
        res.json({ ok: true });
    } catch (e: unknown) {
        const message = e instanceof Error ? e.message : 'Unknown error';
        res.status(500).json({ error: message });
    }
});

export default router;
