/**
 * api.js — Ustandaryzowany klient API z timeoutem, obsługą błędów i toastami.
 *
 * Zastępuje ad-hoc fetch() z niespójną obsługą błędów.
 *
 * Użycie:
 *   const data = await api.get('/api/offers-studnie');
 *   const result = await api.put('/api/orders-studnie', { data: [...] });
 */

(function () {
    const DEFAULT_TIMEOUT = 15000;

    /**
     * Wykonuje fetch z timeoutem.
     * @param {string} url
     * @param {RequestInit} options
     * @param {number} [timeoutMs]
     * @returns {Promise<Response>}
     */
    async function fetchWithTimeout(url, options, timeoutMs) {
        if (timeoutMs == null) timeoutMs = DEFAULT_TIMEOUT;
        const controller = new AbortController();
        const timer = setTimeout(function () { controller.abort(); }, timeoutMs);
        try {
            return await fetch(url, Object.assign({}, options, { signal: controller.signal }));
        } finally {
            clearTimeout(timer);
        }
    }

    /**
     * Wykonuje bezpieczne żądanie HTTP z obsługą błędów.
     * - Timeout przez AbortController
     * - Automatyczne !res.ok → throw
     * - Parsowanie JSON
     * - Logowanie błędów
     * @param {string} url
     * @param {Object} [opts]
     * @param {string} [opts.method='GET']
     * @param {Object} [opts.body] - Ciało żądania (zostanie zserializowane jako JSON)
     * @param {Object} [opts.headers]
     * @param {number} [opts.timeout]
     * @param {boolean} [opts.silent] - Gdy true, nie pokazuje toasta przy błędzie
     * @returns {Promise<Object|null>} - Sparsowane JSON lub null przy błędzie (silent)
     */
    async function request(url, opts = {}) {
        const method = (opts.method || 'GET').toUpperCase();
        const headers = Object.assign(
            { 'Content-Type': 'application/json' },
            typeof authHeaders === 'function' ? authHeaders() : {},
            opts.headers || {}
        );
        const fetchOpts = { method, headers };
        if (opts.body != null) {
            fetchOpts.body = JSON.stringify(opts.body);
        }
        try {
            const res = await fetchWithTimeout(url, fetchOpts, opts.timeout);
            if (!res.ok) {
                const text = await res.text().catch(function () { return ''; });
                throw new Error('HTTP ' + res.status + (text ? ': ' + text.slice(0, 200) : ''));
            }
            const contentType = res.headers.get('content-type') || '';
            if (contentType.includes('application/json')) {
                return await res.json();
            }
            return await res.text();
        } catch (err) {
            if (err.name === 'AbortError') {
                console.error('[API] Timeout:', url);
                if (!opts.silent) showToast('Przekroczono czas żądania: ' + url, 'error');
            } else {
                console.error('[API] Błąd:', url, err.message);
                if (!opts.silent) showToast('Błąd: ' + err.message, 'error');
            }
            return null;
        }
    }

    window.api = {
        get: function (url, opts) { return request(url, Object.assign({}, opts, { method: 'GET' })); },
        post: function (url, body, opts) { return request(url, Object.assign({}, opts, { method: 'POST', body: body })); },
        put: function (url, body, opts) { return request(url, Object.assign({}, opts, { method: 'PUT', body: body })); },
        del: function (url, opts) { return request(url, Object.assign({}, opts, { method: 'DELETE' })); },
        request: request
    };
})();
