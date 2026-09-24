// @ts-check
/* ===== Persystencja zwinięć sekcji (collapseState) — SSoT =====
 * Jeden moduł dla całego S.O.K.: zwinięcie/rozwinięcie sekcji
 * zapamiętywane w localStorage, per-użytkownik (suffix jak theme.js
 * i displayUnits.js), fallback do klucza globalnego bez suffixu.
 * Wartość: jeden JSON { "<sectionId>": true/false } (true = otwarta).
 * Sekcje bez zapisu wracają do defaultOpen — zero zmian przy starcie.
 * Zapis zawsze best-effort (try/catch, tryb prywatny nie wywala UI). */

var SOK_COLLAPSE_KEY = 'sok-collapse';

/** Suffix per-user: currentUser / window.currentUser (wzorzec theme.js). */
function _collapseSuffix() {
    try {
        var u =
            typeof currentUser !== 'undefined'
                ? currentUser
                : typeof window !== 'undefined'
                  ? window.currentUser
                  : null;
        if (u && u.id) return '_' + String(u.id);
    } catch (_e) {}
    try {
        var last =
            typeof localStorage !== 'undefined' ? localStorage.getItem('sok-last-user') : null;
        if (last) return '_' + String(last);
    } catch (_e2) {}
    return '';
}

/** Odczyt całego stanu; uszkodzony JSON/shape → {} (nie blokuj UI). */
function _collapseReadAll() {
    try {
        // Z suffixem: tylko klucz per-user (izolacja, wzorzec displayUnits.js —
        // global nie leakuje stanu jednego usera do drugiego).
        var suffix = _collapseSuffix();
        var raw = suffix
            ? localStorage.getItem(SOK_COLLAPSE_KEY + suffix)
            : localStorage.getItem(SOK_COLLAPSE_KEY);
        if (!raw) return {};
        var parsed = JSON.parse(raw);
        if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return {};
        var clean = {};
        Object.keys(parsed).forEach(function (k) {
            if (typeof parsed[k] === 'boolean') clean[k] = parsed[k];
        });
        return clean;
    } catch (_e) {
        return {};
    }
}

function _collapseWriteAll(state) {
    try {
        var json = JSON.stringify(state);
        localStorage.setItem(SOK_COLLAPSE_KEY, json);
        var suffix = _collapseSuffix();
        if (suffix) localStorage.setItem(SOK_COLLAPSE_KEY + suffix, json);
    } catch (_e) {}
}

/**
 * Stan sekcji: true = otwarta. Brak zapisu → defaultOpen.
 * @param {string} id stabilny identyfikator sekcji
 * @param {boolean} [defaultOpen] domyślny stan (default true)
 */
function collapseGet(id, defaultOpen) {
    if (!id) return defaultOpen !== false;
    var state = _collapseReadAll();
    if (typeof state[id] === 'boolean') return state[id];
    return defaultOpen !== false;
}

/**
 * Zapis stanu sekcji (best-effort).
 * @param {string} id stabilny identyfikator sekcji
 * @param {boolean} isOpen true = otwarta
 */
function collapseSet(id, isOpen) {
    if (!id) return;
    var state = _collapseReadAll();
    state[id] = !!isOpen;
    _collapseWriteAll(state);
}

/** Ikona chevron wg stanu (wzorzec toggleCard z shared/ui.js). */
function _collapseIconHtml(isOpen) {
    return isOpen ? '<i data-lucide="chevron-up"></i>' : '<i data-lucide="chevron-down"></i>';
}

/**
 * Aplikuje zapisany stan na istniejące elementy DOM (wywoływać w renderze).
 * Nic nie robi, gdy content nie istnieje (sekcja jeszcze niewyrenderowana).
 * @param {string} contentId id kontenera treści
 * @param {string} [iconId] id elementu ikony
 * @param {boolean} [defaultOpen] domyślny stan (default true)
 * @param {string} [displayOpen] display gdy otwarta (default 'block')
 * @returns {boolean} efektywny stan (true = otwarta)
 */
function collapseApply(contentId, iconId, defaultOpen, displayOpen) {
    var isOpen = collapseGet(contentId, defaultOpen);
    if (typeof document === 'undefined') return isOpen;
    var content = document.getElementById(contentId);
    if (content) content.style.display = isOpen ? displayOpen || 'block' : 'none';
    var icon = iconId ? document.getElementById(iconId) : null;
    if (icon) {
        icon.innerHTML = _collapseIconHtml(isOpen);
        if (window.lucide) window.lucide.createIcons({ root: icon });
    }
    return isOpen;
}

window.collapseGet = collapseGet;
window.collapseSet = collapseSet;
window.collapseApply = collapseApply;
