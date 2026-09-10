// @ts-check
/* ===== EXCEL POLLING — Polling i synchronizacja AUTO/MAN dla tabeli konfiguracyjnej studni ===== */

/* Wspólny helper: czy studnia jest w trybie automatycznym (AUTO / AUTO_JS / AUTO_AI) */
function isWellAuto(well) {
    return well.autoSelect !== false && well.configSource !== 'MANUAL';
}
window.isWellAuto = isWellAuto;

function _excelStartPolling() {
    if (_excelPollInterval || typeof wells === 'undefined') return;
    /* Snapshot dla taniego porownywania - hash konfigow wszystkich studni */
    let lastSnapshot = '';
    _excelPollInterval = setInterval(function () {
        if (_excelUserEditing) return;
        if (!document.getElementById('excel-table-overlay')) return;
        // ponytail: 200→500ms, dirty jako watchdog—snapshot budowany zawsze, dirty wskazuje oczekiwany mut
        const snap = _excelBuildWellsSnapshot();
        if (snap !== lastSnapshot) {
            lastSnapshot = snap;
            /* Lekka aktualizacja — nie re-render caly, tylko tryb AUTO/MAN */
            _excelSyncAutoManualUI();
            /* Tła wierszy zależne od configStatus (zmiana statusu z głównego panelu) */
            if (typeof _excelRefreshDupColors === 'function') _excelRefreshDupColors();
            _excelDirty = true;
        } else if (_excelDirty) {
            // brak zmian mimo dirty—wyczyszcz flagę (watchdog)
            _excelDirty = false;
        }
    }, 500);
    /* Inicjalny snapshot */
    lastSnapshot = _excelBuildWellsSnapshot();
}

/* Snapshot stanu configSource + autoSelect wszystkich studzien */
function _excelBuildWellsSnapshot() {
    if (typeof wells === 'undefined') return '';
    const parts = [];
    for (let i = 0; i < wells.length; i++) {
        const w = wells[i];
        if (!w) continue;
        parts.push(
            i +
                ':' +
                (w.configSource || '-') +
                ':' +
                (w.autoSelect === false ? '0' : '1') +
                ':' +
                (w.config ? w.config.length : 0) +
                ':' +
                (w.configStatus || '-')
        );
    }
    return parts.join('|');
}

/* Synchronizuje przyciski AUTO/MAN w UI bez pelnego re-render */
function _excelSyncAutoManualUI() {
    if (typeof wells === 'undefined') return;
    for (let i = 0; i < wells.length; i++) {
        const w = wells[i];
        if (!w) continue;
        if (_excelIsWellLocked(i))
            continue; /* zablokowana — nie synchronizuj, przyciski wylaczone */
        const btnMode = document.getElementById('excel-mode-btn-' + i);
        const btnRun = document.getElementById('excel-run-auto-' + i);
        if (!btnMode) continue; /* wiersz nie widoczny / nie renderowany */
        /* Sync autoSelect z configSource (gdy glowny panel zmieni configSource) */
        if (
            (w.configSource === 'AUTO' ||
                w.configSource === 'AUTO_JS' ||
                w.configSource === 'AUTO_AI') &&
            w.autoSelect === false
        )
            w.autoSelect = true;
        if (w.configSource === 'MANUAL' && w.autoSelect !== false) w.autoSelect = false;
        const isAuto = window.isWellAuto(w);
        btnMode.textContent = isAuto ? 'Auto' : 'Manual';
        btnMode.classList.toggle('is-auto', isAuto);
        btnMode.classList.toggle('is-manual', !isAuto);
        btnMode.title = isAuto
            ? 'Auto (klik = przełącz na Manual)'
            : 'Manual (klik = przełącz na Auto)';
        if (btnRun) {
            btnRun.disabled = !isAuto;
            btnRun.classList.toggle('is-auto', isAuto);
            btnRun.classList.toggle('is-manual', !isAuto);
            btnRun.title = isAuto
                ? 'Uruchom auto-dobór elementów dla tej studni'
                : 'Przełącz na Auto aby uruchomić';
        }
    }
}

function _excelStopPolling() {
    if (_excelPollInterval) {
        clearInterval(_excelPollInterval);
        _excelPollInterval = null;
    }
}

/* Kolejka studni do przeliczenia błędów w timerze — _excelDebouncedRefresh(wIdx)
   dokłada edytowany wiersz; brak argumentu = cała aktywna zakładka (operacje
   strukturalne: kolumny przejść, undo/redo, paste-create, delete). */
var _excelPendingErrorWIdxs = [];
var _excelRefreshAllErrorsPending = false;

/* Opróżnia kolejkę błędów: przelicza docelowe studnie i odświeża tła wierszy.
   Zwraca true, gdy cokolwiek przeliczono. */
function _excelRecalcPendingWellErrors() {
    if (typeof wells === 'undefined' || !Array.isArray(wells)) return false;
    if (typeof recalculateWellErrors !== 'function') return false;
    var seen = {};
    var targets = [];
    function _add(i) {
        if (typeof i !== 'number' || isNaN(i) || i < 0 || i >= wells.length) return;
        if (!wells[i] || seen[i]) return;
        seen[i] = 1;
        targets.push(i);
    }
    var i;
    if (_excelRefreshAllErrorsPending) {
        for (i = 0; i < wells.length; i++) {
            if (typeof _excelWellMatchesTab === 'function') {
                try {
                    if (!_excelWellMatchesTab(wells[i], _excelActiveTab)) continue;
                } catch (_e) {}
            }
            _add(i);
        }
    } else {
        for (i = 0; i < _excelPendingErrorWIdxs.length; i++) _add(_excelPendingErrorWIdxs[i]);
        if (targets.length === 0 && typeof currentWellIndex !== 'undefined') _add(currentWellIndex);
    }
    _excelPendingErrorWIdxs = [];
    _excelRefreshAllErrorsPending = false;
    for (i = 0; i < targets.length; i++) {
        try {
            recalculateWellErrors(wells[targets[i]]);
        } catch (_e) {}
    }
    if (targets.length > 0 && typeof _excelRefreshDupColors === 'function') {
        try {
            _excelRefreshDupColors();
        } catch (_e) {}
    }
    return targets.length > 0;
}

function _excelDebouncedRefresh(editedWIdx) {
    _excelMarkDirty();
    if (typeof editedWIdx === 'number' && !isNaN(editedWIdx)) {
        _excelPendingErrorWIdxs.push(editedWIdx);
    } else if (Array.isArray(editedWIdx)) {
        for (var i = 0; i < editedWIdx.length; i++) {
            if (typeof editedWIdx[i] === 'number' && !isNaN(editedWIdx[i]))
                _excelPendingErrorWIdxs.push(editedWIdx[i]);
        }
    } else {
        _excelRefreshAllErrorsPending = true;
    }
    if (_excelRefreshTimer) clearTimeout(_excelRefreshTimer);
    _excelRefreshTimer = setTimeout(() => {
        _excelRefreshTimer = null;
        /* Tylko odśwież kody h3 — NIE refreshAll (zbyt wolne przy 50+ studniach) */
        _excelUpdateHeaderProdCodes();
        /* Przelicz błędy edytowanych studni (kolejka) i odśwież tła */
        _excelRecalcPendingWellErrors();
        /* Odśwież główny panel gdy Excel jest otwarty */
        if (typeof window.updateSummary === 'function') window.updateSummary();
        if (typeof window.renderWellDiagram === 'function') window.renderWellDiagram();
        if (typeof window.renderWellsList === 'function') window.renderWellsList();
    }, 800);
}
