import fs from 'fs';
import path from 'path';
import vm from 'vm';

// Regresja: DELETE dokumentu + releaseOf => celowy 404 guarda P1.5
// (nierozróżnialne: brak dokumentu vs brak uprawnień), nic nie zwalniający.
// Po udanym DELETE nie wołamy release wcale (wygasłe locki czyszczą się same).
describe('kartotekaActions delete — brak releaseOf po DELETE', () => {
    let mod: any;
    let fetchCalls: Array<{ url: string; method: string }>;
    let releaseCalls: Array<{ docType: string; docId: string }>;
    let toasts: string[];
    let deletedOffers: string[];

    function nextFetch(): Promise<any> {
        return Promise.resolve({
            ok: true,
            status: 200,
            json: async () => ({})
        });
    }

    beforeEach(() => {
        fetchCalls = [];
        releaseCalls = [];
        toasts = [];
        deletedOffers = [];
        const base = path.join(__dirname, '../../public/js/kartoteka');
        const code = fs
            .readFileSync(path.join(base, 'kartotekaActions.js'), 'utf8')
            .replace(/^import .*$/m, 'const storageService = globalThis.__storageService;')
            .replace('export default', 'globalThis.__kartotekaActions =');
        const context: any = {
            console,
            setTimeout,
            clearTimeout,
            logger: { info() {}, warn() {}, error() {} },
            document: { getElementById: () => null },
            showToast: (msg: string) => {
                toasts.push(String(msg));
            },
            appConfirm: async () => true,
            fetch: (url: string, opts: any) => {
                fetchCalls.push({ url: String(url), method: opts && opts.method });
                return nextFetch();
            },
            __storageService: {
                deleteOffer: async (id: string) => {
                    deletedOffers.push(String(id));
                    return true;
                }
            },
            window: null as any
        };
        context.window = {
            showToast: (msg: string) => {
                toasts.push(String(msg));
            },
            escapeHtml: (s: unknown) => String(s ?? ''),
            lockService: {
                releaseOf: (docType: string, docId: string) => {
                    releaseCalls.push({ docType: String(docType), docId: String(docId) });
                    return Promise.resolve({ ok: true, released: false });
                }
            }
        };
        vm.createContext(context);
        vm.runInContext(code, context);
        mod = context.__kartotekaActions;
        mod.ordersMap = new Map();
        mod.currentFilter = 'all';
        mod.loadLocalOffers = async () => {};
    });

    test('deleteOrderUnified: DELETE + lista + toast, zero POST /api/locks/release', async () => {
        mod.ordersMap.set('offer_studnie_1', [{ id: 'ord-1', offerStudnieId: 'offer_studnie_1' }]);
        await mod.deleteOrderUnified('ord-1', 'studnia_oferta');
        expect(fetchCalls).toEqual([{ url: '/api/orders-studnie/ord-1', method: 'DELETE' }]);
        expect(releaseCalls).toHaveLength(0);
        expect(mod.ordersMap.has('offer_studnie_1')).toBe(false);
        expect(toasts.some((t) => t.includes('usunięte'))).toBe(true);
    });

    test('deleteOfferWithConfirmation: deleteOffer + toast, zero releaseOf', async () => {
        await mod.deleteOfferWithConfirmation('offer_studnie_1');
        expect(deletedOffers).toEqual(['offer_studnie_1']);
        expect(releaseCalls).toHaveLength(0);
        expect(toasts.some((t) => t.includes('usunięta'))).toBe(true);
    });
});
