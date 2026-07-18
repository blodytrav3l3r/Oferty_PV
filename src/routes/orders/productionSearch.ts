import { Router } from 'express';
import prisma, { Prisma } from '../../prismaClient';
import { requireAuth, AuthenticatedRequest } from '../../middleware/auth';
import { buildRoleWhereCondition } from '../../utils/roleFilter';
import { parseSearchParams, mapProductionOrderRow } from '../../utils/productionSearchUtils';
import { searchCache } from '../../utils/searchCache';

const router = Router();

const SEARCH_LIMIT_MAX = 100;

router.get('/', requireAuth, async (req, res) => {
    const authReq = req as AuthenticatedRequest;
    const user = authReq.user;
    if (!user) return res.status(401).json({ error: 'Unauthorized' });

    const params = parseSearchParams(req.query as Record<string, unknown>);
    const { q, status, dateFrom, dateTo, userId, cursor, cursorId, limit, order } = params;

    const cacheKey: Record<string, unknown> = { ...params, _userId: user.id };
    const cached = searchCache.get('production', cacheKey);
    if (cached) return res.json(cached);

    const roleSql = buildRoleWhereCondition(user);
    const sortDir = order === 'asc' ? 'ASC' : 'DESC';
    const limitVal = Math.min(limit, SEARCH_LIMIT_MAX);

    const whereParts: Prisma.Sql[] = [];

    if (roleSql !== Prisma.empty) {
        whereParts.push(roleSql);
    }

    if (cursor && cursorId) {
        const op = order === 'desc' ? '<' : '>';
        whereParts.push(
            Prisma.sql`(production_orders_rel."createdAt" ${Prisma.raw(op)} ${cursor}
                OR (production_orders_rel."createdAt" = ${cursor}
                    AND production_orders_rel.id ${Prisma.raw(op)} ${cursorId}))`
        );
    }

    if (status === 'draft') {
        whereParts.push(Prisma.sql`(
            production_orders_rel.data IS NULL
            OR json_extract(production_orders_rel.data, '$.status') IS NOT 'accepted'
            OR json_extract(production_orders_rel.data, '$.status') IS NULL
        )`);
    } else if (status === 'accepted') {
        whereParts.push(
            Prisma.sql`json_extract(production_orders_rel.data, '$.status') = 'accepted'`
        );
    }

    if (dateFrom) {
        whereParts.push(Prisma.sql`production_orders_rel."createdAt" >= ${dateFrom}`);
    }
    if (dateTo) {
        whereParts.push(
            Prisma.sql`production_orders_rel."createdAt" <= ${dateTo + 'T23:59:59.999Z'}`
        );
    }

    if (userId) {
        whereParts.push(
            Prisma.sql`(production_orders_rel."userId" = ${userId}
                OR production_orders_rel."creatorId" = ${userId})`
        );
    }

    const whereSql =
        whereParts.length > 0
            ? Prisma.sql`WHERE ${Prisma.join(whereParts, ' AND ')}`
            : Prisma.empty;

    let searchWhere = Prisma.empty;
    if (q) {
        const searchParts: Prisma.Sql[] = [
            Prisma.sql`json_extract(production_orders_rel.data, '$.productionOrderNumber') LIKE ${'%' + q.replace(/'/g, "''") + '%'}`,
            Prisma.sql`json_extract(production_orders_rel.data, '$.wellName') LIKE ${'%' + q.replace(/'/g, "''") + '%'}`,
            Prisma.sql`json_extract(production_orders_rel.data, '$.projectName') LIKE ${'%' + q.replace(/'/g, "''") + '%'}`,
            Prisma.sql`json_extract(production_orders_rel.data, '$.obiekt') LIKE ${'%' + q.replace(/'/g, "''") + '%'}`,
            Prisma.sql`json_extract(production_orders_rel.data, '$.elementName') LIKE ${'%' + q.replace(/'/g, "''") + '%'}`,
            Prisma.sql`json_extract(production_orders_rel.data, '$.productName') LIKE ${'%' + q.replace(/'/g, "''") + '%'}`,
            Prisma.sql`json_extract(production_orders_rel.data, '$.snr') LIKE ${'%' + q.replace(/'/g, "''") + '%'}`,
            Prisma.sql`u1."firstName" LIKE ${'%' + q.replace(/'/g, "''") + '%'}`,
            Prisma.sql`u1."lastName" LIKE ${'%' + q.replace(/'/g, "''") + '%'}`,
            Prisma.sql`u2."firstName" LIKE ${'%' + q.replace(/'/g, "''") + '%'}`,
            Prisma.sql`u2."lastName" LIKE ${'%' + q.replace(/'/g, "''") + '%'}`
        ];
        searchWhere = Prisma.sql`AND (${Prisma.join(searchParts, ' OR ')})`;
    }

    try {
        const sql = Prisma.sql`
            SELECT production_orders_rel.id,
                   production_orders_rel."userId",
                   production_orders_rel."orderId",
                   production_orders_rel."wellId",
                   production_orders_rel."elementIndex",
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
            ORDER BY production_orders_rel."createdAt" ${Prisma.raw(sortDir)},
                     production_orders_rel.id ${Prisma.raw(sortDir)}
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
            nextCursor = (last.createdAt as string) || null;
            nextCursorId = (last.id as string) || null;
        }

        let totalCount: number | null = null;
        if (!cursor) {
            const countSql = Prisma.sql`
                SELECT COUNT(*) as cnt
                FROM production_orders_rel
                LEFT JOIN users u1 ON production_orders_rel."userId" = u1.id
                LEFT JOIN users u2 ON production_orders_rel."creatorId" = u2.id
                LEFT JOIN orders_studnie_rel o ON o.id = production_orders_rel."orderId"
                ${whereSql}
                ${searchWhere}
            `;
            const countResult: Array<{ cnt: number }> = (await prisma.$queryRaw(
                countSql
            )) as Array<{
                cnt: number;
            }>;
            totalCount = Number(countResult[0]?.cnt || 0);
        }

        const data = dataRows.map((row) => mapProductionOrderRow(row));

        const result = { data, totalCount, hasMore, nextCursor, nextCursorId };
        searchCache.set('production', cacheKey, result);
        res.json(result);
    } catch (e: unknown) {
        const message = e instanceof Error ? e.message : 'Unknown error';
        res.status(500).json({ error: message });
    }
});

export default router;
