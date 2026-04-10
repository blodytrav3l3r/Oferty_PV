/* ===== OFFER SUMMARY ===== */
function renderOfferSummary() {
    const container = document.getElementById('offer-summary-body');
    if (!container) return;

    // Check for order changes dynamically against current wells in memory
    const order = getCurrentOfferOrder();
    const orderChanges = order ? getOrderChanges({ ...order, wells: wells }) : {};
    const hasChanges = Object.keys(orderChanges).length > 0;

    let totalPrice = 0, totalWeight = 0;

    let html = '';

    // Order status banner
    if (order) {
        const changeCount = Object.keys(orderChanges).length;
        html += `<div style="display:flex; align-items:center; justify-content:space-between; padding:0.5rem 0.8rem; margin-bottom:0.5rem; background:${hasChanges ? 'rgba(239,68,68,0.1)' : 'rgba(16,185,129,0.1)'}; border:1px solid ${hasChanges ? 'rgba(239,68,68,0.3)' : 'rgba(16,185,129,0.3)'}; border-radius:8px;">
            <div style="display:flex; align-items:center; gap:0.4rem;">
                <span style="font-size:1.1rem;">📦</span>
                <span style="font-size:0.75rem; font-weight:700; color:${hasChanges ? '#f87171' : '#34d399'};">ZAMÓWIENIE ${hasChanges ? '— ' + changeCount + ' studni zmienionych' : '— bez zmian'}</span>
            </div>
            <button class="btn btn-sm" style="background:rgba(16,185,129,0.15); border:1px solid rgba(16,185,129,0.3); color:#34d399; font-size:0.65rem; padding:0.15rem 0.4rem;" onclick="orderEditMode ? saveCurrentOrder() : saveOrderStudnie()">📦 Zapisz zamówienie</button>
        </div>`;
    }

    // Pre-calculate global transport cost
    let globalWeight = 0;
    wells.forEach(w => globalWeight += calcWellStats(w).weight);

    const transportKm = parseFloat(document.getElementById('transport-km')?.value) || 0;
    const transportRate = parseFloat(document.getElementById('transport-rate')?.value) || 0;
    let totalTransportCost = 0;
    let totalTransports = 0;
    let transportCostPerTrip = 0;

    if (transportKm > 0 && transportRate > 0) {
        totalTransports = Math.ceil(globalWeight / 24000);
        transportCostPerTrip = transportKm * transportRate;
        totalTransportCost = totalTransports * transportCostPerTrip;
    }

    html += `<div class="table-wrap">
    <table style="table-layout:fixed; width:100%;">
      <thead>
        <tr>
          <th style="width:5%;">Lp.</th>
          <th style="width:18%;">Nazwa studni</th>
          <th style="width:8%;">DN</th>
          <th style="width:8%;">Elementy</th>
          <th class="text-right" style="width:12%;">Waga</th>
          <th class="text-right" style="width:10%;">Wys.</th>
          <th class="text-right" style="width:12%;">Pow. wewn.</th>
          <th class="text-right" style="width:12%;">Pow. zewn.</th>
          <th class="text-right" style="width:15%;">Cena netto</th>
        </tr>
      </thead>
      <tbody>`;

    wells.forEach((well, i) => {
        const stats = calcWellStats(well);
        totalWeight += stats.weight;

        // Koszt transportu przypisany do tej studni proporcjonalnie do jej wagi
        const wellTransportCost = globalWeight > 0 ? totalTransportCost * (stats.weight / globalWeight) : 0;

        // Zwiększamy statystykę ceny o koszt transportu (aby kwota brutto na pasku zamówienia i rubryki się zgadzały)
        stats.price += wellTransportCost;
        totalPrice += stats.price;

        const wc = orderChanges[i];
        const isChanged = !!wc;
        const rowStyle = isChanged
            ? (wc.type === 'added' ? 'border-left:3px solid #34d399; background:rgba(16,185,129,0.05);' : 'border-left:3px solid #ef4444; background:rgba(239,68,68,0.05);')
            : '';
        const changeBadge = isChanged
            ? (wc.type === 'added'
                ? '<span style="font-size:0.55rem; padding:1px 5px; border-radius:3px; background:rgba(16,185,129,0.2); color:#34d399; font-weight:700; margin-left:0.3rem;">🟢 NOWE</span>'
                : '<span style="font-size:0.55rem; padding:1px 5px; border-radius:3px; background:rgba(239,68,68,0.2); color:#f87171; font-weight:700; margin-left:0.3rem;">🔴 ZMIENIONO</span>')
            : '';

        html += `<tr style="cursor:pointer; ${rowStyle}" onclick="showSection('builder'); selectWell(${i})">
      <td>${i + 1}</td>
      <td style="font-weight:600; color:var(--text-primary);">${well.name}${changeBadge}</td>
      <td>DN${well.dn}</td>
      <td>${(well.config || []).length}</td>
      <td class="text-right">${fmtInt(stats.weight)} kg</td>
      <td class="text-right">${fmtInt(stats.height)} mm</td>
      <td class="text-right">${fmt(stats.areaInt)} m²</td>
      <td class="text-right">${fmt(stats.areaExt)} m²</td>
      <td class="text-right" style="font-weight:700; color:var(--success);">${fmtInt(stats.price)} PLN</td>
    </tr>`;

        const rzDna = parseFloat(well.rzednaDna) || 0;
        const configMap = [];
        let currY = 0;
        let dennicaProcessedCount = 0;
        for (let j = well.config.length - 1; j >= 0; j--) {
            const item = well.config[j];
            const p = studnieProducts.find(pr => pr.id === item.productId);
            if (!p) continue;

            let h = 0;
            if (p.componentType === 'dennica') {
                for (let q = 0; q < item.quantity; q++) {
                    dennicaProcessedCount++;
                    h += (p.height || 0) - (dennicaProcessedCount > 1 ? 100 : 0);
                }
            } else {
                h = (p.height || 0) * item.quantity;
            }

            configMap.push({ index: j, start: currY, end: currY + h });
            currY += h;
        }

        const assignedPrzejscia = {};
        if (well.przejscia) {
            well.przejscia.forEach(pr => {
                let pel = parseFloat(pr.rzednaWlaczenia);
                if (isNaN(pel)) pel = rzDna;
                const mmFromBottom = (pel - rzDna) * 1000;

                let assignedIndex = -1;
                for (let cm of configMap) {
                    if (mmFromBottom >= cm.start && mmFromBottom < cm.end) {
                        assignedIndex = cm.index;
                        break;
                    }
                }
                if (assignedIndex === -1 && well.config.length > 0) assignedIndex = well.config.length - 1;

                if (!assignedPrzejscia[assignedIndex]) assignedPrzejscia[assignedIndex] = [];
                assignedPrzejscia[assignedIndex].push(pr);
            });
        }

        const disc = wellDiscounts[well.dn] || { dennica: 0, nadbudowa: 0 };
        const nadbudowaMult = 1 - ((disc.nadbudowa || 0) / 100);

        // Component details
        well.config.forEach((item, index) => {
            const p = studnieProducts.find(pr => pr.id === item.productId);
            if (!p) return;
            if (p.componentType === 'kineta') return; // Wyświetlana jako podpunkt pod dennicą

            let discStr = '';
            if (p.componentType === 'dennica' || p.componentType === 'kineta' || p.componentType === 'styczna') {
                if (disc.dennica > 0) discStr = ` <span style="font-size:0.6rem; color:#10b981; margin-left:0.3rem;">(-${disc.dennica}%)</span>`;
            } else {
                if (disc.nadbudowa > 0) discStr = ` <span style="font-size:0.6rem; color:#10b981; margin-left:0.3rem;">(-${disc.nadbudowa}%)</span>`;
            }

            const itemPrice = getItemAssessedPrice(well, p, true);
            let totalLinePrice = itemPrice * item.quantity;

            if (p.componentType === 'dennica' || p.componentType === 'styczna') {
                const kinetaItem = well.config.find(c => {
                    const pr = studnieProducts.find(x => x.id === c.productId);
                    return pr && pr.componentType === 'kineta';
                });
                if (kinetaItem) {
                    const kinetaProd = studnieProducts.find(x => x.id === kinetaItem.productId);
                    if (kinetaProd) {
                        const rawKinetaPrice = getItemAssessedPrice(well, kinetaProd, true);
                        totalLinePrice += rawKinetaPrice * (kinetaItem.quantity || 1);
                    }
                }
                // Dodaj też część kosztu transportu studni do dennicy / bazy stycznej
                totalLinePrice += wellTransportCost;
            }
            let totalLineWeight = (p.weight || 0) * item.quantity;

            const itemPrzejscia = assignedPrzejscia[index] || [];
            itemPrzejscia.forEach(pr => {
                const prProd = studnieProducts.find(x => x.id === pr.productId);
                if (prProd) {
                    totalLinePrice += (prProd.price || 0) * nadbudowaMult;
                    totalLineWeight += (prProd.weight || 0);
                }
            });

            const isDennicaOrStyczna = (p.componentType === 'dennica' || p.componentType === 'styczna');
            if (isDennicaOrStyczna && well.doplata) {
                totalLinePrice += well.doplata;
            }

            html += `<tr style="opacity:0.6; ${isChanged && wc.type === 'modified' && wc.fields?.includes('config') ? 'color:#f87171;' : ''}">
        <td></td>
        <td colspan="2" style="padding-left:1.5rem; font-size:0.78rem; ${isChanged && wc.type === 'modified' && wc.fields?.includes('config') ? 'color:#f87171;' : 'color:var(--text-muted);'}">↳ ${p.name}${discStr}</td>
        <td class="ui-text-lg">${item.quantity} szt.</td>
        <td class="text-right" class="ui-text-lg">${fmtInt(totalLineWeight)} kg</td>
        <td class="text-right" class="ui-text-lg">${p.height ? fmtInt(p.height) + ' mm' : '—'}</td>
        <td class="text-right" class="ui-text-lg">${p.area ? fmt(p.area * item.quantity) : '—'}</td>
        <td class="text-right" class="ui-text-lg">${p.areaExt ? fmt(p.areaExt * item.quantity) : '—'}</td>
        <td class="text-right" class="ui-text-lg">${p.componentType === 'kineta' ? 'wliczone (' + fmtInt(totalLinePrice) + ' PLN)' : fmtInt(totalLinePrice) + ' PLN'}</td>
      </tr>`;

            if (isDennicaOrStyczna && well.doplata) {
                const doplataColor = well.doplata < 0 ? '#ef4444' : '#10b981';
                html += `<tr style="opacity:0.6; color:${doplataColor};">
                    <td></td>
                    <td colspan="2" style="padding-left:2.5rem; font-size:0.72rem;">↳ + Dopłata</td>
                    <td class="ui-text-sm">1 skmpl.</td>
                    <td class="text-right" class="ui-text-sm">—</td>
                    <td class="text-right" class="ui-text-sm">—</td>
                    <td class="text-right" class="ui-text-sm">—</td>
                    <td class="text-right" class="ui-text-sm">—</td>
                    <td class="text-right" class="ui-text-sm">wliczone (${fmtInt(well.doplata)} PLN)</td>
                </tr>`;
            }

            itemPrzejscia.forEach(pr => {
                const prProd = studnieProducts.find(x => x.id === pr.productId);
                if (!prProd) return;

                let pDiscStr = '';
                if (disc.nadbudowa > 0) pDiscStr = ` <span style="font-size:0.6rem; color:#10b981; margin-left:0.3rem;">(-${disc.nadbudowa}%)</span>`;

                const prPriceDoliczane = (prProd.price || 0) * nadbudowaMult;

                html += `<tr style="opacity:0.6; ${isChanged && wc.type === 'modified' && wc.fields?.includes('przejscia') ? 'color:#f87171;' : 'color:#818cf8;'}">
                    <td></td>
                    <td colspan="2" style="padding-left:2.5rem; font-size:0.72rem;">↳ + Przejście szczelne: ${prProd.category} ${typeof prProd.dn === 'string' && prProd.dn.includes('/') ? prProd.dn : 'DN' + prProd.dn} (${pr.angle}°)${pDiscStr}</td>
                    <td class="ui-text-sm">1 szt.</td>
                    <td class="text-right" class="ui-text-sm">wliczone (${fmtInt(prProd.weight || 0)} kg)</td>
                    <td class="text-right" class="ui-text-sm">—</td>
                    <td class="text-right" class="ui-text-sm">—</td>
                    <td class="text-right" class="ui-text-sm">—</td>
                    <td class="text-right" class="ui-text-sm">wliczone (${fmtInt(prPriceDoliczane)} PLN)</td>
                </tr>`;
            });

            // Podpunkt dla kinety, jeśli renderujemy dennicę / bazę styczną
            if (p.componentType === 'dennica' || p.componentType === 'styczna') {
                const kinetaItem = well.config.find(c => {
                    const pr = studnieProducts.find(x => x.id === c.productId);
                    return pr && pr.componentType === 'kineta';
                });
                if (kinetaItem) {
                    const kinetaProd = studnieProducts.find(x => x.id === kinetaItem.productId);
                    if (kinetaProd) {
                        let kDiscStr = '';
                        if (disc.dennica > 0) kDiscStr = ` <span style="font-size:0.6rem; color:#10b981; margin-left:0.3rem;">(-${disc.dennica}%)</span>`;

                        const kPriceDoliczane = getItemAssessedPrice(well, kinetaProd, true) * (kinetaItem.quantity || 1);
                        const kWeight = (kinetaProd.weight || 0) * kinetaItem.quantity;

                        html += `<tr style="opacity:0.6; ${isChanged && wc.type === 'modified' && wc.fields?.includes('config') ? 'color:#f87171;' : 'color:#f472b6;'}">
                            <td></td>
                            <td colspan="2" style="padding-left:2.5rem; font-size:0.72rem;">↳ + ${kinetaProd.name}${kDiscStr}</td>
                            <td class="ui-text-sm">${kinetaItem.quantity} szt.</td>
                            <td class="text-right" class="ui-text-sm">${kWeight > 0 ? fmtInt(kWeight) + ' kg' : 'wliczone (0 kg)'}</td>
                            <td class="text-right" class="ui-text-sm">—</td>
                            <td class="text-right" class="ui-text-sm">—</td>
                            <td class="text-right" class="ui-text-sm">—</td>
                            <td class="text-right" class="ui-text-sm">wliczone (${fmtInt(kPriceDoliczane)} PLN)</td>
                        </tr>`;
                    }
                }

                // Dodaj wiersz "Transport" pod dennicą / bazą styczną, jeśli istnieje koszt
                if (wellTransportCost > 0) {
                    html += `<tr style="opacity:0.6; color:#a855f7;">
                        <td></td>
                        <td colspan="2" style="padding-left:2.5rem; font-size:0.72rem;">↳ 🚚 Koszt transportu</td>
                        <td class="ui-text-sm">1 skmpl.</td>
                        <td class="text-right" class="ui-text-sm">—</td>
                        <td class="text-right" class="ui-text-sm">—</td>
                        <td class="text-right" class="ui-text-sm">—</td>
                        <td class="text-right" class="ui-text-sm">—</td>
                        <td class="text-right" class="ui-text-sm">wliczone (${fmtInt(wellTransportCost)} PLN)</td>
                    </tr>`;
                }
            }
        });

    });

    html += `</tbody>
      <tfoot>
        <tr style="border-top:2px solid var(--border-glass);">
          <td colspan="4" style="font-weight:700; font-size:0.95rem; color:var(--text-primary);">RAZEM (${wells.length} studni)</td>
          <td class="text-right" style="font-weight:700;">${fmtInt(totalWeight)} kg</td>
          <td></td><td></td><td></td>
          <td class="text-right" style="font-weight:800; font-size:1.1rem; color:var(--success);">${fmtInt(totalPrice)} PLN</td>
        </tr>
      </tfoot>
    </table></div>`;

    container.innerHTML = html;

    // Update offer totals
    const totalEl = document.getElementById('sum-total-netto');
    const bruttoEl = document.getElementById('sum-brutto-details');
    const weightEl = document.getElementById('sum-netto-weight');
    const transCostEl = document.getElementById('sum-transport-cost');

    // Transport UI indicators
    if (totalTransportCost > 0) {
        if (transCostEl) transCostEl.textContent = fmtInt(totalTransportCost) + ' PLN';

        const transDetails = document.getElementById('transport-breakdown');
        if (transDetails) {
            transDetails.innerHTML = `<div style="font-size:0.8rem; color:var(--text-muted); background:rgba(15,23,42,0.4); padding:0.8rem; border-radius:8px; border:1px solid rgba(255,255,245,0.05); margin-bottom:1rem;">
             🛣️ Łączny ciężar to <strong>${fmtInt(totalWeight)} kg</strong> co wymaga ok. <strong>${totalTransports} transportów</strong>. 
             Koszt jednego kursu: <strong>${fmtInt(transportCostPerTrip)} PLN</strong>. Łącznie transport: <strong>${fmtInt(totalTransportCost)} PLN</strong> (koszt rozbity na poszczególne studnie w tabeli wyżej).
           </div>`;
        }
    } else {
        if (transCostEl) transCostEl.textContent = '0 PLN';
        const transDetails = document.getElementById('transport-breakdown');
        if (transDetails) transDetails.innerHTML = '';
    }

    // Transport jest już wliczony w totalPrice podczas pętli studni
    const finalNetto = totalPrice;

    if (totalEl) totalEl.textContent = fmtInt(finalNetto) + ' PLN';
    if (bruttoEl) bruttoEl.textContent = 'Brutto: ' + fmtInt(finalNetto * 1.23) + ' PLN';
    if (weightEl) weightEl.textContent = fmtInt(totalWeight) + ' kg';
}



