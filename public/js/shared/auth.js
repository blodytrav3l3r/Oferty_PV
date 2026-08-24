// @ts-check
/**
 * Shared Auth Module — wspólna logika autoryzacji.
 *
 * WAŻNE: Token przechowywany jest w localStorage (JavaScript-accessible).
 * Cookie httpOnly jest ustawiane przez serwer ale NIE jest czytalne przez JS.
 * Sesja po stronie serwera weryfikowana jest przez cookie + X-Auth-Token header.
 */

/**
 * Pobiera token autoryzacji z localStorage.
 * @returns {string|null}
 */
function getAuthToken() {
    return localStorage.getItem('authToken') || null;
}

/**
 * Ustawia token autoryzacji w localStorage.
 * @param {string} token
 */
function setAuthToken(token) {
    localStorage.setItem('authToken', token);
}

/**
 * Zwraca nagłówki autoryzacji do fetch().
 * @returns {object}
 */
function authHeaders() {
    const token = getAuthToken();
    const headers = { 'Content-Type': 'application/json' };
    if (token) headers['X-Auth-Token'] = token;
    return headers;
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
                    const ok = await confirmFn('Wprowadzone zmiany mogą nie zostać zapisane.', {
                        title: 'Niezapisane zmiany',
                        type: 'warning',
                        okText: 'Opuść bez zapisu',
                        cancelText: 'Zostań'
                    });
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
        await fetch('/api/auth/logout', {
            method: 'POST',
            headers: authHeaders(),
            credentials: 'include'
        });
    } catch (e) {
        logger.error('auth', 'Logout request failed:', e);
    }
    localStorage.removeItem('authToken');
    document.cookie = 'authToken=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;';
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
