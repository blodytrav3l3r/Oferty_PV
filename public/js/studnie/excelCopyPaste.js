// @ts-check
/* ===== EXCEL COPY / PASTE (Excel-like) ===== */
let _excelPasteRafId = null;

function _excelGetPasteColIdx(row) {
    if (!row) return 2;
    const active = document.activeElement;
    if (active && row.contains(active)) {
        const td = active.closest('td');
        if (td) {
            const ci = Array.from(row.children).indexOf(td);
            if (ci >= 2) return ci;
        }
    }
    return 2; /* fallback: pierwsza kolumna po Lp+NrStudni */
}
/* Widoczne wiersze (pomija display:none z filtra wyszukiwarki), posortowane po data-widx */
function _excelGetVisibleRows() {
    const rows = document.querySelectorAll('#excel-table-container tbody tr[data-widx]');
    /** @type {HTMLElement[]} */
    const out = [];
    for (let i = 0; i < rows.length; i++) {
        if (rows[i].style.display !== 'none') out.push(/** @type {HTMLElement} */ (rows[i]));
    }
    return out;
}
function _excelNormalizeHeader(s) {
    return String(s || '')
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-z0-9]/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
}
function _excelDetectHeader(firstParts) {
    if (!firstParts || firstParts.length === 0) return false;
    const norms = firstParts.map(_excelNormalizeHeader);
    const kws = [
        'stu',
        'nr',
        'nazwa',
        'rz wlazu',
        'rz dna',
        'srednica',
        'rz wlot',
        'rzedna wlot',
        'kat',
        'rodzaj',
        'wlaz',
        'krag',
        'plyta',
        'kineta',
        'psia buda'
    ];
    let hits = 0;
    for (const n of norms) {
        if (!n) continue;
        for (const kw of kws)
            if (n.includes(kw) || kw.includes(n)) {
                hits++;
                break;
            }
    }
    if (hits >= 2) return true;
    if (firstParts.length === 1 && hits >= 1) return true;
    if (hits >= 1 && firstParts.length >= 3) {
        const nonNum = norms.filter((v) => v && isNaN(parseFloat(v.replace(',', '.')))).length;
        if (nonNum >= 2) return true;
    }
    return false;
}
function _excelBuildSemanticMap(headerParts, dn) {
    const norms = headerParts.map(_excelNormalizeHeader);
    const wew = [];
    wew.push({ norm: 'stu', col: 3 });
    wew.push({ norm: 'nr', col: 3 });
    wew.push({ norm: 'nazwa', col: 3 });
    wew.push({ norm: 'nr studni', col: 3 });
    wew.push({ norm: 'nazwa studni', col: 3 });
    wew.push({ norm: 'numer', col: 3 });
    wew.push({ norm: 'numer studni', col: 3 });
    wew.push({ norm: 'studnia', col: 3 });
    wew.push({ norm: 'rz wlazu', col: 4 });
    wew.push({ norm: 'rz dna', col: 5 });
    const maxTr = (typeof _excelMaxTransitions !== 'undefined' && _excelMaxTransitions[dn]) || 1;
    const headerN = norms.filter((n) => n.includes('srednica')).length || maxTr;
    const N = Math.max(maxTr, headerN, 1);
    for (let i = 0; i < N; i++) {
        wew.push({ norm: `rz wlot ${i}`, col: 7 + i * 4 });
        wew.push({ norm: `kat ${i}`, col: 8 + i * 4 });
        wew.push({ norm: `rodzaj ${i}`, col: 9 + i * 4 });
        wew.push({ norm: `srednica ${i}`, col: 10 + i * 4 });
    }
    const map = {};
    for (let extIdx = 0; extIdx < norms.length; extIdx++) {
        const e = norms[extIdx];
        if (!e) continue;
        let f = wew.find((x) => x.norm === e);
        if (!f) f = wew.find((x) => e.includes(x.norm) || x.norm.includes(e));
        if (!f) {
            const mS = e.match(/srednica\s*(\d+)/);
            if (mS) f = wew.find((x) => x.col === 10 + parseInt(mS[1], 10) * 4);
            else {
                const mR = e.match(/rz\s*wlot\s*(\d+)/);
                if (mR) f = wew.find((x) => x.col === 7 + parseInt(mR[1], 10) * 4);
                else {
                    const mK = e.match(/kat\s*(\d+)/);
                    if (mK) f = wew.find((x) => x.col === 8 + parseInt(mK[1], 10) * 4);
                    else {
                        const mRo = e.match(/rodzaj\s*(\d+)/);
                        if (mRo) f = wew.find((x) => x.col === 9 + parseInt(mRo[1], 10) * 4);
                    }
                }
            }
        }
        if (!f && e === 'srednica') f = wew.find((x) => x.norm === 'srednica 0');
        if (!f && e === 'rz wlot') f = wew.find((x) => x.norm === 'rz wlot 0');
        if (!f && e === 'kat') f = wew.find((x) => x.norm === 'kat 0');
        if (!f && e === 'rodzaj') f = wew.find((x) => x.norm === 'rodzaj 0');
        if (f) map[extIdx] = f.col;
    }
    return map;
}
function _excelPasteSemantic(lines, visibleRows, map) {
    for (let si = 0; si < lines.length; si++) {
        const parts = lines[si].split('\t');
        const row = visibleRows[si];
        if (!row) continue;
        for (let ci = 0; ci < parts.length; ci++) {
            const targetCol = map[ci];
            if (targetCol == null) continue;
            const tdEl = row.children[targetCol];
            const target = tdEl ? tdEl.querySelector('input, select') : null;
            if (target) _excelSetCellValue(target, parts[ci].replace(/\r/g, '').trim());
        }
    }
}
function _excelPasteSemanticBatch(lines, visibleRows, map, doneCallback) {
    const CHUNK = 50;
    let idx = 0;
    const total = lines.length;
    if (total < 100) {
        _excelPasteSemantic(lines, visibleRows, map);
        if (doneCallback) doneCallback();
        return;
    }
    _excelShowPasteProgress(0, total);
    function tick() {
        if (!document.getElementById('excel-table-overlay')) {
            _excelCancelPasteBatch();
            return;
        }
        const end = Math.min(idx + CHUNK, total);
        for (; idx < end; idx++) {
            const parts = lines[idx].split('\t');
            const row = visibleRows[idx];
            if (!row) continue;
            for (let ci = 0; ci < parts.length; ci++) {
                const targetCol = map[ci];
                if (targetCol == null) continue;
                const tdEl = row.children[targetCol];
                const target = tdEl ? tdEl.querySelector('input, select') : null;
                if (target) _excelSetCellValue(target, parts[ci].replace(/\r/g, '').trim());
            }
        }
        _excelShowPasteProgress(idx, total);
        if (idx < total) _excelPasteRafId = requestAnimationFrame(tick);
        else {
            _excelPasteRafId = null;
            _excelHidePasteProgress();
            if (doneCallback) doneCallback();
        }
    }
    _excelPasteRafId = requestAnimationFrame(tick);
}
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
        /* Mapa data-widx -> wiersz (wIdx z selekcji = indeks globalny, nie pozycja DOM) */
        const rowMap = {};
        for (let i = 0; i < rows.length; i++) {
            rowMap[rows[i].getAttribute('data-widx')] = rows[i];
        }
        for (let r = minR; r <= maxR; r++) {
            const line = [];
            for (let c = minC; c <= maxC; c++) {
                let val = '';
                if (cellMap[r] && cellMap[r][c]) {
                    const row = rowMap[r];
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
        _excelGetVisibleRows().forEach(function (row) {
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

function _excelHandleCut(e) {
    /* Tylko gdy Excel otwarty */
    if (!document.getElementById('excel-table-overlay')) return;
    if (_excelSelectedCells.length === 0 && _excelSelectedCols.length === 0) return;
    /* ClipboardEvent ma clipboardData — wypełnij schowek (wzorzec jak Ctrl+C) */
    _excelHandleCopy(e);
    _excelSaveUndoSnapshot();
    _excelPasteInProgress = true;
    try {
        if (_excelSelectedCells.length > 0) {
            _excelSelectedCells.forEach(function (cell) {
                if (cell.colIdx === 3) return; /* nazwa studni — nigdy nie kasuj */
                const row = document.querySelector('tr[data-widx="' + cell.wIdx + '"]');
                if (!row) return;
                const td = row.children[cell.colIdx];
                const target = td ? td.querySelector('input, select') : null;
                if (!target) return;
                _excelSetCellValue(target, '');
            });
        } else {
            /* Zaznaczone kolumny — czyść we wszystkich widocznych wierszach */
            _excelGetVisibleRows().forEach(function (row) {
                _excelSelectedCols.forEach(function (colIdx) {
                    if (colIdx === 3) return; /* nazwa studni — nigdy nie kasuj */
                    const td = row.children[colIdx];
                    const target = td ? td.querySelector('input, select') : null;
                    if (target) _excelSetCellValue(target, '');
                });
            });
        }
        showToast('Wycinto: ' + _excelSelectedCells.length + ' komorek', 'info');
    } finally {
        _excelPasteInProgress = false;
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

    /* Jeden snapshot undo dla CAŁEGO wklejenia; flaga blokuje indywidualne
       snapshoty w handlerach zmian (per komórka) — inaczej stack undo
       przepełnia się po 20 komórkach i Ctrl+Z nie cofa wklejenia. */
    _excelSaveUndoSnapshot();
    _excelPasteInProgress = true;
    let _batched = false;
    const _finishPaste = function () {
        _excelPasteInProgress = false;
        /* W4: wyczyść martwą selekcję (tablice i klasy) + pełny re-render. */
        if (typeof _excelResetLayoutDependentState === 'function')
            _excelResetLayoutDependentState();
        _excelRenderTable(_excelActiveTab);
    };
    try {
        const rows = document.querySelectorAll('#excel-table-container tbody tr[data-widx]');
        if (rows.length === 0) return;
        let lines = text.trim().split('\n');
        for (let _pi = 0; _pi < lines.length; _pi++) {
            lines[_pi] = lines[_pi].replace(/\r$/, '');
        }
        // Wklejanie z nagłówkiem (zewnętrzny Excel): wykryj i zbuduj mapę semantyczną
        let _hasHeader = false;
        let _semanticMap = null;
        if (lines.length > 1) {
            const _firstParts = lines[0].split('\t');
            if (_excelDetectHeader(_firstParts)) {
                _hasHeader = true;
                _semanticMap = _excelBuildSemanticMap(_firstParts, _excelActiveTab || '1000');
                lines = lines.slice(1);
                // Rozszerz liczbę kolumn przejść jeśli nagłówek ma więcej niż tabela
                const _maxNeeded = Math.max(
                    ...Object.values(_semanticMap).map((c) => Math.floor((c - 7) / 4)),
                    -1
                );
                if (_maxNeeded >= 0) {
                    const _needTr = _maxNeeded + 1;
                    const _curTr =
                        (_excelMaxTransitions && _excelMaxTransitions[_excelActiveTab]) || 1;
                    if (_needTr > _curTr) {
                        _excelMaxTransitions[_excelActiveTab] = _needTr;
                        // Upewnij się że wells mają przejścia dla nowych kolumn
                        if (typeof wells !== 'undefined')
                            wells.forEach((w) => {
                                if (!_excelWellMatchesTab(w, _excelActiveTab)) return;
                                if (!w.przejscia) w.przejscia = [];
                                while (w.przejscia.length < _needTr)
                                    w.przejscia.push(_excelCreatePrzejscie());
                            });
                        _excelRenderTable(_excelActiveTab);
                    }
                }
            }
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
            /* Przy cell-selection NIE dodawaj nowych wierszy — obetnij do dostępnej liczby.
               Licz tylko WIDOCZNE wiersze o wIdx >= start (pomija wiersze ukryte filtrem) */
            const visibleRows = _excelGetVisibleRows().filter(function (r) {
                const rWIdx = parseInt(r.getAttribute('data-widx'), 10);
                return !isNaN(rWIdx) && rWIdx >= _baseWIdx;
            });
            const availableRows = visibleRows.length;
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
            _batched = lines.length > 100;
            const _pasteFn = _batched ? _excelPasteBatch : _excelPasteSync;
            _pasteFn(lines, visibleRows, _firstCol, _batched ? _finishPaste : null);
        } else if (_excelSelectedCols.length > 0) {
            const cols = [..._excelSelectedCols].sort(function (a, b) {
                return a - b;
            });
            /* Przy column-selection NIE dodawaj nowych wierszy — obetnij (tylko widoczne) */
            const visibleRows = _excelGetVisibleRows();
            if (lines.length > visibleRows.length) {
                lines = lines.slice(0, visibleRows.length);
                showToast('Wklejono ' + lines.length + ' (obcięte — koniec tabeli)', 'warning');
            }
            if (_hasHeader && _semanticMap) {
                lines.forEach(function (line, i) {
                    const parts = line.split('\t');
                    for (let ci = 0; ci < parts.length; ci++) {
                        const targetCol = _semanticMap[ci];
                        if (targetCol == null) continue;
                        if (cols.indexOf(targetCol) < 0) continue;
                        const tdInner = visibleRows[i] ? visibleRows[i].children[targetCol] : null;
                        const target = tdInner ? tdInner.querySelector('input, select') : null;
                        if (!target) continue;
                        _excelSetCellValue(target, parts[ci].replace(/\r/g, '').trim());
                    }
                });
            } else {
                lines.forEach(function (line, i) {
                    const parts = line.split('	');
                    cols.forEach(function (colIdx, ci) {
                        if (ci >= parts.length) return;
                        const tdInner = visibleRows[i] ? visibleRows[i].children[colIdx] : null;
                        const target = tdInner ? tdInner.querySelector('input, select') : null;
                        if (!target) return;
                        _excelSetCellValue(target, parts[ci].replace(/\r/g, '').trim());
                    });
                });
            }
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
            /* Pomija wiersze ukryte filtrem wyszukiwarki. */
            let visibleRows = _excelGetVisibleRows().filter(function (r) {
                const rWIdx = parseInt(r.getAttribute('data-widx'), 10);
                return !isNaN(rWIdx) && rWIdx >= startWIdx;
            });
            let availableRows = visibleRows.length;
            /* Jeśli wklejamy więcej wierszy niż mamy — auto-utwórz brakujące studnie (paste z zewn. Excela).
               Dotyczy głównie paste w kolumnę nazw (colIdx 3), ale działa dla dowolnej kolumny startowej. */
            if (lines.length > availableRows) {
                if (colIdx === 3) {
                    const surplus = lines.slice(availableRows);
                    let created = 0;
                    for (let si = 0; si < surplus.length; si++) {
                        const parts = surplus[si].split('	');
                        const rawName = (parts[0] || '').replace(/\r/g, '').trim();
                        if (!rawName) continue;
                        const dn = _excelActiveTab || '1000';
                        let dnVal = dn === 'styczne' ? 'styczna' : parseInt(dn, 10);
                        if (typeof dnVal === 'number' && isNaN(dnVal)) dnVal = 1000;
                        const well =
                            typeof createNewWell === 'function'
                                ? createNewWell(rawName, dnVal)
                                : {
                                      id: 'well_' + Date.now() + '_' + created + '_' + si,
                                      name: rawName,
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
                        well.name = rawName;
                        well.numer = rawName.replace(/ (PRE|UTH)$/, '');
                        if (typeof autoUpdateWellName === 'function') {
                            try {
                                autoUpdateWellName(well, wells.length);
                            } catch (_e) {}
                        }
                        wells.push(well);
                        if (typeof _excelAutoSetWlaz === 'function') {
                            try {
                                _excelAutoSetWlaz(well);
                            } catch (_e) {}
                        }
                        created++;
                    }
                    if (created > 0) {
                        if (typeof _excelGetMaxTransitions === 'function')
                            _excelMaxTransitions[_excelActiveTab] = _excelGetMaxTransitions();
                        // Re-render by dopisać wiersze do DOM przed dalszym paste reszty kolumn
                        if (typeof _excelRenderTable === 'function')
                            _excelRenderTable(_excelActiveTab);
                        // Odśwież listę widocznych po dodaniu
                        visibleRows = _excelGetVisibleRows().filter(function (r) {
                            const rWIdx = parseInt(r.getAttribute('data-widx'), 10);
                            return !isNaN(rWIdx) && rWIdx >= startWIdx;
                        });
                        availableRows = visibleRows.length;
                        // Jeśli wciąż nadmiar (np. puste nazwy), obetnij
                        if (lines.length > availableRows) {
                            lines = lines.slice(0, availableRows);
                        }
                    } else {
                        lines = lines.slice(0, availableRows);
                    }
                } else {
                    lines = lines.slice(0, availableRows);
                    if (lines.length === 0) {
                        showToast('Kliknij w istniejący wiersz — tu nie ma miejsca', 'warning');
                        return;
                    }
                    showToast('Wklejono ' + lines.length + ' (obcięte — koniec tabeli)', 'warning');
                }
            }
            /* Użyj batch/sync paste — obsłuż duże zestawy; header-aware via semantic map */
            _batched = lines.length > 100;
            if (_hasHeader && _semanticMap && Object.keys(_semanticMap).length > 0) {
                if (_batched)
                    _excelPasteSemanticBatch(lines, visibleRows, _semanticMap, _finishPaste);
                else _excelPasteSemantic(lines, visibleRows, _semanticMap);
                if (!_batched) _finishPaste();
                _batched = true; // suppress duplicate _finishPaste in finally
            } else {
                (_batched ? _excelPasteBatch : _excelPasteSync)(
                    lines,
                    visibleRows,
                    colIdx,
                    _batched ? _finishPaste : null
                );
            }
        }
    } finally {
        /* Batch (async, >100 wierszy) finalizuje flagę + re-render w doneCallback
           (_excelPasteBatch) — inaczej guard _excelPasteInProgress wygasłby przed
           pierwszym tickiem i każda komórka pchała osobny snapshot undo. */
        if (!_batched) _finishPaste();
    }
    showToast('Wklejono', 'info');
}

/* ===== BATCH PASTE (async chunked) ===== */
function _excelShowPasteProgress(now, total) {
    const pct = Math.min(100, Math.round((now / total) * 100));
    let el = document.getElementById('excel-paste-progress');
    if (!el) {
        el = document.createElement('div');
        el.id = 'excel-paste-progress';
        el.style.cssText =
            'position:fixed;bottom:1rem;right:1rem;z-index:' +
            LAYERS.TOAST +
            ';background:var(--bg-card);border:1px solid rgba(var(--white-rgb), 0.1);border-radius: var(--radius-sm);padding:0.75rem 1rem;min-width:260px;box-shadow:0 4px 20px rgba(var(--black-rgb), 0.5);';
        el.innerHTML =
            '<div style="font-size: var(--fs-xs);color:var(--slate-400);margin-bottom:0.35rem;">Wklejanie... <span id="excel-paste-pct">0%</span></div>' +
            '<div style="height:4px;background:var(--slate-950);border-radius:2px;overflow:hidden;">' +
            '<div id="excel-paste-bar" style="height:100%;width:0%;background:linear-gradient(90deg,var(--accent),var(--success));transition:width 0.15s;"></div></div>';
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

function _excelCancelPasteBatch() {
    if (_excelPasteRafId !== null) {
        cancelAnimationFrame(_excelPasteRafId);
        _excelPasteRafId = null;
    }
    _excelHidePasteProgress();
    _excelPasteInProgress = false;
    _excelBatchKragTouched = false;
}

/**
 * Wkleja dane wsadowo w chunkach przez requestAnimationFrame.
 * Nie blokuje UI.
 * @param {string[]} lines
 * @param {HTMLElement[]} visibleRows — widoczne wiersze docelowe (pomijają display:none)
 * @param {number} startColIdx
 * @param {Function|null} doneCallback
 */
function _excelPasteBatch(lines, visibleRows, startColIdx, doneCallback) {
    const CHUNK = 50;
    let idx = 0;
    const total = lines.length;
    if (total < 100) {
        _excelPasteSync(lines, visibleRows, startColIdx);
        if (doneCallback) doneCallback();
        return;
    }
    _excelShowPasteProgress(0, total);
    function tick() {
        if (!document.getElementById('excel-table-overlay')) {
            _excelCancelPasteBatch();
            return;
        }
        const end = Math.min(idx + CHUNK, total);
        for (; idx < end; idx++) {
            const line = lines[idx];
            const parts = line.split('	');
            const row = visibleRows[idx];
            if (!row) continue;
            parts.forEach(function (v, ci) {
                const colIdx = startColIdx + ci;
                const tdEl = row.children[colIdx];
                const target = tdEl ? tdEl.querySelector('input, select') : null;
                if (target) _excelSetCellValue(target, v.replace(/\r/g, '').trim());
            });
        }
        _excelShowPasteProgress(idx, total);
        if (idx < total) {
            _excelPasteRafId = requestAnimationFrame(tick);
        } else {
            _excelPasteRafId = null;
            _excelHidePasteProgress();
            if (doneCallback) doneCallback();
        }
    }
    _excelPasteRafId = requestAnimationFrame(tick);
}

/** Synchroniczne wklejenie (do 99 wierszy).
 * @param {string[]} lines
 * @param {HTMLElement[]} visibleRows — widoczne wiersze docelowe (pomijają display:none)
 * @param {number} startColIdx
 */
function _excelPasteSync(lines, visibleRows, startColIdx) {
    for (let si = 0; si < lines.length; si++) {
        const parts = lines[si].split('	');
        const row = visibleRows[si];
        if (!row) continue;
        parts.forEach(function (v, ci) {
            const colIdx = startColIdx + ci;
            const tdEl = row.children[colIdx];
            const target = tdEl ? tdEl.querySelector('input, select') : null;
            if (target) _excelSetCellValue(target, v.replace(/\r/g, '').trim());
        });
    }
}

/**
 * Ustawia wartość komórki (input lub select) i dispatchuje eventy.
 * @param {Element} target
 * @param {string} val
 */
function _excelSetCellValue(target, val) {
    /* Centralny punkt mutacji — blokada studni z PZ accepted / zamówieniem.
       Obejmuje paste, Delete, Ctrl+X, Ctrl+D, Ctrl+R (wszystkie ida przez to miejsce). */
    const tr = target && target.closest ? target.closest('tr[data-widx]') : null;
    const wIdx = tr ? parseInt(tr.getAttribute('data-widx'), 10) : -1;
    if (!isNaN(wIdx) && _excelIsWellLocked(wIdx)) return;
    const td = target && target.closest ? target.closest('td') : null;
    const colIdx =
        td && td.parentElement ? Array.prototype.indexOf.call(td.parentElement.children, td) : -1;
    /* Nazwa studni (colIdx 3) — przez paste/fill dozwolona (excelOnNameChange logic), blokuj tylko delete/cut (pusty val). */
    if (colIdx === 3) {
        const clean = String(val || '')
            .replace(/\r/g, '')
            .trim();
        if (!clean) return;
        if (isNaN(wIdx) || !wells[wIdx]) return;
        const well = wells[wIdx];
        well.name = clean;
        well.numer = clean.replace(/ (PRE|UTH)$/, '');
        if (typeof autoUpdateWellName === 'function') {
            try {
                autoUpdateWellName(well, wIdx);
            } catch (_e) {}
        }
        if (typeof _excelMarkDirty === 'function') {
            try {
                _excelMarkDirty();
            } catch (_e) {}
        }
        return;
    }
    if (target.tagName === 'SELECT') {
        const _sel = /** @type {HTMLSelectElement} */ (target);
        let opt = Array.from(_sel.options).find(function (o) {
            return o.value === val || o.text === val;
        });
        if (!opt) {
            const normVal = String(val).trim().toLowerCase();
            opt = Array.from(_sel.options).find(function (o) {
                return o.text.trim().toLowerCase() === normVal;
            });
        }
        if (!opt) {
            const numVal = String(val).replace(/\D/g, '');
            if (numVal) {
                opt = Array.from(_sel.options).find(function (o) {
                    return (
                        o.text.replace(/\D/g, '') === numVal ||
                        o.value.replace(/\D/g, '') === numVal
                    );
                });
            }
        }
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

/* ===== FILL ZAZNACZENIA (Ctrl+Enter) ===== */

/* Czysta funkcja budująca plan wypełnienia — bez DOM, testowalna.
   Pomija: kolumny strukturalne + nazwę (colIdx <= 3), aktywną komórkę
   (źródło wartości), wiersze ukryte filtrem (rowsMeta[w].hidden) i
   zablokowane (rowsMeta[w].locked). Zwraca posortowane, zdduplikowane komórki. */
function _excelBuildFillPlan(opts) {
    const cells = opts && opts.cells ? opts.cells : [];
    const cols = opts && opts.cols ? opts.cols : [];
    const active = opts && opts.active ? opts.active : null;
    const rowsMeta = (opts && opts.rowsMeta) || {};
    const plan = [];
    const seen = {};
    const add = function (wIdx, colIdx) {
        if (colIdx <= 3) return; /* strukturalne + nazwa studni — nigdy */
        const meta = rowsMeta[wIdx] || {};
        if (meta.hidden || meta.locked) return;
        if (active && wIdx === active.wIdx && colIdx === active.colIdx) return;
        const key = wIdx + ':' + colIdx;
        if (seen[key]) return;
        seen[key] = true;
        plan.push({ wIdx: wIdx, colIdx: colIdx });
    };
    cells.forEach(function (c) {
        add(c.wIdx, c.colIdx);
    });
    cols.forEach(function (ci) {
        Object.keys(rowsMeta).forEach(function (wk) {
            const wIdx = parseInt(wk, 10);
            if (!isNaN(wIdx)) add(wIdx, ci);
        });
    });
    plan.sort(function (a, b) {
        return a.wIdx - b.wIdx || a.colIdx - b.colIdx;
    });
    return plan;
}

/* Wypełnia zaznaczony zakres wartością komórki aktywnej (Ctrl+Enter).
   Jeden snapshot undo + flaga _excelPasteInProgress (wzorzec wklejania, #29). */
function _excelHandleFillDown() {
    if (_excelSelectedCells.length === 0 && _excelSelectedCols.length === 0) return;
    const activeEl = document.activeElement;
    let value = undefined;
    if (activeEl) {
        if (activeEl.tagName === 'INPUT' || activeEl.tagName === 'SELECT') {
            /* Źródło NIE może być checkboxem (wartość "on") ani kolumną
               strukturalną (checkbox 0, A/M 1, Lp 2, nazwa 3) — nadpisałoby
               komórki danych bezsensowną wartością (S1). */
            if (activeEl.tagName === 'INPUT' && activeEl.type === 'checkbox') return;
            const srcTd = activeEl.closest('td');
            let srcColIdx = -1;
            if (srcTd && srcTd.parentElement) {
                srcColIdx = Array.from(srcTd.parentElement.children).indexOf(srcTd);
            }
            if (srcColIdx >= 0 && srcColIdx <= 3) return;
            value = /** @type {HTMLInputElement | HTMLSelectElement} */ (activeEl).value;
        } else {
            const wrap = activeEl.closest ? activeEl.closest('td') : null;
            if (wrap) {
                const t = wrap.querySelector('input, select');
                if (t) value = /** @type {HTMLInputElement | HTMLSelectElement} */ (t).value;
            }
        }
    }
    if (value === undefined) return;
    /* rowsMeta: ukrycie filtrem + blokada PZ per wiersz */
    const rowsMeta = {};
    document.querySelectorAll('#excel-table-container tbody tr[data-widx]').forEach(function (row) {
        const wIdx = parseInt(row.getAttribute('data-widx'), 10);
        if (isNaN(wIdx)) return;
        rowsMeta[wIdx] = {
            hidden: row.style.display === 'none',
            locked: typeof _excelIsWellLocked === 'function' && _excelIsWellLocked(wIdx)
        };
    });
    const active =
        _excelLastClickedCell && _excelLastClickedCell.wIdx !== undefined
            ? _excelLastClickedCell
            : null;
    const plan = _excelBuildFillPlan({
        cells: _excelSelectedCells,
        cols: _excelSelectedCols,
        active: active,
        rowsMeta: rowsMeta
    });
    if (plan.length === 0) return;
    if (typeof _excelBatchKragTouched !== 'undefined') _excelBatchKragTouched = false;
    _excelSaveUndoSnapshot();
    _excelPasteInProgress = true;
    try {
        plan.forEach(function (cell) {
            const row = document.querySelector('tr[data-widx="' + cell.wIdx + '"]');
            if (!row) return;
            const td = row.children[cell.colIdx];
            const target = td ? td.querySelector('input, select') : null;
            if (target) _excelSetCellValue(target, value);
        });
        /* Krag/krag_ot: jeden pełny render po całym fill (konwersja musi pokazać
           finalny config), zamiast re-rendera po każdej komórce (H1). */
        if (typeof _excelBatchKragTouched !== 'undefined' && _excelBatchKragTouched) {
            _excelBatchKragTouched = false;
            if (typeof _excelRenderTable === 'function') _excelRenderTable(_excelActiveTab);
        }
        _excelDebouncedRefresh();
        showToast('Wypełniono ' + plan.length + ' komórek', 'info');
    } finally {
        _excelPasteInProgress = false;
    }
}
