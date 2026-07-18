// @ts-check
/* ===== ZAMÓWIENIA RUR — CRUD ===== */

let ordersRury = [];
let pendingOrderCreationData = null;

async function loadOrdersRury() {
    try {
        const res = await fetchWithTimeout('/api/orders-rury', { headers: authHeaders() });
        const json = await res.json();
        ordersRury = json.data || [];
        return ordersRury;
    } catch (err) {
        logger.error('orderCrud', 'Błąd ładowania zamówień rur:', err);
        return [];
    }
}

async function saveOrdersDataRury(data) {
    try {
        const res = await fetch('/api/orders-rury', {
            method: 'PUT',
            headers: authHeaders(),
            body: JSON.stringify({ data })
        });
        if (!res.ok) {
            const errBody = await res.json().catch(() => ({ error: 'Unknown error' }));
            throw new Error(errBody.error || `HTTP ${res.status}`);
        }
        return res;
    } catch (err) {
        logger.error('orderCrud', 'Błąd zapisu zamówień rur:', err);
        showToast('Błąd zapisu zamówień', 'error');
        throw err;
    }
}

function getOrdersForOffer(offerId) {
    if (!ordersRury || !offerId) return [];
    return ordersRury.filter((o) => o.offerId === offerId || o.id === offerId);
}
window.getOrdersForOffer = getOrdersForOffer;

async function createOrderFromOffer() {
    if (!editingOfferId) {
        showToast('Najpierw zapisz ofertę', 'error');
        return;
    }

    const number = document.getElementById('offer-number').value.trim();
    if (!number) {
        showToast('Błąd: Brak numeru oferty', 'error');
        return;
    }

    const offer = offers.find((o) => o.id === editingOfferId);
    if (!offer) {
        showToast('Nie znaleziono oferty', 'error');
        return;
    }

    if (!ordersRury || ordersRury.length === 0) {
        ordersRury = await loadOrdersRury();
    }
    const existingOrdersForOffer = getOrdersForOffer(offer.id);

    const selectedItems =
        typeof collectSelectedItemsForOrder === 'function' ? collectSelectedItemsForOrder() : [];
    if (selectedItems.length === 0) {
        showToast('Zaznacz co najmniej jeden produkt do zamówienia', 'warning');
        return;
    }

    let selectedItemsClone;
    try {
        selectedItemsClone = structuredClone(selectedItems);
    } catch (_e) {
        showToast('Nie można przetworzyć wybranych elementów', 'error');
        return;
    }

    pendingOrderCreationData = {
        offer,
        selectedItems: selectedItemsClone,
        kartaBudowyTemplateOrders: existingOrdersForOffer
    };

    if (typeof showSection === 'function') showSection('builder');
    if (typeof goToPhase === 'function') {
        goToPhase(4);
    }
}
window.createOrderFromOffer = createOrderFromOffer;

