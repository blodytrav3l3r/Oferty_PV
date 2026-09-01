// @ts-nocheck
/* ===== WELL VIRTUAL — viewport dla konfiguratora (C-2) =====
 * Model SSoT: wells[] + wellIndexById + filteredIndexes[logical→wellIdx]
 * DOM = view only: ~50 cards + spacers, nie 10k
 * Flag: ?wellVirtual=1 (progressive, legacy pozostaje oracle)
 * Row binding: data-logical-row + data-well-idx, event czyta aktualny binding
 */

const WELL_CARD_HEIGHT = 78;
const WELL_OVERSCAN = 10;

let _wellVirtualEnabled = false;
let _wellVirtualRaf = 0;
let _wellVirtualFiltered = null; // number[] wellIdx
let _wellVirtualTotal = 0;
let _wellVirtualStart = 0;
let _wellVirtualEnd = 0;
let _wellVirtualContainer = null;
let _wellVirtualTransportMap = null;
let _wellVirtualStatsMap = null;

function _wellVirtualIsEnabled() {
    try {
        if (
            typeof window !== 'undefined' &&
            window.location &&
            window.location.search.indexOf('wellVirtual=0') >= 0
        )
            return false;
        if (typeof localStorage !== 'undefined' && localStorage.getItem('sok_well_virtual') === '0')
            return false;
    } catch (_e) {}
    return true;
}

function _wellVirtualBuildFiltered() {
    if (typeof wells === 'undefined' || !Array.isArray(wells)) {
        _wellVirtualFiltered = [];
        _wellVirtualTotal = 0;
        return;
    }
    const searchEl =
        typeof document !== 'undefined' ? document.getElementById('wells-search-input') : null;
    const q = searchEl
        ? String(searchEl.value || '')
              .trim()
              .toLowerCase()
        : '';
    const arr = [];
    // preserve DN group order 1000,1200,... but via single pass stable sort by dktCap index
    const order = { 1000: 0, 1200: 1, 1500: 2, 2000: 3, 2500: 4, styczna: 5 };
    const tmp = [];
    for (let i = 0; i < wells.length; i++) {
        const w = wells[i];
        if (!w) continue;
        if (
            q &&
            String(w.name || '')
                .toLowerCase()
                .indexOf(q) < 0
        )
            continue;
        tmp.push(i);
    }
    tmp.sort(function (a, b) {
        const da = String(wells[a].dn);
        const db = String(wells[b].dn);
        const oa = order[da] !== undefined ? order[da] : 99;
        const ob = order[db] !== undefined ? order[db] : 99;
        if (oa !== ob) return oa - ob;
        return a - b;
    });
    for (let k = 0; k < tmp.length; k++) arr.push(tmp[k]);
    _wellVirtualFiltered = arr;
    _wellVirtualTotal = arr.length;
    try {
        if (typeof window !== 'undefined') {
            window._wellVirtualFiltered = _wellVirtualFiltered;
            window._wellVirtualTotal = _wellVirtualTotal;
        }
    } catch (_e) {}
}

function _wellVirtualGetVisibleRange() {
    const c =
        _wellVirtualContainer ||
        (typeof document !== 'undefined' ? document.getElementById('wells-list') : null);
    if (!c) return { start: 0, end: Math.min(_wellVirtualTotal, 30) };
    const scrollTop = c.scrollTop || 0;
    const h = c.clientHeight || 400;
    const rowsInView = Math.ceil(h / WELL_CARD_HEIGHT);
    let start = Math.floor(scrollTop / WELL_CARD_HEIGHT) - WELL_OVERSCAN;
    if (start < 0) start = 0;
    let end = start + rowsInView + WELL_OVERSCAN * 2;
    if (end > _wellVirtualTotal) {
        end = _wellVirtualTotal;
        start = Math.max(0, end - rowsInView - WELL_OVERSCAN * 2);
    }
    return { start, end };
}

function _wellVirtualOnScroll() {
    if (_wellVirtualRaf) cancelAnimationFrame(_wellVirtualRaf);
    _wellVirtualRaf = requestAnimationFrame(function () {
        _wellVirtualRaf = 0;
        const r = _wellVirtualGetVisibleRange();
        if (r.start === _wellVirtualStart && r.end === _wellVirtualEnd) return;
        _wellVirtualRenderBody();
    });
}

