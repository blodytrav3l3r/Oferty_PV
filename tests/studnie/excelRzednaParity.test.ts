// @ts-nocheck
// RED: parzystosc manual (excelOnPrzejscieChange) vs paste (_excelSetModelCellValue, logical 7).
// Wzor loaderow: excelPasteBulk.test.ts. Oczekiwany RED na HEAD: puste "" tworzy
// przejscie w paste (length 1), manual robi early-return (length 0).
import fs from 'fs';
import path from 'path';
import vm from 'vm';
describe('excel rzedna parity - manual vs paste (RED)', () => {
    function createCtx(wellsData: any[]) {
        const base = path.join(__dirname, '../../public/js/studnie');
        const context: any = {
            wells: JSON.parse(JSON.stringify(wellsData)),
            studnieProducts: [],
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
                getElementById: () => null,
                createElement: () => ({ style: {}, setAttribute: () => {}, appendChild: () => {} }),
                body: { appendChild: () => {} },
                activeElement: null
            },
            window: {
                showModal: () => ({}),
                degToGon: (d: number) => ((d * 400) / 360).toFixed(2)
            },
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
        context._excelIsWellLocked = () => false;
        return context;
    }
    function freshWell() {
        return {
            id: 'well-S1',
            name: 'S1',
            numer: 'S1',
            dn: '1000',
            magazyn: 'Kluczbork',
            config: [],
            przejscia: [],
            rzednaWlazu: 10,
            rzednaDna: 5,
            kineta: 'brak',
            psiaBuda: false
        };
    }
    function runManual(val: any) {
        const ctx = createCtx([freshWell()]);
        ctx.excelOnPrzejscieChange(0, 0, 'rzednaWlaczenia', val);
        const p = ctx.wells[0].przejscia[0];
        return { len: ctx.wells[0].przejscia.length, val: p ? p.rzednaWlaczenia : undefined };
    }
    function runPaste(val: any) {
        const ctx = createCtx([freshWell()]);
        const cache = ctx._excelBuildPasteCache();
        ctx._excelSetModelCellValue(0, 7, val, cache, null);
        const p = ctx.wells[0].przejscia[0];
        return { len: ctx.wells[0].przejscia.length, val: p ? p.rzednaWlaczenia : undefined };
    }
    test('T1 7,5 manual vs paste rowne 7.5', () => {
        expect(runManual('7,5')).toEqual({ len: 1, val: 7.5 });
        expect(runPaste('7,5')).toEqual({ len: 1, val: 7.5 });
    });
    test('T2 7.5 manual vs paste rowne 7.5', () => {
        expect(runManual('7.5')).toEqual({ len: 1, val: 7.5 });
        expect(runPaste('7.5')).toEqual({ len: 1, val: 7.5 });
    });
    test('T3 puste parity dlugosci (RED: paste tworzy, manual nie)', () => {
        const m = runManual('');
        const p = runPaste('');
        expect(m).toEqual({ len: 0, val: undefined });
        expect(p.len).toBe(m.len);
        expect(p.val).toBe(m.val);
    });
    test('T4 abc parity null', () => {
        expect(runManual('abc')).toEqual({ len: 1, val: null });
        expect(runPaste('abc')).toEqual({ len: 1, val: null });
    });
});
