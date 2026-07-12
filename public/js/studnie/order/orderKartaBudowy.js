// @ts-check
/* ===== PODFUNKCJE KARTY BUDOWY KROK 4 ===== */

function _resetKartaBudowyForm() {
    const fields = [
        'step4-email-faktura',
        'step4-email-efaktura',
        'step4-offer-nr-input',
        'step4-adres-wysylki',
        'step4-ilosc-dni',
        'step4-ubezpieczenie',
        'step4-osoba-kontakt',
        'step4-kaskada-uwagi',
        'step4-slepa-kineta-uwagi',
        'step4-data-zamowienia'
    ];
    fields.forEach((id) => {
        const el = document.getElementById(id);
        if (el) el.value = '';
    });

    const textDefaults = {
        'step4-warunki-platnosci': 'przelew',
        'step4-zabezpieczenie-transportu': 'Nie dotyczy',
        'step4-rodzaj-transportu': 'Transport P.V.',
        'step4-wlasciwosci-betonu': 'C40/50',
        'step4-rodzaj-stopni': 'Nie dotyczy',
        'step4-rodzaj-studni': 'Nie dotyczy',
        'step4-uszczelka-studni': 'Brak',
        'step4-kineta': 'Brak',
        'step4-wysokosc-spocznika': 'Nie dotyczy',
        'step4-usytuowanie': 'Linia dolna',
        'step4-kaskada': 'Nie dotyczy',
        'step4-slepa-kineta': 'Nie dotyczy',
        'step4-redukcja-kinety': 'Nie dotyczy',
        'step4-przejscia-tulejowe': 'Nie dotyczy',
        'step4-przejscia-szczelne': 'Nie dotyczy',
        'step4-przejscia-zamowione': 'Nie dotyczy',
        'step4-pozostale-wlasciwosci': ''
    };
    Object.keys(textDefaults).forEach((id) => {
        const el = document.getElementById(id);
        if (el) el.value = textDefaults[id];
    });

    ['step4-rodzaj-stopni-inne', 'step4-uszczelka-studni-inne', 'step4-kineta-inne'].forEach(
        (id) => {
            const el = document.getElementById(id);
            if (el) el.value = '';
            const wrap = document.getElementById(id + '-wrap');
            if (wrap) wrap.style.display = 'none';
        }
    );
}

function _calcTransportCosts() {
    let tCost = 0,
        tWeight = 0,
        costPerTrip = 0;

    if (orderEditMode && orderEditMode.order) {
        const o = orderEditMode.order;
        tWeight = o.totalWeight || 0;
        if (o.wells) {
            o.wells.forEach((w) => {
                tCost += typeof w.transportCost === 'number' ? w.transportCost : 0;
            });
        }
        costPerTrip = (parseFloat(o.transportKm) || 0) * (parseFloat(o.transportRate) || 0);
    } else if (typeof pendingOrderCreationData !== 'undefined' && pendingOrderCreationData) {
        const off = pendingOrderCreationData.offer;
        const sel = pendingOrderCreationData.selectedWells;
        if (sel) {
            sel.forEach(
                (w) =>
                    (tWeight += typeof calcWellStats === 'function' ? calcWellStats(w).weight : 0)
            );
        }
        const gWeight = off.totalWeight || 0;
        const gKm = parseFloat(off.transportKm) || 0;
        const gRate = parseFloat(off.transportRate) || 0;
        const offerMode = off.transportMode || 'full';
        const gCost =
            gKm > 0 && gRate > 0
                ? (typeof calcTransportCount === 'function'
                      ? calcTransportCount(gWeight, offerMode)
                      : Math.ceil(gWeight / MAX_TRANSPORT_WEIGHT)) *
                  gKm *
                  gRate
                : 0;
        if (gWeight > 0 && tWeight > 0) {
            tCost = gCost * (tWeight / gWeight);
        }
        costPerTrip = gKm * gRate;
    }

    return { tCost: Math.max(0, tCost), costPerTrip };
}

function _displayTransportCost(tCost, costPerTrip) {
    const wyliczonyTransportInput = document.getElementById('step4-wyliczony-transport');
    if (!wyliczonyTransportInput) return;
    const t = Math.max(0, tCost);
    const fmt = (v) =>
        v
            .toFixed(2)
            .replace('.', ',')
            .replace(/\B(?=(\d{3})+(?!\d))/g, ' ');

    if (t > 0 && costPerTrip > 0) {
        const count = Math.round((t / costPerTrip) * 1000) / 1000;
        const countLabel = count % 1 === 0 ? String(count) : count.toFixed(2).replace('.', ',');
        wyliczonyTransportInput.value = `${countLabel} x ${fmt(costPerTrip)} zł = ${fmt(t)} zł`;
    } else if (t > 0) {
        wyliczonyTransportInput.value = `${fmt(t)} zł`;
    } else {
        wyliczonyTransportInput.value = 'Brak transportu';
    }
}

function _detectWellParams() {
    const result = {
        stopnie: 'Nie dotyczy',
        rodzajStudni: 'Nie dotyczy',
        kineta: 'Brak',
        wysokoscSpocznika: 'Nie dotyczy',
        pozostale: []
    };

    const wellsToDetect =
        typeof orderEditMode !== 'undefined' && orderEditMode && orderEditMode.order
            ? orderEditMode.order.wells
            : typeof pendingOrderCreationData !== 'undefined' && pendingOrderCreationData
              ? pendingOrderCreationData.selectedWells
              : [];

    if (!wellsToDetect || wellsToDetect.length === 0) return result;

    let hasNierdzewna = false,
        hasDrabinka = false,
        hasBrak = false;
    let hasZelbet = false,
        hasBetonStudnia = false;
    let hasPrecoTop = false,
        hasPreco = false,
        hasBetonKineta = false;
    let spocznikHFound = null;

    wellsToDetect.forEach((w) => {
        if (w.stopnie === 'nierdzewna') hasNierdzewna = true;
        else if (w.stopnie === 'drabinka') hasDrabinka = true;
        else if (w.stopnie === 'brak') hasBrak = true;

        if (
            w.dennicaMaterial === 'zelbetowa' ||
            w.nadbudowa === 'zelbetowa' ||
            w.material === 'zelbetowa'
        )
            hasZelbet = true;
        else if (
            w.dennicaMaterial === 'betonowa' ||
            w.nadbudowa === 'betonowa' ||
            w.material === 'betonowa'
        )
            hasBetonStudnia = true;

        if (w.kineta === 'precotop') hasPrecoTop = true;
        else if (w.kineta === 'preco') hasPreco = true;
        else if (w.kineta === 'beton') hasBetonKineta = true;

        if (w.spocznikH && w.spocznikH !== 'brak') spocznikHFound = w.spocznikH;

        if (
            w.agresjaChemiczna &&
            w.agresjaChemiczna !== 'brak' &&
            !result.pozostale.includes(w.agresjaChemiczna)
        ) {
            result.pozostale.push(w.agresjaChemiczna);
        }
        if (
            w.agresjaMrozowa &&
            w.agresjaMrozowa !== 'brak' &&
            !result.pozostale.includes(w.agresjaMrozowa)
        ) {
            result.pozostale.push(w.agresjaMrozowa);
        }
    });

    if (hasNierdzewna) result.stopnie = 'Drabinka nierdzewna';
    else if (hasDrabinka) result.stopnie = 'Drabinka';
    else if (hasBrak) result.stopnie = 'Brak';

    if (hasZelbet) result.rodzajStudni = 'Żelbet';
    else if (hasBetonStudnia) result.rodzajStudni = 'Beton';

    if (hasPrecoTop) result.kineta = 'PrecoTop';
    else if (hasPreco) result.kineta = 'Preco';
    else if (hasBetonKineta) result.kineta = 'Beton';

    if (spocznikHFound) result.wysokoscSpocznika = spocznikHFound;

    return result;
}

