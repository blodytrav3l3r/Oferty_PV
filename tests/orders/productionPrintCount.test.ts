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

describe('Liczniki wydruków (print-count)', () => {
    let app: express.Application;

    beforeEach(() => {
        app = createApp();
    });

    it('single: inkrementuje licznik zlecenia od zera', async () => {
        (prisma.production_orders_rel.findUnique as jest.Mock).mockResolvedValue({
            data: JSON.stringify({ productionOrderNumber: 'PZ/1' }),
            userId: 'user-id',
            version: 1
        });
        (prisma.production_orders_rel.updateMany as jest.Mock).mockResolvedValue({ count: 1 });

        const res = await request(app)
            .post('/api/orders-studnie/production/abc/print-count')
            .send({ kind: 'zlecenie' });

        expect(res.status).toBe(200);
        expect(res.body.printCountZlecenia).toBe(1);
        expect(res.body.printCountEtykieta).toBe(0);
        expect(res.body.printLastZleceniaAt).toBeTruthy();
        expect(Number.isNaN(Date.parse(res.body.printLastZleceniaAt))).toBe(false);
        const written = JSON.parse(
            (prisma.production_orders_rel.updateMany as jest.Mock).mock.calls[0][0].data.data
        );
        expect(written.printCountZlecenia).toBe(1);
        // Oryginalne pola bloba zachowane
        expect(written.productionOrderNumber).toBe('PZ/1');
    });

    it('single: data null i uszkodzony JSON traktowane jak zero', async () => {
        (prisma.production_orders_rel.findUnique as jest.Mock).mockResolvedValue({
            data: null,
            userId: 'user-id',
            version: 1
        });
        (prisma.production_orders_rel.updateMany as jest.Mock).mockResolvedValue({ count: 1 });

        const res = await request(app)
            .post('/api/orders-studnie/production/abc/print-count')
            .send({ kind: 'etykieta' });

        expect(res.status).toBe(200);
        expect(res.body.printCountEtykieta).toBe(1);
    });

    it('single: nieprawidłowy kind → 400', async () => {
        for (const kind of ['foo', 'ZLECENIE', '', undefined]) {
            const res = await request(app)
                .post('/api/orders-studnie/production/abc/print-count')
                .send({ kind });
            expect(res.status).toBe(400);
        }
        expect(prisma.production_orders_rel.findUnique).not.toHaveBeenCalled();
    });

    it('single: cudze zlecenie → 404 (brak wycieku)', async () => {
        (prisma.production_orders_rel.findUnique as jest.Mock).mockResolvedValue({
            data: '{}',
            userId: 'other-user',
            version: 1
        });

        const res = await request(app)
            .post('/api/orders-studnie/production/abc/print-count')
            .send({ kind: 'zlecenie' });

        expect(res.status).toBe(404);
        expect(prisma.production_orders_rel.updateMany).not.toHaveBeenCalled();
    });

    it('single: konflikt wersji po 3 próbach → 409', async () => {
        (prisma.production_orders_rel.findUnique as jest.Mock).mockResolvedValue({
            data: '{}',
            userId: 'user-id',
            version: 7
        });
        (prisma.production_orders_rel.updateMany as jest.Mock).mockResolvedValue({ count: 0 });

        const res = await request(app)
            .post('/api/orders-studnie/production/abc/print-count')
            .send({ kind: 'zlecenie' });

        expect(res.status).toBe(409);
        expect(prisma.production_orders_rel.updateMany).toHaveBeenCalledTimes(3);
    });

    it('single: retry po wyścigu dolicza do świeżej wartości', async () => {
        (prisma.production_orders_rel.findUnique as jest.Mock)
            .mockResolvedValueOnce({ data: '{}', userId: 'user-id', version: 5 })
            .mockResolvedValueOnce({
                data: JSON.stringify({ printCountZlecenia: 4 }),
                userId: 'user-id',
                version: 6
            });
        (prisma.production_orders_rel.updateMany as jest.Mock)
            .mockResolvedValueOnce({ count: 0 })
            .mockResolvedValueOnce({ count: 1 });

        const res = await request(app)
            .post('/api/orders-studnie/production/abc/print-count')
            .send({ kind: 'zlecenie' });

        expect(res.status).toBe(200);
        expect(res.body.printCountZlecenia).toBe(5);
    });

    it('batch: inkrementuje wiele, raportuje failures', async () => {
        (prisma.production_orders_rel.findUnique as jest.Mock).mockImplementation(
            async ({ where }: any) => {
                if (where.id === 'missing') return null;
                return { data: '{}', userId: 'user-id', version: 1 };
            }
        );
        (prisma.production_orders_rel.updateMany as jest.Mock).mockResolvedValue({ count: 1 });

        const res = await request(app)
            .post('/api/orders-studnie/production/print-count-batch')
            .send({ ids: ['a', 'b', 'missing'], kind: 'etykieta' });

        expect(res.status).toBe(200);
        expect(res.body.counts.a.printCountEtykieta).toBe(1);
        expect(res.body.counts.b.printCountEtykieta).toBe(1);
        expect(res.body.failed).toHaveLength(1);
        expect(res.body.failed[0].id).toBe('missing');
    });

    it('batch: walidacja ids i kind', async () => {
        expect(
            (await request(app).post('/api/orders-studnie/production/print-count-batch').send({}))
                .status
        ).toBe(400);
        expect(
            (
                await request(app)
                    .post('/api/orders-studnie/production/print-count-batch')
                    .send({ ids: [], kind: 'zlecenie' })
            ).status
        ).toBe(400);
        expect(
            (
                await request(app)
                    .post('/api/orders-studnie/production/print-count-batch')
                    .send({ ids: new Array(201).fill('x'), kind: 'zlecenie' })
            ).status
        ).toBe(400);
    });
});

