// @ts-check
/* ===== ZAMÓWIENIA STUDNI — CRUD (barrel) ===== */

async function deleteOrderStudnie(orderId) {
    const order = ordersStudnie ? ordersStudnie.find((o) => o.id === orderId) : null;
    if (order) {
        const acceptedPOs = (productionOrders || []).filter(
            (po) => po.offerId === order.offerId && po.status === 'accepted'
        );
        if (acceptedPOs.length > 0) {
            showToast(
                '<i data-lucide="x-circle"></i> Nie można usunąć zamówienia — zawiera zaakceptowane zlecenia produkcyjne. Najpierw cofnij ich akceptację.',
                'error'
            );
            return;
        }
    }

    if (
        !(await appConfirm('Czy na pewno usunąć to zamówienie?', {
            title: 'Usuwanie zamówienia',
            type: 'danger'
        }))
    )
        return;

    try {
        const res = await fetch(`/api/orders-studnie/${orderId}`, {
            method: 'DELETE',
            headers: typeof authHeaders === 'function' ? authHeaders() : {}
        });
        if (!res.ok) {
            const errData = await res.json().catch(() => ({}));
            showToast(errData.error || 'Błąd usuwania zamówienia', 'error');
            return;
        }
    } catch (e) {
        logger.error('orderManager', 'Błąd usuwania zamówienia przez API:', e);
        showToast('Błąd połączenia z serwerem', 'error');
        return;
    }

    let affectedOfferId = null;
    if (order) {
        affectedOfferId = normalizeId(order.offerId);
    }
    if (ordersStudnie) {
        ordersStudnie = ordersStudnie.filter((o) => o.id !== orderId);
        await saveOrdersDataStudnie(ordersStudnie);
    }
    renderSavedOffersStudnie();
    showToast('Zamówienie usunięte. Studnie odblokowane do ponownego zamówienia.', 'info');

    if (typeof renderWellConfig === 'function') renderWellConfig();

    if (affectedOfferId && editingOfferIdStudnie === affectedOfferId) {
        refreshAll();
    }

    if (window.pvSalesUI) {
        window.pvSalesUI
            .loadOrdersMap()
            .then(() => window.pvSalesUI.filterLocalOffers())
            .catch((e) => logger.error('orderManager', e));
    }
}

async function enterOrderEditMode(orderId) {
    try {
        logger.info('orderManager', '[enterOrderEditMode] START orderId=', orderId);
        const res = await fetchWithTimeout(
            `/api/orders-studnie/${orderId}`,
            { headers: authHeaders() },
            15000
        );
        if (!res.ok) {
            showToast('Zamówienie nie znalezione', 'error');
            return;
        }
        const json = await res.json();
        const order = json.data;
        if (!order) {
            showToast('Zamówienie nie znalezione', 'error');
            return;
        }

        logger.info(
            'orderManager',
            '[enterOrderEditMode] order loaded, wells count:',
            order.wells ? order.wells.length : 'NO WELLS'
        );

        orderEditMode = { orderId: order.id, order: order };
        editingOfferIdStudnie = order.offerId || null;
        window.isPreviewMode = false;

        visiblePrzejsciaTypes.clear();
        (order.visiblePrzejsciaTypes || []).forEach(function (t) {
            visiblePrzejsciaTypes.add(t);
        });

        wells = Array.isArray(order.wells) ? structuredClone(order.wells) : [];
        migrateWellData(wells);

        if (order.wellDiscounts) {
            window.wellDiscounts = structuredClone(order.wellDiscounts);
        } else {
        }

        if (order.wells && order.wells.length > 0) {
            const offer = offersStudnie ? offersStudnie.find((o) => o.id === order.offerId) : null;
            let _w = 0,
                _t = 0;
            order.wells.forEach((w) => {
                const s = calcWellStats(w);
                _w += s.price;
                _t += s.weight;
            });
            const km = parseFloat(order.transportKm || offer?.transportKm) || 0;
            const rate = parseFloat(order.transportRate || offer?.transportRate) || 0;
            const _mode = order.transportMode || offer?.transportMode || 'full';
            let tc = 0;
            if (km > 0 && rate > 0 && _t > 0) {
                const _offerTotalWeight = offer?.totalWeight || _t;
                const _fullOfferCost =
                    (typeof calcTransportCount === 'function'
                        ? calcTransportCount(_offerTotalWeight, _mode)
                        : Math.ceil(_offerTotalWeight / MAX_TRANSPORT_WEIGHT)) *
                    km *
                    rate;
                tc = _offerTotalWeight > 0 ? _fullOfferCost * (_t / _offerTotalWeight) : 0;
            }
            order.totalNetto = _w + tc;
            order.totalBrutto = (_w + tc) * 1.23;
        }

        wells.forEach((w) => {
            if (!Array.isArray(w.config)) w.config = [];
            if (!Array.isArray(w.przejscia)) w.przejscia = [];
            if (typeof syncKineta === 'function') syncKineta(w);
        });

        logger.info('orderManager', '[enterOrderEditMode] wells migrated, count:', wells.length);

        wells.forEach((w) => {
            if (w.przejscia) {
                w.przejscia.forEach((pr) => {
                    const prod = studnieProducts.find((p) => p.id === pr.productId);
                    if (prod && prod.category) {
                        visiblePrzejsciaTypes.add(prod.category);
                    }
                });
            }
        });

        wellCounter = wells.length;
        currentWellIndex = 0;

        const setVal = (id, val) => {
            const el = document.getElementById(id);
            if (el) el.value = val;
        };
        setVal('offer-number', order.number || '');
        setVal('offer-date', order.date || new Date().toISOString().slice(0, 10));
        setVal('client-name', order.clientName || '');
        setVal('client-nip', order.clientNip || '');
        setVal('client-address', order.clientAddress || '');
        setVal('client-contact', order.clientContact || '');
        setVal('invest-name', order.investName || '');
        setVal('invest-address', order.investAddress || '');
        setVal('invest-contractor', order.investContractor || '');

        setVal('transport-km', order.transportKm ?? 100);
        setVal('transport-rate', order.transportRate ?? 10);
        currentTransportMode = order.transportMode || 'full';

        logger.info(
            'orderManager',
            '[enterOrderEditMode] fields filled, calling skipWizardToStep3...'
        );

        wizardConfirmedParams = new Set(WIZARD_REQUIRED_PARAMS);
        currentWizardStep = 5;
        document.querySelectorAll('.wizard-step').forEach((s) => s.classList.remove('active'));
        const target = document.getElementById('wizard-step-3');
        if (target) target.classList.add('active');
        if (typeof updateWizardIndicator === 'function') updateWizardIndicator();
        if (typeof updateWizardSummaryBar === 'function') updateWizardSummaryBar();

        const layout = document.querySelector('.well-app-layout');
        if (layout) layout.classList.remove('intro-mode');

        showSection('builder');

        logger.info('orderManager', '[enterOrderEditMode] calling refreshAll...');
        refreshAll();

        logger.info('orderManager', '[enterOrderEditMode] calling renderOrderModeBanner...');
        renderOrderModeBanner();
        if (typeof renderOfferLockBanner === 'function') renderOfferLockBanner();

        document.title = `📦 Zamówienie: ${order.number || orderId}`;

        logger.info('orderManager', '[enterOrderEditMode] DONE');
        showToast('<i data-lucide="package"></i> Zamówienie wczytane do edycji', 'success');
    } catch (err) {
        logger.error('orderManager', 'Błąd ładowania zamówienia:', err);
        logger.error('orderManager', 'Stack:', err.stack);
        showToast('Błąd ładowania zamówienia: ' + err.message, 'error');
    }
}

