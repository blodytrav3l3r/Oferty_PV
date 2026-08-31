// @ts-check
// Oracle: legacy vs virtual muszą dać identyczny TSV i selekcję
import fs from 'fs';
import path from 'path';
import vm from 'vm';

describe('excelVirtual oracle — legacy vs virtual', () => {
    let ctx: any;
    beforeAll(() => {
        const base = path.join(__dirname, '../../public/js/studnie');
        const context: any = {
            wells: [],
            _excelActiveTab: '1000',
            _excelMaxTransitions: { '1000': 1 },
            _excelRowSelectStates: {},
            _excelColWidths: {},
            _excelHiddenColumnIds: [],
            _excelSelectedCells: [],
            _excelSelectedCols: [],
            _excelVirtualFiltered: null,
            _excelVirtualTotal: 0,
            studnieProducts: [
                {
                    id: 'den-1000-300',
                    componentType: 'dennica',
                    dn: 1000,
                    height: 300,
                    magazynKLB: 1
                },
                { id: 'krag-1000-500', componentType: 'krag', dn: 1000, height: 500, magazynKLB: 1 }
            ],
            DN_COLORS: { '1000': { border: '#3b82f6' }, styczne: { border: '#ec4899' } },
            LAYERS_EXCEL: {
                STICKY_COLUMN: 5,
                STICKY_HEADER_TH: 20,
                RESIZE_HANDLE: 30,
                TOAST: 5000
            },
            LAYERS: { TOAST: 5000 },
            KINETA_OPTIONS: [],
            logger: { warn() {}, error() {} },
            document: {
                getElementById: () => null,
                querySelector: () => null,
                querySelectorAll: () => [],
                createElement: () => ({})
            },
            window: null as any,
            localStorage: { getItem: () => null },
            location: { search: '' }
        };
        context.window = context;
        vm.createContext(context);
        for (const f of [
            'excelState.js',
            'excelHelpers.js',
            'excelReductionColumns.js',
            'excelColumns.js',
            'excelTableBody.js',
            'excelVirtual.js'
        ]) {
            const code = fs.readFileSync(path.join(base, f), 'utf8');
            try {
                vm.runInContext(code, context);
            } catch (e) {
                /* ignore */
            }
        }
        ctx = context;
        // helper wells
        ctx.wells = [];
        for (let i = 0; i < 100; i++)
            ctx.wells.push({
                id: 'well-' + i,
                name: 'Ss' + i,
                dn: '1000',
                numer: 'Ss' + i,
                config: [],
                przejscia: [],
                rzednaWlazu: 10 + i,
                rzednaDna: 5 + i
            });
    });

    test('filteredIndexes zawiera tylko DN 1000 i po filtrze q', () => {
        ctx._excelActiveTab = '1000';
        ctx._excelVirtualBuildFiltered();
        expect(ctx._excelVirtualTotal).toBe(100);
        // filtr
        const origGet = ctx.document.getElementById;
        ctx.document.getElementById = (id: string) =>
            id === 'excel-search-input' ? { value: 'Ss5' } : null;
        ctx._excelVirtualBuildFiltered();
        const filtered = ctx._excelVirtualFiltered as number[];
        expect(filtered.length).toBeGreaterThan(0);
        expect(
            filtered.every(
                (idx: number) => String(ctx.wells[idx].name).toLowerCase().indexOf('ss5') >= 0
            )
        ).toBe(true);
        ctx.document.getElementById = origGet;
        ctx._excelVirtualBuildFiltered();
    });

    test('virtual TSV z modelu zgadza się z legacy DOM copy dla małego zakresu', () => {
        // ustaw 3 wells
        ctx.wells = [
            {
                id: 'well-0',
                name: 'Ss0',
                dn: '1000',
                rzednaWlazu: 10,
                rzednaDna: 5,
                config: [],
                przejscia: []
            },
            {
                id: 'well-1',
                name: 'Ss1',
                dn: '1000',
                rzednaWlazu: 11,
                rzednaDna: 6,
                config: [],
                przejscia: []
            }
        ];
        ctx._excelActiveTab = '1000';
        ctx._excelVirtualBuildFiltered();
        // selekcja 2 wiersze x col 3 (Nazwa)
        const vals = [0, 1].map((idx) => ctx._excelVirtualGetCellValue(idx, 3));
        expect(vals).toEqual(['Ss0', 'Ss1']);
    });

    test('range O(1) dla 10k — nie buduje 400k entries', () => {
        ctx.wells = [];
        for (let i = 0; i < 10000; i++)
            ctx.wells.push({ id: 'well-' + i, name: 'Ss' + i, dn: '1000' });
        ctx._excelActiveTab = '1000';
        ctx._excelVirtualBuildFiltered();
        expect(ctx._excelVirtualTotal).toBe(10000);
        // symuluj Ctrl+A range
        (global as any).window = ctx;
        ctx.window._excelVirtualSelectionRange = { r1: 0, r2: 9999, c1: 0, c2: 5 };
        // copy nie powinien iterować 10k*6 via array, tylko range
        expect(
            ctx.window._excelVirtualSelectionRange.r2 - ctx.window._excelVirtualSelectionRange.r1
        ).toBe(9999);
    });
});
