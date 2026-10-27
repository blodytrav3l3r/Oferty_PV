/**
 * Ręczny wybór obowiązującego cennika („Ustaw jako aktywny”):
 * - resolveActive respektuje wskazanie (tylko dla bieżącego czasu),
 * - dozwolone wyłącznie dla APPROVED z datą <= now,
 * - publikacja nowej wersji zdejmuje wskazanie (oś czasu znów rządzi),
 * - usuwanie: obowiązującej nie wolno, historycznej bez ofert wolno.
 */

interface VRow {
    id: string;
    type: string;
    seq: number;
    version: string;
    status: string;
    effectiveFrom: string;
    sha256: string;
    note?: string | null;
}

const versions: VRow[] = [];
const settings = new Map<string, string>();
const audits: Array<Record<string, unknown>> = [];
const items: Array<Record<string, unknown>> = [];

const nowIso = () => new Date().toISOString();

function findVersion(id: string): VRow | null {
    return versions.find((v) => v.id === id) ?? null;
}

function activeCandidate(
    where: {
        id?: string;
        type?: string;
        status?: { in?: string[] };
        effectiveFrom?: { lte?: string };
    } = {},
    atIso = nowIso()
): VRow | null {
    const maxDate = where.effectiveFrom?.lte ?? atIso;
    const statuses = where.status?.in ?? ['APPROVED'];
    const rows = versions
        .filter(
            (v) =>
                (where.id === undefined || v.id === where.id) &&
                (where.type === undefined || v.type === where.type) &&
                statuses.includes(v.status) &&
                v.effectiveFrom <= maxDate
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

const settingsMock = {
    findUnique: jest.fn(async ({ where }: { where: { key: string } }) => {
        const value = settings.get(where.key);
        return value === undefined ? null : { key: where.key, value };
    }),
    findMany: jest.fn(async ({ where }: { where?: { key?: { in: string[] } } } = {}) => {
        const keys = where?.key?.in;
        return [...settings.entries()]
            .filter(([key]) => !keys || keys.includes(key))
            .map(([key, value]) => ({ key, value }));
    }),
    deleteMany: jest.fn(async ({ where }: { where: { key?: string; value?: string } }) => {
        let count = 0;
        for (const [key, value] of [...settings.entries()]) {
            if (where.key !== undefined && where.key !== key) continue;
            if (where.value !== undefined && where.value !== value) continue;
            settings.delete(key);
            count++;
        }
        return { count };
    }),
    upsert: jest.fn(
        async ({
            where,
            update,
            create
        }: {
            where: { key: string };
            update: { value: string };
            create: { key: string; value: string };
        }) => {
            const value = update?.value ?? create.value;
            settings.set(where.key, value);
            return { key: where.key, value };
        }
    )
};

const versionMock = {
    findUnique: jest.fn(async ({ where }: { where: { id: string } }) => findVersion(where.id)),
    findFirst: jest.fn(async ({ where }: { where: { id?: string; type?: string } }) =>
        activeCandidate(where)
    ),
    findMany: jest.fn(async ({ where }: { where?: { type?: string } } = {}) =>
        versions.filter((v) => where?.type === undefined || v.type === where.type)
    ),
    updateMany: jest.fn(
        async ({
            where,
            data
        }: {
            where: { id: string; status?: string };
            data: Partial<VRow>;
        }) => {
            const row = versions.find(
                (v) =>
                    v.id === where.id && (where.status === undefined || v.status === where.status)
            );
            if (!row) return { count: 0 };
            Object.assign(row, data);
            return { count: 1 };
        }
    ),
    delete: jest.fn(async ({ where }: { where: { id: string } }) => {
        const idx = versions.findIndex((v) => v.id === where.id);
        if (idx === -1) throw new Error('Not found');
        const [gone] = versions.splice(idx, 1);
        return gone;
    }),
    update: jest.fn(async ({ where, data }: { where: { id: string }; data: Partial<VRow> }) => {
        const row = versions.find((v) => v.id === where.id);
        if (!row) throw new Error('Not found');
        Object.assign(row, data);
        return { ...row };
    })
};

const itemMock = {
    createMany: jest.fn(async ({ data }: { data: Array<Record<string, unknown>> }) => {
        items.push(...data);
        return { count: data.length };
    }),
    deleteMany: jest.fn(async ({ where }: { where: { versionId: string } }) => {
        let count = 0;
        for (let i = items.length - 1; i >= 0; i--) {
            if (items[i]['versionId'] === where.versionId) {
                items.splice(i, 1);
                count++;
            }
        }
        return { count };
    })
};

const txMock = {
    pricelistVersion: versionMock,
    pricelistItemRury: itemMock,
    pricelistItemStudnie: itemMock,
    pricelistItemPrecoKonfig: itemMock,
    pricelistItemPrecoKinety: itemMock,
    pricelistItemPrecoZakresy: itemMock,
    settings: settingsMock,
    offers_rel: { count: jest.fn(async () => 0) },
    offers_studnie_rel: { count: jest.fn(async () => 0) },
    orders_rury_rel: { count: jest.fn(async () => 0) },
    orders_studnie_rel: { count: jest.fn(async () => 0) },
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
        pricelistVersion: versionMock,
        settings: settingsMock,
        offers_rel: { count: jest.fn(async () => 0) },
        offers_studnie_rel: { count: jest.fn(async () => 0) },
        orders_rury_rel: { count: jest.fn(async () => 0) },
        orders_studnie_rel: { count: jest.fn(async () => 0) },
        $transaction: jest.fn(async (fn: (tx: unknown) => Promise<unknown>) => fn(txMock))
    }
}));

