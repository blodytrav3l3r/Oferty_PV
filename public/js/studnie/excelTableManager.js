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

const USE_PATCH_UNDO = true; // B+ flag — patch undo, fallback full snapshot przy błędzie

/* B+ — path-based patch dla pojedynczej komórki (logicalColumnId) */
function _excelSaveCellPatch(wellId, path, before, after) {
    if (!USE_PATCH_UNDO) return _excelSaveUndoSnapshot();
    if (typeof wells === 'undefined') return;
    _excelUndoStack.push({
        type: 'cell-edit',
        wellId,
        path,
        before: structuredClone(before),
        after: structuredClone(after)
    });
    if (_excelUndoStack.length > _EXCEL_UNDO_LIMIT) _excelUndoStack.shift();
    _excelRedoStack = [];
}
function _excelSaveBatchPatch(changes) {
    if (!USE_PATCH_UNDO || !Array.isArray(changes) || changes.length === 0)
        return _excelSaveUndoSnapshot();
    const batch = changes.map(function (c) {
        return {
            wellId: c.wellId,
            path: c.path,
            before: structuredClone(c.before),
            after: structuredClone(c.after)
        };
    });
    _excelUndoStack.push({ type: 'batch', changes: batch });
    if (_excelUndoStack.length > _EXCEL_UNDO_LIMIT) _excelUndoStack.shift();
    _excelRedoStack = [];
}
if (typeof window !== 'undefined') {
    window._excelSaveCellPatch = _excelSaveCellPatch;
    window._excelSaveBatchPatch = _excelSaveBatchPatch;
}

/* ===== UNDO / REDO — patch-based dla 10k, fallback full snapshot dla splice ===== */
function _excelSaveUndoSnapshot() {
    if (typeof wells === 'undefined') return;
    const args = Array.prototype.slice.call(arguments);
    let idxs = [];
    if (args.length === 1 && Array.isArray(args[0])) idxs = args[0];
    else if (args.length > 0 && typeof args[0] === 'number') idxs = args;
    else if (
        args.length === 1 &&
        typeof args[0] === 'object' &&
        args[0] !== null &&
        args[0].wellIdx != null
    )
        idxs = [args[0].wellIdx];
    // patch dla 1..N wells, full dla braku args (np. bulk add) lub dużych zmian
    if (idxs.length > 0 && idxs.length < wells.length && idxs.length <= 100) {
        const patch = { type: 'patch', wells: [] };
        for (let k = 0; k < idxs.length; k++) {
            const i = idxs[k];
            if (wells[i])
                patch.wells.push({ idx: i, id: wells[i].id, before: structuredClone(wells[i]) });
        }
        if (patch.wells.length === 0) return;
        _excelUndoStack.push(patch);
    } else {
        // fallback full snapshot (np. add/delete, duże paste)
        _excelUndoStack.push({ type: 'full', data: structuredClone(wells) });
    }
    if (_excelUndoStack.length > _EXCEL_UNDO_LIMIT) _excelUndoStack.shift();
    _excelRedoStack = [];
}

function _excelApplyPatchPath(obj, path, value) {
    if (!obj || !path) return;
    const parts = String(path).split('.');
    let cur = obj;
    for (let i = 0; i < parts.length - 1; i++) {
        const key = parts[i];
        const idx = parseInt(key, 10);
        if (!isNaN(idx) && Array.isArray(cur)) cur = cur[idx];
        else cur = cur[key];
        if (!cur) return;
    }
    const last = parts[parts.length - 1];
    const lastIdx = parseInt(last, 10);
    if (!isNaN(lastIdx) && Array.isArray(cur)) cur[lastIdx] = value;
    else cur[last] = value;
}
function _excelFindWellIdxById(id) {
    if (typeof _excelWellIndexById !== 'undefined' && _excelWellIndexById.has(id))
        return _excelWellIndexById.get(id);
    return wells.findIndex(function (w) {
        return w && w.id === id;
    });
}

