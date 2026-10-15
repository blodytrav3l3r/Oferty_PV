/**
 * @jest-environment jsdom
 */

// @ts-nocheck
/**
 * Tab-fokus w Excelu (virtual=1).
 * Ładuje PRAWDZIWE pliki (selection/virtual/cellNavigation) jednym evalem
 * razem z driverem `window.__tabTest` — ten sam scope leksykalny dla kodu
 * i sterowania (osobne evale tworzyłyby rozjazd let-bindings).
 * Fixture DOM o układzie kolumn jak produkcja (identyczny z excelArrowNav):
 * check|mode|lp|name|rzWlazu|rzDna|wys(tekst)|rzWlot|kat|rodzaj|srednica|
 * gap|gap|wlaz|hDenn|uszcz|kineta|psiaBuda|akcje
 * Prod nie ma własnego handlera Tab w gridzie (native order = DOM order
 * = kolejność _excelGetNavElements); testy kroczą Tabem po tej prod-kolejności.
 * Trap fokusu: grid go nie implementuje — zamiast FAIL-dokumentacji test
 * weryfikuje istniejący focus-restore po close (modalCore untrapFocus,
 * wołany przez _excelCloseOverlay).
 */
import fs from 'fs';
import path from 'path';
import vm from 'vm';

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
    ';window.__tabTest = {' +
    'setup: function(cols, total) { _excelVirtualLogicalCols = cols; _excelVirtualTotal = total; _excelVirtualStart = 0; _excelVirtualEnd = 100; _excelVirtualActiveCell = null; },' +
    'focusNavEl: function(el, dir, noScroll) { var row = el.closest("tr"); var els = _excelGetNavElements(row); _excelFocusNavEl(el, els, dir, noScroll ? { noScroll: true } : undefined); },' +
    'navEls: function(row) { return _excelGetNavElements(row); },' +
    'attachFocusIn: function() { var c = document.getElementById("excel-table-container"); c.removeEventListener("focusin", _excelVirtualOnFocusIn); c.addEventListener("focusin", _excelVirtualOnFocusIn); }' +
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
    return (window as any).__tabTest;
}

describe('excel tab-fokus', () => {
    let modalCtx: any;

    beforeAll(() => {
        const code = ['excelSelection.js', 'excelVirtual.js', 'excelCellNavigation.js']
            .map((f) => fs.readFileSync(path.join(BASE, f), 'utf8'))
            .join('\n;\n');
        (0, eval)(code + DRIVER);
        (window as any).excelSelectRow = jest.fn();
        // modalCore (ESM) — ten sam wzorzec vm co modalScrollGuard.test.ts
        const modalCode = fs
            .readFileSync(path.join(process.cwd(), 'public/js/shared/modalCore.js'), 'utf-8')
            .replace(/import\s+.*from\s+['"].*['"];?/, '')
            .replace(/export function/g, 'function');
        const context: any = {
            document,
            window: {
                getComputedStyle: (el: Element) => global.window.getComputedStyle(el)
            },
            setTimeout: (fn: any, ms: number) => setTimeout(fn, ms),
            escapeHtml: (s: any) => String(s ?? '')
        };
        vm.createContext(context);
        vm.runInContext(modalCode, context, { filename: 'modalCore.js' });
        modalCtx = context;
    });

    beforeEach(() => {
        document.body.innerHTML =
            '<button id="opener">open</button>' +
            '<div id="excel-table-overlay"><div id="excel-table-container"><table><tbody>' +
            rowHtml(0) +
            rowHtml(1) +
            '</tbody></table></div></div>';
        nav().setup(COLS.slice(), 2);
        nav().attachFocusIn();
        ((window as any).excelSelectRow as jest.Mock).mockClear();
    });

    afterEach(() => {
        document.querySelectorAll('.js-modal-overlay').forEach((el) => el.remove());
        document.body.style.overflow = '';
    });

    /** Wszystkie tab-stopy grida w DOM order (prod-kolejność _excelGetNavElements). */
    function allTabStops(): HTMLElement[] {
        const rows = Array.from(
            document.querySelectorAll('#excel-table-container tr[data-logical-row]')
        );
        const out: HTMLElement[] = [];
        rows.forEach((r) => {
            nav()
                .navEls(r)
                .forEach((el: HTMLElement) => out.push(el));
        });
        return out;
    }

    /** Symulacja natywnego Tab (browser default): następny/poprzedni stop + focus. */
    function pressTab(shift = false): string {
        const all = allTabStops();
        const cur = document.activeElement as HTMLElement;
        let i = all.indexOf(cur);
        if (i < 0) i = shift ? 0 : -1;
        const n = shift ? (i - 1 + all.length) % all.length : (i + 1) % all.length;
        all[n].focus();
        return all[n].id;
    }

    test('focusin na komórce → excelSelectRow dokładnie 1× z właściwym wIdx', () => {
        const sel = (window as any).excelSelectRow as jest.Mock;
        const el = document.getElementById('rzDna-1') as HTMLElement;
        // prod ścieżka fokusu: _excelFocusNavEl (focus + selectRow) + focusin (sync active)
        nav().focusNavEl(el, 'down', true);
        el.dispatchEvent(new window.FocusEvent('focusin', { bubbles: true }));
        expect(sel).toHaveBeenCalledTimes(1);
        expect(sel).toHaveBeenCalledWith(1);
    });

    test('Tab Tab Tab do przodu: name → rzWlazu → rzDna → rzWlot (żadna nie gubi)', () => {
        (document.getElementById('name-0') as HTMLElement).focus();
        expect(pressTab()).toBe('rzWlazu-0');
        expect(pressTab()).toBe('rzDna-0');
        expect(pressTab()).toBe('rzWlot_0-0');
    });

    test('pełny spacer Tab name → psiaBuda jak legacy rowEls', () => {
        (document.getElementById('name-0') as HTMLElement).focus();
        const visited = ['name-0'];
        for (let i = 1; i < FOCUSABLE.length; i++) visited.push(pressTab());
        expect(visited).toEqual(FOCUSABLE.map((c) => c + '-0'));
    });

    test('Shift+Tab: pełny powrót psiaBuda → name bez strat', () => {
        (document.getElementById('psiaBuda-0') as HTMLElement).focus();
        const visited = ['psiaBuda-0'];
        for (let i = FOCUSABLE.length - 2; i >= 0; i--) visited.push(pressTab(true));
        expect(visited).toEqual([...FOCUSABLE].reverse().map((c) => c + '-0'));
    });

    test('Tab na ostatniej przechodzi do wiersza niżej, Shift+Tab wraca', () => {
        (document.getElementById('psiaBuda-0') as HTMLElement).focus();
        expect(pressTab()).toBe('name-1');
        expect(pressTab(true)).toBe('psiaBuda-0');
    });

    test('modal close → focus-restore na element sprzed open (modalCore untrapFocus)', () => {
        const opener = document.getElementById('opener') as HTMLElement;
        opener.focus();
        expect(document.activeElement).toBe(opener);
        modalCtx.window.showModal({
            id: 'tab-focus-modal',
            title: 'T',
            titleId: 'tab-focus-title',
            html: '<div class="modal"><button id="m-ok">OK</button><button id="m-x">X</button></div>'
        });
        // open przenosi fokus do modala
        expect((document.activeElement as HTMLElement).closest('#tab-focus-modal')).not.toBeNull();
        modalCtx.window.closeModal('tab-focus-modal');
        expect(document.activeElement).toBe(opener);
    });
});
