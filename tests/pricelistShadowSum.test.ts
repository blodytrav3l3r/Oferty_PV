import { shadowStudnieTotal } from '../src/services/pricelist/shadowSum';

describe('S4 shadow sum oferty studni', () => {
    test('zgodna suma → brak zgłoszenia', () => {
        const blob = { wellsExport: [{ totalPrice: 100.1 }, { totalPrice: 200.2 }] };
        expect(shadowStudnieTotal(blob, 300.3)).toBeNull();
    });

    test('różnica > 1 grosz → delta (stored - suma)', () => {
        const blob = { wellsExport: [{ totalPrice: 100 }, { totalPrice: 200 }] };
        expect(shadowStudnieTotal(blob, 310)).toEqual({
            stored: 310,
            wellsExportTotal: 300,
            delta: 10
        });
    });

    test('różnica 1 grosz mieści się w tolerancji', () => {
        const blob = { wellsExport: [{ totalPrice: 300 }] };
        expect(shadowStudnieTotal(blob, 300.01)).toBeNull();
    });

    test('brak/niepoprawny wellsExport → brak porównania', () => {
        expect(shadowStudnieTotal({}, 100)).toBeNull();
        expect(shadowStudnieTotal({ wellsExport: null }, 100)).toBeNull();
        expect(shadowStudnieTotal({ wellsExport: [] }, 100)).toBeNull();
    });

    test('śmieci w wierszach pomijane, nie wywalają', () => {
        const blob = { wellsExport: [{ totalPrice: 'abc' }, null, { totalPrice: 50 }] };
        expect(shadowStudnieTotal(blob, 50)).toBeNull();
    });
});
