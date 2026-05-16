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
            <div class="note-box"><strong>Uwagi:</strong> ${notes}</div>
        </div>`;
    }

    html += `<div class="conditions">`;
    if (paymentTerms) {
        html += `<div><strong>Warunki płatności:</strong> ${paymentTerms}</div>`;
    }
    if (validity) {
        // Przeniesiono do górnej części, więc tutaj pomijamy
        // html += `<div><strong>Data ważności oferty:</strong> ${validity}</div>`;
    }
    html += `</div>`;

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

    const template = await getTemplate('templates/oferta_studnie.html');
    if (!template) return null;

    // Dane oferty
    const offerNumber = document.getElementById('offer-number')?.value || '—';
    const offerDate =
        document.getElementById('offer-date')?.value || new Date().toISOString().slice(0, 10);
    const notes = document.getElementById('offer-notes')?.value?.trim() || '';
    const paymentTerms = document.getElementById('offer-payment-terms')?.value?.trim() || '';
    const validity = document.getElementById('offer-validity')?.value?.trim() || '';

    // Transport
    const { map: transportMap, totalTransportCost } = calculateWellTransportMap(wells);

    // Grupy po średnicach
    const groups = groupWellsByDiameter(wells);

    // Budowanie tabel
    let tablesHtml = '';
    let currentLp = 1;
    const summaries = [];

    groups.forEach((groupWells, dn) => {
        const result = buildDiameterTableHtml(dn, groupWells, currentLp, transportMap);
        tablesHtml += result.html;
        currentLp = result.nextLp;

        const label = dn === 'styczna' ? 'Studnie styczne' : `Studnie DN${dn}`;
        summaries.push({ label, count: result.count, totalPrice: result.totalPrice });
    });

    // Suma netto (produkty + transport wliczony do cen studni)
    const totalNettoAll = summaries.reduce((s, x) => s + x.totalPrice, 0);

    // Podsumowanie
    const summaryHtml = buildOfferSummaryHtml(summaries, totalNettoAll);

    // Uwagi / warunki
    const notesHtml = buildOfferNotesHtml(notes, paymentTerms, validity);

    // Fetch contact details for offer author and assignee (opiekun)
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
 * Pokazuje modal wyboru formatu eksportu oferty
 */
window.showOfferExportChoice = function() {
    const modalHtml = `
    <div id="offer-export-modal" style="position: fixed; top: 0; left: 0; width: 100vw; height: 100vh; background: rgba(0,0,0,0.6); display: flex; justify-content: center; align-items: center; z-index: 10000; backdrop-filter: blur(4px);">
        <div style="background: #1e293b; border: 1px solid #334155; border-radius: 12px; width: 350px; padding: 1.5rem; text-align: center; box-shadow: 0 10px 25px rgba(0,0,0,0.5);">
            <h3 style="margin: 0 0 0.5rem 0; font-size: 1.1rem; color: #fff; font-weight: 700;">Wydruk Oferty</h3>
            <p style="font-size: 0.8rem; color: #cbd5e1; margin-bottom: 1.5rem;">Do jakiego formatu chcesz wyeksportować tę ofertę?</p>
            <div style="display: flex; gap: 1rem; justify-content: center; margin-bottom: 1.5rem;">
                <button onclick="exportOfferToPDF_action()" style="flex: 1; background: rgba(239,68,68,0.2); color: #fca5a5; border: 2px solid rgba(239,68,68,0.6); padding: 1rem; border-radius: 10px; cursor: pointer; font-weight: 800; display: flex; flex-direction: column; align-items: center; gap: 0.4rem; transition: all 0.2s;" onmouseenter="this.style.background='rgba(239,68,68,0.4)'" onmouseleave="this.style.background='rgba(239,68,68,0.2)'">
                    <span style="font-size: 2rem;"><i data-lucide="file-text"></i></span> PDF
                </button>
                <button onclick="exportOfferToWord_action()" style="flex: 1; background: rgba(59,130,246,0.2); color: #93c5fd; border: 2px solid rgba(59,130,246,0.6); padding: 1rem; border-radius: 10px; cursor: pointer; font-weight: 800; display: flex; flex-direction: column; align-items: center; gap: 0.4rem; transition: all 0.2s;" onmouseenter="this.style.background='rgba(59,130,246,0.4)'" onmouseleave="this.style.background='rgba(59,130,246,0.2)'">
                    <span style="font-size: 2rem;"><i data-lucide="edit"></i></span> Word
                </button>
            </div>
            <button style="padding: 0.5rem 1rem; border-radius: 6px; background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.1); color: var(--text-muted); cursor: pointer;" onclick="document.getElementById('offer-export-modal').remove()">Anuluj</button>
        </div>
    </div>
    `;
    document.body.insertAdjacentHTML('beforeend', modalHtml);
    if(typeof lucide !== 'undefined') lucide.createIcons();
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

