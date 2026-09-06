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
                version: number | null;
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
        >`SELECT production_orders_rel.id, production_orders_rel."userId", production_orders_rel."orderId", production_orders_rel."wellId", production_orders_rel."elementIndex", production_orders_rel."elementKey", production_orders_rel.data, production_orders_rel.version,
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
        // P0-C: całość albo nic. Zod (validateData) sprawdza kształt całego
        // batcha PRZED transakcją; ownership sprawdzany W transakcji (TOCTOU).
        const saved: string[] = [];
        try {
            const incoming = req.body.data || [];

            await prisma.$transaction(
                async (tx) => {
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
                            // P0-D: baza optimistic lockingu — nie trafia do bloba JSON.
                            version: clientVersionRaw,
                            ...rest
                        } = o;
                        const clientVersion =
                            typeof clientVersionRaw === 'number' ? clientVersionRaw : null;
                        const dataStr = JSON.stringify(rest);
                        // P0-A: finalny numer produkcyjny do kolumny pod UNIQUE.
                        // Update z undefined nie nadpisuje (Prisma pomija undefined).
                        const prodNum =
                            typeof (rest as Record<string, unknown>).productionOrderNumber ===
                            'string'
                                ? ((rest as Record<string, unknown>)
                                      .productionOrderNumber as string)
                                : undefined;

                        const old = await tx.production_orders_rel.findUnique({
                            where: { id: docId },
                            select: { data: true, userId: true, version: true }
                        });

                        // P0-C: guard W transakcji — return zamieniony na throw, żeby
                        // cofnąć cały batch (wcześniej: 403 w połowie = partial write).
                        if (old && !canWriteDoc(authReq.user, old.userId)) {
                            throw {
                                status: 403,
                                message: 'Brak uprawnień do zapisu dla tego użytkownika'
                            };
                        }

                        const targetUserId =
                            old?.userId || incomingUserId || authReq.user?.id || '';
                        if (!canWriteDoc(authReq.user, targetUserId)) {
                            throw { status: 403, message: 'Brak uprawnień do tego zlecenia' };
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
                            logAudit(
                                'production_order',
                                docId,
                                authReq.user?.id || '',
                                'create',
                                rest
                            );
                        }

                        if (!old) {
                            await tx.production_orders_rel.create({
                                data: {
                                    id: docId,
                                    userId: targetUserId,
                                    creatorId: authReq.user?.id,
                                    orderId: orderId || '',
                                    wellId: wellId || '',
                                    elementIndex: elementIndex || 0,
                                    elementKey: elementKey || '',
                                    createdAt: createdAt || new Date().toISOString(),
                                    updatedAt: updatedAt || new Date().toISOString(),
                                    data: dataStr,
                                    productionNumber: prodNum ?? null,
                                    version: 1
                                }
                            });
                        } else if (clientVersion != null) {
                            // P0-D: predykat w JEDNYM SQL (SET version+1 WHERE
                            // id+version). 0 wierszy = ktoś zapisał wcześniej.
                            const upd = await tx.production_orders_rel.updateMany({
                                where: { id: docId, version: clientVersion },
                                data: {
                                    userId: targetUserId,
                                    creatorId: authReq.user?.id,
                                    orderId: orderId || '',
                                    wellId: wellId || '',
                                    elementIndex: elementIndex || 0,
                                    elementKey: elementKey || '',
                                    createdAt: createdAt || new Date().toISOString(),
                                    updatedAt: updatedAt || new Date().toISOString(),
                                    data: dataStr,
                                    productionNumber: prodNum,
                                    version: { increment: 1 }
                                }
                            });
                            if (upd.count === 0) {
                                throw {
                                    status: 409,
                                    code: 'VERSION_CONFLICT',
                                    message:
                                        'Zlecenie zmienione przez innego użytkownika — odśwież i spróbuj ponownie',
                                    serverVersion: old.version ?? 1
                                };
                            }
                        } else {
                            await tx.production_orders_rel.update({
                                where: { id: docId },
                                data: {
                                    userId: targetUserId,
                                    creatorId: authReq.user?.id,
                                    orderId: orderId || '',
                                    wellId: wellId || '',
                                    elementIndex: elementIndex || 0,
                                    elementKey: elementKey || '',
                                    createdAt: createdAt || new Date().toISOString(),
                                    updatedAt: updatedAt || new Date().toISOString(),
                                    data: dataStr,
                                    productionNumber: prodNum,
                                    version: { increment: 1 }
                                }
                            });
                        }
                        saved.push(docId);
                    }
                },
                { timeout: 30000 }
            );

            searchCache.invalidateNamespace('production');
            res.json({ ok: true, saved });
        } catch (e: unknown) {
            // P0-C: guard w tx rzuca 403 — cały batch cofnięty, saved puste.
            if ((e as { status?: number }).status === 403) {
                return res.status(403).json({
                    error: (e as { message?: string }).message || 'Brak uprawnień',
                    saved: []
                });
            }
            // P0-D: predykat wersji nie trafił — cały batch cofnięty.
            if ((e as { status?: number }).status === 409) {
                return res.status(409).json({
                    error: (e as { message?: string }).message || 'Konflikt wersji',
                    code: (e as { code?: string }).code || 'VERSION_CONFLICT',
                    serverVersion: (e as { serverVersion?: number }).serverVersion,
                    saved: []
                });
            }
            // P0-A: P2002 = dubel finalnego numeru (UNIQUE) — safety net, nie sterowanie.
            if ((e as { code?: string }).code === 'P2002') {
                return res.status(409).json({
                    error: 'Numer produkcyjny już zajęty — pobierz nowy numer',
                    code: 'PRODUCTION_NUMBER_CONFLICT',
                    saved: []
                });
            }
            const message = e instanceof Error ? e.message : 'Unknown error';
            logger.error('Production', 'Błąd serwera', message);
            res.status(500).json({ error: 'Wewnętrzny błąd serwera', saved: [] });
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
                // P0-D: baza optimistic lockingu — nie trafia do bloba JSON.
                version: clientVersionRaw,
                ...rest
            } = o;
            const clientVersion = typeof clientVersionRaw === 'number' ? clientVersionRaw : null;
            const dataStr = JSON.stringify(rest);
            // P0-A: finalny numer produkcyjny do kolumny pod UNIQUE.
            const prodNum =
                typeof (rest as Record<string, unknown>).productionOrderNumber === 'string'
                    ? ((rest as Record<string, unknown>).productionOrderNumber as string)
                    : undefined;

            const createdAt = normalizeDate(createdAtRaw);
            const updatedAt = normalizeDate(updatedAtRaw);

            const old = await prisma.production_orders_rel.findUnique({
                where: { id: docId },
                select: { data: true, userId: true, version: true }
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

            if (!old) {
                await prisma.production_orders_rel.create({
                    data: {
                        id: docId,
                        userId: targetUserId,
                        creatorId: authReq.user?.id || '',
                        orderId: orderId || '',
                        wellId: wellId || '',
                        elementIndex: elementIndex || 0,
                        elementKey: elementKey || '',
                        createdAt: createdAt,
                        updatedAt: updatedAt,
                        data: dataStr,
                        productionNumber: prodNum ?? null,
                        version: 1
                    }
                });
            } else if (clientVersion != null) {
                // P0-D: predykat w JEDNYM SQL (SET version+1 WHERE id+version).
                const upd = await prisma.production_orders_rel.updateMany({
                    where: { id: docId, version: clientVersion },
                    data: {
                        userId: targetUserId,
                        creatorId: authReq.user?.id || '',
                        orderId: orderId || '',
                        wellId: wellId || '',
                        elementIndex: elementIndex || 0,
                        elementKey: elementKey || '',
                        updatedAt: updatedAt,
                        data: dataStr,
                        productionNumber: prodNum,
                        version: { increment: 1 }
                    }
                });
                if (upd.count === 0) {
                    return res.status(409).json({
                        error: 'Zlecenie zmienione przez innego użytkownika — odśwież i spróbuj ponownie',
                        code: 'VERSION_CONFLICT',
                        serverVersion: old.version ?? 1
                    });
                }
            } else {
                await prisma.production_orders_rel.update({
                    where: { id: docId },
                    data: {
                        userId: targetUserId,
                        creatorId: authReq.user?.id || '',
                        orderId: orderId || '',
                        wellId: wellId || '',
                        elementIndex: elementIndex || 0,
                        elementKey: elementKey || '',
                        updatedAt: updatedAt,
                        data: dataStr,
                        productionNumber: prodNum,
                        version: { increment: 1 }
                    }
                });
            }

            searchCache.invalidateNamespace('production');
            res.json({ ok: true, id: docId });
        } catch (e: unknown) {
            // P0-A: P2002 = dubel finalnego numeru (UNIQUE) — safety net, nie sterowanie.
            if ((e as { code?: string }).code === 'P2002') {
                return res.status(409).json({
                    error: 'Numer produkcyjny już zajęty — pobierz nowy numer',
                    code: 'PRODUCTION_NUMBER_CONFLICT'
                });
            }
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
                ...parsedData,
                // P0-D: kolumna wygrywa z blobem — baza optimistic lockingu.
                version: order.version ?? 1
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
