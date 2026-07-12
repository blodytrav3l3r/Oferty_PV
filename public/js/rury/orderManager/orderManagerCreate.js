// @ts-check
/* ===== ZAMÓWIENIA RUR — TWORZENIE ZAMÓWIENIA Z OFERTY ===== */

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

function collectKartaBudowyDataStep4() {
    const getVal = (id) => document.getElementById(id)?.value?.trim() || '';
    const getSelectVal = (id) => document.getElementById(id)?.value || '';

    return {
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
}

function initKartaBudowyStep4(primaryOfferNumber) {
    const offerInput = document.getElementById('step4-offer-nr-input');
    const adresWysylkiInput = document.getElementById('step4-adres-wysylki');
    const osobaKontaktInput = document.getElementById('step4-osoba-kontakt');
    const emailFakturaInput = document.getElementById('step4-email-faktura');

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

    if (typeof window.updateTransportCostSummary === 'function') {
        window.updateTransportCostSummary();
    }

    const zabezpSelect = document.getElementById('step4-zabezpieczenie-transportu');
    if (zabezpSelect) {
        const activeItems = getActiveItemsArray();
        const hasZt =
            activeItems &&
            activeItems.some(
                (item) =>
                    item.autoAdded &&
                    item.productId &&
                    item.productId.startsWith('ZT-') &&
                    item.quantity > 0
            );
        zabezpSelect.value = hasZt ? 'Podkłady jednorazowe' : 'Podkłady zwrotne';
    }

    ['transport-km', 'transport-rate'].forEach((id) => {
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

    const uwagiField = document.getElementById('step4-uwagi-ogolne');
    const activeItemsForUwagi =
        typeof pendingOrderCreationData !== 'undefined' &&
        pendingOrderCreationData &&
        pendingOrderCreationData.selectedItems
            ? pendingOrderCreationData.selectedItems
            : getActiveItemsArray();
    if (uwagiField && activeItemsForUwagi && activeItemsForUwagi.length > 0) {
        const fmtPLN = (v) =>
            v
                .toFixed(2)
                .replace('.', ',')
                .replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
        const discountLines = activeItemsForUwagi
            .filter((item) => !item.autoAdded)
            .map((item) => {
                const name = item.name || 'Nieznany produkt';
                const suffix =
                    item.commercialVersion && item.commercialVersion.trim()
                        ? ` ${item.commercialVersion.trim()}`
                        : '';
                const pehdText = item.pehdType
                    ? ` + wkładka ${item.pehdType === 'PEHD-3MM' ? 'PEHD 3mm' : 'PEHD 4mm'}`
                    : '';
                const discountStr = (item.discount || 0).toFixed(2).replace('.', ',');
                const qty = item.quantity || 0;
                const priceAfterDiscount = item.unitPrice * (1 - (item.discount || 0) / 100);
                return `${name}${suffix}${pehdText}: ${discountStr}% | ${qty} szt. × ${fmtPLN(priceAfterDiscount)} PLN`;
            });

        const ztLines = activeItemsForUwagi
            .filter(
                (item) => item.autoAdded && item.productId.startsWith('ZT-') && item.quantity > 0
            )
            .map((item) => {
                const total = (item.unitPrice || 0) * item.quantity;
                return `${item.name}: ${item.quantity} szt. × ${fmtPLN(item.unitPrice || 0)} PLN = ${fmtPLN(total)} PLN`;
            });

        const autoLines =
            ztLines.length > 0
                ? [...discountLines, '', '--- Zabezpieczenie transportu ---', ...ztLines]
                : discountLines;

        if (autoLines.length > 0) {
            const isOrder =
                !!(window.orderEditMode && editingRuryOrderId) ||
                !!(pendingOrderCreationData && pendingOrderCreationData.selectedItems);
            const currentVal = uwagiField.value;
            const existingLines = currentVal ? currentVal.split('\n').map((l) => l.trimEnd()) : [];

            if (isOrder) {
                const autoStartPattern = /^(RURA |--- Zabezpieczenie)/;
                let cutIdx = existingLines.length;
                for (let i = existingLines.length - 1; i >= 0; i--) {
                    if (autoStartPattern.test(existingLines[i])) {
                        cutIdx = i;
                    } else if (cutIdx < existingLines.length && existingLines[i].trim() !== '') {
                        break;
                    }
                }
                const manualLines = existingLines
                    .slice(0, cutIdx)
                    .filter((l) => l.trim() !== '' || cutIdx === existingLines.length);
                uwagiField.value =
                    manualLines.length > 0
                        ? manualLines.join('\n') + '\n' + autoLines.join('\n')
                        : autoLines.join('\n');
            } else {
                const alreadyHas = autoLines.every((line, i) => {
                    const idx = existingLines.length - autoLines.length + i;
                    return idx >= 0 && existingLines[idx] === line;
                });
                if (!alreadyHas) {
                    uwagiField.value = currentVal
                        ? currentVal +
                          (currentVal.endsWith('\n') ? '' : '\n') +
                          autoLines.join('\n')
                        : autoLines.join('\n');
                }
            }
        }
    }

    const dataZamInput = document.getElementById('step4-data-zamowienia');
    if (dataZamInput && !dataZamInput.value) {
        dataZamInput.value = new Date().toISOString().slice(0, 10);
    }

    if (!_przejsciaInitialized) {
        _customPrzejscieRows = [];
        _offerPrzejscieRows = [];
        renderPrzejsciaDetailsTable();
        _przejsciaInitialized = true;
    }

    renderKartaBudowyCopyOptions();

    const copySelect = document.getElementById('step4-copy-order-select');
    if (copySelect) copySelect.value = '';

    [
        'step4-uszczelka-studni-inne-wrap',
        'step4-rodzaj-stopni-inne-wrap',
        'step4-kineta-inne-wrap'
    ].forEach((id) => {
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
        const snapshotItems = structuredClone(
            pendingOrderCreationData.selectedItems || getActiveItemsArray() || []
        );

        const orderedUids = new Set(snapshotItems.map((it) => it.uid).filter(Boolean));

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
            items: structuredClone(snapshotItems),
            kartaBudowy: kartaBudowyData,
            transportKm,
            transportRate,
            transportMode: currentRuryTransportMode || 'full',
            createdAt: new Date().toISOString()
        };

        ordersRury.push(orderData);
        await saveOrdersDataRury(ordersRury);

        pendingOrderCreationData = null;
        editingRuryOrderId = orderId;
        window.editingRuryOrderId = orderId;
        orderEditMode = true;
        window.orderEditMode = true;
        orderCurrentItems = structuredClone(snapshotItems);
        window.orderCurrentItems = orderCurrentItems;

        document.getElementById('btn-order-create')?.style.setProperty('display', 'none');

        showToast(`Zamówienie utworzone: ${orderNumber}`, 'success');

        if (typeof renderOrderModeBanner === 'function') {
            renderOrderModeBanner(orderData);
        }
        if (typeof goToPhase === 'function') goToPhase(5);
        updateRuryOrderSummary(orderData);
        if (typeof updateTransportCostSummary === 'function') updateTransportCostSummary();

        document.title = `Zamówienie: ${orderNumber}`;
    } catch (err) {
        logger.error('orderManager', 'Błąd finalizacji zamówienia:', err);
        showToast('Błąd tworzenia zamówienia', 'error');
    }
}
