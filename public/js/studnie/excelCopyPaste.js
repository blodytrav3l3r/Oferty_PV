// @ts-check
/* ===== EXCEL COPY / PASTE (Excel-like) ===== */

function _excelGetPasteColIdx(row) {
    if (!row) return 2;
    let active = document.activeElement;
    if (active && row.contains(active)) {
        let td = active.closest('td');
        if (td) {
            let ci = Array.from(row.children).indexOf(td);
            if (ci >= 2) return ci;
        }
    }
    return 2; /* fallback: pierwsza kolumna po Lp+NrStudni */
}
function _excelHandleCopy(e) {
    /* Tylko gdy Excel otwarty */
    if (!document.getElementById('excel-table-overlay')) return;
    if (_excelSelectedCells.length === 0 && _excelSelectedCols.length === 0) return;
    e.preventDefault();
    let rows = document.querySelectorAll('#excel-table-container tbody tr[data-widx]');
    if (rows.length === 0) return;
    let text = '';
    if (_excelSelectedCells.length > 0) {
        let cellMap = {};
        let minR = Infinity,
            maxR = -Infinity,
            minC = Infinity,
            maxC = -Infinity;
        _excelSelectedCells.forEach(function (cell) {
            if (!cellMap[cell.wIdx]) cellMap[cell.wIdx] = {};
            cellMap[cell.wIdx][cell.colIdx] = true;
            if (cell.wIdx < minR) minR = cell.wIdx;
            if (cell.wIdx > maxR) maxR = cell.wIdx;
            if (cell.colIdx < minC) minC = cell.colIdx;
            if (cell.colIdx > maxC) maxC = cell.colIdx;
        });
        for (let r = minR; r <= maxR; r++) {
            let line = [];
            for (let c = minC; c <= maxC; c++) {
                let val = '';
                if (cellMap[r] && cellMap[r][c]) {
                    let row = rows[r];
                    if (row) {
                        let td = row.children[c];
                        let target = td ? td.querySelector('input, select') : null;
                        if (target) {
                            let _sel = /** @type {HTMLSelectElement} */ (target);
                            val =
                                _sel.tagName === 'SELECT'
                                    ? _sel.options[_sel.selectedIndex]
                                        ? _sel.options[_sel.selectedIndex].text
                                        : ''
                                    : /** @type {HTMLInputElement} */ (target).value || '';
                        }
                    }
                }
                line.push(val);
            }
            text += line.join('\t') + '\n';
        }
    } else if (_excelSelectedCols.length > 0) {
        let cols = [..._excelSelectedCols].sort(function (a, b) {
            return a - b;
        });
        rows.forEach(function (row) {
            let line = [];
            cols.forEach(function (colIdx) {
                let td = row.children[colIdx];
                let target = td ? td.querySelector('input, select') : null;
                line.push(
                    target
                        ? (function (t) {
                              let _s = /** @type {HTMLSelectElement} */ (t);
                              return _s.tagName === 'SELECT'
                                  ? _s.options[_s.selectedIndex]
                                      ? _s.options[_s.selectedIndex].text
                                      : ''
                                  : /** @type {HTMLInputElement} */ (t).value || '';
                          })(target)
                        : ''
                );
            });
            text += line.join('\t') + '\n';
        });
    }
    if (text) {
        if (e.clipboardData) {
            e.clipboardData.setData('text/plain', text);
        } else if (window.clipboardData) {
            window.clipboardData.setData('text', text);
        }
    }
}