function _applyDetectedParams(detected) {
    const setVal = (id, val) => {
        const el = document.getElementById(id);
        if (el) el.value = val;
    };
    setVal('step4-rodzaj-stopni', detected.stopnie);
    setVal('step4-rodzaj-studni', detected.rodzajStudni);
    setVal('step4-uszczelka-studni', 'Brak');
    setVal('step4-kineta', detected.kineta);
    setVal('step4-wysokosc-spocznika', detected.wysokoscSpocznika);
    setVal('step4-usytuowanie', 'Linia dolna');
    setVal('step4-kaskada', 'Nie dotyczy');
    setVal('step4-kaskada-uwagi', '');
    setVal('step4-slepa-kineta', 'Nie dotyczy');
    setVal('step4-slepa-kineta-uwagi', '');
    setVal('step4-redukcja-kinety', 'Nie dotyczy');
    setVal('step4-przejscia-tulejowe', 'Nie dotyczy');
    setVal('step4-przejscia-szczelne', 'Nie dotyczy');
    setVal('step4-wlasciwosci-betonu', 'C40/50');
    setVal('step4-pozostale-wlasciwosci', detected.pozostale ? detected.pozostale.join(', ') : '');
    setVal('step4-przejscia-zamowione', 'Nie dotyczy');
    setVal('step4-data-zamowienia', '');
}

function _getExistingKartaBudowyData() {
    if (
        typeof orderEditMode !== 'undefined' &&
        orderEditMode &&
        orderEditMode.order &&
        orderEditMode.order.kartaBudowy
    ) {
        return orderEditMode.order.kartaBudowy;
    }
    if (
        typeof pendingOrderCreationData !== 'undefined' &&
        pendingOrderCreationData &&
        pendingOrderCreationData.kartaBudowyTemplate
    ) {
        return pendingOrderCreationData.kartaBudowyTemplate;
    }
    return null;
}

function _applyExistingKartaBudowyData(existingData, primaryOfferNumber) {
    if (!existingData) {
        if (primaryOfferNumber) {
            const el = document.getElementById('step4-offer-nr-input');
            if (el) el.value = primaryOfferNumber;
        }
        return;
    }

    const mappings = [
        'emailFaktura',
        'emailEfaktura',
        'adresWysylki',
        'iloscDni',
        'ubezpieczenie',
        'osobaKontakt',
        'wysokoscSpocznika',
        'usytuowanie',
        'kaskada',
        'kaskadaUwagi',
        'slepaKineta',
        'slepaKinetaUwagi',
        'redukcjaKinety',
        'przejsciaTulejowe',
        'przejsciaSzczelne',
        'wlasciwosciBetonu',
        'pozostaleWlasciwosci',
        'przejsciaZamowione',
        'dataZamowienia',
        'uwagiOgolne'
    ];
    mappings.forEach((field) => {
        const inputId = 'step4-' + field.replace(/([A-Z])/g, '-$1').toLowerCase();
        const el = document.getElementById(inputId);
        if (el && existingData[field]) el.value = existingData[field];
    });

    const selectMappings = [
        { field: 'warunkiPlatnosci', id: 'step4-warunki-platnosci' },
        { field: 'zabezpieczenieTransportu', id: 'step4-zabezpieczenie-transportu' },
        { field: 'rodzajTransportu', id: 'step4-rodzaj-transportu' },
        { field: 'rodzajStudni', id: 'step4-rodzaj-studni' }
    ];
    selectMappings.forEach(({ field, id }) => {
        const el = document.getElementById(id);
        if (el && existingData[field]) el.value = existingData[field];
    });

    ['rodzajStopni', 'uszczelkaStudni', 'kineta'].forEach((field) => {
        const inputId = 'step4-' + field.replace(/([A-Z])/g, '-$1').toLowerCase();
        const el = document.getElementById(inputId);
        if (el && existingData[field]) {
            el.value = existingData[field];
            if (existingData[field] === 'Inne') {
                const wrap = document.getElementById(inputId + '-inne-wrap');
                if (wrap) wrap.style.display = 'block';
                const inneInput = document.getElementById(inputId + '-inne');
                if (inneInput) inneInput.value = existingData[field + 'Inne'] || '';
            }
        }
    });

    if (existingData.offerNumbers && existingData.offerNumbers.length > 0) {
        const el = document.getElementById('step4-offer-nr-input');
        if (el) el.value = existingData.offerNumbers.join(', ');
    } else if (primaryOfferNumber) {
        const el = document.getElementById('step4-offer-nr-input');
        if (el) el.value = primaryOfferNumber;
    }
}

