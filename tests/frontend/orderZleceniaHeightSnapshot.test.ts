// @ts-nocheck -- vm sandbox for vanilla frontend scripts
import fs from 'fs';
import path from 'path';
import vm from 'vm';

const JS_DIR = path.join(process.cwd(), 'public/js/studnie');

function saveOrderAtElevation(elevation: number) {
    const savedOrders = [];
    const sb = {
        window: {},
        document: { getElementById: () => ({ value: '' }) },
        structuredClone: (value) => JSON.parse(JSON.stringify(value)),
        logger: { debug() {}, info() {}, warn() {}, error() {} },
        showToast: () => {},
        authHeaders: () => ({}),
        fetch: async () => ({ ok: true, json: async () => ({ number: 'PZ-TEST-1' }) }),
        pzGuard: { findPzForElement: () => null },
        productionOrders: [],
        zleceniaSelectedIdx: 0,
        zleceniaElementsList: [
            {
                well: {
                    id: 'w1',
                    name: 'D1',
                    numer: 'D1',
                    dn: 1000,
                    rzednaDna: 152,
                    przejscia: [
                        {
                            id: 'prz-1',
                            productId: 'prz-1',
                            rzednaWlaczenia: elevation,
                            angle: 0
                        }
                    ]
                },
                product: { id: 'dennica-1', name: 'Dennica DN1000 H=750/600' },
                elementIndex: 7,
                configItem: { _elemId: 'dennica-1' }
            }
        ],
        currentUser: { id: 'u1', username: 'tester' },
        buildEtykietaElementsSnapshot: () => [],
        buildConfigMap: () => [{ index: 7, start: 0, end: 1000 }],
        findAssignedElement: (mmFromBottom, configMap) => {
            const entry =
                configMap.find((item) => mmFromBottom >= item.start && mmFromBottom < item.end) ||
                configMap[configMap.length - 1];
            return { assignedIndex: entry.index, entry };
        },
        getStudnieProductById: () => null,
        studnieProducts: [],
        getStudniaDIN: () => '',
        renderZleceniaList: () => {},
        renderZleceniaWellConfig: () => {},
        populateZleceniaForm: () => {},
        refreshGlobalMetrics: () => {},
        saveProductionOrdersData: async (orders) => savedOrders.push(...orders)
    };
    sb.window = sb;
    vm.createContext(sb);
    vm.runInContext(fs.readFileSync(path.join(JS_DIR, 'orderZleceniaHelpers.js'), 'utf8'), sb);
    vm.runInContext(fs.readFileSync(path.join(JS_DIR, 'orderZleceniaModal.js'), 'utf8'), sb);

    return sb.saveProductionOrder().then(() => savedOrders[0]);
}

describe('migawka zlecenia produkcyjnego', () => {
    test.each([
        { elevation: 152, expectedHeight: 0 },
        { elevation: 153, expectedHeight: 1000 }
    ])(
        'zapisuje lokalną wysokość i rzędną dna dla przejścia na rzędnej $elevation m',
        async ({ elevation, expectedHeight }) => {
            const order = await saveOrderAtElevation(elevation);

            expect(order.rzednaDna).toBe(152);
            expect(order.przejscia[0].heightFromElementMm).toBe(expectedHeight);
        }
    );
});
