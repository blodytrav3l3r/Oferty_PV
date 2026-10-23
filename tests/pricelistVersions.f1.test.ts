/**
 * F1: draft (seq auto, version nie z inputu), concurrent 2× createDraft,
 * mutacja APPROVED → 403, ujemna cena → 422, chunking > 25 wierszy.
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
    updatedAt?: string;
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
        findFirst: jest.fn(
            async ({ where }: { where: { type?: string; status?: string } } = { where: {} }) => {
                return (
                    versions.find(
                        (v) =>
                            (where.type === undefined || v.type === where.type) &&
                            (where.status === undefined || v.status === where.status)
                    ) ?? null
                );
            }
        ),
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
    },
    audit_logs: {
        create: jest.fn(async ({ data }: { data: Record<string, unknown> }) => ({ ...data }))
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
        expect(v1.version).toBe('Rv1-20260901');
        expect(v1.status).toBe('DRAFT');

        // Jeden szkic na typ: publikacja (APPROVED) zwalnia miejsce na kolejny.
        const stored1 = versions.find((x) => x.id === v1.id);
        if (stored1) stored1.status = 'APPROVED';

        const v2 = await createDraft('rury', [rura('r1', 110)], {
            effectiveFrom: '2026-10-01T00:00:00.000Z',
            note: 'podwyżka'
        });
        expect(v2.seq).toBe(2);
        expect(v2.version).toBe('Rv2-20261001');

        const stored2 = versions.find((x) => x.id === v2.id);
        if (stored2) stored2.status = 'APPROVED';

        // data w przeszłości też startuje jako DRAFT (oś czasu przy approve)
        const v3 = await createDraft('rury', [rura('r1', 90)], {
            effectiveFrom: '2026-09-15T00:00:00.000Z'
        });
        expect(v3.seq).toBe(3);
        expect(v3.status).toBe('DRAFT');
    });

    test('drugi DRAFT tego samego typu → 409 DRAFT_EXISTS, brak zapisu', async () => {
        await createDraft('studnie', [
            { id: 's1', name: 'S', category: 'C', componentType: 'dennica' }
        ]);
        await expect(
            createDraft('studnie', [
                { id: 's2', name: 'S2', category: 'C', componentType: 'dennica' }
            ])
        ).rejects.toMatchObject({ statusCode: 409, code: 'DRAFT_EXISTS' });
        expect(versions.filter((v) => v.type === 'studnie' && v.status === 'DRAFT')).toHaveLength(
            1
        );
        expect(itemsStudnie.length).toBe(1);
    });

    test('concurrent 2× createDraft → jeden szkic, brak partial/orphan', async () => {
        const results = await Promise.allSettled([
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
        const ok = results.filter((r) => r.status === 'fulfilled');
        const rejected = results.filter((r) => r.status === 'rejected');
        expect(ok).toHaveLength(1);
        expect(rejected).toHaveLength(1);
        expect(rejected[0]).toMatchObject({
            status: 'rejected',
            reason: { statusCode: 409, code: 'DRAFT_EXISTS' }
        });
        // brak partial: jeden szkic = jeden komplet wierszy
        expect(versions).toHaveLength(1);
        expect(itemsStudnie.length).toBe(1);
    });

    test('If-Match zgodny → zapis; niezgodny → 409 STALE_DRAFT z currentSha', async () => {
        const v = await createDraft('rury', [rura('r1', 100)], {
            effectiveFrom: '2026-09-01T00:00:00.000Z'
        });
        const ok = await updateDraft(v.id, [rura('r1', 120)], undefined, {
            expectedSha: v.sha256
        });
        expect(ok.sha256).not.toBe(v.sha256);

        await expect(
            updateDraft(ok.id, [rura('r1', 130)], undefined, { expectedSha: v.sha256 })
        ).rejects.toMatchObject({
            statusCode: 409,
            code: 'STALE_DRAFT',
            details: { currentSha: ok.sha256 }
        });
        // niezgodny If-Match nic nie zapisuje (nadal 120)
        expect(itemsRury.find((i) => i.versionId === v.id)?.price).toBe(120);
    });

    test('mutacja APPROVED odrzucona (403)', async () => {
        const v = await createDraft('rury', [rura('r1')], {
            effectiveFrom: '2026-09-01T00:00:00.000Z'
        });
        const stored = versions.find((x) => x.id === v.id);
        if (stored) stored.status = 'APPROVED';

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

    test('chunking > 100 wierszy (250 → 3× createMany, VERSION_ITEMS_CHUNK)', async () => {
        const rows = Array.from({ length: 250 }, (_, i) => rura(`r${i}`, 100 + i));
        const v = await createDraft('rury', rows, { effectiveFrom: '2026-09-01T00:00:00.000Z' });
        expect(v.seq).toBe(1);
        expect(txMock.pricelistItemRury.createMany).toHaveBeenCalledTimes(3);
        expect(txMock.pricelistItemRury.createMany).toHaveBeenNthCalledWith(1, {
            data: expect.arrayContaining([])
        });
        expect(itemsRury.filter((i) => i.versionId === v.id).length).toBe(250);
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
                status: { in: ['APPROVED'] },
                effectiveFrom: { lte: '2026-09-10T00:00:00.000Z' }
            },
            orderBy: [{ effectiveFrom: 'desc' }, { seq: 'desc' }]
        });
    });
});

describe('updateDraft nota (labelka version niemutowalna)', () => {
    test('zapis noty z wierszami (trim)', async () => {
        const v = await createDraft('rury', [rura('r1')], {
            effectiveFrom: '2026-09-01T00:00:00.000Z'
        });
        const updated = await updateDraft(v.id, [rura('r1', 120)], '  nowa nota  ');
        expect(updated.note).toBe('nowa nota');
        // labelka bez zmian
        expect(updated.version).toBe(v.version);
        expect(updated.seq).toBe(v.seq);
        // „ostatnia zmiana" — znacznik obecny i nie starszy niż przy utworzeniu
        expect(v.updatedAt).toBeTruthy();
        expect(updated.updatedAt).toBeTruthy();
        expect(String(updated.updatedAt) >= String(v.updatedAt)).toBe(true);
    });

    test('sama nota bez rows: wiersze i sha nietknięte', async () => {
        const v = await createDraft('rury', [rura('r1')], {
            effectiveFrom: '2026-09-01T00:00:00.000Z',
            note: 'stara'
        });
        const shaBefore = v.sha256;
        const updated = await updateDraft(v.id, undefined, 'sama nota');
        expect(updated.note).toBe('sama nota');
        expect(updated.sha256).toBe(shaBefore);
        expect(itemsRury.filter((i) => i.versionId === v.id).length).toBe(1);
    });

    test('pusta nota czyści (null), undefined zostawia bez zmian', async () => {
        const v = await createDraft('rury', [rura('r1')], {
            effectiveFrom: '2026-09-01T00:00:00.000Z',
            note: 'do wyczyszczenia'
        });
        const cleared = await updateDraft(v.id, undefined, '   ');
        expect(cleared.note).toBeNull();
        const kept = await updateDraft(v.id, [rura('r1', 130)], undefined);
        expect(kept.note).toBeNull();
    });

    test('note undefined = nota bez zmian przy podmianie wierszy', async () => {
        const v = await createDraft('rury', [rura('r1')], {
            effectiveFrom: '2026-09-01T00:00:00.000Z',
            note: 'trzymaj'
        });
        const updated = await updateDraft(v.id, [rura('r1', 140)]);
        expect(updated.note).toBe('trzymaj');
    });

    test('brak rows i noty → 422 NO_CHANGES', async () => {
        const v = await createDraft('rury', [rura('r1')], {
            effectiveFrom: '2026-09-01T00:00:00.000Z'
        });
        await expect(updateDraft(v.id, undefined, undefined)).rejects.toMatchObject({
            statusCode: 422,
            code: 'NO_CHANGES'
        });
    });

    test('nota na niemutowalnej (APPROVED) → 403', async () => {
        const v = await createDraft('rury', [rura('r1')], {
            effectiveFrom: '2026-09-01T00:00:00.000Z'
        });
        const stored = versions.find((x) => x.id === v.id);
        if (stored) stored.status = 'APPROVED';
        await expect(updateDraft(v.id, undefined, 'próba')).rejects.toMatchObject({
            statusCode: 403,
            code: 'IMMUTABLE_VERSION'
        });
    });

    test('nota > 500 znaków → 422 NOTE_TOO_LONG, nic nie zapisane', async () => {
        const v = await createDraft('rury', [rura('r1')], {
            effectiveFrom: '2026-09-01T00:00:00.000Z',
            note: 'oryginalna'
        });
        await expect(updateDraft(v.id, undefined, 'x'.repeat(501))).rejects.toMatchObject({
            statusCode: 422,
            code: 'NOTE_TOO_LONG'
        });
        expect(versions.find((x) => x.id === v.id)?.note).toBe('oryginalna');
    });
});
