/**
 * @jest-environment jsdom
 */

// @ts-nocheck
/**
 * Nawigacja strzałkami w Excelu (virtual=1) — krok co komórkę.
 * Ładuje PRAWDZIWE pliki (selection/virtual/cellNavigation) jednym evalem
 * razem z driverem `window.__navTest` — ten sam scope leksykalny dla kodu
 * i sterowania (osobne evale tworzyłyby rozjazd let-bindings).
 * Fixture DOM o układzie kolumn jak produkcja:
 * check|mode|lp|name|rzWlazu|rzDna|wys(tekst)|rzWlot|kat|rodzaj|srednica|
 * gap|gap|wlaz|hDenn|uszcz|kineta|psiaBuda|akcje
 * Invariant: virtual horizontal MUSI dać tę samą sekwencję co legacy rowEls.
 */
import fs from 'fs';
import path from 'path';

const BASE = path.join(process.cwd(), 'public/js/studnie');
const COLS = [
    'check',
    'mode',
    'lp',
    'name',
    'rzWlazu',
    'rzDna',
    'wys',
    'rzWlot_0',
    'kat_0',
    'rodzaj_0',
    'srednica_0',
    'gap1',
    'gap2',
    'wlaz',
    'avr_p1',
    'avr_p2',
    'hDenn',
    'uszcz',
    'kineta',
    'psiaBuda',
    'akcje'
];
// legacy-oracle: kolejność _excelGetNavElements (tylko fokusowalne, zwarte)
const FOCUSABLE = [
    'name',
    'rzWlazu',
    'rzDna',
    'rzWlot_0',
    'kat_0',
    'rodzaj_0',
    'srednica_0',
    'wlaz',
    'avr_p1',
    'avr_p2',
    'hDenn',
    'uszcz',
    'kineta',
    'psiaBuda'
];

const DRIVER =
    ';window.__navTest = {' +
    'setup: function(cols, total) { _excelVirtualLogicalCols = cols; _excelVirtualTotal = total; _excelVirtualStart = 0; _excelVirtualEnd = 100; _excelVirtualActiveCell = null; },' +
    'setActive: function(r, c) { _excelVirtualActiveCell = { logicalRow: r, logicalColId: c }; },' +
    'getActive: function() { return _excelVirtualActiveCell ? { logicalRow: _excelVirtualActiveCell.logicalRow, logicalColId: _excelVirtualActiveCell.logicalColId } : null; },' +
    'arrow: function(key, target) { return _excelVirtualHandleArrow({ key: key, target: target, preventDefault: function(){}, stopPropagation: function(){}, stopImmediatePropagation: function(){} }); },' +
    'focusIds: function(row) { return _excelVirtualFocusableIds(row); },' +
    'focusCell: function(r, c, noScroll) { return _excelVirtualFocusCell({ logicalRow: r, logicalColId: c }, noScroll ? { noScroll: true } : undefined); },' +
    'focusNavEl: function(el, dir, noScroll) { var row = el.closest("tr"); var els = _excelGetNavElements(row); _excelFocusNavEl(el, els, dir, noScroll ? { noScroll: true } : undefined); },' +
    'navEls: function(row) { return _excelGetNavElements(row); }' +
    '};';

function cellHtml(col: string, r: number): string {
    switch (col) {
        case 'check':
            return '<input type="checkbox" class="excel-row-select" disabled tabindex="-1" />';
        case 'mode':
            return '<button disabled>—</button><button disabled>run</button>';
        case 'lp':
            return String(r + 1);
        case 'wys':
            return '4000';
        case 'gap1':
        case 'gap2':
            return '';
        case 'akcje':
            return '<button>del</button>';
        case 'rodzaj_0':
        case 'srednica_0':
        case 'wlaz':
        case 'kineta':
            return (
                '<div class="excel-sel-wrap" tabindex="0" id="' +
                col +
                '-' +
                r +
                '"><select tabindex="-1"><option value="">—</option></select></div>'
            );
        case 'psiaBuda':
            return '<input type="checkbox" id="' + col + '-' + r + '" />';
        default:
            return '<input type="number" id="' + col + '-' + r + '" value="' + (r + 1) + '" />';
    }
}

