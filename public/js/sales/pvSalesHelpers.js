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

window.openPrintModal = openPrintModal;
window.offerMatchesUser = offerMatchesUser;
window.offerMatchesDate = offerMatchesDate;
window.resolveDatePreset = resolveDatePreset;
window.httpErrorMessage = httpErrorMessage;
window.offerTypeForApi = offerTypeForApi;
window.recalculateRuryTransportCost = recalculateRuryTransportCost;
window.computeOrderValueWithTransport = computeOrderValueWithTransport;
