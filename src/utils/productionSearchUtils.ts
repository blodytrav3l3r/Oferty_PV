import { parseJsonField } from '../helpers';
import { Prisma } from '../prismaClient';

export interface SearchParams {
    q: string;
    status: string;
    dateFrom: string;
    dateTo: string;
    userId: string;
    // Wariant B — dedykowane filtry strukturalne
    productionOrderNumber: string;
    salesOrderNumber: string;
    cursor: string;
    cursorId: string;
    limit: number;
    sort: string;
    order: string;
}

function escLike(str: string): string {
    return str.replace(/\\/g, '\\\\').replace(/%/g, '\\%').replace(/_/g, '\\_');
}

export function parseSearchParams(query: Record<string, unknown>): SearchParams {
    return {
        q: typeof query.q === 'string' ? query.q.trim() : '',
        status: ['all', 'draft', 'accepted'].includes(query.status as string)
            ? (query.status as string)
            : 'all',
        dateFrom:
            typeof query.dateFrom === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(query.dateFrom)
                ? query.dateFrom
                : '',
        dateTo:
            typeof query.dateTo === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(query.dateTo)
                ? query.dateTo
                : '',
        userId: typeof query.userId === 'string' ? query.userId : '',
        productionOrderNumber:
            typeof query.productionOrderNumber === 'string'
                ? query.productionOrderNumber.trim()
                : '',
        salesOrderNumber:
            typeof query.salesOrderNumber === 'string' ? query.salesOrderNumber.trim() : '',
        cursor: typeof query.cursor === 'string' ? query.cursor : '',
        cursorId: typeof query.cursorId === 'string' ? query.cursorId : '',
        limit: Math.min(500, Math.max(1, parseInt(query.limit as string) || 50)),
        sort: ['createdAt', 'updatedAt', 'productionOrderNumber'].includes(query.sort as string)
            ? (query.sort as string)
            : 'createdAt',
        order: query.order === 'asc' ? 'asc' : 'desc'
    };
}

/**
 * Normalizacja createdAt dla porównań w WHERE — identyczna z CASE w SELECT
 * (legacy epoch-ms → 'YYYY-MM-DD HH:MM:SS', nowe ISO zostaje bez zmian).
 * Uwaga: CASE w WHERE pomija indeks na createdAt — akceptowalne przy skali,
 * bo search jest cache'owany (searchCache) tym samym kluczem.
 */
export function normalizedCreatedAtSql() {
    return Prisma.sql`CASE WHEN production_orders_rel."createdAt" GLOB '[0-9][0-9][0-9][0-9][0-9][0-9][0-9][0-9][0-9][0-9][0-9][0-9][0-9]'
        THEN datetime(CAST(production_orders_rel."createdAt" AS INTEGER) / 1000, 'unixepoch')
        ELSE production_orders_rel."createdAt" END`;
}
/**
 * Wspólne budowanie klauzul WHERE dla wyszukiwania zleceń produkcyjnych
 * (używane przez search).
 * roleSql pochodzi z buildRoleWhereCondition(user).
 */
