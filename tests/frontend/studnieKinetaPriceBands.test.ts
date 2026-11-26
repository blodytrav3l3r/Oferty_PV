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

    function priceFor(baseId: string) {
        const well = {
            dn: '1000',
            malowanieW: 'brak',
            malowanieZ: 'brak',
            config: [
                { productId: baseId, quantity: 1 },
                { productId: 'kineta-dn1000-11', quantity: 1 }
            ]
        };
        const kineta = products.find((product) => product.id === 'kineta-dn1000-11');
        return context.getItemAssessedPrice(well, kineta, false, well.config[1]);
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
});
