/**
 * normalized-css-diff.mjs — porównuje bloki CSS po normalizacji (usuń białe znaki/wcięcia).
 * Szuka w `source` bloków obecnych w `candidate` (czyste duplikaty vs modyfikacje).
 *
 * Użycie: node scripts/normalized-css-diff.mjs <source> <candidate> [--report-only]
 */

import fs from 'fs';
import path from 'path';

const ROOT = 'I:/GitHub/Oferty_PV';
const [srcPath, candPath] = process.argv.slice(2).map((p) => path.join(ROOT, p));

function normalize(css) {
    return css
        .replace(/\/\*[\s\S]*?\*\//g, '') // usuń komentarze
        .replace(/\s+/g, ' ')
        .replace(/ ?([{}:;,>~+]) ?/g, '$1')
        .trim();
}

function splitRules(css) {
    const norm = normalize(css);
    const rules = [];
    const re = /([^{}]+)\{([^{}]*)\}/g;
    let m;
    while ((m = re.exec(norm))) {
        const sel = m[1].trim();
        const body = m[2].trim();
        if (sel && body) rules.push({ sel, body, raw: sel + '{' + body + '}' });
    }
    return rules;
}

const src = fs.readFileSync(srcPath, 'utf8');
const cand = fs.readFileSync(candPath, 'utf8');

const srcRules = splitRules(src);
const candRules = splitRules(cand);

// Mapa selektor->body (normalizowane) dla kandydata (źródła prawdy)
const candBySel = new Map();
for (const r of candRules) candBySel.set(r.sel, r.body);

let exact = 0;
let modified = 0;
const modifiedList = [];
for (const r of srcRules) {
    if (candBySel.has(r.sel)) {
        if (candBySel.get(r.sel) === r.body) {
            exact++;
        } else {
            modified++;
            modifiedList.push(r.sel);
        }
    }
}

console.log(`source: ${path.basename(srcPath)} (${srcRules.length} reguł)`);
console.log(`candidate: ${path.basename(candPath)} (${candRules.length} reguł)`);
console.log(`czyste duplikaty (selektor+body identyczne): ${exact}`);
console.log(`modyfikacje (selektor wspólny, body różne): ${modified}`);
if (modifiedList.length) {
    console.log('modyfikacje:');
    modifiedList.forEach((s) => console.log('  ' + s));
}
