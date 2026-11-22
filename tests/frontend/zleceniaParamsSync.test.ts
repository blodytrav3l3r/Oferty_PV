// @ts-nocheck -- vm sandbox, celowy brak typow dla public/js
import fs from 'fs';
import path from 'path';
import vm from 'vm';

/**
 * Spójność „Parametry tej studni” między kalkulatorem, Excelem i zleceniami:
 * parametr studni (źródło prawdy) propaguje się do roboczych PZ, a wybór
 * w zleceniu wraca do studni (orderZleceniaForm.js).
 */
const SRC = fs.readFileSync(
    path.join(__dirname, '../../public/js/studnie/orderHelpers.js'),
    'utf8'
);

function syncSource(): string {
    const start = SRC.indexOf('/* ===== SPÓJNOŚĆ PARAMETRÓW');
    expect(start).toBeGreaterThan(-1);
    const end = SRC.indexOf(
        'window.syncAllWellParamsToProductionOrders = syncAllWellParamsToProductionOrders;'
    );
    expect(end).toBeGreaterThan(start);
    return SRC.slice(start, end);
}

const PRODUCTS = [
    { id: 'p-krag', componentType: 'krag', category: 'KRĄG' },
    { id: 'p-ot', componentType: 'krag_ot', category: 'KRĄG' },
    { id: 'p-dennica', componentType: 'dennica', category: 'DENNICA' },
    { id: 'p-szczelka', componentType: 'uszczelka', category: 'USZCZELKA' }
];

function loadSandbox(wells: any[], orders: any[]) {
    const pending: any[] = [];
    const sandbox: any = {
        console,
        wells,
        productionOrders: orders,
        studnieProducts: PRODUCTS,
        resolveWellMagazyn: (well: any, part: string) =>
            (part === 'dennica' ? well.magazynDennica : well.magazynNadbudowa) ||
            well.magazyn ||
            'Kluczbork',
        partForProduct: (product: any) =>
            product && ['dennica', 'kineta', 'styczna'].includes(product.componentType)
                ? 'dennica'
                : 'nadbudowa',
        markProductionOrderPending: (po: any) => pending.push(po)
    };
    sandbox.window = sandbox;
    vm.createContext(sandbox);
    vm.runInContext(syncSource(), sandbox, { filename: 'orderHelpers.sync.js' });
    return { sandbox, pending };
}

function makeWell(overrides: Record<string, any> = {}) {
    return {
        id: 'w1',
        kineta: 'beton',
        spocznik: 'beton',
        spocznikH: '1/2',
        redukcjaKinety: 'nie',
        usytuowanie: 'w_osi',
        klasaBetonu: 'C40/50',
        stopnie: 'drabinka',
        _selectedRodzajStopni: 'drabinka_a_stalowa',
        nadbudowa: 'betonowa',
        dennicaMaterial: 'betonowa',
        config: [{ productId: 'p-krag', _elemId: 'e1' }],
        ...overrides
    };
}

function makeOrder(index: number, overrides: Record<string, any> = {}) {
    return {
        id: `pz-${index}`,
        wellId: 'w1',
        elementIndex: index,
        elementKey: `e${index + 1}`,
        productId: 'p-krag',
        status: 'draft',
        kineta: 'beton',
        spocznik: 'beton',
        spocznikH: '1/2',
        redukcjaKinety: 'nie',
        usytuowanie: 'w_osi',
        klasaBetonu: 'C40/50',
        rodzajStopni: 'drabinka_a_stalowa',
        rodzajStudni: 'beton',
        ...overrides
    };
}

