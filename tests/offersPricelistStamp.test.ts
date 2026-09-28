import express from 'express';
import cookieParser from 'cookie-parser';
import request from 'supertest';
import ruryRouter from '../src/routes/offers/ruryCrud';
import studnieRouter from '../src/routes/offers/studnieCrud';
import { hashToken } from '../src/middleware/auth';
import { resolveActive, resolveVersionIdSafe } from '../src/services/pricelistVersionService';

jest.mock('../src/prismaClient', () => ({
    __esModule: true,
    default: {
        sessions: { findUnique: jest.fn() },
        users: { findUnique: jest.fn() },
        offers_rel: { findMany: jest.fn(), findUnique: jest.fn() },
        offers_studnie_rel: { findMany: jest.fn() },
        offer_items_rel: { findMany: jest.fn(), deleteMany: jest.fn(), createMany: jest.fn() },
        $transaction: jest.fn(),
        $executeRaw: jest.fn(),
        $queryRaw: jest.fn(async () => [])
    },
    // studnieCrud buduje raw query przez Prisma.join/sql (mock $queryRaw zwraca []).
    Prisma: {
        join: jest.fn((v: unknown) => v),
        sql: jest.fn((parts: unknown) => parts),
        empty: {},
        raw: jest.fn((s: unknown) => s)
    }
}));

jest.mock('../src/middleware/rateLimiters', () => ({
    WRITE_LIMITER: (_req: unknown, _res: unknown, next: () => void) => next()
}));

jest.mock('../src/utils/fts5Sync', () => ({
    syncFts5: jest.fn(async () => true),
    removeFts5: jest.fn(async () => true)
}));

jest.mock('../src/utils/logger', () => ({
    logger: { info: jest.fn(), error: jest.fn(), warn: jest.fn(), debug: jest.fn() }
}));

jest.mock('../src/services/pricelistVersionService', () => ({
    resolveActive: jest.fn(),
    resolveVersionIdSafe: jest.fn(async () => null)
}));

// eslint-disable-next-line @typescript-eslint/no-require-imports
const prismaMock = require('../src/prismaClient').default;
const resolveActiveMock = resolveActive as jest.Mock;
const resolveVersionIdSafeMock = resolveVersionIdSafe as jest.Mock;

const USER_ROW = {
    id: 'u1',
    username: 'jan',
    role: 'user',
    firstName: 'Jan',
    lastName: 'Kowalski',
    email: null,
    subUsers: '[]'
};

function buildApp(router: express.Router) {
    const app = express();
    app.use(cookieParser());
    app.use(express.json());
    app.use('/', router);
    return app;
}

const ruryApp = () => buildApp(ruryRouter);
const studnieApp = () => buildApp(studnieRouter);
const COOKIE = 'authToken=sess-u1';

const authMocks = () =>
    prismaMock.sessions.findUnique.mockResolvedValue({
        token: hashToken('sess-u1'),
        userId: 'u1',
        createdAt: BigInt(Date.now())
    }) && prismaMock.users.findUnique.mockResolvedValue(USER_ROW);

function txCapture() {
    const updates: Array<Record<string, unknown>> = [];
    const tx = {
        offers_rel: {
            updateMany: jest.fn(async (args: { data: Record<string, unknown> }) => {
                updates.push(args.data);
                return { count: 1 };
            })
        },
        offers_studnie_rel: {
            updateMany: jest.fn(async (args: { data: Record<string, unknown> }) => {
                updates.push(args.data);
                return { count: 1 };
            })
        },
        offer_items_rel: {
            deleteMany: jest.fn(async () => ({})),
            createMany: jest.fn(async () => ({}))
        }
    };
    prismaMock.$transaction.mockImplementation(async (cb: (tx: unknown) => unknown) => cb(tx));
    return { tx, updates };
}

const ruryDoc = (over: Record<string, unknown> = {}) => ({
    id: 'o1',
    clientId: 'c1',
    items: [{ productId: 'p1', quantity: 2 }],
    version: 1,
    ...over
});