function _generateDefaultUwagi() {
    const uwagiEl = document.getElementById('step4-uwagi-ogolne');
    if (!uwagiEl || uwagiEl.value) return;

    const selectedWells = pendingOrderCreationData
        ? pendingOrderCreationData.selectedWells
        : typeof orderEditMode !== 'undefined' && orderEditMode && orderEditMode.order
          ? orderEditMode.order.wells
          : [];
    if (selectedWells.length === 0 || typeof wellDiscounts === 'undefined') return;

    let lines = [];
    let precoDiscounts = new Set();
    let pehdDiscounts = new Set();
    let paintingLines = new Set();

    const uniqueDns = [...new Set(selectedWells.map((w) => w.dn))];
    uniqueDns.forEach((dn) => {
        const discountKey = dn === 'styczna' ? 'styczne' : dn;
        const d = wellDiscounts[discountKey];
        if (d) {
            const den = parseFloat(d.dennica || 0);
            const nad = parseFloat(d.nadbudowa || 0);
            const pre = parseFloat(d.preco || 0);
            const pehd = parseFloat(d.pehd || 0);

            let parts = [];
            if (den > 0) parts.push(`Dennica: ${den.toFixed(2).replace('.', ',')}%`);
            if (nad > 0) parts.push(`Nadbudowa: ${nad.toFixed(2).replace('.', ',')}%`);

            if (parts.length > 0) {
                const label = dn === 'styczna' ? 'Styczne' : `DN${dn}`;
                lines.push(`${label} ${parts.join(', ')}`);
            }
            if (pre > 0) precoDiscounts.add(pre);
            if (pehd > 0) pehdDiscounts.add(pehd);
        }
    });

    selectedWells.forEach((w) => {
        if (w.malowanieW && w.malowanieW !== 'brak') {
            const price = parseFloat(w.malowanieWewCena || 0)
                .toFixed(2)
                .replace('.', ',');
            paintingLines.add(`Malowanie wewnątrz (${w.malowanieW}): ${price} PLN/m²`);
        }
        if (w.malowanieZ && w.malowanieZ !== 'brak') {
            const price = parseFloat(w.malowanieZewCena || 0)
                .toFixed(2)
                .replace('.', ',');
            paintingLines.add(`Malowanie zewnątrz (${w.malowanieZ}): ${price} PLN/m²`);
        }
    });

    precoDiscounts.forEach((pre) => lines.push(`Preco: ${pre.toFixed(2).replace('.', ',')}%`));
    pehdDiscounts.forEach((pehd) =>
        lines.push(`Wkładka PEHD: ${pehd.toFixed(2).replace('.', ',')}%`)
    );
    paintingLines.forEach((pl) => lines.push(pl));

    if (lines.length > 0) {
        uwagiEl.value = lines.join('\n');
    }
}

function initKartaBudowyStep4(primaryOfferNumber) {
    _przejsciaInitialized = false;
    _resetKartaBudowyForm();

    const transport = _calcTransportCosts();
    _displayTransportCost(transport.tCost, transport.costPerTrip);

    const detected = _detectWellParams();
    _applyDetectedParams(detected);

    const existingData = _getExistingKartaBudowyData();
    _applyExistingKartaBudowyData(existingData, primaryOfferNumber);

    if (typeof renderKartaBudowyCopyOptions === 'function') {
        renderKartaBudowyCopyOptions();
    }
    renderPrzejsciaDetailsTable(existingData ? existingData.przejsciaDetails : null);

    _generateDefaultUwagi();
}

async function step4NextAction() {
    const kartaData = collectKartaBudowyDataStep4();

    if (typeof orderEditMode !== 'undefined' && orderEditMode && orderEditMode.order) {
        orderEditMode.order.kartaBudowy = kartaData;
        goToWizardStep(5);
        return;
    }

    if (typeof pendingOrderCreationData !== 'undefined' && pendingOrderCreationData) {
        const { offer, selectedWells } = pendingOrderCreationData;
        pendingOrderCreationData = null;
        await finalizeOrderFromOffer(offer, selectedWells, kartaData);
        return;
    }

    goToWizardStep(5);
}

function getKartaBudowyCopyOrders() {
    if (typeof pendingOrderCreationData !== 'undefined' && pendingOrderCreationData) {
        return pendingOrderCreationData.kartaBudowyTemplateOrders || [];
    }
    if (typeof orderEditMode !== 'undefined' && orderEditMode && orderEditMode.order) {
        const offerId =
            orderEditMode.order.offerId ||
            orderEditMode.order.offerStudnieId ||
            editingOfferIdStudnie;
        return getOrdersForOffer(offerId).filter(
            (order) => String(order.id) !== String(orderEditMode.order.id)
        );
    }
    return [];
}

async function showKartaBudowyCopyPicker() {
    if (!ordersStudnie) {
        ordersStudnie = await loadOrdersStudnie();
    }

    renderKartaBudowyCopyOptions();

    const copySelect = document.getElementById('step4-copy-order-select');
    const orders = getKartaBudowyCopyOrders();

    if (!orders.some((order) => order.kartaBudowy)) {
        if (typeof showToast === 'function') {
            showToast('Brak zamówień z zapisaną Kartą Budowy dla tej oferty.', 'info');
        }
        return;
    }

    if (copySelect) copySelect.focus();
}

function renderKartaBudowyCopyOptions() {
    const copySelect = document.getElementById('step4-copy-order-select');
    const copyButton = document.getElementById('step4-copy-toggle-btn');
    const helpText = document.getElementById('step4-copy-order-help');
    const orders =
        typeof pendingOrderCreationData !== 'undefined' && pendingOrderCreationData
            ? pendingOrderCreationData.kartaBudowyTemplateOrders || []
            : getKartaBudowyCopyOrders();

    if (!copySelect) return;

    if (!orders || orders.length === 0) {
        copySelect.innerHTML = '<option>Brak zamówień do kopiowania</option>';
        copySelect.disabled = true;
        if (copyButton) copyButton.disabled = true;
        if (helpText)
            helpText.textContent = 'Brak wcześniejszych zamówień powiązanych z tą ofertą.';
        return;
    }

    const optionsHtml = [`<option value="">Wybierz kartę budowy do skopiowania</option>`].concat(
        orders.map((order) => {
            const label = order.orderNumber
                ? order.orderNumber
                : order.id
                  ? order.id.substring(0, 8)
                  : 'Brak numeru';
            const suffix = order.kartaBudowy ? '' : ' (brak karty budowy)';
            return `<option value="${order.id}"${order.kartaBudowy ? '' : ' disabled'}>${label}${suffix}</option>`;
        })
    );

    copySelect.innerHTML = optionsHtml.join('');
    copySelect.disabled = false;
    if (copyButton) copyButton.disabled = !orders.some((order) => order.kartaBudowy);
    if (helpText)
        helpText.textContent =
            'Wybierz istniejące zamówienie, aby skopiować jego dane Karty Budowy.';
}

function copyKartaBudowyFromOrder() {
    const copySelect = document.getElementById('step4-copy-order-select');
    if (!copySelect) return;

    const orderId = copySelect.value;
    if (!orderId) {
        if (typeof showToast === 'function') {
            showToast('Wybierz zamówienie do skopiowania.', 'error');
        }
        return;
    }

    const orders =
        typeof pendingOrderCreationData !== 'undefined' && pendingOrderCreationData
            ? pendingOrderCreationData.kartaBudowyTemplateOrders || []
            : getKartaBudowyCopyOrders();
    const sourceOrder = orders.find((order) => String(order.id) === String(orderId));

    if (!sourceOrder) {
        if (typeof showToast === 'function') {
            showToast('Nie znaleziono wybranego zamówienia.', 'error');
        }
        return;
    }

    if (!sourceOrder.kartaBudowy) {
        if (typeof showToast === 'function') {
            showToast('Wybrane zamówienie nie ma zapisanych danych Karty Budowy.', 'error');
        }
        return;
    }

    applyCopiedKartaBudowyData(sourceOrder.kartaBudowy);

    if (typeof pendingOrderCreationData !== 'undefined' && pendingOrderCreationData) {
        pendingOrderCreationData.kartaBudowyTemplate = collectKartaBudowyDataStep4();
    }

    if (typeof showToast === 'function') {
        showToast(
            `Skopiowano dane Karty Budowy z zamówienia ${sourceOrder.orderNumber || sourceOrder.id.substring(0, 8)}.`,
            'success'
        );
    }
}

