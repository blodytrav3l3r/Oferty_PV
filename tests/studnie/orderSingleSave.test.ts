// @ts-nocheck -- vm sandbox, celowy brak typow dla public/js
import fs from 'fs';
import path from 'path';
import vm from 'vm';

function loadOrderHelpers(fetchImpl: any, extra: any = {}) {
    const toasts: string[] = [];
    const context: any = {
        window: {},
        Blob,
        fetch: fetchImpl,
        authHeaders: () => ({}),
        showToast: (msg: string) => toasts.push(String(msg)),
        logger: { info: () => {}, warn: () => {}, error: () => {} },
        structuredClone: (obj: any) => JSON.parse(JSON.stringify(obj)),
        ordersStudnie: [{ id: 'o1', wells: [], updatedAt: 'srv-t' }],
        ...extra
    };
    const code = fs.readFileSync(
        path.join(__dirname, '../../public/js/studnie/orderHelpers.js'),
        'utf8'
    );
    vm.createContext(context);
    vm.runInContext(code, context);
    return { w: context.window, toasts, context };
}

function okRes() {
    return { ok: true, status: 200, json: async () => ({}) };
}

describe('P1 HIGH — saveSingleOrderStudnie (frontend)', () => {
    test('putSingleOrderStudnie wysyła TYLKO 1 zamówienie + baseUpdatedAt', async () => {
        const calls: any[] = [];
        const { w } = loadOrderHelpers(async (url: string, opts: any) => {
            calls.push({ url, opts });
            return okRes();
        });
        const order = {
            id: 'o1',
            wells: [{ id: 'w1' }],
            updatedAt: 't-new',
            _baseUpdatedAt: 't-base',
            originalSnapshot: { slimWells: [] }
        };
        const saved = await w.putSingleOrderStudnie(order);
        expect(saved).toBe(true);
        expect(calls).toHaveLength(1);
        expect(calls[0].url).toBe('/api/orders-studnie');
        const body = JSON.parse(calls[0].opts.body);
        expect(body.data).toHaveLength(1);
        expect(body.data[0].id).toBe('o1');
        expect(body.baseUpdatedAt).toBe('t-base');
        expect(order._baseUpdatedAt).toBe('t-new');
    });

    test('patchSingleOrderStudnie wysyła PATCH /:id z baseUpdatedAt', async () => {
        const calls: any[] = [];
        const { w } = loadOrderHelpers(async (url: string, opts: any) => {
            calls.push({ url, opts });
            return okRes();
        });
        const order = { id: 'o1', wells: [], updatedAt: 't-new', _baseUpdatedAt: 't-base' };
        const saved = await w.patchSingleOrderStudnie(order, { wells: [] });
        expect(saved).toBe(true);
        expect(calls[0].url).toBe('/api/orders-studnie/o1');
        expect(calls[0].opts.method).toBe('PATCH');
        expect(JSON.parse(calls[0].opts.body).baseUpdatedAt).toBe('t-base');
    });

    test('P1 PATCH: helper dokłada version gdy number', async () => {
        const calls: any[] = [];
        const { w } = loadOrderHelpers(async (url: string, opts: any) => {
            calls.push({ url, opts });
            return okRes();
        });
        const order = {
            id: 'o1',
            wells: [],
            updatedAt: 't-new',
            _baseUpdatedAt: 't-base',
            version: 7
        };
        const saved = await w.patchSingleOrderStudnie(order, { wells: [] });
        expect(saved).toBe(true);
        expect(JSON.parse(calls[0].opts.body).version).toBe(7);
    });

    test('P1 PATCH: brak version w obiekcie → payload bez pola version (kompatybilność)', async () => {
        const calls: any[] = [];
        const { w } = loadOrderHelpers(async (url: string, opts: any) => {
            calls.push({ url, opts });
            return okRes();
        });
        const order = { id: 'o1', wells: [], updatedAt: 't-new', _baseUpdatedAt: 't-base' };
        const saved = await w.patchSingleOrderStudnie(order, { wells: [] });
        expect(saved).toBe(true);
        expect(JSON.parse(calls[0].opts.body)).not.toHaveProperty('version');
    });

    test('409 → handleOrderConflict scala kopię serwerową i zwraca false', async () => {
        const serverOrder = { id: 'o1', wells: [{ id: 'w9' }], updatedAt: 'srv-new' };
        const { w, toasts, context } = loadOrderHelpers(async () => ({
            ok: false,
            status: 409,
            json: async () => ({ serverOrder })
        }));
        const order = { id: 'o1', wells: [], updatedAt: 't-new', _baseUpdatedAt: 't-base' };
        const saved = await w.patchSingleOrderStudnie(order, { wells: [] });
        expect(saved).toBe(false);
        expect(order.wells).toEqual([{ id: 'w9' }]);
        expect(order._baseUpdatedAt).toBe('srv-new');
        expect(context.ordersStudnie[0].wells).toEqual([{ id: 'w9' }]);
        expect(toasts.some((t) => t.includes('międzyczasie'))).toBe(true);
    });

    test('P2/P3: sukces PATCH przyjmuje version serwera i synchronizuje listę', async () => {
        const { w, context } = loadOrderHelpers(async () => ({
            ok: true,
            status: 200,
            json: async () => ({ ok: true, version: 8, updatedAt: 'srv-8' })
        }));
        const order = {
            id: 'o1',
            wells: [],
            version: 7,
            updatedAt: 't-new',
            _baseUpdatedAt: 't-base'
        };
        const saved = await w.patchSingleOrderStudnie(order, { wells: [] });
        expect(saved).toBe(true);
        expect(order.version).toBe(8);
        expect(order._baseUpdatedAt).toBe('srv-8');
        expect(context.ordersStudnie[0].version).toBe(8);
        expect(context.ordersStudnie[0]._baseUpdatedAt).toBe('srv-8');
    });

    test('P2/P3: sukces PUT przyjmuje version serwera (bez +1 po stronie klienta)', async () => {
        const { w, context } = loadOrderHelpers(async () => ({
            ok: true,
            status: 200,
            json: async () => ({ ok: true, version: 2, updatedAt: 'srv-2' })
        }));
        const order = {
            id: 'o1',
            wells: [{ id: 'w1' }],
            updatedAt: 't-new',
            _baseUpdatedAt: 't-base',
            originalSnapshot: { slimWells: [] }
        };
        const saved = await w.putSingleOrderStudnie(order);
        expect(saved).toBe(true);
        // Serwer SSoT: 2, a nie optymistyczne +1 z undefined.
        expect(order.version).toBe(2);
        expect(order._baseUpdatedAt).toBe('srv-2');
        expect(context.ordersStudnie[0].version).toBe(2);
    });

    test('P3: legacy sukces bez version nie nadpisuje wersji klienta', async () => {
        const { w } = loadOrderHelpers(async () => ({
            ok: true,
            status: 200,
            json: async () => ({})
        }));
        const order = {
            id: 'o1',
            wells: [],
            version: 7,
            updatedAt: 't-new',
            _baseUpdatedAt: 't-base'
        };
        const saved = await w.patchSingleOrderStudnie(order, { wells: [] });
        expect(saved).toBe(true);
        expect(order.version).toBe(7);
        expect(order._baseUpdatedAt).toBe('t-new');
    });

    test('P3: 409 scala version serwera (retry nie zapętla VERSION_CONFLICT)', async () => {
        const serverOrder = {
            id: 'o1',
            wells: [{ id: 'w9' }],
            updatedAt: 'srv-new',
            version: 9
        };
        const { w, context } = loadOrderHelpers(
            async () => ({
                ok: false,
                status: 409,
                json: async () => ({ serverOrder, serverVersion: 9 })
            }),
            { orderEditMode: { orderId: 'o1', order: { id: 'o1', version: 7 } } }
        );
        const order = {
            id: 'o1',
            wells: [],
            version: 7,
            updatedAt: 't-new',
            _baseUpdatedAt: 't-base'
        };
        const saved = await w.patchSingleOrderStudnie(order, { wells: [] });
        expect(saved).toBe(false);
        expect(order.version).toBe(9);
        expect(order._baseUpdatedAt).toBe('srv-new');
        expect(context.ordersStudnie[0].version).toBe(9);
        expect(context.ordersStudnie[0]._baseUpdatedAt).toBe('srv-new');
    });
});
