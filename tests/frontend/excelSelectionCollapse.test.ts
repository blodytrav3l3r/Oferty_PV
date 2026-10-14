/**
 * @jest-environment jsdom
 */

// @ts-nocheck
/**
 * Zwijanie highlightu przy zmianie aktywnej komorki/wiersza.
 * Bug: kliknieta komorka trzymala .cell-selected po ruchu strzalka,
 * a excelSelectRow zatruwal data-orig-bg kolorem active (hover doklejal).
 * Harness jak excelArrowNav.test.ts + excelCellSelection.js.
 */
import fs from 'fs';
import path from 'path';

const BASE = path.join(process.cwd(), 'public/js/studnie');

const SEEDS =
    'var _excelSelectedCells = [];' +
    'var _excelSelectedCols = [];' +
    'var _excelLastClickedCell = null;' +
    'var _excelGetVisibleRows = function() { return []; };' +
    'window._excelVirtualIsEnabled = function() { return false; };' +
    'window.excelSelectRow = function() {};';

function rowHtml(r: number): string {
    return (
        '<tr data-widx="' +
        r +
        '">' +
        '<td><input id="a-' +
        r +
        '" value="1" /></td>' +
        '<td><input id="b-' +
        r +
        '" value="2" /></td>' +
        '<td><input id="c-' +
        r +
        '" value="3" /></td>' +
        '</tr>'
    );
}

function fixture(): void {
    document.body.innerHTML =
        '<div id="excel-table-overlay"><div id="excel-table-container"><table><tbody>' +
        rowHtml(0) +
        rowHtml(1) +
        '</tbody></table></div></div>';
}

describe('strzalka zwija .cell-selected', () => {
    beforeAll(() => {
        const code = [
            'excelSelection.js',
            'excelVirtual.js',
            'excelCellNavigation.js',
            'excelCellSelection.js'
        ]
            .map((f) => fs.readFileSync(path.join(BASE, f), 'utf8'))
            .join('\n;\n');
        (0, eval)(SEEDS + code);
    });

    beforeEach(() => {
        fixture();
        (0, eval)('_excelSelectedCells = []; _excelLastClickedCell = null;');
    });

    function selectedCount(): number {
        return document.querySelectorAll('td.cell-selected').length;
    }

    test('klik + ArrowRight: stara komorka traci klase, focus idzie dalej', () => {
        (0, eval)('_excelSelectCell(0, 1, false, false)');
        expect(selectedCount()).toBe(1);
        (document.getElementById('b-0') as HTMLElement).focus();
        (0, eval)(
            "_excelHandleArrow({ key: 'ArrowRight', target: document.activeElement, preventDefault: function(){} })"
        );
        expect((document.activeElement as HTMLElement)?.id).toBe('c-0');
        expect(selectedCount()).toBe(0);
    });

    test('klik + ArrowDown: stara komorka traci klase', () => {
        (0, eval)('_excelSelectCell(0, 0, false, false)');
        expect(selectedCount()).toBe(1);
        (document.getElementById('a-0') as HTMLElement).focus();
        (0, eval)(
            "_excelHandleArrow({ key: 'ArrowDown', target: document.activeElement, preventDefault: function(){} })"
        );
        expect(selectedCount()).toBe(0);
    });
});

describe('excelSelectRow nie zatruwa data-orig-bg', () => {
    beforeAll(() => {
        const stubs =
            'var currentWellIndex = -1;' +
            'var _excelStickyCellBg = function(tint) { return tint; };';
        (0, eval)(stubs + fs.readFileSync(path.join(BASE, 'excelModal.js'), 'utf8'));
    });

    beforeEach(() => {
        document.body.innerHTML =
            '<div id="excel-table-container"><table><tbody>' +
            '<tr data-widx="0" data-base-bg="rgb(255, 255, 255)" data-orig-bg="rgb(255, 255, 255)" data-active-bg="rgb(200, 210, 255)"><td>0</td></tr>' +
            '<tr data-widx="1" data-base-bg="rgb(255, 255, 255)" data-orig-bg="rgb(255, 255, 255)" data-active-bg="rgb(200, 210, 255)"><td>1</td></tr>' +
            '</tbody></table></div>';
        (0, eval)('currentWellIndex = -1;');
    });

    function row(i: number): Element | null {
        return document.querySelector('tr[data-widx="' + i + '"]');
    }

    test('select(1) nie nadpisuje orig active; restore(0) wraca do base', () => {
        const BASE = 'rgb(255, 255, 255)';
        const ACTIVE = 'rgb(200, 210, 255)';
        (0, eval)('excelSelectRow(1)');
        expect(row(1)?.getAttribute('data-orig-bg')).toBe(BASE);
        expect((row(1) as HTMLElement).style.background).toBe(ACTIVE);
        (0, eval)('excelSelectRow(0)');
        expect((row(1) as HTMLElement).style.background).toBe(BASE);
        expect(row(1)?.getAttribute('data-orig-bg')).toBe(BASE);
        expect((row(0) as HTMLElement).style.background).toBe(ACTIVE);
    });
});
