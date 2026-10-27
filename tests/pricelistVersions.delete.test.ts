/**
 * DELETE wersji cennika: allowlist (DRAFT/SCHEDULED/BACKDATE_REQUESTED)
 * kasuje jak dziś; ACTIVE/BACKDATE ZAWSZE 409 (nawet przy zerze —
 * resolveActive rozdaje je nowym ofertom, wyścig); ARCHIVED (i inne
 * przyszłe nie-allowlist) kasuje się bez użycia, z użyciem → 409 USED_BY
 * z liczbą w komunikacie.
 */

interface VRow {
    id: string;
    type: string;
    seq: number;
    version: string;
    status: string;
    effectiveFrom: string;
    sha256: string;
}

const versions: VRow[] = [];
const itemsRury: Array<Record<string, unknown>> = [];
const audits: Array<Record<string, unknown>> = [];
/** Pieczątki pricelistVersionId: `${tabela}:${wersja}` → liczba. */
const usage: Record<string, number> = {};

function use(table: string, id: string, n: number): void {
    usage[`${table}:${id}`] = n;
}

function countMock(table: string) {
    return jest.fn(async ({ where }: { where: { pricelistVersionId: string } }) => {
        return usage[`${table}:${where.pricelistVersionId}`] ?? 0;
    });
}

const txMock = {
    pricelistVersion: {
        findUnique: jest.fn(async ({ where }: { where: { id: string } }) => {
            return versions.find((v) => v.id === where.id) ?? null;
        }),
        findMany: jest.fn(async ({ where }: { where?: { type?: string } } = {}) => {
            return versions.filter((v) => where?.type === undefined || v.type === where.type);
        }),
        delete: jest.fn(async ({ where }: { where: { id: string } }) => {
            const idx = versions.findIndex((v) => v.id === where.id);
            if (idx === -1) throw new Error('Not found');
            const [gone] = versions.splice(idx, 1);
            return gone;
        })
    },
    pricelistItemRury: {
        deleteMany: jest.fn(async ({ where }: { where: { versionId: string } }) => {
            let n = 0;
            for (let i = itemsRury.length - 1; i >= 0; i--) {
                if (itemsRury[i]['versionId'] === where.versionId) {
                    itemsRury.splice(i, 1);
                    n++;
                }
            }
            return { count: n };
        })
    },
    pricelistItemPrecoKonfig: { deleteMany: jest.fn(async () => ({ count: 0 })) },
    pricelistItemPrecoKinety: { deleteMany: jest.fn(async () => ({ count: 0 })) },
    pricelistItemPrecoZakresy: { deleteMany: jest.fn(async () => ({ count: 0 })) },
    offers_rel: { count: countMock('offers_rel') },
    offers_studnie_rel: { count: countMock('offers_studnie_rel') },
    orders_rury_rel: { count: countMock('orders_rury_rel') },
    orders_studnie_rel: { count: countMock('orders_studnie_rel') },
    settings: {
        deleteMany: jest.fn(async () => ({ count: 0 })),
        findUnique: jest.fn(async () => null),
        findMany: jest.fn(async () => []),
        upsert: jest.fn(async () => ({}))
    },
    audit_logs: {
        create: jest.fn(async ({ data }: { data: Record<string, unknown> }) => {
            audits.push(data);
            return data;
        })
    }
};

