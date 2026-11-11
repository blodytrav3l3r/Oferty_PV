import request from 'supertest';
import express from 'express';

const queryRaw = jest.fn();
const authState: { user: Record<string, unknown> | null } = { user: null };

jest.mock('../../src/prismaClient', () => {
    const { Prisma } = jest.requireActual('../../generated/prisma-postgres/client');
    return {
        __esModule: true,
        default: {
            $queryRaw: (...args: unknown[]) => queryRaw(...args)
        },
        Prisma
    };
});

jest.mock('../../src/middleware/auth', () => ({
    requireAuth: (req: any, _res: any, next: any) => {
        if (authState.user) req.user = authState.user;
        next();
    }
}));

jest.mock('../../src/utils/logger', () => ({
    logger: { info: jest.fn(), error: jest.fn(), warn: jest.fn(), debug: jest.fn() }
}));

import productionSearchRouter from '../../src/routes/orders/productionSearch';
import { logger } from '../../src/utils/logger';
import { searchCache } from '../../src/utils/searchCache';

const app = express();
app.use('/production-search', productionSearchRouter);

const baseRow = (overrides: Record<string, unknown> = {}) => ({
    id: 'po-1',
    userId: 'user-id',
    orderId: 'order-1',
    wellId: 'well-1',
    elementIndex: 0,
    elementKey: 'elem-1',
    data: JSON.stringify({ productionOrderNumber: 'PZ/2026/01/0001', status: 'draft' }),
    createdAt: '2026-01-02 10:00:00',
    updatedAt: '2026-01-02 11:00:00',
    handlerFirstName: 'Jan',
    handlerLastName: 'Kowalski',
    handlerUsername: 'jkowalski',
    creatorFirstName: null,
    creatorLastName: null,
    creatorUsername: 'creator',
    dbSalesOrderNumber: 'ZAM/2026/01/0007',
    dbSalesOrderId: 'order-1',
    ...overrides
});

const statsRow = { total: 3, accepted: 1, draft: 2, today: 1 };

/** SQL przekazany do $queryRaw jako tekst — do asercji kształtu WHERE. */
function sqlText(call: unknown[]): string {
    const sql = call[0] as { strings?: string[]; values?: unknown[] };
    if (!sql?.strings) return String(sql);
    return sql.strings.join(' ? ');
}

beforeEach(() => {
    searchCache.invalidateAll();
    queryRaw.mockReset();
    (logger.error as jest.Mock).mockClear();
    authState.user = { id: 'user-id', role: 'user', subUsers: [] };
});

