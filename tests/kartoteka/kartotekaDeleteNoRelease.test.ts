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
    let loadLocalOffers: jest.Mock;
    let updateOfferCard: jest.Mock;

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
        mod.searchResults = {
            items: [{ id: 'offer_studnie_1', type: 'studnia_oferta', _orderCount: 1 }],
            totalCount: 1,
            hasMore: false,
            nextCursor: null,
            nextCursorId: null,
            nextCursorType: null
        };
        loadLocalOffers = jest.fn(async () => {});
        updateOfferCard = jest.fn();
        mod.loadLocalOffers = loadLocalOffers;
        mod.updateOfferCard = updateOfferCard;
        mod.updateOfferCounter = jest.fn();
        mod.updateSearchResultControls = jest.fn();
        mod._offerListSignature = jest.fn(() => 'updated-signature');
    });

    test('deleteOrderUnified: DELETE + lista + toast, zero POST /api/locks/release', async () => {
        mod.ordersMap.set('offer_studnie_1', [{ id: 'ord-1', offerStudnieId: 'offer_studnie_1' }]);
        await mod.deleteOrderUnified('ord-1', 'studnia_oferta');
        expect(fetchCalls).toEqual([{ url: '/api/orders-studnie/ord-1', method: 'DELETE' }]);
        expect(releaseCalls).toHaveLength(0);
        expect(mod.ordersMap.has('offer_studnie_1')).toBe(false);
        expect(mod.searchResults.items[0]._orderCount).toBe(0);
        expect(updateOfferCard).toHaveBeenCalledWith('offer_studnie_1');
        expect(loadLocalOffers).not.toHaveBeenCalled();
        expect(toasts.some((t) => t.includes('usunięte'))).toBe(true);
    });

    test('removes the offer locally without restarting the search', async () => {
        const abort = jest.fn();
        mod.abortController = { abort };
        mod.isLoading = true;

        await mod.deleteOfferWithConfirmation('offer_studnie_1');

        expect(deletedOffers).toEqual(['offer_studnie_1']);
        expect(mod.searchResults.items).toEqual([]);
        expect(mod.searchResults.totalCount).toBe(0);
        expect(abort).toHaveBeenCalledTimes(1);
        expect(mod.abortController).toBeNull();
        expect(mod.isLoading).toBe(false);
        expect(updateOfferCard).toHaveBeenCalledWith('offer_studnie_1');
        expect(loadLocalOffers).not.toHaveBeenCalled();
    });

    test('removes the last order locally while keeping the with-order filter', async () => {
        mod.currentFilter = 'with_order';
        mod.ordersMap.set('offer_studnie_1', [{ id: 'ord-1', offerStudnieId: 'offer_studnie_1' }]);

        await mod.deleteOrderUnified('ord-1', 'studnia_oferta');

        expect(mod.currentFilter).toBe('with_order');
        expect(mod.searchResults.items).toEqual([]);
        expect(mod.searchResults.totalCount).toBe(0);
        expect(updateOfferCard).toHaveBeenCalledWith('offer_studnie_1');
        expect(loadLocalOffers).not.toHaveBeenCalled();
    });

    test('keeps the offer and updates its remaining order count when another order exists', async () => {
        mod.ordersMap.set('offer_studnie_1', [
            { id: 'ord-1', offerStudnieId: 'offer_studnie_1' },
            { id: 'ord-2', offerStudnieId: 'offer_studnie_1' }
        ]);
        mod.searchResults.items[0]._orderCount = 2;

        await mod.deleteOrderUnified('ord-1', 'studnia_oferta');

        expect(mod.ordersMap.get('offer_studnie_1')).toEqual([
            { id: 'ord-2', offerStudnieId: 'offer_studnie_1' }
        ]);
        expect(mod.searchResults.items[0]._orderCount).toBe(1);
        expect(mod.searchResults.totalCount).toBe(1);
        expect(updateOfferCard).toHaveBeenCalledWith('offer_studnie_1');
        expect(loadLocalOffers).not.toHaveBeenCalled();
    });

    test('deleteOfferWithConfirmation: deleteOffer + toast, zero releaseOf', async () => {
        await mod.deleteOfferWithConfirmation('offer_studnie_1');
        expect(deletedOffers).toEqual(['offer_studnie_1']);
        expect(releaseCalls).toHaveLength(0);
        expect(toasts.some((t) => t.includes('usunięta'))).toBe(true);
    });
});
