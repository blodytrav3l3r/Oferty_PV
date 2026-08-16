/*
 * tests/studnieOrdersError.test.ts
 * A-22: GET /:id zamówienia studni — wewnętrzny błąd zwraca 500 z logiem
 * (nie cichy 404 silent fail).
 */
import request from 'supertest';
import express from 'express';
import studnieOrdersRouter from '../src/routes/orders/studnieOrders.crud';

let currentUser = { id: 'user1', role: 'user' as const, subUsers: [] as string[] };

jest.mock('../src/middleware/auth', () => ({
    requireAuth: (req: any, _res: any, next: any) => {
        req.user = { ...currentUser };
        next();
    }
}));

jest.mock('../src/middleware/rateLimiters', () => ({
    WRITE_LIMITER: (_req: any, _res: any, next: any) => next()
}));

jest.mock('../src/services/auditService', () => ({
    logAudit: jest.fn()
}));

const loggerError = jest.fn();
jest.mock('../src/utils/logger', () => ({
    logger: {
        info: jest.fn(),
        error: (...args: unknown[]) => loggerError(...args),
        warn: jest.fn(),
        debug: jest.fn()
    }
}));

jest.mock('../src/utils/ownership', () => ({
    canReadDoc: jest.fn().mockReturnValue(true),
    canWriteDoc: jest.fn().mockReturnValue(true)
}));

jest.mock('../src/utils/roleFilter', () => ({
    buildRoleWhereCondition: jest.fn().mockReturnValue({})
}));

jest.mock('../src/utils/searchCache', () => ({
    searchCache: { invalidate: jest.fn() }
}));

jest.mock('../src/utils/productionOrderGuard', () => ({
    countProductionOrdersForOrder: jest.fn().mockResolvedValue(0)
}));

jest.mock('../src/prismaClient', () => ({
    __esModule: true,
    default: {
        orders_studnie_rel: {
            findUnique: jest.fn(),
            findMany: jest.fn(),
            upsert: jest.fn(),
            create: jest.fn(),
            update: jest.fn(),
            delete: jest.fn(),
            deleteMany: jest.fn(),
            count: jest.fn()
        },
        users: { findUnique: jest.fn() }
    }
}));

import prisma from '../src/prismaClient';

describe('A-22: GET /:id zamówienia studni — brak silent fail', () => {
    it('zwraca 500 z logiem błędu zamiast cichego 404', async () => {
        (prisma.orders_studnie_rel.findUnique as jest.Mock).mockRejectedValue(new Error('boom db'));
        loggerError.mockClear();

        const app = express();
        app.use('/api/orders-studnie', studnieOrdersRouter);
        const res = await request(app).get('/api/orders-studnie/order-1').set('x-user-id', 'user1');

        expect(res.statusCode).toBe(500);
        expect(res.body.error).toBe('Wewnętrzny błąd serwera');
        expect(loggerError).toHaveBeenCalledWith('StudnieOrdersV2', 'GET order error', 'boom db');
    });

    it('zwraca 404 gdy zamówienie nie istnieje (normalna ścieżka)', async () => {
        (prisma.orders_studnie_rel.findUnique as jest.Mock).mockResolvedValue(null);

        const app = express();
        app.use('/api/orders-studnie', studnieOrdersRouter);
        const res = await request(app)
            .get('/api/orders-studnie/order-null')
            .set('x-user-id', 'user1');

        expect(res.statusCode).toBe(404);
    });
});
