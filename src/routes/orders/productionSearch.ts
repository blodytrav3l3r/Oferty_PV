import { Router } from 'express';
import prisma, { Prisma } from '../../prismaClient';
import { requireAuth, AuthenticatedRequest } from '../../middleware/auth';
import { buildRoleWhereCondition } from '../../utils/roleFilter';
import {
    parseSearchParams,
    mapProductionOrderRow,
    buildProductionSearchWhere,
    normalizedCreatedAtSql
} from '../../utils/productionSearchUtils';
import { searchCache } from '../../utils/searchCache';
import { logger } from '../../utils/logger';

const router = Router();

const SEARCH_LIMIT_MAX = 500;

router.get('/', requireAuth, async (req, res) => {
    const authReq = req as AuthenticatedRequest;
    const user = authReq.user;
    if (!user) return res.status(401).json({ error: 'Unauthorized' });

    const params = parseSearchParams(req.query as Record<string, unknown>);

    const cacheKey: Record<string, unknown> = { ...params, _userId: user.id };
    const cached = searchCache.get('production', cacheKey);
    if (cached) return res.json(cached);

    const roleSql = buildRoleWhereCondition(user, 'production_orders_rel');
    const sortDir = params.order === 'asc' ? 'ASC' : 'DESC';
    const limitVal = Math.min(params.limit, SEARCH_LIMIT_MAX);

    // ORDER BY zgodny z nowym sort (wariant B: createdAt | updatedAt | productionOrderNumber)
    const orderBySql =
        params.sort === 'productionOrderNumber'
            ? Prisma.sql`json_extract(production_orders_rel.data, '$.productionOrderNumber') ${Prisma.raw(sortDir)}, production_orders_rel.id ${Prisma.raw(sortDir)}`
            : params.sort === 'updatedAt'
              ? Prisma.sql`production_orders_rel."updatedAt" ${Prisma.raw(sortDir)}, production_orders_rel.id ${Prisma.raw(sortDir)}`
              : Prisma.sql`production_orders_rel."createdAt" ${Prisma.raw(sortDir)}, production_orders_rel.id ${Prisma.raw(sortDir)}`;

    const { whereSql, searchWhere } = buildProductionSearchWhere(params, roleSql);

    try {
        const sql = Prisma.sql`
            SELECT production_orders_rel.id,
                   production_orders_rel."userId",
                   production_orders_rel."orderId",
                   production_orders_rel."wellId",
                   production_orders_rel."elementIndex",
                   production_orders_rel."elementKey",
                   production_orders_rel.data,
                   CASE WHEN production_orders_rel."createdAt" GLOB '[0-9][0-9][0-9][0-9][0-9][0-9][0-9][0-9][0-9][0-9][0-9][0-9][0-9]'
                       THEN datetime(CAST(production_orders_rel."createdAt" AS INTEGER)/1000, 'unixepoch')
                       ELSE production_orders_rel."createdAt" END as "createdAt",
                   CASE WHEN production_orders_rel."updatedAt" GLOB '[0-9][0-9][0-9][0-9][0-9][0-9][0-9][0-9][0-9][0-9][0-9][0-9][0-9]'
                       THEN datetime(CAST(production_orders_rel."updatedAt" AS INTEGER)/1000, 'unixepoch')
                       ELSE production_orders_rel."updatedAt" END as "updatedAt",
                   u1."firstName" as "handlerFirstName",
                   u1."lastName" as "handlerLastName",
                   u1.username as "handlerUsername",
                   u2."firstName" as "creatorFirstName",
                   u2."lastName" as "creatorLastName",
                   u2.username as "creatorUsername",
                   o.data as "orderData",
                   o.id as "dbSalesOrderId"
            FROM production_orders_rel
            LEFT JOIN users u1 ON production_orders_rel."userId" = u1.id
            LEFT JOIN users u2 ON production_orders_rel."creatorId" = u2.id
            LEFT JOIN orders_studnie_rel o ON o.id = production_orders_rel."orderId"
            ${whereSql}
            ${searchWhere}
            ORDER BY ${orderBySql}
            LIMIT ${limitVal + 1}
        `;

        const rows: Array<Record<string, unknown>> = (await prisma.$queryRaw(sql)) as Array<
            Record<string, unknown>
        >;

        const hasMore = rows.length > limitVal;
        const dataRows = hasMore ? rows.slice(0, limitVal) : rows;

        let nextCursor: string | null = null;
        let nextCursorId: string | null = null;
        if (hasMore && dataRows.length > 0) {
            const last = dataRows[dataRows.length - 1];
            if (params.sort === 'productionOrderNumber') {
                const d = last.data
                    ? (JSON.parse(last.data as string) as Record<string, unknown>)
                    : {};
                nextCursor =
                    (d.productionOrderNumber as string) || (last.createdAt as string) || null;
            } else if (params.sort === 'updatedAt') {
                nextCursor = (last.updatedAt as string) || (last.createdAt as string) || null;
            } else {
                nextCursor = (last.createdAt as string) || null;
            }
            nextCursorId = (last.id as string) || null;
        }

        let totalCount: number | null = null;
        let stats: { total: number; accepted: number; draft: number; today: number } | null = null;
        if (!params.cursor) {
            // Agregaty całego zbioru w jednym zapytaniu — współdzielą whereSql/searchWhere
            // (rola użytkownika + aktywne filtry) identycznie z głównym search.
            const statsSql = Prisma.sql`
                SELECT COUNT(*) as total,
                       SUM(CASE WHEN json_extract(production_orders_rel.data, '$.status') = 'accepted' THEN 1 ELSE 0 END) as accepted,
                       SUM(CASE WHEN production_orders_rel.data IS NULL
                                OR json_extract(production_orders_rel.data, '$.status') IS NOT 'accepted' THEN 1 ELSE 0 END) as draft,
                       SUM(CASE WHEN ${normalizedCreatedAtSql()} >= datetime('now', 'start of day') THEN 1 ELSE 0 END) as today
                FROM production_orders_rel
                LEFT JOIN users u1 ON production_orders_rel."userId" = u1.id
                LEFT JOIN users u2 ON production_orders_rel."creatorId" = u2.id
                LEFT JOIN orders_studnie_rel o ON o.id = production_orders_rel."orderId"
                ${whereSql}
                ${searchWhere}
            `;
            const statsRows: Array<{
                total: number;
                accepted: number;
                draft: number;
                today: number;
            }> = (await prisma.$queryRaw(statsSql)) as Array<{
                total: number;
                accepted: number;
                draft: number;
                today: number;
            }>;
            const statsRow = statsRows[0] || { total: 0, accepted: 0, draft: 0, today: 0 };
            stats = {
                total: Number(statsRow.total || 0),
                accepted: Number(statsRow.accepted || 0),
                draft: Number(statsRow.draft || 0),
                today: Number(statsRow.today || 0)
            };
            totalCount = stats.total;
        }

        const data = dataRows.map((row) => mapProductionOrderRow(row));

        const result = { data, totalCount, hasMore, nextCursor, nextCursorId, stats };
        searchCache.set('production', cacheKey, result);
        res.json(result);
    } catch (e: unknown) {
        const message = e instanceof Error ? e.message : 'Unknown error';
        logger.error('ProductionSearch', 'Błąd serwera', message);
        res.status(500).json({ error: 'Wewnętrzny błąd serwera' });
    }
});

export default router;