function rowHtml(r: number): string {
    const tds = COLS.map((c) => '<td class="excel-td">' + cellHtml(c, r) + '</td>').join('');
    return '<tr data-logical-row="' + r + '" data-widx="' + r + '">' + tds + '</tr>';
}

function nav(): any {
    return (window as any).__navTest;
}

describe('excel virtual arrow — krok co komórkę', () => {
    beforeAll(() => {
        const code = ['excelSelection.js', 'excelVirtual.js', 'excelCellNavigation.js']
            .map((f) => fs.readFileSync(path.join(BASE, f), 'utf8'))
            .join('\n;\n');
        (0, eval)(code + DRIVER);
        (window as any).excelSelectRow = () => {};
    });

    beforeEach(() => {
        document.body.innerHTML =
            '<div id="excel-table-overlay"><div id="excel-table-container"><table><tbody>' +
            rowHtml(0) +
            rowHtml(1) +
            '</tbody></table></div></div>';
        nav().setup(COLS.slice(), 2);
    });

    function focus(col: string, r: number): void {
        (document.getElementById(col + '-' + r) as HTMLElement).focus();
    }

    function arrow(key: string): void {
        nav().arrow(key, document.activeElement);
    }

    function activeId(): string {
        return (document.activeElement as HTMLElement)?.id || '';
    }

    test('zgłoszony błąd: rzDna +Right → rzWlot (nie średnica)', () => {
        nav().setActive(0, 'rzDna');
        focus('rzDna', 0);
        arrow('ArrowRight');
        expect(activeId()).toBe('rzWlot_0-0');
    });

    test('parity Right: pełny spacer name → psiaBuda co komórkę jak legacy', () => {
        nav().setActive(0, 'name');
        focus('name', 0);
        const visited = ['name-0'];
        for (let i = 1; i < FOCUSABLE.length; i++) {
            arrow('ArrowRight');
            visited.push(activeId());
        }
        expect(visited).toEqual(FOCUSABLE.map((c) => c + '-0'));
    });

    test('parity Left: pełny powrót psiaBuda → name (łapie asymetrię)', () => {
        nav().setActive(0, 'psiaBuda');
        focus('psiaBuda', 0);
        const visited = ['psiaBuda-0'];
        for (let i = FOCUSABLE.length - 2; i >= 0; i--) {
            arrow('ArrowLeft');
            visited.push(activeId());
        }
        expect(visited).toEqual([...FOCUSABLE].reverse().map((c) => c + '-0'));
    });

    test('krawędzie: Right na ostatniej i Left na pierwszej to no-op', () => {
        nav().setActive(0, 'psiaBuda');
        focus('psiaBuda', 0);
        arrow('ArrowRight');
        expect(activeId()).toBe('psiaBuda-0');
        nav().setActive(0, 'name');
        focus('name', 0);
        arrow('ArrowLeft');
        expect(activeId()).toBe('name-0');
    });

    test('disabled select pomijany w obie strony (Right i Left)', () => {
        (document.getElementById('kat_0-0') as HTMLInputElement).disabled = true;
        nav().setActive(0, 'rzWlot_0');
        focus('rzWlot_0', 0);
        arrow('ArrowRight');
        expect(activeId()).toBe('rodzaj_0-0');
        arrow('ArrowLeft');
        expect(activeId()).toBe('rzWlot_0-0');
    });

    test('stary cursor na nie-fokusowalnej (wys) +Right z rzDna → rzWlot', () => {
        nav().setActive(0, 'wys');
        focus('rzDna', 0);
        arrow('ArrowRight');
        expect(activeId()).toBe('rzWlot_0-0');
    });

    test('stary cursor na nie-fokusowalnej (wys) +Left z rzWlot → rzDna', () => {
        nav().setActive(0, 'wys');
        focus('rzWlot_0', 0);
        arrow('ArrowLeft');
        expect(activeId()).toBe('rzDna-0');
    });

    test('gap pomijany: srednica +Right → wlaz, wlaz +Left → srednica', () => {
        nav().setActive(0, 'srednica_0');
        focus('srednica_0', 0);
        arrow('ArrowRight');
        expect(activeId()).toBe('wlaz-0');
        arrow('ArrowLeft');
        expect(activeId()).toBe('srednica_0-0');
    });

    test('zgłoszony błąd 2: właz +Right → AVR (nie blokada na włazie)', () => {
        nav().setActive(0, 'wlaz');
        focus('wlaz', 0);
        arrow('ArrowRight');
        expect(activeId()).toBe('avr_p1-0');
        arrow('ArrowRight');
        expect(activeId()).toBe('avr_p2-0');
        arrow('ArrowRight');
        expect(activeId()).toBe('hDenn-0');
        // i z powrotem bez skoków
        arrow('ArrowLeft');
        expect(activeId()).toBe('avr_p2-0');
        arrow('ArrowLeft');
        expect(activeId()).toBe('avr_p1-0');
        arrow('ArrowLeft');
        expect(activeId()).toBe('wlaz-0');
    });

    test('focusCell na kolumnie-tekście (wys) ląduje na najbliższej enabled', () => {
        focus('rzDna', 0);
        const ok = nav().focusCell(0, 'wys');
        expect(ok).toBe(true);
        expect(activeId()).toBe('rzWlot_0-0');
    });

    test('Up/Down: dokładnie 1 wiersz, ta sama kolumna', () => {
        nav().setActive(0, 'rzDna');
        focus('rzDna', 0);
        arrow('ArrowDown');
        expect(activeId()).toBe('rzDna-1');
        arrow('ArrowUp');
        expect(activeId()).toBe('rzDna-0');
    });

    test('restore po recyklu (noScroll): fokus wraca, scroll stoi', () => {
        const container = document.getElementById('excel-table-container')!;
        container.scrollTop = 100;
        focus('rzDna', 0);
        const ok = nav().focusCell(0, 'rzDna', true);
        expect(ok).toBe(true);
        expect(activeId()).toBe('rzDna-0');
        expect(container.scrollTop).toBe(100);
    });

    test('nawigacja strzałką (bez noScroll): korekta scrolla działa jak dawniej', () => {
        const container = document.getElementById('excel-table-container')!;
        container.scrollTop = 100;
        const el = document.getElementById('rzDna-0')!;
        nav().focusNavEl(el, 'down', false);
        expect(activeId()).toBe('rzDna-0');
        expect(container.scrollTop).not.toBe(100);
    });

    test('focusNavEl noScroll: fokus bez ruszania scrolla', () => {
        const container = document.getElementById('excel-table-container')!;
        container.scrollTop = 100;
        container.scrollLeft = 40;
        const el = document.getElementById('rzDna-0')!;
        nav().focusNavEl(el, 'down', true);
        expect(activeId()).toBe('rzDna-0');
        expect(container.scrollTop).toBe(100);
        expect(container.scrollLeft).toBe(40);
    });

    test('virtual ids == legacy rowEls dla wiersza (helper parity)', () => {
        const row = document.querySelector('tr[data-logical-row="0"]')!;
        const ids: string[] = nav().focusIds(row);
        const legacyEls: Element[] = nav().navEls(row);
        const legacyIds = legacyEls.map((el) => {
            const td = el.closest('td')!;
            return COLS[Array.prototype.indexOf.call(row.children, td)];
        });
        expect(ids).toEqual(legacyIds);
        expect(ids).toEqual(FOCUSABLE);
    });
});
