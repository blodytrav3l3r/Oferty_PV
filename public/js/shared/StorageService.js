/**
 * StorageService.js
 * Unified service for managing all offer types (Rury & Studnie).
 * Built on direct SQLite/NodeJS backend REST calls.
 */

class StorageService {
    constructor() {
        this.initialized = true;
    }

    async init() {
        this.initialized = true;
        console.log('[StorageService] Unified storage initialized (REST mode).');
    }

    /**
     * Saves an offer (Rury or Studnie).
     * @param {Object} offerData - The offer document to save.
     * @returns {Promise<Object>} The saved document result.
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
            const headers = { 'Content-Type': 'application/json' };
            let token = document.cookie
                .split(';')
                .map((c) => c.trim())
                .find((c) => c.startsWith('authToken='));
            if (token) {
                token = token.split('=')[1];
            } else if (typeof localStorage !== 'undefined') {
                token = localStorage.getItem('authToken');
            }
            if (token) headers['x-auth-token'] = token;

            const resp = await fetch(endpoint, {
                method: 'POST',
                headers: headers,
                body: JSON.stringify({ data: [offerData] })
            });

            const data = await resp.json();
            if (!resp.ok) throw new Error(data.error || 'Błąd zapisu oferty');

            console.log(`[StorageService] Offer ${offerData.id} saved successfully.`);

            // Re-fetch to get any server-side generated fields if needed, or simply return updated
            return offerData;
        } catch (error) {
            console.error('[StorageService] Error saving offer:', error);
            throw error;
        }
    }

    /**
     * Fetches all global offers from the server
     * @param {Array} types - Array of types to fetch.
     * @returns {Promise<Array>} List of offer documents.
     */
    async getOffers(types = ['offer', 'studnia_oferta']) {
        if (!this.initialized) throw new Error('StorageService not initialized.');

        let results = [];
        try {
            const timestamp = Date.now();
            if (types.includes('offer')) {
                const res = await fetch(`/api/offers-rury?t=${timestamp}`);
                if (res.ok) {
                    const json = await res.json();
                    results = results.concat(json.data || []);
                }
            }
            if (types.includes('studnia_oferta')) {
                const res = await fetch(`/api/offers-rury/studnie?t=${timestamp}`);
                if (res.ok) {
                    const json = await res.json();
                    results = results.concat(json.data || []);
                }
            }

            // Sort by createdAt desc
            return results.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
        } catch (error) {
            console.error('[StorageService] Error fetching offers:', error);
            throw error;
        }
    }

    /**
     * Deletes an offer from the server database.
     * @param {string} id - The document ID.
     */
    async deleteOffer(id) {
        if (!this.initialized) throw new Error('StorageService not initialized.');

        const headers = {};
        let token = document.cookie
            .split(';')
            .map((c) => c.trim())
            .find((c) => c.startsWith('authToken='));
        if (token) {
            token = token.split('=')[1];
        } else if (typeof localStorage !== 'undefined') {
            token = localStorage.getItem('authToken');
        }
        if (token) headers['x-auth-token'] = token;
        headers['Content-Type'] = 'application/json';

        console.log(`[StorageService] Deleting offer ${id}...`);

        try {
            const res1 = await fetch(`/api/offers-rury/${id}`, { method: 'DELETE', headers });
            if (res1.ok) {
                console.log(`[StorageService] Offer ${id} deleted from rury.`);
                return true;
            }

            // If not found in rury, try studnie
            const res2 = await fetch(`/api/offers-rury/studnie/${id}`, {
                method: 'DELETE',
                headers
            });
            if (res2.ok) {
                console.log(`[StorageService] Offer ${id} deleted from studnie.`);
                return true;
            }

            throw new Error('Nie udało się usunąć oferty z żadnego endpointu');
        } catch (error) {
            console.error(`[StorageService] Error deleting offer ${id}:`, error);
            throw error;
        }
    }

    /**
     * Gets a single offer by ID from memory/cached fetch.
     * Since REST APIs usually have GET /id, we could call that.
     * @param {string} id - The document ID.
     * @returns {Promise<Object>} The offer document.
     */
    async getOfferById(id) {
        // Fallback: fetch all and find, or assume the app already handles this
        console.warn(
            '[StorageService] getOfferById invoked. Doing a full fetch as a fallback. Implement /api/offers-rury/:id for best performance.'
        );
        const allOffers = await this.getOffers();
        const doc = allOffers.find((o) => String(o.id) === String(id));
        return this.normalizeOffer(doc);
    }

    /**
     * Normalizes offer data
     * @param {Object} doc - The raw document from API.
     * @returns {Object} Normalized flat offer object.
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
