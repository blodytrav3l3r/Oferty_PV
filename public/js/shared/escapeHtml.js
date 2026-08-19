// @ts-check
/**
 * escapeHtml.js — ES module (TASK-047, etap 1).
 * Czyste funkcje escapowania. Brak zależności.
 * Eksport ESM + mostek `window.*` dla niezmigrowanych plików legacy.
 */

export function escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str == null ? '' : str;
    return div.innerHTML;
}

export function escapeHtmlAttr(str) {
    return String(str == null ? '' : str)
        .replace(/&/g, '&amp;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;');
}

export function escapeJsStr(str) {
    return String(str ?? '')
        .replace(/\\/g, '\\\\')
        .replace(/'/g, "\\'")
        .replace(/"/g, '\\"');
}

/* Bridge dla legacy — usunąć po zmigrowaniu wszystkich callerów */
window.escapeHtml = escapeHtml;
window.escapeHtmlAttr = escapeHtmlAttr;
window.escapeJsStr = escapeJsStr;
