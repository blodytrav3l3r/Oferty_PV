// @ts-nocheck
import fs from 'fs';
import path from 'path';
import vm from 'vm';

describe('enforceOtRings and excelOnCompChange ring selection', () => {
    let studnieProducts: any[] = [];

    beforeAll(() => {
        studnieProducts = [
            {
                id: 'krag-1000-500',
                componentType: 'krag',
                dn: '1000',
                height: 500,
                name: 'Krąg DN1000 H=500'
            },
            {
                id: 'krag_ot-1000-500',
                componentType: 'krag_ot',
                dn: '1000',
                height: 500,
                name: 'Krąg wiercony DN1000 H=500'
            },
            {
                id: 'dennica-1000-1000',
                componentType: 'dennica',
                dn: '1000',
                height: 1000,
                name: 'Dennica DN1000'
            },
            { id: 'prz-160', componentType: 'przejscie', dn: '160', name: 'Przejście 160' }
        ];

        (global as any).studnieProducts = studnieProducts;
        (global as any).logger = { info: () => {}, warn: () => {}, error: () => {} };
    });

    function runScriptInContext(well: any) {
        const context = {
            getCurrentWell: () => well,
            studnieProducts,
            logger: (global as any).logger,
            structuredClone: (obj: any) => JSON.parse(JSON.stringify(obj)),
            enforceOtRings: null
        };
        const code = fs.readFileSync(
            path.join(__dirname, '../../public/js/studnie/diagramOtRings.js'),
            'utf8'
        );
        vm.createContext(context);
        vm.runInContext(code, context);
        return context;
    }

    test('should split a multi-quantity krag item into 1 krag_ot and remaining krag items when hole is present', () => {
        const well = {
            dn: '1000',
            rzednaWlazu: 2.5,
            rzednaDna: 0.0,
            przejscia: [
                { productId: 'prz-160', rzednaWlaczenia: 0.3 } // 300mm from bottom
            ],
            config: [{ productId: 'krag-1000-500', quantity: 3 }]
        };

        const ctx = runScriptInContext(well);
        const mutated = ctx.enforceOtRings();
        expect(mutated).toBe(true);

        expect(well.config.length).toBe(2);

        const otItem = well.config.find((x: any) => x.productId === 'krag_ot-1000-500');
        const regItem = well.config.find((x: any) => x.productId === 'krag-1000-500');

        expect(otItem).toBeDefined();
        expect(otItem.quantity).toBe(1);

        expect(regItem).toBeDefined();
        expect(regItem.quantity).toBe(2);
    });

    test('should preserve 2 regular krag items when setting krag quantity to 2 while 1 krag_ot is present', () => {
        const well = {
            dn: '1000',
            rzednaWlazu: 2.5,
            rzednaDna: 0.0,
            przejscia: [{ productId: 'prz-160', rzednaWlaczenia: 0.3 }],
            // Initially 1 regular ring + 1 drilled ring
            config: [
                { productId: 'krag-1000-500', quantity: 1 },
                { productId: 'krag_ot-1000-500', quantity: 1 }
            ]
        };

        const wells = [well];
        const context = {
            window: {},
            document: { querySelector: () => null },
            wells,
            currentWellIndex: 0,
            studnieProducts,
            logger: (global as any).logger,
            _excelSaveUndoSnapshot: () => {},
            _excelMarkAsManual: () => {},
            _excelClearResCache: () => {},
            _excelInsertConfigItem: (w, ct, pid, q) => {
                w.config.unshift({ productId: pid, quantity: q });
            },
            _excelCleanEmptyPrzejscia: () => {},
            _excelMarkManual: () => {},
            _excelRefreshAutoCells: () => {},
            _excelUpdateLeftPreview: () => {},
            _excelUpdateHeaderProdCodes: () => {},
            _excelDebouncedRefresh: () => {},
            getAvailableProducts: () => studnieProducts,
            filterByWellParams: () => true,
            structuredClone: (obj: any) => JSON.parse(JSON.stringify(obj)),
            enforceOtRings: null,
            excelOnCompChange: null
        };

        const codeOt = fs.readFileSync(
            path.join(__dirname, '../../public/js/studnie/diagramOtRings.js'),
            'utf8'
        );
        const codeChange = fs.readFileSync(
            path.join(__dirname, '../../public/js/studnie/excelChangeHandlers.js'),
            'utf8'
        );

        vm.createContext(context);
        vm.runInContext(codeOt, context);
        vm.runInContext(codeChange, context);

        // User enters '2' in the regular 'krag' column
        context.excelOnCompChange(0, 'krag', 500, '2');

        const regItem = well.config.find((x: any) => x.productId === 'krag-1000-500');
        const otItem = well.config.find((x: any) => x.productId === 'krag_ot-1000-500');

        // User typed '2' for regular rings, so there are 2 regular rings + 1 drilled ring = 3 total!
        expect(regItem).toBeDefined();
        expect(regItem.quantity).toBe(2);

        expect(otItem).toBeDefined();
        expect(otItem.quantity).toBe(1);
    });
});
