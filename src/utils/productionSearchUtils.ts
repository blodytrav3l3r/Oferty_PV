import { parseJsonField } from '../helpers';

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
        dateFrom: typeof query.dateFrom === 'string' ? query.dateFrom : '',
        dateTo: typeof query.dateTo === 'string' ? query.dateTo : '',
        userId: typeof query.userId === 'string' ? query.userId : '',
        cursor: typeof query.cursor === 'string' ? query.cursor : '',
        cursorId: typeof query.cursorId === 'string' ? query.cursorId : '',
        limit: Math.min(100, Math.max(1, parseInt(query.limit as string) || 50)),
        sort: ['createdAt', 'updatedAt'].includes(query.sort as string)
            ? (query.sort as string)
            : 'createdAt',
        order: query.order === 'asc' ? 'asc' : 'desc'
    };
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
        createdAt: row.createdAt,
        updatedAt: row.updatedAt,
        handlerName: handlerName || undefined,
        creatorName: creatorName || undefined,
        ...parsedData,
        dbSalesOrderNumber: dbSalesOrderNumber || undefined,
        dbSalesOrderId: row.dbSalesOrderId || undefined
    };
}
