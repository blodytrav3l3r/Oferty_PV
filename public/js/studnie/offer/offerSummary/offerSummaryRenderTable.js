// @ts-check
/* ===== OFERTA — Renderowanie podsumowania (główna tabela) ===== */

function toggleWellExpansion(index, event) {
    if (event) event.stopPropagation();
    if (expandedWellIndices.has(index)) {
        expandedWellIndices.delete(index);
    } else {
        expandedWellIndices.add(index);
    }
    renderOfferSummary();
}

function renderOfferSummary() {
    const container = document.getElementById('offer-summary-body');
    if (!container) return;

    const order = orderEditMode ? getCurrentOfferOrder() : null;
    const orderChanges = orderEditMode && order ? getOrderChanges({ ...order, wells: wells }) : {};

    generateOfferNotes(false);

    const totals = calculateOfferTotals();

    let html = '';
    html += renderOrderBanners(order, orderChanges);
    html += renderOfferSummaryTable(order, orderChanges, totals);

    container.innerHTML = html;

    if (window.lucide) window.lucide.createIcons({ root: container });

    updateOfferSummaryUI(totals);

    const saveBtn = document.getElementById('btn-save-studnie-offer');
    const createOrderBtn = document.getElementById('btn-create-order-offer');

    if (saveBtn) {
        if (orderEditMode) {
            saveBtn.innerHTML = '<i data-lucide="save" aria-hidden="true"></i> Zapisz zamówienie';
            saveBtn.onclick = () => {
                if (typeof saveCurrentOrder === 'function') saveCurrentOrder();
            };
            saveBtn.classList.remove('btn-primary');
            saveBtn.classList.add('btn-order-save');
            saveBtn.style.background = '';
            saveBtn.style.borderColor = '';

            if (createOrderBtn) createOrderBtn.style.display = 'none';
        } else {
            saveBtn.innerHTML = '<i data-lucide="save" aria-hidden="true"></i> Zapisz ofertę';
            saveBtn.onclick = () => {
                if (typeof saveOfferStudnie === 'function') saveOfferStudnie();
            };
            saveBtn.classList.remove('btn-primary');
            saveBtn.classList.add('btn-order-save');
            saveBtn.style.background = '';
            saveBtn.style.borderColor = '';

            if (createOrderBtn) createOrderBtn.style.display = 'flex';
        }
        if (window.lucide) window.lucide.createIcons({ root: saveBtn });
    }
}

function renderOrderBanners(order, orderChanges) {
    let html = '';
    const hasChanges = Object.keys(orderChanges).length > 0;

    if (order) {
        const changeCount = Object.keys(orderChanges).length;
        html += `<div style="display:flex; align-items:center; justify-content:space-between; padding:0.5rem 0.8rem; margin-bottom:0.5rem; background:${hasChanges ? 'rgba(var(--danger-rgb),0.1)' : 'rgba(var(--success-rgb),0.1)'}; border:1px solid ${hasChanges ? 'rgba(var(--danger-rgb),0.3)' : 'rgba(var(--success-rgb),0.3)'}; border-radius:8px;">
            <div style="display:flex; align-items:center; gap:0.4rem;">
                <span style="font-size:1.1rem;"><i data-lucide="package"></i></span>
                <span style="font-size:0.75rem; font-weight:700; color:${hasChanges ? 'var(--danger-hover)' : 'var(--success-hover)'};">ZAMÓWIENIE ${hasChanges ? '— ' + changeCount + ' studni zmienionych' : '— bez zmian'}</span>
            </div>
            <button class="btn btn-sm" style="background:rgba(var(--success-rgb),0.15); border:1px solid rgba(var(--success-rgb),0.3); color:var(--success-hover); font-size:0.65rem; padding:0.15rem 0.4rem;" data-action="saveOrderOrOfferStudnie"><i data-lucide="package" aria-hidden="true"></i> Zapisz zamówienie</button>
        </div>`;
    }

    if (!orderEditMode && editingOfferIdStudnie && wells.length > 0) {
        html += renderPartialOrderProgress();
    }
    return html;
}

function renderPartialOrderProgress() {
    const progress =
        typeof getOfferOrderProgress === 'function'
            ? getOfferOrderProgress(editingOfferIdStudnie, wells)
            : { ordered: 0, total: wells.length, percent: 0 };
    const orderedIds =
        typeof getOrderedWellIds === 'function'
            ? getOrderedWellIds(editingOfferIdStudnie)
            : new Set();
    const availableCount = wells.filter((w) => !orderedIds.has(w.id)).length;

    if (progress.ordered === 0 && availableCount === wells.length) return '';

    const progressColor = progress.percent >= 100 ? 'var(--success-hover)' : 'var(--blue-hover)';
    return `<div style="display:flex; align-items:center; gap:0.6rem; padding:0.5rem 0.8rem; margin-bottom:0.5rem; background:rgba(var(--blue-rgb),0.08); border:1px solid rgba(var(--blue-rgb),0.2); border-radius:8px;">
        <div class="flex-1">
            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:0.3rem;">
                <span style="font-size:0.72rem; font-weight:700; color:var(--text-secondary);">
                    <i data-lucide="package" aria-hidden="true"></i> Postęp zamówień
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
    const showOrderSelection = !orderEditMode;
    const orderedWellIds =
        showOrderSelection && typeof getOrderedWellIds === 'function'
            ? getOrderedWellIds(editingOfferIdStudnie)
            : new Set();
    const showPriceComparison = orderEditMode && order && order.originalSnapshot;

    let html = `<div class="table-wrap"><table style="width:100%;">
      <thead>
        <tr>
          ${showOrderSelection ? '<th style="width:4%; min-width:40px; text-align:center;"><input type="checkbox" id="select-all-wells-for-order" data-action="toggleAllWellsForOrder" style="cursor:pointer; width:16px; height:16px;"></th>' : ''}
          <th style="width:1%; min-width:30px; text-align:center; white-space:nowrap;">Lp.</th>
          <th style="width:1%; min-width:20px;"></th>
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

window.renderOfferSummary = renderOfferSummary;
window.toggleWellExpansion = toggleWellExpansion;