function applyCopiedKartaBudowyData(sourceData) {
    if (!sourceData) return;

    const setValue = (id, value) => {
        const el = document.getElementById(id);
        if (!el || value === undefined || value === null) return;
        el.value = value;
    };
    const setSelect = (id, value) => {
        const el = document.getElementById(id);
        if (!el || value === undefined || value === null || value === '') return;
        el.value = value;
    };

    setValue('step4-email-faktura', sourceData.emailFaktura || '');
    setValue('step4-email-efaktura', sourceData.emailEfaktura || '');
    if (Array.isArray(sourceData.offerNumbers) && sourceData.offerNumbers.length > 0) {
        setValue('step4-offer-nr-input', sourceData.offerNumbers.join(', '));
    }
    setValue('step4-adres-wysylki', sourceData.adresWysylki || '');
    setSelect('step4-warunki-platnosci', sourceData.warunkiPlatnosci);
    setValue('step4-ilosc-dni', sourceData.iloscDni || '');
    setValue('step4-ubezpieczenie', sourceData.ubezpieczenie || '');
    setValue('step4-osoba-kontakt', sourceData.osobaKontakt || '');
    setSelect('step4-zabezpieczenie-transportu', sourceData.zabezpieczenieTransportu);
    setSelect('step4-rodzaj-transportu', sourceData.rodzajTransportu);
    setSelect('step4-rodzaj-stopni', sourceData.rodzajStopni);
    setValue('step4-rodzaj-stopni-inne', sourceData.rodzajStopniInne || '');
    setSelect('step4-rodzaj-studni', sourceData.rodzajStudni);
    setSelect('step4-uszczelka-studni', sourceData.uszczelkaStudni);
    setValue('step4-uszczelka-studni-inne', sourceData.uszczelkaStudniInne || '');
    setSelect('step4-kineta', sourceData.kineta);
    setValue('step4-kineta-inne', sourceData.kinetaInne || '');
    setSelect('step4-wysokosc-spocznika', sourceData.wysokoscSpocznika);
    setSelect('step4-usytuowanie', sourceData.usytuowanie);
    setSelect('step4-kaskada', sourceData.kaskada);
    setValue('step4-kaskada-uwagi', sourceData.kaskadaUwagi || '');
    setSelect('step4-slepa-kineta', sourceData.slepaKineta);
    setValue('step4-slepa-kineta-uwagi', sourceData.slepaKinetaUwagi || '');
    setSelect('step4-redukcja-kinety', sourceData.redukcjaKinety);
    setSelect('step4-przejscia-tulejowe', sourceData.przejsciaTulejowe);
    setSelect('step4-przejscia-szczelne', sourceData.przejsciaSzczelne);
    setSelect('step4-wlasciwosci-betonu', sourceData.wlasciwosciBetonu);
    setValue('step4-pozostale-wlasciwosci', sourceData.pozostaleWlasciwosci || '');
    setSelect('step4-przejscia-zamowione', sourceData.przejsciaZamowione);
    setValue('step4-data-zamowienia', sourceData.dataZamowienia || '');
    setValue('step4-uwagi-ogolne', sourceData.uwagiOgolne || '');

    const toggleOther = (selectId, wrapId) => {
        const select = document.getElementById(selectId);
        const wrap = document.getElementById(wrapId);
        if (select && wrap) wrap.style.display = select.value === 'Inne' ? 'block' : 'none';
    };
    toggleOther('step4-rodzaj-stopni', 'step4-rodzaj-stopni-inne-wrap');
    toggleOther('step4-uszczelka-studni', 'step4-uszczelka-studni-inne-wrap');
    toggleOther('step4-kineta', 'step4-kineta-inne-wrap');

    mergeCopiedCustomPrzejscia(sourceData.przejsciaDetails);
}

function mergeCopiedCustomPrzejscia(sourceDetails) {
    if (!Array.isArray(sourceDetails)) return;

    _syncCustomRowsFromDOM();
    const copiedCustomRows = sourceDetails
        .filter((row) => row && row.source !== 'offer' && row.rodzaj)
        .map((row) => ({
            rodzaj: row.rodzaj || '',
            dnOd: row.dnOd ?? '',
            dnDo: row.dnDo ?? '',
            uwagi: row.uwagi || '',
            czyPrzejscie: row.czyPrzejscie || 'TAK',
            source: 'custom'
        }));

    copiedCustomRows.forEach((row) => {
        const exists = _customPrzejscieRows.some(
            (current) =>
                String(current.rodzaj || '') === String(row.rodzaj || '') &&
                String(current.dnOd || '') === String(row.dnOd || '') &&
                String(current.dnDo || '') === String(row.dnDo || '') &&
                String(current.uwagi || '') === String(row.uwagi || '')
        );
        if (!exists) _customPrzejscieRows.push(row);
    });

    renderPrzejsciaDetailsTable(null);
}