/* ===== OFFERS STUDNIE (SERVER API) ===== */

/**
 * Normalizes an offer object by flattening .data properties to the top level.
 * This is needed because the backend stores nested data in a JSON blob,
 * but the UI expects flat fields like offer.wells, offer.clientName, etc.
 */
function normalizeOfferData(doc) {
    if (!doc) return doc;
    if (doc.data && typeof doc.data === 'object' && !Array.isArray(doc.data)) {
        const fields = [
            'items', 'wells', 'totalNetto', 'totalBrutto', 'number', 'clientName',
            'clientNip', 'clientAddress', 'clientContact', 'clientPhone',
            'investName', 'investAddress', 'investContractor', 'notes', 'paymentTerms', 'validity',
            'transportKm', 'transportRate', 'wellDiscounts', 'visiblePrzejsciaTypes',
            'date', 'history', 'userName', 'lastEditedBy', 'createdByUserId', 'createdByUserName', 'userId'
        ];
        for (const key of fields) {
            const val = doc.data[key];
            if (val !== undefined && val !== null && (doc[key] === undefined || doc[key] === null)) {
                doc[key] = val;
            }
        }
        // Fallback mappings for alternative field names
        if (!doc.number && doc.data.offerNumber) doc.number = doc.data.offerNumber;
        if (!doc.date && doc.data.offerDate) doc.date = doc.data.offerDate;
        if (!doc.totalNetto && doc.data.summary && doc.data.summary.totalValue) doc.totalNetto = doc.data.summary.totalValue;
        if (!doc.totalBrutto && doc.data.summary && doc.data.summary.totalBrutto) doc.totalBrutto = doc.data.summary.totalBrutto;
    }
    return doc;
}

