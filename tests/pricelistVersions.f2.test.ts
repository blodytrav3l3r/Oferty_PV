/**
 * F2/S2a: approveVersion + legacy aliasy (activate/backdate) + resolveActive-matrix.
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
    updatedAt?: string;
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
        // Ręczny wybór obowiązującego cennika — brak = wybór czasowy.
        settings: {
            findUnique: jest.fn(async () => null),
            findMany: jest.fn(async () => []),
            deleteMany: jest.fn(async () => ({ count: 0 }))
        },
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
    applyBackdate,
    approveVersion,
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

describe('S2a approveVersion', () => {
    test('createDraft zawsze DRAFT (przyszła i przeszła data)', async () => {
        const future = await createDraft('rury', [rura('r1')], {
            effectiveFrom: '2099-01-01T00:00:00.000Z'
        });
        // Jeden szkic na typ: publikacja zwalnia miejsce na kolejny.
        await approveVersion(future.id);
        const past = await createDraft('rury', [rura('r1')], {
            effectiveFrom: '2020-01-01T00:00:00.000Z'
        });
        expect(future.status).toBe('DRAFT');
        expect(past.status).toBe('DRAFT');
    });

    test('approve ze zmienioną datą przelicza labelkę {Prefiks}v{seq}-data', async () => {
        const draft = await createDraft('rury', [rura('r1')], {
            effectiveFrom: '2026-09-01T00:00:00.000Z'
        });
        expect(draft.version).toBe('Rv1-20260901');
        const approved = await approveVersion(draft.id, {
            effectiveFrom: '2026-12-15T00:00:00.000Z'
        });
        expect(approved.effectiveFrom).toBe('2026-12-15T00:00:00.000Z');
        expect(approved.version).toBe('Rv1-20261215');
    });

    test('approve zapisuje APPROVED + approvedBy/At i audit APPROVE', async () => {
        const draft = await createDraft('rury', [rura('r1', 110)], {
            effectiveFrom: '2026-09-01T00:00:00.000Z'
        });
        const approved = await approveVersion(draft.id, { userId: 'admin1' });
        expect(approved.status).toBe('APPROVED');
        expect(approved.effectiveFrom).toBe('2026-09-01T00:00:00.000Z');
        expect(approved.approvedBy).toBe('admin1');
        expect(approved.approvedAt).toBeTruthy();
        // „ostatnia zmiana" ustawiona przy publikacji
        expect(approved.updatedAt).toBeTruthy();
        expect(settings.get('pricelist_defaults_updated_at')).toBeTruthy();
        expect(audits).toHaveLength(2);
        expect(audits[1]).toMatchObject({ action: 'APPROVE' });
        expect(JSON.parse(String(audits[1].oldData))).toEqual({ przed: 'DRAFT' });
        expect(JSON.parse(String(audits[1].newData))).toMatchObject({
            po: 'APPROVED',
            effectiveFrom: '2026-09-01T00:00:00.000Z'
        });
    });

    test('approve z przeszłą datą bez noty → 400 NOTE_TOO_SHORT, wersja zostaje DRAFT', async () => {
        const draft = await createDraft('rury', [rura('r1')], {
            effectiveFrom: '2099-01-01T00:00:00.000Z'
        });
        await expect(
            approveVersion(draft.id, {
                effectiveFrom: '2020-01-01T00:00:00.000Z',
                requirePastNote: true
            })
        ).rejects.toMatchObject({ statusCode: 400, code: 'NOTE_TOO_SHORT' });
        expect(versions.find((v) => v.id === draft.id)?.status).toBe('DRAFT');

        const ok = await approveVersion(draft.id, {
            effectiveFrom: '2020-01-01T00:00:00.000Z',
            note: 'korekta wsteczna',
            requirePastNote: true
        });
        expect(ok.status).toBe('APPROVED');
        expect(ok.effectiveFrom).toBe('2020-01-01T00:00:00.000Z');
    });

    test('approve z pustą notą nie może wyczyścić uzasadnienia korekty', async () => {
        const draft = await createDraft('rury', [rura('r1')], {
            effectiveFrom: '2020-01-01T00:00:00.000Z',
            note: 'uzasadnienie historyczne'
        });
        await expect(
            approveVersion(draft.id, { note: '', requirePastNote: true })
        ).rejects.toMatchObject({ statusCode: 400, code: 'NOTE_TOO_SHORT' });
        expect(versions.find((v) => v.id === draft.id)?.note).toBe('uzasadnienie historyczne');
    });

    test('powtórny approve tej samej wersji → 409 APPROVE_NOT_DRAFT', async () => {
        const draft = await createDraft('rury', [rura('r1')], {
            effectiveFrom: '2026-09-01T00:00:00.000Z'
        });
        await approveVersion(draft.id);
        await expect(approveVersion(draft.id)).rejects.toMatchObject({
            statusCode: 409,
            code: 'APPROVE_NOT_DRAFT'
        });
    });

    test('kolizja (type, effectiveFrom) → 409 EFFECTIVE_COLLISION, drugi zostaje DRAFT', async () => {
        const eff = '2026-09-15T00:00:00.000Z';
        const a = await createDraft('rury', [rura('r1', 90)], { effectiveFrom: eff });
        await approveVersion(a.id);
        // b powstaje po publikacji a — jeden szkic na typ.
        const b = await createDraft('rury', [rura('r1', 95)], { effectiveFrom: eff });
        await expect(approveVersion(b.id)).rejects.toMatchObject({
            statusCode: 409,
            code: 'EFFECTIVE_COLLISION'
        });
        expect(versions.find((v) => v.id === b.id)?.status).toBe('DRAFT');
    });
});

describe('S2a aliasy legacy', () => {
    test('activate: przyszła data → ACTIVATE_NOT_DUE, przeszła → APPROVED', async () => {
        const future = await createDraft('rury', [rura('r1')], {
            effectiveFrom: '2099-01-01T00:00:00.000Z'
        });
        await expect(activate(future.id)).rejects.toMatchObject({ code: 'ACTIVATE_NOT_DUE' });

        // activate nie rusza przyszłej wersji, więc zwalniamy slot bez publikacji.
        const stored = versions.find((v) => v.id === future.id);
        if (stored) stored.status = 'APPROVED';

        const past = await createDraft('rury', [rura('r1')], {
            effectiveFrom: '2020-01-01T00:00:00.000Z'
        });
        await expect(activate(past.id)).resolves.toMatchObject({ status: 'APPROVED' });
    });

    test('backdate: nota < 10 znaków → 400, nic nie zapisane', async () => {
        const draft = await createDraft('rury', [rura('r1', 90)], {
            effectiveFrom: '2020-09-15T00:00:00.000Z'
        });
        await expect(applyBackdate(draft.id, 'za krotka')).rejects.toMatchObject({
            statusCode: 400,
            code: 'NOTE_TOO_SHORT'
        });
        expect(versions.find((v) => v.id === draft.id)?.status).toBe('DRAFT');
        expect(audits).toHaveLength(1);
        expect(audits[0]).toMatchObject({ action: 'CREATE' });
    });

    test('backdate: nota ≥ 10 znaków → APPROVED + nota + audit APPROVE', async () => {
        const draft = await createDraft('rury', [rura('r1', 90)], {
            effectiveFrom: '2020-09-15T00:00:00.000Z'
        });
        const done = await applyBackdate(draft.id, 'Korekta historyczna cen wrzesnia', {
            userId: 'admin1'
        });
        expect(done.status).toBe('APPROVED');
        expect(done.note).toBe('Korekta historyczna cen wrzesnia');
        expect(audits).toHaveLength(2);
        expect(JSON.parse(String(audits[1].newData))).toMatchObject({
            po: 'APPROVED',
            note: 'Korekta historyczna cen wrzesnia'
        });
    });
});

describe('S2a resolveActive matrix (tylko APPROVED)', () => {
    test('najnowsza APPROVED <= at; DRAFT nigdy nie wygrywa', async () => {
        seedVersion({
            type: 'rury',
            status: 'APPROVED',
            effectiveFrom: '2026-09-01T00:00:00.000Z'
        });
        seedVersion({
            type: 'rury',
            status: 'APPROVED',
            effectiveFrom: '2026-10-01T00:00:00.000Z'
        });
        seedVersion({ type: 'rury', status: 'DRAFT', effectiveFrom: '2026-11-01T00:00:00.000Z' });

        expect((await resolveActive('rury', '2026-09-10T00:00:00.000Z'))?.effectiveFrom).toBe(
            '2026-09-01T00:00:00.000Z'
        );
        expect((await resolveActive('rury', '2026-10-05T00:00:00.000Z'))?.effectiveFrom).toBe(
            '2026-10-01T00:00:00.000Z'
        );
        expect(await resolveActive('rury', '2026-08-01T00:00:00.000Z')).toBeNull();
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
