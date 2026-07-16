// @ts-check
/* ===== EXCEL CELL SELECTION — Mouse/cell selection (Excel-like) ===== */

/* ===== CELL SELECTION (Excel-like) ===== */
function _excelToggleCellClass(wIdx, colIdx, add) {
    const container = document.getElementById('excel-table-container');
    if (!container) return;
    const td = container.querySelector(
        'tr[data-widx="' + wIdx + '"] td:nth-child(' + (colIdx + 1) + ')'
    );
    if (!td) return;
    if (add) td.classList.add('cell-selected');
    else td.classList.remove('cell-selected');
}

function _excelDeselectAllCells() {
    if (_excelSelectedCells.length === 0) return;
    const copy = [..._excelSelectedCells];
    _excelSelectedCells = [];
    copy.forEach(function (cell) {
        _excelToggleCellClass(cell.wIdx, cell.colIdx, false);
    });
}

function _excelSelectCell(wIdx, colIdx, ctrl, shift) {
    if (shift && _excelLastClickedCell) {
        _excelDeselectAllCells();
        var minR = Math.min(_excelLastClickedCell.wIdx, wIdx);
        var maxR = Math.max(_excelLastClickedCell.wIdx, wIdx);
        var minC = Math.min(_excelLastClickedCell.colIdx, colIdx);
        var maxC = Math.max(_excelLastClickedCell.colIdx, colIdx);
        for (var r = minR; r <= maxR; r++) {
            for (var c = minC; c <= maxC; c++) {
                _excelSelectedCells.push({ wIdx: r, colIdx: c });
                _excelToggleCellClass(r, c, true);
            }
        }
    } else if (ctrl) {
        var idx = _excelSelectedCells.findIndex(function (cell) {
            return cell.wIdx === wIdx && cell.colIdx === colIdx;
        });
        if (idx >= 0) {
            _excelSelectedCells.splice(idx, 1);
            _excelToggleCellClass(wIdx, colIdx, false);
        } else {
            _excelSelectedCells.push({ wIdx: wIdx, colIdx: colIdx });
            _excelToggleCellClass(wIdx, colIdx, true);
        }
    } else {
        _excelDeselectAllCells();
        _excelSelectedCells.push({ wIdx: wIdx, colIdx: colIdx });
        _excelToggleCellClass(wIdx, colIdx, true);
    }
    _excelLastClickedCell = { wIdx: wIdx, colIdx: colIdx };
}

/* ===== MOUSE DRAG SELECTION (Excel-like) ===== */
function _excelOnMouseDown(e) {
    if (e.button !== 0) return; // tylko lewy przycisk
    var td = e.target.closest('td');
    if (!td) return;
    var tr = td.closest('tr[data-widx]');
    if (!tr || !tr.children) return;
    var wIdx = parseInt(tr.getAttribute('data-widx'), 10);
    var colIdx = Array.prototype.indexOf.call(tr.children, td);
    if (isNaN(wIdx) || colIdx < 0) return;

    _excelDragState = {
        anchor: { wIdx: wIdx, colIdx: colIdx },
        mode: e.ctrlKey || e.metaKey ? 'add' : 'new',
        end: { wIdx: wIdx, colIdx: colIdx },
        active: true,
        thresholdMet: false,
        additiveFromShift: false
    };

    /* Zaznacz anchor natychmiast (action-only-on-mousedown dla czystego drag) */
    if (!e.ctrlKey && !e.shiftKey) {
        _excelDeselectAllCells();
        _excelSelectCell(wIdx, colIdx, false, false);
    } else if (e.shiftKey && _excelLastClickedCell) {
        _excelDeselectAllCells();
        for (
            var r = Math.min(_excelLastClickedCell.wIdx, wIdx);
            r <= Math.max(_excelLastClickedCell.wIdx, wIdx);
            r++
        ) {
            for (
                var c = Math.min(_excelLastClickedCell.colIdx, colIdx);
                c <= Math.max(_excelLastClickedCell.colIdx, colIdx);
                c++
            ) {
                _excelSelectCell(r, c, false, false);
            }
        }
    }
    /* Dla ctrl: nic nie rob (toggle bedzie przy mouseup) */
}

function _excelOnMouseMove(e) {
    if (!_excelDragState || !_excelDragState.active) return;
    /* nie aktualizuj jeszcze dragu, czekaj na dragstart */
    var td = e.target.closest('td');
    if (!td) return;
    var tr = td.closest('tr[data-widx]');
    if (!tr || !tr.children) return;
    var wIdx = parseInt(tr.getAttribute('data-widx'), 10);
    var colIdx = Array.prototype.indexOf.call(tr.children, td);
    if (isNaN(wIdx) || colIdx < 0) return;
    if (wIdx === _excelDragState.end.wIdx && colIdx === _excelDragState.end.colIdx) return;

    _excelDragState.end = { wIdx: wIdx, colIdx: colIdx };
    /* Live preview */
    if (_excelDragThrottle) return;
    _excelDragThrottle = true;
    requestAnimationFrame(function () {
        _excelDragThrottle = false;
        if (!_excelDragState) return;
        _excelClearDragPreview();
        var s = _excelDragState.anchor;
        var e2 = _excelDragState.end;
        var rMin = Math.min(s.wIdx, e2.wIdx);
        var rMax = Math.max(s.wIdx, e2.wIdx);
        var cMin = Math.min(s.colIdx, e2.colIdx);
        var cMax = Math.max(s.colIdx, e2.colIdx);
        for (var r = rMin; r <= rMax; r++) {
            for (var c = cMin; c <= cMax; c++) {
                var row = document.querySelector('tr[data-widx="' + r + '"]');
                if (!row || !row.children[c]) continue;
                /* Nie nadpisuj juz-faktycznie-zaznaczonych komorek, tylko preview */
                if (_excelDragState.mode === 'new') {
                    row.children[c].classList.add('drag-preview');
                }
            }
        }
    });
}

