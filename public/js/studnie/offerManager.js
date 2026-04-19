/* ===== PODSUMOWANIE OFERTY ===== */

function toggleWellExpansion(index, event) {
    if (event) event.stopPropagation();
    if (expandedWellIndices.has(index)) {
        expandedWellIndices.delete(index);
    } else {
        expandedWellIndices.add(index);
    }
    renderOfferSummary();
}

/**
 * Główna funkcja renderująca podsumowanie oferty.
 * Zrefaktoryzowana zgodnie z zasadami SRP i limitami długości funkcji.
 */
function renderOfferSummary() {
    const container = document.getElementById('offer-summary-body');
    if (!container) return;

    const order = getCurrentOfferOrder();
    const orderChanges = order ? getOrderChanges({ ...order, wells: wells }) : {};
    
    // Obliczenia globalne
    const totals = calculateOfferTotals();
    
    let html = '';
    // Baner statusu zamówienia i postęp
    html += renderOrderBanners(order, orderChanges);
    
    // Tabela zestawienia
    html += renderOfferSummaryTable(order, orderChanges, totals);
    
    container.innerHTML = html;
    
    // Inicjalizacja ikon Lucide dla nowo dodanych elementów
    if (window.lucide) window.lucide.createIcons();
    
    // Aktualizacja wskaźników zewnętrznych (stopka)
    updateOfferSummaryUI(totals);
}

function calculateOfferTotals() {
    let globalWeight = 0;
    wells.forEach((w) => (globalWeight += calcWellStats(w).weight));

    const transportKm = parseFloat(document.getElementById('transport-km')?.value) || 0;
    const transportRate = parseFloat(document.getElementById('transport-rate')?.value) || 0;
    
    let totalTransports = 0, transportCostPerTrip = 0, totalTransportCost = 0;
    if (transportKm > 0 && transportRate > 0) {
        totalTransports = Math.ceil(globalWeight / 24000);
        transportCostPerTrip = transportKm * transportRate;
        totalTransportCost = totalTransports * transportCostPerTrip;
    }

    return { globalWeight, totalTransports, transportCostPerTrip, totalTransportCost };
}

function renderOrderBanners(order, orderChanges) {
    let html = '';
    const hasChanges = Object.keys(orderChanges).length > 0;
    
    if (order) {
        const changeCount = Object.keys(orderChanges).length;
        html += `<div style="display:flex; align-items:center; justify-content:space-between; padding:0.5rem 0.8rem; margin-bottom:0.5rem; background:${hasChanges ? 'rgba(239,68,68,0.1)' : 'rgba(16,185,129,0.1)'}; border:1px solid ${hasChanges ? 'rgba(239,68,68,0.3)' : 'rgba(16,185,129,0.3)'}; border-radius:8px;">
            <div style="display:flex; align-items:center; gap:0.4rem;">
                <span style="font-size:1.1rem;"><i data-lucide="package"></i></span>
                <span style="font-size:0.75rem; font-weight:700; color:${hasChanges ? '#f87171' : '#34d399'};">ZAMÓWIENIE ${hasChanges ? '— ' + changeCount + ' studni zmienionych' : '— bez zmian'}</span>
            </div>
            <button class="btn btn-sm" style="background:rgba(16,185,129,0.15); border:1px solid rgba(16,185,129,0.3); color:#34d399; font-size:0.65rem; padding:0.15rem 0.4rem;" onclick="orderEditMode ? saveCurrentOrder() : saveOrderStudnie()"><i data-lucide="package"></i> Zapisz zamówienie</button>
        </div>`;
    }

    if (!orderEditMode && editingOfferIdStudnie && wells.length > 0) {
        html += renderPartialOrderProgress();
    }
    return html;
}

function renderPartialOrderProgress() {
    const progress = typeof getOfferOrderProgress === 'function'
        ? getOfferOrderProgress(editingOfferIdStudnie, wells)
        : { ordered: 0, total: wells.length, percent: 0 };
    const orderedIds = typeof getOrderedWellIds === 'function'
        ? getOrderedWellIds(editingOfferIdStudnie)
        : new Set();
    const availableCount = wells.filter((w) => !orderedIds.has(w.id)).length;

    if (progress.ordered === 0 && availableCount === wells.length) return '';

    const progressColor = progress.percent >= 100 ? '#34d399' : '#60a5fa';
    return `<div style="display:flex; align-items:center; gap:0.6rem; padding:0.5rem 0.8rem; margin-bottom:0.5rem; background:rgba(59,130,246,0.08); border:1px solid rgba(59,130,246,0.2); border-radius:8px;">
        <div style="flex:1;">
            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:0.3rem;">
                <span style="font-size:0.72rem; font-weight:700; color:var(--text-secondary);">
                    <i data-lucide="package"></i> Postęp zamówień
                </span>
                <span style="font-size:0.72rem; font-weight:800; color:${progressColor};">
                    ${progress.ordered} / ${progress.total} studni (${progress.percent}%)
                </span>
            </div>
            <div style="height:6px; background:rgba(255,255,255,0.08); border-radius:3px; overflow:hidden;">
                <div style="height:100%; width:${progress.percent}%; background:${progressColor}; border-radius:3px; transition:width 0.3s ease;"></div>
            </div>
        </div>
    </div>`;
}

function renderOfferSummaryTable(order, orderChanges, totals) {
    const showOrderSelection = !orderEditMode && editingOfferIdStudnie;
    const orderedWellIds = showOrderSelection && typeof getOrderedWellIds === 'function' ? getOrderedWellIds(editingOfferIdStudnie) : new Set();

    let html = `<div class="table-wrap"><table style="table-layout:fixed; width:100%;">
      <thead>
        <tr>
          ${showOrderSelection ? `<th style="width:40px; text-align:center;"><input type="checkbox" id="select-all-wells-for-order" onchange="toggleAllWellsForOrder(this.checked)" style="cursor:pointer; width:16px; height:16px;"></th>` : ''}
          <th style="width:40px; text-align:center;">Lp.</th>
          <th style="width:30px;"></th> <!-- Expand icon -->
          <th>Nazwa studni</th>
          <th style="width:80px; text-align:center;">DN</th>
          <th style="width:120px;" class="text-right">Cena</th>
          <th style="width:100px;" class="text-right">Akcje</th>
        </tr>
      </thead>
      <tbody>`;

    let runningTotalPrice = 0;
    let runningTotalWeight = 0;

    wells.forEach((well, i) => {
        const stats = calcWellStats(well);
        const wellTransportCost = totals.globalWeight > 0 ? totals.totalTransportCost * (stats.weight / totals.globalWeight) : 0;
        stats.price += wellTransportCost;
        
        runningTotalPrice += stats.price;
        runningTotalWeight += stats.weight;

        html += renderWellHeaderRow(well, i, stats, orderChanges[i], orderedWellIds.has(well.id), showOrderSelection);
        html += renderWellDetailsRow(well, i, orderChanges[i], wellTransportCost);
    });

    html += renderOfferSummaryFooter(wells.length, runningTotalWeight, runningTotalPrice, showOrderSelection);
    html += `</tbody></table></div>`;
    return html;
}

