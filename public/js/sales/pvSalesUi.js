// @ts-check
// Wersja 2.0 - Zarzadzanie zamowieniami w Kartotece
import { storageService } from '../shared/StorageService.js';
import { pvSalesAuditMixin } from './pvSalesAudit.js';
import { pvSalesOrdersMixin } from './pvSalesOrders.js';
import { pvSalesUiRenderMixin } from './pvSalesUiRender.js';

window.isRuryOfferFromTypeOrId = function isRuryOfferFromTypeOrId(offerType, offerId) {
    if (offerType === 'rura_oferta' || offerType === 'offer') return true;
    if (offerId && /^offer_rury_/.test(offerId)) return true;
    return false;
};

window.openPrintModal = function openPrintModal(offerId, orderId, offerType, relatedOrders) {
    if (!offerId && !orderId) {
        if (typeof showToast === 'function') {
            showToast('Brak identyfikatora oferty/zamówienia do wydruku', 'error');
        }
        return;
    }
    const isRury = window.isRuryOfferFromTypeOrId(offerType, offerId);
    const safeOrderId = orderId || '';
    const safeRelatedOrders = Array.isArray(relatedOrders) ? relatedOrders : null;
    if (isRury && typeof window.showUniversalPrintModalRury === 'function') {
        window.showUniversalPrintModalRury(offerId, safeOrderId, safeRelatedOrders);
    } else if (typeof window.showUniversalPrintModal === 'function') {
        window.showUniversalPrintModal(offerId, safeOrderId, safeRelatedOrders);
    } else if (typeof showToast === 'function') {
        showToast('Funkcja wydruku nie jest dostępna w tym widoku.', 'info');
    }
};

(function () {
    var s = document.createElement('style');
    s.textContent =
        '.btn-open-order:hover{color:#7dd3fc!important;text-decoration:underline!important}';
    document.head.appendChild(s);
})();

class PVSalesUI {
    constructor() {
        this.syncManager = null;
        this.allLocalOffers = [];
        this.isSyncUpToDate = true;
        this.ordersMap = new Map();
        this.currentFilter = 'all';
        this.currentTypeFilter = 'all';
        this.autoRefreshInterval = null;

        this.init();
    }

    normalizeId(id) {
        if (!id) return '';
        return String(id);
    }

    escapeHtml(value) {
        return String(value ?? '')
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;');
    }

    async init() {
        if (this.initialized) return;

        try {
            const userStr = sessionStorage.getItem('user');
            if (!userStr) {
                logger.info(
                    'pvSalesUi',
                    '[PVSalesUI] Czekam na dane użytkownika w sessionStorage (ponowienie za 500ms)...'
                );
                setTimeout(() => this.init(), 500);
                return;
            }

            const user = JSON.parse(userStr);
            this.role = user.role || 'user';
            logger.info('pvSalesUi', 'Inicjalizacja dla użytkownika:', user.username);

            await storageService.init();

            this.attachEventListeners();
            await this.loadOrdersMap();
            if (typeof fetchGlobalUsers === 'function') await fetchGlobalUsers();
            await this.loadLocalOffers();

            this._startAutoRefresh();

            this.initialized = true;
        } catch (error) {
            logger.error('pvSalesUi', 'Błąd inicjalizacji UI Sprzedaży:', error);
            const listDiv = document.getElementById('pv-local-offers-list');
            if (listDiv)
                listDiv.innerHTML = `<div style="text-align:center; padding:2rem; color:var(--text-danger);">Błąd ładowania ofert: ${this.escapeHtml(error.message)}</div>`;
        }
    }

    attachEventListeners() {}

    async loadLocalOffers() {
        const listDiv = document.getElementById('pv-local-offers-list');
        if (!listDiv) {
            logger.warn(
                'pvSalesUi',
                'Element #pv-local-offers-list nie istnieje — pomijam loadLocalOffers'
            );
            return;
        }

        try {
            const data = await storageService.getOffers();
            this.allLocalOffers = data;
            this.isSyncUpToDate = this.allLocalOffers.length === 0 || (data && data.length > 0);
            this.filterLocalOffers();
        } catch (error) {
            logger.error('pvSalesUi', 'Błąd pobierania ofert:', error);
            listDiv.innerHTML = `<div style="text-align:center; padding: 2rem; color: var(--text-danger);">Błąd wczytywania ofert: ${this.escapeHtml(error.message)}</div>`;
        }
    }

    _startAutoRefresh() {
        this._stopAutoRefresh();
        this.autoRefreshInterval = setInterval(() => {
            if (!document.hidden) {
                this.loadLocalOffers();
            }
        }, 30000);
    }

    _stopAutoRefresh() {
        if (this.autoRefreshInterval) {
            clearInterval(this.autoRefreshInterval);
            this.autoRefreshInterval = null;
        }
    }

