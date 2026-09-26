/**
 * F1: draft (seq auto, version nie z inputu), concurrent 2× createDraft,
 * mutacja ACTIVE → 403, ujemna cena → 422, chunking > 25 wierszy.
 */

interface VRow {
    id: string;
    type: string;
    seq: number;
    version: string;
    status: string;
    effectiveFrom: string;
    createdBy?: string;
    note?: string;
    sha256: string;
    createdAt?: string;
}

const versions: VRow[] = [];
const itemsRury: Array<Record<string, unknown>> = [];
const itemsStudnie: Array<Record<string, unknown>> = [];
const itemsKonfig: Array<Record<string, unknown>> = [];
const itemsKinety: Array<Record<string, unknown>> = [];
const itemsZakresy: Array<Record<string, unknown>> = [];

/** Małe opóźnienie w agregacji — wymusza przeplot bez locka per-type. */
const tick = () => new Promise((r) => setTimeout(r, 5));

function uniqueErr(): Error {
    const err = new Error('Unique constraint failed') as Error & { code: string };
    err.code = 'P2002';
    return err;
}

const txMock = {
    pricelistVersion: {
        aggregate: jest.fn(async ({ where }: { where: { type: string } }) => {
            await tick();
            const vs = versions.filter((v) => v.type === where.type);
            return {
                _max: {
                    seq: vs.length > 0 ? Math.max(...vs.map((v) => v.seq)) : null,
                    effectiveFrom:
                        vs.length > 0
                            ? vs
                                  .map((v) => v.effectiveFrom)
                                  .sort()
                                  .reverse()[0]
                            : null
                }
            };
        }),
        create: jest.fn(async ({ data }: { data: VRow }) => {
            await tick();
            if (versions.some((v) => v.type === data.type && v.seq === data.seq)) throw uniqueErr();
            if (versions.some((v) => v.type === data.type && v.version === data.version)) {
                throw uniqueErr();
            }
            versions.push({ ...data });
            return { ...data };
        }),
        findUnique: jest.fn(async ({ where }: { where: { id: string } }) => {
            return versions.find((v) => v.id === where.id) ?? null;
        }),
        update: jest.fn(async ({ where, data }: { where: { id: string }; data: Partial<VRow> }) => {
            const v = versions.find((x) => x.id === where.id);
            if (!v) throw new Error('Not found');
            Object.assign(v, data);
            return { ...v };
        })
    },
    pricelistItemRury: {
        createMany: jest.fn(async ({ data }: { data: Array<Record<string, unknown>> }) => {
            itemsRury.push(...data);
            return { count: data.length };
        }),
        deleteMany: jest.fn(async () => {
            itemsRury.length = 0;
            return { count: 0 };
        }),
        findMany: jest.fn(async () => [...itemsRury])
    },
    pricelistItemStudnie: {
        createMany: jest.fn(async ({ data }: { data: Array<Record<string, unknown>> }) => {
            itemsStudnie.push(...data);
            return { count: data.length };
        }),
        deleteMany: jest.fn(async () => {
            itemsStudnie.length = 0;
            return { count: 0 };
        }),
        findMany: jest.fn(async () => [...itemsStudnie])
    },
    pricelistItemPrecoKonfig: {
        createMany: jest.fn(async ({ data }: { data: Array<Record<string, unknown>> }) => {
            itemsKonfig.push(...data);
            return { count: data.length };
        }),
        deleteMany: jest.fn(async () => {
            itemsKonfig.length = 0;
            return { count: 0 };
        }),
        findMany: jest.fn(async () => [...itemsKonfig])
    },
    pricelistItemPrecoKinety: {
        createMany: jest.fn(async ({ data }: { data: Array<Record<string, unknown>> }) => {
            itemsKinety.push(...data);
            return { count: data.length };
        }),
        deleteMany: jest.fn(async () => {
            itemsKinety.length = 0;
            return { count: 0 };
        }),
        findMany: jest.fn(async () => [...itemsKinety])
    },
    pricelistItemPrecoZakresy: {
        createMany: jest.fn(async ({ data }: { data: Array<Record<string, unknown>> }) => {
            itemsZakresy.push(...data);
            return { count: data.length };
        }),
        deleteMany: jest.fn(async () => {
            itemsZakresy.length = 0;
            return { count: 0 };
        }),
        findMany: jest.fn(async () => [...itemsZakresy])
    }
};

