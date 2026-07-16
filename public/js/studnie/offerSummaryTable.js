/* ===== TABELA PODSUMOWANIA OFERTY ===== */

function renderOfferSummaryTable(order, orderChanges, totals) {
    const showOrderSelection = !orderEditMode;
    const orderedWellIds =
        showOrderSelection && typeof getOrderedWellIds === 'function'
            ? getOrderedWellIds(editingOfferIdStudnie)
            : new Set();
    const showPriceComparison = orderEditMode && order && order.originalSnapshot;

    let html = `<div class="table-wrap"><table style="width:100%;">
      <thead>
        <tr>
          ${showOrderSelection ? '<th style="width:4%; min-width:40px; text-align:center;"><input type="checkbox" id="select-all-wells-for-order" onchange="toggleAllWellsForOrder(this.checked)" style="cursor:pointer; width:16px; height:16px;"></th>' : ''}
          <th style="width:1%; min-width:30px; text-align:center; white-space:nowrap;">Lp.</th>
          <th style="width:1%; min-width:20px;"></th> <!-- Expand icon -->
          <th style="width:100%;">Nazwa studni</th>
          <th style="width:1%; min-width:70px; text-align:center; white-space:nowrap; padding:0.5rem 0.5rem;">Status</th>
          <th style="width:1%; min-width:60px; text-align:right; white-space:nowrap; padding:0.5rem 0.75rem;">DN</th>
          ${showPriceComparison ? '<th style="width:1%; min-width:110px; text-align:right; white-space:nowrap; padding:0.5rem 0.75rem;">Cena z oferty</th>' : ''}
          <th style="width:1%; min-width:110px; text-align:right; white-space:nowrap; padding:0.5rem 0.75rem;">${showPriceComparison ? 'Cena zamówienia' : 'Cena'}</th>
          ${showPriceComparison ? '<th style="width:1%; min-width:90px; text-align:right; white-space:nowrap; padding:0.5rem 0.75rem;">Różnica</th>' : ''}
          <th style="width:1%; min-width:90px; text-align:right; white-space:nowrap; padding:0.5rem 0.75rem;">Akcje</th>
        </tr>
      </thead>
      <tbody>`;

    let runningTotalPrice = 0;
    let runningTotalWeight = 0;
    const dnGroups = {};

    const sortedWells = wells
        .map((well, originalIndex) => ({ well, originalIndex }))
        .sort((a, b) => {
            const dnA = a.well.dn === 'styczna' ? Infinity : parseInt(a.well.dn) || 0;
            const dnB = b.well.dn === 'styczna' ? Infinity : parseInt(b.well.dn) || 0;
            return dnA - dnB;
        });

    let origTotalTransportCost = 0;
    let origTotalWeight = 0;
    if (showPriceComparison && order) {
        const snap = order.originalSnapshot;
        const origSnap = Array.isArray(snap) ? null : snap;
        const origWellsArr = Array.isArray(snap) ? snap : snap.wells || [];
        origWellsArr.forEach((w) => (origTotalWeight += calcWellStats(w).weight));
        if (origSnap) {
            const oKm = parseFloat(origSnap.transportKm) || 0;
            const oRate = parseFloat(origSnap.transportRate) || 0;
            const oMode = origSnap.transportMode || 'full';
            if (oKm > 0 && oRate > 0 && origTotalWeight > 0) {
                const origOffer =
                    typeof offersStudnie !== 'undefined' && offersStudnie
                        ? offersStudnie.find((o) => o.id === order.offerId)
                        : null;
                const origOfferWeight = origOffer?.totalWeight || origTotalWeight;
                const origCostPerTrip = oKm * oRate;
                const origFullOfferCost =
                    (typeof calcTransportCount === 'function'
                        ? calcTransportCount(origOfferWeight, oMode)
                        : Math.ceil(origOfferWeight / MAX_TRANSPORT_WEIGHT)) * origCostPerTrip;
                origTotalTransportCost =
                    origOfferWeight > 0
                        ? origFullOfferCost * (origTotalWeight / origOfferWeight)
                        : 0;
            }
        }
    }

    sortedWells.forEach(({ well, originalIndex }, displayIndex) => {
        const stats = calcWellStats(well);
        const wellTransportCost =
            totals.globalWeight > 0
                ? totals.totalTransportCost * (stats.weight / totals.globalWeight)
                : 0;
        stats.price += wellTransportCost;

        runningTotalPrice += stats.price;
        runningTotalWeight += stats.weight;

        const dnKey = well.dn || '—';
        if (!dnGroups[dnKey])
            dnGroups[dnKey] = { count: 0, sumPrice: 0, sumHeight: 0, sumOfferPrice: 0 };
        dnGroups[dnKey].count++;
        dnGroups[dnKey].sumPrice += stats.price;
        dnGroups[dnKey].sumHeight += stats.height;

        let offerPrice = null;
        if (showPriceComparison) {
            const snap = order.originalSnapshot;
            const originalWells = Array.isArray(snap) ? snap : snap.wells || [];
            const originalDiscounts = Array.isArray(snap) ? null : snap.wellDiscounts || null;

            if (originalWells[originalIndex]) {
                const origWell = originalWells[originalIndex];
                const currentGlobalDiscounts =
                    typeof wellDiscounts !== 'undefined' ? structuredClone(wellDiscounts) : {};
                if (originalDiscounts && typeof wellDiscounts !== 'undefined') {
                    window.wellDiscounts = originalDiscounts;
                }

                const origStats = calcWellStats(origWell);

                if (originalDiscounts && typeof wellDiscounts !== 'undefined') {
                    window.wellDiscounts = currentGlobalDiscounts;
                }

                const origTransportCost =
                    origTotalWeight > 0
                        ? origTotalTransportCost * (origStats.weight / origTotalWeight)
                        : 0;
                offerPrice = origStats.price + origTransportCost;
                dnGroups[dnKey].sumOfferPrice += offerPrice;
            }
        }

        html += renderWellHeaderRow(
            well,
            originalIndex,
            stats,
            orderChanges[originalIndex],
            orderedWellIds.has(well.id),
            showOrderSelection,
            displayIndex + 1,
            offerPrice,
            showPriceComparison
        );
        html += renderWellDetailsRow(
            well,
            originalIndex,
            orderChanges[originalIndex],
            wellTransportCost
        );
    });

    html += renderOfferSummaryFooter(
        wells.length,
        runningTotalWeight,
        runningTotalPrice,
        showOrderSelection,
        dnGroups,
        showPriceComparison
    );
    html += '</tbody></table></div>';
    return html;
}

