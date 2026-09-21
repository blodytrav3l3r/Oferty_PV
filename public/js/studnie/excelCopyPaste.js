// @ts-check
/* ===== EXCEL COPY / PASTE (schowek, wklejanie, batch, fill zaznaczenia) ===== */
let _excelPasteRafId = null;

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
function _excelPasteSemantic(lines, visibleRows, map, ctx, snapshot) {
    // ctx opcjonalny — F1 lokalny cache dla Rodzaj/Średnica
    const _filtered = Array.isArray(snapshot) ? snapshot : _excelSnapshotFiltered();
    const _rowMap = _excelBuildRowMap();
    let _startFilteredIdx = 0;
    if (
        visibleRows &&
        visibleRows.length > 0 &&
        visibleRows[0] &&
        typeof visibleRows[0].getAttribute === 'function'
    ) {
        const firstWIdx = parseInt(visibleRows[0].getAttribute('data-widx'), 10);
        const pos = _filtered.indexOf(firstWIdx);
        if (pos >= 0) _startFilteredIdx = pos;
    }
    for (let si = 0; si < lines.length; si++) {
        const parts = lines[si].split('\t');
        const modelWIdx = _filtered[_startFilteredIdx + si];
        if (modelWIdx === undefined || !wells[modelWIdx]) {
            _excelPasteCountSkipped(ctx, parts.length);
            continue;
        }
        const row = _excelResolvePasteRow(_rowMap, visibleRows, si, modelWIdx);
        for (let ci = 0; ci < parts.length; ci++) {
            const targetCol = map[ci];
            if (targetCol == null) {
                _excelPasteCountSkipped(ctx, 1);
                continue;
            }
            const targetVal = parts[ci].replace(/\r/g, '').trim();
            const tdEl = row ? _excelGetCellByLogical(row, targetCol) : null;
            const target = tdEl ? tdEl.querySelector('input, select') : null;
            _excelPasteCount(
                ctx,
                _excelSetModelCellValue(modelWIdx, targetCol, targetVal, ctx, target)
            );
        }
    }
}
function _excelPasteSemanticBatch(lines, visibleRows, map, doneCallback, ctx, snapshot) {
    const CHUNK = 50;
    let idx = 0;
    const total = lines.length;
    if (total < 100) {
        _excelPasteSemantic(
            lines,
            visibleRows,
            map,
            ctx,
            Array.isArray(snapshot) ? snapshot : _excelSnapshotFiltered()
        );
        if (doneCallback) doneCallback();
        return;
    }
    const _filtered = Array.isArray(snapshot) ? snapshot : _excelSnapshotFiltered();
    let _startFilteredIdx = 0;
    if (
        visibleRows &&
        visibleRows.length > 0 &&
        visibleRows[0] &&
        typeof visibleRows[0].getAttribute === 'function'
    ) {
        const firstWIdx = parseInt(visibleRows[0].getAttribute('data-widx'), 10);
        const pos = _filtered.indexOf(firstWIdx);
        if (pos >= 0) _startFilteredIdx = pos;
    }
    _excelShowPasteProgress(0, total);
    function tick() {
        if (!document.getElementById('excel-table-overlay')) {
            _excelCancelPasteBatch();
            return;
        }
        const _rowMap = _excelBuildRowMap(); // świeża mapa co tick (chunk 50)
        const end = Math.min(idx + CHUNK, total);
        for (; idx < end; idx++) {
            const parts = lines[idx].split('\t');
            const modelWIdx = _filtered[_startFilteredIdx + idx];
            if (modelWIdx === undefined || !wells[modelWIdx]) {
                _excelPasteCountSkipped(ctx, parts.length);
                continue;
            }
            const row = _excelResolvePasteRow(_rowMap, visibleRows, idx, modelWIdx);
            for (let ci = 0; ci < parts.length; ci++) {
                const targetCol = map[ci];
                if (targetCol == null) {
                    _excelPasteCountSkipped(ctx, 1);
                    continue;
                }
                const targetVal = parts[ci].replace(/\r/g, '').trim();
                const tdEl = row ? _excelGetCellByLogical(row, targetCol) : null;
                const target = tdEl ? tdEl.querySelector('input, select') : null;
                _excelPasteCount(
                    ctx,
                    _excelSetModelCellValue(modelWIdx, targetCol, targetVal, ctx, target)
                );
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
    /* Tylko gdy Excel otwarty i brak innego aktywnego modala */
    if (!document.getElementById('excel-table-overlay')) return;
    if (
        document.activeElement &&
        document.activeElement.closest('.modal-overlay:not(#excel-table-overlay)')
    )
        return;
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
    /* Tylko gdy Excel otwarty i brak innego aktywnego modala */
    if (!document.getElementById('excel-table-overlay')) return;
    if (
        document.activeElement &&
        document.activeElement.closest('.modal-overlay:not(#excel-table-overlay)')
    )
        return;
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
    _excelResetMismatches();
    let _batched = false;
    // F1 lokalny ctx jednego paste — nie global, przekazywany do Sync/Batch/Semantic
    const _pasteCtx = typeof _excelBuildPasteCache === 'function' ? _excelBuildPasteCache() : null;
    if (_pasteCtx) _pasteCtx.stats = _excelPasteStatsNew();
    /* Zamrożona mapa adresowania na cały paste (wells[] + pasteFiltered[] = SSoT,
       DOM tylko do odczytu). Snapshot PO ewentualnym auto-tworzeniu studni —
       gałąź default resetuje _pasteFiltered po dopisaniu studni. */
    let _pasteFiltered = null;
    const _ensurePasteFiltered = function () {
        if (!_pasteFiltered) _pasteFiltered = _excelSnapshotFiltered();
        return _pasteFiltered;
    };
    const _finishPaste = function () {
        // batch finalize: zachowaj semantykę change handlerów raz dla affected wells (Q1)
        if (_pasteCtx)
            try {
                _excelFinalizePasteAffected(_pasteCtx);
            } catch (_e) {}
        /* Przelicz błędy dotkniętych studni PRZED re-renderem — inaczej tabela
           czyta stary configStatus (D1). */
        if (_pasteCtx && _pasteCtx.affected && _pasteCtx.affected.size > 0) {
            if (typeof recalculateWellErrors === 'function') {
                _pasteCtx.affected.forEach(function (wIdx) {
                    var w = typeof wells !== 'undefined' ? wells[wIdx] : null;
                    if (!w) return;
                    try {
                        recalculateWellErrors(w);
                    } catch (_e) {}
                });
            }
        } else if (typeof recalculateWellErrors === 'function' && typeof wells !== 'undefined') {
            for (var _ri = 0; _ri < wells.length; _ri++) {
                if (!wells[_ri]) continue;
                if (typeof _excelWellMatchesTab === 'function') {
                    try {
                        if (!_excelWellMatchesTab(wells[_ri], _excelActiveTab)) continue;
                    } catch (_e) {}
                }
                try {
                    recalculateWellErrors(wells[_ri]);
                } catch (_e) {}
            }
        }
        _excelPasteInProgress = false;
        /* W4: wyczyść martwą selekcję (tablice i klasy) + pełny re-render. */
        if (typeof _excelResetLayoutDependentState === 'function')
            _excelResetLayoutDependentState();
        _excelRenderTable(_excelActiveTab);
        if (typeof _excelRefreshDupColors === 'function')
            try {
                _excelRefreshDupColors();
            } catch (_e) {}
        if (typeof _excelMarkDirty === 'function')
            try {
                _excelMarkDirty();
            } catch (_e) {}
        if (typeof window.refreshAll === 'function') {
            try {
                window.refreshAll();
            } catch (_e) {}
        } else {
            if (typeof window.updateSummary === 'function')
                try {
                    window.updateSummary();
                } catch (_e) {}
            if (typeof window.renderWellsList === 'function')
                try {
                    window.renderWellsList();
                } catch (_e) {}
            if (typeof window.renderWellDiagram === 'function')
                try {
                    window.renderWellDiagram();
                } catch (_e) {}
        }
        if (window._excelPasteMismatches && window._excelPasteMismatches.length > 0) {
            setTimeout(() => {
                if (window._excelPasteMismatches && window._excelPasteMismatches.length > 0)
                    _excelShowMismatchModal(window._excelPasteMismatches);
            }, 120);
        }
        /* Raport kompletności: applied + locked + unsupported === total.
           Mismatches to flaga jakości części applied, nie osobna partycja. */
        if (_pasteCtx && _pasteCtx.stats && _pasteCtx.stats.total > 0) {
            const _st = _pasteCtx.stats;
            if (
                _st.applied + _st.locked + _st.unsupported !== _st.total &&
                typeof console !== 'undefined' &&
                console.warn
            ) {
                try {
                    console.warn('[Excel paste] invariant applied+locked+unsupported!==total', _st);
                } catch (_e) {}
            }
            if (typeof _excelInvalidateFilteredIndexes === 'function') {
                try {
                    _excelInvalidateFilteredIndexes();
                } catch (_e) {}
            }
            if (typeof showToast === 'function') {
                const _extra = [];
                if (_st.locked > 0) _extra.push('zablokowanych: ' + _st.locked);
                if (_st.unsupported > 0) _extra.push('pominiętych: ' + _st.unsupported);
                showToast(
                    'Wklejono ' +
                        _st.applied +
                        ' z ' +
                        _st.total +
                        ' komórek' +
                        (_extra.length > 0 ? ' (' + _extra.join(', ') + ')' : ''),
                    _st.unsupported + _st.locked > 0 ? 'warning' : 'success'
                );
            }
        }
        if (typeof _excelAutoSelectEnabled !== 'undefined' && _excelAutoSelectEnabled) {
            const toAuto = [];
            for (let i = 0; i < wells.length; i++) {
                const w = wells[i];
                if (!w || w.autoSelect === false) continue;
                if (_excelIsWellLocked(i)) continue;
                if (w.rzednaWlazu == null || w.rzednaDna == null) continue;
                if (parseFloat(w.rzednaWlazu) <= parseFloat(w.rzednaDna)) continue;
                toAuto.push(i);
            }
            const recent = toAuto.slice(-5);
            recent.forEach((wIdx, k) => {
                setTimeout(
                    () => {
                        if (typeof _excelAutoSelectForWell === 'function')
                            _excelAutoSelectForWell(wIdx).catch(() => {});
                    },
                    200 + k * 300
                );
            });
        }
    };
    try {
        const rows = document.querySelectorAll('#excel-table-container tbody tr[data-widx]');
        if (rows.length === 0) return;
        // Geometria schowka: pusta komórka = "" nie brak — trim() zjadał wiodące puste wiersze (bug Średnica 2)
        const _raw = text.replace(/\r/g, '');
        let lines = _raw.split('\n');
        if (_raw.endsWith('\n')) lines.pop();
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
                        if (typeof _pasteCtx !== 'undefined' && _pasteCtx)
                            _excelRebuildPasteSeq(_pasteCtx);
                    }
                }
            }
        }
        // Fallback: dane bez nagłówka ale cała tabela (np. 7/15 kol) — zbuduj mapę pseudonagłówka
        if (!_hasHeader && lines.length > 0) {
            const _firstParts = lines[0].split('\t');
            if (_firstParts.length >= 7) {
                const _firstCell = _firstParts[0].replace(/\r/g, '').trim();
                const _isName =
                    _firstCell &&
                    /[a-zA-Z]/.test(_firstCell) &&
                    isNaN(parseFloat(_firstCell.replace(',', '.')));
                if (_isName) {
                    const _colCount = _firstParts.length;
                    let _N = 1;
                    if ((_colCount - 3) % 4 === 0) _N = (_colCount - 3) / 4;
                    else if ((_colCount - 3) % 3 === 0) _N = (_colCount - 3) / 3;
                    else _N = Math.floor((_colCount - 3) / 4) || 1;
                    const _pseudo = ['Nr Studni', 'Rz. Wlazu', 'Rz. Dna'];
                    for (let _pi = 0; _pi < _N; _pi++) {
                        if ((_colCount - 3) % 4 === 0)
                            _pseudo.push(
                                `Rz.wlot ${_pi}`,
                                `Kąt ${_pi}`,
                                `Rodzaj ${_pi}`,
                                `Średnica ${_pi}`
                            );
                        else _pseudo.push(`Rz.wlot ${_pi}`, `Kąt ${_pi}`, `Średnica ${_pi}`);
                    }
                    if (_pseudo.length === _colCount) {
                        _semanticMap = _excelBuildSemanticMap(_pseudo, _excelActiveTab || '1000');
                        _hasHeader = true;
                        const _maxNeeded2 = Math.max(
                            ...Object.values(_semanticMap).map((c) => Math.floor((c - 7) / 4)),
                            -1
                        );
                        if (_maxNeeded2 >= 0) {
                            const _needTr2 = _maxNeeded2 + 1;
                            const _curTr2 =
                                (_excelMaxTransitions && _excelMaxTransitions[_excelActiveTab]) ||
                                1;
                            if (_needTr2 > _curTr2) {
                                _excelMaxTransitions[_excelActiveTab] = _needTr2;
                                if (typeof wells !== 'undefined')
                                    wells.forEach((w) => {
                                        if (!_excelWellMatchesTab(w, _excelActiveTab)) return;
                                        if (!w.przejscia) w.przejscia = [];
                                        while (w.przejscia.length < _needTr2)
                                            w.przejscia.push(_excelCreatePrzejscie());
                                    });
                                _excelRenderTable(_excelActiveTab);
                                if (typeof _pasteCtx !== 'undefined' && _pasteCtx)
                                    _excelRebuildPasteSeq(_pasteCtx);
                            }
                        }
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
            // Faza A: sort/min origin — najnizszy colIdx wsrod wszystkich zaznaczonych, nie insertion order
            const _allColsFlat = cellList.map(function (c) {
                return c.colIdx;
            });
            const _minCol =
                _allColsFlat.length > 0
                    ? Math.min.apply(null, _allColsFlat)
                    : _excelGetPasteColIdx(rows[0]);
            const _baseColsSorted =
                widxArr.length > 0 && cellRows[_baseWIdx]
                    ? [...cellRows[_baseWIdx]].sort(function (a, b) {
                          return a - b;
                      })
                    : [_minCol];
            const _baseCols = _baseColsSorted;
            /* Przy cell-selection NIE dodawaj nowych wierszy — obetnij do dostępnej liczby W MODELU.
               Licz od _baseWIdx do końca odfiltrowanych studni w modelu. */
            const _filteredSel =
                typeof _excelGetFilteredIndexes === 'function' ? _excelGetFilteredIndexes() : [];
            const _startPosInFiltered = Math.max(0, _filteredSel.indexOf(_baseWIdx));
            const availableRows = Math.max(0, _filteredSel.length - _startPosInFiltered);
            const visibleRows = _excelGetVisibleRows().filter(function (r) {
                const rWIdx = parseInt(r.getAttribute('data-widx'), 10);
                return !isNaN(rWIdx) && rWIdx >= _baseWIdx;
            });
            if (lines.length > availableRows) {
                lines = lines.slice(0, availableRows);
                if (lines.length === 0) {
                    showToast('Kliknij w istniejący wiersz — tu nie ma miejsca', 'warning');
                    return;
                }
                showToast('Wklejono ' + lines.length + ' (obcięte — koniec tabeli)', 'warning');
            }
            // Faza A: base row min (nie global) — globalMin dawał poziomy shift przy nieprostokątnej selekcji (H2)
            const _firstCol =
                _baseColsSorted.length > 0 ? Math.min.apply(null, _baseColsSorted) : _minCol;
            /* Użyj batch/sync paste — obsłuż duże zestawy (F1 ctx przekazany, seq w ctx) */
            _batched = lines.length > 100;
            if (_batched) {
                if (_pasteCtx)
                    _excelPasteBatch(
                        lines,
                        visibleRows,
                        _firstCol,
                        _finishPaste,
                        _pasteCtx,
                        _ensurePasteFiltered()
                    );
                else
                    _excelPasteBatch(
                        lines,
                        visibleRows,
                        _firstCol,
                        _finishPaste,
                        null,
                        _ensurePasteFiltered()
                    );
            } else {
                if (_pasteCtx)
                    _excelPasteSync(
                        lines,
                        visibleRows,
                        _firstCol,
                        _pasteCtx,
                        _ensurePasteFiltered()
                    );
                else _excelPasteSync(lines, visibleRows, _firstCol, null, _ensurePasteFiltered());
            }
        } else if (_excelSelectedCols.length > 0) {
            const cols = [..._excelSelectedCols].sort(function (a, b) {
                return a - b;
            });
            /* Przy column-selection NIE dodawaj nowych wierszy — obetnij do liczby studni w modelu */
            const _filteredCols =
                typeof _excelGetFilteredIndexes === 'function' ? _excelGetFilteredIndexes() : [];
            const availableRows = _filteredCols.length;
            if (lines.length > availableRows) {
                lines = lines.slice(0, availableRows);
                if (lines.length === 0) {
                    showToast('Brak studni na tej zakładce', 'warning');
                    return;
                }
                showToast('Wklejono ' + lines.length + ' (obcięte — koniec tabeli)', 'warning');
            }
            const visibleRows = _excelGetVisibleRows();
            _batched = lines.length > 100;
            if (_hasHeader && _semanticMap) {
                if (_batched) {
                    if (_pasteCtx)
                        _excelPasteSemanticBatch(
                            lines,
                            visibleRows,
                            _semanticMap,
                            _finishPaste,
                            _pasteCtx,
                            _ensurePasteFiltered()
                        );
                    else
                        _excelPasteSemanticBatch(
                            lines,
                            visibleRows,
                            _semanticMap,
                            _finishPaste,
                            null,
                            _ensurePasteFiltered()
                        );
                } else {
                    if (_pasteCtx)
                        _excelPasteSemantic(
                            lines,
                            visibleRows,
                            _semanticMap,
                            _pasteCtx,
                            _ensurePasteFiltered()
                        );
                    else
                        _excelPasteSemantic(
                            lines,
                            visibleRows,
                            _semanticMap,
                            null,
                            _ensurePasteFiltered()
                        );
                }
                if (!_batched) _finishPaste();
                _batched = true;
            } else {
                if (_batched) {
                    if (_pasteCtx)
                        _excelPasteBatch(
                            lines,
                            visibleRows,
                            cols[0] || 3,
                            _finishPaste,
                            _pasteCtx,
                            _ensurePasteFiltered()
                        );
                    else
                        _excelPasteBatch(
                            lines,
                            visibleRows,
                            cols[0] || 3,
                            _finishPaste,
                            null,
                            _ensurePasteFiltered()
                        );
                } else {
                    if (_pasteCtx)
                        _excelPasteSync(
                            lines,
                            visibleRows,
                            cols[0] || 3,
                            _pasteCtx,
                            _ensurePasteFiltered()
                        );
                    else
                        _excelPasteSync(
                            lines,
                            visibleRows,
                            cols[0] || 3,
                            null,
                            _ensurePasteFiltered()
                        );
                }
                if (!_batched) _finishPaste();
                _batched = true;
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
            /* Pomija wiersze ukryte filtrem wyszukiwarki. Licz wiersze W MODELU od startWIdx. */
            const _filteredDef =
                typeof _excelGetFilteredIndexes === 'function' ? _excelGetFilteredIndexes() : [];
            const _startPosInFiltered = Math.max(0, _filteredDef.indexOf(startWIdx));
            let availableRows = Math.max(0, _filteredDef.length - _startPosInFiltered);
            const visibleRows = _excelGetVisibleRows().filter(function (r) {
                const rWIdx = parseInt(r.getAttribute('data-widx'), 10);
                return !isNaN(rWIdx) && rWIdx >= startWIdx;
            });
            /* Jeśli wklejamy więcej wierszy niż mamy — auto-utwórz brakujące studnie (paste z zewn. Excela).
               Dotyczy głównie paste w kolumnę nazw (colIdx 3) lub danych z nagłówkiem/zewnętrznym formatem. */
            if (lines.length > availableRows) {
                if (colIdx === 3 || (_hasHeader && _semanticMap)) {
                    const surplus = lines.slice(availableRows);
                    let created = 0;
                    for (let si = 0; si < surplus.length; si++) {
                        const parts = surplus[si].split('\t');
                        const rawName =
                            (parts[0] || '').replace(/\r/g, '').trim() ||
                            'Studnia (' + (wells.length + 1) + ')';
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
                        if (typeof _excelRebuildWellIndex === 'function') _excelRebuildWellIndex();
                        if (typeof _excelInvalidateFilteredIndexes === 'function')
                            _excelInvalidateFilteredIndexes();
                        if (typeof _excelGetMaxTransitions === 'function')
                            _excelMaxTransitions[_excelActiveTab] = _excelGetMaxTransitions();
                        const _updatedFiltered =
                            typeof _excelGetFilteredIndexes === 'function'
                                ? _excelGetFilteredIndexes()
                                : [];
                        availableRows = Math.max(0, _updatedFiltered.length - _startPosInFiltered);
                        /* Studnie dopisane — snapshot adresowania buduj PO tym punkcie. */
                        _pasteFiltered = null;
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
            /* Użyj batch/sync paste — obsłuż duże zestawy; header-aware via semantic map (F1 ctx) */
            _batched = lines.length > 100;
            if (_hasHeader && _semanticMap && Object.keys(_semanticMap).length > 0) {
                if (_batched) {
                    if (_pasteCtx)
                        _excelPasteSemanticBatch(
                            lines,
                            visibleRows,
                            _semanticMap,
                            _finishPaste,
                            _pasteCtx,
                            _ensurePasteFiltered()
                        );
                    else
                        _excelPasteSemanticBatch(
                            lines,
                            visibleRows,
                            _semanticMap,
                            _finishPaste,
                            null,
                            _ensurePasteFiltered()
                        );
                } else {
                    if (_pasteCtx)
                        _excelPasteSemantic(
                            lines,
                            visibleRows,
                            _semanticMap,
                            _pasteCtx,
                            _ensurePasteFiltered()
                        );
                    else
                        _excelPasteSemantic(
                            lines,
                            visibleRows,
                            _semanticMap,
                            null,
                            _ensurePasteFiltered()
                        );
                }
                if (!_batched) _finishPaste();
                _batched = true; // suppress duplicate _finishPaste in finally
            } else {
                if (_pasteCtx)
                    (_batched ? _excelPasteBatch : _excelPasteSync)(
                        lines,
                        visibleRows,
                        colIdx,
                        _batched ? _finishPaste : null,
                        _pasteCtx,
                        _ensurePasteFiltered()
                    );
                else
                    (_batched ? _excelPasteBatch : _excelPasteSync)(
                        lines,
                        visibleRows,
                        colIdx,
                        _batched ? _finishPaste : null,
                        null,
                        _ensurePasteFiltered()
                    );
            }
        }
    } finally {
        /* Batch (async, >100 wierszy) finalizuje flagę + re-render w doneCallback
           (_excelPasteBatch) — inaczej guard _excelPasteInProgress wygasłby przed
           pierwszym tickiem i każda komórka pchała osobny snapshot undo. */
        if (!_batched) _finishPaste();
    }
    /* Ścieżka sync raportuje szczegółowo w _finishPaste; tu tylko sygnał startu batcha async. */
    if (_batched) showToast('Wklejanie w tle...', 'info');
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
            ';background:var(--bg-card);border:1px solid var(--excel-border);border-radius: var(--radius-sm);padding:0.75rem 1rem;min-width:260px;box-shadow:var(--excel-shadow);';
        el.innerHTML =
            '<div style="font-size: var(--fs-xs);color:var(--excel-text-dim);margin-bottom:0.35rem;">Wklejanie... <span id="excel-paste-pct">0%</span></div>' +
            '<div style="height:4px;background:var(--excel-bg-alt);border-radius:2px;overflow:hidden;">' +
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
 * @param {*} [ctx] - F1 lokalny cache, przekazywany do _excelSetCellValue
 * @param {number[]|null} [snapshot] - zamrożona mapa adresowania (pasteFiltered)
 */
function _excelPasteBatch(lines, visibleRows, startColIdx, doneCallback, ctx, snapshot) {
    const CHUNK = 50;
    let idx = 0;
    const total = lines.length;
    const seqBatch = ctx && ctx.seq ? ctx.seq : null;
    const startPosBatch = seqBatch ? _excelFindSeqPosByVis(seqBatch, startColIdx) : -1;
    if (total < 100) {
        _excelPasteSync(lines, visibleRows, startColIdx, ctx, snapshot);
        if (doneCallback) doneCallback();
        return;
    }
    const _filtered = Array.isArray(snapshot) ? snapshot : _excelSnapshotFiltered();
    let _startFilteredIdx = 0;
    if (visibleRows && visibleRows.length > 0 && visibleRows[0]) {
        const firstWIdx = parseInt(visibleRows[0].getAttribute('data-widx'), 10);
        const pos = _filtered.indexOf(firstWIdx);
        if (pos >= 0) _startFilteredIdx = pos;
    }
    _excelShowPasteProgress(0, total);
    function tick() {
        if (!document.getElementById('excel-table-overlay')) {
            _excelCancelPasteBatch();
            return;
        }
        const _rowMap = _excelBuildRowMap(); // świeża mapa co tick (chunk 50)
        const end = Math.min(idx + CHUNK, total);
        for (; idx < end; idx++) {
            const line = lines[idx];
            const parts = line.split('\t');
            const modelWIdx = _filtered[_startFilteredIdx + idx];
            if (modelWIdx === undefined || !wells[modelWIdx]) {
                _excelPasteCountSkipped(ctx, parts.length);
                continue;
            }
            const row = _excelResolvePasteRow(_rowMap, visibleRows, idx, modelWIdx);
            parts.forEach(function (v, ci) {
                let visIdx, logical;
                if (seqBatch && startPosBatch >= 0) {
                    const entry = seqBatch[startPosBatch + ci];
                    if (!entry) {
                        _excelPasteCountSkipped(ctx, 1);
                        return;
                    }
                    visIdx = entry.vis;
                    logical = entry.logical;
                } else {
                    visIdx = startColIdx + ci;
                    logical = visIdx;
                }
                const targetVal = v.replace(/\r/g, '').trim();
                const tdEl = row && row.children ? row.children[visIdx] : null;
                const target = tdEl ? tdEl.querySelector('input, select') : null;
                _excelPasteCount(
                    ctx,
                    _excelSetModelCellValue(modelWIdx, logical, targetVal, ctx, target)
                );
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

/** Synchroniczne wklejenie (do 99 wierszy). Semantyka A: wklej sekwencyjnie do widocznych TD.
 * @param {string[]} lines
 * @param {HTMLElement[]} visibleRows — widoczne wiersze docelowe (pomijają display:none)
 * @param {number} startColIdx — visibleIdx (row.children index, nie logical)
 * @param {*} [ctx] - F1 lokalny cache
 * @param {number[]|null} [snapshot] - zamrożona mapa adresowania (pasteFiltered)
 */
function _excelPasteSync(lines, visibleRows, startColIdx, ctx, snapshot) {
    const seq = ctx && ctx.seq ? ctx.seq : null;
    const startPos = seq ? _excelFindSeqPosByVis(seq, startColIdx) : -1;
    const _filtered = Array.isArray(snapshot) ? snapshot : _excelSnapshotFiltered();
    const _rowMap = _excelBuildRowMap();
    let _startFilteredIdx = 0;
    if (
        visibleRows &&
        visibleRows.length > 0 &&
        visibleRows[0] &&
        typeof visibleRows[0].getAttribute === 'function'
    ) {
        const firstWIdx = parseInt(visibleRows[0].getAttribute('data-widx'), 10);
        const pos = _filtered.indexOf(firstWIdx);
        if (pos >= 0) _startFilteredIdx = pos;
    }
    for (let si = 0; si < lines.length; si++) {
        const parts = lines[si].split('\t');
        const modelWIdx = _filtered[_startFilteredIdx + si];
        if (modelWIdx === undefined || !wells[modelWIdx]) {
            _excelPasteCountSkipped(ctx, parts.length);
            continue;
        }
        const row = _excelResolvePasteRow(_rowMap, visibleRows, si, modelWIdx);
        parts.forEach(function (v, ci) {
            let visIdx, logical;
            if (seq && startPos >= 0) {
                const entry = seq[startPos + ci];
                if (!entry) {
                    _excelPasteCountSkipped(ctx, 1);
                    return;
                }
                visIdx = entry.vis;
                logical = entry.logical;
            } else {
                visIdx = startColIdx + ci;
                logical = visIdx;
            }
            const targetVal = v.replace(/\r/g, '').trim();
            const tdEl = row && row.children ? row.children[visIdx] : null;
            const target = tdEl ? tdEl.querySelector('input, select') : null;
            _excelPasteCount(
                ctx,
                _excelSetModelCellValue(modelWIdx, logical, targetVal, ctx, target)
            );
        });
    }
}

/** Zapewnia bezpośredni zapis wartości do modelu studni (obsługuje wirtualizację, gdy brak elementu TR w DOM).
 * Zwraca status: 'applied' | 'locked' | 'unsupported' (do licznika raportu paste). */
function _excelSetModelCellValue(wIdx, effLogical, val, ctx, targetElement) {
    if (isNaN(wIdx) || wIdx < 0 || typeof wells === 'undefined' || !wells[wIdx])
        return 'unsupported';
    if (typeof _excelIsWellLocked === 'function' && _excelIsWellLocked(wIdx)) return 'locked';

    if (targetElement) {
        return _excelSetCellValue(targetElement, val, ctx, effLogical);
    }

    const well = wells[wIdx];
    const valStr = String(val || '').trim();

    if (effLogical === 3) {
        if (!valStr) return 'unsupported'; /* nazwa studni — nigdy nie kasuj */
        const well = wells[wIdx];
        well.name = valStr;
        well.numer = valStr.replace(/ (PRE|UTH)$/i, '').trim();
        if (typeof autoUpdateWellName === 'function') {
            try {
                autoUpdateWellName(well, wIdx);
            } catch (_e) {}
        }
    } else if (effLogical === 4) {
        const num = parseFloat(valStr.replace(',', '.'));
        well.rzednaWlazu = !isNaN(num) ? num : null;
    } else if (effLogical === 5) {
        const num = parseFloat(valStr.replace(',', '.'));
        well.rzednaDna = !isNaN(num) ? num : null;
    } else if (_excelModelLogicalIsPrzejscie(effLogical)) {
        const maxTr =
            typeof _excelMaxTransitions !== 'undefined' && _excelMaxTransitions[_excelActiveTab]
                ? _excelMaxTransitions[_excelActiveTab]
                : 1;
        const trIdx = Math.floor((effLogical - 7) / 4);
        if (trIdx < maxTr) {
            const subType = (effLogical - 7) % 4;
            if (!well.przejscia) well.przejscia = [];
            while (well.przejscia.length <= trIdx) {
                if (typeof _excelCreatePrzejscie === 'function')
                    well.przejscia.push(_excelCreatePrzejscie());
                else
                    well.przejscia.push({
                        productId: '',
                        tempCategory: '',
                        rzednaWlaczenia: null,
                        angle: 0,
                        angleExecution: 0,
                        angleGony: 0,
                        flowType: 'PRZELOT'
                    });
            }
            const prz = well.przejscia[trIdx];
            if (subType === 0) {
                const num = parseFloat(valStr.replace(',', '.'));
                // Cichy clamp do zakresu dno–właz (ścieżka quiet: batch bez toastów
                // i modali; jak excelOnPrzejscieChange w _excelPasteQuiet).
                if (!isNaN(num) && typeof clampRzednaWlaczenia === 'function') {
                    prz.rzednaWlaczenia = clampRzednaWlaczenia(num, well).value;
                } else {
                    prz.rzednaWlaczenia = !isNaN(num) ? num : null;
                }
            } else if (subType === 1) {
                const num = parseFloat(valStr.replace(',', '.'));
                if (!isNaN(num)) {
                    prz.angle = num;
                    prz.angleExecution = num;
                    prz.angleGony =
                        typeof window !== 'undefined' && typeof window.degToGon === 'function'
                            ? window.degToGon(num)
                            : ((num * 400) / 360).toFixed(2);
                }
            } else if (subType === 2) {
                if (!valStr) {
                    prz.tempCategory = '';
                    prz.productId = '';
                } else if (ctx && (ctx.catLowerMap || ctx.cats)) {
                    // Kanoniczne dopasowanie jak fast-path. Martwe ctx.allCatToCat usunięte —
                    // pole nie istnieje w _excelBuildPasteCache, więc gałąź nigdy nie działała
                    // i surowy tekst ("k2kan") trafiał do tempCategory, psując zakres średnic.
                    const lower = valStr.toLowerCase();
                    let cat = ctx.catLowerMap ? ctx.catLowerMap.get(lower) || null : null;
                    let isExact = !!cat;
                    if (!cat && typeof _excelFindPasteCategory === 'function') {
                        const _fc = _excelFuzzyCatCache(ctx);
                        const _fck = 'paste|' + lower;
                        if (_fc && _fc.has(_fck)) {
                            const _hit = _fc.get(_fck);
                            cat = _hit.cat;
                            isExact = !!cat && cat.toLowerCase() === lower;
                        } else {
                            cat = _excelFindPasteCategory(valStr, ctx.cats);
                            isExact = !!cat && cat.toLowerCase() === lower;
                            if (_fc) _fc.set(_fck, { cat: cat });
                        }
                    }
                    if (!cat) {
                        prz.tempCategory = '';
                        prz.productId = '';
                        _excelRecordMismatch({
                            wIdx: wIdx,
                            colIdx: effLogical,
                            wellName: well.name || 'Studnia DN' + (well.dn || ''),
                            originalVal: String(val),
                            matchedVal: '',
                            matchedText: '',
                            optionsKind: 'cats'
                        });
                    } else {
                        prz.tempCategory = cat;
                        // order-independence jak fast-path: remap productId na ten sam DN
                        // w nowej kategorii zamiast czyszczenia.
                        if (prz.productId && ctx.prodById) {
                            const curProd = ctx.prodById.get(String(prz.productId));
                            if (curProd && curProd.category !== cat) {
                                const curDn = String(curProd.dn || '').replace(/\D/g, '');
                                let remapped = null;
                                if (curDn && ctx.catToProducts) {
                                    const catPool = ctx.catToProducts.get(cat) || [];
                                    for (let _ri = 0; _ri < catPool.length; _ri++) {
                                        if (String(catPool[_ri].dn).replace(/\D/g, '') === curDn) {
                                            remapped = catPool[_ri];
                                            break;
                                        }
                                    }
                                }
                                prz.productId = remapped ? remapped.id : '';
                            }
                        }
                        if (!isExact) {
                            _excelRecordMismatch({
                                wIdx: wIdx,
                                colIdx: effLogical,
                                wellName: well.name || 'Studnia DN' + (well.dn || ''),
                                originalVal: String(val),
                                matchedVal: cat,
                                matchedText: cat,
                                optionsKind: 'cats'
                            });
                        }
                    }
                } else if (typeof _excelFindPasteCategory === 'function') {
                    prz.tempCategory = _excelFindPasteCategory(valStr) || valStr;
                } else {
                    prz.tempCategory = valStr;
                }
            } else if (subType === 3) {
                if (!valStr) {
                    prz.productId = '';
                } else if (ctx && ctx.all) {
                    const poolAll = ctx.all;
                    const curCat = prz.tempCategory;
                    const catPool =
                        curCat && ctx.catToProducts.get(curCat)
                            ? ctx.catToProducts.get(curCat)
                            : null;
                    const searchPool = catPool && catPool.length > 0 ? catPool : poolAll;
                    const poolScoped = !!(catPool && catPool.length > 0);
                    let matched = null;
                    let isExact = false;
                    // exact by id / name — tylko w zakresie kategorii (guard jak fast-path,
                    // inaczej id z obcej kategorii nadpisywało tempCategory).
                    if (ctx.prodById.has(valStr)) {
                        const cand = ctx.prodById.get(valStr);
                        if (searchPool.indexOf(cand) >= 0) {
                            matched = cand;
                            isExact = true;
                        }
                    }
                    if (!matched && ctx.prodByLower.has(valStr.toLowerCase())) {
                        const cand = ctx.prodByLower.get(valStr.toLowerCase());
                        if (searchPool.indexOf(cand) >= 0) {
                            matched = cand;
                            isExact = true;
                        }
                    }
                    const numVal = valStr.replace(/\D/g, '');
                    if (!matched && numVal) {
                        const hits = [];
                        for (let i = 0; i < searchPool.length; i++) {
                            const p = searchPool[i];
                            if (
                                String(p.dn) === numVal ||
                                (p.name && p.name.indexOf(numVal) >= 0)
                            ) {
                                hits.push(p);
                                // Bez zakresu kategorii nie zgadujemy "pierwszego z seeda" —
                                // GRP jest przed K2KAN i cichy strzał psuł dane.
                                if (hits.length > 1 && !poolScoped) break;
                            }
                        }
                        if (hits.length === 1 || (hits.length > 1 && poolScoped)) {
                            matched = hits[0];
                            isExact = String(hits[0].dn) === numVal;
                        }
                    }
                    if (!matched && typeof _excelFindClosestProduct === 'function' && poolScoped) {
                        matched = _excelFindClosestProduct(valStr, searchPool);
                    }
                    if (matched && isExact && _excelForeignIdSignal(ctx, valStr, matched))
                        isExact = false;
                    if (matched) {
                        prz.productId = matched.id;
                        prz.tempCategory = matched.category;
                    }
                    // Gałąź model-only nigdy nie raportowała nie-exact — stąd ciche GRP
                    // omijające modal weryfikacji. Każde nie-exact ląduje w grupach.
                    if (!isExact) {
                        _excelRecordMismatch({
                            wIdx: wIdx,
                            colIdx: effLogical,
                            wellName: well.name || 'Studnia DN' + (well.dn || ''),
                            originalVal: String(val),
                            matchedVal: matched ? matched.id : '',
                            matchedText: matched ? matched.name || 'DN ' + matched.dn : '',
                            optionsKind: 'products',
                            optionsLimit: 300,
                            optionsCat: matched ? matched.category : curCat || null
                        });
                    }
                } else if (
                    typeof _excelFindClosestProduct === 'function' &&
                    typeof studnieProducts !== 'undefined'
                ) {
                    const matched = _excelFindClosestProduct(valStr, studnieProducts);
                    if (matched) {
                        prz.productId = matched.id;
                        prz.tempCategory = matched.category;
                    }
                }
            }
        }
    } else {
        /* Ścieżka model-only dla pozostałych kolumn (właz, komponenty, kineta,
           psia buda, redukcja) — brak TR w DOM (wirtualizacja) nie gubi danych.
           Wspólna logika z handlerami DOM (DRY). */
        const _desc =
            typeof _excelLogicalToColumn === 'function' ? _excelLogicalToColumn(effLogical) : null;
        if (!_desc) return 'unsupported';
        if (
            _desc.kind === 'readonly' ||
            _desc.kind === 'structural' ||
            _desc.kind === 'unknown' ||
            _desc.kind === 'name' ||
            _desc.kind === 'rzWlazu' ||
            _desc.kind === 'rzDna' ||
            _desc.kind === 'przejscie'
        )
            return 'unsupported'; /* obsłużone wyżej; tu tylko tail + komponenty */
        if (_desc.kind === 'wlaz') {
            if (typeof _excelWlazModelUpdate !== 'function') return 'unsupported';
            const _pid = _excelResolveWlazProductId(_desc, valStr);
            if (_pid === null) return 'unsupported';
            _excelWlazModelUpdate(wIdx, _pid);
        } else if (_desc.kind === 'comp' && _desc.col) {
            if (typeof _excelCompModelUpdate !== 'function') return 'unsupported';
            const _c = _desc.col;
            _excelCompModelUpdate(
                wIdx,
                _c.componentType,
                _c.height,
                valStr,
                _c.productId || null,
                _c.fromReduction ? _c.targetDn || 1000 : undefined
            );
            if (
                (_c.componentType === 'krag' || _c.componentType === 'krag_ot') &&
                typeof _excelBatchKragTouched !== 'undefined'
            )
                _excelBatchKragTouched = true;
            if (
                (_c.componentType === 'pierscien_odciazajacy' ||
                    _c.componentType === 'plyta_najazdowa' ||
                    _c.componentType === 'plyta_zamykajaca') &&
                typeof _excelBatchReliefTouched !== 'undefined'
            )
                _excelBatchReliefTouched = true;
        } else if (_desc.kind === 'kineta') {
            if (typeof _excelKinetaModelUpdate !== 'function') return 'unsupported';
            _excelKinetaModelUpdate(wIdx, valStr);
        } else if (_desc.kind === 'psia') {
            if (typeof _excelPsiaBudaModelUpdate !== 'function') return 'unsupported';
            const _pb = _excelParsePasteBoolean(valStr);
            if (_pb === null) return 'unsupported';
            _excelPsiaBudaModelUpdate(wIdx, _pb);
        } else if (_desc.kind === 'redukcja') {
            if (typeof _excelReductionModelUpdate !== 'function') return 'unsupported';
            const _rv = String(valStr || '').trim();
            if (_rv !== '') {
                const _digits = _rv.replace(/\D/g, '');
                if (!_digits) return 'unsupported';
                _excelReductionModelUpdate(wIdx, _digits);
            } else {
                _excelReductionModelUpdate(wIdx, '');
            }
        } else {
            return 'unsupported';
        }
    }

    if (typeof _excelMarkDirty === 'function') {
        try {
            _excelMarkDirty();
        } catch (_e) {}
    }
    return 'applied';
}

/**
 * Ustawia wartość komórki (input lub select) i dispatchuje eventy.
 * Zwraca status ('applied' | 'locked' | 'unsupported'); brak return = applied.
 * @param {Element} target
 * @param {string} val
 * @param {*} [ctx] - lokalny paste ctx z _excelBuildPasteCache (F1); gdy podany, Rodzaj/Srednica ida fast-path bez dispatch
 * @param {number} [logicalCol] - logical column (dla seq mapping), gdy brak uzyj colIdx
 */
function _excelSetCellValue(target, val, ctx, logicalCol) {
    /* Centralny punkt mutacji — blokada studni z PZ accepted / zamowieniem.
       Obejmuje paste, Delete, Ctrl+X, Ctrl+D, Ctrl+R (wszystkie ida przez to miejsce). */
    const tr = target && target.closest ? target.closest('tr[data-widx]') : null;
    const wIdx = tr ? parseInt(tr.getAttribute('data-widx'), 10) : -1;
    if (!isNaN(wIdx) && _excelIsWellLocked(wIdx)) return 'locked';
    const td = target && target.closest ? target.closest('td') : null;
    const colIdx =
        td && td.parentElement ? Array.prototype.indexOf.call(td.parentElement.children, td) : -1;
    const effLogical = typeof logicalCol === 'number' && !isNaN(logicalCol) ? logicalCol : colIdx;
    // F1 fast-path: Rodzaj (2) / Srednica (3) via ctx cache - direct model, bez dispatch, zbierz affected
    if (ctx && ctx.affected && !isNaN(wIdx) && wells[wIdx] && effLogical >= 7) {
        const maxTr =
            typeof _excelMaxTransitions !== 'undefined' && _excelMaxTransitions[_excelActiveTab]
                ? _excelMaxTransitions[_excelActiveTab]
                : 1;
        const trIdx = Math.floor((effLogical - 7) / 4);
        if (trIdx >= maxTr) {
            // poza zakresem przejść (gap/Wlaz) — nie traktuj jako Rodzaj/Średnica
        } else {
            const subType = (effLogical - 7) % 4;
            if (subType === 2 || subType === 3) {
                const _valEmpty = !String(val || '').trim();
                const _hasExisting = wells[wIdx].przejscia && trIdx < wells[wIdx].przejscia.length;
                if (!_hasExisting && _valEmpty) return;
                if (!wells[wIdx].przejscia) wells[wIdx].przejscia = [];
                while (wells[wIdx].przejscia.length <= trIdx) {
                    if (typeof _excelCreatePrzejscie === 'function')
                        wells[wIdx].przejscia.push(_excelCreatePrzejscie());
                    else wells[wIdx].przejscia.push({ productId: '', tempCategory: '' });
                }
                const prz = wells[wIdx].przejscia[trIdx];
                const valStr = String(val || '').trim();
                if (subType === 2) {
                    // Rodzaj — Map exact przed fuzzy
                    if (!valStr) {
                        prz.tempCategory = '';
                        // wyczyść productId gdy kategoria wyczyszczona (jak handler)
                        prz.productId = '';
                        ctx.affected.add(wIdx);
                        return;
                    }
                    const lower = valStr.toLowerCase();
                    let cat = ctx.catLowerMap.get(lower) || null;
                    let isExact = !!cat;
                    if (!cat) {
                        // Cache fuzzy per unikalna wartość — nie per komórka.
                        const _fc = _excelFuzzyCatCache(ctx);
                        const _fck = 'paste|' + lower;
                        if (_fc && _fc.has(_fck)) {
                            const _hit = _fc.get(_fck);
                            cat = _hit.cat;
                            isExact = !!cat && cat.toLowerCase() === lower;
                        } else {
                            cat = _excelFindPasteCategory(valStr, ctx.cats);
                            isExact = !!cat && cat.toLowerCase() === lower;
                            if (_fc) _fc.set(_fck, { cat: cat });
                        }
                    }
                    if (!cat) {
                        prz.tempCategory = '';
                        prz.productId = '';
                        const wellForUnmatchedCategory =
                            wells[wIdx].name || 'Studnia DN' + (wells[wIdx].dn || '');
                        _excelRecordMismatch({
                            wIdx: wIdx,
                            colIdx: colIdx,
                            wellName: wellForUnmatchedCategory,
                            originalVal: String(val),
                            matchedVal: '',
                            matchedText: '',
                            optionsKind: 'cats'
                        });
                        ctx.affected.add(wIdx);
                        return;
                    }
                    prz.tempCategory = cat;
                    // order-independence: gdy kategoria zmienia się po wklejeniu średnicy,
                    // spróbuj remapować istniejący productId na ten sam DN w nowej kategorii
                    // zamiast czyścić (E2/E3). Dzięki temu Paste(Średnica)→Paste(Rodzaj)
                    // daje ten sam wynik co Paste(Rodzaj)→Paste(Średnica).
                    if (prz.productId) {
                        const curProd = ctx.prodById.get(String(prz.productId));
                        if (curProd && curProd.category !== cat) {
                            const curDn = String(curProd.dn || '').replace(/\D/g, '');
                            let remapped = null;
                            if (curDn) {
                                const catPool = ctx.catToProducts.get(cat) || [];
                                for (let _ri = 0; _ri < catPool.length; _ri++) {
                                    if (String(catPool[_ri].dn).replace(/\D/g, '') === curDn) {
                                        remapped = catPool[_ri];
                                        break;
                                    }
                                }
                            }
                            prz.productId = remapped ? remapped.id : '';
                        }
                    }
                    if (!isExact) {
                        const wellForName =
                            wells[wIdx].name || 'Studnia DN' + (wells[wIdx].dn || '');
                        // thin: options leniwie per grupa (modal), nie per komórka
                        _excelRecordMismatch({
                            wIdx: wIdx,
                            colIdx: colIdx,
                            wellName: wellForName,
                            originalVal: String(val),
                            matchedVal: cat,
                            matchedText: cat,
                            optionsKind: 'cats'
                        });
                    }
                    ctx.affected.add(wIdx);
                    return;
                }
                if (subType === 3) {
                    if (!valStr) {
                        prz.productId = '';
                        ctx.affected.add(wIdx);
                        return;
                    }
                    const poolAll = ctx.all;
                    const curCat = prz.tempCategory;
                    const catPool =
                        curCat && ctx.catToProducts.get(curCat)
                            ? ctx.catToProducts.get(curCat)
                            : null;
                    const searchPool = catPool && catPool.length > 0 ? catPool : poolAll;
                    let matched = null;
                    let isExact = false;
                    // exact by id / name lower
                    if (ctx.prodById.has(valStr)) {
                        const cand = ctx.prodById.get(valStr);
                        if (searchPool.indexOf(cand) >= 0) {
                            matched = cand;
                            isExact = true;
                        }
                    }
                    if (!matched) {
                        const low = valStr.toLowerCase();
                        if (ctx.prodByLower.has(low)) {
                            const cand = ctx.prodByLower.get(low);
                            if (searchPool.indexOf(cand) >= 0) {
                                matched = cand;
                                isExact = true;
                            }
                        }
                    }
                    const numVal = valStr.replace(/\D/g, '');
                    // Cache fuzzy per (kategoria, wartość) — linear scan + Levenshtein raz, nie per komórka.
                    const _fpc = _excelFuzzyProdCache(ctx);
                    const _fpk = String(curCat || '') + '|' + valStr.toLowerCase() + '|' + numVal;
                    const _fpHit = _fpc && _fpc.has(_fpk) ? _fpc.get(_fpk) : undefined;
                    if (_fpHit !== undefined && !matched) {
                        if (_fpHit) {
                            const _cand =
                                ctx.prodById.get(_fpHit) ||
                                (typeof getStudnieProductById === 'function'
                                    ? getStudnieProductById(_fpHit)
                                    : null);
                            if (_cand && searchPool.indexOf(_cand) >= 0) {
                                matched = _cand;
                                isExact = _cand.id === valStr || String(_cand.dn) === numVal;
                            }
                        }
                    }
                    if (!matched && numVal && _fpHit === undefined) {
                        // exact digits w searchPool
                        for (let i = 0; i < searchPool.length; i++) {
                            const p = searchPool[i];
                            if (
                                String(p.dn) === numVal ||
                                (p.name && p.name.indexOf(numVal) >= 0)
                            ) {
                                matched = p;
                                isExact = String(p.dn) === numVal;
                                break;
                            }
                        }
                    }
                    if (!matched && _fpHit === undefined) {
                        matched = _excelFindClosestProduct(valStr, searchPool);
                        isExact =
                            matched &&
                            (matched.id === valStr ||
                                matched.name === valStr ||
                                String(matched.dn) === numVal);
                    }
                    if (matched && isExact && _excelForeignIdSignal(ctx, valStr, matched))
                        isExact = false;
                    if (_fpc && _fpHit === undefined) _fpc.set(_fpk, matched ? matched.id : '');
                    if (matched) {
                        prz.productId = matched.id;
                        prz.tempCategory = matched.category;
                        if (!isExact) {
                            const wellForName =
                                wells[wIdx].name || 'Studnia DN' + (wells[wIdx].dn || '');
                            // thin: opcje leniwie per grupa w modalu (pełna lista jak dziś)
                            _excelRecordMismatch({
                                wIdx: wIdx,
                                colIdx: colIdx,
                                wellName: wellForName,
                                originalVal: String(val),
                                matchedVal: matched.id,
                                matchedText: matched.name || 'DN ' + matched.dn,
                                optionsKind: 'products',
                                optionsLimit: 300,
                                optionsCat: matched.category
                            });
                        }
                        ctx.affected.add(wIdx);
                    }
                    return;
                }
            }
        }
    }
    /* Nazwa studni (colIdx 3) — przez paste/fill dozwolona (excelOnNameChange logic), blokuj tylko delete/cut (pusty val). */
    if (colIdx === 3) {
        const clean = String(val || '')
            .replace(/\r/g, '')
            .trim();
        if (!clean) return 'unsupported';
        if (isNaN(wIdx) || !wells[wIdx]) return;
        const well = wells[wIdx];
        well.name = clean;
        well.numer = clean.replace(/ (PRE|UTH)$/i, '').trim();
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
        // Najbliższa opcja gdy brak dokładnego dopasowania — wybierz closest i pokaż popup do weryfikacji
        let isClosest = false;
        if (!opt) {
            const closest = _excelFindClosestOption(_sel.options, val);
            if (closest) {
                opt = closest;
                isClosest = true;
            }
        }
        // Jeśli to Średnica (subType 3) i przejście ma już kategorię (np. PVC SN8 z poprzedniej kolumny paste),
        // a znaleziony opt nie pasuje kategorią — odrzuć go, by fallback wybrał produkt z właściwej kategorii
        if (opt && !isNaN(wIdx) && wells[wIdx] && colIdx >= 7) {
            const _trIdxTmp = Math.floor((colIdx - 7) / 4);
            const _subTypeTmp = (colIdx - 7) % 4;
            if (_subTypeTmp === 3) {
                const _przTmp = wells[wIdx].przejscia && wells[wIdx].przejscia[_trIdxTmp];
                if (_przTmp && _przTmp.tempCategory) {
                    const _prodTmp =
                        typeof studnieProducts !== 'undefined'
                            ? typeof getStudnieProductById === 'function'
                                ? getStudnieProductById(opt.value)
                                : studnieProducts.find((p) => p.id === opt.value)
                            : null;
                    if (_prodTmp && _prodTmp.category !== _przTmp.tempCategory) {
                        opt = null;
                        isClosest = false;
                    }
                }
            }
        }
        if (opt) {
            const isExact =
                String(val).trim().toLowerCase() === opt.text.trim().toLowerCase() ||
                String(val).trim() === opt.value;
            if (isClosest || !isExact) {
                const wellForName =
                    !isNaN(wIdx) && wells[wIdx]
                        ? wells[wIdx].name || 'Studnia DN' + (wells[wIdx].dn || '')
                        : '';
                _excelRecordMismatch({
                    wIdx: wIdx,
                    colIdx: colIdx,
                    wellName: wellForName,
                    originalVal: String(val),
                    matchedVal: opt.value,
                    matchedText: opt.text,
                    options: Array.from(_sel.options).map((o) => ({ value: o.value, text: o.text }))
                });
            }
            _sel.value = opt.value;
            _sel.dispatchEvent(new Event('change', { bubbles: true }));
        } else if (!isNaN(wIdx) && wells[wIdx] && colIdx >= 7) {
            const maxTrFb =
                typeof _excelMaxTransitions !== 'undefined' && _excelMaxTransitions[_excelActiveTab]
                    ? _excelMaxTransitions[_excelActiveTab]
                    : 1;
            const trIdx = Math.floor((colIdx - 7) / 4);
            if (trIdx >= maxTrFb) return 'unsupported'; // gap/Wlaz — nie przejście
            const subType = (colIdx - 7) % 4; // 0: rzedna, 1: angle, 2: category, 3: productId
            if (!wells[wIdx].przejscia) wells[wIdx].przejscia = [];
            while (wells[wIdx].przejscia.length <= trIdx) {
                if (typeof _excelCreatePrzejscie === 'function')
                    wells[wIdx].przejscia.push(_excelCreatePrzejscie());
            }
            const prz = wells[wIdx].przejscia[trIdx];
            const valStr = String(val).trim();
            if (subType === 2) {
                // Rodzaj przejścia (category) — najbliższy
                let catToSet = valStr;
                let isClosest = false;
                if (typeof studnieProducts !== 'undefined') {
                    const cats = [
                        ...new Set(
                            studnieProducts
                                .filter((p) => p.componentType === 'przejscie')
                                .map((p) => p.category)
                        )
                    ];
                    const closest = _excelFindClosestCategory(valStr, cats);
                    if (closest && closest.toLowerCase() !== valStr.toLowerCase()) {
                        catToSet = closest;
                        isClosest = true;
                    }
                }
                prz.tempCategory = catToSet;
                if (isClosest) {
                    const wellForName2 = wells[wIdx].name || 'Studnia DN' + (wells[wIdx].dn || '');
                    _excelRecordMismatch({
                        wIdx: wIdx,
                        colIdx: colIdx,
                        wellName: wellForName2,
                        originalVal: valStr,
                        matchedVal: catToSet,
                        matchedText: catToSet,
                        optionsKind: 'cats'
                    });
                }
            } else if (subType === 3) {
                // Średnica (productId/DN) — najbliższa (preferuj kategorię z tego samego przejścia)
                const numVal = valStr.replace(/\D/g, '');
                let matched = null;
                if (typeof studnieProducts !== 'undefined') {
                    const pool = studnieProducts.filter((p) => p.componentType === 'przejscie');
                    const cat = prz.tempCategory;
                    const catPool =
                        cat && pool.some((p) => p.category === cat)
                            ? pool.filter((p) => p.category === cat)
                            : null;
                    const searchPool = catPool && catPool.length > 0 ? catPool : pool;
                    let exact = searchPool.find((p) => p.id === valStr || p.name === valStr);
                    if (!exact && numVal)
                        exact = searchPool.find(
                            (p) => String(p.dn) === numVal || p.name.indexOf(numVal) >= 0
                        );
                    matched = exact || _excelFindClosestProduct(valStr, searchPool);
                    if (matched) {
                        prz.productId = matched.id;
                        prz.tempCategory = matched.category;
                        const isExact =
                            matched.id === valStr ||
                            matched.name === valStr ||
                            String(matched.dn) === numVal;
                        if (!isExact) {
                            const wellForName3 =
                                wells[wIdx].name || 'Studnia DN' + (wells[wIdx].dn || '');
                            _excelRecordMismatch({
                                wIdx: wIdx,
                                colIdx: colIdx,
                                wellName: wellForName3,
                                originalVal: valStr,
                                matchedVal: matched.id,
                                matchedText: matched.name || 'DN ' + matched.dn,
                                optionsKind: 'products',
                                optionsLimit: 0,
                                optionsCat: matched.category
                            });
                        }
                    }
                }
            }
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
    if (typeof _excelBatchReliefTouched !== 'undefined') _excelBatchReliefTouched = false;
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
        /* Para odciążająca: partner ląduje w innej kolumnie niż edytowana —
           bez pełnego rendera kolumna partnera nie pokaże "1". */
        if (typeof _excelBatchReliefTouched !== 'undefined' && _excelBatchReliefTouched) {
            _excelBatchReliefTouched = false;
            if (typeof _excelRenderTable === 'function') _excelRenderTable(_excelActiveTab);
        }
        var _fillWIdxs = [];
        var _fillSeen = {};
        plan.forEach(function (cell) {
            if (typeof cell.wIdx === 'number' && !_fillSeen[cell.wIdx]) {
                _fillSeen[cell.wIdx] = 1;
                _fillWIdxs.push(cell.wIdx);
            }
        });
        _excelDebouncedRefresh(_fillWIdxs);
        showToast('Wypełniono ' + plan.length + ' komórek', 'info');
    } finally {
        _excelPasteInProgress = false;
    }
}
