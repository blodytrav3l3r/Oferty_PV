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
        escapeHtml: (value: string) => String(value).replace(/&/g, '&amp;').replace(/</g, '&lt;'),
        productionOrders: [],
        pzGuard: { findPzForElement: () => null },
        studnieProducts: products,
        getStudnieProductById: (id: string) => products.find((product) => product.id === id),
        partForProduct: (product: any) =>
            product && ['dennica', 'kineta', 'styczna'].includes(product.componentType)
                ? 'dennica'
                : 'nadbudowa',
        resolveWellMagazyn: (well: any, part: string) =>
            (part === 'dennica' ? well.magazynDennica : well.magazynNadbudowa) ||
            well.magazyn ||
            'Kluczbork',
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
        fs.readFileSync(
            path.join(process.cwd(), 'public/js/studnie/orderZleceniaHelpers.js'),
            'utf8'
        ),
        context
    );
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

    test('buduje PZ dolnej dennicy z kinetą bez błędu wyboru najniższego elementu', () => {
        const context = loadBulkContext();
        const kineta = { id: 'kineta', componentType: 'kineta', name: 'Kineta DN1000' };
        context.studnieProducts.push(kineta);
        context.buildConfigMap = () => [
            { index: 0, start: 0, end: 1000, componentType: 'dennica' },
            { index: 1, start: 1000, end: 1100, componentType: 'kineta' }
        ];
        const element = {
            well: {
                id: 'w1',
                name: 'S1',
                dn: 1000,
                rzednaDna: 10,
                kineta: 'beton',
                config: [{ productId: 'base' }, { productId: 'kineta' }],
                przejscia: []
            },
            product: context.getStudnieProductById('base'),
            elementIndex: 0,
            wellIndex: 0
        };

        const order = context.buildAutoOrderData(element, { userId: 'u1' });

        expect(order.componentType).toBe('dennica');
        expect(order.blindKinetaPrzejscia).toEqual([]);
    });

    test('domyślny magazyn PZ wynika z magazynu części studni', () => {
        const context = loadBulkContext();
        const well = {
            id: 'w1',
            name: 'S1',
            dn: 1000,
            rzednaDna: 10,
            magazyn: 'Kluczbork',
            magazynDennica: 'Włocławek',
            magazynNadbudowa: 'Kluczbork',
            config: [{ productId: 'base' }, { productId: 'ring', _elemId: 'e-ring' }],
            przejscia: []
        };
        const dennica = context.buildAutoOrderData(
            { well, product: context.getStudnieProductById('base'), elementIndex: 0, wellIndex: 0 },
            { userId: 'u1' }
        );
        const krag = context.buildAutoOrderData(
            { well, product: context.getStudnieProductById('ring'), elementIndex: 1, wellIndex: 0 },
            { userId: 'u1' }
        );

        expect(dennica.magazyn).toBe('Włocławek');
        expect(krag.magazyn).toBe('Kluczbork');
    });

    test('popup pokazuje magazyny domyślne pozycji jako kafelki wyboru', () => {
        const context = loadBulkContext();
        const group = {
            wellIndex: 2,
            wellName: 'S3',
            wellDn: 1000,
            openCount: 2,
            totalCount: 2,
            warehouseDefaults: { dennica: 'Włocławek', nadbudowa: 'Kluczbork' }
        };

        const defaultRow = context._bulkSeqRowHtml(group, 1, false, 67);
        expect(defaultRow).toContain('height:67px; box-sizing:border-box; overflow:hidden;');
        expect(defaultRow).toContain('Dennica: Włocławek');
        expect(defaultRow).toContain('Nadbudowa: Kluczbork');
        expect(defaultRow).toContain('data-warehouse-choice="config" aria-pressed="true"');

        const overriddenRow = vm.runInContext(
            '_bulkSeqWarehouseOverrides.set(2, "Włocławek"); _bulkSeqRowHtml(group, 1, false, null)',
            Object.assign(context, { group })
        );
        expect(overriddenRow).toContain('data-warehouse-choice="Włocławek" aria-pressed="true"');
    });

    test('kafelki globalne aktualizują wybór studni, a kafelek pozycji może go nadpisać', () => {
        const context = loadBulkContext();
        const createTile = (dataset: Record<string, string>) => {
            const attributes = new Map<string, string>();
            return {
                dataset,
                disabled: false,
                closest: jest.fn(),
                setAttribute: (name: string, value: string) => attributes.set(name, value),
                getAttribute: (name: string) => attributes.get(name),
                classList: { toggle: jest.fn() }
            };
        };
        const globalTile = createTile({ warehouseScope: 'global', warehouseChoice: 'Kluczbork' });
        const rowTile = createTile({
            warehouseScope: 'well',
            wellIndex: '2',
            warehouseChoice: 'Włocławek'
        });
        const row = { querySelectorAll: jest.fn(() => [rowTile]) };
        rowTile.closest.mockReturnValue(row);
        let handleClick: (event: any) => void = () => undefined;
        const overlay = {
            addEventListener: jest.fn((_type, handler) => {
                handleClick = handler;
            }),
            querySelectorAll: jest.fn(() => [globalTile, rowTile])
        };
        context._bulkSeqBindWarehouseControls(overlay);

        handleClick({ target: { closest: () => globalTile }, stopPropagation: jest.fn() });
        expect(globalTile.getAttribute('aria-pressed')).toBe('true');
        expect(rowTile.getAttribute('aria-pressed')).toBe('false');

        handleClick({ target: { closest: () => rowTile }, stopPropagation: jest.fn() });
        const html = vm.runInContext(
            '_bulkSeqRowHtml({wellIndex:2,wellName:"S3",wellDn:1000,openCount:1,totalCount:1,warehouseDefaults:{dennica:"Kluczbork"}},1,false,null)',
            context
        );
        expect(html).toContain('data-warehouse-choice="Włocławek" aria-pressed="true"');
    });
});
