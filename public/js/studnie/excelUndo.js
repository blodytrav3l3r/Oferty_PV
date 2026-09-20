// @ts-check
/* ===== EXCEL UNDO — patch-based undo/redo + stacki snapshotów (E7 split z excelTableManager.js, move-intact; stacki w excelState.js, flaga _excelPasteInProgress #29) ===== */
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

function _excelEstimateUndoBytes(entry) {
    try {
        return JSON.stringify(entry).length;
    } catch (_e) {
        return 0;
    }
}
function _excelUndoTotalBytes(stack) {
    let s = 0;
    for (let i = 0; i < stack.length; i++) s += _excelEstimateUndoBytes(stack[i]);
    return s;
}
function _excelEvictUndoIfNeeded() {
    const maxEntries =
        typeof wells !== 'undefined' && Array.isArray(wells) && wells.length > 1000 ? 20 : 50;
    const maxBytes =
        typeof _EXCEL_UNDO_MAX_BYTES !== 'undefined' ? _EXCEL_UNDO_MAX_BYTES : 12 * 1024 * 1024;
    while (_excelUndoStack.length > maxEntries) _excelUndoStack.shift();
    // bytes eviction FIFO — expected ~8-12MB, Actual TBD baseline
    let guard = 0;
    while (
        _excelUndoTotalBytes(_excelUndoStack) > maxBytes &&
        _excelUndoStack.length > 1 &&
        guard < 100
    ) {
        _excelUndoStack.shift();
        guard++;
    }
}

/* ===== UNDO / REDO — patch-based dla 10k, fallback full snapshot dla splice ===== */
/* E5: gate'y undo odrzucały snapshot po cichu (N>100 / cap 1 MB) — użytkownik
   widział tylko martwy Ctrl+Z. Helper loguje powód (logger) + throttled toast
   (max 1/10 s, bez spamu przy operacjach seryjnych). Bez zmian semantyki undo. */
let _excelUndoWarnLastTs = 0;
function _excelNotifyUndoRejected(reason) {
    try {
        if (typeof logger !== 'undefined' && logger && typeof logger.warn === 'function')
            logger.warn('excelUndo', reason);
        else if (
            typeof window !== 'undefined' &&
            window.logger &&
            typeof window.logger.warn === 'function'
        )
            window.logger.warn('excelUndo', reason);
    } catch (_eWarn) {}
    try {
        const now = Date.now();
        if (now - _excelUndoWarnLastTs < 10000) return;
        _excelUndoWarnLastTs = now;
        if (typeof showToast === 'function')
            showToast('Cofnij (Ctrl+Z) niedostępne dla tej zmiany: ' + reason, 'warning');
    } catch (_eToast) {}
}
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
    const n = Array.isArray(wells) ? wells.length : 0;
    // v1.1 hard gate: N>100 → structuredClone(wells) FORBIDDEN — bytes budget > entry count
    if (n > 100 && idxs.length === 0) {
        // bulk op without idxs at >100: use bulk-add pattern, not full — caller should use _excelPushBulkAddUndo
        // compact fallback: store ids only if possible, else single patch of last well
        _excelNotifyUndoRejected('za dużo studni (>100) — operacja zbiorcza bez Ctrl+Z');
        return;
    }
    // patch dla 1..N wells, full dla braku args (np. bulk add) lub dużych zmian
    if (idxs.length > 0 && idxs.length < wells.length && idxs.length <= 100) {
        const patch = { type: 'patch', wells: [] };
        for (let k = 0; k < idxs.length; k++) {
            const i = idxs[k];
            if (wells[i])
                patch.wells.push({ idx: i, id: wells[i].id, before: structuredClone(wells[i]) });
        }
        if (patch.wells.length === 0) return;
        // per-entry bytes cap: if patch >1MB split via bulk-add — not full
        if (
            _excelEstimateUndoBytes(patch) >
            (typeof _EXCEL_UNDO_MAX_BYTES_PER_ENTRY !== 'undefined'
                ? _EXCEL_UNDO_MAX_BYTES_PER_ENTRY
                : 1024 * 1024)
        ) {
            _excelNotifyUndoRejected('wpis undo >1 MB — pominięto snapshot (Ctrl+Z niedostępne)');
            return;
        }
        _excelUndoStack.push(patch);
    } else {
        if (n > 100) {
            _excelNotifyUndoRejected('za dużo studni (>100) — pełny snapshot zablokowany');
            return; // hard gate — never full snapshot at >100
        }
        // fallback full snapshot (np. add/delete, duże paste) only when N<=100
        _excelUndoStack.push({ type: 'full', data: structuredClone(wells) });
    }
    _excelEvictUndoIfNeeded();
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

