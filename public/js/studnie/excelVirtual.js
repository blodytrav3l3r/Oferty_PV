// @ts-nocheck
/* ===== EXCEL VIRTUAL — viewport dla 10k studni (B) =====
 * 7 kolumn sticky zawsze widoczne (Checkbox..Wys) jak w 14c6d09.
 * Model SSoT: wells + filteredIndexes[logical→wellIdx] + selection range.
 * DOM to tylko widok: 40-70 wierszy + spacery, nie 10k.
 * Flag: ?virtual=1  (progessive, legacy pozostaje oracle)
 */

const EXCEL_ROW_HEIGHT = 32;
const EXCEL_OVERSCAN = 15;
const EXCEL_VIEWPORT_ROWS = 35;

let _excelVirtualEnabled = false;
const _excelVirtualScrollTop = 0;
let _excelVirtualRaf = 0;
let _excelVirtualOffset = 0;
let _excelVirtualFiltered = null; // number[] wellIdx
let _excelVirtualTotal = 0;
let _excelVirtualStart = 0;
let _excelVirtualEnd = 0;
let _excelVirtualContainer = null;
let _excelVirtualLogicalCols = []; // logicalColumnId[] in visible order (never colIdx as semantics)
let _excelVirtualActiveCell = null; // {logicalRow, logicalColId} — preserves focus across scroll/recycle (R12)
// SSoT invariant: logicalRow = position in filteredIndexes, NOT wellIdx (docs/plans/2026-09-02-excel-arrow-virtual-nav.md)

/* ===== PERF instrumentation (?perf=1, tymczasowe — usunąć po benchmarku) =====
 * Jeden przełącznik: window.__EXCEL_PERF__ = true tylko gdy URL ma ?perf=1.
 * Bez flagi zero overhead (jeden boolean check na render).
 * Layout/paint obserwowany w rAF, nie w synchronicznym RenderBody.
 * Agregaty zamiast console.log per render — raport via __excelPerfReport(). */
(function () {
    try {
        if (typeof window !== 'undefined' && !window.__EXCEL_PERF__) {
            const search = (typeof window.location !== 'undefined' && window.location.search) || '';
            if (search.indexOf('perf=1') >= 0) window.__EXCEL_PERF__ = true;
        }
    } catch (_e) {}
})();

function _excelPerfOn() {
    try {
        return typeof window !== 'undefined' && window.__EXCEL_PERF__ === true;
    } catch (_e) {
        return false;
    }
}
function _excelPerfNow() {
    try {
        if (typeof performance !== 'undefined' && performance.now) return performance.now();
    } catch (_e) {}
    return Date.now();
}
function _excelPerfPush(stage, ms) {
    try {
        if (typeof window === 'undefined') return;
        if (!window.__EXCEL_PERF_STATS) window.__EXCEL_PERF_STATS = {};
        const stats = window.__EXCEL_PERF_STATS;
        if (!stats[stage]) stats[stage] = [];
        const arr = stats[stage];
        arr.push(ms);
        if (arr.length > 500) arr.shift(); // cap — bez wzrostu pamięci przy scrollu
    } catch (_e) {}
}
function _excelPerfObserveFrame() {
    // koszt layout/paint na granicy klatki — osobny rAF, nie część sync RenderBody
    try {
        if (typeof requestAnimationFrame === 'undefined') return;
        const t0 = _excelPerfNow();
        requestAnimationFrame(function () {
            _excelPerfPush('frame', _excelPerfNow() - t0);
        });
    } catch (_e) {}
}
function _excelPerfQuantile(sorted, q) {
    if (!sorted.length) return 0;
    const pos = (sorted.length - 1) * q;
    const lo = Math.floor(pos);
    const hi = Math.ceil(pos);
    if (lo === hi) return sorted[lo];
    return sorted[lo] + (sorted[hi] - sorted[lo]) * (pos - lo);
}
function __excelPerfReport() {
    const stats = (typeof window !== 'undefined' && window.__EXCEL_PERF_STATS) || {};
    const out = {};
    Object.keys(stats).forEach(function (stage) {
        const arr = stats[stage].slice().sort(function (a, b) {
            return a - b;
        });
        if (!arr.length) {
            out[stage] = { count: 0 };
            return;
        }
        const sum = arr.reduce(function (a, b) {
            return a + b;
        }, 0);
        let max = arr[0];
        for (let i = 1; i < arr.length; i++) if (arr[i] > max) max = arr[i];
        out[stage] = {
            count: arr.length,
            avg: Math.round((sum / arr.length) * 10) / 10,
            p50: Math.round(_excelPerfQuantile(arr, 0.5) * 10) / 10,
            p95: Math.round(_excelPerfQuantile(arr, 0.95) * 10) / 10,
            max: Math.round(max * 10) / 10
        };
    });
    try {
        if (typeof console !== 'undefined' && console.table) console.table(out);
        else if (typeof console !== 'undefined') console.log(out);
    } catch (_e) {}
    return out;
}
function __excelPerfReset() {
    try {
        if (typeof window !== 'undefined') window.__EXCEL_PERF_STATS = {};
    } catch (_e) {}
}

function _excelVirtualIsExcelCell(el) {
    if (!el) return false;
    const c = document.getElementById('excel-table-container');
    if (!c || !c.contains(el)) return false;
    if (el.closest && el.closest('#excel-empty-row')) return true;
    if (el.tagName === 'INPUT' || el.tagName === 'SELECT') return true;
    if (el.classList && el.classList.contains('excel-sel-wrap')) return true;
    return false;
}

