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
 */
window.showUniversalPrintModal = function(offerId, orderId) {
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

    // Pobierz powiązane zamówienia
    let relatedOrders = [];
    if (finalOfferId && typeof getOrdersForOffer === 'function') {
        relatedOrders = getOrdersForOffer(finalOfferId);
    }
    if (finalOrderId && relatedOrders.length === 0) {
        if (typeof ordersStudnie !== 'undefined') {
            const currentOrder = ordersStudnie.find(o => o.id === finalOrderId);
            if (currentOrder) relatedOrders = [currentOrder];
        }
        // Fallback: pobierz zamówienie z API (np. z kartoteki PV gdzie ordersStudnie jest puste)
        if (relatedOrders.length === 0) {
            fetch(`/api/orders-studnie/${finalOrderId}`, {
                headers: typeof authHeaders === 'function' ? authHeaders() : {}
            })
            .then(res => res.ok ? res.json() : null)
            .then(json => {
                if (json && json.data) {
                    window._modalRelatedOrders = [json.data];
                    if (typeof renderOrdersSection === 'function') renderOrdersSection();
                }
            })
            .catch(() => {});
        }
    }

    // Tworzenie HTML modala
    let ordersSectionHtml = '';
    if (relatedOrders.length > 0) {
        ordersSectionHtml = `
            <div style="margin-top: 1.2rem; border-top: 1px solid #334155; padding-top: 1.2rem;">
                <h4 style="margin: 0 0 0.6rem 0; font-size: 0.95rem; color: #34d399; font-weight: 700; text-align: left; display: flex; align-items: center; gap: 0.4rem;">
                    <i data-lucide="package" style="width: 16px; height: 16px;"></i> Wydruk Karty Budowy
                </h4>
                <p style="font-size: 0.75rem; color: #94a3b8; text-align: left; margin-bottom: 0.8rem; line-height: 1.3;">Wybierz format eksportu Karty Budowy:</p>
                <div style="display: flex; flex-direction: column; gap: 0.5rem; max-height: 180px; overflow-y: auto; padding-right: 2px;">
        `;
        relatedOrders.forEach(ord => {
            const ordNum = ord.orderNumber || (ord.id ? ord.id.substring(0, 8) : '—');
            ordersSectionHtml += `
                <div style="background: rgba(52, 211, 153, 0.05); border: 1px solid rgba(52, 211, 153, 0.2); padding: 0.5rem 0.6rem; border-radius: 8px; display: flex; justify-content: space-between; align-items: center; gap: 0.5rem;">
                    <span style="font-size: 0.75rem; color: #e2e8f0; font-weight: 600; text-overflow: ellipsis; overflow: hidden; white-space: nowrap; text-align: left;" title="Zlecenie/Zamówienie ${ordNum}">ZAM: ${ordNum}</span>
                    <div style="display: flex; gap: 0.4rem; flex-shrink: 0;">
                        <button onclick="window.exportKartaDirect_action('${ord.id}', 'pdf')" style="background: rgba(239,68,68,0.2); color: #fca5a5; border: 1px solid rgba(239,68,68,0.5); padding: 0.3rem 0.6rem; border-radius: 6px; cursor: pointer; font-size: 0.7rem; font-weight: 800; transition: all 0.2s;" onmouseenter="this.style.background='rgba(239,68,68,0.4)'" onmouseleave="this.style.background='rgba(239,68,68,0.2)'">
                            PDF
                        </button>
                        <button onclick="window.exportKartaDirect_action('${ord.id}', 'docx')" style="background: rgba(59,130,246,0.2); color: #93c5fd; border: 1px solid rgba(59,130,246,0.5); padding: 0.3rem 0.6rem; border-radius: 6px; cursor: pointer; font-size: 0.7rem; font-weight: 800; transition: all 0.2s;" onmouseenter="this.style.background='rgba(59,130,246,0.4)'" onmouseleave="this.style.background='rgba(59,130,246,0.2)'">
                            Word
                        </button>
                    </div>
                </div>
            `;
        });
        ordersSectionHtml += `
                </div>
            </div>
        `;
    } else {
        ordersSectionHtml = `
            <div style="margin-top: 1.2rem; border-top: 1px solid #334155; padding-top: 1.2rem;">
                <h4 style="margin: 0 0 0.6rem 0; font-size: 0.95rem; color: #64748b; font-weight: 700; text-align: left; display: flex; align-items: center; gap: 0.4rem;">
                    <i data-lucide="package" style="width: 16px; height: 16px;"></i> Wydruk Karty Budowy
                </h4>
                <p style="font-size: 0.75rem; color: #64748b; text-align: left; font-style: italic; background: rgba(255,255,255,0.02); border: 1px dashed rgba(255,255,255,0.1); padding: 0.6rem; border-radius: 8px; line-height: 1.4;">
                    Brak przypisanego zamówienia. Utwórz zamówienie z poziomu podglądu oferty, aby móc wyeksportować Kartę Budowy.
                </p>
            </div>
        `;
    }

    // Sekcja Oferty
    let offerSectionHtml = '';
    if (finalOfferId) {
        offerSectionHtml = `
            <div>
                <h4 style="margin: 0 0 0.6rem 0; font-size: 0.95rem; color: #818cf8; font-weight: 700; text-align: left; display: flex; align-items: center; gap: 0.4rem;">
                    <i data-lucide="file-text" style="width: 16px; height: 16px;"></i> Wydruk Oferty
                </h4>
                <p style="font-size: 0.75rem; color: #94a3b8; text-align: left; margin-bottom: 0.8rem; line-height: 1.3;">Wybierz format eksportu kalkulacji ofertowej:</p>
                <div style="display: flex; gap: 1rem; justify-content: center;">
                    <button onclick="window.exportOfferDirect_action('${finalOfferId}', 'pdf')" style="flex: 1; background: rgba(239,68,68,0.2); color: #fca5a5; border: 2px solid rgba(239,68,68,0.6); padding: 0.8rem; border-radius: 10px; cursor: pointer; font-weight: 800; display: flex; flex-direction: column; align-items: center; gap: 0.4rem; transition: all 0.2s;" onmouseenter="this.style.background='rgba(239,68,68,0.4)'" onmouseleave="this.style.background='rgba(239,68,68,0.2)'">
                        <span style="font-size: 1.5rem;"><i data-lucide="file-text"></i></span> PDF
                    </button>
                    <button onclick="window.exportOfferDirect_action('${finalOfferId}', 'docx')" style="flex: 1; background: rgba(59,130,246,0.2); color: #93c5fd; border: 2px solid rgba(59,130,246,0.6); padding: 0.8rem; border-radius: 10px; cursor: pointer; font-weight: 800; display: flex; flex-direction: column; align-items: center; gap: 0.4rem; transition: all 0.2s;" onmouseenter="this.style.background='rgba(59,130,246,0.4)'" onmouseleave="this.style.background='rgba(59,130,246,0.2)'">
                        <span style="font-size: 1.5rem;"><i data-lucide="edit"></i></span> Word
                    </button>
                </div>
            </div>
        `;
    }

    // Usunięcie poprzedniego modala jeśli istnieje
    const existingModal = document.getElementById('universal-print-modal');
    if (existingModal) existingModal.remove();

    const modalHtml = `
    <div id="universal-print-modal" style="position: fixed; top: 0; left: 0; width: 100vw; height: 100vh; background: rgba(0,0,0,0.6); display: flex; justify-content: center; align-items: center; z-index: 10000; backdrop-filter: blur(4px);">
        <div style="background: #1e293b; border: 1px solid #334155; border-radius: 12px; width: 380px; padding: 1.5rem; text-align: center; box-shadow: 0 10px 25px rgba(0,0,0,0.5);">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1.2rem; border-bottom: 1px solid #334155; padding-bottom: 0.6rem;">
                <h3 style="margin: 0; font-size: 1.1rem; color: #fff; font-weight: 700; display: flex; align-items: center; gap: 0.4rem;">
                    <i data-lucide="printer" style="width: 18px; height: 18px;"></i> Wydruk Dokumentów
                </h3>
                <button onclick="document.getElementById('universal-print-modal').remove()" style="background: none; border: none; color: #94a3b8; cursor: pointer; display: flex; align-items: center; justify-content: center;"><i data-lucide="x" style="width: 18px; height: 18px;"></i></button>
            </div>
            
            ${offerSectionHtml}
            ${ordersSectionHtml}
            
            <div style="margin-top: 1.5rem; display: flex; justify-content: flex-end;">
                <button style="padding: 0.5rem 1.2rem; border-radius: 8px; background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.1); color: #cbd5e1; cursor: pointer; font-size: 0.8rem; font-weight: 600; transition: all 0.2s;" onmouseenter="this.style.background='rgba(255,255,255,0.1)'" onmouseleave="this.style.background='rgba(255,255,255,0.05)'" onclick="document.getElementById('universal-print-modal').remove()">Zamknij</button>
            </div>
        </div>
    </div>
    `;

    document.body.insertAdjacentHTML('beforeend', modalHtml);
    if(typeof lucide !== 'undefined') lucide.createIcons();
};

