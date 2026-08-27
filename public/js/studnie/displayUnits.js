// @ts-check
/* ===== Display Units — mm/cm/m + precyzja dla podglądu studni =====
   Scope: well-diagram-panel + well-list H + linie wymiarowe SVG.
   Storage w mm, konwersja na widok. Persystencja per-user via localStorage (auto-zapis).
   Wzorzec jak excelState.js. Popup obok ceny.
*/

const DISPLAY_UNIT_KEY = 'sok_studnie_display_unit';
const DISPLAY_UNIT_LEGACY_KEY = 'witros_studnie_display_unit';
const DISPLAY_PREFS_KEY = 'sok_studnie_display_prefs';
const DISPLAY_PREFS_LEGACY_KEY = 'witros_studnie_display_prefs';
const VALID_UNITS = ['mm', 'cm', 'm'];
const DEFAULT_DECIMALS = { mm: 0, cm: 1, m: 3 };
// mm zawsze bez miejsc po przecinku — opcje precyzji tylko dla cm/m
const DECIMALS_OPTIONS = { mm: [0], cm: [0, 1, 2, 3], m: [0, 1, 2, 3] };
let _unitPopupEl = null;

function _displayUnitsGetUserSuffix() {
    try {
        const u = typeof currentUser !== 'undefined' ? currentUser : null;
        if (u && u.id) return '_' + String(u.id);
        const alt =
            typeof window !== 'undefined' && window.currentUser && window.currentUser.id
                ? '_' + String(window.currentUser.id)
                : '';
        return alt;
    } catch (_e) {
        return '';
    }
}

function _displayUnitsMigrateLegacy() {
    try {
        if (
            localStorage.getItem(DISPLAY_UNIT_LEGACY_KEY) !== null &&
            localStorage.getItem(DISPLAY_UNIT_KEY) === null
        ) {
            localStorage.setItem(DISPLAY_UNIT_KEY, localStorage.getItem(DISPLAY_UNIT_LEGACY_KEY));
        }
        if (localStorage.getItem(DISPLAY_UNIT_LEGACY_KEY) !== null)
            localStorage.removeItem(DISPLAY_UNIT_LEGACY_KEY);
        if (
            localStorage.getItem(DISPLAY_PREFS_LEGACY_KEY) !== null &&
            localStorage.getItem(DISPLAY_PREFS_KEY) === null
        ) {
            localStorage.setItem(DISPLAY_PREFS_KEY, localStorage.getItem(DISPLAY_PREFS_LEGACY_KEY));
        }
        if (localStorage.getItem(DISPLAY_PREFS_LEGACY_KEY) !== null)
            localStorage.removeItem(DISPLAY_PREFS_LEGACY_KEY);
    } catch (_e) {}
}

function _cloneDecimals(d) {
    return { mm: d.mm, cm: d.cm, m: d.m };
}

function _normalizeDecimals(input) {
    const out = { mm: DEFAULT_DECIMALS.mm, cm: DEFAULT_DECIMALS.cm, m: DEFAULT_DECIMALS.m };
    if (!input || typeof input !== 'object') return out;
    ['cm', 'm'].forEach(function (k) {
        const v = input[k];
        const n = typeof v === 'number' ? v : parseInt(v, 10);
        if (Number.isFinite(n) && n >= 0 && n <= 3) out[k] = Math.round(n);
    });
    // mm zawsze 0 — ignoruj zapisane wartości z poprzednich wersji
    out.mm = 0;
    return out;
}

function getDisplayPrefs() {
    try {
        _displayUnitsMigrateLegacy();
        const suffix = _displayUnitsGetUserSuffix();
        // per-user ma priorytet; izolacja - nie leakuj global do innego usera
        if (suffix) {
            const rawUser = localStorage.getItem(DISPLAY_PREFS_KEY + suffix);
            if (rawUser) {
                const parsed = JSON.parse(rawUser);
                if (
                    parsed &&
                    typeof parsed === 'object' &&
                    VALID_UNITS.indexOf(parsed.unit) !== -1
                ) {
                    return { unit: parsed.unit, decimals: _normalizeDecimals(parsed.decimals) };
                }
            }
            try {
                const perUserLegacy = localStorage.getItem(DISPLAY_UNIT_KEY + suffix);
                if (perUserLegacy && VALID_UNITS.indexOf(perUserLegacy) !== -1)
                    return { unit: perUserLegacy, decimals: _cloneDecimals(DEFAULT_DECIMALS) };
            } catch (_e2) {}
            return { unit: 'mm', decimals: _cloneDecimals(DEFAULT_DECIMALS) };
        }
        const raw = localStorage.getItem(DISPLAY_PREFS_KEY);
        if (raw) {
            const parsed = JSON.parse(raw);
            if (parsed && typeof parsed === 'object' && VALID_UNITS.indexOf(parsed.unit) !== -1) {
                return { unit: parsed.unit, decimals: _normalizeDecimals(parsed.decimals) };
            }
        }
        const unitFallback = getDisplayUnitLegacy();
        if (unitFallback) return { unit: unitFallback, decimals: _cloneDecimals(DEFAULT_DECIMALS) };
    } catch (_e) {}
    return { unit: 'mm', decimals: _cloneDecimals(DEFAULT_DECIMALS) };
}