const studnieDoc = (over: Record<string, unknown> = {}) => ({
    id: 's1',
    clientId: 'c1',
    wells: [{ id: 'w1', dn: 1000 }],
    version: 1,
    ...over
});

beforeEach(() => {
    jest.clearAllMocks();
    resolveVersionIdSafeMock.mockResolvedValue(null);
    resolveActiveMock.mockResolvedValue({ id: 'v-active' });
});

/**
 * Pieczątka oferty po „Przelicz do aktywnego": opcjonalne o.pricelistVersionId
 * w update (POST-upsert i PUT, rury + studnie) — zgodne z ACTIVE przechodzi
 * i stempluje kolumnę, rozjazd to 409 STALE_PRICELIST bez zapisu, brak pola
 * zachowuje starą pieczątkę. Create ignoruje pole.
 */
describe('offers pricelist stamp (rury PUT)', () => {
    it('stamp == ACTIVE przechodzi i stempluje updateData', async () => {
        authMocks();
        prismaMock.offers_rel.findMany.mockResolvedValue([{ id: 'o1', userId: 'u1', version: 1 }]);
        const { updates } = txCapture();
        const res = await request(ruryApp())
            .put('/')
            .set('Cookie', COOKIE)
            .send({ data: [ruryDoc({ pricelistVersionId: 'v-active' })] });
        expect(res.status).toBe(200);
        expect(resolveActiveMock).toHaveBeenCalledWith('rury');
        expect(updates).toHaveLength(1);
        expect(updates[0].pricelistVersionId).toBe('v-active');
    });

    it('stamp != ACTIVE -> 409 STALE_PRICELIST, nic nie ruszone', async () => {
        authMocks();
        prismaMock.offers_rel.findMany.mockResolvedValue([{ id: 'o1', userId: 'u1', version: 1 }]);
        const res = await request(ruryApp())
            .put('/')
            .set('Cookie', COOKIE)
            .send({ data: [ruryDoc({ pricelistVersionId: 'v-stara' })] });
        expect(res.status).toBe(409);
        expect(res.body.code).toBe('STALE_PRICELIST');
        expect(prismaMock.$transaction).not.toHaveBeenCalled();
    });

    it('brak pola -> jak dziś (updateData bez pieczątki)', async () => {
        authMocks();
        prismaMock.offers_rel.findMany.mockResolvedValue([{ id: 'o1', userId: 'u1', version: 1 }]);
        const { updates } = txCapture();
        const res = await request(ruryApp())
            .put('/')
            .set('Cookie', COOKIE)
            .send({ data: [ruryDoc()] });
        expect(res.status).toBe(200);
        expect(resolveActiveMock).not.toHaveBeenCalled();
        expect(updates).toHaveLength(1);
        expect(updates[0]).not.toHaveProperty('pricelistVersionId');
    });
});

describe('offers pricelist stamp (studnie PUT)', () => {
    it('stamp == ACTIVE przechodzi i stempluje update', async () => {
        authMocks();
        prismaMock.offers_studnie_rel.findMany.mockResolvedValue([
            { id: 's1', userId: 'u1', data: '{}', wellCount: 1, totalPrice: 10, version: 1 }
        ]);
        const { updates } = txCapture();
        const res = await request(studnieApp())
            .put('/studnie')
            .set('Cookie', COOKIE)
            .send({ data: [studnieDoc({ pricelistVersionId: 'v-active' })] });
        expect(res.status).toBe(200);
        expect(resolveActiveMock).toHaveBeenCalledWith('studnie');
        expect(updates).toHaveLength(1);
        expect(updates[0].pricelistVersionId).toBe('v-active');
    });

    it('stamp != ACTIVE -> 409 STALE_PRICELIST, nic nie ruszone', async () => {
        authMocks();
        prismaMock.offers_studnie_rel.findMany.mockResolvedValue([
            { id: 's1', userId: 'u1', data: '{}', wellCount: 1, totalPrice: 10, version: 1 }
        ]);
        const res = await request(studnieApp())
            .put('/studnie')
            .set('Cookie', COOKIE)
            .send({ data: [studnieDoc({ pricelistVersionId: 'v-stara' })] });
        expect(res.status).toBe(409);
        expect(res.body.code).toBe('STALE_PRICELIST');
        expect(prismaMock.$transaction).not.toHaveBeenCalled();
    });

    it('brak pola -> jak dziś (update bez pieczątki)', async () => {
        authMocks();
        prismaMock.offers_studnie_rel.findMany.mockResolvedValue([
            { id: 's1', userId: 'u1', data: '{}', wellCount: 1, totalPrice: 10, version: 1 }
        ]);
        const { updates } = txCapture();
        const res = await request(studnieApp())
            .put('/studnie')
            .set('Cookie', COOKIE)
            .send({ data: [studnieDoc()] });
        expect(res.status).toBe(200);
        expect(resolveActiveMock).not.toHaveBeenCalled();
        expect(updates).toHaveLength(1);
        expect(updates[0]).not.toHaveProperty('pricelistVersionId');
    });
});

