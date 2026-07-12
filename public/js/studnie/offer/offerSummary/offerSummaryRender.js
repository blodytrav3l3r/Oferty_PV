// @ts-check
/* ===== OFERTA — Renderowanie podsumowania ===== */

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

    const order = orderEditMode ? getCurrentOfferOrder() : null;
    const orderChanges = orderEditMode && order ? getOrderChanges({ ...order, wells: wells }) : {};

    // Auto-generate offer notes
    generateOfferNotes(false);

    // Obliczenia globalne
    const totals = calculateOfferTotals();

    let html = '';
    // Baner statusu zamówienia i postęp
    html += renderOrderBanners(order, orderChanges);

    // Tabela zestawienia
    html += renderOfferSummaryTable(order, orderChanges, totals);

    container.innerHTML = html;

    // Inicjalizacja ikon Lucide tylko dla nowo wyrenderowanego kontenera (zapobiega miganiu całego ekranu)
    if (window.lucide) window.lucide.createIcons({ root: container });

    // Aktualizacja wskaźników zewnętrznych (stopka)
    updateOfferSummaryUI(totals);

    // Synchronizacja przycisku zapisu w podsumowaniu z trybem zamówienia
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
            // Usuwamy ręczne style z poprzedniej iteracji, aby klasa przejęła kontrolę
            saveBtn.style.background = '';
            saveBtn.style.borderColor = '';

            // Ukryj przyciski ofertowe w trybie zamówienia
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

            // Pokaż przycisk "Utwórz zamówienie" w trybie oferty
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

    // Posortuj studnie po DN do wyświetlenia (zachowując oryginalne indexy)
    const sortedWells = wells
        .map((well, originalIndex) => ({ well, originalIndex }))
        .sort((a, b) => {
            const dnA = a.well.dn === 'styczna' ? Infinity : parseInt(a.well.dn) || 0;
            const dnB = b.well.dn === 'styczna' ? Infinity : parseInt(b.well.dn) || 0;
            return dnA - dnB;
        });

    // Oryginalny koszt transportu z migawki (dla porównania "Cena z oferty")
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

        // Oblicz cenę z oferty (z originalSnapshot) dla porównania
        let offerPrice = null;
        if (showPriceComparison) {
            const snap = order.originalSnapshot;
            const originalWells = Array.isArray(snap) ? snap : snap.wells || [];
            const originalDiscounts = Array.isArray(snap) ? null : snap.wellDiscounts || null;

            if (originalWells[originalIndex]) {
                const origWell = originalWells[originalIndex];

                // Tymczasowo podmień rabaty globalne na te z migawki dla poprawnego wyliczenia ceny historycznej
                const currentGlobalDiscounts =
                    typeof wellDiscounts !== 'undefined' ? structuredClone(wellDiscounts) : {};
                if (originalDiscounts && typeof wellDiscounts !== 'undefined') {
                    window.wellDiscounts = originalDiscounts;
                }

                const origStats = calcWellStats(origWell);

                // Przywróć rabaty
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

function renderWellHeaderRow(
    well,
    i,
    stats,
    change,
    isOrdered,
    showOrderSelection,
    lp,
    offerPrice,
    showPriceComparison
) {
    const isExpanded = expandedWellIndices.has(i);
    const rowStyle = getWellRowStyle(change, isOrdered);
    const badges = getWellBadges(change, isOrdered, well);
    const displayLp = lp !== undefined ? lp : i + 1;

    let checkbox = '';
    if (showOrderSelection) {
        checkbox = isOrdered
            ? '<td class="text-center"><i data-lucide="package-check" style="width:16px; height:16px; color:var(--accent-text);"></i></td>'
            : `<td class="text-center" data-action="stopPropagation"><input type="checkbox" class="well-order-checkbox" data-well-index="${i}" data-action="updateOrderSelectionCount" style="cursor:pointer; width:16px; height:16px;"></td>`;
    }

    // Przygotuj kolumny z porównaniem cen (tylko w trybie zamówienia)
    let offerPriceCell = '';
    let priceDiffCell = '';
    if (offerPrice !== null) {
        const priceDiff = stats.price - offerPrice;
        const diffColor =
            priceDiff > 0
                ? 'var(--success-hover)'
                : priceDiff < 0
                  ? 'var(--danger-hover)'
                  : 'var(--text-muted)';
        const diffSign = priceDiff > 0 ? '+' : '';
        offerPriceCell = `<td class="text-right" style="font-weight:600; color:var(--text-secondary); white-space:nowrap; padding:0.5rem 0.75rem;">${fmt(offerPrice)} PLN</td>`;
        priceDiffCell = `<td class="text-right" style="font-weight:700; color:${diffColor}; white-space:nowrap; padding:0.5rem 0.75rem;">${diffSign}${fmt(priceDiff)} PLN</td>`;
    } else if (showPriceComparison) {
        // Puste komórki dla zachowania wyrównania kolumn (studnia NOWA bez ceny z oferty)
        offerPriceCell = '<td class="text-right pad-sm"></td>';
        priceDiffCell = '<td class="text-right pad-sm"></td>';
    }

    return `<tr class="well-row-header" style="${rowStyle}" data-action="toggleWellExpansion" data-well-index="${i}">
        ${checkbox}
        <td style="text-align:center; color:var(--text-muted); font-weight:600;">${displayLp}</td>
        <td style="text-align:center; color:var(--accent);"><i data-lucide="${isExpanded ? 'chevron-down' : 'chevron-right'}" style="width:16px; height:16px;"></i></td>
        <td style="font-weight:700; color:${well.doplata < 0 ? 'var(--danger)' : well.doplata > 0 ? 'var(--success)' : 'var(--text-primary)'};">${escapeHtml(well.name)}</td>
        <td style="text-align:center; white-space:nowrap; padding:0.5rem 0.5rem;">${badges}</td>
        <td style="text-align:right; font-weight:600; color:var(--text-secondary); white-space:nowrap; padding:0.5rem 0.75rem;">DN${well.dn}</td>
        ${offerPriceCell}
        <td class="text-right" style="font-weight:800; color:var(--success); white-space:nowrap; padding:0.5rem 0.75rem;">${fmt(stats.price)} PLN</td>
        ${priceDiffCell}
        <td class="text-right" data-action="stopPropagation" style="white-space:nowrap; padding:0.5rem 0.75rem;">
            <button class="btn btn-sm" data-action="editWell" data-well-index="${i}" title="Edytuj studnię" style="font-size:0.7rem; padding:0.25rem 0.6rem; display:inline-flex; align-items:center; gap:0.3rem;">
                <i data-lucide="edit-3" style="width:12px; height:12px;"></i> Edytuj
            </button>
        </td>
    </tr>`;
}

function getWellRowStyle(change, isOrdered) {
    if (change) {
        return change.type === 'added'
            ? 'border-left:3px solid var(--success-hover); background:rgba(var(--success-rgb),0.05);'
            : 'border-left:3px solid var(--danger); background:rgba(var(--danger-rgb),0.05);';
    }
    return isOrdered
        ? 'border-left:3px solid rgba(var(--accent-rgb),0.5); background:rgba(var(--accent-rgb),0.04);'
        : '';
}

function getWellBadges(change, isOrdered, well) {
    let html = '';
    if (change) {
        html +=
            change.type === 'added'
                ? '<span style="font-size:0.55rem; padding:1px 5px; border-radius:3px; background:rgba(var(--success-rgb),0.2); color:var(--success-hover); font-weight:700; margin-left:0.3rem;"><i data-lucide="circle-check"></i> NOWA</span>'
                : '<span style="font-size:0.55rem; padding:1px 5px; border-radius:3px; background:rgba(var(--danger-rgb),0.2); color:var(--danger-hover); font-weight:700; margin-left:0.3rem;"><i data-lucide="circle-x"></i> ZMIENIONO</span>';
    }
    if (isOrdered && well) {
        const wellOrder =
            typeof getOrderForWellId === 'function'
                ? getOrderForWellId(well.id, editingOfferIdStudnie)
                : null;
        if (wellOrder && wellOrder.orderNumber) {
            html += `<span data-action="navigateToOrder" data-order-id="${wellOrder.id}"
                title="Zamówienie ${wellOrder.orderNumber} — kliknij aby otworzyć"
                style="font-size:0.55rem; padding:1px 5px; border-radius:3px; background:rgba(var(--success-rgb),0.15); color:var(--success-hover); font-weight:800; margin-left:0.3rem; cursor:pointer; border:1px solid rgba(var(--success-rgb),0.4); display:inline-flex; align-items:center; gap:3px;">
                <i data-lucide="package" aria-hidden="true"></i> ${wellOrder.orderNumber}
            </span>`;
        } else {
            html +=
                '<span style="font-size:0.55rem; padding:1px 5px; border-radius:3px; background:rgba(var(--accent-rgb),0.2); color:var(--accent-text); font-weight:700; margin-left:0.3rem;"><i data-lucide="lock"></i> ZAMÓWIENIE</span>';
        }
    }
    return html;
}

function renderWellDetailsRow(well, i, change, wellTransportCost) {
    const isExpanded = expandedWellIndices.has(i);
    if (!isExpanded)
        return `<tr id="well-details-${i}" class="well-details-row hidden"><td colspan="12"></td></tr>`;

    const stats = calcWellStats(well);
    // Mapowanie dn na klucz rabatów (styczna -> styczne)
    const discountKey = well.dn === 'styczna' ? 'styczne' : well.dn;
    const activeDiscounts =
        typeof getWellActiveDiscounts === 'function' ? getWellActiveDiscounts(well) : wellDiscounts;
    const disc = activeDiscounts[discountKey] || { dennica: 0, nadbudowa: 0 };
    const nadbudowaMult = 1 - (disc.nadbudowa || 0) / 100;

    const detailsHtml = `<tr class="well-details-row"><td colspan="12">
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
        const { totalLinePrice, totalLineWeight } = calculateLinePricing(
            well,
            p,
            item,
            wellTransportCost,
            disc,
            nadbudowaMult,
            assignedPrzejscia[index],
            index
        );

        let badgesHtml = '';
        const precoAlloc =
            typeof calculatePrecoAllocationForItem === 'function'
                ? calculatePrecoAllocationForItem(well, index)
                : null;
        if (
            precoAlloc &&
            precoAlloc.hasPreco &&
            (precoAlloc.isBottomMostDennica || precoAlloc.fraction > 0) &&
            !item.disablePreco
        ) {
            badgesHtml +=
                ' <span style="font-size:0.55rem; color:#f43f5e; border:1px solid rgba(244,63,94,0.4); padding:1px 4px; border-radius:4px; background:rgba(244,63,94,0.1); margin-left:4px; font-weight:700;">PRECO</span>';
        }

        let pehdType = null;
        if (['dennica', 'styczna'].includes(p.componentType)) pehdType = well.wkladkaDennica;
        else if (
            [
                'plyta',
                'plyta_redukcyjna',
                'plyta_nastudzienna',
                'stozek',
                'zwienczenie',
                'konus',
                'plyta_din',
                'plyta_najazdowa',
                'plyta_zamykajaca',
                'pierscien_odciazajacy'
            ].includes(p.componentType)
        )
            pehdType = well.wkladkaZwienczenie;
        else if (['krag', 'krag_ot', 'rura'].includes(p.componentType))
            pehdType = well.wkladkaNadbudowa;

        if (pehdType && pehdType !== 'brak' && p.doplataPEHD && !item.disablePehd) {
            badgesHtml +=
                ' <span style="font-size:0.55rem; color:#0ea5e9; border:1px solid rgba(14,165,233,0.4); padding:1px 4px; border-radius:4px; background:rgba(14,165,233,0.1); margin-left:4px; font-weight:700;">PEHD</span>';
        }

        if (
            well.nadbudowa === 'zelbetowa' &&
            (p.componentType === 'krag' || p.componentType === 'krag_ot')
        ) {
            badgesHtml +=
                ' <span style="font-size:0.55rem; color:var(--warn); border:1px solid rgba(var(--warn-rgb),0.4); padding:1px 4px; border-radius:4px; background:rgba(var(--warn-rgb),0.1); margin-left:4px; font-weight:700;">ŻELBET</span>';
        }
        if (
            (well.dennicaMaterial === 'zelbetowa' || well.material === 'zelbetowa') &&
            p.componentType === 'dennica'
        ) {
            badgesHtml +=
                ' <span style="font-size:0.55rem; color:var(--warn); border:1px solid rgba(var(--warn-rgb),0.4); padding:1px 4px; border-radius:4px; background:rgba(var(--warn-rgb),0.1); margin-left:4px; font-weight:700;">ŻELBET</span>';
        }
        if (
            well.stopnie === 'nierdzewna' &&
            (p.componentType === 'krag' ||
                p.componentType === 'krag_ot' ||
                p.componentType === 'konus')
        ) {
            badgesHtml +=
                ' <span style="font-size:0.55rem; color:#a855f7; border:1px solid rgba(168,85,247,0.4); padding:1px 4px; border-radius:4px; background:rgba(168,85,247,0.1); margin-left:4px; font-weight:700;">NIERDZ.</span>';
        }

        html += `<tr style="opacity:0.8;">
            <td style="color:var(--text-secondary);">↳ ${p.name}${badgesHtml}${discStr}</td>
            <td style="width:60px; text-align:center;">${item.quantity} szt.</td>
            <td style="width:100px;" class="text-right">${fmtInt(totalLineWeight)} kg</td>
            <td style="width:120px;" class="text-right">${p.componentType === 'kineta' ? 'wliczone' : fmt(totalLinePrice) + ' PLN'}</td>
        </tr>`;

        // Renderowanie szczegółów dopłaty, przejść i kinety (jako sub-elementy w skróconej tabeli)
        html += renderComponentSubItems(
            well,
            p,
            item,
            assignedPrzejscia[index],
            disc,
            nadbudowaMult,
            wellTransportCost,
            index
        );
    });
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
    // Oblicz colspan dla pierwszych kolumn (stałe)
    // Baza: Lp. (1) + Expand (1) + Nazwa (1) + Status (1) + DN (1) = 5 kolumn stałych
    // Dodatkowe w trybie wyboru: Checkbox (1)
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

            // Oblicz różnicę cen dla grupy DN (jeśli w trybie porównania)
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
                    offerPriceCell = '<td class="text-right pad-sm"></td>';
                    priceDiffCell = '<td class="text-right pad-sm"></td>';
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

    // Oblicz sumę cen z oferty dla wszystkich studni
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

// Eksport globalny dla funkcji wywoływanych z innych modułów
window.renderOfferSummary = renderOfferSummary;
window.calculateOfferTotals = calculateOfferTotals;
window.generateOfferNotes = generateOfferNotes;
window.calculateAssignedPrzejscia = calculateAssignedPrzejscia;
window.calculatePrecoAllocationForItem = calculatePrecoAllocationForItem;
window.toggleWellExpansion = toggleWellExpansion;
