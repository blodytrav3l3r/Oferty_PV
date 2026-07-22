// @ts-check
/* ===== Funkcje pomocnicze dla PV Sales UI ===== */

function isRuryOfferFromTypeOrId(offerType, offerId) {
    if (offerType === 'rura_oferta' || offerType === 'offer') return true;
    if (offerId && /^offer_rury_/.test(offerId)) return true;
    return false;
}

function openPrintModal(offerId, orderId, offerType, relatedOrders) {
    if (!offerId && !orderId) {
        if (typeof showToast === 'function')
            showToast('Brak identyfikatora oferty/zamówienia do wydruku', 'error');
        return;
    }
    const isRury = isRuryOfferFromTypeOrId(offerType, offerId);
    const safeOrderId = orderId || '';
    const safeRelatedOrders = Array.isArray(relatedOrders) ? relatedOrders : null;
    if (isRury && typeof window.showUniversalPrintModalRury === 'function') {
        window.showUniversalPrintModalRury(offerId, safeOrderId, safeRelatedOrders);
    } else if (typeof window.showUniversalPrintModal === 'function') {
        window.showUniversalPrintModal(offerId, safeOrderId, safeRelatedOrders);
    } else if (typeof showToast === 'function') {
        showToast('Funkcja wydruku nie jest dostępna w tym widoku.', 'info');
    }
}

function offerMatchesUser(offer, selectedUserId) {
    if (!selectedUserId) return true;
    const uid = offer.userId || offer.lastEditedBy || '';
    return uid === selectedUserId;
}

function offerMatchesDate(offer, dateFilter, boundaries) {
    if (dateFilter.mode === 'none') return true;
    if (!offer.createdAt) return false;
    const d = new Date(offer.createdAt);
    if (isNaN(d.getTime())) return false;

    if (dateFilter.mode === 'preset') {
        const ts = d.getTime();
        switch (dateFilter.preset) {
            case 'today':
                return ts >= boundaries.today.getTime() && ts < boundaries.todayEnd.getTime();
            case '7d':
                return ts >= boundaries.weekAgo.getTime();
            case '30d':
                return ts >= boundaries.monthAgo.getTime();
            case 'month': {
                const dLocal = new Date(d.getFullYear(), d.getMonth(), d.getDate());
                const monthStart = new Date(
                    boundaries.today.getFullYear(),
                    boundaries.today.getMonth(),
                    1
                );
                const monthEnd = new Date(
                    boundaries.today.getFullYear(),
                    boundaries.today.getMonth() + 1,
                    1
                );
                return (
                    dLocal.getTime() >= monthStart.getTime() &&
                    dLocal.getTime() < monthEnd.getTime()
                );
            }
        }
        return true;
    }

    if (dateFilter.from || dateFilter.to) {
        const dd = new Date(offer.createdAt);
        if (isNaN(dd.getTime())) return false;
        const y = dd.getFullYear();
        const m = String(dd.getMonth() + 1).padStart(2, '0');
        const day = String(dd.getDate()).padStart(2, '0');
        const dateStr = `${y}-${m}-${day}`;
        if (dateFilter.from && dateStr < dateFilter.from) return false;
        if (dateFilter.to && dateStr > dateFilter.to) return false;
    }
    return true;
}

function resolveDatePreset(preset) {
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const todayEnd = new Date(today.getTime() + 86400000);
    switch (preset) {
        case 'today':
            return { from: today.toISOString(), to: todayEnd.toISOString() };
        case '7d': {
            const weekAgo = new Date(today.getTime() - 6 * 86400000);
            return { from: weekAgo.toISOString(), to: todayEnd.toISOString() };
        }
        case '30d': {
            const monthAgo = new Date(today.getTime() - 29 * 86400000);
            return { from: monthAgo.toISOString(), to: todayEnd.toISOString() };
        }
        case 'month': {
            const monthStart = new Date(today.getFullYear(), today.getMonth(), 1);
            const monthEnd = new Date(today.getFullYear(), today.getMonth() + 1, 1);
            return { from: monthStart.toISOString(), to: monthEnd.toISOString() };
        }
        default:
            return { from: '', to: '' };
    }
}

