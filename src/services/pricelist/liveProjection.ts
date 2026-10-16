/**
 * pricelist/liveProjection — projekcja wierszy wersji → shape LIVE
 * (arkusze + nagłówki + kolejność 1:1 z eksportem przeglądarki).
 * Czyste funkcje, zero DB. Kod przeniesiony 1:1 z pricelistVersionService.ts.
 *
 * SSoT kształtu:
 * - RURY: public/js/rury/pricelistUi.js RURY_EXPORT_COLUMNS (linia 336)
 * - STUDNIE: public/js/studnie/pricelistState.js EXPORT_COLUMNS (linia 42)
 * - arkusze + sort Przejścia + sanitize: liveStudnieSheetName / projectStudnie
 *   poniżej (eksport studni buduje serwer, Etap C — brak getSheetName w FE)
 * - PRECO: public/js/studnie/pricelistImportExport.js (linie 78-147)
 * Zero zmian DB/importu/UI — tylko projekcja wierszy w eksporcie wersji.
 */

import type { PricelistType } from './validation';
import { STUDNIE_BOOL_FIELDS } from './validation';

export type LiveSheetRows = Record<string, Array<Record<string, unknown>>>;

/** SSoT FE: public/js/rury/pricelistUi.js:336 RURY_EXPORT_COLUMNS. */
export const RURY_LIVE_COLUMNS = [
    { header: 'Indeks', key: 'id' },
    { header: 'Nazwa produktu', key: 'name' },
    { header: 'Cena PLN (netto)', key: 'price' },
    { header: 'Kategoria', key: 'category' },
    { header: 'Waga (kg)', key: 'weight' },
    { header: 'Szt./transport', key: 'transport' },
    { header: 'Powierzchnia (m2)', key: 'area' }
] as const;

export const RURY_LIVE_SHEET = 'Cennik Rury';

/** SSoT FE: public/js/studnie/pricelistState.js:42 EXPORT_COLUMNS. */
export const STUDNIE_LIVE_COLUMNS = [
    { key: 'id', header: 'Indeks' },
    { key: 'name', header: 'Nazwa' },
    { key: 'category', header: 'Kategoria' },
    { key: 'componentType', header: 'Typ komponentu' },
    { key: 'dn', header: 'DN' },
    { key: 'height', header: 'Wysokość mm' },
    { key: 'weight', header: 'Waga kg' },
    { key: 'area', header: 'Pow. wewn. m²' },
    { key: 'areaExt', header: 'Pow. zewn. m²' },
    { key: 'transport', header: 'Ilość/transport' },
    { key: 'price', header: 'Cena PLN' },
    { key: 'doplataPEHD', header: 'Dopłata PEHD' },
    { key: 'malowanieWewnetrzne', header: 'Malow. wewn.' },
    { key: 'malowanieZewnetrzne', header: 'Malow. zewn.' },
    { key: 'doplataZelbet', header: 'Dopłata Żelbet' },
    { key: 'doplataDrabNierdzewna', header: 'Drab. Nierdzewna' },
    { key: 'magazynWL', header: 'Mag WL' },
    { key: 'magazynKLB', header: 'Mag KLB' },
    { key: 'formaStandardowa', header: 'Forma std. WL' },
    { key: 'formaStandardowaKLB', header: 'Forma std. KLB' },
    { key: 'zapasDol', header: 'Zapas dół mm' },
    { key: 'zapasGora', header: 'Zapas góra mm' },
    { key: 'zapasDolMin', header: 'Zapas dół min mm' },
    { key: 'zapasGoraMin', header: 'Zapas góra min mm' },
    { key: 'spocznikH', header: 'Wys. spocznika' },
    { key: 'hMin1', header: 'Hmin 1 mm' },
    { key: 'hMax1', header: 'Hmax 1 mm' },
    { key: 'cena1', header: 'Cena 1 PLN' },
    { key: 'hMin2', header: 'Hmin 2 mm' },
    { key: 'hMax2', header: 'Hmax 2 mm' },
    { key: 'cena2', header: 'Cena 2 PLN' },
    { key: 'hMin3', header: 'Hmin 3 mm' },
    { key: 'hMax3', header: 'Hmax 3 mm' },
    { key: 'cena3', header: 'Cena 3 PLN' }
] as const;

