import request from 'supertest';
import express from 'express';
import numbering from '../src/routes/orders/numbering';
import prisma from '../src/prismaClient';

// Auth jako user-B (zwykły user).
jest.mock('../src/middleware/auth', () => ({
    requireAuth: (req: any, _res: any, next: any) => {
        if (!req.user) {
            req.user = { id: 'user-B', role: 'user', subUsers: [] };
        }
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

jest.mock('../src/prismaClient', () => ({
    __esModule: true,
    default: {
        users: { findUnique: jest.fn() },
        order_counters: { findUnique: jest.fn(), upsert: jest.fn() },
        settings: { findUnique: jest.fn() },
        recycled_production_numbers: { findMany: jest.fn(), deleteMany: jest.fn() },
        idempotency_keys: {
            create: jest.fn(async ({ data }: any) => {
                const k = data.userId + '|' + data.endpoint + '|' + data.key;
                if (idemStore.has(k)) {
                    const e: any = new Error('Unique constraint');
                    e.code = 'P2002';
                    throw e;
                }
                idemStore.set(k, { ...data, responseStatus: null, responseBody: null });
                return data;
            }),
            findUnique: jest.fn(async ({ where }: any) => {
                const w = where.userId_endpoint_key;
                return idemStore.get(w.userId + '|' + w.endpoint + '|' + w.key) || null;
            }),
            updateMany: jest.fn(async ({ where, data }: any) => {
                let count = 0;
                for (const [k, row] of idemStore) {
                    const match = Object.entries(where).every(([f, v]) => (row as any)[f] === v);
                    if (match) {
                        idemStore.set(k, { ...row, ...data });
                        count++;
                    }
                }
                return { count };
            }),
            deleteMany: jest.fn(async () => ({ count: 0 }))
        },
        $transaction: jest.fn(),
        $queryRaw: jest.fn(),
        $executeRaw: jest.fn()
    }
}));

const idemStore = new Map<string, any>();

describe('P0.2 numbering guard', () => {
    let app: express.Application;

    beforeAll(() => {
        app = express();
        app.use(express.json());
        app.use('/api/numbering', numbering);
    });

    beforeEach(() => {
        jest.clearAllMocks();
        idemStore.clear();
    });

    it('403 przy claim cudzego numeru (user-B vs user-A)', async () => {
        const res = await request(app).post('/api/numbering/claim-number/user-A').send({});
        expect(res.statusCode).toBe(403);
        expect(prisma.order_counters.upsert).not.toHaveBeenCalled();
    });

    it('403 przy podglądzie cudzego next-number', async () => {
        const res = await request(app).get('/api/numbering/next-number/user-A');
        expect(res.statusCode).toBe(403);
        expect(prisma.users.findUnique).not.toHaveBeenCalled();
    });

    it('403 przy claim-production-number cudzego usera', async () => {
        const res = await request(app)
            .post('/api/numbering/claim-production-number/user-A')
            .send({});
        expect(res.statusCode).toBe(403);
    });

    it('403 przy hurtowym claim cudzego usera (licznik nie drgnie)', async () => {
        const res = await request(app)
            .post('/api/numbering/claim-production-numbers/user-A')
            .send({ count: 5 });
        expect(res.statusCode).toBe(403);
    });

    it('200 przy claim własnego numeru (brak drainu self)', async () => {
        (prisma.users.findUnique as jest.Mock).mockResolvedValue({ symbol: 'BB' });
        (prisma.order_counters.upsert as jest.Mock).mockResolvedValue({ lastNumber: 7 });
        const res = await request(app).post('/api/numbering/claim-number/user-B').send({});
        expect(res.statusCode).toBe(200);
        expect(res.body.nextSeq).toBe(7);
        expect(prisma.order_counters.upsert).toHaveBeenCalledTimes(1);
    });

    it('retry tym samym Idempotency-Key zwraca ten sam numer, licznik +1', async () => {
        (prisma.users.findUnique as jest.Mock).mockResolvedValue({ symbol: 'BB' });
        (prisma.order_counters.upsert as jest.Mock).mockResolvedValue({ lastNumber: 7 });
        const first = await request(app)
            .post('/api/numbering/claim-number/user-B')
            .set('Idempotency-Key', 'k-claim-1')
            .send({});
        const second = await request(app)
            .post('/api/numbering/claim-number/user-B')
            .set('Idempotency-Key', 'k-claim-1')
            .send({});
        expect(first.statusCode).toBe(200);
        expect(second.statusCode).toBe(200);
        expect(second.body).toEqual(first.body);
        expect(second.body.nextSeq).toBe(7);
        expect(prisma.order_counters.upsert).toHaveBeenCalledTimes(1);
    });

    it('ten sam klucz + inny payload → 409 IDEMPOTENCY_KEY_REUSE', async () => {
        (prisma.users.findUnique as jest.Mock).mockResolvedValue({ symbol: 'BB' });
        (prisma.order_counters.upsert as jest.Mock).mockResolvedValue({ lastNumber: 7 });
        const first = await request(app)
            .post('/api/numbering/claim-number/user-B')
            .set('Idempotency-Key', 'k-claim-2')
            .send({});
        expect(first.statusCode).toBe(200);
        const retry = await request(app)
            .post('/api/numbering/claim-number/user-B')
            .set('Idempotency-Key', 'k-claim-2')
            .send({ other: 'payload' });
        expect(retry.statusCode).toBe(409);
        expect(retry.body.code).toBe('IDEMPOTENCY_KEY_REUSE');
        expect(prisma.order_counters.upsert).toHaveBeenCalledTimes(1);
    });
});
