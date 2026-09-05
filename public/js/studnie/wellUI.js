// @ts-check
/* ===== WELL UI RENDERING (WRAPPER) ===== */
/* UI modules extracted to: uiLockBanners.js, uiParamTiles.js, uiWellParams.js, uiTabSwitcher.js */

/* ===== RENDEROWANIE LISTY STUDNI ===== */
// Debounce + per-tick cache (Faza 0 visual-safe): nie zmienia wyglądu, tylko koszt renderu.
let _wellSearchDebounce = null;
let _wellStatsCache = null;
window.renderWellsList = function renderWellsList() {
    const container = document.getElementById('wells-list');
    if (!container) return;

    // Przelicz bezwzględnie wszystkie studnie z tła, aby uzyskać aktualne błędy grubości rur / luzów
    refreshAllWellErrors();

    // Per-tick cache stats — jeden calcWellStats per well na render, nie 2×
    _wellStatsCache = new Map();
    try {
        for (let _ci = 0; _ci < wells.length; _ci++) {
            const _w = wells[_ci];
            if (_w && typeof calcWellStats === 'function')
                _wellStatsCache.set(_w, calcWellStats(_w));
        }
    } catch (_e) {}

    const searchTerm = (document.getElementById('wells-search-input')?.value || '')
        .toLowerCase()
        .trim();

    let html = '';
    const dktCap = [1000, 1200, 1500, 2000, 2500, 'styczna'];

    // P4-P0: jedno grupowanie per render zamiast 6× map+filter po wells.
    const groups = new Map();
    for (let _gi = 0; _gi < wells.length; _gi++) {
        const _gw = wells[_gi];
        if (!_gw) continue;
        if (
            searchTerm &&
            String(_gw.name || '')
                .toLowerCase()
                .indexOf(searchTerm) < 0
        )
            continue;
        let _arr = groups.get(_gw.dn);
        if (!_arr) {
            _arr = [];
            groups.set(_gw.dn, _arr);
        }
        _arr.push({ w: _gw, i: _gi });
    }

    // Oblicz mapę transportu dla wszystkich studni (proporcjonalnie do wagi)
    let transportMap = new Map();
    if (typeof calculateWellTransportMap === 'function') {
        const result = calculateWellTransportMap(wells);
        transportMap = result.map;
    }

    dktCap.forEach((dnGroup) => {
        if (!groups.has(dnGroup)) return;
        const groupWells = groups.get(dnGroup);
        if (groupWells.length === 0) return;

        const groupTitle = dnGroup === 'styczna' ? 'Studnie Styczne' : `Studnie DN${dnGroup}`;
        html += `<div style="font-size: var(--fs-xs); color:var(--text-muted); text-transform:uppercase; margin: 0.8rem 0 0.35rem 0.3rem; letter-spacing:0.8px; font-weight: var(--fw-extrabold); opacity:0.7;">${groupTitle}</div>`;

        groupWells.forEach(({ w, i }) => {
            const stats =
                _wellStatsCache && _wellStatsCache.has(w)
                    ? _wellStatsCache.get(w)
                    : calcWellStats(w);
            const transportVal = transportMap ? transportMap.get(w) || 0 : 0;
            if (typeof _wellBuildCardHtml === 'function') {
                html += _wellBuildCardHtml(w, i, null, transportVal, stats);
            }
        });
    });

    if (wells.length === 0) {
        html = `<div style="padding:2rem; text-align:center; color:var(--text-muted); font-size: var(--fs-lg);">Brak dodanych studni.<br>Wybierz średnicę z przycisków powyżej.</div>`;
    }

    container.innerHTML = html;
    if (window.lucide) window.lucide.createIcons({ root: container });

    const counter = document.getElementById('wells-counter');
    if (counter) counter.textContent = `(${wells.length})`;

    // perf: wyłącz blur/anim przy dużej liście (klasa w studnie.css) — bez zmiany layoutu
    try {
        container.classList.toggle('wells-list--many', wells.length > 200);
    } catch (_e) {}
    renderDiscountPanel();
    _wellStatsCache = null;
};

// Debounce wyszukiwarki — bez zmiany HTML sidebar.html (oninput zostaje, ale JS przejmuje)
// Minimalne ryzyko: usuwa atrybut oninput i podpina debounced listener 150ms jak w Excelu.
(function _wellPatchSearchDebounce() {
    function patch() {
        const inp = document.getElementById('wells-search-input');
        if (!inp || /** @type {any} */ (inp)._wellSearchPatched) return;
        // usuń inline oninput (legacy renderWellsList per keystroke → freeze)
        inp.removeAttribute('oninput');
        inp.oninput = null;
        inp.addEventListener('input', function () {
            if (_wellSearchDebounce) clearTimeout(_wellSearchDebounce);
            _wellSearchDebounce = setTimeout(function () {
                _wellSearchDebounce = null;
                if (typeof window.renderWellsList === 'function') window.renderWellsList();
            }, 150);
        });
        /** @type {any} */ (inp)._wellSearchPatched = true;
    }
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', patch);
    else patch();
    // re-patch po partial load
    let tries = 0;
    const iv = setInterval(function () {
        patch();
        tries++;
        if (
            tries > 20 ||
            /** @type {any} */ (document.getElementById('wells-search-input'))?.[
                '_wellSearchPatched'
            ]
        )
            clearInterval(iv);
    }, 300);
})();