function _excelUndo() {
    if (_excelUndoStack.length === 0) return;
    const patch = _excelUndoStack.pop();
    if (patch.type === 'cell-edit') {
        const wIdx = _excelFindWellIdxById(patch.wellId);
        if (wIdx >= 0 && wells[wIdx]) {
            const redoPatch = {
                type: 'cell-edit',
                wellId: patch.wellId,
                path: patch.path,
                before: structuredClone(patch.before),
                after: structuredClone(patch.after)
            };
            _excelRedoStack.push(redoPatch);
            _excelApplyPatchPath(wells[wIdx], patch.path, patch.before);
            if (typeof _excelRebuildWellIndex === 'function' && patch.path === 'id')
                _excelRebuildWellIndex();
        } else {
            // fallback full
            _excelRedoStack.push({ type: 'full', data: structuredClone(wells) });
        }
    } else if (patch.type === 'batch') {
        const redoBatch = { type: 'batch', changes: [] };
        for (let i = 0; i < patch.changes.length; i++) {
            const c = patch.changes[i];
            redoBatch.changes.push({
                wellId: c.wellId,
                path: c.path,
                before: structuredClone(c.before),
                after: structuredClone(c.after)
            });
        }
        _excelRedoStack.push(redoBatch);
        for (let i = 0; i < patch.changes.length; i++) {
            const c = patch.changes[i];
            const wIdx = _excelFindWellIdxById(c.wellId);
            if (wIdx >= 0 && wells[wIdx]) {
                _excelApplyPatchPath(wells[wIdx], c.path, c.before);
            }
        }
    } else if (patch.type === 'patch') {
        const redoPatch = { type: 'patch', wells: [] };
        for (let k = 0; k < patch.wells.length; k++) {
            const e = patch.wells[k];
            const curIdx =
                typeof e.idx === 'number'
                    ? e.idx
                    : wells.findIndex(function (w) {
                          return w && w.id === e.id;
                      });
            if (curIdx >= 0 && wells[curIdx])
                redoPatch.wells.push({
                    idx: curIdx,
                    id: e.id,
                    before: structuredClone(wells[curIdx])
                });
        }
        _excelRedoStack.push(redoPatch);
        const locked = _excelSnapshotLockedWells();
        for (let k = 0; k < patch.wells.length; k++) {
            const e = patch.wells[k];
            const curIdx =
                typeof e.idx === 'number'
                    ? e.idx
                    : wells.findIndex(function (w) {
                          return w && w.id === e.id;
                      });
            if (curIdx >= 0) wells[curIdx] = structuredClone(e.before);
            else if (e.before) wells.push(structuredClone(e.before));
        }
        _excelRestoreLockedWells(locked);
    } else {
        _excelRedoStack.push({ type: 'full', data: structuredClone(wells) });
        const snap = patch.data || patch;
        const locked = _excelSnapshotLockedWells();
        const arr = Array.isArray(snap) ? snap : snap.data;
        wells.splice(0, wells.length, ...(Array.isArray(arr) ? arr : []));
        if (typeof _excelRebuildWellIndex === 'function') _excelRebuildWellIndex();
        _excelRestoreLockedWells(locked);
    }
    _excelMarkDirty();
    _excelRenderTable(_excelActiveTab);
    if (typeof _excelDebouncedRefresh === 'function') _excelDebouncedRefresh();
    showToast('Cofnięto', 'info');
}

