/**
 * @jest-environment jsdom
 */

// @ts-nocheck
/**
 * P4-A1/A2: guardy pól edycyjnych w skrótach Excel.
 * - Ctrl+A w INPUT/TEXTAREA: natywne select-all (handler nie tyka selekcji tabeli).
 * - Ctrl+A poza polem: zaznacza widoczne wiersze (jak dawniej).
 * - Ctrl+F w #excel-search-input: natywny find (bez preventDefault).
 * - Ctrl+F spoza: fokus wyszukiwarki (jak dawniej).
 * Ładuje PRAWDZIWY excelCellNavigation.js (eval) ze stubami helperów.
 */
import fs from 'fs';
import path from 'path';

const BASE = path.join(process.cwd(), 'public/js/studnie');

const STUBS =
    ';var _excelSelectedCells = [];' +
    'function _excelGetVisibleRows() { return Array.prototype.slice.call(document.querySelectorAll("tr[data-widx]")); }' +
    'function _excelDeselectAllCells() { _excelSelectedCells = []; }' +
    'function _excelDeselectAllCols() {}' +
    'function _excelCursorToEnd(el) { try { var l = (el.value || "").length; el.setSelectionRange(l, l); } catch (e) {} }' +
    'function _excelUndo() {}' +
    'function _excelRedo() {}' +
    'function _excelUpdateSelectionSummary() {}' +
    'function _excelSaveUndoSnapshot() {}' +
    'function _excelSetCellValue() {}' +
    'function showToast() {}' +
    'var _excelPasteInProgress = false;';

function keyEvent(key: string, target: any, ctrl = true): any {
    return {
        key,
        ctrlKey: ctrl,
        metaKey: false,
        shiftKey: false,
        target,
        preventDefault: jest.fn()
    };
}

describe('P4 keyboard guards (A1/A2)', () => {
    beforeAll(() => {
        const code = fs.readFileSync(path.join(BASE, 'excelCellNavigation.js'), 'utf8');
        (0, eval)(STUBS + '\n;\n' + code);
    });

    beforeEach(() => {
        (0, eval)('_excelSelectedCells = [];');
        document.body.innerHTML =
            '<div id="excel-table-overlay">' +
            '<input id="excel-search-input" value="x" />' +
            '<table><tbody>' +
            '<tr data-widx="0"><td>c</td><td>c</td><td>c</td><td>c</td><td><input id="cell-0" value="1" /></td></tr>' +
            '</tbody></table></div>';
    });

    test('A1: Ctrl+A w INPUT nie tyka tabeli (brak preventDefault, brak selekcji)', () => {
        const input = document.getElementById('cell-0')!;
        const e = keyEvent('a', input);
        (0, eval)('_excelHandleKeydown')(e);
        expect(e.preventDefault).not.toHaveBeenCalled();
        expect((0, eval)('_excelSelectedCells').length).toBe(0);
    });

    test('A1: Ctrl+A poza polem zaznacza wiersze (jak dawniej)', () => {
        const e = keyEvent('a', document.body);
        (0, eval)('_excelHandleKeydown')(e);
        expect(e.preventDefault).toHaveBeenCalled();
        expect((0, eval)('_excelSelectedCells').length).toBeGreaterThan(0);
    });

    test('A2: Ctrl+F w wyszukiwarce nie blokuje natywnego find', () => {
        const input = document.getElementById('excel-search-input')!;
        const e = keyEvent('f', input);
        (0, eval)('_excelHandleKeydown')(e);
        expect(e.preventDefault).not.toHaveBeenCalled();
    });

    test('A2: Ctrl+F spoza pola fokusuje wyszukiwarkę (jak dawniej)', () => {
        const e = keyEvent('f', document.body);
        (0, eval)('_excelHandleKeydown')(e);
        expect(e.preventDefault).toHaveBeenCalled();
        expect(document.activeElement!.id).toBe('excel-search-input');
    });
});
