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

    // Scenariusz 1: Edycja istniejącego zamówienia — zapisz kartę i przejdź do kroku 5
    if (typeof orderEditMode !== 'undefined' && orderEditMode && orderEditMode.order) {
        orderEditMode.order.kartaBudowy = kartaData;
        goToWizardStep(5);
        return;
    }

    // Scenariusz 2: Tworzenie nowego zamówienia — finalizuj z zebranymi danymi
    if (typeof pendingOrderCreationData !== 'undefined' && pendingOrderCreationData) {
        const { offer, selectedWells } = pendingOrderCreationData;
        pendingOrderCreationData = null;
        await finalizeOrderFromOffer(offer, selectedWells, kartaData);
        return;
    }

    // Scenariusz 3: Fallback — po prostu przejdź do kroku 5
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

/** Zbiera dane z formularza Kroku 4 */
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
