// @ts-check
/* ===== PEHD (wkładki do rur) ===== */

function addPehdToPipe(pipeIndex, pehdId) {
    if (isItemLocked(getActiveItemsArray()[pipeIndex])) return;
    const pipe = getActiveItemsArray()[pipeIndex];
    const area = getPipeInnerArea(pipe.productId);
    if (area <= 0) return;

    const pehdProd = products.find((p) => p.id === pehdId);
    if (!pehdProd) return;

    if (pipe.pehdType === pehdId) {
        pipe.pehdType = null;
        pipe.pehdCostPerUnit = 0;
        showToast('Wkładka usunięta', 'info');
    } else {
        pipe.pehdType = pehdId;
        let ratio = 1;
        if (pipe.customLengthM) {
            const origL = getProductLength(pipe.productId) / 1000;
            if (origL > 0) ratio = pipe.customLengthM / origL;
        }
        pipe.pehdCostPerUnit = area * ratio * pehdProd.price;
        showToast('Wkładka została przypisana do rury', 'success');
    }

    renderOfferItems();
    if (typeof syncOrderTableIfNeeded === 'function') syncOrderTableIfNeeded();
}
window.addPehdToPipe = addPehdToPipe;
