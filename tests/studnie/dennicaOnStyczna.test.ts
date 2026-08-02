// @ts-nocheck
import fs from 'fs';
import path from 'path';
import vm from 'vm';

describe('Dennica na stycznej — reguła "dennica na dennicy" (efektywna wysokość -100mm)', () => {
    let ctx: any;

    beforeAll(() => {
        const products = [
            {
                id: 'styczna-1000-1350',
                name: 'Styczna DN1000 H=1350',
                componentType: 'styczna',
                dn: 1000,
                height: 1350
            },
            {
                id: 'dennica-1000-400',
                name: 'Dennica DN1000 H=400',
                componentType: 'dennica',
                dn: 1000,
                height: 400
            },
            {
                id: 'krag-1000-500',
                name: 'Krag DN1000 H=500',
                componentType: 'krag',
                dn: 1000,
                height: 500
            },
            {
                id: 'wlaz-625',
                name: 'Wlaz 625',
                componentType: 'wlaz',
                dn: 625,
                height: 0
            }
        ];
        const context: any = {
            studnieProducts: products,
            FLOW_TYPES: Object.freeze({ WYLOT: 'wylot', WLOT: 'wlot', DOLOT: 'dolot' }),
            logger: { info: () => {}, warn: () => {}, error: () => {} },
            window: {}
        };
        vm.createContext(context);
        const code = fs.readFileSync(
            path.join(__dirname, '../../public/js/studnie/transitionRenderer.js'),
            'utf8'
        );
        vm.runInContext(code, context);
        ctx = context;
    });

    function findProduct(id: string) {
        return ctx.studnieProducts.find((p) => p.id === id);
    }

    test('dennica na stycznej → wysokość dennicy zmniejszona o 100mm (overlap)', () => {
        const well = {
            config: [
                { productId: 'wlaz-625', quantity: 1 },
                { productId: 'krag-1000-500', quantity: 1 },
                { productId: 'dennica-1000-400', quantity: 1 },
                { productId: 'styczna-1000-1350', quantity: 1 }
            ]
        };
        const configMap = ctx.buildConfigMap(well, findProduct, true);
        const byId = {};
        configMap.forEach((cm) => {
            byId[cm.productId] = cm;
        });
        // buildConfigMap iteruje od dołu (styczna najpierw) → dennica to 2. element "dennicowy"
        expect(byId['styczna-1000-1350'].end - byId['styczna-1000-1350'].start).toBe(1350);
        expect(byId['dennica-1000-400'].end - byId['dennica-1000-400'].start).toBe(300);
        expect(byId['krag-1000-500'].end - byId['krag-1000-500'].start).toBe(500);
    });

    test('pojedyncza styczna (bez dennicy) → pełna wysokość', () => {
        const well = {
            config: [
                { productId: 'wlaz-625', quantity: 1 },
                { productId: 'krag-1000-500', quantity: 1 },
                { productId: 'styczna-1000-1350', quantity: 1 }
            ]
        };
        const configMap = ctx.buildConfigMap(well, findProduct, true);
        const styczna = configMap.find((cm) => cm.productId === 'styczna-1000-1350');
        expect(styczna.end - styczna.start).toBe(1350);
    });

    test('dwie dennicy na stycznej → obie z overlapem (dennica na dennicy)', () => {
        const well = {
            config: [
                { productId: 'wlaz-625', quantity: 1 },
                { productId: 'dennica-1000-400', quantity: 1 },
                { productId: 'dennica-1000-400', quantity: 1 },
                { productId: 'styczna-1000-1350', quantity: 1 }
            ]
        };
        const configMap = ctx.buildConfigMap(well, findProduct, true);
        const dennicy = configMap.filter((cm) => cm.productId === 'dennica-1000-400');
        expect(dennicy.length).toBe(2);
        dennicy.forEach((d) => {
            expect(d.end - d.start).toBe(300);
        });
        const styczna = configMap.find((cm) => cm.productId === 'styczna-1000-1350');
        expect(styczna.end - styczna.start).toBe(1350);
    });
});
