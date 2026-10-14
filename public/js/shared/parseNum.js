// @ts-check
/**
 * parseNum.js - SSoT parser liczb / DN / naglowkow / eventow Excel (studnie).
 * Czyste funkcje bez zaleznosci. ESM + mostek window.SokParse dla legacy.
 * JEDYNY nowy global w tym pliku: window.SokParse.
 */

/**
 * Tekst/wartosc -> liczba lub null (pusto/NaN -> null; ',' -> '.').
 * @param {unknown} v
 * @returns {number | null}
 */
export function parseNum(v) {
    if (v === null || v === undefined) return null;
    if (typeof v === 'number') return Number.isFinite(v) ? v : null;
    const s = String(v).trim().replace(/,/g, '.');
    if (s === '') return null;
    const n = parseFloat(s);
    return Number.isNaN(n) ? null : n;
}

/**
 * Tekst -> int calkowity lub null; '' -> 0 (kontrakt _excelParseIntStrict).
 * @param {unknown} v
 * @returns {number | null}
 */
export function parseIntStrict(v) {
    if (v === null || v === undefined) return null;
    if (typeof v === 'number') return Number.isInteger(v) ? v : null;
    const s = String(v).trim();
    if (s === '') return 0;
    if (!/^[+-]?\d+$/.test(s)) return null;
    const n = parseInt(s, 10);
    return Number.isNaN(n) ? null : n;
}

/**
 * 'DN1000' / 'dn 1200' / '1000' / 1000 -> 1000; 'styczna'/pusto -> null.
 * @param {unknown} v
 * @returns {number | null}
 */
export function parseDn(v) {
    if (v === null || v === undefined) return null;
    if (typeof v === 'number') return Number.isFinite(v) ? Math.trunc(v) : null;
    const m = String(v).match(/(\d+)/);
    if (!m) return null;
    const n = parseInt(m[1], 10);
    return Number.isNaN(n) ? null : n;
}

/**
 * Wartosc domknieta do [min, max]; nie-liczba -> min.
 * @param {unknown} value
 * @param {number} min
 * @param {number} max
 * @returns {number}
 */
export function clamp(value, min, max) {
    const n = typeof value === 'number' ? value : parseNum(value);
    if (n === null || !Number.isFinite(n)) return min;
    if (n < min) return min;
    if (n > max) return max;
    return n;
}

/**
 * Naglowek kolumny -> UPPER TRIM (kontrakt XlsxImportShared.normalizeHeader).
 * @param {unknown} h
 * @returns {string}
 */
export function normalizeHeader(h) {
    if (h === null || h === undefined) return '';
    return String(h).trim().toUpperCase();
}

/**
 * Sygnal 'sok:excel-mutated' na document (fallback window); bez DOM -> false.
 * @param {unknown} detail
 * @returns {boolean}
 */
export function emitExcelMutated(detail) {
    const data = detail === undefined ? {} : detail;
    try {
        if (typeof CustomEvent === 'undefined') return false;
        const evt = new CustomEvent('sok:excel-mutated', { detail: data, bubbles: true });
        if (typeof document !== 'undefined' && typeof document.dispatchEvent === 'function') {
            document.dispatchEvent(evt);
            return true;
        }
        if (typeof window !== 'undefined' && typeof window.dispatchEvent === 'function') {
            window.dispatchEvent(evt);
            return true;
        }
    } catch (_e) {}
    return false;
}

/* Bridge dla legacy - usunac po zmigrowaniu callerow na import ESM. */
if (typeof window !== 'undefined') {
    window.SokParse = {
        parseNum,
        parseIntStrict,
        parseDn,
        clamp,
        normalizeHeader,
        emitExcelMutated
    };
}
