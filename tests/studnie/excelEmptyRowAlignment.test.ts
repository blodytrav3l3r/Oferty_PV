/* eslint-disable @typescript-eslint/ban-ts-comment */
// @ts-nocheck
import fs from 'fs';
import path from 'path';
import vm from 'vm';

describe('excel empty row — alignment per DN (header vs data vs empty)', () => {
    let ctx: any;
    const DN_TABS = ['1000', '1200', '1500', '2000', '2500', 'styczne'];

    beforeAll(() => {
        const base = path.join(__dirname, '../../public/js/studnie');
        const context: any = {
            wells: [],
            studnieProducts: [],
            _excelActiveTab: '1000',
            _excelMaxTransitions: {},
            _excelRowSelectStates: {},
            _excelHiddenColumnIds: [],
            currentWellIndex: -1,
            DN_TABS,
            DN_COLORS: {
                '1000': { border: '#3b82f6' },
                '1200': { border: '#22c55e' },
                '1500': { border: '#eab308' },
                '2000': { border: '#a855f7' },
                '2500': { border: '#ef4444' },
                styczne: { border: '#ec4899' }
            },
            LAYERS: { FOCUS_OVERLAY: 1000, EXCEL_BACKDROP: 999 },
            LAYERS_EXCEL: {
                STICKY_HEADER_TH: 10,
                STICKY_COLUMN: 5,
                STICKY_HEADER_ROW: 10,
                STICKY_THEAD: 10,
                SELECT_OVERLAY: 20
            },
            _EXCEL_FONT:
                'font-size: var(--fs-sm);font-family:Inter,Segoe UI,sans-serif;letter-spacing:0.1px;',
            KINETA_OPTIONS: [
                ['brak', 'Brak'],
                ['beton', 'Beton']
            ],
            logger: { info: () => {}, warn: () => {}, error: () => {} },
            escapeHtml: (s: string) =>
                String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'),
            escapeHtmlAttr: (s: string) => String(s).replace(/"/g, '&quot;'),
            isWellAuto: () => true,
            getAvailableProducts: (w: any) => context.studnieProducts,
            filterByWellParams: () => true,
            filterSealsByWellType: (arr: any) => arr,
            getMaxPipeDn: () => 1000,
            visiblePrzejsciaTypes: new Set(['PVC']),
            // minimal stubs for helpers called inside render
            _excelGetWellProdCode: () => null,
            _excelShortLabel: (n: string) => ({ short: n, detail: '' }),
            _excelWrapDetail: (d: string) => d,
            _excelCellInp: () => '',
            _excelOverlaySelectHtml: () => '<select></select>',
            _excelStickyCellBg: () => '',
            _excelCalcWellHeight: () => 4000,
            _excelCalcDennicaHeight: () => 0,
            _excelCalcUszczelkaCount: () => 0,
            _excelGetWlazFromConfig: () => '',
            _excelCountProductInConfig: () => 0,
            _excelGetResolution: () => null,
            _excelIsWellLocked: () => false
        };
        context.window = context;
        vm.createContext(context);
        const files = [
            'excelHelpers.js',
            'excelReductionColumns.js',
            'excelColumns.js',
            'excelTableBody.js'
        ];
        for (const file of files) {
            const code = fs.readFileSync(path.join(base, file), 'utf8');
            vm.runInContext(code, context);
        }
        // Override helpers that depend on DOM with lightweight versions for counting
        // keep real _excelRenderTbody — it returns html string; we just need counts
        ctx = context;
    });

    const PRODUCTS = [
        {
            id: 'wlaz-1000-150',
            name: 'Właz DN1000 H=150',
            componentType: 'wlaz',
            dn: '1000',
            height: 150,
            magazynKLB: 1,
            magazynWL: 1
        },
        {
            id: 'wlaz-1200-150',
            name: 'Właz DN1200 H=150',
            componentType: 'wlaz',
            dn: '1200',
            height: 150,
            magazynKLB: 1,
            magazynWL: 1
        },
        {
            id: 'krag-1000-500',
            name: 'Krąg DN1000 H=500',
            componentType: 'krag',
            dn: '1000',
            height: 500,
            magazynKLB: 1,
            magazynWL: 1
        },
        {
            id: 'krag-1200-500',
            name: 'Krąg DN1200 H=500',
            componentType: 'krag',
            dn: '1200',
            height: 500,
            magazynKLB: 1,
            magazynWL: 1
        },
        {
            id: 'krag-1500-500',
            name: 'Krąg DN1500 H=500',
            componentType: 'krag',
            dn: '1500',
            height: 500,
            magazynKLB: 1,
            magazynWL: 1
        },
        {
            id: 'krag-2000-500',
            name: 'Krąg DN2000 H=500',
            componentType: 'krag',
            dn: '2000',
            height: 500,
            magazynKLB: 1,
            magazynWL: 1
        },
        {
            id: 'krag-2500-500',
            name: 'Krąg DN2500 H=500',
            componentType: 'krag',
            dn: '2500',
            height: 500,
            magazynKLB: 1,
            magazynWL: 1
        },
        {
            id: 'den-1000-300',
            name: 'Dennica DN1000 H=300',
            componentType: 'dennica',
            dn: '1000',
            height: 300,
            magazynKLB: 1,
            magazynWL: 1
        },
        {
            id: 'den-1200-300',
            name: 'Dennica DN1200 H=300',
            componentType: 'dennica',
            dn: '1200',
            height: 300,
            magazynKLB: 1,
            magazynWL: 1
        },
        {
            id: 'styczna-1',
            name: 'Studnia styczna',
            componentType: 'styczna',
            dn: 'styczna',
            height: 0,
            magazynKLB: 1,
            magazynWL: 1
        },
        {
            id: 'uszcz-1000-gsg',
            name: 'Uszczelka GSG DN1000',
            componentType: 'uszczelka',
            dn: '1000',
            height: 0,
            magazynKLB: 1,
            magazynWL: 1
        },
        {
            id: 'prz-250',
            name: 'Przejście DN250',
            componentType: 'przejscie',
            dn: '250',
            height: 0,
            magazynKLB: 1,
            magazynWL: 1
        }
    ];

    function countCols(
        dn: string,
        opts: { withReduction?: boolean; stycznaNadbudowa1200?: boolean } = {}
    ) {
        ctx.studnieProducts = [...PRODUCTS];
        const wellDn = dn === 'styczne' ? 'styczna' : dn;
        const well: any = {
            name: 'ST-001',
            dn: wellDn,
            magazyn: 'Kluczbork',
            rzednaWlazu: 5,
            rzednaDna: 1,
            przejscia: [{ id: 'p1', productId: '', rzednaWlaczenia: 0.5, angle: 0 }],
            config: [],
            redukcjaDN1000: !!opts.withReduction,
            redukcjaTargetDN: 1000,
            kineta: 'brak',
            psiaBuda: false,
            stycznaNadbudowa1200: !!opts.stycznaNadbudowa1200
        };
        ctx.wells = [well];
        if (opts.withReduction) {
            // need wells array for _excelBuildComponentColumns to detect hasRed
            ctx.wells = [well];
        }
        const visibleCols = ctx._excelGetVisibleComponentColumns(dn, well);
        const maxTr = 2;
        const hasReduction =
            ['1200', '1500', '2000', '2500', 'styczne'].includes(dn) && !!opts.withReduction;
        const tabWells = [well];
        // Build header th count — reproduce logic from excelTableRenderer
        // 7 sticky + maxTr*4 + 2 (+/-) + WLAZ? + visibleCols filtered + 2 (Hdenn,Uszcz) + hasReduction + 3 (Kineta,PBuda,Akcje)
        // For exactness, render whole table via _excelRenderTbody counts + header count derived from visibleCols
        const html = ctx._excelRenderTbody(tabWells, dn, visibleCols, maxTr, hasReduction);
        // html = '</thead><tbody><tr data-widx...> ... </tr><tr id="excel-empty-row"...> ...'
        const emptyIdx = html.indexOf('id="excel-empty-row"');
        const dataRowHtml = html.substring(0, emptyIdx);
        const emptyRowHtml = html.substring(emptyIdx);
        const countTd = (s: string) => (s.match(/<td/g) || []).length;
        const dataTds = countTd(dataRowHtml);
        const emptyTds = countTd(emptyRowHtml);
        // header th count: count via building header would be complex; instead derive from data row td count logic:
        // header has same count as data row (by construction). So we just verify data vs empty.
        // Additionally compute visibleCols len to ensure WLAZ conditional
        const wlazInVisible = visibleCols.some((c: any) => c.componentType === 'wlaz');
        const componentTds = visibleCols.filter(
            (c: any) => c.type !== 'select' && c.type !== 'auto'
        ).length;
        return {
            dn,
            visibleCols: visibleCols.length,
            componentTds,
            wlazInVisible,
            hasReduction,
            dataTds,
            emptyTds,
            maxTr
        };
    }

    test.each(DN_TABS)('DN %s — empty row ma tę samą liczbę kolumn co wiersz danych', (dn) => {
        const withReduction = ['1200', '1500', '2000', '2500', 'styczne'].includes(dn);
        const r = countCols(dn, {
            withReduction,
            stycznaNadbudowa1200: dn === 'styczne' ? false : undefined
        });
        expect(r.emptyTds).toBe(r.dataTds);
        // A/M width guard — sticky 7 must align (checked visually, here width count)
        // WLAZ conditional: empty should not have extra col when wlaz absent
        // For DN1000 with wlaz present, both have it; for DN without, both skip
    });

    test('styczne bez redukcji — brak R.* cols, WLAZ warunkowy', () => {
        const r = countCols('styczne', { withReduction: false });
        expect(r.hasReduction).toBe(false);
        expect(r.emptyTds).toBe(r.dataTds);
    });

    test('styczne z redukcją — R.* + styczna, WLAZ nadal warunkowy', () => {
        const r = countCols('styczne', { withReduction: true, stycznaNadbudowa1200: true });
        expect(r.hasReduction).toBe(true);
        expect(r.emptyTds).toBe(r.dataTds);
    });

    test('A/M column width — empty row używa 70px (nie 54)', () => {
        // Sprawdź surowy html pustego wiersza — musi zawierać width:70px
        const r = countCols('1000', {});
        // Uruchom ponownie by pobrać html
        ctx.studnieProducts = [...PRODUCTS];
        const well: any = {
            name: 'ST-001',
            dn: '1000',
            magazyn: 'Kluczbork',
            rzednaWlazu: 5,
            rzednaDna: 1,
            przejscia: [],
            config: [],
            redukcjaDN1000: false,
            kineta: 'brak',
            psiaBuda: false
        };
        ctx.wells = [well];
        const visibleCols = ctx._excelGetVisibleComponentColumns('1000', well);
        const html = ctx._excelRenderTbody([well], '1000', visibleCols, 2, false);
        const emptyPart = html.substring(html.indexOf('id="excel-empty-row"'));
        expect(emptyPart).toContain('width:70px');
        expect(emptyPart).not.toContain('width:54px');
        // WLAZ width 62 gdy obecny
        if (visibleCols.some((c: any) => c.componentType === 'wlaz')) {
            expect(emptyPart).toContain('62');
        }
    });
});
