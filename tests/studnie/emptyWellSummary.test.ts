import fs from 'fs';
import path from 'path';
import vm from 'vm';

const STUDNIE = path.join(__dirname, '../../public/js/studnie');

function createContext() {
    const products: Record<string, { componentType: string }> = {
        ring: { componentType: 'krag' },
        seal: { componentType: 'uszczelka' }
    };
    const context: any = {
        wells: [
            {
                id: 'empty',
                name: 'Pusta',
                dn: 1000,
                config: [],
                przejscia: [{ productId: 'pipe' }]
            },
            { id: 'accessory', name: 'Akcesorium', dn: 1000, config: [{ productId: 'seal' }] },
            { id: 'valid', name: 'C1', dn: 1000, config: [{ productId: 'ring' }] }
        ],
        orderEditMode: null,
        editingOfferIdStudnie: 'offer-1',
        wellDiscounts: {},
        MAX_TRANSPORT_WEIGHT: 100,
        currentTransportMode: 'full',
        transportSeparate: false,
        document: { getElementById: () => ({ value: '0' }) },
        getStudnieProductById: (id: string) => products[id] || null,
        safeCalcWellStats: (well: any) => ({
            price: well.id === 'valid' ? 120 : 50,
            weight: well.id === 'valid' ? 8 : 99,
            height: 1200
        }),
        calcWellStats: () => ({ price: 0, weight: 0, height: 0 }),
        calcComparableWellPrice: () => 120,
        isWellPricingError: () => false,
        renderWellHeaderRow: (_well: any, originalIndex: number) =>
            `<tr data-source-index="${originalIndex}"></tr>`,
        renderWellDetailsRow: () => '',
        getOfferColumnsCount: () => 1,
        getOrderedWellIds: () => new Set<string>(),
        isTransportSeparateRow: () => false,
        fmt: (value: number) => String(value),
        fmtInt: (value: number) => String(value),
        window: null as any
    };
    context.window = context;
    vm.createContext(context);
    vm.runInContext(fs.readFileSync(path.join(STUDNIE, 'wellUIHelpers.js'), 'utf8'), context);
    return context;
}

describe('Studnie summary excludes empty offer positions', () => {
    test('offer table keeps configured products and preserves original indexes', () => {
        const context = createContext();
        vm.runInContext(
            fs.readFileSync(path.join(STUDNIE, 'offerSummaryTable.js'), 'utf8'),
            context
        );

        const html = vm.runInContext(
            'renderOfferSummaryTable(null, { wells: {} }, { globalWeight: 8, totalTransportCost: 0 })',
            context
        );

        expect(html).toContain('data-source-index="2"');
        expect(html).not.toContain('data-source-index="0"');
        expect(html).toContain('data-source-index="1"');
        expect(html).toContain('RAZEM (2 studni)');
    });

    test('offer totals use only product-bearing weights', () => {
        const context = createContext();
        vm.runInContext(
            fs.readFileSync(path.join(STUDNIE, 'offerPricingCalc.js'), 'utf8'),
            context
        );

        const totals = vm.runInContext('calculateOfferTotals()', context);

        expect(totals.globalWeight).toBe(107);
    });

    test('keeps a legacy empty well visible and priced when an order protects it', () => {
        const context = createContext();
        context.isWellLocked = (index: number) => index === 0;
        vm.runInContext(
            fs.readFileSync(path.join(STUDNIE, 'offerSummaryTable.js'), 'utf8'),
            context
        );
        const html = vm.runInContext(
            'renderOfferSummaryTable(null, { wells: {} }, { globalWeight: 107, totalTransportCost: 0 })',
            context
        );
        expect(html).toContain('data-source-index="0"');
        expect(html).toContain('data-source-index="1"');
        expect(html).toContain('data-source-index="2"');
        expect(html).toContain('RAZEM (3 studni)');

        vm.runInContext(
            fs.readFileSync(path.join(STUDNIE, 'offerPricingCalc.js'), 'utf8'),
            context
        );
        expect(vm.runInContext('calculateOfferTotals().globalWeight', context)).toBe(206);
    });
});
