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
        /* F1: ukryta karta = zero pracy (żaden wiersz i tak nie jest widoczny) */
        if (typeof document !== 'undefined' && document.hidden) return;
        if (!document.getElementById('excel-table-overlay')) return;
        // ponytail: 200→500ms, dirty jako watchdog—snapshot budowany zawsze, dirty wskazuje oczekiwany mut
        // F1: 500→1000ms — steady-state to sam snapshot (~0,3 ms/1200), watchdog toleruje 1 s.
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
    }, 1000);
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

/* ===== FAST PATH: błędy aktywnego wiersza bez czekania na debounce ===== */
/* Model sync (1 studnia), DOM coalesced rAF (1 wiersz + pasek w overlay).
   Ciężkie updateSummary/diagram/lista zostają w _excelDebouncedRefresh.
   Główny banner za overlayem jest niewidoczny — nie ruszamy go per-edycja;
   synchronizuje się w timerze i przy zamknięciu (refreshAll). */
var _excelPendingActivePaint = -1;
var _excelActivePaintRaf = 0;

function _excelSyncActiveRowErrors(wIdx, opts) {
    var doRecalc = !opts || opts.recalc !== false;
    var force = !!opts && !!opts.force;
    if (!force && typeof _excelPasteQuiet === 'function') {
        try {
            if (_excelPasteQuiet()) return 'deferred';
        } catch (_e) {}
    }
    if (typeof wells === 'undefined' || !wells || !wells[wIdx]) return 'missing';
    if (doRecalc && typeof recalculateWellErrors === 'function') {
        try {
            recalculateWellErrors(wells[wIdx]);
        } catch (_e2) {}
    }
    _excelScheduleActiveRowPaint(wIdx);
    return 'scheduled';
}

function _excelScheduleActiveRowPaint(wIdx) {
    if (typeof wIdx !== 'number' || isNaN(wIdx)) return;
    _excelPendingActivePaint = wIdx;
    if (_excelActivePaintRaf) return;
    if (
        typeof requestAnimationFrame === 'function' &&
        typeof document !== 'undefined' &&
        document.getElementById &&
        document.getElementById('excel-table-overlay')
    ) {
        _excelActivePaintRaf = requestAnimationFrame(function () {
            _excelActivePaintRaf = 0;
            var target = _excelPendingActivePaint;
            _excelPendingActivePaint = -1;
            _excelFlushActiveRowPaint(target);
        });
    } else {
        _excelFlushActiveRowPaint(wIdx);
    }
}

function _excelFlushActiveRowPaint(wIdx) {
    if (typeof wells === 'undefined' || !wells || !wells[wIdx]) return;
    if (
        typeof document === 'undefined' ||
        !document.getElementById ||
        !document.getElementById('excel-table-overlay')
    )
        return;
    var well = wells[wIdx];
    try {
        var row = document.querySelector('tr[data-widx="' + wIdx + '"]');
        if (row && typeof _excelPaintRowStatus === 'function') _excelPaintRowStatus(row, well);
    } catch (_e) {}
    _excelRenderActiveRowStrip(wIdx);
}

function _excelActiveErrorsKeyFor(wIdx, well) {
    var errs = (well && well.configErrors) || [];
    return wIdx + '|' + errs.slice().sort().join('\n');
}

/* Pasek błędów aktywnego wiersza w overlay (#excel-active-errors).
   Guard klucza + ukrycia: ten sam błąd nie pisze DOM drugi raz. */
function _excelRenderActiveRowStrip(wIdx) {
    var el = null;
    try {
        el = document.getElementById('excel-active-errors');
    } catch (_e) {
        return;
    }
    if (!el) return;
    var well = typeof wells !== 'undefined' && wells ? wells[wIdx] : null;
    if (!well) {
        el.style.display = 'none';
        return;
    }
    var errs = well.configErrors || [];
    var key = _excelActiveErrorsKeyFor(wIdx, well);
    if (el.dataset && el.dataset.errkey === key && el.style.display !== 'none') return;
    if (el.dataset) el.dataset.errkey = key;
    if (errs.length === 0) {
        el.style.display = 'none';
        el.innerHTML = '';
        return;
    }
    var esc =
        typeof escapeHtml === 'function'
            ? escapeHtml
            : function (s) {
                  return String(s);
              };
    var rawLabel =
        well.numer != null && String(well.numer).trim() !== ''
            ? String(well.numer)
            : well.name || '#' + (wIdx + 1);
    var items = errs
        .map(function (e) {
            return '• ' + esc(String(e));
        })
        .join('<br>');
    el.innerHTML = 'Błędy — wiersz ' + esc(rawLabel) + ':<br>' + items;
    el.style.display = 'block';
}

