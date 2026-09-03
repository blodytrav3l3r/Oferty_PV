import fs from 'fs';
import path from 'path';
import vm from 'vm';

describe('offerDiscountsPopup — Zamknij/X cofa niezapisane rabaty', () => {
    let ctx: any;
    let modalStub: any;
    let appConfirmCalls: any[];
    let appConfirmResult: boolean;

    function makeModalStub() {
        let active = false;
        return {
            classList: {
                add: (c: string) => {
                    if (c === 'active') active = true;
                },
                remove: (c: string) => {
                    if (c === 'active') active = false;
                },
                contains: (c: string) => (c === 'active' ? active : false)
            },
            dataset: {} as Record<string, string>,
            listeners: {} as Record<string, ((...args: any[]) => void)[]>,
            addEventListener: function (type: string, fn: (...args: any[]) => void) {
                (this.listeners[type] = this.listeners[type] || []).push(fn);
            }
        };
    }

    function loadContext() {
        modalStub = makeModalStub();
        appConfirmCalls = [];
        appConfirmResult = true;
        // window === global: odwzorowanie semantyki przeglądarki
        // (window.x = fn tworzy też globalne x)
        const context: any = {
            wells: [{ id: 'w1', pehdDiscount: 0, malowanieWewCena: 0, malowanieZewCena: 0 }],
            wellDiscounts: { '1000': { dennica: 0, nadbudowa: 0, preco: 0, pehd: 0 } },
            structuredClone: (v: unknown) => JSON.parse(JSON.stringify(v)),
            document: {
                getElementById: (id: string) => (id === 'offer-discounts-modal' ? modalStub : null),
                addEventListener: () => {}
            },
            appConfirm: async (...args: any[]) => {
                appConfirmCalls.push(args);
                return appConfirmResult;
            }
        };
        context.window = context;
        vm.createContext(context);
        const code = fs.readFileSync(
            path.join(__dirname, '../../public/js/studnie/offerDiscountsPopup.js'),
            'utf8'
        );
        vm.runInContext(code, context);
        return context;
    }

    beforeEach(() => {
        ctx = loadContext();
    });

    test('bez zmian: Zamknij zamyka po cichu, bez pytania', async () => {
        vm.runInContext('openOfferDiscountsPopup()', ctx);
        expect(modalStub.classList.contains('active')).toBe(true);
        await vm.runInContext('handleOfferDiscountsCancel()', ctx);
        expect(appConfirmCalls.length).toBe(0);
        expect(modalStub.classList.contains('active')).toBe(false);
    });

    test('brudny rabat: pytanie "Niezapisane zmiany rabatów", Tak cofa zmiany', async () => {
        vm.runInContext('openOfferDiscountsPopup()', ctx);
        vm.runInContext(`window.wellDiscounts['1000'].dennica = 15`, ctx);
        await vm.runInContext('handleOfferDiscountsCancel()', ctx);
        expect(appConfirmCalls.length).toBe(1);
        expect(String(appConfirmCalls[0][1]?.title || '')).toMatch('Niezapisane zmiany');
        expect(ctx.window.wellDiscounts['1000'].dennica).toBe(0);
        expect(modalStub.classList.contains('active')).toBe(false);
    });

    test('brudny rabat: "Nie, wracam" zostawia okno i zmiany', async () => {
        vm.runInContext('openOfferDiscountsPopup()', ctx);
        vm.runInContext(`window.wellDiscounts['1000'].nadbudowa = 7`, ctx);
        appConfirmResult = false;
        await vm.runInContext('handleOfferDiscountsCancel()', ctx);
        expect(appConfirmCalls.length).toBe(1);
        expect(ctx.window.wellDiscounts['1000'].nadbudowa).toBe(7);
        expect(modalStub.classList.contains('active')).toBe(true);
    });

    test('brudny PEHD na studni: rollback przywraca pole studni', async () => {
        vm.runInContext('openOfferDiscountsPopup()', ctx);
        vm.runInContext('wells[0].pehdDiscount = 12', ctx);
        await vm.runInContext('handleOfferDiscountsCancel()', ctx);
        expect(appConfirmCalls.length).toBe(1);
        expect(ctx.wells[0].pehdDiscount).toBe(0);
        expect(modalStub.classList.contains('active')).toBe(false);
    });

    test('backdrop: klik w tło podpina ścieżkę anulowania', () => {
        vm.runInContext('openOfferDiscountsPopup()', ctx);
        expect(modalStub.dataset.dismissWired).toBe('1');
        expect((modalStub.listeners['click'] || []).length).toBe(1);
    });
});
