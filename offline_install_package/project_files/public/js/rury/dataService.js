/* ===== DATA SERVICE (RURY) ===== */
/* Wydzielone z app.js — odpowiedzialność: komunikacja REST API z backendem */
/* Zależności: authHeaders() z shared/auth.js, showToast() z shared/ui.js */
/* Globalne: products, DEFAULT_PRODUCTS z pricelist.js */

/**
 * Pobiera produkty z serwera i naprawia ewentualne uszkodzenia kategorii.
 * @returns {Promise<Array>} Tablica produktów
 */
async function loadProducts() {
    try {
        const res = await fetch('/api/products', { headers: authHeaders() });
        if (res.status === 401) {
            window.location.href = 'index.html';
            return [];
        }
        const json = await res.json();
        let saved = json.data && json.data.length > 0
            ? json.data
            : JSON.parse(JSON.stringify(DEFAULT_PRODUCTS));

        // Synchronizuj brakujące produkty z cennika domyślnego
        let modified = false;
        DEFAULT_PRODUCTS.forEach((dp) => {
            const sp = saved.find((s) => s.id === dp.id);
            if (!sp) {
                saved.push(JSON.parse(JSON.stringify(dp)));
                modified = true;
            } else {
                // Napraw uszkodzoną kategorię, jeśli została ustawiona na 'studnie' przez błąd backendu
                if (sp.category === undefined || sp.category === 'studnie') {
                    console.warn(`[App] Naprawiono uszkodzoną kategorię produktu "${sp.id}": "${sp.category}" → "${dp.category}". Źródło błędu: backend/migracja.`);
                    sp.category = dp.category;
                    modified = true;
                }
            }
        });

        if (modified) {
            await fetch('/api/products', {
                method: 'PUT',
                headers: authHeaders(),
                body: JSON.stringify({ data: saved })
            });
        }

        return saved;
    } catch (err) {
        console.error('Błąd loadProducts:', err);
        return JSON.parse(JSON.stringify(DEFAULT_PRODUCTS));
    }
}

/**
 * Zapisuje tablicę produktów na serwer.
 * @param {Array} data - Tablica produktów do zapisu
 * @returns {Promise<boolean>} true jeśli zapis się powiódł
 */
async function saveProducts(data) {
    try {
        const res = await fetch('/api/products', {
            method: 'PUT',
            headers: authHeaders(),
            body: JSON.stringify({ data })
        });
        if (!res.ok) {
            const err = await res.json().catch(() => ({}));
            console.error('saveProducts: serwer zwrócił błąd', res.status, err);
            showToast('Błąd zapisu cennika: ' + (err.error || res.status), 'error');
            return false;
        }
        return true;
    } catch (err) {
        console.error('saveProducts: błąd sieci', err);
        showToast('Błąd sieci przy zapisie cennika', 'error');
        return false;
    }
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
        console.error('Błąd loadOffers REST API:', err);
        return [];
    }
}

/**
 * Zapisuje tablicę ofert przez StorageService.
 * @param {Array} data - Tablica ofert do zapisu
 */
async function saveOffersData(data) {
    try {
        const { storageService } = await import('./shared/StorageService.js');
        for (const offer of data) {
            const doc = { ...offer, id: offer.id, type: 'offer' };
            await storageService.saveOffer(doc);
        }
    } catch (err) {
        console.error('Błąd saveOffersData:', err);
    }
}
