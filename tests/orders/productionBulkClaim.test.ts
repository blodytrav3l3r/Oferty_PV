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
    users: Record<string, { id?: string; symbol: string; productionOrderStartNumber: number }>;
    settings: Record<string, string>;
    recycled: Array<{ userId: string; year: number; seqNumber: number }>;
    claims: Array<{ userId: string; year: number; seqNumber: number }>;
    counters: Record<string, number>;
    orders: Record<string, any>;
    lastSql: string;
    failUpsertAfter: number;
    upsertCalls: number;
} = {
    users: {},
    settings: {},
    recycled: [],
    claims: [],
    counters: {},
    orders: {},
    lastSql: '',
    failUpsertAfter: -1,
    upsertCalls: 0
};
const recycledClaimLocks = new Map<string, Promise<void>>();

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
        recycled_production_numbers_global: {
            findMany: jest.fn(async ({ where, orderBy, take }: any) => {
                let rows = store.recycled.filter(
                    (r) =>
                        r.year === where.year &&
                        (!where.userId || r.userId === where.userId) &&
                        (!where.seqNumber?.in || where.seqNumber.in.includes(r.seqNumber))
                );
                if (orderBy && orderBy.seqNumber === 'asc')
                    rows = rows.sort((a, b) => a.seqNumber - b.seqNumber);
                if (typeof take === 'number') rows = rows.slice(0, take);
                return rows.map((r) => ({ ...r }));
            }),
            deleteMany: jest.fn(async ({ where }: any) => {
                const before = store.recycled.length;
                store.recycled = store.recycled.filter(
                    (r) =>
                        !(
                            r.year === where.year &&
                            (!where.seqNumber?.in || where.seqNumber.in.includes(r.seqNumber))
                        )
                );
                return { count: before - store.recycled.length };
            })
        },
        production_global_order_counters: {
            findUnique: jest.fn(async ({ where }: any) => {
                const value = store.counters[String(where.year)];
                return value === undefined ? null : { year: where.year, lastNumber: value };
            })
        },
        production_global_number_claims: {
            findUnique: jest.fn(
                async ({ where }: any) =>
                    store.claims.find(
                        (claim) =>
                            claim.year === where.year_seqNumber.year &&
                            claim.seqNumber === where.year_seqNumber.seqNumber
                    ) || null
            )
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
        // (bez locka aplikacyjnego): findMany z opóźnieniem wymusza
        // przeplot, deleteMany kasuje warunkowo i zwraca realny count.
        // Rollback: undo-log tylko własnych zmian (jak ROLLBACK w DB —
        // nie rusza commitów innych tx).
        $transaction: jest.fn(async (fn: any) => {
            const undo = {
                recycled: [] as any[],
                claims: [] as any[],
                counters: {} as Record<string, number>,
                orders: {} as Record<string, any>
            };
            const snapCounter = (key: string) => {
                if (!(key in undo.counters)) undo.counters[key] = store.counters[key];
            };
            const snapOrder = (id: string) => {
                if (!(id in undo.orders)) undo.orders[id] = store.orders[id];
            };
            const recycledLockRelease: { release?: () => void } = {};
            const tx = {
                // P0-C/D: PUT batch działa na tx.production_orders_rel.
                production_orders_rel: {
                    findUnique: jest.fn(async ({ where }: any) => store.orders[where.id] || null),
                    // P0.3: batch-read jednym findMany id IN (filtr po store).
                    findMany: jest.fn(async ({ where }: any) => {
                        const ids: string[] = where?.id?.in ?? Object.keys(store.orders);
                        return ids
                            .map((id) => store.orders[id])
                            .filter(Boolean)
                            .map((o: any) => ({ ...o }));
                    }),
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
                    }),
                    // P0-D: wierna semantyka predykatu wersji.
                    create: jest.fn(async ({ data }: any) => {
                        store.upsertCalls++;
                        if (
                            store.failUpsertAfter >= 0 &&
                            store.upsertCalls > store.failUpsertAfter
                        ) {
                            throw new Error('boom');
                        }
                        snapOrder(data.id);
                        store.orders[data.id] = { ...data };
                        return store.orders[data.id];
                    }),
                    update: jest.fn(async ({ where, data }: any) => {
                        snapOrder(where.id);
                        const prev = store.orders[where.id];
                        const next: any = { ...(prev || {}) };
                        for (const k of Object.keys(data || {})) {
                            const v = data[k];
                            if (v === undefined) continue;
                            next[k] =
                                typeof v === 'object' && v !== null && 'increment' in v
                                    ? (next[k] ?? 0) + v.increment
                                    : v;
                        }
                        store.orders[where.id] = next;
                        return next;
                    }),
                    updateMany: jest.fn(async ({ where, data }: any) => {
                        const prev = store.orders[where.id];
                        if (!prev) return { count: 0 };
                        if (where.version !== undefined && prev.version !== where.version)
                            return { count: 0 };
                        snapOrder(where.id);
                        const next: any = { ...prev };
                        for (const k of Object.keys(data || {})) {
                            const v = data[k];
                            if (v === undefined) continue;
                            next[k] =
                                typeof v === 'object' && v !== null && 'increment' in v
                                    ? (next[k] ?? 0) + v.increment
                                    : v;
                        }
                        store.orders[where.id] = next;
                        return { count: 1 };
                    })
                },
                recycled_production_numbers_global: {
                    findMany: jest.fn(async ({ where, orderBy, take }: any) => {
                        await new Promise((r) => setTimeout(r, 5));
                        let rows = store.recycled.filter(
                            (x) =>
                                x.year === where.year &&
                                (!where.userId || x.userId === where.userId) &&
                                (!where.seqNumber?.in || where.seqNumber.in.includes(x.seqNumber))
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
                                r.year === where.year &&
                                (!where.seqNumber?.in || where.seqNumber.in.includes(r.seqNumber))
                        );
                        undo.recycled.push(...gone.map((r) => ({ ...r })));
                        store.recycled = store.recycled.filter(
                            (r) =>
                                !(
                                    r.year === where.year &&
                                    (!where.seqNumber?.in ||
                                        where.seqNumber.in.includes(r.seqNumber))
                                )
                        );
                        return { count: before - store.recycled.length };
                    })
                },
                production_global_order_counters: {
                    findUnique: jest.fn(async ({ where }: any) => {
                        const value = store.counters[String(where.year)];
                        return value === undefined ? null : { year: where.year, lastNumber: value };
                    })
                },
                production_global_number_claims: {
                    findUnique: jest.fn(
                        async ({ where }: any) =>
                            store.claims.find(
                                (claim) =>
                                    claim.year === where.year_seqNumber.year &&
                                    claim.seqNumber === where.year_seqNumber.seqNumber
                            ) || null
                    ),
                    createMany: jest.fn(async ({ data }: any) => {
                        for (const claim of data) {
                            if (
                                store.claims.some(
                                    (row) =>
                                        row.year === claim.year && row.seqNumber === claim.seqNumber
                                )
                            )
                                throw new Error('duplicate global number claim');
                            store.claims.push({ ...claim });
                            undo.claims.push({ added: true, row: { ...claim } });
                        }
                        return { count: data.length };
                    }),
                    update: jest.fn(async ({ where, data }: any) => {
                        const claim = store.claims.find(
                            (row) =>
                                row.year === where.year_seqNumber.year &&
                                row.seqNumber === where.year_seqNumber.seqNumber
                        );
                        if (!claim) throw new Error('global number claim not found');
                        const previous = { ...claim };
                        claim.userId = data.userId;
                        undo.claims.push({ added: false, changed: true, row: previous });
                        return { ...claim };
                    }),
                    deleteMany: jest.fn(async ({ where }: any) => {
                        const matches = (row: any) => {
                            if (where.OR) {
                                return where.OR.some(
                                    (candidate: any) =>
                                        row.userId === candidate.userId &&
                                        row.year === candidate.year &&
                                        row.seqNumber === candidate.seqNumber
                                );
                            }
                            return (
                                row.userId === where.userId &&
                                row.year === where.year &&
                                (!where.seqNumber?.in || where.seqNumber.in.includes(row.seqNumber))
                            );
                        };
                        const gone = store.claims.filter(matches);
                        undo.claims.push(...gone.map((row) => ({ added: false, row: { ...row } })));
                        store.claims = store.claims.filter((row) => !matches(row));
                        return { count: gone.length };
                    })
                },
                $executeRaw: jest.fn(async (strings: any, ...values: any[]) => {
                    const head: string = strings[0] || '';
                    store.lastSql = strings.join('?');
                    if (head.includes('INSERT INTO production_global_order_counters')) {
                        const [year, base] = values;
                        const key = String(year);
                        snapCounter(key);
                        if (store.counters[key] === undefined) store.counters[key] = base;
                    } else if (head.includes('UPDATE production_global_order_counters')) {
                        const [n, year] = values;
                        const key = String(year);
                        snapCounter(key);
                        store.counters[key] = (store.counters[key] ?? 0) + n;
                    }
                    return 1;
                }),
                $queryRaw: jest.fn(async (strings: any, ...values: any[]) => {
                    const sql: string = strings[0] || '';
                    if (sql.includes('WITH candidate')) return [];
                    if (
                        sql.includes('SELECT "userId"') &&
                        sql.includes('production_global_number_claims')
                    ) {
                        const [year, seqNumber] = values;
                        const claim = store.claims.find(
                            (row) => row.year === year && row.seqNumber === seqNumber
                        );
                        return claim ? [{ userId: claim.userId }] : [];
                    }
                    if (sql.includes('FROM "production_global_number_claims"')) {
                        const userId = values[0];
                        const year = values[1];
                        return store.claims
                            .filter((row) => row.userId === userId && row.year === year)
                            .map((row) => ({ seqNumber: row.seqNumber }));
                    }
                    if (sql.includes('FROM "recycled_production_numbers_global"')) {
                        const [year, take] = values;
                        const lockKey = String(year);
                        const previous = recycledClaimLocks.get(lockKey) ?? Promise.resolve();
                        let release!: () => void;
                        const lock = new Promise<void>((resolve) => {
                            release = resolve;
                        });
                        recycledClaimLocks.set(lockKey, lock);
                        await previous;
                        recycledLockRelease.release = () => {
                            release();
                            if (recycledClaimLocks.get(lockKey) === lock)
                                recycledClaimLocks.delete(lockKey);
                        };
                        return store.recycled
                            .filter((row) => row.year === year)
                            .sort((a, b) => a.seqNumber - b.seqNumber)
                            .slice(0, take)
                            .map((row) => ({ seqNumber: row.seqNumber }));
                    }
                    const [year] = values;
                    return [{ lastNumber: store.counters[String(year)] ?? 0 }];
                })
            };
            try {
                return await fn(tx);
            } catch (e) {
                for (const change of undo.claims) {
                    const index = store.claims.findIndex(
                        (row) =>
                            row.userId === change.row.userId &&
                            row.year === change.row.year &&
                            row.seqNumber === change.row.seqNumber
                    );
                    if (change.added && index >= 0) store.claims.splice(index, 1);
                    if (!change.added && index < 0) store.claims.push(change.row);
                    if (!change.added && change.changed && index >= 0)
                        store.claims[index] = change.row;
                }
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
            } finally {
                recycledLockRelease.release?.();
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
    store.users = {
        u1: { id: 'u1', symbol: 'T', productionOrderStartNumber: 1 },
        u2: { id: 'u2', symbol: 'KK', productionOrderStartNumber: 50 }
    };
    store.settings = { ['year_letter_' + YEAR]: 'A' };
    store.recycled = [];
    store.claims = [];
    store.counters = {};
    store.orders = {};
    store.lastSql = '';
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
            `A/00001/${String(YEAR).slice(-2)}`,
            `A/00002/${String(YEAR).slice(-2)}`,
            `A/00003/${String(YEAR).slice(-2)}`,
            `A/00004/${String(YEAR).slice(-2)}`,
            `A/00005/${String(YEAR).slice(-2)}`
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
        expect(res.body.seqs).toEqual([3, 7, 8]);
        expect(store.recycled).toEqual([]);
        const next = await request(app)
            .post('/api/orders-studnie/claim-production-number/u2')
            .send({});
        expect(next.body.nextSeq).toBe(9);
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
        expect([a.body.nextSeq, b.body.nextSeq].sort()).toEqual([5, 6]);
        expect(store.recycled).toEqual([]);
    });

    test('różni użytkownicy korzystają z jednego globalnego licznika', async () => {
        const app = createApp();
        const [a, b] = await Promise.all([
            request(app).post('/api/orders-studnie/claim-production-number/u1').send({}),
            request(app).post('/api/orders-studnie/claim-production-number/u2').send({})
        ]);
        expect(a.status).toBe(200);
        expect(b.status).toBe(200);
        expect([a.body.number, b.body.number].sort()).toEqual([
            `A/00001/${String(YEAR).slice(-2)}`,
            `A/00002/${String(YEAR).slice(-2)}`
        ]);
        expect(a.body.number).not.toContain('T/');
        expect(b.body.number).not.toContain('KK/');
    });

    test('globalny numer startowy działa tylko przy pierwszej inicjalizacji licznika', async () => {
        store.settings.production_order_start_number = '7';
        const app = createApp();
        const first = await request(app)
            .post('/api/orders-studnie/claim-production-number/u1')
            .send({});
        const second = await request(app)
            .post('/api/orders-studnie/claim-production-number/u2')
            .send({});
        expect(first.body.nextSeq).toBe(7);
        expect(second.body.nextSeq).toBe(8);
    });

    test('panel odzysku pokazuje wspólną pulę bez symboli użytkowników', async () => {
        store.recycled = [
            { userId: 'u1', year: YEAR, seqNumber: 8 },
            { userId: 'u2', year: YEAR, seqNumber: 3 }
        ];
        const response = await request(createApp()).get('/api/orders-studnie/recycled');
        expect(response.status).toBe(200);
        expect(response.body.recycled).toEqual([3, 8]);
        expect(response.body).not.toHaveProperty('symbol');
    });
});