export function buildProductionSearchWhere(
    params: SearchParams,
    roleSql: Prisma.Sql
): { whereSql: Prisma.Sql; searchWhere: Prisma.Sql } {
    const {
        q,
        status,
        dateFrom,
        dateTo,
        userId,
        productionOrderNumber,
        salesOrderNumber,
        cursor,
        cursorId
    } = params;

    const whereParts: Prisma.Sql[] = [];

    if (cursor && cursorId) {
        const op = params.order === 'desc' ? '<' : '>';
        if (params.sort === 'productionOrderNumber') {
            // Kursor po nr zlecenia (sort leksykograficzny) — koherentny z ORDER BY
            whereParts.push(
                Prisma.sql`(json_extract(production_orders_rel.data, '$.productionOrderNumber') ${Prisma.raw(op)} ${cursor}
                    OR (json_extract(production_orders_rel.data, '$.productionOrderNumber') = ${cursor}
                        AND production_orders_rel.id ${Prisma.raw(op)} ${cursorId}))`
            );
        } else if (params.sort === 'updatedAt') {
            whereParts.push(
                Prisma.sql`(production_orders_rel."updatedAt" ${Prisma.raw(op)} ${cursor}
                    OR (production_orders_rel."updatedAt" = ${cursor}
                        AND production_orders_rel.id ${Prisma.raw(op)} ${cursorId}))`
            );
        } else {
            // Domyślnie kursor po znormalizowanym createdAt (tie-breaker id)
            whereParts.push(
                Prisma.sql`(${normalizedCreatedAtSql()} ${Prisma.raw(op)} ${cursor}
                    OR (${normalizedCreatedAtSql()} = ${cursor}
                        AND production_orders_rel.id ${Prisma.raw(op)} ${cursorId}))`
            );
        }
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
        whereParts.push(Prisma.sql`${normalizedCreatedAtSql()} >= ${dateFrom}`);
    }
    if (dateTo) {
        whereParts.push(Prisma.sql`${normalizedCreatedAtSql()} <= ${dateTo + 'T23:59:59.999Z'}`);
    }

    if (userId) {
        whereParts.push(
            Prisma.sql`(production_orders_rel."userId" = ${userId}
                OR production_orders_rel."creatorId" = ${userId})`
        );
    }

    if (productionOrderNumber) {
        const v = '%' + escLike(productionOrderNumber) + '%';
        whereParts.push(
            Prisma.sql`json_extract(production_orders_rel.data, '$.productionOrderNumber') LIKE ${v} ESCAPE '\\'`
        );
    }
    if (salesOrderNumber) {
        const v = '%' + escLike(salesOrderNumber) + '%';
        // Nr zamówienia handlowego — w JOIN o.data (orders_studnie_rel) lub fallback w PO data
        whereParts.push(
            Prisma.sql`(
                json_extract(o.data, '$.orderNumber') LIKE ${v} ESCAPE '\\'
                OR json_extract(production_orders_rel.data, '$.salesOrderNumber') LIKE ${v} ESCAPE '\\'
                OR json_extract(production_orders_rel.data, '$.orderNumber') LIKE ${v} ESCAPE '\\'
            )`
        );
    }

    const whereSql =
        roleSql !== Prisma.empty
            ? Prisma.sql`${roleSql}${
                  whereParts.length > 0
                      ? Prisma.sql` AND ${Prisma.join(whereParts, ' AND ')}`
                      : Prisma.empty
              }`
            : whereParts.length > 0
              ? Prisma.sql`WHERE ${Prisma.join(whereParts, ' AND ')}`
              : Prisma.empty;

    let searchWhere = Prisma.empty;
    if (q) {
        const v = '%' + escLike(q) + '%';
        const searchParts: Prisma.Sql[] = [
            Prisma.sql`json_extract(production_orders_rel.data, '$.productionOrderNumber') LIKE ${v} ESCAPE '\\'`,
            Prisma.sql`json_extract(production_orders_rel.data, '$.wellName') LIKE ${v} ESCAPE '\\'`,
            Prisma.sql`json_extract(production_orders_rel.data, '$.projectName') LIKE ${v} ESCAPE '\\'`,
            Prisma.sql`json_extract(production_orders_rel.data, '$.obiekt') LIKE ${v} ESCAPE '\\'`,
            Prisma.sql`json_extract(production_orders_rel.data, '$.elementName') LIKE ${v} ESCAPE '\\'`,
            Prisma.sql`json_extract(production_orders_rel.data, '$.productName') LIKE ${v} ESCAPE '\\'`,
            Prisma.sql`json_extract(production_orders_rel.data, '$.snr') LIKE ${v} ESCAPE '\\'`,
            Prisma.sql`json_extract(o.data, '$.orderNumber') LIKE ${v} ESCAPE '\\'`,
            Prisma.sql`u1."firstName" LIKE ${v} ESCAPE '\\'`,
            Prisma.sql`u1."lastName" LIKE ${v} ESCAPE '\\'`,
            Prisma.sql`u2."firstName" LIKE ${v} ESCAPE '\\'`,
            Prisma.sql`u2."lastName" LIKE ${v} ESCAPE '\\'`
        ];
        searchWhere =
            whereSql === Prisma.empty
                ? Prisma.sql`WHERE (${Prisma.join(searchParts, ' OR ')})`
                : Prisma.sql`AND (${Prisma.join(searchParts, ' OR ')})`;
    }

    return { whereSql, searchWhere };
}

export function mapProductionOrderRow(row: Record<string, unknown>) {
    const parsedData = parseJsonField<Record<string, unknown>>(row.data as string, {});

    const handlerName =
        row.handlerFirstName || row.handlerLastName
            ? `${row.handlerFirstName || ''} ${row.handlerLastName || ''}`.trim()
            : row.handlerUsername || '';

    const creatorName =
        row.creatorFirstName || row.creatorLastName
            ? `${row.creatorFirstName || ''} ${row.creatorLastName || ''}`.trim()
            : row.creatorUsername || '';

    const orderParsed =
        typeof row.dbSalesOrderNumber === 'string'
            ? { orderNumber: row.dbSalesOrderNumber }
            : row.orderData
              ? parseJsonField<Record<string, unknown>>(row.orderData as string, {})
              : {};
    const dbSalesOrderNumber = (orderParsed.orderNumber || '') as string;

    return {
        id: row.id,
        type: 'production_order',
        userId: row.userId,
        orderId: row.orderId,
        wellId: row.wellId,
        elementIndex: row.elementIndex,
        elementKey: row.elementKey,
        createdAt: row.createdAt,
        updatedAt: row.updatedAt,
        handlerName: handlerName || undefined,
        creatorName: creatorName || undefined,
        ...parsedData,
        dbSalesOrderNumber: dbSalesOrderNumber || undefined,
        dbSalesOrderId: row.dbSalesOrderId || undefined
    };
}