function _excelVirtualSyncActiveFromElement(el) {
    if (!el) return null;
    let target = el;
    if (target.tagName === 'SELECT') {
        const wrap = target.closest('.excel-sel-wrap');
        if (wrap) target = wrap;
    } else if (target.closest) {
        const wrap = target.closest('.excel-sel-wrap');
        if (wrap) target = wrap;
    }
    const tr = target.closest ? target.closest('tr[data-widx], tr#excel-empty-row') : null;
    if (!tr) return null;
    // empty row is virtual row = total (past last logical)
    if (tr.id === 'excel-empty-row') {
        const colIdx = target.closest('td')
            ? Array.prototype.indexOf.call(tr.children, target.closest('td'))
            : -1;
        const colId =
            colIdx >= 0 && _excelVirtualLogicalCols[colIdx]
                ? _excelVirtualLogicalCols[colIdx]
                : _excelVirtualLogicalCols[3] || 'name';
        _excelVirtualActiveCell = { logicalRow: _excelVirtualTotal, logicalColId: colId };
        return _excelVirtualActiveCell;
    }
    const logicalAttr = tr.getAttribute('data-logical-row');
    let logicalRow = logicalAttr !== null ? parseInt(logicalAttr, 10) : -1;
    if (isNaN(logicalRow) || logicalRow < 0) {
        const wIdx = parseInt(tr.getAttribute('data-widx'), 10);
        if (!isNaN(wIdx) && _excelVirtualFiltered) {
            logicalRow = _excelVirtualFiltered.indexOf(wIdx);
        }
    }
    if (isNaN(logicalRow) || logicalRow < 0) return null;
    const td = target.closest('td');
    const colIdx = td && tr.contains(td) ? Array.prototype.indexOf.call(tr.children, td) : -1;
    const colId =
        colIdx >= 0 && _excelVirtualLogicalCols[colIdx]
            ? _excelVirtualLogicalCols[colIdx]
            : _excelVirtualLogicalCols[0] || 'name';
    _excelVirtualActiveCell = { logicalRow: logicalRow, logicalColId: colId };
    return _excelVirtualActiveCell;
}

function _excelVirtualGetColIdxForId(logicalColId) {
    const idx = _excelVirtualLogicalCols.indexOf(logicalColId);
    return idx >= 0 ? idx : -1;
}

/* Lista fokusowalnych logicalColId dla wiersza — SSoT nawigacji poziomej.
 * TD-index != rowEls-index (Lp/Wys-tekst/gap/akcje nie mają inputa), więc krok
 * Left/Right idzie po tej liście, nigdy po pozycji TD. Disabled pomijane
 * (per-wiersz, bo select może być disabled tylko w niektórych wierszach).
 * Invariant: virtual horizontal MUSI dać tę samą sekwencję co legacy rowEls. */
function _excelVirtualFocusableIds(row) {
    const ids = [];
    if (!row || !row.children) return ids;
    const cols = _excelVirtualLogicalCols || [];
    const kids = row.children;
    for (let i = 0; i < kids.length && i < cols.length; i++) {
        const colId = cols[i];
        if (!colId) continue;
        const td = kids[i];
        const el = td.querySelector ? td.querySelector('input, select, .excel-sel-wrap') : null;
        if (!el) continue;
        if (typeof _excelIsDisabledNav === 'function' && _excelIsDisabledNav(el)) continue;
        ids.push(colId);
    }
    return ids;
}

/* Znajdź enabled element w wierszu idąc po kolejności TD od colIdx w kierunku
 * dir (+1/-1), potem w przeciwną. Zwraca element lub null. Operuje na TD
 * (nie na rowEls-index), bo rowEls jest listą zwartą bez Lp/Wys/gap. */
function _excelVirtualFindEnabledInRow(row, colIdx, dir) {
    if (!row || !row.children) return null;
    const kids = row.children;
    const dirs = dir >= 0 ? [1, -1] : [-1, 1];
    for (let p = 0; p < dirs.length; p++) {
        const step = dirs[p];
        for (let i = colIdx + step; i >= 0 && i < kids.length; i += step) {
            const td = kids[i];
            if (!td || !td.querySelector) continue;
            const el = td.querySelector('input, select, .excel-sel-wrap');
            if (!el) continue;
            if (typeof _excelIsDisabledNav === 'function' && _excelIsDisabledNav(el)) continue;
            return el;
        }
    }
    return null;
}

function _excelVirtualFocusCell(active, opts) {
    if (!active) return false;
    // empty row
    if (active.logicalRow === _excelVirtualTotal) {
        const emptyRow = document.getElementById('excel-empty-row');
        if (!emptyRow) return false;
        const colIdx = _excelVirtualGetColIdxForId(active.logicalColId);
        const td = colIdx >= 0 ? emptyRow.children[colIdx] : null;
        let el = td ? td.querySelector('input, select, .excel-sel-wrap') : null;
        if (!el || (typeof _excelIsDisabledNav === 'function' && _excelIsDisabledNav(el))) {
            // fallback po kolejności TD (rowEls jest zwarty — index TD != index rowEls)
            el =
                (typeof _excelVirtualFindEnabledInRow === 'function'
                    ? _excelVirtualFindEnabledInRow(emptyRow, colIdx, 1)
                    : null) || null;
            if (!el && typeof _excelGetNavElements === 'function') {
                const els = _excelGetNavElements(emptyRow);
                el = els[0] || null;
            }
        }
        if (el) {
            if (
                typeof _excelFocusNavEl === 'function' &&
                typeof _excelGetNavElements === 'function'
            ) {
                const emptyEls = _excelGetNavElements(emptyRow);
                _excelFocusNavEl(el, emptyEls, 'down', opts);
            } else {
                el.focus();
            }
            return true;
        }
        return false;
    }
    const container = document.getElementById('excel-table-container');
    if (!container) return false;
    const row = container.querySelector('tr[data-logical-row="' + active.logicalRow + '"]');
    if (!row) return false;
    const colIdx = _excelVirtualGetColIdxForId(active.logicalColId);
    if (colIdx < 0) return false;
    const td = row.children[colIdx];
    let el = td ? td.querySelector('input, select, .excel-sel-wrap') : null;
    if (!el || (typeof _excelIsDisabledNav === 'function' && _excelIsDisabledNav(el))) {
        // fallback po kolejności TD (rowEls jest zwarty — index TD != index rowEls)
        el =
            (typeof _excelVirtualFindEnabledInRow === 'function'
                ? _excelVirtualFindEnabledInRow(row, colIdx, 1)
                : null) || null;
        if (!el && typeof _excelGetNavElements === 'function') {
            const rowEls = _excelGetNavElements(row);
            el = rowEls[0] || null;
        }
    }
    if (!el) return false;
    const rowEls2 = typeof _excelGetNavElements === 'function' ? _excelGetNavElements(row) : [el];
    if (typeof _excelFocusNavEl === 'function') {
        _excelFocusNavEl(el, rowEls2, 'down', opts);
    } else {
        el.focus();
    }
    // sync currentWellIndex
    const wIdx = parseInt(row.getAttribute('data-widx'), 10);
    if (
        !isNaN(wIdx) &&
        typeof currentWellIndex !== 'undefined' &&
        wIdx !== currentWellIndex &&
        typeof excelSelectRow === 'function'
    ) {
        try {
            excelSelectRow(wIdx);
        } catch (_e) {}
    }
    return true;
}