async function finalizeOrderFromOffer(offer, kartaBudowyData) {
    const orderId = 'order_rury_' + Date.now();
    const offerNumber = document.getElementById('offer-number')?.value?.trim() || '';

    const clientName = document.getElementById('client-name')?.value?.trim() || '';
    const clientNip = document.getElementById('client-nip')?.value?.trim() || '';
    const clientAddress = document.getElementById('client-address')?.value?.trim() || '';
    const clientContact = document.getElementById('client-contact')?.value?.trim() || '';
    const investName = document.getElementById('invest-name')?.value?.trim() || '';
    const investAddress = document.getElementById('invest-address')?.value?.trim() || '';
    const investContractor = document.getElementById('invest-contractor')?.value?.trim() || '';
    const notes = document.getElementById('offer-notes')?.value?.trim() || '';
    const transportKm = Number(document.getElementById('transport-km')?.value || 0);
    const transportRate = Number(document.getElementById('transport-rate')?.value || 0);

    const assignedUserId =
        (typeof editingOfferAssignedUserId !== 'undefined' && editingOfferAssignedUserId) ||
        (offer && offer.userId) ||
        (typeof currentUser !== 'undefined' && currentUser && currentUser.id) ||
        null;

    if (!assignedUserId) {
        showToast('Brak opiekuna oferty — nie można nadać numeru zamówienia', 'error');
        return;
    }

    let orderNumber = '';
    try {
        const claimResp = await fetch('/api/orders-rury/claim-rury-number/' + assignedUserId, {
            method: 'POST',
            headers: authHeaders()
        });
        const claimData = await claimResp.json();
        if (claimResp.ok && claimData.number) {
            orderNumber = claimData.number;
        } else {
            showToast('Błąd generowania numeru zamówienia: ' + (claimData.error || ''), 'error');
            return;
        }
    } catch (e) {
        showToast('Błąd połączenia przy generowaniu numeru zamówienia', 'error');
        return;
    }

    try {
        const snapshotItems = structuredClone(
            pendingOrderCreationData.selectedItems || getActiveItemsArray() || []
        );

        const orderedUids = new Set(snapshotItems.map((it) => it.uid).filter(Boolean));

        const orderItems = structuredClone(snapshotItems);
        orderItems.forEach((it) => {
            it.orderedQuantity = it.orderedQuantity || it.quantity || 0;
        });

        const orderData = {
            id: orderId,
            offerId: offer.id || editingOfferId,
            offerNumber: offerNumber,
            orderNumber: orderNumber,
            userId: assignedUserId,
            userName:
                (typeof editingOfferAssignedUserName !== 'undefined' &&
                    editingOfferAssignedUserName) ||
                (typeof currentUser !== 'undefined' &&
                    currentUser &&
                    (currentUser.username || '')) ||
                '',
            originalSnapshot: {
                items: snapshotItems,
                transportKm,
                transportRate,
                transportMode: currentRuryTransportMode || 'full'
            },
            clientName,
            clientNip,
            clientAddress,
            clientContact,
            investName,
            investAddress,
            investContractor,
            notes,
            transportKm,
            transportRate,
            transportMode: currentRuryTransportMode || 'full',
            items: orderItems,
            kartaBudowy: kartaBudowyData,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
            createdBy: currentUser ? currentUser.id : ''
        };

        if (!ordersRury) ordersRury = [];
        ordersRury.push(orderData);

        await saveOrdersDataRury(ordersRury);
        showToast('Zamówienie utworzone', 'success');

        if (window.pvSalesUI) {
            window.pvSalesUI.notifyOrderMutation();
        }

        editingRuryOrderId = orderId;
        window.editingRuryOrderId = orderId;
        pendingOrderCreationData = null;

        if (typeof enterRuryOrderEditMode === 'function') {
            enterRuryOrderEditMode(orderId);
        } else {
            if (typeof goToPhase === 'function') {
                goToPhase(5);
            }
            updateRuryOrderSummary(orderData);
        }
    } catch (err) {
        logger.error('orderCrud', 'Błąd tworzenia zamówienia:', err);
        showToast('Błąd tworzenia zamówienia', 'error');
    }
}

async function saveRuryOrder() {
    if (!editingRuryOrderId) {
        showToast('Brak aktywnego zamówienia do zapisania', 'error');
        return;
    }

    const orderIndex = (ordersRury || []).findIndex((o) => o.id === editingRuryOrderId);
    if (orderIndex === -1) {
        showToast('Nie znaleziono zamówienia w pamięci', 'error');
        return;
    }

    const orderData = ordersRury[orderIndex];
    orderData.items = structuredClone(orderCurrentItems || []);
    orderData.transportKm = Number(document.getElementById('transport-km')?.value || 0);
    orderData.transportRate = Number(document.getElementById('transport-rate')?.value || 0);
    orderData.transportMode = currentRuryTransportMode || 'full';
    orderData.updatedAt = new Date().toISOString();

    try {
        await saveOrdersDataRury(ordersRury);
        showToast('Zamówienie zaktualizowane', 'success');
        if (window.pvSalesUI) {
            window.pvSalesUI.notifyOrderMutation();
        }
        const savedOrder = ordersRury[orderIndex];
        if (typeof renderOrderModeBanner === 'function') renderOrderModeBanner(savedOrder);
        if (typeof updateRuryOrderSummary === 'function') updateRuryOrderSummary(savedOrder);
    } catch (err) {
        logger.error('orderCrud', 'Błąd zapisu zamówienia:', err);
        showToast('Błąd zapisu zamówienia', 'error');
    }
}
window.saveRuryOrder = saveRuryOrder;

window.saveOfferOrOrder = async function () {
    if (window.orderEditMode && editingRuryOrderId) {
        await saveRuryOrder();
    } else {
        await saveOffer();
    }
};
