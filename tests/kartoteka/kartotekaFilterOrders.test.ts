import fs from 'fs';
import path from 'path';
import vm from 'vm';

// Regresja: zmiana filtra/wyszukiwarki wołała sam searchOffers bez
// notifyOrderMutation — nowa lista, stara mapa: badge z _orderCount,
// wiersze zamówień dopiero po powrocie z innego modułu (refreshModule).
describe('kartoteka filtry — zmiana listy dociąga mapę zamówień', () => {
    let mod: any;
    let queue: any[];
    let renders: number;
    let fetchedUrls: string[];

    const offer = { id: 'offer_studnie_1', updatedAt: 't1', state: 'aktywna', _orderCount: 1 };
    const order = { id: 'ord-1', offerStudnieId: 'offer_studnie_1', orderNumber: 'SA/ZS/1' };
    const searchBody = { data: [offer], totalCount: 1, hasMore: false };

    const okResp = (data: any) => ({ ok: true, status: 200, body: { data } });
    const okBody = (body: any) => ({ ok: true, status: 200, body });

    function nextFetch(url?: string): Promise<any> {
        fetchedUrls.push(String(url).split('?')[0]);
        const next = queue.shift() || { ok: true, status: 200, body: { data: [] } };
        return Promise.resolve({
            ok: next.ok,
            status: next.status,
            json: async () => next.body
        });
    }

    function loadPart(name: string): string {
        const base = path.join(__dirname, '../../public/js/kartoteka');
        return fs
            .readFileSync(path.join(base, name), 'utf8')
            .replace(
                /^import .*$/m,
                'var storageService = typeof storageService !== "undefined" ? storageService : {};'
            )
            .replace('export default', `globalThis.__part_${name.replace(/\W/g, '_')} =`);
    }

    beforeEach(() => {
        queue = [];
        renders = 0;
        fetchedUrls = [];
        const context: any = {
            console,
            setTimeout,
            clearTimeout,
            AbortController,
            URLSearchParams,
            logger: { info() {}, warn() {}, error() {} },
            document: { getElementById: () => null, querySelectorAll: () => [] },
            fetch: nextFetch,
            window: null as any
        };
        const esc = (s: unknown) => String(s ?? '');
        context.window = {
            escapeHtml: esc,
            showToast: () => {},
            resolveDatePreset: () => ({ from: '', to: '' }),
            httpErrorMessage: (c: number) => 'HTTP ' + c
        };
        vm.createContext(context);
        vm.runInContext(loadPart('kartotekaSearch.js'), context);
        vm.runInContext(loadPart('kartotekaFilter.js'), context);
        vm.runInContext(loadPart('kartotekaActions.js'), context);
        mod = Object.assign(
            {
                ordersMap: new Map(),
                currentFilter: 'all',
                currentTypeFilter: 'all',
                filters: { user: '', date: { mode: 'preset', preset: 'month', from: '', to: '' } },
                searchResults: null,
                isLoading: false,
                abortController: null,
                searchDebounceTimer: null,
                _ordersRetryDelay: 0,
                renderResults() {
                    renders++;
                },
                showLoadingSpinner() {},
                showError() {},
                updateOfferCounter() {},
                populateUserFilter() {}
            },
            context.__part_kartotekaSearch_js,
            context.__part_kartotekaFilter_js,
            context.__part_kartotekaActions_js
        );
        // Stub UI z powrotem (mixin nadpisuje realnymi, zależnymi od DOM).
        mod.renderResults = () => {
            renders++;
        };
        mod.showLoadingSpinner = () => {};
        mod.showError = () => {};
        mod.updateOfferCounter = () => {};
        mod.populateUserFilter = () => {};
    });

    async function flush(ms = 50) {
        await new Promise((resolve) => setTimeout(resolve, ms));
    }

    test('setTypeFilter: nowa lista + mapa zamówień wypełniona', async () => {
        queue.push(okBody(searchBody), okResp([order]), okResp([]));
        mod.setTypeFilter('studnia_oferta');
        await flush();
        expect(mod.searchResults.items).toHaveLength(1);
        expect([...(mod.ordersMap.get('offer_studnie_1') || [])]).toHaveLength(1);
        expect(renders).toBeGreaterThanOrEqual(1);
    });

    test('setDatePreset: nowa lista + mapa zamówień wypełniona', async () => {
        queue.push(okBody(searchBody), okResp([order]), okResp([]));
        mod.setDatePreset('month');
        await flush();
        expect(mod.searchResults.items).toHaveLength(1);
        expect([...(mod.ordersMap.get('offer_studnie_1') || [])]).toHaveLength(1);
    });

    test('onSearchInput (debounce): nowa lista + mapa zamówień wypełniona', async () => {
        queue.push(okBody(searchBody), okResp([order]), okResp([]));
        mod.onSearchInput();
        await flush(450);
        expect(mod.searchResults.items).toHaveLength(1);
        expect([...(mod.ordersMap.get('offer_studnie_1') || [])]).toHaveLength(1);
    });
});
