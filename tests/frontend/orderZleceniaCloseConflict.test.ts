import fs from 'fs';
import path from 'path';
import vm from 'vm';

const JS_DIR = path.join(__dirname, '../../public/js/studnie');

interface ApiResponse {
    ok: boolean;
    body: Record<string, unknown>;
}

function loadDataLayer(responses: ApiResponse[], options: { gateFirst?: boolean } = {}) {
    const requests: Array<{ url: string; options: RequestInit }> = [];
    let releaseFirst!: (response: ApiResponse) => void;
    const firstResponse = new Promise<ApiResponse>((resolve) => {
        releaseFirst = resolve;
    });
    const context: any = {
        console,
        document: {},
        structuredClone: (value: unknown) => JSON.parse(JSON.stringify(value)),
        logger: { debug() {}, info() {}, warn() {}, error() {} },
        authHeaders: () => ({}),
        productionOrders: []
    };
    context.fetch = async (url: string, requestOptions: RequestInit) => {
        requests.push({ url, options: requestOptions });
        const response =
            options.gateFirst && requests.length === 1
                ? await firstResponse
                : responses.shift() || { ok: true, body: { saved: [] } };
        return { ok: response.ok, json: async () => response.body };
    };
    context.window = context;
    context.globalThis = context;
    vm.createContext(context);
    vm.runInContext(fs.readFileSync(path.join(JS_DIR, 'orderZleceniaData.js'), 'utf8'), context, {
        filename: 'orderZleceniaData.js'
    });
    return { context, requests, releaseFirst };
}

function loadModal(context: any) {
    const removeModal = jest.fn();
    const toasts: Array<{ message: string; type: string }> = [];
    context.document = {
        getElementById: (id: string) =>
            id === 'zlecenia-modal' ? { classList: { remove: removeModal } } : { value: '' },
        querySelector: () => null
    };
    context.appConfirm = async () => true;
    context.showToast = (message: string, type: string) => toasts.push({ message, type });
    context.syncSourceData = jest.fn(async () => {});
    context.zleceniaSelectedIdx = 0;
    context.zleceniaElementsList = [
        {
            well: { id: 'w1', name: 'S1', numer: 'SNR1', dn: 1000, przejscia: [] },
            product: { id: 'product-1', name: 'Krąg' },
            elementIndex: 0,
            configItem: { _elemId: 'elem-1' }
        }
    ];
    context.pzGuard = {
        findPzForElement: () => context.productionOrders[0]
    };
    context.currentUser = { id: 'u1', username: 'tester' };
    context.wells = [];
    context.wellsSnapshotBeforeZlecenia = null;
    context.buildEtykietaElementsSnapshot = () => [];
    context.getStudniaDIN = () => '';
    context.renderZleceniaList = jest.fn();
    context.renderZleceniaWellConfig = jest.fn();
    context.populateZleceniaForm = jest.fn();
    context.refreshGlobalMetrics = jest.fn();
    vm.runInContext(
        fs.readFileSync(path.join(JS_DIR, 'orderZleceniaHelpers.js'), 'utf8'),
        context,
        {
            filename: 'orderZleceniaHelpers.js'
        }
    );
    vm.runInContext(fs.readFileSync(path.join(JS_DIR, 'orderZleceniaModal.js'), 'utf8'), context, {
        filename: 'orderZleceniaModal.js'
    });
    return { removeModal, toasts };
}

function getSavedIds(request: { options: RequestInit }) {
    const body = JSON.parse(String(request.options.body));
    return body.data.map((po: { id: string }) => po.id);
}

function getSavedOrders(request: { options: RequestInit }) {
    return JSON.parse(String(request.options.body)).data as Array<Record<string, unknown>>;
}

