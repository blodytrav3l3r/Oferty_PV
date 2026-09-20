// @ts-nocheck -- wzorzec vm (rzednaClamp.test.ts)
// Hover przejścia w podglądzie SVG → wyraźne podświetlenie na liście
// (konfigurator, zlecenia, Excel) po stabilnym pr.id, bez scrollowania.
import fs from 'fs';
import path from 'path';
import vm from 'vm';

const readStudnie = (f: string) =>
    fs.readFileSync(path.join(__dirname, '../../public/js/studnie/' + f), 'utf8');

function fakeEl(attrs: Record<string, string>) {
    const classes = new Set<string>();
    return {
        getAttribute: (n: string) => (n in attrs ? attrs[n] : null),
        classList: {
            add: (c: string) => classes.add(c),
            remove: (c: string) => classes.delete(c),
            toggle: (c: string, force?: boolean) => {
                if (force) classes.add(c);
                else classes.delete(c);
            },
            contains: (c: string) => classes.has(c)
        },
        style: {} as Record<string, string>,
        _classes: classes
    };
}

function fakeSvgShape(przId: string, cls: string) {
    const el: any = fakeEl({ 'data-prz-id': przId });
    el._cls = cls;
    return el;
}

function loadRenderer(well: any, tiles: any[], excelTds: any[], svgShapes: any[] = []) {
    const overlay =
        excelTds === null
            ? null
            : {
                  querySelectorAll: (sel: string) =>
                      String(sel).includes('td[data-prz-id]') ? excelTds : []
              };
    const context: any = {
        window: { svgDragStartIndex: -1 },
        document: {
            querySelectorAll: (sel: string) => {
                if (String(sel).includes('.prz-tile')) return tiles;
                if (String(sel).includes('g[data-prz-id]')) return svgShapes;
                if (String(sel).includes('.svg-prz-'))
                    return svgShapes.filter((s) => s._cls === String(sel).slice(1));
                return [];
            },
            getElementById: (id: string) => (id === 'excel-table-overlay' ? overlay : null)
        },
        getCurrentWell: () => well
    };
    vm.createContext(context);
    vm.runInContext(readStudnie('diagramRenderer.js'), context);
    // diagramRenderer rejestruje na window.* — udostępnij bezpośrednio dla wygody.
    context.svgPrzPointerEnter = context.window.svgPrzPointerEnter;
    context.svgPrzPointerLeave = context.window.svgPrzPointerLeave;
    context.highlightSvg = context.window.highlightSvg;
    context.unhighlightSvg = context.window.unhighlightSvg;
    return context;
}

const WELL = {
    przejscia: [
        { id: 'prz-aaa', angle: 0 },
        { id: 'prz-bbb', angle: 90 }
    ]
};

