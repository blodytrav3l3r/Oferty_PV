// @ts-check
/* ===== EXCEL CLIPBOARD — Cofnij/powtórz i skróty klawiszowe ===== */

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
    wells.splice(0, wells.length, ...snap);
    _excelRenderTable(_excelActiveTab);
    showToast('Cofnięto', 'info');
}

function _excelRedo() {
    if (_excelRedoStack.length === 0) return;
    _excelUndoStack.push(JSON.parse(JSON.stringify(wells)));
    const snap = _excelRedoStack.pop();
    wells.splice(0, wells.length, ...snap);
    _excelRenderTable(_excelActiveTab);
    showToast('Przywrócono', 'info');
}

function _excelHandleKeydown(e) {
    /* Tylko gdy kontener Excela jest otwarty */
    const overlay = document.getElementById('excel-table-overlay');
    if (!overlay) return;

    const isCtrl = e.ctrlKey || e.metaKey;

    /* Ctrl+Z = undo */
    if (isCtrl && !e.shiftKey && e.key === 'z') {
        e.preventDefault();
        _excelUndo();
        return;
    }
    /* Ctrl+Y / Ctrl+Shift+Z = redo */
    if (
        (isCtrl && !e.shiftKey && e.key === 'y') ||
        (isCtrl && e.shiftKey && (e.key === 'z' || e.key === 'Z'))
    ) {
        e.preventDefault();
        _excelRedo();
        return;
    }

    /* Delete = wyczyść zaznaczone komórki */
    if (e.key === 'Delete' || e.key === 'Backspace') {
        if (e.target.tagName === 'INPUT' || e.target.tagName === 'SELECT')
            return; /* edycja w komórce */
        if (_excelSelectedCells.length === 0) return;
        e.preventDefault();
        _excelSaveUndoSnapshot();
        var rows = document.querySelectorAll('#excel-table-container tbody tr[data-widx]');
        _excelSelectedCells.forEach(function (cell) {
            const row = document.querySelector('tr[data-widx="' + cell.wIdx + '"]');
            if (!row) return;
            const inputs = row.querySelectorAll('input, select');
            const target = inputs[cell.colIdx];
            if (!target) return;
            if (target.tagName === 'SELECT') {
                /** @type {HTMLSelectElement} */ (target).value = '';
                target.dispatchEvent(new Event('change', { bubbles: true }));
            } else if (target.tagName === 'INPUT') {
                /** @type {HTMLInputElement} */ (target).value = '';
                target.dispatchEvent(new Event('input', { bubbles: true }));
                target.dispatchEvent(new Event('change', { bubbles: true }));
            }
        });
        showToast('Wyczyszczono ' + _excelSelectedCells.length + ' komórek', 'info');
        return;
    }

    /* Ctrl+A = zaznacz wszystko */
    if (isCtrl && (e.key === 'a' || e.key === 'A')) {
        e.preventDefault();
        const allRows = document.querySelectorAll('#excel-table-container tbody tr[data-widx]');
        _excelDeselectAllCells();
        allRows.forEach(function (row, rIdx) {
            const tds = row.querySelectorAll('td');
            tds.forEach(function (td, cIdx) {
                if (cIdx < 2) return; /* pomiń Lp + Nr Studni */
                _excelSelectedCells.push({ wIdx: rIdx, colIdx: cIdx });
                td.classList.add('cell-selected');
            });
        });
        _excelLastClickedCell = null;
        showToast('Zaznaczono wszystkie komórki', 'info');
        return;
    }

    /* Ctrl+X = wytnij */
    if (isCtrl && (e.key === 'x' || e.key === 'X')) {
        if (_excelSelectedCells.length === 0) return;
        e.preventDefault();
        /* Uzyj oryginalnego eventu — clipboardData istnieje w keydown */
        _excelHandleCopy(/** @type {any} */ (e));
        /* Potem wyczyść */
        _excelSaveUndoSnapshot();
        var rows = document.querySelectorAll('#excel-table-container tbody tr[data-widx]');
        _excelSelectedCells.forEach(function (cell) {
            const row = document.querySelector('tr[data-widx="' + cell.wIdx + '"]');
            if (!row) return;
            const inputs = row.querySelectorAll('input, select');
            const target = inputs[cell.colIdx];
            if (!target) return;
            if (target.tagName === 'SELECT') {
                /** @type {HTMLSelectElement} */ (target).value = '';
                target.dispatchEvent(new Event('change', { bubbles: true }));
            } else if (target.tagName === 'INPUT') {
                /** @type {HTMLInputElement} */ (target).value = '';
                target.dispatchEvent(new Event('input', { bubbles: true }));
                target.dispatchEvent(new Event('change', { bubbles: true }));
            }
        });
        showToast('Wycinanie: ' + _excelSelectedCells.length + ' komórek', 'info');
        return;
    }

    /* Ctrl+D = kopiuj w dół */
    if (isCtrl && (e.key === 'd' || e.key === 'D')) {
        if (_excelSelectedCells.length === 0) return;
        e.preventDefault();
        _excelSaveUndoSnapshot();
        var rows = document.querySelectorAll('#excel-table-container tbody tr[data-widx]');
        _excelSelectedCells.forEach(function (cell) {
            if (cell.wIdx === 0) return;
            const srcRow = document.querySelector('tr[data-widx="' + (cell.wIdx - 1) + '"]');
            const dstRow = document.querySelector('tr[data-widx="' + cell.wIdx + '"]');
            if (!srcRow || !dstRow) return;
            const tdDst = dstRow.children[cell.colIdx];
            const tdSrc = srcRow.children[cell.colIdx];
            const target = tdDst ? tdDst.querySelector('input, select') : null;
            const src = tdSrc ? tdSrc.querySelector('input, select') : null;
            if (!target || !src) return;
            if (target.tagName === 'SELECT') {
                /** @type {HTMLSelectElement} */ (target).value = /** @type {HTMLSelectElement} */ (
                    src
                ).value;
                target.dispatchEvent(new Event('change', { bubbles: true }));
            } else if (target.tagName === 'INPUT') {
                /** @type {HTMLInputElement} */ (target).value = /** @type {HTMLInputElement} */ (
                    src
                ).value;
                target.dispatchEvent(new Event('input', { bubbles: true }));
                target.dispatchEvent(new Event('change', { bubbles: true }));
            }
        });
        showToast('Skopiowano w dół', 'info');
        return;
    }

    /* Ctrl+R = kopiuj w prawo */
    if (isCtrl && (e.key === 'r' || e.key === 'R')) {
        if (_excelSelectedCells.length === 0) return;
        e.preventDefault();
        _excelSaveUndoSnapshot();
        var rows = document.querySelectorAll('#excel-table-container tbody tr[data-widx]');
        _excelSelectedCells.forEach(function (cell) {
            if (cell.colIdx <= 1) return;
            const row = document.querySelector('tr[data-widx="' + cell.wIdx + '"]');
            if (!row) return;
            const tdR = row.children[cell.colIdx];
            const tdRSrc = row.children[cell.colIdx - 1];
            const target = tdR ? tdR.querySelector('input, select') : null;
            const src = tdRSrc ? tdRSrc.querySelector('input, select') : null;
            if (!target || !src) return;
            if (target.tagName === 'SELECT') {
                /** @type {HTMLSelectElement} */ (target).value = /** @type {HTMLSelectElement} */ (
                    src
                ).value;
                target.dispatchEvent(new Event('change', { bubbles: true }));
            } else if (target.tagName === 'INPUT') {
                /** @type {HTMLInputElement} */ (target).value = /** @type {HTMLInputElement} */ (
                    src
                ).value;
                target.dispatchEvent(new Event('input', { bubbles: true }));
                target.dispatchEvent(new Event('change', { bubbles: true }));
            }
        });
        showToast('Skopiowano w prawo', 'info');
        return;
    }
}
