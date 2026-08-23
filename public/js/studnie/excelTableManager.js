// @ts-check
/* ===== EXCEL TABLE MANAGER — Tabela konfiguracyjna studni (Excel-style) ===== */
// ponytail: _excelInitColumnResize 98 linii — przenieś do excelColumnVisibility.js gdy excelTableManager >400 linii; teraz 380 OK, nie dziel na siłę (SRP > limit)

/* ===== RESIZE COLUMNS (Excel-like drag handles) ===== */
function _excelInitColumnResize() {
    const container = document.getElementById('excel-table-container');
    if (!container) return;
    const table = container.querySelector('table');
    if (!table) return;

    const headers = table.querySelectorAll('thead tr:first-child th');
    headers.forEach((th) => {
        // Tylko ustaw position:relative dla kolumn ktore nie maja sticky w inline
        // (sticky columns maja position:sticky;left:N ustawione przez _excelApplyStickyColumns)
        if (th.style.position !== 'sticky') {
            th.style.position = 'relative';
        }

        const handle = document.createElement('div');
        handle.className = 'excel-col-resize-handle';
        handle.style.cssText =
            'position:absolute;top:2px;right:-1px;width:3px;height:calc(100% - 4px);cursor:col-resize;z-index:' +
            LAYERS_EXCEL.RESIZE_HANDLE +
            ';' +
            'background:rgba(var(--slate-400-rgb), 0.15);border-radius:2px;transition:background 0.12s,width 0.12s,box-shadow 0.12s;';
        handle.addEventListener('mouseenter', () => {
            handle.style.background = 'rgba(var(--accent-rgb), 0.5)';
            handle.style.width = '4px';
            handle.style.boxShadow = '0 0 6px rgba(var(--accent-rgb), 0.3)';
        });
        handle.addEventListener('mouseleave', () => {
            handle.style.background = 'rgba(var(--slate-400-rgb), 0.15)';
            handle.style.width = '3px';
            handle.style.boxShadow = 'none';
        });

        let startX = 0;
        let startWidth = 0;
        let lastDiff = 0;

        handle.addEventListener('mousedown', (/** @type {MouseEvent} */ e) => {
            startX = e.clientX;
            startWidth = /** @type {HTMLElement} */ (th).offsetWidth;
            lastDiff = 0;
            e.preventDefault();

            const colIndex = Array.from(headers).indexOf(th);
            const rows = table.querySelectorAll('tr');

            const onMove = (/** @type {MouseEvent} */ e2) => {
                const diff = e2.clientX - startX;
                lastDiff = diff;
                const newWidth = Math.max(30, startWidth + diff);

                // Które kolumny zmieniamy: wszystkie zaznaczone (jeśli ta jest zaznaczona) albo tylko tę
                const colsToResize = _excelSelectedCols.includes(colIndex)
                    ? _excelSelectedCols
                    : [colIndex];

                colsToResize.forEach((ci) => {
                    rows.forEach((row) => {
                        const cell = row.children[ci];
                        if (cell) {
                            /* TASK-038: szerokości kolumn to dane runtime (resize) —
                               inline celowo, nie klasa (zgodnie z planem TASK-038). */
                            cell.style.minWidth = newWidth + 'px';
                            cell.style.width = newWidth + 'px';
                        }
                    });
                });
            };

            const onUp = () => {
                document.removeEventListener('mousemove', onMove);
                document.removeEventListener('mouseup', onUp);
                document.body.style.cursor = '';
                document.body.style.userSelect = '';
                /* Zapisz szerokości dla trwałości po re-renderze */
                const newWidth = Math.max(30, startWidth + lastDiff);
                const colsToResize = _excelSelectedCols.includes(colIndex)
                    ? _excelSelectedCols
                    : [colIndex];
                colsToResize.forEach((ci) => {
                    _excelColWidths[_excelActiveTab + '-' + ci] = newWidth;
                });
                /* Trwałość szerokości po zakończeniu przeciągania (localStorage) */
                if (typeof _excelSaveColWidths === 'function') _excelSaveColWidths();
            };

            document.addEventListener('mousemove', onMove);
            document.addEventListener('mouseup', onUp);
            document.body.style.cursor = 'col-resize';
            document.body.style.userSelect = 'none';
        });

        th.appendChild(handle);
    });
}

