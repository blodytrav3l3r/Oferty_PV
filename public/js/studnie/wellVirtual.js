// @ts-nocheck
/* ===== WELL VIRTUAL — viewport dla konfiguratora =====
 * Model SSoT: wells[] + _wellVirtualFiltered[logical→wellIdx]
 * DOM = view only: ~30 cards + spacery, bez przeciążania drzewa DOM
 * Statyczne granice nagłówków grup (isStart) + Prefix Sums dla 100% precyzji spacerów (0 layout shifts/jumps)
 * Scoped icon generation + rAF scroll handler z ochroną przed pętlami re-entrancy
 */

const WELL_CARD_HEIGHT = 78;
const WELL_OVERSCAN_PX = 350;

let _wellVirtualEnabled = false;
let _wellVirtualRaf = 0;
let _wellVirtualIsRendering = false;
let _wellVirtualFiltered = null; // number[] wellIdx
let _wellVirtualGroupStarts = null; // boolean[] isGroupStart
let _wellVirtualPrefixSums = null; // number[] cumulative heights
let _wellVirtualTotal = 0;
let _wellVirtualStart = 0;
let _wellVirtualEnd = 0;
let _wellVirtualContainer = null;
let _wellVirtualTransportMap = null;
let _wellVirtualStatsMap = null;

let _wellVirtualMeasuredNoElev = 76;
let _wellVirtualMeasuredElev = 104;
const _wellVirtualMeasuredHeader = 34;

function _wellVirtualCardHtml(w, wIdx, logicalRow, transportVal, stats) {
    if (typeof _wellBuildCardHtml === 'function') {
        return _wellBuildCardHtml(w, wIdx, logicalRow, transportVal, stats);
    }
    const esc =
        typeof escapeHtml === 'function'
            ? escapeHtml
            : function (s) {
                  return String(s);
              };
    return (
        '<div class="well-list-item" data-widx="' +
        wIdx +
        '" data-logical-row="' +
        logicalRow +
        '" data-well-idx="' +
        wIdx +
        '" onclick="selectWell(' +
        wIdx +
        ')">' +
        esc(w ? w.name || '' : '') +
        '</div>'
    );
}

