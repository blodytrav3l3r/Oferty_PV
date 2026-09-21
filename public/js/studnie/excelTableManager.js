// @ts-check
/* ===== EXCEL TABLE MANAGER — Tabela konfiguracyjna studni (Excel-style) ===== */
// ponytail: E7 split done - undo -> excelUndo.js (move-intact).
// Resize -> excelColumnResize.js (move-intact, Etap 2); F2 w excel-validator.py
// wskazuje nowy plik (referencja lokalizacyjna, nie zmiana logiki).

/* ===== ROW SELECT — shift-range + group toggle + tri-state header ===== */
if (typeof window !== 'undefined') window._excelSyncHeaderCheckbox = _excelSyncHeaderCheckbox;
function _excelSyncHeaderCheckbox() {
    const hdrAll = document.getElementById('excel-select-all');
    if (!hdrAll) return;
    const boxes = document.querySelectorAll(
        '#excel-table-container tbody tr[data-widx] input.excel-row-select'
    );
    const total = boxes.length;
    if (total === 0) {
        hdrAll.checked = false;
        hdrAll.indeterminate = false;
        hdrAll.setAttribute('aria-checked', 'false');
        return;
    }
    let checkedCount = 0;
    boxes.forEach(function (cb) {
        const idx = parseInt(cb.getAttribute('data-widx'), 10);
        if (!isNaN(idx) && _excelRowSelectStates[idx]) checkedCount++;
    });
    const all = checkedCount === total;
    const some = checkedCount > 0 && checkedCount < total;
    if (hdrAll !== document.activeElement) hdrAll.checked = all;
    hdrAll.indeterminate = some;
    hdrAll.setAttribute('aria-checked', some ? 'mixed' : String(all));
}

function _excelSetRowRange(fromWIdx, toWIdx, checked) {
    const visibleRows = typeof _excelGetVisibleRows === 'function' ? _excelGetVisibleRows() : [];
    const order = [];
    const posByWIdx = new Map();
    visibleRows.forEach(function (tr, pos) {
        const idx = parseInt(tr.getAttribute('data-widx'), 10);
        if (!isNaN(idx)) {
            posByWIdx.set(idx, pos);
            order.push(idx);
        }
    });
    const fromPos = posByWIdx.get(fromWIdx);
    const toPos = posByWIdx.get(toWIdx);
    if (fromPos === undefined || toPos === undefined) {
        // fallback pojedynczy wiersz gdy jeden z końców niewidoczny (filtr)
        if (
            (!isNaN(toWIdx) && typeof _excelIsWellLocked !== 'function') ||
            !_excelIsWellLocked(toWIdx)
        ) {
            _excelRowSelectStates[toWIdx] = checked;
        }
        return;
    }
    const lo = Math.min(fromPos, toPos);
    const hi = Math.max(fromPos, toPos);
    for (let p = lo; p <= hi; p++) {
        const wIdx = order[p];
        if (typeof _excelIsWellLocked === 'function' && _excelIsWellLocked(wIdx)) continue;
        _excelRowSelectStates[wIdx] = checked;
    }
}

function _excelSyncRowCheckboxes() {
    document
        .querySelectorAll('#excel-table-container tbody tr[data-widx] input.excel-row-select')
        .forEach(function (cb) {
            const idx = parseInt(cb.getAttribute('data-widx'), 10);
            if (!isNaN(idx)) cb.checked = !!_excelRowSelectStates[idx];
        });
}

