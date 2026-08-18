/**
 * Seed Exporter
 *
 * Eksportuje aktualne cenniki z produkcyjnych tabel DB do plików seed JSON
 * (data/seed_rury.json, data/seed_studnie.json, data/seed_preco.json).
 *
 * Format odwzorowuje scripts/export-settings-to-seed.mjs (tabWidth 4, końcowy
 * newline, spłaszczone kinety: prosta=height, dodWlot=cena). Świadoma duplikacja
 * ~40 linii — skrypt CLI zachowuje extra funkcje (dry-run, checksum, walidacja);
 * przy zmianie formatu aktualizuj OBA miejsca.
 */

import fs from 'fs';
import path from 'path';

interface KonfigRow {
    id: string;
    key: string;
    value: string;
}

interface KinetyRow {
    id: string;
    order: number;
    dn: number;
    wellDn: number;
    height: number;
    cena: number;
}

interface ZakresyRow {
    id: string;
    order: number;
    label: string;
    min: number;
    max: number;
    grupy: string;
    wellDn: number;
}

export type { KonfigRow, KinetyRow, ZakresyRow };

const OUTPUT_MAP = {
    rury: path.join(__dirname, '..', '..', 'data', 'seed_rury.json'),
    studnie: path.join(__dirname, '..', '..', 'data', 'seed_studnie.json'),
    preco: path.join(__dirname, '..', '..', 'data', 'seed_preco.json')
};

export function buildPricelistJson(items: Record<string, unknown>[]): string {
    return JSON.stringify(items, null, 4);
}

const RANGE_TYPES = ['spadekKineta', 'spadekMufa', 'uniesienie', 'redukcja'] as const;

function safeJsonParse(val: string, fallback: unknown = {}): unknown {
    try {
        return JSON.parse(val);
    } catch {
        return fallback;
    }
}

export function buildPrecoJson(
    konfig: KonfigRow[],
    kinety: KinetyRow[],
    zakresy: ZakresyRow[] = []
): string {
    const byDn: Record<string, Record<string, unknown>> = {};

    for (const k of konfig) {
        let obj: Record<string, unknown> = {};
        try {
            obj = JSON.parse(k.value) as Record<string, unknown>;
        } catch {
            obj = {};
        }
        // Zakresy mają osobna tabele — usuwamy je z value, zeby zrodlem prawdy
        // była tabela precoZakresy (patrz formatPrecoResponse).
        for (const label of RANGE_TYPES) delete obj[label];
        byDn[k.key] = obj;
    }

    for (const k of kinety) {
        const dnKey = String(k.wellDn);
        if (!byDn[dnKey]) byDn[dnKey] = {};
        if (!Array.isArray(byDn[dnKey].kinety)) byDn[dnKey].kinety = [];
        (byDn[dnKey].kinety as Array<Record<string, unknown>>).push({
            dn: k.dn,
            prosta: k.height,
            dodWlot: k.cena,
            order: k.order
        });
    }

    for (const z of zakresy) {
        const dnKey = String(z.wellDn);
        if (!byDn[dnKey]) byDn[dnKey] = {};
        if (!Array.isArray(byDn[dnKey][z.label])) byDn[dnKey][z.label] = [];
        (byDn[dnKey][z.label] as Array<Record<string, unknown>>).push({
            order: z.order,
            min: z.min,
            max: z.max,
            grupy: safeJsonParse(z.grupy)
        });
    }

    for (const entry of Object.values(byDn)) {
        if (Array.isArray(entry.kinety)) {
            (entry.kinety as Array<{ order: number }>).sort((a, b) => a.order - b.order);
        }
        for (const label of RANGE_TYPES) {
            if (Array.isArray(entry[label])) {
                (entry[label] as Array<{ order: number }>).sort((a, b) => a.order - b.order);
            }
        }
    }

    for (const dnKey of Object.keys(byDn)) {
        const entry = byDn[dnKey];
        const config: Record<string, unknown> = {};
        const arrays: Record<string, unknown> = {};
        for (const [k, v] of Object.entries(entry)) {
            if (k === 'kinety') continue;
            if (Array.isArray(v)) arrays[k] = v;
            else config[k] = v;
        }
        byDn[dnKey] = { ...config, kinety: entry.kinety ?? [], ...arrays };
    }

    return JSON.stringify([byDn], null, 4);
}

function writeAtomic(filePath: string, content: string): void {
    const tmpPath = filePath + '.tmp';
    fs.writeFileSync(tmpPath, content + '\n', 'utf-8');
    fs.renameSync(tmpPath, filePath);
}

export function writeSeedFiles(data: {
    rury: Record<string, unknown>[];
    studnie: Record<string, unknown>[];
    konfig: KonfigRow[];
    kinety: KinetyRow[];
    zakresy?: ZakresyRow[];
}): void {
    writeAtomic(OUTPUT_MAP.rury, buildPricelistJson(data.rury));
    writeAtomic(OUTPUT_MAP.studnie, buildPricelistJson(data.studnie));
    writeAtomic(OUTPUT_MAP.preco, buildPrecoJson(data.konfig, data.kinety, data.zakresy ?? []));
}
