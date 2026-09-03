import fs from 'fs';
import path from 'path';
import vm from 'vm';

// P0: ciche odświeżanie listy ofert — spinner tylko przy jawnych akcjach,
// tło renderuje wyłącznie przy realnej zmianie danych.
describe('kartotekaSearch silent refresh (P0)', () => {
    let mod: any;
    let calls: { render: number; spinner: number; error: number };
    let queue: any[];

    const row = (id: string, updatedAt: string, state = 'aktywna', orderCount = 0) => ({
        id,
        updatedAt,
        state,
        _orderCount: orderCount
    });

    function setFetchResponse(body: any, ok = true) {
        queue.push({ ok, body });
    }

    beforeEach(() => {
        calls = { render: 0, spinner: 0, error: 0 };
        queue = [];
        const base = path.join(__dirname, '../../public/js/kartoteka');
        let code = fs.readFileSync(path.join(base, 'kartotekaSearch.js'), 'utf8');
        code = code
            .replace(/^import .*$/m, 'const storageService = {};')
            .replace('export default', 'globalThis.__kartotekaSearch =');
        const context: any = {
            console,
            AbortController,
            URLSearchParams,
            logger: { info() {}, warn() {}, error() {} },
            document: { getElementById: () => null, hidden: false },
            window: null as any,
            fetch: async () => {
                const next = queue.shift() || { ok: true, body: { data: [] } };
                return {
                    ok: next.ok,
                    status: next.ok ? 200 : 500,
                    json: async () => next.body
                };
            }
        };
        context.window = {
            ...context,
            escapeHtml: (s: string) => String(s),
            httpErrorMessage: (c: number) => 'HTTP ' + c,
            resolveDatePreset: () => ({ from: '', to: '' })
        };
        vm.createContext(context);
        vm.runInContext(code, context);
        mod = context.__kartotekaSearch;
        mod.searchResults = null;
        mod._lastOfferSignature = undefined;
        mod.isLoading = false;
        mod.abortController = null;
        mod.renderResults = () => {
            calls.render++;
        };
        mod.showLoadingSpinner = () => {
            calls.spinner++;
        };
        mod.showError = () => {
            calls.error++;
        };
        mod.updateOfferCounter = () => {};
        mod.populateUserFilter = () => {};
        mod.notifyOrderMutation = () => {};
    });

    test('tło bez zmian: zero spinnera, zero renderu', async () => {
        const items = [row('a', 't1'), row('b', 't1')];
        mod.searchResults = { items, totalCount: 2, hasMore: false };
        mod._lastOfferSignature = mod._offerListSignature(items);
        setFetchResponse({ data: items, totalCount: 2, hasMore: false });
        await mod.searchOffers({}, false, { silent: true });
        expect(calls.spinner).toBe(0);
        expect(calls.render).toBe(0);
        expect(calls.error).toBe(0);
    });

    test('tło ze zmianą: zero spinnera, jeden render', async () => {
        mod.searchResults = { items: [row('a', 't1')], totalCount: 1, hasMore: false };
        mod._lastOfferSignature = mod._offerListSignature(mod.searchResults.items);
        const changed = [row('a', 't2'), row('b', 't2')];
        setFetchResponse({ data: changed, totalCount: 2, hasMore: false });
        await mod.searchOffers({}, false, { silent: true });
        expect(calls.spinner).toBe(0);
        expect(calls.render).toBe(1);
        expect(mod.searchResults.items).toHaveLength(2);
    });

    test('jawne wyszukiwanie: spinner + render', async () => {
        setFetchResponse({ data: [row('a', 't1')], totalCount: 1, hasMore: false });
        await mod.searchOffers({});
        expect(calls.spinner).toBe(1);
        expect(calls.render).toBe(1);
    });

    test('„Pokaż więcej": bez spinnera, dokleja i renderuje', async () => {
        mod.searchResults = {
            items: [row('a', 't1')],
            totalCount: 2,
            hasMore: true,
            nextCursor: 't1',
            nextCursorId: 'a'
        };
        mod._lastOfferSignature = mod._offerListSignature(mod.searchResults.items);
        mod.filters = { date: { mode: 'preset', preset: 'all' }, user: '' };
        mod.currentTypeFilter = 'all';
        mod.currentFilter = 'all';
        setFetchResponse({ data: [row('b', 't1')], hasMore: false });
        await mod.loadMore();
        expect(calls.spinner).toBe(0);
        expect(calls.render).toBe(1);
        expect(mod.searchResults.items.map((o: any) => o.id)).toEqual(['a', 'b']);
    });

    test('tło przy błędzie: nie nadpisuje listy ekranem błędu', async () => {
        mod.searchResults = { items: [row('a', 't1')], totalCount: 1, hasMore: false };
        mod._lastOfferSignature = mod._offerListSignature(mod.searchResults.items);
        queue.push({ ok: false, body: { error: 'boom' } });
        await mod.searchOffers({}, false, { silent: true });
        expect(calls.error).toBe(0);
        expect(calls.render).toBe(0);
        expect(mod.searchResults.items).toHaveLength(1);
    });
});
