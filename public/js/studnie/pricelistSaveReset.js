/* ===== RESET / ZAPIS DOMYŚLNYCH ===== */
async function resetStudniePriceList() {
    try {
        const json = /** @type {any} */ (await api.get('/api/products-studnie/default'));
        if (!json) throw new Error('Nie udało się pobrać domyślnego cennika');
        const customDefault = json.data;
        if (customDefault && customDefault.length > 0) {
            if (
                !(await appConfirm('Przywrócić cennik studni do zapisanego cennika domyślnego?', {
                    title: 'Reset cennika',
                    type: 'warning'
                }))
            )
                return;
            studnieProducts = structuredClone(customDefault);
        } else {
            showToast('Brak zapisanych wartości fabrycznych cennika studni', 'error');
            return;
        }
    } catch {
        showToast('Nie udało się pobrać domyślnego cennika studni z serwera', 'error');
        return;
    }
    _studniePricelistDirty = true;
    updateStudnieSaveBtn();
    renderStudniePriceList();
    renderTiles();
    showToast('Cennik studni przywrócony — kliknij Zapisz by zachować', 'info');
}

async function saveStudniePriceList() {
    if (!_studniePricelistDirty) {
        showToast('Brak zmian do zapisania', 'info');
        return;
    }
    try {
        const ok = await saveStudnieProducts(studnieProducts);
        if (!ok) {
            showToast('Błąd zapisu cennika studni', 'error');
            return;
        }
        _studniePricelistDirty = false;
        updateStudnieSaveBtn();
        await refreshStudnieData();
        showToast('Zapisano cennik studni', 'success');
    } catch (err) {
        logger.error('pricelistManager', 'saveStudniePriceList: wyjątek', err);
        showToast('Błąd zapisu: ' + err.message, 'error');
    }
}

/**
 * Centralne odświeżenie wszystkich widoków konfiguratora po zmianie cennika.
 * Pobiera świeże dane z serwera i przebudowuje: tabelę cennika, kafelki, tabelę Excel.
 */
async function refreshStudnieData() {
    const result = /** @type {any} */ (await api.get('/api/products-studnie', { silent: true }));
    if (result && Array.isArray(result.data)) {
        studnieProducts = result.data;
        renderStudniePriceList();
        renderTiles();
        if (typeof window.refreshExcelFromConfig === 'function') {
            window.refreshExcelFromConfig();
        }
    }
}
