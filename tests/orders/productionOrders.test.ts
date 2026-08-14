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
    mockUser.id = 'user-id';
    mockUser.role = 'user';
    mockUser.subUsers = [];
});

describe('Production Orders (PZ) routes', () => {
    let app: express.Application;

    beforeEach(() => {
        app = createApp();
    });

    describe('POST / (create)', () => {
        it('tworzy nowe PZ i zwraca id', async () => {
            (prisma.production_orders_rel.findUnique as jest.Mock).mockResolvedValue(null);
            (prisma.production_orders_rel.upsert as jest.Mock).mockResolvedValue({});

            const res = await request(app)
                .post('/api/orders/production')
                .set('x-user-id', 'user-id')
                .send({
                    wellId: 'w-1',
                    orderId: 'o-1',
                    elementIndex: 2,
                    productionOrderNumber: 'AB/PZ/000001/26'
                });

            expect(res.statusCode).toBe(200);
            expect(res.body.ok).toBe(true);
            expect(res.body.id).toBeTruthy();
            expect(prisma.production_orders_rel.upsert).toHaveBeenCalled();
        });

        it('zwraca 400 przy braku wellId (walidacja productionOrderCreateSchema)', async () => {
            const res = await request(app)
                .post('/api/orders/production')
                .set('x-user-id', 'user-id')
                .send({ orderId: 'o-1' });

            expect(res.statusCode).toBe(400);
        });

        it('zwraca 403 gdy user nie może zapisać dla innego użytkownika', async () => {
            (prisma.production_orders_rel.findUnique as jest.Mock).mockResolvedValue(null);

            const res = await request(app)
                .post('/api/orders/production')
                .set('x-user-id', 'user-id')
                .send({ wellId: 'w-1', userId: 'other-user' });

            expect(res.statusCode).toBe(403);
        });
    });

    describe('PUT / (batch)', () => {
        it('tworzy/aktualizuje batch PZ', async () => {
            (prisma.production_orders_rel.findUnique as jest.Mock).mockResolvedValue(null);
            (prisma.production_orders_rel.upsert as jest.Mock).mockResolvedValue({});

            const res = await request(app)
                .put('/api/orders/production')
                .set('x-user-id', 'user-id')
                .send({
                    data: [
                        { id: 'pz-1', wellId: 'w-1', elementIndex: 0, status: 'draft' },
                        { wellId: 'w-2', elementIndex: 1, status: 'draft' }
                    ]
                });

            expect(res.statusCode).toBe(200);
            expect(res.body.ok).toBe(true);
            expect(prisma.production_orders_rel.upsert).toHaveBeenCalledTimes(2);
        });

        it('zwraca 403 przy edycji cudzego PZ', async () => {
            (prisma.production_orders_rel.findUnique as jest.Mock).mockResolvedValue({
                id: 'pz-1',
                userId: 'other-user',
                data: '{}'
            });

            const res = await request(app)
                .put('/api/orders/production')
                .set('x-user-id', 'user-id')
                .send({ data: [{ id: 'pz-1', wellId: 'w-1', status: 'draft' }] });

            expect(res.statusCode).toBe(403);
        });
    });

    describe('GET /:id', () => {
        it('zwraca 200 dla właściciela', async () => {
            (prisma.production_orders_rel.findUnique as jest.Mock).mockResolvedValue({
                id: 'pz-1',
                userId: 'user-id',
                orderId: 'o-1',
                wellId: 'w-1',
                elementIndex: 0,
                data: JSON.stringify({ status: 'draft', productionOrderNumber: 'AB/PZ/1/26' })
            });

            const res = await request(app).get('/api/orders/production/pz-1');
            expect(res.statusCode).toBe(200);
            expect(res.body.data.id).toBe('pz-1');
            expect(res.body.data.productionOrderNumber).toBe('AB/PZ/1/26');
        });

        it('zwraca 404 dla cudzego PZ', async () => {
            (prisma.production_orders_rel.findUnique as jest.Mock).mockResolvedValue({
                id: 'pz-1',
                userId: 'other-user',
                data: '{}'
            });

            const res = await request(app).get('/api/orders/production/pz-1');
            expect(res.statusCode).toBe(404);
        });
    });

    describe('POST /batch-delete', () => {
        it('odrzuca brak ids (400)', async () => {
            const res = await request(app).post('/api/orders/production/batch-delete').send({});
            expect(res.statusCode).toBe(400);
        });

        it('odrzuca >200 ids (400)', async () => {
            const res = await request(app)
                .post('/api/orders/production/batch-delete')
                .send({ ids: Array.from({ length: 201 }, (_, i) => `pz-${i}`) });
            expect(res.statusCode).toBe(400);
        });

        it('usuwa drafty i pomija accepted', async () => {
            (prisma.production_orders_rel.findMany as jest.Mock).mockResolvedValue([
                {
                    id: 'pz-draft',
                    userId: 'user-id',
                    data: JSON.stringify({ status: 'draft', productionOrderNumber: 'AB/PZ/1/26' })
                },
                {
                    id: 'pz-accepted',
                    userId: 'user-id',
                    data: JSON.stringify({
                        status: 'accepted',
                        productionOrderNumber: 'AB/PZ/2/26'
                    })
                }
            ]);
            (prisma.production_orders_rel.deleteMany as jest.Mock).mockResolvedValue({ count: 1 });

            const res = await request(app)
                .post('/api/orders/production/batch-delete')
                .set('x-user-id', 'user-id')
                .send({ ids: ['pz-draft', 'pz-accepted'] });

            expect(res.statusCode).toBe(200);
            expect(res.body).toEqual({ deleted: 1, skipped: 1 });
        });

        it('zwraca 403 gdy jeden z PZ należy do kogoś innego', async () => {
            (prisma.production_orders_rel.findMany as jest.Mock).mockResolvedValue([
                {
                    id: 'pz-1',
                    userId: 'other-user',
                    data: JSON.stringify({ status: 'draft' })
                }
            ]);

            const res = await request(app)
                .post('/api/orders/production/batch-delete')
                .set('x-user-id', 'user-id')
                .send({ ids: ['pz-1'] });

            expect(res.statusCode).toBe(403);
        });
    });

    describe('DELETE /:id', () => {
        it('usuwa draft PZ przez właściciela', async () => {
            (prisma.production_orders_rel.findUnique as jest.Mock).mockResolvedValue({
                id: 'pz-1',
                userId: 'user-id',
                data: JSON.stringify({ status: 'draft' })
            });
            (prisma.production_orders_rel.deleteMany as jest.Mock).mockResolvedValue({ count: 1 });

            const res = await request(app)
                .delete('/api/orders/production/pz-1')
                .set('x-user-id', 'user-id');

            expect(res.statusCode).toBe(200);
            expect(prisma.production_orders_rel.deleteMany).toHaveBeenCalled();
        });

        it('blokuje usunięcie zatwierdzonego PZ (accepted → 403)', async () => {
            (prisma.production_orders_rel.findUnique as jest.Mock).mockResolvedValue({
                id: 'pz-1',
                userId: 'user-id',
                data: JSON.stringify({ status: 'accepted' })
            });

            const res = await request(app)
                .delete('/api/orders/production/pz-1')
                .set('x-user-id', 'user-id');

            expect(res.statusCode).toBe(403);
            expect(res.body.error).toMatch(/zatwierdzonego zlecenia/);
            expect(prisma.production_orders_rel.deleteMany).not.toHaveBeenCalled();
        });

        it('zwraca 403 przy usuwaniu cudzego PZ', async () => {
            (prisma.production_orders_rel.findUnique as jest.Mock).mockResolvedValue({
                id: 'pz-1',
                userId: 'other-user',
                data: JSON.stringify({ status: 'draft' })
            });

            const res = await request(app)
                .delete('/api/orders/production/pz-1')
                .set('x-user-id', 'user-id');

            expect(res.statusCode).toBe(403);
        });
    });
});
