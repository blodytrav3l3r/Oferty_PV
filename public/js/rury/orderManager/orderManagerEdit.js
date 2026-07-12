// @ts-check
/* ===== ZAMÓWIENIA RUR — TRYB EDYCJI ZAMÓWIENIA ===== */

var orderEditMode = false;
window.orderEditMode = false;

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
        logger.error('orderManager', 'Błąd ładowania zamówienia:', err);
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
        escapeHtml(orderData.orderNumber || orderData.offerNumber || orderData.id || '—') +
        '</strong></span>' +
        '<span style="color:var(--text-muted);font-size:0.82rem;">Po dodaniu produktów kliknij <strong style="color:var(--text);">Dalej</strong> aby przejść do podsumowania.</span>' +
        '</div>' +
        '<button class="btn btn-sm badge-ok" data-action="navigateToPhase5" style="padding:0.4rem 0.8rem;font-size:0.78rem;font-weight:600;border-radius:6px;cursor:pointer;">Powrót do zamówienia</button>';
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
