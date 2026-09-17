/**
 * Osobna pozycja transportu (TR-RURY): guard w calculateTransportDistribution.
 * Gdy flaga separate = true, dystrybucja zwraca {} (koszt nie wchodzi w ceny
 * jednostkowe); domyślnie false = wliczony (status quo).
 */
import fs from 'fs';
import path from 'path';
import vm from 'vm';

function fakeEl() {
    return {
        value: '0',
        textContent: '',
        innerHTML: '',
        style: {},
        parentElement: null,
        classList: {
            add() {},
            remove() {},
            toggle() {},
            contains: () => false
        },
        addEventListener() {},
        removeEventListener() {},
        appendChild() {},
        querySelector: () => null,
        querySelectorAll: () => []
    };
}

function loadTransport() {
    const ctxDir = path.join(process.cwd(), 'public/js/rury');
    const sandbox = {
        window: {} as Record<string, unknown>,
        document: {
            getElementById: () => fakeEl(),
            createElement: () => fakeEl(),
            querySelector: () => null,
            addEventListener() {}
        },
        MAX_TRANSPORT_WEIGHT: 24000,
        getActiveItemsArray: () => [],
        getRuryProductById: () => null,
        getProductDiameter: () => null,
        calculateTransportTrips: () => ({ saved: 0 }),
        fmt: (v: number) => String(v),
        fmtInt: (v: number) => String(v),
        formatTransportCount: (v: number) => String(v),
        escapeHtml: (v: string) => String(v),
        console
    };
    vm.createContext(sandbox);
    vm.runInContext(fs.readFileSync(path.join(ctxDir, 'transport.js'), 'utf-8'), sandbox, {
        filename: 'transport.js'
    });
    const w = sandbox.window as Record<string, (...args: unknown[]) => unknown>;
    return {
        toggle: w['toggleRuryTransportSeparate'] as () => void,
        isSeparate: w['isRuryTransportSeparate'] as () => boolean,
        withFlags: w['withOfferTransportFlags'] as (
            offer: Record<string, unknown>,
            fn: () => unknown
        ) => unknown,
        dist: w['calculateTransportDistributionStandalone'] as (
            items: Array<Record<string, unknown>>,
            costPerTrip: number
        ) => Record<string, number>
    };
}

const ITEMS = [{ productId: 'RTB-0-03-25-K00', weight: 500, quantity: 2 }];

describe('frontend vm: transport osobna pozycja (TR-RURY)', () => {
    it('domyślnie wliczony: dystrybucja niepusta', () => {
        const t = loadTransport();
        expect(t.isSeparate()).toBe(false);
        // 1000 kg wagi, 1 kurs x 100 PLN, 2 szt. => 50 PLN/szt.
        expect(t.dist(ITEMS, 100)).toEqual({ 'RTB-0-03-25-K00': 50 });
    });

    it('po toggle: dystrybucja pusta, toggle wraca do wliczonego', () => {
        const t = loadTransport();
        t.toggle();
        expect(t.isSeparate()).toBe(true);
        expect(t.dist(ITEMS, 100)).toEqual({});
        t.toggle();
        expect(t.isSeparate()).toBe(false);
        expect(t.dist(ITEMS, 100)).toEqual({ 'RTB-0-03-25-K00': 50 });
    });

    it('withOfferTransportFlags: flaga oferty w srodku, restore runtime po wyjsciu', () => {
        const t = loadTransport();
        t.toggle(); // runtime: osobna pozycja
        const inside = t.withFlags({ transportSeparate: false }, () => t.isSeparate());
        expect(inside).toBe(false);
        expect(t.isSeparate()).toBe(true); // runtime nietknięty
        expect(t.dist(ITEMS, 100)).toEqual({});
    });
});
