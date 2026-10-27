// @ts-check
/* ===== DATA SERVICE (RURY) ===== */
/* Wydzielone z app.js — odpowiedzialność: komunikacja REST API z backendem */
/* Zależności: authHeaders() z shared/auth.js, showToast() z shared/ui.js */

/* Helper HTTP z auth + timeout, dostępny globalnie dla pricelistUi itp. */
/* Kontrakt: null = błąd (HTTP lub sieciowy), callerzy traktują null jako fail. */
/* E2d: warn-only w logach; zmiana na throw wymaga decyzji po mapie callerów. */
function _apiWarn(method, url, info) {
    logger.warn('api', method + ' ' + url + ' — ' + info);
}

/* 409 STALE_DRAFT: inny admin zapisał szkic — pokazujemy powód z serwera
   i odświeżamy pasek (nowy sha), żeby kolejny zapis miał aktualny If-Match. */
async function _apiHandleError(verb, url, res) {
    _apiWarn(verb, url, 'HTTP ' + res.status);
    // Callerzy widzą tylko null/boolean — status zostaje tu, by nie dublować toastów.
    window.api.lastStatus = res.status;
    if (res.status !== 409) return null;
    let body = null;
    try {
        body = await res.json();
    } catch {
        return null;
    }
    if (!body || body.code !== 'STALE_DRAFT') return null;
    if (typeof showToast === 'function') {
        showToast(body.error || 'Szkic zmienił się — odśwież cennik', 'warning');
    }
    if (
        window.pricelistVersions &&
        typeof window.pricelistVersions.refreshStatusStrip === 'function'
    ) {
        window.pricelistVersions.refreshStatusStrip();
    }
    return null;
}

window.api = {
    async get(url) {
        try {
            const res = await fetchWithTimeout(url, { headers: authHeaders() });
            if (!res.ok) _apiWarn('GET', url, 'HTTP ' + res.status);
            return res.ok ? res.json() : null;
        } catch {
            _apiWarn('GET', url, 'błąd sieci');
            return null;
        }
    },
    async put(url, body, opts) {
        try {
            const res = await fetchWithTimeout(url, {
                method: 'PUT',
                headers: {
                    ...authHeaders(),
                    'Content-Type': 'application/json',
                    ...((opts && opts.headers) || {})
                },
                body: JSON.stringify(body)
            });
            if (!res.ok) return _apiHandleError('PUT', url, res);
            return res.json();
        } catch {
            _apiWarn('PUT', url, 'błąd sieci');
            return null;
        }
    },
    async post(url, body) {
        try {
            const res = await fetchWithTimeout(url, {
                method: 'POST',
                headers: { ...authHeaders(), 'Content-Type': 'application/json' },
                body: JSON.stringify(body)
            });
            if (!res.ok) _apiWarn('POST', url, 'HTTP ' + res.status);
            return res.ok ? res.json() : null;
        } catch {
            _apiWarn('POST', url, 'błąd sieci');
            return null;
        }
    },
    async patch(url, body) {
        try {
            const res = await fetchWithTimeout(url, {
                method: 'PATCH',
                headers: { ...authHeaders(), 'Content-Type': 'application/json' },
                body: JSON.stringify(body)
            });
            if (!res.ok) _apiWarn('PATCH', url, 'HTTP ' + res.status);
            return res.ok ? res.json() : null;
        } catch {
            _apiWarn('PATCH', url, 'błąd sieci');
            return null;
        }
    },
    async del(url) {
        try {
            const res = await fetchWithTimeout(url, { method: 'DELETE', headers: authHeaders() });
            if (!res.ok) _apiWarn('DELETE', url, 'HTTP ' + res.status);
            return res.ok ? res.json() : null;
        } catch {
            _apiWarn('DELETE', url, 'błąd sieci');
            return null;
        }
    }
};

/* P1: oferty liczą z wersji ACTIVE (?source=active), cennik-admin zostaje na LIVE.
   Fallback BE (brak ACTIVE → LIVE + X-Pricelist-Fallback: live) sygnalizujemy
   jednym toastem na załadowanie strony (flaga window.__activePricingFallbackToastShown). */