function collectKartaBudowyDataStep4() {
    const emailFaktura = (document.getElementById('step4-email-faktura')?.value || '').trim();
    const emailEfaktura = (document.getElementById('step4-email-efaktura')?.value || '').trim();
    const offerInput = document.getElementById('step4-offer-nr-input')?.value || '';
    const uwagiOgolne = (document.getElementById('step4-uwagi-ogolne')?.value || '').trim();
    const adresWysylki = (document.getElementById('step4-adres-wysylki')?.value || '').trim();
    const warunkiPlatnosci = (
        document.getElementById('step4-warunki-platnosci')?.value || 'przelew'
    ).trim();
    const iloscDni = (document.getElementById('step4-ilosc-dni')?.value || '').trim();
    const ubezpieczenie = (document.getElementById('step4-ubezpieczenie')?.value || '').trim();
    const osobaKontakt = (document.getElementById('step4-osoba-kontakt')?.value || '').trim();
    const zabezpieczenieTransportu = (
        document.getElementById('step4-zabezpieczenie-transportu')?.value || 'Nie dotyczy'
    ).trim();
    const rodzajTransportu = (
        document.getElementById('step4-rodzaj-transportu')?.value || 'Transport P.V.'
    ).trim();
    const rodzajStopni = (
        document.getElementById('step4-rodzaj-stopni')?.value || 'Nie dotyczy'
    ).trim();
    const rodzajStopniInne = (
        document.getElementById('step4-rodzaj-stopni-inne')?.value || ''
    ).trim();
    const rodzajStudni = (
        document.getElementById('step4-rodzaj-studni')?.value || 'Nie dotyczy'
    ).trim();
    const uszczelkaStudni = (
        document.getElementById('step4-uszczelka-studni')?.value || 'Brak'
    ).trim();
    const uszczelkaStudniInne = (
        document.getElementById('step4-uszczelka-studni-inne')?.value || ''
    ).trim();
    const kineta = (document.getElementById('step4-kineta')?.value || 'Brak').trim();
    const kinetaInne = (document.getElementById('step4-kineta-inne')?.value || '').trim();
    const wysokoscSpocznika = (
        document.getElementById('step4-wysokosc-spocznika')?.value || 'Nie dotyczy'
    ).trim();
    const usytuowanie = (
        document.getElementById('step4-usytuowanie')?.value || 'Linia dolna'
    ).trim();
    const kaskada = (document.getElementById('step4-kaskada')?.value || 'Nie dotyczy').trim();
    const kaskadaUwagi = (document.getElementById('step4-kaskada-uwagi')?.value || '').trim();
    const slepaKineta = (
        document.getElementById('step4-slepa-kineta')?.value || 'Nie dotyczy'
    ).trim();
    const slepaKinetaUwagi = (
        document.getElementById('step4-slepa-kineta-uwagi')?.value || ''
    ).trim();
    const redukcjaKinety = (
        document.getElementById('step4-redukcja-kinety')?.value || 'Nie dotyczy'
    ).trim();
    const przejsciaTulejowe = (
        document.getElementById('step4-przejscia-tulejowe')?.value || 'Nie dotyczy'
    ).trim();
    const przejsciaSzczelne = (
        document.getElementById('step4-przejscia-szczelne')?.value || 'Nie dotyczy'
    ).trim();
    const wlasciwosciBetonu = (
        document.getElementById('step4-wlasciwosci-betonu')?.value || 'C40/50'
    ).trim();
    const pozostaleWlasciwosci = (
        document.getElementById('step4-pozostale-wlasciwosci')?.value || ''
    ).trim();
    const wyliczonyTransport = (
        document.getElementById('step4-wyliczony-transport')?.value || ''
    ).trim();
    const przejsciaZamowione = (
        document.getElementById('step4-przejscia-zamowione')?.value || 'Nie dotyczy'
    ).trim();
    const dataZamowienia = (document.getElementById('step4-data-zamowienia')?.value || '').trim();

    const offerNumbers = offerInput
        .split(',')
        .map((n) => n.trim())
        .filter((n) => n);

    return {
        emailFaktura,
        emailEfaktura,
        offerNumbers,
        adresWysylki,
        warunkiPlatnosci,
        iloscDni,
        ubezpieczenie,
        osobaKontakt,
        zabezpieczenieTransportu,
        rodzajTransportu,
        wyliczonyTransport,
        rodzajStopni,
        rodzajStopniInne,
        rodzajStudni,
        uszczelkaStudni,
        uszczelkaStudniInne,
        kineta,
        kinetaInne,
        wysokoscSpocznika,
        usytuowanie,
        kaskada,
        kaskadaUwagi,
        slepaKineta,
        slepaKinetaUwagi,
        redukcjaKinety,
        przejsciaTulejowe,
        przejsciaSzczelne,
        wlasciwosciBetonu,
        pozostaleWlasciwosci,
        przejsciaZamowione,
        dataZamowienia,
        przejsciaDetails: collectPrzejsciaDetailsFromTable(),
        uwagiOgolne: uwagiOgolne,
        createdAt: new Date().toISOString()
    };
}

function handlePrzejsciaZamowioneChange(selectElement) {
    const dataInput = document.getElementById('step4-data-zamowienia');
    if (!dataInput) return;

    if (selectElement.value === 'Tak') {
        const today = new Date();
        const yyyy = today.getFullYear();
        const mm = String(today.getMonth() + 1).padStart(2, '0');
        const dd = String(today.getDate()).padStart(2, '0');
        dataInput.value = `${yyyy}-${mm}-${dd}`;
    }
}

/* ===== SEKCJA PRZEJŚĆ SZCZELNYCH — SZCZEGÓŁY Z OFERTY ===== */

var _customPrzejscieRows = [];
var _offerPrzejscieRows = [];
var _przejsciaInitialized = false;

function buildOfferPrzejsciaTypes() {
    const usedProductIds = new Set();
    if (typeof wells !== 'undefined' && Array.isArray(wells)) {
        wells.forEach((w) => {
            if (w.przejscia && Array.isArray(w.przejscia)) {
                w.przejscia.forEach((pr) => {
                    if (pr.productId) {
                        usedProductIds.add(pr.productId);
                    }
                });
            }
        });
    }

    const przejsciaProducts = studnieProducts.filter(
        (p) => p.componentType === 'przejscie' && p.active !== 0 && usedProductIds.has(p.id)
    );
    const typeMap = new Map();
    const stringDnMap = new Map();

    przejsciaProducts.forEach((p) => {
        const cat = p.category;
        if (!cat) return;

        if (typeof p.dn === 'string' && p.dn.includes('/')) {
            if (!stringDnMap.has(cat)) {
                stringDnMap.set(cat, { dnStrings: [] });
            }
            stringDnMap.get(cat).dnStrings.push(p.dn);
        } else {
            let dn = parseFloat(p.dn) || 0;
            if (!typeMap.has(cat)) {
                typeMap.set(cat, { dnMin: dn, dnMax: dn });
            } else {
                const entry = typeMap.get(cat);
                if (dn < entry.dnMin) entry.dnMin = dn;
                if (dn > entry.dnMax) entry.dnMax = dn;
            }
        }
    });

    const result = [];
    typeMap.forEach((val, key) => {
        result.push({
            rodzaj: key,
            dnOd: val.dnMin,
            dnDo: val.dnMax,
            ilosc: 1,
            uwagi: '',
            czyPrzejscie: 'TAK',
            source: 'offer'
        });
    });
    stringDnMap.forEach((val, key) => {
        val.dnStrings = [...val.dnStrings].sort((a, b) => {
            const aFirst = parseFloat(a.split('/')[0]) || 0;
            const bFirst = parseFloat(b.split('/')[0]) || 0;
            return aFirst - bFirst;
        });
        const uniqueDns = [...new Set(val.dnStrings)];
        uniqueDns.forEach((dn) => {
            result.push({
                rodzaj: key,
                dnOd: dn,
                dnDo: dn,
                ilosc: 1,
                uwagi: '',
                czyPrzejscie: 'TAK',
                source: 'offer'
            });
        });
    });
    return result.sort((a, b) => a.rodzaj.localeCompare(b.rodzaj));
}

