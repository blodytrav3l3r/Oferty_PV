import express from 'express';
import prisma, { Prisma } from '../../prismaClient';
import { logAudit } from '../../db';
import { requireAuth, AuthenticatedRequest } from '../../middleware/auth';
import { parseJsonField, normalizeDate } from '../../helpers';
import { logger } from '../../utils/logger';
import { canReadDoc, canWriteDoc, resolveWriteUserId } from '../../utils/ownership';
import { buildRoleWhereCondition } from '../../utils/roleFilter';
import crypto from 'crypto';
import { validateData } from '../../validators/authSchema';
import { WRITE_LIMITER } from '../../middleware/rateLimiters';
import { searchCache } from '../../utils/searchCache';
import { mapProductionOrderRow } from '../../utils/productionSearchUtils';
import {
    productionOrdersBatchSchema,
    productionOrderCreateSchema
} from '../../validators/offerSchemas';

const router = express.Router();

async function recycleProductionNumber(userId: string, oldData: Record<string, unknown>) {
    const prodNum =
        typeof oldData.productionOrderNumber === 'string' ? oldData.productionOrderNumber : '';
    if (!prodNum) return;
    const parts = prodNum.split('/');
    if (parts.length < 4) return;
    const seqNumber = parseInt(parts[2], 10);
    const yearShort = parseInt(parts[3], 10);
    const fullYear = 2000 + yearShort;
    if (seqNumber > 0) {
        await prisma.$executeRaw`
            INSERT INTO recycled_production_numbers ("userId", year, seqNumber)
            VALUES (${userId}, ${fullYear}, ${seqNumber})
            ON CONFLICT ("userId", year, seqNumber) DO NOTHING
        `;
    }
}

const writeProductionLimiter = WRITE_LIMITER;

/* ===== PRODUCTION ORDERS (Zlecenia Produkcyjne) ===== */

router.get('/', requireAuth, async (req, res) => {
    const authReq = req as AuthenticatedRequest;
    try {
        const whereCondition = authReq.user
            ? buildRoleWhereCondition(authReq.user, 'production_orders_rel')
            : Prisma.empty;
        const orders = await prisma.$queryRaw<
            Array<{
                id: string;
                userId: string | null;
                orderId: string | null;
                wellId: string | null;
                elementIndex: number | null;
                elementKey: string | null;
                createdAt: string | null;
                updatedAt: string | null;
                data: string | null;
                handlerFirstName: string | null;
                handlerLastName: string | null;
                handlerUsername: string | null;
                creatorFirstName: string | null;
                creatorLastName: string | null;
                creatorUsername: string | null;
                dbSalesOrderNumber: string | null;
                dbSalesOrderId: string | null;
            }>
        >`SELECT production_orders_rel.id, production_orders_rel."userId", production_orders_rel."orderId", production_orders_rel."wellId", production_orders_rel."elementIndex", production_orders_rel."elementKey", production_orders_rel.data,
            CASE WHEN production_orders_rel."createdAt" GLOB '[0-9][0-9][0-9][0-9][0-9][0-9][0-9][0-9][0-9][0-9][0-9][0-9][0-9]'
                THEN datetime(CAST(production_orders_rel."createdAt" AS INTEGER)/1000, 'unixepoch')
                ELSE production_orders_rel."createdAt" END as "createdAt",
            CASE WHEN production_orders_rel."updatedAt" GLOB '[0-9][0-9][0-9][0-9][0-9][0-9][0-9][0-9][0-9][0-9][0-9][0-9][0-9]'
                THEN datetime(CAST(production_orders_rel."updatedAt" AS INTEGER)/1000, 'unixepoch')
                ELSE production_orders_rel."updatedAt" END as "updatedAt",
            u1."firstName" as handlerFirstName, u1."lastName" as handlerLastName, u1.username as handlerUsername,
            u2."firstName" as creatorFirstName, u2."lastName" as creatorLastName, u2.username as creatorUsername,
            json_extract(o.data, '$.orderNumber') as "dbSalesOrderNumber",
            o.id as "dbSalesOrderId"
         FROM production_orders_rel 
         LEFT JOIN users u1 ON production_orders_rel."userId" = u1.id
         LEFT JOIN users u2 ON production_orders_rel."creatorId" = u2.id
         LEFT JOIN orders_studnie_rel o ON o.id = production_orders_rel."orderId"
         ${whereCondition}`;

        const mapped = orders.map((o) => mapProductionOrderRow(o));

        res.json({ data: mapped });
    } catch (e: unknown) {
        const message = e instanceof Error ? e.message : 'Unknown error';
        logger.error('Production', 'Błąd serwera', message);
        res.status(500).json({ error: 'Wewnętrzny błąd serwera' });
    }
});

/**
 * Lekki indeks PZ (Faza 1 PZ): tylko kolumny + status/numer/offerId przez
 * json_extract — bez ciężkiej kolumny `data`. KB zamiast MB przy dużej tabeli.
 * MUSI być przed `/:id` (inaczej "index" wpadnie w param).
 */
