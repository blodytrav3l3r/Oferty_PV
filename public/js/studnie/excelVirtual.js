// @ts-check
/* ===== EXCEL VIRTUAL — viewport dla 10k studni (B) =====
 * 7 kolumn sticky zawsze widoczne (Checkbox..Wys) jak w 14c6d09.
 * Model SSoT: wells + filteredIndexes[logical→wellIdx] + selection range.
 * DOM to tylko widok: 40-70 wierszy + spacery, nie 10k.
 * Flag: ?virtual=1  (progessive, legacy pozostaje oracle)
 */

const EXCEL_ROW_HEIGHT = 32;
const EXCEL_OVERSCAN = 10;
const EXCEL_VIEWPORT_ROWS = 20;

let _excelVirtualEnabled = false;
const _excelVirtualScrollTop = 0;
let _excelVirtualRaf = 0;
let _excelVirtualFiltered = null; // number[] wellIdx
let _excelVirtualTotal = 0;
let _excelVirtualStart = 0;
let _excelVirtualEnd = 0;
let _excelVirtualContainer = null;

function _excelVirtualIsEnabled() {
    try {
        if (
            typeof window !== 'undefined' &&
            window.location &&
            window.location.search.indexOf('virtual=1') >= 0
        )
            return true;
        if (
            typeof localStorage !== 'undefined' &&
            localStorage.getItem('sok_excel_virtual') === '1'
        )
            return true;
    } catch (_e) {}
    return false;
}

function _excelVirtualBuildFiltered() {
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
        const range = _excelVirtualGetVisibleRange();
        if (range.start === _excelVirtualStart && range.end === _excelVirtualEnd) return;
        _excelVirtualRenderBody();
    });
}

function _excelVirtualAttach() {
    const c = document.getElementById('excel-table-container');
    if (!c || _excelVirtualContainer === c) return;
    _excelVirtualContainer = c;
    c.removeEventListener('scroll', _excelVirtualOnScroll);
    c.addEventListener('scroll', _excelVirtualOnScroll, { passive: true });
    // wysokość viewport 60vh, overflow auto
    if (!c.style.maxHeight) c.style.maxHeight = '60vh';
    c.style.overflow = 'auto';
}

function _excelVirtualDetach() {
    if (_excelVirtualContainer) {
        _excelVirtualContainer.removeEventListener('scroll', _excelVirtualOnScroll);
        _excelVirtualContainer = null;
    }
    if (_excelVirtualRaf) {
        cancelAnimationFrame(_excelVirtualRaf);
        _excelVirtualRaf = 0;
    }
}

function _excelVirtualRenderBody() {
    if (!_excelVirtualEnabled) return;
    if (!_excelVirtualFiltered) _excelVirtualBuildFiltered();
    const range = _excelVirtualGetVisibleRange();
    _excelVirtualStart = range.start;
    _excelVirtualEnd = range.end;
    const total = _excelVirtualTotal;
    const start = _excelVirtualStart;
    const end = _excelVirtualEnd;
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
    // render tbody slice via istniejący helper (Map w środku już O(n) lekko — dla slice 50 wierszy tanie)
    let bodyHtml = '';
    if (typeof _excelRenderTbody === 'function') {
        // _excelRenderTbody oczekuje tabWells, ale liczy dup na wells global — dla virtual slice dup może być niepełny, więc liczymy osobno
        bodyHtml = _excelRenderTbody(sliceWells, dn, compCols, maxTr, hasReduction);
        // usuń </thead><tbody> wrapper — wstawimy spacery
        bodyHtml = bodyHtml.replace('</thead><tbody>', '').replace('</tbody>', '');
        // wstaw spacery
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
        bodyHtml = topSpacer + bodyHtml + bottomSpacer;
        const container = document.getElementById('excel-table-container');
        if (!container) return;
        const tbody = container.querySelector('tbody');
        if (tbody) {
            tbody.innerHTML = bodyHtml;
            if (typeof lucide !== 'undefined' && lucide.createIcons) {
                try {
                    lucide.createIcons({ root: tbody });
                } catch (_e) {}
            }
            if (typeof _excelApplyStickyColumns === 'function') _excelApplyStickyColumns();
            if (typeof _excelApplyLockedRows === 'function') _excelApplyLockedRows();
        }
    }
}

// Patch _excelRenderTable gdy virtual=1
(function () {
    _excelVirtualEnabled = _excelVirtualIsEnabled();
    if (!_excelVirtualEnabled) return;
    const origRender = typeof _excelRenderTable === 'function' ? _excelRenderTable : null;
    if (!origRender) return;
    window._excelRenderTable = function (dn) {
        // pełny render dla header, ale body virtual
        origRender(dn);
        // po pełnym renderze podmień body na virtual slice
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

// expose dla testów/oracle
if (typeof window !== 'undefined') {
    window._excelVirtualBuildFiltered = _excelVirtualBuildFiltered;
    window._excelVirtualRenderBody = _excelVirtualRenderBody;
    window._excelVirtualIsEnabled = _excelVirtualIsEnabled;
    window.EXCEL_ROW_HEIGHT = EXCEL_ROW_HEIGHT;
}
