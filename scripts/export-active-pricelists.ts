#!/usr/bin/env node
/**
 * export-active-pricelists.ts
 *
 * Read-only eksport obowiązujących cenników z bazy PostgreSQL do formatu
 * pakietu `sok-active-pricelists` (v1), używanego przez świeże instalacje.
 *
 * Nie zapisuje niczego w bazie. Plik wynikowy powstaje tylko z jawnym `--out`;
 * domyślnie skrypt wypisuje podsumowanie (i różnice względem obecnego pakietu).
 *
 * Uzycie:
 *   npx ts-node --transpile-only scripts/export-active-pricelists.ts
 *   npx ts-node --transpile-only scripts/export-active-pricelists.ts --out data/pricelists/active-pricelists.json
 *   npx ts-node --transpile-only scripts/export-active-pricelists.ts --seeds data
 *
 * `--seeds <dir>` regeneruje dodatkowo `seed_rury.json`, `seed_studnie.json`
 * i `seed_preco.json` z wyeksportowanego pakietu (jeden kierunek: baza → pakiet → seed).
 *
 * Kody wyjscia: 0 = OK, 1 = błąd odczytu lub niespójność danych.
 */

import 'dotenv/config';
import fs from 'node:fs';
import path from 'node:path';
import { ZAKRESY_TYPES } from '../src/constants/precoSizes';

// Gdy DATABASE_URL wskazuje host sieci dockerowej, a lokalnie jest baza testowa.
// Eksport musi być jawny: logowany jest host, na który faktycznie idzie zapytanie.
if (
    process.env.POSTGRES_TEST_URL &&
    (!process.env.DATABASE_URL || process.env.DATABASE_URL.includes('@postgres:'))
) {
    process.env.DATABASE_URL = process.env.POSTGRES_TEST_URL;
}

import prisma from '../src/prismaClient';
import { resolveActive, readActiveOverrides } from '../src/services/pricelist/usage';
import {
    ACTIVE_PACKAGE_TYPES,
    ITEM_FIELDS,
    MONEY_FIELDS,
    buildActivePackage,
    packageVersionSha,
    toPackageRow,
    transformPackageRow
} from '../src/services/pricelist/package';
import { diffPackageRows } from '../src/services/pricelist/drift';
import type {
    ActivePackage,
    ActivePackageRows,
    ActivePackageType,
    ActivePackageVersion,
    PackageRow
} from '../src/services/pricelist/package';

const DEFAULT_PACKAGE_PATH = 'data/pricelists/active-pricelists.json';

function parseArgs(argv: string[]): { out: string | null; seeds: string | null } {
    let out: string | null = null;
    let seeds: string | null = null;
    for (let i = 0; i < argv.length; i++) {
        const arg = argv[i];
        if (arg === '--out' || arg === '--seeds') {
            const value = argv[i + 1];
            if (!value || value.startsWith('--')) throw new Error(`Brak wartości dla ${arg}`);
            if (arg === '--out') out = value;
            else seeds = value;
            i++;
            continue;
        }
        throw new Error(`Nieznany argument: ${arg}`);
    }
    return { out, seeds };
}

function describeTarget(): string {
    const url = process.env.DATABASE_URL ?? '';
    try {
        const parsed = new URL(url);
        return `${parsed.hostname}:${parsed.port || '5432'}${parsed.pathname}`;
    } catch {
        return '(niepoprawny DATABASE_URL)';
    }
}

function toVersion(row: Record<string, unknown>): ActivePackageVersion {
    return {
        id: String(row.id),
        type: String(row.type) as ActivePackageType,
        seq: Number(row.seq),
        version: String(row.version),
        status: 'APPROVED',
        effectiveFrom: String(row.effectiveFrom),
        // Pakiet instalacyjny nie może ujawniać loginów źródłowej bazy
        // (kontrakt: tests/scripts/installLinuxServer.test.cjs).
        createdBy: null,
        note: (row.note ?? null) as string | null,
        labelOverride: (row.labelOverride ?? null) as string | null,
        sha256: String(row.sha256),
        createdAt: (row.createdAt ?? null) as string | null,
        updatedAt: (row.updatedAt ?? null) as string | null,
        approvedBy: null,
        approvedAt: (row.approvedAt ?? null) as string | null,
        approvalStatus: (row.approvalStatus ?? null) as string | null
    };
}

