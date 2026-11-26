import fs from 'fs';
import path from 'path';
import vm from 'vm';

describe('Ceny kinety według rzeczywistej wysokości dennicy', () => {
    const products = [
        {
            id: 'dennica-700-550',
            componentType: 'dennica',
            dn: '1000',
            height: 550,
            name: 'Dennica DN1000 H=700/550'
        },
        {
            id: 'dennica-700',
            componentType: 'dennica',
            dn: '1000',
            height: 700,
            name: 'Dennica DN1000 WYS.=700'
        },
        {
            id: 'dennica-1300-1150',
            componentType: 'dennica',
            dn: '1000',
            height: 1150,
            name: 'Dennica DN1000 H=1300/1150'
        },
        {
            id: 'dennica-1500-1350',
            componentType: 'dennica',
            dn: '1000',
            height: 1350,
            name: 'Dennica DN1000 H=1500/1350'
        },
        {
            id: 'dennica-650-500',
            componentType: 'dennica',
            dn: '1000',
            height: 500,
            name: 'Dennica DN1000 H=650/500'
        },
        {
            id: 'dennica-1800',
            componentType: 'dennica',
            dn: '1000',
            height: 1800,
            name: 'Dennica DN1000 H=1800'
        },
        {
            id: 'dennica-600',
            componentType: 'dennica',
            dn: '1000',
            height: 600,
            name: 'Dennica DN1000 H=600'
        },
        {
            id: 'dennica-50',
            componentType: 'dennica',
            dn: '1000',
            height: 50,
            name: 'Dennica DN1000 H=50'
        },
        {
            id: 'kineta-dn1000-11',
            componentType: 'kineta',
            dn: '1000',
            price: 220,
            hMin1: 0,
            hMax1: 699,
            cena1: 220,
            hMin2: 700,
            hMax2: 949,
            cena2: 240,
            hMin3: 950,
            hMax3: 1600,
            cena3: 280,
            name: 'Kineta DN1000 wys. 1/1'
        }
    ];

    const context: any = {
        studnieProducts: products,
        wellDiscounts: {},
        window: {}
    };
    vm.createContext(context);
    vm.runInContext(
        fs.readFileSync(
            path.join(__dirname, '../../public/js/studnie/actionsWellPricing.js'),
            'utf8'
        ),
        context
    );

    function pricingForConfig(productIds: string[]) {
        const well = {
            dn: '1000',
            malowanieW: 'brak',
            malowanieZ: 'brak',
            config: productIds.map((productId) => ({ productId, quantity: 1 }))
        };
        const kineta = products.find((product) => product.id === 'kineta-dn1000-11');
        if (!kineta) throw new Error('Brak produktu kinety w fixture');
        const kinetaItem = well.config.find((item) => item.productId === kineta.id);
        return {
            assessed: context.getItemAssessedPrice(well, kineta, false, kinetaItem),
            breakdown: context.getItemPriceBreakdown(well, kineta, false, kinetaItem)
        };
    }

    function priceFor(baseId: string) {
        return pricingForConfig([baseId, 'kineta-dn1000-11']).assessed;
    }

    test('H=700/550 używa WYS. 550 mm i CENA1', () => {
        expect(priceFor('dennica-700-550')).toBe(220);
    });

    test('rzeczywista WYS. 700 mm obejmuje dolną granicę CENA2', () => {
        expect(priceFor('dennica-700')).toBe(240);
    });

    test('H=1300/1150 używa WYS. 1150 mm i CENA3', () => {
        expect(priceFor('dennica-1300-1150')).toBe(280);
    });

    test('kineta używa wysokości dolnej dennicy, a nie pierwszej w konfiguracji', () => {
        const pricing = pricingForConfig([
            'dennica-1500-1350',
            'dennica-650-500',
            'kineta-dn1000-11'
        ]);

        expect(pricing.assessed).toBe(220);
        expect(pricing.breakdown.base).toBe(220);
    });

    test('zmiana kolejności dennic aktualizuje próg ceny kinety', () => {
        expect(
            pricingForConfig(['dennica-650-500', 'dennica-1500-1350', 'kineta-dn1000-11']).assessed
        ).toBe(280);
    });

    test('wysokość powyżej ostatniego zakresu wybiera cenę najbliższego zakresu', () => {
        expect(priceFor('dennica-1800')).toBe(280);
    });

    test('wysokość poniżej pierwszego zakresu wybiera CENA1', () => {
        const kineta = products.find((product) => product.id === 'kineta-dn1000-11');
        if (!kineta) throw new Error('Brak produktu kinety w fixture');
        const changedKineta = { ...kineta, price: 999, hMin1: 100, hMax1: 300 };
        const well = {
            dn: '1000',
            malowanieW: 'brak',
            malowanieZ: 'brak',
            config: [
                { productId: 'dennica-50', quantity: 1 },
                { productId: kineta.id, quantity: 1 }
            ]
        };

        expect(context.getItemAssessedPrice(well, changedKineta, false, well.config[1])).toBe(220);
    });

    test('przy remisie odległości wybiera wcześniejszy zakres i ignoruje cenę bazową', () => {
        const kineta = products.find((product) => product.id === 'kineta-dn1000-11');
        if (!kineta) throw new Error('Brak produktu kinety w fixture');
        const changedKineta = {
            ...kineta,
            price: 999,
            hMax1: 500,
            hMin2: 700,
            hMax2: 949,
            hMin3: 950,
            hMax3: 1600
        };
        const well = {
            dn: '1000',
            malowanieW: 'brak',
            malowanieZ: 'brak',
            config: [
                { productId: 'dennica-600', quantity: 1 },
                { productId: changedKineta.id, quantity: 1 }
            ]
        };
        const item = well.config[1];

        expect(context.getItemAssessedPrice(well, changedKineta, false, item)).toBe(220);
        expect(context.getItemPriceBreakdown(well, changedKineta, false, item).base).toBe(220);
    });

    test('brak użytecznych zakresów zgłasza błąd zamiast używać ceny bazowej', () => {
        const kineta = products.find((product) => product.id === 'kineta-dn1000-11');
        if (!kineta) throw new Error('Brak produktu kinety w fixture');
        const withoutBands = {
            ...kineta,
            price: 999,
            hMin1: null,
            hMax1: null,
            cena1: null,
            hMin2: null,
            hMax2: null,
            cena2: null,
            hMin3: null,
            hMax3: null,
            cena3: null
        };
        const well = {
            dn: '1000',
            malowanieW: 'brak',
            malowanieZ: 'brak',
            config: [
                { productId: 'dennica-700-550', quantity: 1 },
                { productId: withoutBands.id, quantity: 1 }
            ]
        };

        expect(() =>
            context.getItemAssessedPrice(well, withoutBands, false, well.config[1])
        ).toThrow('Kineta DN1000 wys. 1/1 nie ma poprawnego zakresu ceny');
        expect(() =>
            context.getItemPriceBreakdown(well, withoutBands, false, well.config[1])
        ).toThrow('Kineta DN1000 wys. 1/1 nie ma poprawnego zakresu ceny');
    });
});
