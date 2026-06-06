// Wersja 2.0 - Zarzadzanie zamowieniami w Kartotece
import { storageService } from '../shared/StorageService.js';

class PVSalesUI {
    constructor() {
        this.syncManager = null;
        this.allLocalOffers = []; // Przechowalnia do filtrowania
        this.isSyncUpToDate = true;
        this.ordersMap = new Map(); // offerId -> order
        this.currentFilter = 'all'; // 'all', 'with_order', 'without_order'
        this.currentTypeFilter = 'all'; // 'all', 'offer', 'studnia_oferta'
        this.autoRefreshInterval = null;

        this.init();
    }

    /** Pomocnik do normalizacji ID */
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

    formatOrderLabel(order) {
        return this.escapeHtml(
            order?.orderNumber || order?.offerNumber || (order?.id ? String(order.id).substring(0, 8) : 'Zamówienie')
        );
    }

    getOrderChangeInfo(order) {
        const currentPrice = Number(order?.totalNetto || order?.totalTotalNetto || 0);
        const originalPrice = Number(
            order?.originalTotalTotalNetto || order?.originalTotalNetto || currentPrice
        );
        const changed = Math.abs(currentPrice - originalPrice) > 0.01;
        return { changed, currentPrice, originalPrice };
    }

    findOrderById(orderId) {
        const needle = this.normalizeId(orderId);
        for (const [offerId, orders] of this.ordersMap.entries()) {
            const order = (orders || []).find((item) => this.normalizeId(item.id) === needle);
            if (order) return { offerId, order };
        }
        return { offerId: '', order: null };
    }

    async init() {
        if (this.initialized) return;

        try {
            const userStr = sessionStorage.getItem('user');
            if (!userStr) {
                console.log(
                    '[PVSalesUI] Czekam na dane użytkownika w sessionStorage (ponowienie za 500ms)...'
                );
                setTimeout(() => this.init(), 500);
                return;
            }

            const user = JSON.parse(userStr);
            this.role = user.role || 'user';
            console.log('[PVSalesUI] Inicjalizacja dla użytkownika:', user.username);

            // Inicjalizacja StorageService
            await storageService.init();

            this.attachEventListeners();
            await this.loadOrdersMap();
            if (typeof fetchGlobalUsers === 'function') await fetchGlobalUsers();
            await this.loadLocalOffers();

            this._startAutoRefresh();

            this.initialized = true;
        } catch (error) {
            console.error('[PVSalesUI] Błąd inicjalizacji UI Sprzedaży:', error);
            const listDiv = document.getElementById('pv-local-offers-list');
            if (listDiv)
                listDiv.innerHTML = `<div style="text-align:center; padding:2rem; color:var(--text-danger);">Błąd ładowania ofert: ${this.escapeHtml(error.message)}</div>`;
        }
    }

    attachEventListeners() {
        // Zdarzenia do ogólnych akcji (wyszukiwanie lokalne ma oninput w HTML)
    }

    async loadOrdersMap() {
        try {
            const headers =
                typeof authHeaders === 'function'
                    ? authHeaders()
                    : { 'Content-Type': 'application/json' };
            const timestamp = Date.now();

            this.ordersMap.clear();
            let totalOrders = 0;

            // Studnie
            const studnieResp = await fetch(`/api/orders-studnie?t=${timestamp}`, { headers });
            if (studnieResp.ok) {
                const json = await studnieResp.json();
                (json.data || []).forEach((order) => {
                    const offId = order.offerId || order.offerStudnieId || order.offer_id;
                    if (!offId) return;
                    const key = this.normalizeId(offId);
                    const list = this.ordersMap.get(key) || [];
                    list.push(order);
                    this.ordersMap.set(key, list);
                    totalOrders++;
                });
            }

            // Rury
            const ruryResp = await fetch(`/api/orders-rury?t=${timestamp}`, { headers });
            if (ruryResp.ok) {
                const json = await ruryResp.json();
                (json.data || []).forEach((order) => {
                    const offId = order.offerId;
                    if (!offId) return;
                    const key = this.normalizeId(offId);
                    const list = this.ordersMap.get(key) || [];
                    list.push(order);
                    this.ordersMap.set(key, list);
                    totalOrders++;
                });
            }

            console.log(`[PVSalesUI] Załadowano ${totalOrders} zamówień (studnie+rury) powiązanych z ${this.ordersMap.size} ofertami.`);
        } catch (error) {
            console.warn('[PVSalesUI] Nie udało się pobrać zamówień:', error.message);
        }
    }

    /**
     * Sprawdza czy oferta ma zamówienie — najpierw z mapy API, potem z pól oferty.
     * @returns {{ hasOrder: boolean, order: Object|null }}
     */
    getOrderForOffer(offer) {
        const offerId = this.normalizeId(offer.id);
        const orders = offerId && this.ordersMap.has(offerId) ? [...this.ordersMap.get(offerId)] : [];

        if (orders.length > 0) {
            return { hasOrder: true, orders, order: orders[0] };
        }

        if (offer.hasOrder && offer.orderId) {
            const fallbackOrder = { id: offer.orderId, orderNumber: offer.orderNumber || '' };
            return { hasOrder: true, orders: [fallbackOrder], order: fallbackOrder };
        }

        return { hasOrder: false, orders: [], order: null };
    }

