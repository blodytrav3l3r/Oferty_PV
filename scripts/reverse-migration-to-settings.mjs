#!/usr/bin/env node
/**
 * reverse-migration-to-settings.mjs
 *
 * Awaryjne narz�dzie recovery: kopiuje dane z tabel Prisma z powrotem
 * do `settings` (legacy JSON format).
 *
 * U�ycie:
 *   node scripts/reverse-migration-to-settings.mjs          # wszystkie
 *   node scripts/reverse-migration-to-settings.mjs rury      # tylko rury
 *   node scripts/reverse-migration-to-settings.mjs studnie   # tylko studnie
 *   node scripts/reverse-migration-to-settings.mjs preco     # tylko PRECO
 *   node scripts/reverse-migration-to-settings.mjs --dry-run # podgl�d
 *
 * Ostrze�enie: To narz�dzie cofa migracj�. U�ywaj tylko w razie
 * konieczno�ci rollbacku po Deploy 2 (gdy backup SQLite nie jest dost�pny).
 */

import { createRequire } from 'module';
import { createHash } from 'crypto';

const require = createRequire(import.meta.url);
const { PrismaClient } = require('../generated/prisma/index.js');

const prisma = new PrismaClient();

const ALL_SECTIONS = ['rury', 'studnie', 'preco'];

const SETTINGS_KEY_MAP = {
    rury: 'pricelist_rury',
    studnie: 'pricelist_studnie',
    preco: 'preco_pricing'
};

function sha256(obj) {
    const canonical = JSON.stringify(obj, Object.keys(obj).sort());
    return createHash('sha256').update(canonical, 'utf-8').digest('hex');
}

function parseArgs() {
    const args = process.argv.slice(2);
    const dryRun = args.includes('--dry-run');
    const sections = args.filter((a) => !a.startsWith('--'));
    return { dryRun, sections: sections.length ? sections : ALL_SECTIONS };
}

async function reverseRury(dryRun) {
    const items = await prisma.productsRury.findMany({ orderBy: { id: 'asc' } });
    const settingsKey = SETTINGS_KEY_MAP.rury;
    const value = JSON.stringify(items);
    const hash = sha256(items);

    if (!dryRun) {
        await prisma.settings.upsert({
            where: { key: settingsKey },
            update: { value },
            create: { key: settingsKey, value }
        });
    }

    return { section: 'Rury', key: settingsKey, count: items.length, hash, dryRun };
}

async function reverseStudnie(dryRun) {
    const items = await prisma.productsStudnie.findMany({ orderBy: { id: 'asc' } });
    const settingsKey = SETTINGS_KEY_MAP.studnie;
    const value = JSON.stringify(items);
    const hash = sha256(items);

    if (!dryRun) {
        await prisma.settings.upsert({
            where: { key: settingsKey },
            update: { value },
            create: { key: settingsKey, value }
        });
    }

    return { section: 'Studnie', key: settingsKey, count: items.length, hash, dryRun };
}

async function reversePreco(dryRun) {
    const konfig = await prisma.precoKonfig.findMany({ orderBy: { id: 'asc' } });
    const kinety = await prisma.precoKinety.findMany({ orderBy: { order: 'asc' } });
    const zakresy = await prisma.precoZakresy.findMany({ orderBy: { order: 'asc' } });

    // Rekonstrukcja legacy formatu PRECO (zagnie�d�ony obiekt per DN)
    const legacy = {};

    // Konfig do p�askich kluczy
    for (const k of konfig) {
        legacy[k.key] = k.value;
    }

    // Grupuj kinety per DN
    const kinetyByDn = {};
    for (const k of kinety) {
        const dn = k.dn;
        if (!kinetyByDn[dn]) kinetyByDn[dn] = [];
        kinetyByDn[dn].push({ dn: k.dn, height: k.height, cena: k.cena });
    }

    // Zakresy - wsp�lne dla wszystkich DN
    const zakresyArr = zakresy.map((z) => ({
        label: z.label,
        min: z.min,
        max: z.max
    }));

    // Po��cz w legacy format
    for (const [dn, kinList] of Object.entries(kinetyByDn)) {
        legacy[dn] = {
            kinety: kinList,
            zakresy: zakresyArr
        };
    }

    // Konfig specyficzny per DN (je�li istnieje w legacy)
    const legacyConfigKeys = new Set(['precoInsertTop', 'precoFullHeight', 'precoInsertDn']);
    for (const k of konfig) {
        legacy[k.key] = k.value;
    }

    const value = JSON.stringify(legacy);
    const hash = sha256(legacy);

    if (!dryRun) {
        await prisma.settings.upsert({
            where: { key: SETTINGS_KEY_MAP.preco },
            update: { value },
            create: { key: SETTINGS_KEY_MAP.preco, value }
        });
    }

    return {
        section: 'PRECO',
        key: SETTINGS_KEY_MAP.preco,
        count: kinety.length + zakresy.length + konfig.length,
        hash,
        dryRun
    };
}

function printReport(results) {
    console.log('');
    console.log('=== REVERSE MIGRATION REPORT ===');
    console.log('');

    let allOk = true;

    for (const r of results) {
        if (r.error) {
            console.log(`  ${r.section}: FAIL - ${r.error}`);
            allOk = false;
            continue;
        }

        console.log(`  ${r.section}:`);
        console.log(`    Key:       ${r.key}`);
        console.log(`    Records:   ${r.count}`);
        console.log(`    SHA-256:   ${r.hash}`);
        if (r.dryRun) console.log(`    (dry run, not written)`);
        console.log('');
    }

    if (allOk) {
        console.log('  Status: OK');
        if (results.some((r) => r.dryRun)) {
            console.log('  Uruchom bez --dry-run aby zapisa�.');
        }
    } else {
        console.log('  Status: FAIL');
    }
    console.log('');
}

async function main() {
    const { dryRun, sections } = parseArgs();

    console.log('=== REVERSE MIGRATION: Prisma -> Settings ===');
    if (dryRun) console.log('  [DRY RUN]');
    console.log('');

    const results = [];

    for (const section of sections) {
        if (!ALL_SECTIONS.includes(section)) {
            console.error(`Unknown section: ${section}. Valid: ${ALL_SECTIONS.join(', ')}`);
            process.exit(1);
        }

        let result;
        switch (section) {
            case 'rury':
                result = await reverseRury(dryRun);
                break;
            case 'studnie':
                result = await reverseStudnie(dryRun);
                break;
            case 'preco':
                result = await reversePreco(dryRun);
                break;
        }
        results.push(result);
    }

    printReport(results);

    await prisma.$disconnect();
}

main().catch((err) => {
    console.error('Fatal:', err.message || err);
    process.exit(1);
});
