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

/**
 * fetchWithRetry429 — wspólny fetch z retry dla kolejek/limiterów (Paczka A).
 * UŻYWAJ zamiast ręcznych pętli retry (orderBulk, offerPrintManager).
 *
 * Kontrakt:
 * - maks. 3 próby (1 + 2 retry), exponential backoff 1s → 2s, cap 10s;
 * - retry TYLKO dla HTTP 429 (limiter/kolejka odrzuca PRZED efektem) oraz
 *   błędu sieciowego/abortu PRZED odpowiedzią — i to tylko gdy bezpiecznie:
 *   metoda GET/HEAD albo nagłówek Idempotency-Key albo jawne retryNetwork;
 * - Retry-After (s) z odpowiedzi wygrywa z backoffem (max z obu, w cap);
 * - 4xx/5xx (w tym 503/504) NIGDY auto-retry — caller decyduje;
 * - options (headers/body) przekazywane BEZ ZMIAN na każdej próbie —
 *   stabilność Idempotency-Key zapewnia caller (A2);
 * - zwraca { res, attempts }; błąd sieci po wyczerpaniu prób → throw.
 */
export async function fetchWithRetry429(url, options, retryOpts) {
    const o = retryOpts || {};
    const maxAttempts = o.maxAttempts || 3;
    const baseDelayMs = o.baseDelayMs || 1000;
    const capMs = o.capMs || 10000;
    const signal = o.signal || (options && options.signal) || null;
    const method = ((options && options.method) || 'GET').toUpperCase();
    const headers = (options && options.headers) || {};
    const headerNames = Object.keys(headers).map((k) => String(k).toLowerCase());
    const networkSafe =
        o.retryNetwork === true ||
        method === 'GET' ||
        method === 'HEAD' ||
        headerNames.indexOf('idempotency-key') !== -1;
    let lastError = null;
    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
        let res = null;
        try {
            res = await fetch(url, options);
        } catch (e) {
            lastError = e;
            res = null;
        }
        const done = attempt >= maxAttempts;
        if (res && res.status !== 429) {
            return { res: res, attempts: attempt };
        }
        if (res === null && !networkSafe) {
            throw lastError;
        }
        if (done) {
            if (res) return { res: res, attempts: attempt };
            throw lastError;
        }
        let delayMs = baseDelayMs * Math.pow(2, attempt - 1);
        if (res) {
            try {
                const ra = parseFloat(res.headers ? res.headers.get('Retry-After') : '');
                if (Number.isFinite(ra) && ra > 0) delayMs = Math.max(delayMs, ra * 1000);
            } catch (_e) {
                /* brak/nagłówek nieparsowalny — backoff */
            }
        }
        delayMs = Math.min(capMs, delayMs);
        if (typeof o.onRetry === 'function') {
            try {
                o.onRetry(attempt, res ? res.status : 0, delayMs);
            } catch (_e) {
                /* callback nie blokuje retry */
            }
        }
        await new Promise((resolve, reject) => {
            if (signal && signal.aborted) {
                reject(lastError || new Error('aborted'));
                return;
            }
            const t = setTimeout(resolve, delayMs);
            if (signal && typeof signal.addEventListener === 'function') {
                signal.addEventListener('abort', () => {
                    clearTimeout(t);
                    reject(lastError || new Error('aborted'));
                });
            }
        });
    }
    throw lastError || new Error('fetch failed');
}

window.fetchWithRetry429 = fetchWithRetry429;