function _excelRedo() {
    if (_excelRedoStack.length === 0) return;
    const patch = _excelRedoStack.pop();
    if (patch.type === 'cell-edit') {
        const wIdx = _excelFindWellIdxById(patch.wellId);
        if (wIdx >= 0 && wells[wIdx]) {
            const undoPatch = {
                type: 'cell-edit',
                wellId: patch.wellId,
                path: patch.path,
                before: structuredClone(patch.before),
                after: structuredClone(patch.after)
            };
            _excelUndoStack.push(undoPatch);
            _excelApplyPatchPath(wells[wIdx], patch.path, patch.after);
        }
    } else if (patch.type === 'batch') {
        const undoBatch = { type: 'batch', changes: [] };
        for (let i = 0; i < patch.changes.length; i++) {
            const c = patch.changes[i];
            undoBatch.changes.push({
                wellId: c.wellId,
                path: c.path,
                before: structuredClone(c.before),
                after: structuredClone(c.after)
            });
        }
        _excelUndoStack.push(undoBatch);
        for (let i = 0; i < patch.changes.length; i++) {
            const c = patch.changes[i];
            const wIdx = _excelFindWellIdxById(c.wellId);
            if (wIdx >= 0 && wells[wIdx]) {
                _excelApplyPatchPath(wells[wIdx], c.path, c.after);
            }
        }
    } else if (patch.type === 'patch') {
        const undoPatch = { type: 'patch', wells: [] };
        for (let k = 0; k < patch.wells.length; k++) {
            const e = patch.wells[k];
            const curIdx =
                typeof e.idx === 'number'
                    ? e.idx
                    : wells.findIndex(function (w) {
                          return w && w.id === e.id;
                      });
            if (curIdx >= 0 && wells[curIdx])
                undoPatch.wells.push({
                    idx: curIdx,
                    id: e.id,
                    before: structuredClone(wells[curIdx])
                });
        }
        _excelUndoStack.push(undoPatch);
        const locked = _excelSnapshotLockedWells();
        for (let k = 0; k < patch.wells.length; k++) {
            const e = patch.wells[k];
            const curIdx =
                typeof e.idx === 'number'
                    ? e.idx
                    : wells.findIndex(function (w) {
                          return w && w.id === e.id;
                      });
            if (curIdx >= 0) wells[curIdx] = structuredClone(e.before);
        }
        _excelRestoreLockedWells(locked);
    } else {
        _excelUndoStack.push({ type: 'full', data: structuredClone(wells) });
        const snap = patch.data || patch;
        const arr = Array.isArray(snap) ? snap : snap.data;
        const locked = _excelSnapshotLockedWells();
        wells.splice(0, wells.length, ...(Array.isArray(arr) ? arr : []));
        if (typeof _excelRebuildWellIndex === 'function') _excelRebuildWellIndex();
        _excelRestoreLockedWells(locked);
    }
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
                if (typeof _excelRebuildWellIndex === 'function') _excelRebuildWellIndex();
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
    const addedIndices = [];
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
        _excelAutoSetWlaz(well);
        added++;
    });
    if (added === 0) {
        showToast('Nie dodano żadnej studni', 'info');
        return;
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
    // autoSelect jak przy ręcznym: tylko gdy rzWlazu > rzDna
    if (typeof _excelAutoSelectEnabled !== 'undefined' && _excelAutoSelectEnabled) {
        addedIndices.forEach(function (nwi, k) {
            setTimeout(
                function () {
                    const w = wells[nwi];
                    if (
                        w &&
                        w.rzednaWlazu != null &&
                        w.rzednaDna != null &&
                        parseFloat(w.rzednaWlazu) > parseFloat(w.rzednaDna)
                    ) {
                        if (typeof _excelAutoSelectForWell === 'function') {
                            _excelAutoSelectForWell(nwi).catch(function (e) {
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
                            autoSelectComponents(true).catch(function () {});
                            currentWellIndex = saved;
                        }
                    }
                },
                200 + k * 300
            );
        });
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
        const row = { name: (parts[0] || '').trim(), przejscia: [] };
        if (parts.length > 1) row.dn = parts[1].trim();
        if (parts.length > 2) row.rzednaWlazu = parts[2].trim();
        if (parts.length > 3) row.rzednaDna = parts[3].trim();
        // Przejścia: każda czwórka → [DN, rzędna, kąt, rodzaj] w kolejności DN|rzedna|kąt|rodzaj (zew. Excel)
        // wewnętrznie: Rz.wlot, Kąt, Rodzaj, Średnica → mapujemy
        if (parts.length > 4) {
            let pIdx = 4;
            while (pIdx < parts.length) {
                const dnRaw = (parts[pIdx] || '').trim();
                const rzRaw = (parts[pIdx + 1] || '').trim();
                const katRaw = (parts[pIdx + 2] || '').trim();
                const rodzRaw = (parts[pIdx + 3] || '').trim();
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
                pIdx += 4;
                // fallback: jeśli dane są w układzie 3-kol (bez rodzaju), obsłuż
                if (pIdx < parts.length && parts.length - pIdx < 4) break;
            }
            // Obsługa wariantu 3-kol (DN, rzędna, kąt) bez rodzaju
            if (row.przejscia.length === 0 && parts.length > 6 && (parts.length - 4) % 3 === 0) {
                row.przejscia = [];
                let q = 4;
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
