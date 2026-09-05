import request from 'supertest';
import express from 'express';
import studnieOrdersRouter from '../../src/routes/orders/studnieOrders.crud';
import prisma from '../../src/prismaClient';

const mockUser: any = { id: 'user-id', role: 'user', subUsers: [] };

jest.mock('../../src/middleware/auth', () => ({
    requireAuth: (req: any, _res: any, next: any) => {
        req.user = { ...mockUser };
        next();
    }
}));

jest.mock('../../src/middleware/rateLimiters', () => ({
    WRITE_LIMITER: (_req: any, _res: any, next: any) => next()
}));

jest.mock('../../src/services/auditService', () => ({
    logAudit: jest.fn()
}));

jest.mock('../../src/utils/logger', () => ({
    logger: { info: jest.fn(), error: jest.fn(), warn: jest.fn(), debug: jest.fn() }
}));

jest.mock('../../src/utils/searchCache', () => ({
    searchCache: { invalidateAll: jest.fn(), invalidateNamespace: jest.fn() }
}));

jest.mock('../../src/prismaClient', () => ({
    __esModule: true,
    default: {
        orders_studnie_rel: {
            findUnique: jest.fn(),
            upsert: jest.fn(),
            update: jest.fn()
        },
        $queryRaw: jest.fn()
    },
    Prisma: {
        empty: '',
        sql: (strings: any, ...values: any[]): string => String.raw({ raw: strings }, ...values),
        join: (values: any[]): string => values.join(', ')
    }
}));

const mockedPrisma = prisma as unknown as {
    orders_studnie_rel: {
        findUnique: jest.Mock;
        upsert: jest.Mock;
        update: jest.Mock;
    };
};

function createApp() {
    const app = express();
    app.use(express.json());
    app.use('/api/orders-studnie', studnieOrdersRouter);
    return app;
}

beforeEach(() => {
    jest.resetAllMocks();
});

describe('P1 HIGH — single-order save + optimistic concurrency', () => {
    test('PUT create (brak rekordu) przechodzi bez baseUpdatedAt', async () => {
        mockedPrisma.orders_studnie_rel.findUnique.mockResolvedValue(null);
        const res = await request(createApp())
            .put('/api/orders-studnie')
            .send({ data: [{ id: 'o-new', wells: [], updatedAt: 't1' }] });
        expect(res.status).toBe(200);
        expect(res.body).toEqual({ ok: true });
        expect(mockedPrisma.orders_studnie_rel.upsert).toHaveBeenCalledTimes(1);
    });

    test('PUT single ze zgodnym baseUpdatedAt przechodzi', async () => {
        mockedPrisma.orders_studnie_rel.findUnique.mockResolvedValue({
            data: JSON.stringify({ updatedAt: 'srv-t' }),
            userId: 'user-id'
        });
        const res = await request(createApp())
            .put('/api/orders-studnie')
            .send({ data: [{ id: 'o1', wells: [], updatedAt: 'srv-t' }], baseUpdatedAt: 'srv-t' });
        expect(res.status).toBe(200);
    });

    test('PUT single z niezgodnym baseUpdatedAt → 409 + serverOrder', async () => {
        mockedPrisma.orders_studnie_rel.findUnique.mockResolvedValue({
            data: JSON.stringify({ updatedAt: 'srv-t', wells: [{ id: 'w1' }] }),
            userId: 'user-id'
        });
        const res = await request(createApp())
            .put('/api/orders-studnie')
            .send({ data: [{ id: 'o1', wells: [], updatedAt: 'old-t' }], baseUpdatedAt: 'old-t' });
        expect(res.status).toBe(409);
        expect(res.body.serverOrder.updatedAt).toBe('srv-t');
        expect(mockedPrisma.orders_studnie_rel.upsert).not.toHaveBeenCalled();
    });

    test('PATCH ze zgodnym baseUpdatedAt scala i NIE zapisuje baseUpdatedAt', async () => {
        mockedPrisma.orders_studnie_rel.findUnique.mockResolvedValue({
            id: 'o1',
            userId: 'user-id',
            status: 'new',
            data: JSON.stringify({ updatedAt: 'srv-t', wells: [] })
        });
        const res = await request(createApp())
            .patch('/api/orders-studnie/o1')
            .send({ wells: [{ id: 'w1' }], updatedAt: 'new-t', baseUpdatedAt: 'srv-t' });
        expect(res.status).toBe(200);
        const savedData = JSON.parse(
            mockedPrisma.orders_studnie_rel.update.mock.calls[0][0].data.data
        );
        expect(savedData).not.toHaveProperty('baseUpdatedAt');
        expect(savedData.wells).toEqual([{ id: 'w1' }]);
    });

    test('PATCH z niezgodnym baseUpdatedAt → 409 + serverOrder', async () => {
        mockedPrisma.orders_studnie_rel.findUnique.mockResolvedValue({
            id: 'o1',
            userId: 'user-id',
            status: 'new',
            data: JSON.stringify({ updatedAt: 'srv-t', wells: [{ id: 'w1' }] })
        });
        const res = await request(createApp())
            .patch('/api/orders-studnie/o1')
            .send({ wells: [], updatedAt: 'old-t', baseUpdatedAt: 'old-t' });
        expect(res.status).toBe(409);
        expect(res.body.serverOrder.wells).toEqual([{ id: 'w1' }]);
        expect(mockedPrisma.orders_studnie_rel.update).not.toHaveBeenCalled();
    });
});
