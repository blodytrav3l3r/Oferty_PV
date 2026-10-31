export {};

/**
 * Zakres PRECO z max <= 0 albo max < min nigdy nie dopasuje się w
 * `_findPrecoRange` (zwraca 0 zł bez sygnału). Realne dziury w danych:
 * DN2000 redukcja 901-1000 (max=10), DN2500 uniesienie 401-500 (max=400).
 * Kontrakt: zapis takiego zakresu = 422 (wersje) / 400 (LIVE), nigdy cicho 0.
 */

jest.mock('../src/prismaClient', () => ({ __esModule: true, default: {} }));

import { precoZakresyRowSchema } from '../src/validators/priceDefaultsSchemas';
import { flattenPrecoRows } from '../src/services/precoPricing';
import { InvalidPriceError } from '../src/validators/finiteNumbers';

function zakres(overrides: Record<string, unknown> = {}): Record<string, unknown> {
    return {
        id: 'r1',
        order: 1,
        label: 'redukcja',
        min: 50,
        max: 100,
        grupy: '{"150-300":100}',
        wellDn: 1000,
        ...overrides
    };
}

describe('precoZakresyRowSchema: przedział musi być trafialny', () => {
    test('poprawny zakres przechodzi', () => {
        expect(precoZakresyRowSchema.safeParse(zakres()).success).toBe(true);
    });

    test('max < min odrzucony', () => {
        const res = precoZakresyRowSchema.safeParse(zakres({ min: 901, max: 10 }));
        expect(res.success).toBe(false);
    });

    test('max = 0 odrzucony (martwy przedział)', () => {
        const res = precoZakresyRowSchema.safeParse(zakres({ min: 401, max: 0 }));
        expect(res.success).toBe(false);
    });

    test('min = max = 1 akceptowane (przedział jednopunktowy)', () => {
        expect(precoZakresyRowSchema.safeParse(zakres({ min: 1, max: 1 })).success).toBe(true);
    });
});

describe('flattenPrecoRows (ścieżka LIVE): ta sama reguła', () => {
    function input(zakresy: Array<Record<string, unknown>>): Record<string, unknown> {
        return {
            '1000': {
                cenaDnoOsadnika: 920,
                cenaPelnaWysMB: 1000,
                skrzynkaWlazowa: 400,
                kinety: [],
                spadekKineta: [],
                spadekMufa: [],
                uniesienie: [],
                redukcja: zakresy
            }
        };
    }

    test('max < min rzuca InvalidPriceError (nic nie trafia do bazy)', () => {
        expect(() => flattenPrecoRows(input([zakres({ min: 401, max: 400 })]))).toThrow(
            InvalidPriceError
        );
    });

    test('max = 0 rzuca InvalidPriceError', () => {
        expect(() => flattenPrecoRows(input([zakres({ min: 401, max: 0 })]))).toThrow(
            InvalidPriceError
        );
    });

    test('poprawny zakres przechodzi', () => {
        const rows = flattenPrecoRows(input([zakres({ min: 50, max: 100 })]));
        expect(rows.zakresy).toHaveLength(1);
        expect(rows.zakresy[0].max).toBe(100);
    });
});