function renderWellHeaderRow(well, i, stats, change, isOrdered, showOrderSelection) {
    const isExpanded = expandedWellIndices.has(i);
    const rowStyle = getWellRowStyle(change, isOrdered);
    const badges = getWellBadges(change, isOrdered);
    
    let checkbox = '';
    if (showOrderSelection) {
        checkbox = isOrdered 
            ? `<td style="text-align:center;"><i data-lucide="package-check" style="width:16px; height:16px; color:#a5b4fc;"></i></td>`
            : `<td style="text-align:center;" onclick="event.stopPropagation()"><input type="checkbox" class="well-order-checkbox" data-well-index="${i}" onchange="updateOrderSelectionCount()" style="cursor:pointer; width:16px; height:16px;"></td>`;
    }

    return `<tr class="well-row-header" style="${rowStyle}" onclick="toggleWellExpansion(${i}, event)">
        ${checkbox}
        <td style="text-align:center; color:var(--text-muted); font-weight:600;">${i + 1}</td>
        <td style="text-align:center; color:var(--accent);"><i data-lucide="${isExpanded ? 'chevron-down' : 'chevron-right'}" style="width:16px; height:16px;"></i></td>
        <td style="font-weight:700; color:var(--text-primary);">${well.name}${badges}</td>
        <td style="text-align:center; font-weight:600; color:var(--text-secondary);">DN${well.dn}</td>
        <td class="text-right" style="font-weight:800; color:var(--success);">${fmtInt(stats.price)} PLN</td>
        <td class="text-right" onclick="event.stopPropagation()">
            <button class="btn btn-icon btn-sm" onclick="showSection('builder'); selectWell(${i})" title="Edytuj studnię">
                <i data-lucide="edit-3"></i>
            </button>
        </td>
    </tr>`;
}

function getWellRowStyle(change, isOrdered) {
    if (change) {
        return change.type === 'added' 
            ? 'border-left:3px solid #34d399; background:rgba(16,185,129,0.05);' 
            : 'border-left:3px solid #ef4444; background:rgba(239,68,68,0.05);';
    }
    return isOrdered ? 'border-left:3px solid rgba(99,102,241,0.5); background:rgba(99,102,241,0.04);' : '';
}

function getWellBadges(change, isOrdered) {
    let html = '';
    if (change) {
        html += change.type === 'added'
            ? `<span style="font-size:0.55rem; padding:1px 5px; border-radius:3px; background:rgba(16,185,129,0.2); color:#34d399; font-weight:700; margin-left:0.3rem;"><i data-lucide="circle-check"></i> NOWA</span>`
            : `<span style="font-size:0.55rem; padding:1px 5px; border-radius:3px; background:rgba(239,68,68,0.2); color:#f87171; font-weight:700; margin-left:0.3rem;"><i data-lucide="circle-x"></i> ZMIENIONO</span>`;
    }
    if (isOrdered) {
        html += `<span style="font-size:0.55rem; padding:1px 5px; border-radius:3px; background:rgba(99,102,241,0.2); color:#a5b4fc; font-weight:700; margin-left:0.3rem;"><i data-lucide="lock"></i> ZAMÓWIENIE</span>`;
    }
    return html;
}

function renderWellDetailsRow(well, i, change, wellTransportCost) {
    const isExpanded = expandedWellIndices.has(i);
    if (!isExpanded) return `<tr id="well-details-${i}" class="well-details-row hidden"><td colspan="10"></td></tr>`;

    const stats = calcWellStats(well);
    const disc = wellDiscounts[well.dn] || { dennica: 0, nadbudowa: 0 };
    const nadbudowaMult = 1 - (disc.nadbudowa || 0) / 100;
    
    let detailsHtml = `<tr class="well-details-row"><td colspan="10">
        <div class="well-details-container">
            <div class="well-details-grid">
                <div class="well-detail-item">
                    <span class="well-detail-label">Masa całkowita</span>
                    <span class="well-detail-value">${fmtInt(stats.weight)} kg</span>
                </div>
                <div class="well-detail-item">
                    <span class="well-detail-label">Wysokość rz.</span>
                    <span class="well-detail-value">${fmtInt(stats.height)} mm</span>
                </div>
                <div class="well-detail-item">
                    <span class="well-detail-label">Pow. wewnętrzna</span>
                    <span class="well-detail-value">${fmt(stats.areaInt)} m²</span>
                </div>
                <div class="well-detail-item">
                    <span class="well-detail-label">Pow. zewnętrzna</span>
                    <span class="well-detail-value">${fmt(stats.areaExt)} m²</span>
                </div>
            </div>
            <div style="margin-top:0.8rem; border-top:1px solid rgba(255,255,255,0.05); padding-top:0.5rem;">
                <div style="font-size:0.65rem; text-transform:uppercase; color:var(--text-muted); font-weight:600; margin-bottom:0.3rem;">Konfiguracja elementów:</div>
                <table style="width:100%; font-size:0.75rem;">
                    ${renderWellComponentsList(well, wellTransportCost, disc, nadbudowaMult, change)}
                </table>
            </div>
        </div>
    </td></tr>`;
    
    return detailsHtml;
}

function renderWellComponentsList(well, wellTransportCost, disc, nadbudowaMult, change) {
    let html = '';
    const assignedPrzejscia = calculateAssignedPrzejscia(well);

    well.config.forEach((item, index) => {
        const p = studnieProducts.find((pr) => pr.id === item.productId);
        if (!p || p.componentType === 'kineta') return;

        const discStr = getDiscountStr(p, disc);
        let { totalLinePrice, totalLineWeight } = calculateLinePricing(well, p, item, wellTransportCost, disc, nadbudowaMult, assignedPrzejscia[index]);

        html += `<tr style="opacity:0.8;">
            <td style="color:var(--text-secondary);">↳ ${p.name}${discStr}</td>
            <td style="width:60px; text-align:center;">${item.quantity} szt.</td>
            <td style="width:100px;" class="text-right">${fmtInt(totalLineWeight)} kg</td>
            <td style="width:120px;" class="text-right">${p.componentType === 'kineta' ? 'wliczone' : fmtInt(totalLinePrice) + ' PLN'}</td>
        </tr>`;

        // Renderowanie szczegółów dopłaty, przejść i kinety (jako sub-elementy w skróconej tabeli)
        html += renderComponentSubItems(well, p, item, assignedPrzejscia[index], disc, nadbudowaMult, wellTransportCost);
    });
    return html;
}

function calculateAssignedPrzejscia(well) {
    const assigned = {};
    const rzDna = parseFloat(well.rzednaDna) || 0;
    const configMap = [];
    let currY = 0;
    let dennicaCount = 0;
    
    // Budujemy mapę wysokości elementów (od dołu)
    for (let j = well.config.length - 1; j >= 0; j--) {
        const p = studnieProducts.find(x => x.id === well.config[j].productId);
        if (!p) continue;
        let h = 0;
        if (p.componentType === 'dennica') {
            dennicaCount++;
            h = (p.height || 0) - (dennicaCount > 1 ? 100 : 0);
        } else {
            h = (p.height || 0) * (well.config[j].quantity || 1);
        }
        configMap.push({ index: j, start: currY, end: currY + h });
        currY += h;
    }

    if (well.przejscia) {
        well.przejscia.forEach(pr => {
            const mmFromBottom = (parseFloat(pr.rzednaWlaczenia || rzDna) - rzDna) * 1000;
            const target = configMap.find(cm => mmFromBottom >= cm.start && mmFromBottom < cm.end);
            const idx = target ? target.index : well.config.length - 1;
            if (!assigned[idx]) assigned[idx] = [];
            assigned[idx].push(pr);
        });
    }
    return assigned;
}

