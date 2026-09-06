// @ts-nocheck
import fs from 'fs';
import path from 'path';
import vm from 'vm';

/* Bulk-paste anti-loss: snapshot pasteFiltered + rowMap + model-only wszystkich
 * kolumn + invariant applied+locked+unsupported===total. Wirtualizacja/filtr
 * nie gubi komórek, kolejność Rodzaj→Średnica zachowana (chunk 50 bez zmian). */
describe('excel bulk paste — brak gubienia komórek i kolejność (GO)', () => {
    function createCtx(wellsData: any[], products: any[], activeTab = '1000', maxTr = 1) {
        const base = path.join(__dirname, '../../public/js/studnie');
        const context: any = {
            wells: JSON.parse(JSON.stringify(wellsData)),
            studnieProducts: JSON.parse(JSON.stringify(products)),
            _excelActiveTab: activeTab,
            _excelMaxTransitions: {
                '1000': maxTr,
                '1200': 1,
                '1500': 1,
                '2000': 1,
                '2500': 1,
                styczne: 1
            },
            _excelHiddenColumnIds: [],
            _excelSelectedCells: [],
            _excelSelectedCols: [],
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
            'excelHelpers.js',
            'excelColumns.js',
            'excelReductionColumns.js',
            'excelChangeHandlers.js',
            'excelCopyPaste.js'
        ];
        for (const f of files) {
            vm.runInContext(fs.readFileSync(path.join(base, f), 'utf8'), context);
        }
        vm.runInContext(
            // Lekkie stubowanie ogona DOM (poza zakresem paste — model-only nie renderuje).
            'globalThis._excelMarkAsManual = function(wIdx){ var w=wells[wIdx]; if(!w) return; w.autoSelect=false; w.configSource="MANUAL"; w.autoLocked=true; };' +
                'globalThis._excelInsertConfigItem = function(well, ct, pid, qty){ well.config = well.config || []; well.config.push({ productId: pid, quantity: qty }); };' +
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
                id: 'prz-pvc-160',
                componentType: 'przejscie',
                dn: '160',
                category: 'PCV',
                name: 'PCV DN160'
            },
            {
                id: 'prz-pvc-200',
                componentType: 'przejscie',
                dn: '200',
                category: 'PCV',
                name: 'PCV DN200'
            },
            {
                id: 'prz-grp-160',
                componentType: 'przejscie',
                dn: '160',
                category: 'GRP',
                name: 'GRP DN160'
            },
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

    function makeWell(name: string, dn = '1000', maxTr = 1) {
        const przejscia: any[] = [];
        for (let i = 0; i < maxTr; i++)
            przejscia.push({
                rzednaWlaczenia: null,
                angle: 0,
                tempCategory: '',
                productId: '',
                angleExecution: 0,
                angleGony: '0.00',
                flowType: 'WYLOT',
                displayIndex: i
            });
        return {
            id: 'well-' + name,
            name,
            numer: name,
            dn: String(dn),
            magazyn: 'Kluczbork',
            config: [],
            przejscia,
            rzednaWlazu: 10,
            rzednaDna: 5,
            kineta: 'brak',
            psiaBuda: false
        };
    }

    function compLogical(ctx: any, componentType: string, height: number) {
        const all = ctx._excelBuildComponentColumns('1000', ctx.wells[0]);
        const idx = all.findIndex(
            (c: any) => c.componentType === componentType && parseInt(c.height) === height
        );
        expect(idx).toBeGreaterThanOrEqual(0);
        const prefixLen = ctx._excelGetComponentPrefixLen();
        return prefixLen + idx;
    }

    test('T1 300 wierszy × komponenty bez DOM — wszystko w modelu + invariant', () => {
        const wells = [];
        for (let i = 0; i < 300; i++) wells.push(makeWell('S' + i));
        const ctx = createCtx(wells, baseProducts());
        const logical = compLogical(ctx, 'krag', 250);
        const lines = [];
        for (let i = 0; i < 300; i++) lines.push('2');
        const cache = ctx._excelBuildPasteCache();
        cache.stats = ctx._excelPasteStatsNew();
        const snapshot = ctx._excelSnapshotFiltered();
        expect(snapshot.length).toBe(300);
        // visibleRows puste (wirtualizacja wyrenderowała 0 TR) — model-only, zero strat
        ctx._excelPasteSync(lines, [], logical, cache, snapshot);
        const st = cache.stats;
        expect(st.total).toBe(300);
        expect(st.applied + st.locked + st.unsupported).toBe(st.total);
        expect(st.applied).toBe(300);
        // parity: każda studnia ma Krąg H=250 ×2
        for (let i = 0; i < 300; i++) {
            const items = ctx.wells[i].config.filter((c: any) => c.productId === 'krag-1000-250');
            expect(items.length).toBe(1);
            expect(items[0].quantity).toBe(2);
        }
    });

    test('T2 filtr/virtual rozjazd — zapis do modelWIdx, nie pozycji DOM', () => {
        const ctx = createCtx([makeWell('S0'), makeWell('S1'), makeWell('S2')], baseProducts());
        // Stale DOM: jeden wiersz z obcym data-widx (np. po filtrze/wirtualizacji)
        const staleRow: any = {
            getAttribute: () => '9',
            children: [],
            style: { display: '' }
        };
        const cache = ctx._excelBuildPasteCache();
        cache.stats = ctx._excelPasteStatsNew();
        // snapshot jak po filtrze: tylko studnie 1,2 (kolejność modelu, nie DOM)
        ctx._excelPasteSync(['PCV', 'GRP'], [staleRow], 9, cache, [1, 2]);
        expect(ctx.wells[1].przejscia[0].tempCategory).toBe('PCV');
        expect(ctx.wells[2].przejscia[0].tempCategory).toBe('GRP');
        expect(ctx.wells[0].przejscia[0].tempCategory).toBe('');
        const st = cache.stats;
        expect(st.applied + st.locked + st.unsupported).toBe(st.total);
        expect(st.applied).toBe(2);
    });

    test('T3 Rodzaj→Średnica w wierszu — kolejność i remap zachowane', () => {
        const ctx = createCtx([makeWell('S0'), makeWell('S1')], baseProducts());
        const cache = ctx._excelBuildPasteCache();
        cache.stats = ctx._excelPasteStatsNew();
        const snapshot = ctx._excelSnapshotFiltered();
        // Dwie kolumny w wierszu: Rodzaj(9) przed Średnicą(10) — Średnica widzi nową kategorię
        ctx._excelPasteSync(['PCV\t160', 'GRP\t160'], [], 9, cache, snapshot);
        expect(ctx.wells[0].przejscia[0].tempCategory).toBe('PCV');
        expect(ctx.wells[0].przejscia[0].productId).toBe('prz-pvc-160');
        expect(ctx.wells[1].przejscia[0].tempCategory).toBe('GRP');
        expect(ctx.wells[1].przejscia[0].productId).toBe('prz-grp-160');
        const st = cache.stats;
        expect(st.total).toBe(4);
        expect(st.applied).toBe(4);
        expect(st.applied + st.locked + st.unsupported).toBe(st.total);
    });

    test('T4 locked + brak TR — liczniki, zero cichych continue', () => {
        const ctx = createCtx([makeWell('S0'), makeWell('S1'), makeWell('S2')], baseProducts());
        ctx._excelIsWellLocked = (wIdx: number) => wIdx === 1;
        const cache = ctx._excelBuildPasteCache();
        cache.stats = ctx._excelPasteStatsNew();
        const snapshot = ctx._excelSnapshotFiltered();
        ctx._excelPasteSync(['PCV', 'GRP', 'PCV'], [], 9, cache, snapshot);
        const st = cache.stats;
        expect(st.total).toBe(3);
        expect(st.locked).toBe(1);
        expect(st.applied).toBe(2);
        expect(st.applied + st.locked + st.unsupported).toBe(st.total);
        // parity: zablokowana studnia nietknięta
        expect(ctx.wells[0].przejscia[0].tempCategory).toBe('PCV');
        expect(ctx.wells[1].przejscia[0].tempCategory).toBe('');
        expect(ctx.wells[2].przejscia[0].tempCategory).toBe('PCV');
    });

    test('T5 wrong-row guard — DOM w innej kolejności niż filtered, zapis do modelWIdx', () => {
        const ctx = createCtx([makeWell('S0'), makeWell('S1'), makeWell('S2')], baseProducts());
        // Wiersz z działającym targetem związanym z WŁASNĄ studnią (closest → row).
        // Stary kod (pozycyjny visibleRows[idx]) pisałby do studni z DOM, nie ze snapshotu.
        const mkRowWithTarget = (wIdx: number) => {
            const row: any = {
                getAttribute: (a: string) => (a === 'data-widx' ? String(wIdx) : null),
                children: [] as any[],
                style: { display: '' }
            };
            for (let i = 0; i < 20; i++) {
                const td: any = { idx: i, style: {}, parentElement: row };
                const target: any = {
                    tagName: 'SELECT',
                    _val: '',
                    options: [
                        { value: '', text: '—' },
                        { value: 'PCV', text: 'PCV' },
                        { value: 'GRP', text: 'GRP' }
                    ],
                    selectedIndex: 0,
                    dispatchEvent: () => {},
                    closest: (sel: string) =>
                        sel === 'td' ? td : sel === 'tr[data-widx]' ? row : null
                };
                Object.defineProperty(target, 'value', {
                    get() {
                        return this._val || '';
                    },
                    set(v: string) {
                        this._val = v;
                        const idx = this.options.findIndex(
                            (o: any) => o.value === v || o.text === v
                        );
                        this.selectedIndex = idx >= 0 ? idx : 0;
                    },
                    configurable: true
                });
                td.querySelector = () => target;
                td._target = target;
                row.children.push(td);
            }
            return row;
        };
        // DOM tasowany: pozycja 1 i 2 zamienione względem snapshotu [0,1,2].
        const rowsShuffled = [mkRowWithTarget(0), mkRowWithTarget(2), mkRowWithTarget(1)];
        const cache = ctx._excelBuildPasteCache();
        cache.stats = ctx._excelPasteStatsNew();
        vm.runInContext('_excelPasteMismatches = []', ctx);
        const snapshot = ctx._excelSnapshotFiltered();
        expect(snapshot).toEqual([0, 1, 2]);
        ctx._excelPasteSync(['PCV', 'GRP', 'PCV'], rowsShuffled, 9, cache, snapshot);
        // parity: wartości trafiły do studni ze snapshotu (model-only po weryfikacji)…
        expect(ctx.wells[0].przejscia[0].tempCategory).toBe('PCV');
        expect(ctx.wells[1].przejscia[0].tempCategory).toBe('GRP');
        expect(ctx.wells[2].przejscia[0].tempCategory).toBe('PCV');
        // …a nie do studni wskazywanych pozycyjnie przez DOM (stary błąd).
        // Fast-path nie dotyka DOM (zapis wprost do modelu) — wszystkie targety puste.
        expect(rowsShuffled[0].children[9]._target.value).toBe('');
        expect(rowsShuffled[1].children[9]._target.value).toBe('');
        expect(rowsShuffled[2].children[9]._target.value).toBe('');
        // partycja: applied + locked + unsupported === total, mismatches poza partycją
        const st = cache.stats;
        expect(st.total).toBe(3);
        expect(st.applied + st.locked + st.unsupported).toBe(st.total);
        expect(st.applied).toBe(3);
        const mism = vm.runInContext('_excelPasteMismatches', ctx);
        expect((Array.isArray(mism) ? mism.length : 0) <= st.applied).toBe(true);
    });

    test('T6 partycja domknięta — wiersz poza snapshotem i kolumna bez mapy liczone', () => {
        const ctx = createCtx([makeWell('S0')], baseProducts());
        const cache = ctx._excelBuildPasteCache();
        cache.stats = ctx._excelPasteStatsNew();
        // Snapshot krótszy niż lines: si=1,2 poza zakresem → 2× unsupported, nie ciche continue.
        ctx._excelPasteSync(['PCV', 'GRP', 'PCV'], [], 9, cache, [0]);
        const st = cache.stats;
        expect(st.total).toBe(3);
        expect(st.applied).toBe(1);
        expect(st.unsupported).toBe(2);
        expect(st.applied + st.locked + st.unsupported).toBe(st.total);
        expect(ctx.wells[0].przejscia[0].tempCategory).toBe('PCV');
        // Kolumna nagłówka bez mapowania semantycznego → unsupported, nie strata.
        const cache2 = ctx._excelBuildPasteCache();
        cache2.stats = ctx._excelPasteStatsNew();
        const snap2 = ctx._excelSnapshotFiltered();
        ctx._excelPasteSemantic(['a\tb'], [], { 0: 9 }, cache2, snap2);
        const st2 = cache2.stats;
        expect(st2.total).toBe(2);
        expect(st2.applied).toBe(1);
        expect(st2.unsupported).toBe(1);
        expect(st2.applied + st2.locked + st2.unsupported).toBe(st2.total);
    });
});
