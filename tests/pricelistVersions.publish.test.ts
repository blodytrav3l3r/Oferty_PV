/**
 * Publish roboczej (DRAFT → SCHEDULED / BACKDATE_REQUESTED) + audyt
 * CREATE/UPDATE + diff top zmian cen + ?source=active + klucz
 * pricelist_active_updated_at.
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
const settings = new Map<string, string>();
const audits: Array<Record<string, unknown>> = [];

type Where = {
    type?: string;
    status?: string | { in: string[] };
    effectiveFrom?: string | { lte: string };
    id?: string | { not: string };
    seq?: number | { lte: number };
};

function matchWhere(v: VRow, where: Where | undefined): boolean {
    if (!where) return true;
    if (where.type !== undefined && v.type !== where.type) return false;
    if (where.status !== undefined) {
        if (typeof where.status === 'string') {
            if (v.status !== where.status) return false;
        } else if (!where.status.in.includes(v.status)) return false;
    }
    if (where.effectiveFrom !== undefined) {
        if (typeof where.effectiveFrom === 'string') {
            if (v.effectiveFrom !== where.effectiveFrom) return false;
        } else if (!(v.effectiveFrom <= where.effectiveFrom.lte)) return false;
    }
    if (where.id !== undefined) {
        if (typeof where.id === 'string') {
            if (v.id !== where.id) return false;
        } else if (v.id === where.id.not) return false;
    }
    if (where.seq !== undefined) {
        if (typeof where.seq === 'number') {
            if (v.seq !== where.seq) return false;
        } else if (!(v.seq <= where.seq.lte)) return false;
    }
    return true;
}

const versionDelegate = {
    aggregate: jest.fn(async ({ where }: { where: Where }) => {
        const vs = versions.filter((v) => matchWhere(v, where));
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
        versions.push({ ...data });
        return { ...data };
    }),
    findUnique: jest.fn(async ({ where }: { where: { id: string } }) => {
        return versions.find((v) => v.id === where.id) ?? null;
    }),
    findFirst: jest.fn(async ({ where, orderBy }: { where?: Where; orderBy?: unknown }) => {
        let out = versions.filter((v) => matchWhere(v, where));
        if (Array.isArray(orderBy)) {
            out = [...out].sort((a, b) => {
                for (const clause of orderBy as Array<Record<string, string>>) {
                    if (clause.effectiveFrom) {
                        const d =
                            a.effectiveFrom.localeCompare(b.effectiveFrom) *
                            (clause.effectiveFrom === 'asc' ? 1 : -1);
                        if (d !== 0) return d;
                    }
                    if (clause.seq) {
                        const d = (a.seq - b.seq) * (clause.seq === 'asc' ? 1 : -1);
                        if (d !== 0) return d;
                    }
                }
                return 0;
            });
        }
        return out.length > 0 ? { ...out[0] } : null;
    }),
    findMany: jest.fn(async ({ where }: { where?: Where }) => {
        return versions.filter((v) => matchWhere(v, where)).map((v) => ({ ...v }));
    }),
    update: jest.fn(async ({ where, data }: { where: { id: string }; data: Partial<VRow> }) => {
        const v = versions.find((x) => x.id === where.id);
        if (!v) throw new Error('Not found');
        Object.assign(v, data);
        return { ...v };
    }),
    updateMany: jest.fn(async ({ where, data }: { where: Where; data: Partial<VRow> }) => {
        let count = 0;
        for (const v of versions) {
            if (matchWhere(v, where)) {
                Object.assign(v, data);
                count++;
            }
        }
        return { count };
    }),
    delete: jest.fn(async ({ where }: { where: { id: string } }) => {
        const i = versions.findIndex((v) => v.id === where.id);
        if (i === -1) throw new Error('Not found');
        const [gone] = versions.splice(i, 1);
        return gone;
    })
};

function itemDelegate(store: Array<Record<string, unknown>>) {
    return {
        createMany: jest.fn(async ({ data }: { data: Array<Record<string, unknown>> }) => {
            store.push(...data);
            return { count: data.length };
        }),
        deleteMany: jest.fn(async ({ where }: { where?: { versionId?: string } }) => {
            if (!where?.versionId) {
                const n = store.length;
                store.length = 0;
                return { count: n };
            }
            let n = 0;
            for (let i = store.length - 1; i >= 0; i--) {
                if (store[i].versionId === where.versionId) {
                    store.splice(i, 1);
                    n++;
                }
            }
            return { count: n };
        }),
        findMany: jest.fn(async ({ where }: { where?: { versionId?: string } }) => {
            const out = !where?.versionId
                ? [...store]
                : store.filter((r) => r.versionId === where.versionId);
            return out.map((r) => ({ ...r }));
        })
    };
}

const txMock = {
    pricelistVersion: versionDelegate,
    pricelistItemRury: itemDelegate(itemsRury),
    pricelistItemStudnie: itemDelegate([]),
    pricelistItemPrecoKonfig: itemDelegate([]),
    pricelistItemPrecoKinety: itemDelegate([]),
    pricelistItemPrecoZakresy: itemDelegate([]),
    settings: {
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
        ),
        deleteMany: jest.fn(async ({ where }: { where: { key?: string; value?: string } }) => {
            let count = 0;
            for (const [key, value] of [...settings.entries()]) {
                if (where.key !== undefined && where.key !== key) continue;
                if (where.value !== undefined && where.value !== value) continue;
                settings.delete(key);
                count++;
            }
            return { count };
        })
    },
    audit_logs: {
        create: jest.fn(async ({ data }: { data: Record<string, unknown> }) => {
            audits.push({ ...data });
            return { ...data };
        })
    }
};

jest.mock('../src/prismaClient', () => ({
    __esModule: true,
    default: {
        pricelistVersion: versionDelegate,
        pricelistItemRury: txMock.pricelistItemRury,
        pricelistItemStudnie: txMock.pricelistItemStudnie,
        pricelistItemPrecoKonfig: txMock.pricelistItemPrecoKonfig,
        pricelistItemPrecoKinety: txMock.pricelistItemPrecoKinety,
        pricelistItemPrecoZakresy: txMock.pricelistItemPrecoZakresy,
        // Ręczny wybór obowiązującego cennika — brak = wybór czasowy.
        settings: {
            findUnique: jest.fn(async () => null),
            findMany: jest.fn(async () => []),
            deleteMany: jest.fn(async () => ({ count: 0 }))
        },
        $transaction: jest.fn(async (fn: (tx: unknown) => Promise<unknown>) => fn(txMock))
    }
}));

jest.mock('../src/utils/logger', () => ({
    logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() }
}));

import {
    activate,
    createDraft,
    getVersionDiff,
    publishDraft,
    requireExportSource,
    updateDraft
} from '../src/services/pricelistVersionService';
import { ACTIVE_UPDATED_AT_KEY } from '../src/services/pricelist/lifecycle';
import { deriveState } from '../src/services/pricelist/validation';

const rura = (id: string, price = 100) => ({
    id,
    name: `Rura ${id}`,
    category: 'Rury Betonowe',
    price
});

beforeEach(() => {
    versions.length = 0;
    itemsRury.length = 0;
    settings.clear();
    audits.length = 0;
    jest.clearAllMocks();
});

describe('publishDraft — domknięcie ślepej uliczki DRAFT', () => {
    test('DRAFT z przyszłą datą → APPROVED (SCHEDULED) + audit APPROVE', async () => {
        versions.push({
            id: 'rury-seed-1',
            type: 'rury',
            seq: 1,
            version: 'v1-20260801',
            status: 'APPROVED',
            effectiveFrom: '2026-08-01T00:00:00.000Z',
            sha256: 'seed'
        });
        const clone = {
            id: 'draft-1',
            type: 'rury',
            seq: 2,
            version: 'v2-20990101',
            status: 'DRAFT',
            effectiveFrom: '2099-01-01T00:00:00.000Z',
            sha256: 'draft'
        };
        versions.push({ ...clone });
        const out = await publishDraft('draft-1', { userId: 'admin1' });
        expect(out.status).toBe('APPROVED');
        expect(deriveState(out.status, out.effectiveFrom)).toBe('SCHEDULED');
        expect(audits).toHaveLength(1);
        expect(audits[0]).toMatchObject({ action: 'APPROVE' });
        expect(settings.has(ACTIVE_UPDATED_AT_KEY)).toBe(false);
    });

    test('DRAFT z przeszłą datą → APPROVED (ACTIVE) bez noty', async () => {
        versions.push({
            id: 'rury-seed-1',
            type: 'rury',
            seq: 1,
            version: 'v1-20261001',
            status: 'APPROVED',
            effectiveFrom: '2026-10-01T00:00:00.000Z',
            sha256: 'seed'
        });
        versions.push({
            id: 'draft-1',
            type: 'rury',
            seq: 2,
            version: 'v2-20260901',
            status: 'DRAFT',
            effectiveFrom: '2026-09-01T00:00:00.000Z',
            sha256: 'draft'
        });
        const out = await publishDraft('draft-1');
        expect(out.status).toBe('APPROVED');
        expect(
            deriveState(out.status, out.effectiveFrom, new Date('2026-10-21T00:00:00.000Z'))
        ).toBe('ACTIVE');
    });

    test('nie-DRAFT → 409 APPROVE_NOT_DRAFT, nic nie ruszone', async () => {
        versions.push({
            id: 's1',
            type: 'rury',
            seq: 1,
            version: 'v1-20990101',
            status: 'APPROVED',
            effectiveFrom: '2099-01-01T00:00:00.000Z',
            sha256: 'seed'
        });
        await expect(publishDraft('s1')).rejects.toMatchObject({
            statusCode: 409,
            code: 'APPROVE_NOT_DRAFT'
        });
        expect(audits).toHaveLength(0);
    });

    test('pełny łańcuch klon → publish → stan ACTIVE po dacie', async () => {
        versions.push({
            id: 'draft-1',
            type: 'rury',
            seq: 1,
            version: 'v1-20990101',
            status: 'DRAFT',
            effectiveFrom: '2099-01-01T00:00:00.000Z',
            sha256: 'draft'
        });
        const pub = await publishDraft('draft-1');
        expect(pub.status).toBe('APPROVED');
        expect(
            deriveState(pub.status, pub.effectiveFrom, new Date('2099-02-01T00:00:00.000Z'))
        ).toBe('ACTIVE');
    });
});

describe('audyt CREATE/UPDATE', () => {
    test('createDraft pisze CREATE, updateDraft pisze UPDATE', async () => {
        const v = await createDraft('rury', [rura('r1')], {
            effectiveFrom: '2026-09-01T00:00:00.000Z'
        });
        expect(audits).toHaveLength(1);
        expect(audits[0]).toMatchObject({ action: 'CREATE' });
        await updateDraft(v.id, undefined, 'korekta noty');
        expect(audits).toHaveLength(2);
        expect(audits[1]).toMatchObject({ action: 'UPDATE' });
    });
});

describe('diff z top zmian cen', () => {
    test('changed z deltaPct + added/removed w changes', async () => {
        const v1 = await createDraft('rury', [rura('r1', 100), rura('r2', 50)], {
            effectiveFrom: '2026-09-01T00:00:00.000Z'
        });
        // Jeden szkic na typ: v1 musi być opublikowana, zanim powstanie v2.
        const stored = versions.find((v) => v.id === v1.id);
        if (stored) stored.status = 'APPROVED';
        const v2 = await createDraft('rury', [rura('r1', 110), rura('r3', 70)], {
            effectiveFrom: '2026-10-01T00:00:00.000Z'
        });
        expect(v1.seq).toBe(1);
        expect(v2.seq).toBe(2);
        const diff = await getVersionDiff(v2.id);
        expect(diff.sections.rury).toMatchObject({ added: 1, removed: 1, changed: 1 });
        const changed = diff.changes.find((c) => c.id === 'r1');
        expect(changed).toMatchObject({ kind: 'changed', before: 100, after: 110, deltaPct: 10 });
        expect(diff.changes.find((c) => c.id === 'r3')?.kind).toBe('added');
        expect(diff.changes.find((c) => c.id === 'r2')?.kind).toBe('removed');
        expect(diff.truncated).toBe(false);
    });
});

describe('source=active + osobny klucz timestampu', () => {
    test("requireExportSource akceptuje 'active', odrzuca 'live'", () => {
        expect(requireExportSource('active')).toBe('active');
        expect(() => requireExportSource('live')).toThrow();
    });

    test('activate bumpuje oba klucze', async () => {
        versions.push({
            id: 'rury-seed-1',
            type: 'rury',
            seq: 1,
            version: 'v1-20260801',
            status: 'ACTIVE',
            effectiveFrom: '2026-08-01T00:00:00.000Z',
            sha256: 'seed'
        });
        const draft = await createDraft('rury', [rura('r1', 110)], {
            effectiveFrom: '2026-09-01T00:00:00.000Z'
        });
        await activate(draft.id);
        expect(settings.get('pricelist_defaults_updated_at')).toBeTruthy();
        expect(settings.get(ACTIVE_UPDATED_AT_KEY)).toBeTruthy();
    });
});
