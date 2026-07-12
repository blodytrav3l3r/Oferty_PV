// @ts-check
/* ===== ZAMÓWIENIA STUDNI ===== */
async function loadOrdersStudnie() {
    try {
        const res = await fetchWithTimeout('/api/orders-studnie', { headers: authHeaders() });
        const json = await res.json();
        return json.data || [];
    } catch (err) {
        logger.error('orderManager', 'Błąd ładowania zamówień studni:', err);
        return [];
    }
}

async function saveOrdersDataStudnie(data) {
    try {
        const res = await fetch('/api/orders-studnie', {
            method: 'PUT',
            headers: authHeaders(),
            body: JSON.stringify({ data })
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
    } catch (err) {
        logger.error('orderManager', 'Błąd zapisu zamówień studni:', err);
        showToast('Błąd zapisu zamówień', 'error');
    }
}

/* ===== POMOCNIKI ZAMÓWIEŃ CZĘŚCIOWYCH ===== */

/** Zwraca wszystkie zamówienia powiązane z daną ofertą */
function getOrdersForOffer(offerId) {
    if (!ordersStudnie || !offerId) return [];
    const nId = normalizeId(offerId);
    return ordersStudnie.filter((o) => normalizeId(o.offerId || o.offerStudnieId) === nId);
}

/** Zwraca Set<string> z ID studni, które są już zamówione dla danej oferty */
function getOrderedWellIds(offerId) {
    const orders = getOrdersForOffer(offerId);
    const ids = new Set();
    orders.forEach((order) => {
        (order.wells || []).forEach((w) => {
            if (w.id) ids.add(w.id);
        });
    });
    return ids;
}

/** Sprawdza, czy dana studnia jest zamówiona w ramach bieżącej oferty */
function isWellOrdered(well) {
    if (!well || !well.id || !editingOfferIdStudnie) return false;
    return getOrderedWellIds(editingOfferIdStudnie).has(well.id);
}

/** Oblicza progres zamówień dla danej oferty: { ordered, total, percent } */
function getOfferOrderProgress(offerId, offerWells) {
    const orderedIds = getOrderedWellIds(offerId);
    const total = (offerWells || []).length;
    const ordered = (offerWells || []).filter((w) => w.id && orderedIds.has(w.id)).length;
    const percent = total > 0 ? Math.round((ordered / total) * 100) : 0;
    return { ordered, total, percent };
}

/** Zwraca zamówienie, do którego należy dana studnia (jeśli istnieje) */
function getOrderForWellId(wellId, offerId) {
    if (!wellId || !ordersStudnie) return null;
    const nId = offerId ? normalizeId(offerId) : null;
    return (
        ordersStudnie.find((order) => {
            if (nId && normalizeId(order.offerId) !== nId) return false;
            return (order.wells || []).some((w) => w.id === wellId);
        }) || null
    );
}

window.getOrdersForOffer = getOrdersForOffer;
window.getOrderedWellIds = getOrderedWellIds;
window.isWellOrdered = isWellOrdered;
window.getOfferOrderProgress = getOfferOrderProgress;
window.getOrderForWellId = getOrderForWellId;

async function createOrderFromOffer() {
    try {
        if (typeof orderEditMode !== 'undefined' && orderEditMode) {
            if (typeof showToast === 'function') {
                showToast(
                    'Tworzenie nowego zamówienia jest niedostępne w trybie edycji zamówienia.',
                    'error'
                );
            }
            return;
        }

        // Zbierz zaznaczone studnie PRZED zapisem (zapis odświeża DOM i kasuje stan checkboxów)
        let selectedWells;
        const existingCheckboxes = document.querySelectorAll('.well-order-checkbox');
        if (existingCheckboxes.length > 0) {
            selectedWells = collectSelectedWellsForOrder();
        } else {
            // Nowa (niezapisana) oferta — checkboxów nie ma, domyślnie wszystkie studnie
            selectedWells = [...wells];
        }
        if (selectedWells.length === 0) {
            showToast('Zaznacz co najmniej jedną studnię do zamówienia', 'error');
            return;
        }

        // Zapobiegaj wyścigom w UI, jeśli użytkownik kliknął dwukrotnie lub kliknął Zamówienie podczas trwania zapisu
        if (isSavingOffer) {
            showToast('Trwa zapisywanie...', 'info');
            while (isSavingOffer) {
                await new Promise((r) => setTimeout(r, 200));
            }
        } else {
            // Automatycznie zapisz ofertę, aby upewnić się, że najnowszy stan został przesłany do SQLite i odświeżony
            const saveResult = await saveOfferStudnie();
            isSavingOffer = false;
            if (saveResult === false) return; // false = blad zapisu, undefined = telemetry popup (kontynuuj)
        }

        const number = document.getElementById('offer-number')?.value?.trim();
        if (!number) {
            showToast('Błąd: Brak numeru oferty', 'error');
            return;
        }
        if (!editingOfferIdStudnie) {
            showToast('Błąd krytyczny: Brak ID oferty po zapisie', 'error');
            return;
        }

        logger.info(
            'orderManager',
            '[createOrderFromOffer] editingOfferIdStudnie =',
            editingOfferIdStudnie
        );
        logger.info(
            'orderManager',
            '[createOrderFromOffer] offersStudnie count =',
            offersStudnie.length
        );
        const offer = offersStudnie.find((o) => o.id === editingOfferIdStudnie);
        logger.info('orderManager', '[createOrderFromOffer] offer found =', !!offer);

        if (!offer) {
            showToast(
                'Nie znaleziono oferty (ID: ' +
                    editingOfferIdStudnie +
                    ', total: ' +
                    offersStudnie.length +
                    ')',
                'error'
            );
            return;
        }

        // Weryfikacja — wybrane studnie nie mogą być już zamówione
        const alreadyOrderedIds = getOrderedWellIds(offer.id);
        const conflicting = selectedWells.filter((w) => alreadyOrderedIds.has(w.id));
        if (conflicting.length > 0) {
            showToast('Wybrane studnie są już częścią innego zamówienia', 'error');
            return;
        }

        // Ostrzeżenie: wybrane studnie zostaną zablokowane do edycji w ofercie
        const confirmMsg =
            selectedWells.length === wells.length
                ? `Utworzysz zamówienie na WSZYSTKIE ${selectedWells.length} studni z oferty.\nWybrane studnie zostaną zablokowane do edycji w ofercie.\n\nKontynuować?`
                : `Utworzysz zamówienie na ${selectedWells.length} z ${wells.length} studni.\nWybrane studnie zostaną zablokowane do edycji w ofercie.\nPozostałe studnie będziesz mógł domówić później.\n\nKontynuować?`;

        if (
            !(await appConfirm(confirmMsg, {
                title: 'Tworzenie zamówienia częściowego',
                type: 'warning'
            }))
        )
            return;

        // Krok 4.1 — Karta budowy zamiast popupu
        if (!ordersStudnie) {
            ordersStudnie = await loadOrdersStudnie();
        }
        const existingOrdersForOffer = getOrdersForOffer(offer.id);
        pendingOrderCreationData = {
            offer,
            selectedWells,
            kartaBudowyTemplateOrders: existingOrdersForOffer
        };
        initKartaBudowyStep4(offer.number);

        // Przejdź do kroku 4
        if (typeof goToWizardStep === 'function') {
            goToWizardStep(4);
        } else {
            currentWizardStep = 4;
            if (typeof updateWizardIndicator === 'function') updateWizardIndicator();
        }
    } catch (err) {
        logger.error('orderManager', '[createOrderFromOffer] Error:', err);
        if (typeof showToast === 'function') {
            showToast(
                'Wystąpił błąd podczas tworzenia zamówienia: ' + (err.message || 'nieznany błąd'),
                'error'
            );
        }
    }
}

/**
 * Zmienna przechowująca dane do utworzenia zamówienia w trakcie kroku Karta Budowy
 */
var pendingOrderCreationData = null;

/**
 * Inicjalizuje formularz Karty Budowy w Kroku 4.
 * Może załadować dane nowej oferty lub istniejącego zamówienia.
 */
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

/** Tymczasowa tablica ręcznie dodanych wierszy niestandardowych przejść */
var _customPrzejscieRows = [];
var _offerPrzejscieRows = [];
var _przejsciaInitialized = false;

/**
 * Buduje listę typów przejść z cennika (studnieProducts).
 * Zwraca tablicę: [{ rodzaj, dnOd, dnDo, source: 'offer' }]
 */
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
    // Dwa oddzielne mapy: numeryczne DN (okrągłe) i stringowe DN (jajowe)
    const typeMap = new Map(); // cat → { dnMin, dnMax }
    const stringDnMap = new Map(); // cat → { dnStrings: ["600/900", "1200/1800"] }

    przejsciaProducts.forEach((p) => {
        const cat = p.category;
        if (!cat) return;

        if (typeof p.dn === 'string' && p.dn.includes('/')) {
            // String DN (jajowe) — zbieraj pełne wymiary
            if (!stringDnMap.has(cat)) {
                stringDnMap.set(cat, { dnStrings: [] });
            }
            stringDnMap.get(cat).dnStrings.push(p.dn);
        } else {
            // Numeryczny DN — śledź min/max
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
    // Wiersze z numerycznym DN (okrągłe)
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
    // Wiersze z stringowym DN (jajowe) — osobny wiersz dla każdego unikalnego DN
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

/**
 * Renderuje tabelę szczegółów przejść szczelnych w Karcie budowy (Step 4).
 * @param {Array|null} existingData — zapisane dane z kartaBudowy.przejsciaDetails
 */
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

    // Przywróć dane jeśli istnieją
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

    // Wiersze z oferty
    _offerPrzejscieRows.forEach((row, idx) => {
        html += buildPrzejscieRowHTML(row, idx, 'offer');
    });

    // Wiersze niestandardowe
    _customPrzejscieRows.forEach((row, idx) => {
        html += buildPrzejscieRowHTML(row, idx, 'custom');
    });

    html += '</tbody></table></div>';
    container.innerHTML = html;

    if (window.lucide && window.lucide.createIcons) {
        window.lucide.createIcons();
    }
}

/**
 * Buduje HTML wiersza tabeli przejścia szczelnego.
 * @param {Object} row — dane wiersza
 * @param {number} idx — indeks w swojej grupie
 * @param {'offer'|'custom'} source — źródło wiersza
 */

/** Aktualizuje opcje DN w zależności od wybranego rodzaju przejścia */
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

    // Kategorie ze stringowym DN (jajowe) — pokaż pełne wymiary w read-only input
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
    const dns = new Set(); // numeryczne DN
    const dnsStr = new Set(); // pełne stringowe DN (jajowe: "600/900")
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

/** Aktualizuje styl selecta TAK/NIE po zmianie wartości */
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

/** Dodaje nowy wiersz niestandardowego przejścia */
function addCustomPrzejscieRow() {
    // Zbierz aktualny stan z DOM przed dodaniem nowego
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
    // Ustaw fokus na nowym wierszu
    setTimeout(() => {
        const newIdx = _customPrzejscieRows.length - 1;
        const rodzajInput = document.getElementById(`step4-psz-custom-${newIdx}-rodzaj`);
        if (rodzajInput) rodzajInput.focus();
    }, 50);
}

/** Usuwa wiersz niestandardowego przejścia */

/** Usuwa wiersz przejścia szczelnego */
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

/**
 * Synchronizuje dane wierszy niestandardowych z DOM do pamięci,
 * aby nie stracić wpisanych wartości przy dodawaniu/usuwaniu wiersza.
 */
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

/** Zbiera informacje o przejściach szczelnych z tabeli */
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

/** Druga część tworzenia zamówienia wywoływana z kroku 4 */
async function finalizeOrderFromOffer(offer, selectedWells, kartaBudowyData) {
    // Określ przypisanego użytkownika dla numeracji zamówienia — domyślnie opiekun oferty
    let assignedUserId = offer.userId || (currentUser ? currentUser.id : null);
    let assignedUserName =
        offer.userName ||
        (currentUser
            ? currentUser.firstName && currentUser.lastName
                ? `${currentUser.firstName} ${currentUser.lastName}`
                : currentUser.username
            : '');

    // Jeśli pro lub admin — zapytaj, któremu użytkownikowi przypisać zamówienie
    if (currentUser && (currentUser.role === 'admin' || currentUser.role === 'pro')) {
        try {
            const usersResp = await fetch('/api/users-for-assignment', { headers: authHeaders() });
            if (!usersResp.ok) throw new Error(`HTTP ${usersResp.status}`);
            const usersData = await usersResp.json();
            const allUsers = usersData.data || [];

            if (allUsers.length > 0) {
                const selectedUser = await showUserSelectionPopup(allUsers, assignedUserId);
                if (selectedUser === null) {
                    showToast('Anulowano tworzenie zamówienia', 'info');
                    return;
                }
                assignedUserId = selectedUser.id;
                assignedUserName =
                    selectedUser.firstName && selectedUser.lastName
                        ? `${selectedUser.firstName} ${selectedUser.lastName}`
                        : selectedUser.displayName || selectedUser.username;
            }
        } catch (e) {
            logger.error('orderManager', 'Błąd pobierania użytkowników:', e);
        }
    }

    // Pobierz numer zamówienia z serwera
    let orderNumber = '';
    try {
        const claimResp = await fetch('/api/orders-studnie/claim-number/' + assignedUserId, {
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

    // Przelicz sumy tylko dla wybranych studni korzystając z rabatów oferty
    const effectiveDiscounts =
        offer && offer.wellDiscounts ? structuredClone(offer.wellDiscounts) : {};

    // Utwórz zamówienie z WYBRANYCH studni — wykonaj głęboką kopię, zapisz oryginalną migawkę
    const selectedWellsCopy = structuredClone(selectedWells);
    // Upewnij się, że kineta jest zsynchronizowana w każdej studni przed zamrożeniem cen
    if (typeof syncKineta === 'function') {
        selectedWellsCopy.forEach((w) => syncKineta(w));
    }
    const order = {
        id: 'order_studnie_' + Date.now(),
        offerId: offer.id,
        offerNumber: offer.number,
        userId: assignedUserId,
        userName: assignedUserName,
        number: offer.number,
        orderNumber: orderNumber,
        date: offer.date,
        clientName: offer.clientName,
        clientNip: offer.clientNip,
        clientAddress: offer.clientAddress,
        clientContact: offer.clientContact,
        investName: offer.investName,
        investAddress: offer.investAddress,
        investContractor: offer.investContractor,
        notes: offer.notes,
        wells: selectedWellsCopy,
        visiblePrzejsciaTypes: Array.from(visiblePrzejsciaTypes),
        originalSnapshot: {
            wells: structuredClone(selectedWellsCopy),
            wellDiscounts: structuredClone(effectiveDiscounts),
            transportKm: offer.transportKm,
            transportRate: offer.transportRate,
            transportMode: offer.transportMode || 'full'
        },
        transportKm: offer.transportKm,
        transportRate: offer.transportRate,
        transportMode: offer.transportMode || 'fractional',
        kartaBudowy: kartaBudowyData,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        createdBy: currentUser ? currentUser.username : ''
    };

    // Tymczasowo nadpisz globalne rabaty, aby calcWellStats i freezeWellPrices ich użyły
    const originalGlobalDiscounts =
        typeof wellDiscounts !== 'undefined' ? structuredClone(wellDiscounts) : {};
    if (typeof wellDiscounts !== 'undefined') {
        window.wellDiscounts = effectiveDiscounts;
    }

    let totalNetto = 0;
    let totalWeight = 0;
    selectedWells.forEach((well) => {
        const stats = calcWellStats(well);
        totalNetto += stats.price;
        totalWeight += stats.weight;
    });

    // Oblicz transport dla zamówienia (proporcjonalnie do wagi wybranych studni)
    let orderTransportCost = 0;
    const globalOfferWeight = offer.totalWeight || 0;
    const gKm = parseFloat(offer.transportKm) || 0;
    const gRate = parseFloat(offer.transportRate) || 0;
    const offerMode = offer.transportMode || 'full';
    const globalOfferTransport =
        gKm > 0 && gRate > 0
            ? (typeof calcTransportCount === 'function'
                  ? calcTransportCount(globalOfferWeight, offerMode)
                  : Math.ceil(globalOfferWeight / MAX_TRANSPORT_WEIGHT)) *
              gKm *
              gRate
            : 0;
    if (globalOfferWeight > 0 && totalWeight > 0) {
        orderTransportCost = globalOfferTransport * (totalWeight / globalOfferWeight);
    }

    order.wellsExport = selectedWellsCopy.map((well) => {
        const stats = calcWellStats(well);
        const wellTransportCost =
            totalWeight > 0 ? orderTransportCost * (stats.weight / totalWeight) : 0;
        const zwienczenie =
            typeof getWellZwienczenieName === 'function' ? getWellZwienczenieName(well) : '—';
        return {
            name: well.name,
            dn: well.dn,
            height: stats.height,
            weight: stats.weight,
            zwienczenie: zwienczenie,
            price: stats.price,
            transportCost: wellTransportCost,
            totalPrice: stats.price + wellTransportCost,
            config: well.config,
            przejscia: well.przejscia
        };
    });

    const finalOrderNetto = totalNetto + orderTransportCost;

    order.totalWeight = totalWeight;
    order.totalNetto = finalOrderNetto;
    order.originalTotalNetto = finalOrderNetto;
    order.totalBrutto = finalOrderNetto * 1.23;
    order.wellDiscounts = effectiveDiscounts;

    // Zamroź ceny studni w zamówieniu w momencie tworzenia (używając aktualnie ustawionych rabatów oferty)
    freezeWellPrices(order.wells);

    // Przywróć oryginalne rabaty globalne
    if (typeof wellDiscounts !== 'undefined') {
        window.wellDiscounts = originalGlobalDiscounts;
    }

    if (!ordersStudnie) ordersStudnie = [];
    ordersStudnie.push(order);
    await saveOrdersDataStudnie(ordersStudnie);

    // Zapisz ofertę (aby zachować powiązania)
    await saveOfferStudnie();
    renderSavedOffersStudnie();

    showToast(
        `<i data-lucide="package"></i> Zamówienie ${orderNumber} utworzone (${selectedWells.length} studni z oferty ${offer.number})`,
        'success'
    );

    // Pasywne uczenie — ORDER_CONFIRM = najsilniejszy sygnał (3× waga)
    if (typeof _sendAcceptanceTelemetry === 'function') {
        _sendAcceptanceTelemetry(selectedWellsCopy, 'ORDER_CONFIRM');
    }

    // Reward hook — potwierdzenie zamówienia = najsilniejszy sygnał akceptacji
    if (typeof window.mlRewardHooks !== 'undefined' && window.mlRewardHooks.onWellAccepted) {
        selectedWellsCopy.forEach(function (w) {
            if (w.config && w.config.length > 0) {
                window.mlRewardHooks.onWellAccepted({ eventType: 'ORDER_CONFIRMED' });
            }
        });
    }

    // Ustaw krok na 4.2 (Zamówienie) przed przekierowaniem
    currentWizardStep = 5;
    if (typeof updateWizardIndicator === 'function') updateWizardIndicator();

    // Otwórz zamówienie w tym samym oknie (używa głównego edytora studni w trybie zamówienia)
    window.location.href = 'studnie.html?order=' + order.id;
}

/** Zbiera indeksy zaznaczonych studni z checkboxów w podsumowaniu oferty */
function collectSelectedWellsForOrder() {
    const checkboxes = document.querySelectorAll('.well-order-checkbox:checked');
    const selectedWells = [];
    checkboxes.forEach((cb) => {
        const idx = parseInt(cb.dataset.wellIndex, 10);
        if (!isNaN(idx) && wells[idx]) {
            selectedWells.push(wells[idx]);
        }
    });
    return selectedWells;
}

async function saveOrderStudnie() {
    if (!editingOfferIdStudnie) return;
    const offer = offersStudnie.find((o) => o.id === editingOfferIdStudnie);
    if (!offer) return;
    const oId = normalizeId(offer.id);
    const order = ordersStudnie ? ordersStudnie.find((o) => normalizeId(o.offerId) === oId) : null;
    if (!order) return;

    // Zamroź ceny wszystkich elementów przed zapisem
    freezeWellPrices(wells);

    // Zaktualizuj studnie zamówienia bieżącym stanem studni (ceny są już zamrożone)
    order.wells = structuredClone(wells);
    if (typeof window.wellDiscounts !== 'undefined') {
        order.wellDiscounts = structuredClone(window.wellDiscounts);
    }
    order.visiblePrzejsciaTypes = Array.from(visiblePrzejsciaTypes);
    order.updatedAt = new Date().toISOString();

    // Przelicz sumy
    let totalNetto = 0,
        totalWeight = 0;
    wells.forEach((well) => {
        const stats = calcWellStats(well);
        totalNetto += stats.price;
        totalWeight += stats.weight;
    });
    order.totalWeight = totalWeight;

    const transportKmVal = parseFloat(offer.transportKm) || 0;
    const transportRateVal = parseFloat(offer.transportRate) || 0;
    const orderMode = order.transportMode || offer.transportMode || 'full';
    let totalTransportCostForOffer = 0;
    if (transportKmVal > 0 && transportRateVal > 0 && totalWeight > 0) {
        totalTransportCostForOffer =
            (typeof calcTransportCount === 'function'
                ? calcTransportCount(totalWeight, orderMode)
                : Math.ceil(totalWeight / MAX_TRANSPORT_WEIGHT)) *
            transportKmVal *
            transportRateVal;
    }
    const orderTotal = totalNetto + totalTransportCostForOffer;
    order.totalNetto = orderTotal;
    order.totalBrutto = orderTotal * 1.23;

    order.wellsExport = wells.map((well) => {
        const stats = calcWellStats(well);
        const wellTransportCost =
            totalWeight > 0 ? totalTransportCostForOffer * (stats.weight / totalWeight) : 0;
        const zwienczenie =
            typeof getWellZwienczenieName === 'function' ? getWellZwienczenieName(well) : '—';
        return {
            name: well.name,
            dn: well.dn,
            height: stats.height,
            weight: stats.weight,
            zwienczenie: zwienczenie,
            price: stats.price,
            transportCost: wellTransportCost,
            totalPrice: stats.price + wellTransportCost,
            config: well.config,
            przejscia: well.przejscia
        };
    });

    await saveOrdersDataStudnie(ordersStudnie);
    showToast('<i data-lucide="package"></i> Zamówienie zaktualizowane', 'success');
}

/** Zamraża bieżące ceny wszystkich elementów konfiguracji i przejść w każdej studni */
function freezeWellPrices(wellsArr) {
    (wellsArr || []).forEach((well) => {
        // Zamroź elementy konfiguracji (kręgi, dennice, konusy itp.)
        (well.config || []).forEach((item) => {
            const p = studnieProducts.find((pr) => pr.id === item.productId);
            if (!p) return;
            item.frozenPrice = getItemAssessedPrice(well, p, true, item);
            item.frozenPriceBase = getItemAssessedPrice(well, p, false, item);
            item.frozenName = p.name;
        });

        // Zamroź ceny przejść
        let discNadbudowa = 0;
        // Mapowanie dn na klucz rabatów (styczna -> styczne)
        const discountKey = well.dn === 'styczna' ? 'styczne' : well.dn;
        if (discountKey && wellDiscounts[discountKey]) {
            discNadbudowa = wellDiscounts[discountKey].nadbudowa || 0;
        }
        const mult = 1 - discNadbudowa / 100;

        const configMap =
            typeof buildConfigMap !== 'undefined'
                ? buildConfigMap(well, (id) => studnieProducts.find((pr) => pr.id === id), true)
                : [];

        (well.przejscia || []).forEach((item) => {
            const p = studnieProducts.find((pr) => pr.id === item.productId);
            if (!p) return;

            let drillingBasePrice = 0;
            let drillProdName = '';
            let drillProdDn = '';
            const isInsitu = p.name && p.name.toUpperCase().includes('INSITU');

            if (!isInsitu && configMap.length > 0) {
                let rzDna = parseFloat(well.rzednaDna) || 0;
                let pel = parseFloat(item.rzednaWlaczenia);
                if (isNaN(pel)) pel = rzDna;
                let mmFromBottom = (pel - rzDna) * 1000;

                if (typeof findAssignedElement === 'function') {
                    const assigned = findAssignedElement(mmFromBottom, configMap);
                    if (
                        assigned &&
                        assigned.entry &&
                        (assigned.entry.componentType === 'krag' ||
                            assigned.entry.componentType === 'krag_ot')
                    ) {
                        const trDn = parseInt(item.dn) || parseInt(p.dn) || 0;
                        if (trDn > 0) {
                            const drillingProducts = studnieProducts.filter(
                                (x) => x.category === 'Wiercenie'
                            );
                            let bestDrill = null;
                            let bestDnDiff = Infinity;
                            drillingProducts.forEach((drill) => {
                                let drillDn = parseInt(drill.dn);
                                if (isNaN(drillDn)) {
                                    const match = drill.id.match(/Wiercenie-(\d+)/i);
                                    if (match) drillDn = parseInt(match[1]);
                                }
                                if (!isNaN(drillDn) && drillDn >= trDn) {
                                    if (drillDn - trDn < bestDnDiff) {
                                        bestDnDiff = drillDn - trDn;
                                        bestDrill = drill;
                                    }
                                }
                            });
                            if (bestDrill) {
                                drillingBasePrice = /** @type {any} */ (bestDrill).price || 0;
                                drillProdName = /** @type {any} */ (bestDrill).name;
                                drillProdDn = /** @type {any} */ (bestDrill).dn || '';
                            }
                        }
                    }
                }
            }

            const transPriceBase = p.price || 0;
            const bP = transPriceBase + drillingBasePrice;
            item.frozenPrice = bP * mult;
            item.frozenPriceBase = bP;
            item.frozenName = p.name || p.category;
            item.frozenTransitionPrice = transPriceBase * mult;
            item.frozenDrillingPrice = drillingBasePrice * mult;
            item.frozenDrillingName = drillProdName;
            item.frozenDrillingDn = drillProdDn;
        });
    });
}

async function deleteOrderStudnie(orderId) {
    // Sprawdź, czy zamówienie ma zaakceptowane zlecenia produkcyjne
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

    // Wywołanie API w celu fizycznego usunięcia zamówienia
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

    // Odśwież główną konfigurację, jeśli jest otwarta
    if (typeof renderWellConfig === 'function') renderWellConfig();

    // Jeśli usunięte zamówienie dotyczy aktualnie otwartej oferty w edytorze, odśwież widok
    if (affectedOfferId && editingOfferIdStudnie === affectedOfferId) {
        refreshAll();
    }

    // Odśwież listę UI globalnie
    if (window.pvSalesUI) {
        window.pvSalesUI
            .loadOrdersMap()
            .then(() => window.pvSalesUI.filterLocalOffers())
            .catch((e) => logger.error('orderManager', e));
    }
}

/** Porównaj bieżące studnie zamówienia z originalSnapshot — zmiana = zmiana ceny studni
 *  Porównuje ceny (zamrożone) zamiast struktury pól, aby dodanie zlecenia produkcyjnego
 *  (które zmienia parametry studni jak kineta, klasa betonu itp.) nie było traktowane jako
 *  zmiana zamówienia, o ile cena nie uległa zmianie. */
function getOrderChanges(order) {
    if (!order || !order.originalSnapshot) return {};
    const changes = {};

    const originalSnapshotData = order.originalSnapshot;
    const originalWells = Array.isArray(originalSnapshotData)
        ? originalSnapshotData
        : originalSnapshotData.wells || [];
    const originalDiscounts = !Array.isArray(originalSnapshotData)
        ? originalSnapshotData.wellDiscounts || null
        : null;

    const orig = structuredClone(originalWells);
    if (typeof migrateWellData === 'function') migrateWellData(orig);
    const curr = order.wells;

    // Tymczasowo zamroź ceny studni z migawki z oryginalnymi rabatami, aby uzyskać uczciwe porównanie
    const savedDiscounts =
        typeof wellDiscounts !== 'undefined' ? structuredClone(wellDiscounts) : null;
    if (originalDiscounts && typeof wellDiscounts !== 'undefined') {
        window.wellDiscounts = originalDiscounts;
    }
    freezeWellPrices(orig);
    if (savedDiscounts && typeof wellDiscounts !== 'undefined') {
        window.wellDiscounts = savedDiscounts;
    }

    // Ustaw tryb podglądu, aby calcWellStats używał zamrożonych cen na obu stronach
    const savedPreviewMode = window.isPreviewMode;
    window.isPreviewMode = true;

    const maxLen = Math.max(orig.length, curr.length);
    for (let i = 0; i < maxLen; i++) {
        if (i >= orig.length) {
            changes[i] = { type: 'added' };
            continue;
        }
        if (i >= curr.length) {
            changes[i] = { type: 'removed', name: orig[i].name };
            continue;
        }

        const origStats = calcWellStats(orig[i]);
        const currStats = calcWellStats(curr[i]);

        if (Math.abs(currStats.price - origStats.price) > 0.01) {
            changes[i] = {
                type: 'modified',
                fields: ['price'],
                priceDiff: currStats.price - origStats.price
            };
        }
    }

    // Wykryj zmianę transportu — jeśli się zmienił, oznacz wszystkie studnie jako zmienione
    const origTransportKm = originalSnapshotData.transportKm;
    const origTransportRate = originalSnapshotData.transportRate;
    const origTransportMode = originalSnapshotData.transportMode;
    const transportChanged =
        (origTransportKm != null || origTransportRate != null) &&
        (Math.abs((order.transportKm || 0) - (origTransportKm || 0)) > 0.01 ||
            Math.abs((order.transportRate || 0) - (origTransportRate || 0)) > 0.01 ||
            (order.transportMode || 'full') !== (origTransportMode || 'full'));
    if (transportChanged) {
        for (let i = 0; i < curr.length; i++) {
            if (!changes[i] || changes[i].type !== 'added') {
                if (changes[i] && changes[i].type === 'modified') {
                    changes[i].fields.push('transport');
                } else {
                    changes[i] = { type: 'modified', fields: ['transport'], priceDiff: 0 };
                }
            }
        }
    }

    // Przywróć oryginalny tryb podglądu
    window.isPreviewMode = savedPreviewMode;

    return changes;
}

/** Sprawdź, czy bieżąca oferta ma aktywne zamówienie */
function getCurrentOfferOrder() {
    if (orderEditMode) return orderEditMode.order;
    if (!editingOfferIdStudnie) return null;
    return ordersStudnie
        ? ordersStudnie.find((o) => o.offerId === editingOfferIdStudnie) || null
        : null;
}

/** Wejdź w tryb edycji zamówienia — ładuje zamówienie do głównego edytora */
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

        visiblePrzejsciaTypes = new Set(order.visiblePrzejsciaTypes || []);

        // Wczytaj studnie z zamówienia — upewnij się, że wells jest zawsze tablicą
        wells = Array.isArray(order.wells) ? structuredClone(order.wells) : [];
        migrateWellData(wells);

        // Załaduj zapisane rabaty z zamówienia (zabezpieczenie, jeśli zamówienie ma własne rabaty)
        if (order.wellDiscounts) {
            window.wellDiscounts = structuredClone(order.wellDiscounts);
        } else {
            // Jeśli stare zamówienie nie ma wellDiscounts, można zostawić obecne lub zresetować:
            // window.wellDiscounts = {};
        }

        // Recalculuj totalNetto z transportem — stare zamówienia mogły mieć zapisane
        // totalNetto bez kosztu transportu (bug w saveCurrentOrder / saveOrderStudnie).
        // Po tej korekcie najbliższy zapis przez saveCurrentOrder utrwali poprawną wartość.
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

        // Dodatkowo upewnij się, że każda studnia ma tablice config i przejscia
        wells.forEach((w) => {
            if (!Array.isArray(w.config)) w.config = [];
            if (!Array.isArray(w.przejscia)) w.przejscia = [];
            if (typeof syncKineta === 'function') syncKineta(w);
        });

        logger.info('orderManager', '[enterOrderEditMode] wells migrated, count:', wells.length);

        // Automatyczne odblokowanie widoku kategorii dla użytych przejść
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

        // Wypełnij pola klienta/oferty
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

        // Wczytaj transport zamówienia (nie oferty)
        setVal('transport-km', order.transportKm ?? 100);
        setVal('transport-rate', order.transportRate ?? 10);
        currentTransportMode = order.transportMode || 'full';

        logger.info(
            'orderManager',
            '[enterOrderEditMode] fields filled, calling skipWizardToStep3...'
        );

        // Pomiń kreatora → przejdź bezpośrednio do kroku 5 (Zamówienie = 4.2)
        wizardConfirmedParams = new Set(WIZARD_REQUIRED_PARAMS);
        currentWizardStep = 5;
        document.querySelectorAll('.wizard-step').forEach((s) => s.classList.remove('active'));
        const target = document.getElementById('wizard-step-3'); // Step 4.2 reuses step 3's UI panel
        if (target) target.classList.add('active');
        if (typeof updateWizardIndicator === 'function') updateWizardIndicator();
        if (typeof updateWizardSummaryBar === 'function') updateWizardSummaryBar();

        const layout = document.querySelector('.well-app-layout');
        if (layout) layout.classList.remove('intro-mode');

        showSection('builder');

        logger.info('orderManager', '[enterOrderEditMode] calling refreshAll...');
        // Aktualizuj UI
        refreshAll();

        logger.info('orderManager', '[enterOrderEditMode] calling renderOrderModeBanner...');
        renderOrderModeBanner();
        if (typeof renderOfferLockBanner === 'function') renderOfferLockBanner();

        // Aktualizuj tytuł strony
        document.title = `📦 Zamówienie: ${order.number || orderId}`;

        logger.info('orderManager', '[enterOrderEditMode] DONE');
        showToast('<i data-lucide="package"></i> Zamówienie wczytane do edycji', 'success');
    } catch (err) {
        logger.error('orderManager', 'Błąd ładowania zamówienia:', err);
        logger.error('orderManager', 'Stack:', err.stack);
        showToast('Błąd ładowania zamówienia: ' + err.message, 'error');
    }
}

window.isPreviewMode = false;

window.applyPreviewLockUI = function () {
    let banner = document.getElementById('preview-lock-banner');
    if (!banner) {
        banner = document.createElement('div');
        banner.id = 'preview-lock-banner';
        banner.innerHTML = `
            <div style="position:fixed; top:2rem; left:50%; transform:translateX(-50%); background:rgba(15, 23, 42, 0.95); border:2px solid var(--warn-hover); color:var(--warn-hover); padding:0.8rem 2.5rem; border-radius:40px; z-index:99999; box-shadow:0 20px 40px rgba(0,0,0,0.6); font-weight:800; display:flex; align-items:center; gap:1.5rem; backdrop-filter:blur(10px);">
                <span style="font-size:1.2rem;"><i data-lucide="eye"></i>️ HISTORIA — TYLKO DO ODCZYTU</span>
                <button data-action="exitPreviewMode" class="btn btn-sm" style="background:var(--warn-hover); color:#000; border:none; padding:0.4rem 1rem; border-radius:20px; font-weight:700;">ZAMKNIJ PODGLĄD</button>
            </div>
        `;
        document.body.appendChild(banner);
    }

    // Zablokuj edycje elementow drag & drop formularza studni
    document
        .querySelectorAll('.drop-zone, #svg-trash, #studnie-product-list, .actions-bar')
        .forEach((el) => {
            el.style.pointerEvents = 'none';
            el.style.opacity = '0.7';
        });

    // Podmień funkcje zapisu by zablokować i pokazać toast
    const originalSaveOrder = window.saveCurrentOrder;
    window.saveCurrentOrder = async () => {
        if (window.isPreviewMode)
            showToast('Zapisywanie w trybie podglądu jest zablokowane', 'error');
        else if (originalSaveOrder) await originalSaveOrder();
    };
    const originalSaveOffer = window.saveOfferStudnie;
    window.saveOfferStudnie = async () => {
        if (window.isPreviewMode) {
            showToast('Zapisywanie w trybie podglądu jest zablokowane', 'error');
            return false;
        } else if (originalSaveOffer) return await originalSaveOffer();
    };

    window.isPreviewMode = true;
};

window.exitPreviewMode = function () {
    window.location.reload(); // Najszybszy i najbezpieczniejszy powrót po przeglądaniu JSONów z historii
};

async function loadOrderSnapshot(rebuiltData, orderId) {
    try {
        const order = rebuiltData;
        orderEditMode = { orderId: orderId, order: order };
        editingOfferIdStudnie = order.offerId || null;

        visiblePrzejsciaTypes = new Set(order.visiblePrzejsciaTypes || []);

        // Załaduj rabaty zamówienia dla poprawnego przeliczania cen w podglądzie
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
window.loadOrderSnapshot = loadOrderSnapshot;

function renderOrderModeBanner() {
    let banner = document.getElementById('order-mode-banner');
    if (!banner) {
        // Utwórz baner u góry środkowej kolumny
        const centerCol = document.querySelector('.well-center-column');
        if (!centerCol) return;
        banner = document.createElement('div');
        banner.id = 'order-mode-banner';
        centerCol.insertBefore(banner, centerCol.firstChild);
    }

    const saveSidebarBtn = document.getElementById('btn-save-studnie-sidebar');
    const saveZamowienieSidebarBtn = document.getElementById('btn-save-zamowienie-sidebar');
    const zleceniaSidebarBtn = document.getElementById('btn-zlecenia-sidebar');

    if (!orderEditMode) {
        banner.style.display = 'none';
        if (saveSidebarBtn) saveSidebarBtn.style.display = 'flex';
        if (saveZamowienieSidebarBtn) saveZamowienieSidebarBtn.style.display = 'none';
        if (zleceniaSidebarBtn) zleceniaSidebarBtn.style.display = 'none';
        // Przywróć wskaźnik kreatora do kroku 3 (Oferta)
        if (typeof currentWizardStep !== 'undefined' && currentWizardStep === 5) {
            currentWizardStep = 3;
            if (typeof updateWizardIndicator === 'function') updateWizardIndicator();
        }
        return;
    }

    banner.style.display = '';
    if (saveSidebarBtn) saveSidebarBtn.style.display = 'none';
    if (saveZamowienieSidebarBtn) saveZamowienieSidebarBtn.style.display = 'flex';
    if (zleceniaSidebarBtn) zleceniaSidebarBtn.style.display = 'flex';

    const order = orderEditMode.order;
    // Oblicz zmiany w stosunku do bieżących studni
    const tempOrder = { ...order, wells: wells };
    const changes = getOrderChanges({ ...order, wells: wells });
    const changeCount = Object.keys(changes).length;
    const hasChanges = changeCount > 0;

    banner.style.cssText = `
        display:flex; align-items:center; justify-content:space-between; flex-wrap:wrap; gap:0.5rem;
        padding:0.7rem 1rem; margin-top:calc(0.5rem + 2px); margin-bottom:0.6rem; border-radius:10px;
        background: ${hasChanges ? 'linear-gradient(135deg, rgba(var(--danger-rgb),0.12), rgba(var(--danger-rgb),0.06))' : 'linear-gradient(135deg, rgba(var(--success-rgb),0.12), rgba(var(--success-rgb),0.06))'};
        border: 2px solid ${hasChanges ? 'rgba(var(--danger-rgb),0.3)' : 'rgba(var(--success-rgb),0.3)'};
    `;

    banner.innerHTML = `
        <div style="display:flex; align-items:center; gap:0.5rem; flex-wrap:wrap;">
            <span style="font-size:1.3rem;"><i data-lucide="package"></i></span>
            <div>
                <div style="font-size:0.82rem; font-weight:800; color:${hasChanges ? 'var(--danger-hover)' : 'var(--success-hover)'};">
                    TRYB ZAMÓWIENIA — ${order.number || ''}
                </div>
                <div style="font-size:0.65rem; color:var(--text-muted);">
                    ${hasChanges ? `<i data-lucide="alert-triangle"></i> ${changeCount} studni zmienionych od oryginału` : '<i data-lucide="check-circle-2"></i> Bez zmian od oryginału'}
                    • Utworzono: ${new Date(order.createdAt).toLocaleString('pl-PL')}
                </div>
            </div>
        </div>
        <div style="display:flex; gap:0.4rem; align-items:center;">
        </div>
    `;
}

async function saveCurrentOrder(options = {}) {
    if (!orderEditMode) {
        showToast('Brak trybu zamówienia', 'error');
        return;
    }

    const order = orderEditMode.order;

    // Zamroź ceny tylko przy normalnym zapisie (nie przy zapisie z poziomu zleceń produkcyjnych)
    if (!options.skipFreeze) {
        freezeWellPrices(wells);
    }

    // Zaktualizuj zamówienie bieżącymi studniami (ceny już zamrożone)
    order.wells = structuredClone(wells);
    if (typeof window.wellDiscounts !== 'undefined') {
        order.wellDiscounts = structuredClone(window.wellDiscounts);
    }
    order.visiblePrzejsciaTypes = Array.from(visiblePrzejsciaTypes);
    order.updatedAt = new Date().toISOString();

    // Recalculate totals
    let totalNetto = 0,
        totalWeight = 0;
    wells.forEach((well) => {
        const stats = calcWellStats(well);
        totalNetto += stats.price;
        totalWeight += stats.weight;
    });
    order.totalWeight = totalWeight;

    const offer = offersStudnie ? offersStudnie.find((o) => o.id === order.offerId) : null;
    const transportKmVal = parseFloat(document.getElementById('transport-km')?.value) || 0;
    const transportRateVal = parseFloat(document.getElementById('transport-rate')?.value) || 0;

    // Zapisz transport do zamówienia (nie nadpisuj oferty)
    order.transportKm = transportKmVal;
    order.transportRate = transportRateVal;
    order.transportMode = currentTransportMode;

    let totalTransportCostForOffer = 0;
    if (transportKmVal > 0 && transportRateVal > 0 && totalWeight > 0) {
        const offerTotalWeight = offer?.totalWeight || totalWeight;
        const fullOfferCost =
            (typeof calcTransportCount === 'function'
                ? calcTransportCount(offerTotalWeight, currentTransportMode)
                : Math.ceil(offerTotalWeight / MAX_TRANSPORT_WEIGHT)) *
            transportKmVal *
            transportRateVal;
        totalTransportCostForOffer =
            offerTotalWeight > 0 ? fullOfferCost * (totalWeight / offerTotalWeight) : 0;
    }
    const orderTotal = totalNetto + totalTransportCostForOffer;
    order.totalNetto = orderTotal;
    order.totalBrutto = orderTotal * 1.23;

    order.wellsExport = wells.map((well) => {
        const stats = calcWellStats(well);
        const wellTransportCost =
            totalWeight > 0 ? totalTransportCostForOffer * (stats.weight / totalWeight) : 0;
        const zwienczenie =
            typeof getWellZwienczenieName === 'function' ? getWellZwienczenieName(well) : '—';
        return {
            name: well.name,
            dn: well.dn,
            height: stats.height,
            weight: stats.weight,
            zwienczenie: zwienczenie,
            price: stats.price,
            transportCost: wellTransportCost,
            totalPrice: stats.price + wellTransportCost,
            config: well.config,
            przejscia: well.przejscia
        };
    });

    // Zapisz przez PATCH
    try {
        await fetch(`/api/orders-studnie/${order.id}`, {
            method: 'PATCH',
            headers: authHeaders(),
            body: JSON.stringify({
                wells: order.wells,
                wellDiscounts: order.wellDiscounts,
                kartaBudowy: order.kartaBudowy,
                updatedAt: order.updatedAt,
                wellsExport: order.wellsExport,
                totalWeight: order.totalWeight,
                totalNetto: order.totalNetto,
                totalBrutto: order.totalBrutto,
                transportKm: order.transportKm,
                transportRate: order.transportRate,
                transportMode: order.transportMode
            })
        });
        showToast('<i data-lucide="package"></i> Zamówienie zapisane', 'success');
        renderOrderModeBanner();
        if (typeof renderOfferSummary === 'function') renderOfferSummary();
    } catch (err) {
        logger.error('orderManager', 'Błąd zapisu zamówienia:', err);
        showToast('Błąd zapisu zamówienia', 'error');
    }
}

window.createOrderFromOffer = createOrderFromOffer;
window.saveOrderStudnie = saveOrderStudnie;
window.saveCurrentOrder = saveCurrentOrder;
window.deleteOrderStudnie = deleteOrderStudnie;

/** Synchronizuje zmiany z ofertą lub zamówieniem w zależności od trybu edycji */
async function syncSourceData(options = {}) {
    let synced = '';
    try {
        if (typeof orderEditMode !== 'undefined' && orderEditMode) {
            // Jesteśmy w trybie edycji zamówienia.
            // Zapisujemy TYLKO zamówienie. Zapisanie oferty w tym trybie usunęłoby studnie,
            // ponieważ globalna tablica 'wells' zawiera teraz tylko studnie z zamówienia.
            if (typeof window.saveCurrentOrder === 'function') {
                await window.saveCurrentOrder(options);
                synced += 'Zamówienie';
            }
        } else {
            // Jesteśmy w trybie edycji oferty
            if (typeof window.saveOfferStudnie === 'function') {
                const offerSaved = await window.saveOfferStudnie();
                if (offerSaved) synced += 'Oferta';
            }
        }
    } catch (err) {
        logger.error('orderManager', 'syncSourceData error:', err);
    }
    return synced;
}
window.syncSourceData = syncSourceData;

/* ===== ZLECENIA PRODUKCYJNE ===== */
let productionOrders = [];
let zleceniaElementsList = []; // [{wellIndex, elementIndex, well, product, configItem}]
let zleceniaSelectedIdx = -1;
let zleceniaActiveFilter = 'all'; // 'all' | 'saved' | 'accepted'

/** Zwraca status elementu: 'zaakceptowany', 'zapisany' lub 'otwarty' */

/** Ustaw aktywny filtr dla listy elementów zleceń */

/**
 * Build a snapshot of etykieta elements from well config.
 * Przechowywane ze zleceniem produkcyjnym, aby rejestr mógł drukować etykiety bez kontekstu studnieProducts.
 */

let wellsSnapshotBeforeZlecenia = null;

/** Pomocnik do znalezienia ostatniego fizycznego elementu (ignorując uszczelki) dla sprawdzenia studni stycznej */

/** Odśwież globalne metryki pulpitu nawigacyjnego, jeśli działa w SPA / oknie nadrzędnym */

window.showKartaBudowyExportChoice = function () {
    if (!orderEditMode || !orderEditMode.orderId) {
        showToast('Brak aktywnego zamówienia', 'error');
        return;
    }
    const orderId = orderEditMode.orderId;
    const modalHtml = `
    <div id="karta-export-modal" style="position: fixed; top: 0; left: 0; width: 100vw; height: 100vh; background: rgba(0,0,0,0.6); display: flex; justify-content: center; align-items: center; z-index: 10000; backdrop-filter: blur(4px);">
        <div style="background: #1e293b; border: 1px solid #334155; border-radius: 12px; width: 350px; padding: 1.5rem; text-align: center; box-shadow: 0 10px 25px rgba(0,0,0,0.5);">
            <h3 style="margin: 0 0 0.5rem 0; font-size: 1.1rem; color: #fff; font-weight: 700;">Wydruk Karty Budowy</h3>
            <p style="font-size: 0.8rem; color: var(--border); margin-bottom: 1.5rem;">Wybierz format eksportu karty budowy zamówienia</p>
            <div style="display: flex; gap: 1rem; justify-content: center; margin-bottom: 1.5rem;">
                <button data-action="exportKartaToPDF" data-order-id="${orderId}" style="flex: 1; background: rgba(var(--danger-rgb),0.2); color: #fca5a5; border: 2px solid rgba(var(--danger-rgb),0.6); padding: 1rem; border-radius: 10px; cursor: pointer; font-weight: 800; display: flex; flex-direction: column; align-items: center; gap: 0.4rem; transition: all 0.2s;">
                    <span style="font-size: 2rem;"><i data-lucide="file-text"></i></span> PDF
                </button>
                <button data-action="exportKartaToWord" data-order-id="${orderId}" style="flex: 1; background: rgba(var(--blue-rgb),0.2); color: #93c5fd; border: 2px solid rgba(var(--blue-rgb),0.6); padding: 1rem; border-radius: 10px; cursor: pointer; font-weight: 800; display: flex; flex-direction: column; align-items: center; gap: 0.4rem; transition: all 0.2s;">
                    <span style="font-size: 2rem;"><i data-lucide="edit"></i></span> Word
                </button>
            </div>
            <button data-action="closeKartaExportModal" style="padding: 0.5rem 1rem; border-radius: 6px; background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.1); color: var(--text-muted); cursor: pointer;">Anuluj</button>
        </div>
    </div>
    `;
    document.body.insertAdjacentHTML('beforeend', modalHtml);
    if (typeof lucide !== 'undefined') lucide.createIcons();
};

window.exportKartaToPDF_action = async function (orderId) {
    const modal = document.getElementById('karta-export-modal');
    if (modal) modal.remove();
    showToast('Generowanie Karty Budowy (PDF)...', 'info');
    fetch('/api/orders-studnie/' + orderId + '/export-karta-pdf', {
        headers:
            typeof authHeaders === 'function'
                ? authHeaders()
                : { 'Content-Type': 'application/json' }
    })
        .then(function (res) {
            if (!res.ok) throw new Error('Nie udało się wyeksportować karty budowy');
            return res.blob();
        })
        .then(function (blob) {
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = 'karta_budowy_' + orderId.substring(0, 8) + '.pdf';
            document.body.appendChild(a);
            a.click();
            window.URL.revokeObjectURL(url);
            a.remove();
            showToast('Pobrano Kartę Budowy w PDF', 'success');
        })
        .catch(function (err) {
            if (typeof logger !== 'undefined') logger.error('orderManager', '[Export Error]', err);
            showToast('Błąd eksportu: ' + err.message, 'error');
        });
};

window.exportKartaToWord_action = async function (orderId) {
    const modal = document.getElementById('karta-export-modal');
    if (modal) modal.remove();
    showToast('Generowanie Karty Budowy (DOCX)...', 'info');
    fetch('/api/orders-studnie/' + orderId + '/export-karta-docx', {
        headers:
            typeof authHeaders === 'function'
                ? authHeaders()
                : { 'Content-Type': 'application/json' }
    })
        .then(function (res) {
            if (!res.ok) throw new Error('Nie udało się wyeksportować karty budowy');
            return res.blob();
        })
        .then(function (blob) {
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = 'karta_budowy_' + orderId.substring(0, 8) + '.docx';
            document.body.appendChild(a);
            a.click();
            window.URL.revokeObjectURL(url);
            a.remove();
            showToast('Pobrano Kartę Budowy w DOCX', 'success');
        })
        .catch(function (err) {
            if (typeof logger !== 'undefined') logger.error('orderManager', '[Export Error]', err);
            showToast('Błąd eksportu: ' + err.message, 'error');
        });
};

document.addEventListener('DOMContentLoaded', () => {
    setTimeout(() => {
        setupParamTiles();
        updateParamTilesUI();
        loadProductionOrders();
    }, 500);
});

/* CSP Actions registrations */
if (typeof registerCspAction === 'function') {
    registerCspAction('deleteOrderStudnie', {
        handler: function ({ orderId }) {
            deleteOrderStudnie(orderId);
        },
        params: ['orderId']
    });

    registerCspAction('onZleceniaKatChange', onZleceniaKatChange);

    registerCspAction('exitPreviewMode', window.exitPreviewMode);

    registerCspAction('toggleDaneElementu', window.toggleDaneElementu);

    registerCspAction('selectZleceniaElement', {
        handler: _onSelectZleceniaElement,
        params: ['zlIdx']
    });

    registerCspAction('deleteProductionOrderFromList', {
        handler: _onDeleteProductionOrderFromList,
        params: ['poId']
    });

    registerCspAction('moveZleceniaComponent', {
        handler: _onMoveZleceniaComponent,
        params: ['zlIdx', 'direction']
    });

    registerCspAction('toggleDaneZlecenia', _onToggleDaneZlecenia);

    registerCspAction('toggleCard', function (params, target) {
        if (typeof window.toggleCard === 'function') {
            window.toggleCard(params.targetId, params.iconId);
        }
    });

    registerCspAction('selectZleceniaTile', {
        handler: function (params, target) {
            selectZleceniaTile(target, params.targetId, params.value);
        },
        params: ['targetId', 'value']
    });

    registerCspAction('selectAndKatChange', _onSelectAndKatChange);

    registerCspAction('setKatStopni', {
        handler: _onSetKatStopni,
        params: ['value']
    });

    registerCspAction('closeBulkOrderPopup', closeBulkOrderPopup);

    registerCspAction('executeBulkFromPopup', executeBulkFromPopup);

    registerCspAction('toggleBulkSeqItem', function (target) {
        toggleBulkSeqItem(target);
    });

    registerCspAction('bulkSeqInput', _onBulkSeqInput);

    registerCspAction('exportKartaToPDF', {
        handler: function ({ orderId }) {
            window.exportKartaToPDF_action(orderId);
        },
        params: ['orderId']
    });

    registerCspAction('exportKartaToWord', {
        handler: function ({ orderId }) {
            window.exportKartaToWord_action(orderId);
        },
        params: ['orderId']
    });

    registerCspAction('closeKartaExportModal', function () {
        var modal = document.getElementById('karta-export-modal');
        if (modal) modal.remove();
    });

    /* Przejscia szczelne handlers */
    registerCspAction('pszRodzajCatChange', _onPszRodzajCatChange);
    registerCspAction('pszRodzajCustomChange', _onPszRodzajCustomChange);
    registerCspAction('pszDnSelectChange', _onPszDnSelectChange);
    registerCspAction('pszDnInputChange', _onPszDnInputChange);
    registerCspAction('pszUwagiChange', _onPszUwagiChange);
    registerCspAction('pszCzyChange', _onPszCzyChange);
    registerCspAction('pszDeleteRow', _onPszDeleteRow);
    registerCspAction('zlCfgDrag', {
        handler: function (p, t, e) {
            if (e.type === 'dragstart') {
                handleZlCfgDragStart(e);
                return;
            }
            if (e.type === 'dragover') {
                e.preventDefault();
                handleZlCfgDragOver(e);
                return;
            }
            if (e.type === 'drop') {
                e.preventDefault();
                handleZlCfgDrop(e);
                return;
            }
            if (e.type === 'dragend') {
                handleZlCfgDragEnd(e);
                return;
            }
        },
        params: []
    });
}