function emptyRows(): ActivePackageRows {
    return {
        pricelist_item_rury: [],
        pricelist_item_studnie: [],
        pricelist_item_preco_konfig: [],
        pricelist_item_preco_kinety: [],
        pricelist_item_preco_zakresy: []
    };
}

function sortRows(rows: PackageRow[]): PackageRow[] {
    return [...rows].sort((a, b) => String(a.id).localeCompare(String(b.id)));
}

/** Porównanie bajtowo (jak `ORDER BY id` w bazie z collation C). */
function sortRowsBytes(rows: PackageRow[]): PackageRow[] {
    return [...rows].sort((a, b) => {
        const left = String(a.id);
        const right = String(b.id);
        return left < right ? -1 : left > right ? 1 : 0;
    });
}

/**
 * Hash wersji liczy się z wierszy w konkretnej kolejności, więc kolejność musi
 * odtwarzać `version.sha256`. Kolejność zależy od tego, jak zapisywał ją autor
 * wersji (fizyczna w bazie, sortowanie bajtowe `id`, sortowanie locale), więc
 * sprawdzamy wszystkie trzy; brak dopasowania = niespójność bazy.
 */
function resolveRowOrder(
    type: ActivePackageType,
    versionId: string,
    sha256: string,
    rows: ActivePackageRows
): { rows: ActivePackageRows; order: 'db' | 'id' } {
    if (packageVersionSha(type, versionId, rows) === sha256) return { rows, order: 'db' };
    for (const sorter of [sortRowsBytes, sortRows]) {
        const sorted = emptyRows();
        for (const table of Object.keys(rows) as (keyof ActivePackageRows)[]) {
            sorted[table] = sorter(rows[table]);
        }
        if (packageVersionSha(type, versionId, sorted) === sha256) {
            return { rows: sorted, order: 'id' };
        }
    }
    throw new Error(
        `SHA cennika ${type} (${versionId}) nie zgadza się z wierszami w żadnej kolejności; ` +
            `baza=${sha256}, wiersze=${packageVersionSha(type, versionId, rows)}`
    );
}

async function loadRows(type: ActivePackageType, versionId: string): Promise<ActivePackageRows> {
    const rows = emptyRows();
    const add = (table: keyof ActivePackageRows, data: Record<string, unknown>[]) => {
        rows[table] = data.map((row) => toPackageRow(table, row));
    };
    if (type === 'rury') {
        add(
            'pricelist_item_rury',
            await prisma.pricelistItemRury.findMany({ where: { versionId } })
        );
    } else if (type === 'studnie') {
        add(
            'pricelist_item_studnie',
            await prisma.pricelistItemStudnie.findMany({ where: { versionId } })
        );
    } else {
        add(
            'pricelist_item_preco_konfig',
            await prisma.pricelistItemPrecoKonfig.findMany({ where: { versionId } })
        );
        add(
            'pricelist_item_preco_kinety',
            await prisma.pricelistItemPrecoKinety.findMany({ where: { versionId } })
        );
        add(
            'pricelist_item_preco_zakresy',
            await prisma.pricelistItemPrecoZakresy.findMany({ where: { versionId } })
        );
    }
    return rows;
}

