#!/usr/bin/env node
/**
 * export-settings-to-seed.mjs
 *
 * Eksportuje aktualne cenniki z produkcyjnych tabel DB (ProductsRury,
 * ProductsStudnie, PrecoKonfig + PrecoKinety) do plikow seed JSON.
 * Zapisuje w data/seed_rury.json, data/seed_studnie.json, data/seed_preco.json.
 *
 * Uzycie:
 *   node scripts/export-settings-to-seed.mjs
 *   node scripts/export-settings-to-seed.mjs --dry-run
 *   node scripts/export-settings-to-seed.mjs pricelist_rury preco_pricing
 *   node scripts/export-settings-to-seed.mjs --dry-run pricelist_studnie
 */

import { createRequire } from 'module';
import { createHash } from 'crypto';
import { writeFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const require = createRequire(import.meta.url);

import dotenv from 'dotenv';
dotenv.config({ path: resolve(__dirname, '..', '.env') });

const { PrismaClient } = require('../generated/prisma/index.js');

const ALL_KEYS = ['pricelist_rury', 'pricelist_studnie', 'preco_pricing'];

const OUTPUT_MAP = {
    pricelist_rury: resolve(__dirname, '..', 'data', 'seed_rury.json'),
    pricelist_studnie: resolve(__dirname, '..', 'data', 'seed_studnie.json'),
    preco_pricing: resolve(__dirname, '..', 'data', 'seed_preco.json')
};

const PRICELIST_KEYS = new Set(['pricelist_rury', 'pricelist_studnie']);
const REQUIRED_FIELDS = ['id', 'name', 'category', 'price'];

function parseArgs() {
    const args = process.argv.slice(2);
    const dryRun = args.includes('--dry-run');
    const requested = args.filter((a) => !a.startsWith('--'));
    return { dryRun, keys: requested.length ? requested : ALL_KEYS };
}

function checksum(str) {
    return createHash('sha256').update(str, 'utf-8').digest('hex');
}

function missingFields(item) {
    return REQUIRED_FIELDS.filter(
        (f) => item[f] === undefined || item[f] === null || item[f] === ''
    );
}

function detectDuplicates(items) {
    const seen = new Set();
    const dups = new Set();
    for (const item of items) {
        const id = item.id;
        if (id !== undefined && id !== null) {
            if (seen.has(id)) dups.add(id);
            seen.add(id);
        }
    }
    return dups;
}

function processPricelist(items) {
    let missCount = 0;
    const missDetails = [];

    for (let i = 0; i < items.length; i++) {
        const m = missingFields(items[i]);
        if (m.length) {
            missCount++;
            missDetails.push({ idx: i, id: items[i].id, fields: m });
        }
    }

    const dups = detectDuplicates(items);

    // tabWidth 4 (.prettierrc) — identyczne z plikami seed w repo.
    const json = JSON.stringify(items, null, 4);
    const sha = checksum(json);

    return { total: items.length, missCount, missDetails, dups: [...dups], sha, json };
}

function processPreco(konfigRows, kinetyRows) {
    const byDn = {};
    for (const k of konfigRows) {
        let obj = {};
        try {
            obj = JSON.parse(k.value);
        } catch {
            obj = {};
        }
        byDn[k.key] = obj;
    }

    for (const k of kinetyRows) {
        const dnKey = String(k.wellDn);
        if (!byDn[dnKey]) byDn[dnKey] = {};
        if (!Array.isArray(byDn[dnKey].kinety)) byDn[dnKey].kinety = [];
        byDn[dnKey].kinety.push({
            dn: k.dn,
            prosta: k.height,
            dodWlot: k.cena,
            order: k.order
        });
    }

    for (const entry of Object.values(byDn)) {
        if (Array.isArray(entry.kinety)) {
            entry.kinety.sort((a, b) => a.order - b.order);
        }
    }

    // Kolejnosc kluczy jak w repo: pola skalarne, kinety, tablice zakresow.
    for (const dnKey of Object.keys(byDn)) {
        const entry = byDn[dnKey];
        const config = {};
        const arrays = {};
        for (const [k, v] of Object.entries(entry)) {
            if (k === 'kinety') continue;
            if (Array.isArray(v)) arrays[k] = v;
            else config[k] = v;
        }
        byDn[dnKey] = { ...config, kinety: entry.kinety ?? [], ...arrays };
    }

    const data = [byDn];
    const json = JSON.stringify(data, null, 4);
    const sha = checksum(json);

    let kinetyCount = 0;
    for (const entry of Object.values(byDn)) {
        kinetyCount += Array.isArray(entry.kinety) ? entry.kinety.length : 0;
    }

    return { total: Object.keys(byDn).length, kinetyCount, sha, json };
}

function printReport(results, dryRun) {
    console.log('\n=== SETTINGS EXPORT REPORT ===\n');

    for (const [key, r] of Object.entries(results)) {
        if (r.error) {
            console.log(`  key: ${key}`);
            console.log(`  ERROR: ${r.error}\n`);
            continue;
        }

        const isPricelist = PRICELIST_KEYS.has(key);

        console.log(`  key: ${key}`);

        if (isPricelist) {
            console.log(`    Source records:    ${r.total}`);
            console.log(`    Exported records:  ${r.total}`);
            console.log(
                `    Duplicates:        ${r.dups.length}${r.dups.length ? ' (' + r.dups.join(', ') + ')' : ''}`
            );
            console.log(`    Missing fields:    ${r.missCount}`);
            for (const d of r.missDetails) {
                console.log(
                    `      - [#${d.idx}] id=${d.id || 'N/A'}: brakuje ${d.fields.join(', ')}`
                );
            }
        } else {
            console.log(`    DN groups:         ${r.total}`);
            console.log(`    Kinety entries:    ${r.kinetyCount}`);
        }

        console.log(`    SHA-256:           ${r.sha}`);
        console.log(`    Written to:        ${OUTPUT_MAP[key]}`);
        console.log('');
    }

    console.log(dryRun ? '  [DRY RUN] No files written.\n' : '  Done.\n');
}

async function main() {
    const { dryRun, keys } = parseArgs();

    for (const k of keys) {
        if (!ALL_KEYS.includes(k)) {
            console.error(`Unknown key: ${k}. Valid: ${ALL_KEYS.join(', ')}`);
            process.exit(1);
        }
    }

    const prisma = new PrismaClient();
    let results;

    try {
        const queries = [];
        const wantRury = keys.includes('pricelist_rury');
        const wantStudnie = keys.includes('pricelist_studnie');
        const wantPreco = keys.includes('preco_pricing');

        if (wantRury) queries.push(prisma.productsRury.findMany({ orderBy: { id: 'asc' } }));
        if (wantStudnie) queries.push(prisma.productsStudnie.findMany({ orderBy: { id: 'asc' } }));
        if (wantPreco) {
            queries.push(prisma.precoKonfig.findMany({ orderBy: { key: 'asc' } }));
            queries.push(
                prisma.precoKinety.findMany({ orderBy: [{ wellDn: 'asc' }, { order: 'asc' }] })
            );
        }

        const rows = await Promise.all(queries);

        results = {};
        let i = 0;
        if (wantRury) results.pricelist_rury = processPricelist(rows[i++]);
        if (wantStudnie) results.pricelist_studnie = processPricelist(rows[i++]);
        if (wantPreco) {
            results.preco_pricing = processPreco(rows[i], rows[i + 1]);
        }
    } finally {
        await prisma.$disconnect();
    }

    printReport(results, dryRun);

    if (!dryRun) {
        for (const [key, r] of Object.entries(results)) {
            if (r.error) continue;
            writeFileSync(OUTPUT_MAP[key], r.json + '\n', 'utf-8');
        }
    }

    const hasError = Object.values(results).some((r) => r.error);
    if (hasError) process.exit(1);
}

main().catch((err) => {
    console.error('Fatal:', err);
    process.exit(1);
});
