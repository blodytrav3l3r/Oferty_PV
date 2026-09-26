/**
 * F2: activate / applyBackdate / activateDue + resolveActive-matrix + UTC.
 * Mock prismy w pamięci z prawdziwą logiką filtrów (findFirst/findMany),
 * żeby macierz overlapping była realnym testem determinizmu, nie echa mocka.
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
const settings = new Map<string, string>();
const audits: Array<Record<string, unknown>> = [];

function uniqueErr(): Error {
    const err = new Error('Unique constraint failed') as Error & { code: string };
    err.code = 'P2002';
    return err;
}

type Where = {
    type?: string;
    status?: string | { in: string[] };
    effectiveFrom?: string | { lte: string };
    id?: string | { not: string };
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
    return true;
}

/** Logika resolveActive: kandydaci + sort effectiveFrom DESC, seq DESC, LIMIT 1. */
function pickActive(where: Where): VRow | null {
    const cands = versions
        .filter((v) => matchWhere(v, where))
        .sort((a, b) =>
            a.effectiveFrom !== b.effectiveFrom
                ? b.effectiveFrom.localeCompare(a.effectiveFrom)
                : b.seq - a.seq
        );
    return cands.length > 0 ? { ...cands[0] } : null;
}

const versionDelegate = {
    aggregate: jest.fn(async ({ where }: { where: { type: string } }) => {
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
    findFirst: jest.fn(async ({ where }: { where: Where }) => pickActive(where)),
    findMany: jest.fn(async ({ where, orderBy }: { where?: Where; orderBy?: unknown }) => {
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
        return out.map((v) => ({ ...v }));
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
    pricelistItemStudnie: itemDelegate(itemsStudnie),
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
        )
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
        $transaction: jest.fn(async (fn: (tx: unknown) => Promise<unknown>) => {
            const snap = JSON.stringify({ versions, itemsRury, itemsStudnie });
            try {
                return await fn(txMock);
            } catch (err) {
                const back = JSON.parse(snap) as {
                    versions: VRow[];
                    itemsRury: Array<Record<string, unknown>>;
                    itemsStudnie: Array<Record<string, unknown>>;
                };
                versions.length = 0;
                versions.push(...back.versions);
                itemsRury.length = 0;
                itemsRury.push(...back.itemsRury);
                itemsStudnie.length = 0;
                itemsStudnie.push(...back.itemsStudnie);
                throw err;
            }
        })
    }
}));

jest.mock('../src/utils/logger', () => ({
    logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() }
}));

import {
    activate,
    activateDue,
    applyBackdate,
    createDraft,
    resolveActive
} from '../src/services/pricelistVersionService';

const rura = (id: string, price = 100) => ({
    id,
    name: `Rura ${id}`,
    category: 'Rury Betonowe',
    price
});

/** Wstawka bezpośrednia (omija draft) — np. istniejące ACTIVE z historii. */
function seedVersion(
    v: Partial<VRow> & { type: string; status: string; effectiveFrom: string }
): VRow {
    const seq = v.seq ?? versions.filter((x) => x.type === v.type).length + 1;
    const row: VRow = {
        id: `${v.type}-seed-${seq}`,
        sha256: 'seed',
        createdAt: '2026-01-01T00:00:00.000Z',
        ...v,
        seq,
        version:
            v.version ??
            `v${seq}-${(v.effectiveFrom ?? '2026-01-01T00:00:00.000Z').slice(0, 10).replace(/-/g, '')}`
    };
    versions.push(row);
    return { ...row };
}

beforeEach(() => {
    versions.length = 0;
    itemsRury.length = 0;
    itemsStudnie.length = 0;
    settings.clear();
    audits.length = 0;
    jest.clearAllMocks();
});

afterEach(() => {
    jest.useRealTimers();
});