/* Bulk flush dla fill/cut (bez pełnego rendera): recalc+paint każdego,
   pasek dla ostatniego. Paste ma własny _finishPaste (pełny render). */
function _excelSyncActiveRowErrorsBulk(wIdxs) {
    if (!Array.isArray(wIdxs) || wIdxs.length === 0) return;
    var seen = {};
    var last = -1;
    var i;
    for (i = 0; i < wIdxs.length; i++) {
        var wIdx = wIdxs[i];
        if (typeof wIdx !== 'number' || isNaN(wIdx) || seen[wIdx]) continue;
        seen[wIdx] = 1;
        if (typeof wells === 'undefined' || !wells[wIdx]) continue;
        if (typeof recalculateWellErrors === 'function') {
            try {
                recalculateWellErrors(wells[wIdx]);
            } catch (_e) {}
        }
        last = wIdx;
    }
    if (
        typeof document !== 'undefined' &&
        document.getElementById &&
        document.getElementById('excel-table-overlay')
    ) {
        for (var k in seen) {
            if (!Object.prototype.hasOwnProperty.call(seen, k)) continue;
            var n = parseInt(k, 10);
            if (typeof wells === 'undefined' || !wells[n]) continue;
            try {
                var row = document.querySelector('tr[data-widx="' + k + '"]');
                if (row && typeof _excelPaintRowStatus === 'function')
                    _excelPaintRowStatus(row, wells[n]);
            } catch (_e2) {}
        }
    }
    if (last >= 0) _excelRenderActiveRowStrip(last);
}

/* F2b: przeliczenie błędów studni jednej zakładki (open/switch). Reszta tabów
   przy własnym switchu; globalni czytelnicy (oferta/lista) wołają
   refreshAllWellErrors() przed renderem, więc stan końcowy identyczny.
   Banner jak w refreshAllWellErrors (renderWellConfigErrors(currentWell)). */
function _excelRecalcTabWellErrors(tab) {
    if (typeof wells === 'undefined' || !Array.isArray(wells)) return;
    if (typeof recalculateWellErrors !== 'function') return;
    for (let i = 0; i < wells.length; i++) {
        try {
            if (typeof _excelWellMatchesTab === 'function' && !_excelWellMatchesTab(wells[i], tab))
                continue;
            recalculateWellErrors(wells[i]);
        } catch (_e) {}
    }
    try {
        if (typeof getCurrentWell === 'function' && typeof renderWellConfigErrors === 'function')
            renderWellConfigErrors(getCurrentWell());
    } catch (_e2) {}
    /* Zmiana zakładki: pasek aktywnego wiersza gaśnie (wiersz z innej zakładki).
       Pokaże się na nowo przy selekcji/edycji (dataset.errkey zostaje — guard). */
    try {
        var _strip = document.getElementById('excel-active-errors');
        if (_strip) _strip.style.display = 'none';
    } catch (_e3) {}
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
        /* Odśwież główny panel gdy Excel jest otwarty.
           F2c-A: guard tłumi wewnętrzny render listy w updateSummary
           (wzór z _excelSyncMainPreview) — jawny render niżej i tak następował.
           F2c-B: lista pod overlayem jest niewidoczna — odłóż na zamknięcie. */
        let _prevListGuard = false;
        try {
            if (typeof window !== 'undefined' && window._renderingWellsList) _prevListGuard = true;
            else if (typeof window !== 'undefined') window._renderingWellsList = true;
            if (typeof window.updateSummary === 'function') window.updateSummary();
        } catch (_eSum) {
        } finally {
            try {
                if (typeof window !== 'undefined' && !_prevListGuard)
                    window._renderingWellsList = false;
            } catch (_eSum2) {}
        }
        if (typeof window.renderWellDiagram === 'function') window.renderWellDiagram();
        if (typeof document !== 'undefined' && document.getElementById('excel-table-overlay')) {
            if (typeof _excelListStale !== 'undefined') _excelListStale = true;
        } else if (typeof window.renderWellsList === 'function') window.renderWellsList();
    }, 800);
}