function _excelHandlePaste(e) {
    /* Tylko gdy Excel otwarty */
    if (!document.getElementById('excel-table-overlay')) return;
    let cb = e.clipboardData || window.clipboardData;
    if (!cb) return;
    let text = cb.getData('text');
    if (!text || !text.trim()) return;
    /* Zawsze przejmij event gdy jesteśmy w kontenerze (capture phase) */
    e.preventDefault();
    e.stopPropagation();

    /* Paste w pusty wiersz → utwórz nowe studnie */
    let _emptyInput = document.getElementById('excel-empty-name');
    if (_emptyInput && _emptyInput === document.activeElement) {
        _excelPasteCreateWells(text);
        return;
    }

    let rows = document.querySelectorAll('#excel-table-container tbody tr[data-widx]');
    if (rows.length === 0) return;
    let lines = text.trim().split('\n');
    for (let _pi = 0; _pi < lines.length; _pi++) {
        lines[_pi] = lines[_pi].replace(/\r$/, '');
    }
    if (_excelSelectedCells.length > 0) {
        let cellList = [..._excelSelectedCells].sort(function (a, b) {
            return a.wIdx - b.wIdx || a.colIdx - b.colIdx;
        });
        let cellRows = {};
        cellList.forEach(function (c) {
            if (!cellRows[c.wIdx]) cellRows[c.wIdx] = [];
            cellRows[c.wIdx].push(c.colIdx);
        });
        let widxArr = Object.keys(cellRows)
            .map(Number)
            .sort(function (a, b) {
                return a - b;
            });
        let _baseWIdx = widxArr.length > 0 ? widxArr[0] : 0;
        let _baseCols =
            widxArr.length > 0 && cellRows[_baseWIdx]
                ? cellRows[_baseWIdx]
                : [_excelGetPasteColIdx(rows[0])];
        /* Przy cell-selection NIE dodawaj nowych wierszy — obetnij do dostępnej liczby */
        let availableRows = rows.length - _baseWIdx;
        if (lines.length > availableRows) {
            lines = lines.slice(0, availableRows);
            if (lines.length === 0) {
                showToast('Kliknij w istniejący wiersz — tu nie ma miejsca', 'warning');
                return;
            }
            showToast('Wklejono ' + lines.length + ' (obcięte — koniec tabeli)', 'warning');
        }
        let _firstCol = _baseCols.length > 0 ? _baseCols[0] : 0;
        /* Użyj batch/sync paste — obsłuż duże zestawy */
        let _pasteFn = lines.length > 100 ? _excelPasteBatch : _excelPasteSync;
        _pasteFn(lines, _baseWIdx, _firstCol, null);
    } else if (_excelSelectedCols.length > 0) {
        let cols = [..._excelSelectedCols].sort(function (a, b) {
            return a - b;
        });
        /* Przy column-selection NIE dodawaj nowych wierszy — obetnij */
        if (lines.length > rows.length) {
            lines = lines.slice(0, rows.length);
            showToast('Wklejono ' + lines.length + ' (obcięte — koniec tabeli)', 'warning');
        }
        lines.forEach(function (line, i) {
            let parts = line.split('	');
            cols.forEach(function (colIdx, ci) {
                if (ci >= parts.length) return;
                let tdInner = rows[i] ? rows[i].children[colIdx] : null;
                let target = tdInner ? tdInner.querySelector('input, select') : null;
                if (!target) return;
                _excelSetCellValue(target, parts[ci].trim());
            });
        });
    } else {
        /* Wykryj startowy wiersz z aktywnego elementu w tabeli */
        let startWIdx = -1; // -1 = nie wykryto aktywnego wiersza
        let _ae = document.activeElement;
        if (_ae) {
            let _tr = _ae.closest('tr[data-widx]');
            if (_tr) startWIdx = parseInt(_tr.getAttribute('data-widx') || '0') || 0;
        }
        if (startWIdx < 0) {
            /* brak fokusu w konkretnym wierszu — szukaj input/select wewnatrz kontenera jako fallback */
            let focusedInput = document.querySelector(
                '#excel-table-container input:focus, #excel-table-container select:focus, #excel-table-container .excel-sel-wrap:focus-within'
            );
            if (focusedInput) {
                let _ftr = focusedInput.closest('tr[data-widx]');
                if (_ftr) startWIdx = parseInt(_ftr.getAttribute('data-widx') || '0') || 0;
            }
        }
        if (startWIdx < 0) {
            /* nadal brak — paste do wszystkich istniejących wierszy od 0 */
            startWIdx = 0;
        }
        let colIdx = _excelGetPasteColIdx(
            document.querySelector('tr[data-widx="' + startWIdx + '"]') || rows[0]
        );
        /* Wkleja tylko w istniejące — obcina nadmiar (bez auto-add nowych pustych wierszy) */
        let availableRows = rows.length - startWIdx;
        if (lines.length > availableRows) {
            lines = lines.slice(0, availableRows);
            if (lines.length === 0) {
                showToast('Kliknij w istniejący wiersz — tu nie ma miejsca', 'warning');
                return;
            }
            showToast('Wklejono ' + lines.length + ' (obcięte — koniec tabeli)', 'warning');
        }
        /* Użyj batch/sync paste — obsłuż duże zestawy */
        (lines.length > 100 ? _excelPasteBatch : _excelPasteSync)(lines, startWIdx, colIdx, null);
    }
    showToast('Wklejono', 'info');
}

