import { parseJsonField } from '../helpers';
import { Prisma } from '../prismaClient';

export interface SearchParams {
    q: string;
    status: string;
    dateFrom: string;
    dateTo: string;
    userId: string;
    cursor: string;
    cursorId: string;
    limit: number;
    sort: string;
    order: string;
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
        cursor: typeof query.cursor === 'string' ? query.cursor : '',
        cursorId: typeof query.cursorId === 'string' ? query.cursorId : '',
        limit: Math.min(500, Math.max(1, parseInt(query.limit as string) || 50)),
        sort: ['createdAt', 'updatedAt'].includes(query.sort as string)
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
    const { q, status, dateFrom, dateTo, userId, cursor, cursorId } = params;

    const whereParts: Prisma.Sql[] = [];

    if (cursor && cursorId) {
        const op = params.order === 'desc' ? '<' : '>';
        // Porównanie przez normalizedCreatedAtSql() — kursor pochodzi ze znormalizowanej
        // wartości SELECT; surowe createdAt przy mieszanych formatach (epoch-ms/ISO)
        // pomijałoby lub duplikowało wiersze.
        whereParts.push(
            Prisma.sql`(${normalizedCreatedAtSql()} ${Prisma.raw(op)} ${cursor}
                OR (${normalizedCreatedAtSql()} = ${cursor}
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

    const orderParsed = row.orderData
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