function _wellVirtualIsRequestEnabled() {
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

function _wellVirtualIsEnabled() {
    if (_wellVirtualIsRequestEnabled() === false) {
        // effectiveVirtual = requestVirtual || total > 500 — diagnostyka vs enforcement (v1.1)
        try {
            const n = typeof wells !== 'undefined' && Array.isArray(wells) ? wells.length : 0;
            if (n > 500) return true;
        } catch (_e) {}
        return false;
    }
    return true;
}

function _wellVirtualBuildFiltered() {
    if (typeof wells === 'undefined' || !Array.isArray(wells)) {
        _wellVirtualFiltered = [];
        _wellVirtualTotal = 0;
        _wellVirtualGroupStarts = [];
        _wellVirtualPrefixSums = [0];
        return;
    }
    const searchEl =
        typeof document !== 'undefined' ? document.getElementById('wells-search-input') : null;
    const q = searchEl
        ? String(searchEl.value || '')
              .trim()
              .toLowerCase()
        : '';
    const tmp = [];
    const order = { 1000: 0, 1200: 1, 1500: 2, 2000: 3, 2500: 4, styczna: 5 };
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

    _wellVirtualFiltered = tmp;
    _wellVirtualTotal = tmp.length;

    // Przelicz statyczne granice grup oraz prefiksowe sumy wysokości
    const groupStarts = new Array(tmp.length);
    const prefixSums = new Array(tmp.length + 1);
    prefixSums[0] = 0;

    const hCardNoElev = _wellVirtualMeasuredNoElev || 62;
    const hCardElev = _wellVirtualMeasuredElev || 84;
    const hHeader = _wellVirtualMeasuredHeader || 34;

    let lastDnKey = null;
    for (let k = 0; k < tmp.length; k++) {
        const wIdx = tmp[k];
        const w = wells[wIdx];
        const dnKey = w ? (w.dn === 'styczna' ? 'styczna' : String(w.dn)) : '';

        const isStart = k === 0 || dnKey !== lastDnKey;
        groupStarts[k] = isStart;
        if (isStart) lastDnKey = dnKey;

        const hasElevations = w && w.rzednaWlazu != null && w.rzednaDna != null;
        const cardH = hasElevations ? hCardElev : hCardNoElev;
        const headH = isStart ? hHeader : 0;
        const totalItemH = cardH + headH;

        prefixSums[k + 1] = prefixSums[k] + totalItemH;
    }

    _wellVirtualGroupStarts = groupStarts;
    _wellVirtualPrefixSums = prefixSums;

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
    if (!c || !_wellVirtualPrefixSums || _wellVirtualTotal === 0) {
        return { start: 0, end: Math.min(_wellVirtualTotal, 30) };
    }
    const scrollTop = c.scrollTop || 0;
    const ch = c.clientHeight || 500;

    const targetTop = Math.max(0, scrollTop - WELL_OVERSCAN_PX);
    const targetBottom = scrollTop + ch + WELL_OVERSCAN_PX;

    // Wyszukiwanie binarne dla start
    let start = 0;
    let low = 0,
        high = _wellVirtualTotal - 1;
    while (low <= high) {
        const mid = (low + high) >> 1;
        if (_wellVirtualPrefixSums[mid + 1] >= targetTop) {
            start = mid;
            high = mid - 1;
        } else {
            low = mid + 1;
        }
    }

    // Wyszukiwanie binarne dla end
    let end = _wellVirtualTotal;
    ((low = start), (high = _wellVirtualTotal - 1));
    while (low <= high) {
        const mid = (low + high) >> 1;
        if (_wellVirtualPrefixSums[mid] >= targetBottom) {
            end = mid;
            high = mid - 1;
        } else {
            low = mid + 1;
        }
    }

    if (start < 0) start = 0;
    if (end > _wellVirtualTotal) end = _wellVirtualTotal;
    if (end < start) end = start;

    // Gdy użytkownik przewija blisko końca (np. ostatnie 15 elementów), wymuś renderowanie do końca
    if (_wellVirtualTotal - end < 15) {
        end = _wellVirtualTotal;
    }

    return { start, end };
}

function _wellVirtualOnScroll() {
    if (_wellVirtualIsRendering) return;
    if (_wellVirtualRaf) cancelAnimationFrame(_wellVirtualRaf);
    _wellVirtualRaf = requestAnimationFrame(function () {
        _wellVirtualRaf = 0;
        if (_wellVirtualIsRendering) return;
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
        if (searchEl._wellSearchPatched) {
            searchEl._wellVirtualPatched = true;
            return;
        }
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
    if (getComputedStyle(c).overflowY === 'visible' || getComputedStyle(c).overflowY === 'hidden') {
        c.style.overflowY = 'auto';
    }
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

function _wellVirtualCalibrateHeights(container) {
    const cards = container.querySelectorAll('.well-list-item[data-widx]');
    if (!cards.length) return;
    let sumNo = 0,
        countNo = 0;
    let sumEl = 0,
        countEl = 0;
    for (let i = 0; i < cards.length; i++) {
        const card = cards[i];
        const h = card.getBoundingClientRect().height;
        if (h < 40 || h > 160) continue;
        const hasElev = card.querySelector('.well-list-elevations') !== null;
        if (hasElev) {
            sumEl += h;
            countEl++;
        } else {
            sumNo += h;
            countNo++;
        }
    }
    let changed = false;
    if (countNo >= 3) {
        const avg = Math.round(sumNo / countNo);
        if (Math.abs(avg - _wellVirtualMeasuredNoElev) > 3) {
            _wellVirtualMeasuredNoElev = avg;
            changed = true;
        }
    }
    if (countEl >= 3) {
        const avg = Math.round(sumEl / countEl);
        if (Math.abs(avg - _wellVirtualMeasuredElev) > 3) {
            _wellVirtualMeasuredElev = avg;
            changed = true;
        }
    }
    if (changed && _wellVirtualFiltered) {
        // Zaktualizuj sumy prefiksowe przy zmianie pomiarów
        const groupStarts = _wellVirtualGroupStarts;
        const prefixSums = _wellVirtualPrefixSums;
        if (groupStarts && prefixSums) {
            const hCardNoElev = _wellVirtualMeasuredNoElev;
            const hCardElev = _wellVirtualMeasuredElev;
            const hHeader = _wellVirtualMeasuredHeader;
            for (let k = 0; k < _wellVirtualFiltered.length; k++) {
                const wIdx = _wellVirtualFiltered[k];
                const w = wells[wIdx];
                const isStart = groupStarts[k];
                const hasElevations = w && w.rzednaWlazu != null && w.rzednaDna != null;
                const cardH = hasElevations ? hCardElev : hCardNoElev;
                const headH = isStart ? hHeader : 0;
                prefixSums[k + 1] = prefixSums[k] + cardH + headH;
            }
        }
    }
}

function _wellVirtualRenderBody() {
    if (!_wellVirtualEnabled) return;
    if (!_wellVirtualFiltered || !_wellVirtualPrefixSums) _wellVirtualBuildFiltered();
    const container =
        typeof document !== 'undefined' ? document.getElementById('wells-list') : null;
    if (!container) return;

    if (_wellVirtualTotal === 0) {
        container.innerHTML =
            '<div style="padding:2rem; text-align:center; color:var(--text-muted); font-size: var(--fs-lg);">Brak dodanych studni.<br>Wybierz średnicę z przycisków powyżej.</div>';
        return;
    }

    const range = _wellVirtualGetVisibleRange();
    _wellVirtualStart = range.start;
    _wellVirtualEnd = range.end;

    const start = _wellVirtualStart;
    const end = _wellVirtualEnd;

    const topH = _wellVirtualPrefixSums[start] || 0;
    const bottomH =
        (_wellVirtualPrefixSums[_wellVirtualTotal] || 0) - (_wellVirtualPrefixSums[end] || 0);

    let html = '';
    if (topH > 0) html += '<div style="height:' + topH + 'px;"></div>';

    // Pamięć podręczna transportu oraz statystyk dla aktualnego wycinka
    try {
        if (typeof calculateWellTransportMap === 'function') {
            const tm = calculateWellTransportMap(wells);
            _wellVirtualTransportMap = new Map();
            if (tm.map) {
                // ponytail: cached wellsById Map O(1), nie wells.indexOf O(N²)
                const getIdx =
                    typeof getWellIndexById === 'function'
                        ? function (w) {
                              return w && w.id != null ? getWellIndexById(w.id) : -1;
                          }
                        : function (w) {
                              return wells.indexOf(w);
                          };
                for (const [wellObj, cost] of tm.map.entries()) {
                    const idx = getIdx(wellObj);
                    if (idx >= 0) _wellVirtualTransportMap.set(idx, cost);
                    _wellVirtualTransportMap.set(wellObj, cost);
                }
            }
        }
    } catch (_e) {}

    try {
        _wellVirtualStatsMap = new Map();
        for (let s = start; s < end; s++) {
            const wIdx = _wellVirtualFiltered[s];
            const w = wells[wIdx];
            if (w && typeof calcWellStats === 'function')
                _wellVirtualStatsMap.set(wIdx, calcWellStats(w));
        }
    } catch (_e) {}

    for (let s = start; s < end; s++) {
        const wIdx = _wellVirtualFiltered[s];
        const w = wells[wIdx];
        if (!w) continue;

        // Renderuj nagłówek TYLKO wtedy, gdy ten element fizycznie rozpoczyna nową grupę DN
        if (_wellVirtualGroupStarts[s]) {
            const dn = w.dn === 'styczna' ? 'styczna' : String(w.dn);
            const title = dn === 'styczna' ? 'Studnie Styczne' : 'Studnie DN' + dn;
            html +=
                '<div class="well-group-header" style="font-size: var(--fs-xs); color:var(--text-muted); text-transform:uppercase; margin: 0.8rem 0 0.35rem 0.3rem; letter-spacing:0.8px; font-weight: var(--fw-extrabold); opacity:0.7;">' +
                title +
                '</div>';
        }

        const transportVal = _wellVirtualTransportMap ? _wellVirtualTransportMap.get(wIdx) || 0 : 0;
        const stats = _wellVirtualStatsMap ? _wellVirtualStatsMap.get(wIdx) : null;

        if (typeof _wellBuildCardHtml === 'function') {
            html += _wellBuildCardHtml(w, wIdx, s, transportVal, stats);
        } else {
            // Minimalny fallback
            html +=
                '<div class="well-list-item" data-widx="' +
                wIdx +
                '" data-logical-row="' +
                s +
                '" data-well-idx="' +
                wIdx +
                '" onclick="selectWell(' +
                wIdx +
                ')" style="box-sizing:border-box;">' +
                (typeof escapeHtml === 'function'
                    ? escapeHtml(w.name || '')
                    : String(w.name || '')) +
                '</div>';
        }
    }

    if (bottomH > 0) html += '<div style="height:' + bottomH + 'px;"></div>';
    if (end === _wellVirtualTotal) html += '<div style="height:60px; flex-shrink:0;"></div>';

    const prevLeft = container.scrollLeft;
    _wellVirtualIsRendering = true;
    container.innerHTML = html;
    container.scrollLeft = prevLeft;
    _wellVirtualIsRendering = false;

    if (window.lucide && window.lucide.createIcons) {
        try {
            window.lucide.createIcons({ root: container });
        } catch (_e) {}
    }
    try {
        container.classList.toggle('wells-list--many', wells.length > 200);
    } catch (_e) {}
}

(function () {
    _wellVirtualEnabled = _wellVirtualIsEnabled();
    if (!_wellVirtualEnabled) return;

    window.renderWellsList = function () {
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
    window._wellVirtualCardHtml = _wellVirtualCardHtml;
    window.WELL_CARD_HEIGHT = WELL_CARD_HEIGHT;
}
