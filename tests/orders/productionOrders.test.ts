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
        // P1-A: Idempotency-Key.
        idempotency_keys: {
            create: jest.fn(),
            findUnique: jest.fn(),
            updateMany: jest.fn(),
            deleteMany: jest.fn()
        },
        $queryRaw: jest.fn(),
        $executeRaw: jest.fn().mockResolvedValue(1),
        $executeRawUnsafe: jest.fn().mockResolvedValue(1),
        // P0-C: PUT batch działa w $transaction — tx deleguje do tych samych mocków.
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
    app.use('/api/orders/production', productionRouter);
    return app;
}

beforeEach(() => {
    jest.resetAllMocks();
    mockUser.id = 'user-id';
    mockUser.role = 'user';
    mockUser.subUsers = [];
    (prisma.$transaction as jest.Mock).mockImplementation(async (fn: any) => fn(prisma));
});

describe('Production Orders (PZ) routes', () => {
    let app: express.Application;

    beforeEach(() => {
        app = createApp();
    });

    describe('POST / (create)', () => {
        it('tworzy nowe PZ i zwraca id', async () => {
            (prisma.production_orders_rel.findUnique as jest.Mock).mockResolvedValue(null);
            (prisma.production_orders_rel.create as jest.Mock).mockResolvedValue({});

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
            expect(prisma.production_orders_rel.create).toHaveBeenCalled();
        });

        it('zwraca 400 przy braku wellId (walidacja productionOrderCreateSchema)', async () => {
            const res = await request(app)
                .post('/api/orders/production')
                .set('x-user-id', 'user-id')
                .send({ orderId: 'o-1' });

            expect(res.statusCode).toBe(400);
        });

        it('pozwala zapisać PZ dla innego użytkownika (model współpracy)', async () => {
            (prisma.production_orders_rel.findUnique as jest.Mock).mockResolvedValue(null);
            (prisma.production_orders_rel.create as jest.Mock).mockResolvedValue({});

            const res = await request(app)
                .post('/api/orders/production')
                .set('x-user-id', 'user-id')
                .send({ wellId: 'w-1', userId: 'other-user' });

            expect(res.statusCode).toBe(200);
            expect(prisma.production_orders_rel.create).toHaveBeenCalled();
        });

        it('P1-A: retry z tym samym Idempotency-Key → ta sama odpowiedź, 1 dokument', async () => {
            const keys: Record<string, any> = {};
            (prisma.idempotency_keys.create as jest.Mock).mockImplementation(
                async ({ data }: any) => {
                    const k = `${data.userId}|${data.endpoint}|${data.key}`;
                    if (keys[k]) {
                        const e: any = new Error('Unique constraint failed');
                        e.code = 'P2002';
                        throw e;
                    }
                    keys[k] = { ...data };
                    return keys[k];
                }
            );
            (prisma.idempotency_keys.findUnique as jest.Mock).mockImplementation(
                async ({ where }: any) => {
                    const w = where.userId_endpoint_key;
                    return keys[`${w.userId}|${w.endpoint}|${w.key}`] || null;
                }
            );
            (prisma.idempotency_keys.updateMany as jest.Mock).mockImplementation(
                async ({ where, data }: any) => {
                    // P1-A: updateMany bierze skalary (compound-unique tylko w findUnique).
                    const k = `${where.userId}|${where.endpoint}|${where.key}`;
                    if (!keys[k]) return { count: 0 };
                    if (where.status && keys[k].status !== where.status) return { count: 0 };
                    Object.assign(keys[k], data);
                    return { count: 1 };
                }
            );
            (prisma.production_orders_rel.findUnique as jest.Mock).mockResolvedValue(null);
            (prisma.production_orders_rel.create as jest.Mock).mockResolvedValue({});

            const send = () =>
                request(app)
                    .post('/api/orders/production')
                    .set('x-user-id', 'user-id')
                    .set('Idempotency-Key', 'key-123')
                    .send({ wellId: 'w-1', productionOrderNumber: 'AB/PZ/000001/26' });
            const first = await send();
            const second = await send();
            expect(first.statusCode).toBe(200);
            expect(second.statusCode).toBe(200);
            expect(second.body).toEqual(first.body);
            expect(prisma.production_orders_rel.create).toHaveBeenCalledTimes(1);
        });

        it('P1-A: ten sam klucz + inny payload → 409 IDEMPOTENCY_KEY_REUSE', async () => {
            const keys: Record<string, any> = {
                'user-id|POST /api/orders-studnie/production|key-abc': {
                    status: 'DONE',
                    requestHash: 'other-hash',
                    responseStatus: 200,
                    responseBody: JSON.stringify({ ok: true })
                }
            };
            (prisma.idempotency_keys.create as jest.Mock).mockImplementation(async () => {
                const e: any = new Error('Unique constraint failed');
                e.code = 'P2002';
                throw e;
            });
            (prisma.idempotency_keys.findUnique as jest.Mock).mockImplementation(
                async ({ where }: any) => {
                    const w = where.userId_endpoint_key;
                    return keys[`${w.userId}|${w.endpoint}|${w.key}`] || null;
                }
            );

            const res = await request(app)
                .post('/api/orders/production')
                .set('x-user-id', 'user-id')
                .set('Idempotency-Key', 'key-abc')
                .send({ wellId: 'w-9' });

            expect(res.statusCode).toBe(409);
            expect(res.body.code).toBe('IDEMPOTENCY_KEY_REUSE');
        });
    });

    describe('PUT / (batch)', () => {
        it('tworzy/aktualizuje batch PZ', async () => {
            (prisma.production_orders_rel.findUnique as jest.Mock).mockResolvedValue(null);
            (prisma.production_orders_rel.create as jest.Mock).mockResolvedValue({});

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
            expect(prisma.production_orders_rel.create).toHaveBeenCalledTimes(2);
        });

        it('pozwala edytować cudze PZ (model współpracy)', async () => {
            (prisma.production_orders_rel.findUnique as jest.Mock).mockResolvedValue({
                id: 'pz-1',
                userId: 'other-user',
                data: '{}'
            });
            (prisma.production_orders_rel.updateMany as jest.Mock).mockResolvedValue({
                count: 1
            });

            const res = await request(app)
                .put('/api/orders/production')
                .set('x-user-id', 'user-id')
                .send({ data: [{ id: 'pz-1', wellId: 'w-1', status: 'draft' }] });

            expect(res.statusCode).toBe(200);
        });

        it('PUT PZ honoruje zmianę opiekuna, bez userId zostawia starą kolumnę', async () => {
            (prisma.production_orders_rel.findUnique as jest.Mock).mockResolvedValue({
                id: 'pz-1',
                userId: 'other-user',
                data: '{}'
            });
            (prisma.production_orders_rel.update as jest.Mock).mockResolvedValue({});

            const res = await request(app)
                .put('/api/orders/production')
                .set('x-user-id', 'user-id')
                .send({
                    data: [{ id: 'pz-1', wellId: 'w-1', userId: 'third-user', status: 'draft' }]
                });

            expect(res.statusCode).toBe(200);
            const updateCall = (prisma.production_orders_rel.update as jest.Mock).mock.calls[0][0];
            expect(updateCall.data.userId).toBe('third-user');
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

        it('accepted między check a tx → skipped, nic nie usunięte (P0-E)', async () => {
            (prisma.production_orders_rel.findMany as jest.Mock)
                .mockResolvedValueOnce([
                    {
                        id: 'pz-race',
                        userId: 'user-id',
                        data: JSON.stringify({ status: 'draft' })
                    }
                ])
                .mockResolvedValue([
                    {
                        id: 'pz-race',
                        userId: 'user-id',
                        data: JSON.stringify({ status: 'accepted' })
                    }
                ]);
            (prisma.production_orders_rel.deleteMany as jest.Mock).mockResolvedValue({ count: 0 });

            const res = await request(app)
                .post('/api/orders/production/batch-delete')
                .set('x-user-id', 'user-id')
                .send({ ids: ['pz-race'] });

            expect(res.statusCode).toBe(200);
            expect(res.body).toEqual({ deleted: 0, skipped: 1 });
            expect(prisma.production_orders_rel.deleteMany).not.toHaveBeenCalled();
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