function renderComponentSubItems(well, p, item, itemPrzejscia, disc, nadbudowaMult, wellTransportCost) {
    let html = '';
    const isBase = p.componentType === 'dennica' || p.componentType === 'styczna';
    
    if (isBase && well.doplata) {
        html += `<tr style="opacity:0.6; font-size:0.7rem; color:var(--success);">
            <td colspan="3" style="padding-left:1.5rem;">↳ + Dopłata indywidualna</td>
            <td class="text-right">${fmtInt(well.doplata)} PLN</td>
        </tr>`;
    }

    if (itemPrzejscia) {
        itemPrzejscia.forEach(pr => {
            const prProd = studnieProducts.find(x => x.id === pr.productId);
            if (!prProd) return;
            let prPrice = (prProd.price || 0) * nadbudowaMult;
            if (pr.doplata) prPrice += pr.doplata;
            html += `<tr style="opacity:0.6; font-size:0.7rem; color:#818cf8;">
                <td colspan="3" style="padding-left:1.5rem;">↳ + Przejście: ${prProd.category} ${prProd.dn} (${pr.angle}°)</td>
                <td class="text-right">${fmtInt(prPrice)} PLN</td>
            </tr>`;
        });
    }

    if (isBase) {
        const kineta = well.config.find(c => studnieProducts.find(x => x.id === c.productId)?.componentType === 'kineta');
        if (kineta) {
            const kp = studnieProducts.find(x => x.id === kineta.productId);
            const kPrice = getItemAssessedPrice(well, kp, true) * (kineta.quantity || 1);
            html += `<tr style="opacity:0.6; font-size:0.7rem; color:#f472b6;">
                <td colspan="3" style="padding-left:1.5rem;">↳ + ${kp.name}</td>
                <td class="text-right">${fmtInt(kPrice)} PLN</td>
            </tr>`;
        }
        if (wellTransportCost > 0) {
            html += `<tr style="opacity:0.6; font-size:0.7rem; color:#a855f7;">
                <td colspan="3" style="padding-left:1.5rem;">↳ <i data-lucide="truck"></i> Udział w transporcie</td>
                <td class="text-right">${fmtInt(wellTransportCost)} PLN</td>
            </tr>`;
        }
    }
    return html;
}

function calculateLinePricing(well, p, item, wellTransportCost, disc, nadbudowaMult, itemPrzejscia) {
    const itemPrice = getItemAssessedPrice(well, p, true);
    let totalLinePrice = itemPrice * item.quantity;
    let totalLineWeight = (p.weight || 0) * item.quantity;

    if (p.componentType === 'dennica' || p.componentType === 'styczna') {
        const kinetaItem = well.config.find(c => studnieProducts.find(x => x.id === c.productId)?.componentType === 'kineta');
        if (kinetaItem) {
            const kinetaProd = studnieProducts.find(x => x.id === kinetaItem.productId);
            if (kinetaProd) {
                totalLinePrice += getItemAssessedPrice(well, kinetaProd, true) * (kinetaItem.quantity || 1);
            }
        }
        totalLinePrice += wellTransportCost;
        if (well.doplata) totalLinePrice += well.doplata;
    }

    if (itemPrzejscia) {
        itemPrzejscia.forEach(pr => {
            const prProd = studnieProducts.find(x => x.id === pr.productId);
            if (prProd) {
                totalLinePrice += ((prProd.price || 0) * nadbudowaMult) + (pr.doplata || 0);
                totalLineWeight += prProd.weight || 0;
            }
        });
    }

    return { totalLinePrice, totalLineWeight };
}

function getDiscountStr(p, disc) {
    const isDen = p.componentType === 'dennica' || p.componentType === 'kineta' || p.componentType === 'styczna';
    const val = isDen ? disc.dennica : disc.nadbudowa;
    return val > 0 ? ` <span style="font-size:0.6rem; color:#10b981; margin-left:0.3rem;">(-${val}%)</span>` : '';
}

function renderOfferSummaryFooter(count, weight, price, showOrderSelection) {
    const colspan = showOrderSelection ? 5 : 4;
    return `<tfoot>
        <tr style="border-top:2px solid var(--border-glass);">
          <td colspan="${colspan}" style="font-weight:700; font-size:0.9rem; color:var(--text-primary); padding:1rem 0.5rem;">RAZEM (${count} studni)</td>
          <td class="text-right" style="font-weight:700; font-size:0.85rem; color:var(--text-muted);">${fmtInt(weight)} kg</td>
          <td class="text-right" style="font-weight:800; font-size:1rem; color:var(--success);">${fmtInt(price)} PLN</td>
        </tr>
      </tfoot>`;
}

function updateOfferSummaryUI(totals) {
    const totalEl = document.getElementById('sum-total-netto');
    const bruttoEl = document.getElementById('sum-brutto-details');
    const weightEl = document.getElementById('sum-netto-weight');
    const transCostEl = document.getElementById('sum-transport-cost');

    if (totals.totalTransportCost > 0) {
        if (transCostEl) transCostEl.innerHTML = fmtInt(totals.totalTransportCost) + ' PLN';
        const transDetails = document.getElementById('transport-breakdown');
        if (transDetails) {
            transDetails.innerHTML = `<div style="font-size:0.75rem; color:var(--text-muted); background:rgba(15,23,42,0.4); padding:0.6rem 0.8rem; border-radius:8px; border:1px solid rgba(255,255,245,0.05); margin-bottom:0.8rem;">
             <i data-lucide="route" style="width:14px; height:14px; margin-right:4px;"></i> Łączny ciężar: <strong>${fmtInt(totals.globalWeight)} kg</strong> (${totals.totalTransports} transporty). 
             Koszt trasy: <strong>${fmtInt(totals.transportCostPerTrip)} PLN</strong>. Łącznie transport: <strong>${fmtInt(totals.totalTransportCost)} PLN</strong>.
           </div>`;
        }
    } else {
        if (transCostEl) transCostEl.textContent = '0 PLN';
        const transDetails = document.getElementById('transport-breakdown');
        if (transDetails) transDetails.innerHTML = '';
    }

    let finalNetto = 0;
    let finalWeight = 0;
    wells.forEach(w => {
        const s = calcWellStats(w);
        finalNetto += s.price + (totals.globalWeight > 0 ? totals.totalTransportCost * (s.weight / totals.globalWeight) : 0);
        finalWeight += s.weight;
    });

    if (totalEl) totalEl.textContent = fmtInt(finalNetto) + ' PLN';
    if (bruttoEl) bruttoEl.textContent = 'Brutto: ' + fmtInt(finalNetto * 1.23) + ' PLN';
    if (weightEl) weightEl.textContent = fmtInt(finalWeight) + ' kg';
}


/* ===== OFERTY STUDNIE (API SERWERA) ===== */

/**
 * Normalizuje obiekt oferty poprzez spłaszczenie właściwości .data do poziomu nadrzędnego.
 * Jest to potrzebne, ponieważ backend przechowuje zagnieżdżone dane w obiekcie JSON,
 * ale UI oczekuje płaskich pól, takich jak offer.wells, offer.clientName itp.
 */
function normalizeOfferData(doc) {
    if (!doc) return doc;
    if (doc.data && typeof doc.data === 'object' && !Array.isArray(doc.data)) {
        const fields = [
            'items',
            'wells',
            'totalNetto',
            'totalBrutto',
            'number',
            'clientName',
            'clientNip',
            'clientAddress',
            'clientContact',
            'clientPhone',
            'investName',
            'investAddress',
            'investContractor',
            'notes',
            'paymentTerms',
            'validity',
            'transportKm',
            'transportRate',
            'wellDiscounts',
            'visiblePrzejsciaTypes',
            'date',
            'history',
            'userName',
            'lastEditedBy',
            'createdByUserId',
            'createdByUserName',
            'userId'
        ];
        for (const key of fields) {
            const val = doc.data[key];
            if (
                val !== undefined &&
                val !== null &&
                (doc[key] === undefined || doc[key] === null)
            ) {
                doc[key] = val;
            }
        }
        // Mapowania awaryjne dla alternatywnych nazw pól
        if (!doc.number && doc.data.offerNumber) doc.number = doc.data.offerNumber;
        if (!doc.date && doc.data.offerDate) doc.date = doc.data.offerDate;
        if (!doc.totalNetto && doc.data.summary && doc.data.summary.totalValue)
            doc.totalNetto = doc.data.summary.totalValue;
        if (!doc.totalBrutto && doc.data.summary && doc.data.summary.totalBrutto)
            doc.totalBrutto = doc.data.summary.totalBrutto;
    }
    return doc;
}