jest.mock('../src/prismaClient', () => ({
    __esModule: true,
    default: {
        pricelistVersion: {
            findUnique: (...a: unknown[]) =>
                (txMock.pricelistVersion.findUnique as (...x: unknown[]) => Promise<unknown>)(...a),
            findMany: (...a: unknown[]) =>
                (txMock.pricelistVersion.findMany as (...x: unknown[]) => Promise<unknown>)(...a),
            // resolveActive: najnowsza APPROVED z effectiveFrom <= teraz.
            findFirst: jest.fn(
                async ({ where }: { where?: { id?: string; type?: string } } = {}) => {
                    const nowIso = new Date().toISOString();
                    const rows = versions
                        .filter(
                            (v) =>
                                (where?.id === undefined || v.id === where.id) &&
                                (where?.type === undefined || v.type === where.type) &&
                                v.status === 'APPROVED' &&
                                v.effectiveFrom <= nowIso
                        )
                        .sort(
                            (a, b) =>
                                (a.effectiveFrom < b.effectiveFrom
                                    ? 1
                                    : a.effectiveFrom > b.effectiveFrom
                                      ? -1
                                      : 0) || b.seq - a.seq
                        );
                    return rows[0] ?? null;
                }
            )
        },
        settings: {
            findUnique: jest.fn(async () => null),
            findMany: jest.fn(async () => []),
            deleteMany: jest.fn(async () => ({ count: 0 })),
            upsert: jest.fn(async () => ({}))
        },
        offers_rel: {
            count: (...a: unknown[]) =>
                (txMock.offers_rel.count as (...x: unknown[]) => Promise<unknown>)(...a)
        },
        offers_studnie_rel: {
            count: (...a: unknown[]) =>
                (txMock.offers_studnie_rel.count as (...x: unknown[]) => Promise<unknown>)(...a)
        },
        orders_rury_rel: {
            count: (...a: unknown[]) =>
                (txMock.orders_rury_rel.count as (...x: unknown[]) => Promise<unknown>)(...a)
        },
        orders_studnie_rel: {
            count: (...a: unknown[]) =>
                (txMock.orders_studnie_rel.count as (...x: unknown[]) => Promise<unknown>)(...a)
        },
        $transaction: jest.fn(async (fn: (tx: unknown) => Promise<unknown>) => fn(txMock))
    }
}));

jest.mock('../src/utils/logger', () => ({
    logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() }
}));

import {
    countVersionUsage,
    deleteVersion,
    getPrecoReferences,
    PricelistVersionError
} from '../src/services/pricelistVersionService';

beforeEach(() => {
    versions.length = 0;
    itemsRury.length = 0;
    audits.length = 0;
    for (const k of Object.keys(usage)) delete usage[k];
    jest.clearAllMocks();
});

function seed(status: string, id?: string): VRow {
    const v: VRow = {
        id: id ?? `v-${status}`,
        type: 'rury',
        seq: 7,
        version: 'v7-20260927',
        status,
        effectiveFrom: '2026-09-27T19:00:00.000Z',
        sha256: 'x'
    };
    versions.push({ ...v });
    itemsRury.push({ id: `${v.id}:r1`, versionId: v.id }, { id: `${v.id}:r2`, versionId: v.id });
    return v;
}

function seedVersion(
    input: Pick<VRow, 'id' | 'type' | 'status' | 'seq'> & Partial<Pick<VRow, 'effectiveFrom'>>
): VRow {
    const v: VRow = {
        version: `v${input.seq}`,
        sha256: 'x',
        effectiveFrom: '2026-01-01T00:00:00.000Z',
        ...input
    };
    versions.push(v);
    return v;
}

