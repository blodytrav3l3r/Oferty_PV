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
      <td>${well.config.length}</td>
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
            if (p.componentType === 'dennica' || p.componentType === 'kineta') {
                if (disc.dennica > 0) discStr = ` <span style="font-size:0.6rem; color:#10b981; margin-left:0.3rem;">(-${disc.dennica}%)</span>`;
            } else {
                if (disc.nadbudowa > 0) discStr = ` <span style="font-size:0.6rem; color:#10b981; margin-left:0.3rem;">(-${disc.nadbudowa}%)</span>`;
            }

            const itemPrice = getItemAssessedPrice(well, p, true);
            let totalLinePrice = itemPrice * item.quantity;

            if (p.componentType === 'dennica') {
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
                // Dodaj też część kosztu transportu studni do dennicy
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

            const isBottommost = (index === well.config.length - 1);
            if (isBottommost && well.doplata) {
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

            if (isBottommost && well.doplata) {
                html += `<tr style="opacity:0.6; color:#10b981;">
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

            // Podpunkt dla kinety, jeśli renderujemy dennicę
            if (p.componentType === 'dennica') {
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

                // Dodaj wiersz "Transport" pod dennicą, jeśli istnieje koszt
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
async function loadOffersStudnie() {
    try {
        if (window.pvSalesUI && window.pvSalesUI.marketplaceManager) {
            const db = window.pvSalesUI.marketplaceManager.localOffers;
            const result = await db.find({
                selector: { type: 'studnia_oferta' }
            });
            return result.docs.map(doc => ({ ...doc, id: doc._id }));
        }

        const res = await fetch('/api/offers-studnie', { headers: authHeaders() });
        const json = await res.json();
        return json.data || [];
    } catch (err) {
        console.error('Błąd ładowania ofert studni:', err);
        return [];
    }
}

async function saveOffersDataStudnie(data) {
    try {
        if (window.pvSalesUI && window.pvSalesUI.marketplaceManager) {
            const { storageService } = await import('../shared/StorageService.js');
            for(const offer of data) {
                const doc = { ...offer, _id: offer.id, type: 'studnia_oferta' };
                await storageService.saveOffer(doc);
            }
            console.log('[StorageService] Studnie offers synced.');
        }
    } catch (err) {
        console.error('saveOffersDataStudnie error:', err);
    }
}



/* ===== OFFER SUMMARY (Studnie) ===== */
async function saveOfferStudnie() {
    if (isOfferLocked()) { showToast(OFFER_LOCKED_MSG, 'error'); return; }
    const number = document.getElementById('offer-number').value.trim();
    if (!number) { showToast('Wprowadź numer oferty', 'error'); return; }

    const date = document.getElementById('offer-date').value;
    const clientName = document.getElementById('client-name').value.trim();
    const clientNip = document.getElementById('client-nip').value.trim();
    const clientAddress = document.getElementById('client-address').value.trim();
    const clientContact = document.getElementById('client-contact').value.trim();
    const investName = document.getElementById('invest-name').value.trim();
    const investAddress = document.getElementById('invest-address').value.trim();
    const investContractor = document.getElementById('invest-contractor').value.trim();
    const notes = document.getElementById('offer-notes').value.trim();
    const transportKm = parseFloat(document.getElementById('transport-km').value) || 0;
    const transportRate = parseFloat(document.getElementById('transport-rate').value) || 0;

    let totalNetto = 0;
    let totalWeight = 0;
    wells.forEach(well => {
        const stats = calcWellStats(well);
        totalNetto += stats.price;
        totalWeight += stats.weight;
    });

    const { storageService } = await import('../shared/StorageService.js');
    
    let existingDoc = null;
    if (editingOfferIdStudnie) {
        try {
            existingDoc = await storageService.getOfferById(editingOfferIdStudnie);
        } catch (e) {}
    }

    const offerDoc = {
        _id: editingOfferIdStudnie || 'offer_studnie_' + Date.now(),
        _rev: existingDoc ? existingDoc._rev : undefined,
        type: 'studnia_oferta',
        userId: existingDoc?.userId || (currentUser ? currentUser.id : null),
        userName: existingDoc?.userName || (currentUser ? currentUser.username : ''),
        number, date, clientName, clientNip, clientAddress, clientContact, investName, investAddress, investContractor, notes,
        wells: JSON.parse(JSON.stringify(wells)),
        visiblePrzejsciaTypes: Array.from(visiblePrzejsciaTypes),
        transportKm,
        transportRate,
        totalWeight,
        totalNetto,
        totalBrutto: totalNetto * 1.23,
        createdAt: existingDoc?.createdAt || new Date().toISOString(),
        lastEditedBy: currentUser ? currentUser.username : ''
    };

    try {
        if (!offerDoc.wells || offerDoc.wells.length === 0) {
            showToast('Błąd: Nie można zapisać pustej oferty.', 'error');
            return;
        }
        const result = await storageService.saveOffer(offerDoc);
        showToast('Oferta zapisana ✔', 'success');
        editingOfferIdStudnie = result.id || offerDoc._id;

        // Update local array for immediate rendering
        const idx = offersStudnie.findIndex(o => o.id === offerDoc._id);
        if (idx >= 0) offersStudnie[idx] = { ...offerDoc, id: offerDoc._id };
        else offersStudnie.push({ ...offerDoc, id: offerDoc._id });

        renderSavedOffersStudnie();
    } catch (err) {
        console.error('[OfferManager] Save error:', err);
        showToast('Błąd zapisu oferty', 'error');
    }
}

function clearOfferForm() {
    editingOfferIdStudnie = null;
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
    document.getElementById('transport-km').value = '100';
    document.getElementById('transport-rate').value = '10';
    wells = [];
    wellCounter = 1;
    currentWellIndex = 0;
    offerDefaultZakonczenie = null;
    offerDefaultRedukcja = false;
    offerDefaultRedukcjaMinH = 2500;
    offerDefaultRedukcjaZak = null;
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
        const hasOrder = o.hasOrder || ordersStudnie.some(ord => ord.offerId === o.id);
        const order = ordersStudnie.find(ord => ord.offerId === o.id);
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
                    ${o.userName ? `<span style="color:var(--accent-hover)">👤 <strong>${o.userName}</strong></span>` : ''}
                    
                    <div style="display:inline-flex; gap:0.3rem; margin-left:0.5rem; font-size:0.65rem;">
                        <span style="background: rgba(52, 211, 153, 0.1); color: #34d399; padding: 1px 5px; border-radius: 4px; border: 1px solid rgba(52, 211, 153, 0.3);">💾 Lokalnie</span>
                        ${(() => {
                            const revNum = o._rev ? parseInt(o._rev.split('-')[0]) : 0;
                            const isSyncUpToDate = window.pvSalesUI && window.pvSalesUI.isSyncUpToDate;
                            const isAdminOrPro = window.pvSalesUI && window.pvSalesUI.syncManager && (window.pvSalesUI.syncManager.role === 'admin' || window.pvSalesUI.syncManager.role === 'pro');
                            const isSynced = revNum > 1 || isAdminOrPro || (isSyncUpToDate && revNum > 0);
                            
                            return isSynced 
                                ? `<span style="background: rgba(59, 130, 246, 0.1); color: #60a5fa; padding: 1px 5px; border-radius: 4px; border: 1px solid rgba(59, 130, 246, 0.3);">☁️ Klaster</span>`
                                : `<span style="background: rgba(245, 158, 11, 0.1); color: #fbbf24; padding: 1px 5px; border-radius: 4px; border: 1px solid rgba(245, 158, 11, 0.3);">⏳ Sync...</span>`;
                        })()}
                    </div>
                </div>
                ${o.clientName || o.investName || o.clientContact ? `
                <div class="offer-client-badges">
                    ${o.clientName ? `<div class="badge-client">🏢 <strong>Klient:</strong> <span style="font-weight:500">${o.clientName}</span></div>` : ''}
                    ${o.investName ? `<div class="badge-invest">🏗️ <strong>Budowa:</strong> <span style="font-weight:500">${o.investName}</span></div>` : ''}
                </div>` : ''}
            </div>
            <div class="offer-actions" style="display:flex; flex-wrap:wrap; gap:0.4rem; justify-content:flex-end; align-content:center;">
                <button class="btn btn-sm btn-primary" onclick="loadSavedOfferStudnie('${o.id}')" title="Wczytaj">Wczytaj</button>
                <button class="btn btn-sm btn-secondary" onclick="exportJSONStudnie('${o.id}')" title="Pobierz plik JSON">💾 JSON</button>
                ${(o.history && o.history.length > 0) ? `<button class="btn btn-sm btn-secondary" onclick="showOfferHistoryStudnie('${o.id}')" title="Historia zmian">⏳ Historia</button>` : ''}
                <button class="btn btn-sm btn-danger" onclick="deleteOfferStudnie('${o.id}')" title="Usuń">🗑️ Usuń</button>
                ${hasOrder && order ? `<button class="btn btn-sm" style="background:rgba(16,185,129,0.15); border:1px solid rgba(16,185,129,0.3); color:#34d399; font-size:0.62rem;" onclick="window.location.href='/studnie?order=${order.id}'" title="Otwórz zamówienie">📦 Otwórz</button>
                <button class="btn btn-sm" style="background:rgba(239,68,68,0.15); border:1px solid rgba(239,68,68,0.3); color:#f87171; font-size:0.6rem;" onclick="deleteOrderStudnie('${order.id}')" title="Usuń zamówienie">🗑️ Zamówienie</button>` : ''}
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
    });
    return wellsArr;
}

function loadSavedOfferStudnie(id_or_doc) {
    let offer;
    if (typeof id_or_doc === 'object') {
        offer = id_or_doc;
    } else {
        offer = offersStudnie.find(o => o.id === id_or_doc);
    }
    
    if (!offer) return;

    // Use normalization from storageService if available
    const normalized = (typeof storageService !== 'undefined' && storageService.normalizeOffer) 
        ? storageService.normalizeOffer(offer) 
        : offer;

    orderEditMode = null; // exit order mode if active
    editingOfferIdStudnie = normalized._id || normalized.id;
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
    document.getElementById('transport-km').value = normalized.transportKm || 100;
    document.getElementById('transport-rate').value = normalized.transportRate || 10;

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
    showSection('offer');
    showToast('Wczytano ofertę: ' + (normalized.number || 'bez numeru'), 'info');

    // Show lock banner if offer has order
    if (typeof renderOfferLockBanner === 'function') renderOfferLockBanner();
}

// Global expose
window.loadSavedOfferStudnie = loadSavedOfferStudnie;

function deleteOfferStudnie(id) {
    if (!confirm('Czy na pewno usunąć tę ofertę?')) return;
    offersStudnie = offersStudnie.filter(o => o.id !== id);
    saveOffersDataStudnie(offersStudnie);
    renderSavedOffersStudnie();
    showToast('Oferta usunięta', 'info');
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



/* ===== CLIENT DATABASE ===== */
async function loadClientsDb() {
    try {
        if (window.pvSalesUI && window.pvSalesUI.syncManager) {
            const db = window.pvSalesUI.syncManager.localClients;
            const result = await db.find({
                selector: { type: 'client' }
            });
            return result.docs.map(doc => ({ ...doc, id: doc._id }));
        }
        const res = await fetch('/api/clients', { headers: authHeaders() });
        const json = await res.json();
        return json.data || [];
    } catch (err) { console.error('loadClientsDb error:', err); return []; }
}

async function saveClientsDbData(data) {
    try {
        if (window.pvSalesUI && window.pvSalesUI.syncManager) {
            const db = window.pvSalesUI.syncManager.localClients;
            for(const client of data) {
                const doc = { ...client, _id: client.id, type: 'client' };
                try {
                    const existing = await db.get(client.id);
                    doc._rev = existing._rev;
                } catch(e) {}
                await db.put(doc);
            }
            return;
        }
        await fetch('/api/clients', { method: 'PUT', headers: authHeaders(), body: JSON.stringify({ data }) });
    } catch (err) { console.error('saveClientsDbData error:', err); }
}

function saveClientToDb() {
    const name = document.getElementById('client-name').value.trim();
    const nip = document.getElementById('client-nip').value.trim();
    const address = document.getElementById('client-address').value.trim();
    const contact = document.getElementById('client-contact').value.trim();

    if (!name) {
        showToast('Wprowadź nazwę firmy, aby zapisać klienta', 'error');
        return;
    }

    if (nip) {
        const existingByNip = clientsDb.find(c => c.nip === nip);
        if (existingByNip && existingByNip.name.toLowerCase() !== name.toLowerCase()) {
            showToast(`Firma z NIP ${nip} już istnieje w bazie danych`, 'error');
            return;
        }
    }

    const existingIdx = clientsDb.findIndex(c => c.name.toLowerCase() === name.toLowerCase());
    if (existingIdx >= 0) {
        if (confirm('Klient o takiej nazwie już istnieje. Zaktualizować dane?')) {
            clientsDb[existingIdx] = { ...clientsDb[existingIdx], name, nip, address, contact, updatedAt: new Date().toISOString() };
            saveClientsDbData(clientsDb);
            showToast('Zaktualizowano dane klienta', 'success');
        }
    } else {
        clientsDb.push({ id: Date.now().toString(), name, nip, address, contact, createdAt: new Date().toISOString() });
        saveClientsDbData(clientsDb);
        showToast('Zapisano nowego klienta', 'success');
    }
}

function showClientsDb() {
    const overlay = document.createElement('div');
    overlay.className = 'modal-overlay';
    overlay.id = 'clients-db-modal';

    overlay.innerHTML = `
    <div class="modal" style="max-width:1200px; width:95%; border-radius:12px; box-shadow:0 20px 25px -5px rgba(0,0,0,0.1); max-height:90vh; display:flex; flex-direction:column;">
      <div class="modal-header" style="border-bottom:1px solid var(--border); padding-bottom:0.8rem; margin-bottom:0;">
        <h3 style="font-size:1.25rem; font-weight:700; color:var(--text);">📂 Baza klientów <span style="font-size:0.8rem; font-weight:400; color:var(--text-muted);">(${clientsDb.length})</span></h3>
        <button class="btn-icon" onclick="closeModal()">✕</button>
      </div>
      <div style="padding:0.8rem 0; border-bottom:1px solid var(--border);">
        <div style="display:flex; gap:0.5rem; align-items:center;">
          <div style="position:relative; flex:1;">
            <input type="text" id="clients-search-input" placeholder="🔍 Szukaj po nazwie lub NIP..." 
              oninput="filterClientsDb(this.value)"
              style="width:100%; padding:0.6rem 0.8rem; border:1px solid var(--border); border-radius:8px; background:var(--bg); color:var(--text); font-size:0.85rem; outline:none; transition:border-color 0.2s;"
              onfocus="this.style.borderColor='var(--primary)'" onblur="this.style.borderColor='var(--border)'">
          </div>
        </div>
      </div>
      <div id="clients-db-list" style="flex:1; overflow-y:auto; padding:0.5rem 0;"></div>
    </div>`;

    document.body.appendChild(overlay);
    overlay.addEventListener('click', e => { if (e.target === overlay) closeModal(); });

    renderClientsDbList('');
    setTimeout(() => document.getElementById('clients-search-input')?.focus(), 100);
}

function filterClientsDb(query) {
    renderClientsDbList(query);
}

let editingClientId = null;

function renderClientsDbList(query) {
    const container = document.getElementById('clients-db-list');
    if (!container) return;

    const q = (query || '').toLowerCase().trim();
    const filtered = q ? clientsDb.filter(c =>
        (c.name && c.name.toLowerCase().includes(q)) ||
        (c.nip && c.nip.includes(q))
    ) : clientsDb;

    if (clientsDb.length === 0) {
        container.innerHTML = '<div style="text-align:center; color:var(--text-muted); padding:3rem; font-size:0.9rem;">Baza klientów jest pusta.<br><span style="font-size:0.8rem;">Zapisz klienta przyciskiem 💾 w formularzu oferty.</span></div>';
        return;
    }

    if (filtered.length === 0) {
        container.innerHTML = '<div style="text-align:center; color:var(--text-muted); padding:2rem; font-size:0.85rem;">Brak wyników dla „' + q + '"</div>';
        return;
    }

    let html = `<table style="width:100%; border-collapse:collapse; font-size:0.85rem;">
    <thead>
      <tr style="border-bottom:2px solid var(--border); color:var(--text-muted); font-size:0.75rem; text-transform:uppercase; letter-spacing:0.5px;">
        <th style="padding:0.5rem 0.8rem; text-align:left; font-weight:600;">Firma</th>
        <th style="padding:0.5rem 0.8rem; text-align:left; font-weight:600; width:130px;">NIP</th>
        <th style="padding:0.5rem 0.8rem; text-align:left; font-weight:600;">Adres</th>
        <th style="padding:0.5rem 0.8rem; text-align:left; font-weight:600;">Kontakt</th>
        <th style="padding:0.5rem 0.8rem; text-align:center; font-weight:600; width:80px;">Akcje</th>
      </tr>
    </thead>
    <tbody>`;

    filtered.forEach(c => {
        if (editingClientId === c.id) {
            html += `<tr style="border-bottom:1px solid var(--border-glass); background:rgba(99,102,241,0.05);">
                <td style="padding:0.4rem 0.6rem;"><input type="text" id="edit-client-name" class="form-input form-input-sm" value="${c.name.replace(/"/g, '&quot;')}" style="width:100%" onclick="event.stopPropagation()"></td>
                <td style="padding:0.4rem 0.6rem;"><input type="text" id="edit-client-nip" class="form-input form-input-sm" value="${(c.nip || '').replace(/"/g, '&quot;')}" style="width:100%" onclick="event.stopPropagation()"></td>
                <td style="padding:0.4rem 0.6rem;"><input type="text" id="edit-client-address" class="form-input form-input-sm" value="${(c.address || '').replace(/"/g, '&quot;')}" style="width:100%" onclick="event.stopPropagation()"></td>
                <td style="padding:0.4rem 0.6rem;"><input type="text" id="edit-client-contact" class="form-input form-input-sm" value="${(c.contact || '').replace(/"/g, '&quot;')}" style="width:100%" onclick="event.stopPropagation()"></td>
                <td style="padding:0.4rem 0.6rem; text-align:center; display:flex; gap:0.2rem; justify-content:center;">
                    <button class="btn-icon" onclick="event.stopPropagation(); saveEditedClientInDb('${c.id}')" title="Zapisz" style="color:var(--primary); font-size:1rem;">💾</button>
                    <button class="btn-icon" onclick="event.stopPropagation(); cancelEditClient()" title="Anuluj" style="color:var(--text-muted); font-size:0.85rem;">✕</button>
                </td>
            </tr>`;
        } else {
            let nameDisplay = c.name;
            let nipDisplay = c.nip || '—';

            if (q) {
                const nameIdx = c.name.toLowerCase().indexOf(q);
                if (nameIdx >= 0) {
                    nameDisplay = c.name.substring(0, nameIdx) + '<mark style="background:rgba(99,102,241,0.3); color:var(--text); padding:0 2px; border-radius:2px;">' + c.name.substring(nameIdx, nameIdx + q.length) + '</mark>' + c.name.substring(nameIdx + q.length);
                }
                if (c.nip) {
                    const nipIdx = c.nip.indexOf(q);
                    if (nipIdx >= 0) {
                        nipDisplay = c.nip.substring(0, nipIdx) + '<mark style="background:rgba(99,102,241,0.3); color:var(--text); padding:0 2px; border-radius:2px;">' + c.nip.substring(nipIdx, nipIdx + q.length) + '</mark>' + c.nip.substring(nipIdx + q.length);
                    }
                }
            }

            html += `<tr onclick="selectClientFromDb('${c.id}')" 
                style="border-bottom:1px solid var(--border-glass); cursor:pointer; transition:background 0.15s;"
                onmouseenter="this.style.background='rgba(99,102,241,0.06)'" 
                onmouseleave="this.style.background='transparent'">
                <td style="padding:0.6rem 0.8rem; font-weight:600; color:var(--text);">${nameDisplay}</td>
                <td style="padding:0.6rem 0.8rem; font-family:monospace; font-size:0.8rem; color:var(--text-secondary);">${nipDisplay}</td>
                <td style="padding:0.6rem 0.8rem; color:var(--text-muted); font-size:0.8rem;">${c.address || '—'}</td>
                <td style="padding:0.6rem 0.8rem; color:var(--text-muted); font-size:0.8rem;">${c.contact || '—'}</td>
                <td style="padding:0.6rem 0.8rem; text-align:center; display:flex; gap:0.2rem; justify-content:center;">
                    <button class="btn-icon" onclick="event.stopPropagation(); editClientInDb('${c.id}')" title="Edytuj" style="color:var(--text-secondary); font-size:0.85rem; opacity:0.8;">✏️</button>
                    <button class="btn-icon" onclick="event.stopPropagation(); deleteClientFromDb('${c.id}')" title="Usuń z bazy" style="color:var(--danger); font-size:0.85rem; opacity:0.6;" onmouseenter="this.style.opacity='1'" onmouseleave="this.style.opacity='0.6'">✕</button>
                </td>
            </tr>`;
        }
    });

    html += '</tbody></table>';
    container.innerHTML = html;
}

function editClientInDb(id) {
    editingClientId = id;
    const searchInput = document.getElementById('clients-search-input');
    renderClientsDbList(searchInput ? searchInput.value : '');
}

function saveEditedClientInDb(id) {
    const name = document.getElementById('edit-client-name').value.trim();
    const nip = document.getElementById('edit-client-nip').value.trim();
    const address = document.getElementById('edit-client-address').value.trim();
    const contact = document.getElementById('edit-client-contact').value.trim();

    if (!name) {
        showToast('Wprowadź nazwę firmy', 'error');
        return;
    }

    const client = clientsDb.find(c => c.id === id);
    if (client) {
        client.name = name;
        client.nip = nip;
        client.address = address;
        client.contact = contact;
        client.updatedAt = new Date().toISOString();
        saveClientsDbData(clientsDb);
        showToast('Zaktualizowano dane klienta', 'success');
    }
    editingClientId = null;
    const searchInput = document.getElementById('clients-search-input');
    renderClientsDbList(searchInput ? searchInput.value : '');
}

function cancelEditClient() {
    editingClientId = null;
    const searchInput = document.getElementById('clients-search-input');
    renderClientsDbList(searchInput ? searchInput.value : '');
}

function selectClientFromDb(id) {
    const c = clientsDb.find(client => client.id === id);
    if (c) {
        document.getElementById('client-name').value = c.name || '';
        document.getElementById('client-nip').value = c.nip || '';
        document.getElementById('client-address').value = c.address || '';
        document.getElementById('client-contact').value = c.contact || '';
        showToast('Wczytano dane klienta', 'success');
        closeModal();
    }
}

function deleteClientFromDb(id) {
    if (!confirm('Czy na pewno chcesz usunąć tego klienta z bazy?')) return;
    clientsDb = clientsDb.filter(c => c.id !== id);
    saveClientsDbData(clientsDb);

    const searchInput = document.getElementById('clients-search-input');
    renderClientsDbList(searchInput ? searchInput.value : '');
    showToast('Klient usunięty z bazy', 'info');
}

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

/* ===== OFFER HISTORY STUDNIE ===== */
function showOfferHistoryStudnie(id) {
    const offer = offersStudnie.find(o => o.id === id);
    if (!offer || !offer.history || offer.history.length === 0) {
        if(typeof window.showToast === 'function') window.showToast('Brak historii dla tej oferty', 'info');
        return;
    }

    const overlay = document.createElement('div');
    overlay.className = 'modal-overlay';
    overlay.id = 'offer-history-modal';

    let historyHtml = offer.history.map((h, i) => {
        const nextState = i === offer.history.length - 1 ? offer : offer.history[i + 1];
        const priceDiff = (nextState.totalBrutto || 0) - (h.totalBrutto || 0);

        let diffHtml = '';
        if (Math.abs(priceDiff) > 0.01) {
            if (priceDiff > 0) {
                diffHtml = `<span style="color:var(--danger); font-size:0.8rem; font-weight:700;">+${fmt(priceDiff)} PLN</span>`;
            } else {
                diffHtml = `<span style="color:var(--success); font-size:0.8rem; font-weight:700;">${fmt(priceDiff)} PLN</span>`;
            }
        } else {
            diffHtml = `<span style="color:var(--text-muted); font-size:0.8rem;">Bez zmian</span>`;
        }

        return `
            <div style="background:var(--bg-glass); border:1px solid var(--border-glass); border-radius:8px; padding:1rem; margin-bottom:0.8rem;">
                <div style="display:flex; justify-content:space-between; margin-bottom:0.5rem; border-bottom:1px dashed var(--border-glass); padding-bottom:0.4rem;">
                    <strong style="color:var(--text-primary);">${new Date(h.updatedAt).toLocaleString()}</strong>
                    <div style="text-align:right;">
                        <div style="font-size:0.75rem; color:var(--text-muted);">Zapisana przez: <strong style="color:var(--text-secondary);">${h.lastEditedBy || h.userName || '—'}</strong></div>
                        <div style="font-size:0.75rem; color:var(--text-muted);">Nadpisana przez: <strong style="color:var(--accent);">${nextState.lastEditedBy || nextState.userName || '—'}</strong></div>
                    </div>
                </div>
                <div style="display:flex; justify-content:space-between; align-items:center;">
                    <div>
                        <div style="font-size:0.85rem; color:var(--text-secondary);">Wersja przed zmianą</div>
                        <div style="font-size:1.1rem; font-weight:700;">💰 ${fmt(h.totalBrutto || 0)} PLN</div>
                        <div style="font-size:0.8rem; color:var(--text-muted);">Studni: ${h.wells ? h.wells.length : 0}</div>
                    </div>
                    <div style="text-align:right;">
                        <div style="font-size:0.8rem; color:var(--text-muted); margin-bottom:0.2rem;">Różnica do kolejnej wersji:</div>
                        ${diffHtml}
                        <div style="margin-top:0.6rem;">
                            <button class="btn btn-sm btn-secondary" onclick="restoreOfferVersionStudnie('${id}', ${i})">Przywróć tę wersję</button>
                        </div>
                    </div>
                </div>
            </div>
        `;
    }).reverse().join('');

    overlay.innerHTML = `
        <div class="modal" style="max-width:800px; width:95%; border-radius:12px; max-height:90vh; display:flex; flex-direction:column;">
            <div class="modal-header" style="border-bottom:1px solid var(--border); padding-bottom:0.8rem;">
                <h3 style="font-weight:700;">⏳ Historia zmian oferty: ${offer.number}</h3>
                <button class="btn-icon" onclick="closeModal()">✕</button>
            </div>
            <div style="padding:1rem 0; overflow-y:auto; flex:1;">
                ${historyHtml}
            </div>
        </div>
    `;
    document.body.appendChild(overlay);
    overlay.classList.add('active');
    overlay.addEventListener('click', e => { if (e.target === overlay) closeModal(); });
}

function restoreOfferVersionStudnie(offerId, historyIndex) {
    const offer = offersStudnie.find(o => o.id === offerId);
    if (!offer || !offer.history || !offer.history[historyIndex]) return;

    const snapshot = offer.history[historyIndex];
    loadSavedOfferStudnie(snapshot);

    if (typeof closeModal === 'function') closeModal();
    if (typeof window.showToast === 'function') window.showToast('Wersja z historii wczytana', 'success');
}

