import express from 'express';
import prisma, { Prisma } from '../../prismaClient';
import { requireAuth, AuthenticatedRequest } from '../../middleware/auth';
import { buildRoleWhereCondition } from '../../utils/roleFilter';
import { logger } from '../../utils/logger';
import { searchCache } from '../../utils/searchCache';
import { parseJsonField } from '../../helpers';
import {
    parseSearchParams,
    buildWhereParts,
    buildOrderStatusSql,
    mapOfferRow
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

        const roleSql = buildRoleWhereCondition(user);
        const whereParts = buildWhereParts({
            q: params.q,
            dateFrom: params.dateFrom,
            dateTo: params.dateTo,
            userId: params.userId,
            roleSql,
            cursor: params.cursor,
            cursorId: params.cursorId,
            sort: params.sort,
            order: params.order
        });
        const whereSql =
            whereParts.length > 0
                ? Prisma.sql`WHERE ${Prisma.join(whereParts, ' AND ')}`
                : Prisma.empty;

        const { whereSql: orderStatusWhere } = buildOrderStatusSql(params.orderStatus);

        const sortDir = params.order === 'asc' ? 'ASC' : 'DESC';
        const allowedSort = ['createdAt', 'offer_number'];
        const sortCol = allowedSort.includes(params.sort) ? params.sort : 'createdAt';
        const limitVal = Math.min(params.limit, SEARCH_LIMIT_MAX);

        const sql = Prisma.sql`
            SELECT * FROM (
                SELECT
                    o.id, "userId", "clientId", state, "createdAt", "updatedAt",
                    "offer_number", data, history,
                    "clientName", "investName", "clientNip",
                    (SELECT "clientNumber" FROM clients_rel WHERE id = o."clientId") AS "clientNumber",
                    'rury' AS "_type",
                    "transportCost",
                    COALESCE(o_rury.order_count, 0) AS "_orderCount"
                FROM offers_rel o
                LEFT JOIN (
                    SELECT "offerId", COUNT(*) as order_count
                    FROM orders_rury_rel
                    GROUP BY "offerId"
                ) o_rury ON o_rury."offerId" = o.id
                ${whereSql}

                UNION ALL

                SELECT
                    s.id, "userId", "clientId", state, "createdAt", "updatedAt",
                    "offer_number", data, history,
                    "clientName", "investName", "clientNip",
                    (SELECT "clientNumber" FROM clients_rel WHERE id = s."clientId") AS "clientNumber",
                    'studnie' AS "_type",
                    "transportCost",
                    COALESCE(o_stud.order_count, 0) AS "_orderCount"
                FROM offers_studnie_rel s
                LEFT JOIN (
                    SELECT "offerStudnieId", COUNT(*) as order_count
                    FROM orders_studnie_rel
                    GROUP BY "offerStudnieId"
                ) o_stud ON o_stud."offerStudnieId" = s.id
                ${whereSql}
            ) AS combined
            ${orderStatusWhere}
            ORDER BY ${Prisma.raw(sortCol)} ${Prisma.raw(sortDir)}, id ${Prisma.raw(sortDir)}
            LIMIT ${limitVal + 1}
        `;

        const rows = (await prisma.$queryRaw(sql)) as any[];

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
                    SELECT id FROM offers_rel ${whereSql}
                    UNION ALL
                    SELECT id FROM offers_studnie_rel ${whereSql}
                )
            `;
            const countResult = (await prisma.$queryRaw(countSql)) as any[];
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
        res.status(500).json({ error: message });
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

        const rows = await prisma.$queryRaw(Prisma.sql`
            SELECT * FROM ${Prisma.raw(table)}
            WHERE ${Prisma.raw(idCol)} = ${id}
            ORDER BY "createdAt" DESC
            LIMIT 50
        `);

        const mapped = ((rows as any[]) || []).map((r) => {
            const parsed = parseJsonField<Record<string, unknown>>(r.data, {});
            return { ...r, data: parsed, ...parsed };
        });

        res.json({ data: mapped });
    } catch (e: unknown) {
        const message = e instanceof Error ? e.message : 'Unknown error';
        logger.error('SearchAPI', 'Blad pobierania zamowien:', message);
        res.status(500).json({ error: message });
    }
});

export default router;