function _excelVirtualClampActive() {
    if (!_excelVirtualActiveCell) return;
    if (_excelVirtualTotal === 0) {
        _excelVirtualActiveCell.logicalRow = 0;
        return;
    }
    if (_excelVirtualActiveCell.logicalRow > _excelVirtualTotal)
        _excelVirtualActiveCell.logicalRow = _excelVirtualTotal;
    if (_excelVirtualActiveCell.logicalRow < 0) _excelVirtualActiveCell.logicalRow = 0;
    if (_excelVirtualLogicalCols.indexOf(_excelVirtualActiveCell.logicalColId) < 0) {
        _excelVirtualActiveCell.logicalColId = _excelVirtualLogicalCols[0] || 'name';
    }
}

function _excelVirtualEnsureVisible(logicalRow) {
    if (
        typeof logicalRow !== 'number' ||
        isNaN(logicalRow) ||
        logicalRow < 0 ||
        logicalRow > _excelVirtualTotal
    )
        return false;
    // already in viewport → no scroll/render
    if (logicalRow >= _excelVirtualStart && logicalRow < _excelVirtualEnd) return false;
    const container = _excelVirtualContainer || document.getElementById('excel-table-container');
    if (!container) return false;
    const viewportH = container.clientHeight || 600;
    const rowsInView = Math.max(1, Math.ceil(viewportH / EXCEL_ROW_HEIGHT));
    let newScrollTop;
    if (logicalRow < _excelVirtualStart) {
        newScrollTop = Math.max(
            0,
            logicalRow * EXCEL_ROW_HEIGHT - EXCEL_OVERSCAN * EXCEL_ROW_HEIGHT * 0.2
        );
        // keep overscan above row minimal — snap to row top
        newScrollTop = Math.max(0, logicalRow * EXCEL_ROW_HEIGHT - 2 * EXCEL_ROW_HEIGHT);
    } else {
        newScrollTop = Math.max(
            0,
            (logicalRow - rowsInView + 1) * EXCEL_ROW_HEIGHT + 2 * EXCEL_ROW_HEIGHT
        );
    }
    const maxScroll = Math.max(0, _excelVirtualTotal * EXCEL_ROW_HEIGHT - viewportH);
    if (newScrollTop > maxScroll) newScrollTop = maxScroll;
    container.scrollTop = newScrollTop;
    _excelVirtualRenderBody();
    return true;
}

function _excelVirtualIsRequestEnabled() {
    try {
        if (
            typeof window !== 'undefined' &&
            window.location &&
            window.location.search.indexOf('virtual=0') >= 0
        )
            return false;
        if (
            typeof localStorage !== 'undefined' &&
            localStorage.getItem('sok_excel_virtual') === '0'
        )
            return false;
    } catch (_e) {}
    return true;
}

function _excelVirtualIsEnabled() {
    if (_excelVirtualIsRequestEnabled() === false) {
        // effectiveVirtual = requestVirtual || total > 500 — diagnostyka vs enforcement
        try {
            const n =
                typeof wells !== 'undefined' && Array.isArray(wells)
                    ? wells.length
                    : typeof _excelVirtualTotal === 'number'
                      ? _excelVirtualTotal
                      : 0;
            if (n > 500) return true;
        } catch (_e) {}
        return false;
    }
    return true;
}

function _excelVirtualBuildFiltered() {
    // deleguj do SSoT filteredIndexes gdy dostępny (Faza1 invariant)
    if (typeof _excelGetFilteredIndexes === 'function') {
        const arr = _excelGetFilteredIndexes();
        _excelVirtualFiltered = arr.slice();
        _excelVirtualTotal = arr.length;
        try {
            if (typeof window !== 'undefined') {
                window._excelVirtualFiltered = _excelVirtualFiltered;
                window._excelVirtualTotal = _excelVirtualTotal;
                window._excelFilteredIndexes = arr;
            }
        } catch (_e) {}
        return;
    }
    if (typeof wells === 'undefined' || !Array.isArray(wells)) {
        _excelVirtualFiltered = [];
        _excelVirtualTotal = 0;
        return;
    }
    const dn = typeof _excelActiveTab !== 'undefined' ? _excelActiveTab : '1000';
    const qEl =
        typeof document !== 'undefined' ? document.getElementById('excel-search-input') : null;
    const q = qEl
        ? String(qEl.value || '')
              .trim()
              .toLowerCase()
        : '';
    const arr = [];
    for (let i = 0; i < wells.length; i++) {
        const w = wells[i];
        if (!w) continue;
        const matchesTab =
            typeof _excelWellMatchesTab === 'function'
                ? _excelWellMatchesTab(w, dn)
                : String(w.dn) === String(dn) || (dn === 'styczne' && w.dn === 'styczna');
        if (!matchesTab) continue;
        if (q) {
            const name = String(w.name || w.numer || '').toLowerCase();
            if (name.indexOf(q) < 0) continue;
        }
        arr.push(i);
    }
    _excelVirtualFiltered = arr;
    _excelVirtualTotal = arr.length;
    // sync to window for vm tests (let globals not reflected as properties)
    try {
        if (typeof window !== 'undefined') {
            window._excelVirtualFiltered = _excelVirtualFiltered;
            window._excelVirtualTotal = _excelVirtualTotal;
        }
    } catch (_e) {}
}

