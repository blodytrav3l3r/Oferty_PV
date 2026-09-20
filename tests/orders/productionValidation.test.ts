/**
 * E3a: walidacja zod 4 endpointów production (batch-delete, recycle-numbers,
 * print-count-batch, :id/print-count). 400 + details dla śmieci, 200 dla
 * poprawnych (opaque id 'pz-1', chunk ≤200, recycle bez year).
 */
import request from 'supertest';
import express from 'express';
import productionRouter from '../../src/routes/orders/production';
import prisma from '../../src/prismaClient';

const mockUser: any = { id: 'user-id', role: 'user', subUsers: [] };

jest.mock('../../src/middleware/auth', () => ({
    requireAuth: (req: any, _res: any, next: any) => {
        req.user = { ...mockUser };
        next();
    }
}));

jest.mock('../../src/middleware/rateLimiters', () => ({
    WRITE_LIMITER: (_req: any, _res: any, next: any) => next(),
    EXPORT_LIMITER: (_req: any, _res: any, next: any) => next(),
    LOGIN_LIMITER: (_req: any, _res: any, next: any) => next(),
    Cennik_LIMITER: (_req: any, _res: any, next: any) => next()
}));

jest.mock('../../src/db', () => ({
    logAudit: jest.fn()
}));

jest.mock('../../src/utils/logger', () => ({
    logger: {
        info: jest.fn(),
        error: jest.fn(),
        warn: jest.fn(),
        debug: jest.fn()
    }
}));

jest.mock('../../src/utils/searchCache', () => ({
    searchCache: {
        invalidateAll: jest.fn(),
        invalidateNamespace: jest.fn()
    }
}));

jest.mock('../../src/utils/productionSearchUtils', () => ({
    mapProductionOrderRow: (o: any) => o
}));

jest.mock('../../src/prismaClient', () => ({
    __esModule: true,
    default: {
        production_orders_rel: {
            findUnique: jest.fn(),
            findMany: jest.fn(),
            upsert: jest.fn(),
            create: jest.fn(),
            update: jest.fn(),
            updateMany: jest.fn(),
            deleteMany: jest.fn()
        },
        idempotency_keys: {
            create: jest.fn(),
            findUnique: jest.fn(),
            updateMany: jest.fn(),
            deleteMany: jest.fn()
        },
        $queryRaw: jest.fn(),
        $executeRaw: jest.fn().mockResolvedValue(1),
        $executeRawUnsafe: jest.fn().mockResolvedValue(1),
        $transaction: jest.fn()
    },
    Prisma: {
        empty: '',
        sql: (strings: any, ...values: any[]): string => String.raw({ raw: strings }, ...values),
        join: (values: any[]): string => values.join(', ')
    }
}));

function createApp() {
    const app = express();
    app.use(express.json());
    app.use('/api/orders-studnie/production', productionRouter);
    return app;
}

beforeEach(() => {
    jest.resetAllMocks();
    mockUser.id = 'user-id';
    mockUser.role = 'user';
    mockUser.subUsers = [];
});

describe('E3a: batch-delete zod', () => {
    it('201 ids → 400 z details', async () => {
        const res = await request(createApp())
            .post('/api/orders-studnie/production/batch-delete')
            .send({ ids: Array.from({ length: 201 }, (_, i) => `pz-${i}`) });
        expect(res.status).toBe(400);
        expect(res.body.details).toBeDefined();
        expect(prisma.production_orders_rel.findMany).not.toHaveBeenCalled();
    });

    it('śmieć w ids (liczba, pusty string) → 400', async () => {
        for (const body of [{ ids: ['pz-1', 123] }, { ids: [''] }, { ids: 'pz-1' }, {}]) {
            const res = await request(createApp())
                .post('/api/orders-studnie/production/batch-delete')
                .send(body);
            expect(res.status).toBe(400);
        }
        expect(prisma.production_orders_rel.findMany).not.toHaveBeenCalled();
    });

    it('opaque id (nie-UUID) przechodzi walidację', async () => {
        (prisma.production_orders_rel.findMany as jest.Mock).mockResolvedValue([]);
        (prisma.$transaction as jest.Mock).mockImplementation(async () => undefined);
        const res = await request(createApp())
            .post('/api/orders-studnie/production/batch-delete')
            .send({ ids: ['pz-1', 'prodorder_123_0_1'] });
        expect(res.status).toBe(200);
        expect(res.body).toEqual({ deleted: 0, skipped: 0 });
    });
});

describe('E3a: print-count zod', () => {
    it('batch: zły kind / 201 ids → 400 z details', async () => {
        for (const body of [
            { ids: ['a'], kind: 'foo' },
            { ids: ['a'] },
            { ids: Array.from({ length: 201 }, (_, i) => `pz-${i}`), kind: 'zlecenie' }
        ]) {
            const res = await request(createApp())
                .post('/api/orders-studnie/production/print-count-batch')
                .send(body);
            expect(res.status).toBe(400);
            expect(res.body.details).toBeDefined();
        }
        expect(prisma.production_orders_rel.findUnique).not.toHaveBeenCalled();
    });

    it('single: zły kind → 400 z details', async () => {
        const res = await request(createApp())
            .post('/api/orders-studnie/production/abc/print-count')
            .send({ kind: 'FOO' });
        expect(res.status).toBe(400);
        expect(res.body.details).toBeDefined();
        expect(prisma.production_orders_rel.findUnique).not.toHaveBeenCalled();
    });
});
