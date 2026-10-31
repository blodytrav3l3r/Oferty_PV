/**
 * Detektor rozjazdu ACTIVE (wersje) vs LIVE (tabele legacy).
 *
 * ACTIVE wyznacza ceny ofert; LIVE to snapshot legacy. Nic ich nie synchronizuje
 * (`approveVersion` nie dotyka LIVE), a `prices:verify` porównywał dotąd tylko
 * LIVE = tabele domyślne = plik — dlatego rozjazd cen (5 dennic DN1200: 1150 vs
 * 1050) przechodził przez wszystkie bramy niezauważony.
 *
 * Read-only: żadnych zapisów. Wynik jest doradczy (WARN), `--strict` w
 * `scripts/prices-verify.ts` zamienia go na błąd.
 */
import prisma from '../../prismaClient';
import { canonicalStringify } from '../priceOverrideService';
import { getVersionExport } from './export';
import { resolveActive } from './usage';

export type DriftType = 'rury' | 'studnie' | 'preco';

export interface DriftEntry {
    /** Wartość pola cenowego (null gdy wiersz go nie ma, np. konfig PRECO). */
    price: number | null;
    /** Znormalizowany wiersz — porównanie pole po polu (nie cały JSON). */
    row: Row;
}

export interface DriftSample {
    key: string;
    kind: 'onlyLive' | 'onlyActive' | 'changed';
    /** Nazwa różniącego się pola (`price`, `dn`, …). */
    field: string;
    live: unknown;
    active: unknown;
}

export interface DriftCounts {
    live: number;
    active: number;
    onlyLive: number;
    onlyActive: number;
    /** Wiersz istnieje po obu stronach, ale różni się czymkolwiek (w tym ceną). */
    changed: number;
    /** Podzbiór `changed`: różnica dotyczy też pola cenowego. */
    priceDiff: number;
}

export interface DriftCounts {
    live: number;
    active: number;
    onlyLive: number;
    onlyActive: number;
    /** Wiersz istnieje po obu stronach, ale różni się czymkolwiek (w tym ceną). */
    changed: number;
    /** Podzbiór `changed`: różnica dotyczy wyłącznie/też pola cenowego. */
    priceDiff: number;
}

export interface DriftReport {
    type: DriftType;
    activeVersionId: string | null;
    /** Brak ACTIVE — nie ma z czym porównywać (nie jest to zgodność). */
    noActive: boolean;
    counts: DriftCounts;
    /** Liczba różniących się wierszy per pole (np. `{ price: 5, dn: 5 }`). */
    fields: Record<string, number>;
    samples: DriftSample[];
    ok: boolean;
}

type Row = Record<string, unknown>;

/** Pola, które nie niosą informacji o cenniku (porównanie po nich to szum):
 *  `active` to martwa kolumna legacy — nie wpływa na cenę ani dostępność,
 *  nie jest eksportowana (`liveProjection.ts` STUDNIE_LIVE_COLUMNS). */
const IGNORED_FIELDS = new Set(['active']);

/** PRECO trzyma część danych jako JSON-string — normalizujemy, by nie łapać formatowania. */
function normalizeRow(type: DriftType, row: Row): Row {
    const out: Row = {};
    for (const [field, raw] of Object.entries(row)) {
        if (IGNORED_FIELDS.has(field)) continue;
        // '' i null to ta sama „brak wartości" (LIVE zapisuje null, wersje '').
        if (raw === '') {
            out[field] = null;
            continue;
        }
        if (type === 'preco' && (field === 'value' || field === 'grupy')) {
            if (typeof raw === 'string' && raw.trim().startsWith('{')) {
                try {
                    out[field] = JSON.parse(raw);
                    continue;
                } catch {
                    // Zostaw surowy string — różnica formatu też jest sygnałem.
                }
            }
        }
        out[field] = raw;
    }
    return out;
}

