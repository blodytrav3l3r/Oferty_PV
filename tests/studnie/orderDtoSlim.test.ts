// @ts-nocheck -- vm sandbox, celowy brak typow dla public/js
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

function loadOrderHelpers(priceById: Record<string, number>) {
    const context: any = {
        window: {},
        structuredClone: (obj: any) => JSON.parse(JSON.stringify(obj)),
        logger: { info: () => {}, warn: () => {}, error: () => {} },
        wellDiscounts: {},
        studnieProducts: [],
        getStudnieProductById: () => null,
        getWellNadbudowaPct: () => 0,
        calcWellStats: (w: any) => ({
            price: w._testPrice ?? priceById[w.id] ?? 0,
            weight: (w._testPrice ?? priceById[w.id] ?? 0) * 2
        })
    };
    const code = fs.readFileSync(
        path.join(__dirname, '../../public/js/studnie/orderHelpers.js'),
        'utf8'
    );
    vm.createContext(context);
    vm.runInContext(code, context);
    return context.window;
}

function dtoWell() {
    return {
        id: 'well-1',
        name: 'S1',
        dn: '1000',
        kineta: 'beton',
        dennicaMaterial: 'betonowa',
        config: [
            { productId: 'dennica-1', quantity: 1, frozenPrice: 740 },
            { productId: 'krag-1', quantity: 2 }
        ],
        przejscia: [{ productId: 'prz-160', dn: '160', rzednaWlaczenia: 101, angle: 90 }]
    };
}

describe('orderDto slim snapshot — DoD P1', () => {
    let dto: any;
    beforeAll(() => {
        dto = loadDto();
    });

    test('ten sam biznesowy config → ten sam hash (niezależnie od kolejności kluczy i configu)', () => {
        const a = dtoWell();
        const b = {
            przejscia: [...a.przejscia],
            dn: '1000',
            config: [...a.config].reverse(),
            name: 'S1',
            id: 'well-1',
            kineta: 'beton',
            dennicaMaterial: 'betonowa'
        };
        expect(dto.wellConfigHash(a)).toBe(dto.wellConfigHash(b));
        expect(dto.wellConfigHash(a)).toMatch(/^[0-9a-f]{8}$/);
    });

    test('zmiana pola cenowego → inny hash (quantity, kineta, klasaNosnosci)', () => {
        const base = dto.wellConfigHash(dtoWell());
        const q = dtoWell();
        q.config[1].quantity = 5;
        expect(dto.wellConfigHash(q)).not.toBe(base);
        const k = dtoWell();
        k.kineta = 'preco';
        expect(dto.wellConfigHash(k)).not.toBe(base);
        const c = dtoWell();
        c.klasaNosnosci_korpus = 'E600';
        expect(dto.wellConfigHash(c)).not.toBe(base);
    });

    test('zmiana runtime/cache → ten sam hash', () => {
        const base = dto.wellConfigHash(dtoWell());
        const r = { ...dtoWell(), solverCache: { big: 1 }, configStatus: 'ERROR' };
        expect(dto.wellConfigHash(r)).toBe(base);
    });

    test('buildSlimWells: wpis {id,name,price,weight,configHash}, zaokrąglenie do grosza', () => {
        const slim = dto.buildSlimWells([dtoWell()], () => ({
            price: 1234.567,
            weight: 500.004
        }));
        expect(slim).toEqual([
            {
                id: 'well-1',
                name: 'S1',
                price: 1234.57,
                weight: 500,
                configHash: dto.wellConfigHash(dtoWell())
            }
        ]);
        expect(dto.buildSlimWells(null, () => ({}))).toEqual([]);
    });

    test('getOrderChanges: legacy full snapshot i slim dają IDENTYCZNY wynik', () => {
        const helpers = loadOrderHelpers({ 'well-1': 1000, 'well-2': 2000 });
        const liveWells = [
            { ...dtoWell(), config: [{ productId: 'd', quantity: 1, frozenPrice: 1 }] },
            {
                id: 'well-2',
                name: 'S2',
                config: [{ productId: 'd', quantity: 1, frozenPrice: 1 }]
            }
        ];
        const legacyOrder = {
            wells: liveWells,
            transportKm: 0,
            transportRate: 0,
            originalSnapshot: {
                wells: JSON.parse(JSON.stringify(liveWells)),
                wellDiscounts: {},
                transportKm: 0,
                transportRate: 0,
                transportMode: 'full'
            }
        };
        const slimOrder = {
            wells: liveWells,
            transportKm: 0,
            transportRate: 0,
            originalSnapshot: {
                slimWells: [
                    { id: 'well-1', name: 'S1', price: 1000, weight: 2000, configHash: 'a' },
                    { id: 'well-2', name: 'S2', price: 2000, weight: 4000, configHash: 'b' }
                ],
                wellDiscounts: {},
                transportKm: 0,
                transportRate: 0,
                transportMode: 'full'
            }
        };
        // brak zmian: oba puste
        expect(helpers.getOrderChanges(legacyOrder)).toEqual({});
        expect(helpers.getOrderChanges(slimOrder)).toEqual({});

        // zmiana ceny S2 (stara 2000 → bieżąca 2500): oba identyczne diffy
        const changedLive = JSON.parse(JSON.stringify(liveWells));
        changedLive[1]._testPrice = 2500;
        const legacyChanged = JSON.parse(JSON.stringify(legacyOrder));
        legacyChanged.wells = JSON.parse(JSON.stringify(changedLive));
        legacyChanged.originalSnapshot.wells[1]._testPrice = 2000;
        const slimChanged = JSON.parse(JSON.stringify(slimOrder));
        slimChanged.wells = JSON.parse(JSON.stringify(changedLive));
        const expected = { 1: { type: 'modified', fields: ['price'], priceDiff: 500 } };
        expect(helpers.getOrderChanges(legacyChanged)).toEqual(expected);
        expect(helpers.getOrderChanges(slimChanged)).toEqual(expected);
    });
});