function httpErrorMessage(status) {
    const msgs = {
        400: 'Nieprawidłowe żądanie',
        401: 'Sesja wygasła — zaloguj się ponownie',
        403: 'Brak uprawnień',
        429: 'Za dużo zapytań — spróbuj za chwilę',
        500: 'Błąd serwera',
        502: 'Serwer tymczasowo niedostępny',
        503: 'Serwer przeciążony'
    };
    return msgs[status] || `Błąd ${status}`;
}

function offerTypeForApi(displayType) {
    return displayType === 'studnia_oferta' ? 'studnie' : 'rury';
}

function recalculateRuryTransportCost(items, transportKm, transportRate) {
    const costPerTrip = (Number(transportKm) || 0) * (Number(transportRate) || 0);
    if (costPerTrip <= 0) return 0;
    const calcItems = (items || [])
        .filter((i) => !i.autoAdded && Number(i.weight) > 0 && Number(i.quantity) > 0)
        .map((i) => ({
            weight: Number(i.weight),
            transport: Number(i.transport),
            quantity: Number(i.quantity)
        }));
    if (calcItems.length === 0) return 0;
    const result = window.calculateTransportTrips(calcItems);
    return result.totalTrips * costPerTrip;
}

function computeOrderValueWithTransport(order, offerType) {
    if (!order) return 0;
    const isStudnie = offerType === 'studnia_oferta' || order.wells || order.wellsExport;
    if (isStudnie) {
        const exportData = order.wellsExport || (order.data && order.data.wellsExport);
        if (Array.isArray(exportData) && exportData.length > 0) {
            return exportData.reduce((sum, w) => sum + (Number(w.totalPrice) || 0), 0);
        }
        return Number(order.totalNetto || order.totalBrutto || 0);
    }
    const items = order.items || [];
    if (items.length === 0) {
        return Number(order.totalNetto || order.totalBrutto || 0);
    }
    const productsTotal = items.reduce((sum, item) => {
        const unitBase = (Number(item.unitPrice) || 0) * (1 - (Number(item.discount) || 0) / 100);
        const surcharge = Number(item.surcharge) || 0;
        const pehdCost = Number(item.pehdCostPerUnit) || 0;
        return sum + (unitBase + surcharge + pehdCost) * (Number(item.quantity) || 0);
    }, 0);
    const transportCost = window.recalculateRuryTransportCost(
        items,
        order.transportKm,
        order.transportRate
    );
    return productsTotal + transportCost;
}

function getOfferPrice(offer) {
    if (offer.type === 'studnia_oferta' || !!offer.wells?.length) {
        const exportData = offer.wellsExport || (offer.data && offer.data.wellsExport);
        if (exportData) return exportData.reduce((sum, w) => sum + (w.totalPrice || 0), 0);
    }
    let priceVal = offer.totalNetto || offer.totalBrutto || 0;
    if (!priceVal && offer.data) {
        if (offer.data.summary)
            priceVal =
                offer.data.summary.totalValue ||
                offer.data.summary.totalNetto ||
                offer.data.summary.totalBrutto ||
                0;
        else if (offer.data.costSummary) priceVal = offer.data.costSummary.totalValue || 0;
        else priceVal = offer.data.totalNetto || offer.data.totalBrutto || 0;
    }
    if (!priceVal && offer.price) priceVal = offer.price;
    return priceVal || 0;
}

function getOfferItemCount(offer) {
    const isWell = offer.type === 'studnia_oferta' || !!offer.wells?.length;
    if (isWell) return offer.wells?.length || offer.data?.wells?.length || 0;
    return offer.items?.length || offer.data?.items?.length || 0;
}

function resolveUserName(raw) {
    if (!raw) return '';
    if (window.globalUsersMap && window.globalUsersMap.has(raw))
        return window.globalUsersMap.get(raw);
    if (
        window.currentUser &&
        (raw === window.currentUser.username || raw === window.currentUser.id)
    )
        return window.currentUser.displayName || window.currentUser.username || raw;
    return raw;
}

