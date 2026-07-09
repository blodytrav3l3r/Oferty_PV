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
 */
async function appLogout() {
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
        var dot = document.getElementById('connection-dot');
        if (dot) {
            dot.className = 'connection-dot is-offline';
            dot.title = 'Brak połączenia sieciowego';
        }
    });
}
