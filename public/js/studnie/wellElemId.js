// @ts-check
/* ===== wellElemId.js — stabilne identyfikatory elementów konfiguracji studni ===== */

/**
 * Nadaje unikalne _elemId każdemu elementowi konfiguracji, który go nie posiada.
 * Idempotentna: istniejące _elemId nie są zmieniane (stabilność wskazań PZ).
 * @param {Array<{ _elemId?: string }>} config
 * @returns {Array<{ _elemId?: string }>}
 */
function ensureElemIds(config) {
    if (!Array.isArray(config)) return config;
    for (const item of config) {
        if (!item || typeof item !== 'object') continue;
        if (!item._elemId) {
            item._elemId = newElemId();
        }
    }
    return config;
}

/**
 * Generuje nowy _elemId. W środowisku przeglądarki z crypto.randomUUID używa go;
 * fallback dla starszych środowisk / testów vm.
 * @returns {string}
 */
function newElemId() {
    if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
        return crypto.randomUUID();
    }
    return 'elem_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 10);
}

window.ensureElemIds = ensureElemIds;
window.newElemId = newElemId;
