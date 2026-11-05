import { parseJsonField } from '../helpers';
import { Prisma } from '../../generated/prisma-postgres/client';

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
    return str.replace(/!/g, '!!').replace(/%/g, '!%').replace(/_/g, '!_');
}

/** Parse valid stored JSON without treating NULL/empty values as malformed. */
export function jsonTextSql(column: Prisma.Sql, key: string): Prisma.Sql {
    return Prisma.sql`COALESCE(NULLIF(${column}, '')::jsonb, '{}'::jsonb) ->> ${key}`;
}

/** Normalize legacy epoch-ms text and ISO timestamps to PostgreSQL timestamptz. */
export function normalizedDateTimeSql(column: Prisma.Sql): Prisma.Sql {
    return Prisma.sql`CASE
        WHEN ${column} ~ '^[0-9]{13}$' THEN to_timestamp(${column}::double precision / 1000)
        ELSE NULLIF(${column}, '')::timestamptz
    END`;
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
    return normalizedDateTimeSql(Prisma.sql`production_orders_rel."createdAt"`);
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
            const orderNumber = jsonTextSql(
                Prisma.sql`production_orders_rel.data`,
                'productionOrderNumber'
            );
            // Kursor po nr zlecenia (sort leksykograficzny) — koherentny z ORDER BY
            whereParts.push(
                Prisma.sql`(${orderNumber} ${Prisma.raw(op)} ${cursor}
                    OR (${orderNumber} = ${cursor}
                        AND production_orders_rel.id ${Prisma.raw(op)} ${cursorId}))`
            );
        } else if (params.sort === 'updatedAt') {
            const updatedAt = normalizedDateTimeSql(Prisma.sql`production_orders_rel."updatedAt"`);
            whereParts.push(
                Prisma.sql`(${updatedAt} ${Prisma.raw(op)} ${cursor}::timestamptz
                    OR (${updatedAt} = ${cursor}::timestamptz
                        AND production_orders_rel.id ${Prisma.raw(op)} ${cursorId}))`
            );
        } else {
            // Domyślnie kursor po znormalizowanym createdAt (tie-breaker id)
            whereParts.push(
                Prisma.sql`(${normalizedCreatedAtSql()} ${Prisma.raw(op)} ${cursor}::timestamptz
                    OR (${normalizedCreatedAtSql()} = ${cursor}::timestamptz
                        AND production_orders_rel.id ${Prisma.raw(op)} ${cursorId}))`
            );
        }
    }

    if (status === 'draft') {
        whereParts.push(Prisma.sql`(
            production_orders_rel.data IS NULL
            OR ${jsonTextSql(Prisma.sql`production_orders_rel.data`, 'status')} IS DISTINCT FROM 'accepted'
        )`);
    } else if (status === 'accepted') {
        whereParts.push(
            Prisma.sql`${jsonTextSql(Prisma.sql`production_orders_rel.data`, 'status')} = 'accepted'`
        );
    }

    if (dateFrom) {
        whereParts.push(
            Prisma.sql`${normalizedCreatedAtSql()} >= ${dateFrom + 'T00:00:00.000Z'}::timestamptz`
        );
    }
    if (dateTo) {
        whereParts.push(
            Prisma.sql`${normalizedCreatedAtSql()} <= ${dateTo + 'T23:59:59.999Z'}::timestamptz`
        );
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
            Prisma.sql`${jsonTextSql(Prisma.sql`production_orders_rel.data`, 'productionOrderNumber')} ILIKE ${v} ESCAPE '!'`
        );
    }
    if (salesOrderNumber) {
        const v = '%' + escLike(salesOrderNumber) + '%';
        // Nr zamówienia handlowego — w JOIN o.data (orders_studnie_rel) lub fallback w PO data
        whereParts.push(
            Prisma.sql`(
                ${jsonTextSql(Prisma.sql`o.data`, 'orderNumber')} ILIKE ${v} ESCAPE '!'
                OR ${jsonTextSql(Prisma.sql`production_orders_rel.data`, 'salesOrderNumber')} ILIKE ${v} ESCAPE '!'
                OR ${jsonTextSql(Prisma.sql`production_orders_rel.data`, 'orderNumber')} ILIKE ${v} ESCAPE '!'
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
            Prisma.sql`${jsonTextSql(Prisma.sql`production_orders_rel.data`, 'productionOrderNumber')} ILIKE ${v} ESCAPE '!'`,
            Prisma.sql`${jsonTextSql(Prisma.sql`production_orders_rel.data`, 'wellName')} ILIKE ${v} ESCAPE '!'`,
            Prisma.sql`${jsonTextSql(Prisma.sql`production_orders_rel.data`, 'projectName')} ILIKE ${v} ESCAPE '!'`,
            Prisma.sql`${jsonTextSql(Prisma.sql`production_orders_rel.data`, 'obiekt')} ILIKE ${v} ESCAPE '!'`,
            Prisma.sql`${jsonTextSql(Prisma.sql`production_orders_rel.data`, 'elementName')} ILIKE ${v} ESCAPE '!'`,
            Prisma.sql`${jsonTextSql(Prisma.sql`production_orders_rel.data`, 'productName')} ILIKE ${v} ESCAPE '!'`,
            Prisma.sql`${jsonTextSql(Prisma.sql`production_orders_rel.data`, 'snr')} ILIKE ${v} ESCAPE '!'`,
            Prisma.sql`${jsonTextSql(Prisma.sql`o.data`, 'orderNumber')} ILIKE ${v} ESCAPE '!'`,
            Prisma.sql`u1."firstName" ILIKE ${v} ESCAPE '!'`,
            Prisma.sql`u1."lastName" ILIKE ${v} ESCAPE '!'`,
            Prisma.sql`u2."firstName" ILIKE ${v} ESCAPE '!'`,
            Prisma.sql`u2."lastName" ILIKE ${v} ESCAPE '!'`
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
        // P0-D: kolumna wygrywa z blobem — baza optimistic lockingu.
        version: typeof row.version === 'number' ? row.version : 1,
        // Liczniki wydruków: jawny kontrakt, brak pola = 0 (kompatybilność wsteczna).
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
                : null,
        dbSalesOrderNumber: dbSalesOrderNumber || undefined,
        dbSalesOrderId: row.dbSalesOrderId || undefined
    };
}