function _notifyActiveFallback(res) {
    let fallback = false;
    try {
        fallback = !!(res && res.headers && res.headers.get('X-Pricelist-Fallback') === 'live');
    } catch (_e) {
        fallback = false;
    }
    if (fallback && typeof showToast === 'function') {
        if (typeof window === 'undefined' || !window.__activePricingFallbackToastShown) {
            if (typeof window !== 'undefined') window.__activePricingFallbackToastShown = true;
            showToast('Brak aktywnej wersji — oferta liczy z cennika roboczego (LIVE)', 'warning');
        }
    }
    return fallback;
}

/**
 * Pobiera produkty z serwera. W przypadku błędu zwraca pustą tablicę.
 * @param {{source?: string}} [options] - source:'active' → ceny z wersji ACTIVE (ekrany ofert);
 *   brak → cennik roboczy LIVE (cennik-admin).
 * @returns {Promise<Array>} Tablica produktów
 */
async function loadProducts(options) {
    const useActive = !!(options && options.source === 'active');
    const url = useActive ? '/api/products?source=active' : '/api/products';
    for (let attempt = 0; attempt < 3; attempt++) {
        try {
            const res = await fetchWithTimeout(url, {}, 1000);
            if (res.ok) {
                const json = await res.json();
                if (json && Array.isArray(json.data)) {
                    window.__pricelistWriteTarget =
                        res.headers.get('X-Pricelist-Write-Target') === 'draft' ? 'draft' : 'live';
                    const fellBack = useActive ? _notifyActiveFallback(res) : false;
                    window.__ruryPricingSource = useActive
                        ? fellBack
                            ? 'live-fallback'
                            : 'active'
                        : 'live';
                    return json.data;
                }
            }
        } catch (_) {
            if (attempt < 2) await new Promise((r) => setTimeout(r, 1000));
        }
    }
    logger.error('dataService', 'Błąd loadProducts: brak danych po 3 próbach');
    return [];
}

/**
 * Zapisuje tablicę produktów na serwer.
 * @param {Array} data - Tablica produktów do zapisu
 * @returns {Promise<boolean>} true jeśli zapis się powiódł
 */
async function saveProducts(data) {
    const headers =
        window.pricelistVersions && typeof window.pricelistVersions.draftHeaders === 'function'
            ? await window.pricelistVersions.draftHeaders('rury')
            : {};
    const result = await api.put('/api/products', { data }, { headers });
    if (
        result &&
        window.pricelistVersions &&
        typeof window.pricelistVersions.noteVersionSaved === 'function'
    ) {
        window.pricelistVersions.noteVersionSaved('rury', result);
    }
    return result !== null;
}

/** Czy ostatni zapis padł na konflikcie wersji szkicu (powód pokazał `api`). */
function isStaleDraftError() {
    return window.api && window.api.lastStatus === 409;
}

/**
 * Pobiera oferty rur z serwera.
 * @returns {Promise<Array>} Tablica ofert
 */
async function loadOffers() {
    try {
        const res = await fetch('/api/offers-rury', { headers: authHeaders() });
        if (res.status === 401) {
            window.location.href = 'index.html';
            return [];
        }
        const json = await res.json();
        return json.data || [];
    } catch (err) {
        logger.error('dataService', 'Błąd loadOffers REST API:', err);
        return [];
    }
}

/**
 * Zapisuje tablicę ofert przez StorageService.
 * @param {Array} data - Tablica ofert do zapisu
 */
async function saveOffersData(data) {
    try {
        const { storageService } = await import('../shared/StorageService.js');
        for (const offer of data) {
            const doc = { ...offer, id: offer.id, type: 'offer' };
            await storageService.saveOffer(doc);
        }
    } catch (err) {
        logger.error('dataService', 'Błąd saveOffersData:', err);
    }
}

/* ===== Rejestracja globali ===== */
window.loadProducts = loadProducts;
window.saveProducts = saveProducts;
window.isStaleDraftError = isStaleDraftError;
window.loadOffers = loadOffers;
window.saveOffersData = saveOffersData;