describe('svgPrzPointerEnter/Leave → klasy (bez inline filter)', () => {
    it('podświetla kafelki konfiguratora i zlecenia tym samym id', () => {
        const tileCfg = fakeEl({ 'data-prz-id': 'prz-aaa', 'data-prz-idx': '0' });
        const tileZl = fakeEl({ 'data-prz-id': 'prz-aaa', 'data-prz-idx': '0' });
        const other = fakeEl({ 'data-prz-id': 'prz-bbb', 'data-prz-idx': '1' });
        const ctx = loadRenderer(WELL, [tileCfg, tileZl, other], []);

        ctx.svgPrzPointerEnter({}, 'prz-aaa');
        expect(tileCfg.classList.contains('prz-tile--svg-hover')).toBe(true);
        expect(tileZl.classList.contains('prz-tile--svg-hover')).toBe(true);
        expect(other.classList.contains('prz-tile--svg-hover')).toBe(false);
        // Bez inline stylingu na kafelkach.
        expect(tileCfg.style.filter || '').toBe('');

        ctx.svgPrzPointerLeave({}, 'prz-aaa');
        expect(tileCfg.classList.contains('prz-tile--svg-hover')).toBe(false);
        expect(tileZl.classList.contains('prz-tile--svg-hover')).toBe(false);
    });

    it('legacy indeks liczbowy mapuje na id przez bieżącą studnię', () => {
        const tile = fakeEl({ 'data-prz-id': 'prz-bbb', 'data-prz-idx': '1' });
        const ctx = loadRenderer(WELL, [tile], []);
        ctx.svgPrzPointerEnter({}, 1);
        expect(tile.classList.contains('prz-tile--svg-hover')).toBe(true);
        ctx.svgPrzPointerLeave({}, 1);
        expect(tile.classList.contains('prz-tile--svg-hover')).toBe(false);
    });

    it('nieznane id → brak crasha, nic nie podświetlone', () => {
        const tile = fakeEl({ 'data-prz-id': 'prz-aaa', 'data-prz-idx': '0' });
        const ctx = loadRenderer(WELL, [tile], []);
        expect(() => ctx.svgPrzPointerEnter({}, 'prz-nie-istnieje')).not.toThrow();
        expect(tile.classList.contains('prz-tile--svg-hover')).toBe(false);
        expect(() => ctx.svgPrzPointerLeave({}, 'prz-nie-istnieje')).not.toThrow();
    });

    it('podświetla dokładnie 4 komórki TD danego PRZ w Excelu', () => {
        const cells = [0, 1, 2, 3].map(() => fakeEl({ 'data-prz-id': 'prz-bbb' }));
        const foreign = fakeEl({ 'data-prz-id': 'prz-aaa' });
        const ctx = loadRenderer(WELL, [], [...cells, foreign]);
        ctx.svgPrzPointerEnter({}, 'prz-bbb');
        cells.forEach((c) => expect(c.classList.contains('excel-tr-hover')).toBe(true));
        expect(foreign.classList.contains('excel-tr-hover')).toBe(false);
        ctx.svgPrzPointerLeave({}, 'prz-bbb');
        cells.forEach((c) => expect(c.classList.contains('excel-tr-hover')).toBe(false));
    });

    it('brak overlaya Excela → brak crasha', () => {
        const tile = fakeEl({ 'data-prz-id': 'prz-aaa', 'data-prz-idx': '0' });
        const ctx = loadRenderer(WELL, [tile], null);
        expect(() => ctx.svgPrzPointerEnter({}, 'prz-aaa')).not.toThrow();
        expect(tile.classList.contains('prz-tile--svg-hover')).toBe(true);
    });

    it('podświetla sam kształt SVG (drop-shadow) i gasi po leave', () => {
        const shapeA = fakeSvgShape('prz-aaa', 'svg-prz-0');
        const shapeB = fakeSvgShape('prz-bbb', 'svg-prz-1');
        const ctx = loadRenderer(WELL, [], [], [shapeA, shapeB]);
        ctx.svgPrzPointerEnter({}, 'prz-aaa');
        expect(shapeA.style.filter).toContain('drop-shadow');
        expect(shapeB.style.filter || '').toBe('');
        ctx.svgPrzPointerLeave({}, 'prz-aaa');
        expect(shapeA.style.filter).toBe('');
    });

    it('legacy indeks liczbowy podświetla kształt po klasie .svg-prz-N', () => {
        // Studnia bez id (legacy) — resolve nie znajduje pr.id, fallback na klasę.
        const legacyWell = { przejscia: [{ angle: 0 }, { angle: 90 }] };
        const shape = fakeSvgShape('', 'svg-prz-1');
        const ctx = loadRenderer(legacyWell, [], [], [shape]);
        ctx.highlightSvg('prz', 1);
        expect(shape.style.filter).toContain('drop-shadow');
        ctx.unhighlightSvg('prz', 1);
        expect(shape.style.filter).toBe('');
    });
});

describe('drawTransitions → data-prz-id w SVG', () => {
    it('generuje <g> z data-prz-id i handlerem po id', () => {
        const context: any = {
            window: {},
            SVG_COLORS: {
                transitionActive: '#00f',
                transitionStroke: '#00f',
                transitionBack: '#888',
                transitionBackStroke: '#888',
                dnLabel: '#fff',
                labelWhite: '#fff',
                textShadow: '#000'
            },
            getStudnieProductById: () => ({ category: 'PVC SN8', dn: '160' }),
            studnieProducts: []
        };
        vm.createContext(context);
        vm.runInContext(readStudnie('diagramTransitions.js'), context);
        const well = {
            rzednaDna: '100.000',
            przejscia: [{ id: 'prz-test-1', productId: 'x', rzednaWlaczenia: '101.000', angle: 0 }]
        };
        const canvas = {
            pxMm: 1,
            cx: 150,
            mT: 10,
            drawH: 400,
            bodyDN: 1000,
            totalMm: 3000,
            svgW: 300,
            mR: 20,
            mL: 60
        };
        const out = context.drawTransitions(well, canvas, []);
        expect(out).toContain('data-prz-id="prz-test-1"');
        expect(out).toContain("svgPrzPointerEnter(event, 'prz-test-1')");
    });
});

describe('excelTableBody → data-prz-id na TD', () => {
    it('render oznacza 4 komórki PRZ stabilnym id i deduplikuje', () => {
        const src = readStudnie('excelTableBody.js');
        expect(src).toContain('data-prz-id');
        expect(src).toContain('przIdAttr');
        expect(src).toContain('ensureUniquePrzejsciaIdsAcrossWells(wells)');
    });
});
