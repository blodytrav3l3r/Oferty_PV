/**
 * ensureActivePricelistVersions: LIVE bez wersji → ACTIVE z labelką serwisu;
 * z wersjami → skip; puste LIVE → skip; race → 1 wersja; jedna tx.
 */
import { ensureActivePricelistVersions } from '../src/services/ensureActiveVersions';
import { sha256Canonical } from '../src/services/priceOverrideService';
import { versionLabel } from '../src/services/pricelistVersionService';

jest.mock('../src/utils/logger', () => ({
    logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() }
}));

jest.mock('../src/prismaClient', () => ({
    __esModule: true,
    default: {
        pricelistVersion: { count: jest.fn(), create: jest.fn(), aggregate: jest.fn() },
        productsRury: { count: jest.fn(), findMany: jest.fn() },
        productsStudnie: { count: jest.fn(), findMany: jest.fn() },
        precoKonfig: { count: jest.fn(), findMany: jest.fn() },
        precoKinety: { count: jest.fn(), findMany: jest.fn() },
        precoZakresy: { count: jest.fn(), findMany: jest.fn() },
        $transaction: jest.fn()
    }
}));

interface MockDb {
    versions: Array<{ type: string; seq: number }>;
    live: Record<string, Array<Record<string, unknown>>>;
    /** Wymusza race: check w tx zawsze widzi 0 (drugi start równolegle). */
    forceRace: boolean;
    txClients: Array<any>;
}

function getPrisma(): any {
    return jest.requireMock('../src/prismaClient').default;
}

/** Tx-client z delegatami LIVE + wersji; create rzuca P2002 przy duplikacie (type,seq). */
function setupDb(db: MockDb) {
    const p = getPrisma();
    const outerCount = jest.fn(({ where }: any) =>
        Promise.resolve(db.versions.filter((v) => v.type === where.type).length)
    );
    p.pricelistVersion.count = outerCount;
    p.pricelistVersion.aggregate.mockImplementation(({ where }: any) => {
        const seqs = db.versions.filter((v) => v.type === where.type).map((v) => v.seq);
        return Promise.resolve({ _max: { seq: seqs.length > 0 ? Math.max(...seqs) : null } });
    });
    p.pricelistVersion.create.mockImplementation(({ data }: any) => Promise.resolve(data));
    for (const t of ['productsRury', 'productsStudnie'] as const) {
        const key = t === 'productsRury' ? 'rury' : 'studnie';
        p[t].count.mockResolvedValue(db.live[key]?.length ?? 0);
        p[t].findMany.mockResolvedValue(db.live[key] ?? []);
    }
    for (const t of ['precoKonfig', 'precoKinety', 'precoZakresy'] as const) {
        p[t].findMany.mockResolvedValue([]);
    }

    p.$transaction.mockImplementation(async (fn: any) => {
        const tx: any = {
            pricelistVersion: {
                count: jest.fn(({ where }: any) =>
                    Promise.resolve(
                        db.forceRace ? 0 : db.versions.filter((v) => v.type === where.type).length
                    )
                ),
                aggregate: jest.fn(({ where }: any) => {
                    const seqs = db.versions.filter((v) => v.type === where.type).map((v) => v.seq);
                    return Promise.resolve({
                        _max: { seq: seqs.length > 0 ? Math.max(...seqs) : null }
                    });
                }),
                create: jest.fn(({ data }: any) => {
                    if (db.versions.some((v) => v.type === data.type && v.seq === data.seq)) {
                        const err: any = new Error('Unique constraint failed');
                        err.code = 'P2002';
                        return Promise.reject(err);
                    }
                    db.versions.push({ type: data.type, seq: data.seq });
                    return Promise.resolve(data);
                })
            },
            productsRury: { findMany: jest.fn().mockResolvedValue(db.live.rury ?? []) },
            productsStudnie: { findMany: jest.fn().mockResolvedValue(db.live.studnie ?? []) },
            precoKonfig: { findMany: jest.fn().mockResolvedValue([]) },
            precoKinety: { findMany: jest.fn().mockResolvedValue([]) },
            precoZakresy: { findMany: jest.fn().mockResolvedValue([]) },
            pricelistItemRury: { createMany: jest.fn().mockResolvedValue({ count: 0 }) },
            pricelistItemStudnie: { createMany: jest.fn().mockResolvedValue({ count: 0 }) },
            pricelistItemPrecoKonfig: { createMany: jest.fn().mockResolvedValue({ count: 0 }) },
            pricelistItemPrecoKinety: { createMany: jest.fn().mockResolvedValue({ count: 0 }) },
            pricelistItemPrecoZakresy: { createMany: jest.fn().mockResolvedValue({ count: 0 }) }
        };
        db.txClients.push(tx);
        return fn(tx);
    });
}

function newDb(liveRury: Array<Record<string, unknown>> = []): MockDb {
    return { versions: [], live: { rury: liveRury, studnie: [] }, forceRace: false, txClients: [] };
}

beforeEach(jest.clearAllMocks);

test('LIVE bez wersji → tworzy ACTIVE z labelką/sha serwisu', async () => {
    const rows = [
        { id: 'r0', name: 'Rura', category: 'K', price: 10 },
        { id: 'r1', name: 'Rura2', category: 'K', price: 20 }
    ];
    const db = newDb(rows);
    setupDb(db);

    const created = await ensureActivePricelistVersions();
    expect(created).toEqual(['rury']);

    const tx = db.txClients[0];
    expect(tx.pricelistVersion.create).toHaveBeenCalledTimes(1);
    const data = tx.pricelistVersion.create.mock.calls[0][0].data;
    expect(data).toMatchObject({
        type: 'rury',
        seq: 1,
        status: 'ACTIVE',
        createdBy: 'auto-ensure'
    });
    // Labelka i sha jak serwis (versionLabel ~314, sha256Canonical(rows) ~292).
    expect(data.version).toBe(versionLabel(1, data.effectiveFrom));
    expect(data.version).not.toBe('v1');
    expect(data.sha256).toBe(sha256Canonical(rows));
    // Items w TEJ SAMEJ tx — crash między items a create niemożliwy.
    expect(tx.pricelistItemRury.createMany).toHaveBeenCalled();
    expect(getPrisma().pricelistVersion.create).not.toHaveBeenCalled();
});

test('istniejące wersje → skip (zero zapisów)', async () => {
    const db = newDb([{ id: 'r0', price: 1 }]);
    db.versions.push({ type: 'rury', seq: 1 });
    setupDb(db);
    expect(await ensureActivePricelistVersions()).toEqual([]);
    for (const tx of db.txClients) {
        expect(tx.pricelistVersion.create).not.toHaveBeenCalled();
    }
});

test('puste LIVE → skip', async () => {
    const db = newDb([]);
    setupDb(db);
    expect(await ensureActivePricelistVersions()).toEqual([]);
    expect(db.versions).toEqual([]);
});

test('concurrent double-call → 1 wersja (drugi P2002 → skip)', async () => {
    const rows = [{ id: 'r0', name: 'Rura', category: 'K', price: 10 }];
    const db = newDb(rows);
    db.forceRace = true; // oba checki w tx widzą 0 — wygrywa jeden, drugi dostaje P2002
    setupDb(db);

    const [a, b] = await Promise.all([
        ensureActivePricelistVersions(),
        ensureActivePricelistVersions()
    ]);
    const total = a.length + b.length;
    expect(db.versions.filter((v) => v.type === 'rury')).toHaveLength(1);
    expect(total).toBe(1);
});