async function buildPackage(): Promise<ActivePackage> {
    const overrides = await readActiveOverrides();
    const versions = {} as Record<ActivePackageType, ActivePackageVersion>;
    const items = {} as Record<ActivePackageType, ActivePackageRows>;
    for (const type of ACTIVE_PACKAGE_TYPES) {
        const active = await resolveActive(type);
        if (!active) throw new Error(`Brak aktywnego cennika dla osi ${type}`);
        versions[type] = toVersion(active as unknown as Record<string, unknown>);
        const loaded = await loadRows(type, active.id);
        const resolved = resolveRowOrder(type, String(active.id), String(active.sha256), loaded);
        items[type] = resolved.rows;
        console.log(
            `[export:pricelists] ${type}: ${active.version} (${active.id}) — ` +
                Object.entries(items[type])
                    .filter(([, rows]) => rows.length > 0)
                    .map(([table, rows]) => `${table}=${rows.length}`)
                    .join(', ') +
                ` — SHA wersji OK (kolejność: ${resolved.order === 'db' ? 'bazy' : 'po id'})`
        );
    }
    const artifact = buildActivePackage({
        exportedAt: new Date().toISOString(),
        versions,
        items,
        activeOverrides: {
            rury: overrides.rury ?? undefined,
            studnie: overrides.studnie ?? undefined,
            preco: overrides.preco ?? undefined
        }
    });
    return artifact;
}

/** Seed musi mieścić się w formacie `data/seed_*.json` (liczby, nie teksty kwot). */
function toSeedRow(table: keyof ActivePackageRows, row: PackageRow): Record<string, unknown> {
    const transformed = transformPackageRow(table, row);
    const seed: Record<string, unknown> = {
        id: String(row.id).slice(String(row.id).lastIndexOf(':') + 1)
    };
    for (const key of ITEM_FIELDS[table]) {
        if (key === 'versionId' || key === 'id') continue;
        const value = transformed[key];
        if (value === undefined || value === null) {
            seed[key] = null;
        } else if (typeof value === 'string' && MONEY_FIELDS.has(key)) {
            seed[key] = Number(value);
        } else {
            seed[key] = value;
        }
    }
    return seed;
}

/**
 * `seed_preco.json` w formacie zagnieżdżonym per DN. Kolejność pozycji bierzemy
 * z tabel `kinety`/`zakresy` (`order`), ale samego `order` nie zapisujemy:
 * `getSeedPrecoItems` nada wierszom kolejność tablicy, a konfig w bazie aplikacji
 * nie niesie `order` w `value` — zapisany `order` tworzyłby sztuczny dryf.
 * Wymagamy ciągłej numeracji od 0, bo na niej opiera się to odwzorowanie.
 */
function assertContiguousOrder(rows: PackageRow[], table: string): void {
    const orders = rows.map((row) => Number(row.order)).sort((a, b) => a - b);
    const contiguous = orders.every((order, index) => order === index);
    if (!contiguous) {
        throw new Error(
            `${table}: kolejność "order" nie jest ciągła od 0 (${orders[0]}..${orders[orders.length - 1]}), ` +
                'nie da się jej odtworzyć z kolejności tablicy'
        );
    }
}

function buildSeedPreco(items: ActivePackageRows): Record<string, unknown> {
    const konfig = [...items.pricelist_item_preco_konfig].sort(
        (a, b) => Number(a.key) - Number(b.key)
    );
    assertContiguousOrder(items.pricelist_item_preco_kinety, 'pricelist_item_preco_kinety');
    assertContiguousOrder(items.pricelist_item_preco_zakresy, 'pricelist_item_preco_zakresy');
    const out: Record<string, unknown> = {};
    for (const cfg of konfig) {
        const wellDn = Number(cfg.key);
        // `kinety` jest wyciągane do osobnej tablicy przez `getSeedPrecoItems`,
        // więc do `value` trafiają wyłącznie pola skalarne.
        const { kinety: _ignoredKinety, ...scalars } = JSON.parse(String(cfg.value)) as Record<
            string,
            unknown
        >;
        void _ignoredKinety;
        const kinety = items.pricelist_item_preco_kinety
            .filter((row) => Number(row.wellDn) === wellDn)
            .sort((a, b) => Number(a.order) - Number(b.order))
            .map((row) => ({
                dn: Number(row.dn),
                prosta: Number(row.height),
                dodWlot: Number(row.cena)
            }));
        const entry: Record<string, unknown> = { ...scalars, kinety };
        for (const label of ZAKRESY_TYPES) {
            entry[label] = items.pricelist_item_preco_zakresy
                .filter((row) => Number(row.wellDn) === wellDn && String(row.label) === label)
                .sort((a, b) => Number(a.order) - Number(b.order))
                .map((row) => ({
                    min: Number(row.min),
                    max: Number(row.max),
                    grupy: JSON.parse(String(row.grupy)) as Record<string, unknown>
                }));
        }
        out[String(cfg.key)] = entry;
    }
    return out;
}

