// @ts-nocheck -- vm sandbox, celowy brak typow dla public/js
// Zamrozony transport per studnia w zamowieniu: zmiana jednej studni nie
// rusza cen pozostalych. Liczby kotwiczne z zywych danych OS/000002/SA/2026
// (27705 kg, 100 km x 10 PLN, full → 2000; s1 4349 kg → 313.95).
import fs from 'fs';
import path from 'path';
import vm from 'vm';

function loadAll(prices: Record<string, number>, weights: Record<string, number>) {
    const context: any = {
        window: {},
        structuredClone: (obj: any) => JSON.parse(JSON.stringify(obj)),
        logger: { info: () => {}, warn: () => {}, error: () => {} },
        wellDiscounts: {},
        studnieProducts: [],
        getStudnieProductById: () => null,
        getWellNadbudowaPct: () => 0,
        calcWellStats: (w: any) => ({
            price: w._testPrice ?? prices[w.id] ?? 0,
            weight: weights[w.id] ?? 0
        }),
        MAX_TRANSPORT_WEIGHT: 24000,
        calcTransportCount: (weight: number, mode: string) => {
            if (weight <= 0) return 0;
            if (mode === 'fractional') return Math.round((weight / 24000) * 1000) / 1000;
            return Math.ceil(weight / 24000);
        }
    };
    vm.createContext(context);
    vm.runInContext(
        fs.readFileSync(path.join(__dirname, '../../public/js/studnie/orderDto.js'), 'utf8'),
        context
    );
    vm.runInContext(
        fs.readFileSync(path.join(__dirname, '../../public/js/studnie/orderHelpers.js'), 'utf8'),
        context
    );
    // Przegladarka: window.X widoczne jako gole X; w vm kopiujemy jawnie.
    for (const k of [
        'calcTransportCount',
        'MAX_TRANSPORT_WEIGHT',
        'calcWellStats',
        'wellDiscounts'
    ]) {
        if (context.window[k] !== undefined) context[k] = context.window[k];
    }
    return context.window;
}

const SA = {
    prices: {
        'well-1': 4136.5,
        'well-2': 6709,
        'well-3': 6776.25,
        'well-4': 9783.25
    },
    weights: { 'well-1': 4349, 'well-2': 6369, 'well-3': 5572, 'well-4': 11415 }
};

function mkWell(h: any, id: string, frozen?: number) {
    const w: any = {
        id,
        name: id,
        dn: '1000',
        kineta: 'beton',
        dennicaMaterial: 'betonowa',
        config: [{ productId: 'KDB-10-10-D', quantity: 1 }]
    };
    if (frozen != null) w.frozenTransportCost = frozen;
    return w;
}

function mkOrder(h: any, live: any[], frozen: (number | null)[]) {
    const wells = live.map((w, i) => {
        const c = JSON.parse(JSON.stringify(w));
        if (frozen[i] != null) c.frozenTransportCost = frozen[i];
        return c;
    });
    const slimWells = wells.map((w) => ({
        id: w.id,
        name: w.name,
        price: SA.prices[w.id],
        weight: SA.weights[w.id],
        configHash: h.wellConfigHash(h.toWellOrderDTO(w)),
        transport: w.frozenTransportCost ?? 0
    }));
    return {
        wells,
        transportKm: 100,
        transportRate: 10,
        transportMode: 'full',
        originalSnapshot: {
            slimWells,
            wellDiscounts: {},
            transportKm: 100,
            transportRate: 10,
            transportMode: 'full'
        }
    };
}

