// @ts-check
/* ===== PODSUMOWANIE OFERTY W ZAKŁADCE "OFERTA" ===== */

function renderOfferSummaryTab() {
    // 1. Zaktualizuj dane klienta i inwestycji
    const dispName = document.getElementById('offer-disp-name');
    if (dispName) dispName.textContent = document.getElementById('offer-client-name')?.value || '—';

    const dispNip = document.getElementById('offer-disp-nip');
    if (dispNip) dispNip.textContent = document.getElementById('offer-client-nip')?.value || '—';

    const dispNumber = document.getElementById('offer-disp-number');
    if (dispNumber) dispNumber.textContent = document.getElementById('offer-number')?.value || '—';

    const dispDate = document.getElementById('offer-disp-date');
    if (dispDate) dispDate.textContent = document.getElementById('offer-date')?.value || '—';

    const dispInvest = document.getElementById('offer-disp-invest');
    if (dispInvest)
        dispInvest.textContent = document.getElementById('offer-invest-name')?.value || '—';

    const dispTransport = document.getElementById('offer-disp-transport');
    if (dispTransport) {
        const km = document.getElementById('transport-km')?.value || '0';
        const rate = document.getElementById('transport-rate')?.value || '0';
        dispTransport.textContent = `${km} km × ${rate} PLN/km`;
    }

    // Jeśli pole uwag i warunków są puste, skopiuj defaulty
    const tabNotes = document.getElementById('offer-tab-notes');
    if (tabNotes && !tabNotes.value) {
        tabNotes.value = document.getElementById('offer-notes')?.value || '';
    }

    const tabPayment = document.getElementById('offer-tab-payment-terms');
    if (tabPayment && !tabPayment.value) {
        tabPayment.value = 'Do uzgodnienia lub według indywidualnych warunków handlowych.';
    }

    const tabValidity = document.getElementById('offer-tab-validity');
    if (tabValidity && !tabValidity.value) {
        tabValidity.value = '7 dni';
    }

    // 2. Wygeneruj tabelę z produktami (podobnie jak do wydruku, ale w HTML)
    const items = getActiveItemsArray();
    const transportResult = calculateTransports(items);
    const costPerTrip = getCostPerTrip();
    renderOfferSummaryTableTab(transportResult, costPerTrip);
}