function getDisplayUnitLegacy() {
    try {
        const suffix = _displayUnitsGetUserSuffix();
        if (suffix) {
            const perUser = localStorage.getItem(DISPLAY_UNIT_KEY + suffix);
            if (perUser && VALID_UNITS.indexOf(perUser) !== -1) return perUser;
        }
        const v = localStorage.getItem(DISPLAY_UNIT_KEY);
        if (v && VALID_UNITS.indexOf(v) !== -1) return v;
    } catch (_e) {}
    return null;
}

function getDisplayUnit() {
    return getDisplayPrefs().unit;
}

function getDisplayDecimals(unit) {
    const prefs = getDisplayPrefs();
    const u = unit || prefs.unit;
    const v = prefs.decimals[u];
    return typeof v === 'number' ? v : DEFAULT_DECIMALS[u];
}

function _saveDisplayPrefs(prefs) {
    const clean = { unit: prefs.unit, decimals: _normalizeDecimals(prefs.decimals) };
    try {
        const json = JSON.stringify(clean);
        localStorage.setItem(DISPLAY_PREFS_KEY, json);
        const suffix = _displayUnitsGetUserSuffix();
        if (suffix) localStorage.setItem(DISPLAY_PREFS_KEY + suffix, json);
        // sync legacy unit key dla wstecznej kompatybilności
        localStorage.setItem(DISPLAY_UNIT_KEY, clean.unit);
        if (suffix) localStorage.setItem(DISPLAY_UNIT_KEY + suffix, clean.unit);
    } catch (_e) {}
}

function setDisplayUnit(unit) {
    if (VALID_UNITS.indexOf(unit) === -1) return;
    const prefs = getDisplayPrefs();
    prefs.unit = unit;
    _saveDisplayPrefs(prefs);
    _displayUnitsApplyActiveState();
    _updateUnitBtnLabel();
    _displayUnitsRerender();
    _refreshUnitPopup();
}

function setDisplayDecimals(unit, decimals) {
    if (VALID_UNITS.indexOf(unit) === -1) return;
    // mm ma stałe 0 miejsc — nie pozwalaj na zmianę
    if (unit === 'mm') return;
    const n = Math.max(0, Math.min(3, Math.round(Number(decimals))));
    if (!Number.isFinite(n)) return;
    const prefs = getDisplayPrefs();
    prefs.decimals[unit] = n;
    _saveDisplayPrefs(prefs);
    _displayUnitsRerender();
    _refreshUnitPopup();
}

function _displayUnitsApplyActiveState() {
    try {
        const prefs = getDisplayPrefs();
        const unit = prefs.unit;
        const dec = prefs.decimals[unit];
        document
            .querySelectorAll('.unit-toggle [data-unit], .unit-popup [data-unit]')
            .forEach(function (el) {
                el.classList.toggle('active', el.getAttribute('data-unit') === unit);
            });
        document.querySelectorAll('.unit-popup [data-dec]').forEach(function (el) {
            const d = parseInt(el.getAttribute('data-dec'), 10);
            el.classList.toggle('active', d === dec && el.getAttribute('data-unit-dec') === unit);
        });
        const preview = document.getElementById('unit-popup-preview');
        if (preview)
            preview.textContent =
                '1500 mm = ' +
                formatHeightValue(1500, 'mm') +
                ' mm / ' +
                formatHeightValue(1500, 'cm') +
                ' cm / ' +
                formatHeightValue(1500, 'm') +
                ' m';
        _updateUnitBtnLabel();
    } catch (_e) {}
}

function _updateUnitBtnLabel() {
    try {
        const btn = document.getElementById('unit-settings-btn');
        if (!btn) return;
        const prefs = getDisplayPrefs();
        // pokaz aktualną jednostkę + precyzję np. "m · 3"
        btn.setAttribute('data-unit', prefs.unit);
        const label = btn.querySelector('.unit-btn-label');
        if (label) label.textContent = prefs.unit;
        btn.title = 'Jednostki: ' + prefs.unit + ' (' + prefs.decimals[prefs.unit] + ' miejsc)';
    } catch (_e) {}
}