describe('zamykanie modalu zleceń produkcyjnych przy konflikcie wersji', () => {
    test('zachowuje metadane VERSION_CONFLICT z odpowiedzi API', async () => {
        const { context, requests } = loadDataLayer([
            {
                ok: false,
                body: {
                    error: 'Zlecenie zmienione przez innego użytkownika',
                    code: 'VERSION_CONFLICT',
                    serverVersion: 3
                }
            }
        ]);

        let caughtError: any;
        try {
            await context.saveProductionOrdersData([{ id: 'pz-1', version: 2 }]);
        } catch (error) {
            caughtError = error;
        }

        expect(caughtError.code).toBe('VERSION_CONFLICT');
        expect(caughtError.serverVersion).toBe(3);
        expect(getSavedIds(requests[0])).toEqual(['pz-1']);
    });

    test('edycja PZ wysyła tylko zmienione zlecenie', async () => {
        const { context, requests } = loadDataLayer([
            { ok: true, body: { saved: [{ id: 'pz-1', version: 3 }] } }
        ]);
        context.productionOrders = [
            { id: 'pz-1', version: 2, productionOrderNumber: 'PZ-1' },
            { id: 'pz-stale', version: 5, productionOrderNumber: 'PZ-2' }
        ];
        loadModal(context);

        await context.saveProductionOrder();

        expect(requests).toHaveLength(1);
        expect(getSavedIds(requests[0])).toEqual(['pz-1']);
        expect(context.productionOrders[0].version).toBe(3);
    });

    test('akceptacja i cofnięcie akceptacji wysyłają tylko wybrane PZ', async () => {
        const changedOrder = {
            id: 'pz-1',
            version: 2,
            productionOrderNumber: 'PZ-1',
            status: 'draft'
        };
        const { context, requests } = loadDataLayer([
            { ok: true, body: { saved: [{ id: 'pz-1', version: 3 }] } },
            { ok: true, body: { saved: [{ id: 'pz-1', version: 4 }] } }
        ]);
        context.productionOrders = [changedOrder, { id: 'pz-stale', version: 5 }];
        context.zleceniaSelectedIdx = 0;
        context.zleceniaElementsList = [{ well: { id: 'w1' }, configItem: { _elemId: 'e1' } }];
        context.pzGuard = { findPzForElement: () => changedOrder };
        context.saveProductionOrder = jest.fn(async () => {});
        context.appConfirm = async () => true;
        context.currentUser = { username: 'tester' };
        context.renderZleceniaList = jest.fn();
        context.renderZleceniaWellConfig = jest.fn();
        context.populateZleceniaForm = jest.fn();
        context.refreshGlobalMetrics = jest.fn();
        context.refreshAll = jest.fn();
        context.showToast = jest.fn();

        await context.acceptProductionOrder();
        await context.revokeProductionOrder();

        expect(requests.map(getSavedIds)).toEqual([['pz-1'], ['pz-1']]);
        expect(changedOrder.version).toBe(4);
        expect(changedOrder.status).toBe('draft');
    });

    test('zamknięcie ponawia tylko nieudany zapis, pomijając nieaktualne inne PZ', async () => {
        const changedOrder = { id: 'pz-1', version: 2 };
        const staleUnrelatedOrder = { id: 'pz-2', version: 5 };
        const { context, requests } = loadDataLayer([
            {
                ok: false,
                body: {
                    error: 'Zlecenie zmienione przez innego użytkownika',
                    code: 'VERSION_CONFLICT',
                    serverVersion: 3
                }
            },
            { ok: true, body: { saved: [{ id: 'pz-1', version: 3 }] } }
        ]);
        context.productionOrders = [changedOrder, staleUnrelatedOrder];
        const { removeModal, toasts } = loadModal(context);

        await expect(context.saveProductionOrdersData([changedOrder])).rejects.toMatchObject({
            code: 'VERSION_CONFLICT',
            serverVersion: 3
        });

        await expect(context.closeZleceniaModal()).resolves.toBeUndefined();

        expect(requests).toHaveLength(2);
        expect(requests.map(getSavedIds)).toEqual([['pz-1'], ['pz-1']]);
        expect(toasts[0].message).toMatch(/Zapisano zmiany studni/);
        expect(removeModal).toHaveBeenCalledWith('active');
    });

    test('konflikt oczekującego PZ pozostawia modal otwarty i nie odrzuca obietnicy', async () => {
        const changedOrder = { id: 'pz-1', version: 2 };
        const { context, requests } = loadDataLayer([
            {
                ok: false,
                body: {
                    error: 'Zlecenie zmienione przez innego użytkownika',
                    code: 'VERSION_CONFLICT',
                    serverVersion: 3
                }
            },
            {
                ok: false,
                body: {
                    error: 'Zlecenie zmienione przez innego użytkownika',
                    code: 'VERSION_CONFLICT',
                    serverVersion: 3
                }
            }
        ]);
        context.productionOrders = [changedOrder, { id: 'pz-stale', version: 5 }];
        const { removeModal, toasts } = loadModal(context);

        await expect(context.saveProductionOrdersData([changedOrder])).rejects.toMatchObject({
            code: 'VERSION_CONFLICT'
        });
        await expect(context.closeZleceniaModal()).resolves.toBeUndefined();

        expect(requests.map(getSavedIds)).toEqual([['pz-1'], ['pz-1']]);
        expect(toasts[0].message).toMatch(/Konflikt wersji/);
        expect(removeModal).not.toHaveBeenCalled();
    });

    test('zamknięcie czeka na aktywny zapis i kolejkuje inne oczekujące PZ', async () => {
        const firstOrder = { id: 'pz-1', version: 2 };
        const secondOrder = { id: 'pz-2', version: 1 };
        const { context, requests, releaseFirst } = loadDataLayer(
            [{ ok: true, body: { saved: [{ id: 'pz-2', version: 2 }] } }],
            { gateFirst: true }
        );
        context.productionOrders = [firstOrder, secondOrder];
        const { removeModal } = loadModal(context);

        const firstSave = context.saveProductionOrdersData([firstOrder]);
        await Promise.resolve();
        const secondSave = context.saveProductionOrdersData([secondOrder]);
        const close = context.closeZleceniaModal();
        releaseFirst({ ok: true, body: { saved: [{ id: 'pz-1', version: 3 }] } });

        await Promise.all([firstSave, secondSave, close]);

        expect(requests.map(getSavedIds)).toEqual([['pz-1'], ['pz-2']]);
        expect(removeModal).toHaveBeenCalledWith('active');
    });

    test('nowsza edycja tego samego PZ nie ginie podczas aktywnego zapisu', async () => {
        const order = { id: 'pz-1', version: 2, uwagi: 'stan A' };
        const { context, requests, releaseFirst } = loadDataLayer(
            [{ ok: true, body: { saved: [{ id: 'pz-1', version: 4 }] } }],
            { gateFirst: true }
        );
        context.productionOrders = [order];

        const firstSave = context.saveProductionOrdersData([order]);
        await Promise.resolve();
        order.uwagi = 'nowszy stan B';
        const secondSave = context.saveProductionOrdersData([order]);
        releaseFirst({ ok: true, body: { saved: [{ id: 'pz-1', version: 3 }] } });

        await Promise.all([firstSave, secondSave]);

        expect(requests).toHaveLength(2);
        expect(getSavedOrders(requests[0])[0].uwagi).toBe('stan A');
        expect(getSavedOrders(requests[1])[0].uwagi).toBe('nowszy stan B');
        expect(order.version).toBe(4);
    });

    test('po błędzie drugiego chunka ponawia tylko niezapisany rekord', async () => {
        const orders = Array.from({ length: 201 }, (_, index) => ({
            id: `pz-${index + 1}`,
            version: 1
        }));
        const { context, requests } = loadDataLayer([
            {
                ok: true,
                body: { saved: orders.slice(0, 200).map((po) => ({ id: po.id, version: 2 })) }
            },
            {
                ok: false,
                body: {
                    error: 'Zlecenie zmienione przez innego użytkownika',
                    code: 'VERSION_CONFLICT',
                    serverVersion: 2
                }
            },
            { ok: true, body: { saved: [{ id: 'pz-201', version: 2 }] } }
        ]);
        context.productionOrders = orders;
        loadModal(context);

        await expect(context.saveProductionOrdersData(orders)).rejects.toMatchObject({
            code: 'VERSION_CONFLICT'
        });
        await expect(context.closeZleceniaModal()).resolves.toBeUndefined();

        expect(requests.map((request) => getSavedIds(request).length)).toEqual([200, 1, 1]);
        expect(getSavedIds(requests[2])).toEqual(['pz-201']);
    });

    test('zamknięcie zapisuje zmiany oznaczone jako oczekujące (bez wcześniejszego „Zapisz”)', async () => {
        const edited = { id: 'pz-1', version: 2, katStopni: '90' };
        const { context, requests } = loadDataLayer([
            { ok: true, body: { saved: [{ id: 'pz-1', version: 3 }] } }
        ]);
        context.productionOrders = [edited, { id: 'pz-stale', version: 5 }];
        const { toasts } = loadModal(context);

        context.markProductionOrderPending(edited);
        await context.closeZleceniaModal();

        expect(requests.map(getSavedIds)).toEqual([['pz-1']]);
        expect(getSavedOrders(requests[0])[0].katStopni).toBe('90');
        expect(toasts[0].message).toMatch(/Zapisano zmiany studni/);
    });

    test('zaakceptowane PZ nie trafiają do oczekujących zapisu', async () => {
        const { context, requests } = loadDataLayer([]);
        const accepted = { id: 'pz-acc', version: 2, status: 'accepted' };
        context.productionOrders = [accepted];

        context.markProductionOrderPending(accepted);
        await context.saveProductionOrdersData(context.productionOrders, { onlyPending: true });

        expect(requests).toHaveLength(0);
    });

    test('nie zapisuje całej listy PZ przy zamknięciu bez oczekujących zmian', async () => {
        const { context, requests } = loadDataLayer([]);
        context.productionOrders = [
            { id: 'pz-stale-1', version: 1 },
            { id: 'pz-stale-2', version: 4 }
        ];
        const { removeModal } = loadModal(context);

        await expect(context.closeZleceniaModal()).resolves.toBeUndefined();

        expect(requests).toHaveLength(0);
        expect(removeModal).toHaveBeenCalledWith('active');
    });
});