function _excelVirtualGetVisibleRange() {
    const container = _excelVirtualContainer || document.getElementById('excel-table-container');
    if (!container)
        return {
            start: 0,
            end: Math.min(_excelVirtualTotal, EXCEL_VIEWPORT_ROWS + EXCEL_OVERSCAN * 2)
        };
    const scrollTop = container.scrollTop || 0;
    const viewportH = container.clientHeight || 600;
    const rowsInView = Math.ceil(viewportH / EXCEL_ROW_HEIGHT);
    let start = Math.floor(scrollTop / EXCEL_ROW_HEIGHT) - EXCEL_OVERSCAN;
    if (start < 0) start = 0;
    let end = start + rowsInView + EXCEL_OVERSCAN * 2;
    if (end > _excelVirtualTotal) {
        end = _excelVirtualTotal;
        start = Math.max(0, end - rowsInView - EXCEL_OVERSCAN * 2);
    }
    return { start, end };
}

function _excelVirtualOnScroll() {
    if (_excelVirtualRaf) cancelAnimationFrame(_excelVirtualRaf);
    _excelVirtualRaf = requestAnimationFrame(function () {
        _excelVirtualRaf = 0;
        // R12: active composition/edit must not be destroyed before commit — skip recycle while composing
        const ae = document.activeElement;
        const isComposing =
            ae &&
            (ae.isComposing ||
                (ae.tagName === 'INPUT' && ae.getAttribute('data-composing') === '1'));
        if (isComposing) return;
        const range = _excelVirtualGetVisibleRange();
        if (range.start === _excelVirtualStart && range.end === _excelVirtualEnd) return;
        _excelVirtualRenderBody();
    });
}

function _excelVirtualOnFocusIn(e) {
    const tgt = e.target;
    if (!_excelVirtualIsExcelCell(tgt)) return;
    // composing guarded — don't sync during IME
    if (tgt.isComposing || tgt.getAttribute('data-composing') === '1') return;
    _excelVirtualSyncActiveFromElement(tgt);
}

function _excelVirtualAttach() {
    const c = document.getElementById('excel-table-container');
    if (!c || _excelVirtualContainer === c) return;
    _excelVirtualContainer = c;
    c.removeEventListener('scroll', _excelVirtualOnScroll);
    c.addEventListener('scroll', _excelVirtualOnScroll, { passive: true });
    c.removeEventListener('focusin', _excelVirtualOnFocusIn);
    c.addEventListener('focusin', _excelVirtualOnFocusIn);
    c.style.maxHeight = '';
    c.style.overflow = 'auto';
}

function _excelVirtualDetach() {
    if (_excelVirtualContainer) {
        _excelVirtualContainer.removeEventListener('scroll', _excelVirtualOnScroll);
        _excelVirtualContainer.removeEventListener('focusin', _excelVirtualOnFocusIn);
        _excelVirtualContainer = null;
    }
    if (_excelVirtualRaf) {
        cancelAnimationFrame(_excelVirtualRaf);
        _excelVirtualRaf = 0;
    }
    _excelVirtualActiveCell = null;
}