function _displayUnitsRerender() {
    try {
        if (typeof updateSummary === 'function') updateSummary();
    } catch (_e) {}
    try {
        if (typeof renderWellDiagram === 'function') renderWellDiagram();
    } catch (_e) {}
    try {
        if (typeof renderWellsList === 'function' && !window._renderingWellsList) renderWellsList();
    } catch (_e) {}
    try {
        if (
            typeof _excelRenderTable === 'function' &&
            document.getElementById('excel-table-overlay') &&
            typeof _excelActiveTab !== 'undefined'
        )
            _excelRenderTable(_excelActiveTab);
        else if (typeof _excelRefreshAutoCells === 'function') {
            const cont = document.getElementById('excel-table-container');
            if (cont)
                cont.querySelectorAll('tr[data-widx]').forEach(function (tr) {
                    const wIdx = parseInt(tr.getAttribute('data-widx'), 10);
                    if (!isNaN(wIdx)) _excelRefreshAutoCells(wIdx, tr);
                });
        }
    } catch (_e) {}
}

function formatHeightValue(mmVal, unit) {
    const mm = Number(mmVal) || 0;
    const u = unit || getDisplayUnit();
    let dec = getDisplayDecimals(u);
    // mm zawsze bez miejsc po przecinku
    if (u === 'mm') dec = 0;
    if (u === 'm') {
        const v = mm / 1000;
        return v.toFixed(dec);
    }
    if (u === 'cm') {
        const v = mm / 10;
        return v.toFixed(dec);
    }
    // mm — zawsze 0 miejsc
    const v = mm;
    return typeof fmtInt === 'function' ? fmtInt(Math.round(v)) : String(Math.round(v));
}

function formatHeightLabel(mmVal, unit) {
    const u = unit || getDisplayUnit();
    return formatHeightValue(mmVal, u) + ' ' + u;
}

function _refreshUnitPopup() {
    if (!_unitPopupEl || !_unitPopupEl.isConnected) return;
    // Aktualizuj bez pełnego re-renderu innerHTML (niszczy kliknięty target przed outside-check → zamknięcie)
    const prefs = getDisplayPrefs();
    const decLabel = _unitPopupEl.querySelector('[data-dec-label]');
    if (decLabel)
        decLabel.textContent =
            'Miejsca po przecinku (' +
            prefs.unit +
            ')' +
            (prefs.unit === 'mm' ? ' — zawsze 0' : '');
    const opts = DECIMALS_OPTIONS[prefs.unit] || DECIMALS_OPTIONS.m;
    _unitPopupEl.querySelectorAll('[data-dec]').forEach(function (el) {
        const d = parseInt(el.getAttribute('data-dec'), 10);
        const allowed = opts.indexOf(d) !== -1;
        el.setAttribute('data-unit-dec', prefs.unit);
        el.disabled = !allowed;
        el.setAttribute('aria-disabled', allowed ? 'false' : 'true');
        if (allowed) {
            el.removeAttribute('title');
            el.setAttribute('onclick', "setDisplayDecimals('" + prefs.unit + "'," + d + ')');
        } else {
            el.setAttribute('title', 'Niedostępne dla ' + prefs.unit);
            el.removeAttribute('onclick');
        }
    });
    _displayUnitsApplyActiveState();
}

function _renderUnitPopupContent(container, prefs) {
    const esc =
        typeof escapeHtml === 'function'
            ? escapeHtml
            : function (s) {
                  return String(s);
              };
    // preview uses current formatting per unit decimals
    const previewText =
        '1500 mm = ' +
        esc(formatHeightValue(1500, 'mm')) +
        ' mm / ' +
        esc(formatHeightValue(1500, 'cm')) +
        ' cm / ' +
        esc(formatHeightValue(1500, 'm')) +
        ' m';
    container.innerHTML =
        '<div class="unit-popup-header"><span><i data-lucide="ruler" class="icon-xs"></i> Jednostki wysokości</span><button type="button" class="unit-popup-close" onclick="closeUnitSettingsPopup()" aria-label="Zamknij">✕</button></div>' +
        '<div class="unit-popup-section"><div class="unit-popup-label">Jednostka</div><div class="unit-popup-row" role="group" aria-label="Jednostka">' +
        VALID_UNITS.map(function (u) {
            return (
                '<button type="button" class="unit-popup-btn' +
                (prefs.unit === u ? ' active' : '') +
                '" data-unit="' +
                u +
                '" onclick="setDisplayUnit(\'' +
                u +
                '\')">' +
                u +
                '</button>'
            );
        }).join('') +
        '</div></div>' +
        '<div class="unit-popup-section"><div class="unit-popup-label" data-dec-label>Miejsca po przecinku (' +
        esc(prefs.unit) +
        ')' +
        (prefs.unit === 'mm' ? ' — zawsze 0' : '') +
        '</div><div class="unit-popup-row" role="group" aria-label="Precyzja">' +
        [0, 1, 2, 3]
            .map(function (d) {
                const allowed =
                    (DECIMALS_OPTIONS[prefs.unit] || DECIMALS_OPTIONS.m).indexOf(d) !== -1;
                return (
                    '<button type="button" class="unit-popup-btn unit-popup-btn--dec' +
                    (prefs.decimals[prefs.unit] === d ? ' active' : '') +
                    '" data-dec="' +
                    d +
                    '" data-unit-dec="' +
                    esc(prefs.unit) +
                    '"' +
                    (allowed
                        ? ' onclick="setDisplayDecimals(\'' + esc(prefs.unit) + "'," + d + ')\'"'
                        : ' disabled title="Niedostępne dla ' +
                          esc(prefs.unit) +
                          '" aria-disabled="true"') +
                    '>' +
                    d +
                    '</button>'
                );
            })
            .join('') +
        '</div></div>' +
        '<div class="unit-popup-preview" id="unit-popup-preview">' +
        previewText +
        '</div>';
    if (window.lucide) window.lucide.createIcons({ root: container });
}

