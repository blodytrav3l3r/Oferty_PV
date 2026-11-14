import express from 'express';
import prisma, { Prisma } from '../../prismaClient';
import { logAudit } from '../../db';
import { requireAuth, AuthenticatedRequest } from '../../middleware/auth';
import { parseJsonField, normalizeDate } from '../../helpers';
import { logger } from '../../utils/logger';
import {
    canReadDoc,
    canClaimNumber,
    canDeleteDoc,
    resolveWriteUserId,
    resolveAssignUserId
} from '../../utils/ownership';
import { buildRoleWhereCondition } from '../../utils/roleFilter';
import crypto from 'crypto';
import { z } from 'zod';
import { validateData } from '../../validators/authSchema';
import { WRITE_LIMITER } from '../../middleware/rateLimiters';
import { searchCache } from '../../utils/searchCache';
import { searchAccessScope } from '../../utils/searchAccessScope';
import {
    jsonTextSql,
    mapProductionOrderRow,
    normalizedDateTimeSql
} from '../../utils/productionSearchUtils';
import { mapPrismaError } from '../../utils/prismaErrors';
import { assertDocLockForWrite } from '../../utils/docLocks';
import { HOT_TX_OPTS } from '../../utils/hotTx';
import { isCurrentProductionNumber, parseProductionNumber } from '../../utils/productionNumber';
import {
    incrementPrintCount,
    preservePrintCounts,
    type PrintCounts
} from '../../services/orders/productionPrintCounts';
import {
    claimIdempotencyKey,
    completeIdempotencyKey,
    idempotencyKeyFrom
} from '../../utils/idempotency';
import {
    productionOrdersBatchSchema,
    productionOrderCreateSchema
} from '../../validators/offerSchemas';
import type {
    ProductionOrderItemInput,
    ProductionOrdersBatchInput
} from '../../validators/offerSchemas';

const router = express.Router();

type RawDb = Pick<typeof prisma, '$executeRaw' | '$queryRaw' | 'production_global_number_claims'>;

type SequenceEntry = { userId: string; year: number; seq: number };
type RecycleEntry = SequenceEntry & { hasGlobalClaim: boolean };

type ClaimDb = Pick<typeof prisma, '$queryRaw' | 'production_global_number_claims'>;

type ExistingProductionNumber = { ownerId: string | null; value: string | null };

function getProductionNumber(data: string | null, columnValue?: string | null): string | null {
    if (typeof columnValue === 'string' && columnValue.length > 0) return columnValue;
    const parsed = parseJsonField<Record<string, unknown>>(data, {});
    return typeof parsed.productionOrderNumber === 'string' &&
        parsed.productionOrderNumber.length > 0
        ? parsed.productionOrderNumber
        : null;
}

async function assertProductionNumberClaim(
    userId: string,
    value: string,
    db: ClaimDb,
    existing?: ExistingProductionNumber
): Promise<void> {
    if (!value) return;
    const unchanged = existing?.value === value;
    if (!isCurrentProductionNumber(value)) {
        if (unchanged) return;
        throw {
            status: 409,
            code: 'INVALID_PRODUCTION_NUMBER_FORMAT',
            message: 'Nowy numer zlecenia ma nieprawidłowy format'
        };
    }
    const parsed = parseProductionNumber(value);
    if (!parsed) throw new Error('CURRENT_PRODUCTION_NUMBER_PARSE_FAILED');
    const [claim] = await db.$queryRaw<Array<{ userId: string }>>`
        SELECT "userId" FROM "production_global_number_claims"
        WHERE "year" = ${parsed.year} AND "seqNumber" = ${parsed.seqNumber}
        FOR UPDATE
    `;
    if (!claim && unchanged) return;
    if (!claim || (claim.userId !== userId && (!unchanged || claim.userId !== existing?.ownerId))) {
        throw {
            status: 409,
            code: 'PRODUCTION_NUMBER_NOT_CLAIMED',
            message: 'Numer nie jest zarezerwowany dla tego użytkownika'
        };
    }
    if (claim.userId !== userId) {
        await db.production_global_number_claims.update({
            where: { year_seqNumber: { year: parsed.year, seqNumber: parsed.seqNumber } },
            data: { userId }
        });
    }
}

