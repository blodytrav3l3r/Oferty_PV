#!/usr/bin/env node
/**
 * prices-verify.ts
 *
 * Brama spójności cenników. Sprawdza trzy warstwy:
 *
 *   1) `data/seed_*.json` — parsują się, mają komplet unikalnych identyfikatorów,
 *   2) pakiet `data/pricelists/active-pricelists.json` — poprawny format, hash
 *      wersji i całości oraz **treść zgodna z seedem** (świeża instalacja ma
 *      dostać dokładnie to, co widzi aplikacja),
 *   3) ACTIVE w bazie — spójność wewnętrzna, a przy `--strict` także treść
 *      zgodna z seedem (dryf = błąd).
 *
 * Baza jest logowana jawnie. Gdy `DATABASE_URL` wskazuje host sieci dockerowej,
 * a `POSTGRES_TEST_URL` jest ustawione, skrypt użyje bazy testowej — ale wypisze
 * to wprost, żeby nikt nie pomylił wyniku z weryfikacją bazy aplikacji.
 *
 * Read-only — niczego nie zapisuje.
 *
 * Uzycie:
 *   npm run prices:verify
 *   npm run prices:verify -- --strict
 *   docker exec sok-oferty npx ts-node --transpile-only scripts/prices-verify.ts --strict
 *
 * Kody wyjscia:
 *   0 = OK (dryf ACTIVE↔seed tylko ostrzega bez --strict)
 *   1 = błąd danych, błąd odczytu bazy, dryf pakietu albo dryf ACTIVE przy --strict
 */

import 'dotenv/config';
import path from 'node:path';

const usedTestDatabase =
    !!process.env.POSTGRES_TEST_URL &&
    (!process.env.DATABASE_URL || process.env.DATABASE_URL.includes('@postgres:'));
if (usedTestDatabase) {
    process.env.DATABASE_URL = process.env.POSTGRES_TEST_URL;
}

import prisma from '../src/prismaClient';
import { getSeedPrecoItems, getSeedRury, getSeedStudnie } from '../src/services/pricelist/seedData';
import { getVersionExport } from '../src/services/pricelist/export';
import { resolveActive } from '../src/services/pricelist/usage';
import { PRICELIST_TYPES } from '../src/services/pricelist/validation';
import type { PricelistType } from '../src/services/pricelist/validation';
import { ACTIVE_PACKAGE_TYPES, readActivePackage } from '../src/services/pricelist/package';
import {
    activeRowsFromSections,
    diffPackageRows,
    seedPackageRows
} from '../src/services/pricelist/drift';
import type { DriftEntry } from '../src/services/pricelist/drift';

type Row = Record<string, unknown>;

const PACKAGE_PATH = path.join('data', 'pricelists', 'active-pricelists.json');

/** Ile różnic pokazać w logu (reszta tylko jako licznik). */
const MAX_REPORTED_DIFFS = 8;

/** Znacznik pozycji już wypisanej wraz ze szczegółami (nie powtarzamy w podsumowaniu). */
const DETAILS_PRINTED = 'details-printed:';

/** Pola, które muszą być skończoną liczbą (mogą być ujemne, np. waga żeliwa). */
const NUMERIC_FIELDS = ['price', 'transport', 'weight', 'area', 'cena', 'cena1', 'cena2', 'cena3'];

/** Pola cenowe — nie mogą być ujemne. */
const NON_NEGATIVE_FIELDS = new Set(['price', 'cena', 'cena1', 'cena2', 'cena3']);

/** Host i baza, na którą faktycznie idą zapytania (bez sekretów). */
function describeDatabase(): string {
    const url = process.env.DATABASE_URL ?? '';
    try {
        const parsed = new URL(url);
        return `${parsed.hostname}:${parsed.port || '5432'}${parsed.pathname}`;
    } catch {
        return '(niepoprawny DATABASE_URL)';
    }
}

function formatDrift(diff: DriftEntry): string {
    return `${diff.type}/${diff.table} ${diff.id} ${diff.field}: seed=${String(
        diff.seed
    )} active=${String(diff.active)}`;
}

function reportDrift(label: string, diffs: DriftEntry[]): void {
    for (const diff of diffs.slice(0, MAX_REPORTED_DIFFS)) {
        console.error(`[prices:verify] BŁĄD: ${label}: ${formatDrift(diff)}`);
    }
    if (diffs.length > MAX_REPORTED_DIFFS) {
        console.error(
            `[prices:verify] BŁĄD: ${label}: … i ${diffs.length - MAX_REPORTED_DIFFS} więcej`
        );
    }
}

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

