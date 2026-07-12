#!/usr/bin/env node
import { readFileSync, readdirSync } from 'fs';
import { join, sep } from 'path';

const ROOT = new URL('..', import.meta.url).pathname.replace(/\/$/, '');
const MAX_LINES = 500;

const EXEMPT = new Set([
    'public/js/studnie/orderManager.js',
    'public/js/studnie/order/orderZlecenia.js',
    'public/js/studnie/wellActions.js',
    'public/js/studnie/wellPopups.js'
]);

const IGNORE_DIRS = new Set(['node_modules', 'dist', 'plugins', '.git']);

let failed = false;

function walk(dir, extList) {
    let entries;
    try {
        entries = readdirSync(dir, { withFileTypes: true });
    } catch {
        return [];
    }
    const result = [];
    for (const entry of entries) {
        if (IGNORE_DIRS.has(entry.name)) continue;
        const full = join(dir, entry.name);
        if (entry.isDirectory()) {
            result.push(...walk(full, extList));
        } else if (extList.some((ext) => entry.name.endsWith(ext))) {
            const rel = full.replace(ROOT + sep, '').replace(/\\/g, '/');
            if (rel.includes('.min.') || rel.includes('xlsx.full')) continue;
            const lines = readFileSync(full, 'utf-8').split('\n').length;
            if (lines > MAX_LINES && !EXEMPT.has(rel)) {
                result.push({ lines, file: rel });
            }
        }
    }
    return result;
}

const over = [...walk('src', ['.ts']), ...walk('public/js', ['.js'])];

if (over.length > 0) {
    console.warn(`\n⚠️  Znaleziono ${over.length} plik(ów) przekraczających ${MAX_LINES} linii:\n`);
    for (const o of over) {
        console.warn(`  ${o.lines} L  ${o.file}`);
    }
    console.warn(`\n🟡  UWAGA: Limit ${MAX_LINES} linii przekroczony — docelowo blokada commita.`);
    console.warn(
        `    Tryb: WARNING (nie blokuje). Plany splitu: orderManager, wellActions, wellPopups.\n`
    );
    // warning mode — exit 0
}

process.exit(0);
