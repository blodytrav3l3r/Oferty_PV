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

function iconKeys() {
    const keys = new Set();
    const re = /^\s{8}([a-z0-9-]+): \[/gm;
    let m;
    while ((m = re.exec(ICONS_SLIM)) !== null) keys.add(m[1]);
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
