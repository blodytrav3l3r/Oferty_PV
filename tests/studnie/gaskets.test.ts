// @ts-nocheck -- vm sandbox, celowy brak typow dla public/js
import fs from 'fs';
import path from 'path';
import vm from 'vm';

function catalog() {
    return [
        { id: 'den-1000', name: 'Dennica 1000', componentType: 'dennica', dn: '1000' },
        { id: 'krag-1000', name: 'Krag 1000', componentType: 'krag', dn: '1000' },
        { id: 'g-gsg-1000', name: 'Uszczelka GSG DN1000', componentType: 'uszczelka', dn: '1000' },
        { id: 'g-sdv-1000', name: 'Uszczelka SDV DN1000', componentType: 'uszczelka', dn: '1000' }
    ];
}

function loadSync(products: any[]) {
    const byId = new Map(products.map((p) => [p.id, p]));
    const context: any = {
        window: {},
        studnieProducts: products,
        getStudnieProductById: (id: string) => byId.get(id) || null,
        getCurrentWell: () => null
    };
    for (const f of ['actionsWellSync.js', 'wellConfigRules.js']) {
        const code = fs.readFileSync(path.join(__dirname, '../../public/js/studnie', f), 'utf8');
        vm.createContext(context);
        vm.runInContext(code, context);
    }
    return context.window;
}

function mkWell(uszczelka: string) {
    return {
        id: 'w1',
        dn: '1000',
        uszczelka,
        config: [
            { productId: 'den-1000', quantity: 1, frozenPrice: 200 },
            { productId: 'krag-1000', quantity: 2, frozenPrice: 100 }
        ]
    };
}

const carriersOf = (w: any) =>
    w.config.filter((i: any) => i.productId !== 'g-gsg-1000' && i.productId !== 'g-sdv-1000');
const gasketsOf = (w: any) =>
    w.config.filter((i: any) => i.productId === 'g-gsg-1000' || i.productId === 'g-sdv-1000');

describe('uszczelki: zmiana typu rusza tylko uszczelki', () => {
    test('GSG -> SDV: nosniki identyczne, tylko pozycja uszczelki podmieniona', () => {
        const sync = loadSync(catalog());
        const well: any = mkWell('GSG');
        sync.recalcGaskets(well);
        expect(gasketsOf(well)).toEqual([
            { productId: 'g-gsg-1000', quantity: 2, autoAdded: true }
        ]);
        const carriersBefore = JSON.parse(JSON.stringify(carriersOf(well)));

        well.uszczelka = 'SDV';
        sync.recalcGaskets(well);
        expect(carriersOf(well)).toEqual(carriersBefore);
        expect(gasketsOf(well)).toEqual([
            { productId: 'g-sdv-1000', quantity: 2, autoAdded: true }
        ]);
    });

    test('SDV -> brak: uszczelki znikaja, nosniki nietkniete', () => {
        const sync = loadSync(catalog());
        const well: any = mkWell('SDV');
        sync.recalcGaskets(well);
        expect(gasketsOf(well)).toHaveLength(1);
        well.uszczelka = 'brak';
        sync.recalcGaskets(well);
        expect(gasketsOf(well)).toHaveLength(0);
        expect(carriersOf(well)).toEqual([
            { productId: 'den-1000', quantity: 1, frozenPrice: 200 },
            { productId: 'krag-1000', quantity: 2, frozenPrice: 100 }
        ]);
    });

    test('ten sam typ: pozycja zachowana z frozenPrice, tylko ilosc', () => {
        const sync = loadSync(catalog());
        const well: any = mkWell('GSG');
        sync.recalcGaskets(well);
        const g: any = gasketsOf(well)[0];
        g.frozenPrice = 33;
        g.frozenPriceBase = 40;
        sync.recalcGaskets(well);
        expect(gasketsOf(well)).toEqual([
            {
                productId: 'g-gsg-1000',
                quantity: 2,
                autoAdded: true,
                frozenPrice: 33,
                frozenPriceBase: 40
            }
        ]);
    });

    test('rename produktu w katalogu (to samo id): uszczelka zachowana po productId', () => {
        const sync = loadSync(catalog());
        const well: any = mkWell('GSG');
        sync.recalcGaskets(well);
        expect(gasketsOf(well)).toHaveLength(1);
        // katalog po zmianie nazwy, to samo id
        const renamed = catalog().map((p) =>
            p.id === 'g-gsg-1000' ? { ...p, name: 'Uszczelka GSG DN1000 nowa' } : p
        );
        const sync2 = loadSync(renamed);
        sync2.recalcGaskets(well);
        expect(gasketsOf(well)).toEqual([
            { productId: 'g-gsg-1000', quantity: 2, autoAdded: true }
        ]);
    });

    test("smar nie istnieje: zero uszczelek jak przy 'brak'", () => {
        const sync = loadSync(catalog());
        const well: any = mkWell('smar');
        sync.recalcGaskets(well);
        expect(gasketsOf(well)).toHaveLength(0);
        expect(sync.GASKET_TYPES).toEqual(['GSG', 'SDV', 'SDV PO', 'NBR']);
        expect(sync.filterSealsByWellType([{ id: 'x' }], well)).toEqual([]);
    });
});
