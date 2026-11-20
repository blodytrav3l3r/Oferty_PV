// @ts-nocheck -- vm sandbox, celowy brak typów dla public/js
import fs from 'fs';
import path from 'path';
import vm from 'vm';

describe('projekcja cenowa kinety', () => {
    test('dolicza kinetę wyłącznie do ceny ostatniej dennicy', () => {
        const context: any = {
            window: {},
            studnieProducts: [
                { id: 'top', componentType: 'dennica', price: 250 },
                { id: 'bottom', componentType: 'dennica', price: 300 },
                { id: 'styczna', componentType: 'styczna', price: 180 },
                { id: 'kineta', componentType: 'kineta', price: 132 }
            ],
            safeCalcWellStats: () => ({ height: 3000, weight: 1000, price: 1000 }),
            isWellPricingError: () => false,
            getWellNadbudowaPctSafe: () => 0,
            safePrecoPct: () => 0,
            getWellActiveDiscounts: () => ({ dennica: 0, nadbudowa: 0, preco: 0 }),
            calculateAssignedPrzejscia: () => ({}),
            getItemAssessedPriceSafe: (_well: unknown, product: any) => product.price,
            getItemPriceBreakdown: () => ({
                pehd: 0,
                malowanieW: 0,
                malowanieZ: 0,
                zelbet: 0,
                nierdzewna: 0
            }),
            calculatePrecoAllocationForItem: () => ({ hasPreco: false, allocatedCost: 0 }),
            getWellDiscountPctSafe: () => 0
        };
        vm.createContext(context);
        vm.runInContext(
            fs.readFileSync(
                path.join(__dirname, '../../public/js/studnie/pricingCalculator.js'),
                'utf8'
            ),
            context
        );
        const well = {
            dn: '1000',
            name: 'Studnia',
            config: [
                { productId: 'top', quantity: 1 },
                { productId: 'bottom', quantity: 1 },
                { productId: 'kineta', quantity: 1 }
            ]
        };

        const result = context.calculateOfferPricing([well], 0, 0, 'standard');
        const config = result.wellsForExport[0].config;

        expect(config[0]._xp).toBe(250);
        expect(config[1]._xp).toBe(432);
        expect(config[2]).toMatchObject({ _xskip: true, _xp: 0 });
        expect(result.totalNetto).toBe(1000);
        expect(well.config[0]).not.toHaveProperty('_xp');

        const stycznaWell = {
            dn: '1000',
            name: 'Studnia ze styczną',
            config: [
                { productId: 'top', quantity: 1 },
                { productId: 'styczna', quantity: 1 },
                { productId: 'kineta', quantity: 1 }
            ]
        };
        const stycznaConfig = context.calculateOfferPricing([stycznaWell], 0, 0, 'standard')
            .wellsForExport[0].config;
        expect(stycznaConfig[0]._xp).toBe(250);
        expect(stycznaConfig[1]._xp).toBe(312);
    });
});
