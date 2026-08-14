#!/usr/bin/env node
// Dependency map frontendu: skanuje public/js/* i szuka eksportów (window.X =) oraz użyć
// (window.X() / window.X.) globali. Wypisuje dla wybranych plików global, plik definiujący i
// liczbę użyć. Służy do oceny granic modułów (Faza 4.0 planu) i kolejności skryptów.
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, resolve } from 'node:path';

const ROOT = resolve('public/js');
const EXPORT_RE = /window\.([A-Za-z_$][\w$]*)\s*=\s*(?:window\.)?([A-Za-z_$][\w$]*)?[;,\s}]/g;
const USE_RE = /\bwindow\.([A-Za-z_$][\w$]*)\b/g;

function listJs(dir) {
    const out = [];
    for (const entry of readdirSync(dir)) {
        const full = join(dir, entry);
        if (statSync(full).isDirectory()) {
            out.push(...listJs(full));
        } else if (entry.endsWith('.js')) {
            out.push(full);
        }
    }
    return out;
}

function exportsIn(code) {
    const set = new Map();
    let m;
    while ((m = EXPORT_RE.exec(code)) !== null) set.set(m[1], m[2] || '');
    return set;
}

function usesIn(code) {
    const set = new Set();
    let m;
    while ((m = USE_RE.exec(code)) !== null) set.add(m[1]);
    return set;
}

const files = listJs(ROOT);
const exportsByGlobal = new Map(); // global -> [{file, value}]
const fileExports = new Map(); // file -> Map(global -> value)
for (const file of files) {
    const code = readFileSync(file, 'utf8');
    const ex = exportsIn(code);
    fileExports.set(file, ex);
    for (const [g, v] of ex) {
        if (!exportsByGlobal.has(g)) exportsByGlobal.set(g, []);
        exportsByGlobal.get(g).push({ file, value: v });
    }
}

// tryb: --global <nazwa> — pokaż definicje i użycia danego globala
const gIdx = process.argv.indexOf('--global');
if (gIdx >= 0 && process.argv[gIdx + 1]) {
    const target = process.argv[gIdx + 1];
    const defs = exportsByGlobal.get(target) || [];
    console.log(`GLOBAL ${target}`);
    for (const d of defs) console.log(`  DEF  ${d.file} (window.${target} = ${d.value || '...'})`);
    for (const file of files) {
        const code = readFileSync(file, 'utf8');
        const uses = usesIn(code);
        if (uses.has(target) && !(fileExports.get(file) && fileExports.get(file).has(target))) {
            console.log(`  USE  ${file}`);
        }
    }
    process.exit(0);
}

// tryb domyslny: podsumowanie — ile globali eksportuje kazdy plik + top nieposiadane
const summary = files
    .map((f) => ({ file: f, count: fileExports.get(f).size }))
    .sort((a, b) => b.count - a.count);
console.log('LICZBA PLIKOW:', files.length);
console.log('LICZBA UNIKALNYCH GLOBALI (window.*):', exportsByGlobal.size);
console.log('\nTOP 15 PLIKOW WG LICZBY EKSPORTOWANYCH GLOBALI:');
for (const s of summary.slice(0, 15)) {
    console.log(`  ${s.count.toString().padStart(4)}  ${s.file}`);
}
console.log('\nGLOBALE ZDEFINIOWANE W WIECEJ NIZ 1 PLIKU (potencjalne konflikty/duplikaty):');
let multi = 0;
for (const [g, defs] of exportsByGlobal) {
    if (defs.length > 1) {
        multi++;
        console.log(`  ${g}: ${defs.map((d) => d.file).join(', ')}`);
    }
}
console.log(`\nLICZBA KONFLIKTOW: ${multi}`);
