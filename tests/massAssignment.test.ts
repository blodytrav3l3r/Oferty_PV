/**
 * Testy Mass Assignment dla schematów Zod (Faza 3)
 *
 * Weryfikują, że po zastosowanej poprawce (Faza 3) schematy
 * productPatchSchema i productStudniePatchSchema odrzucają
 * dodatkowe pola nieznane, blokując wektor ataku mass assignment.
 */

import { productPatchSchema, productStudniePatchSchema } from '../src/validators/offerSchemas';

describe('Mass Assignment Prevention - productPatchSchema (rury)', () => {
    it('akceptuje żądanie z poprawnymi polami', () => {
        const result = productPatchSchema.safeParse({
            name: 'Rura DN500',
            price: 250.5
        });
        expect(result.success).toBe(true);
    });

    it('odrzuca żądanie z nieznanymi polami (mass assignment)', () => {
        const result = productPatchSchema.safeParse({
            name: 'Rura DN500',
            price: 250.5,
            extraField: 'attacker-controlled', // Pole nieznane schematowi
            isAdmin: true
        });
        expect(result.success).toBe(false);
    });

    it('nie przepuszcza dodatkowych pól krytycznych (np. isAdmin)', () => {
        const result = productPatchSchema.safeParse({
            isAdmin: true,
            role: 'admin',
            userId: 'admin1'
        });
        expect(result.success).toBe(false);
    });

    it('akceptuje wszystkie dozwolone pola', () => {
        const result = productPatchSchema.safeParse({
            name: 'Rura DN500',
            category: 'Rury Betonowe',
            price: 250.5,
            transport: 15.0,
            weight: 1000.0,
            area: 5.5
        });
        expect(result.success).toBe(true);
    });
});

describe('Mass Assignment Prevention - productStudniePatchSchema (studnie)', () => {
    it('akceptuje żądanie z poprawnymi polami', () => {
        const result = productStudniePatchSchema.safeParse({
            name: 'Krąg DN1000',
            price: 320.0
        });
        expect(result.success).toBe(true);
    });

    it('odrzuca żądanie z nieznanymi polami (mass assignment)', () => {
        const result = productStudniePatchSchema.safeParse({
            name: 'Krąg DN1000',
            price: 320.0,
            rogueField: 'evil-value',
            isActiveAdmin: true
        });
        expect(result.success).toBe(false);
    });

    it('akceptuje wszystkie dozwolone pola liczbowe (nullable)', () => {
        const result = productStudniePatchSchema.safeParse({
            name: 'Krąg DN1000',
            zapasDol: 250,
            zapasGora: 300,
            hMin1: 1000,
            hMax1: 2000,
            cena1: 450
        });
        expect(result.success).toBe(true);
    });

    it('nie przepuszcza dodatkowych atrybutów do schematu', () => {
        // Próba wstrzyknięcia _meta, _config etc.
        const result = productStudniePatchSchema.safeParse({
            __proto__: { isAdmin: true },
            constructor: { prototype: { evil: true } }
        });
        expect(result.success).toBe(false);
    });
});
