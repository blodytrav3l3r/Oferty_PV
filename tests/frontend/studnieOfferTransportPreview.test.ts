import fs from 'fs';
import path from 'path';
import vm from 'vm';

describe('Transport w podglądzie oferty studni', () => {
    const products = [
        {
            id: 'dennica-1000',
            componentType: 'dennica',
            name: 'Dennica DN1000 H=500',
            price: 250
        },
        {
            id: 'kineta-1000',
            componentType: 'kineta',
            name: 'Kineta DN1000',
            price: 132
        },
        {
            id: 'krag-1000-500',
            componentType: 'krag',
            name: 'Krąg DN1000/500',
            price: 400
        }
    ];

    function loadRenderer() {
        const context: any = {
            studnieProducts: products,
            calculateAssignedPrzejscia: () => [],
            calculateLinePricing: () => ({ totalLinePrice: 400, totalLineWeight: 100 }),
            getItemPriceBreakdownSafe: (_well: unknown, product: any) => ({
                base: product.price,
                total: product.price,
                pehd: 0,
                malowanieW: 0,
                malowanieZ: 0,
                zelbet: 0,
                nierdzewna: 0
            }),
            getItemAssessedPriceSafe: (_well: unknown, product: any) => product.price,
            isFrozenPriceCtx: () => false,
            getDiscountStr: () => ' (-45%)',
            getDiscountStrForWell: () => '',
            getStudnieProductById: (id: string) => products.find((product) => product.id === id),
            getPehdTypeForComponent: () => 'brak',
            calculatePrecoAllocationForItem: () => ({
                hasPreco: false,
                error: null,
                allocatedCost: 0,
                fraction: 0,
                isBottomMostDennica: false
            }),
            escapeHtml: (value: unknown) => String(value),
            fmt: (value: unknown) => String(value),
            fmtInt: (value: unknown) => String(value),
            window: {}
        };
        vm.createContext(context);
        vm.runInContext(
            fs.readFileSync(
                path.join(__dirname, '../../public/js/studnie/offerWellComponents.js'),
                'utf8'
            ),
            context
        );
        context.renderComponentSubItems = () => '';
        return context;
    }

    test('pokazuje osobny wiersz transportu, gdy studnia nie ma dennicy ani stycznej', () => {
        const context = loadRenderer();
        const well = {
            config: [{ productId: 'krag-1000-500', quantity: 1 }]
        };

        const html = context.renderWellComponentsList(well, 250, {}, null);

        expect(html).toContain('Udział w transporcie');
        expect(html).toContain('250 PLN');
        expect((html.match(/Udział w transporcie/g) || []).length).toBe(1);
    });

    test('pokazuje sumę dennicy z elementami w głównym wierszu i cenę samej dennicy pod spodem', () => {
        const context = loadRenderer();
        const well = {
            config: [
                { productId: 'dennica-1000', quantity: 1 },
                { productId: 'kineta-1000', quantity: 1 }
            ]
        };

        const html = context.renderWellComponentsList(well, 0, {}, null);

        const mainRow = html.match(/<tr style="opacity:0\.8;">[\s\S]*?<\/tr>/)?.[0] || '';
        const standaloneRow =
            html.match(/<tr class="included-row-accent">[\s\S]*?<\/tr>/)?.[0] || '';
        expect(mainRow).toContain('Cena dennicy:');
        expect(mainRow).toContain('532 PLN');
        expect(standaloneRow).toContain('Dennica DN1000 H=500 (-45%)');
        expect(html).not.toContain('bez elementów');
        expect(html).toContain('250 PLN');
        expect(html).not.toContain('Cena dennicy z elementami');
    });

    test('w głównym wierszu pokazuje sumę także dla cen utrwalonych', () => {
        const context = loadRenderer();
        context.isFrozenPriceCtx = () => true;
        const well = {
            config: [
                { productId: 'dennica-1000', quantity: 1, frozenPrice: 300 },
                { productId: 'kineta-1000', quantity: 1, frozenPrice: 120 }
            ]
        };

        const html = context.renderWellComponentsList(well, 0, {}, null);

        const mainRow = html.match(/<tr style="opacity:0\.8;">[\s\S]*?<\/tr>/)?.[0] || '';
        const standaloneRow =
            html.match(/<tr class="included-row-accent">[\s\S]*?<\/tr>/)?.[0] || '';
        expect(mainRow).toContain('Cena dennicy:');
        expect(mainRow).toContain('520 PLN');
        expect(standaloneRow).toContain('Dennica DN1000 H=500 (-45%)');
        expect(html).not.toContain('bez elementów');
        expect(html).toContain('300 PLN');
        expect(html).not.toContain('utrwalona');
    });
});