jest.mock('../src/utils/logger', () => ({
    logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() }
}));

import {
    approveVersion,
    clearActiveOverride,
    deleteVersion,
    PricelistVersionError,
    readActiveOverrides,
    replaceVersionRows,
    resolveActive,
    setActiveVersion
} from '../src/services/pricelistVersionService';

function seed(input: {
    id: string;
    type?: string;
    seq: number;
    status: string;
    effectiveFrom: string;
}): VRow {
    const row: VRow = {
        version: `v${input.seq}`,
        sha256: 'x',
        type: input.type ?? 'rury',
        ...input
    };
    versions.push(row);
    items.push({ id: `${row.id}:r1`, versionId: row.id });
    return row;
}

beforeEach(() => {
    versions.length = 0;
    items.length = 0;
    audits.length = 0;
    settings.clear();
    jest.clearAllMocks();
});

describe('resolveActive + ręczne wskazanie', () => {
    test('wskazana starsza wersja obowiązuje zamiast najnowszej', async () => {
        seed({ id: 'v1', seq: 1, status: 'APPROVED', effectiveFrom: '2025-01-01T00:00:00.000Z' });
        seed({ id: 'v2', seq: 2, status: 'APPROVED', effectiveFrom: '2026-01-01T00:00:00.000Z' });
        await expect(resolveActive('rury')).resolves.toMatchObject({ id: 'v2' });

        await setActiveVersion('v1');

        await expect(resolveActive('rury')).resolves.toMatchObject({ id: 'v1' });
        expect(settings.get('pricelist_active_override_rury')).toBe('v1');
    });

    test('historyczne rozstrzygnięcie (at) ignoruje wskazanie', async () => {
        seed({ id: 'v1', seq: 1, status: 'APPROVED', effectiveFrom: '2025-01-01T00:00:00.000Z' });
        seed({ id: 'v2', seq: 2, status: 'APPROVED', effectiveFrom: '2026-01-01T00:00:00.000Z' });
        await setActiveVersion('v2');
        await expect(resolveActive('rury', '2025-06-01T00:00:00.000Z')).resolves.toMatchObject({
            id: 'v1'
        });
    });

    test('wskazanie nieistniejącej/niedostępnej wersji jest ignorowane', async () => {
        seed({ id: 'v1', seq: 1, status: 'APPROVED', effectiveFrom: '2025-01-01T00:00:00.000Z' });
        settings.set('pricelist_active_override_rury', 'widmo');
        await expect(resolveActive('rury')).resolves.toMatchObject({ id: 'v1' });
    });

    test('clearActiveOverride wraca do wyboru czasowego + audyt', async () => {
        seed({ id: 'v1', seq: 1, status: 'APPROVED', effectiveFrom: '2025-01-01T00:00:00.000Z' });
        seed({ id: 'v2', seq: 2, status: 'APPROVED', effectiveFrom: '2026-01-01T00:00:00.000Z' });
        await setActiveVersion('v1');
        await expect(clearActiveOverride('rury')).resolves.toEqual({ type: 'rury', cleared: true });
        await expect(resolveActive('rury')).resolves.toMatchObject({ id: 'v2' });
        expect(audits.some((a) => a['action'] === 'ACTIVATE_RESET')).toBe(true);
    });

    test('readActiveOverrides zwraca wskazania per oś', async () => {
        settings.set('pricelist_active_override_rury', 'v1');
        settings.set('pricelist_active_override_preco', 'p1');
        await expect(readActiveOverrides()).resolves.toEqual({
            rury: 'v1',
            studnie: null,
            preco: 'p1'
        });
    });

    test('każda oś ma własne wskazanie (studnie nie dziedziczy z rur)', async () => {
        seed({
            id: 's1',
            type: 'studnie',
            seq: 1,
            status: 'APPROVED',
            effectiveFrom: '2025-01-01T00:00:00.000Z'
        });
        seed({
            id: 's2',
            type: 'studnie',
            seq: 2,
            status: 'APPROVED',
            effectiveFrom: '2026-01-01T00:00:00.000Z'
        });
        await setActiveVersion('s1');
        await expect(resolveActive('studnie')).resolves.toMatchObject({ id: 's1' });
        expect(settings.has('pricelist_active_override_rury')).toBe(false);
    });
});

