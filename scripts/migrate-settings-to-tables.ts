#!/usr/bin/env ts-node
/**
 * migrate-settings-to-tables.ts
 *
 * Bezpieczna, idempotentna migracja danych cennikowych z `settings` JSON
 * do docelowych tabel Prisma z walidacją SHA-256 i automatycznym rollbackiem.
 *
 * Użycie:
 *   npx ts-node scripts/migrate-settings-to-tables.ts
 *   npx ts-node scripts/migrate-settings-to-tables.ts --dry-run
 *   npx ts-node scripts/migrate-settings-to-tables.ts --backup
 *
 * Flagi:
 *   --dry-run - tylko odczyt i walidacja, bez zapisu
 *   --backup  - wykonaj backup SQLite przed migracją
 */

import { PrismaClient } from '../generated/prisma';
import { createHash } from 'crypto';
import { copyFileSync, existsSync, mkdirSync } from 'fs';
import { resolve } from 'path';

const prisma = new PrismaClient();

// Mapowanie: klucz settings → docelowy model CURRENT + DEFAULT
const TABLE_MAP: Record<string, { current: string; default: string; isPreco?: boolean }> = {
    pricelist_rury: { current: 'productsRury', default: 'productsRuryDefault' },
    pricelist_studnie: { current: 'productsStudnie', default: 'productsStudnieDefault' },
    preco_pricing: { current: 'preco', default: 'precoDefault', isPreco: true }
};

function sha256(obj: unknown): string {
    const canonical = JSON.stringify(obj, Object.keys(obj as object).sort());
    return createHash('sha256').update(canonical, 'utf-8').digest('hex');
}

function parseArgs(): { dryRun: boolean; shouldBackup: boolean } {
    const args = process.argv.slice(2);
    return {
        dryRun: args.includes('--dry-run'),
        shouldBackup: args.includes('--backup')
    };
}

async function doBackup(): Promise<string> {
    const backupDir = resolve(__dirname, '../data/backups');
    if (!existsSync(backupDir)) mkdirSync(backupDir, { recursive: true });

    const ts = Date.now();
    const src = resolve(__dirname, '../data/app.sqlite');
    const dest = resolve(backupDir, `pre_migration_${ts}.sqlite`);

    if (!existsSync(src)) {
        console.warn('  [BACKUP] Brak pliku app.sqlite, pomijam backup.');
        return '';
    }

    copyFileSync(src, dest);
    console.log(`  [BACKUP] ${dest}`);
    return dest;
}

async function readSettings(): Promise<Record<string, unknown>> {
    const keys = Object.keys(TABLE_MAP);
    const rows = await prisma.settings.findMany({
        where: { key: { in: keys } }
    });
    const map: Record<string, unknown> = {};
    for (const r of rows) map[r.key] = r.value;
    return map;
}

const PRECO_RANGE_TYPES = ['spadekKineta', 'spadekMufa', 'uniesienie', 'redukcja'] as const;

function parsePreco(raw: unknown): {
    konfig: Record<string, string>[];
    kinety: Record<string, unknown>[];
    zakresy: Record<string, unknown>[];
} {
    let data = raw;
    if (typeof raw === 'string') data = JSON.parse(raw);
    if (Array.isArray(data)) data = data[0] || {};

    const obj = data as Record<string, any>;
    const konfig: Record<string, string>[] = [];
    const kinety: Record<string, unknown>[] = [];
    const zakresy: Record<string, unknown>[] = [];

    for (const [key, val] of Object.entries(obj)) {
        if (!val || typeof val !== 'object') continue;

        const dnEntry = val as Record<string, any>;

        // Konfig — one row per DN with JSON value (skrzynkaWlazowa, cenaPelnaWysMB, cenaDnoOsadnika)
        const scalars: Record<string, number> = {};
        for (const sk of ['skrzynkaWlazowa', 'cenaPelnaWysMB', 'cenaDnoOsadnika']) {
            if (typeof dnEntry[sk] === 'number') scalars[sk] = dnEntry[sk];
        }
        if (Object.keys(scalars).length > 0) {
            konfig.push({
                id: `konfig_${key}`,
                key: String(key),
                value: JSON.stringify(scalars)
            });
        }

        // Zakresy per range type
        for (const rt of PRECO_RANGE_TYPES) {
            const arr = dnEntry[rt];
            if (!Array.isArray(arr)) continue;
            for (let i = 0; i < arr.length; i++) {
                const z = arr[i];
                const zId = `zakr_${key}_${rt}_${i}`;
                zakresy.push({
                    id: zId,
                    order: zakresy.length,
                    label: rt,
                    min: z.min ?? 0,
                    max: z.max ?? 0,
                    grupy: JSON.stringify(z.grupy ?? {}),
                    wellDn: Number(key)
                });
            }
        }

        // Kinety
        if (Array.isArray(dnEntry.kinety)) {
            for (let i = 0; i < dnEntry.kinety.length; i++) {
                const k = dnEntry.kinety[i];
                const kDn = k.dn ?? 0;
                const kId = `kin_${key}_${i}`;
                kinety.push({
                    id: kId,
                    order: kinety.length,
                    dn: kDn,
                    wellDn: Number(key),
                    height: k.prosta ?? 0,
                    cena: k.dodWlot ?? 0
                });
            }
        }
    }

    return { konfig, kinety, zakresy };
}

