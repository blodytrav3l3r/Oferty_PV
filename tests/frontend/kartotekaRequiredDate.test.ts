import fs from 'fs';
import path from 'path';
import vm from 'vm';

const ROOT = path.join(__dirname, '../..');
const SEARCH_PATH = path.join(ROOT, 'public/js/kartoteka/kartotekaSearch.js');
const FILTER_PATH = path.join(ROOT, 'public/js/kartoteka/kartotekaFilter.js');
const UI_PATH = path.join(ROOT, 'public/js/kartoteka/kartotekaUi.js');

function loadSearchModule(context: Record<string, unknown>) {
    const source = fs
        .readFileSync(SEARCH_PATH, 'utf8')
        .replace(/^import .*$/m, 'var storageService = {};')
        .replace('export default', 'globalThis.kartotekaSearch =');
    vm.createContext(context);
    vm.runInContext(source, context);
    return context.kartotekaSearch as Record<string, (...args: unknown[]) => unknown>;
}

function loadFilterModule() {
    const source = fs
        .readFileSync(FILTER_PATH, 'utf8')
        .replace('export default', 'globalThis.kartotekaFilter =');
    const elements = {
        'ka-local-search-input': { value: 'test' },
        'ka-date-from': { value: '2026-01-01' },
        'ka-date-to': { value: '2026-01-31' }
    };
    const context = {
        document: { getElementById: (id: string) => elements[id as keyof typeof elements] || null }
    };
    vm.createContext(context);
    vm.runInContext(source, context);
    return {
        filter: (context as Record<string, unknown>).kartotekaFilter as Record<
            string,
            (...args: unknown[]) => unknown
        >,
        elements
    };
}

function loadKartotekaUiConstructor() {
    const source = fs
        .readFileSync(UI_PATH, 'utf8')
        .replace(/^import kartotekaSearch .*$/m, 'const kartotekaSearch = {};')
        .replace(/^import kartotekaFilter .*$/m, 'const kartotekaFilter = {};')
        .replace(/^import kartotekaHistory .*$/m, 'const kartotekaHistory = {};')
        .replace(/^import kartotekaActions .*$/m, 'const kartotekaActions = {};')
        .replace(/^import kartotekaFollowUp .*$/m, 'const kartotekaFollowUp = {};')
        .concat('\nglobalThis.KartotekaUI = KartotekaUI;');
    const context = {
        document: { addEventListener() {} },
        window: { addEventListener() {} }
    };
    vm.createContext(context);
    vm.runInContext(source, context);
    return (context as Record<string, unknown>).KartotekaUI as new () => {
        filters: { date: Record<string, string> };
    };
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

    test('nowa sesja kartoteki domyślnie wybiera preset dzisiaj', () => {
        const KartotekaUI = loadKartotekaUiConstructor();
        const ui = new KartotekaUI();

        expect(ui.filters.date).toEqual({ mode: 'preset', preset: 'today', from: '', to: '' });
    });

    test('ponowne wybranie aktywnego presetu dzisiaj nie wyłącza filtra', () => {
        const { filter } = loadFilterModule();
        const ui = {
            filters: { date: { mode: 'preset', preset: 'today', from: '', to: '' } },
            _syncFilterUI: jest.fn(),
            loadLocalOffers: jest.fn()
        };

        filter.setDatePreset.call(ui, 'today');

        expect(ui.filters.date).toEqual({ mode: 'preset', preset: 'today', from: '', to: '' });
        expect(ui.loadLocalOffers).toHaveBeenCalledTimes(1);
    });

    test('wyczyszczenie pozostałych filtrów przywraca zakres dzisiaj', () => {
        const { filter, elements } = loadFilterModule();
        const ui = {
            currentFilter: 'with_order',
            currentTypeFilter: 'studnie',
            currentFollowupFilter: 'overdue',
            hidePaused: true,
            filters: {
                user: 'user-1',
                date: { mode: 'range', preset: '', from: '2026-01-01', to: '2026-01-31' }
            },
            _syncFilterUI: jest.fn(),
            loadLocalOffers: jest.fn()
        };

        filter.clearAllFilters.call(ui);

        expect(ui.filters.date).toEqual({ mode: 'preset', preset: 'today', from: '', to: '' });
        expect(elements['ka-local-search-input'].value).toBe('');
        expect(elements['ka-date-from'].value).toBe('');
        expect(elements['ka-date-to'].value).toBe('');
        expect(ui.loadLocalOffers).toHaveBeenCalledTimes(1);
    });
});