function _excelHandleRowCheckboxClick(target, e) {
    const wIdx = parseInt(target.getAttribute('data-widx'), 10);
    if (isNaN(wIdx)) return;
    const isShift = !!e.shiftKey && _excelLastClickedRow !== null;
    // Shift-range ma priorytet nad group-toggle (korekta planu #2)
    if (isShift) {
        e.preventDefault();
        const anchor = _excelLastClickedRow;
        // kotwica nie zmienia się przy Shift (OS)
        // konserwatywnie: sprawdzony anchor → zaznacz zakres, inaczej odznacz
        const rangeChecked = _excelRowSelectStates[anchor] ? true : !!target.checked;
        _excelSetRowRange(anchor, wIdx, rangeChecked);
        _excelSyncRowCheckboxes();
        _excelSyncHeaderCheckbox();
        return;
    }
    // Group toggle: klik na dowolnym należącym do grupy ≥2 (checkboxy + komórki)
    const selectedIds = Object.keys(_excelRowSelectStates).filter(function (k) {
        return _excelRowSelectStates[k];
    });
    // jeśli zaznaczenie komórek obejmuje kilka wierszy i kliknięty wiersz w nim jest — traktuj te wiersze jako grupę
    if (
        typeof _excelSelectedCells !== 'undefined' &&
        Array.isArray(_excelSelectedCells) &&
        _excelSelectedCells.length > 1
    ) {
        const cellSet = new Set();
        _excelSelectedCells.forEach(function (c) {
            if (c && typeof c.wIdx !== 'undefined') cellSet.add(String(c.wIdx));
        });
        if (cellSet.has(String(wIdx)) && cellSet.size > 1) {
            cellSet.forEach(function (id) {
                if (selectedIds.indexOf(id) < 0) selectedIds.push(id);
            });
        }
    }
    const isInGroup = selectedIds.length > 1 && selectedIds.indexOf(String(wIdx)) >= 0;
    if (isInGroup) {
        e.preventDefault();
        const allGroupChecked = selectedIds.every(function (id) {
            return !!_excelRowSelectStates[id];
        });
        const newChecked = !allGroupChecked;
        selectedIds.forEach(function (id) {
            const idx = parseInt(id, 10);
            if (typeof _excelIsWellLocked === 'function' && _excelIsWellLocked(idx)) return;
            _excelRowSelectStates[idx] = newChecked;
        });
        // kliknięty wiersz też w grupie — już objęty
        _excelSyncRowCheckboxes();
        _excelSyncHeaderCheckbox();
        _excelLastClickedRow = wIdx;
        return;
    }
    // Zwykły pojedynczy toggle — pozwól browser przełączyć, zsynchronizuj stan
    // e.target.checked już po natywnym toggle w click
    _excelRowSelectStates[wIdx] = target.checked;
    _excelLastClickedRow = wIdx;
    _excelSyncHeaderCheckbox();
}

