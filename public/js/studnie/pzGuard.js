// @ts-check
/* ===== pzGuard.js — blokady usuwania przy istniejących zleceniach produkcyjnych (PZ) ===== */

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

// Ochrona reindeksacji: blokada usunięcia elementu, gdy w studni jest PZ o elementIndex >= usuwany indeks
function hasPzForElementAtOrAfter(wellId, elementIndex) {
    return getProductionOrdersList().some(
        (po) =>
            String(po.wellId) === String(wellId) &&
            typeof po.elementIndex === 'number' &&
            po.elementIndex >= elementIndex
    );
}

window.pzGuard = { hasPzForOffer, hasPzForOrder, hasPzForWell, hasPzForElementAtOrAfter };
