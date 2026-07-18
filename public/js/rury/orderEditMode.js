// @ts-check
/* ===== ZAMÓWIENIA RUR — TRYB EDYCJI ===== */

let orderEditMode = false;
window.orderEditMode = false;
let editingRuryOrderId = null;
window.editingRuryOrderId = null;
let orderCurrentItems = [];
window.orderCurrentItems = orderCurrentItems;

function isOrderMode() {
    return orderEditMode;
}
window.isOrderMode = isOrderMode;

async function enterRuryOrderEditMode(orderId) {
    try {
        let orderData = (ordersRury || []).find((o) => o.id === orderId);
        if (!orderData) {
            if (!ordersRury || ordersRury.length === 0) await loadOrdersRury();
            orderData = (ordersRury || []).find((o) => o.id === orderId);
        }
        if (!orderData) {
            showToast('Nie znaleziono zamówienia', 'error');
            return;
        }

        orderEditMode = true;
        window.orderEditMode = true;
        editingRuryOrderId = orderId;
        window.editingRuryOrderId = orderId;
        document.getElementById('btn-order-create')?.style.setProperty('display', 'none');

        const setVal = (id, val) => {
            const el = document.getElementById(id);
            if (el && val !== undefined && val !== null) el.value = val;
        };

        setVal('client-name', orderData.clientName);
        setVal('client-nip', orderData.clientNip);
        setVal('client-address', orderData.clientAddress);
        setVal('client-contact', orderData.clientContact);
        setVal('invest-name', orderData.investName);
        setVal('invest-address', orderData.investAddress);
        setVal('invest-contractor', orderData.investContractor);
        setVal('offer-number', orderData.offerNumber);
        setVal('offer-notes', orderData.notes);
        setVal('transport-km', orderData.transportKm);
        setVal('transport-rate', orderData.transportRate);
        currentRuryTransportMode = orderData.transportMode || 'fractional';
        setVal('offer-date', orderData.date ? orderData.date.slice(0, 10) : '');
        setVal('offer-validity', orderData.validity || orderData.offerValidity);
        setVal('offer-payment-terms', orderData.paymentTerms);

        if (Array.isArray(orderData.items)) {
            orderCurrentItems = structuredClone(orderData.items);
        }

        if (orderData.kartaBudowy) {
            setTimeout(() => applyCopiedKartaBudowyData(orderData.kartaBudowy), 200);
        }

        if (orderData.offerId) editingOfferId = orderData.offerId;

        if (typeof showSection === 'function') showSection('builder');
        if (typeof renderOfferItems === 'function') renderOfferItems();
        if (typeof goToPhase === 'function') goToPhase(5);
        updateRuryOrderSummary(orderData);
        renderOrderModeBanner(orderData);
        if (typeof updateTransportCostSummary === 'function') updateTransportCostSummary();

        if (window.lucide) lucide.createIcons();

        document.title = `Zamówienie: ${orderData.orderNumber || orderData.offerNumber || orderId}`;
    } catch (err) {
        logger.error('orderEditMode', 'Błąd ładowania zamówienia:', err);
        showToast('Błąd ładowania zamówienia', 'error');
    }
}
window.enterRuryOrderEditMode = enterRuryOrderEditMode;

function exitOrderEditMode() {
    if (typeof clearOrderEditState === 'function') {
        clearOrderEditState();
    } else {
        orderEditMode = false;
        window.orderEditMode = false;
        editingRuryOrderId = null;
        window.editingRuryOrderId = null;
    }
    document.getElementById('btn-order-create')?.style.removeProperty('display');
    if (window.lucide) lucide.createIcons();
    if (typeof goToPhase === 'function') goToPhase(1);
    document.title = 'WITROS — Generator Ofert';
}
window.exitOrderEditMode = exitOrderEditMode;

