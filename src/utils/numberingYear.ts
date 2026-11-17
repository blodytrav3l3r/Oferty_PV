const NUMBERING_TIME_ZONE = 'Europe/Warsaw';

/**
 * Rok kalendarzowy numeracji — licząc w strefie Europe/Warsaw, nie w strefie serwera.
 * Dzięki temu numer zmienia się o północy czasu lokalnego (reset roczny puli).
 */
export function getNumberingYear(date = new Date()): number {
    return Number(
        new Intl.DateTimeFormat('en', { year: 'numeric', timeZone: NUMBERING_TIME_ZONE }).format(
            date
        )
    );
}
