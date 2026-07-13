// @ts-check
/* ===== OFERTA — Renderowanie podsumowania (wiersze i szczegóły) ===== */

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