describe('PUT preservePrintCounts (chude obiekty nie zerują liczników)', () => {
    let app: express.Application;

    const OLD_BLOB = JSON.stringify({
        productionOrderNumber: 'PZ/1',
        status: 'draft',
        printCountZlecenia: 5,
        printCountEtykieta: 2,
        printLastZleceniaAt: '2026-09-17T10:00:00.000Z',
        printLastEtykietaAt: '2026-09-17T11:00:00.000Z'
    });

    // Chudy obiekt jak z `/index` (modal/accept-flow): bez pól print*, bez version
    const skinny = (extra: Record<string, unknown> = {}) => ({
        id: 'pz-1',
        type: 'production_order',
        userId: 'user-id',
        orderId: 'o-1',
        wellId: 'w-1',
        status: 'draft',
        productionOrderNumber: 'PZ/1',
        ...extra
    });

    beforeEach(() => {
        app = createApp();
        (prisma.production_orders_rel.findUnique as jest.Mock).mockResolvedValue({
            data: OLD_BLOB,
            userId: 'user-id',
            version: 3
        });
        (prisma.production_orders_rel.update as jest.Mock).mockResolvedValue({});
        (prisma.production_orders_rel.updateMany as jest.Mock).mockResolvedValue({ count: 1 });
        (prisma.$transaction as jest.Mock).mockImplementation(async (fn: any) => fn(prisma));
    });

    function writtenBlob() {
        const updateMock = prisma.production_orders_rel.update as jest.Mock;
        const updateManyMock = prisma.production_orders_rel.updateMany as jest.Mock;
        const call = updateMock.mock.calls[0] || updateManyMock.mock.calls[0];
        return JSON.parse(call[0].data.data);
    }

    it('chudy PUT bez version (unconditional) zachowuje liczniki i daty', async () => {
        const res = await request(app)
            .put('/api/orders-studnie/production')
            .send({ data: [skinny()] });

        expect(res.status).toBe(200);
        expect(prisma.production_orders_rel.update).toHaveBeenCalled();
        const written = writtenBlob();
        expect(written.printCountZlecenia).toBe(5);
        expect(written.printCountEtykieta).toBe(2);
        expect(written.printLastZleceniaAt).toBe('2026-09-17T10:00:00.000Z');
        expect(written.printLastEtykietaAt).toBe('2026-09-17T11:00:00.000Z');
        // Reszta bloba z requestu zachowana
        expect(written.status).toBe('draft');
    });

    it('chudy PUT z version (optimistic) zachowuje liczniki', async () => {
        const res = await request(app)
            .put('/api/orders-studnie/production')
            .send({ data: [skinny({ version: 3 })] });

        expect(res.status).toBe(200);
        const updateManyMock = prisma.production_orders_rel.updateMany as jest.Mock;
        expect(updateManyMock).toHaveBeenCalled();
        expect(updateManyMock.mock.calls[0][0].where).toEqual({ id: 'pz-1', version: 3 });
        expect(writtenBlob().printCountZlecenia).toBe(5);
    });

    it('jawna liczba wygrywa (7 nad 5, a 0 nad 5)', async () => {
        let res = await request(app)
            .put('/api/orders-studnie/production')
            .send({ data: [skinny({ printCountZlecenia: 7 })] });
        expect(res.status).toBe(200);
        expect(writtenBlob().printCountZlecenia).toBe(7);

        jest.resetAllMocks();
        (prisma.production_orders_rel.findUnique as jest.Mock).mockResolvedValue({
            data: OLD_BLOB,
            userId: 'user-id',
            version: 3
        });
        (prisma.production_orders_rel.update as jest.Mock).mockResolvedValue({});
        (prisma.$transaction as jest.Mock).mockImplementation(async (fn: any) => fn(prisma));

        res = await request(app)
            .put('/api/orders-studnie/production')
            .send({ data: [skinny({ printCountZlecenia: 0 })] });
        expect(res.status).toBe(200);
        expect(writtenBlob().printCountZlecenia).toBe(0);
    });

    it('zły typ ("7" string) nie nadpisuje starej wartości', async () => {
        const res = await request(app)
            .put('/api/orders-studnie/production')
            .send({ data: [skinny({ printCountZlecenia: '7' })] });

        expect(res.status).toBe(200);
        expect(writtenBlob().printCountZlecenia).toBe(5);
    });

    it('batch mieszany: chudy zachowuje, pełny nadpisuje', async () => {
        (prisma.production_orders_rel.findUnique as jest.Mock).mockImplementation(
            async ({ where }: any) => ({
                data: OLD_BLOB,
                userId: 'user-id',
                version: 3,
                ...(where.id === 'pz-2' ? { data: '{}' } : {})
            })
        );

        const res = await request(app)
            .put('/api/orders-studnie/production')
            .send({
                data: [skinny(), { ...skinny(), id: 'pz-2', printCountZlecenia: 9 }]
            });

        expect(res.status).toBe(200);
        const updateMock = prisma.production_orders_rel.update as jest.Mock;
        expect(updateMock).toHaveBeenCalledTimes(2);
        expect(JSON.parse(updateMock.mock.calls[0][0].data.data).printCountZlecenia).toBe(5);
        expect(JSON.parse(updateMock.mock.calls[1][0].data.data).printCountZlecenia).toBe(9);
    });
});