router.get('/index', requireAuth, async (req, res) => {
    const authReq = req as AuthenticatedRequest;
    try {
        if (!authReq.user) return res.status(401).json({ error: 'Unauthorized' });
        const cacheKey = { scope: 'pz-index', _userId: authReq.user.id };
        const cached = searchCache.get('production', cacheKey);
        if (cached) return res.json(cached);

        const whereCondition = buildRoleWhereCondition(authReq.user, 'production_orders_rel');
        const rows = await prisma.$queryRaw<
            Array<{
                id: string;
                userId: string | null;
                orderId: string | null;
                wellId: string | null;
                elementIndex: number | null;
                elementKey: string | null;
                createdAt: string | null;
                updatedAt: string | null;
                status: string | null;
                productionOrderNumber: string | null;
                offerId: string | null;
            }>
        >`SELECT production_orders_rel.id, production_orders_rel."userId",
            production_orders_rel."orderId", production_orders_rel."wellId",
            production_orders_rel."elementIndex", production_orders_rel."elementKey",
            production_orders_rel."createdAt", production_orders_rel."updatedAt",
            json_extract(production_orders_rel.data, '$.status') as "status",
            json_extract(production_orders_rel.data, '$.productionOrderNumber') as "productionOrderNumber",
            json_extract(production_orders_rel.data, '$.offerId') as "offerId"
         FROM production_orders_rel
         ${whereCondition}`;

        const result = {
            data: rows.map((r) => ({
                id: r.id,
                type: 'production_order',
                userId: r.userId,
                orderId: r.orderId,
                wellId: r.wellId,
                elementIndex: r.elementIndex,
                elementKey: r.elementKey,
                createdAt: r.createdAt,
                updatedAt: r.updatedAt,
                status: r.status,
                productionOrderNumber: r.productionOrderNumber,
                offerId: r.offerId
            }))
        };
        searchCache.set('production', cacheKey, result);
        res.json(result);
    } catch (e: unknown) {
        const message = e instanceof Error ? e.message : 'Unknown error';
        logger.error('Production', 'Błąd serwera', message);
        res.status(500).json({ error: 'Wewnętrzny błąd serwera' });
    }
});

router.put(
    '/',
    requireAuth,
    writeProductionLimiter,
    validateData(productionOrdersBatchSchema),
    async (req, res) => {
        const authReq = req as AuthenticatedRequest;
        // Jawny partial success (bulk): zbierane id zapisanych pozycji — wołający
        // rozlicza claimed - saved (recycle tylko niezapisanych).
        const saved: string[] = [];
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
                    elementKey,
                    createdAt,
                    updatedAt,
                    ...rest
                } = o;
                const dataStr = JSON.stringify(rest);

                const old = await prisma.production_orders_rel.findUnique({
                    where: { id: docId },
                    select: { data: true, userId: true }
                });

                if (old && !canWriteDoc(authReq.user, old.userId)) {
                    return res
                        .status(403)
                        .json({ error: 'Brak uprawnień do zapisu dla tego użytkownika' });
                }

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
                        elementKey: elementKey || '',
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
                        elementKey: elementKey || '',
                        createdAt: createdAt || new Date().toISOString(),
                        updatedAt: updatedAt || new Date().toISOString(),
                        data: dataStr
                    }
                });
                saved.push(docId);
            }

            searchCache.invalidateNamespace('production');
            res.json({ ok: true, saved });
        } catch (e: unknown) {
            const message = e instanceof Error ? e.message : 'Unknown error';
            logger.error('Production', 'Błąd serwera', message);
            res.status(500).json({ error: 'Wewnętrzny błąd serwera', saved });
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
                elementKey,
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

            if (old && !canWriteDoc(authReq.user, old.userId)) {
                return res
                    .status(403)
                    .json({ error: 'Brak uprawnień do zapisu dla tego użytkownika' });
            }

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
                    elementKey: elementKey || '',
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
                    elementKey: elementKey || '',
                    updatedAt: updatedAt,
                    data: dataStr
                }
            });

            searchCache.invalidateNamespace('production');
            res.json({ ok: true, id: docId });
        } catch (e: unknown) {
            const message = e instanceof Error ? e.message : 'Unknown error';
            logger.error('Production', 'Błąd POST', message);
            res.status(500).json({ error: 'Wewnętrzny błąd serwera' });
        }
    }
);

