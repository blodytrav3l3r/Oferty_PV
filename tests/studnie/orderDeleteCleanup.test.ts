// @ts-nocheck -- vm sandbox, celowy brak typow dla public/js
import fs from 'fs';
import path from 'path';
import vm from 'vm';

// Kontrakt cache lookup zamowien (orderHelpers.js), na ktorym polega fix
// usuwania zamowienia: delete usuwa tylko studnie A, studnie B zostaja oznaczone,
// a jawna invalidacja po push w miejscu pokazuje nowe studnie od razu.
function loadCache(extra: any = {}) {
    const context: any = {
        window: {},
        Blob,
        normalizeId: (id: any) => {
            if (!id || typeof id !== 'string') return id;
            return id.includes(':') ? id.split(':').pop() : id;
        },
        logger: { info: () => {}, warn: () => {}, error: () => {} },
        ordersStudnie: [],
        editingOfferIdStudnie: null,
        ...extra
    };
    const code = fs.readFileSync(
        path.join(__dirname, '../../public/js/studnie/orderHelpers.js'),
        'utf8'
    );
    vm.createContext(context);
    vm.runInContext(code, context);
    return context;
}

const OFFER = 'offer_studnie_1';
const orderA = {
    id: 'order_A',
    offerId: OFFER,
    wells: [{ id: 'w1' }, { id: 'w2' }]
};
const orderB = {
    id: 'order_B',
    offerId: OFFER,
    wells: [{ id: 'w3' }]
};

describe('order lookup cache — delete usuwa tylko studnie usuwanego zamowienia', () => {
    test('po filter (delete A) studnie A odblokowane, studnia B nadal ordered', () => {
        const ctx = loadCache({ ordersStudnie: [orderA, orderB] });
        expect(ctx.getOrderedWellIds(OFFER)).toEqual(new Set(['w1', 'w2', 'w3']));

        // deleteOrderStudnie: ordersStudnie = filter(o.id !== orderId)
        ctx.ordersStudnie = ctx.ordersStudnie.filter((o: any) => o.id !== 'order_A');

        expect(ctx.getOrderedWellIds(OFFER)).toEqual(new Set(['w3']));
        expect(ctx.getOrderForWellId('w1', OFFER)).toBeNull();
        expect(ctx.getOrderForWellId('w3', OFFER)).toEqual(orderB);
        expect(
            ctx.getOfferOrderProgress(OFFER, [{ id: 'w1' }, { id: 'w2' }, { id: 'w3' }])
        ).toEqual({ ordered: 1, total: 3, percent: 33 });
    });

    test('push w miejscu + invalidacja pokazuje nowe studnie (fix stale-cache przy create)', () => {
        const ctx = loadCache({ ordersStudnie: [orderB] });
        expect(ctx.getOrderedWellIds(OFFER)).toEqual(new Set(['w3']));

        // finalizeOrderFromOffer: ordersStudnie.push(order) — ta sama referencja
        ctx.ordersStudnie.push(orderA);
        ctx.window._invalidateOrdersLookupCache();

        expect(ctx.getOrderedWellIds(OFFER)).toEqual(new Set(['w1', 'w2', 'w3']));
    });

    test('zamowienie z samym offerStudnieId (bez offerId) tez oznacza studnie', () => {
        const legacy = { id: 'order_legacy', offerStudnieId: OFFER, wells: [{ id: 'w9' }] };
        const ctx = loadCache({ ordersStudnie: [legacy] });
        expect(ctx.getOrderedWellIds(OFFER)).toEqual(new Set(['w9']));
        expect(ctx.getOrdersForOffer(OFFER)).toEqual([legacy]);
    });
});
