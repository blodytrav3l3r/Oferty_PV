// @ts-nocheck -- vm sandbox, celowy brak typow dla public/js
import fs from 'fs';
import path from 'path';
import vm from 'vm';

function readJs(name: string): string {
    return fs.readFileSync(path.join(__dirname, '../../public/js/studnie', name), 'utf8');
}

function loadState(store: Record<string, string> = {}) {
    const context: any = {
        window: {},
        localStorage: {
            getItem: (k: string) => (k in store ? store[k] : null),
            setItem: (k: string, v: string) => {
                store[k] = String(v);
            },
            removeItem: (k: string) => {
                delete store[k];
            }
        }
    };
    vm.createContext(context);
    vm.runInContext(readJs('excelState.js'), context);
    return { ctx: context, store };
}

describe('excelHeaderFonts rozmiar H1/H2/H3', () => {
    test('defaulty odtwarzaja obecny wyglad', () => {
        const { ctx } = loadState();
        expect(vm.runInContext("_excelHeaderFontPx('h1')", ctx)).toBe(10);
        expect(vm.runInContext("_excelHeaderFontPx('h2')", ctx)).toBe(10);
        expect(vm.runInContext("_excelHeaderFontPx('h3')", ctx)).toBe(9);
    });

    test('clamp 8-20 i odrzucenie smieci', () => {
        const { ctx } = loadState();
        const out = vm.runInContext("_excelNormalizeHeaderFonts({h1: 100, h2: 0, h3: 'x'})", ctx);
        expect(out).toEqual({ h1: 20, h2: 8, h3: 9 });
    });

    test('roundtrip localStorage', () => {
        const { ctx, store } = loadState();
        vm.runInContext('_excelHeaderFontSizes = _excelNormalizeHeaderFonts({h1: 14})', ctx);
        vm.runInContext('_excelSaveHeaderFonts()', ctx);
        expect(JSON.parse(store['sok_excel_header_fonts']).h1).toBe(14);
        vm.runInContext('_excelHeaderFontSizes = _excelNormalizeHeaderFonts(null)', ctx);
        vm.runInContext('_excelLoadHeaderFonts()', ctx);
        expect(vm.runInContext("_excelHeaderFontPx('h1')", ctx)).toBe(14);
    });

    test('renderer bierze px z gettera (wszystkie wiersze)', () => {
        const src = readJs('excelTableRenderer.js');
        expect(src).toContain("_excelHeaderFontPx('h1')");
        expect(src).toContain("_excelHeaderFontPx('h2')");
        expect(src).toContain("_excelHeaderFontPx('h3')");
        expect(src).not.toContain('font-size: var(--fs-xs)');
    });

    test('popup Kolumny ma sekcje stepperow H1/H2/H3', () => {
        const src = readJs('excelColumnVisibility.js');
        expect(src).toContain('Rozmiar czcionki');
        expect(src).toContain('_excelHeaderFontStep');
        expect(src).toContain('_excelHeaderFontReset');
        // SOK: klasy CSS + ikony Lucide, nie inline style na przyciskach
        expect(src).toContain('excel-font-box');
        expect(src).toContain('unit-popup-btn excel-font-step');
        expect(src).toContain('data-lucide="minus"');
        expect(src).toContain('data-lucide="plus"');
        expect(src).not.toContain('class="excel-toolbar-btn" style="padding:0.1rem');
    });
});
