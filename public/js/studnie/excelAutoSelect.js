// @ts-check
/* ===== EXCEL AUTO-SELECT — Auto-dobór komponentów dla studni ===== */

async function _excelAutoSelectForWell(wIdx) {
    const well = wells[wIdx];
    if (!well) return;
    if (_excelIsWellLocked(wIdx)) return; /* blokada PZ / zamówienie */
    if (well.rzednaWlazu == null || well.rzednaDna == null) return;
    if (well.autoSelect === false) return; /* Manual skip */
    if (typeof autoSelectComponents !== 'function') return;
    const savedIdx = typeof currentWellIndex !== 'undefined' ? currentWellIndex : -1;
    try {
        currentWellIndex = wIdx;
        _excelMarkDirty();
        await autoSelectComponents(true);
        _excelClearResCache(well);
        _excelRenderTable(_excelActiveTab);
        _excelUpdateHeaderProdCodes();
    } finally {
        if (savedIdx >= 0) currentWellIndex = savedIdx;
    }
}

/* Per-row toggle: przelacz well.autoSelect (bez regresami Auto/Manual naglowka) */
function _excelToggleWellAutoMode(wIdx) {
    if (typeof wells === 'undefined' || !wells[wIdx]) return;
    if (!_excelGuardWellLocked(wIdx)) return;
    _excelSaveUndoSnapshot();
    _excelMarkDirty();
    wells[wIdx].autoSelect = wells[wIdx].autoSelect === false;
    /* Synchronizuj configSource z glownym panelem */
    wells[wIdx].configSource = wells[wIdx].autoSelect !== false ? 'AUTO' : 'MANUAL';
    /* Synchronizuj autoLocked - glowny panel sprawdza to dla przycisku Auto */
    if (wells[wIdx].autoSelect === false) wells[wIdx].autoLocked = true;
    else wells[wIdx].autoLocked = false;
    /* Lekki update - tylko jeden TD, bez calego _excelRenderTable (mniej migotania) */
    const btn = document.getElementById('excel-mode-btn-' + wIdx);
    const runBtn = document.getElementById('excel-run-auto-' + wIdx);
    if (!btn) return;
    const nowAuto = wells[wIdx].autoSelect !== false;
    btn.textContent = nowAuto ? 'AUTO' : 'MANUAL';
    btn.classList.toggle('is-auto', nowAuto);
    btn.classList.toggle('is-manual', !nowAuto);
    btn.title = nowAuto ? 'Auto (klik = przelacz na Manual)' : 'Manual (klik = przelacz na Auto)';
    if (runBtn) {
        runBtn.disabled = !nowAuto;
        runBtn.classList.toggle('is-auto', nowAuto);
        runBtn.classList.toggle('is-manual', !nowAuto);
        runBtn.title = nowAuto
            ? 'Uruchom auto-dobor elementow dla tej studni'
            : 'Przelacz na Auto aby uruchomic';
    }
    /* Odswiez glowny panel (configSource zmieniony przez nas) */
    if (typeof window.updateSummary === 'function') window.updateSummary();
    if (typeof window.renderWellsList === 'function') window.renderWellsList();
    if (typeof window.updateAutoLockUI === 'function') window.updateAutoLockUI();
    showToast(nowAuto ? 'Auto wl.' : 'Manual wl.', 'info');
}

/* Per-row Run: uruchom solver dla konkretnej studni.
   Wzorzec jak przycisk Auto w konfiguratorze: najpierw wyczysc config,
   potem wywolaj autoSelectComponents (prawdziwy dobór od nowa). */
async function _excelRunAutoSelectForWell(wIdx) {
    if (typeof wells === 'undefined' || !wells[wIdx]) return;
    const well = wells[wIdx];
    if (!well) return;
    if (!_excelGuardWellLocked(wIdx)) return;
    if (well.autoSelect === false) {
        showToast('Przełącz w tryb Auto aby uruchomić', 'warning');
        return;
    }
    if (well.rzednaWlazu == null || well.rzednaDna == null) {
        showToast('Uzupełnij Rz. włazu i Rz. dna przed autodor.', 'warning');
        return;
    }
    if (typeof autoSelectComponents !== 'function') {
        showToast('Auto-dobór nie dostępny (autoSelectComponents brak)', 'error');
        return;
    }
    const runBtn = document.getElementById('excel-run-auto-' + wIdx);
    const savedIdx = typeof currentWellIndex !== 'undefined' ? currentWellIndex : -1;
    if (runBtn) runBtn.textContent = '...';
    try {
        currentWellIndex = wIdx;
        _excelMarkDirty();
        _excelSaveUndoSnapshot();
        /* WZORZEC z wellActions.js:1390 - czyscimy config i przeładowujemy solver */
        well.configSource = 'AUTO';
        well.config = [];
        await autoSelectComponents(true);
        _excelClearResCache(well);
        _excelRenderTable(_excelActiveTab);
        _excelUpdateHeaderProdCodes();
        showToast('Auto-dobór dla studni #' + wIdx + ' OK', 'success');
    } catch (e) {
        console.error('Auto-dobór fail:', e);
        showToast('Błąd auto-doboru: ' + (e?.message || e), 'error');
    } finally {
        currentWellIndex = savedIdx >= 0 ? savedIdx : currentWellIndex;
        if (runBtn)
            runBtn.innerHTML =
                '<svg viewBox="0 0 16 16" width="16" height="16" fill="currentColor" class="d-block"><polygon points="3,2 15,8 3,14"/></svg>';
    }
}