async function loadOffersStudnie() {
    try {
        const res = await fetch('/api/offers-studnie', { headers: authHeaders() });
        const json = await res.json();
        const rawOffers = json.data || [];
        // Normalizuj każdą ofertę, aby spłaszczyć właściwości .data (numer, data, studnie itp.)
        return rawOffers.map((o) => normalizeOfferData(o));
    } catch (e) {
        console.error('Błąd ładowania ofert:', e);
        return [];
    }
}

async function saveOffersDataStudnie(data) {
    // Ta funkcja nie jest już używana, ponieważ oferty są zapisywane indywidualnie za pomocą saveOfferStudnie
    // i pobierane za pomocą loadOffersStudnie, które teraz bezpośrednio korzysta z REST API.
}

/* ===== PODSUMOWANIE OFERTY (Studnie) ===== */
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
                editingOfferAssignedUserName =
                    selectedUser.firstName && selectedUser.lastName
                        ? `${selectedUser.firstName} ${selectedUser.lastName}`
                        : selectedUser.displayName || selectedUser.username;
                showToast(`Opiekun zmieniony na: ${editingOfferAssignedUserName}`, 'success');

                const btnChangeUser = document.getElementById('btn-change-offer-user');
                if (btnChangeUser)
                    btnChangeUser.innerHTML = `<i data-lucide="user"></i> Opiekun: ${editingOfferAssignedUserName}`;

                if (editingOfferIdStudnie) {
                    saveOfferStudnie();

                    // Przenieś zmianę opiekuna na powiązane zamówienie
                    const oId = normalizeId(editingOfferIdStudnie);
                    const linkedOrder = ordersStudnie
                        ? ordersStudnie.find((o) => normalizeId(o.offerId) === oId)
                        : null;
                    if (linkedOrder) {
                        linkedOrder.userId = editingOfferAssignedUserId;
                        linkedOrder.userName = editingOfferAssignedUserName;
                        fetch(`/api/orders-studnie/${linkedOrder.id}`, {
                            method: 'PATCH',
                            headers: authHeaders(),
                            body: JSON.stringify({
                                userId: linkedOrder.userId,
                                userName: linkedOrder.userName
                            })
                        }).catch((e) =>
                            console.error('Błąd aktualizacji opiekuna w zamówieniu:', e)
                        );
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
    const offer = offersStudnie.find((o) => o.id === offerId);
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
                offer.userName =
                    selectedUser.firstName && selectedUser.lastName
                        ? `${selectedUser.firstName} ${selectedUser.lastName}`
                        : selectedUser.displayName || selectedUser.username;

                const { storageService } = await import('../shared/StorageService.js');
                await storageService.saveOffer(offer);

                // Przenieś zmianę opiekuna na powiązane zamówienie
                const oId = normalizeId(offerId);
                const linkedOrder = ordersStudnie
                    ? ordersStudnie.find((o) => normalizeId(o.offerId) === oId)
                    : null;
                if (linkedOrder) {
                    linkedOrder.userId = offer.userId;
                    linkedOrder.userName = offer.userName;
                    fetch(`/api/orders-studnie/${linkedOrder.id}`, {
                        method: 'PATCH',
                        headers: authHeaders(),
                        body: JSON.stringify({
                            userId: linkedOrder.userId,
                            userName: linkedOrder.userName
                        })
                    }).catch((e) => console.error('Błąd aktualizacji opiekuna w zamówieniu:', e));
                }

                showToast(`Opiekun zmieniony na: ${offer.userName}`, 'success');
                renderSavedOffersStudnie();

                if (editingOfferIdStudnie === offerId) {
                    editingOfferAssignedUserId = offer.userId;
                    editingOfferAssignedUserName = offer.userName;
                    const btnChangeUser = document.getElementById('btn-change-offer-user');
                    if (btnChangeUser) btnChangeUser.innerHTML = `<i data-lucide="user"></i> Opiekun: ${offer.userName}`;
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

    if (isOfferLocked()) {
        showToast(OFFER_LOCKED_MSG, 'error');
        return false;
    }
    const number = document.getElementById('offer-number').value.trim();
    if (!number) {
        showToast('Wprowadź numer oferty', 'error');
        return false;
    }

    const date = document.getElementById('offer-date').value;
    const clientName = document.getElementById('client-name').value.trim();
    const clientNip = document.getElementById('client-nip').value.trim();
    const clientAddress = document.getElementById('client-address').value.trim();
    const clientContact = document.getElementById('client-contact').value.trim();
    const investName = document.getElementById('invest-name').value.trim();
    const investAddress = document.getElementById('invest-address').value.trim();
    const investContractor = document.getElementById('invest-contractor').value.trim();
    const notes = document.getElementById('offer-notes').value.trim();
    const paymentTerms =
        document.getElementById('offer-payment-terms')?.value.trim() ||
        'Do uzgodnienia lub według indywidualnych warunków handlowych.';
    const validity = document.getElementById('offer-validity')?.value.trim() || '7 dni';
    const transportKm = parseFloat(document.getElementById('transport-km').value) || 0;
    const transportRate = parseFloat(document.getElementById('transport-rate').value) || 0;

    let totalNetto = 0;
    let totalWeight = 0;
    wells.forEach((well) => {
        const stats = calcWellStats(well);
        totalNetto += stats.price;
        totalWeight += stats.weight;
    });

    // --- TELEMETRIA: Pętla Sprzężenia Zwrotnego ---
    // Znajdź pierwszą studnię która została zmieniona z AUTO_AI na MANUAL i nie ma zapisanego powodu
    const unjustifiedWell = wells.find(
        (w) => w.configSource === 'MANUAL' && w.originalAutoConfig && !w.overrideReason
    );

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
            } catch (e) {
                console.error('Błąd wysyłki telemetrii:', e);
            }

            // Wznów zapis
            saveOfferStudnie();
        });
    }
    // --- KONIEC TELEMETRII ---

    isSavingOffer = true;

    // Automatyczny wybór opiekuna dla nowych ofert (tylko admin / pro)
    if (
        !editingOfferIdStudnie &&
        currentUser &&
        (currentUser.role === 'admin' || currentUser.role === 'pro') &&
        !editingOfferAssignedUserId
    ) {
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
                if (btnChangeUser)
                    btnChangeUser.innerHTML = `<i data-lucide="user"></i> Opiekun: ${editingOfferAssignedUserName}`;
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
        } catch (e) {
            console.warn('[OfferManager] Nie udało się pobrać istniejącej oferty studni do edycji:', e);
        }
    }

    const simpleId = editingOfferIdStudnie || 'offer_studnie_' + Date.now();

    // Oblicz koszty transportu per studnia
    let globalWeightForTransport = 0;
    wells.forEach((w) => (globalWeightForTransport += calcWellStats(w).weight));
    const transportKmVal = parseFloat(document.getElementById('transport-km').value) || 0;
    const transportRateVal = parseFloat(document.getElementById('transport-rate').value) || 0;
    let totalTransportCostForOffer = 0;
    if (transportKmVal > 0 && transportRateVal > 0) {
        const totalTransportsCount = Math.ceil(globalWeightForTransport / 24000);
        const costPerTrip = transportKmVal * transportRateVal;
        totalTransportCostForOffer = totalTransportsCount * costPerTrip;
    }

    // Przygotuj wells z obliczonymi cenami dla backendu (PDF/Word export)
    const wellsForExport = wells.map((well) => {
        const stats = calcWellStats(well);
        const wellTransportCost =
            globalWeightForTransport > 0
                ? totalTransportCostForOffer * (stats.weight / globalWeightForTransport)
                : 0;
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

    const offerDoc = {
        id: simpleId,
        type: 'studnia_oferta',
        userId:
            editingOfferAssignedUserId ||
            existingDoc?.userId ||
            (currentUser ? currentUser.id : null),
        userName:
            editingOfferAssignedUserName ||
            existingDoc?.userName ||
            (currentUser
                ? currentUser.firstName && currentUser.lastName
                    ? `${currentUser.firstName} ${currentUser.lastName}`
                    : currentUser.username
                : ''),
        createdByUserId:
            editingOfferCreatedByUserId ||
            existingDoc?.createdByUserId ||
            (currentUser ? currentUser.id : null),
        createdByUserName:
            editingOfferCreatedByUserName ||
            existingDoc?.createdByUserName ||
            (currentUser
                ? currentUser.firstName && currentUser.lastName
                    ? `${currentUser.firstName} ${currentUser.lastName}`
                    : currentUser.username
                : ''),
        number,
        date,
        clientName,
        clientNip,
        clientAddress,
        clientContact,
        investName,
        investAddress,
        investContractor,
        notes,
        paymentTerms,
        validity,
        wells: JSON.parse(JSON.stringify(wells)),
        wellsExport: wellsForExport,
        visiblePrzejsciaTypes: Array.from(visiblePrzejsciaTypes),
        transportKm,
        transportRate,
        wellDiscounts:
            typeof wellDiscounts !== 'undefined'
                ? JSON.parse(JSON.stringify(wellDiscounts || {}))
                : {},
        totalWeight,
        totalNetto,
        totalBrutto: totalNetto * 1.23,
        createdAt: existingDoc?.createdAt || new Date().toISOString(),
        lastEditedBy: currentUser
            ? currentUser.firstName && currentUser.lastName
                ? `${currentUser.firstName} ${currentUser.lastName}`
                : currentUser.username
            : ''
    };

    try {
        if (!offerDoc.wells || offerDoc.wells.length === 0) {
            showToast('Błąd: Nie można zapisać pustej oferty.', 'error');
            return;
        }
        const result = await storageService.saveOffer(offerDoc);
        showToast('Oferta zapisana <i data-lucide="check"></i>', 'success');
        const savedId = result.id || offerDoc.id;
        editingOfferIdStudnie = savedId;

        // Aktualizuj lokalną tablicę dla natychmiastowego renderowania przy użyciu potwierdzonego ID
        const idx = offersStudnie.findIndex((o) => o.id === editingOfferIdStudnie);
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
        <h3 style="color:#f59e0b; font-weight:700; margin-bottom:0.5rem;"><i data-lucide="bot"></i> Pętla Sprzężenia AI</h3>
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
    if (document.getElementById('offer-payment-terms'))
        document.getElementById('offer-payment-terms').value =
            'Do uzgodnienia lub według indywidualnych warunków handlowych.';
    if (document.getElementById('offer-validity'))
        document.getElementById('offer-validity').value = '7 dni';
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
    if (titleEl) titleEl.innerHTML = `<i data-lucide="clipboard-list"></i> Dane klienta i oferty (Nowa)`;
    const btnEl2 = document.getElementById('btn-save-studnie-offer');
    if (btnEl2) btnEl2.innerHTML = `<i data-lucide="save"></i> Zapisz ofertę`;

    const btnChangeUser = document.getElementById('btn-change-offer-user');
    if (btnChangeUser) {
        btnChangeUser.style.display =
            currentUser && (currentUser.role === 'admin' || currentUser.role === 'pro')
                ? 'inline-block'
                : 'none';
        btnChangeUser.innerHTML = `<i data-lucide="user"></i> Zmień opiekuna`;
    }

    refreshAll();
    showSection('builder');
    renderOfferSummary();
    // Reset kreatora do kroku 1
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

    container.innerHTML = offersStudnie
        .sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt))
        .map((o) => {
            const oId = normalizeId(o.id);
            // Oblicz postęp zamówień częściowych
            const progress = typeof getOfferOrderProgress === 'function' 
                ? getOfferOrderProgress(oId, o.wells) 
                : { ordered: 0, total: (o.wells || []).length, percent: 0 };
            
            const hasOrder = progress.ordered > 0;
            const isFullyOrdered = progress.percent >= 100;
            
            let orderBadge = '';
            if (hasOrder) {
                const badgeColor = isFullyOrdered ? '#34d399' : '#60a5fa';
                const badgeBg = isFullyOrdered ? 'rgba(16,185,129,0.15)' : 'rgba(59,130,246,0.15)';
                const badgeBorder = isFullyOrdered ? 'rgba(16,185,129,0.4)' : 'rgba(59,130,246,0.4)';
                
                orderBadge = `<div style="display:inline-flex; align-items:center; gap:0.3rem; padding:0.2rem 0.6rem; background:${badgeBg}; border:2px solid ${badgeBorder}; border-radius:6px; margin-top:0.3rem;">
                <span style="font-size:0.85rem;"><i data-lucide="${isFullyOrdered ? 'check-circle' : 'package'}"></i></span>
                <span style="font-size:0.68rem; font-weight:800; color:${badgeColor}; text-transform:uppercase; letter-spacing:0.5px;">
                    ${isFullyOrdered ? 'Zrealizowana' : 'W realizacji'} (${progress.ordered}/${progress.total})
                </span>
               </div>`;
            }
            
            return `
        <div class="offer-list-item" ${hasOrder ? `style="border-left:3px solid ${isFullyOrdered ? '#34d399' : '#60a5fa'};"` : ''}>
            <div class="offer-info" style="min-width:0;">
                <div style="display:flex; justify-content:space-between; align-items:flex-start; flex-wrap:wrap; gap:0.5rem;">
                    <div style="display:flex; align-items:center; gap:0.5rem; flex-wrap:wrap;">
                        <h3 style="margin-bottom:0.2rem; word-break:break-all;">${o.number}</h3>
                        ${orderBadge}
                    </div>
                    <div style="font-weight:700; color:var(--text-primary); font-size: 0.9rem; white-space:nowrap;">
                        <i data-lucide="banknote"></i> ${fmt(o.totalBrutto)} PLN
                    </div>
                </div>
                <div class="meta" style="margin-top:0.3rem;">
                    <span><i data-lucide="calendar"></i> <strong>${o.date}</strong></span>
                    <span><i data-lucide="folder-open"></i> <strong>${o.wells.length}</strong> studnie</span>
                    ${(() => {
                        const resolveName = (rawName) => {
                            if (!rawName) return '';
                            if (window.globalUsersMap && window.globalUsersMap.has(rawName))
                                return window.globalUsersMap.get(rawName);
                            if (
                                typeof currentUser !== 'undefined' &&
                                currentUser &&
                                (rawName === currentUser.username || rawName === currentUser.id)
                            )
                                return currentUser.displayName || currentUser.username || rawName;
                            return rawName;
                        };
                        const creatorName = resolveName(o.createdByUserName || o.userName);
                        const assignedName = resolveName(o.userName);

                        let html = '';
                        if (creatorName === assignedName && creatorName) {
                            html += `<span style="color:var(--accent-hover)"><i data-lucide="user"></i> Autor i Opiekun: <strong>${creatorName}</strong></span>`;
                        } else {
                            if (creatorName)
                                html += `<span style="display:inline-block; margin-right:10px; color:#888;"><i data-lucide="pen-tool"></i>️ Autor: <strong>${creatorName}</strong></span>`;
                            if (assignedName)
                                html += `<span style="color:var(--accent-hover)"><i data-lucide="user"></i> Opiekun: <strong>${assignedName}</strong></span>`;
                        }
                        return html;
                    })()}
                    
                    <div style="display:inline-flex; gap:0.3rem; margin-left:0.5rem; font-size:0.65rem;">
                        <span style="background: rgba(52, 211, 153, 0.1); color: #34d399; padding: 1px 5px; border-radius: 4px; border: 1px solid rgba(52, 211, 153, 0.3);"><i data-lucide="save"></i> Zapisano</span>
                    </div>
                </div>
                ${
                    o.clientName || o.investName || o.clientContact
                        ? `
                <div class="offer-client-badges">
                    ${o.clientName ? `<div class="badge-client"><i data-lucide="building-2"></i> <strong>Klient:</strong> <span style="font-weight:500">${o.clientName}</span></div>` : ''}
                    ${o.investName ? `<div class="badge-invest"><i data-lucide="hard-hat"></i> <strong>Budowa:</strong> <span style="font-weight:500">${o.investName}</span></div>` : ''}
                </div>`
                        : ''
                }
            </div>
            <div class="offer-actions" style="display:flex; flex-wrap:wrap; gap:0.4rem; justify-content:flex-end; align-content:center;">
                <button class="btn btn-sm btn-primary" onclick="loadSavedOfferStudnie('${oId}')" title="Wczytaj">Wczytaj</button>
                <button class="btn btn-sm btn-secondary" onclick="exportJSONStudnie('${oId}')" title="Pobierz plik JSON"><i data-lucide="save"></i> JSON</button>
                ${currentUser && (currentUser.role === 'admin' || currentUser.role === 'pro') ? `<button class="btn btn-sm btn-secondary" onclick="changeOfferUserFromListStudnie('${oId}')" title="Zmień opiekuna"><i data-lucide="user"></i> Zmień opiekuna</button>` : ''}
                ${o.history && o.history.length > 0 ? `<button class="btn btn-sm btn-secondary" onclick="showOfferHistoryStudnie('${oId}')" title="Historia zmian"><i data-lucide="hourglass"></i> Historia</button>` : ''}
                <button class="btn btn-sm btn-danger" onclick="deleteOfferStudnie('${oId}')" title="Usuń"><i data-lucide="trash-2"></i> Usuń</button>
                ${
                    hasOrder && order
                        ? `
                    <button class="btn btn-sm" style="background:rgba(16,185,129,0.15); border:1px solid rgba(16,185,129,0.3); color:#34d399; font-size:0.75rem; font-weight:800; padding:0.4rem 0.8rem;" onclick="window.location.href='/studnie?order=${order.id}'" title="Otwórz zamówienie"><i data-lucide="package"></i> Otwórz zamówienie</button>
                    <button class="btn btn-sm" style="background:rgba(239,68,68,0.1); border:1px solid rgba(239,68,68,0.2); color:#f87171; font-size:0.6rem;" onclick="deleteOrderStudnie('${order.id}')" title="Usuń zamówienie"><i data-lucide="trash-2"></i> Zamówienie</button>
                `
                        : ''
                }
            </div>
        </div>
        `;
        })
        .join('');
}

