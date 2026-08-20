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
        const opts = Object.assign({ credentials: 'same-origin' }, options || {});
        const defaultHeaders = typeof authHeaders === 'function' ? authHeaders() : {};
        opts.headers = Object.assign(
            {},
            defaultHeaders,
            options && options.headers ? options.headers : {}
        );
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
