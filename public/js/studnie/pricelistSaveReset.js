/* ===== RESET / ZAPIS DOMYŚLNYCH ===== */
async function resetStudniePriceList() {
    const btns = document.querySelectorAll('[onclick*="resetStudniePriceList"]');
    btns.forEach((b) => b.setAttribute('disabled', 'true'));
    if (
        !(await appConfirm('Przywrócić cennik studni do zapisanego cennika domyślnego?', {
            title: 'Reset cennika',
            type: 'warning'
        }))
    ) {
        btns.forEach((b) => b.removeAttribute('disabled'));
        return;
    }
    try {
        const res = await fetchWithTimeout('/api/products-studnie/default', {
            headers: authHeaders()
        });
        const json = res.ok ? /** @type {any} */ (await res.json()) : null;
        if (!json) throw new Error('Nie udało się pobrać domyślnego cennika');
        const customDefault = json.data;
        if (customDefault && customDefault.length > 0) {
            studnieProducts = structuredClone(customDefault);
        } else {
            showToast('Brak zapisanych wartości fabrycznych cennika studni', 'error');
            return;
        }
    } catch {
        showToast('Nie udało się pobrać domyślnego cennika studni z serwera', 'error');
        return;
    } finally {
        btns.forEach((b) => b.removeAttribute('disabled'));
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
    const btns = document.querySelectorAll('[onclick*="saveStudniePriceList"]');
    btns.forEach((b) => b.setAttribute('disabled', 'true'));
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
    } finally {
        btns.forEach((b) => b.removeAttribute('disabled'));
    }
}

/**
 * Centralne odświeżenie wszystkich widoków konfiguratora po zmianie cennika.
 * Pobiera świeże dane z serwera i przebudowuje: tabelę cennika, kafelki, tabelę Excel.
 */
async function refreshStudnieData() {
    try {
        const res = await fetch('/api/products-studnie', { headers: authHeaders() });
        const result = res.ok ? /** @type {any} */ (await res.json()) : null;
        if (result && Array.isArray(result.data)) {
            studnieProducts = result.data;
            renderStudniePriceList();
            renderTiles();
            if (typeof window.refreshExcelFromConfig === 'function') {
                window.refreshExcelFromConfig();
            }
        }
    } catch {
        logger.warn('pricelistSaveReset', 'refreshStudnieData: blad pobierania');
    }
}

window.saveStudniePriceList = saveStudniePriceList;
window.resetStudniePriceList = resetStudniePriceList;