async function loadOffersStudnie() {
    try {
        const res = await fetch('/api/offers-studnie', { headers: authHeaders() });
        const json = await res.json();
        const rawOffers = json.data || [];
        // Normalize each offer to flatten .data properties (number, date, wells, etc.)
        return rawOffers.map(o => normalizeOfferData(o));
    } catch (e) {
        console.error('Błąd ładowania ofert:', e);
        return [];
    }
}

async function saveOffersDataStudnie(data) {
    // This function is no longer used as offers are saved individually via saveOfferStudnie
    // and fetched via loadOffersStudnie which now directly uses the REST API.
}



/* ===== OFFER SUMMARY (Studnie) ===== */
let editingOfferAssignedUserId = null;
let editingOfferAssignedUserName = '';
let editingOfferCreatedByUserId = null;
let editingOfferCreatedByUserName = '';

async function changeOfferUser() {
    if (!currentUser || (currentUser.role !== 'admin' && currentUser.role !== 'pro')) {
        showToast('Brak uprawnień do zmiany opiekuna', 'error');
        return;
    }
    try {
        const usersResp = await fetch('/api/users-for-assignment', { headers: authHeaders() });
        const usersData = await usersResp.json();
        const allUsers = usersData.data || [];

        if (allUsers.length > 0) {
            const currentId = editingOfferAssignedUserId || currentUser.id;
            const selectedUser = await showUserSelectionPopup(allUsers, currentId);
            if (selectedUser !== null) {
                editingOfferAssignedUserId = selectedUser.id;
                editingOfferAssignedUserName = (selectedUser.firstName && selectedUser.lastName)
                    ? `${selectedUser.firstName} ${selectedUser.lastName}`
                    : (selectedUser.displayName || selectedUser.username);
                showToast(`Opiekun zmieniony na: ${editingOfferAssignedUserName}`, 'success');
                
                const btnChangeUser = document.getElementById('btn-change-offer-user');
                if (btnChangeUser) btnChangeUser.textContent = `👤 Opiekun: ${editingOfferAssignedUserName}`;

                if (editingOfferIdStudnie) {
                    saveOfferStudnie();

                    // Propagate opiekun change to associated order
                    const oId = normalizeId(editingOfferIdStudnie);
                    const linkedOrder = ordersStudnie ? ordersStudnie.find(o => normalizeId(o.offerId) === oId) : null;
                    if (linkedOrder) {
                        linkedOrder.userId = editingOfferAssignedUserId;
                        linkedOrder.userName = editingOfferAssignedUserName;
                        fetch(`/api/orders-studnie/${linkedOrder.id}`, {
                            method: 'PATCH',
                            headers: authHeaders(),
                            body: JSON.stringify({ userId: linkedOrder.userId, userName: linkedOrder.userName })
                        }).catch(e => console.error('Błąd aktualizacji opiekuna w zamówieniu:', e));
                    }
                }
            }
        }
    } catch (e) {
        console.error('Błąd pobierania użytkowników:', e);
        showToast('Błąd pobierania listy użytkowników', 'error');
    }
}

async function changeOfferUserFromListStudnie(offerId) {
    if (!currentUser || (currentUser.role !== 'admin' && currentUser.role !== 'pro')) {
        showToast('Brak uprawnień do zmiany opiekuna', 'error');
        return;
    }
    const offer = offersStudnie.find(o => o.id === offerId);
    if (!offer) {
        showToast('Nie znaleziono oferty', 'error');
        return;
    }
    
    try {
        const usersResp = await fetch('/api/users-for-assignment', { headers: authHeaders() });
        const usersData = await usersResp.json();
        const allUsers = usersData.data || [];

        if (allUsers.length > 0) {
            const currentId = offer.userId || currentUser.id;
            const selectedUser = await showUserSelectionPopup(allUsers, currentId);
            if (selectedUser !== null) {
                offer.userId = selectedUser.id;
                offer.userName = (selectedUser.firstName && selectedUser.lastName)
                    ? `${selectedUser.firstName} ${selectedUser.lastName}`
                    : (selectedUser.displayName || selectedUser.username);
                
                const { storageService } = await import('../shared/StorageService.js');
                await storageService.saveOffer(offer);
                
                // Propagate opiekun change to associated order
                const oId = normalizeId(offerId);
                const linkedOrder = ordersStudnie ? ordersStudnie.find(o => normalizeId(o.offerId) === oId) : null;
                if (linkedOrder) {
                    linkedOrder.userId = offer.userId;
                    linkedOrder.userName = offer.userName;
                    fetch(`/api/orders-studnie/${linkedOrder.id}`, {
                        method: 'PATCH',
                        headers: authHeaders(),
                        body: JSON.stringify({ userId: linkedOrder.userId, userName: linkedOrder.userName })
                    }).catch(e => console.error('Błąd aktualizacji opiekuna w zamówieniu:', e));
                }

                showToast(`Opiekun zmieniony na: ${offer.userName}`, 'success');
                renderSavedOffersStudnie();
                
                if (editingOfferIdStudnie === offerId) {
                    editingOfferAssignedUserId = offer.userId;
                    editingOfferAssignedUserName = offer.userName;
                    const btnChangeUser = document.getElementById('btn-change-offer-user');
                    if (btnChangeUser) btnChangeUser.textContent = `👤 Opiekun: ${offer.userName}`;
                }
            }
        }
    } catch (e) {
        console.error('Błąd zmiany opiekuna z listy:', e);
        showToast('Wystąpił błąd przy zmianie opiekuna', 'error');
    }
}