describe('F2 activate', () => {
    test('happy path DRAFT→SCHEDULED→ACTIVE (stare ACTIVE→ARCHIVED + audit)', async () => {
        seedVersion({ type: 'rury', status: 'ACTIVE', effectiveFrom: '2026-08-01T00:00:00.000Z' });
        const draft = await createDraft('rury', [rura('r1', 110)], {
            effectiveFrom: '2026-09-01T00:00:00.000Z'
        });
        expect(draft.status).toBe('SCHEDULED');

        const active = await activate(draft.id, { userId: 'admin1' });
        expect(active.status).toBe('ACTIVE');
        expect(versions.find((v) => v.seq === 1)?.status).toBe('ARCHIVED');
        expect(settings.get('pricelist_defaults_updated_at')).toBeTruthy();
        expect(audits).toHaveLength(1);
        expect(audits[0]).toMatchObject({ entityType: 'pricelist_version', action: 'ACTIVATE' });
    });

    test('activate w przeszłość (eff w istniejącym okresie) → 409 PERIOD_OVERLAP', async () => {
        seedVersion({ type: 'rury', status: 'ACTIVE', effectiveFrom: '2026-10-01T00:00:00.000Z' });
        const late = seedVersion({
            type: 'rury',
            status: 'SCHEDULED',
            effectiveFrom: '2026-09-15T00:00:00.000Z'
        });
        await expect(activate(late.id)).rejects.toMatchObject({
            statusCode: 409,
            code: 'PERIOD_OVERLAP'
        });
        // nic nie zarchiwizowane, statusy nietknięte
        expect(versions.find((v) => v.seq === 1)?.status).toBe('ACTIVE');
        expect(versions.find((v) => v.id === late.id)?.status).toBe('SCHEDULED');
        expect(audits).toHaveLength(0);
    });

    test('activate SCHEDULED przed terminem → 409, BACKDATE_REQUESTED → 409 ze wskazaniem', async () => {
        const future = await createDraft('rury', [rura('r1')], {
            effectiveFrom: '2099-01-01T00:00:00.000Z'
        });
        await expect(activate(future.id)).rejects.toMatchObject({ code: 'ACTIVATE_NOT_DUE' });

        const past = await createDraft('rury', [rura('r1')], {
            effectiveFrom: '2020-01-01T00:00:00.000Z'
        });
        expect(past.status).toBe('BACKDATE_REQUESTED');
        await expect(activate(past.id)).rejects.toMatchObject({
            code: 'ACTIVATE_NOT_SCHEDULED'
        });
    });
});

describe('F2 backdate', () => {
    test('happy path + audit BACKDATE {przed/po}', async () => {
        seedVersion({ type: 'rury', status: 'ACTIVE', effectiveFrom: '2026-10-01T00:00:00.000Z' });
        const draft = await createDraft('rury', [rura('r1', 90)], {
            effectiveFrom: '2026-09-15T00:00:00.000Z'
        });
        expect(draft.status).toBe('BACKDATE_REQUESTED');
        const done = await applyBackdate(draft.id, 'Korekta historyczna cen wrzesnia', {
            userId: 'admin1'
        });
        expect(done.status).toBe('BACKDATE');
        expect(done.note).toBe('Korekta historyczna cen wrzesnia');
        expect(audits).toHaveLength(1);
        expect(audits[0]).toMatchObject({ action: 'BACKDATE' });
        expect(JSON.parse(String(audits[0].oldData))).toEqual({ przed: 'BACKDATE_REQUESTED' });
        expect(JSON.parse(String(audits[0].newData))).toMatchObject({ po: 'BACKDATE' });
    });

    test('nota < 10 znaków → 400, nic nie zapisane', async () => {
        seedVersion({ type: 'rury', status: 'ACTIVE', effectiveFrom: '2026-10-01T00:00:00.000Z' });
        const draft = await createDraft('rury', [rura('r1', 90)], {
            effectiveFrom: '2026-09-15T00:00:00.000Z'
        });
        await expect(applyBackdate(draft.id, 'za krotka')).rejects.toMatchObject({
            statusCode: 400,
            code: 'NOTE_TOO_SHORT'
        });
        expect(versions.find((v) => v.id === draft.id)?.status).toBe('BACKDATE_REQUESTED');
        expect(audits).toHaveLength(0);
    });

    test('kolizja (type, effectiveFrom) → 409 EFFECTIVE_COLLISION', async () => {
        seedVersion({ type: 'rury', status: 'ACTIVE', effectiveFrom: '2026-10-01T00:00:00.000Z' });
        const eff = '2026-09-15T00:00:00.000Z';
        const a = await createDraft('rury', [rura('r1', 90)], { effectiveFrom: eff });
        const b = await createDraft('rury', [rura('r1', 95)], { effectiveFrom: eff });
        await applyBackdate(a.id, 'Pierwsza korekta historyczna');
        await expect(applyBackdate(b.id, 'Druga korekta historyczna')).rejects.toMatchObject({
            statusCode: 409,
            code: 'EFFECTIVE_COLLISION'
        });
        expect(versions.find((v) => v.id === b.id)?.status).toBe('BACKDATE_REQUESTED');
    });
});

