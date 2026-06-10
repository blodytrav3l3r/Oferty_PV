/* ===== ZAMÓWIENIA RUR ===== */
let ordersRury = [];
let pendingOrderCreationData = null;
let _customPrzejscieRows = [];
let _offerPrzejscieRows = [];
let _przejsciaInitialized = false;
let orderCurrentItems = [];

function getActiveItemsArray() {
    return window.orderEditMode ? orderCurrentItems : currentOfferItems;
}
window.getActiveItemsArray = getActiveItemsArray;
window.orderCurrentItems = orderCurrentItems;

function isItemInAnyOrder(uid) {
    if (!uid) return false;
    if (typeof ordersRury === 'undefined' || !ordersRury) return false;
    const offerId = window.editingOfferId;
    if (!offerId) return false;
    return ordersRury.some((o) =>
        o && o.offerId === offerId &&
        Array.isArray(o.items) &&
        o.items.some((it) => it && it.uid === uid)
    );
}
window.isItemInAnyOrder = isItemInAnyOrder;

function isItemLocked(item) {
    if (!item) return false;
    if (window.orderEditMode) return false;
    return isItemInAnyOrder(item.uid);
}
window.isItemLocked = isItemLocked;

async function loadOrdersRury() {
    try {
        const res = await fetchWithTimeout('/api/orders-rury', { headers: authHeaders() });
        const json = await res.json();
        ordersRury = json.data || [];
        return ordersRury;
    } catch (err) {
        logger.error('orderManager', 'Błąd ładowania zamówień rur:', err);
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
        logger.error('orderManager', 'Błąd zapisu zamówień rur:', err);
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

    // Zbierz zaznaczone pozycje
    const selectedItems = typeof collectSelectedItemsForOrder === 'function'
        ? collectSelectedItemsForOrder()
        : [];
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

function collectKartaBudowyDataStep4() {
    const getVal = (id) => document.getElementById(id)?.value?.trim() || '';
    const getSelectVal = (id) => document.getElementById(id)?.value || '';

    const kartaBudowy = {
        emailFaktura: getVal('step4-email-faktura'),
        emailEfaktura: getVal('step4-email-efaktura'),
        offerNumbers: getVal('step4-offer-nr-input'),
        adresWysylki: getVal('step4-adres-wysylki'),
        warunkiPlatnosci: getSelectVal('step4-warunki-platnosci'),
        iloscDni: getVal('step4-ilosc-dni'),
        ubezpieczenie: getVal('step4-ubezpieczenie'),
        osobaKontakt: getVal('step4-osoba-kontakt'),
        zabezpieczenieTransportu: getSelectVal('step4-zabezpieczenie-transportu'),
        rodzajTransportu: getSelectVal('step4-rodzaj-transportu'),
        wyliczonyTransport: getVal('step4-wyliczony-transport'),
        rodzajStopni: getSelectVal('step4-rodzaj-stopni'),
        rodzajStopniInne: getVal('step4-rodzaj-stopni-inne'),
        rodzajStudni: getSelectVal('step4-rodzaj-studni'),
        uszczelkaStudni: getSelectVal('step4-uszczelka-studni'),
        uszczelkaStudniInne: getVal('step4-uszczelka-studni-inne'),
        kineta: getSelectVal('step4-kineta'),
        kinetaInne: getVal('step4-kineta-inne'),
        wysokoscSpocznika: getSelectVal('step4-wysokosc-spocznika'),
        usytuowanie: getSelectVal('step4-usytuowanie'),
        kaskada: getSelectVal('step4-kaskada'),
        kaskadaUwagi: getVal('step4-kaskada-uwagi'),
        slepaKineta: getSelectVal('step4-slepa-kineta'),
        slepaKinetaUwagi: getVal('step4-slepa-kineta-uwagi'),
        redukcjaKinety: getSelectVal('step4-redukcja-kinety'),
        przejsciaTulejowe: getSelectVal('step4-przejscia-tulejowe'),
        przejsciaSzczelne: getSelectVal('step4-przejscia-szczelne'),
        przejsciaZamowione: getSelectVal('step4-przejscia-zamowione'),
        dataZamowienia: getVal('step4-data-zamowienia'),
        wlasciwosciBetonu: getSelectVal('step4-wlasciwosci-betonu'),
        pozostaleWlasciwosci: getVal('step4-pozostale-wlasciwosci'),
        przejsciaDetails: collectPrzejsciaDetailsFromTable(),
        uwagiOgolne: getVal('step4-uwagi-ogolne'),
        createdAt: new Date().toISOString()
    };

    return kartaBudowy;
}

function initKartaBudowyStep4(primaryOfferNumber) {
    const offerInput = document.getElementById('step4-offer-nr-input');
    const adresWysylkiInput = document.getElementById('step4-adres-wysylki');
    const osobaKontaktInput = document.getElementById('step4-osoba-kontakt');
    const emailFakturaInput = document.getElementById('step4-email-faktura');

    // Uzupełnij dane z oferty
    const offerNumber = document.getElementById('offer-number')?.value?.trim() || '';
    if (offerInput) offerInput.value = primaryOfferNumber || offerNumber;

    const clientName = document.getElementById('client-name')?.value?.trim() || '';
    const clientAddress = document.getElementById('client-address')?.value?.trim() || '';
    const clientContact = document.getElementById('client-contact')?.value?.trim() || '';

    if (adresWysylkiInput && !adresWysylkiInput.value) {
        adresWysylkiInput.value = clientAddress;
    }
    if (osobaKontaktInput && !osobaKontaktInput.value) {
        osobaKontaktInput.value = clientContact;
    }

    // Wyliczony transport — realna kalkulacja z wag i limitów (jak w studniach)
    const wyliczonyTransportInput = document.getElementById('step4-wyliczony-transport');
    if (wyliczonyTransportInput) {
        const transportResult = typeof calculateTransports === 'function' ? calculateTransports(getActiveItemsArray() || []) : null;
        const costPerTrip = typeof getCostPerTrip === 'function' ? getCostPerTrip() : 0;
        if (transportResult && transportResult.totalTransports > 0 && costPerTrip > 0) {
            const fmt = (v) => v.toFixed(2).replace('.', ',').replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
            wyliczonyTransportInput.value = `${transportResult.totalTransports} x ${fmt(costPerTrip)} zł`;
        } else {
            wyliczonyTransportInput.value = 'Brak transportu';
        }
    }

    // Auto-wybierz zabezpieczenie transportu na podstawie ZT w ofercie
    const zabezpSelect = document.getElementById('step4-zabezpieczenie-transportu');
    if (zabezpSelect) {
        const activeItems = getActiveItemsArray();
        const hasZt = activeItems && activeItems.some(
            item => item.autoAdded && item.productId && item.productId.startsWith('ZT-') && item.quantity > 0
        );
        zabezpSelect.value = hasZt ? 'Podkłady jednorazowe' : 'Podkłady zwrotne';
    }

    // Reaguj na zmiany km/stawki w czasie rzeczywistym
    ['transport-km', 'transport-rate'].forEach(id => {
        const el = document.getElementById(id);
        if (el && !el.dataset.kartaListenerAttached) {
            el.dataset.kartaListenerAttached = '1';
            el.addEventListener('input', () => {
                if (typeof window.updateTransportCostSummary === 'function') {
                    window.updateTransportCostSummary();
                }
            });
        }
    });

    // Auto-uzupełnij uwagi ogólne listą rabatów + zabezpieczeniem transportu (dopisz, nie kasuj ręcznych wpisów)
    const uwagiField = document.getElementById('step4-uwagi-ogolne');
    const activeItemsForUwagi = getActiveItemsArray();
    if (uwagiField && activeItemsForUwagi && activeItemsForUwagi.length > 0) {
        const discountLines = activeItemsForUwagi
            .filter(item => !item.autoAdded)
            .map(item => {
                const name = item.name || 'Nieznany produkt';
                const suffix = item.commercialVersion && item.commercialVersion.trim()
                    ? ` ${item.commercialVersion.trim()}`
                    : '';
                const pehdText = item.pehdType
                    ? ` + wkładka ${item.pehdType === 'PEHD-3MM' ? 'PEHD 3mm' : 'PEHD 4mm'}`
                    : '';
                const fmtPLN = (v) => v.toFixed(2).replace('.', ',').replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
                const discountStr = (item.discount || 0).toFixed(2).replace('.', ',');
                const qty = item.quantity || 0;
                const priceAfterDiscount = item.unitPrice * (1 - (item.discount || 0) / 100);
                return `${name}${suffix}${pehdText}: ${discountStr}% | ${qty} szt. × ${fmtPLN(priceAfterDiscount)} PLN`;
            });

        const ztLines = activeItemsForUwagi
            .filter(item => item.autoAdded && item.productId.startsWith('ZT-') && item.quantity > 0)
            .map(item => {
                const fmtPLN = (v) => v.toFixed(2).replace('.', ',').replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
                const total = (item.unitPrice || 0) * item.quantity;
                return `${item.name}: ${item.quantity} szt. × ${fmtPLN(item.unitPrice || 0)} PLN = ${fmtPLN(total)} PLN`;
            });

        const allLines = ztLines.length > 0
            ? [...discountLines, '', '--- Zabezpieczenie transportu ---', ...ztLines]
            : discountLines;

        if (allLines.length > 0) {
            const currentVal = uwagiField.value;
            const existingLines = currentVal ? currentVal.split('\n').map(l => l.trimEnd()) : [];
            const alreadyHas = allLines.every((line, i) => {
                const idx = existingLines.length - allLines.length + i;
                return idx >= 0 && existingLines[idx] === line;
            });
            if (!alreadyHas) {
                uwagiField.value = currentVal
                    ? currentVal + (currentVal.endsWith('\n') ? '' : '\n') + allLines.join('\n')
                    : allLines.join('\n');
            }
        }
    }

    // Data zamówienia
    const dataZamInput = document.getElementById('step4-data-zamowienia');
    if (dataZamInput && !dataZamInput.value) {
        dataZamInput.value = new Date().toISOString().slice(0, 10);
    }

    // Inicjalizacja przejść
    if (!_przejsciaInitialized) {
        _customPrzejscieRows = [];
        _offerPrzejscieRows = [];
        renderPrzejsciaDetailsTable();
        _przejsciaInitialized = true;
    }

    // Obsługa kopiowania z istniejącego zamówienia
    renderKartaBudowyCopyOptions();

    // Przywróć dane z kopiowania jeśli istnieją
    const copySelect = document.getElementById('step4-copy-order-select');
    if (copySelect) copySelect.value = '';

    // Ukryj pola "Inne" na starcie
    ['step4-uszczelka-studni-inne-wrap', 'step4-rodzaj-stopni-inne-wrap', 'step4-kineta-inne-wrap'].forEach((id) => {
        const el = document.getElementById(id);
        if (el) el.style.display = 'none';
    });
}

window.initKartaBudowyStep4 = initKartaBudowyStep4;

async function step4NextAction() {
    const kartaBudowyData = collectKartaBudowyDataStep4();

    if (pendingOrderCreationData) {
        await finalizeOrderFromOffer(pendingOrderCreationData.offer, kartaBudowyData);
    } else {
        showToast('Brak danych do utworzenia zamówienia. Zapisz najpierw ofertę.', 'error');
    }
}

window.step4NextAction = step4NextAction;

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
        const snapshotItems = structuredClone(pendingOrderCreationData.selectedItems || getActiveItemsArray() || []);

        const orderedUids = new Set(snapshotItems.map(it => it.uid).filter(Boolean));

        const orderData = {
            id: orderId,
            offerId: offer.id || editingOfferId,
            offerNumber: offerNumber,
            orderNumber: orderNumber,
            userId: assignedUserId,
            userName: (typeof editingOfferAssignedUserName !== 'undefined' && editingOfferAssignedUserName) ||
                      (typeof currentUser !== 'undefined' && currentUser && (currentUser.username || '')) ||
                      '',
            originalSnapshot: {
                items: snapshotItems,
                transportKm,
                transportRate
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
            items: structuredClone(snapshotItems),
            kartaBudowy: kartaBudowyData,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
            createdBy: currentUser ? currentUser.id : ''
        };

        if (!ordersRury) ordersRury = [];
        ordersRury.push(orderData);

        await saveOrdersDataRury(ordersRury);
        showToast('Zamówienie utworzone', 'success');

        // UWAGA: NIE mutujemy currentOfferItems[i].ordered = true.
        // Flaga 'ordered' jest obliczana na bieżąco z ordersRury przez isItemInAnyOrder(uid).

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
        logger.error('orderManager', 'Błąd tworzenia zamówienia:', err);
        showToast('Błąd tworzenia zamówienia', 'error');
    }
}

let editingRuryOrderId = null;
window.editingRuryOrderId = null;

function updateRuryOrderSummary(orderData) {
    const src = document.getElementById('offer-items-body');
    const dst = document.getElementById('order-items-body');
    if (!dst) return;

    const isOrderMode = !!(window.orderEditMode && orderData);
    const colCount = 13;

    const orderColgroup = document.getElementById('order-colgroup');
    if (orderColgroup && typeof buildRuryColgroup === 'function') {
        orderColgroup.innerHTML = buildRuryColgroup(0);
    }

    if (!src || (getActiveItemsArray() || []).length === 0) {
        dst.innerHTML = `<tr class="rury-table-empty"><td colspan="${colCount}">Brak produktów</td></tr>`;
        copyTransportBreakdown();
        if (window.lucide) lucide.createIcons();
        return;
    }

    dst.innerHTML = src.innerHTML;

    dst.querySelectorAll('tr:not(.offer-cat-header):not(.offer-diam-header)').forEach(row => {
        const firstCell = row.querySelector('td');
        if (!firstCell) return;
        const checkbox = firstCell.querySelector('.item-order-checkbox');
        if (!checkbox) return;
        const uid = row.dataset.uid;
        const ordered = isOrderMode || isItemInAnyOrder(uid);
        const icon = ordered
            ? '<i data-lucide="package-check" style="width:16px;height:16px;color:#a5b4fc"></i>'
            : '<i data-lucide="circle" style="width:12px;height:12px;color:var(--text-muted);opacity:0.4"></i>';
        firstCell.innerHTML = icon;
        firstCell.setAttribute('data-status', ordered ? 'ordered' : 'available');
    });

    dst.querySelectorAll('.offer-cat-header td, .offer-diam-header td').forEach(td => {
        td.setAttribute('colspan', colCount);
    });

    copyTransportBreakdown();
    if (window.lucide) lucide.createIcons();
}

function copyTransportBreakdown() {
    const src = document.getElementById('transport-breakdown');
    const dst = document.getElementById('order-transport-breakdown');
    if (!src || !dst) return;
    dst.innerHTML = src.innerHTML
        .replace(/id="transport-breakdown-content"/g, 'id="order-transport-breakdown-content"')
        .replace(/id="transport-toggle-icon"/g, 'id="order-transport-toggle-icon"')
        .replace(/onclick="toggleTransportBreakdown\(\)"/g, 'onclick="toggleOrderTransportBreakdown()"');
    if (window.lucide) lucide.createIcons({root: dst});
}

window.updateRuryOrderSummary = updateRuryOrderSummary;

function getCurrentRuryOrder() {
    if (window.orderEditMode && editingRuryOrderId) {
        return (ordersRury || []).find(o => o.id === editingRuryOrderId) || null;
    }
    if (editingOfferId) {
        return (ordersRury || []).find(o => o.offerId === editingOfferId) || null;
    }
    return null;
}
window.getCurrentRuryOrder = getCurrentRuryOrder;

/* ===== ZAPIS ZAMÓWIENIA Z KROKU 5 ===== */

async function saveRuryOrder() {
    if (!editingRuryOrderId) {
        showToast('Brak aktywnego zamówienia do zapisania', 'error');
        return;
    }

    const orderIndex = (ordersRury || []).findIndex(o => o.id === editingRuryOrderId);
    if (orderIndex === -1) {
        showToast('Nie znaleziono zamówienia w pamięci', 'error');
        return;
    }

    const orderData = ordersRury[orderIndex];
    orderData.items = structuredClone(orderCurrentItems || []);
    orderData.updatedAt = new Date().toISOString();

    try {
        await saveOrdersDataRury(ordersRury);
        showToast('Zamówienie zaktualizowane', 'success');
    } catch (err) {
        logger.error('orderManager', 'Błąd zapisu zamówienia:', err);
        showToast('Błąd zapisu zamówienia', 'error');
    }
}

window.saveRuryOrder = saveRuryOrder;

/* ===== ZAPIS OFERTY LUB ZAMÓWIENIA ===== */

window.saveOfferOrOrder = async function () {
    if (window.orderEditMode && editingRuryOrderId) {
        await saveRuryOrder();
    } else {
        await saveOffer();
    }
};

/* ===== TRYB EDYCJI ZAMÓWIENIA ===== */

let orderEditMode = false;
window.orderEditMode = false;

function isOrderMode() {
    return orderEditMode;
}
window.isOrderMode = isOrderMode;

async function enterRuryOrderEditMode(orderId) {
    try {
        let orderData = (ordersRury || []).find(o => o.id === orderId);
        if (!orderData) {
            if (!ordersRury || ordersRury.length === 0) await loadOrdersRury();
            orderData = (ordersRury || []).find(o => o.id === orderId);
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
    banner.style.cssText = 'background:rgba(239,68,68,0.12);border:2px solid rgba(239,68,68,0.3);border-radius:10px;padding:0.6rem 1rem;margin-bottom:1rem;display:flex;align-items:center;justify-content:space-between;';
    banner.innerHTML = '<div style="display:flex;align-items:center;gap:0.75rem;">'
        + '<span style="font-size:1.3rem;"><i data-lucide="package"></i></span>'
        + '<span style="font-weight:800;color:#f87171;font-size:0.82rem;">TRYB ZAMÓWIENIA — <strong>' + escapeHtml(orderData.orderNumber || orderData.offerNumber || orderData.id || '') + '</strong></span>'
        + '</div>'
        + '<button class="btn btn-sm" onclick="exitOrderEditMode()" style="background:rgba(239,68,68,0.12);border:1px solid rgba(239,68,68,0.3);color:#f87171;padding:0.3rem 0.7rem;font-size:0.75rem;font-weight:600;border-radius:6px;cursor:pointer;">Wyjdź</button>';
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
    banner.style.cssText = 'background:rgba(16,185,129,0.1);border:1px solid rgba(16,185,129,0.3);border-radius:8px;padding:0.7rem 1rem;margin-bottom:1rem;display:flex;align-items:center;justify-content:space-between;gap:1rem;flex-wrap:wrap;';
    banner.innerHTML = '<div style="display:flex;align-items:center;gap:0.75rem;flex-wrap:wrap;">'
        + '<span style="font-size:1.3rem;">📦</span>'
        + '<span style="font-weight:700;color:#34d399;">Dodajesz produkty do istniejącego zamówienia</span>'
        + '<span style="color:var(--text-muted);">|</span>'
        + '<span style="color:var(--text-muted);font-size:0.85rem;">Zamówienie: <strong style="color:var(--text);">' + escapeHtml(orderData.orderNumber || orderData.offerNumber || orderData.id || '—') + '</strong></span>'
        + '<span style="color:var(--text-muted);font-size:0.82rem;">Po dodaniu produktów kliknij <strong style="color:var(--text);">Dalej</strong> aby przejść do podsumowania.</span>'
        + '</div>'
        + '<div style="display:flex;gap:0.5rem;flex-shrink:0;">'
        + '<button class="btn btn-sm" onclick="goToPhase(5)" style="background:rgba(16,185,129,0.15);border:1px solid rgba(16,185,129,0.4);color:#34d399;padding:0.4rem 0.8rem;font-size:0.78rem;font-weight:600;border-radius:6px;cursor:pointer;">Powrót do zamówienia</button>'
        + '<button class="btn btn-sm" onclick="exitOrderEditMode()" style="background:rgba(239,68,68,0.12);border:1px solid rgba(239,68,68,0.3);color:#f87171;padding:0.4rem 0.8rem;font-size:0.78rem;font-weight:600;border-radius:6px;cursor:pointer;">Wyjdź</button>'
        + '</div>';
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

/* ===== KOPIOWANIE KARTY BUDOWY Z ISTNIEJĄCEGO ZAMÓWIENIA ===== */

function getKartaBudowyCopyOrders() {
    if (!pendingOrderCreationData || !pendingOrderCreationData.kartaBudowyTemplateOrders) return [];
    return pendingOrderCreationData.kartaBudowyTemplateOrders;
}

function renderKartaBudowyCopyOptions() {
    const select = document.getElementById('step4-copy-order-select');
    if (!select) return;

    const orders = getKartaBudowyCopyOrders();
    select.innerHTML = '<option value="">Wybierz kartę budowy do skopiowania</option>';

    if (orders.length === 0) {
        const help = document.getElementById('step4-copy-order-help');
        if (help) help.textContent = 'Brak wcześniejszych zamówień dla tej oferty.';
        return;
    }

    orders.forEach((order) => {
        const opt = document.createElement('option');
        opt.value = order.id;
        const offerNum = order.orderNumber || order.offerNumber || order.number || '—';
        const date = order.createdAt ? new Date(order.createdAt).toLocaleDateString('pl-PL') : '—';
        opt.textContent = `${offerNum} (${date})`;
        select.appendChild(opt);
    });
}

function copyKartaBudowyFromOrder() {
    const select = document.getElementById('step4-copy-order-select');
    if (!select || !select.value) {
        showToast('Wybierz zamówienie do skopiowania', 'error');
        return;
    }

    const sourceOrder = getKartaBudowyCopyOrders().find((o) => o.id === select.value);
    if (!sourceOrder || !sourceOrder.kartaBudowy) {
        showToast('Brak danych Karty Budowy w wybranym zamówieniu', 'error');
        return;
    }

    applyCopiedKartaBudowyData(sourceOrder.kartaBudowy);
    showToast('Skopiowano dane Karty Budowy', 'success');
}

window.copyKartaBudowyFromOrder = copyKartaBudowyFromOrder;

function applyCopiedKartaBudowyData(sourceData) {
    const map = {
        'step4-email-faktura': 'emailFaktura',
        'step4-email-efaktura': 'emailEfaktura',
        'step4-offer-nr-input': 'offerNumbers',
        'step4-adres-wysylki': 'adresWysylki',
        'step4-ilosc-dni': 'iloscDni',
        'step4-ubezpieczenie': 'ubezpieczenie',
        'step4-osoba-kontakt': 'osobaKontakt',
        'step4-wyliczony-transport': 'wyliczonyTransport',
        'step4-kaskada-uwagi': 'kaskadaUwagi',
        'step4-slepa-kineta-uwagi': 'slepaKinetaUwagi',
        'step4-data-zamowienia': 'dataZamowienia',
        'step4-pozostale-wlasciwosci': 'pozostaleWlasciwosci',
        'step4-uwagi-ogolne': 'uwagiOgolne'
    };

    for (const [elId, field] of Object.entries(map)) {
        const el = document.getElementById(elId);
        if (el && sourceData[field] !== undefined && sourceData[field] !== null) {
            el.value = sourceData[field];
        }
    }

    const selectMap = {
        'step4-warunki-platnosci': 'warunkiPlatnosci',
        'step4-zabezpieczenie-transportu': 'zabezpieczenieTransportu',
        'step4-rodzaj-transportu': 'rodzajTransportu',
        'step4-rodzaj-stopni': 'rodzajStopni',
        'step4-rodzaj-studni': 'rodzajStudni',
        'step4-uszczelka-studni': 'uszczelkaStudni',
        'step4-kineta': 'kineta',
        'step4-wysokosc-spocznika': 'wysokoscSpocznika',
        'step4-usytuowanie': 'usytuowanie',
        'step4-kaskada': 'kaskada',
        'step4-slepa-kineta': 'slepaKineta',
        'step4-redukcja-kinety': 'redukcjaKinety',
        'step4-przejscia-tulejowe': 'przejsciaTulejowe',
        'step4-przejscia-szczelne': 'przejsciaSzczelne',
        'step4-przejscia-zamowione': 'przejsciaZamowione',
        'step4-wlasciwosci-betonu': 'wlasciwosciBetonu'
    };

    for (const [elId, field] of Object.entries(selectMap)) {
        const el = document.getElementById(elId);
        if (el && sourceData[field] !== undefined && sourceData[field] !== null) {
            el.value = sourceData[field];
            // Trigger change event for conditional fields
            const event = new Event('change', { bubbles: true });
            el.dispatchEvent(event);
        }
    }

    // Copy transition details if available
    if (Array.isArray(sourceData.przejsciaDetails)) {
        _customPrzejscieRows = sourceData.przejsciaDetails.filter((p) => p.source === 'custom');
        _offerPrzejscieRows = sourceData.przejsciaDetails.filter((p) => p.source === 'offer');
        renderPrzejsciaDetailsTable();
    }
}

/* ===== PRZEJŚCIA SZCZELNE — TABELA ===== */

function renderPrzejsciaDetailsTable(existingData) {
    const container = document.getElementById('step4-przejscia-details-table');
    if (!container) return;

    const allRows = [
        ..._offerPrzejscieRows.map((r, i) => ({ ...r, source: 'offer', _idx: i })),
        ..._customPrzejscieRows.map((r, i) => ({ ...r, source: 'custom', _idx: i }))
    ];

    if (allRows.length === 0) {
        container.innerHTML = '<div style="font-size: 0.8rem; color: var(--text-muted); padding: 0.5rem;">Brak przejść. Kliknij "Dodaj niestandardowe" aby dodać.</div>';
        return;
    }

    let html = `<table class="rury-table" style="font-size:0.75rem;">
        <thead>
            <tr>
                <th style="width:22%;">Rodzaj przejścia</th>
                <th style="width:12%;">DN OD</th>
                <th style="width:12%;">DN DO</th>
                <th style="width:12%;">Ilość</th>
                <th style="width:22%;">Uwagi</th>
                <th style="width:10%;">Czy przejście?</th>
                <th style="width:10%;">Akcje</th>
            </tr>
        </thead>
        <tbody>`;

    allRows.forEach((row, idx) => {
        const isCustom = row.source === 'custom';
        html += `<tr>
            <td>
                ${isCustom
                    ? `<input type="text" class="form-input" value="${row.rodzaj || ''}" style="width:100%;font-size:0.7rem;padding:0.2rem 0.4rem;" data-field="rodzaj" data-source="${row.source}" data-idx="${row._idx}" onchange="_syncCustomRow(this)" />`
                    : `<span style="font-weight:600;">${row.rodzaj || '—'}</span>`
                }
            </td>
            <td><input type="text" class="form-input" value="${row.dnOd || ''}" style="width:100%;font-size:0.7rem;padding:0.2rem 0.4rem;" data-field="dnOd" data-source="${row.source}" data-idx="${row._idx}" onchange="_syncCustomRow(this)" /></td>
            <td><input type="text" class="form-input" value="${row.dnDo || ''}" style="width:100%;font-size:0.7rem;padding:0.2rem 0.4rem;" data-field="dnDo" data-source="${row.source}" data-idx="${row._idx}" onchange="_syncCustomRow(this)" /></td>
            <td><input type="number" class="form-input" value="${row.ilosc || ''}" style="width:100%;font-size:0.7rem;padding:0.2rem 0.4rem;" data-field="ilosc" data-source="${row.source}" data-idx="${row._idx}" onchange="_syncCustomRow(this)" /></td>
            <td><input type="text" class="form-input" value="${row.uwagi || ''}" style="width:100%;font-size:0.7rem;padding:0.2rem 0.4rem;" data-field="uwagi" data-source="${row.source}" data-idx="${row._idx}" onchange="_syncCustomRow(this)" /></td>
            <td>
                <select class="form-input" style="width:100%;font-size:0.7rem;padding:0.2rem;" data-field="czyPrzejscie" data-source="${row.source}" data-idx="${row._idx}" onchange="_syncCustomRow(this)">
                    <option value="TAK" ${row.czyPrzejscie === 'TAK' ? 'selected' : ''}>TAK</option>
                    <option value="NIE" ${row.czyPrzejscie === 'NIE' ? 'selected' : ''}>NIE</option>
                </select>
            </td>
            <td>
                ${isCustom
                    ? `<button class="btn btn-sm btn-danger" onclick="removePrzejscieRow('custom', ${row._idx})" style="font-size:0.65rem;padding:0.15rem 0.4rem;"><i data-lucide="x" style="width:12px;height:12px;"></i></button>`
                    : '<span style="color:var(--text-muted);font-size:0.65rem;">z oferty</span>'
                }
            </td>
        </tr>`;
    });

    html += `</tbody></table>`;
    container.innerHTML = html;
    if (window.lucide) lucide.createIcons();
}

function addCustomPrzejscieRow() {
    _syncCustomRowsFromDOM();
    _customPrzejscieRows.push({
        rodzaj: '',
        dnOd: '',
        dnDo: '',
        ilosc: 1,
        uwagi: '',
        czyPrzejscie: 'TAK',
        source: 'custom'
    });
    renderPrzejsciaDetailsTable();
}

window.addCustomPrzejscieRow = addCustomPrzejscieRow;

function removePrzejscieRow(source, idx) {
    if (source === 'custom') {
        _customPrzejscieRows.splice(idx, 1);
    } else {
        _offerPrzejscieRows.splice(idx, 1);
    }
    renderPrzejsciaDetailsTable();
}

window.removePrzejscieRow = removePrzejscieRow;

function _syncCustomRow(input) {
    const field = input.dataset.field;
    const source = input.dataset.source;
    const idx = parseInt(input.dataset.idx);
    const target = source === 'custom' ? _customPrzejscieRows : _offerPrzejscieRows;
    if (target && target[idx] !== undefined) {
        target[idx][field] = input.value;
    }
}

function _syncCustomRowsFromDOM() {
    document.querySelectorAll('#step4-przejscia-details-table input, #step4-przejscia-details-table select').forEach((input) => {
        if (input.dataset.field && input.dataset.source && input.dataset.idx !== undefined) {
            _syncCustomRow(input);
        }
    });
}

function collectPrzejsciaDetailsFromTable() {
    _syncCustomRowsFromDOM();
    return [
        ..._offerPrzejscieRows.map((r) => ({ ...r, source: 'offer' })),
        ..._customPrzejscieRows.map((r) => ({ ...r, source: 'custom' }))
    ];
}

function handlePrzejsciaZamowioneChange(select) {
    const dataInput = document.getElementById('step4-data-zamowienia');
    if (select.value === 'Tak' && dataInput && !dataInput.value) {
        dataInput.value = new Date().toISOString().slice(0, 10);
    }
}

window.handlePrzejsciaZamowioneChange = handlePrzejsciaZamowioneChange;

function syncOrderTableIfNeeded() {
    if (typeof currentWizardStep === 'undefined' || currentWizardStep !== 5) return;
    if (typeof updateRuryOrderSummary !== 'function') return;
    const order = (window.orderEditMode && typeof getCurrentRuryOrder === 'function')
        ? getCurrentRuryOrder()
        : null;
    updateRuryOrderSummary(order);
}
window.syncOrderTableIfNeeded = syncOrderTableIfNeeded;

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
