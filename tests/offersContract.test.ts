import express from 'express';
import cookieParser from 'cookie-parser';
import request from 'supertest';
import ruryRouter from '../src/routes/offers/ruryCrud';
import { hashToken } from '../src/middleware/auth';

jest.mock('../src/prismaClient', () => ({
    __esModule: true,
    default: {
        sessions: { findUnique: jest.fn() },
        users: { findUnique: jest.fn() },
        offers_rel: { findMany: jest.fn() },
        offer_items_rel: { deleteMany: jest.fn(), createMany: jest.fn() },
        $transaction: jest.fn(),
        $executeRaw: jest.fn(),
        $queryRaw: jest.fn()
    }
}));

jest.mock('../src/middleware/rateLimiters', () => ({
    WRITE_LIMITER: (_req: unknown, _res: unknown, next: () => void) => next()
}));

jest.mock('../src/utils/fts5Sync', () => ({
    syncFts5: jest.fn(async () => true)
}));

jest.mock('../src/utils/logger', () => ({
    logger: { info: jest.fn(), error: jest.fn(), warn: jest.fn(), debug: jest.fn() }
}));

// eslint-disable-next-line @typescript-eslint/no-require-imports
const prismaMock = require('../src/prismaClient').default;

const USER_ROW = {
    id: 'u1',
    username: 'jan',
    role: 'user',
    firstName: 'Jan',
    lastName: 'Kowalski',
    email: null,
    subUsers: '[]'
};

function buildApp() {
    const app = express();
    app.use(cookieParser());
    app.use(express.json());
    app.use('/', ruryRouter);
    return app;
}

const authMocks = () =>
    prismaMock.sessions.findUnique.mockResolvedValue({
        token: hashToken('sess-u1'),
        userId: 'u1',
        createdAt: BigInt(Date.now())
    }) && prismaMock.users.findUnique.mockResolvedValue(USER_ROW);

function txMocks(updateCount: number) {
    const tx = {
        offers_rel: { updateMany: jest.fn(async () => ({ count: updateCount })) },
        offer_items_rel: {
            deleteMany: jest.fn(async () => ({})),
            createMany: jest.fn(async () => ({}))
        }
    };
    prismaMock.$transaction.mockImplementation(async (cb: (tx: unknown) => unknown) => cb(tx));
    return tx;
}

const validDoc = (over: Record<string, unknown> = {}) => ({
    id: 'o1',
    clientId: 'c1',
    items: [{ productId: 'p1', quantity: 2 }],
    version: 1,
    ...over
});

beforeEach(() => {
    jest.clearAllMocks();
});

/**
 * P1.1: kontrakt PUT /api/offers-rury (batch).
 * 200 valid / 400 invalid / 401 unauth / 403 cudzy dokument / 409 stale version.
 */
describe('P1.1 offers-rury contract', () => {
    it('valid update własnego dokumentu -> 200 {ok:true}', async () => {
        authMocks();
        prismaMock.offers_rel.findMany.mockResolvedValue([{ id: 'o1', userId: 'u1', version: 1 }]);
        txMocks(1);
        const res = await request(buildApp())
            .put('/')
            .set('Cookie', 'authToken=sess-u1')
            .send({ data: [validDoc()] });
        expect(res.status).toBe(200);
        expect(res.body.ok).toBe(true);
    });

    it('invalid body (ujemna ilość) -> 400', async () => {
        authMocks();
        const res = await request(buildApp())
            .put('/')
            .set('Cookie', 'authToken=sess-u1')
            .send({ data: [{ id: 'o1', items: [{ productId: 'p1', quantity: -5 }] }] });
        expect(res.status).toBe(400);
    });

    it('brak sesji -> 401', async () => {
        prismaMock.sessions.findUnique.mockResolvedValue(null);
        const res = await request(buildApp())
            .put('/')
            .send({ data: [validDoc()] });
        expect(res.status).toBe(401);
    });

    it('cudzy dokument -> 403', async () => {
        authMocks();
        prismaMock.offers_rel.findMany.mockResolvedValue([{ id: 'o1', userId: 'u2', version: 1 }]);
        const res = await request(buildApp())
            .put('/')
            .set('Cookie', 'authToken=sess-u1')
            .send({ data: [validDoc()] });
        expect(res.status).toBe(403);
    });

    it('stale version -> 409 VERSION_CONFLICT', async () => {
        authMocks();
        prismaMock.offers_rel.findMany.mockResolvedValue([{ id: 'o1', userId: 'u1', version: 2 }]);
        txMocks(0);
        const res = await request(buildApp())
            .put('/')
            .set('Cookie', 'authToken=sess-u1')
            .send({ data: [validDoc({ version: 1 })] });
        expect(res.status).toBe(409);
        expect(res.body.code).toBe('VERSION_CONFLICT');
        expect(res.body.serverVersion).toBe(2);
    });
});
