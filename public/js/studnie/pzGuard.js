// @ts-check
/* ===== pzGuard.js — blokady usuwania przy istniejących zleceniach produkcyjnych (PZ) ===== */

/**
 * Flaga funkcjonalna: stabilny identyfikator PZ (elementKey) włączony (domyślnie true).
 * Wyłączenie przywraca dopasowanie wyłącznie po elementIndex (stary kod).
 */
let pzStableIdEnabled = true;

/**
 * Ustawia flagę funkcjonalną pz_stable_id.
 * @param {boolean} enabled
 */
function setPzStableIdEnabled(enabled) {
    pzStableIdEnabled = enabled === true;
}

/**
 * Pobiera flagę pz_stable_id z backendu (raz, cache) i aktualizuje stan.
 * W razie błędu zostaje stan domyślny (true).
 */
async function initPzStableIdFlag() {
    try {
        /** @type {RequestInit} */
        const opts = { credentials: 'include' };
        if (typeof authHeaders === 'function') {
            opts.headers = authHeaders();
        }
        const r = await fetch('/api/feature-flags', opts);
        const j = await r.json();
        setPzStableIdEnabled(j.pz_stable_id !== false);
    } catch {
        /* pozostaje domyślne true */
    }
}

/**
 * Zwraca listę zleceń produkcyjnych z globalnego stanu.
 * Obsługuje zarówno globalną zmienną `productionOrders` (studnie.html),
 * jak i ewentualną wersję na `window.productionOrders`.
 * @returns {Array<{ orderId?: string; offerId?: string; wellId?: string; elementIndex?: number }>}
 */
function getProductionOrdersList() {
    return typeof productionOrders !== 'undefined' && productionOrders ? productionOrders : [];
}

function hasPzForOffer(offerId) {
    return getProductionOrdersList().some((po) => String(po.offerId) === String(offerId));
}

function hasPzForOrder(orderId, offerId) {
    return getProductionOrdersList().some(
        (po) =>
            String(po.orderId) === String(orderId) ||
            (String(po.offerId) === String(offerId) && !po.orderId)
    );
}

function hasPzForWell(wellId) {
    return getProductionOrdersList().some((po) => String(po.wellId) === String(wellId));
}

/**
 * Dopasowuje PZ do elementu studni przez elementKey (stabilny), z fallbackiem na elementIndex
 * (legacy PZ zapisane przed wprowadzeniem elementKey). Jedyne źródło dopasowania PZ↔element
 * (krok 3.4 planu — PZ stable ID).
 * @param {Array} list lista PZ
 * @param {string} wellId id studni
 * @param {string} [elemKey] elementKey (_elemId) elementu
 * @param {number} [elementIndex] legacy indeks elementu
 * @returns {object|undefined}
 */
function findPzForElement(list, wellId, elemKey, elementIndex) {
    if (!Array.isArray(list)) return undefined;
    // 1. Ścisłe dopasowanie po elementKey
    if (pzStableIdEnabled && elemKey) {
        const matchedByKey = list.find(
            (po) =>
                String(po.wellId) === String(wellId) &&
                po.elementKey &&
                String(po.elementKey) === String(elemKey)
        );
        if (matchedByKey) return matchedByKey;
    }
    // 2. Fallback po elementIndex dla legacy PZ lub w przypadku przelosowania _elemId w edytorze
    if (typeof elementIndex === 'number') {
        return list.find(
            (po) =>
                String(po.wellId) === String(wellId) &&
                typeof po.elementIndex === 'number' &&
                po.elementIndex === elementIndex
        );
    }
    return undefined;
}

// Ochrona reindeksacji: blokada usunięcia elementu, gdy w studni jest PZ o elementIndex >= usuwany indeks
function hasPzForElementAtOrAfter(wellId, elementIndex) {
    return getProductionOrdersList().some(
        (po) =>
            String(po.wellId) === String(wellId) &&
            typeof po.elementIndex === 'number' &&
            po.elementIndex >= elementIndex
    );
}

window.pzGuard = {
    hasPzForOffer,
    hasPzForOrder,
    hasPzForWell,
    hasPzForElementAtOrAfter,
    findPzForElement,
    setPzStableIdEnabled,
    initPzStableIdFlag
};