/** SSoT FE: public/js/studnie/pricelistImportExport.js:89-94 (PRECO_Kinety). */
export const PRECO_KINETY_LIVE_COLUMNS = [
    'DN Studni',
    'DN Rury',
    'Cena prosta (PLN)',
    'Dod. wlot (PLN)'
] as const;

/** SSoT FE: public/js/studnie/pricelistImportExport.js:103-110 (PRECO_Zakresy). */
export const PRECO_ZAKRESY_LIVE_COLUMNS = [
    'Typ',
    'DN Studni',
    'Min',
    'Max',
    'Grupa DN',
    'Cena (PLN)'
] as const;

/** SSoT FE: public/js/studnie/pricelistImportExport.js:117-122 (PRECO_Dodatki). */
export const PRECO_DODATKI_LIVE_COLUMNS = [
    'DN Studni',
    'Skrzynka włazowa',
    'Cena dna osadnika',
    'Cena pełna wys MB'
] as const;

export const PRECO_LIVE_SHEETS = ['PRECO_Kinety', 'PRECO_Zakresy', 'PRECO_Dodatki'] as const;

/** Typy zakresów PRECO (SSoT FE pricelistImportExport.js:98, kolejność arkusza). */
const PRECO_RANGE_TYPES = ['spadekKineta', 'spadekMufa', 'uniesienie', 'redukcja'] as const;

/** SSoT FE: eksport studni buduje serwer (Etap C); grupowanie arkuszy tutaj. */
export function liveStudnieSheetName(p: Record<string, unknown>): string {
    const c = String(p.category ?? '').toLowerCase();
    const ct = String(p.componentType ?? '').toLowerCase();
    if (
        c.includes('akcesoria') ||
        c.includes('chemia') ||
        c.includes('stopnie') ||
        c.includes('uszczelki') ||
        ct === 'wlaz' ||
        ct === 'osadnik'
    )
        return 'Akcesoria';
    if (
        c.includes('przejścia') ||
        c.includes('przejscia') ||
        c.includes('otwór') ||
        c.includes('otwor') ||
        ct === 'przejscie'
    )
        return 'Przejścia';
    if (
        String(p.componentType ?? '')
            .trim()
            .toLowerCase() === 'styczna'
    )
        return 'Styczna';
    if (c.includes('kinet') || ct === 'kineta') return 'Kinety';
    if (c.includes('dennic') || ct === 'dennica') return 'Dennice';
    if (p.dn !== null && p.dn !== undefined && String(p.dn) !== '') {
        return 'DN' + String(p.dn);
    }
    return 'Inne';
}

/** SSoT FE: public/js/studnie/pricelistImportExport.js:74 sanitize. */
export function liveSanitizeSheetName(cat: string): string {
    return cat.replace(/[[\]*/\\?:]/g, '_').substring(0, 31);
}

function toLiveValue(value: unknown): unknown {
    return value ?? '';
}

export function parseJsonObject(raw: unknown): Record<string, unknown> {
    if (raw !== null && typeof raw === 'object' && !Array.isArray(raw)) {
        return raw as Record<string, unknown>;
    }
    if (typeof raw !== 'string' || raw === '') return {};
    try {
        const parsed: unknown = JSON.parse(raw);
        if (parsed !== null && typeof parsed === 'object' && !Array.isArray(parsed)) {
            return parsed as Record<string, unknown>;
        }
    } catch {
        // Mechanicznie: zły JSON → brak wierszy z tego rekordu (jak pusta grupa w LIVE).
    }
    return {};
}

function byOrder(a: Record<string, unknown>, b: Record<string, unknown>): number {
    const oa = typeof a.order === 'number' ? a.order : 0;
    const ob = typeof b.order === 'number' ? b.order : 0;
    return oa - ob;
}

function projectRury(rows: Array<Record<string, unknown>>): LiveSheetRows {
    if (rows.length === 0) return {};
    return {
        [RURY_LIVE_SHEET]: rows.map((p) => {
            const row: Record<string, unknown> = {};
            for (const col of RURY_LIVE_COLUMNS) {
                row[col.header] = toLiveValue(p[col.key]);
            }
            return row;
        })
    };
}

