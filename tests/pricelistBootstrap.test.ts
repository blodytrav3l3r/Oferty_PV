/**
 * Bootstrap wersji bazowej: świeża instalacja nie ma żadnej wersji cennika,
 * a oferty wymagają ACTIVE (409 bez niej). `ensureBaselineVersions` tworzy
 * v1 APPROVED per oś z plików `data/seed_*.json`, idempotentnie.
 */

jest.mock('../src/utils/logger', () => ({
    logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() }
}));

import { ensureBaselineVersions } from '../src/services/pricelist/bootstrap';
import { getSeedRury, getSeedStudnie } from '../src/services/pricelist/seedData';
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

function makeClient(input: { versions?: VersionRow[] } = {}) {
    const versions: VersionRow[] = [...(input.versions ?? [])];
    const items: Row[] = [];
    const table = () => ({
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
        // Tabele LIVE nie są już czytane przez bootstrap — brak w mocku to test.
        pricelistItemRury: table(),
        pricelistItemStudnie: table(),
        pricelistItemPrecoKonfig: table(),
        pricelistItemPrecoKinety: table(),
        pricelistItemPrecoZakresy: table(),
        $transaction: jest.fn(async (fn: (tx: unknown) => Promise<unknown>) => fn(client))
    };
    return { client: client as unknown as typeof prismaClient, versions, items };
}

const SEED_RURY = getSeedRury().length;
const SEED_STUDNIE = getSeedStudnie().length;

describe('bootstrap cennika: wersja bazowa z seed_*.json', () => {
    it('brak wersji → trzy APPROVED v1 z jednym effectiveFrom', async () => {
        const { client, versions, items } = makeClient();
        const created = await ensureBaselineVersions(client, NOW);

        expect(created.map((c) => c.type)).toEqual(['rury', 'studnie', 'preco']);
        expect(versions).toHaveLength(3);
        for (const v of versions) {
            // Kontrakt ID tras: bez `:` z ISO, inaczej export/clone-draft → 400 INVALID_ID.
            expect(v.id).toMatch(/^[A-Za-z0-9_-]{1,64}$/);
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
        // Pozycje z seeda (klucz `<versionId>:<seedId>`), bez odczytu LIVE.
        const ruryItems = items.filter((r) => String(r.id).startsWith(`${versions[0].id}:`));
        expect(ruryItems).toHaveLength(SEED_RURY);
        expect(items.filter((r) => r.versionId === versions[1].id)).toHaveLength(SEED_STUDNIE);
        expect(items.filter((r) => r.versionId === versions[2].id).length).toBeGreaterThan(0);
    });

    it('drugie wywołanie jest no-op (idempotencja)', async () => {
        const { client, versions } = makeClient();
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
        const { client, versions } = makeClient({ versions: [draft] });
        const created = await ensureBaselineVersions(client, NOW);
        expect(created.map((c) => c.type)).toEqual(['studnie', 'preco']);
        expect(versions.filter((v) => v.type === 'rury')).toHaveLength(1);
    });
});
