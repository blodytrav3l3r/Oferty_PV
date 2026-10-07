import fs from 'fs';
import path from 'path';
import vm from 'vm';

// Tryb zamówienia: popup rabatów ma tytuł Zamówienia, a Zastosuj
// zapisuje zamówienie (saveCurrentOrder), nie ofertę.
const BASE = path.join(__dirname, '../../public/js/studnie');

function loadContext(orderMode: boolean) {
    const titleStub: any = { innerHTML: '' };
    const modalStub: any = {
        classList: { add: () => {}, remove: () => {}, contains: () => false },
        dataset: {},
        addEventListener: () => {}
    };
    const calls: string[] = [];
    const context: any = {
        wells: [],
        wellDiscounts: {},
        structuredClone: (v: unknown) => JSON.parse(JSON.stringify(v)),
        document: {
            getElementById: (id: string) => {
                if (id === 'offer-discounts-modal') return modalStub;
                if (id === 'offer-discounts-modal-title') return titleStub;
                return null;
            },
            addEventListener: () => {}
        },
        appConfirm: async () => true,
        saveCurrentOrder: async () => {
            calls.push('order');
        },
        saveOfferStudnie: async () => {
            calls.push('offer');
        },
        showToast: () => {},
        renderSavedOffersStudnie: () => {}
    };
    if (orderMode) context.orderEditMode = { order: {} };
    context.window = context;
    vm.createContext(context);
    vm.runInContext(fs.readFileSync(path.join(BASE, 'offerDiscountsPopup.js'), 'utf8'), context);
    return { context, titleStub, calls };
}

describe('orderDiscountsPopup — tryb zamówienia vs oferty', () => {
    test('order: tytuł Zamówienia, Zastosuj → saveCurrentOrder', async () => {
        const { context, titleStub, calls } = loadContext(true);
        vm.runInContext('openOfferDiscountsPopup()', context);
        expect(titleStub.innerHTML).toMatch('Zamówienia');
        await vm.runInContext('handleOfferDiscountsSave()', context);
        expect(calls).toEqual(['order']);
    });

    test('oferta: tytuł Oferty, Zastosuj → saveOfferStudnie', async () => {
        const { context, titleStub, calls } = loadContext(false);
        vm.runInContext('openOfferDiscountsPopup()', context);
        expect(titleStub.innerHTML).toMatch('Oferty');
        await vm.runInContext('handleOfferDiscountsSave()', context);
        expect(calls).toEqual(['offer']);
    });
});

describe('offer footer — jeden binding zapisu (bez data-csp)', () => {
    test('btn-save-studnie-offer nie ma data-csp (onclick z renderOfferSummary)', () => {
        const html = fs.readFileSync(
            path.join(__dirname, '../../public/partials/studnie/offer.html'),
            'utf8'
        );
        const btn = html.match(/<button[^>]*id="btn-save-studnie-offer"[^>]*>/);
        expect(btn).not.toBeNull();
        expect(btn![0]).not.toMatch('data-csp');
    });
});
