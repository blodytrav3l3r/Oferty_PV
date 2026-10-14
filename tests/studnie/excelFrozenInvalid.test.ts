// @ts-nocheck
// RED: oderwany target (wiersz zwirtualizowany, closest null) w _excelSetCellValue
// zwraca undefined zamiast unsupported - model nietkniety, ale raport paste liczy applied.
// Wzor: excelPasteBulk.test.ts. T3/T4 zweryfikowane na HEAD skryptem dbg (undefined).
import fs from 'fs';
import path from 'path';
import vm from 'vm';
describe('excel frozen invalid - oderwany target to unsupported (RED)', () => {
    function createCtx(wellsData: any[], products: any[]) {
        const base = path.join(__dirname, '../../public/js/studnie');
        const context: any = {
            wells: JSON.parse(JSON.stringify(wellsData)),
            studnieProducts: JSON.parse(JSON.stringify(products)),
            _excelActiveTab: '1000',
            _excelMaxTransitions: {
                '1000': 1,
                '1200': 1,
                '1500': 1,
                '2000': 1,
                '2500': 1,
                styczne: 1
            },
            _excelHiddenColumnIds: [],
            _excelSelectedCells: [],
            _excelSelectedCols: [],
            _excelPasteInProgress: false,
            _excelAutoSelectEnabled: false,
            document: {
                querySelectorAll: () => [],
                querySelector: () => null,
                getElementById: (id: string) => (id === 'excel-table-overlay' ? { id } : null),
                createElement: () => ({ style: {}, setAttribute: () => {}, appendChild: () => {} }),
                body: { appendChild: () => {} },
                activeElement: null
            },
            window: {},
            LAYERS: { TOAST: 1000 },
            LAYERS_EXCEL: { STICKY_COLUMN: 5, STICKY_HEADER_TH: 10 },
            logger: { info: () => {}, warn: () => {}, error: () => {} },
            escapeHtml: (s: string) => String(s),
            escapeHtmlAttr: (s: string) => String(s),
            showToast: () => {},
            lucide: { createIcons: () => {} }
        };
        context.window = context;
        vm.createContext(context);
        const files = [
            'excelState.js',
            'solverValidation.js',
            'excelHelpers.js',
            'excelColumns.js',
            'excelReductionColumns.js',
            'excelChangeHandlers.js',
            'excelPasteSeq.js',
            'excelPasteMismatch.js',
            'excelCopyPaste.js'
        ];
        for (const f of files) {
            vm.runInContext(fs.readFileSync(path.join(base, f), 'utf8'), context);
        }
        vm.runInContext(
            'globalThis._excelMarkAsManual = function(wIdx){ var w=wells[wIdx]; if(!w) return; w.autoSelect=false; w.configSource="MANUAL"; w.autoLocked=true; };' +
                'globalThis._excelInsertConfigItem = function(well, ct, pid, qty){ well.config = well.config || []; well.config.push({ productId: pid, quantity: qty }); };' +
                'globalThis._excelSaveUndoSnapshot = function(){};' +
                'globalThis._excelGuardWellLocked = function(){ return true; };' +
                'globalThis._excelAutoSelectForWell = function(){};' +
                'globalThis._excelClearResCache = function(){};' +
                'globalThis._excelMarkDirty = function(){};' +
                'globalThis._excelRefreshAutoCells = function(){};' +
                'globalThis._excelUpdateLeftPreview = function(){};' +
                'globalThis._excelImmediatePreview = function(){};' +
                'globalThis._excelDebouncedRefresh = function(){};' +
                'globalThis._excelRenderTable = function(){};' +
                'globalThis._excelSyncActiveRowErrors = function(){};' +
                'globalThis._excelUpdateHeaderProdCodes = function(){};' +
                'globalThis._excelSyncRowSelect = function(){};' +
                'globalThis.autoSelectComponents = function(){};' +
                'if(typeof Event==="undefined") globalThis.Event = class Event { constructor(t,o){this.type=t; this.bubbles=o&&o.bubbles;}};' +
                'if(typeof requestAnimationFrame==="undefined") globalThis.requestAnimationFrame = function(cb){ return 0; };' +
                'if(typeof cancelAnimationFrame==="undefined") globalThis.cancelAnimationFrame = function(){};',
            context
        );
        context._excelIsWellLocked = (wIdx: number) => wIdx === 1;
        return context;
    }
    function baseProducts() {
        return [
            {
                id: 'prz-pvc-160',
                componentType: 'przejscie',
                dn: '160',
                category: 'PCV',
                name: 'PCV DN160'
            },
            {
                id: 'prz-grp-160',
                componentType: 'przejscie',
                dn: '160',
                category: 'GRP',
                name: 'GRP DN160'
            }
        ];
    }
    function makeWell(name: string) {
        return {
            id: 'well-' + name,
            name,
            numer: name,
            dn: '1000',
            magazyn: 'Kluczbork',
            config: [],
            przejscia: [
                {
                    rzednaWlaczenia: null,
                    angle: 0,
                    tempCategory: '',
                    productId: '',
                    angleExecution: 0,
                    angleGony: '0.00',
                    flowType: 'WYLOT',
                    displayIndex: 0
                }
            ],
            rzednaWlazu: 10,
            rzednaDna: 5,
            kineta: 'brak',
            psiaBuda: false
        };
    }
    function detachedInput() {
        return {
            tagName: 'INPUT',
            type: 'text',
            value: '',
            dispatchEvent: () => {},
            closest: () => null
        };
    }
    test('T1 model-only na zablokowanej zwraca locked (kontrakt zielony)', () => {
        const ctx = createCtx([makeWell('S0'), makeWell('S1')], baseProducts());
        const cache = ctx._excelBuildPasteCache();
        expect(ctx._excelSetModelCellValue(1, 9, 'PCV', cache, null)).toBe('locked');
        expect(ctx.wells[1].przejscia[0].tempCategory).toBe('');
    });
    test('T2 nieprawidlowy wIdx to unsupported (kontrakt zielony)', () => {
        const ctx = createCtx([makeWell('S0')], baseProducts());
        const cache = ctx._excelBuildPasteCache();
        expect(ctx._excelSetModelCellValue(NaN, 9, 'PCV', cache, null)).toBe('unsupported');
        expect(ctx._excelSetModelCellValue(99, 9, 'PCV', cache, null)).toBe('unsupported');
    });
    test('T3 oderwany target to unsupported (RED: HEAD daje undefined)', () => {
        const ctx = createCtx([makeWell('S0')], baseProducts());
        const cache = ctx._excelBuildPasteCache();
        const st = ctx._excelSetCellValue(detachedInput(), 'PCV', cache, 9);
        expect(st).toBe('unsupported');
        expect(ctx.wells[0].przejscia[0].tempCategory).toBe('');
    });
    test('T4 licznik nie liczy applied bez zapisu modelu (RED)', () => {
        const ctx = createCtx([makeWell('S0')], baseProducts());
        const cache = ctx._excelBuildPasteCache();
        cache.stats = ctx._excelPasteStatsNew();
        const st = ctx._excelSetCellValue(detachedInput(), 'PCV', cache, 9);
        ctx._excelPasteCount(cache, st);
        expect(cache.stats.applied).toBe(0);
        expect(cache.stats.unsupported).toBe(1);
    });
});