function _excelVirtualRenderBody() {
    if (!_excelVirtualEnabled) return;
    // perf: jeden boolean check — bez flagi zero overhead
    const _perf = _excelPerfOn();
    const _tRenderStart = _perf ? _excelPerfNow() : 0;
    const _tPrepareStart = _perf ? _excelPerfNow() : 0;
    if (!_excelVirtualFiltered) _excelVirtualBuildFiltered();
    // clamp active cursor when total changed (filtr/tab)
    _excelVirtualClampActive();
    // capture focus owner before DOM replacement — only restore if focus was inside excel grid cell
    const _hadGridFocusEl = document.activeElement;
    const _hadGridFocus = _excelVirtualIsExcelCell(_hadGridFocusEl);
    const _activeBefore = _excelVirtualActiveCell
        ? {
              logicalRow: _excelVirtualActiveCell.logicalRow,
              logicalColId: _excelVirtualActiveCell.logicalColId
          }
        : null;
    const range = _excelVirtualGetVisibleRange();
    _excelVirtualStart = range.start;
    _excelVirtualEnd = range.end;
    const total = _excelVirtualTotal;
    const start = _excelVirtualStart;
    const end = _excelVirtualEnd;
    _excelVirtualOffset = start;
    // zbuduj slice wells dla visible
    const sliceIdx = _excelVirtualFiltered.slice(start, end);
    const sliceWells = sliceIdx.map(function (idx) {
        return wells[idx];
    });
    const dn = typeof _excelActiveTab !== 'undefined' ? _excelActiveTab : '1000';
    const maxTr = typeof _excelMaxTransitions !== 'undefined' ? _excelMaxTransitions[dn] || 1 : 1;
    let refWell = sliceWells[0];
    if (!refWell && typeof _excelGetReferenceWell === 'function')
        refWell = _excelGetReferenceWell(dn);
    const compCols =
        typeof _excelGetVisibleComponentColumns === 'function'
            ? _excelGetVisibleComponentColumns(dn, refWell)
            : [];
    const hasReduction = ['1200', '1500', '2000', '2500', 'styczne'].indexOf(dn) >= 0;
    // Build logicalColumnId list in header order: 0:check,1:mode,2:Lp,3:name,4:rzWlazu,5:rzDna,6:wys,7.. przejscia*4, gap, wlaz, comps, denn,uszcz,red,kineta,pb,akcje
    try {
        const ids = ['check', 'mode', 'lp', 'name', 'rzWlazu', 'rzDna', 'wys'];
        for (let i = 0; i < maxTr; i++)
            ids.push('rzWlot_' + i, 'kat_' + i, 'rodzaj_' + i, 'srednica_' + i);
        ids.push('gap1', 'gap2', 'wlaz');
        compCols.forEach(function (c) {
            // select/auto nie mają własnego TD (właz renderowany dedykowanym
            // blokiem) — ta sama konwencja co body/header (tableBody:416,624,
            // renderer:129). Bez tego 'wlaz' dublowałby się w ids i rozjeżdżał
            // pairing TD-index → logicalColId dla wszystkich późniejszych kolumn.
            if (c.type === 'select' || c.type === 'auto') return;
            ids.push(
                (c.id || c.key || c.componentType + '_' + (c.height || c.productId || '')) + ''
            );
        });
        ids.push('hDenn', 'uszcz', hasReduction ? 'redukcja' : null, 'kineta', 'psiaBuda', 'akcje');
        _excelVirtualLogicalCols = ids.filter(Boolean);
    } catch (_e) {
        _excelVirtualLogicalCols = [];
    }
    if (_perf) _excelPerfPush('prepare', _excelPerfNow() - _tPrepareStart);
    const _tTbodyStart = _perf ? _excelPerfNow() : 0;
    let bodyHtml = '';
    if (typeof _excelRenderTbody === 'function') {
        bodyHtml = _excelRenderTbody(sliceWells, dn, compCols, maxTr, hasReduction);
        bodyHtml = bodyHtml.replace('</thead><tbody>', '').replace('</tbody>', '');
        // usuń pusty wiersz z slice — pokaż tylko na końcu listy gdy virtual na dole
        bodyHtml = bodyHtml.replace(/<tr id="excel-empty-row"[\s\S]*?<\/tr>/, '');
        bodyHtml = bodyHtml.replace(/<tr id="excel-empty-state"[\s\S]*?<\/tr>/, '');
        const topH = start * EXCEL_ROW_HEIGHT;
        const bottomH = (total - end) * EXCEL_ROW_HEIGHT;
        const colCount =
            (
                document.querySelector('#excel-table-container table thead tr') || {
                    children: { length: 30 }
                }
            ).children.length || 30;
        const topSpacer =
            topH > 0
                ? '<tr class="excel-spacer-top" style="height:' +
                  topH +
                  'px;"><td colspan="' +
                  colCount +
                  '" style="height:' +
                  topH +
                  'px;padding:0;border:none;background:transparent;"></td></tr>'
                : '';
        const bottomSpacer =
            bottomH > 0
                ? '<tr class="excel-spacer-bottom" style="height:' +
                  bottomH +
                  'px;"><td colspan="' +
                  colCount +
                  '" style="height:' +
                  bottomH +
                  'px;padding:0;border:none;background:transparent;"></td></tr>'
                : '';
        // Lp korekta: w tbody Lp to idx+1 — with virtual to start+idx+1, popraw po renderze
        // pusty wiersz tylko gdy na końcu
        let emptyRow = '';
        if (end === total) {
            const emptyBg = 'var(--slate-950)';
            const stickyZ = typeof LAYERS_EXCEL !== 'undefined' ? LAYERS_EXCEL.STICKY_COLUMN : 5;
            emptyRow =
                '<tr id="excel-empty-row" style="background:' +
                emptyBg +
                ';"><td class="excel-td excel-td-empty" style="background:' +
                emptyBg +
                ';text-align:center;padding:2px;border-right:1px solid rgba(var(--white-rgb), 0.05);width:28px;"><input type="checkbox" disabled tabindex="-1" style="cursor:default;accent-color:rgba(var(--accent-rgb), 0.8);opacity:0.3;" /></td><td class="excel-td excel-td-empty" style="background:' +
                emptyBg +
                ';text-align:center;padding:2px;border-right:1px solid rgba(var(--white-rgb), 0.05);width:70px;min-width:70px;"><button type="button" disabled class="excel-mode-btn is-manual" style="opacity:0.3;cursor:default;">\u2014</button><button type="button" disabled class="excel-run-btn is-manual" style="opacity:0.3;"><i data-lucide="play" class="icon-xs" aria-hidden="true"></i></button></td><td class="excel-td excel-td-empty" style="position:sticky;left:0;z-index:' +
                stickyZ +
                ';background:' +
                emptyBg +
                ';text-align:center;color:var(--accent);font-size:var(--fs-xs);font-weight:var(--fw-bold);border-right:1px solid rgba(var(--white-rgb), 0.1);min-width:32px;">+</td><td class="excel-td excel-td-empty" style="position:sticky;left:32px;z-index:' +
                stickyZ +
                ';background:' +
                emptyBg +
                ';border-right:1px solid rgba(var(--white-rgb), 0.1);"><input type="text" placeholder="Wpisz nazwę (Enter)" title="Wpisz nazwę nowej studni i wciśnij Enter" id="excel-empty-name" onkeydown="if(event.key===\'Enter\')excelCreateFromEmpty()" onblur="excelCreateFromEmpty(event)" onfocus="excelCellFocus(this);_excelSelWrapFocus(this)" style="background:var(--slate-950);border:1px dashed rgba(var(--accent-rgb),0.4);border-radius:2px;color:var(--accent);font-size:var(--fs-sm);outline:none;text-align:left;width:118px;box-sizing:border-box;" /></td><td class="excel-td excel-td-empty" style="position:sticky;left:162px;z-index:' +
                stickyZ +
                ';background:' +
                emptyBg +
                ';text-align:right;"><input type="number" step="0.01" placeholder="\u2014" id="excel-empty-rzw" onfocus="excelCellFocus(this);_excelSelWrapFocus(this)" style="background:var(--slate-950);border:1px solid rgba(var(--white-rgb), 0.1);border-radius:2px;color:var(--text-primary);font-size:var(--fs-sm);outline:none;text-align:right;width:72px;" /></td><td class="excel-td excel-td-empty" style="position:sticky;left:240px;z-index:' +
                stickyZ +
                ';background:' +
                emptyBg +
                ';text-align:right;"><input type="number" step="0.01" placeholder="\u2014" id="excel-empty-rzd" onfocus="excelCellFocus(this);_excelSelWrapFocus(this)" style="background:var(--slate-950);border:1px solid rgba(var(--white-rgb), 0.1);border-radius:2px;color:var(--text-primary);font-size:var(--fs-sm);outline:none;text-align:right;width:72px;" /></td><td class="excel-td excel-td-empty" style="position:sticky;left:318px;z-index:' +
                stickyZ +
                ';background:' +
                emptyBg +
                ';text-align:center;color:var(--slate-800);" data-cell="height-empty">\u2014</td><td colspan="' +
                (colCount - 7) +
                '" style="text-align:center;color:var(--slate-700);">\u2014</td></tr>';
        }
        bodyHtml = topSpacer + bodyHtml + bottomSpacer + emptyRow;
        if (_perf) _excelPerfPush('tbody', _excelPerfNow() - _tTbodyStart);
        const container = document.getElementById('excel-table-container');
        if (!container) return;
        const tbody = container.querySelector('tbody');
        if (tbody) {
            const _tInnerStart = _perf ? _excelPerfNow() : 0;
            tbody.innerHTML = bodyHtml;
            if (_perf) _excelPerfPush('innerHTML', _excelPerfNow() - _tInnerStart);
            // R11: fresh explicit binding — DOM row != logical row
            const rows = tbody.querySelectorAll('tr[data-widx]');
            for (let i = 0; i < rows.length; i++) {
                const logicalRow = start + i;
                const wIdxAttr = rows[i].getAttribute('data-widx');
                rows[i].setAttribute('data-logical-row', String(logicalRow));
                rows[i].setAttribute('data-well-idx', wIdxAttr || '');
                const lpCell = rows[i].children[2];
                if (lpCell) lpCell.textContent = String(logicalRow + 1);
            }
            // przywróć selekcję dla visible slice
            if (typeof _excelSelectedCells !== 'undefined' && _excelSelectedCells.length > 0) {
                for (let s = 0; s < _excelSelectedCells.length; s++) {
                    const c = _excelSelectedCells[s];
                    const row = tbody.querySelector('tr[data-widx="' + c.wIdx + '"]');
                    if (row) {
                        const td = row.children[c.colIdx];
                        if (td) td.classList.add('cell-selected');
                    }
                }
            }
            if (typeof _excelSelectedCols !== 'undefined' && _excelSelectedCols.length > 0) {
                for (let ci = 0; ci < _excelSelectedCols.length; ci++) {
                    const colIdx = _excelSelectedCols[ci];
                    const th = container.querySelector(
                        'thead tr th:nth-child(' + (colIdx + 1) + ')'
                    );
                    if (th) th.classList.add('excel-col-selected');
                }
            }
            const _tLucideStart = _perf ? _excelPerfNow() : 0;
            if (typeof lucide !== 'undefined' && lucide.createIcons) {
                try {
                    lucide.createIcons({ root: tbody });
                } catch (_e) {}
            }
            if (_perf) _excelPerfPush('lucide', _excelPerfNow() - _tLucideStart);
            const _tStickyStart = _perf ? _excelPerfNow() : 0;
            if (typeof _excelApplyStickyColumns === 'function') _excelApplyStickyColumns();
            if (typeof _excelApplyLockedRows === 'function') _excelApplyLockedRows();
            // restore logical focus after recycle — only if grid had focus and active still in viewport
            if (_hadGridFocus && _activeBefore) {
                // use latest active (may have been updated by ensureVisible)
                const toRestore = _excelVirtualActiveCell || _activeBefore;
                if (
                    toRestore &&
                    toRestore.logicalRow >= _excelVirtualStart &&
                    toRestore.logicalRow < _excelVirtualEnd
                ) {
                    // avoid stealing focus if user already moved to search/other input during render
                    const curAe = document.activeElement;
                    const stillGrid =
                        !curAe ||
                        curAe === _hadGridFocusEl ||
                        _excelVirtualIsExcelCell(curAe) ||
                        curAe === document.body;
                    if (stillGrid) {
                        // de-dup: if already focused correct cell, skip
                        const alreadyFocused =
                            curAe &&
                            curAe.closest &&
                            curAe.closest('tr[data-logical-row="' + toRestore.logicalRow + '"]');
                        // noScroll: restore edycji bez ciągnięcia scrolla —
                        // inaczej scroll myszką wracał do komórki (focus + korekta)
                        if (!alreadyFocused) _excelVirtualFocusCell(toRestore, { noScroll: true });
                    }
                } else if (
                    toRestore &&
                    toRestore.logicalRow === _excelVirtualTotal &&
                    _excelVirtualEnd === _excelVirtualTotal
                ) {
                    _excelVirtualFocusCell(toRestore, { noScroll: true });
                }
            }
            if (_perf) _excelPerfPush('sticky', _excelPerfNow() - _tStickyStart);
        }
    }
    if (_perf) {
        _excelPerfPush('total', _excelPerfNow() - _tRenderStart);
        _excelPerfObserveFrame();
    }
    _excelVirtualOffset = 0;
}