async function saveOfferStudnie() {
    if (isSavingOffer) return false;
    
    if (isOfferLocked()) { showToast(OFFER_LOCKED_MSG, 'error'); return false; }
    const number = document.getElementById('offer-number').value.trim();
    if (!number) { showToast('Wprowadź numer oferty', 'error'); return false; }

    const date = document.getElementById('offer-date').value;
    const clientName = document.getElementById('client-name').value.trim();
    const clientNip = document.getElementById('client-nip').value.trim();
    const clientAddress = document.getElementById('client-address').value.trim();
    const clientContact = document.getElementById('client-contact').value.trim();
    const investName = document.getElementById('invest-name').value.trim();
    const investAddress = document.getElementById('invest-address').value.trim();
    const investContractor = document.getElementById('invest-contractor').value.trim();
    const notes = document.getElementById('offer-notes').value.trim();
    const paymentTerms = document.getElementById('offer-payment-terms')?.value.trim() || 'Do uzgodnienia lub według indywidualnych warunków handlowych.';
    const validity = document.getElementById('offer-validity')?.value.trim() || '7 dni';
    const transportKm = parseFloat(document.getElementById('transport-km').value) || 0;
    const transportRate = parseFloat(document.getElementById('transport-rate').value) || 0;

    let totalNetto = 0;
    let totalWeight = 0;
    wells.forEach(well => {
        const stats = calcWellStats(well);
        totalNetto += stats.price;
        totalWeight += stats.weight;
    });

    // --- TELEMETRIA: Pętla Sprzężenia Zwrotnego ---
    // Znajdź pierwszą studnię która została zmieniona z AUTO_AI na MANUAL i nie ma zapisanego powodu
    const unjustifiedWell = wells.find(w => w.configSource === 'MANUAL' && w.originalAutoConfig && !w.overrideReason);
    
    if (unjustifiedWell) {
        // Pokaż popup i ZATRZYMAJ proces zapisu
        return showTelemetryPopup(unjustifiedWell, async (reason) => {
            unjustifiedWell.overrideReason = reason;

            // Wyślij log telemetryczny na CITO w tle do nowej tabeli SQLite
            try {
                await fetch('/api/telemetry/override', {
                    method: 'POST',
                    headers: authHeaders(),
                    body: JSON.stringify({
                        originalConfig: unjustifiedWell.originalAutoConfig,
                        finalConfig: unjustifiedWell.config,
                        overrideReason: reason
                    })
                });
            } catch (e) { console.error('Błąd wysyłki telemetrii:', e); }

            // Wznów zapis
            saveOfferStudnie();
        });
    }
    // --- KONIEC TELEMETRII ---

    isSavingOffer = true;

    // Automatyczny wybór opiekuna dla nowych ofert (tylko admin / pro)
    if (!editingOfferIdStudnie && currentUser && (currentUser.role === 'admin' || currentUser.role === 'pro') && !editingOfferAssignedUserId) {
        try {
            const usersResp = await fetch('/api/users-for-assignment', { headers: authHeaders() });
            const usersData = await usersResp.json();
            const allUsers = usersData.data || [];

            if (allUsers.length > 0) {
                const currentId = currentUser.id;
                const selectedUser = await showUserSelectionPopup(allUsers, currentId);
                if (selectedUser === null) {
                    showToast('Anulowano zapis oferty - brak wybranego opiekuna', 'info');
                    isSavingOffer = false;
                    return false;
                }
                editingOfferAssignedUserId = selectedUser.id;
                editingOfferAssignedUserName = selectedUser.displayName || selectedUser.username;
                
                const btnChangeUser = document.getElementById('btn-change-offer-user');
                if (btnChangeUser) btnChangeUser.textContent = `👤 Opiekun: ${editingOfferAssignedUserName}`;
            }
        } catch (e) {
            console.error('Błąd wyboru opiekuna:', e);
        }
    }

    const { storageService } = await import('../shared/StorageService.js');

    let existingDoc = null;
    if (editingOfferIdStudnie) {
        try {
            existingDoc = await storageService.getOfferById(editingOfferIdStudnie);
        } catch (e) { }
    }

    const simpleId = editingOfferIdStudnie || ('offer_studnie_' + Date.now());

    // Oblicz koszty transportu per studnia
    let globalWeightForTransport = 0;
    wells.forEach(w => globalWeightForTransport += calcWellStats(w).weight);
    const transportKmVal = parseFloat(document.getElementById('transport-km').value) || 0;
    const transportRateVal = parseFloat(document.getElementById('transport-rate').value) || 0;
    let totalTransportCostForOffer = 0;
    if (transportKmVal > 0 && transportRateVal > 0) {
        const totalTransportsCount = Math.ceil(globalWeightForTransport / 24000);
        const costPerTrip = transportKmVal * transportRateVal;
        totalTransportCostForOffer = totalTransportsCount * costPerTrip;
    }

    // Przygotuj wells z obliczonymi cenami dla backendu (PDF/Word export)
    const wellsForExport = wells.map(well => {
        const stats = calcWellStats(well);
        const wellTransportCost = globalWeightForTransport > 0 ? totalTransportCostForOffer * (stats.weight / globalWeightForTransport) : 0;
        const zwienczenie = (typeof getWellZwienczenieName === 'function') ? getWellZwienczenieName(well) : '—';
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

    const offerDoc = {
        id: simpleId,
        type: 'studnia_oferta',
        userId: editingOfferAssignedUserId || existingDoc?.userId || (currentUser ? currentUser.id : null),
        userName: editingOfferAssignedUserName || existingDoc?.userName || (currentUser ? (currentUser.firstName && currentUser.lastName ? `${currentUser.firstName} ${currentUser.lastName}` : currentUser.username) : ''),
        createdByUserId: editingOfferCreatedByUserId || existingDoc?.createdByUserId || (currentUser ? currentUser.id : null),
        createdByUserName: editingOfferCreatedByUserName || existingDoc?.createdByUserName || (currentUser ? (currentUser.firstName && currentUser.lastName ? `${currentUser.firstName} ${currentUser.lastName}` : currentUser.username) : ''),
        number, date, clientName, clientNip, clientAddress, clientContact, investName, investAddress, investContractor, notes, paymentTerms, validity,
        wells: JSON.parse(JSON.stringify(wells)),
        wellsExport: wellsForExport,
        visiblePrzejsciaTypes: Array.from(visiblePrzejsciaTypes),
        transportKm,
        transportRate,
        wellDiscounts: typeof wellDiscounts !== 'undefined' ? JSON.parse(JSON.stringify(wellDiscounts || {})) : {},
        totalWeight,
        totalNetto,
        totalBrutto: totalNetto * 1.23,
        createdAt: existingDoc?.createdAt || new Date().toISOString(),
        lastEditedBy: currentUser ? (currentUser.firstName && currentUser.lastName ? `${currentUser.firstName} ${currentUser.lastName}` : currentUser.username) : ''
    };

    try {
        if (!offerDoc.wells || offerDoc.wells.length === 0) {
            showToast('Błąd: Nie można zapisać pustej oferty.', 'error');
            return;
        }
        const result = await storageService.saveOffer(offerDoc);
        showToast('Oferta zapisana ✔', 'success');
        const savedId = result.id || offerDoc.id;
        editingOfferIdStudnie = savedId;

        // Update local array for immediate rendering using the confirmed ID
        const idx = offersStudnie.findIndex(o => o.id === editingOfferIdStudnie);
        let updatedOffer = { ...offerDoc, id: editingOfferIdStudnie };
        
        if (idx >= 0) offersStudnie[idx] = updatedOffer;
        else offersStudnie.push(updatedOffer);

        renderSavedOffersStudnie();
        return true;
    } catch (err) {
        console.error('[OfferManager] Save error:', err);
        showToast('Błąd zapisu oferty', 'error');
        return false;
    } finally {
        isSavingOffer = false;
    }
}

function showTelemetryPopup(well, callback) {
    const overlay = document.createElement('div');
    overlay.className = 'modal-overlay';
    overlay.style.zIndex = '99999';
    overlay.innerHTML = `
    <div class="modal" style="max-width:500px; padding:1.5rem;">
        <h3 style="color:#f59e0b; font-weight:700; margin-bottom:0.5rem;">🤖 Pętla Sprzężenia AI</h3>
        <p style="font-size:0.85rem; color:var(--text-muted); margin-bottom:1.5rem;">
            Zauważyliśmy, że w studni <strong>${well.name}</strong> odrzuciłeś autokonfigurację wygenerowaną przez system i ręcznie ułożyłeś własne elementy.
            <br/><br/>
            Wybierz powód z listy, by pomóc algorytmowi uczyć się na Twoim doświadczeniu!
        </p>
        <div style="margin-bottom:1.5rem;">
            <select id="telemetry-reason" class="ui-input" style="width:100%; font-size:0.9rem;">
                <option value="Błąd algorytmu - kolizja łączeń itp." selected>Błąd algorytmu - kolizja łączeń itp.</option>
                <option value="Optymalizacja pod względem produkcji">Optymalizacja pod względem produkcji</option>
                <option value="Optymalizacja wysokości dennicy">Optymalizacja wysokości dennicy</option>
                <option value="Inne powody własne">Inne powody własne</option>
            </select>
        </div>
        <div style="display:flex; justify-content:flex-end; gap:0.5rem;">
            <button class="btn btn-primary" id="btn-telemetry-confirm">Wyślij powód i zapisz dokument</button>
        </div>
    </div>`;

    document.body.appendChild(overlay);

    document.getElementById('btn-telemetry-confirm').onclick = () => {
        const r = document.getElementById('telemetry-reason').value;
        overlay.remove();
        callback(r);
    };
}

function clearOfferForm() {
    editingOfferIdStudnie = null;
    editingOfferAssignedUserId = null;
    editingOfferAssignedUserName = '';
    editingOfferCreatedByUserId = null;
    editingOfferCreatedByUserName = '';
    document.getElementById('offer-number').value = generateOfferNumberStudnie();
    document.getElementById('offer-date').value = new Date().toISOString().slice(0, 10);
    document.getElementById('client-name').value = '';
    document.getElementById('client-nip').value = '';
    document.getElementById('client-address').value = '';
    document.getElementById('client-contact').value = '';
    document.getElementById('invest-name').value = '';
    document.getElementById('invest-address').value = '';
    document.getElementById('invest-contractor').value = '';
    document.getElementById('offer-notes').value = '';
    if (document.getElementById('offer-payment-terms')) document.getElementById('offer-payment-terms').value = 'Do uzgodnienia lub według indywidualnych warunków handlowych.';
    if (document.getElementById('offer-validity')) document.getElementById('offer-validity').value = '7 dni';
    document.getElementById('transport-km').value = '100';
    document.getElementById('transport-rate').value = '10';
    wells = [];
    wellCounter = 1;
    currentWellIndex = 0;
    wellDiscounts = {}; // Reset rabatów

    offerDefaultZakonczenie = null;
    offerDefaultRedukcja = false;
    offerDefaultRedukcjaMinH = 2500;
    offerDefaultRedukcjaZak = null;
    
    // Aktualizacja UI
    const titleEl = document.getElementById('offer-form-title-studnie');
    if (titleEl) titleEl.innerHTML = `📋 Dane klienta i oferty (Nowa)`;
    const btnEl2 = document.getElementById('btn-save-studnie-offer');
    if (btnEl2) btnEl2.innerHTML = `💾 Zapisz ofertę`;

    const btnChangeUser = document.getElementById('btn-change-offer-user');
    if (btnChangeUser) {
        btnChangeUser.style.display = (currentUser && (currentUser.role === 'admin' || currentUser.role === 'pro')) ? 'inline-block' : 'none';
        btnChangeUser.textContent = `👤 Zmień opiekuna`;
    }

    refreshAll();
    showSection('builder');
    renderOfferSummary();
    // Reset wizard to step 1
    wizardConfirmedParams = new Set();
    goToWizardStep(1);
}

function renderSavedOffersStudnie() {
    const container = document.getElementById('saved-offers-list');
    if (!container) return;

    if (offersStudnie.length === 0) {
        container.innerHTML = `<div class="empty-state">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M9 12h6m-3-3v6m-7 4h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"/></svg>
            <h3>Brak zapisanych ofert</h3><p>Utwórz nową ofertę w zakładce "Oferta"</p></div>`;
        return;
    }

    container.innerHTML = offersStudnie.sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt)).map(o => {
        const oId = normalizeId(o.id);
        const hasOrder = o.hasOrder || (ordersStudnie && ordersStudnie.some(ord => normalizeId(ord.offerId) === oId));
        const order = ordersStudnie ? ordersStudnie.find(ord => normalizeId(ord.offerId) === oId) : null;
        const orderBadge = hasOrder
            ? `<div style="display:inline-flex; align-items:center; gap:0.3rem; padding:0.2rem 0.6rem; background:rgba(16,185,129,0.15); border:2px solid rgba(16,185,129,0.4); border-radius:6px; margin-top:0.3rem;">
                <span style="font-size:0.85rem;">📦</span>
                <span style="font-size:0.68rem; font-weight:800; color:#34d399; text-transform:uppercase; letter-spacing:0.5px;">Zamówienie ${order ? order.number : ''}</span>
               </div>`
            : '';
        return `
        <div class="offer-list-item" ${hasOrder ? 'style="border-left:3px solid #34d399;"' : ''}>
            <div class="offer-info" style="min-width:0;">
                <div style="display:flex; justify-content:space-between; align-items:flex-start; flex-wrap:wrap; gap:0.5rem;">
                    <div style="display:flex; align-items:center; gap:0.5rem; flex-wrap:wrap;">
                        <h3 style="margin-bottom:0.2rem; word-break:break-all;">${o.number}</h3>
                        ${orderBadge}
                    </div>
                    <div style="font-weight:700; color:var(--text-primary); font-size: 0.9rem; white-space:nowrap;">
                        💰 ${fmt(o.totalBrutto)} PLN
                    </div>
                </div>
                <div class="meta" style="margin-top:0.3rem;">
                    <span>📅 <strong>${o.date}</strong></span>
                    <span>🗂️ <strong>${o.wells.length}</strong> studnie</span>
                    ${(() => {
                        const resolveName = (rawName) => {
                            if (!rawName) return '';
                            if (window.globalUsersMap && window.globalUsersMap.has(rawName)) return window.globalUsersMap.get(rawName);
                            if (typeof currentUser !== 'undefined' && currentUser && (rawName === currentUser.username || rawName === currentUser.id)) return currentUser.displayName || currentUser.username || rawName;
                            return rawName;
                        };
                        const creatorName = resolveName(o.createdByUserName || o.userName);
                        const assignedName = resolveName(o.userName);
                        
                        let html = '';
                        if (creatorName === assignedName && creatorName) {
                            html += `<span style="color:var(--accent-hover)">👤 Autor i Opiekun: <strong>${creatorName}</strong></span>`;
                        } else {
                            if (creatorName) html += `<span style="display:inline-block; margin-right:10px; color:#888;">✍️ Autor: <strong>${creatorName}</strong></span>`;
                            if (assignedName) html += `<span style="color:var(--accent-hover)">👤 Opiekun: <strong>${assignedName}</strong></span>`;
                        }
                        return html;
                    })()}
                    
                    <div style="display:inline-flex; gap:0.3rem; margin-left:0.5rem; font-size:0.65rem;">
                        <span style="background: rgba(52, 211, 153, 0.1); color: #34d399; padding: 1px 5px; border-radius: 4px; border: 1px solid rgba(52, 211, 153, 0.3);">💾 Zapisano</span>
                    </div>
                </div>
                ${o.clientName || o.investName || o.clientContact ? `
                <div class="offer-client-badges">
                    ${o.clientName ? `<div class="badge-client">🏢 <strong>Klient:</strong> <span style="font-weight:500">${o.clientName}</span></div>` : ''}
                    ${o.investName ? `<div class="badge-invest">🏗️ <strong>Budowa:</strong> <span style="font-weight:500">${o.investName}</span></div>` : ''}
                </div>` : ''}
            </div>
            <div class="offer-actions" style="display:flex; flex-wrap:wrap; gap:0.4rem; justify-content:flex-end; align-content:center;">
                <button class="btn btn-sm btn-primary" onclick="loadSavedOfferStudnie('${oId}')" title="Wczytaj">Wczytaj</button>
                <button class="btn btn-sm btn-secondary" onclick="exportJSONStudnie('${oId}')" title="Pobierz plik JSON">💾 JSON</button>
                ${(currentUser && (currentUser.role === 'admin' || currentUser.role === 'pro')) ? `<button class="btn btn-sm btn-secondary" onclick="changeOfferUserFromListStudnie('${oId}')" title="Zmień opiekuna">👤 Zmień opiekuna</button>` : ''}
                ${(o.history && o.history.length > 0) ? `<button class="btn btn-sm btn-secondary" onclick="showOfferHistoryStudnie('${oId}')" title="Historia zmian">⏳ Historia</button>` : ''}
                <button class="btn btn-sm btn-danger" onclick="deleteOfferStudnie('${oId}')" title="Usuń">🗑️ Usuń</button>
                ${hasOrder && order ? `
                    <button class="btn btn-sm" style="background:rgba(16,185,129,0.15); border:1px solid rgba(16,185,129,0.3); color:#34d399; font-size:0.75rem; font-weight:800; padding:0.4rem 0.8rem;" onclick="window.location.href='/studnie?order=${order.id}'" title="Otwórz zamówienie">📦 Otwórz zamówienie</button>
                    <button class="btn btn-sm" style="background:rgba(239,68,68,0.1); border:1px solid rgba(239,68,68,0.2); color:#f87171; font-size:0.6rem;" onclick="deleteOrderStudnie('${order.id}')" title="Usuń zamówienie">🗑️ Zamówienie</button>
                ` : ''}
            </div>
        </div>
        `}).join('');
}

