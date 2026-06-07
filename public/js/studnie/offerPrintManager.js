/* ============================
   WITROS — Wydruk Oferty Studni
   offerPrintManager.js
   ============================ */

/**
 * Zwraca nazwę zwieńczenia (górnego elementu) studni na podstawie konfiguracji.
 * Szuka wlazu, konusa, płyty zamykającej / najazdowej / DIN / pierścienia.
 */
function getWellZwienczenieName(well) {
    if (!well || !well.config) return '—';

    // Zgodnie z wytycznymi: Zwieńczenie to nie właz, tylko element pod nim (płyta, konus itp.)
    const topTypes = [
        'konus',
        'plyta_zamykajaca',
        'plyta_najazdowa',
        'plyta_din',
        'pierscien_odciazajacy'
    ];
    const topItem = well.config.find((item) => {
        const p = studnieProducts.find((pr) => pr.id === item.productId);
        return p && topTypes.includes(p.componentType);
    });

    if (!topItem) return '—';

    const product = studnieProducts.find((p) => p.id === topItem.productId);
    if (!product) return '—';

    let name = product.name;
    // Usunięcie oznaczeń wysokości (np. h=200, H=250, (H=600mm), itp.)
    name = name.replace(/\s*\(?[hH]\s*=?\s*\d+([.,]\d+)?\s*(mm|cm|m)?\)?\s*/gi, ' ');
    // Usunięcie dopisków o stopniach (np. "bez stopni", "z drabinką", "drabinka")
    name = name.replace(/\s*(bez\s+stopni|z\s+drabinką|drabinka|ze\s+stopniami|-B|-D|-N)/gi, '');
    name = name.trim().replace(/\s+/g, ' ');

    return name;
}

/**
 * Grupuje studnie po średnicy. Studnie styczne (dn === 'styczna') trafiają do osobnej grupy.
 * Zwraca Map<klucz, Well[]> posortowaną: DN1000, DN1200, ..., styczna.
 */
function groupWellsByDiameter(wellsList) {
    const groups = new Map();
    const dnOrder = [1000, 1200, 1500, 2000, 2500, 'styczna'];

    wellsList.forEach((well) => {
        const key = well.dn;
        if (!groups.has(key)) groups.set(key, []);
        groups.get(key).push(well);
    });

    // Sortowanie wg ustalonej kolejności
    const sorted = new Map();
    dnOrder.forEach((dn) => {
        if (groups.has(dn)) sorted.set(dn, groups.get(dn));
    });
    // Nietypowe DN (failsafe)
    groups.forEach((v, k) => {
        if (!sorted.has(k)) sorted.set(k, v);
    });

    return sorted;
}

/**
 * Buduje HTML jednej tabeli dla grupy studni o tej samej średnicy.
 * globalLpOffset — numer LP od którego zaczynamy numerację.
 * Zwraca { html, count, totalPrice, nextLp }.
 */
function buildDiameterTableHtml(dn, wellsGroup, globalLpOffset, transportCostMap) {
    const dnLabel = dn === 'styczna' ? 'Studnie styczne' : `Studnie DN${dn}`;

    let html = `<div class="dn-section">
        <div class="dn-header">${dnLabel}</div>
        <table class="offer-table">
            <thead>
                <tr>
                    <th style="width:5%;">Lp.</th>
                    <th style="width:30%;">Nr studni</th>
                    <th style="width:10%;">Średnica</th>
                    <th style="width:8%;">H [mm]</th>
                    <th style="width:32%;">Zwieńczenie</th>
                    <th style="width:15%;">Cena netto [PLN]</th>
                </tr>
            </thead>
            <tbody>`;

    let groupTotal = 0;
    let lp = globalLpOffset;

    wellsGroup.forEach((well) => {
        const stats = calcWellStats(well);
        const transportCost = transportCostMap.get(well) || 0;
        const wellPrice = stats.price + transportCost;
        groupTotal += wellPrice;

        const zwienczenie = getWellZwienczenieName(well);
        const dnDisplay = well.dn === 'styczna' ? 'Styczna' : `DN${well.dn}`;

        html += `<tr>
            <td class="text-center">${lp}</td>
            <td class="text-center bold">${well.name || '—'}</td>
            <td class="text-center">${dnDisplay}</td>
            <td class="text-center">${fmtInt(stats.height)}</td>
            <td class="zwienczenie-cell text-center">${zwienczenie}</td>
            <td class="text-center bold">${fmt(wellPrice)}</td>
        </tr>`;
        lp++;
    });

    // Wiersz sumy
    html += `<tr class="dn-summary-row">
        <td colspan="4"></td>
        <td class="text-right">Razem ${dnLabel} (${wellsGroup.length} szt.):</td>
        <td class="text-center">${fmt(groupTotal)} PLN</td>
    </tr>`;

    html += `</tbody></table></div>`;

    return { html, count: wellsGroup.length, totalPrice: groupTotal, nextLp: lp };
}

