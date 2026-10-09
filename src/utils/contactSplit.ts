/**
 * Rozcina łączony mirror kontaktu "Jan Kowalski, 600 100 200"
 * (lustro heurystyki FE parseLegacyMirror w clientContacts.js).
 *
 * Rozcina tylko gdy wyciągnięty telefon zgadza się z kolumną phone
 * (porównanie po cyfrach) albo kolumna jest pusta. Rozjazd danych
 * (inne cyfry) i brak dopasowania zostają verbatim — bez zgadywania.
 */
export function splitMergedContact(
    name: string,
    phone: string | null
): { name: string; phone: string | null } {
    const digits = (s: string): string => s.replace(/\D/g, '');
    const m = name.match(/^(.*?)[,;]\s*([\d+\-() ]{7,20})$/);
    if (!m) return { name, phone };
    const extracted = m[2].trim();
    const base = (m[1].trim() || name).slice(0, 200);
    if (!phone) return { name: base, phone: extracted.slice(0, 50) };
    if (digits(phone) === digits(extracted)) return { name: base, phone };
    return { name, phone };
}
