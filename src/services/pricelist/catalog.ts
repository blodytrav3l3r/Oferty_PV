/**
 * Katalog produktów dla PDF/DOCX: ACTIVE (jeśli jest), w przeciwnym razie seed.
 * Zastępuje odczyty tabel LIVE i `*Default`.
 */
import { getSeedRury, getSeedStudnie } from './seedData';
import { getVersionExport } from './export';
import { resolveActive } from './usage';

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

/** Metadane elementów studni (componentType/kategoria/dn/wysokość). */
export async function getCatalogStudnieRows(): Promise<CatalogStudnieRow[]> {
    try {
        const active = await resolveActive('studnie');
        if (active) {
            const { sections } = await getVersionExport(active.id);
            const rows = (sections.studnie ?? []) as Row[];
            if (rows.length > 0) return rows.map(toStudnieRow);
        }
    } catch {
        // Brak bazy/wersji: katalog z seeda (PDF nie może paść bez metadanych).
    }
    return getSeedStudnie().map(toStudnieRow);
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
    try {
        const active = await resolveActive('rury');
        if (active) {
            const { sections } = await getVersionExport(active.id);
            const rows = (sections.rury ?? []) as Row[];
            if (rows.length > 0) return collect(rows);
        }
    } catch {
        // j.w. — fallback do seeda
    }
    return collect(getSeedRury());
}