jest.mock('../src/prismaClient', () => ({
    __esModule: true,
    default: {
        pricelistVersion: {
            aggregate: (...a: unknown[]) =>
                (txMock.pricelistVersion.aggregate as (...x: unknown[]) => Promise<unknown>)(...a),
            create: (...a: unknown[]) =>
                (txMock.pricelistVersion.create as (...x: unknown[]) => Promise<unknown>)(...a),
            findUnique: (...a: unknown[]) =>
                (txMock.pricelistVersion.findUnique as (...x: unknown[]) => Promise<unknown>)(...a),
            update: (...a: unknown[]) =>
                (txMock.pricelistVersion.update as (...x: unknown[]) => Promise<unknown>)(...a),
            findFirst: jest.fn(async () => null)
        },
        $transaction: jest.fn(async (fn: (tx: unknown) => Promise<unknown>) => {
            const snap = {
                v: versions.length,
                r: itemsRury.length,
                s: itemsStudnie.length,
                k: itemsKonfig.length,
                kt: itemsKinety.length,
                z: itemsZakresy.length
            };
            try {
                return await fn(txMock);
            } catch (err) {
                versions.length = snap.v;
                itemsRury.length = snap.r;
                itemsStudnie.length = snap.s;
                itemsKonfig.length = snap.k;
                itemsKinety.length = snap.kt;
                itemsZakresy.length = snap.z;
                throw err;
            }
        })
    }
}));

jest.mock('../src/utils/logger', () => ({
    logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() }
}));

import {
    createDraft,
    updateDraft,
    PricelistVersionError,
    resolveActive
} from '../src/services/pricelistVersionService';

const rura = (id: string, price = 100) => ({
    id,
    name: `Rura ${id}`,
    category: 'Rury Betonowe',
    price
});

beforeEach(() => {
    versions.length = 0;
    itemsRury.length = 0;
    itemsStudnie.length = 0;
    itemsKonfig.length = 0;
    itemsKinety.length = 0;
    itemsZakresy.length = 0;
    jest.clearAllMocks();
});

