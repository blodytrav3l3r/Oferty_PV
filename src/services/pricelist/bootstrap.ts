/**
 * Bootstrap wersji bazowej cennika.
 *
 * Świeża instalacja (`install.bat` → migrate → `prisma/seed.ts`) wypełnia tylko
 * tabele LIVE + `*Default`. Żadna migracja ani seed nie tworzy wiersza
 * `PricelistVersion`, więc `resolveActive()` (status APPROVED + effectiveFrom)
 * zwraca null i oferty spadają na LIVE z `X-Pricelist-Fallback: live`.
 *
 * `ensureBaselineVersions()` domyka tę lukę: dla osi BEZ żadnej wersji tworzy
 * seq:1 APPROVED z bieżącego LIVE. Idempotentne — oś z jakąkolwiek wersją
 * (także szkicem) jest pomijana, więc ręcznej pracy admina to nie nadpisuje.
 */

import prisma, { Prisma } from '../../prismaClient';
import { chunkedCreateMany } from '../../utils/prismaBatch';
import { sha256Canonical } from '../priceOverrideService';
import { versionLabel } from './lifecycle';
import { PRICELIST_TYPES } from './validation';
import type { PricelistType } from './validation';
import { logger } from '../../utils/logger';

/** Pozycje wersji trzymają złożony klucz `<versionId>:<liveId>`. */
const VERSION_ITEMS_CHUNK = 100;

type Tx = Prisma.TransactionClient;
type ItemRow = { id: string; versionId: string } & Record<string, unknown>;

type ItemTable =
    | 'pricelistItemRury'
    | 'pricelistItemStudnie'
    | 'pricelistItemPrecoKonfig'
    | 'pricelistItemPrecoKinety'
    | 'pricelistItemPrecoZakresy';

interface LoadGroup {
    table: ItemTable;
    rows: ItemRow[];
}

/** Wiersze LIVE w kształcie pozycji wersji (przepisane 1:1, nowy klucz). */
const LOADERS: Record<PricelistType, (tx: Tx, versionId: string) => Promise<LoadGroup[]>> = {
    rury: async (tx, versionId) => {
        const live = await tx.productsRury.findMany({ orderBy: { id: 'asc' } });
        return [
            {
                table: 'pricelistItemRury',
                rows: live.map((row) => ({ ...row, id: `${versionId}:${row.id}`, versionId }))
            }
        ];
    },
    studnie: async (tx, versionId) => {
        const live = await tx.productsStudnie.findMany({ orderBy: { id: 'asc' } });
        return [
            {
                table: 'pricelistItemStudnie',
                rows: live.map((row) => ({ ...row, id: `${versionId}:${row.id}`, versionId }))
            }
        ];
    },
    preco: async (tx, versionId) => {
        const [konfig, kinety, zakresy] = await Promise.all([
            tx.precoKonfig.findMany({ orderBy: { key: 'asc' } }),
            tx.precoKinety.findMany({ orderBy: [{ wellDn: 'asc' }, { order: 'asc' }] }),
            tx.precoZakresy.findMany({ orderBy: [{ wellDn: 'asc' }, { order: 'asc' }] })
        ]);
        const tag = (rows: { id: string }[], prefix: string) =>
            rows.map((row) => ({ ...row, id: `${versionId}:${prefix}:${row.id}`, versionId }));
        return [
            { table: 'pricelistItemPrecoKonfig', rows: tag(konfig, 'konfig') },
            { table: 'pricelistItemPrecoKinety', rows: tag(kinety, 'kinety') },
            { table: 'pricelistItemPrecoZakresy', rows: tag(zakresy, 'zakresy') }
        ];
    }
};

export interface BaselineVersionInfo {
    type: PricelistType;
    version: string;
    rows: number;
}

/**
 * Id wersji bazowej: `<typ>-baseline-<ISO bez znaków spoza [A-Za-z0-9_-]>`.
 * Musi przejść kontrakt ID tras (`[A-Za-z0-9_-]{1,64}`), więc `:` i `.` z ISO wypadają.
 */
function baselineVersionId(type: PricelistType, nowIso: string): string {
    return `${type}-baseline-${nowIso}`.replace(/[^A-Za-z0-9_-]/g, '');
}

/**
 * Tworzy wersję bazową dla każdej osi, która nie ma żadnej wersji i ma
 * niepuste LIVE. Jedno `nowIso` dla wszystkich osi — timeline PRECO wymaga
 * `preco.effectiveFrom <= studnie.effectiveFrom`.
 *
 * @param client Klient Prisma (wstrzykiwany w testach).
 * @param nowIso  Czas obowiązywania wersji (domyślnie teraz, ISO UTC).
 * @returns Utworzone wersje (pusta lista = nic do zrobienia).
 */
export async function ensureBaselineVersions(
    client: typeof prisma = prisma,
    nowIso: string = new Date().toISOString()
): Promise<BaselineVersionInfo[]> {
    const created: BaselineVersionInfo[] = [];
    for (const type of PRICELIST_TYPES) {
        const existing = await client.pricelistVersion.count({ where: { type } });
        if (existing > 0) continue;
        const inserted = await client.$transaction(async (tx) => {
            const versionId = baselineVersionId(type, nowIso);
            const groups = await LOADERS[type](tx, versionId);
            const total = groups.reduce((sum, group) => sum + group.rows.length, 0);
            if (total === 0) return null;
            const version = versionLabel(type, 1, nowIso);
            // FK pozycji → wersja (Restrict): nagłówek musi istnieć PRZED wierszami.
            await tx.pricelistVersion.create({
                data: {
                    id: versionId,
                    type,
                    seq: 1,
                    version,
                    status: 'APPROVED',
                    effectiveFrom: nowIso,
                    createdBy: 'bootstrap',
                    note: 'Wersja bazowa z cennika LIVE (bootstrap startu)',
                    sha256: sha256Canonical({ type, rows: total, at: nowIso }),
                    createdAt: nowIso
                }
            });
            for (const group of groups) {
                const delegate = tx[group.table] as unknown as {
                    createMany: (args: { data: ItemRow[] }) => Promise<{ count: number }>;
                };
                await chunkedCreateMany(delegate, group.rows, VERSION_ITEMS_CHUNK);
            }
            return { type, version, rows: total };
        });
        if (inserted) created.push(inserted);
    }
    return created;
}

/** Wywołanie startowe: błąd loguje i nie blokuje serwera (jak reszta auto-heal). */
export async function ensureBaselineVersionsAtStartup(): Promise<void> {
    try {
        const created = await ensureBaselineVersions();
        for (const info of created) {
            logger.info(
                'Pricelist',
                `Bootstrap: utworzono ${info.version} (APPROVED, wierszy=${info.rows})`
            );
        }
    } catch (err) {
        logger.warn(
            'Pricelist',
            'Bootstrap wersji bazowej nie powiódł się:',
            err instanceof Error ? err.message : String(err)
        );
    }
}
