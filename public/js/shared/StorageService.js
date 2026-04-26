/**
 * StorageService.js
 * Ujednolicona usługa do zarządzania wszystkimi typami ofert (Rury i Studnie).
 * Oparta na bezpośrednich wywołaniach REST backendu SQLite/NodeJS.
 */

class StorageService {
    constructor() {
        this.initialized = true;
    }

    async init() {
        this.initialized = true;
        console.log('[StorageService] Ujednolicony magazyn zainicjowany (tryb REST).');
    }

    /**
     * Zwraca nagłówki autoryzacji do fetch().
     * @returns {object}
     */
    getHeaders() {
        const headers = { 'Content-Type': 'application/json' };
        let token = null;

        // Priorytet 1: funkcja globalna authHeaders() (jeśli dostępna z auth.js)
        if (typeof window !== 'undefined' && typeof window.getAuthToken === 'function') {
            token = window.getAuthToken();
        }

        // Priorytet 2: manualne sprawdzenie cookie/localStorage (jeśli auth.js nie załadowane)
        if (!token) {
            const match = document.cookie.match(/(?:^|;\s*)authToken=([^;]*)/);
            if (match && match[1]) {
                token = match[1];
            } else if (typeof localStorage !== 'undefined') {
                token = localStorage.getItem('authToken');
            }
        }

        if (token) {
            headers['X-Auth-Token'] = token;
        }
        return headers;
    }

    /**
     * Zapisuje ofertę (Rury lub Studnie).
     * @param {Object} offerData - Dokument oferty do zapisania.
     * @returns {Promise<Object>} Wynik zapisanego dokumentu.
     */
    async saveOffer(offerData) {
        if (!this.initialized) throw new Error('StorageService not initialized.');

        const now = new Date().toISOString();
        if (!offerData.createdAt) offerData.createdAt = now;
        offerData.updatedAt = now;

        if (!offerData.type) throw new Error('Offer type is required (offer/studnia_oferta).');

        const endpoint =
            offerData.type === 'studnia_oferta' ? '/api/offers-rury/studnie' : '/api/offers-rury';

        try {
            const headers = this.getHeaders();
            const resp = await fetch(endpoint, {
                method: 'POST',
                headers: headers,
                body: JSON.stringify({ data: [offerData] })
            });

            const data = await resp.json();
            if (!resp.ok) throw new Error(data.error || 'Błąd zapisu oferty');

            console.log(`[StorageService] Oferta ${offerData.id} została zapisana pomyślnie.`);

            // Pobierz ponownie, aby uzyskać pola wygenerowane po stronie serwera, jeśli to konieczne,
            // lub po prostu zwróć zaktualizowane dane.
            return offerData;
        } catch (error) {
            console.error('[StorageService] Błąd podczas zapisywania oferty:', error);
            throw error;
        }
    }

    /**
     * Pobiera wszystkie globalne oferty z serwera.
     * @param {Array} types - Tablica typów do pobrania.
     * @returns {Promise<Array>} Lista dokumentów ofert.
     */
    async getOffers(types = ['offer', 'studnia_oferta']) {
        if (!this.initialized) throw new Error('StorageService not initialized.');

        let results = [];
        try {
            const timestamp = Date.now();
            const headers = this.getHeaders();

            if (types.includes('offer')) {
                const res = await fetch(`/api/offers-rury?t=${timestamp}`, { headers });
                if (res.ok) {
                    const json = await res.json();
                    results = results.concat(json.data || []);
                }
            }
            if (types.includes('studnia_oferta')) {
                const res = await fetch(`/api/offers-rury/studnie?t=${timestamp}`, { headers });
                if (res.ok) {
                    const json = await res.json();
                    results = results.concat(json.data || []);
                }
            }

            // Sortuj według createdAt malejąco
            return results.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
        } catch (error) {
            console.error('[StorageService] Błąd podczas pobierania ofert:', error);
            throw error;
        }
    }