describe('syncWellParamsToProductionOrders: studnia → zlecenia', () => {
    test('zmiana kinety, spocznika i wysokości trafia do PZ', () => {
        const well = makeWell({ kineta: 'klinkier', spocznik: 'klinkier', spocznikH: '3/4' });
        const order = makeOrder(0);
        const { sandbox, pending } = loadSandbox([well], [order]);

        expect(sandbox.syncWellParamsToProductionOrders(well)).toBe(1);
        expect(order.kineta).toBe('klinkier');
        expect(order.spocznik).toBe('klinkier');
        expect(order.spocznikH).toBe('3/4');
        expect(pending).toEqual([order]);
    });

    test('PRECO wymusza spocznik 1/1', () => {
        const well = makeWell({ kineta: 'preco', spocznik: 'preco', spocznikH: '1/2' });
        const order = makeOrder(0);
        const { sandbox } = loadSandbox([well], [order]);

        sandbox.syncWellParamsToProductionOrders(well);
        expect(order.spocznikH).toBe('1/1');
    });

    test('element krag_ot zawsze bez dna kinety', () => {
        const well = makeWell({ kineta: 'beton', spocznik: 'beton', spocznikH: '1/2' });
        const order = makeOrder(0, { productId: 'p-ot' });
        const { sandbox } = loadSandbox([well], [order]);

        sandbox.syncWellParamsToProductionOrders(well);
        expect(order.kineta).toBe('brak');
        expect(order.spocznik).toBe('brak');
        expect(order.spocznikH).toBe('brak');
        expect(order.redukcjaKinety).toBe('nie');
    });

    test('klasa betonu HSR mapowana w obie strony', () => {
        const well = makeWell({ klasaBetonu: 'C45/55(HSR)' });
        const order = makeOrder(0);
        const { sandbox } = loadSandbox([well], [order]);

        sandbox.syncWellParamsToProductionOrders(well);
        expect(order.klasaBetonu).toBe('C45/55(HSR!!!!)');
        expect(sandbox.klasaBetonuPzToWell('C45/55(HSR!!!!)')).toBe('C45/55(HSR)');
    });

    test('puste pola studni (legacy) nie nadpisują zapisanych wartości PZ', () => {
        const well = makeWell({
            kineta: '',
            spocznik: '',
            spocznikH: '',
            redukcjaKinety: '',
            usytuowanie: '',
            klasaBetonu: '',
            stopnie: '',
            _selectedRodzajStopni: ''
        });
        const order = makeOrder(0, { kineta: 'klinkier', spocznikH: '1/1' });
        const { sandbox, pending } = loadSandbox([well], [order]);

        sandbox.syncWellParamsToProductionOrders(well);
        expect(order.kineta).toBe('klinkier');
        expect(order.spocznikH).toBe('1/1');
        expect(pending).toEqual([]);
    });

    test('zaakceptowane PZ są zamrożone', () => {
        const well = makeWell({ kineta: 'preco' });
        const order = makeOrder(0, { status: 'accepted' });
        const { sandbox, pending } = loadSandbox([well], [order]);

        sandbox.syncWellParamsToProductionOrders(well);
        expect(order.kineta).toBe('beton');
        expect(pending).toEqual([]);
    });

    test('syncAll obejmuje wszystkie studnie', () => {
        const well1 = makeWell({ id: 'w1', kineta: 'preco' });
        const well2 = makeWell({ id: 'w2', kineta: 'klinkier' });
        const order1 = makeOrder(0);
        const order2 = makeOrder(1, { wellId: 'w2' });
        const { sandbox } = loadSandbox([well1, well2], [order1, order2]);

        expect(sandbox.syncAllWellParamsToProductionOrders()).toBe(2);
        expect(order1.kineta).toBe('preco');
        expect(order2.kineta).toBe('klinkier');
    });

    test('magazyn synchronizuje się do szkiców według typu elementu', () => {
        const well = makeWell({
            magazyn: 'Kluczbork',
            magazynDennica: 'Włocławek',
            magazynNadbudowa: 'Kluczbork',
            config: [
                { productId: 'p-dennica', _elemId: 'e1' },
                { productId: 'p-krag', _elemId: 'e2' }
            ]
        });
        const bottomOrder = makeOrder(0, { productId: 'p-dennica', magazyn: 'Kluczbork' });
        const upperOrder = makeOrder(1, { productId: 'p-krag', magazyn: 'Włocławek' });
        const { sandbox, pending } = loadSandbox([well], [bottomOrder, upperOrder]);

        expect(sandbox.syncWellParamsToProductionOrders(well)).toBe(2);
        expect(bottomOrder.magazyn).toBe('Włocławek');
        expect(upperOrder.magazyn).toBe('Kluczbork');
        expect(pending).toEqual([bottomOrder, upperOrder]);
    });

    test('zmiana magazynu studni synchronizuje robocze PZ, ale nie rusza zaakceptowanych', () => {
        const well = makeWell({
            magazyn: 'Włocławek',
            magazynDennica: 'Włocławek',
            magazynNadbudowa: 'Włocławek'
        });
        const draft = makeOrder(0, { magazyn: 'Kluczbork' });
        const accepted = makeOrder(1, { status: 'accepted', magazyn: 'Kluczbork' });
        const { sandbox, pending } = loadSandbox([well], [draft, accepted]);

        sandbox.syncWellParamsToProductionOrders(well);

        expect(draft.magazyn).toBe('Włocławek');
        expect(accepted.magazyn).toBe('Kluczbork');
        expect(pending).toEqual([draft]);
    });

    test('synchronizacja samego magazynu nie zmienia innych pól roboczych PZ', () => {
        const well = makeWell({
            magazyn: 'Włocławek',
            magazynDennica: 'Włocławek',
            magazynNadbudowa: 'Włocławek',
            config: [
                { productId: 'p-dennica', _elemId: 'e1' },
                { productId: 'p-krag', _elemId: 'e2' }
            ]
        });
        const bottomOrder = makeOrder(0, {
            productId: 'p-dennica',
            magazyn: 'Kluczbork',
            kineta: 'klinkier',
            uwagi: 'zachować'
        });
        const upperOrder = makeOrder(1, { productId: 'p-krag', magazyn: 'Kluczbork' });
        const accepted = makeOrder(2, { status: 'accepted', magazyn: 'Kluczbork' });
        const { sandbox, pending } = loadSandbox([well], [bottomOrder, upperOrder, accepted]);

        expect(sandbox.syncWellWarehouseToProductionOrders(well)).toBe(2);
        expect(bottomOrder.magazyn).toBe('Włocławek');
        expect(upperOrder.magazyn).toBe('Włocławek');
        expect(bottomOrder.kineta).toBe('klinkier');
        expect(bottomOrder.uwagi).toBe('zachować');
        expect(accepted.magazyn).toBe('Kluczbork');
        expect(pending).toEqual([bottomOrder, upperOrder]);
    });
});
