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
    const pv = window.pricelistVersions;
    const versionLabel = pv?.versionEditLabel?.('studnie');
    const rows = studnieProducts;
    btns.forEach((b) => b.setAttribute('disabled', 'true'));
    try {
        const saved = await saveStudnieProducts(rows);
        if (!saved || saved.error) {
            showToast(
                'Nie potwierdzono zapisu cennika studni: ' + (saved?.error || 'brak odpowiedzi'),
                'error'
            );
            return;
        }
        if (studnieProducts === rows || saved.savedWhilePreviewing) {
            _studniePricelistDirty = false;
            if (studnieProducts === rows && Array.isArray(saved.rows)) {
                window.studnieProducts = saved.rows;
            }
            // Odczyt kontrolny w saveStudnieProducts już zwrócił zapisany cel.
            await refreshStudnieData({ reload: false });
        }
        if (typeof pv?.refreshStatusStrip === 'function') {
            try {
                await pv.refreshStatusStrip('studnie');
            } catch (err) {
                logger.warn('pricelistSaveReset', 'Nie udało się odświeżyć paska cennika', err);
            }
        }
        showToast(
            versionLabel
                ? 'Zapisano wersję ' + versionLabel + ' — jej ceny zostały podmienione'
                : 'Zapisano szkic studni — opublikuj wersję, aby trafił do ofert',
            'success'
        );
    } catch (err) {
        logger.error('pricelistManager', 'saveStudniePriceList: wyjątek', err);
        showToast('Błąd zapisu: ' + err.message, 'error');
    } finally {
        btns.forEach((b) => b.removeAttribute('disabled'));
        updateStudnieSaveBtn();
    }
}

/**
 * Centralne odświeżenie wszystkich widoków konfiguratora po zmianie cennika.
 * Pobiera świeże dane z serwera i przebudowuje: tabelę cennika, kafelki, tabelę Excel.
 * Źródło zależy od kontekstu: edycja (hub) = dane edytora (szkic), podgląd =
 * cennik oferty (wersja pieczątki), a bez pieczątki — obowiązujący (ACTIVE).
 * @param {{reload?: boolean}} [options]
 */
async function refreshStudnieData({ reload = true } = {}) {
    try {
        const versionBar = document.getElementById('pv-version-bar');
        const isPreviewing = () =>
            versionBar &&
            !versionBar.hidden &&
            versionBar.dataset.axis === 'studnie' &&
            window.pricelistVersions?.isEditing?.('studnie') !== true;
        if (reload && !isPreviewing()) {
            const pv = window.pricelistVersions;
            const editing = pv?.isEditing?.('studnie') === true;
            const stamp = pv?.offerStamp?.('studnie');
            if (!editing && stamp && typeof pv.applyOfferPricelist === 'function') {
                // Kafelki i Excel muszą liczyć z tego samego cennika co siatka.
                await pv.applyOfferPricelist('studnie', stamp);
            } else if (!pv?.versionEditLabel?.('studnie')) {
                const previousRows = studnieProducts;
                const rows = await loadStudnieProducts(editing ? undefined : { source: 'active' });
                if (
                    studnieProducts === previousRows &&
                    (pv?.isEditing?.('studnie') === true) === editing &&
                    !isPreviewing() &&
                    Array.isArray(rows)
                ) {
                    window.studnieProducts = rows;
                }
            }
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