/** Pakiet instalacyjny musi nieść tę samą treść co seed (hash + pola). */
function checkPackageMatchesSeed(): string[] {
    const issues: string[] = [];
    let artifact;
    try {
        artifact = readActivePackage(PACKAGE_PATH);
    } catch (err: unknown) {
        return [
            `${PACKAGE_PATH}: ${err instanceof Error ? err.message : String(err)}`,
            'odtwórz pakiet: npx ts-node --transpile-only scripts/export-active-pricelists.ts --out ' +
                PACKAGE_PATH +
                ' --seeds data'
        ];
    }
    for (const type of ACTIVE_PACKAGE_TYPES) {
        const diffs = diffPackageRows(type, seedPackageRows(type), artifact.items[type]);
        if (diffs.length > 0) {
            reportDrift(`pakiet ≠ seed (${type})`, diffs);
            issues.push(
                `${DETAILS_PRINTED}pakiet ≠ seed (${type}): ${diffs.length} różnic — ${PACKAGE_PATH}`
            );
        } else {
            const version = artifact.versions[type];
            console.log(`[prices:verify] pakiet ${type}: ${version.version} — zgodny z seedem`);
        }
    }
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
            if (strict) issues.push(`${type}: brak ACTIVE przy --strict`);
            else console.warn(`[prices:verify] ${type}: brak ACTIVE — pomijam`);
            continue;
        }
        const { sections } = await getVersionExport(active.id);
        const rows = Object.values(sections).flat() as Row[];
        const found = checkVersionRows(type, rows);
        issues.push(...found);
        if (found.length > 0) continue;

        const diffs = diffPackageRows(
            type,
            seedPackageRows(type),
            activeRowsFromSections(sections)
        );
        if (diffs.length === 0) {
            console.log(
                `[prices:verify] ${type}: ACTIVE ${active.version} — ${rows.length} pozycji, zgodne z seedem`
            );
            continue;
        }
        const summary = `ACTIVE ≠ seed (${type}, ${active.version}): ${diffs.length} różnic`;
        if (strict) {
            reportDrift(summary, diffs);
            issues.push(`${DETAILS_PRINTED}${summary}`);
        } else {
            console.warn(`[prices:verify] OSTRZEŻENIE: ${summary}`);
            for (const diff of diffs.slice(0, MAX_REPORTED_DIFFS)) {
                console.warn(`[prices:verify]   ${formatDrift(diff)}`);
            }
            console.warn(
                '[prices:verify]   Seed/pakiet opisuje inny cennik niż baza. ' +
                    'Uruchom eksport z bazy aplikacji (docs/cutover/active-pricelists.md).'
            );
        }
    }
    return issues;
}

/**
 * Baza PostgreSQL bez wdrożonego schematu (zero tabel aplikacji) to SKIP, nie awaria.
 * Brak pojedynczej tabeli w bazie z danymi to dryf schematu — twardy błąd,
 * inaczej `validate` przechodzi przy niedostępnej lub rozjechanej bazie.
 */
async function isUninitializedDb(err: unknown): Promise<boolean> {
    if ((err as { code?: unknown })?.code !== 'P2021') return false;
    const rows = await prisma.$queryRaw<Array<{ c: bigint | number }>>`
        SELECT count(*) AS c
        FROM information_schema.tables
        WHERE table_schema = current_schema() AND table_type = 'BASE TABLE'
    `;
    return Number(rows[0]?.c ?? 0) === 0;
}

async function main(): Promise<void> {
    const strict = process.argv.slice(2).includes('--strict');
    console.log(
        `[prices:verify] baza: ${describeDatabase()}` +
            (usedTestDatabase ? ' (POSTGRES_TEST_URL — baza testowa)' : '')
    );
    const issues = checkSeedFiles();
    issues.push(...checkPackageMatchesSeed());

    try {
        issues.push(...(await checkActive(strict)));
    } catch (err: unknown) {
        if (await isUninitializedDb(err)) {
            console.warn(
                '[prices:verify] SKIP: baza bez wdrożonego schematu — uruchom `prisma migrate deploy`.'
            );
        } else {
            issues.push(
                `nie można odczytać ACTIVE: ${err instanceof Error ? err.message : String(err)}`
            );
        }
    }

    if (issues.length > 0) {
        for (const issue of issues) {
            if (!issue.startsWith(DETAILS_PRINTED)) console.error(`[prices:verify] BŁĄD: ${issue}`);
        }
        process.exit(1);
    }
    console.log('[prices:verify] OK — seed, pakiet i ACTIVE spójne.');
}

main()
    .catch((err: unknown) => {
        console.error('[prices:verify] Blad:', err);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
