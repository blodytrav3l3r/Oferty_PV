import express from 'express';
import prisma from '../../prismaClient';
import { logAudit } from '../../db';
import { requireAuth, AuthenticatedRequest } from '../../middleware/auth';
import { parseJsonField } from '../../helpers';
import { logger } from '../../utils/logger';
import { validateData } from '../../validators/authSchema';
import { productionOrdersBatchSchema, productionOrderCreateSchema } from '../../validators/offerSchemas';

const router = express.Router();

/* ===== PRODUCTION ORDERS (Zlecenia Produkcyjne) ===== */

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
                orderId: string | null;
                wellId: string | null;
                elementIndex: number | null;
                createdAt: string | null;
                updatedAt: string | null;
                data: string | null;
            }>
        >(`SELECT id, "userId", "orderId", "wellId", "elementIndex", data,
            CASE WHEN "createdAt" GLOB '[0-9][0-9][0-9][0-9][0-9][0-9][0-9][0-9][0-9][0-9][0-9][0-9][0-9]'
                THEN datetime(CAST("createdAt" AS INTEGER)/1000, 'unixepoch')
                ELSE "createdAt" END as "createdAt",
            CASE WHEN "updatedAt" GLOB '[0-9][0-9][0-9][0-9][0-9][0-9][0-9][0-9][0-9][0-9][0-9][0-9][0-9]'
                THEN datetime(CAST("updatedAt" AS INTEGER)/1000, 'unixepoch')
                ELSE "updatedAt" END as "updatedAt"
         FROM production_orders_rel ${whereSql}`);

        const mapped = orders.map((o) => {
            const parsedData = parseJsonField<Record<string, unknown>>(o.data, {});
            return {
                id: o.id,
                type: 'production_order',
                userId: o.userId,
                orderId: o.orderId,
                wellId: o.wellId,
                elementIndex: o.elementIndex,
                createdAt: o.createdAt,
                updatedAt: o.updatedAt,
                ...parsedData
            };
        });

        res.json({ data: mapped });
    } catch (e: unknown) {
        const message = e instanceof Error ? e.message : 'Unknown error';
        res.status(500).json({ error: message });
    }
});

router.get('/registry', requireAuth, async (req, res) => {
    const authReq = req as AuthenticatedRequest;
    try {
        const whereSql = authReq.user ? buildRoleWhereSql(authReq.user) : '';
        const orders = await prisma.$queryRawUnsafe<
            Array<{
                id: string;
                userId: string | null;
                orderId: string | null;
                wellId: string | null;
                elementIndex: number | null;
                createdAt: string | null;
                updatedAt: string | null;
                data: string | null;
            }>
        >(`SELECT id, "userId", "orderId", "wellId", "elementIndex", data,
            CASE WHEN "createdAt" GLOB '[0-9][0-9][0-9][0-9][0-9][0-9][0-9][0-9][0-9][0-9][0-9][0-9][0-9]'
                THEN datetime(CAST("createdAt" AS INTEGER)/1000, 'unixepoch')
                ELSE "createdAt" END as "createdAt",
            CASE WHEN "updatedAt" GLOB '[0-9][0-9][0-9][0-9][0-9][0-9][0-9][0-9][0-9][0-9][0-9][0-9][0-9]'
                THEN datetime(CAST("updatedAt" AS INTEGER)/1000, 'unixepoch')
                ELSE "updatedAt" END as "updatedAt"
         FROM production_orders_rel ${whereSql} ORDER BY "createdAt" DESC`);

        const mapped = orders.map((o) => {
            const parsedData = parseJsonField<Record<string, unknown>>(o.data, {});
            return {
                id: o.id,
                type: 'production_order',
                userId: o.userId,
                orderId: o.orderId,
                wellId: o.wellId,
                elementIndex: o.elementIndex,
                createdAt: o.createdAt,
                updatedAt: o.updatedAt,
                ...parsedData
            };
        });

        res.json({ data: mapped });
    } catch (e: unknown) {
        const message = e instanceof Error ? e.message : 'Unknown error';
        res.status(500).json({ error: message });
    }
});

