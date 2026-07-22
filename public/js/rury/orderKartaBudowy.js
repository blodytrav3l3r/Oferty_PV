// @ts-check
/* ===== ZAMÓWIENIA RUR — KARTA BUDOWY KROK 4 ===== */

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
        zabezpSelect.value = hasZt ? 'Podk\u0142ady jednorazowe' : 'Podk\u0142ady zwrotne';
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
        typeof window.pendingOrderCreationData !== 'undefined' &&
        window.pendingOrderCreationData &&
        window.pendingOrderCreationData.selectedItems
            ? window.pendingOrderCreationData.selectedItems
            : getActiveItemsArray();
    if (uwagiField && activeItemsForUwagi && activeItemsForUwagi.length > 0) {
        if (typeof getSortedRuryItems === 'function') {
            const sorted = getSortedRuryItems(activeItemsForUwagi.filter((i) => !i.autoAdded));
            const sortedUids = new Map();
            sorted.flat.forEach((g) =>
                g.entries.forEach((e, i) => sortedUids.set(e.item.uid || e.item.productId, i))
            );
            [...activeItemsForUwagi].sort((a, b) => {
                const ai = sortedUids.get(a.uid || a.productId) ?? 999;
                const bi = sortedUids.get(b.uid || b.productId) ?? 999;
                return ai - bi;
            });
        }
        const discountLines = activeItemsForUwagi
            .filter((item) => !item.autoAdded)
            .map((item) => {
                const name = item.name || 'Nieznany produkt';
                const suffix =
                    item.commercialVersion && item.commercialVersion.trim()
                        ? ' ' + item.commercialVersion.trim()
                        : '';
                const pehdText = item.pehdType
                    ? ' + wk\u0142adka ' + (item.pehdType === 'PEHD-3MM' ? 'PEHD 3mm' : 'PEHD 4mm')
                    : '';
                const fmtPLN = (v) =>
                    v
                        .toFixed(2)
                        .replace('.', ',')
                        .replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
                const discountStr = (item.discount || 0).toFixed(2).replace('.', ',');
                const qty = item.orderedQuantity || item.quantity || 0;
                const priceAfterDiscount = item.unitPrice * (1 - (item.discount || 0) / 100);
                return (
                    name +
                    suffix +
                    pehdText +
                    ': ' +
                    discountStr +
                    '% | ' +
                    qty +
                    ' szt. \u00D7 ' +
                    fmtPLN(priceAfterDiscount) +
                    ' PLN'
                );
            });

        const ztLines = activeItemsForUwagi
            .filter(
                (item) => item.autoAdded && item.productId.startsWith('ZT-') && item.quantity > 0
            )
            .map((item) => {
                const fmtPLN = (v) =>
                    v
                        .toFixed(2)
                        .replace('.', ',')
                        .replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
                const total = (item.unitPrice || 0) * item.quantity;
                return (
                    item.name +
                    ': ' +
                    item.quantity +
                    ' szt. \u00D7 ' +
                    fmtPLN(item.unitPrice || 0) +
                    ' PLN = ' +
                    fmtPLN(total) +
                    ' PLN'
                );
            });

        const autoLines =
            ztLines.length > 0
                ? [...discountLines, '', '--- Zabezpieczenie transportu ---', ...ztLines]
                : discountLines;

        if (autoLines.length > 0) {
            const isOrder =
                !!(
                    window.orderEditMode &&
                    typeof editingRuryOrderId !== 'undefined' &&
                    editingRuryOrderId
                ) ||
                !!(
                    typeof window.pendingOrderCreationData !== 'undefined' &&
                    window.pendingOrderCreationData &&
                    window.pendingOrderCreationData.selectedItems
                );
            const currentVal = uwagiField.value;
            const existingLines = currentVal ? currentVal.split('\n').map((l) => l.trimEnd()) : [];
            const alreadyHas = autoLines.every((line, i) => {
                const idx = existingLines.length - autoLines.length + i;
                return idx >= 0 && existingLines[idx] === line;
            });

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
            } else if (!alreadyHas) {
                uwagiField.value = currentVal
                    ? currentVal + (currentVal.endsWith('\n') ? '' : '\n') + autoLines.join('\n')
                    : autoLines.join('\n');
            }
        }
    }

    const dataZamInput = document.getElementById('step4-data-zamowienia');
    if (dataZamInput && !dataZamInput.value) {
        dataZamInput.value = new Date().toISOString().slice(0, 10);
    }

    if (!window._przejsciaInitialized) {
        window._customPrzejscieRows = [];
        window._offerPrzejscieRows = [];

        window._przejsciaInitialized = true;
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

    if (window.pendingOrderCreationData) {
        await finalizeOrderFromOffer(window.pendingOrderCreationData.offer, kartaBudowyData);
    } else {
        showToast('Brak danych do utworzenia zamówienia. Zapisz najpierw ofertę.', 'error');
    }
}
window.step4NextAction = step4NextAction;

function getKartaBudowyCopyOrders() {
    if (
        !window.pendingOrderCreationData ||
        !window.pendingOrderCreationData.kartaBudowyTemplateOrders
    )
        return [];
    return window.pendingOrderCreationData.kartaBudowyTemplateOrders;
}

function renderKartaBudowyCopyOptions() {
    const select = document.getElementById('step4-copy-order-select');
    if (!select) return;

    const orders = getKartaBudowyCopyOrders();
    select.innerHTML = '<option value="">Wybierz kart\u0119 budowy do skopiowania</option>';

    if (orders.length === 0) {
        const help = document.getElementById('step4-copy-order-help');
        if (help) help.textContent = 'Brak wcze\u015Bniejszych zam\u00F3wie\u0144 dla tej oferty.';
        return;
    }

    orders.forEach((order) => {
        const opt = document.createElement('option');
        opt.value = order.id;
        const offerNum = order.orderNumber || order.offerNumber || order.number || '\u2014';
        const date = order.createdAt
            ? new Date(order.createdAt).toLocaleDateString('pl-PL')
            : '\u2014';
        opt.textContent = offerNum + ' (' + date + ')';
        select.appendChild(opt);
    });
}

function copyKartaBudowyFromOrder() {
    const select = document.getElementById('step4-copy-order-select');
    if (!select || !select.value) {
        showToast('Wybierz zam\u00F3wienie do skopiowania', 'error');
        return;
    }

    const sourceOrder = getKartaBudowyCopyOrders().find((o) => o.id === select.value);
    if (!sourceOrder || !sourceOrder.kartaBudowy) {
        showToast('Brak danych Karty Budowy w wybranym zam\u00F3wieniu', 'error');
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
            const event = new Event('change', { bubbles: true });
            el.dispatchEvent(event);
        }
    }

    if (Array.isArray(sourceData.przejsciaDetails)) {
        window._customPrzejscieRows = sourceData.przejsciaDetails.filter(
            (p) => p.source === 'custom'
        );
        window._offerPrzejscieRows = sourceData.przejsciaDetails.filter(
            (p) => p.source === 'offer'
        );
        renderPrzejsciaDetailsTable();
    }
}
