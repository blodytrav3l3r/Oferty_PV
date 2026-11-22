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

    test('popup kolejności domyślnie zachowuje magazyn z konfiguratora i przyjmuje wybór per studnia', () => {
        const context = loadBulkContext();
        const group = {
            wellIndex: 2,
            wellName: 'S3',
            wellDn: 1000,
            openCount: 2,
            totalCount: 2
        };

        const defaultRow = context._bulkSeqRowHtml(group, 1, false, null);
        expect(defaultRow).toContain('<option value="config" selected>Z konfiguratora</option>');

        const overriddenRow = vm.runInContext(
            '_bulkSeqWarehouseOverrides.set(2, "Włocławek"); _bulkSeqRowHtml(group, 1, false, null)',
            Object.assign(context, { group })
        );
        expect(overriddenRow).toContain('<option value="Włocławek" selected>Włocławek</option>');
    });

    test('zmiana globalna ustawia wiersze, a wybór studni może ją nadpisać', () => {
        const context = loadBulkContext();
        context.HTMLSelectElement = HTMLSelectElement;
        const overlay = document.createElement('div');
        const globalSelect = document.createElement('select');
        globalSelect.id = 'bulk-seq-global-warehouse';
        const rowSelect = document.createElement('select');
        rowSelect.className = 'bulk-seq-warehouse';
        rowSelect.dataset.wellIndex = '2';
        ['config', 'Kluczbork', 'Włocławek'].forEach((value) => {
            globalSelect.add(new Option(value, value));
            rowSelect.add(new Option(value, value));
        });
        overlay.append(globalSelect, rowSelect);
        context._bulkSeqBindWarehouseControls(overlay);

        globalSelect.value = 'Kluczbork';
        globalSelect.dispatchEvent(new Event('change', { bubbles: true }));
        expect(rowSelect.value).toBe('Kluczbork');

        rowSelect.value = 'Włocławek';
        rowSelect.dispatchEvent(new Event('change', { bubbles: true }));
        const row = vm.runInContext(
            '_bulkSeqRowHtml({wellIndex:2,wellName:"S3",wellDn:1000,openCount:1,totalCount:1},1,false,null)',
            context
        );
        expect(row).toContain('<option value="Włocławek" selected>Włocławek</option>');
    });
});
