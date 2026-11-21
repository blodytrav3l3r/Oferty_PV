// @ts-nocheck -- vm sandbox, celowy brak typow dla public/js
import fs from 'fs';
import path from 'path';
import vm from 'vm';

function loadBulkContext() {
    const products = [
        { id: 'base', componentType: 'dennica', name: 'Dennica DN1000 H=1000/900', height: 1000 },
        { id: 'ring', componentType: 'krag', name: 'Krąg DN1000/1000', height: 1000 }
    ];
    const context: any = {
        window: {},
        document: { getElementById: () => null, createElement: () => null, body: {} },
        currentUser: { id: 'u1', firstName: 'Test', lastName: 'User' },
        productionOrders: [],
        pzGuard: { findPzForElement: () => null },
        studnieProducts: products,
        getStudnieProductById: (id: string) => products.find((product) => product.id === id),
        parseWysokoscGlebokosc: () => ({ wysokosc: 1000, glebokosc: 900 }),
        buildConfigMap: () => [
            { index: 0, start: 0, end: 1000 },
            { index: 1, start: 1000, end: 3000 }
        ],
        findAssignedElement: (mmFromBottom: number, configMap: any[]) => {
            const entry = configMap.find(
                (candidate) => mmFromBottom >= candidate.start && mmFromBottom < candidate.end
            );
            return entry
                ? { assignedIndex: entry.index, entry }
                : { assignedIndex: -1, entry: null };
        },
        buildEtykietaElementsSnapshot: () => [],
        calcStopnieExecution: () => '',
        getStudniaDIN: () => 'DIN',
        structuredClone: (value: any) => JSON.parse(JSON.stringify(value))
    };
    context.window = context;
    vm.createContext(context);
    vm.runInContext(
        fs.readFileSync(path.join(process.cwd(), 'public/js/studnie/orderBulk.js'), 'utf8'),
        context
    );
    return context;
}

describe('snapshot przejść przy hurtowym tworzeniu PZ', () => {
    test('zapisuje wysokość przejścia względem dołu przypisanego elementu', () => {
        const context = loadBulkContext();
        const element = {
            well: {
                id: 'w1',
                name: 'S1',
                dn: 1000,
                rzednaDna: 10,
                config: [{ productId: 'base' }, { productId: 'ring', _elemId: 'e-ring' }],
                przejscia: [{ productId: 'PVC-SN8-300', rzednaWlaczenia: 12, angle: 0 }]
            },
            product: context.getStudnieProductById('ring'),
            elementIndex: 1,
            wellIndex: 0
        };

        const order = context.buildAutoOrderData(element, { userId: 'u1' });

        expect(order.przejscia).toHaveLength(1);
        expect(order.przejscia[0].heightFromElementMm).toBe(1000);
    });
});
