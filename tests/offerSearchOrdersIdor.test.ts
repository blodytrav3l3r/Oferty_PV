import request from 'supertest';
import express from 'express';
import searchRoutes from '../src/routes/offers/search';
import prisma from '../src/prismaClient';

const mockUser: any = { id: 'user-id', role: 'user', subUsers: [] };

jest.mock('../src/middleware/auth', () => ({
    requireAuth: (req: any, _res: any, next: any) => {
        req.user = { ...mockUser };
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

jest.mock('../src/utils/roleFilter', () => ({
    buildRoleWhereCondition: jest.fn()
}));

import { buildRoleWhereCondition } from '../src/utils/roleFilter';

function setRoleSql(sql: string) {
    (buildRoleWhereCondition as jest.Mock).mockReturnValue(sql);
}

jest.mock('../src/prismaClient', () => {
    const sql = (strings: TemplateStringsArray, ...values: unknown[]): string => {
        let out = '';
        strings.forEach((s, i) => {
            out += s;
            if (i < values.length) {
                out += String(values[i]);
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

describe('GET /api/offers/search/orders — autoryzacja (IDOR A-03)', () => {
    let app: express.Application;

    beforeEach(() => {
        jest.resetAllMocks();
        mockUser.id = 'user-id';
        mockUser.role = 'user';
        mockUser.subUsers = [];
        setRoleSql('');
        (prisma.$queryRaw as jest.Mock).mockResolvedValue([]);
        app = createApp();
    });

    async function ordersSql() {
        const calls = (prisma.$queryRaw as jest.Mock).mock.calls;
        return calls.length > 0 ? String(calls[0][0]) : '';
    }

    it('zwraca 400 przy braku id', async () => {
        const res = await request(app).get('/api/offers/search/orders?type=rury');
        expect(res.statusCode).toBe(400);
    });

    it('zwraca 400 przy nieprawidłowym typie', async () => {
        const res = await request(app).get('/api/offers/search/orders?id=off-1&type=bad');
        expect(res.statusCode).toBe(400);
    });

    it('regularny user: filtr userId jest dodawany do zapytania', async () => {
        setRoleSql('WHERE "userId" = user-id');
        await request(app).get('/api/offers/search/orders?id=off-1&type=rury');

        const sql = await ordersSql();
        expect(sql).toContain('orders_rury_rel');
        expect(sql).toContain('offerId');
        expect(sql).toContain('"userId"');
        expect(sql).toContain('user-id');
    });

    it('pro: filtr IN (id + subUsers) jest dodawany do zapytania', async () => {
        mockUser.role = 'pro';
        mockUser.subUsers = ['sub-1', 'sub-2'];
        setRoleSql('WHERE "userId" IN (sub-1, sub-2)');

        await request(app).get('/api/offers/search/orders?id=off-1&type=studnie');

        const sql = await ordersSql();
        expect(sql).toContain('orders_studnie_rel');
        expect(sql).toContain('"userId"');
        expect(sql).toContain('sub-1');
        expect(sql).toContain('sub-2');
    });

    it('admin: brak filtra userId w zapytaniu (widzi wszystko)', async () => {
        mockUser.role = 'admin';

        await request(app).get('/api/offers/search/orders?id=off-1&type=rury');

        const sql = await ordersSql();
        expect(sql).toContain('offerId');
        expect(sql).not.toContain('"userId"');
    });
});