function _excelOnRowSelectChange(e) {
    const target = e.target;
    if (!target) return;
    if (target.classList && target.classList.contains('excel-row-select')) {
        // Guard: click już obsłużył intencję (mouse) — nie mutuj drugi raz na change
        if (_excelRowClickHandled) {
            _excelRowClickHandled = false;
            return;
        }
        const wIdx = parseInt(target.getAttribute('data-widx'), 10);
        if (!isNaN(wIdx)) {
            _excelRowSelectStates[wIdx] = target.checked;
            _excelLastClickedRow = wIdx;
            _excelSyncHeaderCheckbox();
        }
    }
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
    // P1a quiet bulk: wycisza wyłącznie UI/render (invariant: stan, solver, AI,
    // telemetria, PZ, undo i walidacje bez zmian). Zdejmowana w finally —
    // również przy błędzie / Anuluj / wyjątku AI (zakaz permanentnego mute).
    if (typeof window !== 'undefined') {
        if (window.__excelBulkDepth > 0) {
            if (typeof window.logger !== 'undefined')
                window.logger.warn(
                    'excelBulk',
                    'Zastana flaga __excelBulkDepth — reset defensywny'
                );
        }
        window.__excelBulkDepth = 0;
        window.__excelBulkDepth++;
        window.__excelBulkStats = { solverRuns: 0, refreshSkipped: 0, rendersSkipped: 0 };
    }
    const btn = document.getElementById('excel-bulk-recalc');
    if (btn) {
        btn.disabled = true;
        btn.style.opacity = '0.5';
    }
    const savedIdx = typeof currentWellIndex !== 'undefined' ? currentWellIndex : -1;
    const bulkContainer = document.getElementById('excel-table-container');
    const bulkSavedScrollTop = bulkContainer ? bulkContainer.scrollTop : null;
    const bulkSavedScrollLeft = bulkContainer ? bulkContainer.scrollLeft : null;
    let bulkSavedActive = null;
    try {
        if (
            typeof window !== 'undefined' &&
            typeof window._excelVirtualGetActiveCell === 'function'
        )
            bulkSavedActive = window._excelVirtualGetActiveCell();
        else if (typeof _excelVirtualActiveCell !== 'undefined' && _excelVirtualActiveCell)
            bulkSavedActive = {
                logicalRow: _excelVirtualActiveCell.logicalRow,
                logicalColId: _excelVirtualActiveCell.logicalColId
            };
    } catch (_e) {}
    let ok = 0;
    let fail = 0;
    try {
        _excelSaveUndoSnapshot();
        _excelMarkDirty();
        if (
            editable.length > 50 &&
            typeof _excelRunBulkJob === 'function' &&
            typeof _excelNewBulkAbort === 'function'
        ) {
            const abort = _excelNewBulkAbort();
            await _excelRunBulkJob({
                total: editable.length,
                chunkSize: 1,
                label: 'Auto-dobór...',
                signal: abort.signal,
                onChunk: async function (start, end) {
                    for (let k = start; k < end; k++) {
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
                }
            });
        } else {
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
        }
    } finally {
        currentWellIndex = savedIdx >= 0 ? savedIdx : currentWellIndex;
        // Flaga w dół PRZED końcowym renderem — ten ma być pełny, nie cichy.
        let bulkStats = null;
        if (typeof window !== 'undefined') {
            bulkStats = window.__excelBulkStats || null;
            if (window.__excelBulkDepth > 0) window.__excelBulkDepth--;
            window.__excelBulkStats = null;
        }
        _excelRenderTable(_excelActiveTab);
        _excelUpdateHeaderProdCodes();
        if (bulkContainer && bulkSavedScrollTop !== null) {
            bulkContainer.scrollTop = bulkSavedScrollTop;
            if (bulkSavedScrollLeft !== null) bulkContainer.scrollLeft = bulkSavedScrollLeft;
            try {
                if (
                    typeof window !== 'undefined' &&
                    typeof window._excelVirtualIsEnabled === 'function' &&
                    window._excelVirtualIsEnabled() &&
                    typeof _excelVirtualRenderBody === 'function'
                ) {
                    _excelVirtualRenderBody();
                }
            } catch (_e2) {}
        }
        if (bulkSavedActive) {
            try {
                if (
                    typeof window !== 'undefined' &&
                    typeof window._excelVirtualSetActiveCell === 'function'
                )
                    window._excelVirtualSetActiveCell(bulkSavedActive);
                else if (typeof _excelVirtualActiveCell !== 'undefined')
                    _excelVirtualActiveCell = {
                        logicalRow: bulkSavedActive.logicalRow,
                        logicalColId: bulkSavedActive.logicalColId
                    };
                if (typeof _excelVirtualFocusCell === 'function')
                    _excelVirtualFocusCell(bulkSavedActive);
            } catch (_e3) {}
        }
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
        if (bulkStats && typeof window.logger !== 'undefined')
            window.logger.info(
                'excelBulk',
                'quiet stats: solverRuns=' +
                    (ok + fail) +
                    ' refreshSkipped=' +
                    bulkStats.refreshSkipped +
                    ' rendersSkipped=' +
                    bulkStats.rendersSkipped
            );
    }
}

/* ===== BULK USUWANIE ZAZNACZONYCH ===== */
async function _excelBulkDeleteSelected() {
    if (typeof wells === 'undefined' || !Array.isArray(wells)) return;
    const sel = [];
    for (let i = 0; i < wells.length; i++) {
        if (_excelRowSelectStates[i]) sel.push(i);
    }
    if (sel.length === 0) {
        showToast('Zaznacz co najmniej jedną studnię (checkbox)', 'warning');
        return;
    }
    const locked = sel.filter(function (i) {
        return typeof _excelIsWellLocked === 'function' && _excelIsWellLocked(i);
    });
    const withPz = sel.filter(function (i) {
        const w = wells[i];
        return (
            w &&
            typeof window.pzGuard !== 'undefined' &&
            window.pzGuard.hasPzForWell &&
            window.pzGuard.hasPzForWell(w.id)
        );
    });
    const blockedSet = new Set([...locked, ...withPz]);
    const editable = sel.filter(function (i) {
        return !blockedSet.has(i);
    });
    if (locked.length > 0) showToast('Pominięto ' + locked.length + ' zablokowanych', 'warning');
    if (withPz.length > 0) showToast('Pominięto ' + withPz.length + ' z PZ', 'warning');
    if (editable.length === 0) {
        showToast('Brak studni do usunięcia (wszystkie zablokowane / z PZ)', 'info');
        return;
    }
    const count = editable.length;
    const label = count === 1 ? wells[editable[0]].name : count + ' studni';
    if (
        !(await appConfirm(`Usunąć ${label}?`, {
            title: 'Usuwanie studni',
            type: 'danger'
        }))
    )
        return;
    _excelSaveUndoSnapshot();
    _excelMarkDirty();
    const deletedSet = new Set(editable);
    // usuń malejąco by nie przesuwać indeksów
    const sorted = [...editable].sort(function (a, b) {
        return b - a;
    });
    sorted.forEach(function (idx) {
        wells.splice(idx, 1);
    });
    if (typeof _excelRebuildWellIndex === 'function') _excelRebuildWellIndex();
    if (typeof _excelInvalidateFilteredIndexes === 'function') _excelInvalidateFilteredIndexes();
    // przebuduj mapę zaznaczeń checkboxów dla pozostałych wierszy
    const newStates = {};
    Object.keys(_excelRowSelectStates).forEach(function (k) {
        const oldIdx = parseInt(k, 10);
        if (deletedSet.has(oldIdx)) return;
        let shift = 0;
        for (let j = 0; j < editable.length; j++) {
            if (editable[j] < oldIdx) shift++;
        }
        const newIdx = oldIdx - shift;
        if (newIdx >= 0 && newIdx < wells.length) newStates[newIdx] = _excelRowSelectStates[k];
    });
    _excelRowSelectStates = newStates;
    // wyczyść / przesuń selekcję komórek
    if (typeof _excelSelectedCells !== 'undefined' && _excelSelectedCells.length > 0) {
        const kept = [];
        _excelSelectedCells.forEach(function (cell) {
            if (deletedSet.has(cell.wIdx)) return;
            let shift = 0;
            for (let j = 0; j < editable.length; j++) {
                if (editable[j] < cell.wIdx) shift++;
            }
            kept.push({ wIdx: cell.wIdx - shift, colIdx: cell.colIdx });
        });
        // odznacz stare, nadpisz nowe
        _excelResetLayoutDependentState();
        // _excelResetLayoutDependentState wyczyścił _excelSelectedCells — przywróć przesunięte
        _excelSelectedCells = kept;
    } else {
        _excelResetLayoutDependentState();
    }
    if (_excelLastClickedCell && deletedSet.has(_excelLastClickedCell.wIdx)) {
        _excelLastClickedCell = null;
    } else if (_excelLastClickedCell) {
        let shift = 0;
        for (let j = 0; j < editable.length; j++) {
            if (editable[j] < _excelLastClickedCell.wIdx) shift++;
        }
        _excelLastClickedCell.wIdx -= shift;
    }
    if (typeof currentWellIndex !== 'undefined') {
        if (deletedSet.has(currentWellIndex)) {
            currentWellIndex = Math.min(currentWellIndex, Math.max(0, wells.length - 1));
            if (wells.length === 0) currentWellIndex = -1;
        } else {
            let shift = 0;
            for (let j = 0; j < editable.length; j++) {
                if (editable[j] < currentWellIndex) shift++;
            }
            currentWellIndex -= shift;
            if (currentWellIndex >= wells.length) currentWellIndex = Math.max(0, wells.length - 1);
        }
    }
    const hdrAll = document.getElementById('excel-select-all');
    if (hdrAll) hdrAll.checked = false;
    if (typeof _excelGetMaxTransitions === 'function') {
        _excelMaxTransitions[_excelActiveTab] = _excelGetMaxTransitions();
    }
    _excelRenderTabs();
    _excelRenderTable(_excelActiveTab);
    _excelUpdateWellCount();
    _excelDebouncedRefresh();
    if (typeof renderWellConfig === 'function') renderWellConfig();
    if (typeof window.updateSummary === 'function') window.updateSummary();
    if (typeof window.renderWellsList === 'function') window.renderWellsList();
    showToast('Usunięto ' + count + ' studni', 'info');
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
            const _addedIdsLines = [];
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
                _addedIdsLines.push(well.id);
                _excelAutoSetWlaz(well);
                added++;
            }
            if (added > 0) {
                if (
                    added > 200 &&
                    _addedIdsLines.length > 0 &&
                    typeof _excelPushBulkAddUndo === 'function'
                ) {
                    if (
                        _excelUndoStack.length > 0 &&
                        _excelUndoStack[_excelUndoStack.length - 1].type === 'full'
                    )
                        _excelUndoStack.pop();
                    _excelPushBulkAddUndo(_addedIdsLines, 'paste-lines-' + Date.now());
                }
                if (typeof _excelRebuildWellIndex === 'function') _excelRebuildWellIndex();
                if (typeof _excelInvalidateFilteredIndexes === 'function')
                    _excelInvalidateFilteredIndexes();
                // Jeśli na aktywnej zakładce po dodaniu jest 0 studni, ale dodano studnie na innej zakładce, przełącz na tamtą z nowymi studniami
                const activeTabWellsParsed = wells.filter(function (w) {
                    return _excelWellMatchesTab(w, _excelActiveTab);
                });
                if (activeTabWellsParsed.length === 0 && wells.length > 0) {
                    const DN_TABS = ['1000', '1200', '1500', '2000', '2500', 'styczne'];
                    for (let ti = 0; ti < DN_TABS.length; ti++) {
                        const tab = DN_TABS[ti];
                        const tabWells = wells.filter(function (w) {
                            return _excelWellMatchesTab(w, tab);
                        });
                        if (tabWells.length > 0) {
                            _excelActiveTab = tab;
                            break;
                        }
                    }
                }
                _excelMaxTransitions[_excelActiveTab] = _excelGetMaxTransitions();
                _excelRenderTabs();
                _excelRenderTable(_excelActiveTab);
                _excelUpdateWellCount();
                _excelDebouncedRefresh();
                // po dużym wklejeniu przewiń do nowych wierszy (virtual pokazuje tylko viewport)
                try {
                    const cont = document.getElementById('excel-table-container');
                    if (cont && added > 10) cont.scrollTop = cont.scrollHeight;
                } catch (_e) {}
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
    const addedIndices = [];
    const _addedIdsParsed = [];
    parsed.forEach(function (row) {
        const name = String(row.name || '').trim();
        if (!name) return;
        // DN z danych steruje routingiem, fallback → aktywna zakładka
        let dnVal = row.dn || String(dn);
        dnVal = dnVal === 'styczne' || dnVal === 'styczna' ? 'styczna' : parseInt(dnVal, 10);
        if (typeof dnVal === 'number' && isNaN(dnVal)) dnVal = parseInt(String(dn), 10) || 1000;
        const rzw =
            row.rzednaWlazu != null && String(row.rzednaWlazu).trim() !== ''
                ? parseFloat(String(row.rzednaWlazu).replace(',', '.'))
                : null;
        const rzd =
            row.rzednaDna != null && String(row.rzednaDna).trim() !== ''
                ? parseFloat(String(row.rzednaDna).replace(',', '.'))
                : null;
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
        well.name = name;
        well.numer = String(name).replace(/ (PRE|UTH)$/, '');
        if (rzw !== null && !isNaN(rzw)) well.rzednaWlazu = rzw;
        if (rzd !== null && !isNaN(rzd)) well.rzednaDna = rzd;
        // przejścia z parsowania
        if (row.przejscia && row.przejscia.length > 0) {
            well.przejscia = [];
            row.przejscia.forEach(function (pr) {
                const np =
                    typeof _excelCreatePrzejscie === 'function' ? _excelCreatePrzejscie() : {};
                if (pr.rzednaWlaczenia != null) np.rzednaWlaczenia = pr.rzednaWlaczenia;
                if (pr.angle != null) {
                    np.angle = pr.angle;
                    np.angleExecution = pr.angleExecution != null ? pr.angleExecution : pr.angle;
                    np.angleGony = pr.angleGony || String(pr.angle);
                    np.flowType = pr.flowType || (pr.angle === 0 ? 'WYLOT' : 'WLOT');
                }
                if (pr.tempCategory) np.tempCategory = pr.tempCategory;
                if (pr.productId) np.productId = pr.productId;
                well.przejscia.push(np);
            });
        }
        wells.push(well);
        addedIndices.push(wells.length - 1);
        _addedIdsParsed.push(well.id);
        _excelAutoSetWlaz(well);
        added++;
    });
    if (added === 0) {
        showToast('Nie dodano żadnej studni', 'info');
        return;
    }
    if (added > 200 && _addedIdsParsed.length > 0 && typeof _excelPushBulkAddUndo === 'function') {
        if (
            _excelUndoStack.length > 0 &&
            _excelUndoStack[_excelUndoStack.length - 1].type === 'full'
        )
            _excelUndoStack.pop();
        _excelPushBulkAddUndo(_addedIdsParsed, 'paste-parsed-' + Date.now());
    }
    if (typeof _excelRebuildWellIndex === 'function') _excelRebuildWellIndex();
    // Przelicz maxTransitions dla wszystkich DN po dodaniu mieszanych
    if (typeof _excelGetMaxTransitions === 'function') {
        const allTabs = ['1000', '1200', '1500', '2000', '2500', 'styczne'];
        const savedTab = _excelActiveTab;
        allTabs.forEach(function (t) {
            _excelActiveTab = t;
            _excelMaxTransitions[t] = _excelGetMaxTransitions();
        });
        _excelActiveTab = savedTab;
    } else {
        _excelMaxTransitions[_excelActiveTab] = _excelGetMaxTransitions();
    }
    _excelRenderTabs();
    _excelRenderTable(_excelActiveTab);
    _excelUpdateWellCount();
    try {
        const cont = document.getElementById('excel-table-container');
        if (cont && added > 10) cont.scrollTop = cont.scrollHeight;
    } catch (_e) {}
    // Natychmiastowy refresh głównego konfiguratora
    if (typeof _excelMarkDirty === 'function') _excelMarkDirty();
    if (typeof window.refreshAll === 'function') {
        try {
            window.refreshAll();
        } catch (_e) {}
    } else {
        if (typeof window.updateSummary === 'function') window.updateSummary();
        if (typeof window.renderWellsList === 'function') window.renderWellsList();
        if (typeof window.renderWellDiagram === 'function') window.renderWellDiagram();
    }
    // autoSelect — Faza5 thresholds: ≤50 auto, 51-500 batch+progress, >500 OFF
    if (typeof _excelAutoSelectEnabled !== 'undefined' && _excelAutoSelectEnabled) {
        if (addedIndices.length > 500) {
            if (typeof showToast === 'function')
                showToast(
                    'Dodano ' +
                        added +
                        ' studni. Automatyczna konfiguracja nie została uruchomiona — użyj [Przelicz zaznaczone] / [Przelicz wszystkie]',
                    'warning'
                );
        } else if (addedIndices.length > 50) {
            const toRun = addedIndices.slice(0, 50);
            if (typeof showToast === 'function')
                showToast(
                    'Dodano ' +
                        added +
                        ' studni — auto dla pierwszych 50, reszta via [Przelicz zaznaczone]',
                    'info'
                );
            if (
                typeof _excelRunBulkJob === 'function' &&
                typeof _excelNewBulkAbort === 'function'
            ) {
                const abort = _excelNewBulkAbort();
                _excelRunBulkJob({
                    total: toRun.length,
                    chunkSize: 1,
                    label: 'Auto-dobór...',
                    signal: abort.signal,
                    onChunk: async function (start, end) {
                        for (let k = start; k < end; k++) {
                            const nwi = toRun[k];
                            const w = wells[nwi];
                            if (!w || w.rzednaWlazu == null || w.rzednaDna == null) continue;
                            if (!(parseFloat(w.rzednaWlazu) > parseFloat(w.rzednaDna))) continue;
                            if (typeof _excelAutoSelectForWell === 'function')
                                await _excelAutoSelectForWell(nwi).catch(function () {});
                            else if (typeof autoSelectComponents === 'function') {
                                const saved =
                                    typeof currentWellIndex !== 'undefined' ? currentWellIndex : -1;
                                currentWellIndex = nwi;
                                await autoSelectComponents(true).catch(function () {});
                                currentWellIndex = saved;
                            }
                        }
                    }
                });
            } else {
                (async function _runPasteCreateAutoBatch() {
                    for (const nwi of toRun) {
                        const w = wells[nwi];
                        if (!w || w.rzednaWlazu == null || w.rzednaDna == null) continue;
                        if (!(parseFloat(w.rzednaWlazu) > parseFloat(w.rzednaDna))) continue;
                        if (typeof _excelAutoSelectForWell === 'function')
                            await _excelAutoSelectForWell(nwi).catch(function () {});
                    }
                })();
            }
        } else {
            // ponytail: sekwencyjnie zamiast forEach+setTimeout (300ms < czas solvera ~1s → WARN/gubione)
            (async function _runPasteCreateAutoBatch() {
                for (const nwi of addedIndices) {
                    const w = wells[nwi];
                    if (
                        !w ||
                        w.rzednaWlazu == null ||
                        w.rzednaDna == null ||
                        !(parseFloat(w.rzednaWlazu) > parseFloat(w.rzednaDna))
                    )
                        continue;
                    if (typeof _excelAutoSelectForWell === 'function') {
                        await _excelAutoSelectForWell(nwi).catch(function (e) {
                            if (window.logger)
                                window.logger.warn(
                                    'AutoSelect pominiety dla nowej studni:',
                                    e.message || e
                                );
                        });
                    } else if (typeof autoSelectComponents === 'function') {
                        const saved =
                            typeof currentWellIndex !== 'undefined' ? currentWellIndex : -1;
                        currentWellIndex = nwi;
                        await autoSelectComponents(true).catch(function () {});
                        currentWellIndex = saved;
                    }
                }
            })();
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

    let startLine = 0;
    const firstParts = lines[0].replace('\r', '').split('\t');
    if (typeof _excelDetectHeader === 'function' && _excelDetectHeader(firstParts)) {
        startLine = 1;
    }

    const VALID_DNS = new Set(['1000', '1200', '1500', '2000', '2500', 'styczna', 'styczne']);
    const result = [];
    for (let li = startLine; li < lines.length; li++) {
        const parts = lines[li].replace('\r', '').split('\t');
        if (parts.length === 0) continue;
        const row = { name: (parts[0] || '').trim(), przejscia: [] };
        if (!row.name) continue;

        let pIdx = 1;
        if (parts.length > 1) {
            const p1 = parts[1].trim().toLowerCase();
            if (VALID_DNS.has(p1)) {
                row.dn = parts[1].trim();
                pIdx = 2;
            }
        }
        if (parts.length > pIdx) {
            row.rzednaWlazu = parts[pIdx].trim();
            pIdx++;
        }
        if (parts.length > pIdx) {
            row.rzednaDna = parts[pIdx].trim();
            pIdx++;
        }

        // Przejścia: od pIdx dalej w czwórkach [DN, rzędna, kąt, rodzaj] w kolejności DN|rzedna|kąt|rodzaj (zew. Excel)
        // wewnętrznie: Rz.wlot, Kąt, Rodzaj, Średnica → mapujemy
        if (parts.length > pIdx) {
            let trIdx = pIdx;
            while (trIdx < parts.length) {
                const dnRaw = (parts[trIdx] || '').trim();
                const rzRaw = (parts[trIdx + 1] || '').trim();
                const katRaw = (parts[trIdx + 2] || '').trim();
                const rodzRaw = (parts[trIdx + 3] || '').trim();
                if (!dnRaw && !rzRaw && !katRaw && !rodzRaw) break;
                const p =
                    typeof _excelCreatePrzejscie === 'function' ? _excelCreatePrzejscie() : {};
                if (dnRaw) {
                    const numDn = dnRaw.replace(/\D/g, '');
                    if (numDn) p.tempDnForParse = numDn;
                }
                if (rzRaw) {
                    const v = rzRaw.replace(',', '.');
                    const num = parseFloat(v);
                    if (!isNaN(num)) p.rzednaWlaczenia = num;
                }
                if (katRaw) {
                    const k = parseFloat(String(katRaw).replace(',', '.'));
                    if (!isNaN(k)) {
                        p.angle = k;
                        p.angleExecution = k;
                        p.angleGony = k.toFixed(2);
                        p.flowType = k === 0 ? 'WYLOT' : 'WLOT';
                    }
                }
                if (rodzRaw) p.tempCategory = rodzRaw;
                if (dnRaw) {
                    const numDn2 = dnRaw.replace(/\D/g, '');
                    if (numDn2 && typeof studnieProducts !== 'undefined') {
                        const prod = studnieProducts.find(
                            (pr) =>
                                pr.componentType === 'przejscie' &&
                                (String(pr.dn) === numDn2 ||
                                    (pr.name && pr.name.indexOf(numDn2) >= 0))
                        );
                        if (prod) {
                            p.productId = prod.id;
                            if (!p.tempCategory) p.tempCategory = prod.category;
                        }
                    }
                }
                // Dodaj tylko jeśli ma jakiekolwiek dane
                if (p.rzednaWlaczenia != null || p.angle || p.tempCategory || p.productId) {
                    row.przejscia.push(p);
                }
                trIdx += 4;
                // fallback: jeśli dane są w układzie 3-kol (bez rodzaju), obsłuż
                if (trIdx < parts.length && parts.length - trIdx < 4) break;
            }
            // Obsługa wariantu 3-kol (DN, rzędna, kąt) bez rodzaju
            if (
                row.przejscia.length === 0 &&
                parts.length > pIdx + 2 &&
                (parts.length - pIdx) % 3 === 0
            ) {
                row.przejscia = [];
                let q = pIdx;
                while (q + 2 < parts.length) {
                    const d = (parts[q] || '').trim();
                    const r = (parts[q + 1] || '').trim();
                    const k2 = (parts[q + 2] || '').trim();
                    if (!d && !r && !k2) break;
                    const pp =
                        typeof _excelCreatePrzejscie === 'function' ? _excelCreatePrzejscie() : {};
                    if (r) {
                        const vv = parseFloat(String(r).replace(',', '.'));
                        if (!isNaN(vv)) pp.rzednaWlaczenia = vv;
                    }
                    if (k2) {
                        const kk = parseFloat(String(k2).replace(',', '.'));
                        if (!isNaN(kk)) {
                            pp.angle = kk;
                            pp.angleExecution = kk;
                            pp.angleGony = kk.toFixed(2);
                            pp.flowType = kk === 0 ? 'WYLOT' : 'WLOT';
                        }
                    }
                    if (d) {
                        const nd = d.replace(/\D/g, '');
                        if (nd && typeof studnieProducts !== 'undefined') {
                            const pr2 = studnieProducts.find(
                                (pr) => pr.componentType === 'przejscie' && String(pr.dn) === nd
                            );
                            if (pr2) {
                                pp.productId = pr2.id;
                                pp.tempCategory = pr2.category;
                            }
                        }
                    }
                    if (pp.rzednaWlaczenia != null || pp.angle || pp.productId)
                        row.przejscia.push(pp);
                    q += 3;
                }
            }
        }
        if (row.name) result.push(row);
    }
    return result;
}