describe('F1 pricelistVersions', () => {
    test('seq auto + version label nie z inputu', async () => {
        const v1 = await createDraft('rury', [rura('r1')], {
            effectiveFrom: '2026-09-01T00:00:00.000Z'
        });
        expect(v1.seq).toBe(1);
        expect(v1.version).toBe('v1-20260901');
        expect(v1.status).toBe('SCHEDULED');

        const v2 = await createDraft('rury', [rura('r1', 110)], {
            effectiveFrom: '2026-10-01T00:00:00.000Z',
            note: 'podwyżka'
        });
        expect(v2.seq).toBe(2);
        expect(v2.version).toBe('v2-20261001');

        // data w przeszłość względem max → BACKDATE_REQUESTED
        const v3 = await createDraft('rury', [rura('r1', 90)], {
            effectiveFrom: '2026-09-15T00:00:00.000Z'
        });
        expect(v3.seq).toBe(3);
        expect(v3.status).toBe('BACKDATE_REQUESTED');
    });

    test('concurrent 2× createDraft → unikalne seq, brak partial/orphan', async () => {
        const barrier = Promise.all([
            createDraft(
                'studnie',
                [{ id: 's1', name: 'S', category: 'C', componentType: 'dennica' }],
                {
                    effectiveFrom: '2026-09-01T00:00:00.000Z'
                }
            ),
            createDraft(
                'studnie',
                [{ id: 's2', name: 'S2', category: 'C', componentType: 'dennica' }],
                {
                    effectiveFrom: '2026-10-01T00:00:00.000Z'
                }
            )
        ]);
        const [a, b] = await barrier;
        const seqs = [a.seq, b.seq].sort();
        expect(seqs).toEqual([1, 2]);
        expect(a.version).not.toBe(b.version);
        // brak partial: każda wersja ma swoje wiersze
        expect(versions.length).toBe(2);
        expect(itemsStudnie.length).toBe(2);
        const vIds = new Set(itemsStudnie.map((i) => i.versionId));
        expect(vIds.size).toBe(2);
    });

    test('mutacja ACTIVE odrzucona (403)', async () => {
        const v = await createDraft('rury', [rura('r1')], {
            effectiveFrom: '2026-09-01T00:00:00.000Z'
        });
        const stored = versions.find((x) => x.id === v.id);
        if (stored) stored.status = 'ACTIVE';

        await expect(updateDraft(v.id, [rura('r1', 120)])).rejects.toMatchObject({
            statusCode: 403
        });
        await expect(updateDraft(v.id, [rura('r1', 120)])).rejects.toBeInstanceOf(
            PricelistVersionError
        );
        // wiersze nietknięte
        expect(itemsRury.filter((i) => i.versionId === v.id).length).toBe(1);
    });

    test('ujemna cena → 422, nic nie zapisane', async () => {
        await expect(createDraft('rury', [rura('r1', -5)])).rejects.toMatchObject({
            statusCode: 422
        });
        await expect(
            createDraft('studnie', [
                { id: 's1', name: 'S', category: 'C', componentType: 'dennica', price: -1 }
            ])
        ).rejects.toMatchObject({ statusCode: 422 });
        await expect(
            createDraft('preco', {
                konfig: [{ id: 'k1', key: 'a', value: '{}' }],
                kinety: [{ id: 'kt1', order: 1, dn: 300, wellDn: 1000, height: 1, cena: -10 }],
                zakresy: [
                    { id: 'z1', order: 1, label: 'A', min: 0, max: 5, grupy: '{}', wellDn: 1000 }
                ]
            })
        ).rejects.toMatchObject({ statusCode: 422 });
        expect(versions.length).toBe(0);
        expect(itemsRury.length).toBe(0);
    });

    test('chunking > 25 wierszy (30 → 2× createMany)', async () => {
        const rows = Array.from({ length: 30 }, (_, i) => rura(`r${i}`, 100 + i));
        const v = await createDraft('rury', rows, { effectiveFrom: '2026-09-01T00:00:00.000Z' });
        expect(v.seq).toBe(1);
        expect(txMock.pricelistItemRury.createMany).toHaveBeenCalledTimes(2);
        expect(txMock.pricelistItemRury.createMany).toHaveBeenNthCalledWith(1, {
            data: expect.arrayContaining([])
        });
        expect(itemsRury.filter((i) => i.versionId === v.id).length).toBe(30);
    });

    test('resolveActive deterministyczny (mock findFirst)', async () => {
        const prisma = (await import('../src/prismaClient')).default as unknown as {
            pricelistVersion: { findFirst: jest.Mock };
        };
        prisma.pricelistVersion.findFirst.mockResolvedValueOnce(null);
        const res = await resolveActive('rury', '2026-09-10T00:00:00.000Z');
        expect(res).toBeNull();
        expect(prisma.pricelistVersion.findFirst).toHaveBeenCalledWith({
            where: {
                type: 'rury',
                status: { in: ['ACTIVE', 'BACKDATE'] },
                effectiveFrom: { lte: '2026-09-10T00:00:00.000Z' }
            },
            orderBy: [{ effectiveFrom: 'desc' }, { seq: 'desc' }]
        });
    });
});