/**
 * Buduje sekcję podsumowania — wiersz na każdy DN + razem.
 */
function buildOfferSummaryHtml(summaries, totalNettoAll) {
    let html = `<div class="summary-section">
        <h3>Podsumowanie oferty</h3>
        <table class="summary-table">`;

    summaries.forEach((s) => {
        html += `<tr>
            <td class="text-center">${s.label}</td>
            <td class="text-center">${s.count} szt.</td>
            <td class="text-center bold">${fmt(s.totalPrice)} PLN</td>
        </tr>`;
    });

    html += `<tr class="grand-total">
            <td class="text-center">RAZEM NETTO</td>
            <td class="text-center">${summaries.reduce((s, x) => s + x.count, 0)} szt.</td>
            <td class="text-center">${fmt(totalNettoAll)} PLN</td>
        </tr>`;

    html += `</table></div>`;
    return html;
}

/**
 * Buduje sekcję uwag i warunków.
 */
function buildOfferNotesHtml(notes, paymentTerms, validity) {
    let html = '';

    if (notes) {
        html += `<div class="notes-section">
            <div class="note-box">${notes.replace(/\\n/g, '<br>')}</div>
        </div>`;
    }

    if (paymentTerms) {
        html += `<div class="conditions" style="margin-top: 10px;">
            <div><strong>Warunki płatności:</strong> ${paymentTerms.replace(/\\n/g, '<br>')}</div>
        </div>`;
    }

    return html;
}

/**
 * Buduje blok danych klienta.
 */
function buildClientInfoHtml() {
    const getValue = (id) => document.getElementById(id)?.value?.trim() || '';

    const clientName = getValue('client-name');
    const clientNip = getValue('client-nip');
    const clientAddress = getValue('client-address');
    const clientContact = getValue('client-contact');

    let html = '';
    if (clientName) html += `<div><strong>${clientName}</strong></div>`;
    if (clientNip) html += `<div>NIP: ${clientNip}</div>`;
    if (clientAddress) html += `<div>${clientAddress}</div>`;
    if (clientContact) html += `<div>Kontakt: ${clientContact}</div>`;
    if (!html) html = '<div>—</div>';
    return html;
}

/**
 * Buduje blok danych inwestycji.
 */
function buildInvestInfoHtml() {
    const getValue = (id) => document.getElementById(id)?.value?.trim() || '';

    const investName = getValue('invest-name');
    const investAddress = getValue('invest-address');
    const investContractor = getValue('invest-contractor');

    let html = '';
    if (investName) html += `<div><strong>${investName}</strong></div>`;
    if (investAddress) html += `<div>${investAddress}</div>`;
    if (investContractor) html += `<div>Wykonawca: ${investContractor}</div>`;
    if (!html) html = '<div>—</div>';
    return html;
}

/**
 * Oblicza mapę kosztów transportu per studnia (proporcjonalnie do wagi).
 * Zwraca Map<Well, number>.
 */
