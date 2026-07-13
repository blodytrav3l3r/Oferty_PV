// @ts-check
/* ===== KARTA BUDOWY — Funkcje rdzenne (init, dane, kopiowanie) ===== */

function initKartaBudowyStep4(primaryOfferNumber) {
    _przejsciaInitialized = false;
    _resetKartaBudowyForm();
    const transport = _calcTransportCosts();
    _displayTransportCost(transport.tCost, transport.costPerTrip);
    const detected = _detectWellParams();
    _applyDetectedParams(detected);
    const existingData = _getExistingKartaBudowyData();
    _applyExistingKartaBudowyData(existingData, primaryOfferNumber);
    if (typeof renderKartaBudowyCopyOptions === 'function') renderKartaBudowyCopyOptions();
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
    if (typeof pendingOrderCreationData !== 'undefined' && pendingOrderCreationData)
        return pendingOrderCreationData.kartaBudowyTemplateOrders || [];
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
    if (!ordersStudnie) ordersStudnie = await loadOrdersStudnie();
    renderKartaBudowyCopyOptions();
    const copySelect = document.getElementById('step4-copy-order-select');
    const orders = getKartaBudowyCopyOrders();
    if (!orders.some((order) => order.kartaBudowy)) {
        if (typeof showToast === 'function')
            showToast(
                'Brak zam\u00f3wie\u0144 z zapisan\u0105 Kart\u0105 Budowy dla tej oferty.',
                'info'
            );
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
        copySelect.innerHTML = '<option>Brak zam\u00f3wie\u0144 do kopiowania</option>';
        copySelect.disabled = true;
        if (copyButton) copyButton.disabled = true;
        if (helpText)
            helpText.textContent =
                'Brak wcze\u015bniejszych zam\u00f3wie\u0144 powi\u0105zanych z t\u0105 ofert\u0105.';
        return;
    }
    const optionsHtml = [
        `<option value="">Wybierz kart\u0119 budowy do skopiowania</option>`
    ].concat(
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
            'Wybierz istniej\u0105ce zam\u00f3wienie, aby skopiowa\u0107 jego dane Karty Budowy.';
}

function copyKartaBudowyFromOrder() {
    const copySelect = document.getElementById('step4-copy-order-select');
    if (!copySelect) return;
    const orderId = copySelect.value;
    if (!orderId) {
        if (typeof showToast === 'function')
            showToast('Wybierz zam\u00f3wienie do skopiowania.', 'error');
        return;
    }
    const orders =
        typeof pendingOrderCreationData !== 'undefined' && pendingOrderCreationData
            ? pendingOrderCreationData.kartaBudowyTemplateOrders || []
            : getKartaBudowyCopyOrders();
    const sourceOrder = orders.find((order) => String(order.id) === String(orderId));
    if (!sourceOrder) {
        if (typeof showToast === 'function')
            showToast('Nie znaleziono wybranego zam\u00f3wienia.', 'error');
        return;
    }
    if (!sourceOrder.kartaBudowy) {
        if (typeof showToast === 'function')
            showToast('Wybrane zam\u00f3wienie nie ma zapisanych danych Karty Budowy.', 'error');
        return;
    }
    applyCopiedKartaBudowyData(sourceOrder.kartaBudowy);
    if (typeof pendingOrderCreationData !== 'undefined' && pendingOrderCreationData)
        pendingOrderCreationData.kartaBudowyTemplate = collectKartaBudowyDataStep4();
    if (typeof showToast === 'function')
        showToast(
            `Skopiowano dane Karty Budowy z zam\u00f3wienia ${sourceOrder.orderNumber || sourceOrder.id.substring(0, 8)}.`,
            'success'
        );
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
    if (Array.isArray(sourceData.offerNumbers) && sourceData.offerNumbers.length > 0)
        setValue('step4-offer-nr-input', sourceData.offerNumbers.join(', '));
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
    const g = (id) => (document.getElementById(id)?.value || '').trim();
    const s = (id, def) => (document.getElementById(id)?.value || def).trim();
    const emailFaktura = g('step4-email-faktura');
    const emailEfaktura = g('step4-email-efaktura');
    const offerInput = g('step4-offer-nr-input');
    const uwagiOgolne = g('step4-uwagi-ogolne');
    const adresWysylki = g('step4-adres-wysylki');
    const warunkiPlatnosci = s('step4-warunki-platnosci', 'przelew');
    const iloscDni = g('step4-ilosc-dni');
    const ubezpieczenie = g('step4-ubezpieczenie');
    const osobaKontakt = g('step4-osoba-kontakt');
    const zabezpieczenieTransportu = s('step4-zabezpieczenie-transportu', 'Nie dotyczy');
    const rodzajTransportu = s('step4-rodzaj-transportu', 'Transport P.V.');
    const rodzajStopni = s('step4-rodzaj-stopni', 'Nie dotyczy');
    const rodzajStopniInne = g('step4-rodzaj-stopni-inne');
    const rodzajStudni = s('step4-rodzaj-studni', 'Nie dotyczy');
    const uszczelkaStudni = s('step4-uszczelka-studni', 'Brak');
    const uszczelkaStudniInne = g('step4-uszczelka-studni-inne');
    const kineta = s('step4-kineta', 'Brak');
    const kinetaInne = g('step4-kineta-inne');
    const wysokoscSpocznika = s('step4-wysokosc-spocznika', 'Nie dotyczy');
    const usytuowanie = s('step4-usytuowanie', 'Linia dolna');
    const kaskada = s('step4-kaskada', 'Nie dotyczy');
    const kaskadaUwagi = g('step4-kaskada-uwagi');
    const slepaKineta = s('step4-slepa-kineta', 'Nie dotyczy');
    const slepaKinetaUwagi = g('step4-slepa-kineta-uwagi');
    const redukcjaKinety = s('step4-redukcja-kinety', 'Nie dotyczy');
    const przejsciaTulejowe = s('step4-przejscia-tulejowe', 'Nie dotyczy');
    const przejsciaSzczelne = s('step4-przejscia-szczelne', 'Nie dotyczy');
    const wlasciwosciBetonu = s('step4-wlasciwosci-betonu', 'C40/50');
    const pozostaleWlasciwosci = g('step4-pozostale-wlasciwosci');
    const wyliczonyTransport = g('step4-wyliczony-transport');
    const przejsciaZamowione = s('step4-przejscia-zamowione', 'Nie dotyczy');
    const dataZamowienia = g('step4-data-zamowienia');
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
