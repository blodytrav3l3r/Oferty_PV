// @ts-nocheck -- vm sandbox, celowy brak typow dla public/js
// Regresja: zamowienie SA/ZS/000043/2026 z oferty OS/000002/SA/2026
// wszystkie 4 studnie flagowane jako ZMIENIONO mimo braku zmian.
// Root cause: hash kanoniczny obejmowal pola pochodne frozenPrice*,
// ktore istnieja w live (po freezeWellPrices), a nie istnialy
// w snapshocie (buildSlimWells przed freeze). Dowod na zywych danych:
// snap.hash === hash(DTO bez frozen) !== hash(DTO z frozen).
import fs from 'fs';
import path from 'path';
import vm from 'vm';

function loadDto() {
    const context: any = { window: {} };
    const code = fs.readFileSync(
        path.join(__dirname, '../../public/js/studnie/orderDto.js'),
        'utf8'
    );
    vm.createContext(context);
    vm.runInContext(code, context);
    return context.window;
}

function frozenWell() {
    return {
        id: 'well-1',
        name: 'S1',
        dn: '1000',
        kineta: 'beton',
        dennicaMaterial: 'betonowa',
        config: [
            {
                productId: 'KDB-10-10-D',
                quantity: 1,
                frozenPrice: 540,
                frozenPriceBase: 600,
                frozenName: 'Krag'
            },
            {
                productId: 'DDD-10-075',
                quantity: 1,
                frozenPrice: 333,
                frozenPriceBase: 370,
                frozenName: 'Dennica'
            }
        ],
        przejscia: [
            {
                productId: 'PVC-SN8-300',
                dn: null,
                rzednaWlaczenia: '0.000',
                angle: 0,
                doplata: 0,
                frozenPrice: 69.75,
                frozenPriceBase: 93,
                frozenName: 'PVC',
                frozenTransitionPrice: 60,
                frozenDrillingPrice: 9.75,
                frozenDrillingName: 'Wiercenie',
                frozenDrillingDn: '300'
            }
        ]
    };
}

function stripFrozen(well: any) {
    const c = JSON.parse(JSON.stringify(well));
    (c.config || []).forEach((i: any) => {
        delete i.frozenPrice;
        delete i.frozenPriceBase;
        delete i.frozenName;
    });
    (c.przejscia || []).forEach((p: any) => {
        delete p.frozenPrice;
        delete p.frozenPriceBase;
        delete p.frozenName;
        delete p.frozenTransitionPrice;
        delete p.frozenDrillingPrice;
        delete p.frozenDrillingName;
        delete p.frozenDrillingDn;
    });
    delete c.frozenPrecoSuma;
    return c;
}

describe('orderFreezeHashRegression — SA/ZS/000043/2026 wszystkie ZMIENIONO', () => {
    let dto: any;
    beforeAll(() => {
        dto = loadDto();
    });

    test('hash stabilny przez freeze: DTO z frozen* === DTO bez frozen*', () => {
        const live = frozenWell();
        const preFreeze = stripFrozen(live);
        expect(dto.wellConfigHash(dto.toWellOrderDTO(live))).toBe(
            dto.wellConfigHash(dto.toWellOrderDTO(preFreeze))
        );
    });

    test('sama zmiana wartosci frozenPrice (ten sam productId/qty) nie zmienia hasha', () => {
        const a = frozenWell();
        const b = frozenWell();
        b.config[0].frozenPrice = 9999.99;
        b.przejscia[0].frozenPrice = 1.11;
        expect(dto.wellConfigHash(dto.toWellOrderDTO(a))).toBe(
            dto.wellConfigHash(dto.toWellOrderDTO(b))
        );
    });

    test('realna zmiana biznesowa nadal wykrywana (quantity, productId, doplata)', () => {
        const base = dto.wellConfigHash(dto.toWellOrderDTO(frozenWell()));
        const q = frozenWell();
        q.config[0].quantity = 7;
        expect(dto.wellConfigHash(dto.toWellOrderDTO(q))).not.toBe(base);
        const p = frozenWell();
        p.config[0].productId = 'INNY-PRODUKT';
        expect(dto.wellConfigHash(dto.toWellOrderDTO(p))).not.toBe(base);
        const d = frozenWell();
        d.przejscia[0].doplata = 50;
        expect(dto.wellConfigHash(dto.toWellOrderDTO(d))).not.toBe(base);
    });
});
