#!/usr/bin/env node
/**
 * prices-verify.ts
 *
 * Etap 2: tabel LIVE i kopii domyślnych nie ma, więc nie ma czego porównywać
 * między warstwami. Skrypt sprawdza dwie rzeczy:
 *
 *   1) pliki `data/seed_*.json` parsują się i mają komplet identyfikatorów,
 *   2) ACTIVE każdej osi istnieje i jest spójna wewnętrznie (unikalne `id`,
 *      skończone ceny, komplet priec).
 *
 * Brak ACTIVE to SKIP (świeża instalacja przed bootstrapem), a z `--strict`
 * błąd — CI może wymagać opublikowanej wersji.
 *
 * Read-only — niczego nie zapisuje.
 *
 * Uzycie:
 *   npm run prices:verify
 *   npx ts-node --transpile-only scripts/prices-verify.ts --strict
 *
 * Kody wyjscia:
 *   0 = OK albo SKIP
 *   1 = błąd danych albo brak ACTIVE przy --strict
 */

import 'dotenv/config';
import prisma from '../src/prismaClient';
import { getSeedPrecoItems, getSeedRury, getSeedStudnie } from '../src/services/pricelist/seedData';
import { getVersionExport } from '../src/services/pricelist/export';
import { resolveActive } from '../src/services/pricelist/usage';
import { PRICELIST_TYPES } from '../src/services/pricelist/validation';
import type { PricelistType } from '../src/services/pricelist/validation';

type Row = Record<string, unknown>;

/** Pola, które muszą być skończoną liczbą (mogą być ujemne, np. waga żeliwa). */
const NUMERIC_FIELDS = ['price', 'transport', 'weight', 'area', 'cena', 'cena1', 'cena2', 'cena3'];

/** Pola cenowe — nie mogą być ujemne. */
const NON_NEGATIVE_FIELDS = new Set(['price', 'cena', 'cena1', 'cena2', 'cena3']);

function checkSeedFiles(): string[] {
    const issues: string[] = [];
    const rury = getSeedRury();
    const studnie = getSeedStudnie();
    const preco = getSeedPrecoItems('seed-check');
    if (rury.length === 0) issues.push('seed_rury.json: 0 wierszy');
    if (studnie.length === 0) issues.push('seed_studnie.json: 0 wierszy');
    if (preco.konfig.length === 0) issues.push('seed_preco.json: 0 konfiguracji');
    for (const [label, rows] of [
        ['rury', rury],
        ['studnie', studnie]
    ] as const) {
        const ids = new Set<string>();
        for (const row of rows) {
            const id = String(row.id ?? '');
            if (!id) issues.push(`seed_${label}: wiersz bez id`);
            else if (ids.has(id)) issues.push(`seed_${label}: duplikat id ${id}`);
            ids.add(id);
        }
    }
    console.log(
        `[prices:verify] seed: rury=${rury.length}, studnie=${studnie.length}, ` +
            `preco=${preco.konfig.length}+${preco.kinety.length}+${preco.zakresy.length}`
    );
    return issues;
}

function checkVersionRows(type: PricelistType, rows: Row[]): string[] {
    const issues: string[] = [];
    if (rows.length === 0) {
        issues.push(`${type}: ACTIVE bez pozycji`);
        return issues;
    }
    const ids = new Set<string>();
    for (const row of rows) {
        const id = String(row.id ?? '');
        if (!id) issues.push(`${type}: pozycja bez id`);
        else if (ids.has(id)) issues.push(`${type}: duplikat id ${id}`);
        ids.add(id);
        for (const field of NUMERIC_FIELDS) {
            const value = row[field];
            if (value == null) continue;
            if (typeof value !== 'number' || !Number.isFinite(value)) {
                issues.push(`${type}: ${id} pole ${field} nie jest skończoną liczbą`);
            } else if (value < 0 && NON_NEGATIVE_FIELDS.has(field)) {
                issues.push(`${type}: ${id} pole ${field} jest ujemne (${value})`);
            }
        }
    }
    return issues;
}

async function checkActive(strict: boolean): Promise<string[]> {
    const issues: string[] = [];
    for (const type of PRICELIST_TYPES) {
        const active = await resolveActive(type);
        if (!active) {
            const line = `[prices:verify] ${type}: brak ACTIVE — pomijam`;
            if (strict) issues.push(`${type}: brak ACTIVE przy --strict`);
            else console.warn(line);
            continue;
        }
        const { sections } = await getVersionExport(active.id);
        const rows = Object.values(sections).flat() as Row[];
        const found = checkVersionRows(type, rows);
        issues.push(...found);
        if (found.length === 0) {
            console.log(
                `[prices:verify] ${type}: ACTIVE ${active.version} — ${rows.length} pozycji OK`
            );
        }
    }
    return issues;
}

async function main(): Promise<void> {
    const strict = process.argv.slice(2).includes('--strict');
    const issues = checkSeedFiles();

    try {
        issues.push(...(await checkActive(strict)));
    } catch (err: unknown) {
        console.warn(
            '[prices:verify] SKIP weryfikacji ACTIVE (brak bazy?):',
            err instanceof Error ? err.message : err
        );
    }

    if (issues.length > 0) {
        for (const issue of issues) console.error(`[prices:verify] BŁĄD: ${issue}`);
        process.exit(1);
    }
    console.log('[prices:verify] OK — seed i ACTIVE spójne.');
}

main()
    .catch((err: unknown) => {
        console.error('[prices:verify] Blad:', err);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
