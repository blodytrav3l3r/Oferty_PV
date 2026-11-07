import fs from 'fs';
import path from 'path';
import vm from 'vm';

const ROOT = path.join(__dirname, '../..');
const SEARCH_PATH = path.join(ROOT, 'public/js/kartoteka/kartotekaSearch.js');

function loadSearchModule(context: Record<string, unknown>) {
    const source = fs
        .readFileSync(SEARCH_PATH, 'utf8')
        .replace(/^import .*$/m, 'var storageService = {};')
        .replace('export default', 'globalThis.kartotekaSearch =');
    vm.createContext(context);
    vm.runInContext(source, context);
    return context.kartotekaSearch as Record<string, (...args: unknown[]) => unknown>;
}

describe('Kartoteka wymaga daty początkowej', () => {
    test('bez daty nie wysyła zapytania i czyści poprzednią listę', async () => {
        const list = { innerHTML: '' };
        const fetch = jest.fn();
        const context = {
            AbortController,
            URLSearchParams,
            fetch,
            document: { getElementById: (id: string) => (id === 'ka-offers-list' ? list : null) },
            window: { resolveDatePreset: () => ({ from: '', to: '' }) },
            logger: { info() {}, warn() {}, error() {} }
        };
        const search = loadSearchModule(context);
        const ui = {
            filters: { date: { mode: 'none', preset: '', from: '', to: '' } },
            currentFilter: 'all',
            hasRequiredDateFrom: () => search.hasRequiredDateFrom.call(ui),
            abortController: null,
            isLoading: true,
            searchResults: { items: [{ id: 'stara-oferta' }], totalCount: 1 },
            ordersMap: new Map([['stara-oferta', ['zamowienie']]]),
            renderResults: () => search.renderResults.call(ui),
            updateOfferCounter: jest.fn()
        };

        await search.searchOffers.call(ui, { dateFrom: '' });

        expect(fetch).not.toHaveBeenCalled();
        expect(ui.searchResults.items).toEqual([]);
        expect(ui.ordersMap.size).toBe(0);
        expect(list.innerHTML).toContain('Wybierz datę początkową');
    });

    test('preset z datą początkową pozwala rozpocząć wyszukiwanie', () => {
        const search = loadSearchModule({
            window: { resolveDatePreset: () => ({ from: '2026-11-07T00:00:00.000Z', to: '' }) }
        });

        expect(
            search.hasRequiredDateFrom.call({
                filters: { date: { mode: 'preset', preset: 'today', from: '', to: '' } }
            })
        ).toBe(true);
    });
});
