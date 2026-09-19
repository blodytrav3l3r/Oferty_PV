import fs from 'fs';
import path from 'path';
import vm from 'vm';

// Regresja: „czasem nie widać zamówienia, po przeklikaniu zakładek się pojawia".
// loadOrdersMap czyścił mapę PRZED fetchem i połykał !ok bez toasta —
// padnięte tło zostawiało pustą mapę do ręcznego odświeżenia.
describe('kartotekaActions loadOrdersMap — atomowa podmiana mapy', () => {
    let mod: any;
    let queue: any[];
    let toasts: string[];

    const okResp = (data: any) => ({ ok: true, status: 200, body: { data } });
    const failResp = (status: number) => ({ ok: false, status, body: {} });

    const ordStudnie = {
        id: 'ord-1',
        offerStudnieId: 'offer_studnie_1',
        orderNumber: 'LKZ/1'
    };

    function nextFetch(): Promise<any> {
        const next = queue.shift() || okResp([]);
        if (next.throw) throw new Error(next.throw);
        return Promise.resolve({
            ok: next.ok,
            status: next.status,
            json: async () => next.body
        });
    }

    beforeEach(() => {
        queue = [];
        toasts = [];
        const base = path.join(__dirname, '../../public/js/kartoteka');
        let code = fs.readFileSync(path.join(base, 'kartotekaActions.js'), 'utf8');
        code = code
            .replace(/^import .*$/m, 'const storageService = {};')
            .replace('export default', 'globalThis.__kartotekaActions =');
        const toastFn = (msg: string) => {
            toasts.push(String(msg));
        };
        const context: any = {
            console,
            setTimeout,
            clearTimeout,
            logger: { info() {}, warn() {}, error() {} },
            document: { getElementById: () => null },
            showToast: toastFn,
            fetch: nextFetch,
            window: null as any
        };
        context.window = { showToast: toastFn, escapeHtml: (s: unknown) => String(s ?? '') };
        vm.createContext(context);
        vm.runInContext(code, context);
        mod = context.__kartotekaActions;
        mod.ordersMap = new Map();
        mod._ordersRetryDelay = 0;
        mod.searchResults = null;
        mod.renderResults = () => {};
    });

    test('sukces: mapa wypełniona, zwraca true', async () => {
        queue.push(okResp([ordStudnie]), okResp([]));
        const res = await mod.loadOrdersMap(['offer_studnie_1']);
        expect(res).toBe(true);
        expect([...(mod.ordersMap.get('offer_studnie_1') || [])]).toHaveLength(1);
        expect(toasts).toHaveLength(0);
    });

    test('pad obu fetchy (!ok): stara mapa NIETKNIĘTA, false, toast raz', async () => {
        mod.ordersMap.set('offer_studnie_1', [ordStudnie]);
        queue.push(failResp(500), failResp(500));
        const res = await mod.loadOrdersMap(['offer_studnie_1'], false);
        expect(res).toBe(false);
        expect([...(mod.ordersMap.get('offer_studnie_1') || [])]).toHaveLength(1);
        expect(toasts).toHaveLength(1);
    });

    test('wyjątek sieci: stara mapa NIETKNIĘTA, toast', async () => {
        mod.ordersMap.set('offer_studnie_1', [ordStudnie]);
        queue.push({ throw: 'ECONNREFUSED' }, { throw: 'ECONNREFUSED' });
        const res = await mod.loadOrdersMap(['offer_studnie_1'], false);
        expect(res).toBe(false);
        expect([...(mod.ordersMap.get('offer_studnie_1') || [])]).toHaveLength(1);
        expect(toasts).toHaveLength(1);
    });

    test('retry: pierwsza runda pada, druga dowozi — mapa wypełniona, bez toasta', async () => {
        queue.push(failResp(500), failResp(500), okResp([ordStudnie]), okResp([]));
        const res = await mod.loadOrdersMap(['offer_studnie_1']);
        expect(res).toBe(true);
        expect([...(mod.ordersMap.get('offer_studnie_1') || [])]).toHaveLength(1);
        expect(toasts).toHaveLength(0);
    });

    test('popup z pustym wynikiem nie tworzy pustego wpisu w mapie', async () => {
        mod.ordersMap.set('other_offer', [ordStudnie]);
        mod.searchResults = { items: [] };
        queue.push(okResp([]));
        await mod.showOfferOrdersPopup('offer_studnie_1', 'studnia_oferta');
        expect(mod.ordersMap.has('offer_studnie_1')).toBe(false);
        expect([...(mod.ordersMap.get('other_offer') || [])]).toHaveLength(1);
        expect(toasts.some((t) => t.includes('Brak zam'))).toBe(true);
    });
});
