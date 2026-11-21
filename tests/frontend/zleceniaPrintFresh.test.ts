// @ts-nocheck -- vm sandbox, celowy brak typow dla public/js
import fs from 'fs';
import vm from 'vm';

const SCRIPT = 'public/js/spa/zlecenia.js';

/**
 * Regresja: wydruk z kartoteki #/zlecenia czytał kopię w RAM (odświeżaną co
 * 60 s), więc po zapisie w edytorze studni drukował parametry sprzed zmiany.
 * Wydruk musi dociągnąć rekord z GET /production/:id.
 */
function loadZlecenia(
    options: {
        detailOk?: boolean;
        orders?: Array<{
            id: string;
            katStopni: string;
            productionOrderNumber: string;
            wellName: string;
            productionOrderPrintNumber?: string;
            dbSalesOrderNumber?: string;
        }>;
        failedDetailId?: string;
        malformedDetailId?: string;
        confirmPrint?: boolean;
    } = {}
) {
    const detailOk = options.detailOk !== false;
    const listedOrders = options.orders || [
        { id: 'po1', katStopni: '45', productionOrderNumber: 'N/1', wellName: 'Studnia 1' }
    ];
    const printed: string[] = [];
    const toasts: string[] = [];
    const elements: Record<string, { value?: string; addEventListener?: () => void }> = {
        'zlecenia-date-from': { value: '2026-01-01', addEventListener() {} },
        'zlecenia-date-to': { value: '', addEventListener() {} }
    };
    const fetch = jest.fn(async (url: string) => {
        if (url.startsWith('/api/orders-studnie/production/search')) {
            return {
                ok: true,
                json: async () => ({
                    data: listedOrders,
                    totalCount: listedOrders.length,
                    hasMore: false
                })
            };
        }
        const detailMatch = url.match(/^\/api\/orders-studnie\/production\/([^/?]+)/);
        if (detailMatch) {
            const id = decodeURIComponent(detailMatch[1]);
            if (!detailOk || id === options.failedDetailId) {
                return { ok: false, json: async () => ({ error: 'not found' }) };
            }
            const listedOrder = listedOrders.find((order) => order.id === id);
            return {
                ok: true,
                json: async () => ({
                    data: {
                        ...listedOrder,
                        id: id === options.malformedDetailId ? 'unexpected-id' : id,
                        katStopni: '90'
                    }
                })
            };
        }
        return { ok: true, json: async () => ({ counts: {} }) };
    });
    const context: Record<string, any> = {
        AbortController,
        URLSearchParams,
        fetch,
        authHeaders: () => ({}),
        logger: { info() {}, warn() {}, error() {} },
        showToast: (message: string) => toasts.push(message),
        appConfirm: async () => options.confirmPrint !== false,
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
                updateSelectAllState: (_total: number, selected: number) => (selected > 0 ? 1 : 0),
                updateBatchBar() {},
                showError() {}
            },
            fetchTemplate: async (path: string) =>
                path.includes('etykieta')
                    ? '<html><head><title>Etykieta</title></head><body><div class="page">{{NR_ZLECENIA}}</div><!-- KONIEC BLOKU "page" --></body></html>'
                    : '<html><head><title>Zlecenie Produkcyjne {{NR_ZLECENIA}}</title></head><body><div class="page">{{NR_ZLECENIA}}</div></body></html>',
            silentPrint: (html: string) => printed.push(html),
            applyPrintTokens: (s: string) => s,
            buildZlecenieFromPO: (tpl: string, po: any) => {
                const page = '<div class="page">KAT=' + po.katStopni + '</div>';
                return tpl.includes('<html')
                    ? '<html><head><title>Zlecenie Produkcyjne</title></head><body>' +
                          page +
                          '</body></html>'
                    : page;
            },
            buildEtykietaFromPO: (tpl: string, po: any) => {
                const page = '<div class="page">KAT=' + po.katStopni + '</div>';
                return tpl.includes('<html')
                    ? '<html><head><title>Etykieta</title></head><body>' + page + '</body></html>'
                    : page;
            },
            buildZlecenieFromPageBlock: () => '<div class="page">INNY BLOK</div>',
            buildEtykietaPageBlock: () => '<div class="page">INNY BLOK</div>'
        },
        setInterval: () => 1,
        clearInterval() {}
    };

    vm.createContext(context);
    vm.runInContext(fs.readFileSync(SCRIPT, 'utf8'), context);

    return { app: context.window.AppZlecenia, fetch, printed, toasts };
}