function calculateWellTransportMap(wellsList) {
    const transportKm = parseFloat(document.getElementById('transport-km')?.value) || 0;
    const transportRate = parseFloat(document.getElementById('transport-rate')?.value) || 0;

    const map = new Map();
    if (transportKm <= 0 || transportRate <= 0) {
        wellsList.forEach((w) => map.set(w, 0));
        return { map, totalTransportCost: 0 };
    }

    let globalWeight = 0;
    wellsList.forEach((w) => {
        globalWeight += calcWellStats(w).weight;
    });

    const totalTransports = Math.ceil(globalWeight / 24000);
    const costPerTrip = transportKm * transportRate;
    const totalTransportCost = totalTransports * costPerTrip;

    wellsList.forEach((w) => {
        const wWeight = calcWellStats(w).weight;
        const share = globalWeight > 0 ? totalTransportCost * (wWeight / globalWeight) : 0;
        map.set(w, share);
    });

    return { map, totalTransportCost };
}

/**
 * Główna funkcja — generuje kod HTML oferty studni.
 */
async function generateOfferHtml() {
    if (!wells || wells.length === 0) {
        showToast('Brak studni w ofercie', 'error');
        return null;
    }

    const template = await getTemplate('templates/ofertaStudnie.html');
    if (!template) return null;

    // Dane oferty
    const offerNumber = document.getElementById('offer-number')?.value || '—';
    const offerDate =
        document.getElementById('offer-date')?.value || new Date().toISOString().slice(0, 10);
    const notes = document.getElementById('offer-tab-notes')?.value?.trim() || document.getElementById('offer-notes')?.value?.trim() || '';
    const paymentTerms = document.getElementById('offer-tab-payment-terms')?.value?.trim() || document.getElementById('offer-payment-terms')?.value?.trim() || '';
    const validity = document.getElementById('offer-tab-validity')?.value?.trim() || document.getElementById('offer-validity')?.value?.trim() || '';

    // Transport
    const { map: transportMap, totalTransportCost } = calculateWellTransportMap(wells);

    // Grupy po średnicach
    const groups = groupWellsByDiameter(wells);

    // Budowanie tabel
    let tablesHtml = '';
    let currentLp = 1;
    const summaries = [];

    groups.forEach((groupWells, dn) => {
        const result = buildDiameterTableHtml(dn, groupWells, 1, transportMap);
        tablesHtml += result.html;

        const label = dn === 'styczna' ? 'Studnie styczne' : `Studnie DN${dn}`;
        summaries.push({ label, count: result.count, totalPrice: result.totalPrice });
    });

    // Suma netto (produkty + transport wliczony do cen studni)
    const totalNettoAll = summaries.reduce((s, x) => s + x.totalPrice, 0);

    // Podsumowanie
    const summaryHtml = buildOfferSummaryHtml(summaries, totalNettoAll);

    // Uwagi / warunki
    const notesHtml = buildOfferNotesHtml(notes, paymentTerms, validity);

    // Pobierz dane kontaktowe autora oferty i opiekuna
    // createdByUserName = oryginalna nazwa autora (niezmienna)
    // editingOfferAssignedUserId = aktualny opiekun handlowy
    let usersList = [];
    try {
        const usersResp = await fetch('/api/users-for-assignment', {
            headers: typeof authHeaders === 'function' ? authHeaders() : {}
        });
        const usersData = await usersResp.json();
        usersList = usersData?.data || usersData?.users || [];
    } catch (e) {
        console.warn('Nie udało się pobrać danych operatorów', e);
    }

    // Opiekun handlowy — z editingOfferAssignedUserId
    const assigneeId =
        typeof editingOfferAssignedUserId !== 'undefined' && editingOfferAssignedUserId
            ? editingOfferAssignedUserId
            : null;
    let offerAssigneeUser = assigneeId
        ? usersList.find((u) => String(u.id) === String(assigneeId)) || null
        : null;
    if (!offerAssigneeUser && typeof currentUser !== 'undefined' && currentUser) {
        offerAssigneeUser = currentUser;
    }

    // Autor oferty — z createdByUserName (szukamy po nazwie) lub currentUser
    const creatorName =
        typeof editingOfferCreatedByUserName !== 'undefined' && editingOfferCreatedByUserName
            ? editingOfferCreatedByUserName
            : null;
    let offerCreatorUser = null;
    if (creatorName && usersList.length) {
        offerCreatorUser =
            usersList.find((u) => {
                const fullName =
                    u.firstName && u.lastName ? `${u.firstName} ${u.lastName}` : u.username;
                return fullName === creatorName || u.username === creatorName;
            }) || null;
    }
    if (!offerCreatorUser) {
        offerCreatorUser = offerAssigneeUser;
    }

    // Sprawdź czy autor i opiekun to ta sama osoba (po rzeczywistym ID)
    const isSamePerson =
        offerCreatorUser &&
        offerAssigneeUser &&
        String(offerCreatorUser.id) === String(offerAssigneeUser.id);

    let contactHtml = `<div class="offer-contact-footer" style="margin-top:20px; padding-top:10px; border-top:1.5px solid #999; font-size:9pt;">`;
    contactHtml += `<table style="width:100%; border:none;"><tr>`;

    const renderUser = (title, u) => {
        if (!u) return '';
        const name =
            u.firstName && u.lastName
                ? `${u.firstName} ${u.lastName}`
                : u.displayName || u.username || 'Nieznany';
        let ht = `<td style="vertical-align:top; width:50%;">`;
        ht += `<strong style="color:#999;">${title}:</strong><br>`;
        ht += `<strong>${name}</strong><br>`;
        if (u.email)
            ht += `Email: <a href="mailto:${u.email}" style="color:#333;text-decoration:none;">${u.email}</a><br>`;
        if (u.phone) ht += `Telefon: ${u.phone}`;
        ht += `</td>`;
        return ht;
    };

    if (isSamePerson) {
        contactHtml += renderUser('Opiekun handlowy (kontakt)', offerAssigneeUser);
    } else {
        contactHtml += renderUser('Ofertę przygotował(-a)', offerCreatorUser);
        contactHtml += renderUser('Opiekun handlowy (kontakt)', offerAssigneeUser);
    }

    contactHtml += `</tr></table></div>`;

    // Payload
    const payload = {
        BASE_URL: window.location.origin,
        NR_OFERTY: offerNumber,
        DATA_OFERTY: offerDate,
        DATA_WAZNOSCI: validity,
        DANE_KLIENTA: buildClientInfoHtml(),
        DANE_INWESTYCJI: buildInvestInfoHtml(),
        TABELE_DN: tablesHtml,
        PODSUMOWANIE: summaryHtml,
        SEKCJA_UWAGI: notesHtml,
        DANE_KONTAKTOWE: contactHtml
    };

    const finalHtml = renderTemplate(template, payload);
    return finalHtml;
}

