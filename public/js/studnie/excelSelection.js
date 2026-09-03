// @ts-check
/* ===== EXCEL SELECTION — Selekcja kolumn i wierszy (Excel-style) ===== */

/* ===== COLUMN SELECTION (Ctrl+Click / Shift+Click) ===== */
function _excelInitColumnSelect() {
    const container = document.getElementById('excel-table-container');
    if (!container) return;
    const table = container.querySelector('table');
    if (!table) return;

    const headers = table.querySelectorAll('thead tr:first-child th');
    headers.forEach((th, colIdx) => {
        th.addEventListener('mousedown', (/** @type {MouseEvent} */ e) => {
            if (e.target.closest('.excel-col-resize-handle')) return;
            if (e.target.closest('button')) return;
            if (!e.ctrlKey && !e.shiftKey) {
                _excelSelectCol(colIdx, false, false);
                e.preventDefault();
                return;
            }
            e.preventDefault();
            _excelSelectCol(colIdx, e.ctrlKey || e.metaKey, e.shiftKey);
        });
    });

    /* Prawy przycisk na dowolnym wierszu nagłówka (H1/H2/H3) → menu kontekstowe kolumny */
    const allHeaders = table.querySelectorAll('thead th');
    allHeaders.forEach((th) => {
        th.addEventListener('contextmenu', (/** @type {MouseEvent} */ e) => {
            if (e.target.closest('.excel-col-resize-handle')) return;
            if (e.target.closest('button')) return;
            if (e.target.closest('input')) return;
            if (typeof _excelOpenColContextMenu !== 'function') return;
            e.preventDefault();
            e.stopPropagation();
            _excelOpenColContextMenu(th, e.clientX, e.clientY);
        });
    });

    // Klik w wiersz/tbody odznacza kolumny
    table.addEventListener('mousedown', (/** @type {MouseEvent} */ e) => {
        if (e.target.closest('thead')) return;
        if (e.ctrlKey || e.shiftKey) return;
        if (_excelSelectedCols.length > 0) _excelDeselectAllCols();
    });
}

function _excelSelectCol(colIdx, ctrl, shift) {
    const container = document.getElementById('excel-table-container');
    if (!container) return;
    const table = container.querySelector('table');
    if (!table) return;

    if (!ctrl && !shift) {
        _excelDeselectAllCols();
    }

    if (shift && _excelLastClickedCol >= 0 && _excelLastClickedCol !== colIdx) {
        const start = Math.min(_excelLastClickedCol, colIdx);
        const end = Math.max(_excelLastClickedCol, colIdx);
        for (let i = start; i <= end; i++) {
            if (!_excelSelectedCols.includes(i)) {
                _excelSelectedCols.push(i);
                _excelToggleColClass(i, true);
            }
        }
    }

    if (ctrl) {
        const idx = _excelSelectedCols.indexOf(colIdx);
        if (idx >= 0) {
            _excelSelectedCols.splice(idx, 1);
            _excelToggleColClass(colIdx, false);
        } else {
            _excelSelectedCols.push(colIdx);
            _excelToggleColClass(colIdx, true);
        }
    } else if (!shift) {
        _excelSelectedCols = [colIdx];
        _excelToggleColClass(colIdx, true);
    }

    _excelLastClickedCol = colIdx;
    if (typeof _excelUpdateSelectionSummary === 'function') _excelUpdateSelectionSummary();
}

function _excelDeselectAllCols() {
    if (_excelSelectedCols.length === 0) return;
    const copy = [..._excelSelectedCols];
    _excelSelectedCols = [];
    _excelLastClickedCol = -1;
    copy.forEach((idx) => _excelToggleColClass(idx, false));
}

function _excelToggleColClass(colIdx, add) {
    const container = document.getElementById('excel-table-container');
    if (!container) return;
    const table = container.querySelector('table');
    if (!table) return;
    const rows = table.querySelectorAll('tr');
    rows.forEach((row) => {
        const cell = row.children[colIdx];
        if (cell) {
            if (add) cell.classList.add('excel-col-selected');
            else cell.classList.remove('excel-col-selected');
        }
    });
}

/* ===== ROW SELECTION ===== */
function _excelToggleSelectAll(checked) {
    _excelRowSelectStates = {};
    if (typeof wells !== 'undefined') {
        for (let i = 0; i < wells.length; i++) {
            if (typeof _excelIsWellLocked === 'function' && _excelIsWellLocked(i) && checked)
                continue;
            _excelRowSelectStates[i] = checked;
        }
    }
    const boxes = document.querySelectorAll('.excel-row-select');
    boxes.forEach(function (cb) {
        const idx = parseInt(cb.getAttribute('data-widx'), 10);
        if (
            !isNaN(idx) &&
            typeof _excelIsWellLocked === 'function' &&
            _excelIsWellLocked(idx) &&
            checked
        ) {
            cb.checked = false;
            return;
        }
        cb.checked = checked;
    });
    _excelLastClickedRow = null;
    if (typeof _excelSyncHeaderCheckbox === 'function') _excelSyncHeaderCheckbox();
    else {
        const hdrAll = document.getElementById('excel-select-all');
        if (hdrAll && hdrAll !== document.activeElement) hdrAll.checked = checked;
    }
}

/** Zbierz fokusowalne elementy nawigacji w wierszu: INPUT + DIV.excel-sel-wrap */
function _excelGetNavElements(row) {
    const els = [];
    const cells = row.querySelectorAll('td');
    for (let i = 0; i < cells.length; i++) {
        // Priorytet: wrapper selecta (DIV.excel-sel-wrap)
        const wrap = cells[i].querySelector('.excel-sel-wrap');
        if (wrap) {
            els.push(wrap);
            continue;
        }
        // INPUT — pomiń checkbox wyboru wiersza (excel-row-select); checkbox "Psia buda" bez klasy zostaje
        const inp = cells[i].querySelector('input:not(.excel-row-select)');
        if (inp) {
            els.push(inp);
            continue;
        }
        // Fallback: natywny select bez wrappera
        const sel = cells[i].querySelector('select');
        if (sel) {
            els.push(sel);
        }
    }
    return els;
}