/* ===== ROW SELECT CHEKBOX CHANGE HANDLER ===== */
function _excelOnRowSelectChange(e) {
    const target = e.target;
    if (!target) return;
    /* Row checkbox - per studnia */
    if (target.classList && target.classList.contains('excel-row-select')) {
        const wIdx = parseInt(target.getAttribute('data-widx'), 10);
        if (!isNaN(wIdx)) {
            _excelRowSelectStates[wIdx] = target.checked;
            /* sync select-all checkbox */
            const allBoxes = document.querySelectorAll(
                '#excel-table-container tbody tr[data-widx] input.excel-row-select'
            );
            const allChecked = Array.from(allBoxes).every(function (cb) {
                return cb.checked;
            });
            const hdrAll = document.getElementById('excel-select-all');
            if (hdrAll && hdrAll !== document.activeElement) hdrAll.checked = allChecked;
        }
    }
    /* Select-all checkbox jest obslugiwany inline onchange -> _excelToggleSelectAll */
}

/* ===== ROW CHECKBOX + AUTO/MANUAL BATCH ===== */
function _excelBulkSetMode(enabled) {
    if (typeof wells === 'undefined') return;
    const sel = [];
    for (let i = 0; i < wells.length; i++) {
        if (_excelRowSelectStates[i]) sel.push(i);
    }
    let targets;
    if (sel.length === 0) {
        targets = [];
        for (let i = 0; i < wells.length; i++) {
            if (wells[i]) targets.push(i);
        }
        if (targets.length === 0) return;
        showToast('Brak zaznaczonych — zastosowano do ' + targets.length + ' studni', 'info');
    } else {
        targets = sel;
        showToast((enabled ? 'Auto' : 'Manual') + ' dla ' + targets.length + ' studni', 'success');
    }
    /* Pomin studnie zablokowane (PZ accepted / zamówienie) */
    const editableTargets = targets.filter(function (i) {
        return !_excelIsWellLocked(i);
    });
    if (editableTargets.length !== targets.length) {
        showToast(
            'Pominięto ' + (targets.length - editableTargets.length) + ' zablokowanych studni',
            'warning'
        );
    }
    targets = editableTargets;
    if (targets.length === 0) return;
    _excelSaveUndoSnapshot();
    _excelMarkDirty();
    targets.forEach(function (i) {
        if (wells[i]) {
            wells[i].autoSelect = enabled;
            wells[i].configSource = enabled ? 'AUTO' : 'MANUAL'; /* sync z glownym panelem */
            wells[i].autoLocked = !enabled; /* sync autoLocked */
        }
    });
    _excelRenderTable(_excelActiveTab);
    /* Odswiez glowny panel */
    if (typeof window.updateSummary === 'function') window.updateSummary();
    if (typeof window.renderWellsList === 'function') window.renderWellsList();
}

/* ===== BULK AUTO-DOBÓR ZAZNACZONYCH ===== */
async function _excelBulkRunAutoSelect() {
    if (typeof wells === 'undefined' || !Array.isArray(wells)) return;
    const sel = [];
    for (let i = 0; i < wells.length; i++) {
        if (_excelRowSelectStates[i]) sel.push(i);
    }
    if (sel.length === 0) {
        showToast('Zaznacz co najmniej jedną studnię (checkbox)', 'warning');
        return;
    }
    if (typeof autoSelectComponents !== 'function') {
        showToast('Auto-dobór nie dostępny', 'error');
        return;
    }
    const locked = sel.filter(function (i) {
        return _excelIsWellLocked(i);
    });
    const manual = sel.filter(function (i) {
        return wells[i] && wells[i].autoSelect === false;
    });
    const missing = sel.filter(function (i) {
        const w = wells[i];
        return !w || w.rzednaWlazu == null || w.rzednaDna == null;
    });
    const editable = sel.filter(function (i) {
        const w = wells[i];
        return (
            w &&
            !_excelIsWellLocked(i) &&
            w.autoSelect !== false &&
            w.rzednaWlazu != null &&
            w.rzednaDna != null
        );
    });
    if (locked.length > 0) showToast('Pominięto ' + locked.length + ' zablokowanych', 'warning');
    if (manual.length > 0) showToast('Pominięto ' + manual.length + ' w trybie Manual', 'warning');
    if (missing.length > 0) showToast('Pominięto ' + missing.length + ' bez rzędnych', 'warning');
    if (editable.length === 0) {
        showToast('Brak studni do przeliczenia', 'info');
        return;
    }
    const btn = document.getElementById('excel-bulk-recalc');
    if (btn) {
        btn.disabled = true;
        btn.style.opacity = '0.5';
    }
    const savedIdx = typeof currentWellIndex !== 'undefined' ? currentWellIndex : -1;
    let ok = 0;
    let fail = 0;
    try {
        _excelSaveUndoSnapshot();
        _excelMarkDirty();
        // ponytail: sekwencyjny via currentWellIndex, per-well lock gdy throughput
        for (let k = 0; k < editable.length; k++) {
            const wIdx = editable[k];
            const well = wells[wIdx];
            try {
                currentWellIndex = wIdx;
                well.configSource = 'AUTO';
                well.config = [];
                await autoSelectComponents(true);
                _excelClearResCache(well);
                ok++;
            } catch (e) {
                fail++;
                if (typeof window.logger !== 'undefined')
                    window.logger.warn('bulk auto fail wIdx=' + wIdx, e);
            }
        }
    } finally {
        currentWellIndex = savedIdx >= 0 ? savedIdx : currentWellIndex;
        _excelRenderTable(_excelActiveTab);
        _excelUpdateHeaderProdCodes();
        _excelDebouncedRefresh();
        if (typeof window.updateSummary === 'function') window.updateSummary();
        if (typeof window.renderWellsList === 'function') window.renderWellsList();
        if (btn) {
            btn.disabled = false;
            btn.style.opacity = '';
        }
        let msg = 'Auto-dobór: ' + ok + ' przeliczono';
        if (fail > 0) msg += ', ' + fail + ' błędów';
        const skipped = sel.length - editable.length;
        if (skipped > 0) msg += ' (pominięto ' + skipped + ')';
        showToast(msg, fail > 0 ? 'warning' : 'success');
    }
}

