/**
 * money.ts — SSoT zaokrągleń kwot PLN (2 miejsca po przecinku, half-up).
 *
 * Reguła projektu: każda kwota pieniężna zapisywana lub prezentowana ma
 * 2 miejsca po przecinku. Tryb handlowy (half-up, od zera). `Number.EPSILON`
 * koryguje błąd zapisu binarnego (1.005 → 1.01, 2.675 → 2.68).
 *
 * Zobacz docs/MONEY_ROUNDING.md.
 */

/**
 * Zaokrągla kwotę do 2 miejsc po przecinku (half-up). NaN/Infinity/null → 0.
 * @param value liczba, string liczbowa lub null/undefined
 */
export function roundMoney(value: unknown): number {
    const n = Number(value);
    if (!Number.isFinite(n)) return 0;
    const sign = n < 0 ? -1 : 1;
    const abs = Math.abs(n);
    return sign * (Math.round((abs + Number.EPSILON) * 100) / 100);
}
