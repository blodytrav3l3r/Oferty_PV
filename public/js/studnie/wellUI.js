// @ts-check
/* ===== WELL UI RENDERING (WRAPPER) ===== */
/* UI modules extracted to: uiLockBanners.js, uiParamTiles.js, uiWellParams.js, uiTabSwitcher.js */

/* ===== RENDEROWANIE LISTY STUDNI ===== */
// Debounce + per-tick cache (Faza 0 visual-safe): nie zmienia wyglądu, tylko koszt renderu.
let _wellSearchDebounce = null;
let _wellStatsCache = null;
// Per-sesja cache wag i cen dla updateSummary (klucz well.id): jeden safeCalcWellStats
// per well + jeden calculateOfferTotals per fingerprint zamiast O(N) per wywolanie.
// Uniewaznianie: (1) wrappery open/close modala excela i _excelClearResCache (lazy patch,
// bez dotykania innych plikow), (2) fingerprint oferty przy wejsciu updateSummary
// (_excelClearResCache nie mieszka w tym pliku). Sygnatura updateSummary bez zmian.
const _sumStatsCache = new Map();
let _sumFp = null;
let _sumTotalsCache = null;
let _sumPatchDone = false;
// F1 rev-counter: tanie unieważnienie cache bez JSON.stringify(wells) per updateSummary.
// Bump w wrapperach mutacji w _wellUIPatchInvalidation; fast path w updateSummary
// omija MB stringify gdy rev+len+cheapSig bez zmian. Slow path = dotychczasowa logika.
let _wellSumRev = 0;
let _lastSumRevSeen = -1;
let _lastSumWellsLen = -1;
let _lastSumCheapSig = null;

function _wellUIClearSumCache() {
    _sumStatsCache.clear();
    _sumFp = null;
    _sumTotalsCache = null;
    _wellSumRev++;
}

// ponytail: pelny JSON wells w fingerprint; lzejsza sygnatura gdyby to mierzalnie cielo.
function _wellUISumFp() {
    try {
        const _km = document.getElementById('transport-km')?.value || '';
        const _rate = document.getElementById('transport-rate')?.value || '';
        const _mode = typeof currentTransportMode !== 'undefined' ? currentTransportMode : '';
        const _fz = typeof isFrozenPriceCtx === 'function' ? (isFrozenPriceCtx() ? 'F' : 'L') : '';
        const _om =
            typeof orderEditMode !== 'undefined' && orderEditMode && orderEditMode.order
                ? 'O' + orderEditMode.order.offerId + '|' + orderEditMode.order.transportMode
                : 'no';
        const _disc = typeof wellDiscounts !== 'undefined' ? JSON.stringify(wellDiscounts) : '';
        let _cen = '';
        if (typeof studnieProducts !== 'undefined' && Array.isArray(studnieProducts)) {
            _cen =
                studnieProducts.length +
                '|' +
                studnieProducts
                    .map(
                        (p) =>
                            p.id +
                            ':' +
                            p.price +
                            ':' +
                            p.weight +
                            ':' +
                            p.height +
                            ':' +
                            p.area +
                            ':' +
                            p.areaExt
                    )
                    .join(',');
        }
        const _ws =
            typeof wells !== 'undefined' && Array.isArray(wells)
                ? JSON.stringify(wells, function (k, v) {
                      return k === '__resCache' || k === '__availCache' ? undefined : v;
                  })
                : '[]';
        return (
            _ws +
            '#' +
            _km +
            '#' +
            _rate +
            '#' +
            _mode +
            '#' +
            _fz +
            '#' +
            _om +
            '#' +
            _disc +
            '#' +
            _cen
        );
    } catch (_e) {
        return null;
    }
}

