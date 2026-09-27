/**
 * DELETE wersji cennika: tylko nigdy nieaktywne (DRAFT/SCHEDULED/
 * BACKDATE_REQUESTED) kasują się z pozycjami; ACTIVE/BACKDATE/ARCHIVED → 409
 * (pieczątki ofert pricelistVersionId).
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
        $transaction: jest.fn(async (fn: (tx: unknown) => Promise<unknown>) => fn(txMock))
    }
}));

jest.mock('../src/utils/logger', () => ({
    logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() }
}));

import { deleteVersion, PricelistVersionError } from '../src/services/pricelistVersionService';

beforeEach(() => {
    versions.length = 0;
    itemsRury.length = 0;
    audits.length = 0;
    jest.clearAllMocks();
});

function seed(status: string): VRow {
    const v: VRow = {
        id: `v-${status}`,
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

    test.each(['ACTIVE', 'BACKDATE', 'ARCHIVED'])(
        'status %s → 409, nic nie ruszone',
        async (status) => {
            const v = seed(status);
            const err = await deleteVersion(v.id).catch((e) => e);
            expect(err).toBeInstanceOf(PricelistVersionError);
            expect((err as PricelistVersionError).statusCode).toBe(409);
            expect(versions.find((x) => x.id === v.id)).toBeDefined();
            expect(itemsRury.filter((i) => i['versionId'] === v.id)).toHaveLength(2);
        }
    );

    test('brak wersji → 404', async () => {
        const err = await deleteVersion('nope').catch((e) => e);
        expect(err).toBeInstanceOf(PricelistVersionError);
        expect((err as PricelistVersionError).statusCode).toBe(404);
    });
});
