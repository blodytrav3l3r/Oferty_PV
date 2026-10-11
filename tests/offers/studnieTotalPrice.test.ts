/*
 * tests/offers/studnieTotalPrice.test.ts
 * Kolumna totalPrice z kształtu incoming (FE nie wysyła top-level totalPrice).
 */
import { deriveStudnieTotalPrice } from '../../src/routes/offers/studnieCrud';

describe('deriveStudnieTotalPrice', () => {
    it('jawny totalPrice/price wygrywa', () => {
        expect(deriveStudnieTotalPrice({ totalPrice: 100 })).toBe(100);
        expect(deriveStudnieTotalPrice({ price: 200 })).toBe(200);
        expect(deriveStudnieTotalPrice({ totalPrice: 100, totalBrutto: 999 })).toBe(100);
    });
    it('kształt FE (totalBrutto top-level, bez totalPrice) nie daje 0', () => {
        expect(deriveStudnieTotalPrice({ totalBrutto: 3931.08, wells: [] })).toBe(3931.08);
    });
    it('zagnieżdżone data.totalBrutto / data.totalPrice', () => {
        expect(deriveStudnieTotalPrice({ data: { totalBrutto: 10 } })).toBe(10);
        expect(deriveStudnieTotalPrice({ data: { totalPrice: 20 } })).toBe(20);
    });
    it('brak/śmieci → 0 (stringi liczbowe działają)', () => {
        expect(deriveStudnieTotalPrice({})).toBe(0);
        expect(deriveStudnieTotalPrice({ totalBrutto: 'abc' })).toBe(0);
        expect(deriveStudnieTotalPrice({ totalBrutto: '29405' })).toBe(29405);
    });
});