async function loadOrderSnapshot(rebuiltData, orderId) {
    try {
        const order = rebuiltData;
        orderEditMode = { orderId: orderId, order: order };
        editingOfferIdStudnie = order.offerId || null;

        visiblePrzejsciaTypes.clear();
        (order.visiblePrzejsciaTypes || []).forEach(function (t) {
            visiblePrzejsciaTypes.add(t);
        });

        if (order.wellDiscounts) {
            window.wellDiscounts = structuredClone(order.wellDiscounts);
        } else {
            window.wellDiscounts = {};
        }

        wells = Array.isArray(order.wells) ? structuredClone(order.wells) : [];
        if (typeof migrateWellData === 'function') migrateWellData(wells);
        wells.forEach((w) => {
            if (!Array.isArray(w.config)) w.config = [];
            if (!Array.isArray(w.przejscia)) w.przejscia = [];

            if (typeof syncKineta === 'function') syncKineta(w);

            if (w.przejscia) {
                w.przejscia.forEach((pr) => {
                    const prod =
                        typeof studnieProducts !== 'undefined'
                            ? studnieProducts.find((p) => p.id === pr.productId)
                            : null;
                    if (prod && prod.category) visiblePrzejsciaTypes.add(prod.category);
                });
            }
        });

        wellCounter = wells.length > 0 ? wells.length : 1;
        currentWellIndex = 0;

        const setVal = (id, val) => {
            const el = document.getElementById(id);
            if (el) el.value = val;
        };
        setVal('offer-number', order.number || '');
        setVal('offer-date', order.date || new Date().toISOString().slice(0, 10));
        setVal('client-name', order.clientName || '');
        setVal('client-nip', order.clientNip || '');
        setVal('client-address', order.clientAddress || '');
        setVal('client-contact', order.clientContact || '');
        setVal('invest-name', order.investName || '');
        setVal('invest-address', order.investAddress || '');
        setVal('invest-contractor', order.investContractor || '');

        if (typeof skipWizardToStep3 === 'function') skipWizardToStep3();
        if (typeof showSection === 'function') showSection('builder');
        if (typeof refreshAll === 'function') refreshAll();

        renderOrderModeBanner();
        document.title = `👁️ PODGLĄD Zamówienia: ${order.number || orderId}`;

        window.applyPreviewLockUI();
    } catch (err) {
        window.isPreviewMode = false;
        logger.error('orderManager', 'Błąd ładowania podglądu zamówienia:', err);
        showToast('Błąd ładowania podglądu zamówienia', 'error');
    }
}

window.loadOrdersStudnie = loadOrdersStudnie;
window.saveOrdersDataStudnie = saveOrdersDataStudnie;
window.freezeWellPrices = freezeWellPrices;
window.createOrderFromOffer = createOrderFromOffer;
window.finalizeOrderFromOffer = finalizeOrderFromOffer;
window.saveOrderStudnie = saveOrderStudnie;
window.saveCurrentOrder = saveCurrentOrder;
window.deleteOrderStudnie = deleteOrderStudnie;
window.enterOrderEditMode = enterOrderEditMode;
window.loadOrderSnapshot = loadOrderSnapshot;
