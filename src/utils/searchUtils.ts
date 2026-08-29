import { Prisma } from '../../generated/prisma';
import { buildFts5Query } from './fts5Sync';

// Akceptuje YYYY-MM-DD (zakres z input[type=date]) oraz pełny ISO z czasem
// (YYYY-MM-DDTHH:MM:SS(.mmm)Z) — preset "Dzisiaj/7d/30d/miesiąc" (resolveDatePreset).
const DATE_PARAM_RE = /^\d{4}-\d{2}-\d{2}(T\d{2}:\d{2}:\d{2}(\.\d{1,3})?Z?)?$/;

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
        dateFrom:
            typeof query.dateFrom === 'string' && DATE_PARAM_RE.test(query.dateFrom)
                ? query.dateFrom
                : '',
        dateTo:
            typeof query.dateTo === 'string' && DATE_PARAM_RE.test(query.dateTo)
                ? query.dateTo
                : '',
        userId: typeof query.userId === 'string' ? query.userId : '',
        orderStatus: ['all', 'with_order', 'without_order'].includes(query.orderStatus as string)
            ? (query.orderStatus as SearchParams['orderStatus'])
            : 'all',
        cursor: typeof query.cursor === 'string' ? query.cursor : '',
        cursorId: typeof query.cursorId === 'string' ? query.cursorId : '',
        limit: Math.min(100, Math.max(1, parseInt(String(query.limit), 10) || 50)),
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
    cursor: string;
    cursorId: string;
    sort: string;
    order: string;
}

export function normalizedCreatedAtSql(): Prisma.Sql {
    return Prisma.sql`CASE WHEN "createdAt" GLOB '[0-9][0-9][0-9][0-9][0-9][0-9][0-9][0-9][0-9][0-9][0-9][0-9][0-9]' THEN datetime(CAST("createdAt" AS INTEGER)/1000, 'unixepoch') ELSE "createdAt" END`;
}

export function buildWhereParts(input: BuildWherePartsInput): Prisma.Sql[] {
    const parts: Prisma.Sql[] = [];

    if (input.cursor && input.cursorId) {
        const op = input.order === 'desc' ? '<' : '>';
        const norm = normalizedCreatedAtSql();
        parts.push(Prisma.sql`(
            ${norm} ${Prisma.raw(op)} ${input.cursor}
            OR (${norm} = ${input.cursor} AND id ${Prisma.raw(op)} ${input.cursorId})
        )`);
    }

    if (input.q) {
        const ftsQuery = buildFts5Query(input.q);
        const qLike = `%${input.q}%`;

        const searchSubquery = Prisma.sql`
            "userId" IN (
                SELECT id FROM users
                WHERE username LIKE ${qLike}
                   OR "firstName" LIKE ${qLike}
                   OR "lastName" LIKE ${qLike}
                   OR ("firstName" || ' ' || "lastName") LIKE ${qLike}
                   OR symbol LIKE ${qLike}
            )
            OR json_extract(data, '$.offerUser') LIKE ${qLike}
            OR json_extract(data, '$.preparedBy') LIKE ${qLike}
            OR json_extract(data, '$.author') LIKE ${qLike}
            OR json_extract(data, '$.investAddress') LIKE ${qLike}
            OR json_extract(data, '$.investContractor') LIKE ${qLike}
            OR "clientNip" LIKE ${qLike}
            OR json_extract(data, '$.clientNip') LIKE ${qLike}
            OR json_extract(data, '$.clientContact') LIKE ${qLike}
            OR json_extract(data, '$.clientAddress') LIKE ${qLike}
            OR json_extract(data, '$.offerNotes') LIKE ${qLike}
            OR json_extract(data, '$.notes') LIKE ${qLike}
            OR json_extract(data, '$.orderNumber') LIKE ${qLike}
            OR json_extract(data, '$.order_number') LIKE ${qLike}
            OR id IN (
                SELECT "offerId" FROM orders_rury_rel
                WHERE id LIKE ${qLike}
                   OR json_extract(data, '$.orderNumber') LIKE ${qLike}
                   OR json_extract(data, '$.order_number') LIKE ${qLike}
                UNION
                SELECT "offerStudnieId" FROM orders_studnie_rel
                WHERE id LIKE ${qLike}
                   OR json_extract(data, '$.orderNumber') LIKE ${qLike}
                   OR json_extract(data, '$.order_number') LIKE ${qLike}
            )
        `;

        if (ftsQuery) {
            parts.push(Prisma.sql`(
                id IN (
                    SELECT id FROM offers_search_fts
                    WHERE offers_search_fts MATCH ${ftsQuery}
                )
                OR ${searchSubquery}
            )`);
        } else {
            parts.push(Prisma.sql`(${searchSubquery})`);
        }
    }

    if (input.dateFrom) {
        parts.push(Prisma.sql`${normalizedCreatedAtSql()} >= ${input.dateFrom}`);
    }
    if (input.dateTo) {
        // Pełny ISO (preset) to już górna granica półotwarta [from, to);
        // goła data (zakres) = koniec dnia UTC.
        const isFullIso = input.dateTo.includes('T');
        const toBound = isFullIso ? input.dateTo : input.dateTo + 'T23:59:59.999Z';
        const op = isFullIso ? '<' : '<=';
        parts.push(Prisma.sql`${normalizedCreatedAtSql()} ${Prisma.raw(op)} ${toBound}`);
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
            whereSql: Prisma.sql`WHERE EXISTS (
                SELECT 1 FROM orders_rury_rel WHERE "offerId" = combined.id
                UNION
                SELECT 1 FROM orders_studnie_rel WHERE "offerStudnieId" = combined.id
            )`
        };
    }
    if (orderStatus === 'without_order') {
        return {
            joinSql: Prisma.empty,
            whereSql: Prisma.sql`WHERE NOT EXISTS (
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
