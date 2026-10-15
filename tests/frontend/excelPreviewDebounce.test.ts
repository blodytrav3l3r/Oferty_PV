/**
 * @jest-environment jsdom
 */

// @ts-nocheck
/**
 * Excel preview/debounce (BUILD Faza 2):
 * (1) debounce-coalesce — 3 szybkie _excelDebouncedRefresh na ten sam wiersz
 *     -> 1 flush: recalculateWellErrors raz, z ostatnim stanem (fake-timers).
 * (2) trailing-flush — 3x _excelScheduleActiveRowPaint + 1 fire rAF
 *     -> paint raz, z ostatnim wIdx.
 * (3) edit-path sync — _excelImmediatePreview wola _excelSyncMainPreview
 *     synchronicznie (zero timerow, brak debounce).
 * Harness jak excelArrowNav/excelSelectionCollapse: PRAWDZIWE pliki
 * (excelState + excelPolling + excelModal) jednym evalem + SEEDS-stuby
 * dla funkcji z nieladowanych plikow (helpers/tableBody).
 * DRIVER musi byc w TYM SAMYM evalem co kod: excelState.js deklaruje
 * `let _excelRefreshTimer` — let z indirect-eval nie wystaje na global
 * (w przeciwienstwie do var/function), wiec dostep tylko przez domkniecia
 * z tego samego scope leksykalnego (wzorzec window.__navTest).
 */
import fs from 'fs';
import path from 'path';

const BASE = path.join(process.cwd(), 'public/js/studnie');

const SEEDS =
    'var wells = [];' +
    'var currentWellIndex = 0;' +
    'var __calls = { recalcArgs: [], headerCalls: 0, paintArgs: [], summaryCalls: 0, diagramCalls: 0 };' +
    'var recalculateWellErrors = function (w) { __calls.recalcArgs.push(w); };' +
    'var _excelUpdateHeaderProdCodes = function () { __calls.headerCalls++; };' +
    'var _excelRefreshDupColors = function () {};' +
    'var _excelPaintRowStatus = function (row, well) { __calls.paintArgs.push(well); };' +
    'var _excelMarkDirty = function () {};' +
    'var _excelWellMatchesTab = function () { return true; };';

// Drapiezny szczegol: _excelRefreshTimer to `let` w excelState.js —
// widoczny tylko w eval-scope ladowania, stad gettery przez driver.
const DRIVER =
    ';window.__pvTest = {' +
    'timerIsNull: function () { return _excelRefreshTimer === null; },' +
    'clearTimer: function () { if (_excelRefreshTimer) { try { clearTimeout(_excelRefreshTimer); } catch (_e) {} _excelRefreshTimer = null; } }' +
    '};';

function ev(code: string): any {
    return (0, eval)(code);
}

function pv(): any {
    return (window as any).__pvTest;
}

