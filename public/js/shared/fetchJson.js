// @ts-check
/**
 * fetchJson.js — ES module (TASK-047, etap 4).
 * Wspólny fetch JSON z normalizacją błędów.
 * Eksport ESM + mostek `window.*` dla niezmigrowanych plików legacy.
 */

/**
 * Wspólny fetch JSON z normalizacją błędów (P1).
 * Zwraca:
 * - `{error:'unauthorized'}` przy 401,
 * - `{error:'forbidden'}` przy 403,
 * - `{error:'unavailable'}` przy 503,
 * - `{error:'server'}` przy innym statusie nie-OK,
 * - `null` przy braku `fetch` lub błędzie sieci,
 * - parsowany JSON w pozostałych przypadkach.
 */
export async function fetchJson(url, options) {
    if (!window.fetch) return null;
    try {
        // Wariant A: sesja wyłącznie przez cookie httpOnly. credentials domyślnie
        // 'same-origin' (wystarcza dla same-origin API); jawne 'include' od
        // callera ma pierwszeństwo; downgrade do 'omit' zablokowany.
        // TODO (osobny task): refresh / sliding expiration — bez zmian tutaj.
        const requested = options && options.credentials;
        const opts = Object.assign({}, options || {}, {
            credentials: requested === 'include' ? 'include' : 'same-origin'
        });
        // authHeaders() to dziś tokenless shim (tylko Content-Type) — merge
        // zostaje dla kompatybilności niemigrowanych call sites; ewentualny
        // X-Auth-Token podany ręcznie przez callera jest celowo odcinany.
        const defaultHeaders = typeof authHeaders === 'function' ? authHeaders() : {};
        opts.headers = Object.assign(
            {},
            defaultHeaders,
            options && options.headers ? options.headers : {}
        );
        if (opts.headers && opts.headers['X-Auth-Token']) {
            delete opts.headers['X-Auth-Token'];
        }
        const resp = await fetch(url, opts);
        if (resp.status === 401) return { error: 'unauthorized' };
        if (resp.status === 403) return { error: 'forbidden' };
        if (resp.status === 503) return { error: 'unavailable' };
        if (!resp.ok) return { error: 'server' };
        return resp.json();
    } catch (_e) {
        return null;
    }
}

/* Bridge dla legacy — usunąć po zmigrowaniu wszystkich callerów */
window.fetchJson = fetchJson;