let _wellVirtualSearchDebounce = null;
function _wellVirtualPatchSearch() {
    try {
        const searchEl =
            typeof document !== 'undefined' ? document.getElementById('wells-search-input') : null;
        if (!searchEl || searchEl._wellVirtualPatched) return;
        searchEl.removeAttribute('oninput');
        searchEl.oninput = null;
        searchEl.addEventListener('input', function () {
            if (_wellVirtualSearchDebounce) clearTimeout(_wellVirtualSearchDebounce);
            _wellVirtualSearchDebounce = setTimeout(function () {
                _wellVirtualSearchDebounce = null;
                _wellVirtualBuildFiltered();
                _wellVirtualRenderBody();
                const counter = document.getElementById('wells-counter');
                if (counter) counter.textContent = '(' + wells.length + ')';
            }, 150);
        });
        searchEl._wellVirtualPatched = true;
    } catch (_e) {}
}

function _wellVirtualAttach() {
    const c = typeof document !== 'undefined' ? document.getElementById('wells-list') : null;
    if (!c || _wellVirtualContainer === c) {
        _wellVirtualPatchSearch();
        return;
    }
    _wellVirtualContainer = c;
    c.removeEventListener('scroll', _wellVirtualOnScroll);
    c.addEventListener('scroll', _wellVirtualOnScroll, { passive: true });
    if (!c.style.maxHeight) c.style.maxHeight = '60vh';
    c.style.overflow = 'auto';
    _wellVirtualPatchSearch();
}

function _wellVirtualDetach() {
    if (_wellVirtualContainer) {
        _wellVirtualContainer.removeEventListener('scroll', _wellVirtualOnScroll);
        _wellVirtualContainer = null;
    }
    if (_wellVirtualRaf) {
        cancelAnimationFrame(_wellVirtualRaf);
        _wellVirtualRaf = 0;
    }
}

