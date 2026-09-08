// @ts-nocheck
// SSoT overlapu dennicy (-100mm): dennica/styczna traci 100mm tylko nad typem
// z kielichem (SOCKET_TYPES); kineta/uszczelka kary nie dają, spód pełny.
import fs from 'fs';
import path from 'path';
import vm from 'vm';

describe('Dennica stacking — SSoT overlap 100mm (globals.js)', () => {
    let ctx: any;

    const products = [
        {
            id: 'dennica-1000-400',
            name: 'Dennica DN1000 H=400',
            componentType: 'dennica',
            dn: 1000,
            height: 400
        },
        {
            id: 'styczna-1000-1350',
            name: 'Styczna DN1000 H=1350',
            componentType: 'styczna',
            dn: 1000,
            height: 1350
        },
        {
            id: 'krag-1000-500',
            name: 'Krag DN1000 H=500',
            componentType: 'krag',
            dn: 1000,
            height: 500
        },
        {
            id: 'krag_ot-1000-500',
            name: 'Krag OT DN1000 H=500',
            componentType: 'krag_ot',
            dn: 1000,
            height: 500
        },
        {
            id: 'plyta-red-1000',
            name: 'Płyta redukcyjna DN1000 H=200',
            componentType: 'plyta_redukcyjna',
            dn: 1000,
            height: 200
        },
        { id: 'kineta-1000', name: 'Kineta DN1000', componentType: 'kineta', dn: 1000, height: 0 },
        { id: 'wlaz-625', name: 'Wlaz 625', componentType: 'wlaz', dn: 625, height: 0 }
    ];

    beforeAll(() => {
        const context: any = {
            studnieProducts: products,
            FLOW_TYPES: Object.freeze({ WYLOT: 'wylot', WLOT: 'wlot', DOLOT: 'dolot' }),
            logger: { info: () => {}, warn: () => {}, error: () => {} },
            window: {}
        };
        vm.createContext(context);
        for (const f of ['globals.js', 'transitionRenderer.js', 'diagramComponents.js']) {
            vm.runInContext(
                fs.readFileSync(path.join(__dirname, '../../public/js/studnie', f), 'utf8'),
                context,
                { filename: f }
            );
        }
        ctx = context;
    });

    function findProduct(id: string) {
        return ctx.studnieProducts.find((p) => p.id === id);
    }

    /** @returns mapa index -> efektywna wysokość z buildConfigMap */
    function heights(well: any) {
        const map = ctx.buildConfigMap(well, findProduct, false);
        const out: Record<number, number> = {};
        for (const cm of map) out[cm.index] = cm.end - cm.start;
        return out;
    }

    const item = (productId: string, quantity = 1) => ({ productId, quantity });

    test('helper: kara 100 tylko nad typem z kielichem (SOCKET_TYPES)', () => {
        expect(ctx.dennicaHeightPenalty({ componentType: 'dennica' }, null)).toBe(0);
        expect(ctx.dennicaHeightPenalty({ componentType: 'dennica' }, 'dennica')).toBe(100);
        expect(ctx.dennicaHeightPenalty({ componentType: 'dennica' }, 'styczna')).toBe(100);
        expect(ctx.dennicaHeightPenalty({ componentType: 'dennica' }, 'krag')).toBe(100);
        expect(ctx.dennicaHeightPenalty({ componentType: 'dennica' }, 'krag_ot')).toBe(100);
        expect(ctx.dennicaHeightPenalty({ componentType: 'dennica' }, 'plyta_redukcyjna')).toBe(
            100
        );
        expect(ctx.dennicaHeightPenalty({ componentType: 'styczna' }, 'krag')).toBe(100);
        expect(ctx.dennicaHeightPenalty({ componentType: 'dennica' }, 'kineta')).toBe(0);
        expect(ctx.dennicaHeightPenalty({ componentType: 'dennica' }, 'uszczelka')).toBe(0);
        expect(ctx.dennicaHeightPenalty({ componentType: 'dennica' }, 'konus')).toBe(0);
        expect(ctx.dennicaHeightPenalty({ componentType: 'krag' }, 'krag')).toBe(0);
        expect(ctx.dennicaHeightPenalty(null, 'krag')).toBe(0);
        expect(ctx.isDennicaLikeProduct({ componentType: 'krag_ot' })).toBe(false);
    });

    test('samotna dennica na spodzie → pełna wysokość', () => {
        const h = heights({
            config: [item('wlaz-625'), item('krag-1000-500'), item('dennica-1000-400')]
        });
        expect(h[2]).toBe(400);
        expect(h[1]).toBe(500);
    });

    test('dennica na dennicy → górna -100', () => {
        const h = heights({ config: [item('dennica-1000-400'), item('dennica-1000-400')] });
        expect(h[1]).toBe(400); // spód pełny
        expect(h[0]).toBe(300); // góra -100
    });

    test('dennica na kręgu → -100', () => {
        const h = heights({ config: [item('dennica-1000-400'), item('krag-1000-500')] });
        expect(h[1]).toBe(500);
        expect(h[0]).toBe(300);
    });

    test('dennica na kręgu wierconym → -100 (jak zwykły krąg)', () => {
        const h = heights({ config: [item('dennica-1000-400'), item('krag_ot-1000-500')] });
        expect(h[1]).toBe(500);
        expect(h[0]).toBe(300);
    });

    test('dennica na płycie redukcyjnej → -100', () => {
        const h = heights({ config: [item('dennica-1000-400'), item('plyta-red-1000')] });
        expect(h[1]).toBe(200);
        expect(h[0]).toBe(300);
    });

    test('kanapka dennica-krąg-dennica → dół pełny, góra -100', () => {
        const h = heights({
            config: [item('dennica-1000-400'), item('krag-1000-500'), item('dennica-1000-400')]
        });
        expect(h[2]).toBe(400);
        expect(h[1]).toBe(500);
        expect(h[0]).toBe(300);
    });

    test('samotna dennica na górze kręgów (zero dennic pod spodem) → -100', () => {
        const h = heights({
            config: [item('dennica-1000-400'), item('krag-1000-500'), item('krag-1000-500')]
        });
        expect(h[0]).toBe(300);
        expect(h[1]).toBe(500);
        expect(h[2]).toBe(500);
    });

    test('psiaBuda → dennica na spodzie też -100', () => {
        const h = heights({
            psiaBuda: true,
            config: [item('krag-1000-500'), item('dennica-1000-400')]
        });
        expect(h[1]).toBe(300);
    });

    test('dennica nad kinetą → pełna (kineta wewnątrz dennicy, bez wpływu)', () => {
        const h = heights({
            config: [item('krag-1000-500'), item('dennica-1000-400'), item('kineta-1000')]
        });
        expect(h[1]).toBe(400);
        expect(h[0]).toBe(500);
    });

    test('dennica nad kinetą Z psiaBuda → -100', () => {
        const h = heights({
            psiaBuda: true,
            config: [item('krag-1000-500'), item('dennica-1000-400'), item('kineta-1000')]
        });
        expect(h[1]).toBe(300);
    });

    test('kineta nie psuje łańcucha: kineta→krąg→dennica (krąg pełny, dennica -100)', () => {
        const h = heights({
            config: [item('dennica-1000-400'), item('krag-1000-500'), item('kineta-1000')]
        });
        expect(h[1]).toBe(500);
        expect(h[0]).toBe(300);
    });

    test('quantity 2 w jednej pozycji: sztuka1 pełna, sztuka2 -100', () => {
        const h = heights({ config: [item('dennica-1000-400', 2)] });
        expect(h[0]).toBe(700);
    });

    test('spójność: buildConfigMap vs buildVisibleComponents (te same wysokości)', () => {
        const well = {
            config: [
                item('wlaz-625'),
                item('dennica-1000-400'),
                item('krag-1000-500'),
                item('dennica-1000-400')
            ]
        };
        // buildVisibleComponents czyta przez window.studnieProducts (Map SSoT z globals.js)
        ctx.window.studnieProducts = products;
        const mapHeights = ctx
            .buildConfigMap(well, findProduct, false)
            .filter((cm) => cm.componentType === 'dennica' || cm.componentType === 'krag')
            .map((cm) => cm.end - cm.start)
            .sort((a, b) => a - b);
        const visHeights = ctx
            .buildVisibleComponents(well)
            .filter((c) => c.componentType === 'dennica' || c.componentType === 'krag')
            .map((c) => c.height)
            .sort((a, b) => a - b);
        expect(visHeights).toEqual(mapHeights);
    });
});
