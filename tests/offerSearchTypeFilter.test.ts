import request from 'supertest';
import express from 'express';
import searchRoutes from '../src/routes/offers/search';
import prisma from '../src/prismaClient';

jest.mock('../src/middleware/auth', () => ({
    requireAuth: (req: any, _res: any, next: any) => {
        req.user = { id: 'user-id', role: 'admin' };
        next();
    }
}));

jest.mock('../src/utils/logger', () => ({
    logger: {
        info: jest.fn(),
        error: jest.fn(),
        warn: jest.fn(),
        debug: jest.fn()
    }
}));

jest.mock('../src/utils/searchCache', () => ({
    searchCache: {
        get: jest.fn(() => null),
        set: jest.fn()
    }
}));

jest.mock('../src/utils/searchUtils', () => {
    const actual = jest.requireActual('../src/utils/searchUtils');
    return {
        ...actual,
        // buildOrderStatusSql importuje Prisma z generated/prisma (real Sql object),
        // co psuje rendering w mocku prismaClient — zwracamy marker string.
        buildOrderStatusSql: () => ({
            joinSql: '',
            whereSql: 'WHERE EXISTS_ORDER_MARKER'
        })
    };
});

jest.mock('../src/prismaClient', () => {
    // Renderer rekurencyjny: fragmenty z actual searchUtils to real-Sql
    // ({strings, values}), nie stringi — rozwiń je zamiast String(v).
    const renderValue = (v: unknown): string => {
        if (
            typeof v === 'object' &&
            v !== null &&
            Array.isArray((v as { strings?: unknown }).strings) &&
            Array.isArray((v as { values?: unknown }).values)
        ) {
            const nested = v as { strings: string[]; values: unknown[] };
            let out = '';
            nested.strings.forEach((s, i) => {
                out += s;
                if (i < nested.values.length) out += renderValue(nested.values[i]);
            });
            return out;
        }
        return String(v);
    };
    const sql = (strings: TemplateStringsArray, ...values: unknown[]): string => {
        let out = '';
        strings.forEach((s, i) => {
            out += s;
            if (i < values.length) out += renderValue(values[i]);
        });
        return out;
    };
    return {
        __esModule: true,
        default: {
            $queryRaw: jest.fn().mockResolvedValue([])
        },
        Prisma: {
            raw: (s: string): string => s,
            empty: '',
            sql,
            join: (values: unknown[]): string => values.join(', ')
        }
    };
});

function createApp() {
    const app = express();
    app.use(express.json());
    app.use('/api/offers/search', searchRoutes);
    return app;
}