router.put('/', requireAuth, validateData(productionOrdersBatchSchema), async (req, res) => {
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
                userId,
                orderId,
                wellId,
                elementIndex,
                createdAt,
                updatedAt,
                ...rest
            } = o;
            const dataStr = JSON.stringify(rest);

            const old = await prisma.production_orders_rel.findUnique({
                where: { id: docId },
                select: { data: true }
            });
            if (old) {
                logAudit(
                    'production_order',
                    docId,
                    authReq.user?.id || '',
                    'update',
                    rest,
                    parseJsonField<Record<string, unknown>>(old.data, {})
                );
            } else {
                logAudit('production_order', docId, authReq.user?.id || '', 'create', rest);
            }

            await prisma.production_orders_rel.upsert({
                where: { id: docId },
                create: {
                    id: docId,
                    userId: userId || authReq.user?.id,
                    creatorId: authReq.user?.id,
                    orderId: orderId || '',
                    wellId: wellId || '',
                    elementIndex: elementIndex || 0,
                    createdAt: createdAt || new Date().toISOString(),
                    updatedAt: updatedAt || new Date().toISOString(),
                    data: dataStr
                },
                update: {
                    userId: userId || authReq.user?.id,
                    creatorId: authReq.user?.id,
                    orderId: orderId || '',
                    wellId: wellId || '',
                    elementIndex: elementIndex || 0,
                    createdAt: createdAt || new Date().toISOString(),
                    updatedAt: updatedAt || new Date().toISOString(),
                    data: dataStr
                }
            });
        }

        res.json({ ok: true });
    } catch (e: unknown) {
        const message = e instanceof Error ? e.message : 'Unknown error';
        res.status(500).json({ error: message });
    }
});

