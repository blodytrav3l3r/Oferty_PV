// @ts-check
/* ===== ZAMÓWIENIA RUR — CORE (globalne zmienne, zapis/odczyt) ===== */
let ordersRury = [];
var pendingOrderCreationData = null;
let orderCurrentItems = [];

function getActiveItemsArray() {
    return window.orderEditMode ? orderCurrentItems : currentOfferItems;
}
window.getActiveItemsArray = getActiveItemsArray;
window.orderCurrentItems = orderCurrentItems;

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
    return isItemInAnyOrder(item.uid);
}
window.isItemLocked = isItemLocked;

async function loadOrdersRury() {
    try {
        const res = await fetchWithTimeout('/api/orders-rury', { headers: authHeaders() });
        const json = await res.json();
        ordersRury = json.data || [];
        return ordersRury;
    } catch (err) {
        logger.error('orderManager', 'Błąd ładowania zamówień rur:', err);
        return [];
    }
}

async function saveOrdersDataRury(data) {
    try {
        const res = await fetch('/api/orders-rury', {
            method: 'PUT',
            headers: authHeaders(),
            body: JSON.stringify({ data })
        });
        if (!res.ok) {
            const errBody = await res.json().catch(() => ({ error: 'Unknown error' }));
            throw new Error(errBody.error || `HTTP ${res.status}`);
        }
        return res;
    } catch (err) {
        logger.error('orderManager', 'Błąd zapisu zamówień rur:', err);
        showToast('Błąd zapisu zamówień', 'error');
        throw err;
    }
}

function getOrdersForOffer(offerId) {
    if (!ordersRury || !offerId) return [];
    return ordersRury.filter((o) => o.offerId === offerId || o.id === offerId);
}
window.getOrdersForOffer = getOrdersForOffer;

/** Porównaj bieżące elementy zamówienia z originalSnapshot. */
function getRuryOrderChanges(order) {
    if (!order || !order.originalSnapshot) return { items: {}, transportChanged: false };
    const result = { items: {}, transportChanged: false };
    const snap = order.originalSnapshot;
    const snapItems = snap.items || [];
    const curItems = order.items || [];
    const maxLen = Math.max(snapItems.length, curItems.length);

    const curKm = Number(document.getElementById('transport-km')?.value || 0);
    const curRate = Number(document.getElementById('transport-rate')?.value || 0);
    const curMode = currentRuryTransportMode || 'full';

    const origKm = snap.transportKm;
    const origRate = snap.transportRate;
    const origMode = snap.transportMode || 'full';
    result.transportChanged =
        Math.abs((curKm || 0) - (origKm || 0)) > 0.01 ||
        Math.abs((curRate || 0) - (origRate || 0)) > 0.01 ||
        curMode !== origMode;

    let origTransportDist = {};
    if (typeof calculateTransportDistribution === 'function' && snapItems.length > 0) {
        const savedMode = currentRuryTransportMode;
        currentRuryTransportMode = origMode;
        const origCostPerTrip = (origKm || 0) * (origRate || 0);
        origTransportDist = calculateTransportDistribution(snapItems, origCostPerTrip);
        currentRuryTransportMode = savedMode;
    }
    const curTransportDist =
        typeof calculateTransportDistribution === 'function' && curItems.length > 0
            ? calculateTransportDistribution(curItems)
            : {};

    for (let i = 0; i < maxLen; i++) {
        if (i >= snapItems.length) {
            result.items[i] = { type: 'added' };
            continue;
        }
        if (i >= curItems.length) {
            result.items[i] = { type: 'removed' };
            continue;
        }
        const si = snapItems[i];
        const ci = curItems[i];

        const origBase =
            (si.unitPrice || 0) * (1 - (si.discount || 0) / 100) +
            (si.pehdCostPerUnit || 0) +
            (si.surcharge || 0);
        const origUnitTotal = origBase + (origTransportDist[si.productId] || 0);
        const curBase =
            (ci.unitPrice || 0) * (1 - (ci.discount || 0) / 100) +
            (ci.pehdCostPerUnit || 0) +
            (ci.surcharge || 0);
        const curUnitTotal = curBase + (curTransportDist[ci.productId] || 0);

        const priceDiff = Math.abs(curUnitTotal - origUnitTotal);
        const qtyDiff = Math.abs((ci.quantity || 0) - (si.quantity || 0));
        if (priceDiff > 0.01 || qtyDiff > 0) {
            result.items[i] = { type: 'modified', priceDiff };
        }
    }

    if (result.transportChanged) {
        for (let i = 0; i < curItems.length; i++) {
            if (!result.items[i] || result.items[i].type !== 'added') {
                if (result.items[i] && result.items[i].type === 'modified') {
                    result.items[i].fields = result.items[i].fields || [];
                    if (!result.items[i].fields.includes('transport')) {
                        result.items[i].fields.push('transport');
                    }
                } else {
                    result.items[i] = { type: 'modified', fields: ['transport'], priceDiff: 0 };
                }
            }
        }
    }

    return result;
}
window.getRuryOrderChanges = getRuryOrderChanges;

async function saveRuryOrder() {
    if (!editingRuryOrderId) {
        showToast('Brak aktywnego zamówienia do zapisania', 'error');
        return;
    }

    const orderIndex = (ordersRury || []).findIndex((o) => o.id === editingRuryOrderId);
    if (orderIndex === -1) {
        showToast('Nie znaleziono zamówienia w pamięci', 'error');
        return;
    }

    const orderData = ordersRury[orderIndex];
    orderData.items = structuredClone(orderCurrentItems || []);
    orderData.transportKm = Number(document.getElementById('transport-km')?.value || 0);
    orderData.transportRate = Number(document.getElementById('transport-rate')?.value || 0);
    orderData.transportMode = currentRuryTransportMode || 'full';
    orderData.updatedAt = new Date().toISOString();

    try {
        await saveOrdersDataRury(ordersRury);
        showToast('Zamówienie zaktualizowane', 'success');
        const orderData = ordersRury[orderIndex];
        if (typeof renderOrderModeBanner === 'function') renderOrderModeBanner(orderData);
        if (typeof updateRuryOrderSummary === 'function') updateRuryOrderSummary(orderData);
    } catch (err) {
        logger.error('orderManager', 'Błąd zapisu zamówienia:', err);
        showToast('Błąd zapisu zamówienia', 'error');
    }
}
window.saveRuryOrder = saveRuryOrder;

window.saveOfferOrOrder = async function () {
    if (window.orderEditMode && editingRuryOrderId) {
        await saveRuryOrder();
    } else {
        await saveOffer();
    }
};

function getCurrentRuryOrder() {
    if (window.orderEditMode && editingRuryOrderId) {
        return (ordersRury || []).find((o) => o.id === editingRuryOrderId) || null;
    }
    if (editingOfferId) {
        return (ordersRury || []).find((o) => o.offerId === editingOfferId) || null;
    }
    return null;
}
window.getCurrentRuryOrder = getCurrentRuryOrder;

function clearOrderEditState() {
    orderEditMode = false;
    window.orderEditMode = false;
    editingRuryOrderId = null;
    window.editingRuryOrderId = null;
    orderCurrentItems = [];
    window.orderCurrentItems = orderCurrentItems;
    pendingOrderCreationData = null;
    if (typeof hideOrderModeBanner === 'function') hideOrderModeBanner();
}
window.clearOrderEditState = clearOrderEditState;

function isOrderMode() {
    return orderEditMode;
}
window.isOrderMode = isOrderMode;
