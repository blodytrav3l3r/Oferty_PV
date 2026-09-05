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
});