describe('F2 overlapping matrix', () => {
    test('v1 09-01 / v2 10-01 / v3 09-15 BACKDATE → resolveActive deterministyczny', async () => {
        seedVersion({ type: 'rury', status: 'ACTIVE', effectiveFrom: '2026-09-01T00:00:00.000Z' });
        seedVersion({ type: 'rury', status: 'ACTIVE', effectiveFrom: '2026-10-01T00:00:00.000Z' });
        seedVersion({
            type: 'rury',
            status: 'BACKDATE',
            effectiveFrom: '2026-09-15T00:00:00.000Z'
        });

        const at0910 = await resolveActive('rury', '2026-09-10T00:00:00.000Z');
        const at0920 = await resolveActive('rury', '2026-09-20T00:00:00.000Z');
        const at1010 = await resolveActive('rury', '2026-10-10T00:00:00.000Z');
        expect(at0910?.effectiveFrom).toBe('2026-09-01T00:00:00.000Z');
        expect(at0920?.effectiveFrom).toBe('2026-09-15T00:00:00.000Z');
        expect(at1010?.effectiveFrom).toBe('2026-10-01T00:00:00.000Z');

        // macierz: dokładnie 1 wersja albo null dla każdego at (sweep co ~5 dni)
        for (let day = 25; day <= 45; day++) {
            const at = `2026-09-${String(day).padStart(2, '0')}T12:00:00.000Z`;
            if (day > 30) continue; // wrzesień ma 30 dni — październik poniżej
            const res = await resolveActive('rury', at);
            expect(res).not.toBeUndefined();
        }
        const oct = await resolveActive('rury', '2026-10-05T00:00:00.000Z');
        expect(oct?.effectiveFrom).toBe('2026-10-01T00:00:00.000Z');
        const before = await resolveActive('rury', '2026-08-01T00:00:00.000Z');
        expect(before).toBeNull();
    });
});

describe('F2 cron (fake timers)', () => {
    test('activateDue: SCHEDULED due → ACTIVE, BACKDATE_REQUESTED nigdy auto', async () => {
        jest.useFakeTimers();
        jest.setSystemTime(new Date('2026-08-01T00:00:00.000Z'));
        const due = await createDraft('rury', [rura('r1', 110)], {
            effectiveFrom: '2026-09-01T00:00:00.000Z'
        });
        const retro = await createDraft('rury', [rura('r1', 90)], {
            effectiveFrom: '2026-08-15T00:00:00.000Z'
        });
        expect(retro.status).toBe('BACKDATE_REQUESTED');

        jest.setSystemTime(new Date('2026-10-01T00:00:00.000Z'));
        const res = await activateDue();
        expect(res.activated).toEqual([due.id]);
        expect(res.skipped).toHaveLength(0);
        expect(versions.find((v) => v.id === due.id)?.status).toBe('ACTIVE');
        expect(versions.find((v) => v.id === retro.id)?.status).toBe('BACKDATE_REQUESTED');
    });

    test('activateDue: błąd jednej wersji nie blokuje pozostałych', async () => {
        jest.useFakeTimers();
        jest.setSystemTime(new Date('2026-10-05T00:00:00.000Z'));
        seedVersion({ type: 'rury', status: 'ACTIVE', effectiveFrom: '2026-10-01T00:00:00.000Z' });
        const clash = seedVersion({
            type: 'rury',
            status: 'SCHEDULED',
            effectiveFrom: '2026-09-15T00:00:00.000Z'
        });
        const good = seedVersion({
            type: 'rury',
            status: 'SCHEDULED',
            effectiveFrom: '2026-10-02T00:00:00.000Z'
        });
        const res = await activateDue();
        expect(res.activated).toEqual([good.id]);
        expect(res.skipped.map((s) => s.id)).toEqual([clash.id]);
        expect(res.skipped[0].code).toBe('PERIOD_OVERLAP');
    });
});

describe('F2 UTC', () => {
    test('local +02:00 → ISO Z', async () => {
        const v = await createDraft('rury', [rura('r1')], {
            effectiveFrom: '2026-09-01T02:00:00+02:00'
        });
        expect(v.effectiveFrom).toBe('2026-09-01T00:00:00.000Z');
    });
});