/**
 * Zapisuje ofertę do pliku Word (.doc)
 */
async function exportOfferToWord() {
    const finalHtml = await generateOfferHtml();
    if (!finalHtml) return;

    showToast('Generowanie pliku Word...', 'info');

    // Dodanie nagłówków specyficznych dla Worda by wymusić formatowanie z HTML
    const wordHtml = `
        <html xmlns:o='urn:schemas-microsoft-com:office:office' xmlns:w='urn:schemas-microsoft-com:office:word' xmlns='http://www.w3.org/TR/REC-html40'>
        <head>
            <meta charset='utf-8'>
            <title>Oferta</title>
        </head>
        <body>
            ${finalHtml}
        </body>
        </html>
    `;

    const offerNumber = document.getElementById('offer-number')?.value || 'BrakNumeru';
    const blob = new Blob(['\ufeff', wordHtml], { type: 'application/msword' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `OFERTA_STUDNIE_${offerNumber.replace(/[^A-Za-z0-9]/g, '_')}.doc`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
}

/**
 * Drukuje ofertę do PDF (wykorzystując systemowy dialog druku)
 */
async function printOfferStudnie() {
    showToast('Generowanie wydruku oferty...', 'info');
    const finalHtml = await generateOfferHtml();
    if (finalHtml) {
        silentPrint(finalHtml);
    }
}

/**
 * Główna funkcja wywoływana przy kliknięciu "Wydruk"
 * Pokazuje uniwersalny modal dający wybór wydruku oferty oraz karty budowy
 */
window.handlePrintClick = function() {
    window.showUniversalPrintModal();
};

/**
 * Kompatybilność wsteczna - deleguje do uniwersalnego modala
 */
window.showOfferExportChoice = function() {
    window.showUniversalPrintModal();
};

/**
 * Uniwersalny modal dający wybór wydruku oferty oraz karty budowy
 *
 * @param {string|null} offerId       ID oferty
 * @param {string|null} orderId       ID zamówienia (opcjonalne)
 * @param {Array|null}   relatedOrders Powiązane zamówienia — przekazywane przez dispatcher
 *                                     (kartoteka PV ma `this.ordersMap`, edytor studni
 *                                     ma `ordersStudnie` / `getOrdersForOffer`).
 */
window.showUniversalPrintModal = function(offerId, orderId, relatedOrders) {
    let finalOfferId = offerId;
    let finalOrderId = orderId;

    if (!finalOfferId && !finalOrderId) {
        // Kliknięcie w aktywnym edytorze
        if (typeof orderEditMode !== 'undefined' && orderEditMode && orderEditMode.orderId) {
            finalOrderId = orderEditMode.orderId;
            finalOfferId = (orderEditMode.order && orderEditMode.order.offerId) || orderEditMode.offerId || (typeof editingOfferIdStudnie !== 'undefined' ? editingOfferIdStudnie : '');
        } else if (typeof editingOfferIdStudnie !== 'undefined' && editingOfferIdStudnie) {
            finalOfferId = editingOfferIdStudnie;
            if (typeof getOrdersForOffer === 'function') {
                const orders = getOrdersForOffer(finalOfferId);
                if (orders && orders.length > 0) {
                    finalOrderId = orders[0].id;
                }
            }
        }
    }

    if (!finalOfferId && !finalOrderId) {
        if (typeof showToast === 'function') showToast('Brak aktywnego dokumentu do wydruku', 'error');
        return;
    }

    // Powiązane zamówienia — priorytet: parametr relatedOrders (z dispatchera),
    // potem getOrdersForOffer / ordersStudnie (kontekst edytora studni).
    let orders = [];
    if (Array.isArray(relatedOrders) && relatedOrders.length > 0) {
        orders = relatedOrders;
    } else {
        if (finalOfferId && typeof getOrdersForOffer === 'function') {
            orders = getOrdersForOffer(finalOfferId);
        }
        if (finalOrderId && orders.length === 0) {
            if (typeof ordersStudnie !== 'undefined') {
                const currentOrder = ordersStudnie.find(o => o.id === finalOrderId);
                if (currentOrder) orders = [currentOrder];
            }
        }
    }

    // Buduj config dla uniwersalnego modala (printModal.js)
    const config = {
        modalTitle: 'Wydruk Dokumentów',
        offerSection: finalOfferId ? {
            id: finalOfferId,
            actionPdf: 'exportOfferDirect_action',
            actionDocx: 'exportOfferDirect_action',
            title: 'Wydruk Oferty',
            description: 'Wybierz format eksportu kalkulacji ofertowej:'
        } : null,
        ordersSection: orders.length > 0 ? {
            orders: orders,
            actionPdf: 'exportOrderDirect_action',
            actionDocx: 'exportOrderDirect_action',
            title: 'Wydruk Zamówienia',
            description: 'Wybierz zamówienie i format eksportu:'
        } : null,
        kartaSection: orders.length > 0 ? {
            orders: orders,
            actionPdf: 'exportKartaDirect_action',
            actionDocx: 'exportKartaDirect_action',
            title: 'Wydruk Karty Budowy',
            description: 'Wybierz zamówienie i format Karty Budowy:'
        } : null
    };

    // Deleguj do wspólnego modala
    if (typeof window.__upmHelperShow === 'function') {
        window.__upmHelperShow(config);
    } else if (typeof showToast === 'function') {
        showToast('Helper printModal.js nie załadowany', 'error');
    }
};

/**
 * Akcja pobierania oferty dla konkretnego ID
 */
window.exportOfferDirect_action = async function(offerId, format) {
    // Jeśli to jest aktualnie edytowana oferta w edytorze, możemy ją najpierw zapisać
    // W trybie edycji zamówienia (orderEditMode) oferta jest już zapisana — pomijamy zapis
    if (typeof editingOfferIdStudnie !== 'undefined' && editingOfferIdStudnie === offerId) {
        const isInOrderEditMode = typeof orderEditMode !== 'undefined' && orderEditMode;
        if (!isInOrderEditMode) {
            if (typeof showToast === 'function') {
                showToast('Zapisywanie oferty przed eksportem...', 'info');
            }
            const savedOk = await saveOfferStudnie();
            if (!savedOk) {
                if (typeof showToast === 'function') {
                    showToast('Eksport przerwany - nie udało się zapisać oferty.', 'error');
                }
                return;
            }
        }
    }

    if (typeof showToast === 'function') {
        showToast(`Generowanie oferty (${format.toUpperCase()})...`, 'info');
    }

    const endpoint = format === 'pdf' ? 'export-pdf' : 'export-docx';
    fetch(`/api/offers-studnie/${offerId}/${endpoint}`, {
        headers: typeof authHeaders === 'function' ? authHeaders() : { 'Content-Type': 'application/json' }
    })
    .then(async (res) => {
        if (!res.ok) {
            const errText = await res.text().catch(() => res.statusText);
            throw new Error(`Eksport ${format.toUpperCase()} (${res.status}): ${errText.slice(0, 200)}`);
        }
        return res.blob();
    })
    .then((blob) => {
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `oferta_studnie_${offerId}.${format}`;
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        a.remove();
        if (typeof showToast === 'function') {
            showToast(`Pobrano ofertę w ${format.toUpperCase()}`, 'success');
        }
    })
    .catch((err) => {
        console.error('[Export Error]', err);
        if (typeof showToast === 'function') {
            showToast('Błąd eksportu: ' + err.message, 'error');
        }
    });
};

/**
 * Akcja eksportu Zamowienia studni (PDF/DOCX) — wariant Oferty.
 * Wywolywane z uniwersalnego modala (printModal.js) dla sekcji ZAMOWIENIA.
 * GET /api/orders-studnie/:id/export-pdf|docx
 */
window.exportOrderDirect_action = async function(orderId, format) {
    if (!orderId) {
        if (typeof showToast === 'function') {
            showToast('Brak ID zamówienia do eksportu', 'error');
        }
        return;
    }
    if (format !== 'pdf' && format !== 'docx') {
        if (typeof showToast === 'function') {
            showToast('Nieobsługiwany format eksportu', 'error');
        }
        return;
    }

    if (typeof showToast === 'function') {
        showToast(`Generowanie Zamówienia (${format.toUpperCase()})...`, 'info');
    }

    const endpoint = format === 'pdf' ? 'export-pdf' : 'export-docx';
    fetch(`/api/orders-studnie/${orderId}/${endpoint}`, {
        headers: typeof authHeaders === 'function' ? authHeaders() : { 'Content-Type': 'application/json' }
    })
    .then(async (res) => {
        if (!res.ok) {
            const errText = await res.text().catch(() => res.statusText);
            throw new Error(`Eksport ${format.toUpperCase()} (${res.status}): ${errText.slice(0, 200)}`);
        }
        return res.blob();
    })
    .then((blob) => {
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `zamowienie_studnie_${orderId.substring(0, 8)}.${format}`;
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        a.remove();
        if (typeof showToast === 'function') {
            showToast(`Pobrano Zamówienie w ${format.toUpperCase()}`, 'success');
        }
    })
    .catch((err) => {
        console.error('[Export Error]', err);
        if (typeof showToast === 'function') {
            showToast('Błąd eksportu: ' + err.message, 'error');
        }
    });
};

/**
 * Akcja pobierania karty budowy dla konkretnego ID
 */
window.exportKartaDirect_action = async function(orderId, format) {
    if (typeof showToast === 'function') {
        showToast(`Generowanie Karty Budowy (${format.toUpperCase()})...`, 'info');
    }

    const endpoint = format === 'pdf' ? 'export-karta-pdf' : 'export-karta-docx';
    fetch(`/api/orders-studnie/${orderId}/${endpoint}`, {
        headers: typeof authHeaders === 'function' ? authHeaders() : { 'Content-Type': 'application/json' }
    })
    .then(async (res) => {
        if (!res.ok) {
            const errText = await res.text().catch(() => res.statusText);
            throw new Error(`Eksport ${format.toUpperCase()} (${res.status}): ${errText.slice(0, 200)}`);
        }
        return res.blob();
    })
    .then((blob) => {
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `karta_budowy_${orderId.substring(0,8)}.${format}`;
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        a.remove();
        if (typeof showToast === 'function') {
            showToast(`Pobrano Kartę Budowy w ${format.toUpperCase()}`, 'success');
        }
    })
    .catch((err) => {
        console.error('[Export Error]', err);
        if (typeof showToast === 'function') {
            showToast('Błąd eksportu: ' + err.message, 'error');
        }
    });
};

/**
 * Akcja eksportu bieżącego stanu zamówienia studni jako oferty (PDF/DOCX).
 * Mirror implementacji rury: czyta pozycje z globalnej `wells`,
 * czyta pola formularza klienta/inwestora/transportu, POST do endpointu
 * /api/orders-studnie/:id/export-offer-pdf|docx i pobiera plik.
 */
async function exportStudnieOrderAsOffer_action(orderId, format) {
    if (!orderId) {
        if (typeof showToast === 'function') {
            showToast('Brak ID zamówienia do eksportu', 'error');
        }
        return;
    }
    if (format !== 'pdf' && format !== 'docx') {
        if (typeof showToast === 'function') {
            showToast('Nieobsługiwany format eksportu', 'error');
        }
        return;
    }

    const items = (typeof wells !== 'undefined' && Array.isArray(wells)) ? wells : [];
    if (!items.length) {
        if (typeof showToast === 'function') {
            showToast('Brak pozycji w bieżącym zamówieniu', 'warning');
        }
        return;
    }

    const getVal = (id) => document.getElementById(id)?.value?.trim() || '';
    const transportKm = Number(document.getElementById('transport-km')?.value || 0);
    const transportRate = Number(document.getElementById('transport-rate')?.value || 0);

    const currentOrder = (typeof getCurrentOfferOrder === 'function') ? getCurrentOfferOrder() : null;
    const orderNumber = currentOrder?.orderNumber || orderId;
    const offerNumber = currentOrder?.offerNumber || getVal('offer-number') || '';

    const exportItems = items.map((well) => {
        const stats = (typeof calcWellStats === 'function')
            ? calcWellStats(well)
            : { price: 0, weight: 0, height: 0 };
        const zwienczenieName = (typeof getWellZwienczenieName === 'function')
            ? getWellZwienczenieName(well)
            : '—';
        return {
            productId: (well.config && well.config[0] && well.config[0].productId) || '',
            productName: well.name || `Studnia DN${well.dn}`,
            quantity: 1,
            discount: 0,
            price: Number(stats.price) || 0,
            DN: String(well.dn ?? ''),
            height: Number(stats.height) || 0,
            zwienczenie: zwienczenieName,
            transportCost: 0,
            dodatkowe_info: well.dodatkowe_info || ''
        };
    });

    const payload = {
        items: exportItems,
        clientName: getVal('client-name'),
        clientNip: getVal('client-nip'),
        clientAddress: getVal('client-address'),
        clientContact: getVal('client-contact'),
        investName: getVal('invest-name'),
        investAddress: getVal('invest-address'),
        notes: getVal('offer-notes'),
        paymentTerms: getVal('offer-payment-terms'),
        validity: getVal('offer-validity'),
        date: document.getElementById('offer-date')?.value || new Date().toISOString(),
        transportKm,
        transportRate,
        orderNumber,
        offerNumber
    };

    try {
        if (typeof showToast === 'function') {
            showToast(`Generowanie oferty z zamówienia (${format.toUpperCase()})...`, 'info');
        }
        const endpoint = format === 'pdf' ? 'export-offer-pdf' : 'export-offer-docx';
        const res = await fetch(`/api/orders-studnie/${orderId}/${endpoint}`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                ...(typeof authHeaders === 'function' ? authHeaders() : {})
            },
            body: JSON.stringify(payload)
        });
        if (!res.ok) {
            const errBody = await res.json().catch(() => ({ error: 'Unknown error' }));
            const details = Array.isArray(errBody.details) ? ` (${errBody.details.join('; ')})` : '';
            throw new Error(`${errBody.error || 'Błąd serwera'}${details}`);
        }
        const blob = await res.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        const safeNumber = String(orderNumber).replace(/[^a-zA-Z0-9_-]/g, '_');
        a.download = `oferta_studnie_zamowienie_${safeNumber}.${format}`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        window.URL.revokeObjectURL(url);

        if (typeof showToast === 'function') {
            showToast('Eksport oferty z bieżącego stanu zakończony', 'success');
        }
    } catch (err) {
        console.error('exportStudnieOrderAsOffer_action error:', err);
        if (typeof showToast === 'function') {
            showToast('Błąd eksportu oferty z zamówienia: ' + (err instanceof Error ? err.message : err), 'error');
        }
    }
}

