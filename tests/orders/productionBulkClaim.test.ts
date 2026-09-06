/**
 * Bulk P0: hurtowy claim numerów + recycle + PUT saved[].
 * DoD recenzji: 0 dubli przy równoległych bulkach, claimed = saved + recycled.
 */
import request from 'supertest';
import express from 'express';
import numberingRouter from '../../src/routes/orders/numbering';
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
    Cennik_LIMITER: (_req: any, _res: any, next: any) => next()
}));

jest.mock('../../src/db', () => ({
    logAudit: jest.fn()
}));

jest.mock('../../src/utils/logger', () => ({
    logger: { info: jest.fn(), error: jest.fn(), warn: jest.fn(), debug: jest.fn() }
}));

jest.mock('../../src/utils/searchCache', () => ({
    searchCache: { invalidateAll: jest.fn(), invalidateNamespace: jest.fn() }
}));

jest.mock('../../src/utils/productionSearchUtils', () => ({
    mapProductionOrderRow: (o: any) => o
}));

/* In-memory baza: users / settings / recycled / counters / production_orders_rel */
const store: {
    users: Record<string, { symbol: string; productionOrderStartNumber: number }>;
    settings: Record<string, string>;
    recycled: Array<{ userId: string; year: number; seqNumber: number }>;
    counters: Record<string, number>;
    orders: Record<string, any>;
    failUpsertAfter: number;
    upsertCalls: number;
} = {
    users: {},
    settings: {},
    recycled: [],
    counters: {},
    orders: {},
    failUpsertAfter: -1,
    upsertCalls: 0
};

