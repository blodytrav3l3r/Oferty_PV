// @ts-check
/* ===== DATA SERVICE (RURY) ===== */
/* Wydzielone z app.js — odpowiedzialność: komunikacja REST API z backendem */
/* Zależności: authHeaders() z shared/auth.js, showToast() z shared/ui.js */

/**
 * Pobiera produkty z serwera. W przypadku błędu zwraca pustą tablicę.
 * @returns {Promise<Array>} Tablica produktów
 */
async function loadProducts() {
    for (let attempt = 0; attempt < 3; attempt++) {
        try {
            const res = await fetchWithTimeout('/api/products', { silent: true }, 1000);
            if (res.ok) {
                const json = await res.json();
                if (json && Array.isArray(json.data)) {
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