describe('kartoteka zleceń — wydruk używa świeżych danych z serwera', () => {
    test('printSingleZlecenie dociąga GET /:id i drukuje nowy kąt', async () => {
        const { app, printed } = loadZlecenia();
        await app.loadOrders();
        await app.printSingleZlecenie('po1');

        expect(printed).toHaveLength(1);
        expect(printed[0]).toContain('KAT=90');
    });

    test('ustawia nazwę pojedynczego zlecenia z numeru i nazwy studni', async () => {
        const { app, printed } = loadZlecenia({
            orders: [
                {
                    id: 'po1',
                    katStopni: '45',
                    productionOrderNumber: 'N/0003/26',
                    productionOrderPrintNumber: 'LK/0003/26',
                    wellName: 's2'
                }
            ]
        });
        await app.loadOrders();
        await app.printSingleZlecenie('po1');

        expect(printed[0]).toContain('<title>N000326 s2</title>');
    });

    test('printSingleEtykieta dociąga GET /:id i drukuje nowy kąt', async () => {
        const { app, printed } = loadZlecenia();
        await app.loadOrders();
        await app.printSingleEtykieta('po1');

        expect(printed).toHaveLength(1);
        expect(printed[0]).toContain('KAT=90');
    });

    test('ustawia taką samą nazwę pliku dla pojedynczej etykiety', async () => {
        const { app, printed } = loadZlecenia({
            orders: [
                {
                    id: 'po1',
                    katStopni: '45',
                    productionOrderNumber: 'N/0003/26',
                    productionOrderPrintNumber: 'LK/0003/26',
                    wellName: 's2'
                }
            ]
        });
        await app.loadOrders();
        await app.printSingleEtykieta('po1');

        expect(printed[0]).toContain('<title>N000326 s2</title>');
    });

    test('nie drukuje nieaktualnej kopii, gdy pobranie świeżego rekordu się nie powiedzie', async () => {
        const { app, fetch, printed, toasts } = loadZlecenia({ detailOk: false });
        await app.loadOrders();
        await app.printSingleZlecenie('po1');

        expect(printed).toHaveLength(0);
        expect(toasts.join(' ')).toContain('N/1');
        expect(fetch.mock.calls.some(([url]) => String(url).includes('print-count'))).toBe(false);
    });

    test('przerywa cały wsad i wskazuje zlecenie, którego danych nie pobrano', async () => {
        const { app, fetch, printed, toasts } = loadZlecenia({
            orders: [
                { id: 'po1', katStopni: '45', productionOrderNumber: 'N/1', wellName: 'Studnia 1' },
                { id: 'po2', katStopni: '30', productionOrderNumber: 'N/2', wellName: 'Studnia 2' }
            ],
            failedDetailId: 'po2'
        });
        await app.loadOrders();
        app.selectAllRows();
        await app.printBatchZlecenia();

        expect(printed).toHaveLength(0);
        expect(toasts.join(' ')).toContain('N/2');
        expect(fetch.mock.calls.some(([url]) => String(url).includes('print-count'))).toBe(false);
    });

    test('błąd pobrania etykiety w jednym zleceniu blokuje cały wsad', async () => {
        const { app, fetch, printed, toasts } = loadZlecenia({
            orders: [
                { id: 'po1', katStopni: '45', productionOrderNumber: 'N/1', wellName: 'Studnia 1' },
                { id: 'po2', katStopni: '30', productionOrderNumber: 'N/2', wellName: 'Studnia 2' }
            ],
            failedDetailId: 'po2'
        });
        await app.loadOrders();
        app.selectAllRows();
        await app.printBatchEtykiety();

        expect(printed).toHaveLength(0);
        expect(toasts.join(' ')).toContain('N/2');
        expect(fetch.mock.calls.some(([url]) => String(url).includes('print-count'))).toBe(false);
    });

    test('odrzuca nieprawidłową odpowiedź szczegółów zamiast drukować jej dane', async () => {
        const { app, printed, toasts } = loadZlecenia({ malformedDetailId: 'po1' });
        await app.loadOrders();
        await app.printSingleEtykieta('po1');

        expect(printed).toHaveLength(0);
        expect(toasts.join(' ')).toContain('N/1');
    });

    test('zawartość zlecenia jest taka sama w druku pojedynczym i seryjnym', async () => {
        const { app, printed } = loadZlecenia();
        await app.loadOrders();
        await app.printSingleZlecenie('po1');
        app.selectAllRows();
        await app.printBatchZlecenia();

        expect(printed).toHaveLength(2);
        expect(printed[1]).toContain('KAT=90');
        expect(printed[1]).toContain('<title>Zlecenia produkcyjne — 1 szt.</title>');
        expect(printed[1]).not.toContain('{{NR_ZLECENIA}}');
    });

    test('zawartość etykiety jest taka sama w druku pojedynczym i seryjnym', async () => {
        const { app, printed } = loadZlecenia();
        await app.loadOrders();
        await app.printSingleEtykieta('po1');
        app.selectAllRows();
        await app.printBatchEtykiety();

        expect(printed).toHaveLength(2);
        expect(printed[1]).toContain('KAT=90');
        expect(printed[1]).toContain('<title>Etykiety zleceń — 1 szt.</title>');
    });

    test('nazywa wsady według numeru zamówienia i rodzaju dokumentu', async () => {
        const { app, printed } = loadZlecenia({
            orders: [
                {
                    id: 'po1',
                    katStopni: '45',
                    productionOrderNumber: 'N/1',
                    wellName: 's2',
                    dbSalesOrderNumber: 'ZS/00013/2026'
                }
            ]
        });
        await app.loadOrders();
        app.selectAllRows();
        await app.printBatchZlecenia();
        await app.printBatchEtykiety();

        expect(printed).toHaveLength(2);
        expect(printed[0]).toContain('<title>ZS000132026 zlecenia</title>');
        expect(printed[1]).toContain('<title>ZS000132026 etykiety</title>');
    });

    test('anulowanie potwierdzenia nie drukuje i nie zwiększa licznika', async () => {
        const { app, fetch, printed } = loadZlecenia({ confirmPrint: false });
        await app.loadOrders();
        await app.printSingleZlecenie('po1');

        expect(printed).toHaveLength(0);
        expect(fetch.mock.calls.some(([url]) => String(url).includes('print-count'))).toBe(false);
    });

    test('anulowanie wsadu nie drukuje i nie zwiększa liczników', async () => {
        const { app, fetch, printed } = loadZlecenia({ confirmPrint: false });
        await app.loadOrders();
        app.selectAllRows();
        await app.printBatchEtykiety();

        expect(printed).toHaveLength(0);
        expect(fetch.mock.calls.some(([url]) => String(url).includes('print-count'))).toBe(false);
    });

    test('po potwierdzeniu wsadu wysyła liczniki dla wydrukowanych zleceń', async () => {
        const { app, fetch, printed } = loadZlecenia({
            orders: [
                { id: 'po1', katStopni: '45', productionOrderNumber: 'N/1', wellName: 'Studnia 1' },
                { id: 'po2', katStopni: '30', productionOrderNumber: 'N/2', wellName: 'Studnia 2' }
            ]
        });
        await app.loadOrders();
        app.selectAllRows();
        await app.printBatchZlecenia();

        expect(printed).toHaveLength(1);
        const countRequest = fetch.mock.calls.find(([url]) =>
            String(url).endsWith('/print-count-batch')
        );
        expect(countRequest).toBeDefined();
        expect(JSON.parse(countRequest[1].body)).toEqual({
            ids: ['po1', 'po2'],
            kind: 'zlecenie'
        });
    });
});
