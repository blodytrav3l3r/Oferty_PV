/**
 * P1-A: Idempotency-Key — claim/replay/reuse/reclaim/complete na mocku.
 */
import { claimIdempotencyKey, completeIdempotencyKey, requestHash } from '../src/utils/idempotency';

const store: Record<string, any> = {};

function p2002(): any {
    const e: any = new Error('Unique constraint failed');
    e.code = 'P2002';
    return e;
}

const db = {
    idempotency_keys: {
        create: jest.fn(async ({ data }: any) => {
            const k = `${data.userId}|${data.endpoint}|${data.key}`;
            if (store[k]) throw p2002();
            store[k] = { ...data };
            return store[k];
        }),
        findUnique: jest.fn(async ({ where }: any) => {
            const w = where.userId_endpoint_key;
            return store[`${w.userId}|${w.endpoint}|${w.key}`] || null;
        }),
        updateMany: jest.fn(async ({ where, data }: any) => {
            const k = `${where.userId}|${where.endpoint}|${where.key}`;
            const row = store[k];
            if (!row) return { count: 0 };
            if (where.status && row.status !== where.status) return { count: 0 };
            if (where.createdAt && !(row.createdAt === where.createdAt)) return { count: 0 };
            Object.assign(row, data);
            return { count: 1 };
        }),
        deleteMany: jest.fn(async () => ({ count: 0 }))
    }
};

const D = () => ({ idempotency_keys: (db as any).idempotency_keys });

beforeEach(() => {
    for (const k of Object.keys(store)) delete store[k];
});

describe('P1-A idempotency', () => {
    test('pierwszy claim → proceed; hash stabilny na kolejność kluczy', async () => {
        expect(requestHash({ b: 1, a: 2 })).toBe(requestHash({ a: 2, b: 1 }));
        const r = await claimIdempotencyKey('u1', 'E', 'k1', { a: 1 }, D());
        expect(r).toEqual({ action: 'proceed' });
    });

    test('powtórka po DONE → replay tej samej odpowiedzi', async () => {
        await claimIdempotencyKey('u1', 'E', 'k1', { a: 1 }, D());
        await completeIdempotencyKey('u1', 'E', 'k1', 200, { ok: true, id: 'x' }, D());
        const r = await claimIdempotencyKey('u1', 'E', 'k1', { a: 1 }, D());
        expect(r).toEqual({ action: 'replay', status: 200, body: { ok: true, id: 'x' } });
    });

    test('ten sam klucz + inny payload → reuse (409)', async () => {
        await claimIdempotencyKey('u1', 'E', 'k1', { a: 1 }, D());
        await completeIdempotencyKey('u1', 'E', 'k1', 200, { ok: true }, D());
        const r = await claimIdempotencyKey('u1', 'E', 'k1', { a: 2 }, D());
        expect(r).toEqual({ action: 'reuse' });
    });

    test('PENDING świeży → in-progress; stary → reclaim → proceed', async () => {
        await claimIdempotencyKey('u1', 'E', 'k1', { a: 1 }, D());
        expect(await claimIdempotencyKey('u1', 'E', 'k1', { a: 1 }, D())).toEqual({
            action: 'in-progress'
        });
        // Postarz PENDING (crash) — reclaim.
        store['u1|E|k1'].createdAt = new Date(Date.now() - 10 * 60 * 1000).toISOString();
        expect(await claimIdempotencyKey('u1', 'E', 'k1', { a: 1 }, D())).toEqual({
            action: 'proceed'
        });
    });

    test('klucze różnych userów nie kolidują', async () => {
        await claimIdempotencyKey('u1', 'E', 'k1', { a: 1 }, D());
        expect(await claimIdempotencyKey('u2', 'E', 'k1', { a: 1 }, D())).toEqual({
            action: 'proceed'
        });
    });

    test('complete przy 5xx nie zapisuje (retry wolny)', async () => {
        await claimIdempotencyKey('u1', 'E', 'k1', { a: 1 }, D());
        await completeIdempotencyKey('u1', 'E', 'k1', 500, { error: 'x' }, D());
        expect(store['u1|E|k1'].status).toBe('PENDING');
    });
});
