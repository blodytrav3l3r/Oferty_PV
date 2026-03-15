/**
 * PV Marketplace - Database & Sync Manager
 * Senior Architect Implementation
 */

// Handle browser vs node environment
const _PouchDB = typeof window !== 'undefined' ? window.PouchDB : require('pouchdb');
const _PouchDBFind = typeof window !== 'undefined' ? (window.PouchDBFind || window.pouchdbFind || window.pouchdb_find) : require('pouchdb-find');

if (_PouchDB && _PouchDB.plugin && _PouchDBFind) {
  try {
      _PouchDB.plugin(_PouchDBFind);
      console.log('[PV Sync] PouchDBFind plugin registered successfully');
  } catch(e) {
      console.warn('[PV Sync] PouchDBFind plugin registration warning:', e);
  }
}

const DB_PREFIX = 'pv_';
const ROLES = {
  ADMIN: 'admin',
  PRO: 'pro',
  USER: 'user'
};

const ROLE_PRIORITY = {
  [ROLES.ADMIN]: 3,
  [ROLES.PRO]: 2,
  [ROLES.USER]: 1
};

class PVSyncManager {
  constructor(user) {
    this.userId = user.id || user._id?.replace('user:', '');
    this.role = user.role || 'user';
    
    // Remote URL detection (default to CouchDB port 5984)
    const protocol = window.location.protocol;
    const hostname = window.location.hostname;
    const port = window.location.port || (protocol === 'https:' ? '443' : '3000');
    
    // For local development, CouchDB is usually on 5984 with admin:admin123
    // If we are on localhost, we use localhost:5984.
    // If we are on a network IP, we use that IP:5984.
    this.remoteUrl = `${protocol}//admin:admin123@${hostname}:5984`;
    
    // Local DBs
    this.localOffers = new _PouchDB(`${DB_PREFIX}local_offers_${this.userId}`);
    this.localMarketCache = new _PouchDB(`${DB_PREFIX}local_market_cache`);
    this.localProducts = new _PouchDB(`${DB_PREFIX}products_cache`);
    this.localClients = new _PouchDB(`${DB_PREFIX}local_clients_${this.userId}`);
    
    // Remote DBs
    // ADMIN i PRO synchronizują się bezpośrednio z bazą globalną by widzieć wszystko
    const isAdminOrPro = this.role === ROLES.ADMIN || this.role === ROLES.PRO;
    
    this.remoteUserDbUrl = isAdminOrPro 
        ? `${this.remoteUrl}/${DB_PREFIX}offers_global`
        : `${this.remoteUrl}/${DB_PREFIX}offers_user_${this.userId}`;
        
    this.remoteGlobalDbUrl = `${this.remoteUrl}/${DB_PREFIX}offers_global`;
    this.remoteProductsUrl = `${this.remoteUrl}/${DB_PREFIX}products`;
    this.remoteClientsUrl = `${this.remoteUrl}/${DB_PREFIX}clients_global`;
    
    this.syncHandler = null;
    this.productSyncHandler = null;
    this.clientsSyncHandler = null;
    this.globalPushHandler = null; // Dodane

    this.syncIsUpToDate = true; // Zainicjalizuj optymistycznie
    this.globalPushIsUpToDate = true; // Zainicjalizuj optymistycznie

    // Plugins check
    if (typeof _PouchDB.plugin === 'function' && _PouchDBFind) {
        try { _PouchDB.plugin(_PouchDBFind); } catch(e) {}
    }
  }

  notifySyncStatus() {
      window.dispatchEvent(new CustomEvent('pv-sync-status-changed', {
          detail: {
              syncIsUpToDate: this.syncIsUpToDate,
              globalPushIsUpToDate: this.globalPushIsUpToDate,
              fullySynced: this.syncIsUpToDate && this.globalPushIsUpToDate
          }
      }));
  }

  /**
   * Inicjalizacja baz danych i indeksów Mango
   */
  async initDatabase() {
    try {
      // Tworzenie indeksów dla optymalizacji wyszukiwania i synchronizacji
      await this.localOffers.createIndex({
        index: { fields: ['type', 'createdAt'] }
      });
      await this.localOffers.createIndex({
        index: { fields: ['type', 'updatedAt'] }
      });
      await this.localOffers.createIndex({
        index: { fields: ['type', 'userId', 'updatedAt'] }
      });
      await this.localOffers.createIndex({
        index: { fields: ['createdAt'] }
      });
      
      await this.localProducts.createIndex({
        index: { fields: ['category', 'name'] }
      });

      await this.localClients.createIndex({
        index: { fields: ['type', 'name', 'nip'] }
      });

      console.log(`[PV Sync] Database initialized for user: ${this.userId}`);
    } catch (err) {
      console.error('[PV Sync] Init error:', err);
      throw err;
    }
  }