window.exportStudnieOrderAsOffer_action = exportStudnieOrderAsOffer_action;

window.exportOfferToPDF_action = async function() {
    document.getElementById('offer-export-modal').remove();
    
    if (typeof showToast === 'function') {
        showToast('Zapisywanie oferty przed eksportem...', 'info');
    }
    
    const savedOk = await saveOfferStudnie();
    if (!savedOk && !editingOfferIdStudnie) {
        if (typeof showToast === 'function') {
            showToast('Eksport przerwany - nie udało się zapisać oferty.', 'error');
        }
        return;
    }

    if (typeof showToast === 'function') {
        showToast('Generowanie pliku PDF...', 'info');
    }

    fetch(`/api/offers-studnie/${editingOfferIdStudnie}/export-pdf`, {
        headers: typeof authHeaders === 'function' ? authHeaders() : { 'Content-Type': 'application/json' }
    })
    .then(async (res) => {
        if (!res.ok) {
            const errText = await res.text().catch(() => res.statusText);
            throw new Error(`Eksport PDF (${res.status}): ${errText.slice(0, 200)}`);
        }
        return res.blob();
    })
    .then((blob) => {
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `oferta_studnie_${editingOfferIdStudnie}.pdf`;
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        a.remove();
        if (typeof showToast === 'function') {
            showToast('Wyeksportowano ofertę do PDF', 'success');
        }
    })
    .catch((err) => {
        console.error('[Export Error]', err);
        if (typeof showToast === 'function') {
            showToast('Błąd eksportu: ' + err.message, 'error');
        }
    });
};

