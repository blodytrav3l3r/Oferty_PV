// @ts-check
/* ===== EXCEL CLIPBOARD — Kopiuj/wklej, nawigacja klaw., undo/redo ===== */

function _excelHandleCopy(e) {
    /* Tylko gdy Excel otwarty */
    if (!document.getElementById('excel-table-overlay')) return;
    if (_excelSelectedCells.length === 0 && _excelSelectedCols.length === 0) return;
    e.preventDefault();
    var rows = document.querySelectorAll('#excel-table-container tbody tr[data-widx]');
    if (rows.length === 0) return;
    var text = '';
    if (_excelSelectedCells.length > 0) {
        var cellMap = {};
        var minR = Infinity,
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
        for (var r = minR; r <= maxR; r++) {
            var line = [];
            for (var c = minC; c <= maxC; c++) {
                var val = '';
                if (cellMap[r] && cellMap[r][c]) {
                    var row = rows[r];
                    if (row) {
                        var td = row.children[c];
                        var target = td ? td.querySelector('input, select') : null;
                        if (target) {
                            var _sel = /** @type {HTMLSelectElement} */ (target);
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
        var cols = [..._excelSelectedCols].sort(function (a, b) {
            return a - b;
        });
        rows.forEach(function (row) {
            var line = [];
            cols.forEach(function (colIdx) {
                var td = row.children[colIdx];
                var target = td ? td.querySelector('input, select') : null;
                line.push(
                    target
                        ? (function (t) {
                              var _s = /** @type {HTMLSelectElement} */ (t);
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
    var cb = e.clipboardData || window.clipboardData;
    if (!cb) return;
    var text = cb.getData('text');
    if (!text || !text.trim()) return;
    /* Zawsze przejmij event gdy jesteśmy w kontenerze (capture phase) */
    e.preventDefault();
    e.stopPropagation();

    /* Paste w pusty wiersz → utwórz nowe studnie */
    var _emptyInput = document.getElementById('excel-empty-name');
    if (_emptyInput && _emptyInput === document.activeElement) {
        _excelPasteCreateWells(text);
        return;
    }

    var rows = document.querySelectorAll('#excel-table-container tbody tr[data-widx]');
    if (rows.length === 0) return;
    var lines = text.trim().split('\n');
    for (var _pi = 0; _pi < lines.length; _pi++) {
        lines[_pi] = lines[_pi].replace(/\r$/, '');
    }
    if (_excelSelectedCells.length > 0) {
        var cellList = [..._excelSelectedCells].sort(function (a, b) {
            return a.wIdx - b.wIdx || a.colIdx - b.colIdx;
        });
        var cellRows = {};
        cellList.forEach(function (c) {
            if (!cellRows[c.wIdx]) cellRows[c.wIdx] = [];
            cellRows[c.wIdx].push(c.colIdx);
        });
        var widxArr = Object.keys(cellRows)
            .map(Number)
            .sort(function (a, b) {
                return a - b;
            });
        var _baseWIdx = widxArr.length > 0 ? widxArr[0] : 0;
        var _baseCols =
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
        var _firstCol = _baseCols.length > 0 ? _baseCols[0] : 0;
        /* Użyj batch/sync paste — obsłuż duże zestawy */
        var _pasteFn = lines.length > 100 ? _excelPasteBatch : _excelPasteSync;
        _pasteFn(lines, _baseWIdx, _firstCol, null);
    } else if (_excelSelectedCols.length > 0) {
        var cols = [..._excelSelectedCols].sort(function (a, b) {
            return a - b;
        });
        /* Przy column-selection NIE dodawaj nowych wierszy — obetnij */
        if (lines.length > rows.length) {
            lines = lines.slice(0, rows.length);
            showToast('Wklejono ' + lines.length + ' (obcięte — koniec tabeli)', 'warning');
        }
        lines.forEach(function (line, i) {
            var parts = line.split('	');
            cols.forEach(function (colIdx, ci) {
                if (ci >= parts.length) return;
                var tdInner = rows[i] ? rows[i].children[colIdx] : null;
                var target = tdInner ? tdInner.querySelector('input, select') : null;
                if (!target) return;
                _excelSetCellValue(target, parts[ci].trim());
            });
        });
    } else {
        /* Wykryj startowy wiersz z aktywnego elementu w tabeli */
        var startWIdx = -1; // -1 = nie wykryto aktywnego wiersza
        var _ae = document.activeElement;
        if (_ae) {
            var _tr = _ae.closest('tr[data-widx]');
            if (_tr) startWIdx = parseInt(_tr.getAttribute('data-widx') || '0') || 0;
        }
        if (startWIdx < 0) {
            /* brak fokusu w konkretnym wierszu — szukaj input/select wewnatrz kontenera jako fallback */
            var focusedInput = document.querySelector(
                '#excel-table-container input:focus, #excel-table-container select:focus, #excel-table-container .excel-sel-wrap:focus-within'
            );
            if (focusedInput) {
                var _ftr = focusedInput.closest('tr[data-widx]');
                if (_ftr) startWIdx = parseInt(_ftr.getAttribute('data-widx') || '0') || 0;
            }
        }
        if (startWIdx < 0) {
            /* nadal brak — paste do wszystkich istniejących wierszy od 0 */
            startWIdx = 0;
        }
        var colIdx = _excelGetPasteColIdx(
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
    var pct = Math.min(100, Math.round((now / total) * 100));
    var el = document.getElementById('excel-paste-progress');
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
    var bar = document.getElementById('excel-paste-bar');
    var pctEl = document.getElementById('excel-paste-pct');
    if (bar) bar.style.width = pct + '%';
    if (pctEl) pctEl.textContent = pct + '%';
}

function _excelHidePasteProgress() {
    var el = document.getElementById('excel-paste-progress');
    if (el) el.remove();
}

function _excelPasteBatch(lines, startWIdx, startColIdx, doneCallback) {
    var CHUNK = 50;
    var idx = 0;
    var total = lines.length;
    if (total < 100) {
        _excelPasteSync(lines, startWIdx, startColIdx);
        if (doneCallback) doneCallback();
        return;
    }
    _excelShowPasteProgress(0, total);
    function tick() {
        var end = Math.min(idx + CHUNK, total);
        for (; idx < end; idx++) {
            if (_excelPasteCancelFlag) {
                _excelHidePasteProgress();
                _excelPasteCancelFlag = false;
                showToast('Wklejanie przerwane', 'warning');
                return;
            }
            var line = lines[idx];
            var parts = line.split('	');
            var wIdx = startWIdx + idx;
            parts.forEach(function (v, ci) {
                var colIdx = startColIdx + ci;
                var row = document.querySelector('tr[data-widx="' + wIdx + '"]');
                if (!row) return;
                var tdEl = row.children[colIdx];
                var target = tdEl ? tdEl.querySelector('input, select') : null;
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
    for (var si = 0; si < lines.length; si++) {
        var parts = lines[si].split('	');
        var wIdx = startWIdx + si;
        parts.forEach(function (v, ci) {
            var colIdx = startColIdx + ci;
            var row = document.querySelector('tr[data-widx="' + wIdx + '"]');
            if (!row) return;
            var tdEl = row.children[colIdx];
            var target = tdEl ? tdEl.querySelector('input, select') : null;
            if (target) _excelSetCellValue(target, v.trim());
        });
    }
}

function _excelSetCellValue(target, val) {
    if (target.tagName === 'SELECT') {
        var _sel = /** @type {HTMLSelectElement} */ (target);
        var opt = Array.from(_sel.options).find(function (o) {
            return o.value === val || o.text === val;
        });
        if (opt) {
            _sel.value = opt.value;
            _sel.dispatchEvent(new Event('change', { bubbles: true }));
        }
    } else if (target.tagName === 'INPUT') {
        /* Normalizuj separator dziesietny — MS Excel z PL wysyla przecinek, input type=number wymaga kropki */
        var normalizedVal = val;
        var inputType = /** @type {HTMLInputElement} */ (target).type;
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
    var w = wells[wIdx];
    if (w.autoSelect !== false || w.configSource !== 'MANUAL' || w.autoLocked !== true) {
        w.autoSelect = false;
        w.configSource = 'MANUAL';
        w.autoLocked = true;
        if (typeof _excelSyncAutoManualUI === 'function') _excelSyncAutoManualUI();
        if (typeof window.updateAutoLockUI === 'function') window.updateAutoLockUI();
    }
}

function _excelEnsureRowCount(neededTotal, currentRows) {
    var deficit = neededTotal - currentRows.length;
    if (deficit <= 0) return currentRows;
    var dn = _excelActiveTab === 'styczne' ? 'styczna' : parseInt(_excelActiveTab, 10);
    _excelSaveUndoSnapshot();
    for (var i = 0; i < deficit; i++) {
        var well =
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
    var snap = _excelUndoStack.pop();
    wells.splice(0, wells.length, ...snap);
    _excelRenderTable(_excelActiveTab);
    showToast('Cofnięto', 'info');
}

function _excelRedo() {
    if (_excelRedoStack.length === 0) return;
    _excelUndoStack.push(JSON.parse(JSON.stringify(wells)));
    var snap = _excelRedoStack.pop();
    wells.splice(0, wells.length, ...snap);
    _excelRenderTable(_excelActiveTab);
    showToast('Przywrócono', 'info');
}

function _excelPasteCreateWells(text) {
    var parsed = _excelParsePasteData(text);
    /* Jesli parser nie rozpoznal danych, sprobuj prostrzy format: kazda linia = nazwa studni */
    if (parsed.length === 0) {
        var lines = text
            .trim()
            .split(String.fromCharCode(10))
            .map(function (l) {
                return l.replace(String.fromCharCode(13), '').trim();
            })
            .filter(function (l) {
                return l;
            });
        if (lines.length > 0) {
            var dn = _excelActiveTab || '1000';
            _excelSaveUndoSnapshot();
            var added = 0;
            for (var fi = 0; fi < lines.length; fi++) {
                var name = lines[fi];
                if (!name) continue;
                var dnVal = dn === 'styczne' ? 'styczna' : parseInt(dn, 10);
                if (typeof dnVal === 'number' && isNaN(dnVal)) dnVal = 1000;
                var well =
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
    var dn = _excelActiveTab || '1000';
    _excelSaveUndoSnapshot();
    var added = 0;
    parsed.forEach(function (row) {
        var name = String(row.name || '').trim();
        if (!name) return;
        /* pozwól na duplikaty — nie sprawdzamy 'wells.some' */
        var dnVal = row.dn || String(dn);
        dnVal = dnVal === 'styczne' || dnVal === 'styczna' ? 'styczna' : parseInt(dnVal, 10);
        if (typeof dnVal === 'number' && isNaN(dnVal)) dnVal = 1000;
        var rzw = row.rzednaWlazu ? parseDecimal(String(row.rzednaWlazu)) : null;
        var rzd = row.rzednaDna ? parseDecimal(String(row.rzednaDna)) : 0;
        var well =
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
        for (var k = 0; k < added; k++) {
            (function (idx) {
                setTimeout(
                    function () {
                        var nwi = wells.length - added + idx;
                        var w = wells[nwi];
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
                    200 + idx * 300
                );
            })(k);
        }
    }
    _excelDebouncedRefresh();
    showToast('Dodano ' + added + ' studni', 'success');
}

function _excelImportPasteList() {
    var ta = document.getElementById('paste-textarea');
    if (!ta) return;
    var text = ta.value.trim();
    if (!text) {
        showToast('Wklej dane studni', 'error');
        return;
    }
    var rows = _excelParsePasteData(text);
    if (rows.length === 0) {
        showToast('Nie rozpoznano danych', 'error');
        return;
    }
    var added = 0;
    rows.forEach(function (row) {
        var name = String(row.name || '');
        if (!name) return;
        if (
            wells.some(function (w) {
                return w.name === name;
            })
        )
            return;
        var dn = row.dn || String(_excelActiveTab);
        var dnVal = dn === 'styczne' || dn === 'styczna' ? 'styczna' : parseInt(dn, 10);
        if (typeof dnVal === 'number' && isNaN(dnVal)) dnVal = 1000;
        var rzw = row.rzednaWlazu ? parseDecimal(String(row.rzednaWlazu)) : null;
        var rzd = row.rzednaDna ? parseDecimal(String(row.rzednaDna)) : 0;
        var well =
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
    var overlay = document.getElementById('excel-paste-dialog-overlay');
    if (added === 0) {
        showToast('Nie dodano żadnej studni (duplikaty?)', 'info');
        return;
    }
    _excelMaxTransitions[_excelActiveTab] = _excelGetMaxTransitions();
    _excelRenderTabs();
    _excelRenderTable(_excelActiveTab);
    _excelUpdateWellCount();
    if (_excelAutoSelectEnabled) {
        for (var k = 0; k < added; k++) {
            (function (idx) {
                setTimeout(
                    function () {
                        var nwi = wells.length - added + idx;
                        var w = wells[nwi];
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
                    200 + idx * 300
                );
            })(k);
        }
    }
    _excelDebouncedRefresh();
}

function _excelUpdatePastePreview() {
    var ta = document.getElementById('paste-textarea');
    var prev = document.getElementById('paste-preview');
    if (!ta || !prev) return;
    var text = ta.value.trim();
    if (!text) {
        prev.textContent = '';
        return;
    }
    var rows = _excelParsePasteData(text);
    prev.innerHTML =
        rows.length > 0
            ? 'Rozpoznano <strong>' + rows.length + '</strong> studni'
            : '(brak danych)';
}

function _excelParsePasteData(text) {
    var lines = text
        .split('\n')
        .map(function (l) {
            return l.trim();
        })
        .filter(function (l) {
            return l;
        });
    if (lines.length === 0) return [];
    var sep = '\t';
    if (!lines[0].includes('\t')) {
        if (lines[0].includes('|')) sep = '|';
        else if (lines[0].includes(';')) sep = ';';
        else if (lines[0].includes(',')) sep = ',';
        else sep = null;
    }
    var rows = [],
        headerKeys = null;
    for (var i = 0; i < lines.length; i++) {
        var parts = sep
            ? lines[i].split(sep).map(function (p) {
                  return p.trim();
              })
            : lines[i].split(/\s+/).filter(function (p) {
                  return p;
              });
        if (parts.length < 2) continue;
        var lower = parts.map(function (p) {
            return p.toLowerCase();
        });
        if (
            lower.some(function (p) {
                return p === 'nazwa' || p === 'nr' || p === 'lp';
            })
        ) {
            headerKeys = parts.map(function (p) {
                return _excelDetectColumn(p);
            });
            continue;
        }
        var row = {};
        if (headerKeys) {
            for (var j = 0; j < Math.min(parts.length, headerKeys.length); j++) {
                if (headerKeys[j]) row[headerKeys[j]] = parts[j];
            }
        } else {
            row.name = parts[0];
            row.dn = parts[1];
            row.rzednaWlazu = parts[2];
            row.rzednaDna = parts[3];
        }
        if (row.name) rows.push(row);
    }
    return rows;
}

function _excelDetectColumn(label) {
    var l = label.toLowerCase();
    if (l === 'nazwa' || l === 'name' || l === 'nr' || l === 'lp' || l === 'studnia') return 'name';
    if (l === 'dn' || l === 'średnica' || l === 'srednica') return 'dn';
    if (
        l === 'rz.włazu' ||
        l === 'rz wlazu' ||
        l === 'rzędna włazu' ||
        l === 'rz.w' ||
        l === 'wlazu'
    )
        return 'rzednaWlazu';
    if (l === 'rz.dna' || l === 'rz dna' || l === 'rzędna dna' || l === 'rz.d' || l === 'dna')
        return 'rzednaDna';
    return null;
}

function _excelGetPasteColIdx(row) {
    if (!row) return 2;
    var active = document.activeElement;
    if (active && row.contains(active)) {
        var td = active.closest('td');
        if (td) {
            var ci = Array.from(row.children).indexOf(td);
            if (ci >= 2) return ci;
        }
    }
    return 2; /* fallback: pierwsza kolumna po Lp+NrStudni */
}

function _excelHandleTab(e) {
    let target = e.target;
    if (!target) return;
    // Normalizuj target — SELECT → wrapper, wrapper OK, INPUT OK
    if (target.tagName === 'SELECT') {
        var w = target.closest('.excel-sel-wrap');
        if (w) target = w;
    } else if (
        target.tagName !== 'INPUT' &&
        !(target.classList && target.classList.contains('excel-sel-wrap'))
    ) {
        return;
    }

    const container = document.getElementById('excel-table-container');
    if (!container || !container.contains(target)) return;

    const tr = target.closest('tr');
    if (!tr) return;
    const navEls = _excelGetNavElements(tr);
    var idx = navEls.indexOf(target);
    if (idx === -1) return;

    // Szukaj następnego/poprzedniego nawigacyjnego elementu w wierszu lub następnych wierszach
    e.preventDefault();
    var allRows = Array.from(container.querySelectorAll('tbody tr[data-widx]'));
    var rowIdx = allRows.indexOf(tr);
    var next = null;
    if (!e.shiftKey) {
        next = navEls[idx + 1];
        if (!next && allRows[rowIdx + 1]) {
            var nextRowEls = _excelGetNavElements(allRows[rowIdx + 1]);
            next = nextRowEls[0];
        }
    } else {
        next = navEls[idx - 1];
        if (!next && allRows[rowIdx - 1]) {
            var prevRowEls = _excelGetNavElements(allRows[rowIdx - 1]);
            next = prevRowEls[prevRowEls.length - 1];
        }
    }
    if (next) {
        _excelFocusNavEl(next, navEls, e.shiftKey ? 'left' : 'right');
    }
}

function _excelHandleArrow(e) {
    /* Kiedy focus jest w pustym wierszu — obsłuż strzałki specjalnie */
    var emptyInput = document.getElementById('excel-empty-name');
    var emptyRzw = document.getElementById('excel-empty-rzw');
    var emptyRzd = document.getElementById('excel-empty-rzd');
    if (emptyInput && (e.target === emptyInput || e.target === emptyRzw || e.target === emptyRzd)) {
        e.preventDefault();
        if (e.key === 'ArrowDown') {
            return; /* nic poniżej */
        }
        if (e.key === 'ArrowUp') {
            e.preventDefault();
            var drUp = document.querySelectorAll('#excel-table-container tbody tr[data-widx]');
            var lastRowUp = drUp[drUp.length - 1];
            if (lastRowUp) {
                var lastElsUp = _excelGetNavElements(lastRowUp);
                /* Wybor kolumny z zapisanej wartosci _excelLastDataCol */
                var targetEl = null;
                var savedCol = typeof _excelLastDataCol === 'number' ? _excelLastDataCol : -1;
                if (savedCol >= 0 && savedCol < lastRowUp.children.length) {
                    var tdAtCol = lastRowUp.children[savedCol];
                    if (tdAtCol) {
                        var inpAtCol = tdAtCol.querySelector('input, select, .excel-sel-wrap');
                        if (inpAtCol) targetEl = inpAtCol;
                    }
                }
                if (!targetEl && lastElsUp.length > 0) {
                    /* Fallback: ostatni focusowalny element w ostatnim wierszu */
                    targetEl = lastElsUp[lastElsUp.length - 1];
                }
                if (targetEl) _excelFocusNavEl(targetEl, lastElsUp, 'up');
            }
            return;
        }
        if (e.key === 'ArrowRight' || e.key === 'Tab') {
            e.preventDefault();
            if (e.target === emptyInput && emptyRzw) emptyRzw.focus();
            else if (e.target === emptyRzw && emptyRzd) emptyRzd.focus();
            return;
        }
        if (e.key === 'ArrowLeft' || (e.key === 'Tab' && e.shiftKey)) {
            e.preventDefault();
            if (e.target === emptyRzd && emptyRzw) emptyRzw.focus();
            else if (e.target === emptyRzw && emptyInput) emptyInput.focus();
            return;
        }
        return;
    }

    let target = e.target;
    if (!target) return;

    // Normalizuj target do elementu nawigacyjnego: INPUT lub DIV.excel-sel-wrap
    target = _excelNormalizeNavTarget(target);
    if (!target) return;

    const container = document.getElementById('excel-table-container');
    if (!container || !container.contains(target)) return;

    const tr = target.closest('tr');
    if (!tr) return;

    // Znajdź wiersze data (pomiń empty-row)
    const allRows = Array.from(container.querySelectorAll('tbody tr'));
    const dataRows = allRows.filter((r) => r.hasAttribute('data-widx'));
    const currentRowIdx = dataRows.indexOf(tr);
    if (currentRowIdx === -1) return;

    // Zbierz fokusowalne elementy: INPUT + DIV.excel-sel-wrap
    const rowEls = _excelGetNavElements(tr);
    const colIdx = rowEls.indexOf(target);
    if (colIdx === -1) {
        if (typeof window.logger !== 'undefined')
            window.logger.warn(
                'excel-nav',
                'colIdx=-1 target=' + target.tagName + ' class=' + (target.className || '')
            );
        return;
    }

    let next = null;

    if (e.key === 'ArrowRight') {
        next = rowEls[colIdx + 1] || null;
    } else if (e.key === 'ArrowLeft') {
        next = rowEls[colIdx - 1] || null;
    } else if (e.key === 'ArrowDown') {
        var nextRow = dataRows[currentRowIdx + 1];
        if (!nextRow) {
            /* zapamietaj indeks td.children (nie index z rowEls) */
            var tddx = target.closest('td');
            if (tddx && tddx.parentElement === tr) {
                _excelLastDataCol = Array.prototype.indexOf.call(tr.children, tddx);
            }
            /* ostatni rzad danych — przejdz do pustego wiersza */
            var emptyInput = document.getElementById('excel-empty-name');
            if (emptyInput) {
                e.preventDefault();
                _excelFocusNavEl(emptyInput, [], 'down');
            }
            return;
        }
        var downWIdx = parseInt(nextRow.getAttribute('data-widx'));
        if (
            !isNaN(downWIdx) &&
            typeof currentWellIndex !== 'undefined' &&
            downWIdx !== currentWellIndex
        ) {
            excelSelectRow(downWIdx);
        }
        var nextEls = _excelGetNavElements(nextRow);
        next = nextEls[Math.min(colIdx, nextEls.length - 1)] || null;
        next = _excelSkipDisabled(next, nextEls, colIdx, 1);
    } else if (e.key === 'ArrowUp') {
        const prevRow = dataRows[currentRowIdx - 1];
        if (prevRow) {
            var upWIdx = parseInt(prevRow.getAttribute('data-widx'));
            if (
                !isNaN(upWIdx) &&
                typeof currentWellIndex !== 'undefined' &&
                upWIdx !== currentWellIndex
            ) {
                excelSelectRow(upWIdx);
            }
            const prevEls = _excelGetNavElements(prevRow);
            next = prevEls[Math.min(colIdx, prevEls.length - 1)] || null;
            next = _excelSkipDisabled(next, prevEls, colIdx, -1);
        }
    }

    if (next) {
        _excelFocusNavEl(next, rowEls, e.key.replace('Arrow', '').toLowerCase());
    }
}

function _excelNormalizeNavTarget(el) {
    if (!el) return null;
    // INPUT — OK
    if (el.tagName === 'INPUT') return el;
    // SELECT — szukaj wrappera, fallback na sam SELECT
    if (el.tagName === 'SELECT') {
        var wrap = el.closest('.excel-sel-wrap');
        return wrap || el;
    }
    // DIV.excel-sel-wrap — OK
    if (el.classList && el.classList.contains('excel-sel-wrap')) return el;
    // Inny element wewnątrz wrappera
    if (el.closest) {
        var parentWrap = el.closest('.excel-sel-wrap');
        if (parentWrap) return parentWrap;
    }
    return null;
}

function _excelGetNavElements(row) {
    var els = [];
    var cells = row.querySelectorAll('td');
    for (var i = 0; i < cells.length; i++) {
        // Priorytet: wrapper selecta (DIV.excel-sel-wrap)
        var wrap = cells[i].querySelector('.excel-sel-wrap');
        if (wrap) {
            els.push(wrap);
            continue;
        }
        // INPUT
        var inp = cells[i].querySelector('input');
        if (inp) {
            els.push(inp);
            continue;
        }
        // Fallback: natywny select bez wrappera
        var sel = cells[i].querySelector('select');
        if (sel) {
            els.push(sel);
        }
    }
    return els;
}

function _excelSkipDisabled(el, els, startIdx, dir) {
    if (!el || !_excelIsDisabledNav(el)) return el;
    var from = Math.min(startIdx, els.length - 1);
    // Szukaj dalej w kierunku dir
    for (var i = from + dir; i >= 0 && i < els.length; i += dir) {
        if (!_excelIsDisabledNav(els[i])) return els[i];
    }
    // Szukaj w przeciwnym kierunku
    for (i = from - dir; i >= 0 && i < els.length; i -= dir) {
        if (!_excelIsDisabledNav(els[i])) return els[i];
    }
    return null;
}

function _excelIsDisabledNav(el) {
    if (!el) return true;
    if (el.disabled) return true;
    // Wrapper z disabled selectem
    if (el.classList && el.classList.contains('excel-sel-wrap')) {
        var sel = el.querySelector('select');
        return sel && sel.disabled;
    }
    return false;
}

function _excelFocusNavEl(el, rowEls, dir) {
    if (!el) return;
    var step = dir === 'right' || dir === 'down' ? 1 : -1;
    var limit = rowEls.length + 1; /* max iteracji = rozmiar wiersza + 1 */
    var cur = el;
    while (cur && limit-- > 0) {
        if (!_excelIsDisabledNav(cur)) {
            cur.focus();
            /* Scroll-into-view bez scrollIntoView (nie uwzglednia sticky headera) */
            var container = document.getElementById('excel-table-container');
            var headerEl = document.querySelector('#excel-table-container thead');
            var headerH = headerEl ? /** @type {HTMLElement} */ (headerEl).offsetHeight : 60;
            var MARGIN = 5;
            /* Reczna korekta scroll — element MUSI byc widoczny ponizej sticky headera */
            if (container) {
                var elRect = cur.getBoundingClientRect();
                var containerRect = container.getBoundingClientRect();
                /* Jesli element jest nad widocznym obszarem (elRect.top < containerRect.top + headerH)
                   lub calkowicie poza viewport — przewin w dol */
                if (elRect.top < containerRect.top + headerH + MARGIN) {
                    /* Element za wysoko / zakryty headerm — przewin w dol */
                    var diffDown = containerRect.top + headerH + MARGIN - elRect.top;
                    container.scrollTop -= diffDown;
                } else if (elRect.top + elRect.height > containerRect.bottom) {
                    /* Element za nisko — przewin w gore (w gore kontenera) */
                    var diffUp = elRect.bottom - containerRect.bottom + MARGIN;
                    container.scrollTop += diffUp;
                }
            }
            if (cur.tagName === 'INPUT' && !cur.disabled && cur.select) cur.select();
            var tr = cur.closest('tr[data-widx]');
            if (tr) {
                var wIdx = parseInt(tr.getAttribute('data-widx'), 10);
                if (
                    !isNaN(wIdx) &&
                    (typeof currentWellIndex === 'undefined' || wIdx !== currentWellIndex)
                ) {
                    excelSelectRow(wIdx);
                }
            }
            return;
        }
        var curIdx = rowEls.indexOf(cur);
        cur = rowEls[curIdx + step] || null;
    }
}

function _excelHandleKeydown(e) {
    /* Tylko gdy kontener Excela jest otwarty */
    var overlay = document.getElementById('excel-table-overlay');
    if (!overlay) return;

    var isCtrl = e.ctrlKey || e.metaKey;

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
            var row = document.querySelector('tr[data-widx="' + cell.wIdx + '"]');
            if (!row) return;
            var inputs = row.querySelectorAll('input, select');
            var target = inputs[cell.colIdx];
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
        var allRows = document.querySelectorAll('#excel-table-container tbody tr[data-widx]');
        _excelDeselectAllCells();
        allRows.forEach(function (row, rIdx) {
            var tds = row.querySelectorAll('td');
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
            var row = document.querySelector('tr[data-widx="' + cell.wIdx + '"]');
            if (!row) return;
            var inputs = row.querySelectorAll('input, select');
            var target = inputs[cell.colIdx];
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
            var srcRow = document.querySelector('tr[data-widx="' + (cell.wIdx - 1) + '"]');
            var dstRow = document.querySelector('tr[data-widx="' + cell.wIdx + '"]');
            if (!srcRow || !dstRow) return;
            var tdDst = dstRow.children[cell.colIdx];
            var tdSrc = srcRow.children[cell.colIdx];
            var target = tdDst ? tdDst.querySelector('input, select') : null;
            var src = tdSrc ? tdSrc.querySelector('input, select') : null;
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
            var row = document.querySelector('tr[data-widx="' + cell.wIdx + '"]');
            if (!row) return;
            var tdR = row.children[cell.colIdx];
            var tdRSrc = row.children[cell.colIdx - 1];
            var target = tdR ? tdR.querySelector('input, select') : null;
            var src = tdRSrc ? tdRSrc.querySelector('input, select') : null;
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
