/**
 * Porównanie treści cenników: pakiet ↔ wiersze z bazy ↔ seed.
 *
 * Czyste funkcje — żadnych zapytań ani zapisów. Używane przez bramę
 * `npm run prices:verify` (seed ↔ pakiet, bez bazy) i przez
 * `scripts/export-active-pricelists.ts` (baza ↔ pakiet).
 */
import { getSeedPrecoItems, getSeedRuryItems, getSeedStudnieItems } from './seedData';
import { ITEM_FIELDS, stableJson, toPackageRow } from './package';
import type {
    ActivePackageRows,
    ActivePackageTable,
    ActivePackageType,
    PackageRow
} from './package';

export interface DriftEntry {
    type: ActivePackageType;
    table: ActivePackageTable;
    id: string;
    field: string;
    seed: unknown;
    active: unknown;
}

/** Sekcje wersji (`getVersionExport`) w kluczach tabel pakietu. */
const SECTION_OF_TABLE: Record<ActivePackageTable, string> = {
    pricelist_item_rury: 'rury',
    pricelist_item_studnie: 'studnie',
    pricelist_item_preco_konfig: 'konfig',
    pricelist_item_preco_kinety: 'kinety',
    pricelist_item_preco_zakresy: 'zakresy'
};

/**
 * Wiersze ACTIVE (sekcje wersji, bez prefiksu `versionId:`) w kształcie pakietu,
 * żeby porównanie z seedem używało tych samych pól i formatu kwot.
 */
export function activeRowsFromSections(
    sections: Record<string, Array<Record<string, unknown>>>
): ActivePackageRows {
    const rows: ActivePackageRows = {
        pricelist_item_rury: [],
        pricelist_item_studnie: [],
        pricelist_item_preco_konfig: [],
        pricelist_item_preco_kinety: [],
        pricelist_item_preco_zakresy: []
    };
    for (const table of Object.keys(rows) as ActivePackageTable[]) {
        rows[table] = (sections[SECTION_OF_TABLE[table]] ?? []).map((row) =>
            toPackageRow(table, { ...row, versionId: '__active__' })
        );
    }
    return rows;
}

/** Wiersze seeda w kształcie pakietu (wspólny mianownik do porównania). */
export function seedPackageRows(type: ActivePackageType): ActivePackageRows {
    const versionId = '__seed__';
    const rows: ActivePackageRows = {
        pricelist_item_rury: [],
        pricelist_item_studnie: [],
        pricelist_item_preco_konfig: [],
        pricelist_item_preco_kinety: [],
        pricelist_item_preco_zakresy: []
    };
    if (type === 'rury') {
        rows.pricelist_item_rury = getSeedRuryItems(versionId).map((row) =>
            toPackageRow('pricelist_item_rury', row)
        );
    } else if (type === 'studnie') {
        rows.pricelist_item_studnie = getSeedStudnieItems(versionId).map((row) =>
            toPackageRow('pricelist_item_studnie', row)
        );
    } else {
        const preco = getSeedPrecoItems(versionId);
        rows.pricelist_item_preco_konfig = preco.konfig.map((row) =>
            toPackageRow('pricelist_item_preco_konfig', row)
        );
        rows.pricelist_item_preco_kinety = preco.kinety.map((row) =>
            toPackageRow('pricelist_item_preco_kinety', row)
        );
        rows.pricelist_item_preco_zakresy = preco.zakresy.map((row) =>
            toPackageRow('pricelist_item_preco_zakresy', row)
        );
    }
    return rows;
}

function rowId(row: PackageRow): string {
    const full = String(row.id);
    const cut = full.lastIndexOf(':');
    return cut === -1 ? full : full.slice(cut + 1);
}

/** Wartość do porównania: JSON-y (`value`, `grupy`) semantycznie, reszta po tekście. */
function comparable(value: unknown): string {
    if (value === null || value === undefined) return '';
    if (typeof value === 'string') {
        const trimmed = value.trim();
        if (trimmed.startsWith('{') || trimmed.startsWith('[')) {
            try {
                return stableJson(JSON.parse(trimmed) as unknown);
            } catch {
                return value;
            }
        }
        return value;
    }
    if (typeof value === 'object') return stableJson(value);
    return String(value);
}

/**
 * Różnice pól między dwoma zestawami wierszy pakietu, dopasowanie po `id`.
 * `expected` = źródło prawdy (seed albo baza), `actual` = pakiet.
 */
export function diffPackageRows(
    type: ActivePackageType,
    expected: ActivePackageRows,
    actual: ActivePackageRows,
    tables: readonly ActivePackageTable[] = Object.keys(expected) as ActivePackageTable[]
): DriftEntry[] {
    const diffs: DriftEntry[] = [];
    for (const table of tables) {
        const expectedMap = new Map(expected[table].map((row) => [rowId(row), row]));
        const actualMap = new Map(actual[table].map((row) => [rowId(row), row]));
        for (const [id, row] of expectedMap) {
            const counterpart = actualMap.get(id);
            if (!counterpart) {
                diffs.push({ type, table, id, field: '*', seed: 'row', active: 'missing' });
                continue;
            }
            for (const field of ITEM_FIELDS[table]) {
                if (field === 'id' || field === 'versionId') continue;
                const left = comparable(row[field]);
                const right = comparable(counterpart[field]);
                if (left !== right) {
                    diffs.push({ type, table, id, field, seed: left, active: right });
                }
            }
        }
        for (const id of actualMap.keys()) {
            if (!expectedMap.has(id)) {
                diffs.push({ type, table, id, field: '*', seed: 'missing', active: 'row' });
            }
        }
    }
    return diffs;
}
