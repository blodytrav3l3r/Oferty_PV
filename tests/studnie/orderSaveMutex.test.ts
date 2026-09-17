// @ts-nocheck -- vm sandbox, celowy brak typow dla public/js
// P5: mutex saveCurrentOrder/saveOrderStudnie — 1 request przy double-save,
// odblokowanie po błędzie (finally).
import fs from 'fs';
import path from 'path';
import vm from 'vm';

function loadOrderCrud(patchImpl: any) {
    const toasts: string[] = [];
    const patchCalls: any[] = [];
    const context: any = {
        window: {},
        document: { getElementById: () => null, querySelectorAll: () => [] },
        structuredClone: (obj: any) => JSON.parse(JSON.stringify(obj)),
        showToast: (msg: string) => toasts.push(String(msg)),
        logger: { info: () => {}, warn: () => {}, error: () => {} },
        authHeaders: () => ({}),
        fetch: async () => ({ ok: true, status: 200, json: async () => ({}) }),
        freezeWellPrices: () => {},
        calcWellStats: () => ({ price: 0, weight: 0 }),
        renderOrderModeBanner: () => {},
        patchSingleOrderStudnie: async (order: any, fields: any) => {
            patchCalls.push({ order, fields });
            return patchImpl(order, fields);
        },
        orderEditMode: {
            orderId: 'o1',
            order: { id: 'o1', updatedAt: 't0', _baseUpdatedAt: 't0', version: 1 }
        },
        wells: [],
        visiblePrzejsciaTypes: new Set(),
        offersStudnie: [],
        currentTransportMode: 'full',
        currentTransportSeparate: false
    };
    const code = fs.readFileSync(
        path.join(__dirname, '../../public/js/studnie/orderCrud.js'),
        'utf8'
    );
    vm.createContext(context);
    vm.runInContext(code, context);
    return { w: context.window, toasts, patchCalls, context };
}

describe('P5 — mutex zapisu zamówienia', () => {
    test('double-save → 1 PATCH, drugie wejście zwrócone natychmiast', async () => {
        let release!: (v: boolean) => void;
        const gate = new Promise<boolean>((resolve) => {
            release = resolve;
        });
        const { w, patchCalls } = loadOrderCrud(() => gate);
        const p1 = w.saveCurrentOrder();
        const p2 = w.saveCurrentOrder();
        // Mikro-tick: p1 wisi na gate, p2 przeszło przez guard bez PATCH.
        await Promise.resolve();
        await Promise.resolve();
        expect(patchCalls).toHaveLength(1);
        release(true);
        await p1;
        await p2;
        expect(patchCalls).toHaveLength(1);
    });

    test('mutex odblokowuje po sukcesie — kolejny zapis działa', async () => {
        const { w, patchCalls } = loadOrderCrud(async () => true);
        await w.saveCurrentOrder();
        await w.saveCurrentOrder();
        expect(patchCalls).toHaveLength(2);
    });

    test('mutex odblokowuje po wyjątku (finally) — kolejny zapis działa', async () => {
        let calls = 0;
        const { w, patchCalls } = loadOrderCrud(async () => {
            calls++;
            if (calls === 1) throw new Error('boom');
            return true;
        });
        await expect(w.saveCurrentOrder()).rejects.toThrow('boom');
        await w.saveCurrentOrder();
        expect(patchCalls).toHaveLength(2);
    });
});