// F1 cheap-sig: lekkie sygnały zmian bez stringify wells — transport live z DOM,
// rabaty (mały obiekt), checksum cen cennika (pętla numeryczna, bez alokacji MB).
// Zwraca null przy błędzie odczytu (caller traktuje jako brak fast path).
const _wellUISumCheapSig = function () {
    try {
        const _km = document.getElementById('transport-km')?.value || '';
        const _rate = document.getElementById('transport-rate')?.value || '';
        const _mode = typeof currentTransportMode !== 'undefined' ? currentTransportMode : '';
        const _fz = typeof isFrozenPriceCtx === 'function' ? (isFrozenPriceCtx() ? 'F' : 'L') : '';
        const _om =
            typeof orderEditMode !== 'undefined' && orderEditMode && orderEditMode.order
                ? 'O' + orderEditMode.order.offerId + '|' + orderEditMode.order.transportMode
                : 'no';
        const _disc = typeof wellDiscounts !== 'undefined' ? JSON.stringify(wellDiscounts) : '';
        let _pc = '0';
        if (typeof studnieProducts !== 'undefined' && Array.isArray(studnieProducts)) {
            let _sum = 0;
            for (let _pi = 0; _pi < studnieProducts.length; _pi++) {
                const _p = studnieProducts[_pi];
                if (!_p) continue;
                _sum +=
                    (Number(_p.price) || 0) + (Number(_p.weight) || 0) + (Number(_p.height) || 0);
            }
            _pc = studnieProducts.length + ':' + Math.round(_sum * 100);
        }
        return _km + '#' + _rate + '#' + _mode + '#' + _fz + '#' + _om + '#' + _disc + '#' + _pc;
    } catch (_e) {
        return null;
    }
};

