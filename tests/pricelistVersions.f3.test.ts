/**
 * F3: freeze ofert — oferta zapisuje versionId + snapshot; zmiana ACTIVE nie
 * rusza historii (co do grosza); odtworzenie ceny historycznej z versionId;
 * E2E freeze (oferta v1 → activate v2 → nowa v2, stara v1).
 *
 * Mock prismy w pamięci (wzorzec F1/F2). Freeze = resolveActive(now) przez
 * null-safe resolveVersionIdSafe (wpięcie w POST /offers rury+studnie);
 * daty w przeszłości względem realnego now (activate używa Date()).
 */

import * as fs from 'fs';
import * as path from 'path';

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

let findFirstFails = false;

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
        versions.push({ ...data });
        return { ...data };
    }),
    findUnique: jest.fn(async ({ where }: { where: { id: string } }) => {
        return versions.find((v) => v.id === where.id) ?? null;
    }),
    findFirst: jest.fn(async ({ where }: { where: Where }) => {
        if (findFirstFails) throw new Error('DB down');
        return pickActive(where);
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

// Współdzielone delegaty itemów: zapis (tx) i odczyt (root) widzą ten sam store.
const ruryItems = itemDelegate(itemsRury);
const studnieItems = itemDelegate([]);
const precoKonfigItems = itemDelegate([]);
const precoKinetyItems = itemDelegate([]);
const precoZakresyItems = itemDelegate([]);

const txMock = {
    pricelistVersion: versionDelegate,
    pricelistItemRury: ruryItems,
    pricelistItemStudnie: studnieItems,
    pricelistItemPrecoKonfig: precoKonfigItems,
    pricelistItemPrecoKinety: precoKinetyItems,
    pricelistItemPrecoZakresy: precoZakresyItems,
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
        // getVersionExport czyta itemy przez root prisma (nie tx) — ten sam store.
        pricelistItemRury: ruryItems,
        pricelistItemStudnie: studnieItems,
        pricelistItemPrecoKonfig: precoKonfigItems,
        pricelistItemPrecoKinety: precoKinetyItems,
        pricelistItemPrecoZakresy: precoZakresyItems,
        $transaction: jest.fn(async (fn: (tx: unknown) => Promise<unknown>) => fn(txMock))
    }
}));

jest.mock('../src/utils/logger', () => ({
    logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() }
}));

import {
    createDraft,
    activateDue,
    resolveActive,
    resolveVersionIdSafe,
    getVersionExport
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
    settings.clear();
    audits.length = 0;
    findFirstFails = false;
    jest.clearAllMocks();
});

/** Mini-model oferty: versionId + snapshot cen w JSON (jak POST /offers). */
interface OfferDoc {
    id: string;
    createdAt: string;
    pricelistVersionId: string | null;
    snapshot: Array<{ productId: string; price: number; quantity: number }>;
}

async function createOfferDoc(
    id: string,
    rows: Array<{ productId: string; price: number; quantity: number }>
): Promise<OfferDoc> {
    return {
        id,
        createdAt: new Date().toISOString(),
        // Wpięcie z POST /offers: null-safe, snapshot bez zmian.
        pricelistVersionId: await resolveVersionIdSafe('rury'),
        snapshot: rows.map((r) => ({ ...r }))
    };
}