describe('GET /production-search', () => {
    it('zwraca 401, gdy middleware nie ustawił użytkownika', async () => {
        authState.user = null;
        const res = await request(app).get('/production-search');
        expect(res.status).toBe(401);
        expect(res.body).toEqual({ error: 'Unauthorized' });
        expect(queryRaw).not.toHaveBeenCalled();
    });

    it('zwraca listę z mapowaniem wierszy i statystykami', async () => {
        queryRaw.mockResolvedValueOnce([baseRow()]).mockResolvedValueOnce([statsRow]);

        const res = await request(app).get('/production-search');

        expect(res.status).toBe(200);
        expect(res.body.hasMore).toBe(false);
        expect(res.body.nextCursor).toBeNull();
        expect(res.body.nextCursorId).toBeNull();
        expect(res.body.stats).toEqual({ total: 3, accepted: 1, draft: 2, today: 1 });
        expect(res.body.totalCount).toBe(3);
        expect(res.body.data).toHaveLength(1);
        expect(res.body.data[0]).toMatchObject({
            id: 'po-1',
            type: 'production_order',
            productionOrderNumber: 'PZ/2026/01/0001',
            handlerName: 'Jan Kowalski',
            creatorName: 'creator',
            dbSalesOrderNumber: 'ZAM/2026/01/0007'
        });
        expect(queryRaw).toHaveBeenCalledTimes(2);
    });

    it('kursor: pomija agregaty (jedno zapytanie) i zwraca totalCount null', async () => {
        queryRaw.mockResolvedValueOnce([baseRow()]);

        const res = await request(app).get(
            '/production-search?cursor=2026-01-02T10%3A00%3A00Z&cursorId=po-1'
        );

        expect(res.status).toBe(200);
        expect(queryRaw).toHaveBeenCalledTimes(1);
        expect(res.body.totalCount).toBeNull();
        expect(res.body.stats).toBeNull();
    });

    it('hasMore + sort=createdAt: kolejny kursor z createdAt i id ostatniego wiersza', async () => {
        queryRaw
            .mockResolvedValueOnce([baseRow({ id: 'po-1' }), baseRow({ id: 'po-2' })])
            .mockResolvedValueOnce([statsRow]);

        const res = await request(app).get('/production-search?limit=1');

        expect(res.body.hasMore).toBe(true);
        expect(res.body.data).toHaveLength(1);
        expect(res.body.nextCursor).toBe('2026-01-02 10:00:00');
        expect(res.body.nextCursorId).toBe('po-1');
    });

    it('hasMore + sort=productionOrderNumber: kursor z numeru zlecenia', async () => {
        queryRaw
            .mockResolvedValueOnce([
                baseRow({ data: JSON.stringify({ productionOrderNumber: 'PZ/7' }) }),
                baseRow({ id: 'po-2' })
            ])
            .mockResolvedValueOnce([statsRow]);

        const res = await request(app).get(
            '/production-search?limit=1&sort=productionOrderNumber&order=asc'
        );

        expect(res.body.hasMore).toBe(true);
        expect(res.body.nextCursor).toBe('PZ/7');
        expect(res.body.nextCursorId).toBe('po-1');
        expect(sqlText(queryRaw.mock.calls[0])).toContain('ASC');
    });

    it('hasMore + sort=updatedAt: kursor z updatedAt, fallback na createdAt', async () => {
        queryRaw
            .mockResolvedValueOnce([
                baseRow({ id: 'po-1', updatedAt: '2026-01-03 08:00:00' }),
                baseRow({ id: 'po-2' })
            ])
            .mockResolvedValueOnce([statsRow]);

        const withUpdated = await request(app).get('/production-search?limit=1&sort=updatedAt');
        expect(withUpdated.body.hasMore).toBe(true);
        expect(withUpdated.body.nextCursor).toBe('2026-01-03 08:00:00');

        searchCache.invalidateAll();
        queryRaw.mockReset();
        queryRaw
            .mockResolvedValueOnce([
                baseRow({ id: 'po-1', updatedAt: null }),
                baseRow({ id: 'po-2', updatedAt: null })
            ])
            .mockResolvedValueOnce([statsRow]);

        const fallback = await request(app).get('/production-search?limit=1&sort=updatedAt');
        expect(fallback.body.data).toHaveLength(1);
        expect(fallback.body.hasMore).toBe(true);
        expect(fallback.body.nextCursor).toBe('2026-01-02 10:00:00');
    });

    it('limit jest przycinany do 500', async () => {
        queryRaw.mockResolvedValueOnce([]).mockResolvedValueOnce([statsRow]);

        await request(app).get('/production-search?limit=99999');

        const values = (queryRaw.mock.calls[0][0] as { values: unknown[] }).values;
        expect(values[values.length - 1]).toBe(501);
    });

    it('rola user zawęża zapytanie, admin nie', async () => {
        queryRaw.mockResolvedValueOnce([]).mockResolvedValueOnce([statsRow]);
        await request(app).get('/production-search?status=draft');
        const userSql = sqlText(queryRaw.mock.calls[0]);
        expect(userSql).toContain('production_orders_rel');

        searchCache.invalidateAll();
        queryRaw.mockReset();
        authState.user = { id: 'admin-id', role: 'admin', subUsers: [] };
        queryRaw.mockResolvedValueOnce([]).mockResolvedValueOnce([statsRow]);
        await request(app).get('/production-search?status=draft');
        const adminSql = sqlText(queryRaw.mock.calls[0]);

        expect(userSql).not.toBe(adminSql);
        expect(adminSql).not.toContain('"production_orders_rel"."userId" =');
    });

    it('drugi identyczny request korzysta z cache (bez nowych zapytań)', async () => {
        queryRaw.mockResolvedValueOnce([baseRow()]).mockResolvedValueOnce([statsRow]);

        await request(app).get('/production-search?q=studnia');
        const second = await request(app).get('/production-search?q=studnia');

        expect(second.status).toBe(200);
        expect(second.body.data).toHaveLength(1);
        expect(queryRaw).toHaveBeenCalledTimes(2);
    });

    it('błąd zapytania: 500, komunikat bez detali i wpis w loggerze', async () => {
        queryRaw.mockRejectedValueOnce(new Error('boom'));

        const res = await request(app).get('/production-search');

        expect(res.status).toBe(500);
        expect(res.body).toEqual({ error: 'Wewnętrzny błąd serwera' });
        expect(logger.error).toHaveBeenCalledWith('ProductionSearch', 'Błąd serwera', 'boom');
    });
});
