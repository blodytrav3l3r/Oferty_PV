/**
 * Znaki kontrolne i sterujące kierunkiem (bidi), których nie dopuszczamy
 * w nazwach pozycji oferty ani w dokumentach PDF/DOCX.
 */
const FORBIDDEN_RANGES: ReadonlyArray<readonly [number, number]> = [
    [0x0000, 0x001f],
    [0x007f, 0x007f],
    [0x2028, 0x202e],
    [0x2066, 0x2069]
];

function isForbiddenCode(code: number): boolean {
    return FORBIDDEN_RANGES.some(([from, to]) => code >= from && code <= to);
}

/** Zamienia znaki kontrolne/bidi na spację. Zwraca nowy string (bez mutacji). */
export function stripForbiddenTextChars(value: string): string {
    let out = '';
    for (const ch of value) {
        out += isForbiddenCode(ch.codePointAt(0) ?? 0) ? ' ' : ch;
    }
    return out;
}

/** Czy tekst zawiera znaki kontrolne/bidi (walidacja wejścia). */
export function hasForbiddenTextChars(value: string): boolean {
    return stripForbiddenTextChars(value) !== value;
}