function _excelOnMouseUp() {
    if (!_excelDragState) return;
    if (_excelDragThrottle) {
        _excelDragThrottle = false;
    }
    var s = _excelDragState.anchor;
    var en = _excelDragState.end;
    var mode = _excelDragState.mode;
    var minR = Math.min(s.wIdx, en.wIdx);
    var maxR = Math.max(s.wIdx, en.wIdx);
    var minC = Math.min(s.colIdx, en.colIdx);
    var maxC = Math.max(s.colIdx, en.colIdx);

    /* Real selection commmit */
    if (maxR - minR > 0 || maxC - minC > 0) {
        /* rzeczywiscie drag (nie klik) */
        if (mode === 'new') {
            _excelDeselectAllCells();
            _excelSelectRange(s.wIdx, s.colIdx, en.wIdx, en.colIdx, false);
        } else {
            /* 'add' mode: dodaj zakres do istniejacej selekcji */
            _excelSelectRange(s.wIdx, s.colIdx, en.wIdx, en.colIdx, true);
        }
    } else if (mode === 'new') {
        /* Sam anchor replacement: pojedyncze klikniecie = zaznacz komorke */
        _excelDeselectAllCells();
        _excelSelectCell(s.wIdx, s.colIdx, false, false);
    }
    _excelClearDragPreview();
    _excelDragState = null;
}

/* ===== FOCUS OVERLAY ===== */
function _excelPositionFocusOverlay(td) {
    if (!_excelFocusOverlayEl) return;
    if (!td || !document.body.contains(td)) {
        _excelFocusOverlayEl.style.display = 'none';
        return;
    }
    var r = td.getBoundingClientRect();
    if (r.width === 0 || r.height === 0) {
        _excelFocusOverlayEl.style.display = 'none';
        return;
    }
    _excelFocusOverlayEl.style.display = 'block';
    _excelFocusOverlayEl.style.top = r.top - 2 + 'px';
    _excelFocusOverlayEl.style.left = r.left - 2 + 'px';
    _excelFocusOverlayEl.style.width = r.width + 4 + 'px';
    _excelFocusOverlayEl.style.height = r.height + 4 + 'px';
}

function _excelOnFocusIn(e) {
    if (!_excelFocusOverlayEl) return;
    var target = e.target;
    if (!target) return;
    var td = target.closest('td');
    if (!td) return;
    if (_excelFocusRaf) cancelAnimationFrame(_excelFocusRaf);
    _excelFocusRaf = requestAnimationFrame(function () {
        _excelFocusRaf = null;
        _excelPositionFocusOverlay(td);
    });
}

function _excelSelWrapFocus(selWrap) {
    if (!_excelFocusOverlayEl) return;
    var td = selWrap.closest('td');
    if (!td) return;
    if (_excelFocusRaf) cancelAnimationFrame(_excelFocusRaf);
    _excelFocusRaf = requestAnimationFrame(function () {
        _excelFocusRaf = null;
        _excelPositionFocusOverlay(td);
    });
}

function _excelOnFocusOut(e) {
    if (!_excelFocusOverlayEl) return;
    setTimeout(function () {
        var ae = document.activeElement;
        var stillInContainer =
            ae &&
            document.getElementById('excel-table-container') &&
            document.getElementById('excel-table-container').contains(ae);
        if (!stillInContainer) {
            if (_excelFocusOverlayEl) _excelFocusOverlayEl.style.display = 'none';
        }
    }, 30);
}

function _excelOnOverlayScroll() {
    if (!_excelFocusOverlayEl) return;
    if (_excelFocusOverlayEl.style.display === 'none') return;
    if (_excelFocusRaf) return;
    _excelFocusRaf = requestAnimationFrame(function () {
        _excelFocusRaf = null;
        var ae = document.activeElement;
        if (!ae) return;
        var td = ae.closest('td');
        if (!td) return;
        _excelPositionFocusOverlay(td);
    });
}

/* ===== DRAG SELECTION ===== */
function _excelClearDragPreview() {
    document.querySelectorAll('#excel-table-container td.drag-preview').forEach(function (td) {
        td.classList.remove('drag-preview');
    });
}

function _excelSelectedCount() {
    return _excelSelectedCells.length;
}

/* ===== SELECT ALL ===== */
function _excelSelectAllCells() {
    _excelDeselectAllCells();
    _excelDeselectAllCols();
    var rows = document.querySelectorAll('#excel-table-container tbody tr[data-widx]');
    for (var r = 0; r < rows.length; r++) {
        var tds = rows[r].querySelectorAll('td');
        for (var c = 0; c < tds.length; c++) {
            var td = tds[c];
            if (td.querySelector('input,select')) {
                _excelSelectCell(r, c, false, false);
            }
        }
    }
}

function _excelSelectRange(startW, startC, endW, endC, additive) {
    if (!additive) _excelDeselectAllCells();
    var rMin = Math.min(startW, endW);
    var rMax = Math.max(startW, endW);
    var cMin = Math.min(startC, endC);
    var cMax = Math.max(startC, endC);
    for (var r = rMin; r <= rMax; r++) {
        for (var c = cMin; c <= cMax; c++) {
            var row = document.querySelector('tr[data-widx="' + r + '"]');
            if (!row || !row.children[c]) continue;
            var existing = _excelSelectedCells.find(function (cl) {
                return cl.wIdx === r && cl.colIdx === c;
            });
            if (!existing) _excelSelectCell(r, c, false, false);
        }
    }
}
