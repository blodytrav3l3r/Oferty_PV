import { roundMoney } from '../src/utils/money';
import { deriveStudnieTotalPrice } from '../src/routes/offers/studnieCrud';

/* =============================================================
   Reguła projektu: każda kwota PLN ma 2 miejsca po przecinku.
   Backend SSoT: src/utils/money.ts → roundMoney (half-up).
   ============================================================= */

describe('roundMoney (backend SSoT)', () => {
    const cases: Array<[unknown, number]> = [
        [0, 0],
        [1, 1],
        [1.004, 1],
        [1.005, 1.01],
        [1.015, 1.02],
        [2.675, 2.68],
        [10.555, 10.56],
        [1234.5678, 1234.57],
        [0.005, 0.01],
        [-1.005, -1.01],
        [-2.675, -2.68],
        ['10.555', 10.56],
        [null, 0],
        [undefined, 0],
        [NaN, 0],
        [Infinity, 0]
    ];

    test.each(cases)('roundMoney(%p) === %p', (input, expected) => {
        expect(roundMoney(input)).toBe(expected);
    });

    test('wynik nie ma artefaktów binarnych', () => {
        for (let i = 0; i < 200; i++) {
            const v = roundMoney(i * 0.037 + 0.005);
            expect(Number(v.toFixed(2))).toBe(v);
        }
    });
});

describe('deriveStudnieTotalPrice — zaokrągla do 2 miejsc', () => {
    test('totalBrutto z ułamkiem groszy', () => {
        expect(deriveStudnieTotalPrice({ totalBrutto: 1234.5678 })).toBe(1234.57);
        expect(deriveStudnieTotalPrice({ data: { totalBrutto: '999.994' } })).toBe(999.99);
    });

    test('jawny totalPrice ma priorytet i też jest zaokrąglany', () => {
        expect(deriveStudnieTotalPrice({ totalPrice: 10.005, totalBrutto: 99 })).toBe(10.01);
    });

    test('brak danych → 0', () => {
        expect(deriveStudnieTotalPrice({})).toBe(0);
        expect(deriveStudnieTotalPrice({ totalPrice: 'abc' })).toBe(0);
    });
});
