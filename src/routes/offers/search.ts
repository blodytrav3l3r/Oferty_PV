import express from 'express';
import prisma, { Prisma } from '../../prismaClient';
import { requireAuth, AuthenticatedRequest } from '../../middleware/auth';
import {
    buildRoleWhereConditionWithShares,
    buildOrderListWhereWithOfferShare
} from '../../utils/roleFilter';
import { logger } from '../../utils/logger';
import { searchCache } from '../../utils/searchCache';
import { parseJsonField } from '../../helpers';
import {
    parseSearchParams,
    buildSearchOrderBy,
    buildWhereParts,
    buildOrderStatusSql,
    buildFollowUpConditions,
    buildFollowUpOrderBy,
    buildOffersCountSql,
    followUpColumnsSql,
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

        // Tryb follow-up: sortowanie po zaległości, nie po createdAt —
        // kursor paginacji (createdAt) jest wtedy niezgodny, więc go pomijamy
        // (v1: widok "Do kontaktu" bez głębokiej paginacji, hasMore działa).
        const followupMode =
            params.followupStatus !== 'all' ||
            params.overdueOnly ||
            params.hidePaused ||
            params.nextContactFrom !== '' ||
            params.nextContactTo !== '' ||
            params.sort === 'followup';
        const nowIso = new Date().toISOString();

        // Filtr dat obejmuje też daty zamówień (OR EXISTS per gałąź UNION).
        const buildBranchParts = (orderRef: { table: string; column: string; alias: string }) =>
            buildWhereParts({
                q: params.q,
                dateFrom: params.dateFrom,
                dateTo: params.dateTo,
                userId: params.userId,
                cursor: followupMode ? '' : params.cursor,
                cursorId: followupMode ? '' : params.cursorId,
                sort: params.sort,
                order: params.order,
                orderStatus: params.orderStatus,
                orderRef
            });
        const roleSqlRury = buildRoleWhereConditionWithShares(user, 'offer', 'o');
        const roleSqlStudnie = buildRoleWhereConditionWithShares(user, 'offer_studnie', 's');
        const buildWhereSql = (roleSql: Prisma.Sql, whereParts: Prisma.Sql[]) =>
            roleSql !== Prisma.empty
                ? Prisma.sql`${roleSql}${
                      whereParts.length > 0
                          ? Prisma.sql` AND ${Prisma.join(whereParts, ' AND ')}`
                          : Prisma.empty
                  }`
                : whereParts.length > 0
                  ? Prisma.sql`WHERE ${Prisma.join(whereParts, ' AND ')}`
                  : Prisma.empty;
        const whereSqlRury = buildWhereSql(
            roleSqlRury,
            buildBranchParts({ table: 'orders_rury_rel', column: '"offerId"', alias: 'o' })
        );
        const whereSqlStudnie = buildWhereSql(
            roleSqlStudnie,
            buildBranchParts({
                table: 'orders_studnie_rel',
                column: '"offerStudnieId"',
                alias: 's'
            })
        );

        const { whereSql: orderStatusWhere } = buildOrderStatusSql(params.orderStatus);

        // Filtr typu oferty (rury vs studnie) na zewnętrznym SELECT — UNION ALL
        // zawiera wiersze z obu tabel, więc filtrujemy po aliasie _type.
        const typeWhere =
            params.type === 'offer'
                ? Prisma.sql`combined."_type" = 'rury'`
                : params.type === 'studnia_oferta'
                  ? Prisma.sql`combined."_type" = 'studnie'`
                  : Prisma.empty;
        let combinedWhere =
            orderStatusWhere !== Prisma.empty && typeWhere !== Prisma.empty
                ? Prisma.sql`${orderStatusWhere} AND ${typeWhere}`
                : orderStatusWhere !== Prisma.empty
                  ? orderStatusWhere
                  : typeWhere !== Prisma.empty
                    ? Prisma.sql`WHERE ${typeWhere}`
                    : Prisma.empty;

        // Opieka nad ofertą (P0.4): warunki LOS doklejane AND (działają też
        // samodzielnie — combinedWhere dostaje wtedy własne WHERE).
        const followupConds = buildFollowUpConditions({
            followupStatus: params.followupStatus,
            overdueOnly: params.overdueOnly,
            hidePaused: params.hidePaused,
            nextContactFrom: params.nextContactFrom,
            nextContactTo: params.nextContactTo,
            nowIso
        });
        if (followupConds.length > 0) {
            const followupSql = Prisma.sql`${Prisma.join(followupConds, ' AND ')}`;
            combinedWhere =
                combinedWhere !== Prisma.empty
                    ? Prisma.sql`${combinedWhere} AND ${followupSql}`
                    : Prisma.sql`WHERE ${followupSql}`;
        }

        const orderBySql =
            params.sort === 'followup'
                ? buildFollowUpOrderBy(nowIso)
                : buildSearchOrderBy(params.sort, params.order);
        const limitVal = Math.min(params.limit, SEARCH_LIMIT_MAX);

        const sql = Prisma.sql`
            SELECT * FROM (
                SELECT
                    o.id, "userId", "clientId", state, "createdAt", "updatedAt",
                    "offer_number",
                    -- P1-C: historia na liście w wersji slim (popup: skalary + itemsCount;
                    -- pełna historia tylko w DETAIL). 29 MB history na liście to przeszłość.
                    COALESCE((SELECT jsonb_agg(jsonb_build_object(
                        'updatedAt', h.value->'updatedAt', 'timestamp', h.value->'timestamp',
                        'state', h.value->'state', 'totalBrutto', h.value->'totalBrutto',
                        'lastEditedBy', h.value->'lastEditedBy', 'userName', h.value->'userName',
                        'itemsCount', CASE WHEN jsonb_typeof(h.value->'items') = 'array'
                            THEN jsonb_array_length(h.value->'items') ELSE NULL END
                    ) ORDER BY h.ordinality)::text
                    FROM jsonb_array_elements(COALESCE(NULLIF(o.history, '')::jsonb, '[]'::jsonb))
                        WITH ORDINALITY AS h(value, ordinality)), '[]') AS history,
                    "clientName", "investName", "clientNip",
                    COALESCE(NULLIF(o."clientNumber", ''), o.data::jsonb ->> 'clientNumber', '') AS "clientNumber",
                    'rury' AS "_type",
                    "transportCost",
                    COALESCE(o_rury.order_count, 0) AS "_orderCount",
                    o.data::jsonb ->> 'clientName' AS "d_clientName",
                    o.data::jsonb ->> 'investName' AS "d_investName",
                    o.data::jsonb ->> 'investAddress' AS "d_investAddress",
                    o.data::jsonb ->> 'clientNip' AS "d_clientNip",
                    o.data::jsonb ->> 'clientNumber' AS "d_clientNumber",
                    o.data::jsonb ->> 'totalNetto' AS "d_totalNetto",
                    o.data::jsonb ->> 'totalBrutto' AS "d_totalBrutto",
                    (o.data::jsonb -> 'summary')::text AS "d_summary",
                    (o.data::jsonb -> 'costSummary')::text AS "d_costSummary",
                    CASE WHEN jsonb_typeof(o.data::jsonb -> 'wellsExport') = 'array' THEN (
                        SELECT ROUND(COALESCE(SUM(CASE
                            WHEN (well.value ->> 'totalPrice') ~ '^-?[0-9]+([.][0-9]+)?$'
                            THEN (well.value ->> 'totalPrice')::numeric END), 0), 2)::double precision
                        FROM jsonb_array_elements(o.data::jsonb -> 'wellsExport') AS well(value)
                    ) ELSE NULL END AS "d_wellsExportTotal",
                    CASE WHEN jsonb_typeof(o.data::jsonb -> 'wells') = 'array'
                        THEN jsonb_array_length(o.data::jsonb -> 'wells') ELSE NULL END AS "d_wellsCount",
                    -- Licznik pozycji rur z tabeli relacyjnej; blob może być slim.
                    COALESCE(i_rel.item_count, CASE WHEN jsonb_typeof(o.data::jsonb -> 'items') = 'array'
                        THEN jsonb_array_length(o.data::jsonb -> 'items') ELSE NULL END) AS "d_itemsCount",
                    o.data::jsonb ->> 'userName' AS "d_userName",
                    o.data::jsonb ->> 'creatorName' AS "d_creatorName",
                    o.data::jsonb ->> 'createdByUserName' AS "d_createdByUserName",
                    o.data::jsonb ->> 'budowa' AS "d_budowa",
                    o.data::jsonb ->> 'number' AS "d_number",
                    o.data::jsonb ->> 'offerNumber' AS "d_offerNumber",
                    o.data::jsonb ->> 'transportSeparate' AS "d_transportSeparate",
                    o."pricelistVersionId" AS "pricelistVersionId"
                    -- Opieka nad ofertą (P0.4): latest follow-up do filtra LOS i badge.
                    ${followUpColumnsSql('rury', 'o')}
                FROM offers_rel o
                LEFT JOIN (
                    SELECT "offerId", COUNT(*) as order_count
                    FROM orders_rury_rel
                    GROUP BY "offerId"
                ) o_rury ON o_rury."offerId" = o.id
                LEFT JOIN (
                    SELECT "offerId", COUNT(*) as item_count
                    FROM offer_items_rel
                    GROUP BY "offerId"
                ) i_rel ON i_rel."offerId" = o.id
                ${whereSqlRury}

                UNION ALL

                SELECT
                    s.id, "userId", "clientId", state, "createdAt", "updatedAt",
                    "offer_number",
                    -- P1-C: historia slim jak wyżej (popup studni i tak idzie po audit endpoint).
                    COALESCE((SELECT jsonb_agg(jsonb_build_object(
                        'updatedAt', h.value->'updatedAt', 'timestamp', h.value->'timestamp',
                        'state', h.value->'state', 'totalBrutto', h.value->'totalBrutto',
                        'lastEditedBy', h.value->'lastEditedBy', 'userName', h.value->'userName',
                        'itemsCount', CASE WHEN jsonb_typeof(h.value->'items') = 'array'
                            THEN jsonb_array_length(h.value->'items') ELSE NULL END
                    ) ORDER BY h.ordinality)::text
                    FROM jsonb_array_elements(COALESCE(NULLIF(s.history, '')::jsonb, '[]'::jsonb))
                        WITH ORDINALITY AS h(value, ordinality)), '[]') AS history,
                    "clientName", "investName", "clientNip",
                    COALESCE(NULLIF(s."clientNumber", ''), s.data::jsonb ->> 'clientNumber', '') AS "clientNumber",
                    'studnie' AS "_type",
                    "transportCost",
                    COALESCE(o_stud.order_count, 0) AS "_orderCount",
                    s.data::jsonb ->> 'clientName' AS "d_clientName",
                    s.data::jsonb ->> 'investName' AS "d_investName",
                    s.data::jsonb ->> 'investAddress' AS "d_investAddress",
                    s.data::jsonb ->> 'clientNip' AS "d_clientNip",
                    s.data::jsonb ->> 'clientNumber' AS "d_clientNumber",
                    s.data::jsonb ->> 'totalNetto' AS "d_totalNetto",
                    s.data::jsonb ->> 'totalBrutto' AS "d_totalBrutto",
                    (s.data::jsonb -> 'summary')::text AS "d_summary",
                    (s.data::jsonb -> 'costSummary')::text AS "d_costSummary",
                    CASE WHEN jsonb_typeof(s.data::jsonb -> 'wellsExport') = 'array' THEN (
                        SELECT ROUND(COALESCE(SUM(CASE
                            WHEN (well.value ->> 'totalPrice') ~ '^-?[0-9]+([.][0-9]+)?$'
                            THEN (well.value ->> 'totalPrice')::numeric END), 0), 2)::double precision
                        FROM jsonb_array_elements(s.data::jsonb -> 'wellsExport') AS well(value)
                    ) ELSE NULL END AS "d_wellsExportTotal",
                    CASE WHEN s."wellCount" IS NULL OR s."wellCount" = 0
                        THEN CASE WHEN jsonb_typeof(s.data::jsonb -> 'wells') = 'array'
                            THEN jsonb_array_length(s.data::jsonb -> 'wells') ELSE NULL END
                        ELSE s."wellCount" END AS "d_wellsCount",
                    CASE WHEN jsonb_typeof(s.data::jsonb -> 'items') = 'array'
                        THEN jsonb_array_length(s.data::jsonb -> 'items') ELSE NULL END AS "d_itemsCount",
                    s.data::jsonb ->> 'userName' AS "d_userName",
                    s.data::jsonb ->> 'creatorName' AS "d_creatorName",
                    s.data::jsonb ->> 'createdByUserName' AS "d_createdByUserName",
                    s.data::jsonb ->> 'budowa' AS "d_budowa",
                    s.data::jsonb ->> 'number' AS "d_number",
                    s.data::jsonb ->> 'offerNumber' AS "d_offerNumber",
                    s.data::jsonb ->> 'transportSeparate' AS "d_transportSeparate",
                    s."pricelistVersionId" AS "pricelistVersionId"
                    -- Opieka nad ofertą (P0.4): jak wyżej (kind studnie).
                    ${followUpColumnsSql('studnie', 's')}
                FROM offers_studnie_rel s
                LEFT JOIN (
                    SELECT "offerStudnieId", COUNT(*) as order_count
                    FROM orders_studnie_rel
                    GROUP BY "offerStudnieId"
                ) o_stud ON o_stud."offerStudnieId" = s.id
                ${whereSqlStudnie}
            ) AS combined
            ${combinedWhere}
            ORDER BY ${orderBySql}
            LIMIT ${limitVal + 1}
        `;

        const rows = (await prisma.$queryRaw(sql)) as RawOfferRow[];

        // P5.3: tryb follow-up nie ma realnej paginacji (kursor ignorowany) —
        // hasMore=false zamiast obietnicy kolejnej strony. totalCount zostaje.
        const hasMore = !followupMode && rows.length > limitVal;
        const dataRows = rows.length > limitVal ? rows.slice(0, limitVal) : rows;

        let nextCursor: string | null = null;
        let nextCursorId: string | null = null;
        if (hasMore && dataRows.length > 0 && !followupMode) {
            const last = dataRows[dataRows.length - 1];
            nextCursor = last.createdAt;
            nextCursorId = last.id;
        }

        let totalCount: number | null = null;
        if (!params.cursor) {
            // Aliasy o/s jak w głównym SELECT — wymaga ich OR EXISTS z filtra dat.
            const countSql = buildOffersCountSql(whereSqlRury, whereSqlStudnie, combinedWhere);
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
        const roleSql = buildOrderListWhereWithOfferShare(authReq.user, docType, {
            alias: 't',
            fkCol: offerType === 'studnie' ? '"offerStudnieId"' : '"offerId"',
            offerDocType: offerType === 'studnie' ? 'offer_studnie' : 'offer'
        });
        const idCond = Prisma.sql`${Prisma.raw(idCol)} = ${id}`;
        const whereSql =
            roleSql !== Prisma.empty
                ? Prisma.sql`${roleSql} AND ${idCond}`
                : Prisma.sql`WHERE ${idCond}`;

        const rows = await prisma.$queryRaw(Prisma.sql`
            SELECT * FROM ${Prisma.raw(table)} t
            ${whereSql}
            ORDER BY "createdAt" DESC
            LIMIT 50
        `);

        const mapped = ((rows as Array<Record<string, unknown>>) || []).map((r) => {
            const parsed = parseJsonField<Record<string, unknown>>(r.data as string, {});
            // Kolumna FK (offerId/offerStudnieId) to SSoT powiązania z ofertą —
            // stare klucze w blobie potrafią wskazywać inną ofertę (rozjazd
            // COUNT vs ordersMap w kartotece), więc kolumna wygrywa, blob to fallback.
            const fkFromBlob = parsed['offerId'] ?? parsed['offerStudnieId'] ?? parsed['offer_id'];
            delete parsed['offerId'];
            delete parsed['offerStudnieId'];
            delete parsed['offer_id'];
            return {
                ...parsed,
                ...r,
                data: parsed,
                [idCol]: (r[idCol] as string) ?? (fkFromBlob as string) ?? null
            };
        });

        res.json({ data: mapped });
    } catch (e: unknown) {
        const message = e instanceof Error ? e.message : 'Unknown error';
        logger.error('SearchAPI', 'Blad pobierania zamowien:', message);
        res.status(500).json({ error: 'Wewnętrzny błąd serwera' });
    }
});

export default router;
