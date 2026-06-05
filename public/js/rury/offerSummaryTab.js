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
    if (dispInvest) dispInvest.textContent = document.getElementById('offer-invest-name')?.value || '—';

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

    // Porównanie cen widoczne tylko w trybie zamówienia + jawnie włączone
    const order = (window.orderEditMode && typeof getCurrentRuryOrder === 'function')
        ? getCurrentRuryOrder()
        : null;
    const showCmp = !!(order && order.originalSnapshot && window.showPriceComparison);
    const snapItems = showCmp ? (order.originalSnapshot.items || []) : [];

    const transportDist = calculateTransportDistribution(items, costPerTrip);

    let html = `<div class="table-wrap"><table style="width:100%;">
      <thead>
        <tr>
          <th style="width:36px;text-align:center"><input type="checkbox" id="select-all-offer-summary" onchange="toggleAllOfferSummaryForOrder(this.checked)" style="cursor:pointer;width:16px;height:16px"></th>
          <th style="width:1%; min-width:30px; text-align:center;">Lp.</th>
          <th style="width:100%;">Produkt</th>
          <th style="width:1%; min-width:80px; text-align:right; white-space:nowrap;">Cena jedn.</th>
          <th style="width:1%; min-width:60px; text-align:right; white-space:nowrap;">Rabat</th>
          <th style="width:1%; min-width:80px; text-align:right; white-space:nowrap;">Cena po rabacie</th>
          <th style="width:1%; min-width:80px; text-align:right; white-space:nowrap;">Transp/szt</th>
          <th style="width:1%; min-width:100px; text-align:right; white-space:nowrap;">Cena po rabacie + Transp/szt</th>
          <th style="width:1%; min-width:60px; text-align:center; white-space:nowrap;">Ilość szt.</th>
          <th style="width:1%; min-width:100px; text-align:right; white-space:nowrap;">RAZEM NETTO</th>${showCmp ? `
          <th style="width:1%; min-width:100px; text-align:right; white-space:nowrap;">Cena z oferty</th>
          <th style="width:1%; min-width:80px; text-align:right; white-space:nowrap;">Różnica</th>` : ''}
        </tr>
      </thead>
      <tbody>`;

    let totalNetto = 0;
    let totalOfferNetto = 0;

    const grouped = {};
    items.forEach((item, i) => {
        const product = products.find((p) => p.id === item.productId);
        const category = product ? product.category : 'Inne';
        if (!grouped[category]) grouped[category] = {};
        let diameter = getProductDiameter(item.productId);
        if (!diameter && item.productId) {
            const parts = item.productId.split('-');
            if (parts.length >= 5) {
                const code = parseInt(parts[4]);
                if (!isNaN(code) && code > 0) diameter = code * 100;
            }
        }
        const diamKey = diameter ? `DN ${diameter}` : 'Inne';
        if (!grouped[category][diamKey]) grouped[category][diamKey] = [];
        grouped[category][diamKey].push({ item, originalIndex: i });
    });

    const sortedCategories = Object.keys(grouped).sort((a, b) => {
        const ia = CATEGORIES.indexOf(a);
        const ib = CATEGORIES.indexOf(b);
        return (ia === -1 ? 999 : ia) - (ib === -1 ? 999 : ib);
    });

    const sortedItems = [];
    sortedCategories.forEach((cat) => {
        const diamKeys = Object.keys(grouped[cat]).sort((a, b) => {
            const da = parseInt(a.replace('DN ', '')) || 99999;
            const db = parseInt(b.replace('DN ', '')) || 99999;
            return da - db;
        });
        diamKeys.forEach((diamKey) => {
            grouped[cat][diamKey].sort((a, b) => {
                const aBB = a.item.name.toLowerCase().includes('bosy') || a.item.productId.endsWith('-B00');
                const bBB = b.item.name.toLowerCase().includes('bosy') || b.item.productId.endsWith('-B00');
                if (aBB !== bBB) return aBB ? -1 : 1;
                return (a.item.lengthM || 0) - (b.item.lengthM || 0);
            });
            grouped[cat][diamKey].forEach((entry) => sortedItems.push(entry));
        });
    });

    sortedItems.forEach(({ item }, i) => {
        const basePriceAfterDiscount = item.unitPrice * (1 - item.discount / 100);
        const pehdCost = item.pehdCostPerUnit || 0;
        const surcharge = item.surcharge || 0;
        const priceAfterDiscount = basePriceAfterDiscount + pehdCost + surcharge;
        const tpu = transportDist[item.productId] || 0;
        const unitTotal = priceAfterDiscount + tpu;
        const netto = unitTotal * item.quantity;
        
        totalNetto += netto;

        // Oblicz cenę z oferty (snapshot)
        let offerNetto = null;
        if (showCmp) {
            const snapItem = snapItems.find(si => si.uid === item.uid);
            if (snapItem && typeof calcSnapshotItemNetto === 'function') {
                offerNetto = calcSnapshotItemNetto(snapItem, order.originalSnapshot);
                totalOfferNetto += offerNetto;
            }
        }

        let pName = escapeHtml(item.name);
        if (item.pehdType === 'PEHD-3MM') pName += ' <span style="font-size:0.65rem; padding:1px 4px; border-radius:3px; background:#10b981; color:white; font-weight:700;">+ PEHD 3mm</span>';
        if (item.pehdType === 'PEHD-4MM') pName += ' <span style="font-size:0.65rem; padding:1px 4px; border-radius:3px; background:#10b981; color:white; font-weight:700;">+ PEHD 4mm</span>';
        if (item.autoAdded) pName += ' <span style="font-size:.65rem;color:var(--warn);opacity:.8">(uszczelka)</span>';
        if (item.surcharge) pName += ` <span style="font-size:0.65rem; padding:1px 4px; border-radius:3px; background:rgba(239,68,68,0.1); color:#ef4444; border:1px solid rgba(239,68,68,0.3); font-weight:700;">Dopłata: ${fmt(item.surcharge)}</span>`;

        const isOrdered = (typeof isItemInAnyOrder === 'function') ? isItemInAnyOrder(item.uid) : false;
        const summaryCheckboxCell = isOrdered
            ? '<td style="text-align:center;"><i data-lucide="package-check" style="width:16px;height:16px;color:#a5b4fc"></i></td>'
            : `<td style="text-align:center;" onclick="event.stopPropagation()"><input type="checkbox" class="offer-summary-checkbox" data-uid="${item.uid}" onchange="updateOfferSummarySelectionCount()" style="cursor:pointer;width:16px;height:16px"></td>`;

        // Komórki porównania
        let offerPriceCell = '';
        let diffCell = '';
        if (showCmp) {
            if (offerNetto !== null) {
                const diff = netto - offerNetto;
                const diffColor = diff > 0.01 ? '#34d399' : (diff < -0.01 ? '#f87171' : 'var(--text-muted)');
                const diffSign = diff > 0 ? '+' : '';
                offerPriceCell = `<td style="text-align:right; font-weight:600; color:var(--text-secondary); white-space:nowrap; padding:0.5rem 0.75rem; font-size:0.78rem;">${fmt(offerNetto)} PLN</td>`;
                diffCell = `<td style="text-align:right; font-weight:700; color:${diffColor}; white-space:nowrap; padding:0.5rem 0.75rem; font-size:0.78rem;">${diffSign}${fmt(diff)} PLN</td>`;
            } else {
                offerPriceCell = '<td style="text-align:right; padding:0.5rem 0.75rem; font-size:0.78rem; color:var(--text-muted);">—</td>';
                diffCell = '<td style="text-align:right; padding:0.5rem 0.75rem; font-size:0.78rem; color:var(--text-muted);">—</td>';
            }
        }

        html += `<tr style="border-bottom:1px solid var(--border-glass); ${isOrdered ? 'border-left:3px solid rgba(99,102,241,0.5); background:rgba(99,102,241,0.04);' : ''}">
            ${summaryCheckboxCell}
            <td style="text-align:center; color:var(--text-muted); font-weight:600;">${i + 1}</td>
            <td style="font-weight:600; color:var(--text-primary); max-width: 300px;">${pName}</td>
            <td style="text-align:right; color:var(--text-secondary);">${fmt(item.unitPrice)}</td>
            <td style="text-align:right; color:var(--text-secondary);">${item.discount}%</td>
            <td style="text-align:right; color:var(--text-secondary);">${fmt(priceAfterDiscount)}</td>
            <td style="text-align:right; color:var(--warn);">${tpu > 0 ? fmt(tpu) : '—'}</td>
            <td style="text-align:right; color:var(--text-primary); font-weight:600;">${fmt(unitTotal)}</td>
            <td style="text-align:center; font-weight:600;">${item.quantity} szt.</td>
            <td style="text-align:right; font-weight:700; color:var(--success);">${fmt(netto)} PLN</td>
            ${offerPriceCell}${diffCell}
        </tr>`;
    });

    // Podsumowanie z różnicą
    if (showCmp && totalOfferNetto > 0) {
        const totalDiff = totalNetto - totalOfferNetto;
        const tdColor = totalDiff > 0.01 ? '#34d399' : (totalDiff < -0.01 ? '#f87171' : 'var(--text-muted)');
        const tdSign = totalDiff > 0 ? '+' : '';
        html += `<tr style="font-weight:700; background:rgba(255,255,255,0.02); border-top:2px solid var(--border-glass);">
            <td colspan="${showCmp ? 9 : 7}" style="text-align:right; padding:0.6rem 0.75rem; font-size:0.82rem;">RAZEM</td>
            <td style="text-align:right; padding:0.6rem 0.75rem; font-size:0.85rem; color:var(--success);">${fmt(totalNetto)} PLN</td>
            <td style="text-align:right; padding:0.6rem 0.75rem; font-size:0.85rem; color:var(--text-secondary);">${fmt(totalOfferNetto)} PLN</td>
            <td style="text-align:right; padding:0.6rem 0.75rem; font-size:0.85rem; color:${tdColor};">${tdSign}${fmt(totalDiff)} PLN</td>
        </tr>`;
    }

    html += `</tbody></table></div>`;
    container.innerHTML = html;

    if (window.lucide) window.lucide.createIcons({root: container});
}

/* ===== SELEKCJA POZYCJI W ZAKŁADCE OFERTA ===== */

window.toggleAllOfferSummaryForOrder = function (checked) {
    document.querySelectorAll('.offer-summary-checkbox').forEach(cb => {
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
