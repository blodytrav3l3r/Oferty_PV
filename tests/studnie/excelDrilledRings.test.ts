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

    function runChangeContext(well: any) {
        const wells = [well];
        const context: any = {
            window: {},
            document: { querySelector: () => null },
            wells,
            currentWellIndex: 0,
            studnieProducts,
            logger: (global as any).logger,
            getCurrentWell: () => well,
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
        return context;
    }

    test('should replace sibling krag/krag_ot when setting krag quantity to 2 (hole splits drilled ring back)', () => {
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

        const context = runChangeContext(well);

        // User enters '2' in the regular 'krag' column
        context.excelOnCompChange(0, 'krag', 500, '2');

        // No duplication: total rings of this dn+height == 2, one of them drilled (hole at 300mm)
        const sumQty = (pid: string) =>
            well.config
                .filter((x: any) => x.productId === pid)
                .reduce((acc: number, x: any) => acc + (x.quantity || 0), 0);

        const total = sumQty('krag-1000-500') + sumQty('krag_ot-1000-500');
        expect(total).toBe(2);

        expect(sumQty('krag_ot-1000-500')).toBe(1);

        expect(sumQty('krag-1000-500')).toBe(1);
    });

    test('should not sum when typing krag_ot in a well without holes (holeless: 2 not 3)', () => {
        const well = {
            dn: '1000',
            rzednaWlazu: 2.5,
            rzednaDna: 0.0,
            przejscia: [], // no holes
            // Initially 1 regular ring
            config: [{ productId: 'krag-1000-500', quantity: 1 }]
        };

        const context = runChangeContext(well);

        // User enters '2' in the drilled 'krag_ot' column
        context.excelOnCompChange(0, 'krag_ot', 500, '2');

        // Filter removes BOTH krag and krag_ot of this dn+height, then enforceOtRings
        // degrades the drilled ring back to regular (no hole) => total must be 2, not 3.
        const sumQty = (pid: string) =>
            well.config
                .filter((x: any) => x.productId === pid)
                .reduce((acc: number, x: any) => acc + (x.quantity || 0), 0);

        const total = sumQty('krag-1000-500') + sumQty('krag_ot-1000-500');
        expect(total).toBe(2);

        expect(sumQty('krag_ot-1000-500')).toBe(0);
        expect(sumQty('krag-1000-500')).toBe(2);
    });
});
