// @ts-check
/* ===== KARTA BUDOWY — Funkcje formularza (pomocnicze) ===== */

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
        if (gWeight > 0 && tWeight > 0) tCost = gCost * (tWeight / gWeight);
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
        wyliczonyTransportInput.value = `${countLabel} x ${fmt(costPerTrip)} z\u0142 = ${fmt(t)} z\u0142`;
    } else if (t > 0) {
        wyliczonyTransportInput.value = `${fmt(t)} z\u0142`;
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
        )
            result.pozostale.push(w.agresjaChemiczna);
        if (
            w.agresjaMrozowa &&
            w.agresjaMrozowa !== 'brak' &&
            !result.pozostale.includes(w.agresjaMrozowa)
        )
            result.pozostale.push(w.agresjaMrozowa);
    });

    if (hasNierdzewna) result.stopnie = 'Drabinka nierdzewna';
    else if (hasDrabinka) result.stopnie = 'Drabinka';
    else if (hasBrak) result.stopnie = 'Brak';
    if (hasZelbet) result.rodzajStudni = '\u017belbet';
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
    )
        return orderEditMode.order.kartaBudowy;
    if (
        typeof pendingOrderCreationData !== 'undefined' &&
        pendingOrderCreationData &&
        pendingOrderCreationData.kartaBudowyTemplate
    )
        return pendingOrderCreationData.kartaBudowyTemplate;
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
    [
        { field: 'warunkiPlatnosci', id: 'step4-warunki-platnosci' },
        { field: 'zabezpieczenieTransportu', id: 'step4-zabezpieczenie-transportu' },
        { field: 'rodzajTransportu', id: 'step4-rodzaj-transportu' },
        { field: 'rodzajStudni', id: 'step4-rodzaj-studni' }
    ].forEach(({ field, id }) => {
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

    const lines = [];
    const precoDiscounts = new Set();
    const pehdDiscounts = new Set();
    const paintingLines = new Set();
    const uniqueDns = [...new Set(selectedWells.map((w) => w.dn))];
    uniqueDns.forEach((dn) => {
        const discountKey = dn === 'styczna' ? 'styczne' : dn;
        const d = wellDiscounts[discountKey];
        if (d) {
            const den = parseFloat(d.dennica || 0),
                nad = parseFloat(d.nadbudowa || 0),
                pre = parseFloat(d.preco || 0),
                pehd = parseFloat(d.pehd || 0);
            const parts = [];
            if (den > 0) parts.push(`Dennica: ${den.toFixed(2).replace('.', ',')}%`);
            if (nad > 0) parts.push(`Nadbudowa: ${nad.toFixed(2).replace('.', ',')}%`);
            if (parts.length > 0)
                lines.push(`${dn === 'styczna' ? 'Styczne' : 'DN' + dn} ${parts.join(', ')}`);
            if (pre > 0) precoDiscounts.add(pre);
            if (pehd > 0) pehdDiscounts.add(pehd);
        }
    });
    selectedWells.forEach((w) => {
        if (w.malowanieW && w.malowanieW !== 'brak') {
            paintingLines.add(
                `Malowanie wewn\u0105trz (${w.malowanieW}): ${parseFloat(w.malowanieWewCena || 0)
                    .toFixed(2)
                    .replace('.', ',')} PLN/m\u00b2`
            );
        }
        if (w.malowanieZ && w.malowanieZ !== 'brak') {
            paintingLines.add(
                `Malowanie zewn\u0105trz (${w.malowanieZ}): ${parseFloat(w.malowanieZewCena || 0)
                    .toFixed(2)
                    .replace('.', ',')} PLN/m\u00b2`
            );
        }
    });
    precoDiscounts.forEach((pre) => lines.push(`Preco: ${pre.toFixed(2).replace('.', ',')}%`));
    pehdDiscounts.forEach((pehd) =>
        lines.push(`Wk\u0142adka PEHD: ${pehd.toFixed(2).replace('.', ',')}%`)
    );
    paintingLines.forEach((pl) => lines.push(pl));
    if (lines.length > 0) uwagiEl.value = lines.join('\n');
}