    async loadLocalOffers() {
        const listDiv = document.getElementById('pv-local-offers-list');
        if (!listDiv) {
            console.warn('[PVSalesUI] Nie znaleziono elementu listy ofert (id: pv-local-offers-list)');
            return;
        }

        console.log('[PVSalesUI] loadLocalOffers: Rozpoczęcie pobierania...');
        try {
            // Zawsze najpierw pobierzmy najświeższą mapę zamówień (omijanie cache'u)
            console.log('[PVSalesUI] loadLocalOffers: Pobieranie mapy zamówień...');
            await this.loadOrdersMap();

            // Pobieramy oferty przez StorageService
            console.log('[PVSalesUI] loadLocalOffers: Wywołanie storageService.getOffers()...');
            const docs = await storageService.getOffers();
            console.log(`[PVSalesUI] loadLocalOffers: Pobrano ${docs.length} dokumentów.`);

            if (docs.length === 0) {
                listDiv.innerHTML = `<div style="text-align:center; padding: 2rem; color: var(--text-muted); font-style: italic;">Nie masz jeszcze żadnych zapisanych ofert.</div>`;
                return;
            }

            this.allLocalOffers = docs;
            console.log('[PVSalesUI] loadLocalOffers: Filtrowanie i renderowanie...');
            this.filterLocalOffers(); // Używa zintegrowanej logiki filtrowania z uwzględnieniem wyszukiwarki i filtrów statusu
            console.log('[PVSalesUI] loadLocalOffers: Gotowe.');
        } catch (error) {
            console.error('[PVSalesUI] Błąd pobierania ofert:', error);
            listDiv.innerHTML = `<div style="text-align:center; padding:2rem; color:var(--text-danger);">
                <strong>Błąd pobierania ofert:</strong><br/>
                <span style="font-size:0.85rem; opacity:0.8;">${this.escapeHtml(error.message || 'Wystąpił nieoczekiwany błąd sieciowy')}</span><br/>
                <button class="btn btn-sm btn-secondary" style="margin-top:1rem;" onclick="window.pvSalesUI.loadLocalOffers()"><i data-lucide="refresh-cw" aria-hidden="true"></i> Odśwież</button>
            </div>`;
            setTimeout(() => { if (window.lucide) lucide.createIcons(); }, 50);
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

        // Aktualizacja UI przycisku filtra statusu
        document.querySelectorAll('.pv-filter-btn').forEach((btn) => {
            if (btn.dataset.filter === this.currentFilter) btn.classList.add('active');
            else btn.classList.remove('active');
        });

        const filtered = this.allLocalOffers.filter((offer) => {
            // Filtr typu (poziom kartoteki)
            if (this.currentTypeFilter !== 'all' && offer.type !== this.currentTypeFilter)
                return false;

            // Wyszukiwanie tekstowe
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

            const matchesText =
                !query ||
                num.includes(query) ||
                client.includes(query) ||
                nip.includes(query) ||
                budowa.includes(query) ||
                userStr.includes(query);

            // Filtr statusu
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

        // Aktualizacja UI przycisku filtru
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

                // Sprawdź czy oferta ma zamówienie
                const { hasOrder, orders, order } = this.getOrderForOffer(offer);
                const orderList = orders && orders.length > 0 ? orders : [];
                const orderCount = orderList.length;

                let orderBadge = '';
                let orderItemsHtml = '';

                if (hasOrder) {
                    const hasModifiedOrder = orderList.some((ord) => this.getOrderChangeInfo(ord).changed);
                    
                    const badgeStateClass = hasModifiedOrder ? 'btn-order-badge modified' : 'btn-order-badge';
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
                            const changeInfo = this.getOrderChangeInfo(ord);
                            return `
                                <div class="offer-order-row">
                                    <button class="offer-order-main btn-edit-order" data-order-id="${this.escapeHtml(ord.id)}" data-offer-type="${this.escapeHtml(offer.type)}" title="Edytuj zamówienie ${label}">
                                        <span class="offer-order-icon"><i data-lucide="package-check"></i></span>
                                        <span class="offer-order-text">
                                            <strong>${label}</strong>
                                            <small>${createdAt}${changeInfo.changed ? ' • zmienione względem oferty' : ''}</small>
                                        </span>
                                    </button>
                                    <div class="offer-order-actions">
                                        ${changeInfo.changed ? '<span class="offer-change-chip"><i data-lucide="activity" aria-hidden="true"></i> zmiany</span>' : ''}
                                        <button class="action-btn success btn-karta-budowy" data-order-id="${this.escapeHtml(ord.id)}" data-offer-id="${this.escapeHtml(offer.id)}" data-offer-type="${this.escapeHtml(offer.type)}" title="Karta budowy ${label}" aria-label="Karta budowy ${label}"><i data-lucide="clipboard-list" aria-hidden="true"></i></button>
                                        <button class="action-btn secondary btn-history-order" data-order-id="${this.escapeHtml(ord.id)}" title="Historia zmian zamówienia ${label}" aria-label="Historia zmian zamówienia ${label}"><i data-lucide="clock" aria-hidden="true"></i></button>
                                        <button class="action-btn danger btn-delete-order" data-order-id="${this.escapeHtml(ord.id)}" data-offer-type="${this.escapeHtml(offer.type)}" title="Usuń zamówienie ${label}" aria-label="Usuń zamówienie ${label}"><i data-lucide="trash-2" aria-hidden="true"></i></button>
                                    </div>
                                </div>`;
                        })
                        .join('');
                } else {
                    orderBadge = `<span style="background:rgba(100,116,139,0.1); color:#94a3b8; padding:4px 10px; border-radius:6px;
                    border:1px solid rgba(100,116,139,0.2); font-size:0.75rem; font-weight:600; white-space:nowrap;">Brak zamówienia</span>`;
                }

                const dateStr = offer.createdAt
                    ? new Date(offer.createdAt).toLocaleDateString('pl-PL')
                    : '—';

                const isWell = offer.type === 'studnia_oferta';
                let priceVal = 0;

                // Dla studni wolimy obliczyć sumę z wellsExport, bo tam jest już transport per studnia
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
                const icon = isWell ? '<i data-lucide="cylinder"></i>' : '<i data-lucide="cylinder" class="lucide-rotate-n90"></i>';

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
                    offer.lastEditedBy ||
                    (offer.data && offer.data.creatorName) ||
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

                return `
                <div class="modern-offer-card" data-offer-id="${offer.id}">
                    <!-- Status Indicator -->
                    <div class="offer-status-indicator ${hasOrder ? 'has-order' : 'no-order'}"></div>

                    <!-- Card Content -->
                    <div class="offer-card-content">
                        <!-- Top Row: Icon + Title + Price -->
                        <div class="offer-top-row">
                            <div class="offer-icon-wrapper">
                                ${icon}
                            </div>
                            <div class="offer-title-section">
                                <h3 class="offer-title">${offer.number || offer.title || offer.offerName || 'Oferta bez numeru'}</h3>
                                <div class="offer-subtitle">
                                    <span class="offer-client">${clientInfo}</span>
                                    ${investInfo ? `<span class="offer-separator">•</span><span class="offer-invest">${investInfo}</span>` : ''}
                                    ${(() => {
                                        let html = '';
                                        const isClickable = this.role === 'admin' || this.role === 'pro';
                                        if (creatorName === userName && creatorName) {
                                            html = `<span class="offer-separator">•</span><span class="author-badge${isClickable ? ' clickable-user' : ''}" ${isClickable ? `onclick="event.stopPropagation(); window.pvSalesUI.changeOfferUserFromList('${offer.id}')"` : ''}><i data-lucide="user" aria-hidden="true"></i> ${creatorName}</span>`;
                                        } else {
                                            if (creatorName) html += `<span class="offer-separator">•</span><span class="author-badge"><i data-lucide="pen-tool" aria-hidden="true"></i> ${creatorName}</span>`;
                                            if (userName) html += `<span class="offer-separator">•</span><span class="author-badge${isClickable ? ' clickable-user' : ''}" ${isClickable ? `onclick="event.stopPropagation(); window.pvSalesUI.changeOfferUserFromList('${offer.id}')"` : ''}><i data-lucide="briefcase" aria-hidden="true"></i> ${userName}</span>`;
                                        }
                                        return html;
                                    })()}
                                </div>
                            </div>
                            <div class="offer-price-section">
                                <div class="offer-price">${typeof formatCurrency === 'function' ? formatCurrency(priceVal) : priceVal.toFixed(2) + ' PLN'}</div>
                                <div class="offer-meta">${dateStr} • ${itemCount} ${isWell ? 'studni' : 'poz.'}</div>
                            </div>
                        </div>

                        ${hasOrder ? `<div class="offer-orders-panel">${orderItemsHtml}</div>` : ''}

                        <!-- Bottom Row: Actions -->
                        <div class="offer-actions-row">
                            <!-- Order Status -->
                            <div class="order-status-badge">
                                ${orderBadge}
                            </div>

                            <!-- Action Buttons -->
                            <div class="action-buttons">
                                ${
                                    isLocalList
                                        ? `
                                        <button class="action-btn primary text-btn" data-id="${offer.id}" data-type="${offer.type}" title="Edytuj ofertę">
                                            <i data-lucide="pencil" aria-hidden="true"></i> Edytuj
                                        </button>
                                        <button class="action-btn secondary text-btn" data-id="${offer.id}" title="Skopiuj ofertę">
                                            <i data-lucide="copy" aria-hidden="true"></i> Skopiuj ofertę
                                        </button>
                                        <button class="action-btn secondary" data-id="${offer.id}" data-type="${offer.type}" title="Historia zmian" aria-label="Historia zmian">
                                            <i data-lucide="clock" aria-hidden="true"></i>
                                        </button>
                                        <button class="action-btn secondary" data-id="${offer.id}" data-type="${offer.type}" data-order-id="${hasOrder ? order.id : ''}" title="Wydruk" aria-label="Wydruk">
                                            <i data-lucide="printer" aria-hidden="true"></i>
                                        </button>
                                        ${
                                            offer.clientPhone
                                                ? `<a href="tel:${offer.clientPhone}" class="action-btn phone" title="Zadzwoń" aria-label="Zadzwoń"><i data-lucide="phone" aria-hidden="true"></i></a>`
                                                : ''
                                        }
                                        <button class="action-btn danger" data-id="${offer.id}" title="${hasOrder ? 'Nie można usunąć' : 'Usuń'}" aria-label="${hasOrder ? 'Nie można usunąć' : 'Usuń'}" ${hasOrder ? 'disabled' : ''}>
                                            <i data-lucide="trash-2" aria-hidden="true"></i>
                                        </button>
                                        `
                                        : `
                                        <button class="action-btn primary" data-id="${offer.id}" title="Szczegóły" aria-label="Szczegóły">
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

    showOfferOrdersPopup(offerId) {
        const offerKey = this.normalizeId(offerId);
        const offer = this.allLocalOffers.find((o) => this.normalizeId(o.id) === offerKey);
        const orders = offerKey && this.ordersMap.has(offerKey) ? [...this.ordersMap.get(offerKey)] : [];

        if (!orders || orders.length === 0) {
            showToast('Brak zamówień powiązanych z tą ofertą.', 'info');
            return;
        }

        const offerLabel = offer && (offer.number || offer.title || offer.offerName) ?
            (offer.number || offer.title || offer.offerName) : 'Oferta';

        let html = `
            <div class="modal-header">
                <h3 id="offer-orders-title">Zamówienia oferty ${offerLabel}</h3>
                <button class="btn-icon btn-close-x" aria-label="Zamknij" onclick="closeModal()"><i data-lucide="x" aria-hidden="true"></i></button>
            </div>
            <div style="margin-bottom:1rem; color:var(--text-muted); font-size:0.9rem;">Lista wszystkich zamówień przypisanych do tej oferty.</div>
            <div style="display:flex; flex-direction:column; gap:0.75rem; max-height:55vh; overflow-y:auto; padding-right:0.25rem;">
        `;

        orders.forEach((ord) => {
            const createdAt = ord.createdAt ? new Date(ord.createdAt).toLocaleDateString('pl-PL') : 'brak daty';
            const orderLabel = this.formatOrderLabel(ord);

            html += `
                <div style="display:flex; align-items:center; justify-content:space-between; gap:0.75rem; padding:0.85rem 0.8rem; border:1px solid rgba(148,163,184,0.15); border-radius:10px; background:rgba(15,23,42,0.855); box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);">
                    <div style="min-width:0;">
                        <div class="btn-open-order" data-order-id="${this.escapeHtml(ord.id)}" data-offer-type="${this.escapeHtml(offer?.type || 'studnia_oferta')}" style="font-weight:700; color:#38bdf8; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; max-width:260px; cursor:pointer; transition:all 0.2s ease;" title="Kliknij, aby otworzyć zamówienie w trybie edycji" onmouseenter="this.style.color='#7dd3fc'; this.style.textDecoration='underline';" onmouseleave="this.style.color='#38bdf8'; this.style.textDecoration='none';">${orderLabel}</div>
                        <div style="font-size:0.78rem; color:var(--text-muted); margin-top:0.25rem;">Utworzono: ${createdAt}</div>
                    </div>
                    <div style="display:flex; gap:0.4rem; flex-wrap:wrap; justify-content:flex-end;">
                        <button class="btn btn-sm btn-primary btn-open-order" data-order-id="${this.escapeHtml(ord.id)}" data-offer-type="${this.escapeHtml(offer?.type || 'studnia_oferta')}" style="padding:0.35rem 0.7rem; font-size:0.75rem;">Otwórz</button>
                        <button class="btn btn-sm btn-secondary btn-print-order" data-order-id="${this.escapeHtml(ord.id)}" data-offer-id="${this.escapeHtml(offerKey)}" data-offer-type="${this.escapeHtml(offer?.type || 'studnia_oferta')}" style="padding:0.35rem 0.7rem; font-size:0.75rem;">Karta</button>
                        <button class="btn btn-sm btn-secondary btn-modal-history-order" data-order-id="${this.escapeHtml(ord.id)}" style="padding:0.35rem 0.7rem; font-size:0.75rem;">Historia</button>
                        <button class="btn btn-sm btn-danger btn-modal-delete-order" data-order-id="${this.escapeHtml(ord.id)}" data-offer-type="${this.escapeHtml(offer?.type || 'studnia_oferta')}" style="padding:0.35rem 0.7rem; font-size:0.75rem;">Usuń</button>
                    </div>
                </div>
            `;
        });

        html += `
            </div>
            <div class="modal-footer">
                <button class="btn btn-secondary btn-close-footer" onclick="closeModal()">Zamknij</button>
            </div>
        `;

        const overlay = showModal({
            id: 'offer-orders-modal',
            titleId: 'offer-orders-title',
            html: `<div class="modal">${html}</div>`
        });
        
        try {
            if (typeof window.lucide !== 'undefined') window.lucide.replace();
        } catch (err) {
            console.error('Lucide replace error in showOfferOrdersPopup:', err);
        }

        // Attach modal closing event listeners
        overlay.querySelectorAll('.btn-open-order').forEach((btn) => {
            btn.addEventListener('click', (e) => {
                const buttonEl = e.target.closest('.btn-open-order');
                const orderId = buttonEl.getAttribute('data-order-id');
                const offerType = buttonEl.getAttribute('data-offer-type');
                closeModal();
                if (window.parent && window.parent.SpaRouter) {
                    window.parent.SpaRouter.openOfferInModule(offerType, orderId, 'order');
                } else if (window.SpaRouter) {
                    window.SpaRouter.openOfferInModule(offerType, orderId, 'order');
                } else {
                    const targetModule = offerType === 'studnia_oferta' ? 'studnie' : 'rury';
                    window.location.href = `app.html#/${targetModule}?order=${orderId}`;
                }
            });
        });

        overlay.querySelectorAll('.btn-print-order').forEach((btn) => {
            btn.addEventListener('click', (e) => {
                const buttonEl = e.target.closest('button');
                const orderId = buttonEl.getAttribute('data-order-id');
                const offerIdAttr = buttonEl.getAttribute('data-offer-id');
                const offerTypeAttr = buttonEl.getAttribute('data-offer-type');
                if (offerTypeAttr === 'rura_oferta' && typeof window.showUniversalPrintModalRury === 'function') {
                    window.showUniversalPrintModalRury(offerIdAttr, orderId);
                } else if (typeof window.showUniversalPrintModal === 'function') {
                    window.showUniversalPrintModal(offerIdAttr, orderId);
                } else {
                    closeModal();
                    showToast('Funkcja wydruku nie jest dostępna w tym widoku.', 'info');
                }
            });
        });

        overlay.querySelectorAll('.btn-modal-history-order').forEach((btn) => {
            btn.addEventListener('click', (e) => {
                const buttonEl = e.target.closest('button');
                const orderId = buttonEl.getAttribute('data-order-id');
                closeModal();
                this.showOfferHistoryUnified(String(orderId), 'order');
            });
        });

        overlay.querySelectorAll('.btn-modal-delete-order').forEach((btn) => {
            btn.addEventListener('click', async (e) => {
                const buttonEl = e.target.closest('button');
                const orderId = buttonEl.getAttribute('data-order-id');
                const offerType = buttonEl.getAttribute('data-offer-type');
                closeModal();
                await this.deleteOrderUnified(orderId, offerType);
            });
        });
    }

    attachActionListeners(container) {
        // Guard: zapobiega wielokrotnemu dodawaniu tego samego listenera do kontenera
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

            // Phone links — let default browser behavior
            if (btn.tagName === 'A' && btn.getAttribute('href')?.startsWith('tel:')) return;

            // ---- ORDER BADGE ----
            if (btn.classList.contains('btn-order-badge')) {
                e.preventDefault();
                const badgeOfferId = btn.getAttribute('data-offer-id');
                if (badgeOfferId) this.showOfferOrdersPopup(badgeOfferId);
                return;
            }

            // ---- EDIT ORDER ----
            if (btn.classList.contains('btn-edit-order')) {
                e.preventDefault();
                const editOrderId = btn.getAttribute('data-order-id');
                const editOfferType = btn.getAttribute('data-offer-type');
                if (!editOrderId) return;
                try {
                    if (window.parent?.SpaRouter) {
                        window.parent.SpaRouter.openOfferInModule(editOfferType, editOrderId, 'order');
                    } else if (window.SpaRouter) {
                        window.SpaRouter.openOfferInModule(editOfferType, editOrderId, 'order');
                    } else {
                        window.location.href = `app.html#/${editOfferType === 'studnia_oferta' ? 'studnie' : 'rury'}?order=${editOrderId}`;
                    }
                } catch (err) {
                    console.error('[PVSalesUI] Błąd nawigacji do zamówienia:', err);
                    window.location.href = `app.html#/${editOfferType === 'studnia_oferta' ? 'studnie' : 'rury'}?order=${editOrderId}`;
                }
                return;
            }

            // ---- CHANGE OWNER ----
            if (btn.classList.contains('btn-change-owner')) {
                this.changeOfferUserFromList(btn.getAttribute('data-id'));
                return;
            }

            // ---- Standard data attributes ----
            const id = btn.getAttribute('data-id');
            const typeAttr = btn.getAttribute('data-type');
            const orderId = btn.getAttribute('data-order-id');
            const offerType = btn.getAttribute('data-offer-type');

            // ---- EDIT / SZCZEGÓŁY ----
            if (title.includes('edytuj') || title.includes('szczegóły') || title.includes('szczegoly')) {
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
                    console.error('[PVSalesUI] Błąd pobierania do edycji:', err);
                }
                return;
            }

            // ---- COPY ----
            if (title.includes('kopiuj') || title.includes('skopiuj')) {
                await this.copyOfferWithVersion(id);
                return;
            }

            // ---- HISTORY (offer) ----
            if (title.includes('historia zmian') && !title.includes('zamówienia')) {
                this.showOfferHistoryUnified(String(id), typeAttr || 'studnia_oferta');
                return;
            }

            // ---- PRINT / EXPORT / KARTA BUDOWY ----
            if (title.includes('wydruk') || title.includes('drukuj') || title.includes('karta budowy')) {
                const printOfferId = btn.getAttribute('data-offer-id') || id;
                const printOrderId = orderId || '';
                // Rury: dedykowany modal (Karta Budowy + Oferta, Bootstrap-styled)
                if (offerType === 'rura_oferta' && typeof window.showUniversalPrintModalRury === 'function') {
                    window.showUniversalPrintModalRury(printOfferId, printOrderId);
                    return;
                }
                // Rury (legacy 'offer' type): bezpośredni export karty budowy
                if (offerType === 'offer' && printOrderId) {
                    if (typeof window.exportKartaDirect_action === 'function') {
                        window.exportKartaDirect_action(printOrderId, 'pdf');
                    } else {
                        showToast('Funkcja Karty Budowy niedostępna w tym widoku.', 'info');
                    }
                } else if (typeof window.showUniversalPrintModal === 'function') {
                    window.showUniversalPrintModal(printOfferId, printOrderId);
                } else {
                    showToast('Funkcja wydruku nie jest dostępna w tym widoku.', 'info');
                }
                return;
            }

            // ---- DELETE ORDER ----
            if (title.includes('usuń zam') || title.includes('usun zam')) {
                await this.deleteOrderUnified(orderId, offerType);
                return;
            }

            // ---- HISTORY (order) ----
            if (title.includes('hist. zam') || title.includes('historia zmian zamówienia')) {
                this.showOfferHistoryUnified(String(orderId), 'order');
                return;
            }

            // ---- DELETE OFFER ----
            if (title.includes('usuń') || title.includes('usun')) {
                if (!btn.disabled) {
                    await this.deleteOfferWithConfirmation(id);
                }
                return;
            }
        });
    }

    openExportPopupUnified(id, type) {
        let overlay = document.getElementById('export-offer-modal');
        if (overlay) overlay.remove();

        showModal({
            id: 'export-offer-modal',
            titleId: 'export-offer-title',
            html: `
            <div class="modal" style="background:#1e293b; padding:1.5rem; border-radius:12px; border:1px solid #334155; width:350px; text-align:center; box-shadow:0 10px 25px rgba(0,0,0,0.5);">
                <h3 id="export-offer-title" style="margin-bottom:1rem; color:#fff; font-size:1.1rem; font-weight:700;">Wydruk Oferty</h3>
                <p style="font-size:0.8rem; color:#cbd5e1; margin-bottom:1.5rem;">Do jakiego formatu chcesz wyeksportować tę ofertę?</p>
                <div style="display:flex; gap:1rem; justify-content:center; margin-bottom:1.5rem;">
                    <!-- PDF -->
                    <button onclick="if(window.pvSalesUI) window.pvSalesUI.handleExportClick('${id}', '${type}', 'pdf')" style="flex:1; background:rgba(239,68,68,0.2); color:#fca5a5; border:2px solid rgba(239,68,68,0.6); padding:1rem; border-radius:10px; cursor:pointer; font-weight:800; display:flex; flex-direction:column; align-items:center; gap:0.4rem; transition:all 0.2s;" onmouseenter="this.style.background='rgba(239,68,68,0.4)'" onmouseleave="this.style.background='rgba(239,68,68,0.2)'">
                        <span style="font-size:2rem;"><i data-lucide="file-text"></i></span> PDF
                    </button>
                    <!-- Word -->
                    <button onclick="if(window.pvSalesUI) window.pvSalesUI.handleExportClick('${id}', '${type}', 'word')" style="flex:1; background:rgba(59,130,246,0.2); color:#93c5fd; border:2px solid rgba(59,130,246,0.6); padding:1rem; border-radius:10px; cursor:pointer; font-weight:800; display:flex; flex-direction:column; align-items:center; gap:0.4rem; transition:all 0.2s;" onmouseenter="this.style.background='rgba(59,130,246,0.4)'" onmouseleave="this.style.background='rgba(59,130,246,0.2)'">
                        <span style="font-size:2rem;"><i data-lucide="edit"></i></span> Word
                    </button>
                </div>
                <button style="padding:0.5rem 1rem; border-radius:6px; background:rgba(255,255,255,0.05); border:1px solid rgba(255,255,255,0.1); color:var(--text-muted); cursor:pointer;" onclick="closeModal()">Anuluj</button>
            </div>
        `
        });
    }

    handleExportClick(id, type, format) {
        closeModal();

        const ext = format === 'pdf' ? 'pdf' : 'docx';
        const endpoint =
            type === 'offer'
                ? `/api/offers-rury/${id}/export-${ext}`
                : `/api/offers-studnie/${id}/export-${ext}`;

        if (typeof window.showToast === 'function') {
            window.showToast(`Generowanie pliku ${ext.toUpperCase()}...`, 'info');
        }

        fetch(endpoint, {
            headers:
                typeof authHeaders === 'function'
                    ? authHeaders()
                    : { 'Content-Type': 'application/json' }
        })
            .then((res) => {
                if (!res.ok) throw new Error('Nie udało się wyeksportować oferty');
                return res.blob();
            })
            .then((blob) => {
                const url = window.URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = `oferta_${type}_${id}.${ext}`;
                document.body.appendChild(a);
                a.click();
                window.URL.revokeObjectURL(url);
                a.remove();
                if (typeof window.showToast === 'function') {
                    window.showToast(`Wyeksportowano ofertę do ${ext.toUpperCase()}`, 'success');
                }
            })
            .catch((err) => {
                console.error('[Export Error]', err);
                if (typeof window.showToast === 'function') {
                    window.showToast('Błąd eksportu: ' + err.message, 'error');
                }
            });
    }

    async deleteOrderUnified(orderId, offerType) {
        const foundOrder = this.findOrderById(orderId);
        const offerIdForOrder = foundOrder.offerId || '';
        const visibleOrderCount = offerIdForOrder
            ? (this.ordersMap.get(offerIdForOrder) || []).length
            : 1;
        const willUnlockOffer = visibleOrderCount <= 1;

        if (
            !(await appConfirm(
                `Czy na pewno chcesz USUNĄĆ to zamówienie?\n\n${willUnlockOffer ? 'Po usunięciu ostatniego zamówienia oferta zostanie odblokowana do edycji.' : 'Oferta ma też inne zamówienia, więc pozostanie oznaczona jako zamówiona.'}`,
                { title: 'Usuwanie zamówienia', type: 'danger', okText: 'Usuń' }
            ))
        ) {
            return;
        }

        try {
            const endpoint =
                offerType === 'studnia_oferta'
                    ? `/api/orders-studnie/${encodeURIComponent(orderId)}`
                    : `/api/orders-rury/${encodeURIComponent(orderId)}`;
            const headers =
                typeof authHeaders === 'function'
                    ? authHeaders()
                    : { 'Content-Type': 'application/json' };

            const response = await fetch(endpoint, { method: 'DELETE', headers });
            if (!response.ok) {
                const data = await response.json().catch(() => ({}));
                throw new Error(data.error || 'Nie udało się usunąć zamówienia z serwera');
            }

            await this.loadOrdersMap();
            const remainingOrders = offerIdForOrder
                ? this.ordersMap.get(offerIdForOrder) || []
                : [];
            const shouldUnlockOffer = offerIdForOrder && remainingOrders.length === 0;

            if (shouldUnlockOffer) {
                const offers = await storageService.getOffers([offerType]);
                const offerWrapper = offers.find(
                    (o) => this.normalizeId(o.id) === this.normalizeId(offerIdForOrder)
                );
                const rawOffer = offerWrapper?.data || offerWrapper;

                if (rawOffer) {
                    console.log('[PVSalesUI] Odblokowywanie oferty:', offerWrapper.id);
                    rawOffer.id = offerWrapper.id;
                    rawOffer.type = offerWrapper.type || offerType;
                    rawOffer.state =
                        offerWrapper.status === 'active' ? 'final' : rawOffer.state || 'draft';
                    rawOffer.hasOrder = false;
                    delete rawOffer.orderId;
                    delete rawOffer.orderNumber;

                    await storageService.saveOffer(rawOffer);
                }
            }

            if (typeof window.showToast === 'function') {
                window.showToast(
                    shouldUnlockOffer
                        ? 'Zamówienie zostało usunięte. Oferta jest ponownie edytowalna.'
                        : 'Zamówienie zostało usunięte.',
                    'info'
                );
            }

            await this.loadLocalOffers();
        } catch (error) {
            console.error('[PVSalesUI] Błąd podczas usuwania zamówienia:', error);
            if (typeof window.showToast === 'function') {
                window.showToast('Błąd podczas usuwania zamówienia: ' + error.message, 'error');
            }
        }
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
            this.loadLocalOffers(); // Odświeżenie listy ofert
        } catch (error) {
            console.error('[PVSalesUI] Błąd podczas usuwania:', error);
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

    getAuditContextLabel(type) {
        if (type === 'order') return 'zamówienia';
        if (type === 'production_order') return 'zlecenia produkcyjnego';
        if (type === 'offer') return 'oferty rury';
        return 'oferty studni';
    }

    getAuditActionMeta(log) {
        const isDiff = log.newData && log.newData._diffMode === true;
        if (log.action === 'delete') {
            return { className: 'action-delete', icon: 'trash-2', label: 'Usunięto', tone: 'danger' };
        }
        if (log.action === 'create') {
            return { className: 'action-create', icon: 'sparkles', label: 'Utworzono', tone: 'create' };
        }
        if (isDiff) {
            return { className: 'action-diff', icon: 'pencil', label: 'Zmieniono', tone: 'diff' };
        }
        return { className: 'action-update', icon: 'save', label: 'Zapisano', tone: 'update' };
    }

    getAuditFieldLabel(key) {
        const labels = {
            totalBrutto: 'Wartość brutto',
            totalNetto: 'Wartość netto',
            totalTotalNetto: 'Wartość netto',
            originalTotalNetto: 'Pierwotna wartość netto',
            originalTotalTotalNetto: 'Pierwotna wartość netto',
            clientName: 'Klient',
            company: 'Firma',
            nip: 'NIP',
            contact: 'Kontakt',
            address: 'Adres',
            investName: 'Inwestycja',
            budowa: 'Budowa',
            userId: 'Opiekun',
            orderNumber: 'Numer zamówienia',
            offerNumber: 'Numer oferty',
            status: 'Status',
            state: 'Status',
            kartaBudowy: 'Karta budowy',
            transportType: 'Rodzaj transportu',
            paymentTerms: 'Warunki płatności',
            invoiceEmails: 'E-maile do faktury',
            efakturaEmails: 'E-faktura',
            wells: 'Studnie',
            wellsExport: 'Pozycje studni',
            products: 'Produkty',
            visiblePrzejsciaTypes: 'Widoczne typy przejść',
            originalSnapshot: 'Pierwotna migawka',
            transportKm: 'Kilometry transportu',
            transportRate: 'Stawka transportu',
            updatedAt: 'Ostatnia zmiana',
            createdAt: 'Utworzono',
            createdBy: 'Utworzył',
            totalWeight: 'Waga łączna',
            wellDiscounts: 'Rabaty studni'
        };
        return labels[key] || key.replace(/([A-Z])/g, ' $1').replace(/^./, (s) => s.toUpperCase());
    }

    formatAuditValue(value) {
        if (value === undefined || value === null || value === '') return 'brak';
        if (typeof value === 'number') {
            const formatter =
                typeof window.fmt === 'function'
                    ? window.fmt
                    : (val) => Number(val || 0).toFixed(2).replace('.', ',');
            return formatter(value);
        }
        if (typeof value === 'boolean') return value ? 'tak' : 'nie';
        if (Array.isArray(value)) return `${value.length} poz.`;
        if (typeof value === 'object') return 'zmieniono dane';
        return this.escapeHtml(value);
    }

    getAuditSnapshotTitle(data, type) {
        if (!data || typeof data !== 'object') return this.getAuditContextLabel(type);
        return (
            data.orderNumber ||
            data.offerNumber ||
            data.number ||
            data.offer_number ||
            data.clientName ||
            data.company ||
            this.getAuditContextLabel(type)
        );
    }

    getAuditSnapshotSummary(data, type) {
        if (!data || typeof data !== 'object') return 'Brak szczegółów w tym wpisie.';
        const parts = [];
        const money = data.totalBrutto || data.totalNetto || data.totalTotalNetto;
        if (money) parts.push(`wartość: ${this.formatAuditValue(Number(money))} PLN`);
        if (data.clientName || data.company) parts.push(`klient: ${this.escapeHtml(data.clientName || data.company)}`);
        if (data.orderNumber) parts.push(`zamówienie: ${this.escapeHtml(data.orderNumber)}`);
        if (data.offerNumber || data.number) parts.push(`oferta: ${this.escapeHtml(data.offerNumber || data.number)}`);
        if (type === 'order' && data.kartaBudowy) parts.push('zawiera kartę budowy');
        return parts.length ? parts.join(' • ') : 'Zapisano pełną migawkę dokumentu.';
    }

    getBusinessChanges(log) {
        const data = log.newData || {};
        const oldData = log.oldData || {};
        const keys = Object.keys(data).filter((key) => key !== '_diffMode');
        const priority = [
            'totalBrutto',
            'totalNetto',
            'totalTotalNetto',
            'clientName',
            'company',
            'orderNumber',
            'status',
            'state',
            'userId',
            'kartaBudowy',
            'wellsExport',
            'wells',
            'products'
        ];
        const orderedKeys = [
            ...priority.filter((key) => keys.includes(key)),
            ...keys.filter((key) => !priority.includes(key))
        ];

        return orderedKeys.slice(0, 6).map((key) => ({
            key,
            label: this.getAuditFieldLabel(key),
            oldValue: oldData[key],
            newValue: data[key]
        }));
    }

    renderAuditEntry(log, id, type) {
        const meta = this.getAuditActionMeta(log);
        const data = log.newData || {};
        const oldData = log.oldData || {};
        const isDiff = data._diffMode === true;
        const source = log.action === 'delete' ? oldData : data;
        const title = this.escapeHtml(this.getAuditSnapshotTitle(source, type));
        const summary = this.escapeHtml(this.getAuditSnapshotSummary(source, type));
        const date = log.createdAt ? new Date(log.createdAt).toLocaleString('pl-PL') : 'brak daty';
        const author = this.escapeHtml(log.userName || log.userId || 'System');

        let detailsHtml = '';
        if (isDiff) {
            const changes = this.getBusinessChanges(log);
            detailsHtml = changes.length
                ? changes
                      .map(
                          (change) => `
                            <div class="audit-change-row">
                                <span class="audit-change-name">${this.escapeHtml(change.label)}</span>
                                <span class="audit-change-values">
                                    <span class="audit-old">${this.formatAuditValue(change.oldValue)}</span>
                                    <i data-lucide="arrow-right"></i>
                                    <span class="audit-new">${this.formatAuditValue(change.newValue)}</span>
                                </span>
                            </div>`
                      )
                      .join('')
                : '<div class="audit-muted">Zmieniono dokument, ale brak czytelnych pól do pokazania.</div>';
        } else if (log.action === 'delete') {
            detailsHtml = `<div class="audit-muted danger-text">Usunięto dokument. Migawka sprzed usunięcia jest dostępna w podglądzie.</div>`;
        } else {
            detailsHtml = `<div class="audit-muted">${summary}</div>`;
        }

        const canRestore =
            log.action !== 'delete' &&
            !isDiff &&
            type !== 'order' &&
            type !== 'production_order';
        const restoreBtn = canRestore
            ? `<button class="btn btn-sm btn-secondary restore-btn" onclick="window.pvSalesUI.restoreOfferVersionUnified('${id}', '${log.id}', '${type}')"><i data-lucide="refresh-cw"></i> Przywróć</button>`
            : '';
        const previewBtn = `<button class="btn btn-sm btn-secondary preview-btn" onclick="window.pvSalesUI.viewHistorySnapshotUnified('${id}', '${log.id}', '${type}')"><i data-lucide="eye"></i> Podgląd</button>`;

        return `
            <div class="audit-card ${meta.className}">
                <div class="audit-card-header">
                    <div class="audit-title-wrap">
                        <span class="audit-badge ${meta.tone}"><i data-lucide="${meta.icon}"></i> ${meta.label}</span>
                        <div>
                            <div class="audit-entry-title">${title}</div>
                            <div class="audit-entry-subtitle">${date} • ${author}</div>
                        </div>
                    </div>
                    <div class="audit-actions">${previewBtn}${restoreBtn}</div>
                </div>
                <div class="audit-card-body">${detailsHtml}</div>
            </div>
        `;
    }

    async showOfferHistoryUnified(id, type = 'studnia_oferta') {
        try {
            const headers =
                typeof authHeaders === 'function'
                    ? authHeaders()
                    : { 'Content-Type': 'application/json' };
            const res = await fetch(`/api/audit/${type}/${id}?limit=20&offset=0`, { headers });
            const json = await res.json();
            const logs = json.data || [];
            const total = json.total || 0;

            if (logs.length === 0) {
                if (typeof window.showToast === 'function') {
                    window.showToast('Brak historii dla tego elementu', 'info');
                }
                return;
            }

            const existing = document.getElementById('offer-history-modal');
            if (existing) existing.remove();

            const contextLabel = this.getAuditContextLabel(type);
            const historyHtml = logs.map((log) => this.renderAuditEntry(log, id, type)).join('');
            const loadMoreHtml =
                logs.length < total
                    ? `<div id="audit-load-more-wrap-kartoteka" class="audit-load-more-wrap">
                        <button class="load-more-btn" onclick="window.pvSalesUI.loadMoreAuditLogs('${type}', '${id}', 20)"><i data-lucide="scroll-text"></i> Pokaż starsze zmiany (${total - logs.length})</button>
                    </div>`
                    : '';

            const overlayHtml = `
                <style>
                    .audit-modal-inner {
                        width: 100vw;
                        height: 100vh;
                        max-width: none;
                        max-height: none;
                        display: flex;
                        flex-direction: column;
                        border-radius: 0;
                        background: #0f172a;
                        border: 0;
                        box-shadow: none;
                        overflow: hidden;
                    }
                    .audit-modal-header {
                        display: flex;
                        justify-content: space-between;
                        align-items: center;
                        gap: 1rem;
                        padding: 1rem 1.25rem;
                        border-bottom: 1px solid rgba(148, 163, 184, 0.12);
                        background: rgba(15, 23, 42, 0.96);
                    }
                    .audit-modal-header h3 {
                        margin: 0;
                        color: #f8fafc;
                        font-size: 1rem;
                        display: flex;
                        align-items: center;
                        gap: 0.55rem;
                    }
                    .audit-modal-subtitle {
                        color: #94a3b8;
                        font-size: 0.78rem;
                        margin-top: 0.18rem;
                    }
                    .audit-list {
                        padding: 1rem 1.25rem 1.25rem;
                        overflow-y: auto;
                    }
                    .audit-card {
                        position: relative;
                        padding: 0.9rem 1rem;
                        margin-bottom: 0.75rem;
                        border-radius: 8px;
                        background: rgba(30, 41, 59, 0.62);
                        border: 1px solid rgba(148, 163, 184, 0.12);
                    }
                    .audit-card::before {
                        content: '';
                        position: absolute;
                        left: 0;
                        top: 0;
                        bottom: 0;
                        width: 4px;
                    }
                    .audit-card.action-create::before { background: #818cf8; }
                    .audit-card.action-update::before { background: #34d399; }
                    .audit-card.action-diff::before { background: #fbbf24; }
                    .audit-card.action-delete::before { background: #f87171; }
                    .audit-card-header {
                        display: flex;
                        justify-content: space-between;
                        align-items: flex-start;
                        gap: 1rem;
                        margin-bottom: 0.75rem;
                    }
                    .audit-title-wrap {
                        display: flex;
                        align-items: flex-start;
                        gap: 0.7rem;
                        min-width: 0;
                    }
                    .audit-badge {
                        display: inline-flex;
                        align-items: center;
                        gap: 0.35rem;
                        height: 28px;
                        padding: 0 0.6rem;
                        border-radius: 999px;
                        font-size: 0.72rem;
                        font-weight: 800;
                        white-space: nowrap;
                    }
                    .audit-badge i { width: 13px; height: 13px; }
                    .audit-badge.create { background: rgba(129, 140, 248, 0.14); color: #a5b4fc; border: 1px solid rgba(129, 140, 248, 0.25); }
                    .audit-badge.update { background: rgba(16, 185, 129, 0.12); color: #34d399; border: 1px solid rgba(16, 185, 129, 0.22); }
                    .audit-badge.diff { background: rgba(245, 158, 11, 0.12); color: #fbbf24; border: 1px solid rgba(245, 158, 11, 0.25); }
                    .audit-badge.danger { background: rgba(239, 68, 68, 0.12); color: #f87171; border: 1px solid rgba(239, 68, 68, 0.25); }
                    .audit-entry-title {
                        color: #f8fafc;
                        font-size: 0.92rem;
                        font-weight: 750;
                        line-height: 1.25;
                    }
                    .audit-entry-subtitle {
                        color: #94a3b8;
                        font-size: 0.76rem;
                        margin-top: 0.2rem;
                    }
                    .audit-card-body {
                        display: flex;
                        flex-direction: column;
                        gap: 0.45rem;
                        padding-left: 0.1rem;
                    }
                    .audit-change-row {
                        display: grid;
                        grid-template-columns: minmax(130px, 210px) 1fr;
                        gap: 0.75rem;
                        align-items: center;
                        padding: 0.45rem 0.55rem;
                        border-radius: 7px;
                        background: rgba(15, 23, 42, 0.5);
                    }
                    .audit-change-name {
                        color: #cbd5e1;
                        font-size: 0.78rem;
                        font-weight: 700;
                    }
                    .audit-change-values {
                        display: inline-flex;
                        align-items: center;
                        gap: 0.45rem;
                        min-width: 0;
                        color: #e2e8f0;
                        font-size: 0.8rem;
                    }
                    .audit-change-values i { width: 13px; height: 13px; color: #64748b; flex: 0 0 auto; }
                    .audit-old {
                        color: #94a3b8;
                        text-decoration: line-through;
                        overflow: hidden;
                        text-overflow: ellipsis;
                        white-space: nowrap;
                    }
                    .audit-new {
                        color: #34d399;
                        font-weight: 800;
                        overflow: hidden;
                        text-overflow: ellipsis;
                        white-space: nowrap;
                    }
                    .audit-muted { color: #cbd5e1; font-size: 0.84rem; }
                    .danger-text { color: #fca5a5; }
                    .audit-actions {
                        display: flex;
                        gap: 0.4rem;
                        flex-wrap: wrap;
                        justify-content: flex-end;
                    }
                    .preview-btn,
                    .restore-btn,
                    .load-more-btn {
                        border-radius: 7px;
                        font-weight: 700;
                    }
                    .load-more-btn {
                        background: rgba(99,102,241,0.14);
                        border: 1px solid rgba(99,102,241,0.3);
                        color: #a5b4fc;
                        padding: 0.55rem 1.1rem;
                        cursor: pointer;
                    }
                    .audit-load-more-wrap { text-align: center; padding: 0.75rem 0 0.25rem; }
                    @media (max-width: 720px) {
                        .audit-card-header,
                        .audit-title-wrap { flex-direction: column; }
                        .audit-actions { justify-content: flex-start; }
                        .audit-change-row { grid-template-columns: 1fr; gap: 0.25rem; }
                    }
                </style>
                <div class="modal audit-modal-inner">
                    <div class="audit-modal-header">
                        <div>
                            <h3 id="offer-history-title"><i data-lucide="history"></i> Historia ${contextLabel}</h3>
                            <div class="audit-modal-subtitle">${total} wpisów • najnowsze zmiany na górze</div>
                        </div>
                        <button class="btn-icon" aria-label="Zamknij" style="background:rgba(255,255,255,0.08); color:#fff; width:32px; height:32px;" onclick="document.getElementById('offer-history-modal').remove()"><i data-lucide="x" aria-hidden="true"></i></button>
                    </div>
                    <div id="audit-logs-container-kartoteka" class="audit-list">
                        ${historyHtml}
                        ${loadMoreHtml}
                    </div>
                </div>
            `;

            const overlay = showModal({
                id: 'offer-history-modal',
                titleId: 'offer-history-title',
                html: overlayHtml
            });
            if (typeof window.lucide !== 'undefined') window.lucide.replace();

            this.currentAuditLogs = logs;
            this.currentAuditOffset = logs.length;
            this.currentAuditEntityId = id;
            this.currentAuditEntityType = type;
            this._renderEntry = (log) => this.renderAuditEntry(log, id, type);
        } catch (error) {
            console.error('[PVSalesUI] Błąd wyświetlania historii:', error);
            if (typeof window.showToast === 'function') {
                window.showToast('Błąd pobierania historii', 'error');
            }
        }
    }

    async loadMoreAuditLogs(entityType, entityId, limit) {
        try {
            const offset = this.currentAuditOffset || 0;
            const headers =
                typeof authHeaders === 'function'
                    ? authHeaders()
                    : { 'Content-Type': 'application/json' };
            const res = await fetch(
                `/api/audit/${entityType}/${entityId}?limit=${limit}&offset=${offset}`,
                { headers }
            );
            const json = await res.json();
            const newLogs = json.data || [];
            const total = json.total || 0;

            if (newLogs.length === 0) return;

            this.currentAuditLogs = [...(this.currentAuditLogs || []), ...newLogs];
            this.currentAuditOffset = offset + newLogs.length;

            const container = document.getElementById('audit-logs-container-kartoteka');
            const wrap = document.getElementById('audit-load-more-wrap-kartoteka');
            if (wrap) wrap.remove();

            container.insertAdjacentHTML('beforeend', newLogs.map(this._renderEntry).join(''));

            if (this.currentAuditOffset < total) {
                const remaining = total - this.currentAuditOffset;
                container.insertAdjacentHTML(
                    'beforeend',
                    `
                    <div id="audit-load-more-wrap-kartoteka" class="audit-load-more-wrap">
                        <button class="load-more-btn"
                            onclick="window.pvSalesUI.loadMoreAuditLogs('${entityType}', '${entityId}', ${limit})"><i data-lucide="scroll-text"></i> Pokaż starsze zmiany (${remaining})</button>
                    </div>
                `
                );
            }
            if (typeof window.lucide !== 'undefined') window.lucide.replace();
        } catch (e) {
            console.error('[PVSalesUI] Błąd ładowania logów:', e);
        }
    }

    async restoreOfferVersionUnified(offerId, logId, type) {
        try {
            const log = this.currentAuditLogs?.find((l) => l.id === logId);
            if (!log || !log.newData) return;

            const snapshot = log.newData;
            const isStudnia = type === 'studnia_oferta';
            const currentPage = window.location.pathname.split('/').pop() || 'index.html';

            if (isStudnia && !currentPage.includes('studnie.html')) {
                if (
                    await appConfirm(
                        'Aby przywrócić tę wersję studni, musisz przejść do edytora STUDNIE. Przejść teraz?',
                        { title: 'Przekierowanie', type: 'info', okText: 'Przejdź' }
                    )
                ) {
                    sessionStorage.setItem(
                        'pending_restore',
                        JSON.stringify({ type, data: snapshot })
                    );
                    window.location.href = `studnie.html?edit=${offerId}&restore=true`;
                }
                return;
            }

            if (isStudnia && typeof window.loadSavedOfferStudnie === 'function') {
                window.loadSavedOfferStudnie(snapshot);
            } else if (!isStudnia && typeof window.loadSavedOfferData === 'function') {
                window.loadSavedOfferData(snapshot, offerId);
            }

            const modal = document.getElementById('offer-history-modal');
            if (modal) modal.remove();

            if (typeof window.showToast === 'function')
                window.showToast('Wersja przywrócona do edytora.', 'success');
        } catch (error) {
            console.error('[PVSalesUI] Błąd przywracania wersji:', error);
        }
    }

    showAuditSnapshotModal(data, type) {
        const existing = document.getElementById('audit-snapshot-modal');
        if (existing) existing.remove();

        const rows = Object.entries(data || {})
            .filter(([key]) => !['history', '_diffMode'].includes(key))
            .slice(0, 40)
            .map(
                ([key, value]) => `
                    <div class="audit-change-row">
                        <span class="audit-change-name">${this.escapeHtml(this.getAuditFieldLabel(key))}</span>
                        <span class="audit-change-values"><span class="audit-new">${this.formatAuditValue(value)}</span></span>
                    </div>`
            )
            .join('');

        showModal({
            id: 'audit-snapshot-modal',
            titleId: 'audit-snapshot-title',
            html: `
            <style>
                #audit-snapshot-modal .audit-modal-inner { width:100vw; height:100vh; max-width:none; max-height:none; background:#0f172a; border:0; border-radius:0; box-shadow:none; display:flex; flex-direction:column; }
                #audit-snapshot-modal .audit-modal-header { display:flex; justify-content:space-between; align-items:center; gap:1rem; padding:1rem 1.25rem; border-bottom:1px solid rgba(148,163,184,0.12); }
                #audit-snapshot-modal .audit-modal-header h3 { margin:0; color:#f8fafc; font-size:1rem; display:flex; align-items:center; gap:0.55rem; }
                #audit-snapshot-modal .audit-modal-subtitle { color:#94a3b8; font-size:0.78rem; margin-top:0.18rem; }
                #audit-snapshot-modal .audit-list { padding:1rem 1.25rem 1.25rem; overflow-y:auto; }
                #audit-snapshot-modal .audit-change-row { display:grid; grid-template-columns:minmax(130px,210px) 1fr; gap:0.75rem; align-items:center; padding:0.45rem 0.55rem; border-radius:7px; background:rgba(15,23,42,0.5); }
                #audit-snapshot-modal .audit-change-name { color:#cbd5e1; font-size:0.78rem; font-weight:700; }
                #audit-snapshot-modal .audit-change-values { min-width:0; color:#e2e8f0; font-size:0.8rem; }
                #audit-snapshot-modal .audit-new { color:#34d399; font-weight:800; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; display:block; }
                #audit-snapshot-modal .audit-muted { color:#cbd5e1; font-size:0.84rem; }
            </style>
            <div class="modal audit-modal-inner" style="width:100vw; height:100vh; max-width:none; max-height:none; overflow:hidden;">
                <div class="audit-modal-header">
                    <div>
                        <h3 id="audit-snapshot-title"><i data-lucide="eye"></i> Podgląd historyczny</h3>
                        <div class="audit-modal-subtitle">${this.escapeHtml(this.getAuditContextLabel(type))}</div>
                    </div>
                    <button class="btn-icon" aria-label="Zamknij" style="background:rgba(255,255,255,0.08); color:#fff; width:32px; height:32px;" onclick="closeModal()"><i data-lucide="x" aria-hidden="true"></i></button>
                </div>
                <div class="audit-list" style="display:flex; flex-direction:column; gap:0.45rem;">
                    ${rows || '<div class="audit-muted">Brak danych do pokazania.</div>'}
                </div>
            </div>
        `
        });
        if (typeof window.lucide !== 'undefined') window.lucide.replace();
    }

    async viewHistorySnapshotUnified(id, logId, type) {
        try {
            const headers =
                typeof authHeaders === 'function'
                    ? authHeaders()
                    : { 'Content-Type': 'application/json' };
            const res = await fetch(`/api/audit/rebuild/${type}/${id}/${logId}`, { headers });

            if (!res.ok) {
                const errJson = await res.json().catch(() => ({}));
                throw new Error(errJson.error || 'Błąd odbudowy historycznej wersji.');
            }

            const json = await res.json();
            const rebuiltData = json.data;

            const modal = document.getElementById('offer-history-modal');
            if (modal) modal.remove();

            const isKartoteka = (window.location.pathname.split('/').pop() || '').startsWith(
                'kartoteka'
            );
            if (type === 'order' || type === 'production_order' || isKartoteka) {
                this.showAuditSnapshotModal(rebuiltData, type);
                return;
            }

            if (typeof window.showToast === 'function') {
                window.showToast('Wczytano wersję historyczną do testowego podglądu.', 'info');
            }

            this.openOfferForEdit(rebuiltData, id, type);
        } catch (error) {
            console.error('[PVSalesUI] Błąd podglądu historii:', error);
            if (typeof window.showToast === 'function') window.showToast(error.message, 'error');
            else if (typeof window.showToast === 'function')
                window.showToast(error.message, 'error');
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

            // Głęboka kopia
            const newOffer = structuredClone(offer);

            // Wyczyść ID i metadane
            delete newOffer.id;
            delete newOffer.createdAt;
            delete newOffer.updatedAt;
            delete newOffer.history;
            delete newOffer.hasOrder;
            delete newOffer.orderId;
            delete newOffer.orderNumber;

            newOffer.id = 'L_COPY_' + Date.now().toString(36);

            // Logika wersji
            let oldNumber = newOffer.number || newOffer.offerNumber || '';
            let newNumber = oldNumber;

            // Szukamy końcówki /v2, /V2
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

            // Przeładuj listę
            await this.loadLocalOffers();
            this.filterLocalOffers(); // Zaaplikuj aktualny filtr jeśli istnieje
        } catch (error) {
            console.error('[PVSalesUI] Błąd podczas kopiowania oferty:', error);
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

                // Propagate opiekun change to associated order
                const normalizedId = this.normalizeId(offerId);
                const linkedOrders = this.ordersMap ? this.ordersMap.get(normalizedId) : null;
                const linkedOrder = Array.isArray(linkedOrders) ? linkedOrders[0] : linkedOrders;
                if (linkedOrder && linkedOrder.id) {
                    const offerType = offerWrapper.type || currentOffer.type;
                    const orderEndpoint =
                        offerType === 'studnia_oferta'
                            ? `/api/orders-studnie/${linkedOrder.id}`
                            : `/api/orders-pv/${linkedOrder.id}`;
                    fetch(orderEndpoint, {
                        method: 'PATCH',
                        headers,
                        body: JSON.stringify({
                            userId: currentOffer.userId,
                            userName: currentOffer.userName
                        })
                    }).catch((e) =>
                        console.error('[PVSalesUI] Błąd aktualizacji opiekuna w zamówieniu:', e)
                    );
                }

                if (typeof window.showToast === 'function') {
                    window.showToast(`Opiekun zmieniony na: ${currentOffer.userName}`, 'success');
                }
                await this.loadLocalOffers();
            }
        } catch (error) {
            console.error('[PVSalesUI] Błąd zmiany opiekuna:', error);
            if (typeof window.showToast === 'function') {
                window.showToast('Błąd podczas zmiany opiekuna: ' + error.message, 'error');
            }
        }
    }
}

document.addEventListener('DOMContentLoaded', () => {
    // Inicjalizacja na stronie kartoteki (brak przycisku nav-sales, zawsze widoczny)
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