async function migratePricelist(
    key: string,
    settings: Record<string, unknown>,
    tx: any,
    dryRun: boolean
): Promise<{ sourceHash: string; targetHash: string; count: number } | { error: string }> {
    const cfg = TABLE_MAP[key];
    const raw = settings[key];

    if (raw === undefined || raw === null) {
        return { error: `Key "${key}" not found in settings` };
    }

    let items: any[];
    try {
        items = typeof raw === 'string' ? JSON.parse(raw) : raw;
    } catch {
        return { error: `Invalid JSON for ${key}` };
    }
    if (!Array.isArray(items)) {
        return { error: `Expected array for ${key}, got ${typeof items}` };
    }

    if (items.length === 0) {
        return { error: `Empty data for ${key}, nothing to migrate` };
    }

    const sourceHash = sha256(items);

    if (!dryRun) {
        await (tx[cfg.current] as any).deleteMany();
        await (tx[cfg.current] as any).createMany({ data: items });
    }

    const targetItems = dryRun
        ? items
        : await (tx[cfg.current] as any).findMany({ orderBy: { id: 'asc' } });

    const targetHash = sha256(targetItems);

    return { sourceHash, targetHash, count: items.length };
}

async function migratePreco(
    key: string,
    settings: Record<string, unknown>,
    tx: any,
    dryRun: boolean
): Promise<{ sourceHash: string; targetHash: string; count: number } | { error: string }> {
    const raw = settings[key];
    if (raw === undefined || raw === null) {
        return { error: `Key "${key}" not found in settings` };
    }

    let parsed: ReturnType<typeof parsePreco>;
    try {
        parsed = parsePreco(raw);
    } catch {
        return { error: `Failed to parse PRECO data for ${key}` };
    }

    const sourceHash = sha256(parsed);

    if (!dryRun) {
        await tx.precoZakresy.deleteMany();
        await tx.precoKinety.deleteMany();
        await tx.precoKonfig.deleteMany();
        if (parsed.konfig.length) await tx.precoKonfig.createMany({ data: parsed.konfig });
        if (parsed.kinety.length) await tx.precoKinety.createMany({ data: parsed.kinety });
        if (parsed.zakresy.length) await tx.precoZakresy.createMany({ data: parsed.zakresy });
    }

    const targetKonfig = dryRun
        ? parsed.konfig
        : await tx.precoKonfig.findMany({ orderBy: { id: 'asc' } });
    const targetKinety = dryRun
        ? parsed.kinety
        : await tx.precoKinety.findMany({ orderBy: { order: 'asc' } });
    const targetZakresy = dryRun
        ? parsed.zakresy
        : await tx.precoZakresy.findMany({ orderBy: { order: 'asc' } });

    const targetHash = sha256({
        konfig: targetKonfig,
        kinety: targetKinety,
        zakresy: targetZakresy
    });

    return {
        sourceHash,
        targetHash,
        count: parsed.konfig.length + parsed.kinety.length + parsed.zakresy.length
    };
}

function printReport(results: Record<string, any>): void {
    console.log('');
    console.log('=== MIGRATION REPORT ===');
    console.log('');

    let allPass = true;

    for (const [key, r] of Object.entries(results)) {
        if (r.error) {
            console.log(`  ${key}: FAIL`);
            console.log(`    Error: ${r.error}`);
            allPass = false;
            continue;
        }

        const match = r.sourceHash === r.targetHash;
        if (!match) allPass = false;

        console.log(`  ${key}: ${match ? 'PASS' : 'FAIL'}`);
        console.log(`    Records:       ${r.count}`);
        console.log(`    Source SHA256: ${r.sourceHash}`);
        console.log(`    Target SHA256: ${r.targetHash}`);
        if (!match) {
            console.log(`    MISMATCH! Dane źródłowe i docelowe różnią się.`);
        }
        console.log('');
    }

    console.log(allPass ? '  STATUS: ALL PASS' : '  STATUS: FAIL');
    console.log('');
}

async function main() {
    const { dryRun, shouldBackup } = parseArgs();

    console.log('=== MIGRATE SETTINGS TO TABLES ===');
    if (dryRun) console.log('  [DRY RUN]');
    if (shouldBackup) {
        const backupPath = await doBackup();
        if (backupPath) console.log(`  Backup: ${backupPath}`);
    }

    const settings = await readSettings();
    const keys = Object.keys(TABLE_MAP);

    const results: Record<string, any> = {};

    await prisma.$transaction(async (tx) => {
        for (const key of keys) {
            const cfg = TABLE_MAP[key];
            if (cfg.isPreco) {
                results[key] = await migratePreco(key, settings, tx, dryRun);
            } else {
                results[key] = await migratePricelist(key, settings, tx, dryRun);
            }

            // Jeśli sourceHash !== targetHash, rollback przez rzucenie błędu
            if (!results[key].error && results[key].sourceHash !== results[key].targetHash) {
                throw new Error(
                    `SHA-256 MISMATCH for ${key}: ${results[key].sourceHash} vs ${results[key].targetHash}`
                );
            }
        }
    });

    printReport(results);

    const hasError = Object.values(results).some((r: any) => r.error);
    const hasMismatch = Object.values(results).some(
        (r: any) => !r.error && r.sourceHash !== r.targetHash
    );

    if (hasError || hasMismatch) {
        console.error('Migracja nie powiodła się. Szczegóły powyżej.');
        process.exit(1);
    }

    console.log('Migracja zakończona sukcesem.');
}

main().catch((err) => {
    console.error('Fatal:', err.message || err);
    process.exit(1);
});