describe('setActiveVersion — guardy', () => {
    test('szkic → 409 ACTIVATE_NOT_APPROVED', async () => {
        seed({ id: 'd1', seq: 1, status: 'DRAFT', effectiveFrom: '2025-01-01T00:00:00.000Z' });
        const err = await setActiveVersion('d1').catch((e) => e);
        expect(err).toBeInstanceOf(PricelistVersionError);
        expect((err as PricelistVersionError).statusCode).toBe(409);
        expect((err as PricelistVersionError).code).toBe('ACTIVATE_NOT_APPROVED');
        expect(settings.size).toBe(0);
    });

    test('wersja z przyszłą datą → 409 ACTIVATE_NOT_DUE', async () => {
        seed({ id: 'f1', seq: 1, status: 'APPROVED', effectiveFrom: '2999-01-01T00:00:00.000Z' });
        const err = await setActiveVersion('f1').catch((e) => e);
        expect((err as PricelistVersionError).code).toBe('ACTIVATE_NOT_DUE');
        expect(settings.size).toBe(0);
    });

    test('brak wersji → 404', async () => {
        const err = await setActiveVersion('nope').catch((e) => e);
        expect((err as PricelistVersionError).statusCode).toBe(404);
    });

    test('wskazanie zapisuje audyt ACTIVATE', async () => {
        seed({ id: 'v1', seq: 1, status: 'APPROVED', effectiveFrom: '2025-01-01T00:00:00.000Z' });
        await setActiveVersion('v1');
        const audit = audits.find((a) => a['action'] === 'ACTIVATE');
        expect(audit).toBeDefined();
        expect(String(audit?.['newData'] ?? '')).toContain('v1');
    });
});

describe('publikacja nowej wersji zdejmuje ręczne wskazanie', () => {
    test('approve wersji z datą <= now czyści override', async () => {
        seed({ id: 'v1', seq: 1, status: 'APPROVED', effectiveFrom: '2025-01-01T00:00:00.000Z' });
        await setActiveVersion('v1');
        seed({
            id: 'v2',
            seq: 2,
            status: 'DRAFT',
            effectiveFrom: new Date(Date.now() - 1000).toISOString()
        });

        await approveVersion('v2');

        expect(settings.has('pricelist_active_override_rury')).toBe(false);
        await expect(resolveActive('rury')).resolves.toMatchObject({ id: 'v2' });
    });
});