function _wellFmtH(mm) {
    try {
        if (typeof formatHeightLabel === 'function') return formatHeightLabel(mm);
    } catch (_e) {}
    return fmtInt(mm) + ' mm';
}
function _wellFmtHWithSign(mm) {
    const abs = Math.abs(mm);
    const label = _wellFmtH(abs);
    return (mm > 0 ? '+' : '-') + label;
}

/* ===== PODSUMOWANIE ===== */
window.updateSummary = function updateSummary() {
    const well = getCurrentWell();
    if (!well) {
        const el = (id) => document.getElementById(id);
        const sp = el('sum-price');
        const sw = el('sum-weight');
        const sh = el('sum-height');
        const sai = el('sum-area-int');
        const sae = el('sum-area-ext');
        if (sp) sp.textContent = '0 PLN';
        if (sw) sw.textContent = '0 kg';
        if (sh) sh.textContent = _wellFmtH(0);
        if (sai) sai.textContent = '0,00 m²';
        if (sae) sae.textContent = '0,00 m²';

        const wsHeight = document.getElementById('ws-height');
        const wsReq = document.getElementById('ws-req-height');
        const wsDiff = document.getElementById('ws-diff-height');
        const wsPrice = document.getElementById('ws-price');
        if (wsHeight) wsHeight.textContent = _wellFmtH(0);
        if (wsReq) wsReq.textContent = '—';
        if (wsDiff) {
            wsDiff.textContent = '—';
            wsDiff.style.color = 'var(--text-muted)';
        }
        if (wsPrice) wsPrice.textContent = '0';

        updateHeightIndicator();
        return;
    }
    const stats = calcWellStats(well);

    let wellTransportCost = 0;
    if (typeof calculateOfferTotals === 'function') {
        const totals = calculateOfferTotals();
        if (totals && totals.globalWeight > 0 && totals.totalTransportCost > 0) {
            wellTransportCost = totals.totalTransportCost * (stats.weight / totals.globalWeight);
        }
    }
    const finalPrice = stats.price + wellTransportCost;

    // Dolny pasek
    const priceEl = document.getElementById('sum-price');
    if (stats.error) {
        if (priceEl) {
            priceEl.textContent = 'BŁĄD';
            priceEl.style.color = 'var(--danger)';
        }
    } else {
        if (priceEl) {
            priceEl.textContent = fmt(finalPrice) + ' PLN';
            priceEl.style.color = '';
        }
    }

    const swEl = document.getElementById('sum-weight');
    const shEl = document.getElementById('sum-height');
    const saiEl = document.getElementById('sum-area-int');
    const saeEl = document.getElementById('sum-area-ext');
    if (swEl) swEl.textContent = fmtInt(stats.weight) + ' kg';
    if (shEl) shEl.textContent = _wellFmtH(stats.height);
    if (saiEl) saiEl.textContent = fmt(stats.areaInt) + ' m²';
    if (saeEl) saeEl.textContent = fmt(stats.areaExt) + ' m²';

    let reqMmText = '—';
    let diffMmText = '—';
    let diffColor = 'var(--text-muted)';

    const rzWlazu = parseFloat(well.rzednaWlazu);
    const rzDna = isNaN(parseFloat(well.rzednaDna))
        ? isNaN(rzWlazu)
            ? NaN
            : 0
        : parseFloat(well.rzednaDna);

    if (!isNaN(rzWlazu) && !isNaN(rzDna) && rzWlazu > rzDna) {
        const reqMm = Math.round((rzWlazu - rzDna) * 1000);
        reqMmText = _wellFmtH(reqMm);
        const diff = reqMm - stats.height;

        if (diff > 0) {
            diffMmText = '-' + _wellFmtH(diff);
            diffColor = 'var(--danger-hover)'; // czerwony
        } else if (diff < 0) {
            diffMmText = '+' + _wellFmtH(Math.abs(diff));
            diffColor = 'var(--warn-hover)'; // żółty/pomarańczowy
        } else {
            diffMmText = 'OK';
            diffColor = 'var(--success-hover)'; // zielony
        }
    }

    const wsHeight = document.getElementById('ws-height');
    const wsReq = document.getElementById('ws-req-height');
    const wsDiff = document.getElementById('ws-diff-height');
    const wsPrice = document.getElementById('ws-price');

    if (wsHeight) wsHeight.textContent = _wellFmtH(stats.height);
    if (wsReq) wsReq.textContent = reqMmText;
    if (wsDiff) {
        wsDiff.textContent = diffMmText;
        wsDiff.style.color = diffColor;
    }
    if (wsPrice) {
        if (stats.error) {
            wsPrice.textContent = 'BŁĄD';
            wsPrice.style.color = 'var(--danger)';
        } else {
            wsPrice.textContent = fmt(finalPrice);
            wsPrice.style.color = '';
        }
    }

    // Height indicator
    updateHeightIndicator();

    // Odśwież panel boczny z cenami studni (aby cena była zawsze aktualna)
    // Guard: pomijaj gdy refreshAll już renderuje (zapobiega double render / kaskadzie).
    // Visual-safe: nie zmienia wyniku, tylko koszt — jeden render na tick.
    if (
        typeof renderWellsList === 'function' &&
        !window._renderingWellsList &&
        !(typeof __refreshAllDepth !== 'undefined' && __refreshAllDepth > 0)
    ) {
        window._renderingWellsList = true;
        renderWellsList();
        window._renderingWellsList = false;
    }
};
