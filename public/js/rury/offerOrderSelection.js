// @ts-check
/* ===== SELEKCJA POZYCJI DO ZAMÓWIENIA (RURY) ===== */

window.toggleAllItemsForOrder = function (checked) {
    const section = document.querySelector('.section.active');
    if (!section) return;
    section.querySelectorAll('.item-order-checkbox').forEach((cb) => {
        if (!cb.disabled) cb.checked = checked;
    });
};

window.updateOrderSelectionCount = function () {
    const section = document.querySelector('.section.active');
    if (!section) return;
    const checkboxes = section.querySelectorAll('.item-order-checkbox');
    const total = checkboxes.length;
    const checked = section.querySelectorAll('.item-order-checkbox:checked').length;
    const selectAll = document.getElementById('select-all-items');
    if (selectAll) {
        selectAll.checked = total > 0 && checked === total;
        selectAll.indeterminate = checked > 0 && checked < total;
    }
};

window.collectSelectedItemsForOrder = function () {
    const section = document.querySelector('.section.active');
    if (!section) return [];
    const offerTabActive = section.id === 'section-offer';
    const selector = offerTabActive
        ? '.offer-summary-checkbox:checked'
        : '.item-order-checkbox:checked';
    const selected = [];
    const seen = new Set();
    const items = getActiveItemsArray() || [];
    section.querySelectorAll(selector).forEach((cb) => {
        if (cb.disabled) return;
        const uid = cb.dataset.uid;
        if (!uid || seen.has(uid)) return;
        const item = items.find((it) => it.uid === uid);
        if (item && item.autoAdded && item.productId && item.productId.startsWith('ZT-')) return;
        if (item && getRemainingQuantity(item) <= 0) return;
        seen.add(uid);
        if (item) {
            const cloned = Object.assign({}, item);
            const qtyInput =
                section.querySelector('#order-qty-' + uid) ||
                section.querySelector('#offer-summary-qty-' + uid);
            const partialQty = qtyInput ? parseInt(qtyInput.value) : NaN;
            const remaining = getRemainingQuantity(item);
            cloned.orderedQuantity =
                partialQty > 0 && partialQty <= remaining ? partialQty : remaining;
            selected.push(cloned);
        }
    });
    {
        const selectedPipeQtyByDiam = {};
        selected.forEach((it) => {
            if (it.autoAdded) return;
            const d =
                getProductDiameter(it.productId) ||
                (() => {
                    if (!it.productId) return 0;
                    const parts = it.productId.split('-');
                    if (parts.length >= 5) {
                        const code = parseInt(parts[4]);
                        if (!isNaN(code) && code > 0) return code * 100;
                    }
                    return 0;
                })();
            if (d > 0) {
                const orderQty = it.orderedQuantity || it.quantity || 0;
                selectedPipeQtyByDiam[d] = (selectedPipeQtyByDiam[d] || 0) + orderQty;
            }
        });

        const selectedDiameters = new Set(Object.keys(selectedPipeQtyByDiam).map(Number));

        items.forEach((it) => {
            if (!it.autoAdded) return;
            if (seen.has(it.uid)) return;
            const d =
                getProductDiameter(it.productId) ||
                (() => {
                    if (!it.productId) return 0;
                    const parts = it.productId.split('-');
                    if (parts.length >= 5) {
                        const code = parseInt(parts[4]);
                        if (!isNaN(code) && code > 0) return code * 100;
                    }
                    return 0;
                })();
            if (d > 0 && selectedDiameters.has(d)) {
                const cloned = structuredClone(it);
                if (cloned.productId && cloned.productId.startsWith('ZT-')) {
                    cloned.quantity = selectedPipeQtyByDiam[d] || 0;
                }
                if (cloned.quantity > 0) {
                    selected.push(cloned);
                    seen.add(it.uid);
                }
            }
        });
    }
    return selected;
};

window.onPipeCheckboxChange = function (cb) {
    const diameter = parseInt(cb.dataset.diameter || '0');
    if (!diameter) return;
    const checked = cb.checked;
    document
        .querySelectorAll(
            `.item-order-auto[data-diameter="${diameter}"]:not(:disabled), .offer-summary-auto[data-diameter="${diameter}"]:not(:disabled)`
        )
        .forEach((autoCb) => {
            autoCb.checked = checked;
        });
    if (typeof window.updateOrderSelectionCount === 'function') {
        window.updateOrderSelectionCount();
    }
};
