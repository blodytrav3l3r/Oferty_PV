// @ts-nocheck -- skan tekstu CSS/JS, celowy brak typow dla public/js
/* ===== EXCEL DYNAMIC CSS GATE (S-03, Faza 3) =====
 * Wstrzykiwany CSS Excela: kolory wyłącznie przez var(--...),
 * zero literalnych kolorów, zero alternatywnego systemu theme
 * (brak selektora html[data-theme] w JS). Właściwości strukturalne
 * (wymiary, display, position) pozostają dozwolone.
 */
import fs from 'fs';
import path from 'path';

const ROOT = path.join(__dirname, '../..');
const EXCEL_DIR = path.join(ROOT, 'public/js/studnie');
const EXCEL_FILES = fs
    .readdirSync(EXCEL_DIR)
    .filter((f) => f.startsWith('excel') && f.endsWith('.js'))
    .map((f) => ({ name: f, code: fs.readFileSync(path.join(EXCEL_DIR, f), 'utf8') }));

/* Celowe wyjątki: biel na akcentowym tle przycisku (niezależna od motywu —
 * var(--white) to #ffffff w obu motywach, ten sam wynik obliczony). */
const HEX_ALLOWLIST = [{ file: 'excelPasteMismatch.js', pattern: '#fff' }];

function stripComments(code) {
    return code.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1');
}

describe('excelDynamicCss gate motywu', () => {
    test('render Excel nie odczytuje motywu ani nie wybiera stylu w JS', () => {
        const violations = [];
        const themeRead =
            /(?:getAttribute\s*\(\s*['"]data-theme|dataset\s*(?:\.theme|\[\s*['"]theme)|data-theme\s*===|isLightTheme)/i;
        for (const f of EXCEL_FILES) {
            const lines = stripComments(f.code).split('\n');
            lines.forEach((line, i) => {
                if (themeRead.test(line)) violations.push(`${f.name}:${i + 1}`);
            });
        }
        expect(violations).toEqual([]);
    });

    test('brak literalnych kolorow hex poza komentarami (poza allowlista)', () => {
        const violations = [];
        const hexRe = /#[0-9a-fA-F]{3,8}\b/g;
        for (const f of EXCEL_FILES) {
            const lines = stripComments(f.code).split('\n');
            lines.forEach((line, i) => {
                let m;
                while ((m = hexRe.exec(line)) !== null) {
                    const allowed = HEX_ALLOWLIST.some(
                        (a) => a.file === f.name && line.includes(a.pattern)
                    );
                    if (!allowed) violations.push(`${f.name}:${i + 1}: ${m[0]}`);
                }
            });
        }
        expect(violations).toEqual([]);
    });

    test('brak numerycznych rgb()/hsl() poza komentarami', () => {
        const violations = [];
        const numRe = /rgba?\(\s*\d|hsla?\(\s*\d/g;
        for (const f of EXCEL_FILES) {
            const lines = stripComments(f.code).split('\n');
            lines.forEach((line, i) => {
                if (numRe.test(line)) violations.push(`${f.name}:${i + 1}`);
            });
        }
        expect(violations).toEqual([]);
    });
});