jest.mock('../../src/prismaClient', () => ({
    __esModule: true,
    default: {
        users: {
            findUnique: jest.fn(async ({ where }: any) => store.users[where.id] || null)
        },
        settings: {
            findUnique: jest.fn(async ({ where }: any) =>
                store.settings[where.key] !== undefined
                    ? { key: where.key, value: store.settings[where.key] }
                    : null
            )
        },
        recycled_production_numbers: {
            findFirst: jest.fn(async ({ where }: any) => {
                const rows = store.recycled
                    .filter((r) => r.userId === where.userId && r.year === where.year)
                    .sort((a, b) => a.seqNumber - b.seqNumber);
                return rows[0] || null;
            }),
            findMany: jest.fn(async ({ where, orderBy, take }: any) => {
                let rows = store.recycled.filter(
                    (r) => r.userId === where.userId && r.year === where.year
                );
                if (orderBy && orderBy.seqNumber === 'asc')
                    rows = rows.sort((a, b) => a.seqNumber - b.seqNumber);
                if (typeof take === 'number') rows = rows.slice(0, take);
                return rows.map((r) => ({ ...r }));
            }),
            delete: jest.fn(async ({ where }: any) => {
                const k = where.userId_year_seqNumber;
                const i = store.recycled.findIndex(
                    (r) => r.userId === k.userId && r.year === k.year && r.seqNumber === k.seqNumber
                );
                if (i < 0) throw new Error('not found');
                store.recycled.splice(i, 1);
                return {};
            }),
            deleteMany: jest.fn(async ({ where }: any) => {
                const before = store.recycled.length;
                store.recycled = store.recycled.filter(
                    (r) =>
                        !(
                            r.userId === where.userId &&
                            r.year === where.year &&
                            (!where.seqNumber?.in || where.seqNumber.in.includes(r.seqNumber))
                        )
                );
                return { count: before - store.recycled.length };
            })
        },
        production_order_counters: {
            findUnique: jest.fn(async ({ where }: any) => {
                const key = where.userId_year.userId + '|' + where.userId_year.year;
                return store.counters[key] === undefined
                    ? null
                    : { lastNumber: store.counters[key] };
            }),
            upsert: jest.fn(async ({ where, create, update }: any) => {
                const k = where.userId_year;
                const key = k.userId + '|' + k.year;
                // Małe opóźnienie, żeby równoległe requesty realnie się przeplotły bez locka.
                await new Promise((r) => setTimeout(r, 5));
                if (store.counters[key] === undefined) {
                    store.counters[key] = create.lastNumber;
                } else if (typeof update.lastNumber === 'number') {
                    store.counters[key] = update.lastNumber;
                } else {
                    store.counters[key] += update.lastNumber.increment;
                }
                return { lastNumber: store.counters[key] };
            })
        },
        production_orders_rel: {
            findUnique: jest.fn(async ({ where }: any) => store.orders[where.id] || null),
            findMany: jest.fn(async () => []),
            upsert: jest.fn(async ({ where, create }: any) => {
                store.upsertCalls++;
                if (store.failUpsertAfter >= 0 && store.upsertCalls > store.failUpsertAfter) {
                    throw new Error('boom');
                }
                store.orders[where.id] = { ...create, id: where.id, userId: create.userId };
                return store.orders[where.id];
            }),
            deleteMany: jest.fn(async () => ({ count: 0 }))
        },
        // P0-B: transakcja interaktywna — brak izolacji między współbieżnymi tx
        // (jak SQLite bez locka aplikacyjnego): findMany z opóźnieniem wymusza
        // przeplot, deleteMany kasuje warunkowo i zwraca realny count.
        // Rollback: undo-log tylko własnych zmian (jak ROLLBACK w DB —
        // nie rusza commitów innych tx).
        $transaction: jest.fn(async (fn: any) => {
            const undo = {
                recycled: [] as any[],
                counters: {} as Record<string, number>,
                orders: {} as Record<string, any>
            };
            const snapCounter = (key: string) => {
                if (!(key in undo.counters)) undo.counters[key] = store.counters[key];
            };
            const snapOrder = (id: string) => {
                if (!(id in undo.orders)) undo.orders[id] = store.orders[id];
            };
            const tx = {
                // P0-C: PUT batch działa na tx.production_orders_rel.
                production_orders_rel: {
                    findUnique: jest.fn(async ({ where }: any) => store.orders[where.id] || null),
                    upsert: jest.fn(async ({ where, create, update }: any) => {
                        store.upsertCalls++;
                        if (
                            store.failUpsertAfter >= 0 &&
                            store.upsertCalls > store.failUpsertAfter
                        ) {
                            throw new Error('boom');
                        }
                        snapOrder(where.id);
                        const prev = store.orders[where.id];
                        const cleanUpdate: any = {};
                        for (const k of Object.keys(update || {}))
                            if (update[k] !== undefined) cleanUpdate[k] = update[k];
                        store.orders[where.id] = {
                            ...(prev || {}),
                            ...(prev ? cleanUpdate : create),
                            id: where.id
                        };
                        return store.orders[where.id];
                    })
                },
                recycled_production_numbers: {
                    findMany: jest.fn(async ({ where, orderBy, take }: any) => {
                        await new Promise((r) => setTimeout(r, 5));
                        let rows = store.recycled.filter(
                            (x) => x.userId === where.userId && x.year === where.year
                        );
                        if (orderBy && orderBy.seqNumber === 'asc')
                            rows = rows.sort((a, b) => a.seqNumber - b.seqNumber);
                        if (typeof take === 'number') rows = rows.slice(0, take);
                        return rows.map((r) => ({ ...r }));
                    }),
                    deleteMany: jest.fn(async ({ where }: any) => {
                        const before = store.recycled.length;
                        const gone = store.recycled.filter(
                            (r) =>
                                r.userId === where.userId &&
                                r.year === where.year &&
                                (!where.seqNumber?.in || where.seqNumber.in.includes(r.seqNumber))
                        );
                        undo.recycled.push(...gone.map((r) => ({ ...r })));
                        store.recycled = store.recycled.filter(
                            (r) =>
                                !(
                                    r.userId === where.userId &&
                                    r.year === where.year &&
                                    (!where.seqNumber?.in ||
                                        where.seqNumber.in.includes(r.seqNumber))
                                )
                        );
                        return { count: before - store.recycled.length };
                    })
                },
                $executeRaw: jest.fn(async (strings: any, ...values: any[]) => {
                    const head: string = strings[0] || '';
                    if (head.includes('INSERT')) {
                        const [userId, year, base] = values;
                        const key = userId + '|' + year;
                        snapCounter(key);
                        if (store.counters[key] === undefined) store.counters[key] = base;
                    } else if (head.includes('UPDATE')) {
                        const [n, userId, year] = values;
                        const key = userId + '|' + year;
                        snapCounter(key);
                        store.counters[key] = (store.counters[key] ?? 0) + n;
                    }
                    return 1;
                }),
                $queryRaw: jest.fn(async (_strings: any, ...values: any[]) => {
                    const [userId, year] = values;
                    return [{ lastNumber: store.counters[userId + '|' + year] ?? 0 }];
                })
            };
            try {
                return await fn(tx);
            } catch (e) {
                for (const r of undo.recycled) {
                    if (
                        !store.recycled.some(
                            (x) =>
                                x.userId === r.userId &&
                                x.year === r.year &&
                                x.seqNumber === r.seqNumber
                        )
                    )
                        store.recycled.push(r);
                }
                for (const k of Object.keys(undo.counters)) {
                    if (undo.counters[k] === undefined) delete store.counters[k];
                    else store.counters[k] = undo.counters[k];
                }
                for (const id of Object.keys(undo.orders)) {
                    if (undo.orders[id] === undefined) delete store.orders[id];
                    else store.orders[id] = undo.orders[id];
                }
                throw e;
            }
        }),
        $queryRaw: jest.fn(async () => []),
        $executeRaw: jest.fn(async () => 1)
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
    app.use('/api/orders-studnie', numberingRouter);
    app.use('/api/orders-studnie/production', productionRouter);
    return app;
}

const YEAR = new Date().getFullYear();

beforeEach(() => {
    store.users = { u1: { symbol: 'T', productionOrderStartNumber: 1 } };
    store.settings = { ['year_letter_' + YEAR]: 'A' };
    store.recycled = [];
    store.counters = {};
    store.orders = {};
    store.failUpsertAfter = -1;
    store.upsertCalls = 0;
});

describe('POST /claim-production-numbers/:userId', () => {
    test('claim 5 → sekwencyjne numery bez dziur', async () => {
        const app = createApp();
        const res = await request(app)
            .post('/api/orders-studnie/claim-production-numbers/u1')
            .send({ count: 5 });
        expect(res.status).toBe(200);
        expect(res.body.numbers).toEqual([
            `T/A/00001/${String(YEAR).slice(-2)}`,
            `T/A/00002/${String(YEAR).slice(-2)}`,
            `T/A/00003/${String(YEAR).slice(-2)}`,
            `T/A/00004/${String(YEAR).slice(-2)}`,
            `T/A/00005/${String(YEAR).slice(-2)}`
        ]);
        expect(res.body.seqs).toEqual([1, 2, 3, 4, 5]);
    });

    test('recycled brane pierwsze, potem licznik (seqs sortowane)', async () => {
        store.recycled = [
            { userId: 'u1', year: YEAR, seqNumber: 7 },
            { userId: 'u1', year: YEAR, seqNumber: 3 }
        ];
        const app = createApp();
        const res = await request(app)
            .post('/api/orders-studnie/claim-production-numbers/u1')
            .send({ count: 3 });
        expect(res.status).toBe(200);
        expect(res.body.seqs).toEqual([1, 3, 7]);
        expect(store.recycled).toEqual([]);
    });

    test('walidacja count: 0 / 201 / brak → 400', async () => {
        const app = createApp();
        for (const body of [{ count: 0 }, { count: 201 }, {}, { count: 1.5 }]) {
            const res = await request(app)
                .post('/api/orders-studnie/claim-production-numbers/u1')
                .send(body);
            expect(res.status).toBe(400);
        }
    });

    test('3 równoległe claimy × 200: zero dubli, zakresy rozłączne, recycled raz', async () => {
        store.recycled = [
            { userId: 'u1', year: YEAR, seqNumber: 9 },
            { userId: 'u1', year: YEAR, seqNumber: 4 }
        ];
        const app = createApp();
        const [a, b, c] = await Promise.all([
            request(app)
                .post('/api/orders-studnie/claim-production-numbers/u1')
                .send({ count: 200 }),
            request(app)
                .post('/api/orders-studnie/claim-production-numbers/u1')
                .send({ count: 200 }),
            request(app)
                .post('/api/orders-studnie/claim-production-numbers/u1')
                .send({ count: 200 })
        ]);
        expect(a.status).toBe(200);
        expect(b.status).toBe(200);
        expect(c.status).toBe(200);
        const all = [...a.body.seqs, ...b.body.seqs, ...c.body.seqs];
        expect(all.length).toBe(600);
        // Zero duplikatów (DoD: 0 duplicate production numbers).
        expect(new Set(all).size).toBe(600);
        // Recycled {4,9} zużyte dokładnie raz + świeże 1..600 z pominięciem {4,9}
        // (deficyt po skipie recycled uzupełnia rezerwacja — count gwarantowany).
        expect(all).toEqual(expect.arrayContaining([4, 9]));
        const fromCounter = all
            .filter((s: number) => s !== 4 && s !== 9)
            .sort((x: number, y: number) => x - y);
        expect(fromCounter).toEqual(
            Array.from({ length: 600 }, (_, i) => i + 1).filter((s) => s !== 4 && s !== 9)
        );
        // Każdy claim posortowany rosnąco.
        for (const r of [a, b, c]) {
            const seqs = r.body.seqs as number[];
            expect(seqs).toEqual([...seqs].sort((x, y) => x - y));
        }
        expect(store.recycled).toEqual([]);
    });

    test('2 równoległe single-claimy na 1 recycled: rozłączne seqi, retry działa', async () => {
        store.recycled = [{ userId: 'u1', year: YEAR, seqNumber: 5 }];
        const app = createApp();
        const [a, b] = await Promise.all([
            request(app).post('/api/orders-studnie/claim-production-number/u1').send({}),
            request(app).post('/api/orders-studnie/claim-production-number/u1').send({})
        ]);
        expect(a.status).toBe(200);
        expect(b.status).toBe(200);
        expect(new Set([a.body.nextSeq, b.body.nextSeq]).size).toBe(2);
        expect([a.body.nextSeq, b.body.nextSeq].sort()).toEqual([1, 5]);
        expect(store.recycled).toEqual([]);
    });
});

describe('PUT /production atomowy (P0-C: całość albo nic)', () => {
    test('sukces → saved ze wszystkimi id', async () => {
        const app = createApp();
        const data = [
            { id: 'a', wellId: 'w1', productionOrderNumber: 'T/A/00001/26' },
            { id: 'b', wellId: 'w1', productionOrderNumber: 'T/A/00002/26' }
        ];
        const res = await request(app).put('/api/orders-studnie/production').send({ data });
        expect(res.status).toBe(200);
        expect(res.body.saved).toEqual(['a', 'b']);
    });

    test('pad drugiego upsertu → 500, saved=[] i NIC nie zapisane (rollback)', async () => {
        store.failUpsertAfter = 1;
        const app = createApp();
        const data = [
            { id: 'a', wellId: 'w1', productionOrderNumber: 'T/A/00001/26' },
            { id: 'b', wellId: 'w1', productionOrderNumber: 'T/A/00002/26' }
        ];
        const res = await request(app).put('/api/orders-studnie/production').send({ data });
        expect(res.status).toBe(500);
        expect(res.body.saved).toEqual([]);
        expect(store.orders).toEqual({});
    });

    test('403 w połowie batcha → 403, saved=[] i NIC nie zapisane', async () => {
        mockUser.id = 'intruz';
        mockUser.role = 'user';
        try {
            const app = createApp();
            // 'cudze' PZ: właściciel 'obcy' — intruz nie ma uprawnień.
            store.orders['cudze'] = { id: 'cudze', userId: 'obcy' };
            const data = [
                { id: 'a', wellId: 'w1' },
                { id: 'cudze', wellId: 'w1' }
            ];
            const res = await request(app).put('/api/orders-studnie/production').send({ data });
            expect(res.status).toBe(403);
            expect(res.body.saved).toEqual([]);
            expect(store.orders['a']).toBeUndefined();
        } finally {
            mockUser.id = 'admin-1';
            mockUser.role = 'admin';
        }
    });
});

describe('POST /production/recycle-numbers', () => {
    test('walidacja: brak userId / puste / >200 → 400', async () => {
        const app = createApp();
        expect(
            (await request(app).post('/api/orders-studnie/production/recycle-numbers').send({}))
                .status
        ).toBe(400);
        expect(
            (
                await request(app)
                    .post('/api/orders-studnie/production/recycle-numbers')
                    .send({ userId: 'u1', seqNumbers: [] })
            ).status
        ).toBe(400);
        expect(
            (
                await request(app)
                    .post('/api/orders-studnie/production/recycle-numbers')
                    .send({
                        userId: 'u1',
                        seqNumbers: Array.from({ length: 201 }, (_, i) => i + 1)
                    })
            ).status
        ).toBe(400);
    });

    test('zwrot numerów → $executeRaw z ON CONFLICT', async () => {
        const prisma = (await import('../../src/prismaClient')).default as any;
        const app = createApp();
        const res = await request(app)
            .post('/api/orders-studnie/production/recycle-numbers')
            .send({ userId: 'u1', seqNumbers: [5, 6, 5, -1, 'x'] });
        expect(res.status).toBe(200);
        expect(res.body).toEqual({ ok: true, returned: 2 });
        expect(prisma.$executeRaw).toHaveBeenCalled();
    });
});