    /**
     * Usuwa ofertę z bazy danych serwera.
     * @param {string} id - ID dokumentu.
     */
    async deleteOffer(id) {
        if (!this.initialized) throw new Error('StorageService not initialized.');

        const headers = this.getHeaders();
        const stringId = String(id);
        const isStudnie = stringId.startsWith('offer_studnie_');

        console.log(`[StorageService] Usuwanie oferty ${id}...`);

        // Ustal kolejność prób na podstawie prefiksu ID
        const endpoints = isStudnie
            ? [`/api/offers-rury/studnie/${id}`, `/api/offers-rury/${id}`]
            : [`/api/offers-rury/${id}`, `/api/offers-rury/studnie/${id}`];

        try {
            for (let i = 0; i < endpoints.length; i++) {
                const url = endpoints[i];
                const res = await fetch(url, { method: 'DELETE', headers });
                
                if (res.ok) {
                    const type = url.includes('/studnie/') ? 'studni' : 'rur';
                    console.log(`[StorageService] Oferta ${id} została usunięta z ${type}.`);
                    return true;
                }

                // Jeśli to ostatnia próba i nadal nie ok, rzuć błąd
                if (i === endpoints.length - 1) {
                    const errData = await res.json().catch(() => ({}));
                    throw new Error(errData.error || 'Nie udało się usunąć oferty z żadnego endpointu');
                }
            }
        } catch (error) {
            console.error(`[StorageService] Błąd podczas usuwania oferty ${id}:`, error);
            throw error;
        }
    }

    /**
     * Pobiera pojedynczą ofertę po ID z pamięci/pamięci podręcznej.
     * Ponieważ interfejsy REST API zazwyczaj mają GET /id, moglibyśmy to wywołać.
     * @param {string} id - ID dokumentu.
     * @returns {Promise<Object>} Dokument oferty.
     */
    async getOfferById(id) {
        const headers = this.getHeaders();
        const stringId = String(id);
        const isStudnie = stringId.startsWith('offer_studnie_');

        // Ustal kolejność prób na podstawie prefiksu ID
        const endpoints = isStudnie
            ? [`/api/offers-rury/studnie/${encodeURIComponent(stringId)}`, `/api/offers-rury/${encodeURIComponent(stringId)}`]
            : [`/api/offers-rury/${encodeURIComponent(stringId)}`, `/api/offers-rury/studnie/${encodeURIComponent(stringId)}`];

        for (const url of endpoints) {
            try {
                const res = await fetch(url, { headers });
                if (res.ok) {
                    const json = await res.json();
                    return this.normalizeOffer(json.data);
                }
            } catch (_e) { /* endpoint niedostępny — próbuj dalej */ }
        }

        // Fallback: pobierz wszystkie (kompatybilność wsteczna)
        console.warn(
            '[StorageService] Dedykowane endpointy GET /:id niedostępne. Fallback do pełnego pobierania.'
        );
        const allOffers = await this.getOffers();
        const doc = allOffers.find((o) => String(o.id) === stringId);
        return this.normalizeOffer(doc);
    }

    /**
     * Normalizuje dane oferty.
     * @param {Object} doc - Surowy dokument z API.
     * @returns {Object} Znormalizowany płaski obiekt oferty.
     */
    normalizeOffer(doc) {
        if (!doc) return doc;

        if (doc.data && typeof doc.data === 'object' && !Array.isArray(doc.data)) {
            const legacyMapping = {
                items: doc.data.items,
                wells: doc.data.wells,
                totalNetto:
                    doc.data.totalNetto || (doc.data.summary ? doc.data.summary.totalValue : null),
                totalBrutto:
                    doc.data.totalBrutto ||
                    (doc.data.summary ? doc.data.summary.totalBrutto : null),
                number: doc.data.number || doc.data.offerNumber,
                clientName: doc.data.clientName,
                date: doc.data.date || doc.data.offerDate
            };

            for (const [key, value] of Object.entries(legacyMapping)) {
                if (
                    value !== undefined &&
                    value !== null &&
                    (doc[key] === undefined || doc[key] === null)
                ) {
                    doc[key] = value;
                }
            }
        }

        // Normalizacja ID zakończona

        return doc;
    }
}

export const storageService = new StorageService();
export default storageService;
