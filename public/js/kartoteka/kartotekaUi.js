// @ts-check
// Wersja 2.0 - Zarzadzanie zamowieniami w Kartotece
import kartotekaSearch from './kartotekaSearch.js';
import kartotekaFilter from './kartotekaFilter.js';
import kartotekaHistory from './kartotekaHistory.js';
import kartotekaActions from './kartotekaActions.js';

class KartotekaUI {
    constructor() {
        this.syncManager = null;
        this.isSyncUpToDate = true;
        this.ordersMap = new Map();
        this.currentFilter = 'all';
        this.currentTypeFilter = 'all';
        this.filters = {
            user: '',
            date: {
                mode: 'none',
                preset: '',
                from: '',
                to: ''
            }
        };
        this.autoRefreshInterval = null;
        this.initRetryCount = 0;
        this.initRetryMax = 5;

        // Nowy stan Unified Search API
        this.searchResults = null; // { items, totalCount, hasMore, nextCursor, nextCursorId }
        this.isLoading = false;
        this.abortController = null;
        this.searchDebounceTimer = null;

        this.init();
    }

    /** Deleguje do domiksowanej implementacji (Object.assign poniżej) */
    init() {
        if (typeof kartotekaSearch.init === 'function') {
            return kartotekaSearch.init.call(this);
        }
    }
}

Object.assign(KartotekaUI.prototype, kartotekaSearch);
Object.assign(KartotekaUI.prototype, kartotekaFilter);
Object.assign(KartotekaUI.prototype, kartotekaHistory);
Object.assign(KartotekaUI.prototype, kartotekaActions);

document.addEventListener('DOMContentLoaded', () => {
    const isKartoteka = (window.location.pathname.split('/').pop() || '').startsWith('kartoteka');

    if (isKartoteka) {
        window.kartotekaUI = new KartotekaUI();
    }

    // Cleanup przy odpięciu iframe
    window.addEventListener('pagehide', () => {
        if (window.kartotekaUI) {
            window.kartotekaUI._stopAutoRefresh();
        }
    });
});
