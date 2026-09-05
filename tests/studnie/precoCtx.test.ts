// @ts-nocheck -- vm sandbox dla public/js
// P4-P0: kontekst Preco raz per studnia; sciezka ctx === sciezka lazy.
import fs from 'fs';
import path from 'path';
import vm from 'vm';

function loadCtx() {
    const context: any = {
        studnieProducts: [
            { id: 'k1', componentType: 'krag', height: 500 },
            { id: 'd1', componentType: 'dennica', height: 600 },
            { id: 'Wiercenie-100', category: 'Wiercenie', dn: '100', price: 10 },
            { id: 'Wiercenie-200', category: 'Wiercenie', dn: '200', price: 20 }
        ],
        calcPrecoPricing: () => ({
            suma: 100,
            bazowa: 60,
            skrzynki: { suma: 10 },
            pelnaWysokosc: { startZ: 0, endZ: 1000, cena: 30 }
        }),
        buildConfigMap: (well: any) =>
            well.config.map((c: any, index: number) => ({
                index,
                start: index * 500,
                end: index * 500 + 500,
                componentType: index === 0 ? 'dennica' : 'krag'
            })),
        getStudnieProductById: (id: string) =>
            ({
                k1: { id: 'k1', componentType: 'krag', height: 500 },
                d1: { id: 'd1', componentType: 'dennica', height: 600 }
            })[id],
        window: {} as any,
        console
    };
    context.window = context;
    vm.createContext(context);
    for (const f of ['offerPricingCalc.js', 'offerWellComponentsHelpers.js']) {
        vm.runInContext(
            fs.readFileSync(path.join(__dirname, '../../public/js/studnie', f), 'utf8'),
            context
        );
    }
    return context;
}

const well = () => ({
    kineta: 'preco',
    config: [{ productId: 'd1' }, { productId: 'k1' }, { productId: 'k1' }],
    przejscia: [{ rzednaWlaczenia: 1.2, dn: '150', productId: 'k1' }]
});

describe('P4-P0 Preco ctx', () => {
    test('ctx === lazy dla kazdej pozycji', () => {
        const ctx = loadCtx();
        const w = well();
        const preco = ctx.computePrecoWellContext(w);
        expect(preco).not.toBeNull();
        for (let i = 0; i < w.config.length; i++) {
            expect(ctx.calculatePrecoAllocationForItem(w, i, preco)).toEqual(
                ctx.calculatePrecoAllocationForItem(w, i)
            );
        }
    });

    test('brak kinety preco → null ctx i puste wyniki', () => {
        const ctx = loadCtx();
        const w = { ...well(), kineta: '' };
        expect(ctx.computePrecoWellContext(w)).toBeNull();
        expect(ctx.calculatePrecoAllocationForItem(w, 0)).toEqual(
            ctx.calculatePrecoAllocationForItem(w, 0, null)
        );
    });

    test('wiercenie: najblizsze DN>= (hoist, ten sam wynik)', () => {
        const ctx = loadCtx();
        const assigned = ctx.calculateAssignedPrzejscia(well());
        // przejscie dn=150 → Wiercenie-200 (cena 20)
        expect(assigned[2][0]._drillingBasePrice).toBe(20);
    });
});
