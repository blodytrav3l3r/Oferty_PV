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
        type: ['all', 'offer', 'studnia_oferta'].includes(query.type as string)
            ? (query.type as SearchParams['type'])
            : 'all',
        dateFrom: typeof query.dateFrom === 'string' ? query.dateFrom : '',
        dateTo: typeof query.dateTo === 'string' ? query.dateTo : '',
        userId: typeof query.userId === 'string' ? query.userId : '',
        orderStatus: ['all', 'with_order', 'without_order'].includes(query.orderStatus as string)
            ? (query.orderStatus as SearchParams['orderStatus'])
            : 'all',
        cursor: typeof query.cursor === 'string' ? query.cursor : '',
        cursorId: typeof query.cursorId === 'string' ? query.cursorId : '',
        limit: Math.min(100, Math.max(1, parseInt(String(query.limit)) || 50)),
        sort: ['createdAt', 'offer_number'].includes(query.sort as string)
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

export interface SearchOfferRowMapped {
    id: string;
    userId: string | null;
    clientId: string | null;
    state: string | null;
    createdAt: string | null;
    updatedAt: string | null;
    offer_number: string | null;
    data: Record<string, unknown>;
    history: unknown[];
    clientName: string;
    investName: string;
    investAddress: string | null;
    clientNip: string;
    clientNumber: string | null;
    type: 'offer' | 'studnia_oferta';
    _orderCount: number;
    transportCost: number | null;
    number: string;
    [key: string]: unknown;
}

export function mapOfferRow(row: RawOfferRow): SearchOfferRowMapped {
    const offer = { ...row } as unknown as SearchOfferRowMapped;
    offer.type = row._type === 'studnie' ? 'studnia_oferta' : 'offer';
    offer.number = row.offer_number || '';
    offer._orderCount = Number(row._orderCount);

    if (typeof row.data === 'string') {
        try {
            offer.data = JSON.parse(row.data) as Record<string, unknown>;
        } catch {
            offer.data = {};
        }
    } else {
        offer.data = {};
    }

    if (typeof row.history === 'string') {
        try {
            offer.history = JSON.parse(row.history) as unknown[];
        } catch {
            offer.history = [];
        }
    } else {
        offer.history = [];
    }

    if (!offer.clientName && !offer.investName) {
        const dataObj = offer.data;
        if (dataObj && typeof dataObj === 'object') {
            offer.clientName = (dataObj.clientName as string) || '';
            offer.investName = (dataObj.investName as string) || '';
            offer.clientNip = (dataObj.clientNip as string) || '';
        }
    }

    offer.clientName = offer.clientName || '';
    offer.investName = offer.investName || '';
    offer.clientNip = offer.clientNip || '';

    return offer;
}
