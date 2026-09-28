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
    offers_rel: { count: countMock('offers_rel') },
    offers_studnie_rel: { count: countMock('offers_studnie_rel') },
    orders_rury_rel: { count: countMock('orders_rury_rel') },
    orders_studnie_rel: { count: countMock('orders_studnie_rel') },
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
                (txMock.pricelistVersion.findUnique as (...x: unknown[]) => Promise<unknown>)(...a)
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

describe('DELETE pricelistVersions', () => {
    test.each(['DRAFT', 'SCHEDULED', 'BACKDATE_REQUESTED'])(
        'status %s kasuje wersję z pozycjami + audit',
        async (status) => {
            const v = seed(status);
            await expect(deleteVersion(v.id)).resolves.toEqual({ id: v.id });
            expect(versions.find((x) => x.id === v.id)).toBeUndefined();
            expect(itemsRury.filter((i) => i['versionId'] === v.id)).toHaveLength(0);
            expect(audits.some((a) => a['action'] === 'DELETE')).toBe(true);
        }
    );

    test('ARCHIVED bez użycia kasuje (+audit z offers:0)', async () => {
        const v = seed('ARCHIVED');
        await expect(deleteVersion(v.id)).resolves.toEqual({ id: v.id });
        expect(versions.find((x) => x.id === v.id)).toBeUndefined();
        expect(itemsRury.filter((i) => i['versionId'] === v.id)).toHaveLength(0);
        const audit = audits.find((a) => a['action'] === 'DELETE');
        expect(audit).toBeDefined();
        expect(String(audit?.['oldData'] ?? '')).toContain('offers');
    });

    test('ARCHIVED z 2 ofertami → 409 USED_BY z liczbą, nic nie ruszone', async () => {
        const v = seed('ARCHIVED', 'v-used');
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

    test.each(['ACTIVE', 'BACKDATE'])('status %s z zerem → 409 NOT_DELETABLE', async (status) => {
        const v = seed(status);
        const err = await deleteVersion(v.id).catch((e) => e);
        expect(err).toBeInstanceOf(PricelistVersionError);
        expect((err as PricelistVersionError).statusCode).toBe(409);
        expect((err as PricelistVersionError).code).toBe('NOT_DELETABLE');
        expect(versions.find((x) => x.id === v.id)).toBeDefined();
        expect(itemsRury.filter((i) => i['versionId'] === v.id)).toHaveLength(2);
    });

    test('countVersionUsage sumuje 4 tabele (offers/orders/total)', async () => {
        const v = seed('ARCHIVED', 'v-count');
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
});