function renderOfferSummaryFooter(
    count,
    weight,
    price,
    showOrderSelection,
    dnGroups,
    showPriceComparison
) {
    let baseColspan = 5;
    if (showOrderSelection) baseColspan += 1;

    let html = '<tfoot>';

    if (dnGroups && Object.keys(dnGroups).length > 0) {
        const sortedDnKeys = Object.keys(dnGroups).sort((a, b) => {
            const dnA = a === 'styczna' ? Infinity : parseInt(a) || 0;
            const dnB = b === 'styczna' ? Infinity : parseInt(b) || 0;
            return dnA - dnB;
        });

        sortedDnKeys.forEach((dn) => {
            const g = dnGroups[dn];
            const avgPrice = g.sumPrice / g.count;
            const avgHeight = g.sumHeight / g.count;

            let priceDiffCell = '';
            let offerPriceCell = '';
            if (showPriceComparison) {
                if (g.sumOfferPrice > 0) {
                    const priceDiff = g.sumPrice - g.sumOfferPrice;
                    const diffColor =
                        priceDiff > 0
                            ? 'var(--success-hover)'
                            : priceDiff < 0
                              ? 'var(--danger-hover)'
                              : 'var(--text-muted)';
                    const diffSign = priceDiff > 0 ? '+' : '';
                    offerPriceCell = `<td class="text-right" style="font-size:0.8rem; color:var(--text-secondary); white-space:nowrap; padding:0.5rem 0.75rem;">${fmt(g.sumOfferPrice)} PLN</td>`;
                    priceDiffCell = `<td class="text-right" style="font-size:0.8rem; color:${diffColor}; white-space:nowrap; padding:0.5rem 0.75rem;">${diffSign}${fmt(priceDiff)} PLN</td>`;
                } else {
                    offerPriceCell = '<td class="text-right" class="pad-sm"></td>';
                    priceDiffCell = '<td class="text-right" class="pad-sm"></td>';
                }
            }

            html += `<tr style="border-top:1px solid rgba(255,255,255,0.05);">
              <td colspan="${baseColspan}" style="padding:0.6rem 0.5rem; font-size:0.85rem; color:var(--text-secondary); white-space:nowrap;">Podsumowanie DN${dn} — ${g.count} szt.</td>
              ${offerPriceCell}
              <td class="text-right" style="font-size:0.85rem; color:var(--success); font-weight:700; white-space:nowrap; padding:0.5rem 0.75rem;">${fmt(g.sumPrice)} PLN</td>
              ${priceDiffCell}
              <td class="text-right" style="font-size:0.8rem; color:var(--text-muted); white-space:nowrap; padding:0.5rem 0.75rem;">śr. ${fmtInt(avgHeight)} mm</td>
            </tr>`;
        });
    }

    let totalOfferPrice = 0;
    let totalPriceDiffCell = '';
    let totalOfferPriceCell = '';
    if (showPriceComparison) {
        Object.values(dnGroups).forEach((g) => {
            totalOfferPrice += g.sumOfferPrice || 0;
        });
        if (totalOfferPrice > 0) {
            const totalDiff = price - totalOfferPrice;
            const diffColor =
                totalDiff > 0
                    ? 'var(--success-hover)'
                    : totalDiff < 0
                      ? 'var(--danger-hover)'
                      : 'var(--text-muted)';
            const diffSign = totalDiff > 0 ? '+' : '';
            totalOfferPriceCell = `<td class="text-right" style="font-weight:700; font-size:0.85rem; color:var(--text-secondary); white-space:nowrap; padding:0.5rem 0.75rem;">${fmt(totalOfferPrice)} PLN</td>`;
            totalPriceDiffCell = `<td class="text-right" style="font-weight:700; font-size:0.85rem; color:${diffColor}; white-space:nowrap; padding:0.5rem 0.75rem;">${diffSign}${fmt(totalDiff)} PLN</td>`;
        } else {
            totalOfferPriceCell = '<td class="text-right" class="pad-sm"></td>';
            totalPriceDiffCell = '<td class="text-right" class="pad-sm"></td>';
        }
    }

    html += `<tr style="border-top:2px solid var(--border-glass);">
          <td colspan="${baseColspan}" style="font-weight:700; font-size:0.9rem; color:var(--text-primary); padding:1rem 0.5rem; white-space:nowrap;">RAZEM (${count} studni)</td>
          ${totalOfferPriceCell}
          <td class="text-right" style="font-weight:800; font-size:1rem; color:var(--success); white-space:nowrap; padding:0.5rem 0.75rem;">${fmt(price)} PLN</td>
          ${totalPriceDiffCell}
          <td class="text-right" style="font-weight:700; font-size:0.85rem; color:var(--text-muted); white-space:nowrap; padding:0.5rem 0.75rem;">${fmtInt(weight)} kg</td>
        </tr>
      </tfoot>`;
    return html;
}