function _excelPushBulkAddUndo(ids, batchId) {
    if (!Array.isArray(ids) || ids.length === 0) return;
    _excelUndoStack.push({ type: 'bulk-add', ids: ids.slice(), batchId: batchId || null });
    _excelEvictUndoIfNeeded();
    _excelRedoStack = [];
}
if (typeof window !== 'undefined') window._excelPushBulkAddUndo = _excelPushBulkAddUndo;

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
    } else if (patch.type === 'bulk-add') {
        const ids = patch.ids || [];
        const removed = [];
        // ponytail: Map O(N+K) zamiast O(K*N) findIndex
        const idxById = new Map();
        for (let j = 0; j < wells.length; j++)
            if (wells[j] && wells[j].id != null) idxById.set(String(wells[j].id), j);
        for (let i = 0; i < ids.length; i++) {
            const idx = idxById.get(String(ids[i]));
            if (idx !== undefined && wells[idx])
                removed.push({ idx: idx, data: structuredClone(wells[idx]) });
        }
        // splice descending to keep indices valid
        const toRemove = [];
        for (let i = 0; i < ids.length; i++) {
            const idx = idxById.get(String(ids[i]));
            if (idx !== undefined) toRemove.push(idx);
        }
        toRemove.sort(function (a, b) {
            return b - a;
        });
        for (let i = 0; i < toRemove.length; i++) wells.splice(toRemove[i], 1);
        if (typeof _excelRebuildWellIndex === 'function') _excelRebuildWellIndex();
        if (typeof _excelInvalidateFilteredIndexes === 'function')
            _excelInvalidateFilteredIndexes();
        _excelRedoStack.push({ type: 'bulk-add-redo', wells: removed, batchId: patch.batchId });
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
    } else if (patch.type === 'bulk-add') {
        const ids = patch.ids || [];
        const removed = [];
        const idxById2 = new Map();
        for (let j = 0; j < wells.length; j++)
            if (wells[j] && wells[j].id != null) idxById2.set(String(wells[j].id), j);
        for (let i = 0; i < ids.length; i++) {
            const idx = idxById2.get(String(ids[i]));
            if (idx !== undefined && wells[idx])
                removed.push({ idx: idx, data: structuredClone(wells[idx]) });
        }
        const toRemove2 = [];
        for (let i = 0; i < ids.length; i++) {
            const idx = idxById2.get(String(ids[i]));
            if (idx !== undefined) toRemove2.push(idx);
        }
        toRemove2.sort(function (a, b) {
            return b - a;
        });
        for (let i = 0; i < toRemove2.length; i++) wells.splice(toRemove2[i], 1);
        if (typeof _excelRebuildWellIndex === 'function') _excelRebuildWellIndex();
        if (typeof _excelInvalidateFilteredIndexes === 'function')
            _excelInvalidateFilteredIndexes();
        _excelUndoStack.push({ type: 'bulk-add-redo', wells: removed, batchId: patch.batchId });
    } else if (patch.type === 'bulk-add-redo') {
        const toRestore = patch.wells || [];
        const sorted = toRestore.slice().sort(function (a, b) {
            return a.idx - b.idx;
        });
        for (let i = 0; i < sorted.length; i++) {
            const entry = sorted[i];
            wells.splice(entry.idx, 0, structuredClone(entry.data));
        }
        if (typeof _excelRebuildWellIndex === 'function') _excelRebuildWellIndex();
        if (typeof _excelInvalidateFilteredIndexes === 'function')
            _excelInvalidateFilteredIndexes();
        _excelUndoStack.push({
            type: 'bulk-add',
            ids: sorted.map(function (e) {
                return e.data.id;
            }),
            batchId: patch.batchId
        });
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
