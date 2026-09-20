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

/**
 * Nadaje stabilne id każdemu przejściu, które go nie posiada.
 * Idempotentna: istniejące id nie są zmieniane (stabilność data-prz-id).
 * @param {Array<{ id?: string }>} przejscia
 * @returns {Array<{ id?: string }>}
 */
function ensurePrzejsciaIds(przejscia) {
    if (!Array.isArray(przejscia)) return przejscia;
    for (const item of przejscia) {
        if (!item || typeof item !== 'object') continue;
        if (!item.id) {
            item.id =
                'prz-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 8);
        }
    }
    return przejscia;
}

/**
 * Przenosi _elemId ze starego configu na nowy (po rebuildzie solvera).
 * Dopasowanie po productId+quantity, pozycyjnie w obrębie tej samej sygnatury.
 * Reszta dostaje świeże _elemId przez ensureElemIds (stabilność wskazań PZ).
 * @param {Array} oldConfig
 * @param {Array} newConfig
 * @returns {Array}
 */
function carryOverConfigElemIds(oldConfig, newConfig) {
    if (!Array.isArray(newConfig)) return newConfig;
    const buckets = new Map();
    for (const item of oldConfig || []) {
        if (!item || typeof item !== 'object') continue;
        if (!item._elemId) continue;
        const key = String(item.productId || '') + '|' + String(item.quantity ?? 1);
        if (!buckets.has(key)) buckets.set(key, []);
        buckets.get(key).push(item._elemId);
    }
    for (const item of newConfig) {
        if (!item || typeof item !== 'object') continue;
        if (item._elemId) continue;
        const key = String(item.productId || '') + '|' + String(item.quantity ?? 1);
        const stack = buckets.get(key);
        if (stack && stack.length > 0) {
            item._elemId = stack.shift();
        }
    }
    return ensureElemIds(newConfig);
}

window.ensureElemIds = ensureElemIds;
window.newElemId = newElemId;
window.ensurePrzejsciaIds = ensurePrzejsciaIds;
window.carryOverConfigElemIds = carryOverConfigElemIds;