async function findActiveProductionSequences(
    entries: SequenceEntry[],
    db: RawDb
): Promise<Set<string>> {
    if (entries.length === 0) return new Set();
    const candidates = entries.map(
        (entry) =>
            Prisma.sql`(${entry.userId}::text, ${entry.year}::integer, ${entry.seq}::integer)`
    );
    const active = await db.$queryRaw<Array<{ year: number; seqNumber: number }>>`
        WITH candidate("userId", "year", "seqNumber") AS (VALUES ${Prisma.join(candidates)}),
        number_values AS (
            SELECT "productionNumber" AS number
            FROM "production_orders_rel"
            WHERE "productionNumber" IS NOT NULL
            UNION ALL
            SELECT substring("data" from '"productionOrderNumber"\s*:\s*"([^"]+)"') AS number
            FROM "production_orders_rel"
            WHERE "data" IS NOT NULL
        ), parsed AS (
            SELECT
                CASE WHEN number ~ '^[^/]+/[^/]+/[0-9]+/[0-9]{2}$'
                    THEN 2000 + split_part(number, '/', 4)::INTEGER
                    ELSE 2000 + split_part(number, '/', 3)::INTEGER END AS year,
                CASE WHEN number ~ '^[^/]+/[^/]+/[0-9]+/[0-9]{2}$'
                    THEN CASE WHEN length(ltrim(split_part(number, '/', 3), '0')) > 10
                        THEN 2147483648::NUMERIC
                        ELSE COALESCE(NULLIF(ltrim(split_part(number, '/', 3), '0'), ''), '0')::NUMERIC END
                    ELSE CASE WHEN length(ltrim(split_part(number, '/', 2), '0')) > 10
                        THEN 2147483648::NUMERIC
                        ELSE COALESCE(NULLIF(ltrim(split_part(number, '/', 2), '0'), ''), '0')::NUMERIC END
                END AS seq
            FROM number_values
            WHERE number ~ '^[^/]+/[^/]+/[0-9]+/[0-9]{2}$'
               OR number ~ '^[^/]+/[0-9]+/[0-9]{2}$'
        )
        SELECT DISTINCT candidate."year", candidate."seqNumber"
        FROM candidate
        WHERE EXISTS (
            SELECT 1 FROM parsed
            WHERE parsed.year = candidate."year" AND parsed.seq = candidate."seqNumber"
        ) OR EXISTS (
            SELECT 1 FROM "production_global_number_claims" AS claim
            WHERE claim."year" = candidate."year"
              AND claim."seqNumber" = candidate."seqNumber"
        )
    `;
    return new Set(active.map((row) => `${row.year}:${row.seqNumber}`));
}

async function recycleProductionNumber(
    userId: string,
    oldData: Record<string, unknown>,
    db: RawDb = prisma
) {
    const prodNum =
        typeof oldData.productionOrderNumber === 'string' ? oldData.productionOrderNumber : '';
    if (!prodNum) return;
    const parsed = parseProductionNumber(prodNum);
    if (!parsed) return;
    const entry = { userId, year: parsed.year, seq: parsed.seqNumber };
    if (isCurrentProductionNumber(prodNum)) {
        await db.production_global_number_claims.deleteMany({
            where: { userId, year: parsed.year, seqNumber: parsed.seqNumber }
        });
    }
    const active = await findActiveProductionSequences([entry], db);
    if (active.has(`${entry.year}:${entry.seq}`)) return;
    await db.$executeRaw`
        INSERT INTO "recycled_production_numbers_global" ("userId", "year", "seqNumber")
        VALUES (${userId}, ${parsed.year}, ${parsed.seqNumber})
        ON CONFLICT ("year", "seqNumber") DO NOTHING
    `;
}

function parseRecycleEntry(userId: string, oldData: Record<string, unknown>): RecycleEntry | null {
    const prodNum =
        typeof oldData.productionOrderNumber === 'string' ? oldData.productionOrderNumber : '';
    if (!prodNum) return null;
    const parsed = parseProductionNumber(prodNum);
    if (!parsed) return null;
    return {
        userId,
        year: parsed.year,
        seq: parsed.seqNumber,
        hasGlobalClaim: isCurrentProductionNumber(prodNum)
    };
}

/**
 * P0.3: hurtowy zwrot numerów — JEDEN INSERT zamiast N w pętli.
 * Semantyka 1:1 z recycleProductionNumber (ON CONFLICT DO NOTHING).
 */
async function recycleProductionNumbersBulk(entries: RecycleEntry[], db: RawDb = prisma) {
    if (entries.length === 0) return;
    const claimedEntries = entries.filter(({ hasGlobalClaim }) => hasGlobalClaim);
    if (claimedEntries.length > 0) {
        await db.production_global_number_claims.deleteMany({
            where: {
                OR: claimedEntries.map(({ userId, year, seq }) => ({
                    userId,
                    year,
                    seqNumber: seq
                }))
            }
        });
    }
    const active = await findActiveProductionSequences(entries, db);
    const recyclable = entries.filter((entry) => !active.has(`${entry.year}:${entry.seq}`));
    if (recyclable.length === 0) return;
    const rows = recyclable.map((e) => Prisma.sql`(${e.userId}, ${e.year}, ${e.seq})`);
    await db.$executeRaw`
        INSERT INTO "recycled_production_numbers_global" ("userId", "year", "seqNumber")
        VALUES ${Prisma.join(rows)}
        ON CONFLICT ("year", "seqNumber") DO NOTHING
    `;
}

const writeProductionLimiter = WRITE_LIMITER;

/* ===== E3a: lokalne schematy zod (luźne kontrakty — NIE validateData) =====
 * Identyfikatory PZ to opaque stringi ('pz-1', 'prodorder_...'), NIE UUID —
 * z.string().uuid() odrzucałoby legalne payloady z frontendu (orderBulk.js,
 * zlecenia.js chunk 200). Dlatego min(1)/max(256) zamiast uuid().
 */
const productionIdListSchema = z.array(z.string().min(1).max(256)).min(1).max(200);

const batchDeleteSchema = z.object({
    ids: productionIdListSchema
});

const recycleNumbersSchema = z.object({
    userId: z.string().min(1).max(256),
    seqNumbers: z.array(z.number().int().positive()).min(1).max(200),
    year: z.number().int().min(2001).max(2099).optional()
});

