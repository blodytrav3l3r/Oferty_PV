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
    const sql = (strings: TemplateStringsArray, ...values: unknown[]): string => {
        let out = '';
        strings.forEach((s, i) => {
            out += s;
            if (i < values.length) {
                const v = values[i];
                out += typeof v === 'object' && v !== null ? String(v) : String(v);
            }
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

describe('Wyszukiwarka ofert â€” filtr typu (rury vs studnie)', () => {
    let app: express.Application;

    beforeEach(() => {
        jest.resetAllMocks();
        (prisma.$queryRaw as jest.Mock).mockResolvedValue([]);
        app = createApp();
    });

    async function dataQuerySql() {
        const calls = (prisma.$queryRaw as jest.Mock).mock.calls;
        // Pierwsze wywołanie $queryRaw to query danych (ma ORDER BY), drugie to COUNT
        const first = calls.find((c) => String(c[0]).includes('ORDER BY'));
        return first ? String(first[0]) : '';
    }

    async function countQuerySql() {
        const calls = (prisma.$queryRaw as jest.Mock).mock.calls;
        // COUNT nie ma ORDER BY — identyfikujemy po SELECT COUNT
        const count = calls.find((c) => String(c[0]).includes('SELECT COUNT'));
        return count ? String(count[0]) : '';
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
});
