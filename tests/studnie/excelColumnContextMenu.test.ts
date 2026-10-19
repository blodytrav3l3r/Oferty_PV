// @ts-nocheck
import fs from 'fs';
import path from 'path';
import vm from 'vm';

describe('_excelGetColMenuActions — akcje menu kontekstowego kolumny Excel', () => {
    let ctx: any;

    beforeAll(() => {
        const context: any = {
            studnieProducts: [],
            wells: [],
            window: {},
            escapeHtml: (s: unknown) => String(s),
            logger: { info: () => {}, warn: () => {}, error: () => {} }
        };
        const base = path.join(__dirname, '../../public/js/studnie');
        vm.createContext(context);
        for (const file of [
            'excelState.js',
            'excelHelpers.js',
            'excelReductionColumns.js',
            'excelColumns.js',
            'excelSort.js',
            'excelColumnContextMenu.js'
        ]) {
            const code = fs.readFileSync(path.join(base, file), 'utf8');
            vm.runInContext(code, context);
        }
        /* _excelHiddenColumnIds to let — nie jest własnością globalną, eksponuj przez helper */
        vm.runInContext(
            'globalThis._excelTestSetHidden = function (list) { _excelHiddenColumnIds = list; };',
            context
        );
        ctx = context;
    });

    test('kolumna stała (brak data-col-id / col=null) — brak ukrycia, pozycja nieaktywna, zarządzanie aktywne', () => {
        const actions = ctx._excelGetColMenuActions(null);
        expect(actions.some((a: any) => a.id === 'hide')).toBe(false);
        expect(actions.some((a: any) => a.id === 'static' && a.disabled)).toBe(true);
        expect(actions.some((a: any) => a.id === 'showAll')).toBe(false);
        expect(actions.some((a: any) => a.id === 'manage' && !a.disabled)).toBe(true);
    });

    test('kolumna liczbowa komponentu — akcja ukrycia aktywna z etykietą "Ukryj kolumnę"', () => {
        const actions = ctx._excelGetColMenuActions({ id: 'krag_500', type: 'number' });
        const hide = actions.find((a: any) => a.id === 'hide');
        expect(hide).toBeDefined();
        expect(hide.disabled).toBe(false);
        expect(hide.label).toBe('Ukryj kolumnę');
        expect(actions.some((a: any) => a.id === 'static')).toBe(false);
    });

    test('kolumna już ukryta — "Pokaż kolumnę" + pojawia się "Pokaż wszystkie kolumny"', () => {
        ctx._excelTestSetHidden(['krag_500']);
        const actions = ctx._excelGetColMenuActions({ id: 'krag_500', type: 'number' });
        const hide = actions.find((a: any) => a.id === 'hide');
        expect(hide.label).toBe('Pokaż kolumnę');
        const showAll = actions.find((a: any) => a.id === 'showAll');
        expect(showAll).toBeDefined();
        expect(showAll.disabled).toBe(false);
        ctx._excelTestSetHidden([]);
    });

    test('kolumna typu select (np. Właz) — nieukrywalna (nieaktywna pozycja stałej)', () => {
        const actions = ctx._excelGetColMenuActions({ id: 'wlaz', type: 'select' });
        expect(actions.some((a: any) => a.id === 'hide')).toBe(false);
        expect(actions.some((a: any) => a.id === 'static' && a.disabled)).toBe(true);
    });

    test('sortowanie — akcje rosnąco/malejąco zawsze obecne, "Wyczyść" tylko przy aktywnym sortie', () => {
        ctx._excelResetSort();
        const base = ctx._excelGetColMenuActions({ id: 'krag_500', type: 'number' });
        expect(base.some((a: any) => a.id === 'sortAsc' && !a.disabled)).toBe(true);
        expect(base.some((a: any) => a.id === 'sortDesc' && !a.disabled)).toBe(true);
        expect(base.some((a: any) => a.id === 'sortClear')).toBe(false);
        ctx._excelSetSort(5);
        const sorted = ctx._excelGetColMenuActions({ id: 'krag_500', type: 'number' });
        expect(sorted.some((a: any) => a.id === 'sortClear' && !a.disabled)).toBe(true);
        ctx._excelResetSort();
    });

    test('a11y: pozycje menu mają role=menuitem, tabindex i aria-disabled', () => {
        const active = ctx._excelColMenuActionHtml({
            id: 'hide',
            label: 'Ukryj kolumnę',
            disabled: false
        });
        expect(active).toContain('role="menuitem"');
        expect(active).toContain('tabindex="-1"');
        expect(active).not.toContain('aria-disabled');
        const disabled = ctx._excelColMenuActionHtml({
            id: 'static',
            label: 'Kolumna stała',
            disabled: true
        });
        expect(disabled).toContain('aria-disabled="true"');
    });

    test('a11y: uchwyt resize ma rolę separator i obsługę klawiatury', () => {
        const src = fs.readFileSync(
            path.join(__dirname, '../../public/js/studnie/excelColumnResize.js'),
            'utf8'
        );
        expect(src).toContain("setAttribute('role', 'separator')");
        expect(src).toContain("setAttribute('aria-orientation', 'vertical')");
        expect(src).toContain("setAttribute('aria-valuenow'");
        expect(src).toContain("e.key !== 'ArrowLeft' && e.key !== 'ArrowRight'");
    });
});
