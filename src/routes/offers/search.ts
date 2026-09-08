import express from 'express';
import prisma, { Prisma } from '../../prismaClient';
import { requireAuth, AuthenticatedRequest } from '../../middleware/auth';
import { buildRoleWhereConditionWithShares } from '../../utils/roleFilter';
import { logger } from '../../utils/logger';
import { searchCache } from '../../utils/searchCache';
import { parseJsonField } from '../../helpers';
import {
    parseSearchParams,
    buildWhereParts,
    buildOrderStatusSql,
    mapOfferRow,
    RawOfferRow
} from '../../utils/searchUtils';

const router = express.Router();

const SEARCH_LIMIT_MAX = 100;

router.get('/', requireAuth, async (req, res) => {
    const authReq = req as AuthenticatedRequest;
    try {
        const params = parseSearchParams(req.query as Record<string, unknown>);
        const user = authReq.user;
        if (!user) {
            return res.status(401).json({ error: 'Nieautoryzowany' });
        }

        // Sprawdź cache
        const cached = searchCache.get(user.id, params as unknown as Record<string, unknown>);
        if (cached) {
            return res.json(cached);
        }

        const whereParts = buildWhereParts({
            q: params.q,
            dateFrom: params.dateFrom,
            dateTo: params.dateTo,
            userId: params.userId,
            cursor: params.cursor,
            cursorId: params.cursorId,
            sort: params.sort,
            order: params.order
        });
        const roleSqlRury = buildRoleWhereConditionWithShares(user, 'offer');
        const roleSqlStudnie = buildRoleWhereConditionWithShares(user, 'offer_studnie');
        const buildWhereSql = (roleSql: Prisma.Sql) =>
            roleSql !== Prisma.empty
                ? Prisma.sql`${roleSql}${
                      whereParts.length > 0
                          ? Prisma.sql` AND ${Prisma.join(whereParts, ' AND ')}`
                          : Prisma.empty
                  }`
                : whereParts.length > 0
                  ? Prisma.sql`WHERE ${Prisma.join(whereParts, ' AND ')}`
                  : Prisma.empty;
        const whereSqlRury = buildWhereSql(roleSqlRury);
        const whereSqlStudnie = buildWhereSql(roleSqlStudnie);

        const { whereSql: orderStatusWhere } = buildOrderStatusSql(params.orderStatus);

        // Filtr typu oferty (rury vs studnie) na zewnętrznym SELECT — UNION ALL
        // zawiera wiersze z obu tabel, więc filtrujemy po aliasie _type.
        const typeWhere =
            params.type === 'offer'
                ? Prisma.sql`combined."_type" = 'rury'`
                : params.type === 'studnia_oferta'
                  ? Prisma.sql`combined."_type" = 'studnie'`
                  : Prisma.empty;
        const combinedWhere =
            orderStatusWhere !== Prisma.empty && typeWhere !== Prisma.empty
                ? Prisma.sql`${orderStatusWhere} AND ${typeWhere}`
                : orderStatusWhere !== Prisma.empty
                  ? orderStatusWhere
                  : typeWhere !== Prisma.empty
                    ? Prisma.sql`WHERE ${typeWhere}`
                    : Prisma.empty;

        const sortDir = params.order === 'asc' ? 'ASC' : 'DESC';
        const allowedSort = ['createdAt', 'offer_number'];
        const sortCol = allowedSort.includes(params.sort) ? params.sort : 'createdAt';
        const limitVal = Math.min(params.limit, SEARCH_LIMIT_MAX);

        const sql = Prisma.sql`
            SELECT * FROM (
                SELECT
                    o.id, "userId", "clientId", state, "createdAt", "updatedAt",
                    "offer_number",
                    -- P1-C: historia na liście w wersji slim (popup: skalary + itemsCount;
                    -- pełna historia tylko w DETAIL). 29 MB history na liście to przeszłość.
                    COALESCE((SELECT json_group_array(json_object(
                        'updatedAt', value->>'updatedAt', 'timestamp', value->>'timestamp',
                        'state', value->>'state', 'totalBrutto', value->>'totalBrutto',
                        'lastEditedBy', value->>'lastEditedBy', 'userName', value->>'userName',
                        'itemsCount', json_array_length(value, '$.items')))
                    FROM json_each(COALESCE(o.history, '[]'))), '[]') AS history,
                    "clientName", "investName", "clientNip",
                    COALESCE(NULLIF(o."clientNumber", ''), json_extract(o.data, '$.clientNumber'), '') AS "clientNumber",
                    'rury' AS "_type",
                    "transportCost",
                    COALESCE(o_rury.order_count, 0) AS "_orderCount",
                    json_extract(o.data, '$.clientName') AS "d_clientName",
                    json_extract(o.data, '$.investName') AS "d_investName",
                    json_extract(o.data, '$.investAddress') AS "d_investAddress",
                    json_extract(o.data, '$.clientNip') AS "d_clientNip",
                    json_extract(o.data, '$.clientNumber') AS "d_clientNumber",
                    -- CAST AS REAL: totalNetto/Brutto bywają number lub stringiem
                    -- ("29405"); Prisma wnioskuje typ z 1. wiersza i rzuca BigInt
                    -- przy mieszanych typach. REAL wraca zawsze jako number.
                    CAST(json_extract(o.data, '$.totalNetto') AS REAL) AS "d_totalNetto",
                    CAST(json_extract(o.data, '$.totalBrutto') AS REAL) AS "d_totalBrutto",
                    json_extract(o.data, '$.summary') AS "d_summary",
                    json_extract(o.data, '$.costSummary') AS "d_costSummary",
                    -- P1-C: suma wellsExport jako skalar (2317 pełnych kopii = MB).
                    -- NULL gdy brak (cena liczy się ze skalarów jak dotąd).
                    -- CAST AS REAL: SUM() bez decltype Prisma mapuje na BigInt
                    -- i rzuca przy ułamkach (np. 8135347.5) — REAL wraca jako number.
                    CASE WHEN json_extract(o.data, '$.wellsExport') IS NULL THEN NULL
                    ELSE (SELECT CAST(ROUND(COALESCE(SUM(value->>'totalPrice'), 0), 2) AS REAL)
                          FROM json_each(o.data, '$.wellsExport'))
                    END AS "d_wellsExportTotal",
                    json_array_length(o.data, '$.wells') AS "d_wellsCount",
                    json_array_length(o.data, '$.items') AS "d_itemsCount",
                    json_extract(o.data, '$.userName') AS "d_userName",
                    json_extract(o.data, '$.creatorName') AS "d_creatorName",
                    json_extract(o.data, '$.createdByUserName') AS "d_createdByUserName",
                    json_extract(o.data, '$.budowa') AS "d_budowa",
                    json_extract(o.data, '$.number') AS "d_number",
                    json_extract(o.data, '$.offerNumber') AS "d_offerNumber"
                FROM offers_rel o
                LEFT JOIN (
                    SELECT "offerId", COUNT(*) as order_count
                    FROM orders_rury_rel
                    GROUP BY "offerId"
                ) o_rury ON o_rury."offerId" = o.id
                ${whereSqlRury}

                UNION ALL

                SELECT
                    s.id, "userId", "clientId", state, "createdAt", "updatedAt",
                    "offer_number",
                    -- P1-C: historia slim jak wyżej (popup studni i tak idzie po audit endpoint).
                    COALESCE((SELECT json_group_array(json_object(
                        'updatedAt', value->>'updatedAt', 'timestamp', value->>'timestamp',
                        'state', value->>'state', 'totalBrutto', value->>'totalBrutto',
                        'lastEditedBy', value->>'lastEditedBy', 'userName', value->>'userName',
                        'itemsCount', json_array_length(value, '$.items')))
                    FROM json_each(COALESCE(s.history, '[]'))), '[]') AS history,
                    "clientName", "investName", "clientNip",
                    COALESCE(NULLIF(s."clientNumber", ''), json_extract(s.data, '$.clientNumber'), '') AS "clientNumber",
                    'studnie' AS "_type",
                    "transportCost",
                    COALESCE(o_stud.order_count, 0) AS "_orderCount",
                    json_extract(s.data, '$.clientName') AS "d_clientName",
                    json_extract(s.data, '$.investName') AS "d_investName",
                    json_extract(s.data, '$.investAddress') AS "d_investAddress",
                    json_extract(s.data, '$.clientNip') AS "d_clientNip",
                    json_extract(s.data, '$.clientNumber') AS "d_clientNumber",
                    -- CAST AS REAL jak wyżej (mieszane typy number/string).
                    CAST(json_extract(s.data, '$.totalNetto') AS REAL) AS "d_totalNetto",
                    CAST(json_extract(s.data, '$.totalBrutto') AS REAL) AS "d_totalBrutto",
                    json_extract(s.data, '$.summary') AS "d_summary",
                    json_extract(s.data, '$.costSummary') AS "d_costSummary",
                    -- P1-C: suma wellsExport jako skalar (2317 pełnych kopii = MB).
                    -- NULL gdy brak (cena liczy się ze skalarów jak dotąd).
                    -- CAST AS REAL: jak wyżej (BigInt rzuca przy ułamkach).
                    CASE WHEN json_extract(s.data, '$.wellsExport') IS NULL THEN NULL
                    ELSE (SELECT CAST(ROUND(COALESCE(SUM(value->>'totalPrice'), 0), 2) AS REAL)
                          FROM json_each(s.data, '$.wellsExport'))
                    END AS "d_wellsExportTotal",
                    json_array_length(s.data, '$.wells') AS "d_wellsCount",
                    json_array_length(s.data, '$.items') AS "d_itemsCount",
                    json_extract(s.data, '$.userName') AS "d_userName",
                    json_extract(s.data, '$.creatorName') AS "d_creatorName",
                    json_extract(s.data, '$.createdByUserName') AS "d_createdByUserName",
                    json_extract(s.data, '$.budowa') AS "d_budowa",
                    json_extract(s.data, '$.number') AS "d_number",
                    json_extract(s.data, '$.offerNumber') AS "d_offerNumber"
                FROM offers_studnie_rel s
                LEFT JOIN (
                    SELECT "offerStudnieId", COUNT(*) as order_count
                    FROM orders_studnie_rel
                    GROUP BY "offerStudnieId"
                ) o_stud ON o_stud."offerStudnieId" = s.id
                ${whereSqlStudnie}
            ) AS combined
            ${combinedWhere}
            ORDER BY ${Prisma.raw(sortCol)} ${Prisma.raw(sortDir)}, id ${Prisma.raw(sortDir)}
            LIMIT ${limitVal + 1}
        `;

        const rows = (await prisma.$queryRaw(sql)) as RawOfferRow[];

        const hasMore = rows.length > limitVal;
        const dataRows = hasMore ? rows.slice(0, limitVal) : rows;

        let nextCursor: string | null = null;
        let nextCursorId: string | null = null;
        if (hasMore && dataRows.length > 0) {
            const last = dataRows[dataRows.length - 1];
            nextCursor = last.createdAt;
            nextCursorId = last.id;
        }

        let totalCount: number | null = null;
        if (!params.cursor) {
            const countSql = Prisma.sql`
                SELECT COUNT(*) as cnt FROM (
                    SELECT id, 'rury' AS "_type" FROM offers_rel ${whereSqlRury}
                    UNION ALL
                    SELECT id, 'studnie' AS "_type" FROM offers_studnie_rel ${whereSqlStudnie}
                ) AS combined
                ${combinedWhere}
            `;
            const countResult = (await prisma.$queryRaw(countSql)) as { cnt: number | bigint }[];
            totalCount = Number(countResult[0]?.cnt || 0);
        }

        const data = (dataRows || []).map(mapOfferRow);

        const result = {
            data,
            totalCount,
            hasMore,
            nextCursor,
            nextCursorId
        };

        searchCache.set(user.id, params as unknown as Record<string, unknown>, result);
        res.json(result);
    } catch (e: unknown) {
        const message = e instanceof Error ? e.message : 'Unknown error';
        logger.error('SearchAPI', 'Blad wyszukiwania ofert:', message);
        res.status(500).json({ error: 'Wewnętrzny błąd serwera' });
    }
});