describe('F3 freeze ofert', () => {
    test('oferta zapisuje versionId + snapshot; brak wersji → null (legacy)', async () => {
        const legacy = await createOfferDoc('o-legacy', [
            { productId: 'r1', price: 100, quantity: 2 }
        ]);
        expect(legacy.pricelistVersionId).toBeNull();
        expect(legacy.snapshot).toEqual([{ productId: 'r1', price: 100, quantity: 2 }]);

        const v1 = await createDraft('rury', [rura('r1', 100)], {
            effectiveFrom: '2020-09-01T00:00:00.000Z'
        });
        await activateDue();
        expect((await resolveActive('rury'))?.id).toBe(v1.id);

        const o1 = await createOfferDoc('o1', [{ productId: 'r1', price: 100, quantity: 2 }]);
        expect(o1.pricelistVersionId).toBe(v1.id);
        // Snapshot cen w JSON bez zmian — źródło prawdy oferty.
        expect(o1.snapshot).toEqual([{ productId: 'r1', price: 100, quantity: 2 }]);
    });

    test('resolveVersionIdSafe null-safe przy błędzie odczytu', async () => {
        await createDraft('rury', [rura('r1')], { effectiveFrom: '2020-09-01T00:00:00.000Z' });
        findFirstFails = true;
        await expect(resolveVersionIdSafe('rury')).resolves.toBeNull();
    });

    test('zmiana ACTIVE nie rusza historii (co do grosza) + odtworzenie z versionId', async () => {
        const v1 = await createDraft('rury', [rura('r1', 100)], {
            effectiveFrom: '2020-09-01T00:00:00.000Z'
        });
        await activateDue();
        const before = await getVersionExport(v1.id);
        expect(before.sections.rury).toHaveLength(1);
        expect(before.sections.rury[0].price).toBe(100);

        const v2 = await createDraft('rury', [rura('r1', 110)], {
            effectiveFrom: '2020-10-01T00:00:00.000Z'
        });
        await activateDue();
        expect((await resolveActive('rury'))?.id).toBe(v2.id);

        // Historia v1 nietknięta co do grosza (immutability + brak update items).
        const after = await getVersionExport(v1.id);
        expect(after.sections.rury).toEqual(before.sections.rury);
        expect(after.sections.rury[0].price).toBe(100);
        // Odtworzenie ceny historycznej z versionId (nie z resolveActive).
        const cur = await getVersionExport(v2.id);
        expect(cur.sections.rury[0].price).toBe(110);
    });

    test('E2E freeze: oferta v1 → activate v2 → nowa v2, stara v1', async () => {
        const v1 = await createDraft('rury', [rura('r1', 100)], {
            effectiveFrom: '2020-09-01T00:00:00.000Z'
        });
        await activateDue();
        const stara = await createOfferDoc('stara', [{ productId: 'r1', price: 100, quantity: 1 }]);
        expect(stara.pricelistVersionId).toBe(v1.id);

        const v2 = await createDraft('rury', [rura('r1', 110)], {
            effectiveFrom: '2020-10-01T00:00:00.000Z'
        });
        await activateDue();

        const nowa = await createOfferDoc('nowa', [{ productId: 'r1', price: 110, quantity: 1 }]);
        expect(nowa.pricelistVersionId).toBe(v2.id);
        // Stara oferta zamrożona na v1 (pole niezmienione, snapshot bez zmian).
        expect(stara.pricelistVersionId).toBe(v1.id);
        expect(stara.snapshot).toEqual([{ productId: 'r1', price: 100, quantity: 1 }]);
        // Rekonstrukcja obu cen z versionId.
        expect(
            (await getVersionExport(stara.pricelistVersionId as string)).sections.rury[0].price
        ).toBe(100);
        expect(
            (await getVersionExport(nowa.pricelistVersionId as string)).sections.rury[0].price
        ).toBe(110);
    });

    test('wpięcie freeze w trasach POST /offers (rury + studnie)', () => {
        const root = path.join(__dirname, '..');
        const rury = fs.readFileSync(path.join(root, 'src/routes/offers/ruryCrud.ts'), 'utf8');
        const studnie = fs.readFileSync(
            path.join(root, 'src/routes/offers/studnieCrud.ts'),
            'utf8'
        );
        for (const src of [rury, studnie]) {
            expect(src).toContain('resolveVersionIdSafe');
            expect(src).toContain('pricelistVersionId');
        }
        // Update nie nadpisuje freeze (tylko createData/create).
        expect(rury).toContain('pricelistVersionId: w.pricelistVersionId');
    });
});
