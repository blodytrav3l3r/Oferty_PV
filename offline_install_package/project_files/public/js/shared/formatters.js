/**
 * Shared Formatters — wspólne formatowanie liczb.
 * Eliminuje duplikat fmt/fmtInt z app.js i app_studnie.js.
 */

/**
 * Formatuje liczbę z 2 miejscami po przecinku i spacją tysięczną.
 * @param {number} n
 * @returns {string}
 */
function fmt(n) {
    return Number(n || 0).toLocaleString('pl-PL', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
    });
}

/**
 * Formatuje liczbę całkowitą ze spacją tysięczną.
 * @param {number} n
 * @returns {string}
 */
function fmtInt(n) {
    return Math.round(n || 0).toLocaleString('pl-PL');
}