/**
 * Przerysowuje sekcję Karty Budowy w otwartym modalu po asynchronicznym pobraniu zamówienia.
 * Wywoływana z API fallback w showUniversalPrintModal.
 */
window.renderOrdersSection = function() {
    const modal = document.getElementById('universal-print-modal');
    if (!modal) return;

    // Struktura: #universal-print-modal > div (inline styles, background:#1e293b)
    const modalBody = modal.firstElementChild;
    if (!modalBody) return;

    // Pobierz zamówienia z globalnej zmiennej (ustawione przez fetch w showUniversalPrintModal)
    const orders = window._modalRelatedOrders || [];
    if (orders.length === 0) return;

    // Usuń istniejącą sekcję Karty Budowy (jeśli jest)
    const existingOrders = modalBody.querySelector('.orders-section');
    if (existingOrders) existingOrders.remove();

    const ordersSection = document.createElement('div');
    ordersSection.className = 'orders-section';
    ordersSection.style.cssText = 'margin-top: 1.2rem; border-top: 1px solid #334155; padding-top: 1.2rem;';

    let innerHtml = `
        <h4 style="margin: 0 0 0.6rem 0; font-size: 0.95rem; color: #34d399; font-weight: 700; text-align: left; display: flex; align-items: center; gap: 0.4rem;">
            <i data-lucide="package" style="width: 16px; height: 16px;"></i> Wydruk Karty Budowy
        </h4>
        <p style="font-size: 0.75rem; color: #94a3b8; text-align: left; margin-bottom: 0.8rem; line-height: 1.3;">Wybierz format eksportu Karty Budowy:</p>
        <div style="display: flex; flex-direction: column; gap: 0.5rem; max-height: 180px; overflow-y: auto; padding-right: 2px;">
    `;
    orders.forEach(ord => {
        const ordNum = ord.orderNumber || (ord.id ? ord.id.substring(0, 8) : '—');
        innerHtml += `
            <div style="background: rgba(52, 211, 153, 0.05); border: 1px solid rgba(52, 211, 153, 0.2); padding: 0.5rem 0.6rem; border-radius: 8px; display: flex; justify-content: space-between; align-items: center; gap: 0.5rem;">
                <span style="font-size: 0.75rem; color: #e2e8f0; font-weight: 600; text-overflow: ellipsis; overflow: hidden; white-space: nowrap; text-align: left;" title="Zamówienie ${ordNum}">ZAM: ${ordNum}</span>
                <div style="display: flex; gap: 0.4rem; flex-shrink: 0;">
                    <button onclick="window.exportKartaDirect_action('${ord.id}', 'pdf')" style="background: rgba(239,68,68,0.2); color: #fca5a5; border: 1px solid rgba(239,68,68,0.5); padding: 0.3rem 0.6rem; border-radius: 6px; cursor: pointer; font-size: 0.7rem; font-weight: 800;">PDF</button>
                    <button onclick="window.exportKartaDirect_action('${ord.id}', 'docx')" style="background: rgba(59,130,246,0.2); color: #93c5fd; border: 1px solid rgba(59,130,246,0.5); padding: 0.3rem 0.6rem; border-radius: 6px; cursor: pointer; font-size: 0.7rem; font-weight: 800;">Word</button>
                </div>
            </div>
        `;
    });
    innerHtml += `</div>`;
    ordersSection.innerHTML = innerHtml;

    // Wstaw przed przycisk "Zamknij" (div z justify-content: flex-end)
    const closeBtn = modalBody.querySelector('div[style*="justify-content: flex-end"]');
    if (closeBtn) {
        modalBody.insertBefore(ordersSection, closeBtn);
    } else {
        modalBody.appendChild(ordersSection);
    }
    if (typeof lucide !== 'undefined') lucide.createIcons();
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
    .then((res) => {
        if (!res.ok) throw new Error('Nie udało się wyeksportować oferty');
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
    .then((res) => {
        if (!res.ok) throw new Error('Nie udało się wyeksportować karty budowy');
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
    .then((res) => {
        if (!res.ok) throw new Error('Nie udało się wyeksportować oferty');
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
    .then((res) => {
        if (!res.ok) throw new Error('Nie udało się wyeksportować oferty');
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

