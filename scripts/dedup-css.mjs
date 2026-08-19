/**
 * dedup-css.mjs — usuwa z `source` top-level reguły, które są CZYSTYMI duplikatami
 * (selektor+body identyczne po normalizacji) względem `candidates` (źródeł prawdy).
 *
 * Użycie: node scripts/dedup-css.mjs <source> <candidate1> [candidate2 ...]
 * - backup do <source>.bak
 * - usuwa CAŁĄ regułę (selektor + blok), w tym wielolinijkowe selektory
 * - nie dotyka bloków @media/@keyframes (przetwarzane osobno)
 */

import fs from 'fs';
import path from 'path';

const ROOT = 'I:/GitHub/Oferty_PV';
const [srcArg, ...candArgs] = process.argv.slice(2);
const srcPath = path.join(ROOT, srcArg);
const candPaths = candArgs.map((p) => path.join(ROOT, p));

function normalize(css) {
    return css
        .replace(/\/\*[\s\S]*?\*\//g, '')
        .replace(/\s+/g, ' ')
        .replace(/ ?([{}:;,>~+]) ?/g, '$1')
        .trim();
}

// Zwraca top-level reguły: { selStart, end, selText, bodyText, full }
// full = selektor (wielolinijkowy) + blok, bez komentarzy w selektorze.
function topLevelRules(css) {
    const rules = [];
    let depth = 0;
    let braceStart = -1;
    let selStart = -1;
    let i = 0;
    const n = css.length;
    while (i < n) {
        const c = css[i];
        if (c === '{') {
            if (depth === 0) {
                braceStart = i;
                // cofnij do początku selektora (po ostatniej granicy depth 0)
                selStart = i;
                while (selStart > 0) {
                    const pc = css[selStart - 1];
                    if (pc === '}' || pc === ';') break;
                    selStart--;
                }
            }
            depth++;
        } else if (c === '}') {
            depth--;
            if (depth === 0 && braceStart !== -1) {
                const full = css.slice(selStart, i + 1);
                if (!full.trim().startsWith('@')) {
                    const braceIdx = full.indexOf('{');
                    const selText = full.slice(0, braceIdx).trim();
                    const bodyText = full.slice(braceIdx + 1, full.length - 1).trim();
                    if (selText && bodyText) {
                        rules.push({ selStart, end: i, selText, bodyText, full });
                    }
                }
                braceStart = -1;
                selStart = -1;
            }
        }
        i++;
    }
    return rules;
}

const src = fs.readFileSync(srcPath, 'utf8');

// Mapa duplikatów: norm(selText+bodyText) -> true
const dupNorm = new Set();
for (const cp of candPaths) {
    const cand = fs.readFileSync(cp, 'utf8');
    for (const r of topLevelRules(cand)) {
        dupNorm.add(normalize(r.selText + r.bodyText));
    }
}

const srcRules = topLevelRules(src);
const toRemove = srcRules.filter((r) => dupNorm.has(normalize(r.selText + r.bodyText)));

fs.writeFileSync(srcPath + '.bak', src);

let out = src;
toRemove.sort((a, b) => b.selStart - a.selStart);
for (const r of toRemove) {
    // obejmij też białe znaki przed selektorem (do poprzedniej linii)
    let s = r.selStart;
    while (s > 0 && /\s/.test(out[s - 1])) s--;
    out = out.slice(0, s) + out.slice(r.end + 1);
}

fs.writeFileSync(srcPath, out);
console.log(`usunięto czyste duplikaty: ${toRemove.length}`);
console.log(
    `rozmiar: ${src.length}B -> ${out.length}B (${Math.round((1 - out.length / src.length) * 100)}%)`
);
