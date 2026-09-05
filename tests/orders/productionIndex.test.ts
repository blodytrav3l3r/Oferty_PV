import request from 'supertest';
import express from 'express';
import productionRouter from '../../src/routes/orders/production';
import prisma from '../../src/prismaClient';
import { searchCache } from '../../src/utils/searchCache';

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
        get: jest.fn(() => null),
        set: jest.fn(),
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
            deleteMany: jest.fn()
        },
        $queryRaw: jest.fn(),
        $executeRaw: jest.fn().mockResolvedValue(1),
        $executeRawUnsafe: jest.fn().mockResolvedValue(1)
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
    app.use('/api/orders/production', productionRouter);
    return app;
}

beforeEach(() => {
    jest.resetAllMocks();
    (searchCache.get as jest.Mock).mockReturnValue(null);
    mockUser.id = 'user-id';
    mockUser.role = 'user';
    mockUser.subUsers = [];
});

describe('GET /index (lekki indeks PZ)', () => {
    it('zwraca wiersze bez ciezkiej kolumny data', async () => {
        (prisma.$queryRaw as jest.Mock).mockResolvedValue([
            {
                id: 'pz-1',
                userId: 'user-id',
                orderId: 'o-1',
                wellId: 'w-1',
                elementIndex: 2,
                elementKey: 'ek-1',
                createdAt: '2026-09-01',
                updatedAt: '2026-09-02',
                status: 'draft',
                productionOrderNumber: 'AB/PZ/000001/26',
                offerId: 'of-1'
            }
        ]);
        const res = await request(createApp()).get('/api/orders/production/index');
        expect(res.status).toBe(200);
        expect(res.body.data).toHaveLength(1);
        const row = res.body.data[0];
        expect(row).toMatchObject({
            id: 'pz-1',
            wellId: 'w-1',
            orderId: 'o-1',
            elementIndex: 2,
            elementKey: 'ek-1',
            status: 'draft',
            productionOrderNumber: 'AB/PZ/000001/26',
            offerId: 'of-1'
        });
        expect(row).not.toHaveProperty('data');
        expect(searchCache.set as jest.Mock).toHaveBeenCalled();
    });

    it('zwraca cache bez pytania bazy', async () => {
        (searchCache.get as jest.Mock).mockReturnValue({ data: [{ id: 'cached' }] });
        const res = await request(createApp()).get('/api/orders/production/index');
        expect(res.status).toBe(200);
        expect(res.body.data).toEqual([{ id: 'cached' }]);
        expect(prisma.$queryRaw as jest.Mock).not.toHaveBeenCalled();
    });

    it('nie wpada w /:id (index przed parametrem)', async () => {
        (prisma.$queryRaw as jest.Mock).mockResolvedValue([]);
        const res = await request(createApp()).get('/api/orders/production/index');
        expect(res.status).toBe(200);
        expect(res.body).toHaveProperty('data');
    });
});
