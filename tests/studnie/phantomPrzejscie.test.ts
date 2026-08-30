// @ts-nocheck
import fs from 'fs';
import path from 'path';
import vm from 'vm';

describe('phantom przejscie — Opcja A', () => {
    function createCtx() {
        const base = path.join(__dirname, '../../public/js/studnie');
        const ctx: any = {
            wells: [
                {
                    id: 'w0',
                    name: 'ss1',
                    dn: '1000',
                    rzednaWlazu: 10,
                    rzednaDna: 7,
                    config: [],
                    przejscia: [
                        {
                            id: 'p0',
                            productId: 'PVC-200',
                            rzednaWlaczenia: 7,
                            angle: 0,
                            tempCategory: 'PVC SN8',
                            displayIndex: 0
                        }
                    ]
                }
            ],
            studnieProducts: [
                {
                    id: 'PVC-200',
                    category: 'PVC SN8',
                    componentType: 'przejscie',
                    dn: '200',
                    name: 'PVC SN8 DN200'
                },
                {
                    id: 'GRP-300',
                    category: 'GRP',
                    componentType: 'przejscie',
                    dn: '300',
                    name: 'GRP DN300'
                }
            ],
            _excelActiveTab: '1000',
            _excelMaxTransitions: { '1000': 1, '1200': 1, styczne: 1 },
            _excelHiddenColumnIds: [],
            document: {
                getElementById: (id: string) => (id === 'excel-table-overlay' ? { id } : null),
                querySelectorAll: () => [],
                createElement: () => ({ style: {} }),
                body: {}
            },
            window: {},
            LAYERS: {},
            LAYERS_EXCEL: {},
            showToast: () => {},
            lucide: { createIcons: () => {} },
            escapeHtml: (s: string) => String(s),
            escapeHtmlAttr: (s: string) => String(s)
        };
        ctx.window = ctx;
        vm.createContext(ctx);
        ['excelState.js', 'excelHelpers.js', 'excelChangeHandlers.js', 'excelCopyPaste.js'].forEach(
            (f) => {
                const code = fs.readFileSync(path.join(base, f), 'utf8');
                vm.runInContext(code, ctx);
            }
        );
        vm.runInContext(
            `if(typeof Event==='undefined') globalThis.Event=class Event{constructor(t,o){this.type=t}}; if(typeof requestAnimationFrame==='undefined') globalThis.requestAnimationFrame=cb=>cb();`,
            ctx
        );
        ctx._excelIsWellLocked = () => false;
        return ctx;
    }
    function makeRow(wIdx: number, maxTr: number) {
        const row: any = {
            getAttribute: (a: string) => (a === 'data-widx' ? String(wIdx) : null),
            children: [],
            style: { display: '' }
        };
        for (let i = 0; i < 20; i++) {
            const td: any = { idx: i, parentElement: row };
            let target: any;
            const sub = (i - 7) % 4;
            const inTrans = i >= 7 && i < 7 + maxTr * 4;
            if (inTrans && sub === 2) {
                target = {
                    tagName: 'SELECT',
                    value: '',
                    _v: '',
                    options: [
                        { value: '', text: '—' },
                        { value: 'PVC SN8', text: 'PVC SN8' },
                        { value: 'GRP', text: 'GRP' }
                    ],
                    closest: (s: string) => (s === 'td' ? td : s === 'tr[data-widx]' ? row : null),
                    dispatchEvent: () => {}
                };
                Object.defineProperty(target, 'value', {
                    get() {
                        return this._v;
                    },
                    set(v) {
                        this._v = v;
                    },
                    configurable: true
                });
            } else if (inTrans && sub === 3) {
                target = {
                    tagName: 'SELECT',
                    value: '',
                    _v: '',
                    options: [
                        { value: '', text: '—' },
                        { value: 'PVC-200', text: 'DN200' }
                    ],
                    closest: (s: string) => (s === 'td' ? td : s === 'tr[data-widx]' ? row : null),
                    dispatchEvent: () => {}
                };
                Object.defineProperty(target, 'value', {
                    get() {
                        return this._v;
                    },
                    set(v) {
                        this._v = v;
                    },
                    configurable: true
                });
            } else {
                target = {
                    tagName: 'INPUT',
                    type: 'text',
                    value: '',
                    closest: (s: string) => (s === 'td' ? td : s === 'tr[data-widx]' ? row : null),
                    dispatchEvent: () => {}
                };
            }
            td.querySelector = () => target;
            row.children.push(td);
        }
        return row;
    }

    test('T30: wklejenie pustego Rodzaj na nieistniejacy trIdx nie tworzy phantom', () => {
        const ctx = createCtx();
        const row = makeRow(0, 2);
        const cache = ctx._excelBuildPasteCache();
        const beforeLen = ctx.wells[0].przejscia.length; // 1
        // trIdx 1 nie istnieje (length 1), val pusty -> nie tworzy
        ctx._excelSetCellValue(row.children[13].querySelector('input, select'), '', cache, 13);
        expect(ctx.wells[0].przejscia.length).toBe(beforeLen);
    });

    test('T31: wklejenie pustego Rodzaj na istniejacy trIdx czysci ale isEmpty=true', () => {
        const ctx = createCtx();
        vm.runInContext('_excelMaxTransitions["1000"]=2', ctx);
        // dodaj drugi przejscie tylko z kategoria (bez rzednej) - po wyczyszczeniu staje sie phantom
        ctx.wells[0].przejscia.push({
            id: 'p1',
            productId: 'GRP-300',
            rzednaWlaczenia: null,
            angle: 0,
            tempCategory: 'GRP',
            displayIndex: 1
        });
        const row = makeRow(0, 2);
        const cache = ctx._excelBuildPasteCache();
        ctx._excelSetCellValue(row.children[13].querySelector('input, select'), '', cache, 13);
        const p = ctx.wells[0].przejscia[1];
        expect(p.tempCategory).toBe('');
        expect(p.productId).toBe('');
        expect(ctx.isEmptyPrzejscie(p)).toBe(true);
    });

    test('isEmptyPrzejscie SSoT', () => {
        const ctx = createCtx();
        expect(
            ctx.isEmptyPrzejscie({
                productId: '',
                tempCategory: '',
                rzednaWlaczenia: null,
                angle: 0
            })
        ).toBe(true);
        expect(
            ctx.isEmptyPrzejscie({
                productId: '',
                tempCategory: '',
                rzednaWlaczenia: null,
                angle: 90
            })
        ).toBe(false);
        expect(
            ctx.isEmptyPrzejscie({
                productId: 'x',
                tempCategory: '',
                rzednaWlaczenia: null,
                angle: 0
            })
        ).toBe(false);
        expect(
            ctx.isEmptyPrzejscie({
                productId: '',
                tempCategory: 'GRP',
                rzednaWlaczenia: null,
                angle: 0
            })
        ).toBe(false);
        expect(
            ctx.isEmptyPrzejscie({ productId: '', tempCategory: '', rzednaWlaczenia: 7, angle: 0 })
        ).toBe(false);
        expect(ctx.isEmptyPrzejscie(null)).toBe(true);
    });

    test('wellTransitions filtruje puste w count', () => {
        // symulacja: wells z 2 valide + 1 phantom
        const wells = [
            {
                id: 'w0',
                name: 'ss1',
                dn: '1000',
                rzednaDna: 7,
                config: [],
                przejscia: [
                    {
                        id: 'a',
                        productId: 'PVC-200',
                        rzednaWlaczenia: 7,
                        angle: 0,
                        tempCategory: 'PVC SN8'
                    },
                    { id: 'b', productId: '', rzednaWlaczenia: null, angle: 0, tempCategory: '' }, // phantom
                    {
                        id: 'c',
                        productId: 'GRP-300',
                        rzednaWlaczenia: 8,
                        angle: 90,
                        tempCategory: 'GRP'
                    }
                ]
            }
        ];
        // isEmpty
        const isEmpty = (p: any) =>
            !p.productId &&
            !p.tempCategory &&
            (p.rzednaWlaczenia == null || String(p.rzednaWlaczenia).trim() === '') &&
            (!p.angle || Number(p.angle) === 0);
        const visible = wells[0].przejscia.filter((p: any) => !isEmpty(p));
        expect(visible.length).toBe(2);
        expect(wells[0].przejscia.length).toBe(3);
    });
});