function projectStudnie(rows: Array<Record<string, unknown>>): LiveSheetRows {
    const groups: Record<string, Array<Record<string, unknown>>> = {};
    for (const p of rows) {
        const cat = liveStudnieSheetName(p);
        if (!groups[cat]) groups[cat] = [];
        groups[cat].push(p);
    }
    const out: LiveSheetRows = {};
    for (const cat of Object.keys(groups)) {
        // Sort tylko Przejścia (Styczna i reszta bez sortowania).
        const items =
            cat === 'Przejścia'
                ? [...groups[cat]].sort((a, b) => {
                      if (a.category !== b.category) {
                          return String(a.category ?? '').localeCompare(String(b.category ?? ''));
                      }
                      const dnA =
                          typeof a.dn === 'string' ? parseInt(a.dn) || 0 : Number(a.dn) || 0;
                      const dnB =
                          typeof b.dn === 'string' ? parseInt(b.dn) || 0 : Number(b.dn) || 0;
                      return dnA - dnB;
                  })
                : groups[cat];
        out[liveSanitizeSheetName(cat)] = items.map((p) => {
            const row: Record<string, unknown> = {};
            for (const col of STUDNIE_LIVE_COLUMNS) {
                row[col.header] = toLiveValue(p[col.key]);
            }
            return row;
        });
    }
    return out;
}

function projectPreco(sections: Record<string, Array<Record<string, unknown>>>): LiveSheetRows {
    const out: LiveSheetRows = {};
    // LIVE nie sortuje arkuszy preco — kolejność z DB (order). Puste sekcje → pomiń arkusz.
    const kinety = [...(sections.kinety ?? [])].sort(byOrder);
    if (kinety.length > 0) {
        out.PRECO_Kinety = kinety.map((k) => ({
            'DN Studni': k.wellDn ?? '',
            'DN Rury': k.dn ?? '',
            'Cena prosta (PLN)': k.height ?? '',
            'Dod. wlot (PLN)': k.cena ?? ''
        }));
    }
    const zakresy = [...(sections.zakresy ?? [])].sort(byOrder);
    const zakresyRows: Array<Record<string, unknown>> = [];
    for (const row of zakresy) {
        const grupy = parseJsonObject(row.grupy);
        for (const g of Object.keys(grupy)) {
            zakresyRows.push({
                Typ: row.label ?? '',
                'DN Studni': row.wellDn ?? '',
                Min: row.min ?? '',
                Max: row.max ?? '',
                'Grupa DN': g,
                'Cena (PLN)': grupy[g] ?? ''
            });
        }
    }
    if (zakresyRows.length > 0) out.PRECO_Zakresy = zakresyRows;
    const konfig = [...(sections.konfig ?? [])].sort((a, b) => Number(a.key) - Number(b.key));
    if (konfig.length > 0) {
        out.PRECO_Dodatki = konfig.map((row) => {
            const data = parseJsonObject(row.value);
            return {
                'DN Studni': Number(row.key),
                'Skrzynka włazowa': data.skrzynkaWlazowa || 0,
                'Cena dna osadnika': data.cenaDnoOsadnika || 0,
                'Cena pełna wys MB': data.cenaPelnaWysMB || 0
            };
        });
    }
    return out;
}

/**
 * Projekcja wierszy wersji → shape LIVE (arkusze + nagłówki + kolejność 1:1
 * z eksportem przeglądarki). Puste sekcje → brak arkusza (jak LIVE).
 */
export function projectVersionToLiveShape(
    type: PricelistType,
    sections: Record<string, Array<Record<string, unknown>>>
): LiveSheetRows {
    if (type === 'rury') return projectRury(sections.rury ?? []);
    if (type === 'studnie') return projectStudnie(sections.studnie ?? []);
    return projectPreco(sections);
}

/**
 * Projekcja kształtu zagnieżdżonego PRECO (formatPrecoResponse: entry
 * { DN: { scalar, kinety, spadekKineta... } }) na 3 arkusze 1:1 z FE
 * (pricelistImportExport.js:78-147). Puste sekcje → brak arkusza (jak FE).
 */
