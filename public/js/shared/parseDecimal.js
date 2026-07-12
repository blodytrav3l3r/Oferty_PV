// @ts-check
/**
 * parseDecimal.js — bezpieczne parsowanie liczb zmiennoprzecinkowych.
 * Obsługuje przecinek jako separator dziesiętny, znaki specjalne, null/undefined.
 *
 * Użycie:
 *   const val = parseDecimal(userInput); // "1,5" → 1.5
 */

function parseDecimal(value) {
    if (typeof value === 'number') return Number.isFinite(value) ? value : 0;
    if (value == null) return 0;
    const normalized = String(value)
        .trim()
        .replace(',', '.')
        .replace(/[^0-9.\-]/g, '');
    const result = parseFloat(normalized);
    return Number.isFinite(result) ? result : 0;
}

window.parseDecimal = parseDecimal;