function _wellUIPatchInvalidation() {
    if (_sumPatchDone) return;
    if (typeof window === 'undefined') return;
    let _all = true;
    const _wrap = function (name, onCall) {
        const _fn = /** @type {any} */ (window)[name];
        if (typeof _fn !== 'function') return false;
        if (/** @type {any} */ (_fn)._wellUISumWrapped) return true;
        const _orig = _fn;
        const _w = function (...args) {
            try {
                onCall(args);
            } catch (_eCb) {}
            return _orig.apply(this, args);
        };
        /** @type {any} */ (_w)._wellUISumWrapped = true;
        /** @type {any} */ (window)[name] = _w;
        return true;
    };
    if (
        !_wrap('openExcelTableModal', function () {
            _wellUIClearSumCache();
        })
    )
        _all = false;
    if (
        !_wrap('closeExcelTableModal', function () {
            _wellUIClearSumCache();
        })
    )
        _all = false;
    if (
        !_wrap('_excelCloseOverlay', function () {
            _wellUIClearSumCache();
        })
    )
        _all = false;
    if (
        !_wrap('_excelClearResCache', function (args) {
            try {
                _wellSumRev++;
                const _one = args && args[0];
                if (_one && _one.id != null) _sumStatsCache.delete(_one.id);
                _sumTotalsCache = null;
            } catch (_eEv) {}
        })
    )
        _all = false;
    // F1: każdy sygnał mutacji z Excela (paste/edit/undo/solver/tab) bumpuje rev.
    if (
        !_wrap('emitExcelMutated', function () {
            _wellSumRev++;
        })
    )
        _all = false;
    // F1: każda akcja panelu głównego idzie przez refreshAll — bump na wejściu,
    // więc updateSummary wołane wewnątrz refreshAll trafia w slow path.
    if (
        !_wrap('refreshAll', function () {
            _wellSumRev++;
        })
    )
        _all = false;
    // F1: rabaty mutują wellDiscounts in-place (bez zmiany wells) — bump na apply.
    if (
        !_wrap('applyDiscount', function () {
            _wellSumRev++;
        })
    )
        _all = false;
    _sumPatchDone = _all;
}
window._wellUIClearSumCache = _wellUIClearSumCache;
// G2: legacy pod dwoma nazwami — window.renderWellsList przejmuje wellVirtual.js
// (jeden delegat, dispatcher z fallbackiem); bezpośrednie wołania legacy używają renderWellsListLegacy.
window.renderWellsListLegacy = window.renderWellsList = function renderWellsList() {
    // F1-net: jak w dispatcherze virtual — render listy unieważnia cache kafelków.
    try {
        if (typeof window !== 'undefined' && typeof window._wellUIClearSumCache === 'function')
            window._wellUIClearSumCache();
    } catch (_eSum) {}
    const container = document.getElementById('wells-list');
    if (!container) return;

    // Przelicz bezwzględnie wszystkie studnie z tła, aby uzyskać aktualne błędy grubości rur / luzów
    refreshAllWellErrors();

    // Per-tick cache stats — jeden calcWellStats per well na render, nie 2×.
    // Corrupt stored → safe fallback 0% per well (jeden zły rabat nie kładzie listy).
    _wellStatsCache = new Map();
    try {
        const _csW = typeof safeCalcWellStats === 'function' ? safeCalcWellStats : calcWellStats;
        for (let _ci = 0; _ci < wells.length; _ci++) {
            const _w = wells[_ci];
            if (_w && typeof _csW === 'function')
                try {
                    _wellStatsCache.set(_w, _csW(_w));
                } catch (_we) {}
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
        html += `<div class="well-group-title">${groupTitle}</div>`;

        groupWells.forEach(({ w, i }) => {
            const _csW2 =
                typeof safeCalcWellStats === 'function' ? safeCalcWellStats : calcWellStats;
            const stats =
                _wellStatsCache && _wellStatsCache.has(w) ? _wellStatsCache.get(w) : _csW2(w);
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
    // F7: skip skanu lucide bez nowych ikon.
    if (window.lucide && container.querySelector('i[data-lucide]'))
        window.lucide.createIcons({ root: container });

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
    try {
        _wellUIPatchInvalidation();
    } catch (_ePatch) {}
    // Per-tick totals + per-sesja stats: fingerprint uniewaznia przy zmianie oferty i cennika.
    // F1 fast path: rev+len+cheapSig bez zmian → pomiń JSON.stringify(wells) (MB churn
    // per klik). Slow path = dotychczasowa logika (100% zgodności wstecz).
    const _wlen = typeof wells !== 'undefined' && Array.isArray(wells) ? wells.length : -1;
    const _cheap = _wellUISumCheapSig();
    let _fp;
    if (
        _sumFp !== null &&
        _cheap !== null &&
        _wellSumRev === _lastSumRevSeen &&
        _wlen === _lastSumWellsLen &&
        _cheap === _lastSumCheapSig
    ) {
        _fp = _sumFp;
    } else {
        _fp = _wellUISumFp();
        _lastSumRevSeen = _wellSumRev;
        _lastSumWellsLen = _wlen;
        _lastSumCheapSig = _cheap;
    }
    if (_fp !== null && _fp !== _sumFp) {
        _sumStatsCache.clear();
        _sumTotalsCache = null;
        _sumFp = _fp;
    }
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
    // Kafelek Ceny nie może zależeć od czystości rabatów — corrupt stored
    // (RangeError z assertDiscountPct) dawałby martwy kafelek ze starą ceną.
    // safeCalcWellStats robi fallback 0% + badge, jak lista i pipeline.
    const _csSum = typeof safeCalcWellStats === 'function' ? safeCalcWellStats : calcWellStats;
    const _ckSum = well && well.id != null ? well.id : well;
    let stats = _fp !== null ? _sumStatsCache.get(_ckSum) : undefined;
    if (!stats) {
        stats = _csSum(well);
        if (_fp !== null) _sumStatsCache.set(_ckSum, stats);
    }

    let wellTransportCost = 0;
    if (typeof calculateOfferTotals === 'function') {
        const _ordered =
            typeof orderEditMode !== 'undefined' && orderEditMode && orderEditMode.order;
        let totals = _fp !== null && !_ordered ? _sumTotalsCache : null;
        if (!totals) {
            totals = calculateOfferTotals();
            if (_fp !== null && !_ordered) _sumTotalsCache = totals;
        }
        if (totals && totals.globalWeight > 0 && totals.totalTransportCost > 0) {
            wellTransportCost = totals.totalTransportCost * (stats.weight / totals.globalWeight);
        }
    }
    // Tryb zamowienia: zamrozony udzial trzyma cene panelu przy zmianach sasiadow.
    if (
        typeof orderEditMode !== 'undefined' &&
        orderEditMode &&
        well &&
        well.frozenTransportCost != null &&
        isFinite(Number(well.frozenTransportCost))
    ) {
        wellTransportCost = Number(well.frozenTransportCost);
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
