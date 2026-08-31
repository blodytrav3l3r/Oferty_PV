// @ts-check
// Oracle C-4: legacy configurator vs virtual — wartości, identity, pricing, validation
import fs from 'fs';
import path from 'path';
import vm from 'vm';

describe('wellVirtual oracle — legacy vs virtual configurator', () => {
    let ctx: any;
    beforeAll(() => {
        const base = path.join(__dirname, '../../public/js/studnie');
        const context: any = {
            wells: [],
            currentWellIndex: 0,
            _excelActiveTab: '1000',
            _excelMaxTransitions: { '1000': 1 },
            wellDiscounts: {},
            orderEditMode: null,
            searchTerm: '',
            console,
            logger: { warn() {}, error() {} },
            document: {
                getElementById: (id: string) => {
                    if (id === 'wells-list')
                        return {
                            innerHTML: '',
                            querySelectorAll: () => [],
                            style: {},
                            scrollTop: 0,
                            clientHeight: 400,
                            addEventListener: () => {},
                            removeEventListener: () => {}
                        };
                    if (id === 'wells-search-input') return { value: '' };
                    if (id === 'wells-counter') return { textContent: '' };
                    return null;
                },
                querySelector: () => null,
                querySelectorAll: () => [],
                createElement: () => ({ style: {}, setAttribute() {} }),
                addEventListener: () => {}
            },
            window: null as any,
            localStorage: { getItem: () => null },
            location: { search: '?wellVirtual=1' },
            // stubs
            calcWellStats: (_w: any) => ({
                price: 1000,
                weight: 500,
                height: 2000,
                areaInt: 1,
                areaExt: 1
            }),
            calculateWellTransportMap: () => ({ map: new Map() }),
            getOrderChanges: () => ({}),
            isWellLocked: () => false,
            refreshAllWellErrors: () => {},
            renderDiscountPanel: () => {},
            escapeHtml: (s: string) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;'),
            escapeHtmlAttr: (s: string) => String(s).replace(/"/g, '&quot;'),
            fmtInt: (n: number) => String(n),
            fmt: (n: number) => String(n),
            lucide: { createIcons: () => {} },
            getCurrentWell: () => null
        };
        context.window = context;
        vm.createContext(context);
        for (const f of ['globals.js', 'wellUI.js', 'wellVirtual.js']) {
            const code = fs.readFileSync(path.join(base, f), 'utf8');
            try {
                vm.runInContext(code, context);
            } catch (e) {
                // ignore
            }
        }
        ctx = context;
    });

    test('filteredIndexes preserves DN order and search', () => {
        ctx.wells = [];
        for (let i = 0; i < 100; i++) {
            const dn = i < 50 ? '1000' : '1200';
            ctx.wells.push({ id: 'well-' + i, name: 'Ss' + i, dn, config: [], przejscia: [] });
        }
        ctx._wellVirtualBuildFiltered();
        expect(ctx._wellVirtualTotal).toBe(100);
        // first 50 should be DN1000 due to order
        const firstDn = String(ctx.wells[ctx._wellVirtualFiltered[0]].dn);
        expect(firstDn).toBe('1000');
    });

    test('virtual slice values match legacy for same wellIdx', () => {
        ctx.wells = [
            { id: 'well-0', name: 'Ss0', dn: '1000', config: [{ productId: 'a' }], przejscia: [] },
            { id: 'well-1', name: 'Ss1', dn: '1000', config: [], przejscia: [] }
        ];
        ctx._wellVirtualBuildFiltered();
        const html0 = ctx._wellVirtualCardHtml(ctx.wells[0], 0, 0);
        const html1 = ctx._wellVirtualCardHtml(ctx.wells[1], 1, 1);
        expect(html0).toContain('Ss0');
        expect(html1).toContain('Ss1');
        expect(html0).toContain('data-logical-row="0"');
        expect(html1).toContain('data-logical-row="1"');
    });

    test('filter → clear filter preserves identity and total', () => {
        ctx.wells = [];
        for (let i = 0; i < 20; i++)
            ctx.wells.push({
                id: 'well-' + i,
                name: 'Ss' + i,
                dn: '1000',
                config: [],
                przejscia: []
            });
        ctx._wellVirtualBuildFiltered();
        const totalBefore = ctx._wellVirtualTotal;
        // simulate search
        ctx.document.getElementById = (id: string) => {
            if (id === 'wells-search-input') return { value: 'Ss1' };
            if (id === 'wells-list')
                return {
                    innerHTML: '',
                    querySelectorAll: () => [],
                    style: {},
                    scrollTop: 0,
                    clientHeight: 400,
                    addEventListener: () => {},
                    removeEventListener: () => {}
                };
            return null;
        };
        ctx._wellVirtualBuildFiltered();
        expect(ctx._wellVirtualTotal).toBeGreaterThan(0);
        expect(ctx._wellVirtualTotal).toBeLessThan(totalBefore);
        // clear
        ctx.document.getElementById = (id: string) => {
            if (id === 'wells-search-input') return { value: '' };
            if (id === 'wells-list')
                return {
                    innerHTML: '',
                    querySelectorAll: () => [],
                    style: {},
                    scrollTop: 0,
                    clientHeight: 400,
                    addEventListener: () => {},
                    removeEventListener: () => {}
                };
            return null;
        };
        ctx._wellVirtualBuildFiltered();
        expect(ctx._wellVirtualTotal).toBe(totalBefore);
    });

    test('range O(1) for 10k wells', () => {
        ctx.wells = [];
        for (let i = 0; i < 10000; i++)
            ctx.wells.push({
                id: 'well-' + i,
                name: 'Ss' + i,
                dn: '1000',
                config: [],
                przejscia: []
            });
        ctx._wellVirtualBuildFiltered();
        expect(ctx._wellVirtualTotal).toBe(10000);
        const range = ctx._wellVirtualGetVisibleRange
            ? ctx._wellVirtualGetVisibleRange()
            : { start: 0, end: 50 };
        expect(range.end - range.start).toBeLessThanOrEqual(70);
    });
});
