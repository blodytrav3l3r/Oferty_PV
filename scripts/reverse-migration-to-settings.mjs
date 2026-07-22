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

const PRECO_RANGE_TYPES = ['spadekKineta', 'spadekMufa', 'uniesienie', 'redukcja'];

async function reversePreco(dryRun) {
    const konfig = await prisma.precoKonfig.findMany({ orderBy: { id: 'asc' } });
    const kinetyRows = await prisma.precoKinety.findMany({ orderBy: { order: 'asc' } });
    const zakresyRows = await prisma.precoZakresy.findMany({ orderBy: { order: 'asc' } });

    // Rekonstrukcja legacy formatu: per DN
    const legacy = {};

    // Konfig: klucz "1000" z value JSON -> scalars pod obiekt DN
    for (const k of konfig) {
        const dn = k.key;
        if (!legacy[dn]) legacy[dn] = {};
        try {
            const parsed = JSON.parse(k.value);
            Object.assign(legacy[dn], parsed);
        } catch {
            legacy[dn][k.key] = k.value;
        }
    }

    // Kinety: grouped by wellDn
    for (const k of kinetyRows) {
        const wellDn = k.wellDn ?? k.dn;
        const dnKey = String(wellDn);
        if (!legacy[dnKey]) legacy[dnKey] = {};
        if (!legacy[dnKey].kinety) legacy[dnKey].kinety = [];
        legacy[dnKey].kinety.push({
            dn: k.dn,
            prosta: k.height,
            dodWlot: k.cena
        });
    }

    // Range types: grouped by wellDn
    const rangeByDn = {};
    for (const z of zakresyRows) {
        const dnKey = String(z.wellDn);
        if (!rangeByDn[dnKey]) rangeByDn[dnKey] = {};
        if (!rangeByDn[dnKey][z.label]) rangeByDn[dnKey][z.label] = [];
        rangeByDn[dnKey][z.label].push({
            min: z.min,
            max: z.max,
            grupy: JSON.parse(z.grupy || '{}')
        });
    }
    for (const dn of Object.keys(legacy)) {
        const perDn = rangeByDn[dn] || {};
        for (const rt of PRECO_RANGE_TYPES) {
            if (perDn[rt]) {
                legacy[dn][rt] = perDn[rt];
            }
        }
    }

    const value = JSON.stringify([legacy]);
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
        count: kinetyRows.length + zakresyRows.length + konfig.length,
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