function renderOrderModeBanner(orderData) {
    hideOrderModeBanner();
    const banner = document.createElement('div');
    banner.id = 'order-mode-banner';

    const changes = getRuryOrderChanges({
        ...orderData,
        items: orderCurrentItems || orderData.items,
        transportKm: Number(document.getElementById('transport-km')?.value || 0),
        transportRate: Number(document.getElementById('transport-rate')?.value || 0),
        transportMode: currentRuryTransportMode || 'full'
    });
    const changeCount = Object.keys(changes.items).filter(
        (k) => changes.items[k].type === 'modified'
    ).length;
    const hasChanges = changeCount > 0 || changes.transportChanged;
    const borderColor = hasChanges ? 'rgba(var(--danger-rgb),0.3)' : 'rgba(var(--success-rgb),0.3)';
    const bgColor = hasChanges ? 'rgba(var(--danger-rgb),0.08)' : 'rgba(var(--success-rgb),0.08)';
    const textColor = hasChanges ? 'var(--danger-hover)' : 'var(--success-hover)';
    banner.style.cssText = `border-radius:10px;padding:0.6rem 1rem;margin-bottom:1rem;display:flex;align-items:center;justify-content:space-between;border-width:2px;border-style:solid;border-color:${borderColor};background:${bgColor};`;
    banner.innerHTML =
        '<div style="display:flex;align-items:center;gap:0.75rem;">' +
        '<span style="font-size:1.3rem;"><i data-lucide="package"></i></span>' +
        '<div>' +
        '<span style="font-size:0.82rem;font-weight:800;color:' +
        textColor +
        ';">TRYB ZAMÓWIENIA — ' +
        escapeHtml(orderData.orderNumber || orderData.offerNumber || orderData.id || '') +
        '</span>' +
        '<div style="font-size:0.65rem;color:var(--text-muted);">' +
        (hasChanges
            ? '<i data-lucide="alert-triangle"></i> ' +
              changeCount +
              ' poz. zmienionych' +
              (changes.transportChanged ? ' + zmiana transportu' : '') +
              ' od oryginału'
            : '<i data-lucide="check-circle-2"></i> Bez zmian od oryginału') +
        ' &bull; Utworzono: ' +
        new Date(orderData.createdAt).toLocaleString('pl-PL') +
        '</div></div>' +
        '</div>';
    const indicator = document.querySelector('.wizard-indicator');
    if (indicator && indicator.parentNode) {
        indicator.parentNode.insertBefore(banner, indicator);
    }
    if (window.lucide) lucide.createIcons();
}
window.renderOrderModeBanner = renderOrderModeBanner;

function hideOrderModeBanner() {
    const el = document.getElementById('order-mode-banner');
    if (el) el.remove();
}

function renderStep2OrderBanner(orderData) {
    hideStep2OrderBanner();
    const banner = document.createElement('div');
    banner.id = 'step2-order-banner';
    banner.classList.add('badge-ok');
    banner.style.cssText =
        'border-radius:8px;padding:0.7rem 1rem;margin-bottom:1rem;display:flex;align-items:center;justify-content:space-between;gap:1rem;flex-wrap:wrap;';
    banner.innerHTML =
        '<div style="display:flex;align-items:center;gap:0.75rem;flex-wrap:wrap;">' +
        '<span style="font-size:1.3rem;">📦</span>' +
        '<span class="color-success fw-7">Dodajesz produkty do istniejącego zamówienia</span>' +
        '<span class="text-muted">|</span>' +
        '<span style="color:var(--text-muted);font-size:0.85rem;">Zamówienie: <strong style="color:var(--text);">' +
        escapeHtml(orderData.orderNumber || orderData.offerNumber || orderData.id || '\u2014') +
        '</strong></span>' +
        '<span style="color:var(--text-muted);font-size:0.82rem;">Po dodaniu produktów kliknij <strong style="color:var(--text);">Dalej</strong> aby przejść do podsumowania.</span>' +
        '</div>' +
        '<button class="btn btn-sm badge-ok" onclick="goToPhase(5)" style="padding:0.4rem 0.8rem;font-size:0.78rem;font-weight:600;border-radius:6px;cursor:pointer;">Powrót do zamówienia</button>';
    const step2 = document.getElementById('wizard-step-2');
    if (step2 && step2.firstChild) {
        step2.insertBefore(banner, step2.firstChild);
    } else if (step2) {
        step2.appendChild(banner);
    }
    if (window.lucide) lucide.createIcons();
}
window.renderStep2OrderBanner = renderStep2OrderBanner;

function hideStep2OrderBanner() {
    const el = document.getElementById('step2-order-banner');
    if (el) el.remove();
}
window.hideStep2OrderBanner = hideStep2OrderBanner;