/* ===== BATCH PASTE (async chunked) ===== */
function _excelShowPasteProgress(now, total) {
    let pct = Math.min(100, Math.round((now / total) * 100));
    let el = document.getElementById('excel-paste-progress');
    if (!el) {
        el = document.createElement('div');
        el.id = 'excel-paste-progress';
        el.style.cssText =
            'position:fixed;bottom:1rem;right:1rem;z-index:' +
            LAYERS.TOAST +
            ';background:#1a1d27;border:1px solid rgba(255,255,255,0.1);border-radius:6px;padding:0.75rem 1rem;min-width:260px;box-shadow:0 4px 20px rgba(0,0,0,0.4);';
        el.innerHTML =
            '<div style="font-size:0.65rem;color:#94a3b8;margin-bottom:0.35rem;">Wklejanie... <span id="excel-paste-pct">0%</span></div>' +
            '<div style="height:4px;background:#0c0e14;border-radius:2px;overflow:hidden;">' +
            '<div id="excel-paste-bar" style="height:100%;width:0%;background:linear-gradient(90deg,#6366f1,#22c55e);transition:width 0.15s;"></div></div>';
        document.body.appendChild(el);
    }
    let bar = document.getElementById('excel-paste-bar');
    let pctEl = document.getElementById('excel-paste-pct');
    if (bar) bar.style.width = pct + '%';
    if (pctEl) pctEl.textContent = pct + '%';
}

function _excelHidePasteProgress() {
    let el = document.getElementById('excel-paste-progress');
    if (el) el.remove();
}

/**
 * Wkleja dane wsadowo w chunkach przez requestAnimationFrame.
 * Nie blokuje UI.
 */
function _excelPasteBatch(lines, startWIdx, startColIdx, doneCallback) {
    let CHUNK = 50;
    let idx = 0;
    let total = lines.length;
    if (total < 100) {
        _excelPasteSync(lines, startWIdx, startColIdx);
        if (doneCallback) doneCallback();
        return;
    }
    _excelShowPasteProgress(0, total);
    function tick() {
        let end = Math.min(idx + CHUNK, total);
        for (; idx < end; idx++) {
            if (_excelPasteCancelFlag) {
                _excelHidePasteProgress();
                _excelPasteCancelFlag = false;
                showToast('Wklejanie przerwane', 'warning');
                return;
            }
            let line = lines[idx];
            let parts = line.split('	');
            let wIdx = startWIdx + idx;
            parts.forEach(function (v, ci) {
                let colIdx = startColIdx + ci;
                let row = document.querySelector('tr[data-widx="' + wIdx + '"]');
                if (!row) return;
                let tdEl = row.children[colIdx];
                let target = tdEl ? tdEl.querySelector('input, select') : null;
                if (target) _excelSetCellValue(target, v.trim());
            });
        }
        _excelShowPasteProgress(idx, total);
        if (idx < total) {
            requestAnimationFrame(tick);
        } else {
            _excelHidePasteProgress();
            if (doneCallback) doneCallback();
        }
    }
    requestAnimationFrame(tick);
}

/** Synchroniczne wklejenie (do 99 wierszy) */
function _excelPasteSync(lines, startWIdx, startColIdx) {
    for (let si = 0; si < lines.length; si++) {
        let parts = lines[si].split('	');
        let wIdx = startWIdx + si;
        parts.forEach(function (v, ci) {
            let colIdx = startColIdx + ci;
            let row = document.querySelector('tr[data-widx="' + wIdx + '"]');
            if (!row) return;
            let tdEl = row.children[colIdx];
            let target = tdEl ? tdEl.querySelector('input, select') : null;
            if (target) _excelSetCellValue(target, v.trim());
        });
    }
}

/**
 * Ustawia wartość komórki (input lub select) i dispatchuje eventy.
 * @param {Element} target
 * @param {string} val
 */
function _excelSetCellValue(target, val) {
    if (target.tagName === 'SELECT') {
        let _sel = /** @type {HTMLSelectElement} */ (target);
        let opt = Array.from(_sel.options).find(function (o) {
            return o.value === val || o.text === val;
        });
        if (opt) {
            _sel.value = opt.value;
            _sel.dispatchEvent(new Event('change', { bubbles: true }));
        }
    } else if (target.tagName === 'INPUT') {
        /* Normalizuj separator dziesietny — MS Excel z PL wysyla przecinek, input type=number wymaga kropki */
        let normalizedVal = val;
        let inputType = /** @type {HTMLInputElement} */ (target).type;
        if (
            inputType === 'number' &&
            typeof normalizedVal === 'string' &&
            normalizedVal.indexOf(',') >= 0 &&
            normalizedVal.indexOf('.') < 0
        ) {
            normalizedVal = normalizedVal.replace(',', '.');
        }
        /** @type {HTMLInputElement} */ (target).value = normalizedVal;
        target.dispatchEvent(new Event('input', { bubbles: true }));
        target.dispatchEvent(new Event('change', { bubbles: true }));
    }
}