describe('edycja opublikowanej wersji w miejscu', () => {
    const rura = (id: string, price: number) => ({
        id,
        name: `Rura ${id}`,
        category: 'Rury Betonowe',
        price
    });

    test('podmienia wiersze i sha, status/daty bez zmian + audyt EDIT_APPROVED', async () => {
        seed({ id: 'v1', seq: 1, status: 'APPROVED', effectiveFrom: '2025-01-01T00:00:00.000Z' });
        const before = { ...versions[0] };

        const updated = await replaceVersionRows('v1', [rura('R1', 111)], {
            expectedSha: before.sha256
        });

        expect(updated.sha256).not.toBe(before.sha256);
        expect(updated.status).toBe('APPROVED');
        expect(updated.effectiveFrom).toBe(before.effectiveFrom);
        const stored = items.filter((i) => i['versionId'] === 'v1');
        expect(stored).toHaveLength(1);
        expect(stored[0]['price']).toBe(111);
        const audit = audits.find((a) => a['action'] === 'EDIT_APPROVED');
        expect(audit).toBeDefined();
    });

    test('szkic → 409 EDIT_NOT_PUBLISHED (szkic ma własną ścieżkę)', async () => {
        seed({ id: 'd1', seq: 1, status: 'DRAFT', effectiveFrom: '2025-01-01T00:00:00.000Z' });
        const err = await replaceVersionRows('d1', [rura('R1', 100)]).catch((e) => e);
        expect((err as PricelistVersionError).code).toBe('EDIT_NOT_PUBLISHED');
    });

    test('nieaktualny sha → 409 STALE_VERSION, wiersze nietknięte', async () => {
        seed({ id: 'v1', seq: 1, status: 'APPROVED', effectiveFrom: '2025-01-01T00:00:00.000Z' });
        const err = await replaceVersionRows('v1', [rura('R1', 111)], {
            expectedSha: 'inny-sha'
        }).catch((e) => e);
        expect((err as PricelistVersionError).statusCode).toBe(409);
        expect((err as PricelistVersionError).code).toBe('STALE_VERSION');
        expect(items.filter((i) => i['versionId'] === 'v1')).toHaveLength(1);
    });

    test('brak wersji → 404', async () => {
        const err = await replaceVersionRows('nope', [rura('R1', 1)]).catch((e) => e);
        expect((err as PricelistVersionError).statusCode).toBe(404);
    });
});

describe('usuwanie z ręcznym wskazaniem', () => {
    test('wskazana (obowiązująca) wersja → 409 ACTIVE_IN_USE', async () => {
        seed({ id: 'v1', seq: 1, status: 'APPROVED', effectiveFrom: '2025-01-01T00:00:00.000Z' });
        seed({ id: 'v2', seq: 2, status: 'APPROVED', effectiveFrom: '2026-01-01T00:00:00.000Z' });
        await setActiveVersion('v1');
        const err = await deleteVersion('v1').catch((e) => e);
        expect((err as PricelistVersionError).code).toBe('ACTIVE_IN_USE');
    });

    test('historyczna bez ofert → kasuje i sprząta własne wskazanie', async () => {
        seed({ id: 'v1', seq: 1, status: 'APPROVED', effectiveFrom: '2025-01-01T00:00:00.000Z' });
        seed({ id: 'v2', seq: 2, status: 'APPROVED', effectiveFrom: '2026-01-01T00:00:00.000Z' });
        await setActiveVersion('v2');
        await expect(deleteVersion('v1')).resolves.toEqual({ id: 'v1' });
        expect(versions.some((v) => v.id === 'v1')).toBe(false);
        expect(settings.get('pricelist_active_override_rury')).toBe('v2');
    });
});
