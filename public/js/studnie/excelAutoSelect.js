// @ts-check
/* ===== EXCEL AUTO-SELECT — Auto-dobór komponentów dla studni ===== */

async function _excelAutoSelectForWell(wIdx) {
    const well = wells[wIdx];
    if (!well) return;
    if (well.rzednaWlazu == null || well.rzednaDna == null) return;
    if (well.autoSelect === false) return; /* Manual skip */
    if (typeof autoSelectComponents !== 'function') return;
    var savedIdx = typeof currentWellIndex !== 'undefined' ? currentWellIndex : -1;
    try {
        currentWellIndex = wIdx;
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
    _excelSaveUndoSnapshot();
    wells[wIdx].autoSelect = wells[wIdx].autoSelect === false;
    /* Synchornizuj configSource z glownym panelem */
    wells[wIdx].configSource = wells[wIdx].autoSelect !== false ? 'AUTO' : 'MANUAL';
    /* Synchornizuj autoLocked - glowny panel sprawdza to dla przycisku Auto */
    if (wells[wIdx].autoSelect === false) wells[wIdx].autoLocked = true;
    else wells[wIdx].autoLocked = false;
    /* Lekki update - tylko jeden TD, bez calego _excelRenderTable (mniej migotania) */
    var btn = document.getElementById('excel-mode-btn-' + wIdx);
    var runBtn = document.getElementById('excel-run-auto-' + wIdx);
    if (!btn) return;
    var nowAuto = wells[wIdx].autoSelect !== false;
    btn.textContent = nowAuto ? 'AUTO' : 'MANUAL';
    btn.style.background = nowAuto ? 'rgba(99,102,241,0.2)' : 'rgba(245,158,11,0.25)';
    btn.style.color = nowAuto ? '#c7d2fe' : '#fbbf24';
    btn.title = nowAuto ? 'Auto (klik = przelacz na Manual)' : 'Manual (klik = przelacz na Auto)';
    if (runBtn) {
        runBtn.disabled = !nowAuto;
        runBtn.style.opacity = nowAuto ? '1' : '0.4';
        runBtn.style.cursor = nowAuto ? 'pointer' : 'not-allowed';
        runBtn.style.background = nowAuto ? 'rgba(99,102,241,0.35)' : 'rgba(100,116,139,0.15)';
        runBtn.style.color = nowAuto ? '#c7d2fe' : '#64748b';
        runBtn.style.borderColor = nowAuto ? '#6366f1' : 'rgba(100,116,139,0.3)';
        runBtn.style.pointerEvents = nowAuto ? 'auto' : 'none';
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
    var well = wells[wIdx];
    if (!well) return;
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
    var runBtn = document.getElementById('excel-run-auto-' + wIdx);
    var savedIdx = typeof currentWellIndex !== 'undefined' ? currentWellIndex : -1;
    if (runBtn) runBtn.textContent = '...';
    try {
        currentWellIndex = wIdx;
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
        if (runBtn) runBtn.textContent = '▶';
    }
}
