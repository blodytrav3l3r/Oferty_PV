// @ts-check
// Wersja 2.0 - Zarzadzanie zamowieniami w Kartotece
import { storageService } from '../shared/StorageService.js';
import { pvSalesAuditMixin } from './pvSalesAudit.js';
import { pvSalesOrdersMixin } from './pvSalesOrders.js';

/**
 * Inferuje, czy oferta jest rurą (vs studnią) na podstawie pola type
 * oraz fallbacków dla legacy danych.
 */
window.isRuryOfferFromTypeOrId = function isRuryOfferFromTypeOrId(offerType, offerId) {
    if (offerType === 'rura_oferta' || offerType === 'offer') return true;
    if (offerId && /^offer_rury_/.test(offerId)) return true;
    return false;
};

/**
 * Wspólna funkcja otwierająca uniwersalny modal wydruku
 */
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

/* CSP-safe: hover for btn-open-order */
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
                'Nie znaleziono elementu listy ofert (id: pv-local-offers-list)'
            );
            return;
        }

        logger.info('pvSalesUi', 'loadLocalOffers: Rozpoczęcie pobierania...');
        try {
            logger.info('pvSalesUi', 'loadLocalOffers: Pobieranie mapy zamówień...');
            await this.loadOrdersMap();

            logger.info('pvSalesUi', 'loadLocalOffers: Wywołanie storageService.getOffers()...');
            const docs = await storageService.getOffers();
            logger.info(
                'pvSalesUi',
                `[PVSalesUI] loadLocalOffers: Pobrano ${docs.length} dokumentów.`
            );

            if (docs.length === 0) {
                listDiv.innerHTML = `<div style="text-align:center; padding: 2rem; color: var(--text-muted); font-style: italic;">Nie masz jeszcze żadnych zapisanych ofert.</div>`;
                return;
            }

            this.allLocalOffers = docs;
            logger.info('pvSalesUi', 'loadLocalOffers: Filtrowanie i renderowanie...');
            this.filterLocalOffers();
            if (window.PvImportExportToolbar) window.PvImportExportToolbar.init('ie-toolbar-host');
            logger.info('pvSalesUi', 'loadLocalOffers: Gotowe.');
        } catch (error) {
            logger.error('pvSalesUi', 'Błąd pobierania ofert:', error);
            listDiv.innerHTML = `<div style="text-align:center; padding:2rem; color:var(--text-danger);">
                <strong>Błąd pobierania ofert:</strong><br/>
                <span style="font-size:0.85rem; opacity:0.8;">${this.escapeHtml(error.message || 'Wystąpił nieoczekiwany błąd sieciowy')}</span><br/>
                <button class="btn btn-sm btn-secondary" style="margin-top:1rem;" data-action="loadLocalOffers"><i data-lucide="refresh-cw" aria-hidden="true"></i> Odśwież</button>
            </div>`;
            setTimeout(() => {
                if (window.lucide) lucide.createIcons();
            }, 50);
        }
    }

    _startAutoRefresh() {
        this._stopAutoRefresh();
        this.autoRefreshInterval = setInterval(() => {
            if (!document.hidden) this.loadLocalOffers();
        }, 60000);
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

    renderOffersList(offers, isLocalList) {
        return offers
            .map((offer) => {
                const isAdminOrPro = this.role === 'admin' || this.role === 'pro';

                const { hasOrder, orders, order } = this.getOrderForOffer(offer);
                const orderList = orders && orders.length > 0 ? orders : [];
                const orderCount = orderList.length;

                let orderBadge = '';
                let orderItemsHtml = '';

                if (hasOrder) {
                    const hasModifiedOrder = orderList.some(
                        (ord) => this.getOrderChangeInfo(ord).changed
                    );

                    const badgeStateClass = hasModifiedOrder
                        ? 'btn-order-badge modified'
                        : 'btn-order-badge';
                    const countLabel = orderCount > 0 ? ` (${orderCount})` : '';

                    orderBadge = `<a href="javascript:void(0)" class="btn btn-sm ${badgeStateClass}" data-order-id="${this.escapeHtml(order.id || '')}" data-offer-id="${this.escapeHtml(offer.id)}" data-offer-type="${this.escapeHtml(offer.type)}" title="Kliknij aby zobaczyć listę zamówień powiązanych z tą ofertą${hasModifiedOrder ? ' (wykryto zmiany)' : ''}">
                    <i data-lucide="package" aria-hidden="true"></i> Zamówienia${countLabel}${hasModifiedOrder ? ' • zmiany' : ''}
                   </a>`;

                    orderItemsHtml = orderList
                        .map((ord) => {
                            const label = this.formatOrderLabel(ord);
                            const createdAt = ord.createdAt
                                ? new Date(ord.createdAt).toLocaleDateString('pl-PL')
                                : 'brak daty';
                            const orderValue = this.computeOrderValueWithTransport(ord, offer.type);
                            const changeInfo = this.getOrderChangeInfo(ord);
                            return `
                                <div class="offer-order-row">
                                    <button class="offer-order-main btn-edit-order" data-order-id="${this.escapeHtml(ord.id)}" data-offer-type="${this.escapeHtml(offer.type)}" title="Edytuj zamówienie ${label}">
                                        <span class="offer-order-icon"><i data-lucide="package-check"></i></span>
                                        <span class="offer-order-text">
                                            <strong>${label} <span style="color: var(--success-hover); font-weight: 600;">• ${orderValue.toFixed(2)} PLN</span></strong>
                                            <small>${createdAt}${changeInfo.changed ? ' • zmienione względem oferty' : ''}</small>
                                        </span>
                                    </button>
                                    <div class="offer-order-actions">
                                        <button class="action-btn success btn-karta-budowy" data-id="${this.escapeHtml(offer.id)}" data-type="${this.escapeHtml(offer.type)}" data-order-id="${this.escapeHtml(ord.id)}" data-offer-id="${this.escapeHtml(offer.id)}" data-offer-type="${this.escapeHtml(offer.type)}" title="Karta budowy ${label}" aria-label="Karta budowy ${label}"><i data-lucide="clipboard-list" aria-hidden="true"></i></button>
                                        <button class="action-btn secondary btn-history-order" data-order-id="${this.escapeHtml(ord.id)}" title="Historia zmian zamówienia ${label}" aria-label="Historia zmian zamówienia ${label}"><i data-lucide="clock" aria-hidden="true"></i></button>
                                        <button class="action-btn danger btn-delete-order" data-order-id="${this.escapeHtml(ord.id)}" data-offer-type="${this.escapeHtml(offer.type)}" title="Usuń zamówienie ${label}" aria-label="Usuń zamówienie ${label}"><i data-lucide="trash-2" aria-hidden="true"></i></button>
                                    </div>
                                </div>`;
                        })
                        .join('');
                } else {
                    orderBadge = `<span style="background:rgba(100,116,139,0.1); color:var(--text-secondary); padding:4px 10px; border-radius:6px;
                    border:1px solid rgba(100,116,139,0.2); font-size:0.75rem; font-weight:600; white-space:nowrap;">Brak zamówienia</span>`;
                }

                const dateStr = offer.createdAt
                    ? new Date(offer.createdAt).toLocaleDateString('pl-PL')
                    : '—';

                const isWell = offer.type === 'studnia_oferta';
                let priceVal = 0;

                if (isWell && (offer.wellsExport || (offer.data && offer.data.wellsExport))) {
                    const exportData = offer.wellsExport || offer.data.wellsExport;
                    priceVal = exportData.reduce((sum, w) => sum + (w.totalPrice || 0), 0);
                } else {
                    priceVal = offer.totalNetto || offer.totalBrutto || 0;
                    if (!priceVal && offer.data) {
                        if (offer.data.summary)
                            priceVal =
                                offer.data.summary.totalValue ||
                                offer.data.summary.totalNetto ||
                                offer.data.summary.totalBrutto ||
                                0;
                        else if (offer.data.costSummary)
                            priceVal = offer.data.costSummary.totalValue || 0;
                        else priceVal = offer.data.totalNetto || offer.data.totalBrutto || 0;
                    }
                    if (!priceVal && offer.price) priceVal = offer.price;
                }
                const icon = isWell
                    ? '<i data-lucide="cylinder"></i>'
                    : '<i data-lucide="cylinder" class="lucide-rotate-n90"></i>';

                let itemCount = 0;
                if (isWell) {
                    itemCount = offer.wells
                        ? offer.wells.length
                        : offer.data && offer.data.wells
                          ? offer.data.wells.length
                          : 0;
                } else {
                    itemCount = offer.items
                        ? offer.items.length
                        : offer.data && offer.data.items
                          ? offer.data.items.length
                          : 0;
                }

                const clientInfo =
                    offer.clientName || (offer.data && offer.data.clientName) || 'Brak danych';
                const investInfo =
                    offer.investName ||
                    offer.budowa ||
                    (offer.data && (offer.data.investName || offer.data.budowa));
                const rawUserName =
                    offer.userName ||
                    (offer.data && offer.data.userName) ||
                    (offer.data && offer.data.creatorName) ||
                    offer.lastEditedBy ||
                    '';
                const rawCreatorName =
                    offer.createdByUserName ||
                    (offer.data && offer.data.createdByUserName) ||
                    rawUserName;

                const resolveUser = (raw) => {
                    if (!raw) return '';
                    if (window.globalUsersMap && window.globalUsersMap.has(raw))
                        return window.globalUsersMap.get(raw);
                    if (
                        window.currentUser &&
                        (raw === window.currentUser.username || raw === window.currentUser.id)
                    )
                        return window.currentUser.displayName || window.currentUser.username || raw;
                    return raw;
                };

                const userName = resolveUser(rawUserName);
                const creatorName = resolveUser(rawCreatorName);
                const isClickable = this.role === 'admin' || this.role === 'pro';

                const safeOfferNumber = this.escapeHtml(
                    offer.number || offer.title || offer.offerName || 'Oferta bez numeru'
                );
                const safeClientInfo = this.escapeHtml(clientInfo);
                const safeInvestInfo = investInfo ? this.escapeHtml(investInfo) : '';
                const safeCreatorName = creatorName ? this.escapeHtml(creatorName) : '';
                const safeUserName = userName ? this.escapeHtml(userName) : '';
                const safeOfferId = this.escapeHtml(offer.id);
                const safeOfferType = this.escapeHtml(offer.type);
                const safeClientPhone = offer.clientPhone ? this.escapeHtml(offer.clientPhone) : '';
                const safeOrderId = hasOrder && order ? this.escapeHtml(order.id) : '';

                return `
                <div class="modern-offer-card" data-offer-id="${safeOfferId}">
                    <div class="offer-status-indicator ${hasOrder ? 'has-order' : 'no-order'}"></div>
                    <div class="offer-card-content">
                        <div class="offer-top-row">
                            <div class="offer-icon-wrapper">
                                ${icon}
                            </div>
                            <div class="offer-title-section">
                                <h3 class="offer-title">${safeOfferNumber}</h3>
                                <div class="offer-subtitle">
                                    <span class="offer-client">${safeClientInfo}</span>
                                    ${safeInvestInfo ? `<span class="offer-separator">•</span><span class="offer-invest">${safeInvestInfo}</span>` : ''}
                                    ${safeCreatorName ? `<span class="offer-separator">•</span><span class="author-badge"><i data-lucide="pen-tool" aria-hidden="true"></i> ${safeCreatorName}</span>` : ''}
                                    ${safeUserName ? `<span class="offer-separator">•</span><span class="author-badge${isClickable ? ' clickable-user' : ''}" ${isClickable ? `data-action="changeOfferUser" data-offer-id="${safeOfferId}"` : ''}><i data-lucide="briefcase" aria-hidden="true"></i> ${safeUserName}</span>` : ''}
                                </div>
                            </div>
                            <div class="offer-price-section">
                                <div class="offer-price">${typeof formatCurrency === 'function' ? formatCurrency(priceVal) : priceVal.toFixed(2) + ' PLN'}</div>
                                <div class="offer-meta">${dateStr} • ${itemCount} ${isWell ? 'studni' : 'poz.'}</div>
                            </div>
                        </div>

                        ${hasOrder ? `<div class="offer-orders-panel">${orderItemsHtml}</div>` : ''}

                        <div class="offer-actions-row">
                            <div class="order-status-badge">
                                ${orderBadge}
                            </div>
                            <div class="action-buttons">
                                ${
                                    isLocalList
                                        ? `
                                        <button class="action-btn primary text-btn" data-id="${safeOfferId}" data-type="${safeOfferType}" title="Edytuj ofertę">
                                            <i data-lucide="pencil" aria-hidden="true"></i> Edytuj
                                        </button>
                                        <button class="action-btn secondary text-btn" data-id="${safeOfferId}" title="Skopiuj ofertę">
                                            <i data-lucide="copy" aria-hidden="true"></i> Skopiuj ofertę
                                        </button>
                                        <button class="action-btn secondary" data-id="${safeOfferId}" data-type="${safeOfferType}" title="Historia zmian" aria-label="Historia zmian">
                                            <i data-lucide="clock" aria-hidden="true"></i>
                                        </button>
                                        <button class="action-btn secondary" data-id="${safeOfferId}" data-type="${safeOfferType}" data-offer-id="${safeOfferId}" data-offer-type="${safeOfferType}" data-order-id="${safeOrderId}" title="Wydruk" aria-label="Wydruk">
                                            <i data-lucide="printer" aria-hidden="true"></i>
                                        </button>
                                        ${
                                            safeClientPhone
                                                ? `<a href="tel:${safeClientPhone}" class="action-btn phone" title="Zadzwoń" aria-label="Zadzwoń"><i data-lucide="phone" aria-hidden="true"></i></a>`
                                                : ''
                                        }
                                        <button class="action-btn danger" data-id="${safeOfferId}" title="${hasOrder ? 'Nie można usunąć' : 'Usuń'}" aria-label="${hasOrder ? 'Nie można usunąć' : 'Usuń'}" ${hasOrder ? 'disabled' : ''}>
                                            <i data-lucide="trash-2" aria-hidden="true"></i>
                                        </button>
                                        `
                                        : `
                                        <button class="action-btn primary" data-id="${safeOfferId}" title="Szczegóły" aria-label="Szczegóły">
                                            <i data-lucide="eye" aria-hidden="true"></i>
                                        </button>
                                        `
                                }
                            </div>
                        </div>
                    </div>
                </div>
            `;
            })
            .join('');
    }

    attachActionListeners(container) {
        if (container._pvActionListenersAttached) return;
        container._pvActionListenersAttached = true;

        const isKartoteka = (window.location.pathname.split('/').pop() || '').startsWith(
            'kartoteka'
        );

        container.addEventListener('click', async (e) => {
            const btn = e.target.closest(
                '.action-btn, .btn-order-badge, .btn-edit-order, .btn-change-owner, ' +
                    '.btn-edit-pv-offer, .btn-copy-pv-offer, .btn-history-pv-offer, ' +
                    '.btn-export-pv-offer, .btn-delete-pv-offer, .btn-delete-order, ' +
                    '.btn-history-order, .btn-karta-budowy'
            );
            if (!btn) return;

            const title = (btn.title || '').toLowerCase();

            if (btn.tagName === 'A' && btn.getAttribute('href')?.startsWith('tel:')) return;

            if (btn.classList.contains('btn-order-badge')) {
                e.preventDefault();
                const badgeOfferId = btn.getAttribute('data-offer-id');
                if (badgeOfferId) this.showOfferOrdersPopup(badgeOfferId);
                return;
            }

            if (btn.classList.contains('btn-edit-order')) {
                e.preventDefault();
                const editOrderId = btn.getAttribute('data-order-id');
                const editOfferType = btn.getAttribute('data-offer-type');
                if (!editOrderId) return;
                try {
                    if (window.parent?.SpaRouter) {
                        window.parent.SpaRouter.openOfferInModule(
                            editOfferType,
                            editOrderId,
                            'order'
                        );
                    } else if (window.SpaRouter) {
                        window.SpaRouter.openOfferInModule(editOfferType, editOrderId, 'order');
                    } else {
                        window.location.href = `app.html#/${editOfferType === 'studnia_oferta' ? 'studnie' : 'rury'}?order=${editOrderId}`;
                    }
                } catch (err) {
                    logger.error('pvSalesUi', 'Błąd nawigacji do zamówienia:', err);
                    window.location.href = `app.html#/${editOfferType === 'studnia_oferta' ? 'studnie' : 'rury'}?order=${editOrderId}`;
                }
                return;
            }

            if (btn.classList.contains('btn-change-owner')) {
                this.changeOfferUserFromList(btn.getAttribute('data-id'));
                return;
            }

            const id = btn.getAttribute('data-id');
            const typeAttr = btn.getAttribute('data-type');
            const orderId = btn.getAttribute('data-order-id');
            const offerType = btn.getAttribute('data-offer-type');

            if (
                title.includes('edytuj') ||
                title.includes('szczegóły') ||
                title.includes('szczegoly')
            ) {
                if (isKartoteka) {
                    try {
                        window.parent.SpaRouter.openOfferInModule(typeAttr, id, 'edit');
                    } catch (err) {
                        const target = typeAttr === 'studnia_oferta' ? 'studnie.html' : 'rury.html';
                        window.location.href = `${target}?edit=${id}`;
                    }
                    return;
                }
                const currentPage = window.location.pathname.split('/').pop() || 'index.html';
                if (typeAttr === 'studnia_oferta' && currentPage !== 'studnie.html') {
                    window.location.href = `studnie.html?edit=${id}`;
                    return;
                } else if (typeAttr === 'offer' && currentPage !== 'rury.html') {
                    window.location.href = `rury.html?edit=${id}`;
                    return;
                }
                try {
                    const doc = await storageService.getOfferById(id);
                    this.openOfferForEdit(doc, id, typeAttr);
                } catch (err) {
                    logger.error('pvSalesUi', 'Błąd pobierania do edycji:', err);
                }
                return;
            }

            if (title.includes('kopiuj') || title.includes('skopiuj')) {
                await this.copyOfferWithVersion(id);
                return;
            }

            if (title.includes('historia zmian') && !title.includes('zamówienia')) {
                this.showOfferHistoryUnified(String(id), typeAttr || 'studnia_oferta');
                return;
            }

            if (
                title.includes('wydruk') ||
                title.includes('drukuj') ||
                title.includes('karta budowy')
            ) {
                const printOfferId = btn.getAttribute('data-offer-id') || id;
                const printOrderId = btn.getAttribute('data-order-id') || orderId || '';
                const printOfferType = btn.getAttribute('data-offer-type') || typeAttr;
                const printRelatedOrders =
                    this.ordersMap && printOfferId
                        ? [...(this.ordersMap.get(this.normalizeId(printOfferId)) || [])]
                        : null;
                window.openPrintModal(
                    printOfferId,
                    printOrderId,
                    printOfferType,
                    printRelatedOrders
                );
                return;
            }

            if (title.includes('usuń zam') || title.includes('usun zam')) {
                await this.deleteOrderUnified(orderId, offerType);
                return;
            }

            if (title.includes('hist. zam') || title.includes('historia zmian zamówienia')) {
                this.showOfferHistoryUnified(String(orderId), 'order');
                return;
            }

            if (title.includes('usuń') || title.includes('usun')) {
                if (!btn.disabled) {
                    await this.deleteOfferWithConfirmation(id);
                }
                return;
            }
        });
    }

    async deleteOfferWithConfirmation(id) {
        if (
            !(await appConfirm(
                'UWAGA!\nCzy na pewno chcesz USUNĄĆ tę ofertę?\n\nOferta zostanie trwale usunięta z Twojej bazy lokalnej ORAZ z serwera głównego (po synchronizacji).',
                { title: 'Usuwanie oferty', type: 'danger', okText: 'Usuń trwale' }
            ))
        ) {
            return;
        }

        try {
            await storageService.deleteOffer(id);
            if (typeof window.showToast === 'function') {
                window.showToast('Oferta została usunięta.', 'success');
            }
            this.loadLocalOffers();
        } catch (error) {
            logger.error('pvSalesUi', 'Błąd podczas usuwania:', error);
            if (typeof window.showToast === 'function') {
                window.showToast('Błąd podczas usuwania oferty.', 'error');
            }
        }
    }

    openOfferForEdit(doc, id, type) {
        const isKartoteka = (window.location.pathname.split('/').pop() || '').startsWith(
            'kartoteka'
        );
        if (isKartoteka) {
            if (typeof window.showToast === 'function') {
                window.showToast(
                    'Aby skorzystać z podglądu graficznego, przejdź do modułu używając przycisku "Edytuj", a następnie tam otwórz panel Historii.',
                    'warning'
                );
            }
            return;
        }

        document.querySelectorAll('.nav-btn').forEach((b) => b.classList.remove('active'));
        document.querySelectorAll('.section').forEach((s) => s.classList.remove('active'));

        const targetBtnId = type === 'studnia_oferta' ? 'nav-builder' : 'nav-offer';
        const targetSectionId = type === 'studnia_oferta' ? 'section-builder' : 'section-offer';

        const homeBtn = document.getElementById(targetBtnId);
        const homeSection = document.getElementById(targetSectionId);

        if (homeBtn && homeSection) {
            homeBtn.classList.add('active');
            homeSection.classList.add('active');

            if (type === 'offer' && typeof window.loadSavedOfferData === 'function') {
                window.loadSavedOfferData(doc, id);
                if (typeof window.showToast === 'function')
                    window.showToast('Wczytano wersję historyczną do testowego podglądu', 'info');
                if (typeof window.applyPreviewLockUI === 'function') window.applyPreviewLockUI();
            } else if (
                type === 'studnia_oferta' &&
                typeof window.loadSavedOfferStudnie === 'function'
            ) {
                window.loadSavedOfferStudnie(doc, id);
                if (typeof window.showToast === 'function')
                    window.showToast('Wczytano wersję historyczną do testowego podglądu', 'info');
                if (typeof window.applyPreviewLockUI === 'function') window.applyPreviewLockUI();
            } else if (type === 'order' && typeof window.loadOrderSnapshot === 'function') {
                window.loadOrderSnapshot(doc, id);
                if (typeof window.showToast === 'function')
                    window.showToast(
                        'Wczytano archiwalną wersję ZAMÓWIENIA w trybie READ-ONLY',
                        'info'
                    );
            }
        } else {
            if (typeof window.showToast === 'function')
                window.showToast('Błąd: Nie można wczytać edytora na tym ekranie.', 'error');
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
            if (window.pvSalesUI) window.pvSalesUI.setFilterLocalOffers(p.filter);
        },
        params: ['filter']
    });
    registerCspAction('closeHistoryModal', function () {
        var el = document.getElementById('offer-history-modal');
        if (el) el.remove();
    });
    registerCspAction('changeOfferUser', {
        handler: function ({ offerId }) {
            window.pvSalesUI.changeOfferUserFromList(offerId);
        },
        params: ['offerId']
    });
    registerCspAction('restoreOfferVersion', {
        handler: function ({ entityId, logId, entityType }) {
            window.pvSalesUI.restoreOfferVersionUnified(entityId, logId, entityType);
        },
        params: ['entityId', 'logId', 'entityType']
    });
    registerCspAction('viewHistorySnapshot', {
        handler: function ({ entityId, logId, entityType }) {
            window.pvSalesUI.viewHistorySnapshotUnified(entityId, logId, entityType);
        },
        params: ['entityId', 'logId', 'entityType']
    });
    registerCspAction('loadMoreAuditLogs', {
        handler: function ({ entityType, entityId, limit }) {
            window.pvSalesUI.loadMoreAuditLogs(entityType, entityId, parseInt(limit, 10) || 20);
        },
        params: ['entityType', 'entityId', 'limit']
    });
    registerCspAction('filter-local-offers', function () {
        if (window.pvSalesUI && window.pvSalesUI.filterLocalOffers) {
            window.pvSalesUI.filterLocalOffers();
        }
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
