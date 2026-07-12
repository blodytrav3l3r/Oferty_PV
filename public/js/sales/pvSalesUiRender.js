// @ts-check
/* ===== pvSalesUiRender.js — render/action mixin for PVSalesUI ===== */

export const pvSalesUiRenderMixin = {
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
    },

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
    },

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
};