/** Migruj stare dane studni (material -> nadbudowa/dennicaMaterial) */
function migrateWellData(wellsArr) {
    if (!wellsArr) return wellsArr;
    wellsArr.forEach((w) => {
        // Migruj stare pole 'material' do nowych 'nadbudowa' + 'dennicaMaterial'
        if (w.material && !w.nadbudowa) {
            w.nadbudowa = w.material;
        }
        if (w.material && !w.dennicaMaterial) {
            w.dennicaMaterial = w.material;
        }
        // Zapewnij wartości domyślne
        if (!w.nadbudowa) w.nadbudowa = 'betonowa';
        if (!w.dennicaMaterial) w.dennicaMaterial = 'betonowa';
        if (!w.klasaNosnosci_korpus) w.klasaNosnosci_korpus = 'D400';
        if (!w.klasaNosnosci_zwienczenie) w.klasaNosnosci_zwienczenie = 'D400';
        // Zapewnij istnienie tablic config i przejscia
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
        offer = offersStudnie.find((o) => o.id === id_or_doc);
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

    // Normalizacja inline — storageService jest tylko ESM i nie jest dostępny w zasięgu globalnym
    const normalized = normalizeOfferData(offer);

    orderEditMode = null; // wyjdź z trybu zamówienia, jeśli jest aktywny
    editingOfferIdStudnie = normalized.id || '';
    editingOfferAssignedUserId = normalized.userId || null;
    editingOfferAssignedUserName = normalized.userName || '';
    editingOfferCreatedByUserId = normalized.createdByUserId || null;
    editingOfferCreatedByUserName = normalized.createdByUserName || '';
    document.getElementById('offer-number').value = normalized.number || '';
    document.getElementById('offer-date').value =
        normalized.date || new Date().toISOString().slice(0, 10);
    document.getElementById('client-name').value = normalized.clientName || '';
    document.getElementById('client-nip').value = normalized.clientNip || '';
    document.getElementById('client-address').value = normalized.clientAddress || '';
    document.getElementById('client-contact').value = normalized.clientContact || '';
    document.getElementById('invest-name').value = normalized.investName || '';
    document.getElementById('invest-address').value = normalized.investAddress || '';
    document.getElementById('invest-contractor').value = normalized.investContractor || '';
    document.getElementById('offer-notes').value = normalized.notes || '';
    if (document.getElementById('offer-payment-terms'))
        document.getElementById('offer-payment-terms').value =
            normalized.paymentTerms ||
            'Do uzgodnienia lub według indywidualnych warunków handlowych.';
    if (document.getElementById('offer-validity'))
        document.getElementById('offer-validity').value = normalized.validity || '7 dni';
    document.getElementById('transport-km').value = normalized.transportKm || 100;
    document.getElementById('transport-rate').value = normalized.transportRate || 10;

    wellDiscounts = normalized.wellDiscounts
        ? JSON.parse(JSON.stringify(normalized.wellDiscounts))
        : {};
    visiblePrzejsciaTypes = new Set(normalized.visiblePrzejsciaTypes || []);

    wells = JSON.parse(JSON.stringify(normalized.wells || []));
    migrateWellData(wells);

    // Zawsze sprawdzaj, czy jakieś przejścia już są fizycznie dodane w studniach
    // i automatycznie włącz kategorię do widoku (aby nie trzeba było ich "wczytywać")
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

    currentWellIndex = 0;

    // Przywróć domyślne parametry poziomu oferty z wczytanych studni
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

    // Populate step 2 DOM fields from the first well so they match what was loaded
    if (wells.length > 0) {
        const firstWell = wells[0];
        ['nadbudowa', 'dennicaMaterial', 'wkladka', 'malowanieW', 'malowanieZ', 'klasaNosnosci_korpus', 'klasaNosnosci_zwienczenie'].forEach(param => {
            if(firstWell[param]) {
                const group = document.querySelector(`.param-group[data-param="${param}"]`);
                if(group) {
                    group.querySelectorAll('.param-tile').forEach(b => b.classList.remove('active'));
                    const targetTile = group.querySelector(`.param-tile[data-val="${firstWell[param]}"]`);
                    if(targetTile) targetTile.classList.add('active');
                }
            }
        });
        if(document.getElementById('powloka-name-w')) document.getElementById('powloka-name-w').value = firstWell.powlokaNameW || '';
        if(document.getElementById('malowanie-wew-cena')) document.getElementById('malowanie-wew-cena').value = firstWell.malowanieWewCena || '';
        if(document.getElementById('powloka-name-z')) document.getElementById('powloka-name-z').value = firstWell.powlokaNameZ || '';
        if(document.getElementById('malowanie-zew-cena')) document.getElementById('malowanie-zew-cena').value = firstWell.malowanieZewCena || '';
        
        if (typeof wizardConfirmedParams !== 'undefined') {
            ['nadbudowa', 'dennicaMaterial', 'wkladka', 'malowanieW', 'malowanieZ', 'klasaNosnosci_korpus', 'klasaNosnosci_zwienczenie'].forEach(param => {
                if(firstWell[param]) wizardConfirmedParams.add(param);
            });
        }
        if (typeof validateWizardStep2 === 'function') {
            validateWizardStep2();
        }
    }

    // Pomiń kreatora dla wczytanych ofert — przejdź bezpośrednio do widoku oferty
    if (typeof skipWizardToStep3 === 'function') skipWizardToStep3();
    showSection(sectionToShow);
    showToast('Wczytano ofertę: ' + (normalized.number || 'bez numeru'), 'info');

    // Aktualizacja UI (nagłówki i przyciski)
    const titleEl = document.getElementById('offer-form-title-studnie');
    if (titleEl)
        titleEl.innerHTML = `<i data-lucide="pencil"></i> Edycja Oferty: <span style="font-weight:700">${normalized.number || offer.id}</span>`;
    const btnEl2 = document.getElementById('btn-save-studnie-offer');
    if (btnEl2) btnEl2.innerHTML = `<i data-lucide="save"></i> Zapisz zmiany`;

    const btnChangeUser = document.getElementById('btn-change-offer-user');
    if (btnChangeUser) {
        btnChangeUser.style.display =
            currentUser && (currentUser.role === 'admin' || currentUser.role === 'pro')
                ? 'inline-block'
                : 'none';
        if (editingOfferAssignedUserName) {
            btnChangeUser.innerHTML = `<i data-lucide="user"></i> Opiekun: ${editingOfferAssignedUserName}`;
        } else {
            btnChangeUser.innerHTML = `<i data-lucide="user"></i> Zmień opiekuna`;
        }
    }

    // Pokaż baner blokady, jeśli oferta ma zamówienie
    if (typeof renderOfferLockBanner === 'function') renderOfferLockBanner();
}

// Globalne udostępnienie
window.loadSavedOfferStudnie = loadSavedOfferStudnie;

async function deleteOfferStudnie(id) {
    if (
        !(await appConfirm('Czy na pewno usunąć tę ofertę?', {
            title: 'Usuwanie oferty',
            type: 'danger'
        }))
    )
        return;
    try {
        const res = await fetch(`/api/offers-studnie/${id}`, {
            method: 'DELETE',
            headers: authHeaders()
        });
        if (!res.ok) {
            const err = await res.json();
            showToast(err.error || 'Błąd usuwania', 'error');
            return;
        }
        offersStudnie = offersStudnie.filter((o) => o.id !== id);
        renderSavedOffersStudnie();
        showToast('Oferta usunięta', 'info');
    } catch (err) {
        console.error('deleteOfferStudnie error:', err);
        showToast('Błąd połączenia z serwerem', 'error');
    }
}

function exportJSONStudnie(id) {
    const offer = offersStudnie.find((o) => o.id === id);
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
    input.onchange = (e) => {
        const file = e.target.files[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = (event) => {
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

/* --- Pomocnik Logiki Diagramu SVG --- */
window.decDiagramWellQty = function (idx) {
    const well = getCurrentWell();
    if (well && well.config[idx]) {
        updateWellQuantity(idx, well.config[idx].quantity - 1);
    }
};

window.svgDragStartIndex = -1;

window.svgPointerDown = function (ev, idx) {
    ev.preventDefault();
    const well = getCurrentWell();
    if (!well) return;

    // Jeśli modal Zlecenia jest otwarty, zaznacz element zamiast przeciągania
    const zlModal = document.getElementById('zlecenia-modal');
    if (zlModal && zlModal.classList.contains('active')) {
        const targetIdx = zleceniaElementsList.findIndex(
            (el) => el.wellIndex === currentWellIndex && el.elementIndex === idx
        );
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
        const grps = Array.from(
            dz.querySelectorAll('g.diag-comp-grp:not([pointer-events="none"])')
        );

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

document.addEventListener(
    'touchmove',
    (ev) => {
        if (window.svgDragStartIndex >= 0 && ev.touches.length > 0) {
            handleLiveSvgDrag(ev.touches[0].clientY);
        }
    },
    { passive: false }
);

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
            well.config.forEach((c) => (c.isPlaceholder = false));
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

        // Reset wizualny stanu kosza
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

let dragOverCount = 0; // dla wizualizacji drag & drop

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
        actionBadge = `<span style="background:rgba(239,68,68,0.15); color:#f87171; padding:4px 10px; border-radius:6px; font-size:0.75rem; font-weight:800; letter-spacing:0.5px;"><i data-lucide="trash-2"></i> USUNIĘTO</span>`;
        const oldData = log.oldData || {};
        contentHtml = `<div style="font-size:0.9rem; color:#f87171;">Usunięta oferta${oldData.totalBrutto ? ` — wcześniej: <strong style="color:#fff;">${fmt(oldData.totalBrutto)} PLN</strong>` : ''}</div>`;
    } else if (log.action === 'create') {
        cardClass = 'action-create';
        actionBadge = `<span style="background:rgba(99,102,241,0.15); color:#818cf8; padding:4px 10px; border-radius:6px; font-size:0.75rem; font-weight:800; letter-spacing:0.5px;"><i data-lucide="sparkles"></i> UTWORZONO</span>`;
        const price = data.totalBrutto || 0;
        contentHtml = `<div style="font-size:1.2rem; font-weight:800; color:#f8fafc;"><i data-lucide="banknote"></i> ${fmt(price)} PLN</div>`;
        if (data.wells)
            contentHtml += `<div style="font-size:0.8rem; color:var(--text-secondary); margin-top:2px;"><i data-lucide="package"></i> ${data.wells.length} studni</div>`;
    } else if (isDiff) {
        cardClass = 'action-diff';
        actionBadge = `<span style="background:rgba(251,191,36,0.15); color:#fbbf24; padding:4px 10px; border-radius:6px; font-size:0.75rem; font-weight:800; letter-spacing:0.5px;"><i data-lucide="edit"></i> EDYCJA (DIFF)</span>`;
        const changedKeys = Object.keys(data).filter((k) => k !== '_diffMode');
        const changesHtml = changedKeys
            .map((k) => {
                const oldVal =
                    log.oldData && log.oldData[k] !== undefined ? log.oldData[k] : '(brak)';
                const newVal = data[k] !== undefined ? data[k] : '(brak)';
                if (
                    k === 'totalBrutto' ||
                    k === 'totalNetto' ||
                    k.toLowerCase().includes('price') ||
                    k.toLowerCase().includes('cena')
                ) {
                    return `<div class="diff-line"><strong class="diff-key">${k}</strong>: <span class="diff-old">${fmt(Number(oldVal))} PLN</span> <span style="color:var(--text-muted); font-size:0.8rem;"><i data-lucide="arrow-right"></i></span> <span class="diff-new">${fmt(Number(newVal))} PLN</span></div>`;
                }
                return `<div class="diff-line"><strong class="diff-key">${k}</strong>: <span class="diff-old">${JSON.stringify(oldVal)}</span> <span style="color:var(--text-muted); font-size:0.8rem;"><i data-lucide="arrow-right"></i></span> <span class="diff-new">${JSON.stringify(newVal)}</span></div>`;
            })
            .join('');
        contentHtml = `<div class="diff-container">${changesHtml}</div>`;
    } else {
        cardClass = 'action-update';
        actionBadge = `<span style="background:rgba(16,185,129,0.15); color:#34d399; padding:4px 10px; border-radius:6px; font-size:0.75rem; font-weight:800; letter-spacing:0.5px;"><i data-lucide="save"></i> ZAPIS / AKTUALIZACJA</span>`;
        const price = data.totalBrutto || 0;
        const oldPrice = log.oldData?.totalBrutto || 0;
        if (oldPrice && Math.abs(price - oldPrice) > 0.01) {
            contentHtml = `<div style="font-size:1.2rem; font-weight:800; color:#f8fafc;"><i data-lucide="banknote"></i> <span style="text-decoration:line-through;color:var(--text-muted);font-size:0.95rem;font-weight:600;">${fmt(oldPrice)}</span> <span style="color:var(--text-muted); font-size:0.9rem; margin:0 4px;"><i data-lucide="arrow-right"></i></span> ${fmt(price)} PLN</div>`;
        } else {
            contentHtml = `<div style="font-size:1.2rem; font-weight:800; color:#f8fafc;"><i data-lucide="banknote"></i> ${fmt(price)} PLN</div>`;
        }
        if (data.wells)
            contentHtml += `<div style="font-size:0.8rem; color:var(--text-secondary); margin-top:2px;"><i data-lucide="package"></i> ${data.wells.length} studni</div>`;
    }

    const restoreBtnHtml =
        !isDelete && !isDiff
            ? `
        <button class="btn btn-sm btn-secondary restore-btn" onclick="restoreHistorySnapshot('${log.id}')"><i data-lucide="refresh-cw"></i> Przywróć</button>
    `
            : '';

    const buttonsHtml = `
        <div style="display:flex; gap:0.4rem;">
            <button class="btn btn-sm btn-secondary preview-btn" onclick="viewHistorySnapshot('${log.id}')"><i data-lucide="eye"></i>️ Podgląd</button>
            ${restoreBtnHtml}
        </div>
    `;

    return `
        <div class="audit-card ${cardClass}">
            <div class="audit-card-header">
                <div style="display:flex; align-items:center; gap:0.6rem;">
                    ${actionBadge}
                    <span class="audit-date"><i data-lucide="calendar"></i> ${new Date(log.createdAt).toLocaleString()}</span>
                </div>
                <div class="audit-author">
                    <i data-lucide="user"></i>‍<i data-lucide="monitor"></i> <strong style="color:#e2e8f0;">${log.userName || 'System'}</strong>
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
        const res = await fetch(`/api/audit/studnia_oferta/${id}?limit=20&offset=0`, {
            headers: authHeaders()
        });
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
        const loadMoreHtml =
            logs.length < total
                ? `<div id="audit-load-more-wrap" style="text-align:center; padding:1.5rem 0 0.5rem 0;">
                   <button class="load-more-btn" onclick="loadMoreAuditLogs('studnia_oferta', '${id}', 20)"><i data-lucide="scroll-text"></i> Załaduj starsze zmiany (${total - logs.length} pozostało)</button>
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
                    <button class="btn-icon" style="background:rgba(255,255,255,0.1); color:#fff; border-radius:50%; width:32px; height:32px; display:flex; align-items:center; justify-content:center;" onclick="closeModal()"><i data-lucide="x"></i></button>
                </div>
                <div id="audit-logs-container" style="padding:1.5rem; overflow-y:auto; flex:1; scrollbar-width:thin;">
                    ${historyHtml}
                    ${loadMoreHtml}
                </div>
            </div>
        `;
        document.body.appendChild(overlay);
        overlay.classList.add('active');
        overlay.addEventListener('click', (e) => {
            if (e.target === overlay) closeModal();
        });

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
        const res = await fetch(
            `/api/audit/${entityType}/${entityId}?limit=${limit}&offset=${offset}`,
            { headers: authHeaders() }
        );
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
            container.insertAdjacentHTML(
                'beforeend',
                `
                <div id="audit-load-more-wrap" style="text-align:center; padding:1.5rem 0 0.5rem 0;">
                    <button class="load-more-btn" onclick="loadMoreAuditLogs('${entityType}', '${entityId}', ${limit})"><i data-lucide="scroll-text"></i> Załaduj starsze zmiany (${remaining} pozostało)</button>
                </div>
            `
            );
        }
    } catch (e) {
        console.error('Błąd ładowania kolejnych logów:', e);
    }
}

async function viewHistorySnapshot(logId) {
    const log = window.currentAuditLogs?.find((l) => l.id === logId);
    if (!log) return;

    try {
        const entityType = log.entityType;
        const entityId = log.entityId;

        const res = await fetch(`/api/audit/rebuild/${entityType}/${entityId}/${logId}`, {
            headers: authHeaders()
        });
        if (!res.ok) {
            const err = await res.json().catch(() => ({}));
            throw new Error(err.error || 'Błąd odtwarzania z serwera.');
        }

        const json = await res.json();
        const rebuiltData = json.data;

        if (entityType === 'order' && typeof window.loadOrderSnapshot === 'function') {
            window.loadOrderSnapshot(rebuiltData, entityId);
            showToast('<i data-lucide="eye"></i>️ Wczytano archiwalną wersję ZAMÓWIENIA w trybie READ-ONLY', 'info');
        } else {
            loadSavedOfferStudnie(rebuiltData);
            showToast('<i data-lucide="eye"></i>️ Wczytano wersję historyczną do testowego podglądu', 'info');
            if (typeof window.applyPreviewLockUI === 'function') window.applyPreviewLockUI();
        }

        closeModal();
    } catch (e) {
        console.error('Błąd podglądu:', e);
        showToast('Błąd podglądu: ' + e.message, 'error');
    }
}

async function restoreHistorySnapshot(logId) {
    const log = window.currentAuditLogs?.find((l) => l.id === logId);
    if (!log || !log.newData) return;

    if (
        !(await appConfirm(
            'Czy na pewno chcesz przywrócić tę wersję? Aktualne zmiany zostaną nadpisane przy następnym zapisie.',
            { title: 'Przywrócenie wersji', type: 'warning', okText: 'Przywróć' }
        ))
    )
        return;

    if (log.entityType === 'order' && typeof window.loadOrderSnapshot === 'function') {
        window.loadOrderSnapshot(log.newData, log.entityId);
        // Wymuś tryb odblokowania dla przywracania
        window.isPreviewMode = false;
        const banner = document.getElementById('preview-lock-banner');
        if (banner) banner.remove();
        document
            .querySelectorAll('.drop-zone, #svg-trash, #studnie-product-list, .actions-bar')
            .forEach((el) => {
                el.style.pointerEvents = '';
                el.style.opacity = '1';
            });
        showToast(
            '<i data-lucide="refresh-cw"></i> Przywrócono ZAMÓWIENIE z historii. Zapisz pomyślnie używając guzika "Zapisz zamówienie".',
            'success'
        );
    } else {
        loadSavedOfferStudnie(log.newData);
        showToast('<i data-lucide="refresh-cw"></i> Przywrócono wersję historyczną. Zapisz ofertę, aby zatwierdzić.', 'success');
    }

    closeModal();
}
/* ===== WYBÓR STUDNI DO ZAMÓWIENIA ===== */

/** Zaznacza/odznacza wszystkie dostępne studnie w tabeli podsumowania */
function toggleAllWellsForOrder(checked) {
    const checkboxes = document.querySelectorAll('.well-order-checkbox');
    checkboxes.forEach((cb) => {
        cb.checked = checked;
    });
    updateOrderSelectionCount();
}

/** Aktualizuje licznik zaznaczonych studni (opcjonalnie do logiki UI w przyszłości) */
function updateOrderSelectionCount() {
    const count = document.querySelectorAll('.well-order-checkbox:checked').length;
    const total = document.querySelectorAll('.well-order-checkbox').length;
    
    // Zaktualizuj stan nagłówkowego checkboxa
    const headerCheckbox = document.getElementById('select-all-wells-for-order');
    if (headerCheckbox) {
        headerCheckbox.checked = count > 0 && count === total;
        headerCheckbox.indeterminate = count > 0 && count < total;
    }
}

window.toggleAllWellsForOrder = toggleAllWellsForOrder;
window.updateOrderSelectionCount = updateOrderSelectionCount;
