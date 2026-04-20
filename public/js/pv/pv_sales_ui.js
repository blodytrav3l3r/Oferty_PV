// Version 2.0 - Order Management in Kartoteka
import { storageService } from '../shared/StorageService.js';

class PVSalesUI {
    constructor() {
        this.syncManager = null;
        this.allLocalOffers = []; // Store for filtering
        this.isSyncUpToDate = true;
        this.ordersMap = new Map(); // offerId -> order
        this.currentFilter = 'all'; // 'all', 'with_order', 'without_order'
        this.currentTypeFilter = 'all'; // 'all', 'offer', 'studnia_oferta'

        this.init();
    }

    /** Helper to normalize ID */
    normalizeId(id) {
        if (!id) return '';
        return String(id);
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

            this.initialized = true;
        } catch (error) {
            console.error('[PVSalesUI] Błąd inicjalizacji UI Sprzedaży:', error);
            const listDiv = document.getElementById('pv-local-offers-list');
            if (listDiv)
                listDiv.innerHTML = `<div style="text-align:center; padding:2rem; color:var(--text-danger);">Błąd ładowania ofert: ${error.message}</div>`;
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
            const response = await fetch(`/api/orders-studnie?t=${timestamp}`, { headers });
            if (!response.ok) return;

            const json = await response.json();
            const orders = json.data || [];

            this.ordersMap.clear();
            orders.forEach((order) => {
                const offId = order.offerId || order.offerStudnieId || order.offer_id;
                if (offId) {
                    this.ordersMap.set(this.normalizeId(offId), order);
                }
            });
            console.log(`[PVSalesUI] Załadowano ${this.ordersMap.size} zamówień.`);
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

        // 1. Sprawdź mapę zamówień (z API)
        if (offerId && this.ordersMap.has(offerId)) {
            return { hasOrder: true, order: this.ordersMap.get(offerId) };
        }

        // 2. Fallback: pola osadzone w samej ofercie
        if (offer.hasOrder && offer.orderId) {
            return {
                hasOrder: true,
                order: { id: offer.orderId, number: offer.orderNumber || '' }
            };
        }

        return { hasOrder: false, order: null };
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
                <span style="font-size:0.85rem; opacity:0.8;">${error.message || 'Wystąpił nieoczekiwany błąd sieciowy'}</span><br/>
                <button class="btn btn-sm btn-secondary" style="margin-top:1rem;" onclick="window.location.reload()">Odśwież stronę</button>
            </div>`;
        }
    }

    filterLocalOffers() {
        const input = document.getElementById('pv-local-search-input');
        const listDiv = document.getElementById('pv-local-offers-list');
        if (!input || !listDiv || !this.allLocalOffers) return;

        const query = input.value.trim().toLowerCase();

        // Update active status filter button UI
        document.querySelectorAll('.pv-filter-btn').forEach((btn) => {
            if (btn.dataset.filter === this.currentFilter) btn.classList.add('active');
            else btn.classList.remove('active');
        });

        const filtered = this.allLocalOffers.filter((offer) => {
            // Type Filter (kartoteka-level)
            if (this.currentTypeFilter !== 'all' && offer.type !== this.currentTypeFilter)
                return false;

            // Text Search
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

            // Status Filter
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

        // Update filter button UI
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
                const { hasOrder, order } = this.getOrderForOffer(offer);
                const orderBadge = hasOrder
                    ? `<a href="javascript:void(0)" class="btn-order-badge" data-order-id="${order.id || ''}" data-offer-type="${offer.type}" 
                    style="display:inline-flex; align-items:center; gap:0.4rem; padding:4px 10px; border-radius:6px; cursor:pointer;
                    background:rgba(16,185,129,0.15); border:1px solid rgba(16,185,129,0.4); color:#34d399; text-decoration:none;
                    font-size:0.75rem; font-weight:700; white-space:nowrap; transition:all 0.2s; box-shadow: 0 0 5px rgba(16,185,129,0.1);"
                    onmouseenter="this.style.background='rgba(16,185,129,0.25)'; this.style.transform='translateY(-1px)';"
                    onmouseleave="this.style.background='rgba(16,185,129,0.15)'; this.style.transform='translateY(0)';"
                    title="Kliknij aby edytować zamówienie${order.orderNumber ? ' ' + order.orderNumber : ''}">
                    <i data-lucide="package"></i> ZAMÓWIENIE${order.orderNumber ? ' ' + order.orderNumber : ''}
                   </a>`
                    : `<span style="background:rgba(100,116,139,0.1); color:#94a3b8; padding:4px 10px; border-radius:6px;
                    border:1px solid rgba(100,116,139,0.2); font-size:0.75rem; font-weight:600; white-space:nowrap;">Brak zamówienia</span>`;

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
                <div class="card offer-list-item" style="padding: 0.4rem 0.5rem 0.4rem 10px; border-radius: 8px; border: 1px solid var(--border-glass); background: var(--bg-card); display: flex; flex-direction: column; gap: 0.3rem; position: relative; overflow: hidden; box-shadow: 0 2px 4px rgba(0,0,0,0.1); margin-bottom: 0.2rem;">
                    
                    ${
                        hasOrder
                            ? `<div style="position: absolute; left: 0; top: 0; bottom: 0; width: 4px; background: #10b981;"></div>`
                            : `<div style="position: absolute; left: 0; top: 0; bottom: 0; width: 4px; background: #64748b;"></div>`
                    }

                    <!-- Row 1: Number (far left) + Data (center) + Price (far right) -->
                    <div style="display: grid; grid-template-columns: auto 1fr auto; align-items: center; gap: 0.8rem;">
                        <!-- LEFT: Icon + Number -->
                        <div style="display: flex; align-items: center; gap: 0.5rem;">
                            <span style="font-size: 1.2rem; line-height: 1; opacity: 0.9;" title="${isWell ? 'Studnie' : 'Rury'}">${icon}</span>
                            <h4 style="margin: 0; font-size: 1.05rem; font-weight: 700; color: var(--text-primary); white-space: nowrap;">
                                ${offer.number || offer.title || offer.offerName || 'Oferta bez numeru'}
                            </h4>
                        </div>

                        <!-- CENTER: Metadata -->
                        <div style="display: flex; align-items: center; gap: 0.8rem; overflow: hidden;">
                            <span style="background: var(--border-glass); width: 1px; height: 16px; flex-shrink: 0;"></span>
                            <div title="Klient" style="white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 250px; font-size: 0.82rem;">
                                <span style="opacity: 0.7;"><i data-lucide="building-2"></i></span> <span style="color: var(--text-primary); font-weight: 500;">${clientInfo}</span>
                            </div>
                            ${
                                investInfo
                                    ? `
                            <div title="Budowa" style="white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 250px; font-size: 0.82rem;">
                                <span style="opacity: 0.7;"><i data-lucide="hard-hat"></i></span> <span style="color: var(--text-primary); font-weight: 500;">${investInfo}</span>
                            </div>`
                                    : ''
                            }
                            <span style="font-size: 0.78rem; color: var(--text-muted); white-space: nowrap;"><i data-lucide="calendar"></i> ${dateStr}</span>
                            <span style="font-size: 0.78rem; color: var(--text-muted); white-space: nowrap;"><i data-lucide="package"></i> ${itemCount} ${isWell ? 'studni' : 'poz.'}</span>
                            ${(() => {
                                let html = '';
                                if (creatorName === userName && creatorName) {
                                    html = `<span style="font-size: 0.78rem; color: var(--text-muted); white-space: nowrap;" title="Autor i Opiekun oferty"><i data-lucide="user"></i>‍<i data-lucide="briefcase"></i> Autor/Opiekun: <strong style="color:var(--text-primary)">${creatorName}</strong></span>`;
                                } else {
                                    if (creatorName)
                                        html += `<span style="font-size: 0.78rem; color: #888; white-space: nowrap; margin-right: 0.5rem;" title="Autor oferty"><i data-lucide="pen-tool"></i>️ Autor: <strong style="color:var(--text-muted)">${creatorName}</strong></span>`;
                                    if (userName)
                                        html += `<span style="font-size: 0.78rem; color: var(--text-muted); white-space: nowrap;" title="Opiekun oferty"><i data-lucide="user"></i>‍<i data-lucide="briefcase"></i> Opiekun: <strong style="color:var(--text-primary)">${userName}</strong></span>`;
                                }
                                return html;
                            })()}
                        </div>

                        <!-- RIGHT: Price -->
                        <div style="font-size: 1.15rem; font-weight: 800; color: var(--accent-light); white-space: nowrap; text-align: right; padding-right: 0.2rem;" title="Wartość Netto">
                            ${typeof formatCurrency === 'function' ? formatCurrency(priceVal) : priceVal.toFixed(2) + ' PLN'}
                        </div>
                    </div>

                    <!-- Row 2: Order badge + Action buttons -->
                    <div style="display: flex; justify-content: space-between; align-items: center; gap: 0.5rem;">
                        <div style="display: flex; align-items: center; gap: 0.5rem; flex-shrink: 0;">
                            ${orderBadge}
                        </div>

                        <div style="display: flex; gap: 0.3rem; align-items: center; flex-wrap: nowrap; margin-left: auto;">
                            ${
                                isLocalList
                                    ? `
                                <button class="btn btn-sm btn-primary btn-edit-pv-offer" data-id="${offer.id}" data-type="${offer.type}" style="padding: 0.3rem 0.7rem; font-weight: 600; font-size: 0.75rem;" title="${hasOrder ? 'Oferta zablokowana przez zamówienie' : 'Edytuj ofertę'}" ${hasOrder ? 'disabled' : ''}><i data-lucide="pencil"></i> Edytuj</button>
                                <button class="btn btn-sm btn-copy-pv-offer" data-id="${offer.id}" style="background: rgba(14,165,233,0.1); border: 1px solid rgba(14,165,233,0.3); color: #0ea5e9; padding: 0.3rem 0.7rem; font-weight: 600; font-size: 0.75rem;" title="Skopiuj ofertę jako nową wersję"><i data-lucide="clipboard-list"></i> Wersja</button>
                                <button class="btn btn-sm btn-secondary btn-history-pv-offer" data-id="${offer.id}" data-type="${offer.type}" title="Historia zmian" style="padding: 0.3rem 0.7rem; font-weight: 600; font-size: 0.75rem;"><i data-lucide="hourglass"></i> Historia</button>
                                ${isAdminOrPro ? `<button class="btn btn-sm btn-secondary btn-change-owner" data-id="${offer.id}" style="padding: 0.3rem 0.7rem; font-weight: 600; font-size: 0.75rem;" title="Zmień opiekuna oferty"><i data-lucide="user"></i> Opiekun</button>` : ''}
                                <button class="btn btn-sm btn-secondary btn-export-pv-offer" data-id="${offer.id}" data-type="${offer.type}" style="background: rgba(99,102,241,0.1); border: 1px solid rgba(99,102,241,0.3); color: #818cf8; padding: 0.3rem 0.7rem; font-weight: 600; font-size: 0.75rem;" title="Wydruk oferty PDF/Word"><i data-lucide="printer"></i> Wydruk</button>
                                <span style="background: var(--border-glass); width: 1px; height: 16px; margin: 0 2px;"></span>
                                ${
                                    hasOrder
                                        ? `
                                    <button class="btn btn-sm btn-edit-order" data-order-id="${order.id || ''}" data-offer-type="${offer.type}" style="background: rgba(16,185,129,0.1); border: 1px solid rgba(16,185,129,0.3); color: #34d399; padding: 0.3rem 0.7rem; font-weight: 600; font-size: 0.75rem;" title="Edytuj zamówienie"><i data-lucide="package"></i> Zamówienie</button>
                                    <button class="btn btn-sm btn-history-order" data-order-id="${order.id || ''}" title="Historia zmian zamówienia" style="background: rgba(99,102,241,0.1); border: 1px solid rgba(99,102,241,0.3); color: #818cf8; padding: 0.3rem 0.7rem; font-weight: 600; font-size: 0.75rem;"><i data-lucide="hourglass"></i> Hist. Zam.</button>
                                    <button class="btn btn-sm btn-delete-order" data-order-id="${order.id || ''}" data-offer-type="${offer.type}" style="background: rgba(245,158,11,0.1); border: 1px solid rgba(245,158,11,0.3); color: #f59e0b; padding: 0.3rem 0.7rem; font-weight: 600; font-size: 0.75rem;" title="Usuń zamówienie i odblokuj ofertę"><i data-lucide="trash-2"></i> Usuń Zam.</button>
                                `
                                        : ''
                                }
                                ${
                                    offer.clientPhone
                                        ? `
                                    <span style="background: var(--border-glass); width: 1px; height: 16px; margin: 0 2px;"></span>
                                    <a href="tel:${offer.clientPhone}" class="btn btn-sm" style="background: rgba(16,185,129,0.1); border: 1px solid rgba(16,185,129,0.3); color: #34d399; text-decoration: none; padding: 0.3rem 0.7rem; font-weight: 600; font-size: 0.75rem;" title="Zadzwoń do klienta"><i data-lucide="phone"></i></a>
                                `
                                        : ''
                                }
                                <span style="background: var(--border-glass); width: 1px; height: 16px; margin: 0 2px;"></span>
                                <button class="btn btn-sm btn-delete-pv-offer" data-id="${offer.id}" style="background: rgba(239,68,68,0.1); border: 1px solid rgba(239,68,68,0.3); color: #ef4444; padding: 0.3rem 0.7rem; font-weight: 600; font-size: 0.75rem;" title="${hasOrder ? 'Nie można usunąć oferty z zamówieniem' : 'Trwale usuń ofertę'}" ${hasOrder ? 'disabled' : ''}><i data-lucide="trash-2"></i></button>
                            `
                                    : `
                                <button class="btn btn-sm btn-primary btn-view-pv-offer" data-id="${offer.id}" style="padding: 0.3rem 0.7rem; font-size: 0.75rem;">Szczegóły</button>
                            `
                            }
                        </div>
                    </div>
                </div>
            `;
            })
            .join('');
    }

    attachActionListeners(container) {
        const isKartoteka = (window.location.pathname.split('/').pop() || '').startsWith(
            'kartoteka'
        );

        // Edit Action
        container.querySelectorAll('.btn-edit-pv-offer').forEach((btn) => {
            btn.addEventListener('click', async (e) => {
                const btnEl = e.target.closest('button');
                const id = btnEl.getAttribute('data-id');
                const type = btnEl.getAttribute('data-type');

                // If we're in kartoteka (SPA iframe), delegate to parent router
                if (isKartoteka) {
                    try {
                        window.parent.SpaRouter.openOfferInModule(type, id, 'edit');
                    } catch (err) {
                        // Fallback: direct navigation
                        const target = type === 'studnia_oferta' ? 'studnie.html' : 'rury.html';
                        window.location.href = `${target}?edit=${id}`;
                    }
                    return;
                }

                const currentPage = window.location.pathname.split('/').pop() || 'index.html';

                if (type === 'studnia_oferta' && currentPage !== 'studnie.html') {
                    window.location.href = `studnie.html?edit=${id}`;
                    return;
                } else if (type === 'offer' && currentPage !== 'rury.html') {
                    window.location.href = `rury.html?edit=${id}`;
                    return;
                }

                try {
                    const doc = await storageService.getOfferById(id);
                    this.openOfferForEdit(doc, id, type);
                } catch (err) {
                    console.error('[PVSalesUI] Błąd pobierania do edycji:', err);
                }
            });
        });

        // Delete Order Action
        container.querySelectorAll('.btn-delete-order').forEach((btn) => {
            btn.addEventListener('click', async (e) => {
                const btnEl = e.target.closest('button');
                const orderId = btnEl.getAttribute('data-order-id');
                const offerType = btnEl.getAttribute('data-offer-type');

                if (offerType === 'studnia_oferta') {
                    this.deleteOrderUnified(orderId, offerType);
                } else {
                    console.warn('[PVSalesUI] Nieobsługiwany typ oferty dla usuwania zamówienia');
                    showToast(
                        'Funkcja usuwania zamówienia dla ofert PV zostanie wkrótce udostępniona.',
                        'info'
                    );
                }
            });
        });

        // History Action (Offer)
        container.querySelectorAll('.btn-history-pv-offer').forEach((btn) => {
            btn.addEventListener('click', (e) => {
                const btnEl = e.target.closest('button');
                const id = btnEl.getAttribute('data-id');
                const type = btnEl.getAttribute('data-type') || 'studnia_oferta';
                this.showOfferHistoryUnified(String(id), type);
            });
        });

        // History Action (Order)
        container.querySelectorAll('.btn-history-order').forEach((btn) => {
            btn.addEventListener('click', (e) => {
                const btnEl = e.target.closest('button');
                const orderId = btnEl.getAttribute('data-order-id');
                this.showOfferHistoryUnified(String(orderId), 'order');
            });
        });

        // Delete Action
        container.querySelectorAll('.btn-delete-pv-offer').forEach((btn) => {
            btn.addEventListener('click', async (e) => {
                const btnEl = e.target.closest('button');
                const id = btnEl.getAttribute('data-id');

                await this.deleteOfferWithConfirmation(id);
            });
        });

        // Copy Action
        container.querySelectorAll('.btn-copy-pv-offer').forEach((btn) => {
            btn.addEventListener('click', async (e) => {
                const btnEl = e.target.closest('button');
                const id = btnEl.getAttribute('data-id');
                await this.copyOfferWithVersion(id);
            });
        });

        // Order Badge Click — navigate to order editing
        container.querySelectorAll('.btn-order-badge, .btn-edit-order').forEach((badge) => {
            badge.addEventListener('click', (e) => {
                e.preventDefault();
                const orderId = badge.getAttribute('data-order-id');
                const offerType = badge.getAttribute('data-offer-type');

                if (!orderId) return;

                console.log(`[PVSalesUI] Opening order ${orderId} in module ${offerType}`);

                try {
                    if (window.parent && window.parent.SpaRouter) {
                        window.parent.SpaRouter.openOfferInModule(offerType, orderId, 'order');
                    } else if (window.SpaRouter) {
                        window.SpaRouter.openOfferInModule(offerType, orderId, 'order');
                    } else {
                        const targetModule = offerType === 'studnia_oferta' ? 'studnie' : 'rury';
                        window.location.href = `app.html#/${targetModule}?order=${orderId}`;
                    }
                } catch (err) {
                    console.error('[PVSalesUI] Błąd nawigacji do zamówienia:', err);
                    const targetModule = offerType === 'studnia_oferta' ? 'studnie' : 'rury';
                    window.location.href = `app.html#/${targetModule}?order=${orderId}`;
                }
            });
        });

        // Change Owner Action
        container.querySelectorAll('.btn-change-owner').forEach((btn) => {
            btn.addEventListener('click', async (e) => {
                const id = e.target.closest('button').getAttribute('data-id');
                this.changeOfferUserFromList(id);
            });
        });

        // Export Action
        container.querySelectorAll('.btn-export-pv-offer').forEach((btn) => {
            btn.addEventListener('click', (e) => {
                const buttonEl = e.target.closest('button');
                const id = buttonEl.getAttribute('data-id');
                const type = buttonEl.getAttribute('data-type');
                this.openExportPopupUnified(id, type);
            });
        });
    }

    openExportPopupUnified(id, type) {
        let overlay = document.getElementById('export-offer-modal');
        if (overlay) overlay.remove();

        overlay = document.createElement('div');
        overlay.className = 'modal-overlay active';
        overlay.id = 'export-offer-modal';
        overlay.style.display = 'flex';

        overlay.innerHTML = `
            <div class="modal" style="background:#1e293b; padding:1.5rem; border-radius:12px; border:1px solid #334155; width:350px; text-align:center; box-shadow:0 10px 25px rgba(0,0,0,0.5);">
                <h3 style="margin-bottom:1rem; color:#fff; font-size:1.1rem; font-weight:700;">Wydruk Oferty</h3>
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
                <button style="padding:0.5rem 1rem; border-radius:6px; background:rgba(255,255,255,0.05); border:1px solid rgba(255,255,255,0.1); color:var(--text-muted); cursor:pointer;" onclick="document.getElementById('export-offer-modal').remove()">Anuluj</button>
            </div>
        `;
        document.body.appendChild(overlay);
    }

    handleExportClick(id, type, format) {
        document.getElementById('export-offer-modal').remove();

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
        if (
            !(await appConfirm(
                'Czy na pewno chcesz USUNĄĆ to zamówienie?\n\nOferta zostanie odblokowana do ponownej edycji.',
                { title: 'Usuwanie zamówienia', type: 'danger', okText: 'Usuń' }
            ))
        ) {
            return;
        }

        try {
            const endpoint =
                offerType === 'studnia_oferta'
                    ? `/api/orders-studnie/${orderId}`
                    : `/api/orders-pv/${orderId}`;
            const headers =
                typeof authHeaders === 'function'
                    ? authHeaders()
                    : { 'Content-Type': 'application/json' };

            const response = await fetch(endpoint, { method: 'DELETE', headers });
            if (!response.ok) throw new Error('Nie udało się usunąć zamówienia z serwera');

            // Znajdź ofertę powiązaną z tym zamówieniem i zaktualizuj jej stan
            const offers = await storageService.getOffers([offerType]);
            const offerWrapper = offers.find(
                (o) =>
                    String(o.orderId) === String(orderId) ||
                    this.ordersMap.get(this.normalizeId(o.id))?.id === orderId
            );

            if (offerWrapper && offerWrapper.data) {
                console.log('[PVSalesUI] Odblokowywanie oferty:', offerWrapper.id);
                const rawOffer = offerWrapper.data; // To jest prawdziwy płaski obiekt zapisany pierwotnie przez aplikację

                // Upewnijmy się, że id i type są ustawione, żeby saveOffer zadziałał poprawnie
                rawOffer.id = offerWrapper.id;
                rawOffer.type = offerWrapper.type;
                rawOffer.state = offerWrapper.status === 'active' ? 'final' : 'draft';

                rawOffer.hasOrder = false;
                delete rawOffer.orderId;
                delete rawOffer.orderNumber;

                // Zapisujemy płaski, odkapsulowany obiekt
                await storageService.saveOffer(rawOffer);
            }

            if (typeof window.showToast === 'function') {
                window.showToast(
                    'Zamówienie zostało usunięte. Oferta jest ponownie edytowalna.',
                    'info'
                );
            }

            // Odśwież widok
            await this.loadOrdersMap();
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
                if (typeof window.showToast === 'function')
                    window.showToast('Brak historii dla tego elementu', 'info');
                return;
            }

            const overlay = document.createElement('div');
            overlay.className = 'modal-overlay';
            overlay.id = 'offer-history-modal';

            const formatter =
                typeof window.fmt === 'function'
                    ? window.fmt
                    : (val) => (val || 0).toFixed(2).replace('.', ',');

            const renderEntry = (log) => {
                const data = log.newData || {};
                const isDiff = data._diffMode === true;
                const isDelete = log.action === 'delete';

                let actionBadge = '';
                let contentHtml = '';
                let cardClass = '';

                if (isDelete) {
                    cardClass = 'action-delete';
                    actionBadge = `<span style="background:rgba(239,68,68,0.15); color:#f87171; padding:4px 10px; border-radius:6px; font-size:0.75rem; font-weight:800; letter-spacing:0.5px;"><i data-lucide="trash-2"></i> USUNIĘTO</span>`;
                    const old = log.oldData || {};
                    contentHtml = `<div style="color:#f87171; font-size:0.9rem;">Usunięty element${old.totalBrutto ? ` — wcześniej: <strong style="color:#fff;">${formatter(old.totalBrutto)} PLN</strong>` : ''}</div>`;
                } else if (log.action === 'create') {
                    cardClass = 'action-create';
                    actionBadge = `<span style="background:rgba(99,102,241,0.15); color:#818cf8; padding:4px 10px; border-radius:6px; font-size:0.75rem; font-weight:800; letter-spacing:0.5px;"><i data-lucide="sparkles"></i> UTWORZONO</span>`;
                    contentHtml = `<div style="font-size:1.2rem; font-weight:800; color:#f8fafc;"><i data-lucide="banknote"></i> ${formatter(data.totalBrutto || 0)} PLN</div>`;
                } else if (isDiff) {
                    cardClass = 'action-diff';
                    actionBadge = `<span style="background:rgba(251,191,36,0.15); color:#fbbf24; padding:4px 10px; border-radius:6px; font-size:0.75rem; font-weight:800; letter-spacing:0.5px;"><i data-lucide="edit"></i> EDYCJA (DIFF)</span>`;
                    const keys = Object.keys(data).filter((k) => k !== '_diffMode');
                    const changesHtml = keys
                        .map((k) => {
                            const oldVal =
                                log.oldData && log.oldData[k] !== undefined
                                    ? log.oldData[k]
                                    : '(brak)';
                            const newVal = data[k] !== undefined ? data[k] : '(brak)';
                            if (
                                k === 'totalBrutto' ||
                                k === 'totalNetto' ||
                                k.toLowerCase().includes('price') ||
                                k.toLowerCase().includes('cena')
                            ) {
                                return `<div class="diff-line"><strong class="diff-key">${k}</strong>: <span class="diff-old">${formatter(Number(oldVal))} PLN</span> <span style="color:var(--text-muted); font-size:0.8rem;"><i data-lucide="arrow-right"></i></span> <span class="diff-new">${formatter(Number(newVal))} PLN</span></div>`;
                            }
                            return `<div class="diff-line"><strong class="diff-key">${k}</strong>: <span class="diff-old">${JSON.stringify(oldVal)}</span> <span style="color:var(--text-muted); font-size:0.8rem;"><i data-lucide="arrow-right"></i></span> <span class="diff-new">${JSON.stringify(newVal)}</span></div>`;
                        })
                        .join('');
                    contentHtml = `<div class="diff-container">${changesHtml}</div>`;
                } else {
                    cardClass = 'action-update';
                    actionBadge = `<span style="background:rgba(16,185,129,0.15); color:#34d399; padding:4px 10px; border-radius:6px; font-size:0.75rem; font-weight:800; letter-spacing:0.5px;"><i data-lucide="save"></i> ZAPIS</span>`;
                    const oldPrice =
                        log.oldData && log.oldData.totalBrutto
                            ? formatter(log.oldData.totalBrutto)
                            : null;
                    const newPrice = formatter(data.totalBrutto || 0);
                    if (oldPrice && oldPrice !== newPrice) {
                        contentHtml = `<div style="font-size:1.2rem; font-weight:800; color:#f8fafc;"><i data-lucide="banknote"></i> <span style="text-decoration:line-through;color:var(--text-muted);font-size:0.95rem;font-weight:600;">${oldPrice}</span> <span style="color:var(--text-muted); font-size:0.9rem; margin:0 4px;"><i data-lucide="arrow-right"></i></span> ${newPrice} PLN</div>`;
                    } else {
                        contentHtml = `<div style="font-size:1.2rem; font-weight:800; color:#f8fafc;"><i data-lucide="banknote"></i> ${newPrice} PLN</div>`;
                    }
                }

                const restoreBtn =
                    !isDelete && !isDiff
                        ? `<button class="btn btn-sm btn-secondary restore-btn" onclick="window.pvSalesUI.restoreOfferVersionUnified('${id}', '${log.id}', '${type}')"><i data-lucide="refresh-cw"></i> Przywróć</button>`
                        : '';
                const previewBtn = `<button class="btn btn-sm btn-secondary preview-btn" onclick="window.pvSalesUI.viewHistorySnapshotUnified('${id}', '${log.id}', '${type}')"><i data-lucide="eye"></i>️ Podgląd</button>`;

                const buttonsHtml = `<div style="display:flex; gap:0.4rem;">${previewBtn}${restoreBtn}</div>`;

                return `
                    <div class="audit-card ${cardClass}">
                        <div class="audit-card-header">
                            <div style="display:flex; align-items:center; gap:0.6rem;">
                                ${actionBadge}
                                <span class="audit-date"><i data-lucide="calendar"></i> ${new Date(log.createdAt).toLocaleString()}</span>
                            </div>
                            <div class="audit-author">
                                <i data-lucide="user"></i>‍<i data-lucide="monitor"></i> <strong style="color:#e2e8f0;">${log.userName || 'System'}</strong>
                            </div>
                        </div>
                        <div class="audit-card-body">
                            <div class="audit-content">${contentHtml}</div>
                            <div class="audit-actions">${buttonsHtml}</div>
                        </div>
                    </div>
                `;
            };

            const historyHtml = logs.map(renderEntry).join('');
            const loadMoreHtml =
                logs.length < total
                    ? `<div id="audit-load-more-wrap-kartoteka" style="text-align:center; padding:1.5rem 0 0.5rem 0;">
                       <button class="load-more-btn" onclick="window.pvSalesUI.loadMoreAuditLogs('${type}', '${id}', 20)"><i data-lucide="scroll-text"></i> Załaduj starsze zmiany (${total - logs.length} pozostało)</button>
                   </div>`
                    : '';

            overlay.innerHTML = `
                <style>
                    .audit-modal-inner {
                        max-width: 800px; width: 95%; border-radius: 20px; max-height: 90vh; 
                        display: flex; flex-direction: column; background: #0f172a; 
                        box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.5); border: 1px solid rgba(255, 255, 255, 0.1);
                    }
                    .audit-card {
                        background: rgba(30, 41, 59, 0.6);
                        border: 1px solid rgba(255, 255, 255, 0.06);
                        border-radius: 16px;
                        padding: 1.25rem 1.5rem;
                        margin-bottom: 1rem;
                        position: relative;
                        overflow: hidden;
                        transition: all 0.2s ease;
                        backdrop-filter: blur(10px);
                    }
                    .audit-card:hover {
                        background: rgba(30, 41, 59, 0.9);
                        border-color: rgba(255, 255, 255, 0.15);
                        transform: translateY(-2px);
                        box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.3), 0 4px 6px -2px rgba(0, 0, 0, 0.15);
                    }
                    .audit-card::before {
                        content: ''; position: absolute; left: 0; top: 0; bottom: 0; width: 5px;
                    }
                    .audit-card.action-create::before { background: #818cf8; }
                    .audit-card.action-update::before { background: #34d399; }
                    .audit-card.action-diff::before { background: #fbbf24; }
                    .audit-card.action-delete::before { background: #f87171; }
                    
                    .audit-card-header {
                        display: flex; justify-content: space-between; align-items: center;
                        margin-bottom: 1rem; padding-bottom: 0.8rem; border-bottom: 1px solid rgba(255, 255, 255, 0.05);
                    }
                    .audit-date { font-size: 0.85rem; color: #94a3b8; font-weight: 500; }
                    .audit-author { font-size: 0.85rem; color: #cbd5e1; display:flex; align-items:center; gap:4px; }
                    
                    .audit-card-body {
                        display: flex; justify-content: space-between; align-items: center; gap: 1rem;
                    }
                    
                    .diff-container { display: flex; flex-direction: column; gap: 0.4rem; }
                    .diff-line { background: rgba(0,0,0,0.2); padding: 0.4rem 0.8rem; border-radius: 6px; font-size: 0.85rem; }
                    .diff-key { color: #f8fafc; font-weight: 600; font-family: monospace; }
                    .diff-old { color: #94a3b8; text-decoration: line-through; }
                    .diff-new { color: #34d399; font-weight: 700; }
                    
                    .restore-btn {
                        background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.1); 
                        color: #f8fafc; padding: 0.5rem 1rem; border-radius: 8px; font-weight: 600;
                        transition: all 0.2s; cursor: pointer;
                    }
                    .restore-btn:hover { background: rgba(52, 211, 153, 0.15); border-color: rgba(52, 211, 153, 0.3); color: #34d399; }
                    
                    .load-more-btn {
                        background: rgba(99,102,241,0.15); border: 1px solid rgba(99,102,241,0.3); 
                        color: #818cf8; font-weight: 700; padding: 0.6rem 1.5rem; border-radius: 30px;
                        cursor: pointer; transition: all 0.2s;
                    }
                    .load-more-btn:hover { background: rgba(99,102,241,0.3); transform: scale(1.05); }
                </style>
                <div class="modal audit-modal-inner">
                    <div class="modal-header" style="border-bottom:1px solid rgba(255,255,255,0.1); padding:1.2rem 1.5rem; background: rgba(255,255,255,0.02); border-radius: 20px 20px 0 0;">
                        <h3 style="font-weight:800; color:#fff; margin:0; display:flex; align-items:center; gap:0.5rem;">
                            <span style="font-size:1.4rem;">⌛</span> Oś Czasu Zmian (${total} wpisów)
                        </h3>
                        <button class="btn-icon" style="background:rgba(255,255,255,0.1); color:#fff; border-radius:50%; width:32px; height:32px; display:flex; align-items:center; justify-content:center;" onclick="document.getElementById('offer-history-modal').remove()"><i data-lucide="x"></i></button>
                    </div>
                    <div id="audit-logs-container-kartoteka" style="padding:1.5rem; overflow-y:auto; flex:1; scrollbar-width:thin;">
                        ${historyHtml}
                        ${loadMoreHtml}
                    </div>
                </div>
            `;
            document.body.appendChild(overlay);
            overlay.classList.add('active');
            overlay.addEventListener('click', (e) => {
                if (e.target === overlay) overlay.remove();
            });

            this.currentAuditLogs = logs;
            this.currentAuditOffset = logs.length;
            this._renderEntry = renderEntry;
        } catch (error) {
            console.error('[PVSalesUI] Błąd wyświetlania historii:', error);
            if (typeof window.showToast === 'function')
                window.showToast('Błąd pobierania historii', 'error');
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
                    <div id="audit-load-more-wrap-kartoteka" style="text-align:center; padding:0.8rem;">
                        <button class="btn btn-sm" style="background:rgba(99,102,241,0.15); border:1px solid rgba(99,102,241,0.3); color:#818cf8; font-weight:700; padding:0.4rem 1.2rem;"
                            onclick="window.pvSalesUI.loadMoreAuditLogs('${entityType}', '${entityId}', ${limit})"><i data-lucide="scroll-text"></i> Pokaż więcej (${remaining} pozostało)</button>
                    </div>
                `
                );
            }
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

            // Usuń modal z historią
            const modal = document.getElementById('offer-history-modal');
            if (modal) modal.remove();

            if (typeof window.showToast === 'function') {
                window.showToast('Wczytano wersję historyczną do testowego podglądu.', 'info');
            }

            // Wczytaj zrekonstruowaną pozycję do formularza edycyjnego (bez wywoływania zapisu)
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
            const newOffer = JSON.parse(JSON.stringify(offer));

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

            // Reload list
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
                const linkedOrder = this.ordersMap ? this.ordersMap.get(normalizedId) : null;
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
    // Initialize on kartoteka page (no nav-sales button, always visible)
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
