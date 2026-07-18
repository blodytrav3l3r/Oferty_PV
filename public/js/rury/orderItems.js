// @ts-check
/* ===== ZAMÓWIENIA RUR — HELPERY ILOŚCIOWE ===== */

function getActiveItemsArray() {
    return window.orderEditMode ? orderCurrentItems : currentOfferItems;
}
window.getActiveItemsArray = getActiveItemsArray;

window.orderCurrentItems = window.orderCurrentItems || [];

function getConfigKey(item) {
    return item.productId + '|' + (item.customLengthM || '') + '|' + (item.pehdType || '');
}

function computeOrderedQuantities() {
    const result = {};
    const offerId = window.editingOfferId;
    if (!offerId || !Array.isArray(ordersRury)) return result;
    const offerOrders = ordersRury.filter((o) => o && o.offerId === offerId);
    if (offerOrders.length === 0) return result;
    offerOrders.forEach((order) => {
        (order.items || []).forEach((oi) => {
            if (!oi || !oi.productId) return;
            const qty = oi.orderedQuantity || oi.quantity || 0;
            if (qty <= 0) return;
            const key = getConfigKey(oi);
            result[key] = (result[key] || 0) + qty;
        });
    });
    return result;
}
window.computeOrderedQuantities = computeOrderedQuantities;

function getItemOrderedQty(item) {
    if (!item || !item.productId) return 0;
    const key = getConfigKey(item);
    const orderedMap = computeOrderedQuantities();
    return orderedMap[key] || 0;
}
window.getItemOrderedQty = getItemOrderedQty;

function getRemainingQuantity(item) {
    if (!item) return 0;
    const ordered = getItemOrderedQty(item);
    return Math.max(0, (item.quantity || 0) - ordered);
}
window.getRemainingQuantity = getRemainingQuantity;

function isItemInAnyOrder(uid) {
    if (!uid) return false;
    if (typeof ordersRury === 'undefined' || !ordersRury) return false;
    const offerId = window.editingOfferId;
    if (!offerId) return false;
    return ordersRury.some(
        (o) =>
            o &&
            o.offerId === offerId &&
            Array.isArray(o.items) &&
            o.items.some((it) => it && it.uid === uid)
    );
}
window.isItemInAnyOrder = isItemInAnyOrder;

function isItemLocked(item) {
    if (!item) return false;
    if (window.orderEditMode) return false;
    return getRemainingQuantity(item) <= 0;
}
window.isItemLocked = isItemLocked;