window.exportOfferToWord_action = async function() {
    document.getElementById('offer-export-modal').remove();
    
    if (typeof showToast === 'function') {
        showToast('Zapisywanie oferty przed eksportem...', 'info');
    }
    
    const savedOk = await saveOfferStudnie();
    if (!savedOk && !editingOfferIdStudnie) {
        if (typeof showToast === 'function') {
            showToast('Eksport przerwany - nie udało się zapisać oferty.', 'error');
        }
        return;
    }

    if (typeof showToast === 'function') {
        showToast('Generowanie pliku DOCX...', 'info');
    }

    fetch(`/api/offers-studnie/${editingOfferIdStudnie}/export-docx`, {
        headers: typeof authHeaders === 'function' ? authHeaders() : { 'Content-Type': 'application/json' }
    })
    .then(async (res) => {
        if (!res.ok) {
            const errText = await res.text().catch(() => res.statusText);
            throw new Error(`Eksport DOCX (${res.status}): ${errText.slice(0, 200)}`);
        }
        return res.blob();
    })
    .then((blob) => {
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `oferta_studnie_${editingOfferIdStudnie}.docx`;
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        a.remove();
        if (typeof showToast === 'function') {
            showToast('Wyeksportowano ofertę do DOCX', 'success');
        }
    })
    .catch((err) => {
        console.error('[Export Error]', err);
        if (typeof showToast === 'function') {
            showToast('Błąd eksportu: ' + err.message, 'error');
        }
    });
};

// ===== GLOBAL EXPORTS =====
window.printOfferStudnie = printOfferStudnie;

