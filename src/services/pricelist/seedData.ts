/**
 * „Domyślny" cennik z plików `data/seed_*.json`.
 *
 * Po etapie 2 (usunięcie tabel LIVE i `*Default`) to jedyne źródło:
 * - „Przywróć domyślne" w panelu cennika (`/default`),
 * - eksport `?source=default`,
 * - wersja bazowa na świeżej instalacji (`bootstrap.ts`).
 *
 * Pliki są read-only i cache'owane w pamięci — zmiana wymaga restartu.
 */
import fs from 'fs';
import path from 'path';
import { ZAKRESY_TYPES } from '../../constants/precoSizes';
import { resolveDataDir } from '../../utils/paths';

export type SeedRow = Record<string, unknown>;

let cache: {
    rury: SeedRow[];
    studnie: SeedRow[];
    preco: Record<string, SeedRow>;
} | null = null;

function readJson(fileName: string): unknown {
    return JSON.parse(fs.readFileSync(path.join(resolveDataDir(), fileName), 'utf-8'));
}

function load(): NonNullable<typeof cache> {
    if (cache) return cache;
    const precoRaw = readJson('seed_preco.json');
    const preco = Array.isArray(precoRaw)
        ? ((precoRaw[0] ?? {}) as Record<string, SeedRow>)
        : (precoRaw as Record<string, SeedRow>);
    cache = {
        rury: readJson('seed_rury.json') as SeedRow[],
        studnie: readJson('seed_studnie.json') as SeedRow[],
        preco
    };
    return cache;
}

/** Wiersze rur w kształcie odpowiedzi `GET /api/products/default`. */
export function getSeedRury(): SeedRow[] {
    return load().rury.map((r) => ({ ...r }));
}

/** Wiersze studni w kształcie odpowiedzi `GET /api/products-studnie/default`. */
export function getSeedStudnie(): SeedRow[] {
    return load().studnie.map((r) => ({ ...r, dn: r.dn != null ? String(r.dn) : null }));
}

/** Zagnieżdżony cennik PRECO (jeden wpis = wszystkie DN) — shape `?source=default`. */
export function getSeedPrecoNested(): SeedRow {
    return JSON.parse(JSON.stringify(load().preco)) as SeedRow;
}

function toBool(value: unknown): boolean {
    return value === 1 || value === true;
}

/** Rury w kształcie pozycji wersji (PricelistItemRury). */
export function getSeedRuryItems(versionId: string): SeedRow[] {
    return load().rury.map((r) => ({
        id: `${versionId}:${String(r.id)}`,
        versionId,
        name: r.name,
        category: r.category,
        price: r.price,
        transport: r.transport ?? null,
        weight: r.weight ?? null,
        area: r.area ?? null
    }));
}

/** Studnie w kształcie pozycji wersji (PricelistItemStudnie). */
export function getSeedStudnieItems(versionId: string): SeedRow[] {
    return load().studnie.map((r) => ({
        id: `${versionId}:${String(r.id)}`,
        versionId,
        name: r.name,
        category: r.category,
        componentType: r.componentType,
        dn: r.dn != null ? String(r.dn) : null,
        height: r.height ?? null,
        weight: r.weight ?? null,
        price: r.price ?? 0,
        area: r.area ?? null,
        areaExt: r.areaExt ?? null,
        transport: r.transport ?? null,
        magazynWL: toBool(r.magazynWL),
        magazynKLB: toBool(r.magazynKLB),
        formaStandardowa: toBool(r.formaStandardowa),
        formaStandardowaKLB: toBool(r.formaStandardowaKLB),
        active: r.active !== undefined ? toBool(r.active) : true,
        zapasDol: r.zapasDol ?? null,
        zapasGora: r.zapasGora ?? null,
        zapasDolMin: r.zapasDolMin ?? null,
        zapasGoraMin: r.zapasGoraMin ?? null,
        spocznikH: r.spocznikH != null ? String(r.spocznikH) : null,
        hMin1: r.hMin1 ?? null,
        hMax1: r.hMax1 ?? null,
        cena1: r.cena1 ?? null,
        hMin2: r.hMin2 ?? null,
        hMax2: r.hMax2 ?? null,
        cena2: r.cena2 ?? null,
        hMin3: r.hMin3 ?? null,
        hMax3: r.hMax3 ?? null,
        cena3: r.cena3 ?? null,
        doplataPEHD: r.doplataPEHD ?? null,
        doplataZelbet: r.doplataZelbet ?? null,
        doplataDrabNierdzewna: r.doplataDrabNierdzewna ?? null,
        malowanieWewnetrzne: r.malowanieWewnetrzne ?? null,
        malowanieZewnetrzne: r.malowanieZewnetrzne ?? null
    }));
}

export interface SeedPrecoItems {
    konfig: SeedRow[];
    kinety: SeedRow[];
    zakresy: SeedRow[];
}

/**
 * PRECO w kształcie pozycji wersji. Identyfikatory 1:1 z dotychczasowym
 * seedem (`preco_konfig_<DN>`, `preco_kinety_<DN>_<i>`, `preco_zakres_<label>_<i>`).
 */
export function getSeedPrecoItems(versionId: string): SeedPrecoItems {
    const konfig: SeedRow[] = [];
    const kinety: SeedRow[] = [];
    const zakresy: SeedRow[] = [];
    let kinetyIdx = 0;
    let zakresIdx = 0;

    for (const dnStr of Object.keys(load().preco)) {
        const dnCfg = load().preco[dnStr];
        if (!dnCfg) continue;
        const { kinety: dnKinety, ...scalarFields } = dnCfg;
        konfig.push({
            id: `${versionId}:konfig:preco_konfig_${dnStr}`,
            versionId,
            key: dnStr,
            value: JSON.stringify(scalarFields)
        });
        if (Array.isArray(dnKinety)) {
            for (const k of dnKinety as SeedRow[]) {
                kinety.push({
                    id: `${versionId}:kinety:preco_kinety_${dnStr}_${kinetyIdx}`,
                    versionId,
                    order: k.order ?? kinetyIdx,
                    dn: k.dn ?? 0,
                    wellDn: Number(dnStr),
                    height: k.prosta ?? k.height,
                    cena: k.dodWlot ?? k.cena
                });
                kinetyIdx++;
            }
        }
        for (const label of ZAKRESY_TYPES) {
            const arr = dnCfg[label];
            if (!Array.isArray(arr)) continue;
            for (const item of arr as SeedRow[]) {
                zakresy.push({
                    id: `${versionId}:zakresy:preco_zakres_${label}_${zakresIdx}`,
                    versionId,
                    order: item.order ?? zakresIdx,
                    label,
                    min: item.min,
                    max: item.max,
                    grupy: JSON.stringify(item.grupy ?? {}),
                    wellDn: Number(dnStr)
                });
                zakresIdx++;
            }
        }
    }

    return { konfig, kinety, zakresy };
}
