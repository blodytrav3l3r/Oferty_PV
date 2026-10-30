/* ===== RESET / ZAPIS DOMYŚLNYCH ===== */
async function resetStudniePriceList() {
    const btns = document.querySelectorAll('[data-csp*="resetStudniePriceList"]');
    btns.forEach((b) => b.setAttribute('disabled', 'true'));
    if (
        !(await appConfirm('Przywrócić cennik studni do zapisanego cennika domyślnego?', {
            title: 'Przywróć domyślne',
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
            window.studnieProducts = structuredClone(customDefault);
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
    if (
        window.pricelistVersions &&
        typeof window.pricelistVersions.isEditing === 'function' &&
        !window.pricelistVersions.isEditing('studnie')
    ) {
        showToast(
            'Kliknij „Edytuj" (albo „Utwórz kopię jako szkic"), aby zmieniać cennik studni',
            'warning'
        );
        return;
    }
    if (!_studniePricelistDirty) {
        showToast('Brak zmian do zapisania', 'info');
        return;
    }
    const btns = document.querySelectorAll('[data-csp*="saveStudniePriceList"]');
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
        if (
            window.pricelistVersions &&
            typeof window.pricelistVersions.refreshStatusStrip === 'function'
        ) {
            window.pricelistVersions.refreshStatusStrip('studnie');
        }
        showToast(
            window.pricelistVersions &&
                typeof window.pricelistVersions.versionEditLabel === 'function' &&
                window.pricelistVersions.versionEditLabel('studnie')
                ? 'Zapisano wersję ' +
                      window.pricelistVersions.versionEditLabel('studnie') +
                      ' — jej ceny zostały podmienione'
                : window.__pricelistWriteTarget === 'draft'
                  ? 'Zapisano szkic studni — opublikuj wersję, aby trafił do ofert'
                  : 'Zapisano cennik studni',
            'success'
        );
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
 * Źródło zależy od kontekstu: edycja (hub) = dane edytora (szkic), podgląd =
 * cennik oferty (wersja pieczątki), a bez pieczątki — obowiązujący (ACTIVE).
 */
async function refreshStudnieData() {
    try {
        const pv = window.pricelistVersions;
        const editing =
            pv && typeof pv.isPricelistEditing === 'function' && pv.isPricelistEditing('studnie');
        const stamp = pv && typeof pv.offerStamp === 'function' ? pv.offerStamp('studnie') : null;
        if (!editing && stamp && typeof pv.applyOfferPricelist === 'function') {
            // Kafelki i Excel muszą liczyć z tego samego cennika co siatka.
            await pv.applyOfferPricelist('studnie', stamp);
        } else {
            const rows = await loadStudnieProducts(editing ? undefined : { source: 'active' });
            if (Array.isArray(rows)) window.studnieProducts = rows;
        }
        renderStudniePriceList();
        renderTiles();
        if (typeof window.refreshExcelFromConfig === 'function') {
            window.refreshExcelFromConfig();
        }
    } catch {
        logger.warn('pricelistSaveReset', 'refreshStudnieData: blad pobierania');
    }
}

window.saveStudniePriceList = saveStudniePriceList;
window.resetStudniePriceList = resetStudniePriceList;
