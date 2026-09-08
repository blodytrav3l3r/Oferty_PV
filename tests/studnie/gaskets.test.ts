// @ts-nocheck -- vm sandbox, celowy brak typow dla public/js
import fs from 'fs';
import path from 'path';
import vm from 'vm';

function catalog() {
    return [
        { id: 'den-1000', name: 'Dennica 1000', componentType: 'dennica', dn: '1000' },
        { id: 'krag-1000', name: 'Krag 1000', componentType: 'krag', dn: '1000' },
        { id: 'g-gsg-1000', name: 'Uszczelka GSG DN1000', componentType: 'uszczelka', dn: '1000' },
        { id: 'g-sdv-1000', name: 'Uszczelka SDV DN1000', componentType: 'uszczelka', dn: '1000' },
        // realne nazwy z bazy (bez 'SDV' w srodku, z polskimi znakami)
        {
            id: 'g-sdvpo-1000',
            name: 'Uszczelka SDV DN1000 z pierścieniem odciążającym',
            componentType: 'uszczelka',
            dn: '1000'
        },
        {
            id: 'g-nbr-1000',
            name: 'Uszczelka GSG DN1000 z NBR',
            componentType: 'uszczelka',
            dn: '1000'
        }
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
    w.config.filter((i: any) => !String(i.productId || '').startsWith('g-'));
const gasketsOf = (w: any) =>
    w.config.filter((i: any) => String(i.productId || '').startsWith('g-'));

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

    test('SDV PO: dobor po slowach kluczowych, nie exact-match nazwy', () => {
        const sync = loadSync(catalog());
        expect(sync.findGasketProduct('SDV PO', '1000')?.id).toBe('g-sdvpo-1000');
        expect(sync.findGasketProduct('NBR', '1000')?.id).toBe('g-nbr-1000');
        expect(sync.findGasketProduct('GSG', '1000')?.id).toBe('g-gsg-1000');
        const well: any = mkWell('SDV PO');
        sync.recalcGaskets(well);
        expect(gasketsOf(well)).toEqual([
            { productId: 'g-sdvpo-1000', quantity: 2, autoAdded: true }
        ]);
    });

    test('inferUszczelkaType: reverse-map nazwy na typ (heal legacy)', () => {
        const sync = loadSync(catalog());
        const withSeal = (pid: string) => ({
            id: 'w1',
            dn: '1000',
            config: [{ productId: pid, quantity: 2 }]
        });
        expect(sync.inferUszczelkaType(withSeal('g-sdv-1000'))).toBe('SDV');
        expect(sync.inferUszczelkaType(withSeal('g-sdvpo-1000'))).toBe('SDV PO');
        expect(sync.inferUszczelkaType(withSeal('g-nbr-1000'))).toBe('NBR');
        expect(sync.inferUszczelkaType(withSeal('g-gsg-1000'))).toBe('GSG');
        expect(sync.inferUszczelkaType(withSeal('krag-1000'))).toBeNull();
        expect(sync.inferUszczelkaType(withSeal('nie-ma-w-katalogu'))).toBeNull();
        expect(sync.inferUszczelkaType({ id: 'w1', config: [] })).toBeNull();
    });

    test('hands-off: brak typu + zapisane uszczelki = config nietkniety', () => {
        const sync = loadSync(catalog());
        const well: any = {
            id: 'w1',
            dn: '1000',
            config: [
                { productId: 'krag-1000', quantity: 2, frozenPrice: 100 },
                { productId: 'g-sdv-1000', quantity: 2, frozenPrice: 50, autoAdded: true }
            ]
        };
        delete well.uszczelka;
        const before = JSON.parse(JSON.stringify(well.config));
        sync.recalcGaskets(well);
        expect(well.config).toEqual(before);
    });

    test('heal end-to-end: zamowienie bez typu odtwarza SDV i trzyma uszczelki', () => {
        const sync = loadSync(catalog());
        // symulacja order.wells po DTO sprzed fixu (config jest, typu nie ma)
        const well: any = {
            id: 'w1',
            dn: '1000',
            config: [
                { productId: 'krag-1000', quantity: 2, frozenPrice: 100 },
                { productId: 'g-sdv-1000', quantity: 2, frozenPrice: 50, autoAdded: true }
            ]
        };
        const inferred = sync.inferUszczelkaType(well);
        expect(inferred).toBe('SDV');
        well.uszczelka = inferred;
        sync.recalcGaskets(well);
        expect(gasketsOf(well)).toEqual([
            { productId: 'g-sdv-1000', quantity: 2, frozenPrice: 50, autoAdded: true }
        ]);
    });
});
