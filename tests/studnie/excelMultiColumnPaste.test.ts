// @ts-nocheck
import fs from 'fs';
import path from 'path';
import vm from 'vm';

describe('excel multi-column paste — visible semantics (A) with hidden columns', () => {
    let ctx: any;

    beforeAll(() => {
        const base = path.join(__dirname, '../../public/js/studnie');
        const context: any = {
            wells: [],
            studnieProducts: [],
            _excelActiveTab: '1000',
            _excelMaxTransitions: { '1000': 1 },
            _excelHiddenColumnIds: [],
            document: {
                querySelectorAll: () => [],
                getElementById: () => null
            },
            window: {},
            LAYERS: { TOAST: 1000 },
            LAYERS_EXCEL: { RESIZE_HANDLE: 5, STICKY_COLUMN: 5, STICKY_HEADER_TH: 10 },
            logger: { info: () => {}, warn: () => {}, error: () => {} },
            escapeHtml: (s: string) => String(s),
            escapeHtmlAttr: (s: string) => String(s),
            showToast: () => {}
        };
        context.window = context;
        vm.createContext(context);
        const files = [
            'excelState.js',
            'excelHelpers.js',
            'excelColumns.js',
            'excelReductionColumns.js',
            'excelCopyPaste.js'
        ];
        for (const f of files) {
            const code = fs.readFileSync(path.join(base, f), 'utf8');
            vm.runInContext(code, context);
        }
        // Setter for let _excelHiddenColumnIds (vm let not on context object)
        vm.runInContext(
            'globalThis._excelTestSetHidden = function(list){ _excelHiddenColumnIds = list; };',
            context
        );
        vm.runInContext(
            'globalThis._excelTestSetActiveTab = function(t){ _excelActiveTab = t; };',
            context
        );
        vm.runInContext(
            'globalThis._excelTestSetMaxTr = function(m){ _excelMaxTransitions = m; };',
            context
        );
        ctx = context;
    });

    function makeRow(visibleCount: number, prefixLen = 14) {
        // prefixLen = 10+maxTr*4 with maxTr=1 => 14 (7 +4 +2 +1)
        // visibleCount = number of visible component tds after prefix
        const totalVisible = prefixLen + visibleCount + 5; // + Hdenn,Uszcz, Kineta, Pbuda, Akcje minimal
        const children: any[] = [];
        for (let i = 0; i < totalVisible; i++) {
            const td: any = {
                idx: i,
                input: { value: '', tagName: 'INPUT', type: 'text' },
                querySelector: function (sel: string) {
                    // only inputs for component area, gap columns have no input
                    // gap at 11,12 are empty
                    if (i === 11 || i === 12) return null;
                    return this.input;
                }
            };
            children.push(td);
        }
        return {
            children,
            getAttribute: () => '0'
        };
    }

    test('bez ukrytych: _excelGetVisibleCell i _excelGetCellByLogical zgodne', () => {
        ctx._excelTestSetHidden([]);
        ctx._excelTestSetActiveTab('1000');
        ctx._excelTestSetMaxTr({ '1000': 1 });
        const row: any = makeRow(3);
        // prefixLen 14, fixed columns <14 direct
        expect(ctx._excelGetVisibleCell(row, 7)).toBe(row.children[7]);
        expect(ctx._excelGetCellByLogical(row, 7)).toBe(row.children[7]);
        expect(ctx._excelGetCellByLogical(row, 14)).toBe(row.children[14]);
        expect(ctx._excelGetCellByLogical(row, 16)).toBe(row.children[16]);
    });

    test('z ukrytą środkową kolumną komponentu: logical hidden => null, następna logical mapuje na next visible (semantyka A)', () => {
        // Build real component columns for DN1000 to get correct ids
        // Need studnieProducts with at least 3 krag heights to generate ids
        ctx.studnieProducts = [
            {
                id: 'krag-1000-250',
                componentType: 'krag',
                dn: '1000',
                height: 250,
                name: 'Krąg 250'
            },
            {
                id: 'krag-1000-500',
                componentType: 'krag',
                dn: '1000',
                height: 500,
                name: 'Krąg 500'
            },
            {
                id: 'krag-1000-1000',
                componentType: 'krag',
                dn: '1000',
                height: 1000,
                name: 'Krąg 1000'
            }
        ];
        ctx.wells = [
            {
                dn: '1000',
                magazyn: 'Kluczbork',
                nadbudowa: 'betonowa',
                dennicaMaterial: 'betonowa',
                wkladkaZwienczenie: 'brak',
                wkladkaOsadnikPreco: 'brak',
                uszczelka: 'GSG',
                spocznik: 'brak',
                stopnie: 'brak',
                kineta: 'brak'
            }
        ];
        ctx._excelTestSetActiveTab('1000');
        ctx._excelTestSetMaxTr({ '1000': 1 });
        const all = ctx._excelBuildComponentColumns('1000', ctx.wells[0]);
        // pick middle comp id to hide (second)
        const toHide = all.length >= 2 ? all[1].id : all[0].id;
        ctx._excelTestSetHidden([toHide]);

        const visible = ctx._excelFilterVisibleColumns(all);
        const prefixLen = ctx._excelGetComponentPrefixLen();
        // Row has only visible comps
        const row: any = makeRow(visible.length, prefixLen);
        // Mark inputs with identifiable values for later
        for (let i = 0; i < row.children.length; i++) row.children[i].input.value = 'c' + i;

        // logical for hidden should be null
        const hiddenLogicalIdx = prefixLen + 1; // second comp logical
        expect(ctx._excelGetCellByLogical(row, hiddenLogicalIdx)).toBeNull();

        // next logical (third comp) should map to visible index prefixLen+1 (since one hidden)
        const nextLogicalIdx = prefixLen + 2;
        const cell = ctx._excelGetCellByLogical(row, nextLogicalIdx);
        expect(cell).toBe(row.children[prefixLen + 1]);

        // positional paste semantics A: start at first visible comp, offset 0,1,2 -> visible sequential
        // Simulate _excelPasteSync with values a,b,c from startVisible = prefixLen
        const startVisible = prefixLen;
        const vals = ['a', 'b', 'c'];
        const captured: string[] = [];
        const origSet = ctx._excelSetCellValue;
        // mock _excelSetCellValue to capture
        const calls: any[] = [];
        ctx._excelSetCellValue = (target: any, v: string) => {
            calls.push({ target, v });
            target.value = v;
        };
        const fakeRows = [row];
        // Use helper directly
        for (let ci = 0; ci < vals.length; ci++) {
            const tdEl = ctx._excelGetVisibleCell(row, startVisible + ci);
            const target = tdEl ? tdEl.querySelector('input, select') : null;
            if (target) ctx._excelSetCellValue(target, vals[ci]);
        }
        expect(calls.length).toBe(3);
        expect(calls[0].v).toBe('a');
        expect(calls[1].v).toBe('b');
        expect(calls[2].v).toBe('c');
        // No silent misalignment: values went to visible cells, hidden skipped
        ctx._excelSetCellValue = origSet;
        ctx._excelTestSetHidden([]);
    });

    test('_excelPasteSync visible sequential with hidden: no misalignment', () => {
        ctx.studnieProducts = [
            {
                id: 'krag-1000-250',
                componentType: 'krag',
                dn: '1000',
                height: 250,
                name: 'Krąg 250'
            },
            {
                id: 'krag-1000-500',
                componentType: 'krag',
                dn: '1000',
                height: 500,
                name: 'Krąg 500'
            },
            {
                id: 'krag-1000-1000',
                componentType: 'krag',
                dn: '1000',
                height: 1000,
                name: 'Krąg 1000'
            }
        ];
        ctx.wells = [
            {
                dn: '1000',
                magazyn: 'Kluczbork',
                nadbudowa: 'betonowa',
                dennicaMaterial: 'betonowa',
                wkladkaZwienczenie: 'brak',
                wkladkaOsadnikPreco: 'brak',
                uszczelka: 'GSG',
                spocznik: 'brak',
                stopnie: 'brak',
                kineta: 'brak'
            }
        ];
        ctx._excelTestSetActiveTab('1000');
        ctx._excelTestSetMaxTr({ '1000': 1 });
        const all = ctx._excelBuildComponentColumns('1000', ctx.wells[0]);
        const hiddenId = all[0].id;
        ctx._excelTestSetHidden([hiddenId]);
        const visible = ctx._excelFilterVisibleColumns(all);
        const prefixLen = ctx._excelGetComponentPrefixLen();
        const row: any = {
            children: [] as any[]
        };
        const totalVisible = prefixLen + visible.length + 5;
        for (let i = 0; i < totalVisible; i++) {
            row.children.push({
                querySelector: (sel: string) => ({
                    value: '',
                    tagName: 'INPUT',
                    closest: () => ({ getAttribute: () => '0' })
                })
            });
        }
        // Mock _excelIsWellLocked and _excelSetCellValue
        const savedLock = ctx._excelIsWellLocked;
        ctx._excelIsWellLocked = () => false;
        const written: string[] = [];
        const orig = ctx._excelSetCellValue;
        ctx._excelSetCellValue = (t: any, v: string) => {
            written.push(v);
            t.value = v;
        };
        // Paste 3 values starting at first visible comp (prefixLen)
        ctx._excelPasteSync(['x\ty\tz'], [row], prefixLen);
        expect(written).toEqual(['x', 'y', 'z']);
        ctx._excelSetCellValue = orig;
        ctx._excelIsWellLocked = savedLock;
        ctx._excelTestSetHidden([]);
    });

    test('przejście 4 kolumny 2x4: Rz.wlot (10,5 comma), Kąt, Rodzaj, Średnica — kolejność 7,8,9,10, brak shift', () => {
        ctx._excelTestSetHidden([]);
        ctx._excelTestSetActiveTab('1000');
        ctx._excelTestSetMaxTr({ '1000': 1 });
        // wells 2 sztuki, DN1000
        ctx.wells = [
            {
                dn: '1000',
                magazyn: 'Kluczbork',
                nadbudowa: 'betonowa',
                dennicaMaterial: 'betonowa',
                wkladkaZwienczenie: 'brak',
                wkladkaOsadnikPreco: 'brak',
                uszczelka: 'GSG',
                spocznik: 'brak',
                stopnie: 'brak',
                kineta: 'brak',
                config: [],
                przejscia: [{ rzednaWlaczenia: null, angle: 0, tempCategory: '', productId: '' }],
                rzednaWlazu: 5,
                rzednaDna: 1
            },
            {
                dn: '1000',
                magazyn: 'Kluczbork',
                nadbudowa: 'betonowa',
                dennicaMaterial: 'betonowa',
                wkladkaZwienczenie: 'brak',
                wkladkaOsadnikPreco: 'brak',
                uszczelka: 'GSG',
                spocznik: 'brak',
                stopnie: 'brak',
                kineta: 'brak',
                config: [],
                przejscia: [{ rzednaWlaczenia: null, angle: 0, tempCategory: '', productId: '' }],
                rzednaWlazu: 5,
                rzednaDna: 1
            }
        ];
        ctx.studnieProducts = [
            {
                id: 'prz-pvc-160',
                componentType: 'przejscie',
                dn: '160',
                category: 'PCV',
                name: 'Przejście PCV DN160'
            },
            {
                id: 'prz-pvc-200',
                componentType: 'przejscie',
                dn: '200',
                category: 'PCV',
                name: 'Przejście PCV DN200'
            }
        ];
        // Event stub dla dispatchEvent
        vm.runInContext(
            'if(typeof Event==="undefined") globalThis.Event = class Event { constructor(t,o){this.type=t; this.bubbles=o&&o.bubbles;}}',
            ctx
        );
        // Mock _excelIsWellLocked false
        const savedLock = ctx._excelIsWellLocked;
        ctx._excelIsWellLocked = () => false;
        // Helper do budowy wiersza z przejściami 7-10
        function makeTransRow(wIdx: number) {
            const total = 20;
            const row: any = {
                getAttribute: (a: string) => (a === 'data-widx' ? String(wIdx) : null),
                children: [] as any[],
                style: { display: '' }
            };
            for (let i = 0; i < total; i++) {
                const td: any = { idx: i, style: {} };
                let target: any;
                if (i === 7) {
                    // Rz.wlot — INPUT number
                    target = {
                        tagName: 'INPUT',
                        type: 'number',
                        value: '',
                        dispatchEvent: () => {},
                        closest: (sel: string) => {
                            if (sel === 'td') return td;
                            if (sel === 'tr[data-widx]') return row;
                            return null;
                        }
                    };
                } else if (i === 8) {
                    // Kąt — INPUT number
                    target = {
                        tagName: 'INPUT',
                        type: 'number',
                        value: '',
                        dispatchEvent: () => {},
                        closest: (sel: string) => {
                            if (sel === 'td') return td;
                            if (sel === 'tr[data-widx]') return row;
                            return null;
                        }
                    };
                } else if (i === 9) {
                    // Rodzaj — SELECT
                    target = {
                        tagName: 'SELECT',
                        value: '',
                        options: [
                            { value: '', text: '—' },
                            { value: 'PCV', text: 'PCV' },
                            { value: 'BETON', text: 'BETON' }
                        ],
                        selectedIndex: 0,
                        dispatchEvent: () => {},
                        closest: (sel: string) => {
                            if (sel === 'td') return td;
                            if (sel === 'tr[data-widx]') return row;
                            return null;
                        }
                    };
                    // selectedIndex sync helper
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
                } else if (i === 10) {
                    // Średnica — SELECT
                    target = {
                        tagName: 'SELECT',
                        value: '',
                        options: [
                            { value: '', text: '—' },
                            { value: 'prz-pvc-160', text: 'DN 160' },
                            { value: 'prz-pvc-200', text: 'DN 200' }
                        ],
                        selectedIndex: 0,
                        dispatchEvent: () => {},
                        closest: (sel: string) => {
                            if (sel === 'td') return td;
                            if (sel === 'tr[data-widx]') return row;
                            return null;
                        }
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
                } else {
                    // pozostałe — INPUT text z no-op
                    target = {
                        tagName: 'INPUT',
                        type: 'text',
                        value: '',
                        dispatchEvent: () => {},
                        closest: (sel: string) => {
                            if (sel === 'td') return td;
                            if (sel === 'tr[data-widx]') return row;
                            return null;
                        }
                    };
                }
                td.querySelector = () => target;
                td.parentElement = row;
                // expose for assertion
                (td as any)._target = target;
                row.children.push(td);
            }
            return row;
        }
        const row0 = makeTransRow(0);
        const row1 = makeTransRow(1);
        // Capture mismatches — should stay empty for exact matches
        const prevMismatches = ctx._excelPasteMismatches || [];
        vm.runInContext('_excelPasteMismatches = []', ctx);
        // Paste 2x4 od col 7
        ctx._excelPasteSync(['10,5\t45\tPCV\tDN 160', '11,2\t90\tPCV\tDN 200'], [row0, row1], 7);
        // Rz.wlot normalizacja 10,5 -> 10.5 (type number)
        expect((row0.children[7] as any)._target.value).toBe('10.5');
        expect((row1.children[7] as any)._target.value).toBe('11.2');
        // Kąt
        expect((row0.children[8] as any)._target.value).toBe('45');
        expect((row1.children[8] as any)._target.value).toBe('90');
        // Rodzaj
        expect((row0.children[9] as any)._target.value).toBe('PCV');
        expect((row1.children[9] as any)._target.value).toBe('PCV');
        // Średnica — po tekście DN 160/200 mapuje na id
        expect((row0.children[10] as any)._target.value).toBe('prz-pvc-160');
        expect((row1.children[10] as any)._target.value).toBe('prz-pvc-200');
        // Brak mismatch dla dokładnych dopasowań
        const mism = vm.runInContext('_excelPasteMismatches', ctx);
        expect(Array.isArray(mism) ? mism.length : 0).toBe(0);
        ctx._excelIsWellLocked = savedLock;
        ctx._excelTestSetHidden([]);
    });
});