/** Migrate old well data (material -> nadbudowa/dennicaMaterial) */
function migrateWellData(wellsArr) {
    if (!wellsArr) return wellsArr;
    wellsArr.forEach(w => {
        // Migrate old 'material' field to new 'nadbudowa' + 'dennicaMaterial'
        if (w.material && !w.nadbudowa) {
            w.nadbudowa = w.material;
        }
        if (w.material && !w.dennicaMaterial) {
            w.dennicaMaterial = w.material;
        }
        // Ensure defaults
        if (!w.nadbudowa) w.nadbudowa = 'betonowa';
        if (!w.dennicaMaterial) w.dennicaMaterial = 'betonowa';
        if (!w.klasaNosnosci_korpus) w.klasaNosnosci_korpus = 'D400';
        if (!w.klasaNosnosci_zwienczenie) w.klasaNosnosci_zwienczenie = 'D400';
        // Ensure config and przejscia arrays exist
        if (!Array.isArray(w.config)) w.config = [];
        if (!Array.isArray(w.przejscia)) w.przejscia = [];
    });
    return wellsArr;
}

async function loadSavedOfferStudnie(id_or_doc, optionalId, targetSection) {
    const sectionToShow = targetSection || 'offer';
    let offer;
    if (typeof id_or_doc === 'object') {
        offer = id_or_doc;
        if (optionalId && !offer.id) offer.id = optionalId;
    } else {
        offer = offersStudnie.find(o => o.id === id_or_doc);
        if (!offer) {
            try {
                const { storageService } = await import('../shared/StorageService.js');
                offer = await storageService.getOfferById(id_or_doc);
            } catch (e) {
                showToast('Błąd: Nie znaleziono oferty w bazie.', 'error');
                return;
            }
        }
    }

    if (!offer) return;

    // Inline normalization — storageService is ESM-only and not available in global scope
    const normalized = normalizeOfferData(offer);

    orderEditMode = null; // exit order mode if active
    editingOfferIdStudnie = normalized.id || '';
    editingOfferAssignedUserId = normalized.userId || null;
    editingOfferAssignedUserName = normalized.userName || '';
    editingOfferCreatedByUserId = normalized.createdByUserId || null;
    editingOfferCreatedByUserName = normalized.createdByUserName || '';
    document.getElementById('offer-number').value = normalized.number || '';
    document.getElementById('offer-date').value = normalized.date || new Date().toISOString().slice(0, 10);
    document.getElementById('client-name').value = normalized.clientName || '';
    document.getElementById('client-nip').value = normalized.clientNip || '';
    document.getElementById('client-address').value = normalized.clientAddress || '';
    document.getElementById('client-contact').value = normalized.clientContact || '';
    document.getElementById('invest-name').value = normalized.investName || '';
    document.getElementById('invest-address').value = normalized.investAddress || '';
    document.getElementById('invest-contractor').value = normalized.investContractor || '';
    document.getElementById('offer-notes').value = normalized.notes || '';
    if (document.getElementById('offer-payment-terms')) document.getElementById('offer-payment-terms').value = normalized.paymentTerms || 'Do uzgodnienia lub według indywidualnych warunków handlowych.';
    if (document.getElementById('offer-validity')) document.getElementById('offer-validity').value = normalized.validity || '7 dni';
    document.getElementById('transport-km').value = normalized.transportKm || 100;
    document.getElementById('transport-rate').value = normalized.transportRate || 10;

    wellDiscounts = normalized.wellDiscounts ? JSON.parse(JSON.stringify(normalized.wellDiscounts)) : {};
    visiblePrzejsciaTypes = new Set(normalized.visiblePrzejsciaTypes || []);

    wells = JSON.parse(JSON.stringify(normalized.wells || []));
    migrateWellData(wells);

    // Zawsze sprawdzaj, czy jakieś przejścia już są fizycznie dodane w studniach
    // i automatycznie włącz kategorię do widoku (aby nie trzeba było ich "wczytywać")
    wells.forEach(w => {
        if (w.przejscia) {
            w.przejscia.forEach(pr => {
                const prod = studnieProducts.find(p => p.id === pr.productId);
                if (prod && prod.category) {
                    visiblePrzejsciaTypes.add(prod.category);
                }
            });
        }
    });

    currentWellIndex = 0;

    // Restore offer-level defaults from loaded wells
    if (wells.length > 0) {
        const lastWell = wells[wells.length - 1];
        offerDefaultZakonczenie = lastWell.zakonczenie || null;
        offerDefaultRedukcja = lastWell.redukcjaDN1000 || false;
        offerDefaultRedukcjaMinH = lastWell.redukcjaMinH || 2500;
        offerDefaultRedukcjaZak = lastWell.redukcjaZakonczenie || null;
    } else {
        offerDefaultZakonczenie = null;
        offerDefaultRedukcja = false;
        offerDefaultRedukcjaMinH = 2500;
        offerDefaultRedukcjaZak = null;
    }

    refreshAll();
    // Skip wizard for loaded offers — go directly to offer view
    if (typeof skipWizardToStep3 === 'function') skipWizardToStep3();
    showSection(sectionToShow);
    showToast('Wczytano ofertę: ' + (normalized.number || 'bez numeru'), 'info');

    // Aktualizacja UI (nagłówki i przyciski)
    const titleEl = document.getElementById('offer-form-title-studnie');
    if (titleEl) titleEl.innerHTML = `✏️ Edycja Oferty: <span style="font-weight:700">${normalized.number || offer.id}</span>`;
    const btnEl2 = document.getElementById('btn-save-studnie-offer');
    if (btnEl2) btnEl2.innerHTML = `💾 Zapisz zmiany`;

    const btnChangeUser = document.getElementById('btn-change-offer-user');
    if (btnChangeUser) {
        btnChangeUser.style.display = (currentUser && (currentUser.role === 'admin' || currentUser.role === 'pro')) ? 'inline-block' : 'none';
        if (editingOfferAssignedUserName) {
            btnChangeUser.textContent = `👤 Opiekun: ${editingOfferAssignedUserName}`;
        } else {
            btnChangeUser.textContent = `👤 Zmień opiekuna`;
        }
    }

    // Show lock banner if offer has order
    if (typeof renderOfferLockBanner === 'function') renderOfferLockBanner();
}

