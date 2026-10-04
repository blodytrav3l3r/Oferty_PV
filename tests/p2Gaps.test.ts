/**
 * P2 gaps — testy charakterystyczne (lock-in obecnego zachowania).
 * Każdy test dokumentuje znane ryzyko z audytu 2026-10-04; zmiana
 * zachowania wymaga jawnej decyzji, nie "przy okazji".
 */
import {
    offerItemSchema,
    offerCreateSchema,
    offerStudnieCreateSchema
} from '../src/validators/offerSchemas';
import { claimIdempotencyKey, idempotencyKeyFrom } from '../src/utils/idempotency';

function p2002(): any {
    const e: any = new Error('Unique constraint failed');
    e.code = 'P2002';
    return e;
}

function memoryDb() {
    const store: Record<string, any> = {};
    return {
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
                Object.assign(row, data);
                return { count: 1 };
            }),
            deleteMany: jest.fn(async () => ({ count: 0 }))
        }
    };
}

describe('P2 gaps (audyt 2026-10-04)', () => {
    it('passthrough celowy: uid/version przechodzą przez offerItemSchema (P0.3A)', () => {
        const r = offerItemSchema.safeParse({
            productId: 'p1',
            quantity: 2,
            price: 10,
            uid: 'u-1',
            version: 3
        });
        expect(r.success).toBe(true);
        if (r.success) {
            expect((r.data as any).uid).toBe('u-1');
            expect((r.data as any).version).toBe(3);
        }
    });

    it('passthrough celowy: obce klucze w offerCreateSchema nie są odrzucane', () => {
        const r = offerCreateSchema.safeParse({
            clientId: 'c1',
            items: [],
            przyszlosciowePole: 'x'
        });
        expect(r.success).toBe(true);
        if (r.success) {
            expect((r.data as any).przyszlosciowePole).toBe('x');
        }
    });

    it('trust-client pricing: dowolna cena z payloadu przechodzi bez cennika', () => {
        // KNOWN-GAP: backend nie przelicza ceny z ACTIVE cennika.
        const rury = offerCreateSchema.safeParse({
            clientId: 'c1',
            items: [{ productId: 'p1', quantity: 1, price: 0.01 }]
        });
        expect(rury.success).toBe(true);
        const studnie = offerStudnieCreateSchema.safeParse({
            clientId: 'c1',
            wells: [{ totalPrice: 0.01 }]
        });
        expect(studnie.success).toBe(true);
    });

    it('retry bez Idempotency-Key: dwa różne klucze = dwa proceed (duplikat możliwy)', async () => {
        // KNOWN-GAP: idempotencja opcjonalna — podwójny POST bez headera zapisuje 2×.
        const db = memoryDb() as any;
        const a = await claimIdempotencyKey(
            'u1',
            'E',
            'k-1',
            { n: 1 },
            { idempotency_keys: db.idempotency_keys }
        );
        const b = await claimIdempotencyKey(
            'u1',
            'E',
            'k-2',
            { n: 1 },
            { idempotency_keys: db.idempotency_keys }
        );
        expect(a).toEqual({ action: 'proceed' });
        expect(b).toEqual({ action: 'proceed' });
    });

    it('ten sam klucz + ten sam payload w PENDING = in-progress (409)', async () => {
        const db = memoryDb() as any;
        const mk = () => ({ idempotency_keys: db.idempotency_keys });
        await claimIdempotencyKey('u1', 'E', 'k-9', { n: 1 }, mk());
        const r = await claimIdempotencyKey('u1', 'E', 'k-9', { n: 1 }, mk());
        expect(r).toEqual({ action: 'in-progress' });
    });

    it('idempotencyKeyFrom: brak headera → null; za długi → null; tablica → pierwszy', () => {
        expect(idempotencyKeyFrom({ headers: {} })).toBeNull();
        expect(idempotencyKeyFrom({ headers: { 'idempotency-key': 'x'.repeat(129) } })).toBeNull();
        expect(idempotencyKeyFrom({ headers: { 'idempotency-key': ['a', 'b'] } })).toBe('a');
        expect(idempotencyKeyFrom({ get: () => 'k-1' })).toBe('k-1');
    });
});
