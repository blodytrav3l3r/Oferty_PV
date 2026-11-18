// @ts-nocheck -- vm sandbox, celowy brak typow dla public/js
import fs from 'fs';
import vm from 'vm';

const SCRIPT = 'public/js/spa/zlecenia.js';

/**
 * Regresja: wydruk z kartoteki #/zlecenia czytał kopię w RAM (odświeżaną co
 * 60 s), więc po zapisie w edytorze studni drukował parametry sprzed zmiany.
 * Wydruk musi dociągnąć rekord z GET /production/:id.
 */
function loadZlecenia(options: { detailOk?: boolean } = {}) {
    const detailOk = options.detailOk !== false;
    const printed: string[] = [];
    const elements: Record<string, { value?: string; addEventListener?: () => void }> = {
        'zlecenia-date-from': { value: '2026-01-01', addEventListener() {} },
        'zlecenia-date-to': { value: '', addEventListener() {} }
    };
    const fetch = jest.fn(async (url: string) => {
        if (url.startsWith('/api/orders-studnie/production/search')) {
            return {
                ok: true,
                json: async () => ({
                    data: [
                        {
                            id: 'po1',
                            katStopni: '45',
                            productionOrderNumber: 'N/1',
                            wellName: 'Studnia 1'
                        }
                    ],
                    totalCount: 1,
                    hasMore: false
                })
            };
        }
        if (url === '/api/orders-studnie/production/po1') {
            if (!detailOk) return { ok: false, json: async () => ({ error: 'not found' }) };
            return { ok: true, json: async () => ({ data: { id: 'po1', katStopni: '90' } }) };
        }
        return { ok: true, json: async () => ({ counts: {} }) };
    });
    const context: Record<string, any> = {
        AbortController,
        URLSearchParams,
        fetch,
        authHeaders: () => ({}),
        logger: { info() {}, warn() {}, error() {} },
        showToast() {},
        appConfirm: async () => true,
        lucide: { createIcons() {} },
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
                renderTable: () => 0,
                updateSentinel() {},
                updatePrintCells() {},
                showError() {}
            },
            fetchTemplate: async () => '<html></html>',
            silentPrint: (html: string) => printed.push(html),
            applyPrintTokens: (s: string) => s,
            buildZlecenieFromPO: (_tpl: string, po: any) => 'KAT=' + po.katStopni,
            buildEtykietaFromPO: (_tpl: string, po: any) => 'KAT=' + po.katStopni,
            buildZlecenieFromPageBlock: (_tpl: string, po: any) => 'KAT=' + po.katStopni,
            buildEtykietaPageBlock: (_tpl: string, po: any) => 'KAT=' + po.katStopni
        },
        setInterval: () => 1,
        clearInterval() {}
    };

    vm.createContext(context);
    vm.runInContext(fs.readFileSync(SCRIPT, 'utf8'), context);

    return { app: context.window.AppZlecenia, fetch, printed };
}

describe('kartoteka zleceń — wydruk używa świeżych danych z serwera', () => {
    test('printSingleZlecenie dociąga GET /:id i drukuje nowy kąt', async () => {
        const { app, printed } = loadZlecenia();
        await app.loadOrders();
        await app.printSingleZlecenie('po1');

        expect(printed).toHaveLength(1);
        expect(printed[0]).toBe('KAT=90');
    });

    test('printSingleEtykieta dociąga GET /:id i drukuje nowy kąt', async () => {
        const { app, printed } = loadZlecenia();
        await app.loadOrders();
        await app.printSingleEtykieta('po1');

        expect(printed).toHaveLength(1);
        expect(printed[0]).toBe('KAT=90');
    });

    test('fallback: brak świeżych danych = wydruk z ostatnio wczytanej listy', async () => {
        const { app, printed } = loadZlecenia({ detailOk: false });
        await app.loadOrders();
        await app.printSingleZlecenie('po1');

        expect(printed).toHaveLength(1);
        expect(printed[0]).toBe('KAT=45');
    });
});
