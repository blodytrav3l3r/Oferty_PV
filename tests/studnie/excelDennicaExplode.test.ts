// @ts-nocheck
import fs from 'fs';
import path from 'path';
import vm from 'vm';

describe('_excelInsertConfigItem — eksplozja dennicy na osobne elementy (psia buda)', () => {
    const products = [
        {
            id: 'dennica-1000-1000',
            name: 'Dennica DN1000 H=1000/850',
            componentType: 'dennica',
            dn: '1000',
            height: 1000
        },
        {
            id: 'krag-1000-500',
            name: 'Krąg DN1000 H=500',
            componentType: 'krag',
            dn: '1000',
            height: 500
        }
    ];

    function loadCtx() {
        const context = {
            studnieProducts: products,
            logger: { info: () => {}, warn: () => {}, error: () => {} },
            window: {},
            _excelClearResCache: () => {}
        };
        vm.createContext(context);
        const code = fs.readFileSync(
            path.join(__dirname, '../../public/js/studnie/excelConfigManager.js'),
            'utf8'
        );
        vm.runInContext(code, context);
        return context;
    }

    test('dennica qty=5 → 5 osobnych elementów qty=1, 4 z isPsiaBuda, ostatni bez flagi', () => {
        const ctx = loadCtx();
        const well = { config: [] };
        ctx._excelInsertConfigItem(well, 'dennica', 'dennica-1000-1000', 5);

        expect(well.config.length).toBe(5);
        well.config.forEach((item) => {
            expect(item.productId).toBe('dennica-1000-1000');
            expect(item.quantity).toBe(1);
        });
        expect(well.config.filter((i) => i.isPsiaBuda === true).length).toBe(4);
        expect(well.config[well.config.length - 1].isPsiaBuda).toBeUndefined();
        expect(well.config[0].isPsiaBuda).toBe(true);
    });

    test('dennica qty=1 → pojedynczy element standardowy bez flagi', () => {
        const ctx = loadCtx();
        const well = { config: [] };
        ctx._excelInsertConfigItem(well, 'dennica', 'dennica-1000-1000', 1);

        expect(well.config.length).toBe(1);
        expect(well.config[0].quantity).toBe(1);
        expect(well.config[0].isPsiaBuda).toBeUndefined();
    });

    test('regresja: krag qty=3 nadal eksploduje do 3 elementów qty=1 bez flag', () => {
        const ctx = loadCtx();
        const well = { config: [] };
        ctx._excelInsertConfigItem(well, 'krag', 'krag-1000-500', 3);

        expect(well.config.length).toBe(3);
        well.config.forEach((item) => {
            expect(item.productId).toBe('krag-1000-500');
            expect(item.quantity).toBe(1);
            expect(item.isPsiaBuda).toBeUndefined();
        });
    });
});
