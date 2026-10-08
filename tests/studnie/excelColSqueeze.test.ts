// @ts-nocheck -- vm sandbox, celowy brak typow dla public/js
import fs from 'fs';
import path from 'path';
import vm from 'vm';

function readJs(name: string): string {
    return fs.readFileSync(path.join(__dirname, '../../public/js/studnie', name), 'utf8');
}

function readCss(): string {
    return fs.readFileSync(path.join(__dirname, '../../public/css/studnie.css'), 'utf8');
}

describe('excelColSqueeze scisk do 10px', () => {
    test('floor 10px (dowolny scisk)', () => {
        const ctx: any = { window: {}, localStorage: { getItem: () => null, setItem: () => {} } };
        vm.createContext(ctx);
        vm.runInContext(readJs('excelState.js'), ctx);
        expect(vm.runInContext('_excelColMinWidth()', ctx)).toBe(10);
    });

    test('resize i apply uzywaja helpera', () => {
        expect(readJs('excelColumnResize.js')).toContain('_excelColMinWidth()');
        expect(readJs('excelColumnResize.js')).not.toContain('Math.max(30');
        expect(readJs('excelTableRenderer.js')).toContain('_excelColMinWidth()');
        expect(readJs('excelTableRenderer.js')).not.toContain('w < 30');
    });

    test('H3 podaza za resizem (colspan-aware)', () => {
        const ctx: any = { window: {} };
        vm.createContext(ctx);
        vm.runInContext(readJs('excelTableRenderer.js'), ctx);
        const mk = (span: number) => ({ style: {} as Record<string, string>, colSpan: span });
        // h3: [sel x1][PRZ-grupa x4][wlaz x1] — indeksy kanoniczne 0..5
        ctx.h3ths = [mk(1), mk(4), mk(1)];
        const single = vm.runInContext('_excelH3CellForCol(h3ths, 0)', ctx);
        expect(single.span).toBe(1);
        const grouped = vm.runInContext('_excelH3CellForCol(h3ths, 2)', ctx);
        expect(grouped.span).toBe(4);
        // single dostaje wymiar + twardy klin, grupa minWidth 0
        vm.runInContext('_excelApplyWidthToH3(h3ths, 0, 10)', ctx);
        expect(ctx.h3ths[0].style.minWidth).toBe('10px');
        expect(ctx.h3ths[0].style.maxWidth).toBe('10px');
        vm.runInContext('_excelApplyWidthToH3(h3ths, 3, 10)', ctx);
        expect(ctx.h3ths[1].style.minWidth).toBe('0px');
    });

    test('tekst zawsze wysrodkowany, td obcina nadmiar', () => {
        const css = readCss();
        expect(css).toMatch(/#excel-table-container td[\s\S]*?text-align:\s*center/);
        expect(css).toMatch(/#excel-table-container td[\s\S]*?overflow:\s*hidden/);
        expect(css).toMatch(/\.excel-sel-wrap > div[\s\S]*?justify-content:\s*center/);
    });

    test('naglowki nie zawijaja (ellipsis)', () => {
        const src = readJs('excelTableRenderer.js');
        expect(src).not.toContain('pre-wrap');
        expect(src).toContain('text-overflow:ellipsis');
        expect(readCss()).toMatch(/thead th[\s\S]*?overflow:\s*hidden/);
    });

    test('select-wrap bez twardego min-width', () => {
        expect(readJs('excelHelpers.js')).not.toContain('min-width:40px');
    });

    test('przycisk Dopasuj kolumny na toolbarze + reset dragow', () => {
        expect(readJs('excelModal.js')).toContain('_excelAutofitAllColumns');
        expect(readJs('excelModal.js')).toContain('Dopasuj kolumny');
        expect(readJs('excelModal.js')).toContain('data-lucide="sliders-horizontal"');
        const ctx: any = {
            window: {},
            localStorage: { getItem: () => null, setItem: () => {}, removeItem: () => {} },
            saved: false,
            rendered: ''
        };
        vm.createContext(ctx);
        vm.runInContext(readJs('excelState.js'), ctx);
        vm.runInContext(readJs('excelColumnResize.js'), ctx);
        vm.runInContext("_excelColWidths['1000-a'] = 10", ctx);
        vm.runInContext("_excelColWidths['1200-b'] = 10", ctx);
        vm.runInContext('_excelAutoFittedWidths["1000-c"] = 50', ctx);
        ctx._excelSaveColWidths = function () {
            ctx.saved = true;
        };
        ctx._excelRenderTable = function (dn: string) {
            ctx.rendered = dn;
        };
        vm.runInContext('_excelAutofitAllColumns()', ctx);
        // aktywna zakladka domyslnie 1000 — jej klucze znikaja, obce zostaja
        expect(vm.runInContext("Object.keys(_excelColWidths).join(',')", ctx)).toBe('1200-b');
        expect(vm.runInContext('Object.keys(_excelAutoFittedWidths).length', ctx)).toBe(0);
        expect(ctx.saved).toBe(true);
        expect(ctx.rendered).toBe('1000');
    });

    test('autofit mierzy tekst (canvas), nie scrollWidth zywych komorek', () => {
        expect(readJs('excelTableRenderer.js')).toContain('_excelAutoFitColumns(dn)');
        expect(readJs('excelTableRenderer.js')).toContain('_excelMeasureTextWidth');
        expect(readJs('excelTableRenderer.js')).toContain('_excelCellText');
        expect(readJs('excelTableRenderer.js')).toContain('_excelAutoFittedWidths');
        expect(readJs('excelColumnResize.js')).toContain('dblclick');
    });

    test('naglowek H3 w kilku liniach mierzony per linia (nie sklejony)', () => {
        const measure = (t: string) => ({ width: String(t).length * 7 });
        const ctx: any = {
            window: {},
            document: {
                createElement: () => ({ getContext: () => ({ font: '', measureText: measure }) })
            }
        };
        vm.createContext(ctx);
        vm.runInContext(readJs('excelTableRenderer.js'), ctx);
        ctx.el = {
            childNodes: [
                { nodeType: 1, tagName: 'DIV', textContent: 'DN1200' },
                { nodeType: 1, tagName: 'DIV', textContent: 'JZW-12-625-D' },
                { nodeType: 1, tagName: 'DIV', textContent: '950 PLN' }
            ]
        };
        // max linii: 'JZW-12-625-D' = 12 znakow * 7 = 84 (sklejone byloby 168+)
        expect(vm.runInContext('_excelStackedMaxWidth(el, "")', ctx)).toBe(84);
        ctx.el2 = { textContent: 'KRAG' };
        expect(vm.runInContext('_excelStackedMaxWidth(el2, "")', ctx)).toBe(28);
    });

    test('autofit kolumny produktowej bierze najdluzsza linie H3', () => {
        const measure = (t: string) => ({ width: String(t).length * 7 });
        const styleOf = () => ({});
        const mkTh = (text: string, colId: string, kids?: any[]) => ({
            textContent: text,
            childNodes: kids,
            getAttribute: (a: string) => (a === 'data-excel-col' ? colId : null),
            style: styleOf(),
            colSpan: 1
        });
        const line = (t: string) => ({ nodeType: 1, tagName: 'DIV', textContent: t });
        const h1 = [mkTh('KRAG', 'krag')];
        const h3 = [
            mkTh('DN1200JZW-12-625-D950 PLN', 'krag', [
                line('DN1200'),
                line('JZW-12-625-D'),
                line('950 PLN')
            ])
        ];
        const bodyRow = {
            children: [
                {
                    querySelector: () => null,
                    textContent: '500',
                    style: styleOf()
                }
            ]
        };
        const tbl = {
            querySelectorAll: (sel: string) => {
                if (sel === 'thead tr')
                    return [{ querySelectorAll: () => h3 }, { querySelectorAll: () => h1 }];
                if (sel === 'tbody tr[data-widx]') return [bodyRow];
                if (sel === 'tbody tr') return [bodyRow];
                return [];
            },
            querySelector: () => null
        };
        const ctx: any = {
            window: {
                getComputedStyle: () => ({
                    font: '11px Inter',
                    paddingLeft: '4px',
                    paddingRight: '4px'
                })
            },
            document: {
                getElementById: (id: string) =>
                    id === 'excel-table-container' ? { querySelector: () => tbl } : null,
                createElement: () => ({ getContext: () => ({ font: '', measureText: measure }) })
            },
            _excelColWidths: {},
            _excelColWidthKey: (t: string, c: string) => t + '-' + c,
            _excelColMinWidth: () => 10
        };
        vm.createContext(ctx);
        vm.runInContext(readJs('excelTableRenderer.js'), ctx);
        vm.runInContext("_excelAutoFitColumns('1000')", ctx);
        // 'JZW-12-625-D' = 12 * 7 = 84 + padX 8 + oddech 2 = 94
        expect(h1[0].style.width).toBe('94px');
    });

    test('autofit zwija kolumne do tekstu + luz (nie do szerokosci inputa)', () => {
        const measure = (t: string) => ({ width: String(t).length * 7 });
        const styleOf = () => ({});
        const mkTh = (text: string, colId: string) => ({
            textContent: text,
            getAttribute: (a: string) => (a === 'data-excel-col' ? colId : null),
            style: styleOf(),
            colSpan: 1
        });
        const h1 = [mkTh('RZ. WLOT 1', 'wlaz')];
        const h3 = [mkTh('WLAZ', 'wlaz')];
        const mkCell = (value: string) => ({
            // input BEZ scrollWidth — stary pomiar nie mialby sie do czego przyssac
            querySelector: (s: string) => (s === 'input' ? { value } : null),
            textContent: '',
            style: styleOf()
        });
        const bodyRow = { children: [mkCell('5')] };
        const tbl = {
            querySelectorAll: (sel: string) => {
                if (sel === 'thead tr')
                    return [{ querySelectorAll: () => h3 }, { querySelectorAll: () => h1 }];
                if (sel === 'tbody tr[data-widx]') return [bodyRow];
                if (sel === 'tbody tr') return [bodyRow];
                return [];
            },
            querySelector: () => null
        };
        const ctx: any = {
            window: {
                getComputedStyle: () => ({
                    font: '11px Inter',
                    paddingLeft: '4px',
                    paddingRight: '4px'
                })
            },
            document: {
                getElementById: (id: string) =>
                    id === 'excel-table-container' ? { querySelector: () => tbl } : null,
                createElement: () => ({ getContext: () => ({ font: '', measureText: measure }) })
            },
            _excelColWidths: {},
            _excelColWidthKey: (t: string, c: string) => t + '-' + c,
            _excelColMinWidth: () => 10
        };
        vm.createContext(ctx);
        vm.runInContext(readJs('excelTableRenderer.js'), ctx);
        vm.runInContext("_excelAutoFitColumns('1000')", ctx);
        // najszerszy tekst: 'RZ. WLOT 1' = 10 znakow * 7 = 70 + padX 8 + oddech 2 = 80
        expect(h1[0].style.width).toBe('80px');
        expect(bodyRow.children[0].style.width).toBe('80px');
    });

    test('_excelCellNaturalWidth bierze input/label/td', () => {
        const ctx: any = { window: {} };
        vm.createContext(ctx);
        vm.runInContext(readJs('excelTableRenderer.js'), ctx);
        ctx.tdInp = { querySelector: (s: string) => (s === 'input' ? { scrollWidth: 120 } : null) };
        expect(vm.runInContext('_excelCellNaturalWidth(tdInp)', ctx)).toBe(120);
        ctx.tdSel = {
            querySelector: (s: string) =>
                s === 'input' ? null : s === '.excel-sel-wrap div' ? { scrollWidth: 87 } : null
        };
        expect(vm.runInContext('_excelCellNaturalWidth(tdSel)', ctx)).toBe(87);
        ctx.tdTxt = { querySelector: () => null, scrollWidth: 33 };
        expect(vm.runInContext('_excelCellNaturalWidth(tdTxt)', ctx)).toBe(33);
        expect(vm.runInContext('_excelCellNaturalWidth(null)', ctx)).toBe(0);
    });
});