function buildOrderModalHtml(orders, offerKey, resolvedType, offerLabel) {
    let html = `
            <div class="modal-header">
                <h3 id="offer-orders-title">Zamówienia oferty ${window.escapeHtml(offerLabel)}</h3>
                <button class="btn-icon btn-close-x" aria-label="Zamknij" onclick="closeModal()"><i data-lucide="x" aria-hidden="true"></i></button>
            </div>
            <div style="margin-bottom:1rem; color:var(--text-muted); font-size:0.9rem;">Lista wszystkich zamówień przypisanych do tej oferty.</div>
            <div style="display:flex; flex-direction:column; gap:0.75rem; max-height:55vh; overflow-y:auto; padding-right:0.25rem;">
        `;

    orders.forEach((ord) => {
        const createdAt = ord.createdAt
            ? new Date(ord.createdAt).toLocaleDateString('pl-PL')
            : 'brak daty';
        const orderLabel = window.escapeHtml(
            ord?.orderNumber ||
                ord?.offerNumber ||
                (ord?.id ? String(ord.id).substring(0, 8) : 'Zamówienie')
        );

        html += `
                <div style="display:flex; align-items:center; justify-content:space-between; gap:0.75rem; padding:0.85rem 0.8rem; border:1px solid rgba(148,163,184,0.15); border-radius:10px; background:rgba(15,23,42,0.855); box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);">
                    <div style="min-width:0;">
                        <div class="btn-open-order" data-order-id="${window.escapeHtml(ord.id)}" data-offer-type="${window.escapeHtml(resolvedType)}" style="font-weight:700; color:#38bdf8; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; max-width:260px; cursor:pointer; transition:all 0.2s ease;" title="Kliknij, aby otworzyć zamówienie w trybie edycji" onmouseenter="this.style.color='#7dd3fc'; this.style.textDecoration='underline';" onmouseleave="this.style.color='#38bdf8'; this.style.textDecoration='none';">${orderLabel}</div>
                        <div style="font-size:0.78rem; color:var(--text-muted); margin-top:0.25rem;">Utworzono: ${createdAt}</div>
                    </div>
                    <div style="display:flex; gap:0.4rem; flex-wrap:wrap; justify-content:flex-end;">
                        <button class="btn btn-sm btn-primary btn-open-order" data-order-id="${window.escapeHtml(ord.id)}" data-offer-type="${window.escapeHtml(resolvedType)}" style="padding:0.35rem 0.7rem; font-size:0.75rem;">Otwórz</button>
                        <button class="btn btn-sm btn-secondary btn-print-order" data-order-id="${window.escapeHtml(ord.id)}" data-offer-id="${window.escapeHtml(offerKey)}" data-offer-type="${window.escapeHtml(resolvedType)}" style="padding:0.35rem 0.7rem; font-size:0.75rem;">Karta</button>
                        <button class="btn btn-sm btn-secondary btn-modal-history-order" data-order-id="${window.escapeHtml(ord.id)}" style="padding:0.35rem 0.7rem; font-size:0.75rem;">Historia</button>
                        <button class="btn btn-sm btn-danger btn-modal-delete-order" data-order-id="${window.escapeHtml(ord.id)}" data-offer-type="${window.escapeHtml(resolvedType)}" style="padding:0.35rem 0.7rem; font-size:0.75rem;">Usuń</button>
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

    return html;
}

function buildOfferCardHtml(offer, hasOrder, orders, order, role, isLocalList) {
    const isAdminOrPro = role === 'admin' || role === 'pro';
    const orderList = orders && orders.length > 0 ? orders : [];
    const orderCount = orderList.length;

    let orderBadge = '';
    let orderItemsHtml = '';

    if (hasOrder) {
        const hasModifiedOrder = orderList.some((ord) => window.getOrderChangeInfo(ord).changed);

        const badgeStateClass = hasModifiedOrder ? 'btn-order-badge modified' : 'btn-order-badge';
        const countLabel = orderCount > 0 ? ` (${orderCount})` : '';

        orderBadge = `<a href="javascript:void(0)" class="btn btn-sm ${badgeStateClass}" data-order-id="${window.escapeHtml(order?.id || '')}" data-offer-id="${window.escapeHtml(offer.id)}" data-offer-type="${window.escapeHtml(offer.type)}" title="Kliknij aby zobaczyć listę zamówień powiązanych z tą ofertą${hasModifiedOrder ? ' (wykryto zmiany)' : ''}">
                    <i data-lucide="package" aria-hidden="true"></i> Zamówienia${countLabel}${hasModifiedOrder ? ' • zmiany' : ''}
                   </a>`;

        orderItemsHtml = orderList
            .map((ord) => {
                const label = window.escapeHtml(
                    ord?.orderNumber ||
                        ord?.offerNumber ||
                        (ord?.id ? String(ord.id).substring(0, 8) : 'Zamówienie')
                );
                const createdAt = ord.createdAt
                    ? new Date(ord.createdAt).toLocaleDateString('pl-PL')
                    : 'brak daty';
                const orderValue = window.computeOrderValueWithTransport(ord, offer.type);
                const changeInfo = window.getOrderChangeInfo(ord);
                return `
                                <div class="offer-order-row">
                                    <button class="offer-order-main btn-edit-order" data-order-id="${window.escapeHtml(ord.id)}" data-offer-type="${window.escapeHtml(offer.type)}" title="Edytuj zamówienie ${label}">
                                        <span class="offer-order-icon"><i data-lucide="package-check"></i></span>
                                        <span class="offer-order-text">
                                            <strong>${label} <span style="color: var(--success-hover); font-weight: 600;">• ${orderValue.toFixed(2)} PLN</span></strong>
                                            <small>${createdAt}${changeInfo.changed ? ' • zmienione względem oferty' : ''}</small>
                                        </span>
                                    </button>
                                    <div class="offer-order-actions">
                                        <button class="action-btn success btn-karta-budowy" data-id="${window.escapeHtml(offer.id)}" data-type="${window.escapeHtml(offer.type)}" data-order-id="${window.escapeHtml(ord.id)}" data-offer-id="${window.escapeHtml(offer.id)}" data-offer-type="${window.escapeHtml(offer.type)}" title="Karta budowy ${label}" aria-label="Karta budowy ${label}"><i data-lucide="clipboard-list" aria-hidden="true"></i></button>
                                        <button class="action-btn secondary btn-history-order" data-order-id="${window.escapeHtml(ord.id)}" title="Historia zmian zamówienia ${label}" aria-label="Historia zmian zamówienia ${label}"><i data-lucide="clock" aria-hidden="true"></i></button>
                                        <button class="action-btn danger btn-delete-order" data-order-id="${window.escapeHtml(ord.id)}" data-offer-type="${window.escapeHtml(offer.type)}" title="Usuń zamówienie ${label}" aria-label="Usuń zamówienie ${label}"><i data-lucide="trash-2" aria-hidden="true"></i></button>
                                    </div>
                                </div>`;
            })
            .join('');
    } else {
        orderBadge = `<span style="background:rgba(100,116,139,0.1); color:var(--text-secondary); padding:4px 10px; border-radius:6px;
                    border:1px solid rgba(100,116,139,0.2); font-size:0.75rem; font-weight:600; white-space:nowrap;">Brak zamówienia</span>`;
    }

    const dateStr = offer.createdAt ? new Date(offer.createdAt).toLocaleDateString('pl-PL') : '—';

    const isWell = offer.type === 'studnia_oferta' || !!offer.wells?.length;
    const priceVal = window.getOfferPrice(offer);
    const icon = isWell
        ? '<i data-lucide="cylinder"></i>'
        : '<i data-lucide="cylinder" class="lucide-rotate-n90"></i>';
    const itemCount = window.getOfferItemCount(offer);

    const dd = window.getOfferDisplayData(offer);
    const isClickable = role === 'admin' || role === 'pro';

    return `
                <div class="modern-offer-card" data-offer-id="${offer.id}">
                    <div class="offer-status-indicator ${hasOrder ? 'has-order' : 'no-order'}"></div>
                    <div class="offer-card-content">
                        <div class="offer-top-row">
                            <div class="offer-icon-wrapper">
                                ${icon}
                            </div>
                            <div class="offer-title-section">
                                <h3 class="offer-title">${offer.number || offer.title || offer.offerName || 'Oferta bez numeru'}</h3>
                                <div class="offer-subtitle">
                                    <span class="offer-client">${dd.clientInfo}${dd.clientNumber ? ` <span class="client-nip">(${dd.clientNumber})</span>` : ''}</span>
                                    ${dd.investInfo ? `<span class="offer-separator">•</span><span class="offer-invest">${dd.investInfo}</span>` : ''}
                                    ${dd.creatorName ? `<span class="offer-separator">•</span><span class="author-badge"><i data-lucide="pen-tool" aria-hidden="true"></i> ${dd.creatorName}</span>` : ''}
                                    ${dd.userName ? `<span class="offer-separator">•</span><span class="author-badge${isClickable ? ' clickable-user' : ''}" ${isClickable ? `onclick="event.stopPropagation(); window.pvSalesUI.changeOfferUserFromList('${escapeHtml(offer.id)}')"` : ''}><i data-lucide="briefcase" aria-hidden="true"></i> ${dd.userName}</span>` : ''}
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
}

function navigateToModule(offerType, entityId, mode) {
    const targetModule = offerType === 'studnia_oferta' ? 'studnie' : 'rury';
    try {
        if (window.parent?.SpaRouter) {
            window.parent.SpaRouter.openOfferInModule(offerType, entityId, mode);
        } else if (window.SpaRouter) {
            window.SpaRouter.openOfferInModule(offerType, entityId, mode);
        } else {
            window.location.href = `app.html#/${targetModule}?${mode}=${entityId}`;
        }
    } catch (err) {
        logger.error('pvSalesUi', 'Błąd nawigacji:', err);
        window.location.href = `app.html#/${targetModule}?${mode}=${entityId}`;
    }
}