function renderPrzejsciaDetailsTable(existingData) {
    const container = document.getElementById('step4-przejscia-details-table');
    if (!container) return;

    if (!_przejsciaInitialized || existingData) {
        _offerPrzejscieRows = buildOfferPrzejsciaTypes();
        _customPrzejscieRows = [];
        if (existingData && Array.isArray(existingData)) {
            _customPrzejscieRows = existingData.filter((r) => r.source === 'custom');
            const savedOffers = existingData.filter((r) => r.source === 'offer');
            if (savedOffers.length > 0) {
                _offerPrzejscieRows = savedOffers;
            } else {
                _offerPrzejscieRows.forEach((ot) => {
                    const saved = existingData.find(
                        (s) => s.source === 'offer' && s.rodzaj === ot.rodzaj
                    );
                    if (saved) {
                        ot.dnOd = saved.dnOd ?? ot.dnOd;
                        ot.dnDo = saved.dnDo ?? ot.dnDo;
                        ot.ilosc = saved.ilosc || 1;
                        ot.uwagi = saved.uwagi || '';
                        ot.czyPrzejscie = saved.czyPrzejscie || 'TAK';
                    }
                });
            }
        }
        _przejsciaInitialized = true;
    }

    const allRows = [..._offerPrzejscieRows, ..._customPrzejscieRows];

    if (allRows.length === 0) {
        container.innerHTML =
            '<div style="text-align:center; padding:1rem; color:var(--text-muted); font-size:0.72rem; border:1px dashed rgba(255,255,255,0.08); border-radius:8px;">Brak przejść szczelnych w cenniku. Dodaj niestandardowe przejście przyciskiem powyżej.</div>';
        return;
    }

    let html = `<div style="overflow-x:auto;">
        <table style="width:100%; border-collapse:collapse; font-size:0.75rem;">
            <thead>
                <tr style="border-bottom:1px solid rgba(var(--accent2-rgb),0.2);">
                    <th style="text-align:left; padding:0.4rem 0.5rem; color:var(--accent2-hover); font-size:0.65rem; font-weight:700; text-transform:uppercase; letter-spacing:0.3px; white-space:nowrap;">Rodzaj</th>
                    <th style="text-align:center; padding:0.4rem 0.5rem; color:var(--accent2-hover); font-size:0.65rem; font-weight:700; text-transform:uppercase; letter-spacing:0.3px; white-space:nowrap;">DN od</th>
                    <th style="text-align:center; padding:0.4rem 0.5rem; color:var(--accent2-hover); font-size:0.65rem; font-weight:700; text-transform:uppercase; letter-spacing:0.3px; white-space:nowrap;">DN do</th>
                    <th style="text-align:left; padding:0.4rem 0.5rem; color:var(--accent2-hover); font-size:0.65rem; font-weight:700; text-transform:uppercase; letter-spacing:0.3px; white-space:nowrap;">Uwagi</th>
                    <th style="text-align:center; padding:0.4rem 0.5rem; color:var(--accent2-hover); font-size:0.65rem; font-weight:700; text-transform:uppercase; letter-spacing:0.3px; white-space:nowrap;">Czy przejście?</th>
                    <th style="width:36px;"></th>
                </tr>
            </thead>
            <tbody>`;

    _offerPrzejscieRows.forEach((row, idx) => {
        html += buildPrzejscieRowHTML(row, idx, 'offer');
    });

    _customPrzejscieRows.forEach((row, idx) => {
        html += buildPrzejscieRowHTML(row, idx, 'custom');
    });

    html += '</tbody></table></div>';
    container.innerHTML = html;

    if (window.lucide && window.lucide.createIcons) {
        window.lucide.createIcons();
    }
}

function updatePrzejscieDnOptions(prefix, category) {
    const dns = new Set();
    const dnsStr = new Set();
    let hasStringDn = false;
    if (typeof studnieProducts !== 'undefined') {
        studnieProducts.forEach((p) => {
            if (
                p.componentType === 'przejscie' &&
                p.active !== 0 &&
                (!category || category === 'Inne' || p.category === category)
            ) {
                if (typeof p.dn === 'string' && p.dn.includes('/')) {
                    hasStringDn = true;
                    dnsStr.add(p.dn);
                    dns.add(parseFloat(p.dn.split('/')[1]) || parseFloat(p.dn.split('/')[0]) || 0);
                } else if (p.dn) {
                    dns.add(parseFloat(p.dn) || 0);
                }
            }
        });
    }

    if (hasStringDn && category && category !== 'Inne') {
        const sortedStr = Array.from(dnsStr).sort((a, b) => {
            const aFirst = parseFloat(a.split('/')[0]) || 0;
            const bFirst = parseFloat(b.split('/')[0]) || 0;
            return aFirst - bFirst;
        });
        const minStr = sortedStr[0] || '';
        const maxStr = sortedStr[sortedStr.length - 1] || minStr;

        ['dnod', 'dndo'].forEach((type) => {
            const select = document.getElementById(`${prefix}-${type}-select`);
            const input = document.getElementById(`${prefix}-${type}`);
            if (!select || !input) return;
            const val = type === 'dndo' ? maxStr : minStr;
            input.type = 'text';
            input.value = val;
            input.style.display = 'block';
            input.readOnly = true;
            input.style.opacity = '0.7';
            input.style.cursor = 'default';
            select.style.display = 'none';
        });
        return;
    }

    const dnOptions = Array.from(dns)
        .filter((d) => !isNaN(d) && d > 0)
        .sort((a, b) => a - b);

    ['dnod', 'dndo'].forEach((type) => {
        const select = document.getElementById(`${prefix}-${type}-select`);
        const input = document.getElementById(`${prefix}-${type}`);
        if (!select || !input) return;

        const currVal = input.value;
        const forceInne = category === 'Inne';
        const isCurrInne = forceInne || (currVal && !dnOptions.includes(parseFloat(currVal)));

        let html = `<option value="" ${!currVal && !forceInne ? 'selected' : ''}>—</option>`;
        html += dnOptions
            .map(
                (d) =>
                    `<option value="${d}" ${!forceInne && parseFloat(currVal) === d ? 'selected' : ''}>${d}</option>`
            )
            .join('');
        html += `<option value="Inne" ${isCurrInne ? 'selected' : ''}>Inne</option>`;

        select.innerHTML = html;
        if (isCurrInne) {
            select.value = 'Inne';
            input.style.display = 'block';
        } else if (currVal && dnOptions.includes(parseFloat(currVal))) {
            select.value = String(parseFloat(currVal));
            input.style.display = 'none';
        } else {
            select.value = '';
            input.value = '';
            input.style.display = 'none';
        }
    });
}