router.get('/orders', requireAuth, async (req, res) => {
    const authReq = req as AuthenticatedRequest;
    try {
        const { id, type: offerType } = req.query;

        if (!id || typeof id !== 'string') {
            return res.status(400).json({ error: 'Brak id oferty' });
        }

        if (offerType !== 'rury' && offerType !== 'studnie') {
            return res.status(400).json({ error: 'type musi byc rury lub studnie' });
        }

        if (!authReq.user) {
            return res.status(401).json({ error: 'Nieautoryzowany' });
        }

        const table = offerType === 'studnie' ? 'orders_studnie_rel' : 'orders_rury_rel';
        const idCol = offerType === 'studnie' ? 'offerStudnieId' : 'offerId';
        const docType = offerType === 'studnie' ? 'order_studnie' : 'order_rury';
        const roleSql = buildRoleWhereConditionWithShares(authReq.user, docType);
        const idCond = Prisma.sql`${Prisma.raw(idCol)} = ${id}`;
        const whereSql =
            roleSql !== Prisma.empty
                ? Prisma.sql`${roleSql} AND ${idCond}`
                : Prisma.sql`WHERE ${idCond}`;

        const rows = await prisma.$queryRaw(Prisma.sql`
            SELECT * FROM ${Prisma.raw(table)}
            ${whereSql}
            ORDER BY "createdAt" DESC
            LIMIT 50
        `);

        const mapped = ((rows as Array<Record<string, unknown>>) || []).map((r) => {
            const parsed = parseJsonField<Record<string, unknown>>(r.data as string, {});
            return { ...r, data: parsed, ...parsed };
        });

        res.json({ data: mapped });
    } catch (e: unknown) {
        const message = e instanceof Error ? e.message : 'Unknown error';
        logger.error('SearchAPI', 'Blad pobierania zamowien:', message);
        res.status(500).json({ error: 'Wewnętrzny błąd serwera' });
    }
});

export default router;
