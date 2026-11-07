import fs from 'fs';
import vm from 'vm';

const SCRIPT = 'public/js/spa/zlecenia.js';

function loadZlecenia(dateFrom = '') {
    const elements: Record<string, { value?: string }> = {
        'zlecenia-date-from': { value: dateFrom },
        'zlecenia-date-to': { value: '' }
    };
    const renderStates: Array<{ requiresDateFrom?: boolean }> = [];
    const fetch = jest.fn(async (_url: string) => ({
        ok: true,
        json: async () => ({ data: [], totalCount: 0, hasMore: false })
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
});