function buildPrzejscieRowHTML(row, idx, source) {
    const prefix = `step4-psz-${source}-${idx}`;
    const rowBg = source === 'custom' ? 'rgba(var(--warn-rgb),0.04)' : 'transparent';
    const borderLeft = source === 'custom' ? '2px solid rgba(var(--warn-rgb),0.3)' : 'none';

    const cats = new Set();
    const dns = new Set();
    const dnsStr = new Set();
    if (typeof studnieProducts !== 'undefined') {
        studnieProducts.forEach((p) => {
            if (p.componentType === 'przejscie' && p.active !== 0) {
                if (p.category) cats.add(p.category);
                if (!row.rodzaj || row.rodzaj === 'Inne' || p.category === row.rodzaj) {
                    if (typeof p.dn === 'string' && p.dn.includes('/')) {
                        dnsStr.add(p.dn);
                        dns.add(
                            parseFloat(p.dn.split('/')[1]) || parseFloat(p.dn.split('/')[0]) || 0
                        );
                    } else if (p.dn) {
                        dns.add(parseFloat(p.dn) || 0);
                    }
                }
            }
        });
    }

    const catOptions = Array.from(cats).sort();
    const dnOptions = Array.from(dns)
        .filter((d) => !isNaN(d) && d > 0)
        .sort((a, b) => a - b);

    const isRodzajInne = row.rodzaj && !catOptions.includes(row.rodzaj);
    const rowHasStringDn = typeof row.dnOd === 'string' && row.dnOd.includes('/');
    const isDnOdInne = !rowHasStringDn && row.dnOd && !dnOptions.includes(parseFloat(row.dnOd));
    const isDnDoInne = !rowHasStringDn && row.dnDo && !dnOptions.includes(parseFloat(row.dnDo));

    const pszWarnAttr = source === 'offer' ? ' data-psz-warn="1"' : '';

    const rodzajCell = `
        <div style="display:flex; gap:0.4rem; flex-direction:column;">
            <select id="${prefix}-rodzaj-select" class="form-input" style="width:100%; font-size:0.78rem; padding:0.3rem 0.5rem; background:rgba(255,255,255,0.03); border:1px solid rgba(255,255,255,0.1); border-radius:4px; color:var(--text-primary);" data-action="pszRodzajCatChange"${pszWarnAttr}>
                <option value="" disabled ${!row.rodzaj ? 'selected' : ''}>Wybierz rodzaj...</option>
                ${catOptions.map((c) => `<option value="${c}" ${row.rodzaj === c ? 'selected' : ''}>${c}</option>`).join('')}
                <option value="Inne" ${isRodzajInne ? 'selected' : ''}>Inne</option>
            </select>
            <input type="text" id="${prefix}-rodzaj" class="form-input" value="${(row.rodzaj || '').toString().replace(/"/g, '&quot;')}" placeholder="Wpisz własny rodzaj..." style="width:100%; font-size:0.78rem; padding:0.3rem 0.5rem; background:rgba(255,255,255,0.03); border:1px solid rgba(255,255,255,0.1); border-radius:4px; color:var(--text-primary); display:${isRodzajInne ? 'block' : 'none'};" data-action="pszRodzajCustomChange"${pszWarnAttr}>
        </div>`;

    const dnOdCell = rowHasStringDn
        ? `
        <div style="display:flex; gap:0.4rem; flex-direction:column;">
            <input type="text" id="${prefix}-dnod" class="form-input" value="${(row.dnOd || '').toString().replace(/"/g, '&quot;')}" readonly style="width:100%; min-width:90px; font-size:0.78rem; padding:0.3rem; text-align:center; background:rgba(255,255,255,0.03); border:1px solid rgba(255,255,255,0.1); border-radius:4px; color:var(--text-primary); font-weight:700; opacity:0.7; cursor:default;">
        </div>`
        : `
        <div style="display:flex; gap:0.4rem; flex-direction:column;">
            <select id="${prefix}-dnod-select" class="form-input" style="width:100%; min-width:72px; font-size:0.78rem; padding:0.3rem; text-align:center; background:rgba(255,255,255,0.03); border:1px solid rgba(255,255,255,0.1); border-radius:4px; color:var(--text-primary);" data-action="pszDnSelectChange" data-psz-field="dnod"${pszWarnAttr}>
                <option value="" ${!row.dnOd ? 'selected' : ''}>—</option>
                ${dnOptions.map((d) => `<option value="${d}" ${parseFloat(row.dnOd) === d ? 'selected' : ''}>${d}</option>`).join('')}
                <option value="Inne" ${isDnOdInne ? 'selected' : ''}>Inne</option>
            </select>
            <input type="number" id="${prefix}-dnod" class="form-input" value="${row.dnOd || ''}" placeholder="DN od" min="0" style="width:100%; min-width:72px; font-size:0.78rem; padding:0.3rem; text-align:center; background:rgba(255,255,255,0.03); border:1px solid rgba(255,255,255,0.1); border-radius:4px; color:var(--text-primary); font-weight:700; display:${isDnOdInne ? 'block' : 'none'};" data-action="pszDnInputChange" data-psz-field="dnod"${pszWarnAttr}>
        </div>`;

    const dnDoCell = rowHasStringDn
        ? `
        <div style="display:flex; gap:0.4rem; flex-direction:column;">
            <input type="text" id="${prefix}-dndo" class="form-input" value="${(row.dnDo || '').toString().replace(/"/g, '&quot;')}" readonly style="width:100%; min-width:90px; font-size:0.78rem; padding:0.3rem; text-align:center; background:rgba(255,255,255,0.03); border:1px solid rgba(255,255,255,0.1); border-radius:4px; color:var(--text-primary); font-weight:700; opacity:0.7; cursor:default;">
        </div>`
        : `
        <div style="display:flex; gap:0.4rem; flex-direction:column;">
            <select id="${prefix}-dndo-select" class="form-input" style="width:100%; min-width:72px; font-size:0.78rem; padding:0.3rem; text-align:center; background:rgba(255,255,255,0.03); border:1px solid rgba(255,255,255,0.1); border-radius:4px; color:var(--text-primary);" data-action="pszDnSelectChange" data-psz-field="dndo"${pszWarnAttr}>
                <option value="" ${!row.dnDo ? 'selected' : ''}>—</option>
                ${dnOptions.map((d) => `<option value="${d}" ${parseFloat(row.dnDo) === d ? 'selected' : ''}>${d}</option>`).join('')}
                <option value="Inne" ${isDnDoInne ? 'selected' : ''}>Inne</option>
            </select>
            <input type="number" id="${prefix}-dndo" class="form-input" value="${row.dnDo || ''}" placeholder="DN do" min="0" style="width:100%; min-width:72px; font-size:0.78rem; padding:0.3rem; text-align:center; background:rgba(255,255,255,0.03); border:1px solid rgba(255,255,255,0.1); border-radius:4px; color:var(--text-primary); font-weight:700; display:${isDnDoInne ? 'block' : 'none'};" data-action="pszDnInputChange" data-psz-field="dndo"${pszWarnAttr}>
        </div>`;

    return `<tr style="border-bottom:1px solid rgba(255,255,255,0.04); background:${rowBg}; border-left:${borderLeft};" data-psz-source="${source}" data-psz-idx="${idx}">
        <td style="padding:0.4rem 0.5rem; white-space:nowrap; vertical-align:top;">${rodzajCell}</td>
        <td style="padding:0.4rem 0.3rem; text-align:center; vertical-align:top;">${dnOdCell}</td>
        <td style="padding:0.4rem 0.3rem; text-align:center; vertical-align:top;">${dnDoCell}</td>
        <td style="padding:0.4rem 0.5rem; vertical-align:top;">
            <input type="text" id="${prefix}-uwagi" class="form-input" value="${(row.uwagi || '').toString().replace(/"/g, '&quot;')}" placeholder="Uwagi..." style="width:100%; font-size:0.75rem; padding:0.3rem 0.5rem; background:rgba(255,255,255,0.03); border:1px solid rgba(255,255,255,0.1); border-radius:4px; color:var(--text-primary);" data-action="pszUwagiChange"${pszWarnAttr}>
        </td>
        <td style="padding:0.4rem 0.3rem; text-align:center; vertical-align:top;">
            <select id="${prefix}-czy" class="form-input" style="width:80px; font-size:0.75rem; padding:0.3rem; text-align:center; font-weight:700; border-radius:4px; ${row.czyPrzejscie === 'TAK' ? 'color:var(--success-hover); background:rgba(var(--success-rgb),0.1); border:1px solid rgba(var(--success-rgb),0.3);' : 'color:var(--danger-hover); background:rgba(var(--danger-rgb),0.1); border:1px solid rgba(var(--danger-rgb),0.3);'}" data-action="pszCzyChange"${pszWarnAttr}>
                <option value="TAK"${row.czyPrzejscie === 'TAK' ? ' selected' : ''}>TAK</option>
                <option value="NIE"${row.czyPrzejscie === 'NIE' ? ' selected' : ''}>NIE</option>
            </select>
        </td>
        <td style="padding:0.4rem 0.2rem; text-align:center; vertical-align:top;">
            <button type="button" class="btn-icon-danger btn-icon-sm" data-action="pszDeleteRow" title="Usuń"><i data-lucide="trash-2" style="width:13px;height:13px;"></i></button>
        </td>
    </tr>`;
}