function writeJson(filePath: string, value: unknown): void {
    fs.mkdirSync(path.dirname(filePath), { recursive: true });
    fs.writeFileSync(filePath, `${JSON.stringify(value, null, 4)}\n`, 'utf8');
    console.log(`[export:pricelists] zapisano ${filePath}`);
}

function writeSeeds(dir: string, artifact: ActivePackage): void {
    const rury = artifact.items.rury.pricelist_item_rury.map((row) =>
        toSeedRow('pricelist_item_rury', row)
    );
    const studnie = artifact.items.studnie.pricelist_item_studnie.map((row) =>
        toSeedRow('pricelist_item_studnie', row)
    );
    writeJson(path.join(dir, 'seed_rury.json'), rury);
    writeJson(path.join(dir, 'seed_studnie.json'), studnie);
    writeJson(path.join(dir, 'seed_preco.json'), [buildSeedPreco(artifact.items.preco)]);
}

function reportDrift(artifact: ActivePackage): number {
    const filePath = path.resolve(DEFAULT_PACKAGE_PATH);
    if (!fs.existsSync(filePath)) {
        console.log(`[export:pricelists] brak ${DEFAULT_PACKAGE_PATH} — porównanie pominięte`);
        return 0;
    }
    const current = JSON.parse(fs.readFileSync(filePath, 'utf8')) as ActivePackage;
    let total = 0;
    for (const type of ACTIVE_PACKAGE_TYPES) {
        const diffs = diffPackageRows(type, artifact.items[type], current.items[type]);
        const versionChanged = current.versions[type].id !== artifact.versions[type].id;
        total += diffs.length;
        console.log(
            `[export:pricelists] ${type}: pakiet_w_repo=${current.versions[type].version}, ` +
                `baza=${artifact.versions[type].version}, różnic_pól=${diffs.length}` +
                (versionChanged ? ' (inna wersja)' : '')
        );
        for (const diff of diffs.slice(0, 10)) {
            console.log(
                `    ${diff.table} ${diff.id} ${diff.field}: repo=${String(diff.active)} baza=${String(diff.seed)}`
            );
        }
        if (diffs.length > 10) console.log(`    … i ${diffs.length - 10} więcej`);
    }
    return total;
}

async function main(): Promise<void> {
    const { out, seeds } = parseArgs(process.argv.slice(2));
    console.log(`[export:pricelists] baza: ${describeTarget()}`);
    const artifact = await buildPackage();
    console.log(`[export:pricelists] SHA-256 pakietu: ${artifact.sha256}`);
    reportDrift(artifact);
    if (out) writeJson(path.resolve(out), artifact);
    if (seeds) writeSeeds(path.resolve(seeds), artifact);
    if (!out && !seeds) {
        console.log(
            '[export:pricelists] tryb tylko-odczyt. Zapis: --out <plik> [--seeds <katalog>]'
        );
    }
}

main()
    .catch((error: unknown) => {
        console.error(
            `[export:pricelists] BŁĄD: ${error instanceof Error ? error.message : String(error)}`
        );
        process.exitCode = 1;
    })
    .finally(async () => prisma.$disconnect());