router.post('/batch-delete', requireAuth, writeProductionLimiter, async (req, res) => {
    const authReq = req as AuthenticatedRequest;
    try {
        const { ids } = req.body || {};
        if (!Array.isArray(ids) || ids.length === 0) {
            return res.status(400).json({ error: 'Brak identyfikatorów zleceń do usunięcia' });
        }
        if (ids.length > 200) {
            return res.status(400).json({ error: 'Zbyt wiele zleceń w jednym żądaniu (max 200)' });
        }
        const uniqueIds = [...new Set(ids.filter((id) => typeof id === 'string' && id.length > 0))];
        if (uniqueIds.length === 0) {
            return res.status(400).json({ error: 'Brak identyfikatorów zleceń do usunięcia' });
        }

        const existing = await prisma.production_orders_rel.findMany({
            where: { id: { in: uniqueIds } },
            select: { id: true, userId: true, data: true }
        });

        // Rozdzielenie: brak uprawnień -> 403, zatwierdzone (accepted) -> pominięcie w odpowiedzi
        const deletable: typeof existing = [];
        let skipped = 0;
        for (const order of existing) {
            if (!canWriteDoc(authReq.user, order.userId)) {
                return res.status(403).json({ error: 'Brak uprawnień do usunięcia tego zlecenia' });
            }
            const oldData = parseJsonField<Record<string, unknown>>(order.data, {});
            if (oldData.status === 'accepted') {
                skipped++;
            } else {
                deletable.push(order);
            }
        }

        const deletedResult =
            deletable.length > 0
                ? await prisma.production_orders_rel.deleteMany({
                      where: { id: { in: deletable.map((o) => o.id) } }
                  })
                : { count: 0 };

        for (const order of deletable) {
            const oldData = parseJsonField<Record<string, unknown>>(order.data, {});
            logAudit('production_order', order.id, order.userId || '', 'delete', null, oldData);
            await recycleProductionNumber(order.userId || '', oldData);
        }
        searchCache.invalidateNamespace('production');
        res.json({ deleted: deletedResult.count, skipped });
    } catch (e: unknown) {
        const message = e instanceof Error ? e.message : 'Unknown error';
        logger.error('Production', 'Błąd serwera', message);
        res.status(500).json({ error: 'Wewnętrzny błąd serwera' });
    }
});
/**
 * Zwrot niewykorzystanych numerów produkcyjnych do puli recycled (bulk P0).
 * Invariant: zwracany jest tylko numer, dla którego wiadomo, że zapis się nie udał
 * (reconciliation claimed - saved po stronie wołającego).
 */
router.post('/recycle-numbers', requireAuth, writeProductionLimiter, async (req, res) => {
    const authReq = req as AuthenticatedRequest;
    try {
        const { userId, seqNumbers, year } = req.body || {};
        if (typeof userId !== 'string' || userId.length === 0) {
            return res.status(400).json({ error: 'Brak userId' });
        }
        if (!canWriteDoc(authReq.user, userId)) {
            return res.status(403).json({ error: 'Brak uprawnień do numerów tego użytkownika' });
        }
        if (!Array.isArray(seqNumbers) || seqNumbers.length === 0) {
            return res.status(400).json({ error: 'Brak numerów do zwrotu' });
        }
        if (seqNumbers.length > 200) {
            return res.status(400).json({ error: 'Zbyt wiele numerów w jednym żądaniu (max 200)' });
        }
        const seqs = [...new Set(seqNumbers.filter((s) => Number.isInteger(s) && s > 0))];
        if (seqs.length === 0) {
            return res.status(400).json({ error: 'Brak numerów do zwrotu' });
        }
        const targetYear =
            Number.isInteger(year) && year > 2000 && year < 2100 ? year : new Date().getFullYear();
        const rows = seqs.map((seq) => Prisma.sql`(${userId}, ${targetYear}, ${seq})`);
        await prisma.$executeRaw`
            INSERT INTO recycled_production_numbers ("userId", year, seqNumber)
            VALUES ${Prisma.join(rows)}
            ON CONFLICT ("userId", year, seqNumber) DO NOTHING
        `;
        res.json({ ok: true, returned: seqs.length });
    } catch (e: unknown) {
        const message = e instanceof Error ? e.message : 'Unknown error';
        logger.error('Production', 'Błąd serwera', message);
        res.status(500).json({ error: 'Wewnętrzny błąd serwera' });
    }
});

router.get('/:id', requireAuth, async (req, res) => {
    const authReq = req as AuthenticatedRequest;
    try {
        const docId = req.params.id;

        const order = await prisma.production_orders_rel.findUnique({
            where: { id: docId }
        });
        if (!order || !canReadDoc(authReq.user, order.userId)) {
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
                elementKey: order.elementKey,
                createdAt: order.createdAt,
                updatedAt: order.updatedAt,
                ...parsedData
            }
        });
    } catch (e: unknown) {
        const message = e instanceof Error ? e.message : 'Unknown error';
        logger.error('Production', 'Błąd serwera', message);
        res.status(500).json({ error: 'Wewnętrzny błąd serwera' });
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

        await recycleProductionNumber(existing.userId || '', oldData);

        if (authReq.user?.role === 'admin') {
            await prisma.$executeRaw`DELETE FROM production_orders_rel WHERE id = ${docId}`;
        } else {
            await prisma.production_orders_rel.deleteMany({
                where: { id: docId, userId: authReq.user?.id }
            });
        }
        searchCache.invalidateNamespace('production');
        res.json({ ok: true });
    } catch (e: unknown) {
        const message = e instanceof Error ? e.message : 'Unknown error';
        logger.error('Production', 'Błąd serwera', message);
        res.status(500).json({ error: 'Wewnętrzny błąd serwera' });
    }
});

export default router;