router.post('/', requireAuth, validateData(productionOrderCreateSchema), async (req, res) => {
    const authReq = req as AuthenticatedRequest;
    try {
        const o = req.body;

        let docId = o.id;
        if (!docId) {
            docId = Date.now().toString() + '_' + Math.random().toString(36).substr(2, 5);
        }

        const {
            id: _id,
            type: _type,
            userId,
            orderId,
            wellId,
            elementIndex,
            createdAt: createdAtRaw,
            updatedAt: updatedAtRaw,
            ...rest
        } = o;
        const dataStr = JSON.stringify(rest).replace(/'/g, "''");

        // Konwersja dat z timestamp na ISO string
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
        const updatedAt = convertDate(updatedAtRaw);

        // Użyj raw query dla find (obsługa błędnych dat w bazie)
        const oldRows = await prisma.$queryRawUnsafe<
            Array<{ data: string | null }>
        >(`SELECT data FROM production_orders_rel WHERE id = '${docId}'`);
        const old = oldRows[0];

        if (old) {
            logAudit(
                'production_order',
                docId,
                authReq.user?.id || '',
                'update',
                rest,
                parseJsonField<Record<string, unknown>>(old.data, {})
            );
        } else {
            logAudit('production_order', docId, authReq.user?.id || '', 'create', rest);
        }

        // Użyj raw query dla INSERT/UPDATE
        const updateResult = await prisma.$executeRawUnsafe(
            `UPDATE production_orders_rel SET "userId" = '${userId || authReq.user?.id || ''}', ` +
            `"creatorId" = '${authReq.user?.id || ''}', "orderId" = '${orderId || ''}', ` +
            `"wellId" = '${wellId || ''}', "elementIndex" = ${elementIndex || 0}, ` +
            `"updatedAt" = '${updatedAt}', data = '${dataStr}' WHERE id = '${docId}'`
        );
        if (updateResult === 0) {
            await prisma.$executeRawUnsafe(
                `INSERT INTO production_orders_rel (id, "userId", "creatorId", "orderId", "wellId", ` +
                `"elementIndex", "createdAt", "updatedAt", data) VALUES ` +
                `('${docId}', '${userId || authReq.user?.id || ''}', '${authReq.user?.id || ''}', ` +
                `'${orderId || ''}', '${wellId || ''}', ${elementIndex || 0}, '${createdAt}', '${updatedAt}', '${dataStr}')`
            );
        }

        res.json({ ok: true, id: docId });
    } catch (e: unknown) {
        const message = e instanceof Error ? e.message : 'Unknown error';
        logger.error('Production', 'Błąd POST', message);
        res.status(500).json({ error: message });
    }
});

router.get('/:id', requireAuth, async (req, res) => {
    const authReq = req as AuthenticatedRequest;
    try {
        const docId = req.params.id;

        // Użyj raw query aby obsłużyć błędne daty w bazie
        const orders = await prisma.$queryRawUnsafe<
            Array<{
                id: string;
                userId: string | null;
                orderId: string | null;
                wellId: string | null;
                elementIndex: number | null;
                createdAt: string | null;
                updatedAt: string | null;
                data: string | null;
            }>
        >(`SELECT id, "userId", "orderId", "wellId", "elementIndex", data,
            CASE WHEN "createdAt" GLOB '[0-9][0-9][0-9][0-9][0-9][0-9][0-9][0-9][0-9][0-9][0-9][0-9][0-9]'
                THEN datetime(CAST("createdAt" AS INTEGER)/1000, 'unixepoch')
                ELSE "createdAt" END as "createdAt",
            CASE WHEN "updatedAt" GLOB '[0-9][0-9][0-9][0-9][0-9][0-9][0-9][0-9][0-9][0-9][0-9][0-9][0-9]'
                THEN datetime(CAST("updatedAt" AS INTEGER)/1000, 'unixepoch')
                ELSE "updatedAt" END as "updatedAt"
         FROM production_orders_rel WHERE id = '${docId}'`);
        const order = orders[0];
        if (!order || (authReq.user?.role !== 'admin' && order.userId !== authReq.user?.id)) {
            return res.status(404).json({ error: 'Zlecenie nie znalezione' });
        }

        const parsedData = parseJsonField<Record<string, unknown>>(order.data, {});

        res.json({
            data: {
                id: order.id,
                type: 'production_order',
                userId: order.userId,
                orderId: order.orderId,
                wellId: order.wellId,
                elementIndex: order.elementIndex,
                createdAt: order.createdAt,
                updatedAt: order.updatedAt,
                ...parsedData
            }
        });
    } catch (e: unknown) {
        const message = e instanceof Error ? e.message : 'Unknown error';
        res.status(500).json({ error: message });
    }
});

router.delete('/:id', requireAuth, async (req, res) => {
    const authReq = req as AuthenticatedRequest;
    try {
        const docId = req.params.id;

        // Użyj raw query aby obsłużyć błędne daty w bazie
        const existingRows = await prisma.$queryRawUnsafe<
            Array<{ id: string; userId: string | null; data: string | null }>
        >(`SELECT id, "userId", data FROM production_orders_rel WHERE id = '${docId}'`);
        const existing = existingRows[0];
        if (!existing) return res.json({ ok: true });

        const oldData = parseJsonField<Record<string, unknown>>(existing.data, {});

        if (oldData.status === 'accepted') {
            return res
                .status(403)
                .json({ error: 'Nie można usunąć zatwierdzonego zlecenia. Najpierw je cofnij.' });
        }

        logAudit('production_order', docId, existing.userId || '', 'delete', null, oldData);

        // Recykling numeru zlecenia produkcyjnego (recykle)
        const prodNum = typeof oldData.productionOrderNumber === 'string' ? oldData.productionOrderNumber : '';
        if (prodNum) {
            const parts = prodNum.split('/');
            if (parts.length >= 4) {
                const seqNumber = parseInt(parts[2], 10);
                const yearShort = parseInt(parts[3], 10);
                const fullYear = 2000 + yearShort;
                if (seqNumber > 0) {
                    await prisma.$executeRawUnsafe(
                        `INSERT INTO recycled_production_numbers ("userId", year, seqNumber) ` +
                        `VALUES ('${existing.userId || ''}', ${fullYear}, ${seqNumber}) ` +
                        `ON CONFLICT ("userId", year, seqNumber) DO NOTHING`
                    );
                }
            }
        }

        // Użyj raw query dla delete
        if (authReq.user?.role === 'admin') {
            await prisma.$executeRawUnsafe(`DELETE FROM production_orders_rel WHERE id = '${docId}'`);
        } else {
            await prisma.$executeRawUnsafe(`DELETE FROM production_orders_rel WHERE id = '${docId}' AND "userId" = '${authReq.user?.id}'`);
        }
        res.json({ ok: true });
    } catch (e: unknown) {
        const message = e instanceof Error ? e.message : 'Unknown error';
        res.status(500).json({ error: message });
    }
});

export default router;
