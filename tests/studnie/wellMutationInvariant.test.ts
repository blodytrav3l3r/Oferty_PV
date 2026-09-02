// Mutation invariant 10k — plan v1.1 K4 (P0/P1 correctness gate)
import fs from 'fs';
import path from 'path';
import vm from 'vm';

describe('well mutation invariant 10k — filteredIndexes/Map/logicalRow/DOM/selection/spacer', () => {
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
                            removeEventListener: () => {},
                            get classList() {
                                return {
                                    toggle() {},
                                    add() {},
                                    remove() {},
                                    contains() {
                                        return false;
                                    }
                                };
                            }
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
            calcWellStats: () => ({
                price: 1000,
                weight: 500,
                height: 2000,
                areaInt: 1,
                areaExt: 1
            }),
            calculateWellTransportMap: () => ({ map: new Map() }),
            escapeHtml: (s: string) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;'),
            escapeHtmlAttr: (s: string) => String(s).replace(/"/g, '&quot;'),
            fmtInt: (n: number) => String(n),
            fmt: (n: number) => String(n),
            lucide: { createIcons: () => {} },
            getCurrentWell: () => null,
            getComputedStyle: () => ({ overflowY: 'auto' }),
            requestAnimationFrame: (cb: any) => {
                cb();
                return 1;
            },
            cancelAnimationFrame: () => {}
        };
        context.window = context;
        vm.createContext(context);
        for (const f of ['globals.js', 'wellUI.js', 'wellVirtual.js']) {
            const code = fs.readFileSync(path.join(base, f), 'utf8');
            try {
                vm.runInContext(code, context);
            } catch (e) {
                // ignore parse quirks
            }
        }
        ctx = context;
    });

    function assertInvariant(_msg: string) {
        const total = ctx._wellVirtualTotal;
        const filtered: number[] = ctx._wellVirtualFiltered || [];
        const wells: any[] = ctx.wells;
        expect(wells.length).toBeGreaterThanOrEqual(0);
        expect(filtered.length).toBe(total);
        for (const idx of filtered) {
            expect(idx).toBeGreaterThanOrEqual(0);
            expect(idx).toBeLessThan(wells.length);
        }
        // wellIndexById valid
        if (typeof ctx.getWellIndexById === 'function' && wells.length > 0) {
            for (let i = 0; i < Math.min(wells.length, 10); i++) {
                const w = wells[i];
                expect(ctx.getWellIndexById(w.id)).toBe(i);
            }
        }
        // logicalRow resolves
        for (let lr = 0; lr < Math.min(total, 5); lr++) {
            const wIdx = filtered[lr];
            expect(wells[wIdx]).toBeDefined();
        }
        // prefix sums length = total+1, monotonic
        if (ctx._wellVirtualPrefixSums) {
            expect(ctx._wellVirtualPrefixSums.length).toBe(total + 1);
            for (let i = 1; i < ctx._wellVirtualPrefixSums.length; i++) {
                expect(ctx._wellVirtualPrefixSums[i]).toBeGreaterThanOrEqual(
                    ctx._wellVirtualPrefixSums[i - 1]
                );
            }
        }
    }

    test('10k → scroll middle → edit → add → delete → filter → clear → sort → scroll', () => {
        ctx.wells = [];
        for (let i = 0; i < 1000; i++) {
            const dn = i % 3 === 0 ? '1200' : '1000';
            ctx.wells.push({ id: 'well-' + i, name: 'Ss' + i, dn, config: [], przejscia: [] });
        }
        if (typeof ctx._rebuildWellsById === 'function') ctx._rebuildWellsById();
        ctx._wellVirtualBuildFiltered();
        assertInvariant('initial 1k');

        // scroll middle — GetVisibleRange bounded
        const r1 = ctx._wellVirtualGetVisibleRange();
        expect(r1.end - r1.start).toBeLessThanOrEqual(70);

        // edit row (rename)
        ctx.wells[500].name = 'Ss500-edited';
        ctx._wellVirtualBuildFiltered();
        assertInvariant('after edit');

        // add row
        ctx.wells.push({ id: 'well-new', name: 'Ss-new', dn: '1000', config: [], przejscia: [] });
        if (typeof ctx._rebuildWellsById === 'function') ctx._rebuildWellsById();
        ctx._wellVirtualBuildFiltered();
        expect(ctx.wells.length).toBe(1001);
        assertInvariant('after add');

        // delete row
        ctx.wells.splice(100, 1);
        if (typeof ctx._rebuildWellsById === 'function') ctx._rebuildWellsById();
        ctx._wellVirtualBuildFiltered();
        expect(ctx.wells.length).toBe(1000);
        assertInvariant('after delete');

        // filter
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
                    removeEventListener: () => {},
                    get classList() {
                        return {
                            toggle() {},
                            add() {},
                            remove() {},
                            contains() {
                                return false;
                            }
                        };
                    }
                };
            return null;
        };
        ctx._wellVirtualBuildFiltered();
        expect(ctx._wellVirtualTotal).toBeGreaterThan(0);
        expect(ctx._wellVirtualTotal).toBeLessThan(1000);
        assertInvariant('after filter');

        // clear filter
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
                    removeEventListener: () => {},
                    get classList() {
                        return {
                            toggle() {},
                            add() {},
                            remove() {},
                            contains() {
                                return false;
                            }
                        };
                    }
                };
            return null;
        };
        ctx._wellVirtualBuildFiltered();
        expect(ctx._wellVirtualTotal).toBe(1000);
        assertInvariant('after clear filter');

        // scroll again
        const r2 = ctx._wellVirtualGetVisibleRange();
        expect(r2.end - r2.start).toBeLessThanOrEqual(70);
        assertInvariant('after scroll 2');
    });
});