// Patch _excelRenderTable gdy virtual=1 — pomijaj full tbody w origRender (P0-B double render)
(function () {
    _excelVirtualEnabled = _excelVirtualIsEnabled();
    if (!_excelVirtualEnabled) return;
    const origRender = typeof _excelRenderTable === 'function' ? _excelRenderTable : null;
    if (!origRender) return;
    window._excelRenderTable = function (dn) {
        const origTbody = window._excelRenderTbody;
        let skipped = false;
        if (typeof origTbody === 'function') {
            window._excelRenderTbody = function () {
                skipped = true;
                return '</thead><tbody></tbody>';
            };
        }
        origRender(dn);
        if (skipped) window._excelRenderTbody = origTbody;
        // po header-only renderze podmień body na virtual slice
        _excelVirtualBuildFiltered();
        _excelVirtualAttach();
        _excelVirtualRenderBody();
        // nadpisz search aby rebuildował filtered
        const origFilter = window.excelFilterWells;
        if (origFilter && !origFilter._virtualPatched) {
            const wrapped = function (v) {
                _excelVirtualBuildFiltered();
                _excelVirtualRenderBody();
            };
            wrapped._virtualPatched = true;
            // zachowaj immediate dla !q
            window._excelVirtualOrigFilter = origFilter;
            // nie nadpisuj globalnie debounce — wywołaj virtual po debounce
            const si = document.getElementById('excel-search-input');
            if (si) {
                si.removeEventListener('input', origFilter);
                si.addEventListener('input', function () {
                    setTimeout(function () {
                        _excelVirtualBuildFiltered();
                        _excelVirtualRenderBody();
                    }, 160);
                });
            }
        }
    };
    // detach przy zamknięciu
    const origClose = typeof _excelCloseOverlay === 'function' ? _excelCloseOverlay : null;
    if (origClose) {
        window._excelCloseOverlay = function () {
            _excelVirtualDetach();
            return origClose.apply(this, arguments);
        };
    }
})();

