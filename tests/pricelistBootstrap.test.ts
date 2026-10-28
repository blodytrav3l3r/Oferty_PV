/**
 * Bootstrap wersji bazowej: świeża instalacja ma ceny LIVE, ale zero wierszy
 * `PricelistVersion` → oferty spadały na LIVE z toastem „Brak aktywnej wersji”.
 * `ensureBaselineVersions` tworzy v1 APPROVED per oś, idempotentnie.
 */

jest.mock('../src/utils/logger', () => ({
    logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() }
}));

import { ensureBaselineVersions } from '../src/services/pricelist/bootstrap';
import type prismaClient from '../src/prismaClient';

type Row = Record<string, unknown>;
type VersionRow = {
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
};

const NOW = '2026-10-28T09:00:00.000Z';

function makeClient(live: {
    rury?: Row[];
    studnie?: Row[];
    precoKonfig?: Row[];
    precoKinety?: Row[];
    precoZakresy?: Row[];
    versions?: VersionRow[];
}) {
    const versions: VersionRow[] = [...(live.versions ?? [])];
    const items: Row[] = [];
    const table = (rows: Row[] = []) => ({
        findMany: jest.fn().mockResolvedValue(rows),
        createMany: jest.fn(async ({ data }: { data: Row[] }) => {
            items.push(...data);
            return { count: data.length };
        })
    });
    // Jawny typ: `$transaction` odwołuje się do `client` w swojej definicji.
    const client: Record<string, any> = {
        pricelistVersion: {
            count: jest.fn(
                async ({ where }: { where: { type: string } }) =>
                    versions.filter((v) => v.type === where.type).length
            ),
            create: jest.fn(async ({ data }: { data: VersionRow }) => {
                versions.push(data);
                return data;
            })
        },
        productsRury: table(live.rury),
        productsStudnie: table(live.studnie),
        precoKonfig: table(live.precoKonfig),
        precoKinety: table(live.precoKinety),
        precoZakresy: table(live.precoZakresy),
        pricelistItemRury: table(),
        pricelistItemStudnie: table(),
        pricelistItemPrecoKonfig: table(),
        pricelistItemPrecoKinety: table(),
        pricelistItemPrecoZakresy: table(),
        $transaction: jest.fn(async (fn: (tx: unknown) => Promise<unknown>) => fn(client))
    };
    return { client: client as unknown as typeof prismaClient, versions, items };
}

const rury = [{ id: 'R-1', name: 'Rura A', category: 'A', price: 10 }];
const studnie = [{ id: 'S-1', name: 'Studnia A', category: 'A', price: 20 }];
const preco = {
    precoKonfig: [{ id: 'P-K1', key: 'cena', value: '1' }],
    precoKinety: [{ id: 'P-KI1', wellDn: 'DN1000', order: 0 }],
    precoZakresy: [{ id: 'P-Z1', wellDn: 'DN1000', order: 0 }]
};

describe('bootstrap cennika: wersja bazowa z LIVE', () => {
    it('brak wersji + LIVE → trzy APPROVED v1 z jednym effectiveFrom', async () => {
        const { client, versions, items } = makeClient({ rury, studnie, ...preco });
        const created = await ensureBaselineVersions(client, NOW);

        expect(created.map((c) => c.type)).toEqual(['rury', 'studnie', 'preco']);
        expect(versions).toHaveLength(3);
        for (const v of versions) {
            expect(v.status).toBe('APPROVED');
            expect(v.seq).toBe(1);
            expect(v.effectiveFrom).toBe(NOW);
            expect(v.createdBy).toBe('bootstrap');
        }
        // Jeden znacznik czasu dla osi: PRECO musi być <= studnie w timeline.
        expect(new Set(versions.map((v) => v.effectiveFrom)).size).toBe(1);
        expect(versions.map((v) => v.version).sort()).toEqual([
            'Pv1-20261028',
            'Rv1-20261028',
            'Sv1-20261028'
        ]);
        // Pozycje skopiowane z LIVE (klucz `<versionId>:<liveId>`).
        expect(items).toHaveLength(5);
        expect(items.map((r) => r.id)).toContain(`${versions[0].id}:R-1`);
    });

    it('drugie wywołanie jest no-op (idempotencja)', async () => {
        const { client, versions } = makeClient({ rury, studnie, ...preco });
        await ensureBaselineVersions(client, NOW);
        const again = await ensureBaselineVersions(client, NOW);
        expect(again).toEqual([]);
        expect(versions).toHaveLength(3);
    });

    it('oś z samym szkicem nie dostaje APPROVED (ręczna praca nietknięta)', async () => {
        const draft: VersionRow = {
            id: 'd1',
            type: 'rury',
            seq: 2,
            version: 'Rv2-20261028',
            status: 'DRAFT',
            effectiveFrom: NOW,
            sha256: 'x'
        };
        const { client, versions } = makeClient({ rury, studnie, ...preco, versions: [draft] });
        const created = await ensureBaselineVersions(client, NOW);
        expect(created.map((c) => c.type)).toEqual(['studnie', 'preco']);
        expect(versions.filter((v) => v.type === 'rury')).toHaveLength(1);
    });

    it('pusty LIVE → bez wersji (oferty zostają na LIVE, bez pustej APPROVED)', async () => {
        const { client, versions } = makeClient({ rury: [], studnie: [], precoKonfig: [] });
        const created = await ensureBaselineVersions(client, NOW);
        expect(created).toEqual([]);
        expect(versions).toEqual([]);
    });
});
