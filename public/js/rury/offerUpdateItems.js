// @ts-check
/* ===== AKTUALIZACJA POZYCJI (RURY) ===== */

function updatePipeLength(index, newLengthM, skipRender = false) {
    const item = getActiveItemsArray()[index];
    if (isItemLocked(item)) return;
    let newL = Number(newLengthM);

    const diameter = getProductDiameter(item.productId);
    const maxLength = diameter === 2200 ? 2.5 : 3;

    if (newL < 1) {
        newL = 1;
        showToast('Minimalna długość rury to 1m', 'error');
    } else if (newL > maxLength) {
        newL = maxLength;
        showToast(`Maksymalna długość tej rury to ${maxLength}m`, 'error');
    }

    const product = products.find((p) => p.id === item.productId);
    if (!product) return;

    const originalLengthM = getProductLength(product.id) / 1000;
    if (!originalLengthM || originalLengthM <= 0) return;

    if (newL === originalLengthM) {
        item.customLengthM = null;
        item.lengthM = originalLengthM;
        item.weight = product.weight;
        item.transport = product.transport;
        item.name = product.name;
    } else {
        item.customLengthM = newL;
        item.lengthM = newL;

        if (product.weight) {
            const weightPerMeter = product.weight / originalLengthM;
            item.weight = Math.round(weightPerMeter * newL);

            const truckCapacity = product.weight * product.transport || MAX_TRANSPORT_WEIGHT;
            item.transport = Math.max(1, Math.floor(truckCapacity / item.weight));
        }

        const lOriginalMm = Math.round(originalLengthM * 1000);
        const lNewMm = Math.round(newL * 1000);
        if (product.name.includes(` / ${lOriginalMm}`)) {
            item.name = product.name.replace(` / ${lOriginalMm}`, ` / ${lNewMm}`);
        } else {
            item.name = `${product.name} (L=${newL}m)`;
        }
    }

    item.meters = item.quantity * item.lengthM;

    if (!skipRender) {
        syncGaskets();
        syncTransportSecurity();
        renderOfferItems();
        updateOfferSummary();
        if (typeof syncOrderTableIfNeeded === 'function') syncOrderTableIfNeeded();
        showToast('Przeliczono uciętą rurę (waga, transport, nazwa)', 'info');
    } else {
        syncGaskets();
        syncTransportSecurity();
        const ps = document.getElementById('product-search');
        if (ps) ps.value = '';
        const pd = document.getElementById('product-dropdown');
        if (pd) pd.classList.remove('show');
        renderOfferItems();
        if (typeof syncOrderTableIfNeeded === 'function') syncOrderTableIfNeeded();
        showToast('Dodano: ' + item.name.substring(0, 40) + '...', 'success');
    }
}
window.updatePipeLength = updatePipeLength;

function updateItemText(index, field, value) {
    const item = getActiveItemsArray()[index];
    if (isItemLocked(item)) return;
    if (item) {
        item[field] = value;
    }
    if (typeof syncOrderTableIfNeeded === 'function') syncOrderTableIfNeeded();
}
window.updateItemText = updateItemText;

function updateItem(index, field, value) {
    const item = getActiveItemsArray()[index];
    if (isItemLocked(item)) return;
    const numVal = Number(value);

    if (field === 'discount' && numVal > 0) {
        const isGasket =
            item.autoAdded ||
            item.name.toLowerCase().includes('uszczelk') ||
            (item.productId && item.productId.includes('Y-U-GZ-U'));
        if (isGasket) {
            showToast('UWAGA! Wpisujesz rabat na uszczelki!', 'warning');
        }
    }

    if (field === 'quantity') {
        const ordered = getItemOrderedQty(item);
        if (numVal < ordered) {
            showToast(
                'Nie można zmniejszyć poniżej już zamówionej ilości (' + ordered + ' szt.)',
                'error'
            );
            renderOfferItems();
            return;
        }
    }
    item[field] = numVal;
    if (field === 'quantity' && item.lengthM) {
        item.meters = numVal * item.lengthM;
    }

    syncGaskets();
    syncTransportSecurity();
    renderOfferItems();
    if (typeof syncOrderTableIfNeeded === 'function') syncOrderTableIfNeeded();
}
window.updateItem = updateItem;

function updateItemMeters(index, metersValue) {
    const item = getActiveItemsArray()[index];
    if (isItemLocked(item)) return;
    const meters = Number(metersValue);
    item.meters = meters;
    if (item.lengthM && item.lengthM > 0) {
        item.quantity = Math.ceil(meters / item.lengthM);
        if (item.quantity < 1 && meters > 0) item.quantity = 1;
        if (meters === 0) item.quantity = 0;
    }

    syncGaskets();
    syncTransportSecurity();
    renderOfferItems();
    if (typeof syncOrderTableIfNeeded === 'function') syncOrderTableIfNeeded();
}
window.updateItemMeters = updateItemMeters;

function removeOfferItem(index) {
    const item = getActiveItemsArray()[index];
    if (isItemLocked(item)) return;
    if (getItemOrderedQty(item) > 0) {
        showToast('Nie można usunąć produktu, który ma już zamówione sztuki', 'error');
        return;
    }
    getActiveItemsArray().splice(index, 1);
    syncGaskets();
    syncTransportSecurity();
    renderOfferItems();
    if (typeof syncOrderTableIfNeeded === 'function') syncOrderTableIfNeeded();
}
window.removeOfferItem = removeOfferItem;
