#!/usr/bin/env node
/**
 * generate-licenses.mjs — generator pliku THIRD-PARTY-NOTICES.md.
 *
 * Czyta package-lock.json (pole `packages`) i buduje listę wszystkich pakietów
 * w drzewie zależności (nazwa@wersja — licencja), pogrupowaną po licencji.
 * Zapis: UTF-8 bez BOM, zakończenia linii LF (spójne z encoding policy + Prettier).
 *
 * Użycie:
 *   node scripts/generate-licenses.mjs            # zapisuje THIRD-PARTY-NOTICES.md
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { format } from 'prettier';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const LOCKFILE = path.join(ROOT, 'package-lock.json');
const OUT_FILE = path.join(ROOT, 'THIRD-PARTY-NOTICES.md');

// Pakiety wymagające NOTICE przy dystrybucji (Apache-2.0).
const APACHE_NOTICE_PACKAGES = new Set([
    'playwright',
    'playwright-core',
    'prisma',
    '@prisma/client',
    'puppeteer',
    'puppeteer-core',
    'typescript'
]);

function licenseToString(license) {
    if (typeof license === 'string') return license;
    if (license && typeof license === 'object' && license.type) return license.type;
    return 'UNKNOWN';
}

// Normalizacja licencji: "MIT OR GPL-3.0-or-later" → "MIT OR GPL-3.0-or-later".
function normalizeLicense(license) {
    return license.replace(/^\(|\)$/g, '').trim();
}

// Wyciąga nazwę pakietu z klucza package-lock ("node_modules/@scope/pkg" → "@scope/pkg").
function nameFromKey(key) {
    const parts = key.split('node_modules/');
    return parts[parts.length - 1];
}

function collectPackages(lock) {
    const items = [];
    for (const [key, pkg] of Object.entries(lock.packages || {})) {
        if (!key || !pkg || !pkg.version) continue; // pomiń root ""
        items.push({
            name: nameFromKey(key),
            version: pkg.version,
            license: normalizeLicense(licenseToString(pkg.license))
        });
    }
    items.sort((a, b) => (a.name + a.version).localeCompare(b.name + b.version));
    return items;
}

function groupByLicense(items) {
    const groups = new Map();
    for (const item of items) {
        if (!groups.has(item.license)) groups.set(item.license, []);
        groups.get(item.license).push(item);
    }
    return [...groups.entries()].sort((a, b) => b[1].length - a[1].length);
}

async function buildNotices(lock) {
    const items = collectPackages(lock);
    const groups = groupByLicense(items);
    const lines = [];
    const today = new Date().toISOString().slice(0, 10);

    lines.push('# THIRD-PARTY-NOTICES');
    lines.push('');
    lines.push('Niniejszy dokument zawiera informacje o oprogramowaniu firm trzecich');
    lines.push('używanym w projekcie **S.O.K. — System Ofert i Kalkulacji**.');
    lines.push('');
    lines.push('> **UWAGA:** lista jest generowana automatycznie z `package-lock.json`');
    lines.push('> przez `npm run licenses:generate`. Nie edytuj jej ręcznie —');
    lines.push('> aktualizacja wymaga ponownego wygenerowania.');
    lines.push('');
    lines.push(`Dane na dzień: **${today}**. Pełne teksty licencji znajdują się`);
    lines.push('w katalogach pakietów (`node_modules/<pakiet>/LICENSE` lub `LICENSE.md`).');
    lines.push('');
    lines.push('## Licencje użyte w projekcie');
    lines.push('');
    lines.push(`| Licencja | Liczba pakietów |`);
    lines.push(`| --- | ---: |`);
    for (const [license, pkgs] of groups) {
        lines.push(`| ${license} | ${pkgs.length} |`);
    }
    lines.push('');
    lines.push('## Oprogramowanie firm trzecich');
    lines.push('');
    for (const [license, pkgs] of groups) {
        lines.push(`### ${license} (${pkgs.length})`);
        lines.push('');
        for (const p of pkgs) {
            lines.push(`- ${p.name}@${p.version}`);
        }
        lines.push('');
    }
    lines.push('## Wymagane noty (NOTICE)');
    lines.push('');
    lines.push('Poniższe pakiety (Apache-2.0) wymagają zachowania noty przy dystrybucji:');
    lines.push('');
    for (const p of items) {
        if (p.license === 'Apache-2.0' && APACHE_NOTICE_PACKAGES.has(p.name)) {
            lines.push(`- ${p.name}@${p.version} — zob. ` + '`node_modules/' + p.name + '/NOTICE`');
        }
    }
    lines.push('');
    return format(lines.join('\n') + '\n', { parser: 'markdown' });
}

async function main() {
    let lock;
    try {
        lock = JSON.parse(fs.readFileSync(LOCKFILE, 'utf-8'));
    } catch (err) {
        console.error(`Nie można odczytać ${LOCKFILE}: ${err.message}`);
        process.exit(1);
    }
    fs.writeFileSync(OUT_FILE, await buildNotices(lock), 'utf-8');
    const count = collectPackages(lock).length;
    console.log(`✓ Wygenerowano ${OUT_FILE} (${count} pakietów).`);
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
    main();
}

export { buildNotices, collectPackages, groupByLicense };
