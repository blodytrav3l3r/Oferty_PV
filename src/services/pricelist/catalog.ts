/**
 * Katalog produktów dla PDF/DOCX: ACTIVE (jeśli jest), w przeciwnym razie seed.
 * Zastępuje odczyty tabel LIVE i `*Default`.
 *
 * Błąd odczytu wersji nie może przejść cicho: dokument trafiłby do klienta
 * z fabrycznymi cenami/metadanymi. Dlatego każdy błąd jest logowany jako
 * `error`, a fallback do seeda zostaje tylko po to, by PDF się wyrenderował.
 */
import { getSeedRury, getSeedStudnie } from './seedData';
import { getVersionExport } from './export';
import { resolveActive } from './usage';
import { logger } from '../../utils/logger';

export interface CatalogStudnieRow {
    id: string;
    componentType: string;
    category: string;
    dn: number | string;
    height: number;
}

type Row = Record<string, unknown>;

function toStudnieRow(row: Row): CatalogStudnieRow {
    return {
        id: String(row.id),
        componentType: String(row.componentType ?? ''),
        category: String(row.category ?? ''),
        dn: (row.dn as number | string | null) ?? 0,
        height: Number(row.height ?? 0)
    };
}

/**
 * Wiersze ACTIVE dla osi albo `null`, gdy wersji nie ma / jest pusta.
 * Błąd odczytu trafia do logu jako `error` (nie jest maskowany).
 */
async function getActiveRows(
    type: 'rury' | 'studnie',
    section: 'rury' | 'studnie'
): Promise<Row[] | null> {
    let activeId: string | null = null;
    try {
        const active = await resolveActive(type);
        if (!active) return null;
        activeId = active.id;
        const { sections } = await getVersionExport(active.id);
        const rows = (sections[section] ?? []) as Row[];
        return rows.length > 0 ? rows : null;
    } catch (err: unknown) {
        logger.error(
            'PricelistCatalog',
            `Nie udało się odczytać ACTIVE (${type}${activeId ? `, ${activeId}` : ''}) — fallback do seeda`,
            err instanceof Error ? err.message : String(err)
        );
        return null;
    }
}

/** Metadane elementów studni (componentType/kategoria/dn/wysokość). */
export async function getCatalogStudnieRows(): Promise<CatalogStudnieRow[]> {
    const rows = await getActiveRows('studnie', 'studnie');
    return (rows ?? getSeedStudnie()).map(toStudnieRow);
}

/** Kategoria rury po id (do PDF ofert, gdy pozycja nie niesie kategorii). */
export async function getRuryCategoryMap(productIds: string[]): Promise<Map<string, string>> {
    const wanted = new Set(productIds);
    const collect = (rows: Row[]): Map<string, string> => {
        const map = new Map<string, string>();
        for (const row of rows) {
            const id = String(row.id);
            if (wanted.has(id)) map.set(id, String(row.category ?? ''));
        }
        return map;
    };
    const rows = await getActiveRows('rury', 'rury');
    return collect(rows ?? getSeedRury());
}