describe('DELETE pricelistVersions (S2a)', () => {
    test('status DRAFT kasuje wersję z pozycjami + audit', async () => {
        const v = seed('DRAFT');
        await expect(deleteVersion(v.id)).resolves.toEqual({ id: v.id });
        expect(versions.find((x) => x.id === v.id)).toBeUndefined();
        expect(itemsRury.filter((i) => i['versionId'] === v.id)).toHaveLength(0);
        expect(audits.some((a) => a['action'] === 'DELETE')).toBe(true);
    });

    test('APPROVED przyszła bez użycia kasuje (+audit z offers:0)', async () => {
        const v = seed('APPROVED', 'v-future');
        v.effectiveFrom = '2999-01-01T00:00:00.000Z';
        versions[0] = v;
        await expect(deleteVersion(v.id)).resolves.toEqual({ id: v.id });
        expect(versions.find((x) => x.id === v.id)).toBeUndefined();
        expect(itemsRury.filter((i) => i['versionId'] === v.id)).toHaveLength(0);
        const audit = audits.find((a) => a['action'] === 'DELETE');
        expect(audit).toBeDefined();
        expect(String(audit?.['oldData'] ?? '')).toContain('offers');
    });

    test('APPROVED przyszła z 2 ofertami → 409 USED_BY z liczbą, nic nie ruszone', async () => {
        const v = seed('APPROVED', 'v-used');
        v.effectiveFrom = '2999-01-01T00:00:00.000Z';
        versions[0] = v;
        use('offers_rel', v.id, 1);
        use('offers_studnie_rel', v.id, 1);
        const err = await deleteVersion(v.id).catch((e) => e);
        expect(err).toBeInstanceOf(PricelistVersionError);
        expect((err as PricelistVersionError).statusCode).toBe(409);
        expect((err as PricelistVersionError).code).toBe('USED_BY');
        expect((err as Error).message).toContain('2');
        expect((err as Error).message).toContain('historia chroniona');
        expect(versions.find((x) => x.id === v.id)).toBeDefined();
        expect(itemsRury.filter((i) => i['versionId'] === v.id)).toHaveLength(2);
    });

    test('APPROVED przeszła i obowiązująca → 409 ACTIVE_IN_USE (najpierw wybierz inną)', async () => {
        const v = seed('APPROVED', 'v-past');
        v.effectiveFrom = '2025-01-01T00:00:00.000Z';
        versions[0] = v;
        const err = await deleteVersion(v.id).catch((e) => e);
        expect(err).toBeInstanceOf(PricelistVersionError);
        expect((err as PricelistVersionError).statusCode).toBe(409);
        expect((err as PricelistVersionError).code).toBe('ACTIVE_IN_USE');
        expect((err as Error).message).toContain('obowiązującym cennikiem');
        expect(versions.find((x) => x.id === v.id)).toBeDefined();
        expect(itemsRury.filter((i) => i['versionId'] === v.id)).toHaveLength(2);
    });

    test('APPROVED historyczna (starsza, nieobowiązująca) bez użycia → kasuje', async () => {
        seedVersion({
            id: 'v-old',
            type: 'rury',
            status: 'APPROVED',
            seq: 1,
            effectiveFrom: '2025-01-01T00:00:00.000Z'
        });
        seedVersion({
            id: 'v-new',
            type: 'rury',
            status: 'APPROVED',
            seq: 2,
            effectiveFrom: '2026-01-01T00:00:00.000Z'
        });
        await expect(deleteVersion('v-old')).resolves.toEqual({ id: 'v-old' });
        expect(versions.some((v) => v.id === 'v-old')).toBe(false);
        expect(versions.some((v) => v.id === 'v-new')).toBe(true);
    });

    test('APPROVED historyczna z 1 ofertą → 409 USED_BY (historia chroniona)', async () => {
        seedVersion({
            id: 'v-old',
            type: 'rury',
            status: 'APPROVED',
            seq: 1,
            effectiveFrom: '2025-01-01T00:00:00.000Z'
        });
        seedVersion({
            id: 'v-new',
            type: 'rury',
            status: 'APPROVED',
            seq: 2,
            effectiveFrom: '2026-01-01T00:00:00.000Z'
        });
        use('offers_rel', 'v-old', 1);
        const err = await deleteVersion('v-old').catch((e) => e);
        expect(err).toBeInstanceOf(PricelistVersionError);
        expect((err as PricelistVersionError).code).toBe('USED_BY');
        expect(versions.some((v) => v.id === 'v-old')).toBe(true);
    });

    test('countVersionUsage sumuje 4 tabele (offers/orders/total)', async () => {
        const v = seed('APPROVED', 'v-count');
        use('offers_rel', v.id, 1);
        use('offers_studnie_rel', v.id, 1);
        use('orders_rury_rel', v.id, 3);
        await expect(countVersionUsage(v.id)).resolves.toEqual({
            offers: 2,
            orders: 3,
            total: 5
        });
    });

    test('brak wersji → 404', async () => {
        const err = await deleteVersion('nope').catch((e) => e);
        expect(err).toBeInstanceOf(PricelistVersionError);
        expect((err as PricelistVersionError).statusCode).toBe(404);
    });

    test('APPROVED przyszła PRECO wskazana przez DRAFT studnie → 409 USED_BY_STUDNIE', async () => {
        seedVersion({
            id: 'p-future',
            type: 'preco',
            status: 'APPROVED',
            seq: 1,
            effectiveFrom: '2999-01-01T00:00:00.000Z'
        });
        seedVersion({
            id: 's-draft',
            type: 'studnie',
            status: 'DRAFT',
            seq: 1,
            effectiveFrom: '3000-02-01T00:00:00.000Z'
        });
        const err = await deleteVersion('p-future').catch((e) => e);
        expect(err).toBeInstanceOf(PricelistVersionError);
        expect((err as PricelistVersionError).statusCode).toBe(409);
        expect((err as PricelistVersionError).code).toBe('USED_BY_STUDNIE');
        expect((err as Error).message).toContain('1');
        expect((err as Error).message).toContain('v1');
        expect(versions.some((v) => v.id === 'p-future')).toBe(true);
    });

    test('DRAFT PRECO nie jest referencją (D1) → delete dozwolony', async () => {
        seedVersion({
            id: 'p-draft',
            type: 'preco',
            status: 'DRAFT',
            seq: 1,
            effectiveFrom: '2026-01-01T00:00:00.000Z'
        });
        seedVersion({
            id: 's-draft',
            type: 'studnie',
            status: 'DRAFT',
            seq: 1,
            effectiveFrom: '2026-02-01T00:00:00.000Z'
        });
        await expect(deleteVersion('p-draft')).resolves.toEqual({ id: 'p-draft' });
        const audit = audits.find((a) => a['action'] === 'DELETE');
        expect(String(audit?.['oldData'] ?? '')).toContain('studnieReferences');
    });

    test('PRECO przeszła i obowiązująca → ACTIVE_IN_USE przed guardem referencji', async () => {
        seedVersion({
            id: 'p-active',
            type: 'preco',
            status: 'APPROVED',
            seq: 1,
            effectiveFrom: '2025-01-01T00:00:00.000Z'
        });
        seedVersion({
            id: 's1',
            type: 'studnie',
            status: 'APPROVED',
            seq: 1,
            effectiveFrom: '2025-02-01T00:00:00.000Z'
        });
        const err = await deleteVersion('p-active').catch((e) => e);
        expect((err as PricelistVersionError).code).toBe('ACTIVE_IN_USE');
    });

    test('re-check w tx: referencja dodana po pre-checku → 409 i brak delete', async () => {
        seedVersion({
            id: 'p-race',
            type: 'preco',
            status: 'APPROVED',
            seq: 1,
            effectiveFrom: '2999-01-01T00:00:00.000Z'
        });
        const findMany = txMock.pricelistVersion.findMany as jest.Mock;
        findMany
            .mockResolvedValueOnce([])
            .mockResolvedValueOnce([])
            .mockResolvedValueOnce([
                {
                    id: 's-race',
                    version: 'v1',
                    seq: 1,
                    status: 'DRAFT',
                    effectiveFrom: '3000-02-01T00:00:00.000Z'
                }
            ])
            .mockResolvedValueOnce([
                {
                    id: 'p-race',
                    version: 'v1',
                    seq: 1,
                    status: 'APPROVED',
                    effectiveFrom: '2999-01-01T00:00:00.000Z'
                }
            ]);

        const err = await deleteVersion('p-race').catch((e) => e);
        expect(err).toBeInstanceOf(PricelistVersionError);
        expect((err as PricelistVersionError).statusCode).toBe(409);
        expect((err as PricelistVersionError).code).toBe('USED_BY_STUDNIE');
        expect(versions.some((v) => v.id === 'p-race')).toBe(true);
        expect(txMock.pricelistVersion.delete).not.toHaveBeenCalled();
        expect(txMock.pricelistItemPrecoKinety.deleteMany).not.toHaveBeenCalled();
    });

    test('getPrecoReferences mapuje referencje i labelki (max 3)', async () => {
        seedVersion({
            id: 'p-arch',
            type: 'preco',
            status: 'APPROVED',
            seq: 1,
            effectiveFrom: '2026-01-01T00:00:00.000Z'
        });
        for (let i = 1; i <= 4; i++) {
            seedVersion({
                id: `s${i}`,
                type: 'studnie',
                status: 'DRAFT',
                seq: i,
                effectiveFrom: `2026-0${i + 1}-01T00:00:00.000Z`
            });
        }
        const refs = await getPrecoReferences();
        expect(refs.get('p-arch')?.count).toBe(4);
        expect(refs.get('p-arch')?.labels).toHaveLength(3);
    });
});
