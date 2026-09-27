import crypto from 'crypto';

/**
 * P5.1: kanoniczny fingerprint datasetu (deterministyczny, SHA-256).
 * Odpowiada na pytanie: "czy to dokładnie ten sam logiczny dataset?".
 *
 * Reguły kanonizacji (SSoT — współdzielone z deduplikacją telemetrii):
 * 1. Obiekty: klucze sortowane leksykograficznie na KAŻDYM poziomie.
 * 2. Tablice obiektów: elementy sortowane wg kanonicznego JSON
 *    (kolejność elementów-obiektów nieistotna).
 * 3. Tablice prymitywów: kolejność ZACHOWANA (ma znaczenie, np. ringHeights).
 * 4. Prymitywy/null: bez zmian, serializacja JSON.
 * 5. Semantyka JSON: `undefined` w obiektach pomijane, w tablicach → null,
 *    NaN/Infinity → null, funkcje/symbole pomijane jak w JSON.stringify.
 * 6. Domenowa separacja hasha: prefix 'sok-dataset-v1:' przed SHA-256.
 */

/** Kanoniczny deterministyczny JSON (rekurencyjnie). Nie rzuca dla wartości JSON. */
export function canonicalizeJson(value: unknown): string {
    if (value === null || typeof value !== 'object') {
        return JSON.stringify(value) ?? 'null';
    }
    if (Array.isArray(value)) {
        const items = value.map((el) => canonicalizeJson(el));
        const allObjects = value.every(
            (el) => el !== null && typeof el === 'object' && !Array.isArray(el)
        );
        if (allObjects) {
            items.sort();
        }
        return '[' + items.join(',') + ']';
    }
    const record = value as Record<string, unknown>;
    const parts = Object.keys(record)
        .sort()
        .filter((k) => record[k] !== undefined && typeof record[k] !== 'function')
        .map((k) => JSON.stringify(k) + ':' + canonicalizeJson(record[k]));
    return '{' + parts.join(',') + '}';
}

/** SHA-256 hex kanonicznej reprezentacji (z prefixem domenowym). */
export function fingerprintDataset(input: unknown): string {
    const canonical = canonicalizeJson(input);
    return crypto
        .createHash('sha256')
        .update('sok-dataset-v1:' + canonical, 'utf8')
        .digest('hex');
}