function getCurrentRuryOrder() {
    if (window.orderEditMode && editingRuryOrderId) {
        return (ordersRury || []).find((o) => o.id === editingRuryOrderId) || null;
    }
    if (editingOfferId) {
        return (ordersRury || []).find((o) => o.offerId === editingOfferId) || null;
    }
    return null;
}
window.getCurrentRuryOrder = getCurrentRuryOrder;

function getRuryOrderChanges(order) {
    if (!order || !order.originalSnapshot) return { items: {}, transportChanged: false };
    const result = { items: {}, transportChanged: false };
    const snap = order.originalSnapshot;
    const snapItems = snap.items || [];
    const curItems = order.items || [];
    const maxLen = Math.max(snapItems.length, curItems.length);

    const curKm = Number(document.getElementById('transport-km')?.value || 0);
    const curRate = Number(document.getElementById('transport-rate')?.value || 0);
    const curMode = currentRuryTransportMode || 'full';

    const origKm = snap.transportKm;
    const origRate = snap.transportRate;
    const origMode = snap.transportMode || 'full';
    result.transportChanged =
        Math.abs((curKm || 0) - (origKm || 0)) > 0.01 ||
        Math.abs((curRate || 0) - (origRate || 0)) > 0.01 ||
        curMode !== origMode;

    let origTransportDist = {};
    if (typeof calculateTransportDistribution === 'function' && snapItems.length > 0) {
        const savedMode = currentRuryTransportMode;
        currentRuryTransportMode = origMode;
        const origCostPerTrip = (origKm || 0) * (origRate || 0);
        origTransportDist = calculateTransportDistribution(snapItems, origCostPerTrip);
        currentRuryTransportMode = savedMode;
    }
    const curTransportDist =
        typeof calculateTransportDistribution === 'function' && curItems.length > 0
            ? calculateTransportDistribution(curItems)
            : {};

    for (let i = 0; i < maxLen; i++) {
        if (i >= snapItems.length) {
            result.items[i] = { type: 'added' };
            continue;
        }
        if (i >= curItems.length) {
            result.items[i] = { type: 'removed' };
            continue;
        }
        const si = snapItems[i];
        const ci = curItems[i];

        const origBase =
            (si.unitPrice || 0) * (1 - (si.discount || 0) / 100) +
            (si.pehdCostPerUnit || 0) +
            (si.surcharge || 0);
        const origUnitTotal = origBase + (origTransportDist[si.productId] || 0);
        const curBase =
            (ci.unitPrice || 0) * (1 - (ci.discount || 0) / 100) +
            (ci.pehdCostPerUnit || 0) +
            (ci.surcharge || 0);
        const curUnitTotal = curBase + (curTransportDist[ci.productId] || 0);

        const priceDiff = Math.abs(curUnitTotal - origUnitTotal);
        const qtyDiff = Math.abs((ci.quantity || 0) - (si.quantity || 0));
        if (priceDiff > 0.01 || qtyDiff > 0) {
            result.items[i] = { type: 'modified', priceDiff };
        }
    }

    if (result.transportChanged) {
        for (let i = 0; i < curItems.length; i++) {
            if (!result.items[i] || result.items[i].type !== 'added') {
                if (result.items[i] && result.items[i].type === 'modified') {
                    result.items[i].fields = result.items[i].fields || [];
                    if (!result.items[i].fields.includes('transport')) {
                        result.items[i].fields.push('transport');
                    }
                } else {
                    result.items[i] = { type: 'modified', fields: ['transport'], priceDiff: 0 };
                }
            }
        }
    }

    return result;
}
window.getRuryOrderChanges = getRuryOrderChanges;

function clearOrderEditState() {
    orderEditMode = false;
    window.orderEditMode = false;
    editingRuryOrderId = null;
    window.editingRuryOrderId = null;
    orderCurrentItems = [];
    window.orderCurrentItems = orderCurrentItems;
    pendingOrderCreationData = null;
    if (typeof hideOrderModeBanner === 'function') hideOrderModeBanner();
}
window.clearOrderEditState = clearOrderEditState;

function syncOrderTableIfNeeded() {
    if (typeof currentWizardStep === 'undefined' || currentWizardStep !== 5) return;
    if (typeof updateRuryOrderSummary !== 'function') return;
    const order =
        window.orderEditMode && typeof getCurrentRuryOrder === 'function'
            ? getCurrentRuryOrder()
            : null;
    updateRuryOrderSummary(order);
}
window.syncOrderTableIfNeeded = syncOrderTableIfNeeded;
