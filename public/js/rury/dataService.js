// @ts-check
/* ===== DATA SERVICE (RURY) ===== */
/* Wydzielone z app.js — odpowiedzialność: komunikacja REST API z backendem */
/* Zależności: authHeaders() z shared/auth.js, showToast() z shared/ui.js */

/**
 * Pobiera produkty z serwera. W przypadku błędu zwraca pustą tablicę.
 * @returns {Promise<Array>} Tablica produktów
 */
async function loadProducts() {
    var result = /** @type {any} */ (
        await api.getWithRetry('/api/products', { silent: true }, 3, 1000)
    );
    if (!result || !Array.isArray(result.data)) {
        logger.error('dataService', 'Błąd loadProducts: brak danych po 3 próbach');
        return [];
    }
    return result.data;
}

/**
 * Zapisuje tablicę produktów na serwer.
 * @param {Array} data - Tablica produktów do zapisu
 * @returns {Promise<boolean>} true jeśli zapis się powiódł
 */
async function saveProducts(data) {
    const result = await api.put('/api/products', { data });
    return result !== null;
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
