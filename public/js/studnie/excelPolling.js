// @ts-check
/* ===== EXCEL POLLING — Polling i synchronizacja AUTO/MAN dla tabeli konfiguracyjnej studni ===== */

function _excelStartPolling() {
    if (_excelPollInterval || typeof wells === 'undefined') return;
    /* Snapshot dla taniego porownywania - hash konfigow wszystkich studni */
    var lastSnapshot = '';
    _excelPollInterval = setInterval(function () {
        if (_excelUserEditing) return;
        if (!document.getElementById('excel-table-overlay')) return;
        var snap = _excelBuildWellsSnapshot();
        if (snap !== lastSnapshot) {
            lastSnapshot = snap;
            /* Lekka aktualizacja — nie re-render caly, tylko tryb AUTO/MAN */
            _excelSyncAutoManualUI();
        }
    }, 200);
    /* Inicjalny snapshot */
    lastSnapshot = _excelBuildWellsSnapshot();
}

/* Snapshot stanu configSource + autoSelect wszystkich studzien */
function _excelBuildWellsSnapshot() {
    if (typeof wells === 'undefined') return '';
    var parts = [];
    for (var i = 0; i < wells.length; i++) {
        var w = wells[i];
        if (!w) continue;
        parts.push(
            i +
                ':' +
                (w.configSource || '-') +
                ':' +
                (w.autoSelect === false ? '0' : '1') +
                ':' +
                (w.config ? w.config.length : 0)
        );
    }
    return parts.join('|');
}

/* Synchronizuje przyciski AUTO/MAN w UI bez pelnego re-render */
function _excelSyncAutoManualUI() {
    if (typeof wells === 'undefined') return;
    for (var i = 0; i < wells.length; i++) {
        var w = wells[i];
        if (!w) continue;
        var btnMode = document.getElementById('excel-mode-btn-' + i);
        var btnRun = document.getElementById('excel-run-auto-' + i);
        if (!btnMode) continue; /* wiersz nie widoczny / nie renderowany */
        /* Sync autoSelect z configSource (gdy glowny panel zmieni configSource) */
        if (w.configSource === 'AUTO' && w.autoSelect === false) w.autoSelect = true;
        if (w.configSource === 'MANUAL' && w.autoSelect !== false) w.autoSelect = false;
        var isAuto = w.autoSelect !== false && w.configSource !== 'MANUAL';
        btnMode.textContent = isAuto ? 'AUTO' : 'MANUAL';
        btnMode.style.background = isAuto ? 'rgba(99,102,241,0.2)' : 'rgba(245,158,11,0.25)';
        btnMode.style.color = isAuto ? '#c7d2fe' : '#fbbf24';
        btnMode.title = isAuto
            ? 'Auto (klik = przełącz na Manual)'
            : 'Manual (klik = przełącz na Auto)';
        if (btnRun) {
            btnRun.disabled = !isAuto;
            btnRun.style.opacity = isAuto ? '1' : '0.4';
            btnRun.style.cursor = isAuto ? 'pointer' : 'not-allowed';
            btnRun.style.background = isAuto ? 'rgba(99,102,241,0.35)' : 'rgba(100,116,139,0.15)';
            btnRun.style.color = isAuto ? '#c7d2fe' : '#64748b';
            btnRun.style.borderColor = isAuto ? '#6366f1' : 'rgba(100,116,139,0.3)';
            btnRun.title = isAuto
                ? 'Uruchom auto-dobór elementów dla tej studni'
                : 'Przełącz na Auto aby uruchomić';
        }
    }
    _excelUpdateBulkButtons();
}

function _excelStopPolling() {
    if (_excelPollInterval) {
        clearInterval(_excelPollInterval);
        _excelPollInterval = null;
    }
}

function _excelDebouncedRefresh() {
    _excelMarkDirty();
    if (_excelRefreshTimer) clearTimeout(_excelRefreshTimer);
    _excelRefreshTimer = setTimeout(() => {
        _excelRefreshTimer = null;
        /* Tylko odśwież kody h3 — NIE refreshAll (zbyt wolne przy 50+ studniach) */
        _excelUpdateHeaderProdCodes();
        /* Odśwież główny panel gdy Excel jest otwarty */
        if (typeof window.updateSummary === 'function') window.updateSummary();
        if (typeof window.renderWellDiagram === 'function') window.renderWellDiagram();
        if (typeof window.renderWellsList === 'function') window.renderWellsList();
    }, 800);
}
