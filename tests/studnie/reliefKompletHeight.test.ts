// @ts-nocheck -- vm sandbox, celowy brak typow dla public/js
import fs from 'fs';
import path from 'path';
import vm from 'vm';

/**
 * Regresja: komplet odciążający (płyta + pierścień) w kalkulacji wysokości.
 * Pierścień nachodzi na krąg (wkład 0), pod płytą dylatacja 50mm.
 * Przykład: DN1000 2000mm = właz 150 + płyta 150 + dylatacja 50 + pierścień 0
 *   + korpus 1650 (dennica 900 + krąg 500 + krąg 250).
 * Bez fixa calcWellStats liczył 150+150=300 (2100 zamiast 2000).
 */
describe('komplet odciążający — wysokość studni', () => {
    const products = [
        { id: 'WLAZ-150', componentType: 'wlaz', dn: '600', height: 150, price: 100 },
        { id: 'PZE-16-10', componentType: 'plyta_zamykajaca', dn: '1000', height: 150, price: 200 },
        {
            id: 'PO-16-10',
            componentType: 'pierscien_odciazajacy',
            dn: '1000',
            height: 150,
            price: 150
        },
        { id: 'KR-1000-500', componentType: 'krag', dn: '1000', height: 500, price: 300 },
        { id: 'KR-1000-250', componentType: 'krag', dn: '1000', height: 250, price: 200 },
        { id: 'DEN-1000-900', componentType: 'dennica', dn: '1000', height: 900, price: 500 }
    ];
    const byId = (id) => products.find((p) => p.id === id);

    function loadAll() {
        const context: any = {
            window: { RELIEF_DYLATACJA_MM: 50, isPreviewMode: false },
            studnieProducts: products,
            getStudnieProductById: byId,
            isDennicaLikeProduct: (p: any) =>
                !!p && (p.componentType === 'dennica' || p.componentType === 'styczna'),
            dennicaHeightPenalty: () => 0,
            getPehdSurcharge: () => 0
        };
        vm.createContext(context);
        for (const f of [
            'actionsWellPricing.js',
            'transitionRenderer.js',
            'diagramComponents.js'
        ]) {
            vm.runInContext(
                fs.readFileSync(path.join(__dirname, '../../public/js/studnie', f), 'utf8'),
                context
            );
        }
        return context;
    }

    let ctx: any;
    beforeAll(() => {
        ctx = loadAll();
    });

    // config top-down (kolejność sortWellConfigByOrder: wlaz 0, płyta 2, pierścień 3, krąg 5, dennica 6)
    const kompletConfig = () => [
        { productId: 'WLAZ-150', quantity: 1 },
        { productId: 'PZE-16-10', quantity: 1 },
        { productId: 'PO-16-10', quantity: 1 },
        { productId: 'KR-1000-500', quantity: 1 },
        { productId: 'KR-1000-250', quantity: 1 },
        { productId: 'DEN-1000-900', quantity: 1 }
    ];

    test('detektor znajduje parę płyta→pierścień na indeksach config', () => {
        const res = ctx.getReliefKompletConfigIdx(kompletConfig(), byId);
        expect([...res.gapAfter]).toEqual([1]);
        expect([...res.ringZero]).toEqual([2]);
    });

    test('calcWellStats: pierścień 0 + dylatacja 50 (2000, nie 2100)', () => {
        const stats = ctx.calcWellStats({ config: kompletConfig() });
        expect(stats.height).toBe(2000);
    });

    test('solo pierścień bez płyty liczy pełne height', () => {
        const stats = ctx.calcWellStats({
            config: [
                { productId: 'WLAZ-150', quantity: 1 },
                { productId: 'PO-16-10', quantity: 1 },
                { productId: 'DEN-1000-900', quantity: 1 }
            ]
        });
        expect(stats.height).toBe(150 + 150 + 900);
    });

    test('solo płyta bez pierścienia: bez dylatacji', () => {
        const stats = ctx.calcWellStats({
            config: [
                { productId: 'WLAZ-150', quantity: 1 },
                { productId: 'PZE-16-10', quantity: 1 },
                { productId: 'DEN-1000-900', quantity: 1 }
            ]
        });
        expect(stats.height).toBe(150 + 150 + 900);
    });

    test('buildConfigMap: segment pierścienia pusty, płyta z dylatacją (total 2000)', () => {
        const well = { config: kompletConfig() };
        const map = ctx.buildConfigMap(well, byId, true);
        const total = map[map.length - 1].end;
        expect(total).toBe(2000);
        const ring = map.find((e: any) => e.componentType === 'pierscien_odciazajacy');
        expect(ring.end - ring.start).toBe(0);
        const plate = map.find((e: any) => e.componentType === 'plyta_zamykajaca');
        expect(plate.end - plate.start).toBe(200);
    });

    test('diagram totalMm zgodny z calcWellStats', () => {
        const well = { config: kompletConfig() };
        const visible = ctx.buildVisibleComponents(well);
        const canvas = ctx.calculateCanvasParams(visible, 1000);
        expect(canvas.totalMm).toBe(ctx.calcWellStats(well).height);
    });
});