describe('excel preview/debounce', () => {
    beforeAll(() => {
        const code = ['excelState.js', 'excelPolling.js', 'excelModal.js']
            .map((f) => fs.readFileSync(path.join(BASE, f), 'utf8'))
            .join('\n;\n');
        (0, eval)(SEEDS + '\n;\n' + code + DRIVER);
    });

    beforeEach(() => {
        document.body.innerHTML =
            '<div id="excel-table-overlay"><div id="excel-table-container"><table><tbody>' +
            '<tr data-widx="0"><td>w0</td></tr>' +
            '<tr data-widx="1"><td>w1</td></tr>' +
            '<tr data-widx="2"><td>w2</td></tr>' +
            '</tbody></table></div><div id="excel-active-errors" style="display:none"></div></div>';
        ev(
            'wells = [{ id: "w0", name: "S1", configErrors: [] },' +
                ' { id: "w1", name: "S2", configErrors: [] },' +
                ' { id: "w2", name: "S3", configErrors: [] }];' +
                ' currentWellIndex = 0;' +
                ' __calls.recalcArgs = []; __calls.headerCalls = 0;' +
                ' __calls.paintArgs = []; __calls.summaryCalls = 0; __calls.diagramCalls = 0;' +
                ' _excelPendingErrorWIdxs = []; _excelRefreshAllErrorsPending = false;' +
                ' _excelRefreshFirstAt = 0;' +
                ' _excelPendingActivePaint = -1; _excelActivePaintRaf = 0;' +
                ' window.updateSummary = function () { __calls.summaryCalls++; };' +
                ' window.renderWellDiagram = function () { __calls.diagramCalls++; };'
        );
        pv().clearTimer();
    });

    test('(1) debounce-coalesce: 3 szybkie zmiany -> 1 solver z ostatnim stanem', () => {
        jest.useFakeTimers();
        try {
            ev('_excelDebouncedRefresh(2)');
            ev('wells[2].marker = "v3";');
            ev('_excelDebouncedRefresh(2)');
            ev('_excelDebouncedRefresh(2)');
            // leading edge: nic przed uplywem 800 ms
            jest.advanceTimersByTime(799);
            expect(ev('__calls.headerCalls')).toBe(0);
            expect(ev('__calls.recalcArgs.length')).toBe(0);
            jest.advanceTimersByTime(1);
            // trailing flush: jeden cykl paneli + jeden recalc z ostatnim stanem
            expect(ev('__calls.headerCalls')).toBe(1);
            expect(ev('__calls.recalcArgs.length')).toBe(1);
            expect(ev('__calls.recalcArgs[0]')).toBe(ev('wells[2]'));
            expect(ev('__calls.recalcArgs[0].marker')).toBe('v3');
            // kolejka oprozniona, timer zdjety
            expect(ev('_excelPendingErrorWIdxs.length')).toBe(0);
            expect(pv().timerIsNull()).toBe(true);
        } finally {
            jest.useRealTimers();
        }
    });

    test('(2) trailing-flush: schedule x3 -> paint raz z ostatnim wIdx', () => {
        ev(
            'window.__origRaf = window.requestAnimationFrame;' +
                ' window.__rafCalls = 0; window.__rafCb = null;' +
                ' window.requestAnimationFrame = function (cb) { window.__rafCalls++; window.__rafCb = cb; return 7; };'
        );
        try {
            ev('_excelScheduleActiveRowPaint(0)');
            ev('_excelScheduleActiveRowPaint(1)');
            ev('_excelScheduleActiveRowPaint(2)');
            // coalesce: jeden rAF, nic nie domalowane przed fire
            expect(ev('window.__rafCalls')).toBe(1);
            expect(ev('__calls.paintArgs.length')).toBe(0);
            expect(ev('_excelPendingActivePaint')).toBe(2);
            ev('window.__rafCb()');
            // trailing flush: paint raz, ostatni wiersz
            expect(ev('__calls.paintArgs.length')).toBe(1);
            expect(ev('__calls.paintArgs[0]')).toBe(ev('wells[2]'));
            expect(ev('_excelPendingActivePaint')).toBe(-1);
            expect(ev('_excelActivePaintRaf')).toBe(0);
        } finally {
            ev('window.requestAnimationFrame = window.__origRaf;');
        }
    });

    test('(3) edit-path sync: _excelImmediatePreview -> sync teraz, zero timerow', () => {
        jest.useFakeTimers();
        try {
            const before = jest.getTimerCount();
            ev('_excelImmediatePreview(1)');
            // synchronicznie: panele + diagram + naglowek, bez udzialu debounce
            expect(ev('__calls.summaryCalls')).toBe(1);
            expect(ev('__calls.diagramCalls')).toBe(1);
            expect(ev('__calls.headerCalls')).toBe(1);
            expect(ev('currentWellIndex')).toBe(1);
            expect(jest.getTimerCount()).toBe(before);
            // fallback bez argumentu bierze currentWellIndex
            ev('_excelImmediatePreview()');
            expect(ev('__calls.summaryCalls')).toBe(2);
            expect(jest.getTimerCount()).toBe(before);
        } finally {
            jest.useRealTimers();
        }
    });
});
