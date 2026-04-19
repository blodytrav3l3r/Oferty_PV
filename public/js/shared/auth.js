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
        console.error('Logout request failed:', e);
    }
    localStorage.removeItem('authToken');
    document.cookie = 'authToken=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;';
    window.location.href = '/';
}