    filterLocalOffers() {
        const input = document.getElementById('pv-local-search-input');
        const listDiv = document.getElementById('pv-local-offers-list');
        if (!input || !listDiv || !this.allLocalOffers) return;

        const query = input.value.trim().toLowerCase();

        document.querySelectorAll('.pv-filter-btn').forEach((btn) => {
            if (btn.dataset.filter === this.currentFilter) btn.classList.add('active');
            else btn.classList.remove('active');
        });

        const filtered = this.allLocalOffers.filter((offer) => {
            if (this.currentTypeFilter !== 'all' && offer.type !== this.currentTypeFilter)
                return false;

            const num = (offer.number || offer.title || offer.offerName || '').toLowerCase();
            const client = (
                offer.clientName ||
                (offer.data && offer.data.clientName) ||
                ''
            ).toLowerCase();
            const nip = (
                offer.clientNip ||
                (offer.data && offer.data.clientNip) ||
                ''
            ).toLowerCase();
            const budowa = (
                offer.investName ||
                offer.budowa ||
                (offer.data && (offer.data.investName || offer.data.budowa)) ||
                ''
            ).toLowerCase();
            const userStr = (
                offer.userName ||
                offer.lastEditedBy ||
                (offer.data && offer.data.creatorName) ||
                ''
            ).toLowerCase();

            const offerOrders = this.ordersMap.get(this.normalizeId(offer.id));
            const matchesOrderNumber =
                offerOrders &&
                offerOrders.some((o) => {
                    const on = o?.orderNumber || o?.data?.orderNumber || '';
                    return on.toLowerCase().includes(query);
                });

            const matchesText =
                !query ||
                num.includes(query) ||
                client.includes(query) ||
                nip.includes(query) ||
                budowa.includes(query) ||
                userStr.includes(query) ||
                matchesOrderNumber;

            if (!matchesText) return false;

            if (this.currentFilter !== 'all') {
                const { hasOrder } = this.getOrderForOffer(offer);
                if (this.currentFilter === 'with_order' && !hasOrder) return false;
                if (this.currentFilter === 'without_order' && hasOrder) return false;
            }
            return true;
        });

        if (filtered.length === 0) {
            listDiv.innerHTML = `<div style="text-align:center; padding: 2rem; color: var(--text-muted); font-style: italic;">Brak ofert pasujących do wyszukiwania.</div>`;
            return;
        }

        listDiv.innerHTML = this.renderOffersList(filtered, true);
        this.attachActionListeners(listDiv);
    }

    setFilterLocalOffers(filterType) {
        this.currentFilter = filterType;

        document.querySelectorAll('.pv-filter-btn').forEach((btn) => {
            btn.classList.toggle('active', btn.dataset.filter === filterType);
            if (btn.dataset.filter === filterType) {
                btn.classList.remove('btn-secondary');
            } else {
                btn.classList.add('btn-secondary');
            }
        });

        this.loadLocalOffers();
    }

    setTypeFilter(typeFilter) {
        this.currentTypeFilter = typeFilter;
        this.loadLocalOffers();
    }

    async deleteOfferWithConfirmation(id) {
        if (
            !(await appConfirm('Czy na pewno chcesz usunąć tę ofertę?', {
                title: 'Usuwanie oferty',
                type: 'danger'
            }))
        )
            return;

        try {
            await storageService.deleteOffer(id);
            if (typeof window.showToast === 'function')
                window.showToast('Oferta została usunięta.', 'success');
            await this.loadLocalOffers();
        } catch (error) {
            logger.error('pvSalesUi', 'Błąd usuwania oferty:', error);
            if (typeof window.showToast === 'function')
                window.showToast('Błąd podczas usuwania oferty: ' + error.message, 'error');
        }
    }

    async copyOfferWithVersion(id) {
        try {
            const offer = await storageService.getOfferById(id);
            if (!offer) {
                if (typeof window.showToast === 'function')
                    window.showToast('Nie znaleziono oferty do skopiowania', 'error');
                return;
            }

            const newOffer = structuredClone(offer);

            delete newOffer.id;
            delete newOffer.createdAt;
            delete newOffer.updatedAt;
            delete newOffer.history;
            delete newOffer.hasOrder;
            delete newOffer.orderId;
            delete newOffer.orderNumber;

            newOffer.id = 'L_COPY_' + Date.now().toString(36);

            const oldNumber = newOffer.number || newOffer.offerNumber || '';
            let newNumber = oldNumber;

            const versionMatch = oldNumber.match(/\/v(\d+)$/i);
            if (versionMatch) {
                const currentVersion = parseInt(versionMatch[1], 10);
                const nextVersion = currentVersion + 1;
                newNumber = oldNumber.replace(/\/v\d+$/i, `/v${nextVersion}`);
            } else {
                newNumber = oldNumber + '/v2';
            }

            newOffer.number = newNumber;
            if (newOffer.data && newOffer.data.number) newOffer.data.number = newNumber;
            if (newOffer.data && newOffer.data.offerNumber) newOffer.data.offerNumber = newNumber;

            await storageService.saveOffer(newOffer);

            if (typeof window.showToast === 'function') {
                window.showToast(`Utworzono kopię: ${newNumber}`, 'success');
            }

            await this.loadLocalOffers();
            this.filterLocalOffers();
        } catch (error) {
            logger.error('pvSalesUi', 'Błąd podczas kopiowania oferty:', error);
            if (typeof window.showToast === 'function') {
                window.showToast('Błąd podczas kopiowania oferty.', 'error');
            }
        }
    }

