// @ts-check
// Wersja 2.0 - Zarzadzanie zamowieniami w Kartotece
import { storageService } from '../shared/StorageService.js';
import pvSalesSearch from './pvSalesSearch.js';
import pvSalesFilter from './pvSalesFilter.js';
import pvSalesHistory from './pvSalesHistory.js';
import pvSalesActions from './pvSalesActions.js';

class PVSalesUI {
    constructor() {
        this.syncManager = null;
        this.isSyncUpToDate = true;
        this.ordersMap = new Map();
        this.currentFilter = 'all';
        this.currentTypeFilter = 'all';
        this.filters = {
            user: '',
            myOffers: false,
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
}

Object.assign(PVSalesUI.prototype, pvSalesSearch);
Object.assign(PVSalesUI.prototype, pvSalesFilter);
Object.assign(PVSalesUI.prototype, pvSalesHistory);
Object.assign(PVSalesUI.prototype, pvSalesActions);

document.addEventListener('DOMContentLoaded', () => {
    const isKartoteka = (window.location.pathname.split('/').pop() || '').startsWith('kartoteka');
    const navSales = document.getElementById('nav-sales');

    if (isKartoteka) {
        window.pvSalesUI = new PVSalesUI();
    } else if (navSales) {
        window.pvSalesUI = new PVSalesUI();
        navSales.addEventListener('click', () => {
            if (window.pvSalesUI) {
                if (!window.pvSalesUI.initialized) {
                    window.pvSalesUI.init();
                } else {
                    window.pvSalesUI.loadLocalOffers();
                }
            }
        });
    }

    // Cleanup przy odpięciu iframe
    window.addEventListener('pagehide', () => {
        if (window.pvSalesUI) {
            window.pvSalesUI._stopAutoRefresh();
        }
    });
});
