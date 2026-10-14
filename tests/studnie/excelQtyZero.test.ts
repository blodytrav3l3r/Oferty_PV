// @ts-nocheck
// RED: paste pustej ilosci nie moze czyscic configu. Wzor: excelPasteBulk.test.ts.
// Oczekiwany RED na HEAD: _excelCompModelUpdate('') -> 0 i filtr usuwa krag (utrata danych).
import fs from 'fs';
import path from 'path';
import vm from 'vm';
describe('excel qty zero - pusta ilosc nie czysci (RED)', () => {
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
                getElementById: () => null,
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
                'globalThis._excelCleanEmptyPrzejscia = function(){};' +
                'globalThis._excelSyncReliefPair = function(){ return false; };' +
                'globalThis.enforceOtRings = function(){ return false; };' +
                'globalThis.recalcGaskets = function(){};' +
                'globalThis.getStudnieProductById = function(id){ return studnieProducts.find(function(p){ return p.id===id; }) || null; };' +
                'globalThis.getAvailableProductsUnion = function(){ return studnieProducts; };' +
                'globalThis.filterByWellParams = function(){ return true; };' +
                'if(typeof Event==="undefined") globalThis.Event = class Event { constructor(t,o){this.type=t; this.bubbles=o&&o.bubbles;}};' +
                'if(typeof requestAnimationFrame==="undefined") globalThis.requestAnimationFrame = function(cb){ return 0; };' +
                'if(typeof cancelAnimationFrame==="undefined") globalThis.cancelAnimationFrame = function(){};',
            context
        );
        context._excelIsWellLocked = () => false;
        return context;
    }
    function baseProducts() {
        return [
            {
                id: 'krag-1000-250',
                componentType: 'krag',
                dn: '1000',
                height: 250,
                name: 'Krag 250'
            },
            {
                id: 'krag-1000-500',
                componentType: 'krag',
                dn: '1000',
                height: 500,
                name: 'Krag 500'
            }
        ];
    }
    function wellWithKrag() {
        return {
            id: 'well-S1',
            name: 'S1',
            numer: 'S1',
            dn: '1000',
            magazyn: 'Kluczbork',
            config: [{ productId: 'krag-1000-250', quantity: 2 }],
            przejscia: [],
            rzednaWlazu: 10,
            rzednaDna: 5,
            kineta: 'brak',
            psiaBuda: false
        };
    }
    function compLogical(ctx: any) {
        const all = ctx._excelBuildComponentColumns('1000', ctx.wells[0]);
        const idx = all.findIndex(
            (c: any) => c.componentType === 'krag' && parseInt(c.height) === 250
        );
        expect(idx).toBeGreaterThanOrEqual(0);
        return ctx._excelGetComponentPrefixLen() + idx;
    }
    test('T1 "0" czysci krag (kontrakt czyszczenia)', () => {
        const ctx = createCtx([wellWithKrag()], baseProducts());
        ctx._excelSetModelCellValue(0, compLogical(ctx), '0', null, null);
        expect(ctx.wells[0].config.filter((c: any) => c.productId === 'krag-1000-250').length).toBe(
            0
        );
    });
    test('T2 "" nie rusza configu (RED: HEAD czysci)', () => {
        const ctx = createCtx([wellWithKrag()], baseProducts());
        ctx._excelSetModelCellValue(0, compLogical(ctx), '', null, null);
        const items = ctx.wells[0].config.filter((c: any) => c.productId === 'krag-1000-250');
        expect(items.length).toBe(1);
        expect(items[0].quantity).toBe(2);
    });
    test('T3 "abc" odrzucone, config nietkniety', () => {
        const ctx = createCtx([wellWithKrag()], baseProducts());
        ctx._excelSetModelCellValue(0, compLogical(ctx), 'abc', null, null);
        const items = ctx.wells[0].config.filter((c: any) => c.productId === 'krag-1000-250');
        expect(items.length).toBe(1);
        expect(items[0].quantity).toBe(2);
    });
});
