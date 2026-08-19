#!/usr/bin/env node
/**
 * check-global-collisions.mjs — wykrywa globalne nazwy przypisywane w >=2 plikach
 * ładowanych na TEJ SAMEJ stronie (ryzyko nadpisania window.X).
 *
 * Zadanie TASK-048 (docs/REPAIR_PLAN.md). Bezpieczne — raportuje, nie blokuje.
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');

const PAGES = [
    'public/studnie.html',
    'public/rury.html',
    'public/kartoteka.html',
    'public/app.html',
    'public/index.html'
];

const PAGE_REGEX = /src="js\/([^"]+?\.js)\?v=/g;

/** @type {Map<string, Set<string>>} */
const globMap = new Map();

function collectGlobals(fileRel) {
    const full = path.join(ROOT, 'public', fileRel);
    if (!fs.existsSync(full)) return;
    const src = fs.readFileSync(full, 'utf8');
    const re = /window\.([A-Za-z_$][\w$]*)\s*=\s*(?![=])/g;
    let m;
    const seen = new Set();
    while ((m = re.exec(src))) {
        const name = m[1];
        if (seen.has(name)) continue;
        seen.add(name);
        if (!globMap.has(name)) globMap.set(name, new Set());
        const rel = fileRel.replace(/^js[\\/]+/, '').replace(/\//g, path.sep);
        globMap.get(name).add(rel);
    }
}

function walk(dir) {
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const e of entries) {
        const full = path.join(dir, e.name);
        if (e.isDirectory()) {
            walk(full);
        } else if (e.name.endsWith('.js')) {
            collectGlobals(path.relative(path.join(ROOT, 'public'), full));
        }
    }
}

walk(path.join(ROOT, 'public/js'));

let total = 0;
let hasCollision = false;
for (const page of PAGES) {
    const full = path.join(ROOT, page);
    if (!fs.existsSync(full)) continue;
    const html = fs.readFileSync(full, 'utf8');
    const scripts = [...html.matchAll(PAGE_REGEX)].map((x) => x[1].replace(/\//g, path.sep));
    const set = new Set(scripts);
    const collisions = [];
    for (const [name, files] of globMap) {
        const onPage = [...files].filter((f) => set.has(f));
        if (onPage.length > 1) collisions.push([name, onPage]);
    }
    if (collisions.length) {
        hasCollision = true;
        console.log(`[collisions] ${page}: ${collisions.length}`);
        collisions.forEach(([name, files]) => {
            console.log(`  ${name} => ${files.join(' | ')}`);
            total++;
        });
    }
}

if (total === 0) {
    console.log('[collisions] OK — brak zduplikowanych globalnych na stronach.');
}
console.log(`[collisions] zgłoszeń: ${total} (raport informacyjny, nie blokuje).`);
process.exit(0);