function updatePrzejscieSelectStyle(selectEl) {
    if (selectEl.value === 'TAK') {
        selectEl.style.color = 'var(--success-hover)';
        selectEl.style.background = 'rgba(var(--success-rgb),0.1)';
        selectEl.style.border = '1px solid rgba(var(--success-rgb),0.3)';
    } else {
        selectEl.style.color = 'var(--danger-hover)';
        selectEl.style.background = 'rgba(var(--danger-rgb),0.1)';
        selectEl.style.border = '1px solid rgba(var(--danger-rgb),0.3)';
    }
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

    renderPrzejsciaDetailsTable(null);
    setTimeout(() => {
        const newIdx = _customPrzejscieRows.length - 1;
        const rodzajInput = document.getElementById(`step4-psz-custom-${newIdx}-rodzaj`);
        if (rodzajInput) rodzajInput.focus();
    }, 50);
}

async function removePrzejscieRow(source, idx) {
    _syncCustomRowsFromDOM();
    if (source === 'offer') {
        if (
            !(await appConfirm(
                'Usuwasz przejście przepisane z oferty. Czy na pewno chcesz to zrobić?',
                { title: 'Potwierdzenie', type: 'warning' }
            ))
        )
            return;
        _offerPrzejscieRows.splice(idx, 1);
    } else {
        _customPrzejscieRows.splice(idx, 1);
    }
    renderPrzejsciaDetailsTable(null);
}

function _syncCustomRowsFromDOM() {
    const rows = document.querySelectorAll('tr[data-psz-source]');
    rows.forEach((tr) => {
        const source = tr.dataset.pszSource;
        const idx = parseInt(tr.dataset.pszIdx);
        const prefix = `step4-psz-${source}-${idx}`;

        const rodzajEl = document.getElementById(`${prefix}-rodzaj`);
        const dnOdEl = document.getElementById(`${prefix}-dnod`);
        const dnDoEl = document.getElementById(`${prefix}-dndo`);
        const iloscEl = document.getElementById(`${prefix}-ilosc`);
        const uwagiEl = document.getElementById(`${prefix}-uwagi`);
        const czyEl = document.getElementById(`${prefix}-czy`);

        if (!rodzajEl) return;

        const data = {
            rodzaj: rodzajEl.value.trim(),
            dnOd:
                dnOdEl && dnOdEl.value
                    ? dnOdEl.value.includes('/')
                        ? dnOdEl.value
                        : parseFloat(dnOdEl.value)
                    : '',
            dnDo:
                dnDoEl && dnDoEl.value
                    ? dnDoEl.value.includes('/')
                        ? dnDoEl.value
                        : parseFloat(dnDoEl.value)
                    : '',
            ilosc: iloscEl ? parseInt(iloscEl.value) || 1 : 1,
            uwagi: uwagiEl ? uwagiEl.value.trim() : '',
            czyPrzejscie: czyEl ? czyEl.value : 'TAK',
            source: source
        };

        if (source === 'custom') {
            _customPrzejscieRows[idx] = data;
        } else if (source === 'offer') {
            _offerPrzejscieRows[idx] = data;
        }
    });
}

function collectPrzejsciaDetailsFromTable() {
    _syncCustomRowsFromDOM();
    const result = [];
    _offerPrzejscieRows.forEach((r) => {
        if (r.rodzaj && r.rodzaj.trim() !== '') {
            result.push({
                rodzaj: r.rodzaj.trim(),
                dnOd:
                    r.dnOd !== ''
                        ? String(r.dnOd).includes('/')
                            ? String(r.dnOd)
                            : parseFloat(r.dnOd)
                        : 0,
                dnDo:
                    r.dnDo !== ''
                        ? String(r.dnDo).includes('/')
                            ? String(r.dnDo)
                            : parseFloat(r.dnDo)
                        : 0,
                ilosc: r.ilosc || 1,
                uwagi: r.uwagi || '',
                czyPrzejscie: r.czyPrzejscie || 'TAK',
                source: 'offer'
            });
        }
    });
    _customPrzejscieRows.forEach((r) => {
        if (r.rodzaj && r.rodzaj.trim() !== '') {
            result.push({
                rodzaj: r.rodzaj.trim(),
                dnOd:
                    r.dnOd !== ''
                        ? String(r.dnOd).includes('/')
                            ? String(r.dnOd)
                            : parseFloat(r.dnOd)
                        : 0,
                dnDo:
                    r.dnDo !== ''
                        ? String(r.dnDo).includes('/')
                            ? String(r.dnDo)
                            : parseFloat(r.dnDo)
                        : 0,
                ilosc: r.ilosc || 1,
                uwagi: r.uwagi || '',
                czyPrzejscie: r.czyPrzejscie || 'TAK',
                source: 'custom'
            });
        }
    });
    return result;
}
