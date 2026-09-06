/**
 * P0-A: UNIQUE(userId, productionNumber) jako ostatnia linia obrony.
 * Dubel finalnego numeru -> 409 PRODUCTION_NUMBER_CONFLICT (P2002 safety net),
 * inny user + ten sam numer -> OK, update bez numeru nie kasuje kolumny.
 */
import request from 'supertest';
import express from 'express';
import productionRouter from '../../src/routes/orders/production';

const mockUser: any = { id: 'admin-1', role: 'admin', subUsers: [] };

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
    writeProductionLimiter: (_req: any, _res: any, next: any) => next()
}));

jest.mock('../../src/db', () => ({
    logAudit: jest.fn()
}));

jest.mock('../../src/utils/logger', () => ({
    logger: { info: jest.fn(), error: jest.fn(), warn: jest.fn(), debug: jest.fn() }
}));

jest.mock('../../src/utils/searchCache', () => ({
    searchCache: {
        invalidateAll: jest.fn(),
        invalidateNamespace: jest.fn(),
        get: jest.fn(),
        set: jest.fn()
    }
}));

jest.mock('../../src/utils/productionSearchUtils', () => ({
    mapProductionOrderRow: (o: any) => o
}));

/* In-memory store z egzekwowanym UNIQUE(userId, productionNumber) jak w DB. */
const store: { orders: Record<string, any>; lastUpdate: any } = { orders: {}, lastUpdate: null };

function p2002(): any {
    const e: any = new Error('Unique constraint failed');
    e.code = 'P2002';
    return e;
}

/* Wspólny zapis z wiernym UNIQUE + increment, jak Prisma. */
function applyUpdate(id: string, data: any) {
    const prev = store.orders[id] || {};
    const next: any = { ...prev };
    for (const k of Object.keys(data || {})) {
        const v = data[k];
        if (v === undefined) continue;
        next[k] =
            typeof v === 'object' && v !== null && 'increment' in v
                ? (next[k] ?? 0) + v.increment
                : v;
    }
    const clash = Object.values(store.orders).find(
        (o: any) =>
            o.id !== id &&
            o.userId === next.userId &&
            next.productionNumber != null &&
            o.productionNumber === next.productionNumber
    );
    if (clash) throw p2002();
    store.lastUpdate = data;
    store.orders[id] = { ...next, id };
}

jest.mock('../../src/prismaClient', () => {
    const mocked: any = {
        production_orders_rel: {
            findUnique: jest.fn(async ({ where }: any) => store.orders[where.id] || null),
            findMany: jest.fn(async () => []),
            // P0-A: wierny UNIQUE(userId, productionNumber); P0-D: predykat wersji.
            create: jest.fn(async ({ data }: any) => {
                const clash = Object.values(store.orders).find(
                    (o: any) =>
                        o.userId === data.userId &&
                        data.productionNumber != null &&
                        o.productionNumber === data.productionNumber
                );
                if (clash) throw p2002();
                store.orders[data.id] = { ...data };
                return store.orders[data.id];
            }),
            update: jest.fn(async ({ where, data }: any) => {
                applyUpdate(where.id, data);
                return store.orders[where.id];
            }),
            updateMany: jest.fn(async ({ where, data }: any) => {
                const prev = store.orders[where.id];
                if (!prev) return { count: 0 };
                if (where.version !== undefined && prev.version !== where.version)
                    return { count: 0 };
                applyUpdate(where.id, data);
                return { count: 1 };
            }),
            upsert: jest.fn(async () => {
                throw new Error('upsert nieużywany po P0-D');
            }),
            deleteMany: jest.fn(async () => ({ count: 0 }))
        },
        $queryRaw: jest.fn(async () => []),
        $executeRaw: jest.fn(async () => 1)
    };
    // P0-C: PUT batch działa w $transaction — tx deleguje do tych samych mocków.
    mocked.$transaction = jest.fn(async (fn: any) => fn(mocked));
    return {
        __esModule: true,
        default: mocked,
        Prisma: {
            empty: '',
            sql: (strings: any, ...values: any[]): string =>
                String.raw({ raw: strings }, ...values),
            join: (values: any[]): string => values.join(', ')
        }
    };
});

function createApp() {
    const app = express();
    app.use(express.json());
    app.use('/api/orders-studnie/production', productionRouter);
    return app;
}

beforeEach(() => {
    store.orders = {};
    store.lastUpdate = null;
});

describe('P0-A UNIQUE productionNumber', () => {
    test('dubel numeru tego samego usera -> 409 PRODUCTION_NUMBER_CONFLICT', async () => {
        const app = createApp();
        const body = { wellId: 'w1', productionOrderNumber: 'T/A/00001/26' };
        const first = await request(app).post('/api/orders-studnie/production/').send(body);
        expect(first.status).toBe(200);
        const second = await request(app).post('/api/orders-studnie/production/').send(body);
        expect(second.status).toBe(409);
        expect(second.body.code).toBe('PRODUCTION_NUMBER_CONFLICT');
    });

    test('ten sam numer u innego usera -> OK', async () => {
        const app = createApp();
        const first = await request(app)
            .post('/api/orders-studnie/production/')
            .send({ wellId: 'w1', userId: 'u1', productionOrderNumber: 'T/A/00001/26' });
        expect(first.status).toBe(200);
        const second = await request(app)
            .post('/api/orders-studnie/production/')
            .send({ wellId: 'w1', userId: 'u2', productionOrderNumber: 'T/A/00001/26' });
        expect(second.status).toBe(200);
    });

    test('update bez numeru nie kasuje kolumny (undefined pomijane)', async () => {
        const app = createApp();
        const created = await request(app)
            .post('/api/orders-studnie/production/')
            .send({ wellId: 'w1', productionOrderNumber: 'T/A/00001/26' });
        const id = created.body.id;
        const updated = await request(app)
            .post('/api/orders-studnie/production/')
            .send({ id, wellId: 'w1' });
        expect(updated.status).toBe(200);
        expect(store.lastUpdate.productionNumber).toBeUndefined();
        expect(store.orders[id].productionNumber).toBe('T/A/00001/26');
    });

    test('PUT batch zapisuje numer do kolumny', async () => {
        const app = createApp();
        const res = await request(app)
            .put('/api/orders-studnie/production/')
            .send({ data: [{ wellId: 'w1', productionOrderNumber: 'T/A/00002/26' }] });
        expect(res.status).toBe(200);
        const saved = Object.values(store.orders)[0] as any;
        expect(saved.productionNumber).toBe('T/A/00002/26');
    });
});
