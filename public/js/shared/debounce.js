// @ts-check
/**
 * debounce.js — ES module (TASK-047, etap 5).
 * Funkcje opóźniające wywołania (debounce).
 * Eksport ESM + mostek `window.*` dla niezmigrowanych plików legacy.
 */

/**
 * Opóźnia wywołanie funkcji aż do pauzy w wywołaniach (min. `delay` ms po ostatnim).
 * @param {Function} fn
 * @param {number} delay
 * @returns {Function}
 */
export function debounce(fn, delay) {
    let timer;
    return function (...args) {
        clearTimeout(timer);
        timer = setTimeout(() => fn.apply(this, args), delay);
    };
}

/* Bridge dla legacy — usunąć po zmigrowaniu wszystkich callerów */
window.debounce = debounce;
