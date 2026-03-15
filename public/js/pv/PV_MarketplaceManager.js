/**
 * PV Marketplace - Core Logic & CRUD
 * Senior Architect Implementation
 */

function generateUUID() {
  if (typeof window !== 'undefined' && window.crypto && window.crypto.randomUUID) {
    return window.crypto.randomUUID();
  }
  return require('uuid').v4();
}

class PVMarketplaceManager {
  constructor(syncManager) {
    this.syncManager = syncManager;
    this.localOffers = syncManager.localOffers;
    this.localMarketCache = syncManager.localMarketCache;
    this.pendingChanges = []; // Kolejka zmian offline
  }

  /**
   * CREATE: Tworzenie nowej oferty
   */
  async createOffer(offerData) {
    const uuid = generateUUID();
    const offerId = `offer:${this.syncManager.userId}:${uuid}`;
    
    const newOffer = {
      _id: offerId,
      type: 'offer',
      userId: this.syncManager.userId,
      status: 'active',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      lastEditedBy: this.syncManager.userId,
      lastEditedByRole: this.syncManager.role,
      syncStatus: 'local',
      ...offerData
    };

    try {
      const result = await this.localOffers.put(newOffer);
      console.log(`[PV Marketplace] Offer created: ${offerId}`);
      return result;
    } catch (err) {
      console.error('[PV Marketplace] Create error:', err);
      this._queueChange('CREATE', newOffer);
      throw err;
    }
  }

  /**
   * UPDATE: Edycja istniejącej oferty z walidacją uprawnień
   */
  async updateOffer(offerId, updateData) {
    try {
      const existingDoc = await this.localOffers.get(offerId);
      
      // Sprawdzenie blokady edycji (Role Priority)
      this.syncManager.checkEditPermission(existingDoc);
 
      const updatedDoc = {
        ...existingDoc,
        ...updateData,
        updatedAt: new Date().toISOString(),
        lastEditedBy: this.syncManager.userId,
        lastEditedByRole: this.syncManager.role,
        syncStatus: 'local'
      };

      const result = await this.localOffers.put(updatedDoc);
      console.log(`[PV Marketplace] Offer updated: ${offerId}`);
      return result;
    } catch (err) {
      console.error('[PV Marketplace] Update error:', err);
      if (err.status !== 403) { // Jeśli to nie błąd uprawnień, wrzuć do kolejki
         this._queueChange('UPDATE', { offerId, updateData });
      }
      throw err;
    }
  }

  /**
   * DELETE: Usuwanie oferty (soft delete lub usunięcie dokumentu)
   */
  async deleteOffer(offerId) {
    try {
      const doc = await this.localOffers.get(offerId);
      const result = await this.localOffers.remove(doc);
      console.log(`[PV Marketplace] Offer deleted: ${offerId}`);
      return result;
    } catch (err) {
      console.error('[PV Marketplace] Delete error:', err);
      this._queueChange('DELETE', { offerId });
      throw err;
    }
  }

  /**
   * Kolejkowanie zmian offline dla późniejszej synchronizacji
   */
  _queueChange(type, data) {
    const change = {
      id: generateUUID(),
      type,
      data,
      timestamp: new Date().toISOString()
    };
    this.pendingChanges.push(change);
    // W produkcji: zapisz this.pendingChanges do osobnej bazy PouchDB/LocalStorage
    console.warn(`[PV Marketplace] Offline change queued: ${type}`, change);
  }

  /**
   * Pobieranie ofert z Marketplace (z lokalnego cache'u)
   */
  async getMarketplaceOffers(filters = {}) {
    // Marketplace działa głównie online, ale tutaj zapewniamy dostęp do cache'u
    return this.localMarketCache.find({
      selector: {
        type: 'offer',
        ...filters
      },
      sort: [{ updatedAt: 'desc' }]
    });
  }
}

export default PVMarketplaceManager;