const printCountKindSchema = z.enum(['zlecenie', 'etykieta']);

const printCountBatchSchema = z.object({
    ids: productionIdListSchema,
    kind: printCountKindSchema
});

const printCountSingleSchema = z.object({
    kind: printCountKindSchema
});

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
            ${normalizedDateTimeSql(Prisma.sql`production_orders_rel."createdAt"`)} as "createdAt",
            ${normalizedDateTimeSql(Prisma.sql`production_orders_rel."updatedAt"`)} as "updatedAt",
            u1."firstName" as handlerFirstName, u1."lastName" as handlerLastName, u1.username as handlerUsername,
            u2."firstName" as creatorFirstName, u2."lastName" as creatorLastName, u2.username as creatorUsername,
            ${jsonTextSql(Prisma.sql`o.data`, 'orderNumber')} as "dbSalesOrderNumber",
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
 * PostgreSQL JSON operators read only selected columns, without returning full `data`.
 * MUSI być przed `/:id` (inaczej "index" wpadnie w param).
 */
router.get('/index', requireAuth, async (req, res) => {
    const authReq = req as AuthenticatedRequest;
    try {
        if (!authReq.user) return res.status(401).json({ error: 'Unauthorized' });
        const cacheKey = { scope: 'pz-index', access: searchAccessScope(authReq.user) };
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
            ${jsonTextSql(Prisma.sql`production_orders_rel.data`, 'status')} as "status",
            ${jsonTextSql(Prisma.sql`production_orders_rel.data`, 'productionOrderNumber')} as "productionOrderNumber",
            ${jsonTextSql(Prisma.sql`production_orders_rel.data`, 'offerId')} as "offerId"
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
        // P0-V: saved niesie wersje faktycznie zapisane (po inkrementacji) —
        // API jest źródłem prawdy dla version, frontend merguje do RAM.
        const saved: Array<{ id: string; version: number }> = [];
        try {
            const incoming: ProductionOrdersBatchInput['data'] = req.body.data || [];
            // P0.3: docId przypisane Z GÓRY (1:1 z dotychczasową semantyką —
            // brak id = crypto.randomUUID), żeby pre-fetch findMany objął cały batch.
            const withIds: Array<{ o: ProductionOrderItemInput; docId: string }> = incoming.map(
                (o) => ({
                    o,
                    docId: o.id || crypto.randomUUID()
                })
            );
            const batchIds: string[] = [...new Set(withIds.map((x) => x.docId))];

            await prisma.$transaction(async (tx) => {
                // P0.3: JEDEN batch-read zamiast findUnique-per-element (N+1).
                // Zapis pozostaje sekwencyjny w kolejności wejścia (efekty uboczne
                // logAudit + kolejność saved bez zmian); mapa odświeżana po
                // każdym zapisie, więc duplikat id w batchu widzi własny zapis
                // (jak read-your-own-write w starej pętli).
                const oldById = new Map<
                    string,
                    {
                        id: string;
                        data: string | null;
                        productionNumber: string | null;
                        userId: string | null;
                        version: number | null;
                    }
                >();
                if (batchIds.length > 0) {
                    const rows = await tx.production_orders_rel.findMany({
                        where: { id: { in: batchIds } },
                        select: {
                            id: true,
                            data: true,
                            productionNumber: true,
                            userId: true,
                            version: true
                        }
                    });
                    for (const r of rows) oldById.set(r.id, r);
                }
                for (const { o, docId } of withIds) {
                    const old = oldById.get(docId) ?? null;

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
                    // Passthrough Zod = pola spoza schematu są unknown; zawężenie
                    // typem (erased, bez zmiany runtime) pod kolumny string.
                    const createdAtStr = createdAt as string | undefined;
                    const updatedAtStr = updatedAt as string | undefined;
                    // P0-A: finalny numer produkcyjny do kolumny pod UNIQUE.
                    // Update z undefined nie nadpisuje (Prisma pomija undefined).
                    const prodNum =
                        typeof (rest as Record<string, unknown>).productionOrderNumber === 'string'
                            ? ((rest as Record<string, unknown>).productionOrderNumber as string)
                            : undefined;

                    // P0-C: guard W transakcji — return zamieniony na throw, żeby
                    // cofnąć cały batch (wcześniej: 403 w połowie = partial write).
                    // P0.1: zapis wymaga prawa względem właściciela (create: self/sub/admin).
                    const reqUser = typeof incomingUserId === 'string' ? incomingUserId : undefined;
                    let targetUserId: string;
                    if (old) {
                        const assigned = resolveAssignUserId(authReq.user, old.userId, reqUser);
                        if (!assigned.allowed) {
                            throw {
                                status: 403,
                                message: 'Brak uprawnień do zapisu dla tego użytkownika'
                            };
                        }
                        targetUserId = assigned.effectiveUserId;
                    } else {
                        const created = resolveWriteUserId(authReq.user, reqUser);
                        if (!created.allowed) {
                            throw {
                                status: 403,
                                message: 'Brak uprawnień do zapisu dla tego użytkownika'
                            };
                        }
                        targetUserId = created.effectiveUserId;
                    }

                    const oldNumber = old
                        ? getProductionNumber(old.data, old.productionNumber)
                        : null;
                    const numberToValidate = prodNum ?? oldNumber;
                    if (numberToValidate) {
                        await assertProductionNumberClaim(targetUserId, numberToValidate, tx, {
                            ownerId: old?.userId ?? null,
                            value: oldNumber
                        });
                    }

                    // Twarda blokada edycji PZ: cudzy świeży lock = 423, cały batch cofnięty.
                    if (old) {
                        await assertDocLockForWrite(tx, {
                            docType: 'production',
                            docId,
                            user: { id: authReq.user?.id || '' }
                        });
                    }

                    if (old) {
                        await logAudit(
                            'production_order',
                            docId,
                            authReq.user?.id || '',
                            'update',
                            rest,
                            parseJsonField<Record<string, unknown>>(old.data, {}),
                            tx
                        );
                    } else {
                        await logAudit(
                            'production_order',
                            docId,
                            authReq.user?.id || '',
                            'create',
                            rest,
                            null,
                            tx
                        );
                    }

                    // Liczniki wydruków: chude obiekty (modal, accept-flow) nie
                    // mają pól print* — donieś ze starego bloba, żeby PUT ich
                    // nie zerował. Wynik helpera jest finalny (bez spreadu za nim).
                    // Błąd #48: PUT whole-array z lekkimi obiektami z `/index`
                    // (accept/revoke/modal-save) NADPISYWAŁ pełny blob szkieletem
                    // (tabela Zlecenia: "—" + "Element #N"). Dlatego merge:
                    // jawne pola z requestu wygrywają, reszta zostaje ze starego.
                    const oldData = old
                        ? parseJsonField<Record<string, unknown>>(old.data, {})
                        : null;
                    const mergedRest = oldData
                        ? preservePrintCounts({ ...oldData, ...rest }, oldData)
                        : rest;
                    const dataStr = JSON.stringify(mergedRest);

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
                                createdAt: createdAtStr || new Date().toISOString(),
                                updatedAt: updatedAtStr || new Date().toISOString(),
                                data: dataStr,
                                productionNumber: prodNum ?? null,
                                version: 1
                            }
                        });
                        saved.push({ id: docId, version: 1 });
                        oldById.set(docId, {
                            id: docId,
                            data: dataStr,
                            productionNumber: prodNum ?? null,
                            userId: targetUserId,
                            version: 1
                        });
                    } else {
                        if (clientVersion == null) {
                            throw {
                                status: 409,
                                code: 'VERSION_CONFLICT',
                                message: 'Brak wersji zlecenia — odśwież dane i spróbuj ponownie',
                                serverVersion: old.version ?? 1
                            };
                        }
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
                                createdAt: createdAtStr || new Date().toISOString(),
                                updatedAt: updatedAtStr || new Date().toISOString(),
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
                        saved.push({ id: docId, version: clientVersion + 1 });
                        oldById.set(docId, {
                            id: docId,
                            data: dataStr,
                            productionNumber: prodNum ?? old.productionNumber,
                            userId: targetUserId,
                            version: clientVersion + 1
                        });
                    }
                    if (old && oldNumber && prodNum !== undefined && prodNum !== oldNumber) {
                        await recycleProductionNumber(
                            old.userId || '',
                            {
                                ...parseJsonField<Record<string, unknown>>(old.data, {}),
                                productionOrderNumber: oldNumber
                            },
                            tx
                        );
                    }
                }
            }, HOT_TX_OPTS);

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
            // Twarda blokada: cudzy lock na zleceniu — cały batch cofnięty.
            if ((e as { status?: number }).status === 423) {
                return res.status(423).json({
                    error:
                        (e as { message?: string }).message ||
                        'Zlecenie jest edytowane przez innego użytkownika',
                    code: (e as { code?: string }).code || 'DOC_LOCKED',
                    holder: (e as { holder?: unknown }).holder,
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
            if (mapPrismaError(res, e, { saved: [] })) return;
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
        // P1-A: Idempotency-Key (opcjonalny) — retry nie tworzy duplikatu.
        const idemEndpoint = 'POST /api/orders-studnie/production';
        const idemKey = idempotencyKeyFrom(req);
        const idemUser = authReq.user?.id || '';
        try {
            if (idemKey) {
                const claim = await claimIdempotencyKey(idemUser, idemEndpoint, idemKey, req.body);
                if (claim.action === 'replay') return res.status(claim.status).json(claim.body);
                if (claim.action === 'reuse')
                    return res.status(409).json({
                        error: 'Klucz idempotencji użyty z innym payloadem',
                        code: 'IDEMPOTENCY_KEY_REUSE'
                    });
                if (claim.action === 'in-progress')
                    return res.status(409).json({
                        error: 'Żądanie w trakcie przetwarzania — spróbuj ponownie',
                        code: 'IDEMPOTENCY_IN_PROGRESS'
                    });
            }
            const o = req.body;

            let docId = o.id;
            if (!docId) {
                // P1-A: deterministyczne id przy kluczu — retry trafia w ten sam rekord.
                docId = idemKey
                    ? 'idem-' +
                      crypto
                          .createHash('sha256')
                          .update(`${idemUser}|${idemEndpoint}|${idemKey}`)
                          .digest('hex')
                          .slice(0, 16)
                    : crypto.randomUUID();
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
            // Błąd #48: update chudym obiektem nadpisywał pełny blob (jak w PUT
            // wyżej) — dataStr dopiero po odczycie starego, z merge.
            // P0-A: finalny numer produkcyjny do kolumny pod UNIQUE.
            const prodNum =
                typeof (rest as Record<string, unknown>).productionOrderNumber === 'string'
                    ? ((rest as Record<string, unknown>).productionOrderNumber as string)
                    : undefined;

            const createdAt = normalizeDate(createdAtRaw);
            const updatedAt = normalizeDate(updatedAtRaw);

            await prisma.$transaction(async (tx) => {
                const old = await tx.production_orders_rel.findUnique({
                    where: { id: docId },
                    select: { data: true, productionNumber: true, userId: true, version: true }
                });

                const reqUser = typeof incomingUserId === 'string' ? incomingUserId : undefined;
                let targetUserId: string;
                if (old) {
                    const assigned = resolveAssignUserId(authReq.user, old.userId, reqUser);
                    if (!assigned.allowed) {
                        throw {
                            status: 403,
                            message: 'Brak uprawnień do zapisu dla tego użytkownika'
                        };
                    }
                    targetUserId = assigned.effectiveUserId;
                } else {
                    const created = resolveWriteUserId(authReq.user, reqUser);
                    if (!created.allowed) {
                        throw {
                            status: 403,
                            message: 'Brak uprawnień do zapisu dla tego użytkownika'
                        };
                    }
                    targetUserId = created.effectiveUserId;
                }

                const oldNumber = old ? getProductionNumber(old.data, old.productionNumber) : null;
                const numberToValidate = prodNum ?? oldNumber;
                if (numberToValidate) {
                    await assertProductionNumberClaim(targetUserId, numberToValidate, tx, {
                        ownerId: old?.userId ?? null,
                        value: oldNumber
                    });
                }

                if (old) {
                    await assertDocLockForWrite(tx, {
                        docType: 'production',
                        docId,
                        user: { id: authReq.user?.id || '' }
                    });
                }

                if (old) {
                    await logAudit(
                        'production_order',
                        docId,
                        authReq.user?.id || '',
                        'update',
                        rest,
                        parseJsonField<Record<string, unknown>>(old.data, {}),
                        tx
                    );
                } else {
                    await logAudit(
                        'production_order',
                        docId,
                        authReq.user?.id || '',
                        'create',
                        rest,
                        null,
                        tx
                    );
                }

                const oldPostData = old
                    ? parseJsonField<Record<string, unknown>>(old.data, {})
                    : null;
                const dataStr = JSON.stringify(
                    oldPostData
                        ? preservePrintCounts({ ...oldPostData, ...rest }, oldPostData)
                        : rest
                );

                if (!old) {
                    await tx.production_orders_rel.create({
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
                } else {
                    const expectedVersion = clientVersion;
                    if (expectedVersion == null) {
                        throw {
                            status: 409,
                            code: 'VERSION_CONFLICT',
                            message: 'Brak wersji zlecenia — odśwież dane i spróbuj ponownie',
                            serverVersion: old.version ?? 1
                        };
                    }
                    const upd = await tx.production_orders_rel.updateMany({
                        where: { id: docId, version: expectedVersion },
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
                        throw {
                            status: 409,
                            code: 'VERSION_CONFLICT',
                            message:
                                'Zlecenie zmienione przez innego użytkownika — odśwież i spróbuj ponownie',
                            serverVersion: old.version ?? 1
                        };
                    }
                }

                if (old && oldNumber && prodNum !== undefined && prodNum !== oldNumber) {
                    await recycleProductionNumber(
                        old.userId || '',
                        {
                            ...oldPostData,
                            productionOrderNumber: oldNumber
                        },
                        tx
                    );
                }
            }, HOT_TX_OPTS);

            searchCache.invalidateNamespace('production');
            // P1-A: odpowiedź finałowa (< 500) ląduje pod kluczem do replay.
            if (idemKey)
                await completeIdempotencyKey(idemUser, idemEndpoint, idemKey, 200, {
                    ok: true,
                    id: docId
                });
            res.json({ ok: true, id: docId });
        } catch (e: unknown) {
            if ((e as { status?: number }).status === 409) {
                const conflict = e as { message?: string; code?: string; serverVersion?: number };
                if (idemKey)
                    await completeIdempotencyKey(idemUser, idemEndpoint, idemKey, 409, {
                        error: conflict.message || 'Konflikt numeru produkcyjnego',
                        code: conflict.code || 'PRODUCTION_NUMBER_CONFLICT',
                        serverVersion: conflict.serverVersion
                    });
                return res.status(409).json({
                    error: conflict.message || 'Konflikt numeru produkcyjnego',
                    code: conflict.code || 'PRODUCTION_NUMBER_CONFLICT',
                    ...(conflict.serverVersion ? { serverVersion: conflict.serverVersion } : {})
                });
            }
            if ((e as { status?: number }).status === 403) {
                return res.status(403).json({
                    error: (e as { message?: string }).message || 'Brak uprawnień'
                });
            }
            // Twarda blokada: cudzy lock na zleceniu.
            if ((e as { status?: number }).status === 423) {
                return res.status(423).json({
                    error:
                        (e as { message?: string }).message ||
                        'Zlecenie jest edytowane przez innego użytkownika',
                    code: (e as { code?: string }).code || 'DOC_LOCKED',
                    holder: (e as { holder?: unknown }).holder
                });
            }
            // P0-A: P2002 = dubel finalnego numeru (UNIQUE) — safety net, nie sterowanie.
            if ((e as { code?: string }).code === 'P2002') {
                if (idemKey)
                    await completeIdempotencyKey(idemUser, idemEndpoint, idemKey, 409, {
                        error: 'Numer produkcyjny już zajęty — pobierz nowy numer',
                        code: 'PRODUCTION_NUMBER_CONFLICT'
                    });
                return res.status(409).json({
                    error: 'Numer produkcyjny już zajęty — pobierz nowy numer',
                    code: 'PRODUCTION_NUMBER_CONFLICT'
                });
            }
            if (mapPrismaError(res, e)) return;
            const message = e instanceof Error ? e.message : 'Unknown error';
            logger.error('Production', 'Błąd POST', message);
            res.status(500).json({ error: 'Wewnętrzny błąd serwera' });
        }
    }
);

router.post('/batch-delete', requireAuth, writeProductionLimiter, async (req, res) => {
    const authReq = req as AuthenticatedRequest;
    try {
        const parsed = batchDeleteSchema.safeParse(req.body || {});
        if (!parsed.success) {
            return res.status(400).json({
                error: 'Brak identyfikatorów zleceń do usunięcia',
                details: parsed.error.issues
            });
        }
        const uniqueIds = [...new Set(parsed.data.ids)];

        const existing = await prisma.production_orders_rel.findMany({
            where: { id: { in: uniqueIds } },
            select: { id: true, userId: true, data: true }
        });

        // Rozdzielenie: brak uprawnień -> 403, zatwierdzone (accepted) -> pominięcie w odpowiedzi
        const deletable: typeof existing = [];
        let skipped = 0;
        for (const order of existing) {
            if (!canDeleteDoc(authReq.user, order.userId)) {
                return res.status(403).json({ error: 'Brak uprawnień do usunięcia tego zlecenia' });
            }
            const oldData = parseJsonField<Record<string, unknown>>(order.data, {});
            if (oldData.status === 'accepted') {
                skipped++;
            } else {
                deletable.push(order);
            }
        }

        // P0-E: kasowanie + recycle w JEDNEJ transakcji (koniec partial delete).
        // accepted pomijane jak wcześniej (skipped), reszta all-or-nothing.
        let deletedCount = 0;
        await prisma.$transaction(async (tx) => {
            // Re-check statusów w tx (koniec TOCTOU accepted-między-check-a-delete).
            const fresh = await tx.production_orders_rel.findMany({
                where: { id: { in: deletable.map((o) => o.id) } },
                select: { id: true, userId: true, data: true }
            });
            const freshById = new Map(fresh.map((o) => [o.id, o]));
            let skippedTx = 0;
            const finalIds: string[] = [];
            for (const order of deletable) {
                const row = freshById.get(order.id);
                if (!row) continue;
                if (!canDeleteDoc(authReq.user, row.userId)) {
                    throw { status: 403, message: 'Brak uprawnień do usunięcia tego zlecenia' };
                }
                // Twarda blokada: cudzy lock na zleceniu = 423, cały batch cofnięty.
                await assertDocLockForWrite(tx, {
                    docType: 'production',
                    docId: order.id,
                    user: { id: authReq.user?.id || '' }
                });
                const rowData = parseJsonField<Record<string, unknown>>(row.data, {});
                if (rowData.status === 'accepted') {
                    skippedTx++;
                    continue;
                }
                finalIds.push(order.id);
            }
            skipped += skippedTx;
            if (finalIds.length > 0) {
                const del = await tx.production_orders_rel.deleteMany({
                    where: { id: { in: finalIds } }
                });
                deletedCount = del.count;
            }
            const finalIdSet = new Set(finalIds);
            // P0.3: audyt sekwencyjnie w kolejności wejścia (efekt uboczny bez
            // zmian), recycle jednym INSERT-em zamiast N w pętli — ta sama tx.
            const recycleEntries: RecycleEntry[] = [];
            for (const order of deletable) {
                if (!finalIdSet.has(order.id)) continue;
                const oldData = parseJsonField<Record<string, unknown>>(order.data, {});
                await logAudit(
                    'production_order',
                    order.id,
                    order.userId || '',
                    'delete',
                    null,
                    oldData,
                    tx
                );
                const entry = parseRecycleEntry(order.userId || '', oldData);
                if (entry) recycleEntries.push(entry);
            }
            await recycleProductionNumbersBulk(recycleEntries, tx);
        }, HOT_TX_OPTS);
        searchCache.invalidateNamespace('production');
        res.json({ deleted: deletedCount, skipped });
    } catch (e: unknown) {
        if ((e as { status?: number }).status === 403) {
            return res
                .status(403)
                .json({ error: (e as { message?: string }).message || 'Brak uprawnień' });
        }
        // Twarda blokada: cudzy lock na zleceniu.
        if ((e as { status?: number }).status === 423) {
            return res.status(423).json({
                error:
                    (e as { message?: string }).message ||
                    'Zlecenie jest edytowane przez innego użytkownika',
                code: (e as { code?: string }).code || 'DOC_LOCKED',
                holder: (e as { holder?: unknown }).holder
            });
        }
        if (mapPrismaError(res, e)) return;
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
        const parsed = recycleNumbersSchema.safeParse(req.body || {});
        if (!parsed.success) {
            return res
                .status(400)
                .json({ error: 'Nieprawidłowe dane zwrotu numerów', details: parsed.error.issues });
        }
        const { userId } = parsed.data;
        if (!canClaimNumber(authReq.user, userId)) {
            return res.status(403).json({ error: 'Brak uprawnień do numerów tego użytkownika' });
        }
        const seqs = [...new Set(parsed.data.seqNumbers)];
        const targetYear = parsed.data.year ?? new Date().getFullYear();
        const returned = await prisma.$transaction(async (tx) => {
            const counter = await tx.production_global_order_counters.findUnique({
                where: { year: targetYear }
            });
            if (!counter) return null;
            if (seqs.some((seq) => seq > counter.lastNumber)) return null;

            const params = Prisma.join(seqs);
            const claimed = await tx.$queryRaw<Array<{ seqNumber: number }>>`
                SELECT "seqNumber"
                FROM "production_global_number_claims"
                WHERE "userId" = ${userId} AND "year" = ${targetYear}
                  AND "seqNumber" IN (${params})
                FOR UPDATE
            `;
            const recycled = await tx.recycled_production_numbers_global.findMany({
                where: { userId, year: targetYear, seqNumber: { in: seqs } },
                select: { seqNumber: true }
            });
            const accepted = new Set([
                ...claimed.map((row) => row.seqNumber),
                ...recycled.map((row) => row.seqNumber)
            ]);
            if (seqs.some((seq) => !accepted.has(seq))) return null;

            const candidates = claimed.map(({ seqNumber }) => ({
                userId,
                year: targetYear,
                seq: seqNumber,
                hasGlobalClaim: true
            }));
            if (candidates.length > 0) {
                const deleted = await tx.production_global_number_claims.deleteMany({
                    where: {
                        userId,
                        year: targetYear,
                        seqNumber: { in: candidates.map(({ seq }) => seq) }
                    }
                });
                if (deleted.count !== candidates.length) {
                    throw {
                        status: 409,
                        code: 'RECYCLE_NUMBER_CONFLICT',
                        message: 'Numer nie należy już do aktywnego przydziału'
                    };
                }
            }
            const active = await findActiveProductionSequences(candidates, tx);
            if (active.size > 0) {
                throw {
                    status: 409,
                    code: 'RECYCLE_NUMBER_CONFLICT',
                    message: 'Numer jest już zapisany w zleceniu produkcyjnym'
                };
            }

            if (candidates.length > 0) {
                const rows = candidates.map(
                    ({ seq }) => Prisma.sql`(${userId}, ${targetYear}, ${seq})`
                );
                await tx.$executeRaw`
                    INSERT INTO "recycled_production_numbers_global" ("userId", "year", "seqNumber")
                    VALUES ${Prisma.join(rows)}
                    ON CONFLICT ("year", "seqNumber") DO NOTHING
                `;
            }
            return seqs.length;
        }, HOT_TX_OPTS);
        if (returned === null) {
            return res.status(409).json({
                error: 'Numery nie należą do aktywnego przydziału albo nie są dostępne',
                code: 'RECYCLE_NUMBER_CONFLICT'
            });
        }
        res.json({ ok: true, returned });
    } catch (e: unknown) {
        if ((e as { status?: number }).status === 409) {
            return res.status(409).json({
                error: (e as { message?: string }).message || 'Konflikt zwrotu numeru',
                code: (e as { code?: string }).code || 'RECYCLE_NUMBER_CONFLICT'
            });
        }
        const message = e instanceof Error ? e.message : 'Unknown error';
        logger.error('Production', 'Błąd serwera', message);
        res.status(500).json({ error: 'Wewnętrzny błąd serwera' });
    }
});

router.post('/print-count-batch', requireAuth, writeProductionLimiter, async (req, res) => {
    const authReq = req as AuthenticatedRequest;
    try {
        const parsed = printCountBatchSchema.safeParse(req.body || {});
        if (!parsed.success) {
            return res.status(400).json({
                error: 'Nieprawidłowe dane licznika wydruków',
                details: parsed.error.issues
            });
        }
        const { ids: batchIds, kind } = parsed.data;
        const uniqueIds = [...new Set(batchIds)];
        const counts: Record<string, PrintCounts> = {};
        const failed: Array<{ id: string; error: string }> = [];
        for (const id of uniqueIds) {
            try {
                counts[id] = await incrementPrintCount(id, kind, authReq.user);
            } catch (e: unknown) {
                failed.push({
                    id,
                    error: (e as { message?: string }).message || 'Błąd zapisu licznika'
                });
            }
        }
        if (Object.keys(counts).length > 0) searchCache.invalidateNamespace('production');
        res.json({ counts, failed });
    } catch (e: unknown) {
        if (mapPrismaError(res, e)) return;
        const message = e instanceof Error ? e.message : 'Unknown error';
        logger.error('Production', 'Błąd serwera', message);
        res.status(500).json({ error: 'Wewnętrzny błąd serwera' });
    }
});

router.post('/:id/print-count', requireAuth, writeProductionLimiter, async (req, res) => {
    const authReq = req as AuthenticatedRequest;
    try {
        const parsed = printCountSingleSchema.safeParse(req.body || {});
        if (!parsed.success) {
            return res.status(400).json({
                error: 'Nieprawidłowy rodzaj wydruku (zlecenie|etykieta)',
                details: parsed.error.issues
            });
        }
        const { kind } = parsed.data;
        const counts = await incrementPrintCount(req.params.id, kind, authReq.user);
        searchCache.invalidateNamespace('production');
        res.json({ ok: true, id: req.params.id, ...counts });
    } catch (e: unknown) {
        if ((e as { status?: number }).status === 404) {
            return res.status(404).json({ error: 'Zlecenie nie znalezione' });
        }
        if ((e as { status?: number }).status === 409) {
            return res.status(409).json({
                error: (e as { message?: string }).message || 'Konflikt wersji',
                code: (e as { code?: string }).code || 'VERSION_CONFLICT'
            });
        }
        if (mapPrismaError(res, e)) return;
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
                version: order.version ?? 1,
                // Liczniki wydruków: jawny kontrakt, brak pola = 0.
                printCountZlecenia:
                    typeof parsedData.printCountZlecenia === 'number' &&
                    (parsedData.printCountZlecenia as number) >= 0
                        ? Math.floor(parsedData.printCountZlecenia as number)
                        : 0,
                printCountEtykieta:
                    typeof parsedData.printCountEtykieta === 'number' &&
                    (parsedData.printCountEtykieta as number) >= 0
                        ? Math.floor(parsedData.printCountEtykieta as number)
                        : 0,
                printLastZleceniaAt:
                    typeof parsedData.printLastZleceniaAt === 'string'
                        ? (parsedData.printLastZleceniaAt as string)
                        : null,
                printLastEtykietaAt:
                    typeof parsedData.printLastEtykietaAt === 'string'
                        ? (parsedData.printLastEtykietaAt as string)
                        : null
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
        if (!canDeleteDoc(authReq.user, existing.userId)) {
            return res.status(403).json({ error: 'Brak uprawnień do usunięcia tego zlecenia' });
        }

        const oldData = parseJsonField<Record<string, unknown>>(existing.data, {});

        if (oldData.status === 'accepted') {
            return res
                .status(403)
                .json({ error: 'Nie można usunąć zatwierdzonego zlecenia. Najpierw je cofnij.' });
        }

        // P0-E: re-check statusu + kasowanie + recycle + audit w JEDNEJ transakcji
        // (audit przed COMMIT = rollback cofa też audit, koniec phantom audit).
        try {
            await prisma.$transaction(async (tx) => {
                const row = await tx.production_orders_rel.findUnique({
                    where: { id: docId },
                    select: { data: true, userId: true }
                });
                const rowData = parseJsonField<Record<string, unknown>>(row?.data, {});
                if (rowData.status === 'accepted') {
                    throw {
                        status: 403,
                        message: 'Nie można usunąć zatwierdzonego zlecenia. Najpierw je cofnij.'
                    };
                }
                if (row && !canDeleteDoc(authReq.user, row.userId)) {
                    throw { status: 403, message: 'Brak uprawnień do usunięcia tego zlecenia' };
                }
                // Twarda blokada: cudzy lock na zleceniu = 423.
                await assertDocLockForWrite(tx, {
                    docType: 'production',
                    docId,
                    user: { id: authReq.user?.id || '' }
                });
                await logAudit(
                    'production_order',
                    docId,
                    existing.userId || '',
                    'delete',
                    null,
                    oldData,
                    tx
                );
                if (authReq.user?.role === 'admin') {
                    await tx.$executeRaw`DELETE FROM production_orders_rel WHERE id = ${docId}`;
                } else {
                    await tx.production_orders_rel.deleteMany({
                        where: { id: docId, userId: authReq.user?.id }
                    });
                }
                await recycleProductionNumber(existing.userId || '', oldData, tx);
            }, HOT_TX_OPTS);
        } catch (e: unknown) {
            if ((e as { status?: number }).status === 403) {
                return res
                    .status(403)
                    .json({ error: (e as { message?: string }).message || 'Brak uprawnień' });
            }
            // Twarda blokada: cudzy lock na zleceniu.
            if ((e as { status?: number }).status === 423) {
                return res.status(423).json({
                    error:
                        (e as { message?: string }).message ||
                        'Zlecenie jest edytowane przez innego użytkownika',
                    code: (e as { code?: string }).code || 'DOC_LOCKED',
                    holder: (e as { holder?: unknown }).holder
                });
            }
            throw e;
        }
        searchCache.invalidateNamespace('production');
        res.json({ ok: true });
    } catch (e: unknown) {
        if (mapPrismaError(res, e)) return;
        const message = e instanceof Error ? e.message : 'Unknown error';
        logger.error('Production', 'Błąd serwera', message);
        res.status(500).json({ error: 'Wewnętrzny błąd serwera' });
    }
});

export default router;
