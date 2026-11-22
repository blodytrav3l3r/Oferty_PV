import fs from 'fs';
import path from 'path';
import vm from 'vm';

const BASE = path.join(__dirname, '../../public/js/studnie');

function makeContext() {
    const search = {
        value: '',
        _wellSearchPatched: false,
        removeAttribute() {},
        addEventListener() {}
    };
    const list = {
        innerHTML: '',
        scrollTop: 0,
        clientHeight: 500,
        style: {},
        classList: { toggle() {}, add() {}, remove() {}, contains: () => false },
        addEventListener() {},
        removeEventListener() {},
        querySelectorAll: () => []
    } as any;
    const counter = { textContent: '' };
    const context: any = {
        wells: [
            {
                id: 'empty',
                name: 'Pusta',
                dn: 1000,
                config: [],
                przejscia: [{ productId: 'outlet' }]
            },
            { id: 'ring', name: 'C1', dn: 1000, config: [{ productId: 'ring' }], przejscia: [] },
            {
                id: 'accessory',
                name: 'Akcesorium',
                dn: 1200,
                config: [{ productId: 'seal' }],
                przejscia: []
            },
            { id: 'locked-empty', name: 'Powiązana pusta', dn: 1500, config: [], przejscia: [] }
        ],
        currentWellIndex: 0,
        _excelActiveTab: '1000',
        _excelMaxTransitions: { '1000': 1 },
        wellDiscounts: {},
        orderEditMode: null,
        isWellLocked: (index: number) => index === 3,
        studnieProducts: [
            { id: 'ring', componentType: 'krag' },
            { id: 'seal', componentType: 'uszczelka' }
        ],
        getStudnieProductById: (id: string) =>
            [
                { id: 'ring', componentType: 'krag' },
                { id: 'seal', componentType: 'uszczelka' }
            ].find((product) => product.id === id) || null,
        document: {
            getElementById: (id: string) => {
                if (id === 'wells-list') return list;
                if (id === 'wells-search-input') return search;
                if (id === 'wells-counter') return counter;
                return null;
            },
            querySelector: () => null,
            querySelectorAll: () => [],
            createElement: () => ({ style: {}, setAttribute() {} }),
            addEventListener() {}
        },
        localStorage: { getItem: () => null },
        location: { search: '?wellVirtual=1' },
        calcWellStats: () => ({ price: 0, weight: 0, height: 0, areaInt: 0, areaExt: 0 }),
        calculateWellTransportMap: () => ({ map: new Map() }),
        safeCalcWellStats: () => ({ price: 0, weight: 0, height: 0, areaInt: 0, areaExt: 0 }),
        refreshAllWellErrors() {},
        renderDiscountPanel() {},
        _wellBuildCardHtml: (_well: any, index: number, logicalRow: number | null) =>
            `<div class="card" data-widx="${index}" data-logical-row="${logicalRow ?? ''}"></div>`,
        window: null as any,
        setInterval: () => 1,
        clearInterval() {},
        requestAnimationFrame: (cb: any) => {
            cb();
            return 1;
        },
        cancelAnimationFrame() {},
        getComputedStyle: () => ({ overflowY: 'auto' })
    };
    context.window = context;
    vm.createContext(context);
    for (const file of ['wellUIHelpers.js', 'wellUI.js', 'wellVirtual.js']) {
        vm.runInContext(fs.readFileSync(path.join(BASE, file), 'utf8'), context, {
            filename: file
        });
    }
    context._wellBuildCardHtml = (_well: any, index: number, logicalRow: number | null) =>
        `<div class="card" data-widx="${index}" data-logical-row="${logicalRow ?? ''}"></div>`;
    return { context, list, counter };
}

describe('wells list excludes empty positions', () => {
    test('legacy renderer shows only eligible wells and counts them without changing source indexes', () => {
        const { context, list, counter } = makeContext();

        context.renderWellsListLegacy();

        expect(list.innerHTML).toContain('data-widx="1"');
        expect(list.innerHTML).toContain('data-widx="2"');
        expect(list.innerHTML).toContain('data-widx="3"');
        expect(list.innerHTML).not.toContain('data-widx="0"');
        expect(counter.textContent).toBe('(3)');
        expect(context.wells.map((well: any) => well.id)).toEqual([
            'empty',
            'ring',
            'accessory',
            'locked-empty'
        ]);
    });

    test('virtual renderer keeps original wIdx values and counts only eligible wells', () => {
        const { context, counter } = makeContext();

        context._wellVirtualBuildFiltered();

        expect(Array.from(context._wellVirtualFiltered)).toEqual([1, 2, 3]);
        context.renderWellsList();
        expect(counter.textContent).toBe('(3)');
        expect(context.wells.map((well: any) => well.id)).toEqual([
            'empty',
            'ring',
            'accessory',
            'locked-empty'
        ]);
    });

    test('active order keeps linked legacy empty position visible in both list modes', () => {
        const { context, list, counter } = makeContext();
        context.orderEditMode = { order: { wells: [{ id: 'empty' }] } };

        context.renderWellsListLegacy();
        expect(list.innerHTML).toContain('data-widx="0"');
        expect(counter.textContent).toBe('(4)');

        context._wellVirtualBuildFiltered();
        expect(Array.from(context._wellVirtualFiltered)).toEqual([0, 1, 2, 3]);
    });
});
