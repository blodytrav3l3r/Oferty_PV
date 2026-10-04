/**
 * productsV2 — kontrakt tras cennika rur (mock Prisma; bez DB).
 * GET live / 422 na obce source / PATCH pusty → 400 / PUT zła cena → 400 bez tx.
 */
import express from 'express';
import request from 'supertest';
import productsRouter from '../src/routes/productsV2';

jest.mock('../src/middleware/auth', () => ({
    requireAuth: (req: any, _res: any, next: any) => {
        req.user = { id: 'admin1', role: 'admin' };
        next();
    },
    requireAdmin: (_req: any, _res: any, next: any) => next()
}));

jest.mock('../src/middleware/rateLimiters', () => ({
    PRICELIST_WRITE_LIMITER: (_req: unknown, _res: unknown, next: () => void) => next()
}));

jest.mock('../src/utils/logger', () => ({
    logger: { info: jest.fn(), error: jest.fn(), warn: jest.fn(), debug: jest.fn() }
}));

const prismaMock = {
    productsRury: {
        findMany: jest.fn(),
        deleteMany: jest.fn(),
        createMany: jest.fn(),
        update: jest.fn()
    },
    productsRuryDefault: { findMany: jest.fn() },
    $transaction: jest.fn(async (ops: Promise<unknown>[]) => Promise.all(ops))
};

jest.mock('../src/prismaClient', () => ({
    __esModule: true,
    default: {
        get productsRury() {
            return prismaMock.productsRury;
        },
        get productsRuryDefault() {
            return prismaMock.productsRuryDefault;
        },
        $transaction: (...args: unknown[]) => (prismaMock.$transaction as any)(...args)
    }
}));

function app() {
    const a = express();
    a.use(express.json());
    a.use('/', productsRouter);
    return a;
}

beforeEach(() => jest.clearAllMocks());

describe('productsV2', () => {
    it('GET / zwraca listę live', async () => {
        prismaMock.productsRury.findMany.mockResolvedValue([{ id: 'r1', price: 10 }]);
        const res = await request(app()).get('/');
        expect(res.status).toBe(200);
        expect(res.body).toEqual({ data: [{ id: 'r1', price: 10 }] });
    });

    it('GET /?source=hack → 422 z kodem (nie 400)', async () => {
        const res = await request(app()).get('/?source=hack');
        expect(res.status).toBe(422);
        expect(res.body.code).toBe('INVALID_SOURCE');
    });

    it('PATCH /:id z pustym body → 400', async () => {
        const res = await request(app()).patch('/r1').send({});
        expect(res.status).toBe(400);
        expect(res.body.error).toBe('Brak pól do aktualizacji');
        expect(prismaMock.productsRury.update).not.toHaveBeenCalled();
    });

    it('PUT / z nie-liczbową ceną → 400 przed transakcją (D-FIX-2)', async () => {
        const res = await request(app())
            .put('/')
            .send({ data: [{ id: 'r1', name: 'Rura', price: 'za darmo' }] });
        expect(res.status).toBe(400);
        expect(prismaMock.$transaction).not.toHaveBeenCalled();
    });

    it('PUT / poprawny → ok z liczbą', async () => {
        const res = await request(app())
            .put('/')
            .send({ data: [{ id: 'r1', name: 'Rura', price: 12.5 }] });
        expect(res.status).toBe(200);
        expect(res.body).toEqual({ ok: true, count: 1 });
        expect(prismaMock.$transaction).toHaveBeenCalledTimes(1);
    });
});
