/* ===== WIERSZE STUDNI I KOMPONENTY ===== */

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

    let featureBadges = '';
    if (well.kineta === 'preco' || well.kineta === 'precotop') {
        featureBadges +=
            '<span style="font-size:0.55rem; color:#f43f5e; border:1px solid rgba(244,63,94,0.4); padding:1px 4px; border-radius:4px; background:rgba(244,63,94,0.1); margin-left:4px; font-weight:700;">PRECO</span>';
    }
    if (
        (well.wkladkaDennica && well.wkladkaDennica !== 'brak') ||
        (well.wkladkaNadbudowa && well.wkladkaNadbudowa !== 'brak') ||
        (well.wkladkaZwienczenie && well.wkladkaZwienczenie !== 'brak')
    ) {
        featureBadges +=
            '<span style="font-size:0.55rem; color:#0ea5e9; border:1px solid rgba(14,165,233,0.4); padding:1px 4px; border-radius:4px; background:rgba(14,165,233,0.1); margin-left:4px; font-weight:700;">PEHD</span>';
    }
    if (well.malowanieW && well.malowanieW !== 'brak') {
        if (well.malowanieZ === 'zewnatrz') {
            featureBadges +=
                '<span style="font-size:0.55rem; color:#a855f7; border:1px solid rgba(168,85,247,0.4); padding:1px 4px; border-radius:4px; background:rgba(168,85,247,0.1); margin-left:4px; font-weight:700;">MAL.</span>';
        } else {
            featureBadges +=
                '<span style="font-size:0.55rem; color:#a855f7; border:1px solid rgba(168,85,247,0.4); padding:1px 4px; border-radius:4px; background:rgba(168,85,247,0.1); margin-left:4px; font-weight:700;">MAL.</span>';
        }
    } else if (well.malowanieZ === 'zewnatrz') {
        featureBadges +=
            '<span style="font-size:0.55rem; color:#a855f7; border:1px solid rgba(168,85,247,0.4); padding:1px 4px; border-radius:4px; background:rgba(168,85,247,0.1); margin-left:4px; font-weight:700;">MAL.</span>';
    }
    if (well.nadbudowa === 'zelbetowa' || well.dennicaMaterial === 'zelbetowa') {
        featureBadges +=
            '<span style="font-size:0.55rem; color:var(--warn); border:1px solid rgba(var(--warn-rgb),0.4); padding:1px 4px; border-radius:4px; background:rgba(var(--warn-rgb),0.1); margin-left:4px; font-weight:700;">ŻELBET</span>';
    }
    if (well.stopnie === 'nierdzewna') {
        featureBadges +=
            '<span style="font-size:0.55rem; color:#a855f7; border:1px solid rgba(168,85,247,0.4); padding:1px 4px; border-radius:4px; background:rgba(168,85,247,0.1); margin-left:4px; font-weight:700;">NIERDZ.</span>';
    }

    let checkbox = '';
    if (showOrderSelection) {
        checkbox = isOrdered
            ? '<td class="text-center"><i data-lucide="package-check" style="width:16px; height:16px; color:var(--accent-text);"></i></td>'
            : `<td class="text-center" onclick="event.stopPropagation()"><input type="checkbox" class="well-order-checkbox" data-well-index="${i}" onchange="updateOrderSelectionCount()" style="cursor:pointer; width:16px; height:16px;"></td>`;
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
        offerPriceCell = '<td class="text-right" class="pad-sm"></td>';
        priceDiffCell = '<td class="text-right" class="pad-sm"></td>';
    }

    return `<tr class="well-row-header" style="${rowStyle}" onclick="toggleWellExpansion(${i}, event)">
        ${checkbox}
        <td style="text-align:center; color:var(--text-muted); font-weight:600;">${displayLp}</td>
        <td style="text-align:center; color:var(--accent);"><i data-lucide="${isExpanded ? 'chevron-down' : 'chevron-right'}" style="width:16px; height:16px;"></i></td>
        <td style="font-weight:700; color:${well.doplata < 0 ? 'var(--danger)' : well.doplata > 0 ? 'var(--success)' : 'var(--text-primary)'};">${escapeHtml(well.name)}</td>
        <td style="text-align:left; white-space:nowrap; padding:0.5rem 0.5rem;">${featureBadges}</td>
        <td style="text-align:center; white-space:nowrap; padding:0.5rem 0.5rem;">${badges}</td>
        <td style="text-align:right; font-weight:600; color:var(--text-secondary); white-space:nowrap; padding:0.5rem 0.75rem;">DN${well.dn}</td>
        ${offerPriceCell}
        <td class="text-right" style="font-weight:800; color:var(--success); white-space:nowrap; padding:0.5rem 0.75rem;">${fmt(stats.price)} PLN</td>
        ${priceDiffCell}
        <td class="text-right" onclick="event.stopPropagation()" style="white-space:nowrap; padding:0.5rem 0.75rem;">
            <button class="btn btn-sm" onclick="showSection('builder'); selectWell(${i})" title="Edytuj studnię" style="font-size:0.7rem; padding:0.25rem 0.6rem; display:inline-flex; align-items:center; gap:0.3rem;">
                <i data-lucide="edit-3" style="width:12px; height:12px;"></i> Edytuj
            </button>
        </td>
    </tr>`;
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
            html += `<span onclick="event.stopPropagation(); window.location.href='studnie.html?order=${escapeHtml(wellOrder.id)}'"
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
        return `<tr id="well-details-${i}" class="well-details-row hidden"><td colspan="13"></td></tr>`;

    const stats = calcWellStats(well);
    const discountKey = well.dn === 'styczna' ? 'styczne' : well.dn;
    const activeDiscounts =
        typeof getWellActiveDiscounts === 'function' ? getWellActiveDiscounts(well) : wellDiscounts;
    const disc = activeDiscounts[discountKey] || { dennica: 0, nadbudowa: 0 };
    const nadbudowaMult = 1 - (disc.nadbudowa || 0) / 100;

    const detailsHtml = `<tr class="well-details-row"><td colspan="13">
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

