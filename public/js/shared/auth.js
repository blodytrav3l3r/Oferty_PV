/**
 * Shared Auth Module — wspólna logika autoryzacji.
 * Eliminuje duplikat getAuthToken/authHeaders/appLogout z app.js i app_studnie.js.
 * 
 * WAŻNE: Unifikacja — app.js używał localStorage, app_studnie.js cookies.
 * Ten moduł sprawdza OBA źródła (cookies priorytet, potem localStorage).
 */

/**
 * Pobiera token autoryzacji z cookie lub localStorage.
 * @returns {string|null}
 */
function getAuthToken() {
    // Priorytet: cookie (server-set, httpOnly=false)
    const match = document.cookie.match(/(?:^|;\s*)authToken=([^;]*)/);
    if (match && match[1]) return match[1];
    // Fallback: localStorage (starsza ścieżka z app.js)
    return localStorage.getItem('authToken') || null;
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
 * Wylogowuje użytkownika — kasuje sesje i cookie, przeładowuje stronę.
 */
async function appLogout() {
    try {
        await fetch('/api/auth/logout', { method: 'POST', headers: authHeaders() });
    } catch (e) { /* ignore network errors on logout */ }
    localStorage.removeItem('authToken');
    document.cookie = 'authToken=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;';
    window.location.href = '/';
}