/* ===== COPY / PASTE (Excel-like) ===== */

function _excelMarkAsManual(wIdx) {
    if (typeof wells === 'undefined' || !wells[wIdx]) return;
    const w = wells[wIdx];
    if (w.autoSelect !== false || w.configSource !== 'MANUAL' || w.autoLocked !== true) {
        w.autoSelect = false;
        w.configSource = 'MANUAL';
        w.autoLocked = true;
        if (typeof _excelSyncAutoManualUI === 'function') _excelSyncAutoManualUI();
        if (typeof window.updateAutoLockUI === 'function') window.updateAutoLockUI();
    }
}

/* ===== UNDO / REDO (simple snapshot stack) ===== */
function _excelSaveUndoSnapshot() {
    if (typeof wells === 'undefined') return;
    _excelUndoStack.push(JSON.parse(JSON.stringify(wells)));
    if (_excelUndoStack.length > _EXCEL_UNDO_LIMIT) _excelUndoStack.shift();
    _excelRedoStack = [];
}

function _excelUndo() {
    if (_excelUndoStack.length === 0) return;
    _excelRedoStack.push(JSON.parse(JSON.stringify(wells)));
    const snap = _excelUndoStack.pop();
    const locked = _excelSnapshotLockedWells();
    wells.splice(0, wells.length, ...snap);
    _excelRestoreLockedWells(locked);
    _excelMarkDirty();
    _excelRenderTable(_excelActiveTab);
    if (typeof _excelDebouncedRefresh === 'function') _excelDebouncedRefresh();
    showToast('Cofnięto', 'info');
}

function _excelRedo() {
    if (_excelRedoStack.length === 0) return;
    _excelUndoStack.push(JSON.parse(JSON.stringify(wells)));
    const snap = _excelRedoStack.pop();
    const locked = _excelSnapshotLockedWells();
    wells.splice(0, wells.length, ...snap);
    _excelRestoreLockedWells(locked);
    _excelMarkDirty();
    _excelRenderTable(_excelActiveTab);
    if (typeof _excelDebouncedRefresh === 'function') _excelDebouncedRefresh();
    showToast('Przywrócono', 'info');
}