describe('orderFrozenTransport — zamrozone udzialy w zamowieniu', () => {
    let h: any;
    beforeAll(() => {
        h = loadAll(SA.prices, SA.weights);
    });

    test('calcOrderTheoreticalTransport: skala oferta->zamowienie jak saveCurrentOrder', () => {
        // Caly zestaw: ceil(27705/24000) * 1000 = 2000.
        expect(h.calcOrderTheoreticalTransport(27705, 27705, 100, 10, 'full')).toBe(2000);
        // Polowa masy: 2000 * 13852.5/27705 = 1000.
        expect(h.calcOrderTheoreticalTransport(13852.5, 27705, 100, 10, 'full')).toBe(1000);
        expect(h.calcOrderTheoreticalTransport(0, 27705, 100, 10, 'full')).toBe(0);
        expect(h.calcOrderTheoreticalTransport(27705, 27705, 0, 10, 'full')).toBe(0);
    });

    test('redistribute: wszystkie elastyczne → proporcja jak dzis (2000; s1 313.95)', () => {
        const shares = h.redistributeFrozenTransport(
            [
                { weight: 4349, frozen: null },
                { weight: 6369, frozen: null },
                { weight: 5572, frozen: null },
                { weight: 11415, frozen: null }
            ],
            2000
        );
        expect(shares[0]).toBeCloseTo(313.95, 2);
        expect(shares.reduce((s: number, v: number) => s + v, 0)).toBeCloseTo(2000, 2);
    });

    test('redistribute: zmiana jednej → pozostale trzymaja, reszta na zmieniona', () => {
        const shares = h.redistributeFrozenTransport(
            [
                { weight: 4349, frozen: 313.95 },
                { weight: 6369, frozen: 459.81 },
                { weight: 5572, frozen: 402.27 },
                { weight: 12000, frozen: null }
            ],
            2000
        );
        expect(shares[0]).toBe(313.95);
        expect(shares[1]).toBe(459.81);
        expect(shares[2]).toBe(402.27);
        expect(shares[3]).toBeCloseTo(2000 - 313.95 - 459.81 - 402.27, 2);
        expect(shares.reduce((s: number, v: number) => s + v, 0)).toBeCloseTo(2000, 2);
    });

    test('redistribute: ujemna reszta (keeps niefinnansowalne) → refreeze wszystkich', () => {
        const shares = h.redistributeFrozenTransport(
            [
                { weight: 4349, frozen: 900 },
                { weight: 6369, frozen: 900 }
            ],
            1000
        );
        expect(shares.reduce((s: number, v: number) => s + v, 0)).toBeCloseTo(1000, 2);
        expect(shares[0]).toBeGreaterThanOrEqual(0);
        expect(shares[1]).toBeGreaterThanOrEqual(0);
        // Proporcja od nowa: ciezsza dostaje wiecej.
        expect(shares[1]).toBeGreaterThan(shares[0]);
    });

    test('redistribute: T=0 → zera; rowny podzial przy zerowych masach', () => {
        expect(h.redistributeFrozenTransport([{ weight: 5, frozen: 3 }], 0)).toEqual([0]);
        const shares = h.redistributeFrozenTransport(
            [
                { weight: 0, frozen: null },
                { weight: 0, frozen: null }
            ],
            100
        );
        expect(shares).toEqual([50, 50]);
    });

    test('freezeTransportShares: cena sasiada niezmieniona → udzial nietkniety', () => {
        const ids = ['well-1', 'well-2', 'well-3', 'well-4'];
        const frozen = [313.95, 459.81, 402.27, 823.97];
        const live = ids.map((id) => mkWell(h, id));
        const order = mkOrder(h, live, frozen);
        // Zmiana TYLKO well-4 (cena 9783.25 → 10000): reszta trzyma.
        order.wells[3]._testPrice = 10000;
        const res = h.freezeTransportShares(order.wells, {
            theoreticalTotal: 2000,
            refreezeAll: false,
            orderLike: order
        });
        expect(res.shares[0]).toBe(313.95);
        expect(res.shares[1]).toBe(459.81);
        expect(res.shares[2]).toBe(402.27);
        expect(res.shares[3]).toBeCloseTo(2000 - 313.95 - 459.81 - 402.27, 2);
        // Mutacja w miejscu — DTO poniesie przez allowlist.
        expect(order.wells[0].frozenTransportCost).toBe(313.95);
        expect(res.delta).toBeCloseTo(0, 2);
    });

    test('freezeTransportShares: refreezeAll (zmiana km) przelicza wszystkie', () => {
        const ids = ['well-1', 'well-2'];
        const live = ids.map((id) => mkWell(h, id));
        const order = mkOrder(h, live, [313.95, 459.81]);
        const res = h.freezeTransportShares(order.wells, {
            theoreticalTotal: 3000,
            refreezeAll: true,
            orderLike: order
        });
        const wTotal = SA.weights['well-1'] + SA.weights['well-2'];
        expect(res.shares[0]).toBeCloseTo((3000 * SA.weights['well-1']) / wTotal, 2);
        expect(res.shares[1]).toBeCloseTo((3000 * SA.weights['well-2']) / wTotal, 2);
    });
});
