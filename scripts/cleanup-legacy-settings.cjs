#!/usr/bin/env node
/**
 * cleanup-legacy-settings.cjs
 *
 * Usuwa legacy klucze cennikowe z tabeli `settings` (relikt migracji ustawień
 * do tabel Prisma, ADR-007). Źródłem prawdy cen są tabele, więc klucze są
 * martwe i tylko zaciemniają porównanie stanu.
 *
 * ZACHOWUJE: pricelist_defaults_updated_at (używany przez runtime).
 *
 * Użycie:
 *   node scripts/cleanup-legacy-settings.cjs            # podgląd (dry-run)
 *   node scripts/cleanup-legacy-settings.cjs --apply    # usunięcie
 *
 * Bezpieczniki:
 *   - domyślnie dry-run (podgląd, bez zapisu),
 *   - nie usuwa, gdy tabele cenników są puste (nigdy nie kasuj jedynej kopii),
 *   - dump wartości do data/backups/legacy_settings_<ts>.json przed usunięciem.
 */

const { mkdirSync, writeFileSync } = require('fs');
const { dirname, join } = require('path');

const LEGACY_KEYS = [
    'pricelist_rury',
    'pricelist_rury_default',
    'pricelist_studnie',
    'pricelist_studnie_default',
    'preco_pricing',
    'preco_pricing_default'
];

const KEEP_KEY = 'pricelist_defaults_updated_at';

const GUARD_TABLES = ['productsRury', 'productsStudnie', 'precoKonfig'];

/**
 * Rdzeń czyszczenia (testowalny, bez wejścia/wyjścia na stałe).
 *
 * @param prisma - klient Prisma (lub mock)
 * @param opts.apply - true = usuń, false = tylko podgląd
 * @param opts.dumpFile - ścieżka pliku dump (null = pomiń dump)
 * @returns raport { found, deleted, guardEmpty, dumpWritten, keepExists }
 */
async function cleanupLegacySettings(prisma, { apply = false, dumpFile = null } = {}) {
    const counts = {};
    const guardEmpty = [];
    for (const table of GUARD_TABLES) {
        counts[table] = await prisma[table].count();
        if (counts[table] === 0) guardEmpty.push(table);
    }
    if (guardEmpty.length > 0) {
        return { found: 0, deleted: 0, guardEmpty, dumpWritten: false, keepExists: null };
    }

    const rows = await prisma.settings.findMany({ where: { key: { in: LEGACY_KEYS } } });
    const keepRow = await prisma.settings.findUnique({ where: { key: KEEP_KEY } });

    let dumpWritten = false;
    if (apply && rows.length > 0 && dumpFile) {
        const dump = {
            exportedAt: new Date().toISOString(),
            source: 'cleanup-legacy-settings.cjs',
            keys: Object.fromEntries(rows.map((r) => [r.key, r.value]))
        };
        mkdirSync(dirname(dumpFile), { recursive: true });
        writeFileSync(dumpFile, JSON.stringify(dump, null, 2) + '\n', 'utf-8');
        dumpWritten = true;
    }

    let deleted = 0;
    if (apply && rows.length > 0) {
        const del = await prisma.settings.deleteMany({ where: { key: { in: LEGACY_KEYS } } });
        deleted = del.count;
    }

    return {
        found: rows.length,
        deleted,
        guardEmpty: [],
        dumpWritten,
        keepExists: Boolean(keepRow)
    };
}

async function main() {
    const args = process.argv.slice(2);
    const apply = args.includes('--apply');

    console.log('=== CLEANUP LEGACY SETTINGS ===');
    console.log(apply ? '  [APPLY] Usuwam legacy klucze cennikowe' : '  [DRY RUN] Podgląd, bez zapisu');
    console.log('');

    const { PrismaClient } = require('../generated/prisma/index.js');
    const prisma = new PrismaClient();

    const dumpFile = join(process.cwd(), 'data', 'backups', `legacy_settings_${Date.now()}.json`);
    const report = await cleanupLegacySettings(prisma, { apply, dumpFile });

    if (report.guardEmpty.length > 0) {
        console.error(
            `  ABORT: puste tabele cenników: ${report.guardEmpty.join(', ')} — nie usuwam legacy kluczy.`
        );
        console.error('  Przywróć najpierw cenniki (seed lub import), potem powtórz.');
        await prisma.$disconnect();
        process.exit(1);
    }

    console.log(`  Kluczy do usunięcia: ${report.found}`);
    if (report.found > 0) {
        const rows = await prisma.settings.findMany({ where: { key: { in: LEGACY_KEYS } } });
        for (const r of rows) {
            console.log(`    ${r.key.padEnd(34)} (${r.value.length} znaków)`);
        }
    }
    if (report.dumpWritten) console.log(`  Dump wartości: ${dumpFile}`);
    console.log(`  Zostaje: ${KEEP_KEY}${report.keepExists ? '' : ' (BRAK w bazie)'}`);
    console.log('');

    if (!apply) {
        console.log('  Uruchom z --apply aby wykonać usunięcie.');
        await prisma.$disconnect();
        return;
    }
    console.log(`  Usunięto kluczy: ${report.deleted}`);
    await prisma.$disconnect();
}

if (require.main === module) {
    main().catch((err) => {
        console.error('Fatal:', err.message || err);
        process.exit(1);
    });
}

module.exports = { cleanupLegacySettings, LEGACY_KEYS, KEEP_KEY };