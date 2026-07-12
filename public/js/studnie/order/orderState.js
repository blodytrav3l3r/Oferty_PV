// @ts-check
/* ===== POMOCNIKI ZAMÓWIEŃ CZĘŚCIOWYCH ===== */

function getOrdersForOffer(offerId) {
    if (!ordersStudnie || !offerId) return [];
    const nId = normalizeId(offerId);
    return ordersStudnie.filter((o) => normalizeId(o.offerId || o.offerStudnieId) === nId);
}

function getOrderedWellIds(offerId) {
    const orders = getOrdersForOffer(offerId);
    const ids = new Set();
    orders.forEach((order) => {
        (order.wells || []).forEach((w) => {
            if (w.id) ids.add(w.id);
        });
    });
    return ids;
}

function isWellOrdered(well) {
    if (!well || !well.id || !editingOfferIdStudnie) return false;
    return getOrderedWellIds(editingOfferIdStudnie).has(well.id);
}

function getOfferOrderProgress(offerId, offerWells) {
    const orderedIds = getOrderedWellIds(offerId);
    const total = (offerWells || []).length;
    const ordered = (offerWells || []).filter((w) => w.id && orderedIds.has(w.id)).length;
    const percent = total > 0 ? Math.round((ordered / total) * 100) : 0;
    return { ordered, total, percent };
}

function getOrderForWellId(wellId, offerId) {
    if (!wellId || !ordersStudnie) return null;
    const nId = offerId ? normalizeId(offerId) : null;
    return (
        ordersStudnie.find((order) => {
            if (nId && normalizeId(order.offerId) !== nId) return false;
            return (order.wells || []).some((w) => w.id === wellId);
        }) || null
    );
}

window.getOrdersForOffer = getOrdersForOffer;
window.getOrderedWellIds = getOrderedWellIds;
window.isWellOrdered = isWellOrdered;
window.getOfferOrderProgress = getOfferOrderProgress;
window.getOrderForWellId = getOrderForWellId;

function getCurrentOfferOrder() {
    if (orderEditMode) return orderEditMode.order;
    if (!editingOfferIdStudnie) return null;
    return ordersStudnie
        ? ordersStudnie.find((o) => o.offerId === editingOfferIdStudnie) || null
        : null;
}

function collectSelectedWellsForOrder() {
    const checkboxes = document.querySelectorAll('.well-order-checkbox:checked');
    const selectedWells = [];
    checkboxes.forEach((cb) => {
        const idx = parseInt(cb.dataset.wellIndex, 10);
        if (!isNaN(idx) && wells[idx]) {
            selectedWells.push(wells[idx]);
        }
    });
    return selectedWells;
}

function getOrderChanges(order) {
    if (!order || !order.originalSnapshot) return {};
    const changes = {};

    const originalSnapshotData = order.originalSnapshot;
    const originalWells = Array.isArray(originalSnapshotData)
        ? originalSnapshotData
        : originalSnapshotData.wells || [];
    const originalDiscounts = !Array.isArray(originalSnapshotData)
        ? originalSnapshotData.wellDiscounts || null
        : null;

    const orig = structuredClone(originalWells);
    if (typeof migrateWellData === 'function') migrateWellData(orig);
    const curr = order.wells;

    const savedDiscounts =
        typeof wellDiscounts !== 'undefined' ? structuredClone(wellDiscounts) : null;
    if (originalDiscounts && typeof wellDiscounts !== 'undefined') {
        window.wellDiscounts = originalDiscounts;
    }
    freezeWellPrices(orig);
    if (savedDiscounts && typeof wellDiscounts !== 'undefined') {
        window.wellDiscounts = savedDiscounts;
    }

    const savedPreviewMode = window.isPreviewMode;
    window.isPreviewMode = true;

    const maxLen = Math.max(orig.length, curr.length);
    for (let i = 0; i < maxLen; i++) {
        if (i >= orig.length) {
            changes[i] = { type: 'added' };
            continue;
        }
        if (i >= curr.length) {
            changes[i] = { type: 'removed', name: orig[i].name };
            continue;
        }

        const origStats = calcWellStats(orig[i]);
        const currStats = calcWellStats(curr[i]);

        if (Math.abs(currStats.price - origStats.price) > 0.01) {
            changes[i] = {
                type: 'modified',
                fields: ['price'],
                priceDiff: currStats.price - origStats.price
            };
        }
    }

    const origTransportKm = originalSnapshotData.transportKm;
    const origTransportRate = originalSnapshotData.transportRate;
    const origTransportMode = originalSnapshotData.transportMode;
    const transportChanged =
        (origTransportKm != null || origTransportRate != null) &&
        (Math.abs((order.transportKm || 0) - (origTransportKm || 0)) > 0.01 ||
            Math.abs((order.transportRate || 0) - (origTransportRate || 0)) > 0.01 ||
            (order.transportMode || 'full') !== (origTransportMode || 'full'));
    if (transportChanged) {
        for (let i = 0; i < curr.length; i++) {
            if (!changes[i] || changes[i].type !== 'added') {
                if (changes[i] && changes[i].type === 'modified') {
                    changes[i].fields.push('transport');
                } else {
                    changes[i] = { type: 'modified', fields: ['transport'], priceDiff: 0 };
                }
            }
        }
    }

    window.isPreviewMode = savedPreviewMode;

    return changes;
}
