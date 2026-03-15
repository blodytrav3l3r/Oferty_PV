/**
 * StorageService.js
 * Unified service for managing all offer types (Rury & Studnie).
 * Built on PouchDB with CouchDB synchronization support.
 */

class StorageService {
    constructor() {
        this.db = null;
        this.initialized = false;
    }

    /**
     * Initializes the database connection using the provided sync manager.
     * @param {Object} syncManager - The PV_SyncManager instance.
     */
    async init(syncManager) {
        if (!syncManager || !syncManager.localOffers) {
            throw new Error('[StorageService] SyncManager not provided or invalid.');
        }
        this.db = syncManager.localOffers;
        this.initialized = true;
        console.log('[StorageService] Unified storage initialized.');
    }

    /**
     * Saves an offer (Rury or Studnie).
     * @param {Object} offerData - The offer document to save.
     * @returns {Promise<Object>} The saved document result.
     */
    async saveOffer(offerData) {
        if (!this.initialized) throw new Error('StorageService not initialized.');

        const now = new Date().toISOString();
        let existingDoc = null;

        // Try to get existing doc to handle history
        if (offerData._id) {
            try {
                existingDoc = await this.db.get(offerData._id);
            } catch (err) {
                // Not found is fine, it's a new doc with a predefined ID
            }
        }

        const doc = {
            ...offerData,
            updatedAt: now
        };

        if (!doc.createdAt) doc.createdAt = now;
        if (!doc.type) throw new Error('Offer type is required (offer/studnia_oferta).');

        // Automatic History Tracking
        if (existingDoc) {
            const history = existingDoc.history || [];
            // Create snapshot (clone without existing history to avoid recursion/bloat)
            const snapshot = { ...existingDoc };
            delete snapshot.history;
            delete snapshot._rev; // rev belongs to the wrapper
            
            // Add snapshot to history
            history.push(snapshot);
            
            // Keep only last 10 versions
            if (history.length > 10) history.shift();
            
            doc.history = history;
        }

        try {
            const result = await this.db.put(doc);
            console.log(`[StorageService] Offer ${doc._id || result.id} saved successfully with history.`);
            return result;
        } catch (error) {
            console.error('[StorageService] Error saving offer:', error);
            throw error;
        }
    }

    /**
     * Fetches all local offers, sorted by creation date descending.
     * @param {Array} types - Array of types to fetch (default: ['offer', 'studnia_oferta']).
     * @returns {Promise<Array>} List of offer documents.
     */
    async getOffers(types = ['offer', 'studnia_oferta']) {
        if (!this.initialized) throw new Error('StorageService not initialized.');

        try {
            const result = await this.db.find({
                selector: {
                    type: { $in: types },
                    createdAt: { $gt: null }
                },
                sort: [{ 'createdAt': 'desc' }]
            });
            return result.docs;
        } catch (error) {
            console.error('[StorageService] Error fetching offers:', error);
            throw error;
        }
    }

    /**
     * Deletes an offer from the local database.
     * @param {string} id - The document ID.
     * @param {string} rev - The document revision.
     * @returns {Promise<Object>} Deletion result.
     */
    async deleteOffer(id, rev) {
        if (!this.initialized) throw new Error('StorageService not initialized.');

        try {
            const result = await this.db.remove(id, rev);
            console.log(`[StorageService] Offer ${id} deleted.`);
            return result;
        } catch (error) {
            console.error(`[StorageService] Error deleting offer ${id}:`, error);
            throw error;
        }
    }

    /**
     * Gets a single offer by ID.
     * @param {string} id - The document ID.
     * @returns {Promise<Object>} The offer document.
     */
    async getOfferById(id) {
        if (!this.initialized) throw new Error('StorageService not initialized.');
        const doc = await this.db.get(id);
        return this.normalizeOffer(doc);
    }

    /**
     * Normalizes offer data by flattening nested 'data' field if present.
     * Supports legacy PV sync format and various vendor-specific formats.
     * @param {Object} doc - The raw document from PouchDB/CouchDB.
     * @returns {Object} Normalized flat offer object.
     */
    normalizeOffer(doc) {
        if (!doc) return doc;

        // If 'data' exists and contains items or wells, it's a legacy/synced nested structure
        if (doc.data && typeof doc.data === 'object' && !Array.isArray(doc.data)) {
            console.log(`[StorageService] Normalizing nested data for offer ${doc._id || doc.id}`);
            
            // Map legacy fields from doc.data to top level if they don't exist
            const legacyMapping = {
                items: doc.data.items,
                wells: doc.data.wells,
                totalNetto: doc.data.totalNetto || (doc.data.summary ? doc.data.summary.totalValue : null),
                totalBrutto: doc.data.totalBrutto || (doc.data.summary ? doc.data.summary.totalBrutto : null),
                number: doc.data.number || doc.data.offerNumber,
                clientName: doc.data.clientName,
                date: doc.data.date || doc.data.offerDate
            };

            for (const [key, value] of Object.entries(legacyMapping)) {
                if (value !== undefined && value !== null && (doc[key] === undefined || doc[key] === null)) {
                    doc[key] = value;
                }
            }
        }

        // Ensure id is present (for UI components expecting .id)
        if (!doc.id && doc._id) doc.id = doc._id;

        return doc;
    }
}

// Export as a singleton
export const storageService = new StorageService();
export default storageService;
