/**
 * PV Marketplace - Core Logic & CRUD (REST Mode)
 * Senior Architect Implementation
 */

import { storageService } from '../shared/StorageService.js';

class PVMarketplaceManager {
    constructor() {
        this.pendingChanges = []; // Kolejka zmian offline (Opcja do wdrożenia w przyszłości)
    }

    /**
     * CREATE: Tworzenie nowej oferty
     */
    async createOffer(offerData) {
        try {
            const result = await storageService.saveOffer(offerData);
            logger.info('pvMarketplaceManager', `[PV Marketplace] Offer created/saved via REST.`);
            return result;
        } catch (err) {
            logger.error('pvMarketplaceManager', '[PV Marketplace] Create error:', err);
            throw err;
        }
    }

    /**
     * UPDATE: Edycja istniejącej oferty
     */
    async updateOffer(offerId, updateData) {
        try {
            // Pobieramy nadpisywaną ofertę
            const existingOffer = await storageService.getOfferById(offerId);
            if (!existingOffer) throw new Error('Nie znaleziono oferty');

            const updatedOffer = { ...existingOffer, ...updateData };

            const result = await storageService.saveOffer(updatedOffer);
            logger.info('pvMarketplaceManager', `[PV Marketplace] Offer updated: ${offerId}`);
            return result;
        } catch (err) {
            logger.error('pvMarketplaceManager', '[PV Marketplace] Update error:', err);
            throw err;
        }
    }

    /**
     * DELETE: Usuwanie oferty
     */
    async deleteOffer(offerId) {
        try {
            const result = await storageService.deleteOffer(offerId);
            logger.info('pvMarketplaceManager', `[PV Marketplace] Offer deleted: ${offerId}`);
            return result;
        } catch (err) {
            logger.error('pvMarketplaceManager', '[PV Marketplace] Delete error:', err);
            throw err;
        }
    }
}

export default PVMarketplaceManager;
