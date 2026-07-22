#!/usr/bin/env node
/**
 * migration-validate.mjs
 *
 * Por�wnuje dane cennikowe z `settings` (JSON) z danymi w tabelach Prisma.
 * Generuje raport SHA-256 checksum + deep diff dla ka�dej pary.
 *
 * U�ycie:
 *   node scripts/migration-validate.mjs
 *   node scripts/migration-validate.mjs --verbose
 *
 * To jest GATE przed Deploy 2 (usuni�ciem legacy settings).
 * Blokuje deploy, je�li jakikolwiek checksum si� nie zgadza.
 */

import { createRequire } from 'module';
import { createHash } from 'crypto';

const require = createRequire(import.meta.url);
const { PrismaClient } = require('../generated/prisma/index.js');

const prisma = new PrismaClient();

function sha256(obj) {
    const canonical = JSON.stringify(obj, Object.keys(obj).sort());
    return createHash('sha256').update(canonical, 'utf-8').digest('hex');
}

function canonicalSort(arr) {
    if (!Array.isArray(arr)) return arr;
    return arr
        .map((item) => {
            if (item && typeof item === 'object' && !Array.isArray(item)) {
                const sorted = {};
                for (const k of Object.keys(item).sort()) sorted[k] = item[k];
                return sorted;
            }
            return item;
        })
        .sort((a, b) => {
            const aId = a?.id ?? '';
            const bId = b?.id ?? '';
            if (aId < bId) return -1;
            if (aId > bId) return 1;
            return 0;
        });
}

function deepDiff(source, target) {
    const mismatches = [];
    const sourceMap = new Map();
    for (const item of source) sourceMap.set(item.id, item);
    const targetMap = new Map();
    for (const item of target) targetMap.set(item.id, item);

    // Sprawd�, czy ka�dy element source istnieje w target
    for (const [id, sItem] of sourceMap) {
        const tItem = targetMap.get(id);
        if (!tItem) {
            mismatches.push({ id, field: '(missing)', source: sItem, target: undefined });
            continue;
        }
        for (const key of Object.keys(sItem)) {
            const sv = String(sItem[key]);
            const tv = String(tItem[key]);
            if (sv !== tv) {
                mismatches.push({ id, field: key, source: sItem[key], target: tItem[key] });
            }
        }
    }

    // Sprawd�, czy target ma elementy spoza source
    for (const [id, tItem] of targetMap) {
        if (!sourceMap.has(id)) {
            mismatches.push({ id, field: '(extra)', source: undefined, target: tItem });
        }
    }

    return mismatches;
}

function parseArgs() {
    return { verbose: process.argv.includes('--verbose') };
}

function printReport(results, verbose) {
    console.log('');
    console.log('╔══════════════════════════════════════════════════════╗');
    console.log('║           MIGRATION VALIDATION REPORT               ║');
    console.log('╚══════════════════════════════════════════════════════╝');
    console.log('');

    let allPass = true;

    for (const r of results) {
        const match = r.sourceHash === r.targetHash;
        if (!match) allPass = false;

        const line = `${r.label}: ${r.sourceCount}=${r.targetCount} | SHA256: ${match ? '==' : '!='}`;
        console.log(`  ${line}`);
        if (match && r.mismatches === 0) {
            console.log(`    => OK`);
        } else {
            console.log(`    => ${match ? 'OK (match)' : 'MISMATCH!'}`);
            if (r.mismatches > 0) {
                console.log(`    Field mismatches: ${r.mismatches}`);
                if (verbose) {
                    for (const m of r.mismatchDetails) {
                        console.log(
                            `      - [${m.id}] ${m.field}: "${m.source}" vs "${m.target}"`
                        );
                    }
                }
            }
        }
        console.log('');
    }

    const totalMismatches = results.reduce((s, r) => s + r.mismatches, 0);

    console.log(`  FIELD MISMATCHES: ${totalMismatches}`);
    console.log(`  STATUS: ${allPass && totalMismatches === 0 ? 'PASS' : 'FAIL'}`);
    console.log('');
}