/* ===== PASTE DO PUSTEGO WIERSZA → nowe studnie ===== */
function _excelPasteCreateWells(text) {
    const parsed = _excelParsePasteData(text);
    /* Jesli parser nie rozpoznal danych, sprobuj prostrzy format: kazda linia = nazwa studni */
    if (parsed.length === 0) {
        const lines = text
            .trim()
            .split(String.fromCharCode(10))
            .map(function (l) {
                return l.replace(String.fromCharCode(13), '').trim();
            })
            .filter(function (l) {
                return l;
            });
        if (lines.length > 0) {
            const dn = _excelActiveTab || '1000';
            _excelSaveUndoSnapshot();
            let added = 0;
            for (let fi = 0; fi < lines.length; fi++) {
                const name = lines[fi];
                if (!name) continue;
                let dnVal = dn === 'styczne' ? 'styczna' : parseInt(dn, 10);
                if (typeof dnVal === 'number' && isNaN(dnVal)) dnVal = 1000;
                const well =
                    typeof createNewWell === 'function'
                        ? createNewWell(name, dnVal)
                        : {
                              id: 'well_' + Date.now() + '_' + added,
                              name: name,
                              dn: dnVal,
                              config: [],
                              przejscia: [],
                              rzednaWlazu: null,
                              rzednaDna: null,
                              kineta: 'brak',
                              psiaBuda: false,
                              redukcjaDN1000: false,
                              redukcjaMinH: 2500
                          };
                well.name = name; /* pozwól na duplikaty */
                wells.push(well);
                _excelAutoSetWlaz(well);
                added++;
            }
            if (added > 0) {
                _excelMaxTransitions[_excelActiveTab] = _excelGetMaxTransitions();
                _excelRenderTabs();
                _excelRenderTable(_excelActiveTab);
                _excelUpdateWellCount();
                _excelDebouncedRefresh();
                showToast('Dodano ' + added + ' studni', 'success');
                return;
            }
            showToast('Brak danych do wklejenia', 'info');
            return;
        }
        showToast('Nie rozpoznano danych', 'error');
        return;
    }
    const dn = _excelActiveTab || '1000';
    _excelSaveUndoSnapshot();
    let added = 0;
    parsed.forEach(function (row) {
        const name = String(row.name || '').trim();
        if (!name) return;
        /* pozwól na duplikaty — nie sprawdzamy 'wells.some' */
        let dnVal = row.dn || String(dn);
        dnVal = dnVal === 'styczne' || dnVal === 'styczna' ? 'styczna' : parseInt(dnVal, 10);
        if (typeof dnVal === 'number' && isNaN(dnVal)) dnVal = 1000;
        const rzw = row.rzednaWlazu ? parseFloat(String(row.rzednaWlazu).replace(',', '.')) : null;
        const rzd = row.rzednaDna ? parseFloat(String(row.rzednaDna).replace(',', '.')) : 0;
        const well =
            typeof createNewWell === 'function'
                ? createNewWell(name, dnVal)
                : {
                      id: 'well_' + Date.now() + '_' + added,
                      name: name,
                      dn: dnVal,
                      config: [],
                      przejscia: [],
                      rzednaWlazu: rzw,
                      rzednaDna: rzd,
                      kineta: 'brak',
                      psiaBuda: false,
                      redukcjaDN1000: false,
                      redukcjaMinH: 2500
                  };
        if (rzw !== null) well.rzednaWlazu = rzw;
        if (rzd !== null) well.rzednaDna = rzd;
        wells.push(well);
        _excelAutoSetWlaz(well);
        added++;
    });
    if (added === 0) {
        showToast('Nie dodano żadnej studni', 'info');
        return;
    }
    _excelMaxTransitions[_excelActiveTab] = _excelGetMaxTransitions();
    _excelRenderTabs();
    _excelRenderTable(_excelActiveTab);
    _excelUpdateWellCount();
    if (_excelAutoSelectEnabled) {
        for (let k = 0; k < added; k++) {
            setTimeout(
                function () {
                    const nwi = wells.length - added + k;
                    const w = wells[nwi];
                    if (w && w.rzednaWlazu != null && w.rzednaDna != null) {
                        _excelAutoSelectForWell(nwi).catch(function (e) {
                            if (window.logger)
                                window.logger.warn(
                                    'AutoSelect pominiety dla nowej studni:',
                                    e.message || e
                                );
                        });
                    }
                },
                200 + k * 300
            );
        }
    }
    _excelDebouncedRefresh();
    showToast('Dodano ' + added + ' studni', 'success');
}

/* ===== GLOBALNA ODSWIEŻALKA ===== */
window.refreshExcelFromConfig = function () {
    if (!document.getElementById('excel-table-overlay')) return; // modal zamknięty
    _excelRenderTable(_excelActiveTab);
};

/* Sync UI z wells[i].configSource/autoSelect (bez pelnego re-render) — dla zmian z glownego panelu */
/* Oryginał z excelPolling.js przechwytujemy PRZED nadpisaniem window — inaczej
   wrapper woła sam siebie (shadowing) i realna synchronizacja nigdy nie działa. */
const _excelSyncAutoManualUIReal = _excelSyncAutoManualUI;
window._excelSyncAutoManualUI = function () {
    if (!document.getElementById('excel-table-overlay')) return;
    const fn = /** @type {any} */ (window._excelSyncAutoManualUI);
    if (fn._inProgress) return;
    fn._inProgress = true;
    try {
        _excelSyncAutoManualUIReal();
    } finally {
        fn._inProgress = false;
    }
};

/* ===== PARSER DANYCH ZE SCHOWKA (paste) ===== */
function _excelParsePasteData(text) {
    if (!text || typeof text !== 'string') return [];
    const lines = text.trim().split('\n').filter(Boolean);
    if (lines.length === 0) return [];
    const result = [];
    for (let li = 0; li < lines.length; li++) {
        const parts = lines[li].replace('\r', '').split('\t');
        if (parts.length === 0) continue;
        const row = { name: (parts[0] || '').trim() };
        if (parts.length > 1) row.dn = parts[1].trim();
        if (parts.length > 2) row.rzednaWlazu = parts[2].trim();
        if (parts.length > 3) row.rzednaDna = parts[3].trim();
        if (row.name) result.push(row);
    }
    return result;
}
