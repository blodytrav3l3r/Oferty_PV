// @ts-check
/* ===== EXCEL TABLE MANAGER — Tabela konfiguracyjna studni (Excel-style) ===== */

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
            'background:rgba(148,163,184,0.15);border-radius:2px;transition:background 0.12s,width 0.12s,box-shadow 0.12s;';
        handle.addEventListener('mouseenter', () => {
            handle.style.background = 'rgba(99,102,241,0.45)';
            handle.style.width = '4px';
            handle.style.boxShadow = '0 0 6px rgba(99,102,241,0.25)';
        });
        handle.addEventListener('mouseleave', () => {
            handle.style.background = 'rgba(148,163,184,0.15)';
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
    let target = e.target;
    if (!target) return;
    /* Row checkbox - per studnia */
    if (target.classList && target.classList.contains('excel-row-select')) {
        let wIdx = parseInt(target.getAttribute('data-widx'), 10);
        if (!isNaN(wIdx)) {
            _excelRowSelectStates[wIdx] = target.checked;
            _excelUpdateBulkButtons();
            /* sync select-all checkbox */
            let allBoxes = document.querySelectorAll(
                '#excel-table-container tbody tr[data-widx] input.excel-row-select'
            );
            let allChecked = Array.from(allBoxes).every(function (cb) {
                return cb.checked;
            });
            let hdrAll = document.getElementById('excel-select-all');
            if (hdrAll && hdrAll !== document.activeElement) hdrAll.checked = allChecked;
        }
    }
    /* Select-all checkbox jest obslugiwany inline onchange -> _excelToggleSelectAll */
}

/* ===== ROW CHECKBOX + AUTO/MANUAL BATCH ===== */
function _excelBulkSetMode(enabled) {
    if (typeof wells === 'undefined') return;
    let sel = [];
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
    _excelSaveUndoSnapshot();
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

/* ===== COPY / PASTE (Excel-like) ===== */

function _excelMarkAsManual(wIdx) {
    if (typeof wells === 'undefined' || !wells[wIdx]) return;
    let w = wells[wIdx];
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
    let snap = _excelUndoStack.pop();
    wells.splice(0, wells.length, ...snap);
    _excelRenderTable(_excelActiveTab);
    showToast('Cofnięto', 'info');
}

function _excelRedo() {
    if (_excelRedoStack.length === 0) return;
    _excelUndoStack.push(JSON.parse(JSON.stringify(wells)));
    let snap = _excelRedoStack.pop();
    wells.splice(0, wells.length, ...snap);
    _excelRenderTable(_excelActiveTab);
    showToast('Przywrócono', 'info');
}

/* ===== PASTE DO PUSTEGO WIERSZA → nowe studnie ===== */
function _excelPasteCreateWells(text) {
    let parsed = _excelParsePasteData(text);
    /* Jesli parser nie rozpoznal danych, sprobuj prostrzy format: kazda linia = nazwa studni */
    if (parsed.length === 0) {
        let lines = text
            .trim()
            .split(String.fromCharCode(10))
            .map(function (l) {
                return l.replace(String.fromCharCode(13), '').trim();
            })
            .filter(function (l) {
                return l;
            });
        if (lines.length > 0) {
            let dn = _excelActiveTab || '1000';
            _excelSaveUndoSnapshot();
            let added = 0;
            for (let fi = 0; fi < lines.length; fi++) {
                let name = lines[fi];
                if (!name) continue;
                let dnVal = dn === 'styczne' ? 'styczna' : parseInt(dn, 10);
                if (typeof dnVal === 'number' && isNaN(dnVal)) dnVal = 1000;
                let well =
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
    let dn = _excelActiveTab || '1000';
    _excelSaveUndoSnapshot();
    let added = 0;
    parsed.forEach(function (row) {
        let name = String(row.name || '').trim();
        if (!name) return;
        /* pozwól na duplikaty — nie sprawdzamy 'wells.some' */
        let dnVal = row.dn || String(dn);
        dnVal = dnVal === 'styczne' || dnVal === 'styczna' ? 'styczna' : parseInt(dnVal, 10);
        if (typeof dnVal === 'number' && isNaN(dnVal)) dnVal = 1000;
        let rzw = row.rzednaWlazu ? parseFloat(String(row.rzednaWlazu).replace(',', '.')) : null;
        let rzd = row.rzednaDna ? parseFloat(String(row.rzednaDna).replace(',', '.')) : 0;
        let well =
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
                    let nwi = wells.length - added + k;
                    let w = wells[nwi];
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
window._excelSyncAutoManualUI = function () {
    if (!document.getElementById('excel-table-overlay')) return;
    let fn = /** @type {any} */ (window._excelSyncAutoManualUI);
    if (fn._inProgress) return;
    fn._inProgress = true;
    try {
        _excelSyncAutoManualUI();
    } finally {
        fn._inProgress = false;
    }
};