function getOfferDisplayData(offer) {
    const clientNumber = offer.clientNumber || (offer.data && offer.data.clientNumber) || '';
    const clientInfo = offer.clientName || (offer.data && offer.data.clientName) || 'Brak danych';
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
        offer.createdByUserName || (offer.data && offer.data.createdByUserName) || rawUserName;
    return {
        clientNumber,
        clientInfo,
        investInfo,
        userName: resolveUserName(rawUserName),
        creatorName: resolveUserName(rawCreatorName)
    };
}

function getOrderChangeInfo(order) {
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
        const snapTransport = window.recalculateRuryTransportCost(
            snapItems,
            snap.transportKm,
            snap.transportRate
        );
        const totalCurrent = window.computeOrderValueWithTransport(order);
        changed = Math.abs(totalCurrent - (snapProductTotal + snapTransport)) > 0.01;
    }
    return { changed, currentPrice, originalPrice };
}

window.openPrintModal = openPrintModal;
window.offerMatchesUser = offerMatchesUser;
window.offerMatchesDate = offerMatchesDate;
window.resolveDatePreset = resolveDatePreset;
window.httpErrorMessage = httpErrorMessage;
window.offerTypeForApi = offerTypeForApi;
window.recalculateRuryTransportCost = recalculateRuryTransportCost;
window.computeOrderValueWithTransport = computeOrderValueWithTransport;
window.getOfferPrice = getOfferPrice;
window.getOfferItemCount = getOfferItemCount;
window.resolveUserName = resolveUserName;
window.navigateToModule = navigateToModule;
window.buildOrderModalHtml = buildOrderModalHtml;
window.buildOfferCardHtml = buildOfferCardHtml;
window.getOfferDisplayData = getOfferDisplayData;
window.getOrderChangeInfo = getOrderChangeInfo;