describe('Wyszukiwarka ofert — filtr typu (rury vs studnie)', () => {
    let app: express.Application;

    beforeEach(() => {
        jest.resetAllMocks();
        (prisma.$queryRaw as jest.Mock).mockResolvedValue([]);
        app = createApp();
    });

    // Renderuje mock-stringi ORAZ real-Sql ({strings, values} z generated/prisma)
    // — buildOffersCountSql buduje real-Sql w actual searchUtils.
    function renderArg(arg: unknown): string {
        if (
            typeof arg === 'object' &&
            arg !== null &&
            Array.isArray((arg as { strings?: unknown }).strings) &&
            Array.isArray((arg as { values?: unknown }).values)
        ) {
            const nested = arg as { strings: string[]; values: unknown[] };
            let out = '';
            nested.strings.forEach((s, i) => {
                out += s;
                if (i < nested.values.length) out += renderArg(nested.values[i]);
            });
            return out;
        }
        return String(arg);
    }

    async function dataQuerySql() {
        const calls = (prisma.$queryRaw as jest.Mock).mock.calls;
        // Pierwsze wywołanie $queryRaw to query danych (ma ORDER BY), drugie to COUNT
        const first = calls.find((c) => renderArg(c[0]).includes('ORDER BY'));
        return first ? renderArg(first[0]) : '';
    }

    async function countQuerySql() {
        const calls = (prisma.$queryRaw as jest.Mock).mock.calls;
        // COUNT nie ma ORDER BY — identyfikujemy po SELECT COUNT
        const count = calls.find((c) => renderArg(c[0]).includes('SELECT COUNT'));
        return count ? renderArg(count[0]) : '';
    }

    it('type=offer: zapytanie filtruje po _type rury', async () => {
        await request(app).get('/api/offers/search?type=offer').expect(200);
        const sql = await dataQuerySql();
        expect(sql).toContain(`combined."_type" = 'rury'`);
    });

    it('type=offer: count query tez ma _type w podzapytaniu', async () => {
        await request(app).get('/api/offers/search?type=offer').expect(200);
        const sql = await countQuerySql();
        expect(sql).toContain(`'rury' AS "_type"`);
        expect(sql).toContain(`combined."_type" = 'rury'`);
    });

    it('type=studnia_oferta: zapytanie filtruje po _type studnie', async () => {
        await request(app).get('/api/offers/search?type=studnia_oferta').expect(200);
        const sql = await dataQuerySql();
        expect(sql).toContain(`combined."_type" = 'studnie'`);
    });

    it('type=all: brak filtra typu', async () => {
        await request(app).get('/api/offers/search?type=all').expect(200);
        const sql = await dataQuerySql();
        expect(sql).not.toContain('combined."_type"');
    });

    it('type=offer + orderStatus=with_order: oba warunki polaczone AND', async () => {
        await request(app).get('/api/offers/search?type=offer&orderStatus=with_order').expect(200);
        const sql = await dataQuerySql();
        expect(sql).toContain('EXISTS_ORDER_MARKER');
        expect(sql).toContain(`combined."_type" = 'rury'`);
        // WHERE ... AND ... — oba filtry w jednym WHERE
        expect(sql).toMatch(/WHERE EXISTS_ORDER_MARKER\s+AND combined\."_type" = 'rury'/);
    });

    // P5.3: tryb follow-up bez realnej paginacji — hasMore=false zamiast
    // obietnicy kolejnej strony; poza trybem zachowanie bez zmian.
    const fullRow = (id: string) => ({
        id,
        userId: 'user-id',
        clientId: null,
        state: 'final',
        createdAt: '2026-10-01T00:00:00.000Z',
        updatedAt: '2026-10-01T00:00:00.000Z',
        offer_number: 'OF/' + id,
        history: '[]',
        _fu_outcome: null,
        _fu_next: null,
        _fu_last: null,
        _type: 'rury',
        transportCost: null,
        _orderCount: 0,
        clientName: 'ACME',
        investName: '',
        clientNip: '',
        clientNumber: null
    });

    it('followupMode: 51 wierszy -> 50 danych, hasMore false, totalCount zostaje', async () => {
        const rows = Array.from({ length: 51 }, (_, i) => fullRow('o-' + i));
        (prisma.$queryRaw as jest.Mock)
            .mockResolvedValueOnce(rows)
            .mockResolvedValueOnce([{ cnt: 60 }]);
        const res = await request(app).get(
            '/api/offers/search?followupStatus=needs_contact&limit=50'
        );
        expect(res.status).toBe(200);
        expect(res.body.data).toHaveLength(50);
        expect(res.body.hasMore).toBe(false);
        expect(res.body.nextCursor).toBeNull();
        expect(res.body.totalCount).toBe(60);
    });

    it('poza followupMode: 51 wierszy -> hasMore true (regresja)', async () => {
        const rows = Array.from({ length: 51 }, (_, i) => fullRow('o-' + i));
        (prisma.$queryRaw as jest.Mock)
            .mockResolvedValueOnce(rows)
            .mockResolvedValueOnce([{ cnt: 60 }]);
        const res = await request(app).get('/api/offers/search?limit=50');
        expect(res.status).toBe(200);
        expect(res.body.data).toHaveLength(50);
        expect(res.body.hasMore).toBe(true);
        expect(res.body.nextCursor).not.toBeNull();
    });
});