// ----- model-driven copy/paste & selection dla virtual -----
function _excelVirtualGetCellValue(wellIdx, colIdx) {
    const w = wells[wellIdx];
    if (!w) return '';
    // map colIdx -> field (zgodnie z excelTableBody order, 7 sticky + maxTr*4 + gap2 + wlaz + comps + denn/uszcz/red/kineta/pb)
    if (colIdx === 3) return String(w.name || '');
    if (colIdx === 4) return w.rzednaWlazu != null ? String(w.rzednaWlazu) : '';
    if (colIdx === 5) return w.rzednaDna != null ? String(w.rzednaDna) : '';
    if (colIdx === 6) return String(_excelCalcWellHeight ? _excelCalcWellHeight(w) : '');
    // przejscia: col 7.. 7+maxTr*4-1
    const maxTr =
        typeof _excelMaxTransitions !== 'undefined'
            ? _excelMaxTransitions[_excelActiveTab] || 1
            : 1;
    if (colIdx >= 7 && colIdx < 7 + maxTr * 4) {
        const rel = colIdx - 7;
        const trIdx = Math.floor(rel / 4);
        const sub = rel % 4;
        const prz = (w.przejscia || [])[trIdx];
        if (!prz) return '';
        if (sub === 0) return prz.rzednaWlaczenia != null ? String(prz.rzednaWlaczenia) : '';
        if (sub === 1) return prz.angle != null ? String(prz.angle) : '';
        if (sub === 2) return prz.tempCategory || '';
        if (sub === 3) return prz.productId || '';
    }
    // gap 7+maxTr*4,7+maxTr*4+1 skip
    // po gap: wlaz col = 7+maxTr*4+2
    // dla virtual uproszczenie: komponenty po gap+wlaz są dynamiczne — zwróć count/product
    // jeśli colIdx w zakresie komponentów, pobierz via visibleCols
    try {
        const dn = _excelActiveTab;
        const compCols =
            typeof _excelGetVisibleComponentColumns === 'function'
                ? _excelGetVisibleComponentColumns(dn, w)
                : [];
        const wlazOffset = 7 + maxTr * 4 + 2;
        if (colIdx === wlazOffset)
            return _excelGetWlazFromConfig ? String(_excelGetWlazFromConfig(w) || '') : '';
        if (colIdx > wlazOffset) {
            const compIdx = colIdx - wlazOffset - 1;
            const col = compCols[compIdx];
            if (col) {
                const cnt = _excelCountProductInConfig
                    ? _excelCountProductInConfig(
                          w,
                          col.componentType,
                          col.height,
                          col.productId,
                          col.fromReduction ? col.targetDn || w.redukcjaTargetDN || 1000 : null
                      )
                    : 0;
                return cnt ? String(cnt) : '';
            }
        }
    } catch (_e) {}
    return '';
}

function _excelVirtualHandleCopy(e) {
    if (!_excelVirtualEnabled || !_excelVirtualIsEnabled()) return;
    if (!document.getElementById('excel-table-overlay')) return;
    const hasSel =
        (typeof _excelSelectedCells !== 'undefined' && _excelSelectedCells.length > 0) ||
        (typeof _excelSelectedCols !== 'undefined' && _excelSelectedCols.length > 0) ||
        (typeof window !== 'undefined' && window._excelVirtualSelectionRange);
    if (!hasSel) return;
    let text = '';
    if (typeof window !== 'undefined' && window._excelVirtualSelectionRange) {
        const rg = window._excelVirtualSelectionRange;
        const filtered = _excelVirtualFiltered || [];
        for (let logical = rg.r1; logical <= rg.r2 && logical < filtered.length; logical++) {
            const wIdx = filtered[logical];
            const line = [];
            for (let c = rg.c1; c <= rg.c2; c++) line.push(_excelVirtualGetCellValue(wIdx, c));
            text += line.join('\t') + '\n';
        }
    } else if (typeof _excelSelectedCells !== 'undefined' && _excelSelectedCells.length > 0) {
        let minR = Infinity,
            maxR = -Infinity,
            minC = Infinity,
            maxC = -Infinity;
        _excelSelectedCells.forEach(function (c) {
            if (c.wIdx < minR) minR = c.wIdx;
            if (c.wIdx > maxR) maxR = c.wIdx;
            if (c.colIdx < minC) minC = c.colIdx;
            if (c.colIdx > maxC) maxC = c.colIdx;
        });
        // minR/maxR to wIdx (global), nie logical — map via filtered
        const filtered = _excelVirtualFiltered || [];
        // znajdź logical range odpowiadający wIdx
        for (let r = minR; r <= maxR; r++) {
            const line = [];
            for (let c = minC; c <= maxC; c++) {
                let val = '';
                // czy komórka była zaznaczona?
                let isSel = false;
                for (let s = 0; s < _excelSelectedCells.length; s++)
                    if (_excelSelectedCells[s].wIdx === r && _excelSelectedCells[s].colIdx === c) {
                        isSel = true;
                        break;
                    }
                if (isSel) val = _excelVirtualGetCellValue(r, c);
                line.push(val);
            }
            text += line.join('\t') + '\n';
        }
    } else if (typeof _excelSelectedCols !== 'undefined' && _excelSelectedCols.length > 0) {
        const cols = [..._excelSelectedCols].sort(function (a, b) {
            return a - b;
        });
        const filtered = _excelVirtualFiltered || [];
        for (let i = 0; i < filtered.length; i++) {
            const wIdx = filtered[i];
            const line = [];
            for (let ci = 0; ci < cols.length; ci++)
                line.push(_excelVirtualGetCellValue(wIdx, cols[ci]));
            text += line.join('\t') + '\n';
        }
    }
    if (text && e.clipboardData) {
        e.preventDefault();
        e.clipboardData.setData('text/plain', text);
    }
}

