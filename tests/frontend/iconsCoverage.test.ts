// @ts-nocheck -- skan tekstu, celowy brak typow dla public/js
/* ===== ICONS COVERAGE — kazda data-lucide z shared JS istnieje w iconsSlim =====
 * iconsSlim.replaceElement po cichu ignoruje nieznane nazwy (puste <i>).
 * Regresja: theme toggle sun/moon niewidoczne (2026-09-21).
 */
import fs from 'fs';
import path from 'path';

const ROOT = path.join(__dirname, '../..');
const SHARED_DIR = path.join(ROOT, 'public/js/shared');
const ICONS_SLIM = fs.readFileSync(path.join(SHARED_DIR, 'iconsSlim.js'), 'utf8');

/* Dokładna lista kluczy (klucze jednolinijkowe typu `moon: ['...'] też liczą)
 * + ALIASES z iconsSlim.js (P6 ICON CONTRACT — stara nazwa == kanoniczna). */
function iconKeys() {
    const keys = new Set();
    const re = /^\s*'?([a-z0-9-]+)'?: \[/gm;
    let m;
    while ((m = re.exec(ICONS_SLIM)) !== null) keys.add(m[1]);
    const aliasRe = /^\s*'?(?:([a-z0-9-]+))'?: '([a-z0-9-]+)',?\s*$/gm;
    const aliasBlock = ICONS_SLIM.slice(ICONS_SLIM.indexOf('const ALIASES'));
    let a;
    while ((a = aliasRe.exec(aliasBlock)) !== null) {
        if (keys.has(a[2])) keys.add(a[1]);
    }
    return keys;
}

function usedIcons(file) {
    const code = fs.readFileSync(path.join(SHARED_DIR, file), 'utf8');
    const used = new Set();
    const re = /data-lucide=\\?"([a-z0-9-]+)\\?"/g;
    let m;
    while ((m = re.exec(code)) !== null) used.add(m[1]);
    return used;
}

describe('iconsSlim pokrycie ikon shared', () => {
    test('theme toggle: sun i moon istnieja', () => {
        const keys = iconKeys();
        expect(keys.has('sun')).toBe(true);
        expect(keys.has('moon')).toBe(true);
    });

    test('theme.js uzywa tylko ikon z ICONS', () => {
        const keys = iconKeys();
        const missing = [...usedIcons('theme.js')].filter((n) => !keys.has(n));
        expect(missing).toEqual([]);
    });
});

/* ===== Rozszerzenie na 5 katalogów (Faza 3, test kontraktowy, non-blocking) ==
 * iconsSlim.replaceElement po cichu ignoruje nieznane nazwy (puste <i>).
 * Znane braki (luki istniejące przed planem motywów — naprawa to osobny
 * temat: dopisanie ścieżek SVG do generowanego pliku) są zamrożone w
 * KNOWN_GAPS. Test pada tylko na NOWE luki lub nieaktualną allowlistę. */
const SCAN_DIRS = [
    'public/js/shared',
    'public/js/studnie',
    'public/js/spa',
    'public/js/rury',
    'public/js/kartoteka'
];

/* P6 ICON CONTRACT: wszystkie luki domknięte (SVG dopisane do iconsSlim.js
 * albo aliasy w ALIASES; edit-3 wymienione na pencil w plikach).
 * Pusta lista = każda data-lucide w 5 katalogach musi istnieć w ICONS. */
const KNOWN_GAPS = {};

function jsFiles(dir) {
    const out = [];
    const abs = path.join(ROOT, dir);
    for (const f of fs.readdirSync(abs, { withFileTypes: true })) {
        const rel = path.join(dir, f.name);
        if (f.isDirectory()) out.push(...jsFiles(rel));
        else if (f.name.endsWith('.js') && f.name !== 'iconsSlim.js') out.push(rel);
    }
    return out;
}

function scanMissing() {
    const keys = iconKeys();
    const missing = {};
    for (const dir of SCAN_DIRS) {
        for (const rel of jsFiles(dir)) {
            const code = fs.readFileSync(path.join(ROOT, rel), 'utf8');
            const re = /data-lucide=\\?"([a-z0-9-]+)\\?"/g;
            let m;
            const names = new Set();
            while ((m = re.exec(code)) !== null) {
                if (!keys.has(m[1])) names.add(m[1]);
            }
            if (names.size > 0) missing[rel.replace(/\\/g, '/')] = [...names].sort();
        }
    }
    return missing;
}

describe('iconsSlim pokrycie 5 katalogow (kontrakt, non-blocking)', () => {
    test('brak nowych luk poza KNOWN_GAPS (grupowanie per plik)', () => {
        const missing = scanMissing();
        const fresh = [];
        for (const [file, names] of Object.entries(missing)) {
            const known = KNOWN_GAPS[file] || [];
            const extra = names.filter((n) => !known.includes(n));
            if (extra.length > 0) fresh.push(`${file} => NOWE: ${extra.join(',')}`);
        }
        expect(fresh).toEqual([]);
    });

    test('KNOWN_GAPS bez trupa (naprawiona ikona wypada z listy)', () => {
        const missing = scanMissing();
        const stale = [];
        for (const [file, names] of Object.entries(KNOWN_GAPS)) {
            const actual = missing[file] || [];
            const gone = names.filter((n) => !actual.includes(n));
            if (gone.length > 0) stale.push(`${file} => do usuniecia: ${gone.join(',')}`);
        }
        expect(stale).toEqual([]);
    });
});
