// @ts-nocheck
// RED: paste ceny/produktu z ulamkiem do ilosci cicho obcina parseInt (utrata danych).
// Wzor: excelPasteBulk.test.ts. Oczekiwany RED: '2,5' -> 2 zamiast 2.5/odrzucenia,
// '123,45 PLN' -> 123 zamiast unsupported.
import fs from 'fs';
import path from 'path';
import vm from 'vm';
describe('excel paste product price - ulamek do qty (RED)', () => {
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
    function emptyWell() {
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
    function compLogical(ctx: any) {
        const all = ctx._excelBuildComponentColumns('1000', ctx.wells[0]);
        const idx = all.findIndex(
            (c: any) => c.componentType === 'krag' && parseInt(c.height) === 250
        );
        expect(idx).toBeGreaterThanOrEqual(0);
        return ctx._excelGetComponentPrefixLen() + idx;
    }
    function qtyOf(ctx: any) {
        const items = ctx.wells[0].config.filter((c: any) => c.productId === 'krag-1000-250');
        return items.length ? items[0].quantity : null;
    }
    test('T1 "2" wstawia 2 (kontrakt zielony)', () => {
        const ctx = createCtx([emptyWell()], baseProducts());
        ctx._excelSetModelCellValue(0, compLogical(ctx), '2', null, null);
        expect(qtyOf(ctx)).toBe(2);
    });
    test('T2 "2,5" nie obcina do 2 (RED: HEAD daje 2)', () => {
        const ctx = createCtx([emptyWell()], baseProducts());
        ctx._excelSetModelCellValue(0, compLogical(ctx), '2,5', null, null);
        expect(qtyOf(ctx)).not.toBe(2);
    });
    test('T3 "123,45 PLN" to unsupported, config pusty (RED: HEAD daje 123)', () => {
        const ctx = createCtx([emptyWell()], baseProducts());
        const st = ctx._excelSetModelCellValue(0, compLogical(ctx), '123,45 PLN', null, null);
        expect(ctx.wells[0].config.length).toBe(0);
        expect(st).toBe('unsupported');
    });
});
