/**
 * @jest-environment jsdom
 */

// @ts-nocheck
/**
 * Baza #58: overlay-selecty Excela odświeżają się LIVE po wyborze (bez scrolla).
 * Tło: dyspozytor CSP odpala tylko pierwszy pasujący slot na event, więc
 * $selectLabel (data-csp-2) nigdy nie leci — labelkę synchronizuje handler
 * modelu (_excelSyncRowSelect). Test na PRAWDZIWYM DOM (jsdom): po wywołaniu
 * handlera widoczna labelka i opcje selecta muszą być świeże natychmiast.
 */
import fs from 'fs';
import path from 'path';
import vm from 'vm';

const BASE = path.join(process.cwd(), 'public/js/studnie');
const read = (f: string) => fs.readFileSync(path.join(BASE, f), 'utf8');

function selWrap(csp: string, args: string, opts: Array<[string, string]>, cur: string) {
    const label = (opts.find((o) => o[0] === cur) || ['', '—'])[1];
    return (
        '<div class="excel-sel-wrap" tabindex="0">' +
        '<select data-csp="' +
        csp +
        '" data-csp-on="change" data-csp-args=\'' +
        args +
        "'>" +
        opts
            .map(
                (o) =>
                    '<option value="' +
                    o[0] +
                    '"' +
                    (o[0] === cur ? ' selected' : '') +
                    '>' +
                    o[1] +
                    '</option>'
            )
            .join('') +
        '</select>' +
        '<div>' +
        label +
        '</div>' +
        '</div>'
    );
}

function loadWithRow() {
    document.body.innerHTML =
        '<div id="excel-table-container"><table><tbody>' +
        '<tr data-widx="0">' +
        '<td>c0</td><td>c1</td><td>c2</td>' +
        '<td><input value="S1"/></td>' +
        '<td><input value="10"/></td><td><input value="5"/></td><td>wys</td>' +
        '<td><input value=""/></td><td><input value=""/></td>' +
        '<td>' +
        selWrap(
            'excelOnPrzejscieTypeChange',
            '[0,0,"$value"]',
            [
                ['', '—'],
                ['PCV', 'PCV'],
                ['GRP', 'GRP']
            ],
            ''
        ) +
        '</td>' +
        '<td>' +
        selWrap(
            'excelOnPrzejscieChange',
            '[0,0,"$value"]',
            [
                ['', '—'],
                ['prz-pcv-160', 'DN 160']
            ],
            ''
        ) +
        '</td>' +
        '<td>gap</td><td>gap</td>' +
        '<td>' +
        selWrap(
            'excelOnWlazChange',
            '[0,"$value"]',
            [
                ['', '—'],
                ['wlaz-a', '40 cm']
            ],
            ''
        ) +
        '</td>' +
        '<td>' +
        selWrap(
            'excelOnKinetaChange',
            '[0,"$value"]',
            [
                ['', '—'],
                ['beton', 'Beton'],
                ['preco', 'Preco']
            ],
            'beton'
        ) +
        '</td>' +
        '</tr>' +
        '</tbody></table></div>';

    const wells = [
        {
            id: 'w1',
            name: 'S1',
            dn: 1000,
            rzednaWlazu: 10,
            rzednaDna: 5,
            config: [],
            przejscia: [],
            kineta: 'beton',
            autoSelect: true,
            autoLocked: false
        }
    ];
    const sandbox: any = {
        window: {},
        document,
        console,
        wells,
        studnieProducts: [
            { id: 'prz-pcv-160', category: 'PCV', dn: '160', componentType: 'przejscie', active: 1 }
        ],
        currentWellIndex: 0,
        _excelActiveTab: '1000',
        _excelMaxTransitions: { '1000': 1 },
        _excelAutoSelectEnabled: true,
        _excelPasteInProgress: false,
        _excelGuardWellLocked: () => true,
        _excelSaveUndoSnapshot: () => {},
        _excelCreatePrzejscie: () => ({ productId: '', rzednaWlaczenia: null, angle: 0 }),
        _excelMarkAsManual: () => {},
        _excelClearResCache: () => {},
        _excelInsertConfigItem: () => {},
        recalculateWellErrors: () => {},
        recalcGaskets: () => {},
        _excelRenderTable: () => {
            throw new Error('full render z edycji komórki (baza #58)');
        },
        _excelUpdateHeaderProdCodes: () => {},
        _excelUpdateLeftPreview: () => {},
        _excelImmediatePreview: () => {},
        _excelSyncActiveRowErrors: () => {},
        _excelDebouncedRefresh: () => {},
        _excelRefreshAutoCells: () => {},
        _excelRefreshKragCells: () => {},
        _excelGetCellByLogical: (row: any, logical: number) => row.children[logical] || null,
        _excelWellMatchesTab: () => true,
        getMaxPipeDn: () => 2000,
        getStudnieProductById: (id: string) =>
            [{ id: 'prz-pcv-160', category: 'PCV', dn: '160' }].find((p) => p.id === id) || null,
        escapeHtml: (s: any) => String(s),
        escapeHtmlAttr: (s: any) => String(s == null ? '' : s).replace(/"/g, '&quot;')
    };
    vm.createContext(sandbox);
    vm.runInContext(read('excelHelpers.js'), sandbox);
    vm.runInContext(read('excelChangeHandlers.js'), sandbox);
    return { sandbox, wells };
}

function labelOf(csp: string): string {
    const sel = document.querySelector(
        'select[data-csp="' + csp + '"]'
    ) as HTMLSelectElement | null;
    if (!sel) return '<brak selecta>';
    const wrap = sel.closest('.excel-sel-wrap');
    const div = wrap ? wrap.querySelector('div') : null;
    return div ? div.textContent || '' : '<brak labelki>';
}

describe('frontend: selecty przejść live (baza #58)', () => {
    test('Rodzaj: labelka + opcje Średnicy świeże bez scrolla i bez rendera', () => {
        const { sandbox, wells } = loadWithRow();
        vm.runInContext('excelOnPrzejscieTypeChange(0, 0, "PCV")', sandbox);
        expect(wells[0].przejscia[0].tempCategory).toBe('PCV');
        expect(labelOf('excelOnPrzejscieTypeChange')).toBe('PCV');
        const dnSel = document.querySelector(
            'select[data-csp="excelOnPrzejscieChange"]'
        ) as HTMLSelectElement;
        const vals = Array.from(dnSel.options).map((o) => o.value);
        expect(vals).toContain('prz-pcv-160');
    });

    test('Średnica: labelka DN świeża natychmiast po wyborze', () => {
        const { sandbox, wells } = loadWithRow();
        vm.runInContext('excelOnPrzejscieTypeChange(0, 0, "PCV")', sandbox);
        vm.runInContext('excelOnPrzejscieChange(0, 0, "productId", "prz-pcv-160")', sandbox);
        expect(wells[0].przejscia[0].productId).toBe('prz-pcv-160');
        expect(labelOf('excelOnPrzejscieChange')).toBe('DN 160');
    });

    test('Właz i Kineta: labelki sync bez full-rendera', () => {
        const { sandbox, wells } = loadWithRow();
        vm.runInContext('excelOnWlazChange(0, "wlaz-a")', sandbox);
        expect(labelOf('excelOnWlazChange')).toBe('40 cm');
        vm.runInContext('excelOnKinetaChange(0, "preco")', sandbox);
        expect(wells[0].kineta).toBe('preco');
        expect(labelOf('excelOnKinetaChange')).toBe('Preco');
    });
});
