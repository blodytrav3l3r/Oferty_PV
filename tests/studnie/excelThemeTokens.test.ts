// @ts-nocheck -- skan tekstu CSS/JS, celowy brak typow dla public/js
/* ===== EXCEL THEME TOKENS — kontrakt motywu (parzystosc) =====
 * Excel nie zna nazw kolorow: powierzchnie tylko przez var(--excel-*).
 * :root = dark (status quo), kazdy blok html[data-theme='<nazwa>'] MUSI
 * definiowac pelny zestaw. Nowy motyw bez zestawu = ten test pada.
 * Wzorce: tests/printTokensConsistency.test.ts, excelColWidths.test.ts.
 */
import fs from 'fs';
import path from 'path';

const ROOT = path.join(__dirname, '../..');
const BASE_CSS = fs.readFileSync(path.join(ROOT, 'public/css/style.base.css'), 'utf8');
const STUDNIE_CSS = fs.readFileSync(path.join(ROOT, 'public/css/studnie.css'), 'utf8');
const EXCEL_DIR = path.join(ROOT, 'public/js/studnie');
const EXCEL_FILES = fs
    .readdirSync(EXCEL_DIR)
    .filter((f) => f.startsWith('excel') && f.endsWith('.js'))
    .map((f) => ({ name: f, code: fs.readFileSync(path.join(EXCEL_DIR, f), 'utf8') }));

/* Celowe wyjatki: obrys fokusu widoczny na obu tlach (czarny pierscien
 * na bialym tez czytelny), komentarze nie renderuja. */
const ALLOWLIST = [
    { file: 'excelModal.js', pattern: 'rgba(var(--black-rgb), 0.3)' },
    { file: 'excelTableRenderer.js', pattern: 'nieczytelny na ciemnym tle' }
];
const BANNED = [
    'slate-950',
    'white-rgb',
    'slate-200',
    'slate-300',
    'slate-400',
    'slate-500',
    'slate-600',
    'slate-700',
    'slate-800',
    'slate-100',
    'slate-50'
];

function getRootBlock(css) {
    const m = css.match(/:root\s*\{([\s\S]*?)\n\}/);
    return m ? m[1] : '';
}

function getThemeBlocks(css) {
    const out = {};
    const re = /html\[data-theme='([^']+)'\]\s*\{([\s\S]*?)\n\}/g;
    let m;
    while ((m = re.exec(css)) !== null) {
        out[m[1]] = (out[m[1]] || '') + '\n' + m[2];
    }
    return out;
}

function parseTokenNames(block) {
    const names = new Set();
    const re = /(--excel-[a-z-]+)\s*:/g;
    let m;
    while ((m = re.exec(block)) !== null) names.add(m[1]);
    return names;
}

function usedExcelTokens() {
    const used = new Set();
    const re = /var\((--excel-[a-z-]+)\)/g;
    for (const f of EXCEL_FILES) {
        let m;
        while ((m = re.exec(f.code)) !== null) used.add(m[1]);
    }
    let m;
    while ((m = re.exec(STUDNIE_CSS)) !== null) used.add(m[1]);
    return used;
}

describe('excelThemeTokens kontrakt motywu', () => {
    test(':root definiuje pelny zestaw --excel-*', () => {
        const names = parseTokenNames(getRootBlock(BASE_CSS));
        expect(names.size).toBeGreaterThan(0);
        for (const t of usedExcelTokens()) {
            expect(names.has(t)).toBe(true);
        }
    });

    test('kazdy blok data-theme definiuje pelny zestaw z :root', () => {
        const rootNames = parseTokenNames(getRootBlock(BASE_CSS));
        const themes = getThemeBlocks(BASE_CSS);
        expect(Object.keys(themes).length).toBeGreaterThan(0);
        for (const [_theme, block] of Object.entries(themes)) {
            const names = parseTokenNames(block);
            for (const t of rootNames) {
                expect(names.has(t)).toBe(true);
            }
        }
    });

    test('excel*.js bez twardych literatow dark (poza allowlista)', () => {
        const violations = [];
        for (const f of EXCEL_FILES) {
            const lines = f.code.split('\n');
            lines.forEach((line, i) => {
                for (const b of BANNED) {
                    if (!line.includes(b)) continue;
                    const allowed = ALLOWLIST.some(
                        (a) => a.file === f.name && line.includes(a.pattern)
                    );
                    if (!allowed) violations.push(`${f.name}:${i + 1}: ${b}`);
                }
            });
        }
        expect(violations).toEqual([]);
    });
});