function renderComponentSubItems(
    well,
    p,
    item,
    itemPrzejscia,
    disc,
    nadbudowaMult,
    wellTransportCost,
    itemIndex
) {
    let html = '';
    const isBase = p.componentType === 'dennica' || p.componentType === 'styczna';

    const bd =
        typeof getItemPriceBreakdown === 'function'
            ? getItemPriceBreakdown(well, p, true, item)
            : null;
    if (bd) {
        let pehdLabel = '';
        if (bd.pehd > 0) {
            if (['dennica', 'styczna'].indexOf(p.componentType) !== -1)
                pehdLabel = well.wkladkaDennica;
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
                ].indexOf(p.componentType) !== -1
            )
                pehdLabel = well.wkladkaZwienczenie;
            else if (['krag', 'krag_ot', 'rura'].indexOf(p.componentType) !== -1)
                pehdLabel = well.wkladkaNadbudowa;
        }
        if (bd.pehd > 0 && pehdLabel) {
            html +=
                '<tr style="opacity:0.5; font-size:0.65rem; color:#0ea5e9;"><td colspan="3" class="pl-lg">w cenie: wkładka PEHD ' +
                pehdLabel +
                '</td><td class="text-right">' +
                fmt(bd.pehd) +
                ' PLN</td></tr>';
        }
        if (bd.malowanieW > 0) {
            html +=
                '<tr style="opacity:0.5; font-size:0.65rem; color:#8b5cf6;"><td colspan="3" class="pl-lg">w cenie: malowanie wewnątrz</td><td class="text-right">' +
                fmt(bd.malowanieW) +
                ' PLN</td></tr>';
        }
        if (bd.malowanieZ > 0) {
            html +=
                '<tr style="opacity:0.5; font-size:0.65rem; color:#8b5cf6;"><td colspan="3" class="pl-lg">w cenie: malowanie zewnątrz</td><td class="text-right">' +
                fmt(bd.malowanieZ) +
                ' PLN</td></tr>';
        }
        if (bd.zelbet > 0) {
            html +=
                '<tr style="opacity:0.5; font-size:0.65rem; color:var(--warn);"><td colspan="3" class="pl-lg">w cenie: dopłata żelbet</td><td class="text-right">' +
                fmt(bd.zelbet) +
                ' PLN</td></tr>';
        }
        if (bd.nierdzewna > 0) {
            html +=
                '<tr style="opacity:0.5; font-size:0.65rem; color:#a855f7;"><td colspan="3" class="pl-lg">w cenie: drabinka nierdzewna</td><td class="text-right">' +
                fmt(bd.nierdzewna) +
                ' PLN</td></tr>';
        }
    }

    if (isBase && well.doplata) {
        const doplataWellColor = well.doplata > 0 ? 'var(--success)' : 'var(--danger)';
        const doplataWellSign = well.doplata > 0 ? '+' : '';
        html += `<tr style="opacity:0.6; font-size:0.7rem; color:${doplataWellColor};">
            <td colspan="3" class="pl-lg">↳ ${doplataWellSign} Dopłata indywidualna</td>
            <td class="text-right">${fmt(well.doplata)} PLN</td>
        </tr>`;
    }

    if (item._osadnikCost > 0) {
        html += `<tr style="opacity:0.6; font-size:0.7rem; color:var(--warn);">
            <td colspan="3" class="pl-lg">↳ + Wkładka osadnika (przestarzałe)</td>
            <td class="text-right">${fmt(item._osadnikCost)} PLN</td>
        </tr>`;
    }

    if (itemPrzejscia) {
        itemPrzejscia.forEach((pr) => {
            const prProd = studnieProducts.find((x) => x.id === pr.productId);
            if (!prProd) return;

            if (pr.frozenTransitionPrice != null) {
                html += `<tr style="opacity:0.6; font-size:0.7rem; color:var(--accent-hover);">
                    <td colspan="3" class="pl-lg">↳ + Przejście: ${pr.frozenName || prProd.category} ${prProd.dn || ''} (${pr.angle}°)</td>
                    <td class="text-right">${fmt(pr.frozenTransitionPrice)} PLN</td>
                </tr>`;
                if (pr.doplata) {
                    const doplPrColor = pr.doplata > 0 ? 'var(--success)' : 'var(--danger)';
                    const doplPrSign = pr.doplata > 0 ? '+' : '';
                    html += `<tr style="opacity:0.6; font-size:0.7rem; color:${doplPrColor};">
                        <td style="padding-left:2.0rem;">↳ ${doplPrSign} Dopłata indywidualna do przejścia</td>
                        <td class="text-right">${fmt(pr.doplata)} PLN</td>
                    </tr>`;
                }
                if (pr.frozenDrillingPrice > 0) {
                    html += `<tr style="opacity:0.6; font-size:0.7rem; color:#f97316;">
                        <td colspan="3" class="pl-lg">↳ + ${pr.frozenDrillingName || 'Wiercenie'} ${pr.frozenDrillingDn || ''}</td>
                        <td class="text-right">${fmt(pr.frozenDrillingPrice)} PLN</td>
                    </tr>`;
                }
            } else {
                const prPrice = (prProd.price || 0) * nadbudowaMult;
                html += `<tr style="opacity:0.6; font-size:0.7rem; color:var(--accent-hover);">
                    <td colspan="3" class="pl-lg">↳ + Przejście: ${prProd.category} ${prProd.dn} (${pr.angle}°)</td>
                    <td class="text-right">${fmt(prPrice)} PLN</td>
                </tr>`;
                if (pr.doplata) {
                    const doplPrColor2 = pr.doplata > 0 ? 'var(--success)' : 'var(--danger)';
                    const doplPrSign2 = pr.doplata > 0 ? '+' : '';
                    html += `<tr style="opacity:0.6; font-size:0.7rem; color:${doplPrColor2};">
                        <td style="padding-left:2.0rem;">↳ ${doplPrSign2} Dopłata indywidualna do przejścia</td>
                        <td class="text-right">${fmt(pr.doplata)} PLN</td>
                    </tr>`;
                }
                if (pr._drillingBasePrice > 0 && pr._drillingProd) {
                    const drillPrice = pr._drillingBasePrice * nadbudowaMult;
                    html += `<tr style="opacity:0.6; font-size:0.7rem; color:#f97316;">
                        <td colspan="3" class="pl-lg">↳ + ${pr._drillingProd.name} ${pr._drillingProd.dn || ''}</td>
                        <td class="text-right">${fmt(drillPrice)} PLN</td>
                    </tr>`;
                }
            }
        });
    }

    if (isBase) {
        const kineta = well.config.find(
            (c) => studnieProducts.find((x) => x.id === c.productId)?.componentType === 'kineta'
        );
        if (kineta) {
            const kp = studnieProducts.find((x) => x.id === kineta.productId);
            const kPrice =
                (kineta.frozenPrice != null && window.isPreviewMode
                    ? kineta.frozenPrice
                    : getItemAssessedPrice(well, kp, true, kineta)) * (kineta.quantity || 1);
            html +=
                '<tr style="opacity:0.6; font-size:0.7rem; color:#f472b6;"><td colspan="3" class="pl-lg">↳ + ' +
                (kp ? kp.name : 'Kineta') +
                '</td><td class="text-right">' +
                fmt(kPrice) +
                ' PLN</td></tr>';

            if (kp && typeof getItemPriceBreakdown === 'function') {
                let kBd = getItemPriceBreakdown(well, kp, true, kineta);
                let kQ = kineta.quantity || 1;
                if (kBd.malowanieW > 0) {
                    html +=
                        '<tr style="opacity:0.5; font-size:0.65rem; color:#f9a8d4;"><td colspan="3" class="pl-lg">w cenie: malowanie wewnątrz</td><td class="text-right">' +
                        fmt(kBd.malowanieW * kQ) +
                        ' PLN</td></tr>';
                }
                if (kBd.malowanieZ > 0) {
                    html +=
                        '<tr style="opacity:0.5; font-size:0.65rem; color:#f9a8d4;"><td colspan="3" class="pl-lg">w cenie: malowanie zewnątrz</td><td class="text-right">' +
                        fmt(kBd.malowanieZ * kQ) +
                        ' PLN</td></tr>';
                }
            }
        }
    }

    const precoAlloc = calculatePrecoAllocationForItem(well, itemIndex);
    if (precoAlloc.hasPreco) {
        if (precoAlloc.allocatedCost > 0) {
            const discKey = well.dn === 'styczna' ? 'styczne' : well.dn;
            const discPreco = (wellDiscounts[discKey] || {}).preco || 0;
            const precoMult = 1 - discPreco / 100;
            const precoCost = precoAlloc.allocatedCost * precoMult;
            const fracPerc =
                precoAlloc.fraction > 0 && precoAlloc.fraction < 1
                    ? Math.round(precoAlloc.fraction * 100)
                    : 0;
            let kinetaLabel;
            if (well.wkladkaOsadnikPreco === 'tak') {
                let h = well.wkladkaOsadnikH || 1000;
                if (!well.wkladkaOsadnikH) {
                    let dennicaH = 0;
                    if (well.config) {
                        well.config.forEach((c) => {
                            const prod = studnieProducts.find((pr) => pr.id === c.productId);
                            if (
                                prod &&
                                (prod.componentType === 'dennica' ||
                                    prod.componentType === 'styczna')
                            ) {
                                dennicaH += (prod.height || 0) * (c.quantity || 1);
                            }
                        });
                    }
                    h = dennicaH || 1000;
                }
                if (precoAlloc.isBottomMostDennica) {
                    kinetaLabel = `osadnika (Dno + ${fracPerc ? fracPerc + '% ścian z ' : 'Ściany '}${h} mm)`;
                } else {
                    kinetaLabel = `osadnika (${fracPerc ? fracPerc + '% ścian z ' : 'Ściany '}${h} mm)`;
                }
            } else {
                const baseName = well.kineta === 'precotop' ? 'PrecoTop' : 'Preco';
                if (precoAlloc.isBottomMostDennica) {
                    kinetaLabel =
                        baseName + (fracPerc ? ` (Baza + ${fracPerc}% uzupełnienia)` : '');
                } else {
                    kinetaLabel =
                        baseName +
                        ` (${fracPerc ? fracPerc + '% uzupełnienia' : 'Wkładka uzupełniająca'})`;
                }
            }
            html += `<tr style="opacity:0.6; font-size:0.7rem; color:var(--danger);">
                <td colspan="3" class="pl-lg">↳ + Wkładka ${kinetaLabel}${discPreco > 0 ? ' <span style="font-size:0.6rem; color:var(--success);">(-' + discPreco + '%)</span>' : ''}</td>
                <td class="text-right">${fmt(precoCost)} PLN</td>
            </tr>`;
            if (precoAlloc.isBottomMostDennica && typeof calcPrecoPricing === 'function') {
                let precoCalc = calcPrecoPricing(well);
                if (precoCalc && precoCalc.suma > 0) {
                    if (precoCalc.bazowa > 0 && precoCalc.kinetaGlowna) {
                        let dnParts = precoCalc.kinetaGlowna.dn.map(function (d) {
                            return 'DN' + d;
                        });
                        let etyParts = precoCalc.kinetaGlowna.etykiety.map(function (e) {
                            return '[' + e + ']';
                        });
                        html +=
                            '<tr style="opacity:0.5; font-size:0.65rem; color:#fb7185;"><td colspan="3" class="pl-xl">↳ Kineta bazowa (' +
                            dnParts.join(' / ') +
                            ') ' +
                            etyParts.join(' / ') +
                            '</td><td class="text-right">' +
                            fmt(precoCalc.bazowa * precoMult) +
                            ' PLN</td></tr>';
                    }
                    if (precoCalc.skrzynki && precoCalc.skrzynki.suma > 0) {
                        html +=
                            '<tr style="opacity:0.5; font-size:0.65rem; color:#fb7185;"><td colspan="3" class="pl-xl">↳ + skrzynki włazowe (' +
                            precoCalc.skrzynki.ilosc +
                            ' × ' +
                            fmt(precoCalc.skrzynki.cenaSzt) +
                            ' PLN)</td><td class="text-right">' +
                            fmt(precoCalc.skrzynki.suma * precoMult) +
                            ' PLN</td></tr>';
                    }
                    if (precoCalc.spadekKineta > 0) {
                        html +=
                            '<tr style="opacity:0.5; font-size:0.65rem; color:#fb7185;"><td colspan="3" class="pl-xl">↳ + spadek kinety</td><td class="text-right">' +
                            fmt(precoCalc.spadekKineta * precoMult) +
                            ' PLN</td></tr>';
                    }
                    if (precoCalc.spadekMufa > 0) {
                        html +=
                            '<tr style="opacity:0.5; font-size:0.65rem; color:#fb7185;"><td colspan="3" class="pl-xl">↳ + spadek mufy</td><td class="text-right">' +
                            fmt(precoCalc.spadekMufa * precoMult) +
                            ' PLN</td></tr>';
                    }
                    if (precoCalc.uniesienie > 0) {
                        let mm =
                            precoCalc.uniesieniaSzczegoly &&
                            precoCalc.uniesieniaSzczegoly.length > 0
                                ? precoCalc.uniesieniaSzczegoly[0].mm
                                : '';
                        html +=
                            '<tr style="opacity:0.5; font-size:0.65rem; color:#fb7185;"><td colspan="3" class="pl-xl">↳ + uniesienie' +
                            (mm ? ' (' + mm + ' mm)' : '') +
                            '</td><td class="text-right">' +
                            fmt(precoCalc.uniesienie * precoMult) +
                            ' PLN</td></tr>';
                    }
                    if (precoCalc.redukcja > 0) {
                        html +=
                            '<tr style="opacity:0.5; font-size:0.65rem; color:#fb7185;"><td colspan="3" class="pl-xl">↳ + redukcja' +
                            (precoCalc.redukcjaOpis ? ' ' + precoCalc.redukcjaOpis : '') +
                            '</td><td class="text-right">' +
                            fmt(precoCalc.redukcja * precoMult) +
                            ' PLN</td></tr>';
                    }
                    if (precoCalc.dodWloty && precoCalc.dodWloty.length > 0) {
                        for (let dwi = 0; dwi < precoCalc.dodWloty.length; dwi++) {
                            let dw = precoCalc.dodWloty[dwi];
                            let dwTyp =
                                dw.typ === 'kaskada'
                                    ? 'kaskada'
                                    : dw.typ === 'sciana'
                                      ? 'ściana'
                                      : dw.typ === 'doplyw'
                                        ? 'dopływ'
                                        : dw.typ || '';
                            html +=
                                '<tr style="opacity:0.5; font-size:0.65rem; color:#fb7185;"><td colspan="3" class="pl-xl">↳ + dod. wlot DN' +
                                dw.dn +
                                (dwTyp ? ' (' + dwTyp + ')' : '') +
                                ' [' +
                                (dw.label || '') +
                                ']</td><td class="text-right">' +
                                fmt(dw.cena * precoMult) +
                                ' PLN</td></tr>';
                        }
                    }
                    if (precoCalc.pelnaWysokosc && precoCalc.pelnaWysokosc.cena > 0) {
                        html +=
                            '<tr style="opacity:0.5; font-size:0.65rem; color:#fb7185;"><td colspan="3" class="pl-xl">↳ + pełna wysokość (' +
                            precoCalc.pelnaWysokosc.metry.toFixed(2) +
                            ' m)</td><td class="text-right">' +
                            fmt(precoCalc.pelnaWysokosc.cena * precoMult) +
                            ' PLN</td></tr>';
                    }
                }
            }
        } else if (precoAlloc.error && precoAlloc.isBottomMostDennica) {
            html += `<tr style="opacity:0.6; font-size:0.7rem; color:var(--danger);">
                <td colspan="3" class="pl-lg">↳ ⚠ Wkładka PRECO — ${precoAlloc.error}</td>
                <td class="text-right">—</td>
            </tr>`;
        }
    }

    if (isBase) {
        if (wellTransportCost > 0) {
            html += `<tr style="opacity:0.6; font-size:0.7rem; color:#a855f7;">
                <td colspan="3" class="pl-lg">↳ <i data-lucide="truck" aria-hidden="true"></i> Udział w transporcie</td>
                <td class="text-right">${fmt(wellTransportCost)} PLN</td>
            </tr>`;
        }
    }
    return html;
}