describe('offers pricelist stamp (POST-upsert, ścieżka zapisu edytora)', () => {
    it('rury: stamp == ACTIVE stempluje update istniejącego', async () => {
        authMocks();
        prismaMock.offers_rel.findMany.mockResolvedValue([
            { id: 'o1', userId: 'u1', version: 1, pricelistVersionId: 'v-stara', history: '[]' }
        ]);
        prismaMock.offer_items_rel.findMany.mockResolvedValue([]);
        const { updates } = txCapture();
        const res = await request(ruryApp())
            .post('/')
            .set('Cookie', COOKIE)
            .send({ data: [ruryDoc({ pricelistVersionId: 'v-active' })] });
        expect(res.status).toBe(200);
        expect(updates).toHaveLength(1);
        expect(updates[0].pricelistVersionId).toBe('v-active');
    });

    it('rury: stamp != ACTIVE -> 409 STALE_PRICELIST', async () => {
        authMocks();
        prismaMock.offers_rel.findMany.mockResolvedValue([
            { id: 'o1', userId: 'u1', version: 1, pricelistVersionId: 'v-stara', history: '[]' }
        ]);
        prismaMock.offer_items_rel.findMany.mockResolvedValue([]);
        const res = await request(ruryApp())
            .post('/')
            .set('Cookie', COOKIE)
            .send({ data: [ruryDoc({ pricelistVersionId: 'v-stara' })] });
        expect(res.status).toBe(409);
        expect(res.body.code).toBe('STALE_PRICELIST');
        expect(prismaMock.$transaction).not.toHaveBeenCalled();
    });

    it('studnie: stamp == ACTIVE stempluje update istniejącej', async () => {
        authMocks();
        prismaMock.offers_studnie_rel.findMany.mockResolvedValue([
            {
                id: 's1',
                history: '[]',
                data: '{}',
                state: 'draft',
                userId: 'u1',
                version: 1,
                totalPrice: 10,
                pricelistVersionId: 'v-stara'
            }
        ]);
        const { updates } = txCapture();
        const res = await request(studnieApp())
            .post('/studnie')
            .set('Cookie', COOKIE)
            .send({ data: [studnieDoc({ pricelistVersionId: 'v-active' })] });
        expect(res.status).toBe(200);
        expect(updates).toHaveLength(1);
        expect(updates[0].pricelistVersionId).toBe('v-active');
    });

    it('studnie: stamp != ACTIVE -> 409 STALE_PRICELIST', async () => {
        authMocks();
        prismaMock.offers_studnie_rel.findMany.mockResolvedValue([
            {
                id: 's1',
                history: '[]',
                data: '{}',
                state: 'draft',
                userId: 'u1',
                version: 1,
                totalPrice: 10,
                pricelistVersionId: 'v-stara'
            }
        ]);
        const res = await request(studnieApp())
            .post('/studnie')
            .set('Cookie', COOKIE)
            .send({ data: [studnieDoc({ pricelistVersionId: 'v-stara' })] });
        expect(res.status).toBe(409);
        expect(res.body.code).toBe('STALE_PRICELIST');
        expect(prismaMock.$transaction).not.toHaveBeenCalled();
    });
});