    async changeOfferUserFromList(offerId) {
        if (this.role !== 'admin' && this.role !== 'pro') {
            if (typeof window.showToast === 'function')
                window.showToast('Brak uprawnień do zmiany opiekuna', 'error');
            return;
        }

        try {
            const offerWrapper = await storageService.getOfferById(offerId);
            if (!offerWrapper) throw new Error('Nie znaleziono oferty');

            const currentOffer = offerWrapper.data || offerWrapper;
            const currentUserId = currentOffer.userId || currentOffer.creatorId;

            const headers =
                typeof authHeaders === 'function'
                    ? authHeaders()
                    : { 'Content-Type': 'application/json' };
            const usersResp = await fetch('/api/users-for-assignment', { headers });
            const usersData = await usersResp.json();
            const allUsers = usersData.data || [];

            if (allUsers.length === 0) {
                if (typeof window.showToast === 'function')
                    window.showToast('Brak użytkowników do przypisania', 'info');
                return;
            }

            const selectedUser = await window.showUserSelectionPopup(allUsers, currentUserId);
            if (selectedUser) {
                currentOffer.userId = selectedUser.id;
                currentOffer.userName = selectedUser.displayName || selectedUser.username;
                currentOffer.lastEditedBy = selectedUser.displayName || selectedUser.username;
                currentOffer.id = offerId;
                currentOffer.type = offerWrapper.type || currentOffer.type;

                await storageService.saveOffer(currentOffer);

                const normalizedId = this.normalizeId(offerId);
                const linkedOrders = this.ordersMap ? this.ordersMap.get(normalizedId) : null;
                const linkedOrder = Array.isArray(linkedOrders) ? linkedOrders[0] : linkedOrders;
                if (linkedOrder && linkedOrder.id) {
                    const offerType = offerWrapper.type || currentOffer.type;
                    const orderEndpoint =
                        offerType === 'studnia_oferta'
                            ? `/api/orders-studnie/${linkedOrder.id}`
                            : `/api/orders-rury/${linkedOrder.id}`;
                    fetch(orderEndpoint, {
                        method: 'PATCH',
                        headers,
                        body: JSON.stringify({
                            userId: currentOffer.userId,
                            userName: currentOffer.userName
                        })
                    }).catch((e) =>
                        logger.error('pvSalesUi', 'Błąd aktualizacji opiekuna w zamówieniu:', e)
                    );
                }

                if (typeof window.showToast === 'function') {
                    window.showToast(`Opiekun zmieniony na: ${currentOffer.userName}`, 'success');
                }
                await this.loadLocalOffers();
            }
        } catch (error) {
            logger.error('pvSalesUi', 'Błąd zmiany opiekuna:', error);
            if (typeof window.showToast === 'function') {
                window.showToast('Błąd podczas zmiany opiekuna: ' + error.message, 'error');
            }
        }
    }
}

Object.assign(PVSalesUI.prototype, pvSalesAuditMixin);
Object.assign(PVSalesUI.prototype, pvSalesOrdersMixin);
Object.assign(PVSalesUI.prototype, pvSalesUiRenderMixin);

if (typeof registerCspAction === 'function') {
    registerCspAction('loadLocalOffers', function () {
        window.pvSalesUI.loadLocalOffers();
    });
    registerCspAction('filterByType', {
        handler: function (p) {
            filterByType(p.type);
        },
        params: ['type']
    });
    registerCspAction('toggleCompactMode', function () {
        toggleCompactMode();
    });
    registerCspAction('setFilterLocalOffers', {
        handler: function (p) {
            window.pvSalesUI.setFilterLocalOffers(p.filter);
        },
        params: ['filter']
    });
    registerCspAction('closeHistoryModal', function () {
        closeModal(document.getElementById('pv-history-modal'));
    });
    registerCspAction('changeOfferUser', {
        handler: function (p) {
            window.pvSalesUI.changeOfferUserFromList(p.offerId);
        },
        params: ['offerId']
    });
    registerCspAction('restoreOfferVersion', {
        handler: function (p) {
            window.restoreOfferVersion(p.id, p.versionType, p.doc);
        },
        params: ['id', 'versionType', 'doc']
    });
    registerCspAction('viewHistorySnapshot', {
        handler: function (p) {
            window.pvSalesUI.showOfferHistoryUnified(p.id, p.type, 'view');
        },
        params: ['id', 'type']
    });
    registerCspAction('loadMoreAuditLogs', {
        handler: function (p) {
            window.pvSalesUI.loadMoreAuditLogs(p.id, p.type);
        },
        params: ['id', 'type']
    });
    registerCspAction('filter-local-offers', function () {
        window.pvSalesUI.filterLocalOffers();
    });
}

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
});
