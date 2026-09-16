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
 * istnieje tylko wstecznie). Zostawione pod starą nazwą, bo ~100 call sites
 * i test statyczny telemetryAuthHeaders.test.ts wciąż ją wołają.
 * @returns {object}
 */
function authHeaders() {
    return { 'Content-Type': 'application/json' };
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
            const confirmFn = window.appConfirm || window.parent?.appConfirm;
            if (typeof confirmFn === 'function') {
                try {
                    window._confirmLock = true;
                    if (window.parent) window.parent._confirmLock = true;
                    const ok = await /** @type {any} */ (confirmFn)(
                        'Wprowadzone zmiany mogą nie zostać zapisane.',
                        {
                            title: 'Niezapisane zmiany',
                            type: 'warning',
                            okText: 'Opuść bez zapisu',
                            cancelText: 'Zostań'
                        }
                    );
                    if (!ok) return;
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
            } else {
                dot.className = 'connection-dot is-offline';
                dot.title = 'Serwer zwrócił błąd';
            }
        })
        .catch(function () {
            clearTimeout(timeoutId);
            dot.className = 'connection-dot is-offline';
            dot.title = 'Brak połączenia z serwerem';
        });
}

if (typeof window !== 'undefined') {
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', function () {
            updateConnectionDot();
            setInterval(updateConnectionDot, 30000);
        });
    } else {
        updateConnectionDot();
        setInterval(updateConnectionDot, 30000);
    }
    window.addEventListener('online', updateConnectionDot);
    window.addEventListener('offline', function () {
        const dot = document.getElementById('connection-dot');
        if (dot) {
            dot.className = 'connection-dot is-offline';
            dot.title = 'Brak połączenia sieciowego';
        }
    });
}

/* ===== Rejestracja globali ===== */
window.getAuthToken = getAuthToken;
window.setAuthToken = setAuthToken;
window.authHeaders = authHeaders;
window.appLogout = appLogout;
