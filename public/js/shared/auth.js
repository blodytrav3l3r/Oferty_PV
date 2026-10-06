// @ts-check
/**
 * Shared Auth Module — wspólna logika autoryzacji (wariant A: httpOnly-first).
 *
 * Sesja niesiona wyłącznie przez cookie `authToken` (httpOnly, SameSite=lax),
 * stawiane/czyszczone serwerowo. Frontend NIGDY nie zapisuje ani nie odczytuje
 * surowego tokenu — localStorage.authToken nie istnieje (pozostałości po
 * migracji kasowane przy wylogowaniu). Guardy wejścia sprawdzają sesję przez
 * GET /api/auth/me na cookie, nie przez localStorage.
 *
 * TODO (osobny task, nie ten krok): refresh / sliding expiration — sesja ma
 * dziś sztywne 7 dni od createdAt (src/middleware/auth.ts). Bez zmian tutaj.
 */

/**
 * DEPRECATED (wariant A): token nie jest przechowywany w JS.
 * Zostawione jako shim, żeby niemigrowane call sites nie rzucały
 * ReferenceError — zawsze zwraca null.
 * @returns {null}
 */
function getAuthToken() {
    return null;
}

/**
 * DEPRECATED (wariant A): no-op. Zapisów tokenu do localStorage nie ma;
 * przy okazji kasuje ewentualną pozostałość po migracji.
 * @param {string} _token
 */
function setAuthToken(_token) {
    try {
        localStorage.removeItem('authToken');
    } catch {}
}

/**
 * Nagłówki autoryzacji — wariant A: wyłącznie Content-Type.
 * X-Auth-Token celowo NIE dokładany (cookie niesie sesję; shim serwerowy
 * usunięty — nagłówek ignorowany). Zostawione pod starą nazwą, bo ~100 call
 * sites i test statyczny telemetryAuthHeaders.test.ts wciąż ją wołają.
 * @returns {object}
 */
function authHeaders() {
    return { 'Content-Type': 'application/json' };
}

/**
 * Okno trzymające brudny dokument (P1.3): najpierw lokalny draft, potem iframe.
 * @param {string} [moduleHint] moduł z __sokDescribeDirty (np. 'studnie')
 * @returns {Window|null}
 */
function _logoutDirtyWindow(moduleHint) {
    try {
        if (
            window.draftAutosave &&
            typeof window.draftAutosave.describeDirty === 'function' &&
            window.draftAutosave.describeDirty()
        )
            return window;
    } catch (_e) {}
    try {
        const frames = document.querySelectorAll('iframe.spa-module-iframe');
        for (let i = 0; i < frames.length; i++) {
            try {
                const fr = /** @type {HTMLIFrameElement} */ (frames[i]);
                const w = fr.contentWindow;
                if (!w) continue;
                const mod = String(fr.id || '').replace('spa-iframe-', '');
                if (moduleHint && mod === moduleHint) return w;
            } catch (_e2) {}
        }
        for (let i = 0; i < frames.length; i++) {
            try {
                const w = /** @type {HTMLIFrameElement} */ (frames[i]).contentWindow;
                if (!w) continue;
                if (w.draftAutosave && typeof w.draftAutosave.describeDirty === 'function') {
                    if (w.draftAutosave.describeDirty()) return w;
                } else if (w._excelDirty) {
                    return w;
                } else if (typeof w._isWizardDirty === 'function' && w._isWizardDirty()) {
                    return w;
                }
            } catch (_e3) {}
        }
    } catch (_e4) {}
    return null;
}

/**
 * Wylogowuje użytkownika — kasuje sesje i localStorage, przeładowuje stronę.
 * Gdy są niezapisane zmiany, pyta custom popupem (appConfirm) — kopia SSoT z ui.js.
 */