export function projectPrecoNestedToSheets(
    entry: Record<string, unknown> | null | undefined
): LiveSheetRows {
    const out: LiveSheetRows = {};
    const kinetyRows: Array<Record<string, unknown>> = [];
    const zakresyRows: Array<Record<string, unknown>> = [];
    const dodatkiRows: Array<Record<string, unknown>> = [];
    for (const dn of Object.keys(entry ?? {})) {
        const data = (entry as Record<string, unknown>)[dn];
        if (data === null || typeof data !== 'object' || Array.isArray(data)) continue;
        const rec = data as Record<string, unknown>;
        if (Array.isArray(rec.kinety)) {
            for (const k of rec.kinety as Array<Record<string, unknown>>) {
                kinetyRows.push({
                    'DN Studni': Number(dn),
                    'DN Rury': k.dn,
                    'Cena prosta (PLN)': k.prosta,
                    'Dod. wlot (PLN)': k.dodWlot
                });
            }
        }
        for (const typ of PRECO_RANGE_TYPES) {
            const arr = rec[typ];
            if (!Array.isArray(arr)) continue;
            for (const row of arr as Array<Record<string, unknown>>) {
                const grupy = row.grupy;
                if (grupy === null || typeof grupy !== 'object' || Array.isArray(grupy)) continue;
                for (const g of Object.keys(grupy as Record<string, unknown>)) {
                    zakresyRows.push({
                        Typ: typ,
                        'DN Studni': Number(dn),
                        Min: row.min,
                        Max: row.max,
                        'Grupa DN': g,
                        'Cena (PLN)': (grupy as Record<string, unknown>)[g]
                    });
                }
            }
        }
        dodatkiRows.push({
            'DN Studni': Number(dn),
            'Skrzynka włazowa': rec.skrzynkaWlazowa || 0,
            'Cena dna osadnika': rec.cenaDnoOsadnika || 0,
            'Cena pełna wys MB': rec.cenaPelnaWysMB || 0
        });
    }
    if (kinetyRows.length > 0) out.PRECO_Kinety = kinetyRows;
    if (zakresyRows.length > 0) out.PRECO_Zakresy = zakresyRows;
    if (dodatkiRows.length > 0) out.PRECO_Dodatki = dodatkiRows;
    return out;
}

/** Porównanie tekstów jak sort DB (kategoria/id w GET live). */
export function cmpText(a: unknown, b: unknown): number {
    const sa = String(a ?? '');
    const sb = String(b ?? '');
    return sa < sb ? -1 : sa > sb ? 1 : 0;
}

/**
 * Wiersz wersji studni (canonical: boolean, dn string) → legacy z GET live
 * (kopia toLegacy z productsStudnieV2.ts: booleany 1/0, dn liczba/string).
 */
export function studnieVersionRowToLegacy(row: Record<string, unknown>): Record<string, unknown> {
    const out = { ...row };
    for (const field of STUDNIE_BOOL_FIELDS) {
        out[field] = out[field] ? 1 : 0;
    }
    const dn = out.dn;
    out.dn = dn != null ? (Number.isNaN(Number(dn)) ? dn : Number(dn)) : null;
    return out;
}

/**
 * Sekcje wersji preco → entry zagnieżdżone per DN (kopia semantyki
 * formatPrecoResponse z precoPricingV2.ts: konfig value JSON → scalary;
 * kinety {dn, prosta: height, dodWlot: cena, order}; zakresy per label
 * z grupy JSON; sort kinety dn/height, zakresy order).
 */
export function buildPrecoEntryFromSections(
    sections: Record<string, Array<Record<string, unknown>>>
): Record<string, unknown> {
    const konfig = sections.konfig ?? [];
    const kinety = sections.kinety ?? [];
    const zakresy = sections.zakresy ?? [];
    const entry: Record<string, unknown> = {};
    for (const row of konfig) {
        const key = String(row.key);
        const wellDn = Number(row.key);
        const parsed = parseJsonObject(row.value);
        const kin = [...kinety]
            .filter((k) => Number(k.wellDn) === wellDn)
            .sort((a, b) => Number(a.dn) - Number(b.dn) || Number(a.height) - Number(b.height))
            .map((k) => ({ dn: k.dn, prosta: k.height, dodWlot: k.cena, order: k.order }));
        const ranges: Record<string, unknown> = {};
        for (const label of PRECO_RANGE_TYPES) {
            ranges[label] = [...zakresy]
                .filter((z) => String(z.label) === label && Number(z.wellDn) === wellDn)
                .sort((a, b) => Number(a.order) - Number(b.order))
                .map((z) => ({
                    order: z.order,
                    min: z.min,
                    max: z.max,
                    grupy: parseJsonObject(z.grupy)
                }));
        }
        entry[key] = { ...parsed, kinety: kin, ...ranges };
    }
    return entry;
}
