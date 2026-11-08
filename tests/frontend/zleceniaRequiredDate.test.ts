import fs from 'fs';
import vm from 'vm';

const SCRIPT = 'public/js/spa/zlecenia.js';

function loadZlecenia(dateFrom = '') {
    const elements: Record<string, { value?: string; addEventListener?: () => void }> = {
        'zlecenia-date-from': { value: dateFrom, addEventListener() {} },
        'zlecenia-date-to': { value: '', addEventListener() {} }
    };
    const renderStates: Array<{ requiresDateFrom?: boolean }> = [];
    const fetch = jest.fn(async (url: string) => ({
        ok: true,
        json: async () =>
            url === '/api/auth/me'
                ? { user: { id: 'admin', role: 'admin' } }
                : { data: [], totalCount: 0, hasMore: false }
    }));
    const context: Record<string, any> = {
        AbortController,
        URLSearchParams,
        fetch,
        authHeaders: () => ({}),
        logger: { info() {}, warn() {}, error() {} },
        document: {
            hidden: false,
            getElementById: (id: string) => elements[id] || null,
            querySelectorAll: () => [],
            addEventListener() {}
        },
        window: {
            zleceniaRender: {
                showLoadingSpinner() {},
                renderStats() {},
                updateChips() {},
                renderTable: (state: { requiresDateFrom?: boolean }) => {
                    renderStates.push(state);
                    return 0;
                },
                updateSentinel() {}
            }
        },
        setInterval: () => 1,
        clearInterval() {}
    };

    vm.createContext(context);
    vm.runInContext(fs.readFileSync(SCRIPT, 'utf8'), context);

    return { app: context.window.AppZlecenia, fetch, elements, renderStates };
}

describe('Zlecenia wymagają daty początkowej', () => {
    test('puste Data od blokuje pobieranie listy', async () => {
        const { app, fetch, renderStates } = loadZlecenia();

        await app.loadOrders();

        expect(fetch).not.toHaveBeenCalled();
        expect(renderStates[renderStates.length - 1]?.requiresDateFrom).toBe(true);
    });

    test('wybrana Data od pozwala pobrać listę', async () => {
        const { app, fetch } = loadZlecenia('2026-11-07');

        await app.loadOrders();

        expect(fetch).toHaveBeenCalledTimes(1);
        expect(String(fetch.mock.calls[0][0])).toContain('dateFrom=2026-11-07');
    });

    test('otwarcie kartoteki domyślnie pobiera dzisiejsze zlecenia', async () => {
        const { app, fetch, elements } = loadZlecenia();

        await app.init();

        const searchUrl = fetch.mock.calls.find(([url]) =>
            String(url).startsWith('/api/orders-studnie/production/search?')
        )?.[0];
        const today = new Date();
        const todayString = [
            today.getFullYear(),
            String(today.getMonth() + 1).padStart(2, '0'),
            String(today.getDate()).padStart(2, '0')
        ].join('-');

        expect(searchUrl).toContain(`dateFrom=${todayString}`);
        expect(elements['zlecenia-date-from'].value).toBe(todayString);
        expect(elements['zlecenia-date-to'].value).toBe(todayString);
    });

    test('wyczyszczenie filtrów przywraca zakres dzisiaj', async () => {
        const { app, fetch, elements } = loadZlecenia('2026-01-01');
        const today = new Date();
        const todayString = [
            today.getFullYear(),
            String(today.getMonth() + 1).padStart(2, '0'),
            String(today.getDate()).padStart(2, '0')
        ].join('-');

        await app.clearAllFilters();

        const searchUrl = fetch.mock.calls.find(([url]) =>
            String(url).startsWith('/api/orders-studnie/production/search?')
        )?.[0];
        expect(elements['zlecenia-date-from'].value).toBe(todayString);
        expect(elements['zlecenia-date-to'].value).toBe(todayString);
        expect(searchUrl).toContain(`dateFrom=${todayString}`);
    });
});