async function appLogout() {
    try {
        if (window._confirmLock) return;
    } catch {}
    try {
        const isDirty =
            (typeof window._isWizardDirty === 'function' && window._isWizardDirty()) ||
            (typeof window._isDirtyNow === 'function' && window._isDirtyNow());
        if (isDirty) {
            // P1.3: nazwij brudny dokument + policz drafty; 3-btn gdy da się zapisać.
            let target = null;
            let contextMsg = 'Wprowadzone zmiany mogą nie zostać zapisane.';
            try {
                if (typeof window.__sokDescribeDirty === 'function') {
                    const d = window.__sokDescribeDirty();
                    if (d && (d.kind || d.module || d.number || d.docId)) {
                        const label =
                            typeof window.__sokKindLabel === 'function' && d.kind
                                ? window.__sokKindLabel(d.kind)
                                : d.module
                                  ? 'Dokument (' + d.module + ')'
                                  : 'Dokument';
                        const num = d.number || (d.docId && d.docId !== 'new' ? d.docId : '') || '';
                        contextMsg =
                            (num ? label + ' ' + num : label) +
                            ' ma niezapisane zmiany.\nWylogowanie skasuje też lokalne drafty.';
                        target = _logoutDirtyWindow(d.module);
                    }
                }
            } catch (_e0) {}
            const canSave =
                !!target &&
                (typeof target.saveCurrentOrder === 'function' ||
                    typeof target.saveOfferStudnie === 'function' ||
                    typeof target.saveOffer === 'function');
            const confirmFn = window.appConfirm || window.parent?.appConfirm;
            const confirm3Fn = window.appConfirm3 || window.parent?.appConfirm3;
            const useFn = canSave && typeof confirm3Fn === 'function' ? confirm3Fn : confirmFn;
            if (typeof useFn === 'function') {
                try {
                    window._confirmLock = true;
                    if (window.parent) window.parent._confirmLock = true;
                    if (useFn === confirm3Fn) {
                        const choice = await /** @type {any} */ (useFn)(contextMsg, {
                            title: 'Niezapisane zmiany',
                            type: 'warning',
                            saveText: 'Zapisz i wyloguj',
                            okText: 'Wyloguj bez zapisu',
                            cancelText: 'Zostań'
                        });
                        if (choice === 'stay') return;
                        if (choice === 'save') {
                            let saved = false;
                            try {
                                if (typeof window.__sokSaveDirty === 'function')
                                    saved =
                                        (await window.__sokSaveDirty(target || window)) === true;
                                else if (target && target !== window) {
                                    const pw = window.parent || window;
                                    if (typeof pw.__sokSaveDirty === 'function')
                                        saved = (await pw.__sokSaveDirty(target)) === true;
                                }
                            } catch (_eS) {
                                saved = false;
                            }
                            if (!saved) return;
                        }
                    } else {
                        const ok = await /** @type {any} */ (useFn)(contextMsg, {
                            title: 'Niezapisane zmiany',
                            type: 'warning',
                            okText: 'Opuść bez zapisu',
                            cancelText: 'Zostań'
                        });
                        if (!ok) return;
                    }
                } finally {
                    try {
                        window._confirmLock = false;
                        if (window.parent) window.parent._confirmLock = false;
                    } catch {}
                }
            }
        }
    } catch {}
    try {
        window._bypassBeforeUnload = true;
        window._navForceOnce = true;
        if (window.parent) {
            window.parent._bypassBeforeUnload = true;
            window.parent._navForceOnce = true;
        }
    } catch {}
    try {
        // Jedyny logout: sesję i cookie czyści serwer (clearCookie).
        // credentials:include — musowe, inaczej cookie nie dotrze i serwer
        // nie będzie wiedział, którą sesję skasować.
        await fetch('/api/auth/logout', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include'
        });
    } catch (e) {
        logger.error('auth', 'Logout request failed:', e);
    }
    // Migracyjne sprzątanie: skasuj ewentualny token sprzed wariantu A.
    // Linii document.cookie NIE MA celowo — cookie httpOnly i tak niewidoczne dla JS.
    try {
        localStorage.removeItem('authToken');
    } catch {}
    try {
        sessionStorage.removeItem('user');
    } catch {}
    // P1.1b: wylogowanie kasuje WSZYSTKIE drafty użytkownika (namespace per-user, RODO).
    try {
        if (window.draftStore && window.draftAutosave) {
            const _draftUser = window.draftAutosave.currentUserId();
            if (_draftUser) window.draftStore.removeUserDrafts(window.localStorage, _draftUser);
        }
    } catch {}
    window.location.href = 'index.html';
}

