// @ts-check
/* ===== EXCEL CLIPBOARD — Rdzeń kopiuj/wklej i undo/redo ===== */

function _excelHandleCopy(e) {
    /* Tylko gdy Excel otwarty */
    if (!document.getElementById('excel-table-overlay')) return;
    if (_excelSelectedCells.length === 0 && _excelSelectedCols.length === 0) return;
    e.preventDefault();
    const rows = document.querySelectorAll('#excel-table-container tbody tr[data-widx]');
    if (rows.length === 0) return;
    let text = '';
    if (_excelSelectedCells.length > 0) {
        const cellMap = {};
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
            const line = [];
            for (let c = minC; c <= maxC; c++) {
                let val = '';
                if (cellMap[r] && cellMap[r][c]) {
                    const row = rows[r];
                    if (row) {
                        const td = row.children[c];
                        const target = td ? td.querySelector('input, select') : null;
                        if (target) {
                            const _sel = /** @type {HTMLSelectElement} */ (target);
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
        const cols = [..._excelSelectedCols].sort(function (a, b) {
            return a - b;
        });
        rows.forEach(function (row) {
            const line = [];
            cols.forEach(function (colIdx) {
                const td = row.children[colIdx];
                const target = td ? td.querySelector('input, select') : null;
                line.push(
                    target
                        ? (function (t) {
                              const _s = /** @type {HTMLSelectElement} */ (t);
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
    const cb = e.clipboardData || window.clipboardData;
    if (!cb) return;
    const text = cb.getData('text');
    if (!text || !text.trim()) return;
    /* Zawsze przejmij event gdy jesteśmy w kontenerze (capture phase) */
    e.preventDefault();
    e.stopPropagation();

    /* Paste w pusty wiersz → utwórz nowe studnie */
    const _emptyInput = document.getElementById('excel-empty-name');
    if (_emptyInput && _emptyInput === document.activeElement) {
        _excelPasteCreateWells(text);
        return;
    }

    const rows = document.querySelectorAll('#excel-table-container tbody tr[data-widx]');
    if (rows.length === 0) return;
    let lines = text.trim().split('\n');
    for (let _pi = 0; _pi < lines.length; _pi++) {
        lines[_pi] = lines[_pi].replace(/\r$/, '');
    }
    if (_excelSelectedCells.length > 0) {
        const cellList = [..._excelSelectedCells].sort(function (a, b) {
            return a.wIdx - b.wIdx || a.colIdx - b.colIdx;
        });
        const cellRows = {};
        cellList.forEach(function (c) {
            if (!cellRows[c.wIdx]) cellRows[c.wIdx] = [];
            cellRows[c.wIdx].push(c.colIdx);
        });
        const widxArr = Object.keys(cellRows)
            .map(Number)
            .sort(function (a, b) {
                return a - b;
            });
        const _baseWIdx = widxArr.length > 0 ? widxArr[0] : 0;
        const _baseCols =
            widxArr.length > 0 && cellRows[_baseWIdx]
                ? cellRows[_baseWIdx]
                : [_excelGetPasteColIdx(rows[0])];
        /* Przy cell-selection NIE dodawaj nowych wierszy — obetnij do dostępnej liczby */
        var availableRows = rows.length - _baseWIdx;
        if (lines.length > availableRows) {
            lines = lines.slice(0, availableRows);
            if (lines.length === 0) {
                showToast('Kliknij w istniejący wiersz — tu nie ma miejsca', 'warning');
                return;
            }
            showToast('Wklejono ' + lines.length + ' (obcięte — koniec tabeli)', 'warning');
        }
        const _firstCol = _baseCols.length > 0 ? _baseCols[0] : 0;
        /* Użyj batch/sync paste — obsłuż duże zestawy */
        const _pasteFn = lines.length > 100 ? _excelPasteBatch : _excelPasteSync;
        _pasteFn(lines, _baseWIdx, _firstCol, null);
    } else if (_excelSelectedCols.length > 0) {
        const cols = [..._excelSelectedCols].sort(function (a, b) {
            return a - b;
        });
        /* Przy column-selection NIE dodawaj nowych wierszy — obetnij */
        if (lines.length > rows.length) {
            lines = lines.slice(0, rows.length);
            showToast('Wklejono ' + lines.length + ' (obcięte — koniec tabeli)', 'warning');
        }
        lines.forEach(function (line, i) {
            const parts = line.split('	');
            cols.forEach(function (colIdx, ci) {
                if (ci >= parts.length) return;
                const tdInner = rows[i] ? rows[i].children[colIdx] : null;
                const target = tdInner ? tdInner.querySelector('input, select') : null;
                if (!target) return;
                _excelSetCellValue(target, parts[ci].trim());
            });
        });
    } else {
        /* Wykryj startowy wiersz z aktywnego elementu w tabeli */
        let startWIdx = -1; // -1 = nie wykryto aktywnego wiersza
        const _ae = document.activeElement;
        if (_ae) {
            const _tr = _ae.closest('tr[data-widx]');
            if (_tr) startWIdx = parseInt(_tr.getAttribute('data-widx') || '0') || 0;
        }
        if (startWIdx < 0) {
            /* brak fokusu w konkretnym wierszu — szukaj input/select wewnatrz kontenera jako fallback */
            const focusedInput = document.querySelector(
                '#excel-table-container input:focus, #excel-table-container select:focus, #excel-table-container .excel-sel-wrap:focus-within'
            );
            if (focusedInput) {
                const _ftr = focusedInput.closest('tr[data-widx]');
                if (_ftr) startWIdx = parseInt(_ftr.getAttribute('data-widx') || '0') || 0;
            }
        }
        if (startWIdx < 0) {
            /* nadal brak — paste do wszystkich istniejących wierszy od 0 */
            startWIdx = 0;
        }
        const colIdx = _excelGetPasteColIdx(
            document.querySelector('tr[data-widx="' + startWIdx + '"]') || rows[0]
        );
        /* Wkleja tylko w istniejące — obcina nadmiar (bez auto-add nowych pustych wierszy) */
        var availableRows = rows.length - startWIdx;
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

function _excelShowPasteProgress(now, total) {
    const pct = Math.min(100, Math.round((now / total) * 100));
    let el = document.getElementById('excel-paste-progress');
    if (!el) {
        el = document.createElement('div');
        el.id = 'excel-paste-progress';
        el.style.cssText =
            'position:fixed;bottom:1rem;right:1rem;z-index:99999;background:#1a1d27;border:1px solid rgba(255,255,255,0.1);border-radius:6px;padding:0.75rem 1rem;min-width:260px;box-shadow:0 4px 20px rgba(0,0,0,0.4);';
        el.innerHTML =
            '<div style="font-size:0.65rem;color:#94a3b8;margin-bottom:0.35rem;">Wklejanie... <span id="excel-paste-pct">0%</span></div>' +
            '<div style="height:4px;background:#0c0e14;border-radius:2px;overflow:hidden;">' +
            '<div id="excel-paste-bar" style="height:100%;width:0%;background:linear-gradient(90deg,#6366f1,#22c55e);transition:width 0.15s;"></div></div>';
        document.body.appendChild(el);
    }
    const bar = document.getElementById('excel-paste-bar');
    const pctEl = document.getElementById('excel-paste-pct');
    if (bar) bar.style.width = pct + '%';
    if (pctEl) pctEl.textContent = pct + '%';
}

function _excelHidePasteProgress() {
    const el = document.getElementById('excel-paste-progress');
    if (el) el.remove();
}

function _excelPasteBatch(lines, startWIdx, startColIdx, doneCallback) {
    const CHUNK = 50;
    let idx = 0;
    const total = lines.length;
    if (total < 100) {
        _excelPasteSync(lines, startWIdx, startColIdx);
        if (doneCallback) doneCallback();
        return;
    }
    _excelShowPasteProgress(0, total);
    function tick() {
        const end = Math.min(idx + CHUNK, total);
        for (; idx < end; idx++) {
            if (_excelPasteCancelFlag) {
                _excelHidePasteProgress();
                _excelPasteCancelFlag = false;
                showToast('Wklejanie przerwane', 'warning');
                return;
            }
            const line = lines[idx];
            const parts = line.split('	');
            var wIdx = startWIdx + idx;
            parts.forEach(function (v, ci) {
                const colIdx = startColIdx + ci;
                const row = document.querySelector('tr[data-widx="' + wIdx + '"]');
                if (!row) return;
                const tdEl = row.children[colIdx];
                const target = tdEl ? tdEl.querySelector('input, select') : null;
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

function _excelPasteSync(lines, startWIdx, startColIdx) {
    for (let si = 0; si < lines.length; si++) {
        const parts = lines[si].split('	');
        var wIdx = startWIdx + si;
        parts.forEach(function (v, ci) {
            const colIdx = startColIdx + ci;
            const row = document.querySelector('tr[data-widx="' + wIdx + '"]');
            if (!row) return;
            const tdEl = row.children[colIdx];
            const target = tdEl ? tdEl.querySelector('input, select') : null;
            if (target) _excelSetCellValue(target, v.trim());
        });
    }
}

function _excelSetCellValue(target, val) {
    if (target.tagName === 'SELECT') {
        const _sel = /** @type {HTMLSelectElement} */ (target);
        const opt = Array.from(_sel.options).find(function (o) {
            return o.value === val || o.text === val;
        });
        if (opt) {
            _sel.value = opt.value;
            _sel.dispatchEvent(new Event('change', { bubbles: true }));
        }
    } else if (target.tagName === 'INPUT') {
        /* Normalizuj separator dziesietny — MS Excel z PL wysyla przecinek, input type=number wymaga kropki */
        let normalizedVal = val;
        const inputType = /** @type {HTMLInputElement} */ (target).type;
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

function _excelEnsureRowCount(neededTotal, currentRows) {
    const deficit = neededTotal - currentRows.length;
    if (deficit <= 0) return currentRows;
    const dn = _excelActiveTab === 'styczne' ? 'styczna' : parseInt(_excelActiveTab, 10);
    _excelSaveUndoSnapshot();
    for (let i = 0; i < deficit; i++) {
        const well =
            typeof createNewWell === 'function'
                ? createNewWell(null, /** @type {any} */ (dn))
                : {
                      id: 'well_' + Date.now() + '_' + i,
                      name:
                          (dn === 'styczna' ? 'Studnia Styczna' : 'Studnia DN' + dn) +
                          ' (#' +
                          (wells.length + 1) +
                          ')',
                      dn: dn,
                      config: [],
                      przejscia: [],
                      rzednaWlazu: null,
                      rzednaDna: null,
                      kineta: 'brak',
                      psiaBuda: false,
                      redukcjaDN1000: false,
                      redukcjaMinH: 2500
                  };
        wells.push(well);
        _excelAutoSetWlaz(well);
    }
    _excelMaxTransitions[_excelActiveTab] = _excelGetMaxTransitions();
    _excelRenderTabs();
    _excelRenderTable(_excelActiveTab);
    _excelUpdateWellCount();
    return document.querySelectorAll('#excel-table-container tbody tr[data-widx]');
}

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