describe('POST /production current-format claims', () => {
    test('rejects a canonical global number that was not claimed for the owner', async () => {
        const response = await request(createApp())
            .post('/api/orders-studnie/production')
            .send({
                id: 'unclaimed-number',
                userId: 'u1',
                wellId: 'w1',
                productionOrderNumber: `A/00001/${String(YEAR).slice(-2)}`
            });
        expect(response.status).toBe(409);
        expect(response.body.code).toBe('PRODUCTION_NUMBER_NOT_CLAIMED');
        expect(store.orders['unclaimed-number']).toBeUndefined();
    });

    test('rejects noncanonical three-segment numbers', async () => {
        const response = await request(createApp()).post('/api/orders-studnie/production').send({
            id: 'malformed-number',
            userId: 'u1',
            wellId: 'w1',
            productionOrderNumber: 'A/1/26'
        });
        expect(response.status).toBe(409);
        expect(response.body.code).toBe('INVALID_PRODUCTION_NUMBER_FORMAT');
    });

    test('rejects legacy four-segment format for a new production order', async () => {
        const response = await request(createApp())
            .post('/api/orders-studnie/production')
            .send({
                id: 'legacy-new-number',
                userId: 'u1',
                wellId: 'w1',
                productionOrderNumber: `KK/A/00001/${String(YEAR).slice(-2)}`
            });
        expect(response.status).toBe(409);
        expect(response.body.code).toBe('INVALID_PRODUCTION_NUMBER_FORMAT');
    });

    test('saves a claimed global number atomically', async () => {
        store.claims = [{ userId: 'u1', year: YEAR, seqNumber: 1 }];
        const response = await request(createApp())
            .post('/api/orders-studnie/production')
            .send({
                id: 'claimed-number',
                userId: 'u1',
                wellId: 'w1',
                productionOrderNumber: `A/00001/${String(YEAR).slice(-2)}`
            });
        expect(response.status).toBe(200);
        expect(store.orders['claimed-number'].productionNumber).toBe(
            `A/00001/${String(YEAR).slice(-2)}`
        );
        expect(store.claims).toEqual([{ userId: 'u1', year: YEAR, seqNumber: 1 }]);
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
        expect(res.body.saved).toEqual([
            { id: 'a', version: 1 },
            { id: 'b', version: 1 }
        ]);
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

    test('blokuje cudze PZ w batchu (P0.1): 403, saved=[] i nic nie zapisane', async () => {
        mockUser.id = 'intruz';
        mockUser.role = 'user';
        try {
            const app = createApp();
            // 'cudze' PZ: właściciel 'obcy' — intruz nie ma prawa zapisu.
            store.orders['cudze'] = { id: 'cudze', userId: 'obcy' };
            const data = [
                { id: 'a', wellId: 'w1' },
                { id: 'cudze', wellId: 'w1' }
            ];
            const res = await request(app).put('/api/orders-studnie/production').send({ data });
            expect(res.status).toBe(403);
            expect(res.body.saved).toEqual([]);
            expect(store.orders['a']).toBeUndefined();
            expect(store.orders['cudze']).toEqual({ id: 'cudze', userId: 'obcy' });
        } finally {
            mockUser.id = 'admin-1';
            mockUser.role = 'admin';
        }
    });

    test('przenosi rezerwację numeru przy przekazaniu PZ innemu opiekunowi', async () => {
        const productionOrderNumber = `A/00012/${String(YEAR).slice(-2)}`;
        store.claims = [{ userId: 'u1', year: YEAR, seqNumber: 12 }];
        store.orders['transfer'] = {
            id: 'transfer',
            userId: 'u1',
            version: 1,
            productionNumber: productionOrderNumber,
            data: JSON.stringify({ productionOrderNumber })
        };

        const response = await request(createApp())
            .put('/api/orders-studnie/production')
            .send({
                data: [
                    {
                        id: 'transfer',
                        userId: 'u2',
                        version: 1,
                        wellId: 'w1',
                        productionOrderNumber
                    }
                ]
            });

        expect(response.status).toBe(200);
        expect(store.orders['transfer'].userId).toBe('u2');
        expect(store.claims).toEqual([{ userId: 'u2', year: YEAR, seqNumber: 12 }]);
    });
});

describe('PUT /production version counter (P0-D: brak cichego overwrite)', () => {
    test('create startuje z version=1', async () => {
        const app = createApp();
        const res = await request(app)
            .put('/api/orders-studnie/production')
            .send({ data: [{ id: 'v1', wellId: 'w1' }] });
        expect(res.status).toBe(200);
        expect(store.orders['v1'].version).toBe(1);
    });

    test('zgodna version → zapis + bump', async () => {
        store.orders['v2'] = { id: 'v2', userId: 'admin-1', version: 1, data: '{}' };
        const app = createApp();
        const res = await request(app)
            .put('/api/orders-studnie/production')
            .send({ data: [{ id: 'v2', wellId: 'w1', version: 1 }] });
        expect(res.status).toBe(200);
        expect(store.orders['v2'].version).toBe(2);
    });

    test('stale version → 409 VERSION_CONFLICT + nic nie zmienione', async () => {
        store.orders['v3'] = { id: 'v3', userId: 'admin-1', version: 2, data: '{}' };
        const app = createApp();
        const res = await request(app)
            .put('/api/orders-studnie/production')
            .send({ data: [{ id: 'v3', wellId: 'w1', version: 1 }] });
        expect(res.status).toBe(409);
        expect(res.body.code).toBe('VERSION_CONFLICT');
        expect(res.body.serverVersion).toBe(2);
        expect(res.body.saved).toEqual([]);
        expect(store.orders['v3'].version).toBe(2);
    });

    test('A-GET, B-GET, A-PUT, B-PUT(stale) → B dostaje 409 (lost update niemożliwy)', async () => {
        store.orders['v4'] = { id: 'v4', userId: 'admin-1', version: 1, data: '{}' };
        const app = createApp();
        const aPut = await request(app)
            .put('/api/orders-studnie/production')
            .send({ data: [{ id: 'v4', wellId: 'wA', version: 1 }] });
        expect(aPut.status).toBe(200);
        const bPut = await request(app)
            .put('/api/orders-studnie/production')
            .send({ data: [{ id: 'v4', wellId: 'wB', version: 1 }] });
        expect(bPut.status).toBe(409);
        expect(store.orders['v4'].version).toBe(2);
    });

    test('brak version przy istniejącym PZ → 409 bez nadpisania', async () => {
        store.orders['v5'] = { id: 'v5', userId: 'admin-1', version: 3, data: '{}' };
        const app = createApp();
        const res = await request(app)
            .put('/api/orders-studnie/production')
            .send({
                data: [
                    { id: 'new-pz', wellId: 'w2' },
                    { id: 'v5', wellId: 'w1' }
                ]
            });
        expect(res.status).toBe(409);
        expect(res.body.code).toBe('VERSION_CONFLICT');
        expect(res.body.serverVersion).toBe(3);
        expect(res.body.saved).toEqual([]);
        expect(store.orders['v5'].version).toBe(3);
        expect(store.orders['new-pz']).toBeUndefined();
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
        store.counters[String(YEAR)] = 10;
        store.claims = [
            { userId: 'u1', year: YEAR, seqNumber: 5 },
            { userId: 'u1', year: YEAR, seqNumber: 6 }
        ];
        const app = createApp();
        const res = await request(app)
            .post('/api/orders-studnie/production/recycle-numbers')
            .send({ userId: 'u1', seqNumbers: [5, 6, 5] });
        expect(res.status).toBe(200);
        expect(res.body).toEqual({ ok: true, returned: 2 });
        const sql = store.lastSql;
        expect(sql).toContain('INSERT INTO "recycled_production_numbers_global"');
        expect(sql).toContain('"userId", "year", "seqNumber"');
        expect(sql).toContain('ON CONFLICT ("year", "seqNumber") DO NOTHING');
    });

    test('E3a strict: śmieć w seqNumbers / year → 400 z details', async () => {
        const app = createApp();
        for (const body of [
            { userId: 'u1', seqNumbers: [5, -1, 'x'] },
            { userId: 'u1', seqNumbers: [5], year: 'abc' },
            { userId: 'u1', seqNumbers: [5], year: 1999 },
            { userId: 'u1', seqNumbers: [5], year: 2100 },
            { userId: 'u1', seqNumbers: [1.5] }
        ]) {
            const res = await request(app)
                .post('/api/orders-studnie/production/recycle-numbers')
                .send(body);
            expect(res.status).toBe(400);
            expect(res.body.details).toBeDefined();
        }
    });

    test('E3a: jawny poprawny year przechodzi', async () => {
        store.counters['2026'] = 10;
        store.claims = [{ userId: 'u1', year: 2026, seqNumber: 7 }];
        const app = createApp();
        const res = await request(app)
            .post('/api/orders-studnie/production/recycle-numbers')
            .send({ userId: 'u1', seqNumbers: [7], year: 2026 });
        expect(res.status).toBe(200);
        expect(res.body).toEqual({ ok: true, returned: 1 });
    });
});
