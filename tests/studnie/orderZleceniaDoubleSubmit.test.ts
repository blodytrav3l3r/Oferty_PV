// @ts-nocheck -- vm sandbox, celowy brak typow dla public/js
// P1: podwojny numer PZ — saveProductionOrder wspoldzieli lot jak
// _pzSaveInFlight (orderZleceniaData.js:205-212). Double-click → 1 claim
// numeru + 1 zapis; mutex zwalniany po sukcesie i po bledzie.
import fs from 'fs';
import path from 'path';
import vm from 'vm';

const JS_DIR = path.join(__dirname, '../../public/js/studnie');

function loadModal(
    hooks: {
        gateSave?: boolean;
        failSave?: boolean;
        failNumberConflictOnce?: string | boolean;
    } = {}
) {
    let fetchCalls = 0;
    let saveCalls = 0;
    const claimKeys: string[] = [];
    let numberConflictFailed = false;
    let releaseSave!: () => void;
    const saveGate = new Promise<void>((resolve) => {
        releaseSave = resolve;
    });
    const sb: any = {
        console,
        window: {},
        document: {
            getElementById: () => ({ value: '' }),
            querySelector: () => null,
            createElement: () => ({ style: {} })
        },
        structuredClone: (o: any) => JSON.parse(JSON.stringify(o)),
        logger: { debug() {}, info() {}, warn() {}, error() {} },
        showToast: () => {},
        authHeaders: () => ({}),
        fetch: async (_url: string, options: any) => {
            fetchCalls++;
            claimKeys.push(options.headers['Idempotency-Key']);
            return { ok: true, json: async () => ({ number: 'PZ-TEST-' + fetchCalls }) };
        },
        pzGuard: {
            findPzForElement: (orders: any[], wellId: string, elementKey: string, index: number) =>
                orders.find(
                    (order) =>
                        order.wellId === wellId &&
                        (elementKey
                            ? order.elementKey === elementKey
                            : order.elementIndex === index)
                ) || null
        },
        productionOrders: [],
        zleceniaSelectedIdx: 0,
        zleceniaElementsList: [
            {
                well: { id: 'w1', name: 'S1', numer: 'SNR1', dn: 1000, przejscia: [] },
                product: { id: 'p1', name: 'Krag 1000' },
                elementIndex: 0,
                configItem: { _elemId: 'e1' }
            }
        ],
        currentUser: { id: 'u1', username: 'tester' },
        wells: [],
        wellsSnapshotBeforeZlecenia: null,
        buildEtykietaElementsSnapshot: () => [],
        getStudniaDIN: () => '',
        renderZleceniaList: () => {},
        renderZleceniaWellConfig: () => {},
        populateZleceniaForm: () => {},
        refreshGlobalMetrics: () => {},
        saveProductionOrdersData: async () => {
            saveCalls++;
            if (hooks.gateSave) await saveGate;
            if (hooks.failNumberConflictOnce && !numberConflictFailed) {
                numberConflictFailed = true;
                const error: any = new Error('Numer nie jest zarezerwowany dla tego użytkownika');
                error.code =
                    typeof hooks.failNumberConflictOnce === 'string'
                        ? hooks.failNumberConflictOnce
                        : 'PRODUCTION_NUMBER_NOT_CLAIMED';
                throw error;
            }
            if (hooks.failSave) throw new Error('boom-zapis');
            return [];
        }
    };
    sb.window = sb;
    sb.globalThis = sb;
    vm.createContext(sb);
    // D-008: modal claimuje przez claimSingleProductionNumber z helpers
    // (kolejność jak w studnie.html: helpers przed modalem) — bez tego
    // claim rzucałby ReferenceError łapany w try/catch (cichy brak numeru).
    vm.runInContext(fs.readFileSync(path.join(JS_DIR, 'orderZleceniaHelpers.js'), 'utf8'), sb, {
        filename: 'orderZleceniaHelpers.js'
    });
    vm.runInContext(fs.readFileSync(path.join(JS_DIR, 'orderZleceniaModal.js'), 'utf8'), sb, {
        filename: 'orderZleceniaModal.js'
    });
    return {
        sb,
        stats: () => ({ fetchCalls, saveCalls }),
        claimKeys: () => claimKeys,
        releaseSave: () => releaseSave()
    };
}

describe('orderZleceniaDoubleSubmit (P1: podwojny numer PZ)', () => {
    test.each(['PRODUCTION_NUMBER_NOT_CLAIMED', 'PRODUCTION_NUMBER_CONFLICT'])(
        '409 %s powoduje nową rezerwację i ponawia zapis przed wydrukiem',
        async (code) => {
            const { sb, stats, claimKeys } = loadModal({ failNumberConflictOnce: code });

            const orderId = await sb.saveProductionOrder();

            expect(orderId).toMatch(/^prodorder_\d+$/);
            expect(stats()).toEqual({ fetchCalls: 2, saveCalls: 2 });
            expect(claimKeys()).toHaveLength(2);
            expect(claimKeys()[0]).not.toBe(claimKeys()[1]);
            expect(sb.productionOrders[0].productionOrderNumber).toBe('PZ-TEST-2');
        }
    );

    test('double-click → 1 claim numeru + 1 zapis, oba wywolania resolve', async () => {
        const { sb, stats, releaseSave } = loadModal({ gateSave: true });
        const p1 = sb.saveProductionOrder();
        const p2 = sb.saveProductionOrder();
        // Poczekaj az lot dotrze do gated save (fetch + budowa ordera to kilka tickow).
        for (let i = 0; i < 100 && stats().saveCalls === 0; i++) {
            await new Promise((r) => setTimeout(r, 0));
        }
        expect(stats().fetchCalls).toBe(1);
        expect(stats().saveCalls).toBe(1);
        releaseSave();
        await p1;
        await p2;
        expect(stats().fetchCalls).toBe(1);
        expect(stats().saveCalls).toBe(1);
    });
    test('mutex zwalniany po sukcesie — kolejny zapis dziala', async () => {
        const { sb, stats } = loadModal();
        await sb.saveProductionOrder();
        await sb.saveProductionOrder();
        expect(stats().saveCalls).toBe(2);
    });

    test('mutex zwalniany po bledzie (finally) — kolejny zapis dziala', async () => {
        // saveProductionOrder lapie blad zapisu w toast (nie rzuca) — mutex
        // musi sie zwolnic mimo to: drugi zapis tez wywoluje persistence.
        const ctx = loadModal({ failSave: true });
        await ctx.sb.saveProductionOrder();
        await ctx.sb.saveProductionOrder();
        expect(ctx.stats().saveCalls).toBe(2);
    });

    test('guard w zrodle: wzorzec _pzSaveInFlight (wspoldzielony lot + finally)', () => {
        const src = fs.readFileSync(path.join(JS_DIR, 'orderZleceniaModal.js'), 'utf8');
        expect(src).toMatch(/_spoSaveInFlight/);
        expect(src).toMatch(/if \(_spoSaveInFlight\) return _spoSaveInFlight/);
        expect(src).toMatch(/finally\s*\{\s*_spoSaveInFlight = null/);
    });
});