function asNumber(value: unknown): number | null {
    return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

/**
 * Buduje indeks wierszy po biznesowym `id`. Klucz musi być unikalny w obrębie osi
 * (PRECO: prefiks `preco_konfig_` / `preco_kinety_` / `preco_zakres_`).
 */
export function indexRows(
    type: DriftType,
    rows: Row[],
    priceField: string | null
): Map<string, DriftEntry> {
    const map = new Map<string, DriftEntry>();
    for (const raw of rows) {
        const row = normalizeRow(type, raw);
        const key = String(row.id);
        map.set(key, { price: priceField ? asNumber(row[priceField]) : null, row });
    }
    return map;
}

/** Pola, którymi różnią się dwa wiersze (posortowane). */
function diffFields(a: Row, b: Row): string[] {
    const keys = new Set([...Object.keys(a), ...Object.keys(b)]);
    const out: string[] = [];
    for (const key of keys) {
        if (canonicalStringify(a[key]) !== canonicalStringify(b[key])) out.push(key);
    }
    return out.sort();
}

/**
 * Porównuje dwa indeksy i zwraca liczniki + próbki (do `limit`).
 * Różnice cen są w próbkach pierwsze, żeby WARN nie ginął w szumie danych.
 */
export function compareIndexes(
    live: Map<string, DriftEntry>,
    active: Map<string, DriftEntry>,
    limit = 20
): { counts: DriftCounts; fields: Record<string, number>; samples: DriftSample[] } {
    const counts: DriftCounts = {
        live: live.size,
        active: active.size,
        onlyLive: 0,
        onlyActive: 0,
        changed: 0,
        priceDiff: 0
    };
    const fields: Record<string, number> = {};
    const priceSamples: DriftSample[] = [];
    const otherSamples: DriftSample[] = [];
    const pushSample = (target: DriftSample[], sample: DriftSample) => {
        if (target.length < limit) target.push(sample);
    };

    for (const [key, liveEntry] of live) {
        const activeEntry = active.get(key);
        if (!activeEntry) {
            counts.onlyLive++;
            pushSample(otherSamples, {
                key,
                kind: 'onlyLive',
                field: 'id',
                live: liveEntry.row,
                active: null
            });
            continue;
        }
        const diff = diffFields(liveEntry.row, activeEntry.row);
        if (diff.length === 0) continue;
        counts.changed++;
        for (const field of diff) fields[field] = (fields[field] ?? 0) + 1;
        const priceField = diff.includes('price') ? 'price' : diff.includes('cena') ? 'cena' : null;
        if (priceField) counts.priceDiff++;
        const field = priceField ?? diff[0];
        pushSample(priceField ? priceSamples : otherSamples, {
            key,
            kind: 'changed',
            field,
            live: liveEntry.row[field] ?? null,
            active: activeEntry.row[field] ?? null
        });
    }

    for (const [key, activeEntry] of active) {
        if (live.has(key)) continue;
        counts.onlyActive++;
        pushSample(otherSamples, {
            key,
            kind: 'onlyActive',
            field: 'id',
            live: null,
            active: activeEntry.row
        });
    }

    return { counts, fields, samples: [...priceSamples, ...otherSamples].slice(0, limit) };
}

async function readLive(type: DriftType): Promise<Map<string, DriftEntry>> {
    if (type === 'rury') {
        const rows = (await prisma.productsRury.findMany()) as unknown as Row[];
        return indexRows(type, rows, 'price');
    }
    if (type === 'studnie') {
        const rows = (await prisma.productsStudnie.findMany()) as unknown as Row[];
        return indexRows(type, rows, 'price');
    }
    const [konfig, kinety, zakresy] = await Promise.all([
        prisma.precoKonfig.findMany(),
        prisma.precoKinety.findMany(),
        prisma.precoZakresy.findMany()
    ]);
    const merged = new Map<string, DriftEntry>();
    for (const [rows, field] of [
        [konfig as unknown as Row[], null],
        [kinety as unknown as Row[], 'cena'],
        [zakresy as unknown as Row[], null]
    ] as Array<[Row[], string | null]>) {
        for (const [key, entry] of indexRows(type, rows, field)) merged.set(key, entry);
    }
    return merged;
}

async function readActive(type: DriftType, versionId: string): Promise<Map<string, DriftEntry>> {
    const { sections } = await getVersionExport(versionId);
    if (type === 'rury') {
        return indexRows(type, (sections.rury ?? []) as Row[], 'price');
    }
    if (type === 'studnie') {
        return indexRows(type, (sections.studnie ?? []) as Row[], 'price');
    }
    const merged = new Map<string, DriftEntry>();
    for (const [name, field] of [
        ['konfig', null],
        ['kinety', 'cena'],
        ['zakresy', null]
    ] as Array<[string, string | null]>) {
        for (const [key, entry] of indexRows(type, (sections[name] ?? []) as Row[], field)) {
            merged.set(key, entry);
        }
    }
    return merged;
}

/** Pełny raport dla osi. Nie rzuca przy braku ACTIVE — zwraca `noActive: true`. */
export async function collectDrift(type: DriftType, limit = 20): Promise<DriftReport> {
    const active = await resolveActive(type);
    const live = await readLive(type);
    if (!active) {
        return {
            type,
            activeVersionId: null,
            noActive: true,
            counts: {
                live: live.size,
                active: 0,
                onlyLive: 0,
                onlyActive: 0,
                changed: 0,
                priceDiff: 0
            },
            fields: {},
            samples: [],
            ok: false
        };
    }
    const activeIndex = await readActive(type, active.id);
    const { counts, fields, samples } = compareIndexes(live, activeIndex, limit);
    return {
        type,
        activeVersionId: active.id,
        noActive: false,
        counts,
        fields,
        samples,
        ok: counts.onlyLive + counts.onlyActive + counts.changed === 0
    };
}

/** Jedno zdanie do logu/CLI. */
export function formatDrift(report: DriftReport): string {
    if (report.noActive) {
        return `${report.type}: BRAK aktywnej wersji (LIVE=${report.counts.live} wierszy)`;
    }
    const c = report.counts;
    const verdict = report.ok ? 'OK' : 'ROZJAZD';
    const fields = Object.entries(report.fields)
        .sort((a, b) => b[1] - a[1])
        .map(([field, count]) => `${field}=${count}`)
        .join(' ');
    return (
        `${report.type}: ${verdict} — live=${c.live} active=${c.active} ` +
        `onlyLive=${c.onlyLive} onlyActive=${c.onlyActive} ` +
        `changed=${c.changed} (ceny=${c.priceDiff})` +
        (fields ? ` pola: ${fields}` : '')
    );
}