// Ctrl+A w virtual: zaznacz wszystkie logical wiersze (O(1) range, nie 500k td)
function _excelVirtualHandleKeydown(e) {
    if (!_excelVirtualEnabled || !_excelVirtualIsEnabled()) return;
    if (!document.getElementById('excel-table-overlay')) return;
    if (
        (e.ctrlKey || e.metaKey) &&
        !e.shiftKey &&
        !e.altKey &&
        String(e.key).toLowerCase() === 'a'
    ) {
        const active = document.activeElement;
        if (
            active &&
            (active.tagName === 'INPUT' ||
                active.tagName === 'TEXTAREA' ||
                active.isContentEditable)
        )
            return;
        e.preventDefault();
        // range: wszystkie filtered
        const total = _excelVirtualTotal || 0;
        if (total === 0) return;
        // wypełnij _excelSelectedCells jako range O(1) — dla virtual nie buduj 400k entries, tylko mark via filtered
        // fallback: stary array dla kompatybilności, ale ogranicz do max 1000 dla bezpieczeństwa
        if (total > 1000) {
            // O(1) range — czyść array i oznacz логicznie
            if (typeof _excelSelectedCells !== 'undefined') _excelSelectedCells = [];
            // zapisz jako virtual range w osobnej zmiennej
            window._excelVirtualSelectionRange = { r1: 0, r2: total - 1, c1: 0, c2: 30 };
            // wizualnie zaznacz visible slice
            const tbody = document.querySelector('#excel-table-container tbody');
            if (tbody)
                tbody.querySelectorAll('td').forEach(function (td) {
                    td.classList.add('cell-selected');
                });
        } else {
            // małe N — stary sposób
            if (typeof _excelSelectedCells !== 'undefined') {
                _excelSelectedCells = [];
                for (let i = 0; i < total; i++) {
                    const wIdx = _excelVirtualFiltered[i];
                    for (let c = 0; c < 30; c++)
                        _excelSelectedCells.push({ wIdx: wIdx, colIdx: c });
                }
            }
        }
        if (typeof _excelUpdateSelectionSummary === 'function')
            try {
                _excelUpdateSelectionSummary();
            } catch (_e) {}
    }
}

(function () {
    if (typeof document !== 'undefined' && typeof document.addEventListener === 'function') {
        document.addEventListener('copy', _excelVirtualHandleCopy, true);
        document.addEventListener('keydown', _excelVirtualHandleKeydown, true);
    }
})();

// Helper: isCellSelected for visible slice (O(1) range check, logical coords)
function _excelVirtualIsCellSelected(logicalRow, logicalColId) {
    const rg = typeof window !== 'undefined' ? window._excelVirtualSelectionRange : null;
    if (!rg) return false;
    const cIdx = _excelVirtualLogicalCols.indexOf(logicalColId);
    if (cIdx < 0) return false;
    return logicalRow >= rg.r1 && logicalRow <= rg.r2 && cIdx >= rg.c1 && cIdx <= rg.c2;
}

// expose dla testów/oracle
if (typeof window !== 'undefined') {
    window._excelVirtualBuildFiltered = _excelVirtualBuildFiltered;
    window._excelVirtualRenderBody = _excelVirtualRenderBody;
    window._excelVirtualIsEnabled = _excelVirtualIsEnabled;
    window._excelVirtualGetCellValue = _excelVirtualGetCellValue;
    window._excelVirtualIsCellSelected = _excelVirtualIsCellSelected;
    window._excelVirtualGetLogicalCols = function () {
        return _excelVirtualLogicalCols.slice();
    };
    window._excelVirtualIsExcelCell = _excelVirtualIsExcelCell;
    window._excelVirtualSyncActiveFromElement = _excelVirtualSyncActiveFromElement;
    window._excelVirtualFocusCell = _excelVirtualFocusCell;
    window._excelVirtualFocusableIds = _excelVirtualFocusableIds;
    window._excelVirtualFindEnabledInRow = _excelVirtualFindEnabledInRow;
    window._excelVirtualEnsureVisible = _excelVirtualEnsureVisible;
    window._excelVirtualClampActive = _excelVirtualClampActive;
    window._excelVirtualGetActiveCell = function () {
        return _excelVirtualActiveCell ? { ..._excelVirtualActiveCell } : null;
    };
    window._excelVirtualSetActiveCell = function (c) {
        _excelVirtualActiveCell = c
            ? { logicalRow: c.logicalRow, logicalColId: c.logicalColId }
            : null;
    };
    window.EXCEL_ROW_HEIGHT = EXCEL_ROW_HEIGHT;
    window.__excelPerfReport = __excelPerfReport;
    window.__excelPerfReset = __excelPerfReset;
}