// Global expose
window.loadSavedOfferStudnie = loadSavedOfferStudnie;

async function deleteOfferStudnie(id) {
    if (!await appConfirm('Czy na pewno usunąć tę ofertę?', { title: 'Usuwanie oferty', type: 'danger' })) return;
    try {
        const res = await fetch(`/api/offers-studnie/${id}`, { method: 'DELETE', headers: authHeaders() });
        if (!res.ok) {
            const err = await res.json();
            showToast(err.error || 'Błąd usuwania', 'error');
            return;
        }
        offersStudnie = offersStudnie.filter(o => o.id !== id);
        renderSavedOffersStudnie();
        showToast('Oferta usunięta', 'info');
    } catch (err) {
        console.error('deleteOfferStudnie error:', err);
        showToast('Błąd połączenia z serwerem', 'error');
    }
}

function exportJSONStudnie(id) {
    const offer = offersStudnie.find(o => o.id === id);
    if (!offer) return;
    const jsonStr = JSON.stringify(offer, null, 2);
    const blob = new Blob([jsonStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `STUDNIE_OFERTA_${offer.number.replace(/[^A-Za-z0-9]/g, '_')}.json`;
    a.click();
    URL.revokeObjectURL(url);
}

function importOfferFromFileStudnie() {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'application/json';
    input.onchange = e => {
        const file = e.target.files[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = event => {
            try {
                const imported = JSON.parse(event.target.result);
                if (imported && imported.wells) {
                    imported.id = 'offer_studnie_' + Date.now();
                    migrateWellData(imported.wells);
                    offersStudnie.push(imported);
                    saveOffersDataStudnie(offersStudnie);
                    renderSavedOffersStudnie();
                    showToast('Oferta zaimportowana', 'success');
                } else {
                    showToast('Nieprawidłowy plik studni', 'error');
                }
            } catch (err) {
                showToast('Błąd parsowania', 'error');
            }
        };
        reader.readAsText(file);
    };
    input.click();
}




/* ===== CLIENT DATABASE — CRUD przeniesione do shared/clientManager.js ===== */


/* --- SVG Diagram Logic Helper --- */
window.decDiagramWellQty = function (idx) {
    const well = getCurrentWell();
    if (well && well.config[idx]) {
        updateWellQuantity(idx, well.config[idx].quantity - 1);
    }
}

window.svgDragStartIndex = -1;

window.svgPointerDown = function (ev, idx) {
    ev.preventDefault();
    const well = getCurrentWell();
    if (!well) return;

    // If Zlecenia modal is open, select element instead of dragging
    const zlModal = document.getElementById('zlecenia-modal');
    if (zlModal && zlModal.classList.contains('active')) {
        const targetIdx = zleceniaElementsList.findIndex(el => el.wellIndex === currentWellIndex && el.elementIndex === idx);
        if (targetIdx >= 0) {
            selectZleceniaElement(targetIdx);
        }
        return;
    }

    window.svgDragStartIndex = idx;
    well.config[idx].isPlaceholder = true;
    window.requestAnimationFrame(() => renderWellDiagram());
};

window.svgTouchStart = function (ev, idx) {
    ev.preventDefault();
    const well = getCurrentWell();
    if (!well) return;
    window.svgDragStartIndex = idx;
    well.config[idx].isPlaceholder = true;
    window.requestAnimationFrame(() => renderWellDiagram());
};

function handleLiveSvgDrag(clientY) {
    if (window.svgDragStartIndex >= 0) {
        const well = getCurrentWell();
        if (!well) return;
        const dz = document.getElementById('drop-zone-diagram');
        if (!dz) return;

        let targetIdx = well.config.length;
        let found = false;
        const grps = Array.from(dz.querySelectorAll('g.diag-comp-grp:not([pointer-events="none"])'));

        for (let g of grps) {
            const rect = g.getBoundingClientRect();
            if (clientY < rect.top + rect.height / 2) {
                targetIdx = parseInt(g.getAttribute('data-cfg-idx'));
                found = true;
                break;
            }
        }
        if (!found && grps.length > 0) {
            targetIdx = well.config.length;
        }

        let insertIdx = targetIdx;
        if (window.svgDragStartIndex < targetIdx) insertIdx -= 1;
        insertIdx = Math.max(0, Math.min(well.config.length, insertIdx));

        if (window.svgDragStartIndex !== insertIdx) {
            const draggedItem = well.config.splice(window.svgDragStartIndex, 1)[0];
            well.config.splice(insertIdx, 0, draggedItem);
            window.svgDragStartIndex = insertIdx;

            window.requestAnimationFrame(() => renderWellDiagram());
        }
    }
}

document.addEventListener('mousemove', (ev) => {
    if (window.svgDragStartIndex >= 0) {
        handleLiveSvgDrag(ev.clientY);
    }
});

document.addEventListener('touchmove', (ev) => {
    if (window.svgDragStartIndex >= 0 && ev.touches.length > 0) {
        handleLiveSvgDrag(ev.touches[0].clientY);
    }
}, { passive: false });

document.addEventListener('mouseup', (ev) => {
    if (window.svgDragStartIndex >= 0) {
        const sourceIdx = window.svgDragStartIndex;
        window.svgDragStartIndex = -1;

        let shouldRemove = false;

        // Złapane w obszar kosza
        const trash = document.getElementById('svg-trash');
        if (trash && (trash === ev.target || trash.contains(ev.target))) {
            shouldRemove = true;
        }

        // Wyrzucone całkowicie poza okienko podglądu (diagram-panel)
        const diagramZone = document.getElementById('drop-zone-diagram');
        if (diagramZone && !diagramZone.contains(ev.target)) {
            shouldRemove = true;
        }

        const well = getCurrentWell();
        if (well) {
            well.config.forEach(c => c.isPlaceholder = false);
            well.autoLocked = true;
            if (typeof updateAutoLockUI === 'function') updateAutoLockUI();
            well.configSource = 'MANUAL';
        }

        if (shouldRemove) {
            window.decDiagramWellQty(sourceIdx);
        } else {
            renderWellConfig();
            renderWellDiagram();
            updateSummary();
        }

        // Reset trash visual state
        if (trash) {
            trash.style.background = 'rgba(239,68,68,0.1)';
            trash.style.borderColor = 'rgba(239,68,68,0.4)';
        }
    }
});

document.addEventListener('touchend', (ev) => {
    if (window.svgDragStartIndex >= 0) {
        // Syntetyczne mapowanie na to samo zachowanie co mouseup
        const mouseUpEvent = new MouseEvent('mouseup', {
            clientX: ev.changedTouches[0].clientX,
            clientY: ev.changedTouches[0].clientY,
            bubbles: true
        });
        document.dispatchEvent(mouseUpEvent);
    }
});

let dragOverCount = 0; // for drag & drop visual

let isBackendOnline = false;


// Nasłuchiwanie zmian statusu synchronizacji dla odświeżenia listy
window.addEventListener('pv-sync-status-changed', () => {
    // Jeśli widżet zapisu ofert jest widoczny, odświeżamy go
    const container = document.getElementById('saved-offers-list');
    if (container && container.offsetParent !== null) {
        renderSavedOffersStudnie();
    }
});

/* ===== OFFER HISTORY STUDNIE (SQLite audit) ===== */

function renderAuditLogEntry(log) {
    const data = log.newData || {};
    const isDiff = data._diffMode === true;
    const isDelete = log.action === 'delete';

    let actionBadge = '';
    let contentHtml = '';
    let cardClass = '';

    if (isDelete) {
        cardClass = 'action-delete';
        actionBadge = `<span style="background:rgba(239,68,68,0.15); color:#f87171; padding:4px 10px; border-radius:6px; font-size:0.75rem; font-weight:800; letter-spacing:0.5px;">🗑️ USUNIĘTO</span>`;
        const oldData = log.oldData || {};
        contentHtml = `<div style="font-size:0.9rem; color:#f87171;">Usunięta oferta${oldData.totalBrutto ? ` — wcześniej: <strong style="color:#fff;">${fmt(oldData.totalBrutto)} PLN</strong>` : ''}</div>`;
    } else if (log.action === 'create') {
        cardClass = 'action-create';
        actionBadge = `<span style="background:rgba(99,102,241,0.15); color:#818cf8; padding:4px 10px; border-radius:6px; font-size:0.75rem; font-weight:800; letter-spacing:0.5px;">✨ UTWORZONO</span>`;
        const price = data.totalBrutto || 0;
        contentHtml = `<div style="font-size:1.2rem; font-weight:800; color:#f8fafc;">💰 ${fmt(price)} PLN</div>`;
        if (data.wells) contentHtml += `<div style="font-size:0.8rem; color:var(--text-secondary); margin-top:2px;">📦 ${data.wells.length} studni</div>`;
    } else if (isDiff) {
        cardClass = 'action-diff';
        actionBadge = `<span style="background:rgba(251,191,36,0.15); color:#fbbf24; padding:4px 10px; border-radius:6px; font-size:0.75rem; font-weight:800; letter-spacing:0.5px;">📝 EDYCJA (DIFF)</span>`;
        const changedKeys = Object.keys(data).filter(k => k !== '_diffMode');
        const changesHtml = changedKeys.map(k => {
            const oldVal = log.oldData && log.oldData[k] !== undefined ? log.oldData[k] : '(brak)';
            const newVal = data[k] !== undefined ? data[k] : '(brak)';
            if (k === 'totalBrutto' || k === 'totalNetto' || k.toLowerCase().includes('price') || k.toLowerCase().includes('cena')) {
                return `<div class="diff-line"><strong class="diff-key">${k}</strong>: <span class="diff-old">${fmt(Number(oldVal))} PLN</span> <span style="color:var(--text-muted); font-size:0.8rem;">➔</span> <span class="diff-new">${fmt(Number(newVal))} PLN</span></div>`;
            }
            return `<div class="diff-line"><strong class="diff-key">${k}</strong>: <span class="diff-old">${JSON.stringify(oldVal)}</span> <span style="color:var(--text-muted); font-size:0.8rem;">➔</span> <span class="diff-new">${JSON.stringify(newVal)}</span></div>`;
        }).join('');
        contentHtml = `<div class="diff-container">${changesHtml}</div>`;
    } else {
        cardClass = 'action-update';
        actionBadge = `<span style="background:rgba(16,185,129,0.15); color:#34d399; padding:4px 10px; border-radius:6px; font-size:0.75rem; font-weight:800; letter-spacing:0.5px;">💾 ZAPIS / AKTUALIZACJA</span>`;
        const price = data.totalBrutto || 0;
        const oldPrice = log.oldData?.totalBrutto || 0;
        if (oldPrice && Math.abs(price - oldPrice) > 0.01) {
            contentHtml = `<div style="font-size:1.2rem; font-weight:800; color:#f8fafc;">💰 <span style="text-decoration:line-through;color:var(--text-muted);font-size:0.95rem;font-weight:600;">${fmt(oldPrice)}</span> <span style="color:var(--text-muted); font-size:0.9rem; margin:0 4px;">➔</span> ${fmt(price)} PLN</div>`;
        } else {
            contentHtml = `<div style="font-size:1.2rem; font-weight:800; color:#f8fafc;">💰 ${fmt(price)} PLN</div>`;
        }
        if (data.wells) contentHtml += `<div style="font-size:0.8rem; color:var(--text-secondary); margin-top:2px;">📦 ${data.wells.length} studni</div>`;
    }

    const restoreBtnHtml = (!isDelete && !isDiff) ? `
        <button class="btn btn-sm btn-secondary restore-btn" onclick="restoreHistorySnapshot('${log.id}')">🔄 Przywróć</button>
    ` : '';

    const buttonsHtml = `
        <div style="display:flex; gap:0.4rem;">
            <button class="btn btn-sm btn-secondary preview-btn" onclick="viewHistorySnapshot('${log.id}')">👁️ Podgląd</button>
            ${restoreBtnHtml}
        </div>
    `;

    return `
        <div class="audit-card ${cardClass}">
            <div class="audit-card-header">
                <div style="display:flex; align-items:center; gap:0.6rem;">
                    ${actionBadge}
                    <span class="audit-date">📅 ${new Date(log.createdAt).toLocaleString()}</span>
                </div>
                <div class="audit-author">
                    🧑‍💻 <strong style="color:#e2e8f0;">${log.userName || 'System'}</strong>
                </div>
            </div>
            <div class="audit-card-body">
                <div class="audit-content">${contentHtml}</div>
                <div class="audit-actions">${buttonsHtml}</div>
            </div>
        </div>
    `;
}

async function showOfferHistoryStudnie(id) {
    try {
        const res = await fetch(`/api/audit/studnia_oferta/${id}?limit=20&offset=0`, { headers: authHeaders() });
        const json = await res.json();
        const logs = json.data || [];
        const total = json.total || 0;

        if (logs.length === 0) {
            showToast('Brak historii dla tego elementu', 'info');
            return;
        }

        const overlay = document.createElement('div');
        overlay.className = 'modal-overlay';
        overlay.id = 'offer-history-modal';

        const historyHtml = logs.map(renderAuditLogEntry).join('');
        const loadMoreHtml = logs.length < total
            ? `<div id="audit-load-more-wrap" style="text-align:center; padding:1.5rem 0 0.5rem 0;">
                   <button class="load-more-btn" onclick="loadMoreAuditLogs('studnia_oferta', '${id}', 20)">📜 Załaduj starsze zmiany (${total - logs.length} pozostało)</button>
               </div>`
            : '';

        overlay.innerHTML = `
            <style>
                .audit-modal-inner {
                    max-width: 800px; width: 95%; border-radius: 20px; max-height: 90vh; 
                    display: flex; flex-direction: column; background: #0f172a; 
                    box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.5); border: 1px solid rgba(255, 255, 255, 0.1);
                }
                .audit-card {
                    background: rgba(30, 41, 59, 0.6);
                    border: 1px solid rgba(255, 255, 255, 0.06);
                    border-radius: 16px;
                    padding: 1.25rem 1.5rem;
                    margin-bottom: 1rem;
                    position: relative;
                    overflow: hidden;
                    transition: all 0.2s ease;
                    backdrop-filter: blur(10px);
                }
                .audit-card:hover {
                    background: rgba(30, 41, 59, 0.9);
                    border-color: rgba(255, 255, 255, 0.15);
                    transform: translateY(-2px);
                    box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.3), 0 4px 6px -2px rgba(0, 0, 0, 0.15);
                }
                .audit-card::before {
                    content: ''; position: absolute; left: 0; top: 0; bottom: 0; width: 5px;
                }
                .audit-card.action-create::before { background: #818cf8; }
                .audit-card.action-update::before { background: #34d399; }
                .audit-card.action-diff::before { background: #fbbf24; }
                .audit-card.action-delete::before { background: #f87171; }
                
                .audit-card-header {
                    display: flex; justify-content: space-between; align-items: center;
                    margin-bottom: 1rem; padding-bottom: 0.8rem; border-bottom: 1px solid rgba(255, 255, 255, 0.05);
                }
                .audit-date { font-size: 0.85rem; color: #94a3b8; font-weight: 500; }
                .audit-author { font-size: 0.85rem; color: #cbd5e1; display:flex; align-items:center; gap:4px; }
                
                .audit-card-body {
                    display: flex; justify-content: space-between; align-items: center; gap: 1rem;
                }
                
                .diff-container { display: flex; flex-direction: column; gap: 0.4rem; }
                .diff-line { background: rgba(0,0,0,0.2); padding: 0.4rem 0.8rem; border-radius: 6px; font-size: 0.85rem; }
                .diff-key { color: #f8fafc; font-weight: 600; font-family: monospace; }
                .diff-old { color: #94a3b8; text-decoration: line-through; }
                .diff-new { color: #34d399; font-weight: 700; }
                
                .restore-btn, .preview-btn {
                    background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.1); 
                    color: #f8fafc; padding: 0.5rem 1rem; border-radius: 8px; font-weight: 600;
                    transition: all 0.2s; cursor: pointer; display: flex; align-items: center; gap: 6px;
                }
                .preview-btn:hover { background: rgba(99, 102, 241, 0.15); border-color: rgba(99, 102, 241, 0.3); color: #818cf8; }
                .restore-btn:hover { background: rgba(52, 211, 153, 0.15); border-color: rgba(52, 211, 153, 0.3); color: #34d399; }
                
                .load-more-btn {
                    background: rgba(99,102,241,0.15); border: 1px solid rgba(99,102,241,0.3); 
                    color: #818cf8; font-weight: 700; padding: 0.6rem 1.5rem; border-radius: 30px;
                    cursor: pointer; transition: all 0.2s;
                }
                .load-more-btn:hover { background: rgba(99,102,241,0.3); transform: scale(1.05); }
            </style>
            <div class="modal audit-modal-inner">
                <div class="modal-header" style="border-bottom:1px solid rgba(255,255,255,0.1); padding:1.2rem 1.5rem; background: rgba(255,255,255,0.02); border-radius: 20px 20px 0 0;">
                    <h3 style="font-weight:800; color:#fff; margin:0; display:flex; align-items:center; gap:0.5rem;">
                        <span style="font-size:1.4rem;">⌛</span> Oś Czasu Zmian (${total} wpisów)
                    </h3>
                    <button class="btn-icon" style="background:rgba(255,255,255,0.1); color:#fff; border-radius:50%; width:32px; height:32px; display:flex; align-items:center; justify-content:center;" onclick="closeModal()">✕</button>
                </div>
                <div id="audit-logs-container" style="padding:1.5rem; overflow-y:auto; flex:1; scrollbar-width:thin;">
                    ${historyHtml}
                    ${loadMoreHtml}
                </div>
            </div>
        `;
        document.body.appendChild(overlay);
        overlay.classList.add('active');
        overlay.addEventListener('click', e => { if (e.target === overlay) closeModal(); });

        window.currentAuditLogs = logs;
        window.currentAuditOffset = logs.length;
    } catch (e) {
        console.error('Błąd pobierania historii:', e);
        showToast('Błąd pobierania historii', 'error');
    }
}

async function loadMoreAuditLogs(entityType, entityId, limit) {
    try {
        const offset = window.currentAuditOffset || 0;
        const res = await fetch(`/api/audit/${entityType}/${entityId}?limit=${limit}&offset=${offset}`, { headers: authHeaders() });
        const json = await res.json();
        const newLogs = json.data || [];
        const total = json.total || 0;

        if (newLogs.length === 0) return;

        window.currentAuditLogs = [...(window.currentAuditLogs || []), ...newLogs];
        window.currentAuditOffset = offset + newLogs.length;

        const container = document.getElementById('audit-logs-container');
        const loadMoreWrap = document.getElementById('audit-load-more-wrap');
        if (loadMoreWrap) loadMoreWrap.remove();

        container.insertAdjacentHTML('beforeend', newLogs.map(renderAuditLogEntry).join(''));

        if (window.currentAuditOffset < total) {
            const remaining = total - window.currentAuditOffset;
            container.insertAdjacentHTML('beforeend', `
                <div id="audit-load-more-wrap" style="text-align:center; padding:1.5rem 0 0.5rem 0;">
                    <button class="load-more-btn" onclick="loadMoreAuditLogs('${entityType}', '${entityId}', ${limit})">📜 Załaduj starsze zmiany (${remaining} pozostało)</button>
                </div>
            `);
        }
    } catch (e) {
        console.error('Błąd ładowania kolejnych logów:', e);
    }
}

async function viewHistorySnapshot(logId) {
    const log = window.currentAuditLogs?.find(l => l.id === logId);
    if (!log) return;

    try {
        const entityType = log.entityType;
        const entityId = log.entityId;

        const res = await fetch(`/api/audit/rebuild/${entityType}/${entityId}/${logId}`, { headers: authHeaders() });
        if (!res.ok) {
            const err = await res.json().catch(() => ({}));
            throw new Error(err.error || 'Błąd odtwarzania z serwera.');
        }

        const json = await res.json();
        const rebuiltData = json.data;

        if (entityType === 'order' && typeof window.loadOrderSnapshot === 'function') {
            window.loadOrderSnapshot(rebuiltData, entityId);
            showToast('👁️ Wczytano archiwalną wersję ZAMÓWIENIA w trybie READ-ONLY', 'info');
        } else {
            loadSavedOfferStudnie(rebuiltData);
            showToast('👁️ Wczytano wersję historyczną do testowego podglądu', 'info');
            if (typeof window.applyPreviewLockUI === 'function') window.applyPreviewLockUI();
        }

        closeModal();
    } catch (e) {
        console.error('Błąd podglądu:', e);
        showToast('Błąd podglądu: ' + e.message, 'error');
    }
}

async function restoreHistorySnapshot(logId) {
    const log = window.currentAuditLogs?.find(l => l.id === logId);
    if (!log || !log.newData) return;

    if (!await appConfirm('Czy na pewno chcesz przywrócić tę wersję? Aktualne zmiany zostaną nadpisane przy następnym zapisie.', { title: 'Przywrócenie wersji', type: 'warning', okText: 'Przywróć' })) return;

    if (log.entityType === 'order' && typeof window.loadOrderSnapshot === 'function') {
        window.loadOrderSnapshot(log.newData, log.entityId);
        // Force unlock mode for restoration
        window.isPreviewMode = false;
        const banner = document.getElementById('preview-lock-banner');
        if (banner) banner.remove();
        document.querySelectorAll('.drop-zone, #svg-trash, #studnie-product-list, .actions-bar').forEach(el => {
            el.style.pointerEvents = '';
            el.style.opacity = '1';
        });
        showToast('🔄 Przywrócono ZAMÓWIENIE z historii. Zapisz pomyślnie używając guzika "Zapisz zamówienie".', 'success');
    } else {
        loadSavedOfferStudnie(log.newData);
        showToast('🔄 Przywrócono wersję historyczną. Zapisz ofertę, aby zatwierdzić.', 'success');
    }

    closeModal();
}



