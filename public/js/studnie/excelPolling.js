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
        let snap = _excelBuildWellsSnapshot();
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
    let parts = [];
    for (let i = 0; i < wells.length; i++) {
        let w = wells[i];
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
    for (let i = 0; i < wells.length; i++) {
        let w = wells[i];
        if (!w) continue;
        if (_excelIsWellLocked(i))
            continue; /* zablokowana — nie synchronizuj, przyciski wylaczone */
        let btnMode = document.getElementById('excel-mode-btn-' + i);
        let btnRun = document.getElementById('excel-run-auto-' + i);
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
        let isAuto = window.isWellAuto(w);
        btnMode.textContent = isAuto ? 'AUTO' : 'MANUAL';
        btnMode.style.background = isAuto
            ? 'rgba(var(--accent-rgb), 0.2)'
            : 'rgba(var(--warn-rgb), 0.3)';
        btnMode.style.color = isAuto ? 'var(--accent-text-light)' : 'var(--warn-hover)';
        btnMode.title = isAuto
            ? 'Auto (klik = przełącz na Manual)'
            : 'Manual (klik = przełącz na Auto)';
        if (btnRun) {
            btnRun.disabled = !isAuto;
            btnRun.style.opacity = isAuto ? '1' : '0.4';
            btnRun.style.cursor = isAuto ? 'pointer' : 'not-allowed';
            btnRun.style.background = isAuto
                ? 'rgba(var(--accent-rgb), 0.3)'
                : 'rgba(var(--slate-500-rgb), 0.15)';
            btnRun.style.color = isAuto ? 'var(--accent-text-light)' : 'var(--slate-500)';
            btnRun.style.borderColor = isAuto ? 'var(--accent)' : 'rgba(var(--slate-500-rgb), 0.3)';
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
