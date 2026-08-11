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
    _excelUpdateSelectionSummary();
}

function _excelSelectCell(wIdx, colIdx, ctrl, shift) {
    if (shift && _excelLastClickedCell) {
        _excelDeselectAllCells();
        const minR = Math.min(_excelLastClickedCell.wIdx, wIdx);
        const maxR = Math.max(_excelLastClickedCell.wIdx, wIdx);
        const minC = Math.min(_excelLastClickedCell.colIdx, colIdx);
        const maxC = Math.max(_excelLastClickedCell.colIdx, colIdx);
        for (let r = minR; r <= maxR; r++) {
            for (let c = minC; c <= maxC; c++) {
                _excelSelectedCells.push({ wIdx: r, colIdx: c });
                _excelToggleCellClass(r, c, true);
            }
        }
    } else if (ctrl) {
        const idx = _excelSelectedCells.findIndex(function (cell) {
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
    _excelUpdateSelectionSummary();
}

/* ===== SELECTION SUMMARY — suma zaznaczonych wartości (pasek w nagłówku) ===== */
/* Czysta suma wartości numerycznych (liczby z przecinkiem). Testowalna. */
function _excelSumNumericValues(values) {
    let sum = 0;
    let count = 0;
    values.forEach(function (v) {
        if (v === '' || v == null) return;
        const num = parseFloat(String(v).replace(',', '.'));
        if (!isNaN(num)) {
            sum += num;
            count++;
        }
    });
    return { sum: sum, count: count };
}

function _excelUpdateSelectionSummary() {
    const el = document.getElementById('excel-selection-summary');
    if (!el) return;
    const container = document.getElementById('excel-table-container');
    if (!container) return;
    const values = [];
    if (_excelSelectedCols.length > 0) {
        _excelGetVisibleRows().forEach(function (row) {
            _excelSelectedCols.forEach(function (ci) {
                const td = row.children[ci];
                const t = td ? td.querySelector('input, select') : null;
                values.push(t ? /** @type {HTMLInputElement} */ (t).value || '' : '');
            });
        });
    } else {
        _excelSelectedCells.forEach(function (cell) {
            const row = container.querySelector('tr[data-widx="' + cell.wIdx + '"]');
            if (!row) return;
            const td = row.children[cell.colIdx];
            const t = td ? td.querySelector('input, select') : null;
            values.push(t ? /** @type {HTMLInputElement} */ (t).value || '' : '');
        });
    }
    const res = _excelSumNumericValues(values);
    if (res.count > 0) {
        el.textContent = 'Σ ' + res.sum.toLocaleString('pl-PL');
        el.style.display = 'inline-block';
    } else {
        el.textContent = '';
        el.style.display = 'none';
    }
}

/* ===== MOUSE DRAG SELECTION (Excel-like) ===== */
function _excelOnMouseDown(e) {
    if (e.button !== 0) return; // tylko lewy przycisk
    const td = e.target.closest('td');
    if (!td) return;
    const tr = td.closest('tr[data-widx]');
    if (!tr || !tr.children) return;
    const wIdx = parseInt(tr.getAttribute('data-widx'), 10);
    const colIdx = Array.prototype.indexOf.call(tr.children, td);
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
        /* Shift+klik: zakres zaznaczy handler click (excelModal.js _excelOnClickCell)
           względem _excelLastClickedCell. Tu tylko zapamiętaj, że to był shift — inaczej
           mouseup kolaapsuje zaznaczenie do pojedynczej komórki (bug W2). */
        _excelDragState.additiveFromShift = true;
    }
    /* Dla ctrl: nic nie rob (toggle bedzie przy mouseup) */
}

function _excelOnMouseMove(e) {
    if (!_excelDragState || !_excelDragState.active) return;
    /* nie aktualizuj jeszcze dragu, czekaj na dragstart */
    const td = e.target.closest('td');
    if (!td) return;
    const tr = td.closest('tr[data-widx]');
    if (!tr || !tr.children) return;
    const wIdx = parseInt(tr.getAttribute('data-widx'), 10);
    const colIdx = Array.prototype.indexOf.call(tr.children, td);
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
        const s = _excelDragState.anchor;
        const e2 = _excelDragState.end;
        const rMin = Math.min(s.wIdx, e2.wIdx);
        const rMax = Math.max(s.wIdx, e2.wIdx);
        const cMin = Math.min(s.colIdx, e2.colIdx);
        const cMax = Math.max(s.colIdx, e2.colIdx);
        for (let r = rMin; r <= rMax; r++) {
            for (let c = cMin; c <= cMax; c++) {
                const row = document.querySelector('tr[data-widx="' + r + '"]');
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
    const s = _excelDragState.anchor;
    const en = _excelDragState.end;
    const mode = _excelDragState.mode;
    const minR = Math.min(s.wIdx, en.wIdx);
    const maxR = Math.max(s.wIdx, en.wIdx);
    const minC = Math.min(s.colIdx, en.colIdx);
    const maxC = Math.max(s.colIdx, en.colIdx);

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
    } else if (mode === 'new' && !_excelDragState.additiveFromShift) {
        /* Sam anchor replacement: pojedyncze klikniecie = zaznacz komorke.
           Shift+klik obsługuje handler click (zakres od _excelLastClickedCell). */
        _excelDeselectAllCells();
        _excelSelectCell(s.wIdx, s.colIdx, false, false);
    }
    _excelClearDragPreview();
    _excelDragState = null;
    _excelUpdateSelectionSummary();
}

/* ===== FOCUS OVERLAY ===== */
function _excelPositionFocusOverlay(td) {
    if (!_excelFocusOverlayEl) return;
    if (!td || !document.body.contains(td)) {
        _excelFocusOverlayEl.style.display = 'none';
        return;
    }
    const r = td.getBoundingClientRect();
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
    const target = e.target;
    if (!target) return;
    const td = target.closest('td');
    if (!td) return;
    if (_excelFocusRaf) cancelAnimationFrame(_excelFocusRaf);
    _excelFocusRaf = requestAnimationFrame(function () {
        _excelFocusRaf = null;
        _excelPositionFocusOverlay(td);
    });
}

function _excelSelWrapFocus(selWrap) {
    if (!_excelFocusOverlayEl) return;
    const td = selWrap.closest('td');
    if (!td) return;
    if (_excelFocusRaf) cancelAnimationFrame(_excelFocusRaf);
    _excelFocusRaf = requestAnimationFrame(function () {
        _excelFocusRaf = null;
        _excelPositionFocusOverlay(td);
    });
}

function _excelOnFocusOut(_e) {
    if (!_excelFocusOverlayEl) return;
    setTimeout(function () {
        const ae = document.activeElement;
        const stillInContainer =
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
        const ae = document.activeElement;
        if (!ae) return;
        const td = ae.closest('td');
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

function _excelSelectRange(startW, startC, endW, endC, additive) {
    if (!additive) _excelDeselectAllCells();
    const rMin = Math.min(startW, endW);
    const rMax = Math.max(startW, endW);
    const cMin = Math.min(startC, endC);
    const cMax = Math.max(startC, endC);
    for (let r = rMin; r <= rMax; r++) {
        for (let c = cMin; c <= cMax; c++) {
            const row = document.querySelector('tr[data-widx="' + r + '"]');
            if (!row || !row.children[c]) continue;
            const existing = _excelSelectedCells.find(function (cl) {
                return cl.wIdx === r && cl.colIdx === c;
            });
            if (!existing) _excelSelectCell(r, c, false, false);
        }
    }
}
