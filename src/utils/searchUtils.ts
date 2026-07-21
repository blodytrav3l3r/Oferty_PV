import { Prisma } from '../../generated/prisma';
import { buildFts5Query } from './fts5Sync';

export interface SearchParams {
    q: string;
    type: 'all' | 'offer' | 'studnia_oferta';
    dateFrom: string;
    dateTo: string;
    userId: string;
    orderStatus: 'all' | 'with_order' | 'without_order';
    cursor: string;
    cursorId: string;
    limit: number;
    sort: 'createdAt' | 'offer_number';
    order: 'asc' | 'desc';
}

export function parseSearchParams(query: Record<string, unknown>): SearchParams {
    return {
        q: typeof query.q === 'string' ? query.q.trim() : '',
        type: (['all', 'offer', 'studnia_oferta'] as const).includes(query.type as any)
            ? (query.type as SearchParams['type'])
            : 'all',
        dateFrom: typeof query.dateFrom === 'string' ? query.dateFrom : '',
        dateTo: typeof query.dateTo === 'string' ? query.dateTo : '',
        userId: typeof query.userId === 'string' ? query.userId : '',
        orderStatus: (['all', 'with_order', 'without_order'] as const).includes(
            query.orderStatus as any
        )
            ? (query.orderStatus as SearchParams['orderStatus'])
            : 'all',
        cursor: typeof query.cursor === 'string' ? query.cursor : '',
        cursorId: typeof query.cursorId === 'string' ? query.cursorId : '',
        limit: Math.min(100, Math.max(1, parseInt(String(query.limit)) || 50)),
        sort: (['createdAt', 'offer_number'] as const).includes(query.sort as any)
            ? (query.sort as SearchParams['sort'])
            : 'createdAt',
        order: query.order === 'asc' ? 'asc' : 'desc'
    };
}

interface BuildWherePartsInput {
    q: string;
    dateFrom: string;
    dateTo: string;
    userId: string;
    roleSql: Prisma.Sql;
    cursor: string;
    cursorId: string;
    sort: string;
    order: string;
}

export function buildWhereParts(input: BuildWherePartsInput): Prisma.Sql[] {
    const parts: Prisma.Sql[] = [];

    // roleSql to Prisma.empty dla admina — nie dodawaj go, bo Prisma.empty jest obiektem (truthy)
    const roleSqlStr = input.roleSql;
    if (roleSqlStr && roleSqlStr !== Prisma.empty) parts.push(roleSqlStr);

    if (input.cursor && input.cursorId) {
        const op = input.order === 'desc' ? '<' : '>';
        parts.push(Prisma.sql`(
            "createdAt" ${Prisma.raw(op)} ${input.cursor}
            OR ("createdAt" = ${input.cursor} AND id ${Prisma.raw(op)} ${input.cursorId})
        )`);
    }

    if (input.q) {
        const ftsQuery = buildFts5Query(input.q);
        if (ftsQuery) {
            parts.push(Prisma.sql`id IN (
                SELECT id FROM offers_search_fts
                WHERE offers_search_fts MATCH ${ftsQuery}
            )`);
        }
    }

    if (input.dateFrom) {
        parts.push(Prisma.sql`"createdAt" >= ${input.dateFrom}`);
    }
    if (input.dateTo) {
        parts.push(Prisma.sql`"createdAt" <= ${input.dateTo + 'T23:59:59.999Z'}`);
    }

    if (input.userId) {
        parts.push(Prisma.sql`"userId" = ${input.userId}`);
    }

    return parts;
}

export function buildOrderStatusSql(orderStatus: SearchParams['orderStatus']): {
    joinSql: Prisma.Sql;
    whereSql: Prisma.Sql;
} {
    if (orderStatus === 'with_order') {
        return {
            joinSql: Prisma.empty,
            whereSql: Prisma.sql`AND EXISTS (
                SELECT 1 FROM orders_rury_rel WHERE "offerId" = combined.id
                UNION
                SELECT 1 FROM orders_studnie_rel WHERE "offerStudnieId" = combined.id
            )`
        };
    }
    if (orderStatus === 'without_order') {
        return {
            joinSql: Prisma.empty,
            whereSql: Prisma.sql`AND NOT EXISTS (
                SELECT 1 FROM orders_rury_rel WHERE "offerId" = combined.id
                UNION
                SELECT 1 FROM orders_studnie_rel WHERE "offerStudnieId" = combined.id
            )`
        };
    }
    return { joinSql: Prisma.empty, whereSql: Prisma.empty };
}

export interface RawOfferRow {
    id: string;
    userId: string | null;
    clientId: string | null;
    state: string | null;
    createdAt: string | null;
    updatedAt: string | null;
    offer_number: string | null;
    data: string | null;
    history: string | null;
    _type: string;
    transportCost: number | null;
    _orderCount: number | bigint;
    clientName: string | null;
    investName: string | null;
    clientNip: string | null;
    clientNumber: string | null;
}

export function mapOfferRow(row: RawOfferRow): Record<string, unknown> {
    const offer: Record<string, unknown> = { ...row };

    if (typeof offer.data === 'string') {
        try {
            offer.data = JSON.parse(offer.data as string);
        } catch {
            offer.data = {};
        }
    }
    if (typeof offer.history === 'string') {
        try {
            offer.history = JSON.parse(offer.history as string);
        } catch {
            offer.history = [];
        }
    }

    // Kolumny clientName/investName są teraz wypełniane przy zapisie
    // Fallback do JSON data dla legacy rekordów
    if (!offer.clientName && !offer.investName) {
        const dataObj = offer.data as Record<string, unknown> | undefined;
        if (dataObj && typeof dataObj === 'object') {
            offer.clientName = dataObj.clientName || '';
            offer.investName = dataObj.investName || '';
            offer.clientNip = dataObj.clientNip || '';
        }
    }

    offer.clientName = offer.clientName || '';
    offer.investName = offer.investName || '';
    offer.clientNip = offer.clientNip || '';

    offer.type = row._type === 'studnie' ? 'studnia_oferta' : 'offer';
    delete offer._type;

    if (typeof offer._orderCount === 'bigint') {
        offer._orderCount = Number(offer._orderCount);
    }

    offer.number = offer.offer_number || '';

    return offer;
}