async function validateRury(label, model, settingsKey) {
    const row = await prisma.settings.findUnique({ where: { key: settingsKey } });
    const sourceRaw = row?.value;
    const source = sourceRaw ? JSON.parse(sourceRaw) : [];

    const target = await model.findMany({ orderBy: { id: 'asc' } });

    const sourceNorm = canonicalSort(source);
    const targetNorm = canonicalSort(target);

    return {
        label,
        sourceCount: sourceNorm.length,
        targetCount: targetNorm.length,
        sourceHash: sha256(sourceNorm),
        targetHash: sha256(targetNorm),
        match: sha256(sourceNorm) === sha256(targetNorm),
        mismatches: deepDiff(sourceNorm, targetNorm).length,
        mismatchDetails: deepDiff(sourceNorm, targetNorm)
    };
}

async function validatePreco() {
    const row = await prisma.settings.findUnique({ where: { key: 'preco_pricing' } });
    const sourceRaw = row?.value;

    // Parse legacy preco_pricing
    let sourceData = sourceRaw ? JSON.parse(sourceRaw) : {};
    if (Array.isArray(sourceData)) sourceData = sourceData[0] || {};

    // Read Prisma tables
    const targetKonfig = await prisma.precoKonfig.findMany({ orderBy: { id: 'asc' } });
    const targetKinety = await prisma.precoKinety.findMany({ orderBy: { order: 'asc' } });
    const targetZakresy = await prisma.precoZakresy.findMany({ orderBy: { order: 'asc' } });

    const targetAll = {
        konfig: targetKonfig,
        kinety: targetKinety,
        zakresy: targetZakresy
    };

    // For deep equality, convert legacy format to match Prisma structure
    const sourceKinety = [];
    const sourceZakresy = [];
    const seen = new Set();
    for (const [, val] of Object.entries(sourceData)) {
        const entry = val;
        if (!entry || typeof entry !== 'object') continue;
        if (Array.isArray(entry.kinety)) {
            for (const k of entry.kinety) {
                const kid = `kin_${k.dn}_${k.height}`;
                if (!seen.has(kid)) {
                    seen.add(kid);
                    sourceKinety.push({ ...k, id: kid, order: sourceKinety.length });
                }
            }
        }
        if (Array.isArray(entry.zakresy)) {
            for (const z of entry.zakresy) {
                const zid = `zakr_${z.min}_${z.max}`;
                if (!seen.has(`z_${zid}`)) {
                    seen.add(`z_${zid}`);
                    sourceZakresy.push({ ...z, id: zid, order: sourceZakresy.length });
                }
            }
        }
    }

    const sourceNorm = canonicalSort(sourceKinety);
    const targetKinetyNorm = canonicalSort(targetKinety);
    const sourceZakrNorm = canonicalSort(sourceZakresy);
    const targetZakrNorm = canonicalSort(targetZakresy);

    const mismatches = [
        ...deepDiff(sourceNorm, targetKinetyNorm),
        ...deepDiff(sourceZakrNorm, targetZakrNorm)
    ];

    return {
        label: 'PRECO (Kinety+Zakresy)',
        sourceCount: sourceKinety.length + sourceZakresy.length,
        targetCount: targetKinety.length + targetZakresy.length,
        sourceHash: sha256({ kinety: sourceNorm, zakresy: sourceZakrNorm }),
        targetHash: sha256({ kinety: targetKinetyNorm, zakresy: targetZakrNorm }),
        match: sha256({ kinety: sourceNorm, zakresy: sourceZakrNorm }) === sha256({ kinety: targetKinetyNorm, zakresy: targetZakrNorm }),
        mismatches: mismatches.length,
        mismatchDetails: mismatches.slice(0, 50) // limit do 50 w detalach
    };
}

async function main() {
    const { verbose } = parseArgs();

    console.log('=== MIGRATION VALIDATE ===');
    console.log('Por�wnuje: settings (legacy) vs Prisma tabele');
    console.log('');

    const results = [
        await validateRury(
            'Rury',
            prisma.productsRury,
            'pricelist_rury'
        ),
        await validateRury(
            'Studnie',
            prisma.productsStudnie,
            'pricelist_studnie'
        ),
        await validatePreco()
    ];

    printReport(results, verbose);

    const allMatch = results.every(
        (r) => r.match && r.mismatches === 0
    );

    await prisma.$disconnect();

    if (!allMatch) {
        console.error('VALIDATION FAILED. Deploy 2 zablokowany.');
        process.exit(1);
    }
}

main().catch((err) => {
    console.error('Fatal:', err.message || err);
    process.exit(1);
});
