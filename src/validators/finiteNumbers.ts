/**
 * D-FIX-2: SSoT walidacji liczb biznesowych (ceny, ilości, wymiary, PRECO).
 *
 * Problem: `Number(value ?? 0)` zamieniał cicho `null`/`undefined`/`''`/
 * niepoprawne stringi na `0`, a `z.number()` przepuszcza `NaN`/`Infinity`.
 * Reguła: walidacja PRZED konwersją do wartości biznesowej; invalid → throw
 * (route mapuje na 400), nigdy ciche `0`.
 */
import { z } from 'zod';

export class InvalidPriceError extends Error {
    readonly field: string;
    constructor(field: string) {
        super(`Nieprawidłowa wartość liczbowa pola "${field}"`);
        this.name = 'InvalidPriceError';
        this.field = field;
    }
}

/**
 * Wymagana nieujemna skończona liczba biznesowa.
 * Akceptuje liczby oraz numeryczne stringi (kontrakt FE). Odrzuca:
 * null, undefined, booleany, obiekty, '', białe znaki, NaN, ±Infinity, ujemne.
 */
export function requireFinitePrice(value: unknown, field: string): number {
    let n: number;
    if (typeof value === 'number') {
        n = value;
    } else if (typeof value === 'string') {
        if (value.trim() === '') throw new InvalidPriceError(field);
        n = Number(value);
    } else {
        throw new InvalidPriceError(field);
    }
    if (!Number.isFinite(n) || n < 0) throw new InvalidPriceError(field);
    return n;
}

/** Zod: liczba nieujemna i skończona (wzorzec: discount w offerSchemas). */
export const finiteNonNegative = (msg = 'Wartość musi być skończoną liczbą >= 0') =>
    z.number().finite(msg).nonnegative(msg);

/** Zod: liczba dodatnia i skończona. */
export const finitePositive = (msg = 'Wartość musi być skończoną liczbą > 0') =>
    z.number().finite(msg).positive(msg);
