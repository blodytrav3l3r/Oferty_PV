// @ts-nocheck -- vm sandbox, celowy brak typow dla public/js
import fs from 'fs';
import path from 'path';
import vm from 'vm';

function readJs(name: string): string {
    return fs.readFileSync(path.join(__dirname, '../../public/js/studnie', name), 'utf8');
}

function readCss(): string {
    return fs.readFileSync(path.join(__dirname, '../../public/css/studnie.css'), 'utf8');
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

describe('excelTransitionsToggle ukrywanie sekcji PRZ', () => {
    test('default widoczna, roundtrip localStorage', () => {
        const { ctx, store } = loadState();
        expect(vm.runInContext('_excelTransitionsHidden()', ctx)).toBe(false);
        vm.runInContext('_excelHideTransitions = true', ctx);
        vm.runInContext('_excelSaveHideTransitions()', ctx);
        expect(store['sok_excel_hide_transitions']).toBe('1');
        vm.runInContext('_excelHideTransitions = false', ctx);
        vm.runInContext('_excelLoadHideTransitions()', ctx);
        expect(vm.runInContext('_excelTransitionsHidden()', ctx)).toBe(true);
    });

    test('ukrycie klasa display:none — licznik kolumn nietkniety', () => {
        // naglowek: petla PRZ i +/- zawsze renderowane, z klasa przy hideTr
        const renderer = readJs('excelTableRenderer.js');
        expect(renderer).toContain('trHideCls');
        expect(renderer).toContain('excel-tr-hidden');
        expect(renderer).not.toContain('hideTr ? 0 :');
        // body: wiersze danych i pusty wiersz + komorki gap
        const body = readJs('excelTableBody.js');
        expect(body).toContain('trHideCls');
        expect(body).toContain('code-cell-center');
        // CSS: display none, zero kolorow (kontrakt S-03)
        expect(readCss()).toMatch(/\.excel-tr-hidden\s*\{[^}]*display:\s*none/);
    });

    test('virtual i indeksy stabilne (brak offset-matematyki)', () => {
        const src = readJs('excelVirtual.js');
        expect(src).toContain('7 + maxTr * 4 + 2');
        expect(src).not.toContain('hideTr ? 0 : 2');
    });

    test('autofit i Ctrl+A pomijaja ukryte', () => {
        expect(readJs('excelTableRenderer.js')).toContain("colId.indexOf('trz-') === 0");
        expect(readJs('excelCellNavigation.js')).toContain('td:not(.excel-tr-hidden)');
    });

    test('Ctrl+Shift+H globalnie (document+capture, bez aktywnej komorki) i na liscie skrotow', () => {
        // _excelGlobalHotkeys: schowek-wzorzec, lapie tez fokus spoza tabeli/modala
        expect(readJs('excelModal.js')).toContain('_excelGlobalHotkeys');
        expect(readJs('excelModal.js')).toContain('_excelToggleTransitionsSection()');
        // rejestr + derejestr jak schowek (brak wycieku miedzy sesjami)
        expect(readJs('excelModal.js')).toContain(
            "document.addEventListener('keydown', _excelGlobalHotkeys, true)"
        );
        expect(readJs('excelModal.js')).toContain(
            "document.removeEventListener('keydown', _excelGlobalHotkeys, true)"
        );
        // brak dubla w container-keydown (przełączyłby 2x)
        expect(readJs('excelCellNavigation.js')).not.toContain('_excelToggleTransitionsSection()');
        expect(readJs('excelShortcuts.js')).toContain('Ctrl+Shift+H');
        expect(readJs('excelModal.js')).toContain('excel-transitions-toggle');
    });

    test('paste auto-odkrywa sekcje', () => {
        expect(readJs('excelCopyPaste.js')).toContain('Odkryto sekcję przejść');
    });

    test('_excelGlobalHotkeys przelacza bez fokusu w tabeli', () => {
        const ctx: any = {
            window: {},
            localStorage: { getItem: () => null, setItem: () => {}, removeItem: () => {} },
            overlayOpen: true,
            otherModal: false
        };
        vm.createContext(ctx);
        vm.runInContext(readJs('excelState.js'), ctx);
        ctx.document = {
            getElementById: (id: string) =>
                id === 'excel-table-overlay' && ctx.overlayOpen ? {} : null,
            querySelector: (sel: string) =>
                sel === '.modal-overlay:not(#excel-table-overlay)' && ctx.otherModal ? {} : null
        };
        ctx._excelSaveHideTransitions = () => {};
        ctx._excelSyncTransitionsToggleBtn = () => {};
        ctx._excelRenderTable = () => {};
        vm.runInContext(readJs('excelColumnVisibility.js'), ctx);
        vm.runInContext(readJs('excelModal.js'), ctx);
        const press = (ev: string) => vm.runInContext(`_excelGlobalHotkeys(${ev})`, ctx);
        const h = `{ctrlKey:true, shiftKey:true, key:'H', preventDefault(){}, stopPropagation(){}}`;
        expect(vm.runInContext('_excelTransitionsHidden()', ctx)).toBe(false);
        press(h);
        expect(vm.runInContext('_excelTransitionsHidden()', ctx)).toBe(true);
        press(h);
        expect(vm.runInContext('_excelTransitionsHidden()', ctx)).toBe(false);
        // bez ctrl — brak reakcji
        press(`{ctrlKey:false, shiftKey:true, key:'H', preventDefault(){}, stopPropagation(){}}`);
        expect(vm.runInContext('_excelTransitionsHidden()', ctx)).toBe(false);
        // zamkniety modal albo inny modal na wierzchu — brak reakcji
        ctx.overlayOpen = false;
        press(h);
        expect(vm.runInContext('_excelTransitionsHidden()', ctx)).toBe(false);
        ctx.overlayOpen = true;
        ctx.otherModal = true;
        press(h);
        expect(vm.runInContext('_excelTransitionsHidden()', ctx)).toBe(false);
    });
});