function renderOfferSummaryTableTab(transportResult, costPerTrip) {
    const container = document.getElementById('offer-tab-summary-body');
    if (!container) return;

    const items = getActiveItemsArray();
    if (items.length === 0) {
        container.innerHTML = `<div style="text-align:center; padding:2rem; color:var(--text-muted);">Brak pozycji w ofercie</div>`;
        return;
    }

    const orderEditModeActive = window.orderEditMode;
    const orderData =
        orderEditModeActive && typeof getCurrentRuryOrder === 'function'
            ? getCurrentRuryOrder()
            : null;
    const showPriceComparison = !!(orderData && orderData.originalSnapshot);
    const snapshotByUid = showPriceComparison
        ? new Map(
              (orderData.originalSnapshot.items || [])
                  .filter((si) => si.uid)
                  .map((si) => [si.uid, si])
          )
        : null;

    const transportDist = calculateTransportDistribution(items, costPerTrip);

    let snapTransportDist = {};
    if (showPriceComparison && orderData.originalSnapshot) {
        const snap = orderData.originalSnapshot;
        const snapKm = snap.transportKm || 0;
        const snapRate = snap.transportRate || 0;
        const snapCostPerTrip = snapKm * snapRate;
        const snapMode = snap.transportMode || 'full';
        const snapItems = snap.items || [];
        if (
            snapItems.length > 0 &&
            snapCostPerTrip > 0 &&
            typeof calculateTransportDistribution === 'function'
        ) {
            const savedMode = currentRuryTransportMode;
            currentRuryTransportMode = snapMode;
            snapTransportDist = calculateTransportDistribution(snapItems, snapCostPerTrip);
            currentRuryTransportMode = savedMode;
        }
    }

    let progressHtml = '';
    if (!window.orderEditMode) {
        const offerId = window.editingOfferId;
        if (offerId && typeof getOrdersForOffer === 'function') {
            const offerOrders = getOrdersForOffer(offerId);
            if (offerOrders.length > 0) {
                const orderedUids = new Set();
                offerOrders.forEach((order) => {
                    (order.items || []).forEach((it) => {
                        if (it.uid) orderedUids.add(it.uid);
                    });
                });
                const total = items.length;
                const ordered = items.filter((it) => it.uid && orderedUids.has(it.uid)).length;
                const percent = total > 0 ? Math.round((ordered / total) * 100) : 0;
                if (ordered > 0) {
                    const color = percent >= 100 ? 'var(--success-hover)' : 'var(--blue-hover)';
                    progressHtml = `<div style="display:flex; align-items:center; gap:0.6rem; padding:0.5rem 0.8rem; margin-bottom:0.5rem; background:rgba(var(--blue-rgb),0.08); border:1px solid rgba(var(--blue-rgb),0.2); border-radius:8px;">
                        <div class="flex-1">
                            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:0.3rem;">
                                <span style="font-size:0.72rem; font-weight:700; color:var(--text-secondary);">
                                    <i data-lucide="package" aria-hidden="true"></i> Postęp zamówień
                                </span>
                                <span style="font-size:0.72rem; font-weight:800; color:${color};">
                                    ${ordered} / ${total} pozycji (${percent}%)
                                </span>
                            </div>
                            <div style="height:6px; background:rgba(255,255,255,0.08); border-radius:3px; overflow:hidden;">
                                <div style="height:100%; width:${percent}%; background:${color}; border-radius:3px; transition:width 0.3s ease;"></div>
                            </div>
                        </div>
                    </div>`;
                }
            }
        }
    }

    let html =
        progressHtml +
        `<div class="table-wrap table-wrap-scroll"><table style="width:100%; table-layout:auto;">
      <thead>
        <tr>
          <th style="width:36px; text-align:center; white-space:nowrap;"><input type="checkbox" id="select-all-offer-summary" onchange="toggleAllOfferSummaryForOrder(this.checked)" style="cursor:pointer;width:16px;height:16px"></th>
          <th style="width:1%; min-width:36px; text-align:center; white-space:nowrap;">Lp.</th>
          <th style="min-width:200px; max-width:320px; white-space:nowrap;">Produkt</th>
          <th style="width:1%; min-width:100px; text-align:right; white-space:nowrap;">Cena jedn.</th>
          <th style="width:1%; min-width:64px; text-align:right; white-space:nowrap;">Rabat</th>
          <th style="width:1%; min-width:120px; text-align:right; white-space:nowrap;">Cena po rabacie</th>
          <th style="width:1%; min-width:90px; text-align:right; white-space:nowrap;">Transp/szt</th>
          <th style="width:1%; min-width:210px; text-align:right; white-space:nowrap;">Cena po rabacie + Transp/szt</th>
          <th style="width:1%; min-width:80px; text-align:center; white-space:nowrap;">Ilość szt.</th>
          <th style="width:1%; min-width:120px; text-align:right; white-space:nowrap;">RAZEM NETTO</th>
          ${showPriceComparison ? '<th style="width:1%; min-width:120px; text-align:right; white-space:nowrap;">Cena z oferty</th>' : ''}
          ${showPriceComparison ? '<th style="width:1%; min-width:90px; text-align:right; white-space:nowrap;">Różnica</th>' : ''}
        </tr>
      </thead>
      <tbody>`;

    let totalNetto = 0;
    let totalOffer = 0;

    const { flat } = getSortedRuryItems(items);
    const sortedItems = [];
    flat.forEach((g) => g.entries.forEach((e) => sortedItems.push(e)));

    const catGroups = {};

    sortedItems.forEach(({ item }, i) => {
        const basePriceAfterDiscount = item.unitPrice * (1 - item.discount / 100);
        const pehdCost = item.pehdCostPerUnit || 0;
        const surcharge = item.surcharge || 0;
        const priceAfterDiscount = basePriceAfterDiscount + pehdCost + surcharge;
        const tpu = transportDist[item.productId] || 0;
        const unitTotal = priceAfterDiscount + tpu;
        const netto = unitTotal * item.quantity;

        totalNetto += netto;

        let snapOfferPrice = null;
        if (showPriceComparison && snapshotByUid) {
            const snapItem = snapshotByUid.get(item.uid);
            if (snapItem) {
                const bpa = snapItem.unitPrice * (1 - (snapItem.discount || 0) / 100);
                const ppu = (snapItem.pehdCostPerUnit || 0) + (snapItem.surcharge || 0);
                const tpuS = snapTransportDist[snapItem.productId] || 0;
                snapOfferPrice = (bpa + ppu + tpuS) * (snapItem.quantity || 0);
                totalOffer += snapOfferPrice;
            }
        }

        if (showPriceComparison) {
            const catKey = (() => {
                const product = products.find((p) => p.id === item.productId);
                return product ? product.category : 'Inne';
            })();
            if (!catGroups[catKey]) catGroups[catKey] = { count: 0, sumCurrent: 0, sumOffer: 0 };
            catGroups[catKey].count++;
            catGroups[catKey].sumCurrent += netto;
            if (snapOfferPrice !== null) catGroups[catKey].sumOffer += snapOfferPrice;
        }

        let pName = escapeHtml(item.name);
        if (item.pehdType === 'PEHD-3MM')
            pName +=
                ' <span style="font-size:0.65rem; padding:1px 4px; border-radius:3px; background:var(--warn); color:#1a1a1a; font-weight:700;">+ PEHD 3mm</span>';
        if (item.pehdType === 'PEHD-4MM')
            pName +=
                ' <span style="font-size:0.65rem; padding:1px 4px; border-radius:3px; background:var(--warn); color:#1a1a1a; font-weight:700;">+ PEHD 4mm</span>';
        if (item.autoAdded)
            pName +=
                ' <span style="font-size:.65rem;color:var(--warn);opacity:.8">(dodane automatycznie)</span>';
        if (item.surcharge) {
            const isPos = item.surcharge > 0;
            const color = isPos ? '#34d399' : '#f87171';
            const bg = isPos ? 'rgba(16,185,129,0.12)' : 'rgba(239,68,68,0.12)';
            const border = isPos ? 'rgba(16,185,129,0.4)' : 'rgba(239,68,68,0.3)';
            pName += ` <span style="font-size:0.65rem; padding:1px 4px; border-radius:3px; background:${bg}; color:${color}; border:1px solid ${border}; font-weight:700;">Dopłata: ${fmt(item.surcharge)}</span>`;
        }

        const isOrdered =
            typeof isItemInAnyOrder === 'function' ? isItemInAnyOrder(item.uid) : false;
        const summDiamRaw = getProductDiameter(item.productId) || 0;
        const summDiamAttr = summDiamRaw > 0 ? `data-diameter="${summDiamRaw}"` : '';
        const summAutoClass = item.autoAdded ? ' offer-summary-auto' : '';
        const summPipeHandler = item.autoAdded ? '' : ' onPipeCheckboxChange(this);';
        const summaryCheckboxCell = isOrdered
            ? '<td class="text-center"><i data-lucide="package-check" style="width:16px;height:16px;color:#a5b4fc"></i></td>'
            : `<td class="text-center" onclick="event.stopPropagation()"><input type="checkbox" class="offer-summary-checkbox${summAutoClass}" data-uid="${item.uid}" ${summDiamAttr} onchange="updateOfferSummarySelectionCount();${summPipeHandler}" style="cursor:pointer;width:16px;height:16px"></td>`;

        let offerCell = '';
        let diffCell = '';
        if (snapOfferPrice !== null) {
            const diff = netto - snapOfferPrice;
            const diffSign = diff >= 0 ? '+' : '';
            const diffColor = diff > 0 ? '#f87171' : diff < 0 ? '#34d399' : 'var(--text-muted)';
            offerCell = `<td style="text-align:right;font-weight:600;color:var(--text-secondary);white-space:nowrap;padding:0.5rem 0.75rem;">${fmt(snapOfferPrice)} PLN</td>`;
            diffCell = `<td style="text-align:right;font-weight:700;color:${diffColor};white-space:nowrap;padding:0.5rem 0.75rem;">${diffSign}${fmt(diff)} PLN</td>`;
        } else if (showPriceComparison) {
            offerCell =
                '<td style="text-align:right;color:var(--text-muted);font-weight:600;white-space:nowrap;padding:0.5rem 0.75rem;">—</td>';
            diffCell =
                '<td style="text-align:right;color:var(--text-muted);padding:0.5rem 0.75rem;">—</td>';
        }

        html += `<tr style="border-bottom:1px solid var(--border-glass); ${isOrdered ? 'border-left:3px solid rgba(99,102,241,0.5); background:rgba(99,102,241,0.04);' : ''}">
            ${summaryCheckboxCell}
            <td style="text-align:center; color:var(--text-muted); font-weight:600; white-space:nowrap;">${i + 1}</td>
            <td style="font-weight:600; color:var(--text-primary); max-width: 320px; overflow-wrap:break-word;">${pName}</td>
            <td style="text-align:right; color:var(--text-secondary); white-space:nowrap;">${fmt(item.unitPrice)}</td>
            <td style="text-align:right; color:var(--text-secondary); white-space:nowrap;">${item.discount}%</td>
            <td style="text-align:right; color:var(--text-secondary); white-space:nowrap;">${fmt(priceAfterDiscount)}</td>
            <td style="text-align:right; color:var(--warn); white-space:nowrap;">${tpu > 0 ? fmt(tpu) : '—'}</td>
            <td style="text-align:right; color:var(--text-primary); font-weight:600; white-space:nowrap;">${fmt(unitTotal)}</td>
            <td style="text-align:center; font-weight:600; white-space:nowrap;">${item.quantity} szt.</td>
            <td style="text-align:right; font-weight:700; color:var(--success); white-space:nowrap;">${fmt(netto)} PLN</td>
            ${offerCell}${diffCell}
        </tr>`;
    });

    html += `</tbody>`;

    if (showPriceComparison && Object.keys(catGroups).length > 0) {
        const sortedCats = Object.keys(catGroups).sort((a, b) => {
            const ia = CATEGORIES.indexOf(a);
            const ib = CATEGORIES.indexOf(b);
            return (ia === -1 ? 999 : ia) - (ib === -1 ? 999 : ib);
        });

        html += '<tfoot>';
        sortedCats.forEach((cat) => {
            const g = catGroups[cat];
            const catDiff = g.sumCurrent - g.sumOffer;
            const catDiffSign = catDiff >= 0 ? '+' : '';
            const catDiffColor =
                catDiff > 0 ? '#f87171' : catDiff < 0 ? '#34d399' : 'var(--text-muted)';
            html += `<tr style="border-top:1px solid rgba(255,255,255,0.05);">
                <td colspan="9" style="padding:0.6rem 0.5rem;font-size:0.85rem;color:var(--text-secondary);white-space:nowrap;">Podsumowanie ${cat} — ${g.count} szt.</td>
                <td class="text-right" style="font-size:0.85rem;color:var(--success);font-weight:700;white-space:nowrap;padding:0.5rem 0.75rem;">${fmt(g.sumCurrent)} PLN</td>
                <td class="text-right" style="font-size:0.8rem;color:var(--text-secondary);white-space:nowrap;padding:0.5rem 0.75rem;">${fmt(g.sumOffer)} PLN</td>
                <td class="text-right" style="font-size:0.8rem;color:${catDiffColor};white-space:nowrap;padding:0.5rem 0.75rem;">${catDiffSign}${fmt(catDiff)} PLN</td>
            </tr>`;
        });

        const totalDiff = totalNetto - totalOffer;
        const totalDiffSign = totalDiff >= 0 ? '+' : '';
        const totalDiffColor =
            totalDiff > 0 ? '#f87171' : totalDiff < 0 ? '#34d399' : 'var(--text-muted)';
        html += `<tr style="border-top:2px solid var(--border-glass);">
            <td colspan="9" style="font-weight:700;font-size:0.9rem;color:var(--text-primary);padding:1rem 0.5rem;white-space:nowrap;">RAZEM (${items.length} pozycji)</td>
            <td class="text-right" style="font-weight:800;font-size:1rem;color:var(--success);white-space:nowrap;padding:0.5rem 0.75rem;">${fmt(totalNetto)} PLN</td>
            <td class="text-right" style="font-weight:700;font-size:0.85rem;color:var(--text-secondary);white-space:nowrap;padding:0.5rem 0.75rem;">${fmt(totalOffer)} PLN</td>
            <td class="text-right" style="font-weight:700;font-size:0.85rem;color:${totalDiffColor};white-space:nowrap;padding:0.5rem 0.75rem;">${totalDiffSign}${fmt(totalDiff)} PLN</td>
        </tr>`;
        html += '</tfoot>';
    }

    html += `</table></div>`;
    container.innerHTML = html;

    if (window.lucide) window.lucide.createIcons({ root: container });
}

/* ===== SELEKCJA POZYCJI W ZAKŁADCE OFERTA ===== */

window.toggleAllOfferSummaryForOrder = function (checked) {
    document.querySelectorAll('.offer-summary-checkbox').forEach((cb) => {
        cb.checked = checked;
    });
};

window.updateOfferSummarySelectionCount = function () {
    const total = document.querySelectorAll('.offer-summary-checkbox').length;
    const checked = document.querySelectorAll('.offer-summary-checkbox:checked').length;
    const selectAll = document.getElementById('select-all-offer-summary');
    if (selectAll) {
        selectAll.checked = total > 0 && checked === total;
        selectAll.indeterminate = checked > 0 && checked < total;
    }
};

// Udostępnij globalnie
window.renderOfferSummaryTab = renderOfferSummaryTab;
