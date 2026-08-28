import request from 'supertest';
import express from 'express';
import ruryRoutes from '../../src/routes/orders/ruryOrders.crud';
import studnieRoutes from '../../src/routes/orders/studnieOrders.crud';
import prisma from '../../src/prismaClient';

let currentRole = 'admin';

jest.mock('../../src/middleware/auth', () => ({
    requireAuth: (req: any, _res: any, next: any) => {
        req.user = { id: 'user-id', role: currentRole };
        next();
    }
}));

jest.mock('../../src/utils/logger', () => ({
    logger: {
        info: jest.fn(),
        error: jest.fn(),
        warn: jest.fn(),
        debug: jest.fn()
    }
}));

// Mock wierny semantyce Prisma: $queryRaw (tagged template) dostaje
// (strings[], ...values), a obiekty Sql (sql/join/raw) są inline'owane.
jest.mock('../../src/prismaClient', () => {
    const renderSql = (strings: any, values: any) => {
        if (strings && typeof strings === 'object' && strings.__prismaSql) {
            return strings.render();
        }
        let out = '';
        (strings || []).forEach((s: string, i: number) => {
            out += s;
            if (i < (values || []).length) {
                const v = values[i];
                out += v && typeof v === 'object' && v.__prismaSql ? v.render() : String(v);
            }
        });
        return out;
    };
    const makeSql = (strings: any, values: any) => ({
        __prismaSql: true,
        render: () => renderSql(strings, values)
    });
    const sql = (strings: TemplateStringsArray, ...values: unknown[]) => makeSql(strings, values);
    const queryRawMock = jest.fn() as jest.Mock & { __mockQueries: string[] };
    queryRawMock.__mockQueries = [];
    queryRawMock.mockImplementation((strings: any, ...values: unknown[]) => {
        queryRawMock.__mockQueries.push(renderSql(strings, values));
        return Promise.resolve([]);
    });
    return {
        __esModule: true,
        default: {
            $queryRaw: queryRawMock
        },
        Prisma: {
            raw: (s: string) => makeSql([s], []),
            empty: makeSql([''], []),
            sql,
            join: (vals: unknown[]) =>
                makeSql(['', ...new Array(Math.max(vals.length - 1, 0)).fill(','), ''], vals)
        }
    };
});

jest.mock('../../src/utils/roleFilter', () => {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { Prisma } = require('../../src/prismaClient');
    const fn = (user: any) => {
        if (user.role === 'admin') return Prisma.empty;
        return Prisma.sql`WHERE "userId" = ${user.id}`;
    };
    return {
        buildRoleWhereCondition: fn,
        buildRoleWhereConditionWithShares: fn
    };
});

function createApp() {
    const app = express();
    app.use(express.json());
    app.use('/api/orders-rury', ruryRoutes);
    app.use('/api/orders-studnie', studnieRoutes);
    return app;
}

describe('GET /api/orders-* z opcjonalnym filtrem ids (kartoteka: zamówienia tylko widocznych ofert)', () => {
    let app: express.Application;

    beforeEach(() => {
        (prisma.$queryRaw as jest.Mock & { __mockQueries?: string[] }).__mockQueries = [];
        currentRole = 'admin';
        app = createApp();
    });

    async function dataQuerySql() {
        const raw = prisma.$queryRaw as jest.Mock & { __mockQueries: string[] };
        return raw.__mockQueries.length > 0 ? raw.__mockQueries[0] : '';
    }

    it('rury: bez ids — brak klauzuli IN', async () => {
        await request(app).get('/api/orders-rury').expect(200);
        const sql = await dataQuerySql();
        expect(sql).not.toContain('IN (');
    });

    it('rury: z ids — WHERE "offerId" IN (...)', async () => {
        await request(app).get('/api/orders-rury?ids=o1,o2').expect(200);
        const sql = await dataQuerySql();
        expect(sql).toContain('WHERE "offerId" IN (o1,o2)');
    });

    it('rury: z ids + rola user — rola i IN polaczone AND', async () => {
        currentRole = 'user';
        await request(app).get('/api/orders-rury?ids=o1').expect(200);
        const sql = await dataQuerySql();
        expect(sql).toContain('WHERE "userId" = user-id AND "offerId" IN (o1)');
    });

    it('studnie: z ids — WHERE "offerStudnieId" IN (...)', async () => {
        await request(app).get('/api/orders-studnie?ids=s1,s2,s3').expect(200);
        const sql = await dataQuerySql();
        expect(sql).toContain('WHERE "offerStudnieId" IN (s1,s2,s3)');
    });

    it('rury: lista ids ograniczona do 200', async () => {
        const many = Array.from({ length: 300 }, (_, i) => 'id' + i).join(',');
        await request(app)
            .get('/api/orders-rury?ids=' + many)
            .expect(200);
        const sql = await dataQuerySql();
        const match = sql.match(/IN \(([^)]+)\)/);
        expect(match).toBeTruthy();
        expect(match![1].split(',').length).toBe(200);
    });
});