  /**
   * Start synchronizacji dwukierunkowej dla ofert użytkownika
   */
  startSync() {
    if (this.syncHandler) return;

    this.syncHandler = this.localOffers.sync(this.remoteUserDbUrl, {
      live: true,
      retry: true,
      batch_size: 100,
      batches_limit: 10,
    })
    .on('change', (info) => {
        console.log('[PV Sync] Change:', info);
        this.syncIsUpToDate = false; // Nowa zmiana w trakcie procesowania
        this.notifySyncStatus();
    })
    .on('paused', (err) => {
        console.log('[PV Sync] Paused', err ? `(error: ${err})` : '(up to date)');
        this.syncIsUpToDate = !err;
        this.notifySyncStatus();
    })
    .on('active', () => {
        console.log('[PV Sync] Resuming synchronization');
        this.syncIsUpToDate = false;
        this.notifySyncStatus();
    })
    .on('denied', (err) => {
        console.error('[PV Sync] Permission denied (401/403):', err);
        if (typeof window.showToast === 'function') window.showToast('Błąd uprawnień synchronizacji. Zaloguj się ponownie.', 'error');
    })
    .on('complete', (info) => console.log('[PV Sync] Sync complete:', info))
    .on('error', (err) => {
        console.error('[PV Sync] Fatal sync error:', err);
        if (err.status === 401) window.location.href = 'index.html';
    });

    // Tylko PULL dla bazy produktów (cenniki read-only dla pracownika)
    this.productSyncHandler = _PouchDB.replicate(
      this.remoteProductsUrl,
      this.localProducts,
      {
        live: true,
        retry: true
      }
    ).on('change', (info) => console.log('[PV Sync] Products Sync updated:', info))
    .on('error', (err) => console.error('[PV Sync] Products Sync error:', err));

    // Dwukierunkowa synchronizacja klientów
    this.clientsSyncHandler = this.localClients.sync(this.remoteClientsUrl, {
        live: true,
        retry: true
    }).on('change', (info) => console.log('[PV Sync] Clients Sync updated:', info))
    .on('error', (err) => console.error('[PV Sync] Clients Sync error:', err));

    // PUSH do bazy globalnej (Marketplace) - aby inni widzieli nasze oferty
    // UWAGA: W systemie produkcyjnym warto tu filtrować tylko zatwierdzone oferty
    this.globalPushHandler = this.localOffers.replicate.to(this.remoteGlobalDbUrl, {
        live: true,
        retry: true
    }).on('change', (info) => {
        console.log('[PV Sync] Global Marketplace Push Change:', info);
        this.globalPushIsUpToDate = false;
        this.notifySyncStatus();
    })
    .on('paused', (err) => {
        console.log('[PV Sync] Global Push Paused');
        this.globalPushIsUpToDate = !err;
        this.notifySyncStatus();
    })
    .on('error', (err) => console.error('[PV Sync] Global Marketplace Push error:', err));
  }

  stopSync() {
    if (this.syncHandler) {
      this.syncHandler.cancel();
      this.syncHandler = null;
    }
    if (this.productSyncHandler) {
      this.productSyncHandler.cancel();
      this.productSyncHandler = null;
    }
    if (this.clientsSyncHandler) {
      this.clientsSyncHandler.cancel();
      this.clientsSyncHandler = null;
    }
  }

  /**
   * Logika rozwiązywania konfliktów: Admin > Premium > User
   */
  async resolveConflict(localDoc, remoteDoc) {
    const localPriority = ROLE_PRIORITY[localDoc.lastEditedByRole] || 0;
    const remotePriority = ROLE_PRIORITY[remoteDoc.lastEditedByRole] || 0;

    if (localPriority > remotePriority) {
      return localDoc;
    } else if (remotePriority > localPriority) {
      return remoteDoc;
    }

    // Role te same -> wybierz nowszy
    return new Date(localDoc.updatedAt) >= new Date(remoteDoc.updatedAt) ? localDoc : remoteDoc;
  }

  /**
   * Sprawdzenie uprawnień do edycji (blokada edycji jeśli wyższa rola modyfikowała)
   */
  checkEditPermission(existingDoc) {
    const currentPriority = ROLE_PRIORITY[this.role];
    const editorPriority = ROLE_PRIORITY[existingDoc.lastEditedByRole];

    if (editorPriority > currentPriority) {
      throw new Error("Ta oferta została zmodyfikowana przez administratora lub konto premium i nie może zostać nadpisana. Odśwież dane aby zobaczyć aktualną wersję.");
    }
    return true;
  }
}

export default PVSyncManager;