function _wellVirtualCardHtml(w, wIdx, logicalRow) {
    try {
        const isActive = typeof currentWellIndex !== 'undefined' && wIdx === currentWellIndex;
        const stats =
            _wellVirtualStatsMap && _wellVirtualStatsMap.has(wIdx)
                ? _wellVirtualStatsMap.get(wIdx)
                : typeof calcWellStats === 'function'
                  ? calcWellStats(w)
                  : { price: 0, weight: 0, height: 0 };
        const hasElevations = w.rzednaWlazu != null && w.rzednaDna != null;
        const requiredH = hasElevations ? Math.round((w.rzednaWlazu - w.rzednaDna) * 1000) : null;
        let transportVal = 0;
        try {
            if (_wellVirtualTransportMap) {
                transportVal =
                    _wellVirtualTransportMap.get(wIdx) || _wellVirtualTransportMap.get(w) || 0;
            } else if (typeof calculateWellTransportMap === 'function') {
                const tm = calculateWellTransportMap(wells);
                transportVal = tm.map ? tm.map.get(w) || 0 : 0;
            }
        } catch (_e) {}
        const hasErrors = (function () {
            if (!w) return false;
            if (w.rzednaWlazu != null && w.rzednaDna != null) {
                const req = Math.round((w.rzednaWlazu - w.rzednaDna) * 1000);
                const s = typeof calcWellStats === 'function' ? calcWellStats(w) : { height: 0 };
                if (s.height - req > 20 || req - s.height > 100) return true;
            }
            if (
                w.configStatus === 'ERROR' ||
                (w.configErrors && w.configErrors.length > 0 && w.configStatus !== 'OK')
            )
                return true;
            return false;
        })();
        const errorStyling = hasErrors
            ? ' background:rgba(var(--danger-rgb), 0.15) !important;'
            : '';
        const errorNameStyle = hasErrors
            ? 'color:var(--danger) !important; font-weight: var(--fw-bold) !important;'
            : '';
        const isLocked = typeof isWellLocked === 'function' ? isWellLocked(wIdx) : false;
        const fmtIntFn =
            typeof fmtInt === 'function'
                ? fmtInt
                : function (n) {
                      return String(n);
                  };
        const esc =
            typeof escapeHtml === 'function'
                ? escapeHtml
                : function (s) {
                      return String(s);
                  };
        let html =
            '<div class="well-list-item ' +
            (isActive ? 'active' : '') +
            '" data-widx="' +
            wIdx +
            '" data-logical-row="' +
            logicalRow +
            '" data-well-idx="' +
            wIdx +
            '" style="' +
            (isLocked ? ' opacity:0.7;' : '') +
            errorStyling +
            '" onclick="selectWell(' +
            wIdx +
            ')">';
        html +=
            '<div class="well-list-header" style="display:flex; align-items:center; gap:0.4rem;"><div class="well-list-name" style="flex:1; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; ' +
            errorNameStyle +
            '" title="' +
            esc(w.name || '').replace(/"/g, '&quot;') +
            '">' +
            esc(w.name || '') +
            '</div>';
        html +=
            '<div class="well-list-actions"><button class="well-list-action" title="Uwagi" onclick="event.stopPropagation(); openWellNotesModal(' +
            wIdx +
            ')"><i data-lucide="file-text"></i></button><button class="well-list-action" title="Duplikuj" onclick="event.stopPropagation(); duplicateWell(' +
            wIdx +
            ')"><i data-lucide="clipboard-list"></i></button><button class="well-list-action del" title="Usuń" onclick="event.stopPropagation(); removeWell(' +
            wIdx +
            ')"><i data-lucide="x"></i></button></div></div>';
        html +=
            '<div class="well-list-meta"><div style="display:flex; gap:0.6rem;"><span>Elementy: <strong>' +
            (w.config || []).length +
            '</strong></span><span>Przejścia: <strong>' +
            (w.przejscia ? w.przejscia.length : 0) +
            '</strong></span></div><span class="well-list-price">' +
            fmtIntFn(stats.price + transportVal) +
            ' PLN</span></div>';
        if (hasElevations) {
            html +=
                '<div class="well-list-elevations"><span>↑ <strong>' +
                Number(w.rzednaWlazu).toFixed(3) +
                '</strong></span><span>↓ <strong>' +
                Number(w.rzednaDna).toFixed(3) +
                '</strong></span><span style="margin-left:auto;">H=<strong>' +
                requiredH +
                '</strong>mm</span></div>';
        }
        html += '</div>';
        return html;
    } catch (_e) {
        return (
            '<div class="well-list-item" data-widx="' +
            wIdx +
            '" data-logical-row="' +
            logicalRow +
            '" onclick="selectWell(' +
            wIdx +
            ')">' +
            (w.name || '') +
            '</div>'
        );
    }
}
if (typeof window !== 'undefined') window._wellVirtualCardHtml = _wellVirtualCardHtml;

function _wellVirtualRenderBody() {
    if (!_wellVirtualEnabled) return;
    if (!_wellVirtualFiltered) _wellVirtualBuildFiltered();
    const range = _wellVirtualGetVisibleRange();
    _wellVirtualStart = range.start;
    _wellVirtualEnd = range.end;
    const total = _wellVirtualTotal;
    const start = _wellVirtualStart;
    const end = _wellVirtualEnd;
    // Build slice wells
    const sliceIdx = _wellVirtualFiltered.slice(start, end);
    // Delegate to existing card renderer but for slice only — reuse wellUI's card HTML generator if available
    // Fallback: generate via _wellVirtualCardHtml
    let html = '';
    const topH = start * WELL_CARD_HEIGHT;
    const bottomH = (total - end) * WELL_CARD_HEIGHT;
    if (topH > 0) html += '<div style="height:' + topH + 'px;"></div>';
    // C-2.1: build transport + stats caches once per tick
    try {
        if (typeof calculateWellTransportMap === 'function') {
            const tm = calculateWellTransportMap(wells);
            _wellVirtualTransportMap = new Map();
            if (tm.map) {
                for (const [wellObj, cost] of tm.map.entries()) {
                    const idx = wells.indexOf(wellObj);
                    if (idx >= 0) _wellVirtualTransportMap.set(idx, cost);
                    _wellVirtualTransportMap.set(wellObj, cost);
                }
            }
        }
    } catch (_e) {
        _wellVirtualTransportMap = null;
    }
    try {
        _wellVirtualStatsMap = new Map();
        for (let sIdx = 0; sIdx < sliceIdx.length; sIdx++) {
            const wIdx = sliceIdx[sIdx];
            const w = wells[wIdx];
            if (w && typeof calcWellStats === 'function')
                _wellVirtualStatsMap.set(wIdx, calcWellStats(w));
        }
    } catch (_e) {}
    // group headers within slice
    let lastDn = null;
    for (let s = 0; s < sliceIdx.length; s++) {
        const wIdx = sliceIdx[s];
        const w = wells[wIdx];
        if (!w) continue;
        const dn = w.dn === 'styczna' ? 'styczna' : String(w.dn);
        if (dn !== lastDn) {
            lastDn = dn;
            const title = dn === 'styczna' ? 'Studnie Styczne' : 'Studnie DN' + dn;
            html +=
                '<div style="font-size: var(--fs-xs); color:var(--text-muted); text-transform:uppercase; margin: 0.8rem 0 0.35rem 0.3rem; letter-spacing:0.8px; font-weight: var(--fw-extrabold); opacity:0.7;">' +
                title +
                '</div>';
        }
        if (typeof _wellVirtualCardHtml === 'function') {
            html += _wellVirtualCardHtml(w, wIdx, start + s);
        } else if (typeof _wellBuildCardHtml === 'function') {
            html += _wellBuildCardHtml(w, wIdx);
        } else {
            // minimal fallback
            html +=
                '<div class="well-list-item" data-widx="' +
                wIdx +
                '" data-logical-row="' +
                (start + s) +
                '" data-well-idx="' +
                wIdx +
                '" onclick="selectWell(' +
                wIdx +
                ')" style="height:' +
                WELL_CARD_HEIGHT +
                'px;overflow:hidden;box-sizing:border-box;">' +
                escapeHtml(w.name || '') +
                '</div>';
        }
    }
    // ensure logical binding on fallback cards that lack it
    if (bottomH > 0) html += '<div style="height:' + bottomH + 'px;"></div>';
    const container =
        typeof document !== 'undefined' ? document.getElementById('wells-list') : null;
    if (!container) return;
    // preserve scroll
    const prevLeft = container.scrollLeft;
    // Use innerHTML for now — R11 recycling will be added via patching node identity check (future: reuse nodes)
    container.innerHTML = html;
    container.scrollLeft = prevLeft;
    // Ensure data-logical-row on each card (for fallback path, already set; for _wellVirtualCardHtml path, patch)
    const cards = container.querySelectorAll('.well-list-item[data-widx]');
    for (let i = 0; i < cards.length; i++) {
        const c = cards[i];
        if (!c.getAttribute('data-logical-row')) {
            const wIdx = parseInt(c.getAttribute('data-widx') || '-1', 10);
            const logical = _wellVirtualFiltered.indexOf(wIdx);
            if (logical >= 0) {
                c.setAttribute('data-logical-row', String(logical));
                c.setAttribute('data-well-idx', String(wIdx));
            }
        }
    }
    if (window.lucide && window.lucide.createIcons) {
        try {
            window.lucide.createIcons({ root: container });
        } catch (_e) {}
    }
}

(function () {
    _wellVirtualEnabled = _wellVirtualIsEnabled();
    if (!_wellVirtualEnabled) return;
    // Patch renderWellsList to use virtual slice
    const orig = typeof window.renderWellsList === 'function' ? window.renderWellsList : null;
    if (!orig) return;
    window.renderWellsList = function () {
        // For virtual path, skip original's full wells.map+filter and use virtual filtered
        // Keep original's side effects (refreshAllWellErrors etc.) but via virtual render
        if (typeof refreshAllWellErrors === 'function') {
            try {
                refreshAllWellErrors();
            } catch (_e) {}
        }
        _wellVirtualBuildFiltered();
        _wellVirtualAttach();
        _wellVirtualRenderBody();
        const counter = document.getElementById('wells-counter');
        if (counter) counter.textContent = '(' + wells.length + ')';
        if (typeof renderDiscountPanel === 'function') {
            try {
                renderDiscountPanel();
            } catch (_e) {}
        }
    };
})();

if (typeof window !== 'undefined') {
    window._wellVirtualBuildFiltered = _wellVirtualBuildFiltered;
    window._wellVirtualRenderBody = _wellVirtualRenderBody;
    window._wellVirtualIsEnabled = _wellVirtualIsEnabled;
    window.WELL_CARD_HEIGHT = WELL_CARD_HEIGHT;
}
