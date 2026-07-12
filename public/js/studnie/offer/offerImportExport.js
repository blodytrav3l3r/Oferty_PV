/* ===== OFERTY STUDNIE — IMPORT / EKSPORT JSON ===== */

function exportJSONStudnie(id) {
    const offer = offersStudnie.find((o) => o.id === id);
    if (!offer) return;
    const jsonStr = JSON.stringify(offer, null, 2);
    const blob = new Blob([jsonStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `STUDNIE_OFERTA_${offer.number.replace(/[^A-Za-z0-9]/g, '_')}.json`;
    a.click();
    URL.revokeObjectURL(url);
}

function importOfferFromFileStudnie() {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'application/json';
    input.onchange = (e) => {
        const file = /** @type {HTMLInputElement} */ (e.target).files[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = async (event) => {
            try {
                const imported = JSON.parse(/** @type {string} */ (event.target.result));
                if (imported && imported.wells) {
                    imported.id = 'offer_studnie_' + Date.now();
                    migrateWellData(imported.wells);
                    offersStudnie.push(imported);
                    await saveOffersDataStudnie(offersStudnie);
                    renderSavedOffersStudnie();
                    showToast('Oferta zaimportowana', 'success');
                } else {
                    showToast('Nieprawidłowy plik studni', 'error');
                }
            } catch (err) {
                showToast('Błąd zapisu zaimportowanej oferty', 'error');
            }
        };
        reader.readAsText(file);
    };
    input.click();
}

window.exportJSONStudnie = exportJSONStudnie;
window.importOfferFromFileStudnie = importOfferFromFileStudnie;
