/**
 * P0.3: batch-read w PUT batch + hurtowy recycle w batch-delete.
 * Cel: brak pętli await N×findUnique / N×$executeRaw.
 * - PUT batch N elementów: DOKŁADNIE 1 findMany, 0 findUnique (PRZED: N findUnique).
 * - batch-delete N id: DOKŁADNIE 1 $executeRaw recycle (PRZED: N $executeRaw).
 * - Semantyka błędów bez zmian: 403 cudze PZ, 409 konflikt wersji,
 *   nieznane id w batch-delete pomijane bez błędu (200, deleted 0).
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
        // PUT batch i batch-delete działają w $transaction — tx to te same mocki.
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

describe('P0.3 batch-read (PUT batch)', () => {
    it('batch 5 elementów: 1× findMany + 0× findUnique (PRZED: 5× findUnique)', async () => {
        const app = createApp();
        (prisma.production_orders_rel.findMany as jest.Mock).mockImplementation(
            async ({ where }: any) =>
                (where?.id?.in ?? [])
                    .filter((id: string) => id === 'pz-1' || id === 'pz-2')
                    .map((id: string) => ({
                        id,
                        userId: 'user-id',
                        version: 1,
                        data: JSON.stringify({ status: 'draft' })
                    }))
        );
        (prisma.production_orders_rel.create as jest.Mock).mockResolvedValue({});
        (prisma.production_orders_rel.updateMany as jest.Mock).mockResolvedValue({ count: 1 });

        const res = await request(app)
            .put('/api/orders/production')
            .send({
                data: [
                    { id: 'pz-1', wellId: 'w-1', elementIndex: 0, version: 1, status: 'draft' },
                    { id: 'pz-2', wellId: 'w-1', elementIndex: 1, version: 1, status: 'draft' },
                    { id: 'pz-3', wellId: 'w-1', elementIndex: 2, status: 'draft' },
                    { id: 'pz-4', wellId: 'w-1', elementIndex: 3, status: 'draft' },
                    { id: 'pz-5', wellId: 'w-1', elementIndex: 4, status: 'draft' }
                ]
            });

        expect(res.statusCode).toBe(200);
        expect(res.body.ok).toBe(true);
        // Kolejność saved = kolejność wejścia (efekty uboczne stabilne).
        expect(res.body.saved.map((s: any) => s.id)).toEqual([
            'pz-1',
            'pz-2',
            'pz-3',
            'pz-4',
            'pz-5'
        ]);
        expect(prisma.production_orders_rel.findMany).toHaveBeenCalledTimes(1);
        expect(prisma.production_orders_rel.findUnique).not.toHaveBeenCalled();
        expect(prisma.production_orders_rel.create).toHaveBeenCalledTimes(3);
        expect(prisma.production_orders_rel.updateMany).toHaveBeenCalledTimes(2);
    });

    it('403 dla cudzego PZ w batchu (semantyka zachowana)', async () => {
        const app = createApp();
        (prisma.production_orders_rel.findMany as jest.Mock).mockResolvedValue([
            { id: 'pz-1', userId: 'other-user', version: 1, data: '{}' }
        ]);

        const res = await request(app)
            .put('/api/orders/production')
            .send({ data: [{ id: 'pz-1', wellId: 'w-1', status: 'draft' }] });

        expect(res.statusCode).toBe(403);
        expect(res.body.saved).toEqual([]);
        expect(prisma.production_orders_rel.create).not.toHaveBeenCalled();
        expect(prisma.production_orders_rel.updateMany).not.toHaveBeenCalled();
    });

    it('409 przy stalej wersji (semantyka zachowana)', async () => {
        const app = createApp();
        (prisma.production_orders_rel.findMany as jest.Mock).mockResolvedValue([
            { id: 'pz-1', userId: 'user-id', version: 7, data: '{}' }
        ]);
        (prisma.production_orders_rel.updateMany as jest.Mock).mockResolvedValue({ count: 0 });

        const res = await request(app)
            .put('/api/orders/production')
            .send({ data: [{ id: 'pz-1', wellId: 'w-1', version: 6, status: 'draft' }] });

        expect(res.statusCode).toBe(409);
        expect(res.body.code).toBe('VERSION_CONFLICT');
        expect(res.body.serverVersion).toBe(7);
        expect(res.body.saved).toEqual([]);
    });
});

describe('P0.3 hurtowy recycle (batch-delete)', () => {
    function draftRow(id: string, seq: string) {
        return {
            id,
            userId: 'user-id',
            data: JSON.stringify({ status: 'draft', productionOrderNumber: `XX/PZ/${seq}/26` })
        };
    }

    it('kasowanie 3 id: 1× $executeRaw recycle (PRZED: 3× $executeRaw)', async () => {
        const app = createApp();
        const rows = [
            draftRow('pz-a', '00001'),
            draftRow('pz-b', '00002'),
            draftRow('pz-c', '00003')
        ];
        (prisma.production_orders_rel.findMany as jest.Mock).mockResolvedValue(rows);
        (prisma.production_orders_rel.deleteMany as jest.Mock).mockResolvedValue({ count: 3 });

        const res = await request(app)
            .post('/api/orders/production/batch-delete')
            .send({ ids: ['pz-a', 'pz-b', 'pz-c'] });

        expect(res.statusCode).toBe(200);
        expect(res.body).toEqual({ deleted: 3, skipped: 0 });
        expect(prisma.production_orders_rel.deleteMany).toHaveBeenCalledTimes(1);
        // Jeden hurtowy INSERT zamiast pętli recycle-per-id.
        expect(prisma.$executeRaw).toHaveBeenCalledTimes(1);
    });

    it('nieznane id pomijane bez błędu (200, deleted 0, brak recycle)', async () => {
        const app = createApp();
        (prisma.production_orders_rel.findMany as jest.Mock).mockResolvedValue([]);
        (prisma.production_orders_rel.deleteMany as jest.Mock).mockResolvedValue({ count: 0 });

        const res = await request(app)
            .post('/api/orders/production/batch-delete')
            .send({ ids: ['pz-ghost'] });

        expect(res.statusCode).toBe(200);
        expect(res.body).toEqual({ deleted: 0, skipped: 0 });
        expect(prisma.production_orders_rel.deleteMany).not.toHaveBeenCalled();
        expect(prisma.$executeRaw).not.toHaveBeenCalled();
    });
});