function openUnitSettingsPopup(anchorEl) {
    const anchor = anchorEl || document.getElementById('unit-settings-btn');
    if (!anchor) return;
    if (_unitPopupEl && _unitPopupEl.isConnected) {
        closeUnitSettingsPopup();
        return;
    }
    const prefs = getDisplayPrefs();
    const popup = document.createElement('div');
    popup.id = 'unit-popup';
    popup.className = 'unit-popup';
    popup.setAttribute('role', 'dialog');
    popup.setAttribute('aria-label', 'Ustawienia jednostek');
    _renderUnitPopupContent(popup, prefs);
    document.body.appendChild(popup);
    _unitPopupEl = popup;

    // pozycjonowanie obok przycisku (jak excelColumnContextMenu)
    const rect = anchor.getBoundingClientRect();
    const popW = 260;
    let left = rect.left;
    let top = rect.bottom + 6;
    if (left + popW > window.innerWidth - 8) left = window.innerWidth - popW - 8;
    if (top + 200 > window.innerHeight - 8) top = rect.top - 200 - 6;
    popup.style.left = left + 'px';
    popup.style.top = top + 'px';

    _displayUnitsApplyActiveState();
    setTimeout(function () {
        document.addEventListener('click', _unitPopupOutsideClick);
        document.addEventListener('keydown', _unitPopupKeydown);
    }, 0);
}

function closeUnitSettingsPopup() {
    if (_unitPopupEl && _unitPopupEl.parentNode) _unitPopupEl.parentNode.removeChild(_unitPopupEl);
    _unitPopupEl = null;
    document.removeEventListener('click', _unitPopupOutsideClick);
    document.removeEventListener('keydown', _unitPopupKeydown);
}

function _unitPopupOutsideClick(e) {
    if (!_unitPopupEl) return;
    const t = e.target;
    // Klik na przyciskach popupa ma data-unit/data-dec – traktuj jako inside nawet jeśli innerHTML został podmieniony
    if (t && t.closest) {
        if (t.closest('#unit-popup') || t.closest('#unit-settings-btn')) return;
        // fallback dla odłączonego targetu po re-renderze
        if (
            t.getAttribute &&
            (t.getAttribute('data-unit') !== null || t.getAttribute('data-dec') !== null)
        )
            return;
    }
    const btn = document.getElementById('unit-settings-btn');
    if (_unitPopupEl.contains(t) || (btn && btn.contains(t))) return;
    closeUnitSettingsPopup();
}

function _unitPopupKeydown(e) {
    if (e.key === 'Escape') closeUnitSettingsPopup();
}

window.getDisplayUnit = getDisplayUnit;
window.getDisplayDecimals = getDisplayDecimals;
window.getDisplayPrefs = getDisplayPrefs;
window.setDisplayUnit = setDisplayUnit;
window.setDisplayDecimals = setDisplayDecimals;
window.formatHeightValue = formatHeightValue;
window.formatHeightLabel = formatHeightLabel;
window.openUnitSettingsPopup = openUnitSettingsPopup;
window.closeUnitSettingsPopup = closeUnitSettingsPopup;

// init
if (typeof document !== 'undefined') {
    function _initUnitBtn() {
        _displayUnitsApplyActiveState();
        _updateUnitBtnLabel();
    }
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', function () {
            _initUnitBtn();
            setTimeout(_initUnitBtn, 600);
        });
    } else {
        setTimeout(_initUnitBtn, 0);
        setTimeout(_initUnitBtn, 600);
    }
}
window.refreshDisplayUnitToggle = function () {
    _displayUnitsApplyActiveState();
    _updateUnitBtnLabel();
};
