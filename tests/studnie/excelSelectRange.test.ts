/**
 * @jest-environment jsdom
 */
// @ts-nocheck -- vm sandbox, celowy brak typow dla public/js
import fs from 'fs';
import path from 'path';
import vm from 'vm';

function readStudnie(f: string): string {
    return fs.readFileSync(path.join(__dirname, '../../public/js/studnie', f), 'utf8');
}

/**
 * P4-A6/A7/A8 (prawdziwe pliki w vm):
 * - A6: Enter + blur (podwójny excelCreateFromEmpty) tworzy JEDNĄ studnię (lock).
 * - A7: _excelApplyStickyColumns mierzy wiersz h1 i kończy po max 5 retry (brak pętli).
 * - A8: _excelSelectRange robi JEDNO podsumowanie (stan jak N× _excelSelectCell).
 */
describe('P4 range/sticky/create (A6/A7/A8)', () => {
    test('A6: podwójne excelCreateFromEmpty (Enter+blur) -> jedna studnia', async () => {
        const ctx: any = {
            window: {},
            document,
            setTimeout,
            clearTimeout,
            wells: [],
            _excelActiveTab: '1000',
            _excelCreatingLock: false,
            _excelMaxTransitions: {},
            _excelAutoSelectEnabled: false,
            _excelSaveUndoSnapshot: () => {},
            _excelMarkDirty: () => {},
            _excelInvalidateFilteredIndexes: () => {},
            _excelRebuildWellIndex: () => {},
            _excelAutoSetWlaz: () => {},
            _excelGetMaxTransitions: () => 1,
            _excelRenderTabs: () => {},
            _excelRenderTable: () => {},
            _excelUpdateWellCount: () => {},
            _excelDebouncedRefresh: () => {},
            showToast: () => {}
        };
        vm.createContext(ctx);
        vm.runInContext(readStudnie('excelTabs.js'), ctx);
        vm.runInContext(
            `document.body.innerHTML = '<input id="excel-empty-name" value="S-New" />' +
            '<input id="excel-empty-rzw" value="" /><input id="excel-empty-rzd" value="" />';`,
            ctx
        );
        vm.runInContext('excelCreateFromEmpty(); excelCreateFromEmpty();', ctx);
        expect(ctx.wells.length).toBe(1);
        expect(ctx.wells[0].name).toBe('S-New');
        // po zwolnieniu locka (100 ms) kolejne świadome wywołanie działa
        await new Promise((r) => setTimeout(r, 150));
        vm.runInContext('excelCreateFromEmpty();', ctx);
        expect(ctx.wells.length).toBe(2);
    });

    test('A7: sticky mierzy h1 i nie zapętla rAF (max 5 retry)', () => {
        let rafCalls = 0;
        const ctx: any = {
            window: {},
            document,
            requestAnimationFrame: (cb: any) => {
                rafCalls++;
                cb();
                return rafCalls;
            }
        };
        vm.createContext(ctx);
        vm.runInContext(readStudnie('excelTableRenderer.js'), ctx);
        expect(typeof ctx._excelApplyStickyColumns).toBe('function');
        vm.runInContext(
            `document.body.innerHTML = '<div id="excel-table-container"><table><thead>' +
            '<tr><th colspan="4">h3</th></tr>' +
            '<tr><th>a</th><th>b</th><th>c</th><th>d</th><th>e</th><th>f</th><th>g</th></tr>' +
            '<tr><th>h2</th></tr></thead></table></div>';` + `_excelApplyStickyColumns();`,
            ctx
        );
        // jsdom: offsetWidth zawsze 0 -> dokładnie 1 + 5 retry, potem stop
        expect(rafCalls).toBeLessThanOrEqual(6);
    });

    test('A8: zakres 3x5 -> 15 komórek, jedno podsumowanie, ten sam stan', () => {
        const ctx: any = {
            window: {},
            document,
            _excelSelectedCells: [],
            _excelLastClickedCell: null,
            __summaries: 0
        };
        vm.createContext(ctx);
        vm.runInContext(readStudnie('excelCellSelection.js'), ctx);
        // plik definiuje własną _excelUpdateSelectionSummary — podmień na licznik
        vm.runInContext('_excelUpdateSelectionSummary = function () { __summaries++; };', ctx);
        let rows = '';
        for (let r = 0; r < 3; r++) {
            rows += `<tr data-widx="${r}">`;
            for (let c = 0; c < 5; c++) rows += '<td>x</td>';
            rows += '</tr>';
        }
        vm.runInContext(
            `document.body.innerHTML = '<div id="excel-table-container"><table><tbody>${rows}</tbody></table></div>';` +
                `_excelSelectRange(0, 0, 2, 4, false);`,
            ctx
        );
        expect(ctx._excelSelectedCells.length).toBe(15);
        expect(ctx.__summaries).toBe(1);
        expect(ctx._excelLastClickedCell).toEqual({ wIdx: 2, colIdx: 4 });
        // addytywny drugi zakres nie duplikuje i nie robi pustego podsumowania
        vm.runInContext(`_excelSelectRange(0, 0, 2, 4, true);`, ctx);
        expect(ctx._excelSelectedCells.length).toBe(15);
        expect(ctx.__summaries).toBe(1);
    });

    test('A9: virtual sticky odświeża tylko nowe wiersze i używa cache offsetów', () => {
        const ctx: any = {
            window: {},
            document,
            LAYERS_EXCEL: { STICKY_HEADER_TH: 10, STICKY_COLUMN: 5 },
            __widthReads: 0
        };
        vm.createContext(ctx);
        vm.runInContext(readStudnie('excelTableRenderer.js'), ctx);
        vm.runInContext(
            `document.body.innerHTML = '<div id="excel-table-container"><table><thead>' +
                '<tr><th colspan="7">h3</th></tr>' +
                '<tr>${'<th style="width:10px">h</th>'.repeat(7)}</tr>' +
                '<tr><th colspan="7">h2</th></tr></thead><tbody>' +
                '<tr>${'<td>x</td>'.repeat(7)}</tr></tbody></table></div>';` +
                `Array.from(document.querySelectorAll('thead tr:nth-child(2) th')).forEach(th => {
                    Object.defineProperty(th, 'offsetWidth', { configurable: true, get() { __widthReads++; return parseFloat(this.style.width) || 10; } });
                });` +
                `_excelApplyStickyColumns(); const readsAfterFull = __widthReads;` +
                `_excelApplyStickyColumns({ rowsOnly: true });` +
                `document.querySelector('thead tr:nth-child(2) th').style.width = '20px';` +
                `_excelApplyStickyColumns({ rowsOnly: true });` +
                `window.innerWidth = 1200; _excelApplyStickyColumns({ rowsOnly: true });` +
                `window.__stickyReads = [readsAfterFull, __widthReads];` +
                `window.__stickyHeaderLeft = document.querySelector('thead tr:nth-child(2) th:nth-child(2)').style.left;` +
                `window.__stickyBodyLeft = document.querySelector('tbody td:nth-child(2)').style.left;`,
            ctx
        );
        expect(ctx.window.__stickyReads[0]).toBe(13);
        expect(ctx.window.__stickyReads[1]).toBe(39);
        expect(ctx.window.__stickyHeaderLeft).toBe('20px');
        expect(ctx.window.__stickyBodyLeft).toBe('20px');
    });
});
