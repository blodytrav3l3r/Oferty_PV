/**
 * money.ts — SSoT zaokrągleń kwot PLN (2 miejsca po przecinku, half-up).
 *
 * Reguła projektu: każda kwota pieniężna zapisywana lub prezentowana ma
 * 2 miejsca po przecinku. Tryb handlowy (half-up, od zera). Przesunięcie
 * dziesiętne umożliwia poprawne zaokrąglenie m.in. 1.005 i 10.075.
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
    if (Math.abs(n) >= 1e21) return n;
    const [mantissa, exponent = '0'] = Math.abs(n).toString().split('e');
    return (n < 0 ? -1 : 1) * (Math.round(Number(`${mantissa}e${Number(exponent) + 2}`)) / 100);
}