/**
 * Ostatni znany stan sieci (A3: toast tylko na przejściu online→offline,
 * kolejny dopiero po powrocie online — bez spamu przy każdym evencie).
 */
var _lastOnlineState = null;

function _notifyOfflineOnce() {
    if (_lastOnlineState === false) return;
    _lastOnlineState = false;
    try {
        if (typeof showToast === 'function')
            showToast('Pracujesz offline — edycja zapisywana lokalnie w drafcie.', 'warning');
    } catch (_e) {}
}

function _notifyOnlineSilent() {
    _lastOnlineState = true;
}

/**
 * Aktualizuje status kropki połączenia w headerze.
 * Sprawdza czy serwer jest osiągalny przez /health.
 */
function updateConnectionDot() {
    const dot = document.getElementById('connection-dot');
    if (!dot) return;
    dot.className = 'connection-dot is-checking';
    dot.title = 'Sprawdzanie połączenia...';

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000);

    fetch('/health', { signal: controller.signal, credentials: 'include' })
        .then(function (res) {
            clearTimeout(timeoutId);
            if (res.ok || res.status === 401) {
                dot.className = 'connection-dot is-online';
                dot.title = 'Połączenie z serwerem OK';
                _notifyOnlineSilent();
            } else {
                dot.className = 'connection-dot is-offline';
                dot.title = 'Serwer zwrócił błąd';
            }
        })
        .catch(function () {
            clearTimeout(timeoutId);
            dot.className = 'connection-dot is-offline';
            dot.title = 'Brak połączenia z serwerem';
            _notifyOfflineOnce();
        });
}

if (typeof window !== 'undefined') {
    // X11: guard pojedynczego timera + cleanup (częstotliwość 30 s bez zmian).
    // Ponowna ewaluacja skryptu (SPA/iframe) nie dokłada kolejnego interwału,
    // a pagehide/beforeunload sprząta timer przy odmontowaniu/nawigacji.
    var _startConnectionPoll = function () {
        updateConnectionDot();
        if (!window._connectionDotInterval) {
            window._connectionDotInterval = setInterval(updateConnectionDot, 30000);
        }
    };
    var _stopConnectionPoll = function () {
        if (window._connectionDotInterval) {
            clearInterval(window._connectionDotInterval);
            window._connectionDotInterval = null;
        }
    };
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', _startConnectionPoll, { once: true });
    } else {
        _startConnectionPoll();
    }
    // Guard: sandboxy testowe (vm) mają window bez addEventListener.
    if (typeof window.addEventListener === 'function') {
        window.addEventListener('pagehide', _stopConnectionPoll);
        window.addEventListener('beforeunload', _stopConnectionPoll);
    }
    window._stopConnectionPoll = _stopConnectionPoll;
    window.addEventListener('online', function () {
        _notifyOnlineSilent();
        updateConnectionDot();
    });
    window.addEventListener('offline', function () {
        const dot = document.getElementById('connection-dot');
        if (dot) {
            dot.className = 'connection-dot is-offline';
            dot.title = 'Brak połączenia sieciowego';
        }
        _notifyOfflineOnce();
    });
}

/* ===== CSP-B: naglowek wylogowania bez onclick (klasa .header-logout) ===== */
(function _bindHeaderLogout() {
    // Guard: sandboxy testowe (vm) maja okrojony document lub brak document.
    if (typeof document === 'undefined' || typeof document.querySelectorAll !== 'function') return;
    function bind() {
        document.querySelectorAll('.header-logout').forEach((btn) => {
            // Elementy z data-csp naleza do dyspozytora CSP-B2 (brak podwojnego logout).
            if (btn.hasAttribute && btn.hasAttribute('data-csp')) return;
            btn.addEventListener('click', () => appLogout());
        });
    }
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', bind, { once: true });
    } else {
        bind();
    }
})();

/* ===== Rejestracja globali ===== */
window.getAuthToken = getAuthToken;
window.setAuthToken = setAuthToken;
window.authHeaders = authHeaders;
window.appLogout = appLogout;
