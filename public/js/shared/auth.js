// @ts-check
/**
 * Shared Auth Module — wspólna logika autoryzacji.
 *
 * Token sesji przechowywany jest w httpOnly cookie (niedostępny dla JS).
 * Wszystkie fetch() wysyłają cookie automatycznie (same-origin + sameSite: 'lax').
 */

/**
 * @deprecated Token nie jest już przechowywany w localStorage.
 * Autoryzacja odbywa się przez httpOnly cookie.
 * @returns {null}
 */
function getAuthToken() {
    return null;
}

/**
 * @deprecated Nie używać — token jest ustawiany przez serwer jako httpOnly cookie.
 */
function setAuthToken(_token) {
    // Token jest zarządzany przez serwer (httpOnly cookie)
}

/**
 * Zwraca nagłówki do fetch().
 * Token autoryzacji jest wysyłany automatycznie przez httpOnly cookie.
 * @returns {object}
 */
function getCsrfToken() {
    const match = document.cookie.match(/(?:^|;\s*)csrf-token=([^;]+)/);
    return match ? match[1] : '';
}

function authHeaders() {
    return { 'Content-Type': 'application/json', 'x-csrf-token': getCsrfToken() };
}

/**
 * Wylogowuje użytkownika — kasuje sesję na serwerze, przeładowuje stronę.
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

window.getCsrfToken = getCsrfToken;
window.authHeaders = authHeaders;
