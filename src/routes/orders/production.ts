import express from 'express';
import prisma, { Prisma } from '../../prismaClient';
import { logAudit } from '../../db';
import { requireAuth, AuthenticatedRequest } from '../../middleware/auth';
import { parseJsonField, normalizeDate } from '../../helpers';
import { logger } from '../../utils/logger';
import { canWriteDoc, resolveWriteUserId } from '../../utils/ownership';
import { buildRoleWhereCondition } from '../../utils/roleFilter';
import crypto from 'crypto';
import { validateData } from '../../validators/authSchema';
import { WRITE_LIMITER } from '../../middleware/rateLimiters';
import {
    productionOrdersBatchSchema,
    productionOrderCreateSchema
} from '../../validators/offerSchemas';

const router = express.Router();

const writeProductionLimiter = WRITE_LIMITER;

/* ===== PRODUCTION ORDERS (Zlecenia Produkcyjne) ===== */

router.get('/', requireAuth, async (req, res) => {
    const authReq = req as AuthenticatedRequest;
    try {
        const whereCondition = authReq.user ? buildRoleWhereCondition(authReq.user) : Prisma.empty;
        const orders = await prisma.$queryRaw<
            Array<{
                id: string;
                userId: string | null;
                orderId: string | null;
                wellId: string | null;
                elementIndex: number | null;
                createdAt: string | null;
                updatedAt: string | null;
                data: string | null;
                handlerFirstName: string | null;
                handlerLastName: string | null;
                handlerUsername: string | null;
                creatorFirstName: string | null;
                creatorLastName: string | null;
                creatorUsername: string | null;
                orderData: string | null;
                dbSalesOrderId: string | null;
            }>
        >`SELECT production_orders_rel.id, production_orders_rel."userId", production_orders_rel."orderId", production_orders_rel."wellId", production_orders_rel."elementIndex", production_orders_rel.data,
            CASE WHEN production_orders_rel."createdAt" GLOB '[0-9][0-9][0-9][0-9][0-9][0-9][0-9][0-9][0-9][0-9][0-9][0-9][0-9]'
                THEN datetime(CAST(production_orders_rel."createdAt" AS INTEGER)/1000, 'unixepoch')
                ELSE production_orders_rel."createdAt" END as "createdAt",
            CASE WHEN production_orders_rel."updatedAt" GLOB '[0-9][0-9][0-9][0-9][0-9][0-9][0-9][0-9][0-9][0-9][0-9][0-9][0-9]'
                THEN datetime(CAST(production_orders_rel."updatedAt" AS INTEGER)/1000, 'unixepoch')
                ELSE production_orders_rel."updatedAt" END as "updatedAt",
            u1."firstName" as handlerFirstName, u1."lastName" as handlerLastName, u1.username as handlerUsername,
            u2."firstName" as creatorFirstName, u2."lastName" as creatorLastName, u2.username as creatorUsername, o.data as orderData,
            o.id as "dbSalesOrderId"
         FROM production_orders_rel 
         LEFT JOIN users u1 ON production_orders_rel."userId" = u1.id
         LEFT JOIN users u2 ON production_orders_rel."creatorId" = u2.id
         LEFT JOIN orders_studnie_rel o ON o.id = production_orders_rel."orderId"
         ${whereCondition}`;

        const mapped = orders.map((o) => {
            const parsedData = parseJsonField<Record<string, unknown>>(o.data, {});

            const handlerName =
                o.handlerFirstName || o.handlerLastName
                    ? `${o.handlerFirstName || ''} ${o.handlerLastName || ''}`.trim()
                    : o.handlerUsername || '';

            const creatorName =
                o.creatorFirstName || o.creatorLastName
                    ? `${o.creatorFirstName || ''} ${o.creatorLastName || ''}`.trim()
                    : o.creatorUsername || '';

            const orderParsed = o.orderData
                ? parseJsonField<Record<string, unknown>>(o.orderData, {})
                : {};
            const dbSalesOrderNumber = (orderParsed.orderNumber || '') as string;
            return {
                id: o.id,
                type: 'production_order',
                userId: o.userId,
                orderId: o.orderId,
                wellId: o.wellId,
                elementIndex: o.elementIndex,
                createdAt: o.createdAt,
                updatedAt: o.updatedAt,
                handlerName: handlerName || undefined,
                creatorName: creatorName || undefined,
                ...parsedData,
                dbSalesOrderNumber: dbSalesOrderNumber || undefined,
                dbSalesOrderId: o.dbSalesOrderId || undefined
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
        const whereCondition = authReq.user ? buildRoleWhereCondition(authReq.user) : Prisma.empty;
        const orders = await prisma.$queryRaw<
            Array<{
                id: string;
                userId: string | null;
                orderId: string | null;
                wellId: string | null;
                elementIndex: number | null;
                createdAt: string | null;
                updatedAt: string | null;
                data: string | null;
                handlerFirstName: string | null;
                handlerLastName: string | null;
                handlerUsername: string | null;
                creatorFirstName: string | null;
                creatorLastName: string | null;
                creatorUsername: string | null;
                orderData: string | null;
                dbSalesOrderId: string | null;
            }>
        >`SELECT production_orders_rel.id, production_orders_rel."userId", production_orders_rel."orderId", production_orders_rel."wellId", production_orders_rel."elementIndex", production_orders_rel.data,
            CASE WHEN production_orders_rel."createdAt" GLOB '[0-9][0-9][0-9][0-9][0-9][0-9][0-9][0-9][0-9][0-9][0-9][0-9][0-9]'
                THEN datetime(CAST(production_orders_rel."createdAt" AS INTEGER)/1000, 'unixepoch')
                ELSE production_orders_rel."createdAt" END as "createdAt",
            CASE WHEN production_orders_rel."updatedAt" GLOB '[0-9][0-9][0-9][0-9][0-9][0-9][0-9][0-9][0-9][0-9][0-9][0-9][0-9]'
                THEN datetime(CAST(production_orders_rel."updatedAt" AS INTEGER)/1000, 'unixepoch')
                ELSE production_orders_rel."updatedAt" END as "updatedAt",
            u1."firstName" as handlerFirstName, u1."lastName" as handlerLastName, u1.username as handlerUsername,
            u2."firstName" as creatorFirstName, u2."lastName" as creatorLastName, u2.username as creatorUsername, o.data as orderData,
            o.id as "dbSalesOrderId"
         FROM production_orders_rel 
         LEFT JOIN users u1 ON production_orders_rel."userId" = u1.id
         LEFT JOIN users u2 ON production_orders_rel."creatorId" = u2.id
         LEFT JOIN orders_studnie_rel o ON o.id = production_orders_rel."orderId"
         ${whereCondition} ORDER BY production_orders_rel."createdAt" DESC`;

        const mapped = orders.map((o) => {
            const parsedData = parseJsonField<Record<string, unknown>>(o.data, {});

            const handlerName =
                o.handlerFirstName || o.handlerLastName
                    ? `${o.handlerFirstName || ''} ${o.handlerLastName || ''}`.trim()
                    : o.handlerUsername || '';

            const creatorName =
                o.creatorFirstName || o.creatorLastName
                    ? `${o.creatorFirstName || ''} ${o.creatorLastName || ''}`.trim()
                    : o.creatorUsername || '';

            const orderParsed = o.orderData
                ? parseJsonField<Record<string, unknown>>(o.orderData, {})
                : {};
            const dbSalesOrderNumber = (orderParsed.orderNumber || '') as string;
            return {
                id: o.id,
                type: 'production_order',
                userId: o.userId,
                orderId: o.orderId,
                wellId: o.wellId,
                elementIndex: o.elementIndex,
                createdAt: o.createdAt,
                updatedAt: o.updatedAt,
                handlerName: handlerName || undefined,
                creatorName: creatorName || undefined,
                ...parsedData,
                dbSalesOrderNumber: dbSalesOrderNumber || undefined,
                dbSalesOrderId: o.dbSalesOrderId || undefined
            };
        });

        res.json({ data: mapped });
    } catch (e: unknown) {
        const message = e instanceof Error ? e.message : 'Unknown error';
        res.status(500).json({ error: message });
    }
});

router.put(
    '/',
    requireAuth,
    writeProductionLimiter,
    validateData(productionOrdersBatchSchema),
    async (req, res) => {
        const authReq = req as AuthenticatedRequest;
        try {
            const incoming = req.body.data || [];

            for (const o of incoming) {
                let docId = o.id;
                if (!docId) {
                    docId = crypto.randomUUID();
                }

                const {
                    id: _id,
                    type: _type,
                    userId: incomingUserId,
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
                    select: { data: true, userId: true }
                });

                const targetUserId = old?.userId || incomingUserId || authReq.user?.id || '';
                if (!canWriteDoc(authReq.user, targetUserId)) {
                    return res.status(403).json({ error: 'Brak uprawnień do tego zlecenia' });
                }

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
                        userId: targetUserId,
                        creatorId: authReq.user?.id,
                        orderId: orderId || '',
                        wellId: wellId || '',
                        elementIndex: elementIndex || 0,
                        createdAt: createdAt || new Date().toISOString(),
                        updatedAt: updatedAt || new Date().toISOString(),
                        data: dataStr
                    },
                    update: {
                        userId: targetUserId,
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
    }
);

router.post(
    '/',
    requireAuth,
    writeProductionLimiter,
    validateData(productionOrderCreateSchema),
    async (req, res) => {
        const authReq = req as AuthenticatedRequest;
        try {
            const o = req.body;

            let docId = o.id;
            if (!docId) {
                docId = crypto.randomUUID();
            }

            const {
                id: _id,
                type: _type,
                userId: incomingUserId,
                orderId,
                wellId,
                elementIndex,
                createdAt: createdAtRaw,
                updatedAt: updatedAtRaw,
                ...rest
            } = o;
            const dataStr = JSON.stringify(rest);

            const createdAt = normalizeDate(createdAtRaw);
            const updatedAt = normalizeDate(updatedAtRaw);

            const old = await prisma.production_orders_rel.findUnique({
                where: { id: docId },
                select: { data: true, userId: true }
            });

            const writeResult = resolveWriteUserId(authReq.user, old?.userId || incomingUserId);
            if (!writeResult.allowed) {
                return res
                    .status(403)
                    .json({ error: 'Brak uprawnień do zapisu dla tego użytkownika' });
            }
            const targetUserId = writeResult.effectiveUserId;

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
                    userId: targetUserId,
                    creatorId: authReq.user?.id || '',
                    orderId: orderId || '',
                    wellId: wellId || '',
                    elementIndex: elementIndex || 0,
                    createdAt: createdAt,
                    updatedAt: updatedAt,
                    data: dataStr
                },
                update: {
                    userId: targetUserId,
                    creatorId: authReq.user?.id || '',
                    orderId: orderId || '',
                    wellId: wellId || '',
                    elementIndex: elementIndex || 0,
                    updatedAt: updatedAt,
                    data: dataStr
                }
            });

            res.json({ ok: true, id: docId });
        } catch (e: unknown) {
            const message = e instanceof Error ? e.message : 'Unknown error';
            logger.error('Production', 'Błąd POST', message);
            res.status(500).json({ error: message });
        }
    }
);

router.get('/:id', requireAuth, async (req, res) => {
    const authReq = req as AuthenticatedRequest;
    try {
        const docId = req.params.id;

        const order = await prisma.production_orders_rel.findUnique({
            where: { id: docId }
        });
        if (!order || !canWriteDoc(authReq.user, order.userId)) {
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

router.delete('/:id', requireAuth, writeProductionLimiter, async (req, res) => {
    const authReq = req as AuthenticatedRequest;
    try {
        const docId = req.params.id;

        const existing = await prisma.production_orders_rel.findUnique({
            where: { id: docId },
            select: { id: true, userId: true, data: true }
        });
        if (!existing) return res.json({ ok: true });
        if (!canWriteDoc(authReq.user, existing.userId)) {
            return res.status(403).json({ error: 'Brak uprawnień do usunięcia tego zlecenia' });
        }

        const oldData = parseJsonField<Record<string, unknown>>(existing.data, {});

        if (oldData.status === 'accepted') {
            return res
                .status(403)
                .json({ error: 'Nie można usunąć zatwierdzonego zlecenia. Najpierw je cofnij.' });
        }

        logAudit('production_order', docId, existing.userId || '', 'delete', null, oldData);

        // Recykling numeru zlecenia produkcyjnego (recykle)
        const prodNum =
            typeof oldData.productionOrderNumber === 'string' ? oldData.productionOrderNumber : '';
        if (prodNum) {
            const parts = prodNum.split('/');
            if (parts.length >= 4) {
                const seqNumber = parseInt(parts[2], 10);
                const yearShort = parseInt(parts[3], 10);
                const fullYear = 2000 + yearShort;
                if (seqNumber > 0) {
                    await prisma.$executeRaw`
                        INSERT INTO recycled_production_numbers ("userId", year, seqNumber)
                        VALUES (${existing.userId || ''}, ${fullYear}, ${seqNumber})
                        ON CONFLICT ("userId", year, seqNumber) DO NOTHING
                    `;
                }
            }
        }

        if (authReq.user?.role === 'admin') {
            await prisma.$executeRaw`DELETE FROM production_orders_rel WHERE id = ${docId}`;
        } else {
            await prisma.production_orders_rel.deleteMany({
                where: { id: docId, userId: authReq.user?.id }
            });
        }
        res.json({ ok: true });
    } catch (e: unknown) {
        const message = e instanceof Error ? e.message : 'Unknown error';
        res.status(500).json({ error: message });
    }
});

export default router;
