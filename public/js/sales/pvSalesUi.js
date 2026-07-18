// @ts-check
// Wersja 2.0 - Zarzadzanie zamowieniami w Kartotece
import { storageService } from '../shared/StorageService.js';
import {
    auditGetContextLabel,
    auditGetActionMeta,
    auditGetFieldLabel,
    auditFormatValue,
    auditGetSnapshotTitle,
    auditGetSnapshotSummary,
    auditGetBusinessChanges,
    auditRenderEntry,
    auditShowHistory,
    auditLoadMore,
    auditRestoreVersion,
    auditShowSnapshotModal,
    auditViewSnapshot
} from './pvSalesAudit.js';

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
            order?.orderNumber ||
                order?.offerNumber ||
                (order?.id ? String(order.id).substring(0, 8) : 'Zamówienie')
        );
    }

    getOrderChangeInfo(order) {
        const currentPrice = Number(order?.totalNetto || order?.totalTotalNetto || 0);
        const originalPrice = Number(
            order?.originalTotalTotalNetto || order?.originalTotalNetto || currentPrice
        );
        let changed = Math.abs(currentPrice - originalPrice) > 0.01;
        if (!changed && order?.originalSnapshot) {
            const snap = order.originalSnapshot;
            const snapItems = snap.items || [];
            const snapProductTotal = snapItems.reduce((sum, item) => {
                const unitBase =
                    (Number(item.unitPrice) || 0) * (1 - (Number(item.discount) || 0) / 100);
                return (
                    sum +
                    (unitBase + Number(item.surcharge || 0) + Number(item.pehdCostPerUnit || 0)) *
                        (Number(item.quantity) || 0)
                );
            }, 0);
            const snapTransport = this.recalculateRuryTransportCost(
                snapItems,
                snap.transportKm,
                snap.transportRate
            );
            const totalCurrent = this.computeOrderValueWithTransport(order);
            changed = Math.abs(totalCurrent - (snapProductTotal + snapTransport)) > 0.01;
        }
        return { changed, currentPrice, originalPrice };
    }

    /**
     * Przelicza koszt transportu dla zamówienia rur na podstawie aktualnych pozycji.
     *
     * Deleguje do calculateTransports() z transport.js (bin-packing z konsolidacją).
     *
     * @param {Array} items pozycje zamówienia (z `weight`, `transport`, `quantity`, `autoAdded`)
     * @param {number} transportKm km na kurs
     * @param {number} transportRate PLN/km
     * @returns {number} łączny koszt transportu (PLN)
     */
    recalculateRuryTransportCost(items, transportKm, transportRate) {
        return window.recalculateRuryTransportCost(items, transportKm, transportRate);
    }

    /**
     * Oblicza aktualną wartość netto zamówienia Z TRANSPORTEM włącznie.
     *
     * Studnie: suma `wellsExport[].totalPrice` (= price + transportCost per studnia).
     *          Te pole jest aktualizowane przy każdym zapisie oferty i zawiera
     *          zarówno cenę konfiguracji jak i koszt transportu rozdzielony na studnie.
     *          Fallback: order.totalNetto (zachowane dla kompatybilności z legacy).
     *
     * Rury: suma produktów + przeliczony transport (bin-packing z wag pozycji).
     *   - products = Σ (unitPrice * (1 - discount/100) + surcharge + pehdCostPerUnit) * quantity
     *   - transport = recalculateRuryTransportCost(items, transportKm, transportRate)
     *     (per-item `transport` z cennika może być nieaktualny po modyfikacji ilości,
     *      więc liczymy koszt od zera z aktualnych wag i `transport` per-unit)
     *   - final = products + transport
     *   Zamówienia rur nie zapisują pola totalNetto — wartość musi być liczona w locie.
     *
     * @param {object} order obiekt zamówienia
     * @param {string} [offerType] typ oferty ('rura_oferta' | 'offer' | 'studnia_oferta')
     * @returns {number} wartość netto (z transportem)
     */
    computeOrderValueWithTransport(order, offerType) {
        return window.computeOrderValueWithTransport(order, offerType);
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
                this.initRetryCount++;
                if (this.initRetryCount > this.initRetryMax) {
                    logger.error('pvSalesUi', 'Przekroczono limit prób inicjalizacji');
                    return;
                }
                logger.info(
                    'pvSalesUi',
                    '[PVSalesUI] Czekam na dane użytkownika w sessionStorage (ponowienie ' +
                        this.initRetryCount +
                        '/' +
                        this.initRetryMax +
                        ')...'
                );
                setTimeout(() => this.init(), 500);
                return;
            }

            this.initRetryCount = 0;

            const user = JSON.parse(userStr);
            this.role = user.role || 'user';
            logger.info('pvSalesUi', 'Inicjalizacja dla użytkownika:', user.username);

            await storageService.init();
            if (typeof fetchGlobalUsers === 'function') await fetchGlobalUsers();
            await this.searchOffers(this.buildSearchParams(), true);
            this.renderResults();

            // Załaduj mapę zamówień w tle — nie blokuje renderowania
            this.notifyOrderMutation();

            this._startAutoRefresh();

            this.initialized = true;
            if (typeof window.initAdvancedFilterEvents === 'function') {
                window.initAdvancedFilterEvents(this);
            }
        } catch (error) {
            logger.error('pvSalesUi', 'Błąd inicjalizacji UI Sprzedaży:', error);
            const listDiv = document.getElementById('pv-local-offers-list');
            if (listDiv)
                listDiv.innerHTML = `<div style="text-align:center; padding:2rem; color:var(--text-danger);">Błąd ładowania ofert: ${this.escapeHtml(error.message)}</div>`;
        }
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

            logger.info(
                'pvSalesUi',
                `[PVSalesUI] Załadowano ${totalOrders} zamówień (studnie+rury) powiązanych z ${this.ordersMap.size} ofertami.`
            );
        } catch (error) {
            logger.warn('pvSalesUi', 'Nie udało się pobrać zamówień:', error.message);
            if (typeof window.showToast === 'function') {
                window.showToast(
                    'Nie udało się pobrać zamówień — oferty mogą być niekompletne',
                    'warning'
                );
            }
        }
    }

    /**
     * Wywołaj po każdej mutacji zamówienia (CREATE/UPDATE/DELETE).
     * Odświeża ordersMap w tle i odświeża widok kartoteki.
     */
    notifyOrderMutation() {
        this.loadOrdersMap()
            .then(() => {
                if (this.searchResults?.items) this.renderResults();
            })
            .catch((e) => logger.warn('pvSalesUi', 'notifyOrderMutation:', e.message));
    }

    /** @returns {{ hasOrder: boolean, orders: Array<Object>, order: Object|null }} */
    getOrderForOffer(offer) {
        const offerId = this.normalizeId(offer.id);

        // ordersMap (pełne dane zamówień) - priorytet, bo UI potrzebuje order.id, orderNumber itp.
        if (offerId && this.ordersMap.has(offerId)) {
            const orders = [...this.ordersMap.get(offerId)];
            if (orders.length > 0) {
                return { hasOrder: true, orders, order: orders[0] };
            }
        }

        // _orderCount z search API — szybki boolean, brak pełnych danych zamówienia
        if (offer._orderCount != null && offer._orderCount > 0) {
            return { hasOrder: true, orders: [], order: null };
        }
        if (offer._orderCount != null && offer._orderCount === 0) {
            return { hasOrder: false, orders: [], order: null };
        }

        // Fallback z pól oferty
        if (offer.hasOrder && offer.orderId) {
            const fallbackOrder = { id: offer.orderId, orderNumber: offer.orderNumber || '' };
            return { hasOrder: true, orders: [fallbackOrder], order: fallbackOrder };
        }

        return { hasOrder: false, orders: [], order: null };
    }

    async loadLocalOffers() {
        logger.info('pvSalesUi', 'loadLocalOffers: Delegowanie do searchOffers...');
        await this.searchOffers(this.buildSearchParams());
        this.notifyOrderMutation();
    }

    _startAutoRefresh() {
        this._stopAutoRefresh();
        this.autoRefreshInterval = setInterval(() => {
            if (!document.hidden) {
                this.searchOffers(this.buildSearchParams()).catch((e) =>
                    logger.error('pvSalesUi', 'Auto-refresh error:', e)
                );
            }
        }, 60000);
    }

    _stopAutoRefresh() {
        if (this.autoRefreshInterval) {
            clearInterval(this.autoRefreshInterval);
            this.autoRefreshInterval = null;
        }
    }

    /**
     * Handler dla oninput na search box — debounce + sync UI
     */
    onSearchInput() {
        this._syncFilterUI();
        clearTimeout(this.searchDebounceTimer);
        this.searchDebounceTimer = setTimeout(() => {
            this.searchOffers(this.buildSearchParams());
        }, 300);
    }

    filterLocalOffers() {
        this._syncFilterUI();
        this.searchOffers(this.buildSearchParams());
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

        this.searchOffers(this.buildSearchParams());
    }

    setTypeFilter(typeFilter) {
        this.currentTypeFilter = typeFilter;
        this.searchOffers(this.buildSearchParams());
    }

    offerMatchesUser(offer, selectedUserId) {
        return window.offerMatchesUser(offer, selectedUserId);
    }

    offerMatchesDate(offer, dateFilter, boundaries) {
        return window.offerMatchesDate(offer, dateFilter, boundaries);
    }

    _syncFilterUI() {
        document.querySelectorAll('.pv-filter-btn').forEach((btn) => {
            btn.classList.toggle('active', btn.dataset.filter === this.currentFilter);
            btn.classList.toggle('btn-secondary', btn.dataset.filter !== this.currentFilter);
        });
        document.querySelectorAll('.pv-type-filter-btn').forEach((btn) => {
            btn.classList.toggle('active', btn.dataset.typeFilter === this.currentTypeFilter);
            btn.classList.toggle(
                'btn-secondary',
                btn.dataset.typeFilter !== this.currentTypeFilter
            );
        });
        const sel = document.getElementById('pv-user-filter');
        if (sel) sel.value = this.filters.user;
        const myBtn = document.getElementById('pv-my-offers-btn');
        if (myBtn) {
            myBtn.classList.toggle('active', this.filters.myOffers);
            myBtn.classList.toggle('btn-secondary', !this.filters.myOffers);
        }
        document.querySelectorAll('.pv-date-preset-btn').forEach((btn) => {
            const isActive =
                this.filters.date.mode === 'preset' &&
                btn.dataset.dateRange === this.filters.date.preset;
            btn.classList.toggle('active', isActive);
            btn.classList.toggle('btn-secondary', !isActive);
        });
        const rangeBtn = document.getElementById('pv-date-range-btn');
        if (rangeBtn) {
            rangeBtn.classList.toggle('active', this.filters.date.mode === 'range');
            rangeBtn.classList.toggle('btn-secondary', this.filters.date.mode !== 'range');
        }
    }

    setUserFilter(userId) {
        this.filters.user = userId || '';
        this.filters.myOffers = false;
        this.searchOffers(this.buildSearchParams());
    }

    toggleMyOffers() {
        if (this.filters.myOffers) {
            this.filters.myOffers = false;
            this.filters.user = '';
        } else {
            this.filters.myOffers = true;
            const uid = window.currentUser?.id || window.currentUser?.username || '';
            this.filters.user = uid;
        }
        this.searchOffers(this.buildSearchParams());
    }

    setDatePreset(preset) {
        if (this.filters.date.mode === 'preset' && this.filters.date.preset === preset) {
            this.filters.date.mode = 'none';
            this.filters.date.preset = '';
        } else {
            this.filters.date.mode = 'preset';
            this.filters.date.preset = preset;
        }
        this.filters.date.from = '';
        this.filters.date.to = '';
        this._closeDatePopover();
        this.searchOffers(this.buildSearchParams());
    }

    toggleDateRange() {
        if (this.filters.date.mode === 'range') {
            this.filters.date.mode = 'none';
            this.filters.date.from = '';
            this.filters.date.to = '';
        } else {
            this.filters.date.mode = 'range';
            this.filters.date.preset = '';
        }
        this.searchOffers(this.buildSearchParams());
    }

    onDateRangeChange(from, to) {
        if (from || to) {
            this.filters.date.mode = 'range';
            this.filters.date.preset = '';
        } else {
            this.filters.date.mode = 'none';
        }
        this.filters.date.from = from || '';
        this.filters.date.to = to || '';
        this.searchOffers(this.buildSearchParams());
    }

    clearFilters() {
        this.filters.user = '';
        this.filters.myOffers = false;
        this.filters.date.mode = 'none';
        this.filters.date.preset = '';
        this.filters.date.from = '';
        this.filters.date.to = '';
        this._closeDatePopover();
        this.searchOffers(this.buildSearchParams());
    }

    /**
     * Buduje parametry wyszukiwania z obecnego stanu filtrów
     */
    buildSearchParams() {
        const input = document.getElementById('pv-local-search-input');
        const q = input ? input.value.trim() : '';

        let dateFrom = '';
        let dateTo = '';
        if (this.filters.date.mode === 'preset') {
            const resolved = this._resolveDatePreset(this.filters.date.preset);
            dateFrom = resolved.from;
            dateTo = resolved.to;
        } else if (this.filters.date.mode === 'range') {
            dateFrom = this.filters.date.from;
            dateTo = this.filters.date.to;
        }

        let userId = this.filters.user;
        if (this.filters.myOffers) {
            try {
                const u = JSON.parse(sessionStorage.getItem('user') || '{}');
                userId = u.id || '';
            } catch {
                userId = '';
            }
        }

        return {
            q,
            type: this.currentTypeFilter,
            dateFrom,
            dateTo,
            userId,
            orderStatus: this.currentFilter,
            limit: 50,
            sort: 'createdAt',
            order: 'desc'
        };
    }

    /**
     * Główna metoda wyszukiwania — zastępuje loadOrdersMap + loadLocalOffers
     */
    _httpErrorMessage(status) {
        return window.httpErrorMessage(status);
    }

    async searchOffers(params = {}, skipRender) {
        if (this.abortController) {
            this.abortController.abort();
        }
        this.abortController = new AbortController();

        this.isLoading = true;
        this.showLoadingSpinner();

        const headers =
            typeof authHeaders === 'function'
                ? authHeaders()
                : { 'Content-Type': 'application/json' };

        const isLoadMore = !!params.cursor;
        const qs = new URLSearchParams({
            q: params.q || '',
            type: params.type || 'all',
            dateFrom: params.dateFrom || '',
            dateTo: params.dateTo || '',
            userId: params.userId || '',
            orderStatus: params.orderStatus || 'all',
            limit: String(params.limit || 50),
            sort: params.sort || 'createdAt',
            order: params.order || 'desc',
            cursor: params.cursor || '',
            cursorId: params.cursorId || '',
            t: String(Date.now())
        }).toString();

        try {
            const resp = await fetch('/api/offers/search?' + qs, {
                headers,
                signal: this.abortController.signal
            });

            if (!resp.ok) {
                const errBody = await resp.json().catch(() => ({}));
                throw new Error(errBody.error || this._httpErrorMessage(resp.status));
            }
            const json = await resp.json();

            if (isLoadMore) {
                this.searchResults.items = [...this.searchResults.items, ...(json.data || [])];
                this.searchResults.hasMore = json.hasMore;
                this.searchResults.nextCursor = json.nextCursor;
                this.searchResults.nextCursorId = json.nextCursorId;
            } else {
                this.searchResults = {
                    items: json.data || [],
                    totalCount: json.totalCount || 0,
                    hasMore: json.hasMore,
                    nextCursor: json.nextCursor,
                    nextCursorId: json.nextCursorId
                };
                // Po nowym wyszukiwaniu odśwież listę opiekunów
                this.populateUserFilter();
            }

            if (!skipRender) this.renderResults();
            this.updateOfferCounter(this.searchResults.items.length, this.searchResults.totalCount);
        } catch (error) {
            if (error.name === 'AbortError') return;
            logger.error('pvSalesUi', 'Błąd wyszukiwania ofert:', error);
            this.showError(error.message || 'Błąd sieci');
        } finally {
            this.isLoading = false;
        }
    }

    /**
     * Ładuje kolejną stronę wyników (cursor-based pagination)
     */
    async loadMore() {
        if (this.isLoading || !this.searchResults?.hasMore) return;

        const params = this.buildSearchParams();
        params.cursor = this.searchResults.nextCursor;
        params.cursorId = this.searchResults.nextCursorId;
        params.limit = 50;

        await this.searchOffers(params);
    }

    /**
     * Renderuje wyniki wyszukiwania do kontenera kart
     */
    renderResults() {
        const listDiv = document.getElementById('pv-local-offers-list');
        if (!listDiv) return;

        const items = this.searchResults?.items || [];

        if (items.length === 0) {
            listDiv.innerHTML =
                '<div style="text-align:center; padding:2rem; color:var(--text-muted); font-style:italic;">Brak ofert pasujących do filtrów.</div>';
            return;
        }

        listDiv.innerHTML = this.renderOffersList(items, true);
        this.attachActionListeners(listDiv);
        if (window.lucide) lucide.createIcons({ root: listDiv });

        if (this.searchResults?.hasMore) {
            listDiv.insertAdjacentHTML('beforeend', this.renderLoadMore());
            document
                .getElementById('pv-load-more-btn')
                ?.addEventListener('click', () => this.loadMore());
        }
    }

    /**
     * HTML przycisku "Pokaż więcej"
     */
    renderLoadMore() {
        const shown = this.searchResults?.items?.length || 0;
        const total = this.searchResults?.totalCount;
        const label =
            total != null ? 'Pokaż więcej (' + shown + ' z ' + total + ')' : 'Pokaż więcej';
        return (
            '<div class="load-more-container" style="text-align:center; padding:1rem;">' +
            '<button class="btn btn-sm btn-secondary" id="pv-load-more-btn">' +
            label +
            '</button></div>'
        );
    }

    /**
     * Wyświetla spinner ładowania
     */
    showLoadingSpinner() {
        const el = document.getElementById('pv-local-offers-list');
        if (!el) return;
        el.innerHTML =
            '<div style="text-align:center; padding:2rem; color:var(--text-muted);">' +
            '<i data-lucide="loader-2" class="spin" style="width:24px;height:24px;animation:spin 1s linear infinite;"></i>' +
            '<br/><span style="font-size:0.85rem; margin-top:0.5rem; display:inline-block;">Ładowanie ofert...</span></div>';
        if (window.lucide) lucide.createIcons({ root: el });
    }

    /**
     * Aktualizuje licznik ofert
     */
    updateOfferCounter(shown, total) {
        const el = document.getElementById('pv-offer-count');
        if (!el) return;
        if (total != null) {
            el.textContent = 'Pokazuje ' + shown + ' z ' + total + ' ofert';
        } else {
            el.textContent = '';
        }
    }

    /**
     * Wyświetla błąd w kontenerze listy
     */
    showError(message) {
        const listDiv = document.getElementById('pv-local-offers-list');
        if (!listDiv) return;
        listDiv.innerHTML =
            '<div style="text-align:center; padding:2rem; color:var(--text-danger);">' +
            '<strong>Błąd:</strong><br/>' +
            '<span style="font-size:0.85rem; opacity:0.8;">' +
            this.escapeHtml(message) +
            '</span><br/>' +
            '<button class="btn btn-sm btn-secondary" style="margin-top:1rem;" data-action="retry-search">' +
            '<i data-lucide="refresh-cw"></i> Odśwież</button></div>';
        const retryBtn = listDiv.querySelector('[data-action="retry-search"]');
        if (retryBtn) {
            retryBtn.addEventListener('click', () => this.searchOffers(this.buildSearchParams()));
        }
        setTimeout(() => {
            if (window.lucide) lucide.createIcons();
        }, 50);
    }

    /**
     * Rozwiązuje preset daty na przedział from-to
     */
    _resolveDatePreset(preset) {
        return window.resolveDatePreset(preset);
    }

    _closeDatePopover() {
        const popover = document.getElementById('pv-date-popover');
        if (popover) popover.style.display = 'none';
    }

    populateUserFilter() {
        const select = document.getElementById('pv-user-filter');
        if (!select) return;

        const offers = this.searchResults?.items || [];
        const userSet = new Map();
        for (const offer of offers) {
            const uid = offer.userId || offer.lastEditedBy || '';
            if (!uid || uid === '' || userSet.has(uid)) continue;
            let displayName = uid;
            if (window.globalUsersMap && window.globalUsersMap.has(uid))
                displayName = window.globalUsersMap.get(uid);
            userSet.set(uid, displayName);
        }

        const sorted = [...userSet.entries()].sort((a, b) => a[1].localeCompare(b[1], 'pl'));

        const prev = this.filters.user;
        select.innerHTML =
            '<option value="">Wszyscy</option>' +
            sorted
                .map(
                    ([id, name]) =>
                        `<option value="${this.escapeHtml(id)}">${this.escapeHtml(name)}</option>`
                )
                .join('');

        if (prev && userSet.has(prev)) {
            select.value = prev;
        } else if (prev) {
            let displayName = prev;
            if (window.globalUsersMap && window.globalUsersMap.has(prev))
                displayName = window.globalUsersMap.get(prev);
            select.innerHTML += `<option value="${this.escapeHtml(prev)}">${this.escapeHtml(displayName)}</option>`;
            select.value = prev;
        } else {
            this.filters.user = '';
            this.filters.myOffers = false;
        }
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
                    const hasModifiedOrder = orderList.some(
                        (ord) => this.getOrderChangeInfo(ord).changed
                    );

                    const badgeStateClass = hasModifiedOrder
                        ? 'btn-order-badge modified'
                        : 'btn-order-badge';
                    const countLabel = orderCount > 0 ? ` (${orderCount})` : '';

                    orderBadge = `<a href="javascript:void(0)" class="btn btn-sm ${badgeStateClass}" data-order-id="${this.escapeHtml(order?.id || '')}" data-offer-id="${this.escapeHtml(offer.id)}" data-offer-type="${this.escapeHtml(offer.type)}" title="Kliknij aby zobaczyć listę zamówień powiązanych z tą ofertą${hasModifiedOrder ? ' (wykryto zmiany)' : ''}">
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

                const isWell = offer.type === 'studnia_oferta' || !!offer.wells?.length;
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

                const clientNumber =
                    offer.clientNumber || (offer.data && offer.data.clientNumber) || '';
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
                                    <span class="offer-client">${clientInfo}${clientNumber ? ` <span class="client-nip">(${clientNumber})</span>` : ''}</span>
                                    ${investInfo ? `<span class="offer-separator">•</span><span class="offer-invest">${investInfo}</span>` : ''}
                                    ${creatorName ? `<span class="offer-separator">•</span><span class="author-badge"><i data-lucide="pen-tool" aria-hidden="true"></i> ${creatorName}</span>` : ''}
                                    ${userName ? `<span class="offer-separator">•</span><span class="author-badge${isClickable ? ' clickable-user' : ''}" ${isClickable ? `onclick="event.stopPropagation(); window.pvSalesUI.changeOfferUserFromList('${offer.id}')"` : ''}><i data-lucide="briefcase" aria-hidden="true"></i> ${userName}</span>` : ''}
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
                                        <button class="action-btn secondary" data-id="${offer.id}" data-type="${offer.type}" data-offer-id="${offer.id}" data-offer-type="${offer.type}" data-order-id="${hasOrder ? order?.id || '' : ''}" title="Wydruk" aria-label="Wydruk">
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

    _offerTypeForApi(displayType) {
        return window.offerTypeForApi(displayType);
    }

    async showOfferOrdersPopup(offerId, offerType) {
        const offerKey = this.normalizeId(offerId);

        let orders =
            offerKey && this.ordersMap.has(offerKey) ? [...this.ordersMap.get(offerKey)] : [];

        if (!orders || orders.length === 0) {
            try {
                const headers =
                    typeof authHeaders === 'function'
                        ? authHeaders()
                        : { 'Content-Type': 'application/json' };
                const apiType = offerType ? this._offerTypeForApi(offerType) : undefined;
                const resp = await fetch(
                    `/api/offers/search/orders?id=${encodeURIComponent(offerKey)}${apiType ? `&type=${apiType}` : ''}&t=${Date.now()}`,
                    { headers }
                );
                if (resp.ok) {
                    const json = await resp.json();
                    orders = json.data || [];
                    this.ordersMap.set(offerKey, orders);
                }
            } catch (e) {
                logger.warn('pvSalesUi', 'Błąd pobierania zamówień:', e);
            }
        }

        if (!orders || orders.length === 0) {
            showToast('Brak zamówień powiązanych z tą ofertą.', 'info');
            return;
        }

        // Odśwież search results — zaktualizuj _orderCount w pamięci
        let offerLabel = 'Oferta';
        const srOffer = this.searchResults?.items?.find((o) => this.normalizeId(o.id) === offerKey);
        if (srOffer) {
            srOffer._orderCount = orders.length;
            offerLabel = srOffer.number || srOffer.title || srOffer.offerName || 'Oferta';
        }
        this.renderResults();

        const resolvedType = offerType || 'studnia_oferta';

        let html = `
            <div class="modal-header">
                <h3 id="offer-orders-title">Zamówienia oferty ${offerLabel}</h3>
                <button class="btn-icon btn-close-x" aria-label="Zamknij" onclick="closeModal()"><i data-lucide="x" aria-hidden="true"></i></button>
            </div>
            <div style="margin-bottom:1rem; color:var(--text-muted); font-size:0.9rem;">Lista wszystkich zamówień przypisanych do tej oferty.</div>
            <div style="display:flex; flex-direction:column; gap:0.75rem; max-height:55vh; overflow-y:auto; padding-right:0.25rem;">
        `;

        orders.forEach((ord) => {
            const createdAt = ord.createdAt
                ? new Date(ord.createdAt).toLocaleDateString('pl-PL')
                : 'brak daty';
            const orderLabel = this.formatOrderLabel(ord);

            html += `
                <div style="display:flex; align-items:center; justify-content:space-between; gap:0.75rem; padding:0.85rem 0.8rem; border:1px solid rgba(148,163,184,0.15); border-radius:10px; background:rgba(15,23,42,0.855); box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);">
                    <div style="min-width:0;">
                        <div class="btn-open-order" data-order-id="${this.escapeHtml(ord.id)}" data-offer-type="${this.escapeHtml(resolvedType)}" style="font-weight:700; color:#38bdf8; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; max-width:260px; cursor:pointer; transition:all 0.2s ease;" title="Kliknij, aby otworzyć zamówienie w trybie edycji" onmouseenter="this.style.color='#7dd3fc'; this.style.textDecoration='underline';" onmouseleave="this.style.color='#38bdf8'; this.style.textDecoration='none';">${orderLabel}</div>
                        <div style="font-size:0.78rem; color:var(--text-muted); margin-top:0.25rem;">Utworzono: ${createdAt}</div>
                    </div>
                    <div style="display:flex; gap:0.4rem; flex-wrap:wrap; justify-content:flex-end;">
                        <button class="btn btn-sm btn-primary btn-open-order" data-order-id="${this.escapeHtml(ord.id)}" data-offer-type="${this.escapeHtml(resolvedType)}" style="padding:0.35rem 0.7rem; font-size:0.75rem;">Otwórz</button>
                        <button class="btn btn-sm btn-secondary btn-print-order" data-order-id="${this.escapeHtml(ord.id)}" data-offer-id="${this.escapeHtml(offerKey)}" data-offer-type="${this.escapeHtml(resolvedType)}" style="padding:0.35rem 0.7rem; font-size:0.75rem;">Karta</button>
                        <button class="btn btn-sm btn-secondary btn-modal-history-order" data-order-id="${this.escapeHtml(ord.id)}" style="padding:0.35rem 0.7rem; font-size:0.75rem;">Historia</button>
                        <button class="btn btn-sm btn-danger btn-modal-delete-order" data-order-id="${this.escapeHtml(ord.id)}" data-offer-type="${this.escapeHtml(resolvedType)}" style="padding:0.35rem 0.7rem; font-size:0.75rem;">Usuń</button>
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
            if (typeof window.lucide !== 'undefined') window.lucide.createIcons();
        } catch (err) {
            logger.error('pvSalesUi', 'Lucide icons error in showOfferOrdersPopup:', err);
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
                const offerId = buttonEl.getAttribute('data-offer-id');
                const offerType = buttonEl.getAttribute('data-offer-type');
                const relatedOrders =
                    this.ordersMap && offerId
                        ? [...(this.ordersMap.get(this.normalizeId(offerId)) || [])]
                        : null;
                openPrintModal(offerId, orderId, offerType, relatedOrders);
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
                const badgeOfferType = btn.getAttribute('data-offer-type');
                if (badgeOfferId)
                    await this.showOfferOrdersPopup(badgeOfferId, badgeOfferType || undefined);
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
                openPrintModal(printOfferId, printOrderId, printOfferType, printRelatedOrders);
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

            if (offerIdForOrder && this.ordersMap.has(offerIdForOrder)) {
                const list = this.ordersMap.get(offerIdForOrder);
                const idx = list.findIndex(
                    (o) => this.normalizeId(o.id) === this.normalizeId(orderId)
                );
                if (idx !== -1) list.splice(idx, 1);
                if (list.length === 0) this.ordersMap.delete(offerIdForOrder);
            }
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
                    logger.info('pvSalesUi', 'Odblokowywanie oferty:', offerWrapper.id);
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
            logger.error('pvSalesUi', 'Błąd podczas usuwania zamówienia:', error);
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

    getAuditContextLabel(type) {
        return auditGetContextLabel(this, type);
    }
    getAuditActionMeta(log) {
        return auditGetActionMeta(log);
    }
    getAuditFieldLabel(key) {
        return auditGetFieldLabel(key);
    }
    formatAuditValue(value) {
        return auditFormatValue(this, value);
    }
    getAuditSnapshotTitle(data, type) {
        return auditGetSnapshotTitle(this, data, type);
    }
    getAuditSnapshotSummary(data, type) {
        return auditGetSnapshotSummary(this, data, type);
    }
    getBusinessChanges(log) {
        return auditGetBusinessChanges(this, log);
    }
    renderAuditEntry(log, id, type) {
        return auditRenderEntry(this, log, id, type);
    }
    async showOfferHistoryUnified(id, type = 'studnia_oferta') {
        return auditShowHistory(this, id, type);
    }
    async loadMoreAuditLogs(entityType, entityId, limit) {
        return auditLoadMore(this, entityType, entityId, limit);
    }
    async restoreOfferVersionUnified(offerId, logId, type) {
        return auditRestoreVersion(this, offerId, logId, type);
    }
    showAuditSnapshotModal(data, type) {
        return auditShowSnapshotModal(this, data, type);
    }
    async viewHistorySnapshotUnified(id, logId, type) {
        return auditViewSnapshot(this, id, logId, type);
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
            const oldNumber = newOffer.number || newOffer.offerNumber || '';
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

                // Propagate opiekun change to associated order
                const normalizedId = this.normalizeId(offerId);
                const linkedOrders = this.ordersMap ? this.ordersMap.get(normalizedId) : null;
                const linkedOrder = Array.isArray(linkedOrders) ? linkedOrders[0] : linkedOrders;
                if (linkedOrder && linkedOrder.id) {
                    const offerType = offerWrapper.type || currentOffer.type;
                    const orderEndpoint =
                        offerType === 'studnia_oferta'
                            ? `/api/orders-studnie/${linkedOrder.id}`
                            : `/api/orders-rury/${linkedOrder.id}`;
                    try {
                        const patchResp = await fetch(orderEndpoint, {
                            method: 'PATCH',
                            headers,
                            body: JSON.stringify({
                                userId: currentOffer.userId,
                                userName: currentOffer.userName
                            })
                        });
                        if (!patchResp.ok) {
                            logger.warn('pvSalesUi', 'Odpowiedz PATCH opiekuna:', patchResp.status);
                        }
                    } catch (e) {
                        logger.error('pvSalesUi', 'Błąd aktualizacji opiekuna w zamówieniu:', e);
                    }
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
