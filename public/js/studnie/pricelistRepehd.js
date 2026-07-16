/* ===== PRZELICZANIE PEHD ===== */
window.recalculatePEHD = async function () {
    const input = document.getElementById('pehd-price-input');
    const price = parseFloat(input?.value);
    if (isNaN(price) || price <= 0) {
        showToast('Podaj prawidłową cenę za m²', 'error');
        return;
    }

    let count = 0;
    studnieProducts.forEach((p) => {
        if (p.componentType !== 'przejscie' && p.componentType !== 'kineta' && p.area > 0) {
            p.doplataPEHD = Math.round(getPehdEffectiveArea(p) * price);
            count++;
        }
    });

    _studniePricelistDirty = true;
    updateStudnieSaveBtn();
    renderStudniePriceList();
    showToast(`Przeliczono wkładkę PEHD dla ${count} elementów.`, 'success');
};
