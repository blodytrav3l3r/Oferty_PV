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
    const errorClass =
        well.configStatus === 'ERROR'
            ? ' well-row-error'
            : well.configStatus === 'WARNING'
              ? ' well-row-warning'
              : '';
    const badges = getWellBadges(change, isOrdered, well);
    const errorCell = getWellErrorCell(well);
    const displayLp = lp !== undefined ? lp : i + 1;

    let featureBadges = '';
    if (well.kineta === 'preco' || well.kineta === 'precotop') {
        featureBadges += '<span class="pill-tag-danger">PRECO</span>';
    }
    if (
        (well.wkladkaDennica && well.wkladkaDennica !== 'brak') ||
        (well.wkladkaNadbudowa && well.wkladkaNadbudowa !== 'brak') ||
        (well.wkladkaZwienczenie && well.wkladkaZwienczenie !== 'brak')
    ) {
        featureBadges += '<span class="pill-tag-blue">PEHD</span>';
    }
    if (well.malowanieW && well.malowanieW !== 'brak') {
        if (well.malowanieZ === 'zewnatrz') {
            featureBadges += '<span class="pill-tag-nierdz">MAL.</span>';
        } else {
            featureBadges += '<span class="pill-tag-nierdz">MAL.</span>';
        }
    } else if (well.malowanieZ === 'zewnatrz') {
        featureBadges += '<span class="pill-tag-nierdz">MAL.</span>';
    }
    if (well.nadbudowa === 'zelbetowa' || well.dennicaMaterial === 'zelbetowa') {
        featureBadges += '<span class="pill-tag-warn">ŻELBET</span>';
    }
    if (well.stopnie === 'nierdzewna') {
        featureBadges += '<span class="pill-tag-nierdz">NIERDZ.</span>';
    }
    if (well.klasaNosnosci_korpus === 'E600' || well.klasaNosnosci_korpus === 'F900') {
        featureBadges +=
            '<span class="pill-tag-blue">NOŚN. ' + well.klasaNosnosci_korpus + '</span>';
    }
    if (well.klasaNosnosci_zwienczenie === 'E600' || well.klasaNosnosci_zwienczenie === 'F900') {
        featureBadges +=
            '<span class="pill-tag-warn">ZWIEŃ. ' + well.klasaNosnosci_zwienczenie + '</span>';
    }
    if (well.agresjaChemiczna === 'XA2' || well.agresjaChemiczna === 'XA3') {
        featureBadges += '<span class="pill-tag-nierdz">CHEM. ' + well.agresjaChemiczna + '</span>';
    }
    if (well.agresjaMrozowa === 'XF2' || well.agresjaMrozowa === 'XF3') {
        featureBadges += '<span class="pill-tag-warn">MROZ. ' + well.agresjaMrozowa + '</span>';
    }

    let checkbox = '';
    if (showOrderSelection) {
        checkbox = isOrdered
            ? '<td class="text-center"><i data-lucide="package-check" style="width:16px; height:16px; color:var(--accent-text);"></i></td>'
            : `<td class="text-center" onclick="event.stopPropagation()"><input type="checkbox" class="well-order-checkbox cursor-icon-16" data-well-index="${i}" onchange="updateOrderSelectionCount()" ></td>`;
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
        offerPriceCell = `<td class="text-right" style="font-weight: var(--fw-semibold); color:var(--text-secondary); white-space:nowrap; padding:0.5rem 0.75rem;">${fmt(offerPrice)} PLN</td>`;
        priceDiffCell = `<td class="text-right" style="font-weight: var(--fw-bold); color:${diffColor}; white-space:nowrap; padding:0.5rem 0.75rem;">${diffSign}${fmt(priceDiff)} PLN</td>`;
    } else if (showPriceComparison) {
        offerPriceCell = '<td class="text-right pad-sm" ></td>';
        priceDiffCell = '<td class="text-right pad-sm" ></td>';
    }

    return `<tr class="well-row-header${errorClass}" style="${rowStyle}" onclick="toggleWellExpansion(${i}, event)">
        ${checkbox}
        <td style="text-align:center; color:var(--text-muted); font-weight: var(--fw-semibold);">${displayLp}</td>
        <td style="text-align:center; color:var(--accent);"><i data-lucide="${isExpanded ? 'chevron-down' : 'chevron-right'}" class="icon-sm"></i></td>
        <td style="text-align:left; font-weight: var(--fw-bold); color:${well.doplata < 0 ? 'var(--danger)' : well.doplata > 0 ? 'var(--success)' : 'var(--text-primary)'};">${escapeHtml(well.name)}</td>
        <td style="text-align:right; white-space:nowrap; padding:0.5rem 0.5rem;">${featureBadges}</td>
        <td style="text-align:right; white-space:nowrap; padding:0.5rem 0.5rem;">${badges}</td>
        <td style="text-align:right; white-space:nowrap; padding:0.5rem 0.5rem;">${errorCell}</td>
        <td style="text-align:right; font-weight: var(--fw-semibold); color:var(--text-secondary); white-space:nowrap; padding:0.5rem 0.75rem;">DN${well.dn}</td>
        ${offerPriceCell}
        <td class="text-right" style="font-weight: var(--fw-extrabold); color:var(--success); white-space:nowrap; padding:0.5rem 0.75rem;">${fmt(stats.price)} PLN</td>
        ${priceDiffCell}
        <td class="text-right" onclick="event.stopPropagation()" style="white-space:nowrap; padding:0.5rem 0.75rem;">
            <button class="btn btn-sm" onclick="showSection('builder'); selectWell(${i})" title="Edytuj studnię" style="font-size: var(--fs-sm); padding:0.25rem 0.6rem; display:inline-flex; align-items:center; gap:0.3rem;">
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
                ? '<span style="font-size: var(--fs-3xs); padding:1px 5px; border-radius: var(--radius-2xs); background:rgba(var(--success-rgb), 0.2); color:var(--success-hover); font-weight: var(--fw-bold); margin-left:0.3rem;"><i data-lucide="circle-check"></i> NOWA</span>'
                : '<span style="font-size: var(--fs-3xs); padding:1px 5px; border-radius: var(--radius-2xs); background:rgba(var(--danger-rgb), 0.2); color:var(--danger-hover); font-weight: var(--fw-bold); margin-left:0.3rem;"><i data-lucide="circle-x"></i> ZMIENIONO</span>';
    }
    if (isOrdered && well) {
        const wellOrder =
            typeof getOrderForWellId === 'function'
                ? getOrderForWellId(well.id, editingOfferIdStudnie)
                : null;
        if (wellOrder && wellOrder.orderNumber) {
            html += `<span onclick="event.stopPropagation(); window.location.href='studnie.html?order=${escapeHtml(wellOrder.id)}'"
                title="Zamówienie ${escapeHtml(wellOrder.orderNumber).replace(/"/g, '&quot;')} — kliknij aby otworzyć"
                style="font-size: var(--fs-3xs); padding:1px 5px; border-radius: var(--radius-2xs); background:rgba(var(--success-rgb), 0.15); color:var(--success-hover); font-weight: var(--fw-extrabold); margin-left:0.3rem; cursor:pointer; border:1px solid rgba(var(--success-rgb), 0.5); display:inline-flex; align-items:center; gap:3px;">
                <i data-lucide="package" aria-hidden="true"></i> ${escapeHtml(wellOrder.orderNumber)}
            </span>`;
        } else {
            html +=
                '<span style="font-size: var(--fs-3xs); padding:1px 5px; border-radius: var(--radius-2xs); background:rgba(var(--accent-rgb), 0.2); color:var(--accent-text); font-weight: var(--fw-bold); margin-left:0.3rem;"><i data-lucide="lock"></i> ZAMÓWIENIE</span>';
        }
    }
    return html;
}

function renderWellDetailsRow(well, i, change, wellTransportCost, colsCount) {
    const isExpanded = expandedWellIndices.has(i);
    if (!isExpanded)
        return `<tr id="well-details-${i}" class="well-details-row hidden"><td colspan="${colsCount}"></td></tr>`;

    const stats = calcWellStats(well);
    const discountKey = well.dn === 'styczna' ? 'styczne' : well.dn;
    const activeDiscounts =
        typeof getWellActiveDiscounts === 'function' ? getWellActiveDiscounts(well) : wellDiscounts;
    const disc = activeDiscounts[discountKey] || { dennica: 0, nadbudowa: 0 };

    const detailsHtml = `<tr class="well-details-row"><td colspan="${colsCount}">
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
            <div style="margin-top:0.8rem; border-top:1px solid rgba(var(--white-rgb), 0.05); padding-top:0.5rem;">
                <div style="font-size: var(--fs-xs); text-transform:uppercase; color:var(--text-muted); font-weight: var(--fw-semibold); margin-bottom:0.3rem;">Konfiguracja elementów:</div>
                <table style="width:100%; font-size: var(--fs-base);">
                    ${renderWellComponentsList(well, wellTransportCost, disc, change)}
                </table>
            </div>
        </div>
    </td></tr>`;

    return detailsHtml;
}

function renderWellComponentsList(well, wellTransportCost, disc, _change) {
    let html = '';
    const assignedPrzejscia = calculateAssignedPrzejscia(well);

    well.config.forEach((item, index) => {
        const p =
            typeof getStudnieProductById === 'function'
                ? getStudnieProductById(item.productId)
                : studnieProducts.find((pr) => pr.id === item.productId);
        if (!p || p.componentType === 'kineta') return;

        const discStr = getDiscountStr(well, p, disc);
        const { totalLinePrice, totalLineWeight } = calculateLinePricing(
            well,
            p,
            item,
            wellTransportCost,
            disc,
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
            badgesHtml += ' <span class="pill-tag-danger">PRECO</span>';
        }

        const pehdType = getPehdTypeForComponent(well, p.componentType);

        if (pehdType && pehdType !== 'brak' && p.doplataPEHD && !item.disablePehd) {
            badgesHtml += ' <span class="pill-tag-blue">PEHD</span>';
        }

        if (
            well.nadbudowa === 'zelbetowa' &&
            (p.componentType === 'krag' || p.componentType === 'krag_ot')
        ) {
            badgesHtml += ' <span class="pill-tag-warn">ŻELBET</span>';
        }
        if (
            (well.dennicaMaterial === 'zelbetowa' || well.material === 'zelbetowa') &&
            p.componentType === 'dennica'
        ) {
            badgesHtml += ' <span class="pill-tag-warn">ŻELBET</span>';
        }
        if (
            well.stopnie === 'nierdzewna' &&
            (p.componentType === 'krag' ||
                p.componentType === 'krag_ot' ||
                p.componentType === 'konus')
        ) {
            badgesHtml += ' <span class="pill-tag-nierdz">NIERDZ.</span>';
        }

        html += `<tr style="opacity:0.8;">
            <td class="text-secondary">↳ ${escapeHtml(item.isPsiaBuda ? 'Psia buda' : p.name)}${badgesHtml}${discStr}</td>
            <td style="width:60px; text-align:center;">${item.quantity} szt.</td>
            <td class="w-100px text-right" >${fmtInt(totalLineWeight)} kg</td>
            <td style="width:120px;" class="text-right">${p.componentType === 'kineta' ? 'wliczone' : fmt(totalLinePrice) + ' PLN'}</td>
        </tr>`;

        html += renderComponentSubItems(
            well,
            p,
            item,
            assignedPrzejscia[index],
            disc,
            wellTransportCost,
            index
        );
    });
    return html;
}

function renderComponentSubItems(well, p, item, itemPrzejscia, disc, wellTransportCost, itemIndex) {
    let html = '';
    const nadbudowaMult = 1 - getWellNadbudowaPct(well, disc) / 100;
    const isBase = p.componentType === 'dennica' || p.componentType === 'styczna';

    const bd =
        typeof getItemPriceBreakdown === 'function'
            ? getItemPriceBreakdown(well, p, true, item)
            : null;
    if (bd) {
        let pehdLabel = '';
        if (bd.pehd > 0) {
            pehdLabel = getPehdTypeForComponent(well, p.componentType) || '';
        }
        if (bd.pehd > 0 && pehdLabel) {
            html +=
                '<tr style="opacity:0.5; font-size: var(--fs-xs); color:var(--blue-alt);"><td colspan="3" class="pl-lg">w cenie: wkładka PEHD ' +
                escapeHtml(pehdLabel) +
                '</td><td class="text-right">' +
                fmt(bd.pehd) +
                ' PLN</td></tr>';
        }
        if (bd.malowanieW > 0) {
            html +=
                '<tr class="included-row-accent"><td colspan="3" class="pl-lg">w cenie: malowanie wewnątrz</td><td class="text-right">' +
                fmt(bd.malowanieW) +
                ' PLN</td></tr>';
        }
        if (bd.malowanieZ > 0) {
            html +=
                '<tr class="included-row-accent"><td colspan="3" class="pl-lg">w cenie: malowanie zewnątrz</td><td class="text-right">' +
                fmt(bd.malowanieZ) +
                ' PLN</td></tr>';
        }
        if (bd.zelbet > 0) {
            html +=
                '<tr class="included-row-warn"><td colspan="3" class="pl-lg">w cenie: dopłata żelbet</td><td class="text-right">' +
                fmt(bd.zelbet) +
                ' PLN</td></tr>';
        }
        if (bd.nierdzewna > 0) {
            html +=
                '<tr class="included-row-accent"><td colspan="3" class="pl-lg">w cenie: drabinka nierdzewna</td><td class="text-right">' +
                fmt(bd.nierdzewna) +
                ' PLN</td></tr>';
        }
    }

    if (isBase && !item.isPsiaBuda && well.doplata) {
        const doplataWellColor = well.doplata > 0 ? 'var(--success)' : 'var(--danger)';
        const doplataWellSign = well.doplata > 0 ? '+' : '';
        html += `<tr style="opacity:0.6; font-size: var(--fs-sm); color:${doplataWellColor};">
            <td colspan="3" class="pl-lg">↳ ${doplataWellSign} Dopłata indywidualna</td>
            <td class="text-right">${fmt(well.doplata)} PLN</td>
        </tr>`;
    }

    if (item._osadnikCost > 0) {
        html += `<tr class="included-row-warn">
            <td colspan="3" class="pl-lg">↳ + Wkładka osadnika (przestarzałe)</td>
            <td class="text-right">${fmt(item._osadnikCost)} PLN</td>
        </tr>`;
    }

    if (itemPrzejscia) {
        itemPrzejscia.forEach((pr) => {
            const prProd =
                typeof getStudnieProductById === 'function'
                    ? getStudnieProductById(pr.productId)
                    : studnieProducts.find((x) => x.id === pr.productId);
            if (!prProd) return;

            if (pr.frozenTransitionPrice != null) {
                html += `<tr class="opacity-6-sm-accent">
                    <td colspan="3" class="pl-lg">↳ + Przejście: ${escapeHtml(pr.frozenName || prProd.category)} ${escapeHtml(prProd.dn || '')} (${pr.angle}°)</td>
                    <td class="text-right">${fmt(pr.frozenTransitionPrice)} PLN</td>
                </tr>`;
                if (pr.doplata) {
                    const doplPrColor = pr.doplata > 0 ? 'var(--success)' : 'var(--danger)';
                    const doplPrSign = pr.doplata > 0 ? '+' : '';
                    html += `<tr style="opacity:0.6; font-size: var(--fs-sm); color:${doplPrColor};">
                        <td class="pl-20">↳ ${doplPrSign} Dopłata indywidualna do przejścia</td>
                        <td class="text-right">${fmt(pr.doplata)} PLN</td>
                    </tr>`;
                }
                if (pr.frozenDrillingPrice > 0) {
                    html += `<tr class="included-row-warn">
                        <td colspan="3" class="pl-lg">↳ + ${escapeHtml(pr.frozenDrillingName || 'Wiercenie')} ${escapeHtml(pr.frozenDrillingDn || '')}</td>
                        <td class="text-right">${fmt(pr.frozenDrillingPrice)} PLN</td>
                    </tr>`;
                }
            } else {
                const prPrice = (prProd.price || 0) * nadbudowaMult;
                html += `<tr class="opacity-6-sm-accent">
                    <td colspan="3" class="pl-lg">↳ + Przejście: ${escapeHtml(prProd.category)} ${escapeHtml(prProd.dn)} (${pr.angle}°)</td>
                    <td class="text-right">${fmt(prPrice)} PLN</td>
                </tr>`;
                if (pr.doplata) {
                    const doplPrColor2 = pr.doplata > 0 ? 'var(--success)' : 'var(--danger)';
                    const doplPrSign2 = pr.doplata > 0 ? '+' : '';
                    html += `<tr style="opacity:0.6; font-size: var(--fs-sm); color:${doplPrColor2};">
                        <td class="pl-20">↳ ${doplPrSign2} Dopłata indywidualna do przejścia</td>
                        <td class="text-right">${fmt(pr.doplata)} PLN</td>
                    </tr>`;
                }
                if (pr._drillingBasePrice > 0 && pr._drillingProd) {
                    const drillPrice = pr._drillingBasePrice * nadbudowaMult;
                    html += `<tr class="included-row-warn">
                        <td colspan="3" class="pl-lg">↳ + ${escapeHtml(pr._drillingProd.name)} ${pr._drillingProd.dn || ''}</td>
                        <td class="text-right">${fmt(drillPrice)} PLN</td>
                    </tr>`;
                }
            }
        });
    }

    if (isBase && !item.isPsiaBuda) {
        const kineta = well.config.find(
            (c) =>
                (typeof getStudnieProductById === 'function'
                    ? getStudnieProductById(c.productId)
                    : studnieProducts.find((x) => x.id === c.productId)
                )?.componentType === 'kineta'
        );
        if (kineta) {
            const kp =
                typeof getStudnieProductById === 'function'
                    ? getStudnieProductById(kineta.productId)
                    : studnieProducts.find((x) => x.id === kineta.productId);
            const kPrice =
                (kineta.frozenPrice != null && window.isPreviewMode
                    ? kineta.frozenPrice
                    : getItemAssessedPrice(well, kp, true, kineta)) * (kineta.quantity || 1);
            html +=
                '<tr style="opacity:0.6; font-size: var(--fs-sm); color:var(--pink-hover);"><td colspan="3" class="pl-lg">↳ + ' +
                escapeHtml(kp ? kp.name : 'Kineta') +
                '</td><td class="text-right">' +
                fmt(kPrice) +
                ' PLN</td></tr>';

            if (kp && typeof getItemPriceBreakdown === 'function') {
                const kBd = getItemPriceBreakdown(well, kp, true, kineta);
                const kQ = kineta.quantity || 1;
                if (kBd.malowanieW > 0) {
                    html +=
                        '<tr class="opacity-5-xs-pink"><td colspan="3" class="pl-lg">w cenie: malowanie wewnątrz</td><td class="text-right">' +
                        fmt(kBd.malowanieW * kQ) +
                        ' PLN</td></tr>';
                }
                if (kBd.malowanieZ > 0) {
                    html +=
                        '<tr class="opacity-5-xs-pink"><td colspan="3" class="pl-lg">w cenie: malowanie zewnątrz</td><td class="text-right">' +
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
                            const prod =
                                typeof getStudnieProductById === 'function'
                                    ? getStudnieProductById(c.productId)
                                    : studnieProducts.find((pr) => pr.id === c.productId);
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
            html += `<tr class="opacity-6-sm-danger">
                <td colspan="3" class="pl-lg">↳ + Wkładka ${kinetaLabel}${discPreco > 0 ? ' <span style="font-size: var(--fs-2xs); color:var(--success);">(-' + discPreco + '%)</span>' : ''}</td>
                <td class="text-right">${fmt(precoCost)} PLN</td>
            </tr>`;
            if (precoAlloc.isBottomMostDennica && typeof calcPrecoPricing === 'function') {
                const precoCalc = calcPrecoPricing(well);
                if (precoCalc && precoCalc.suma > 0) {
                    if (precoCalc.bazowa > 0 && precoCalc.kinetaGlowna) {
                        const dnParts = precoCalc.kinetaGlowna.dn.map(function (d) {
                            return 'DN' + d;
                        });
                        const etyParts = precoCalc.kinetaGlowna.etykiety.map(function (e) {
                            return '[' + e + ']';
                        });
                        html +=
                            '<tr class="included-row-danger"><td colspan="3" class="pl-xl">↳ Kineta bazowa (' +
                            dnParts.join(' / ') +
                            ') ' +
                            etyParts.join(' / ') +
                            '</td><td class="text-right">' +
                            fmt(precoCalc.bazowa * precoMult) +
                            ' PLN</td></tr>';
                    }
                    if (precoCalc.skrzynki && precoCalc.skrzynki.suma > 0) {
                        html +=
                            '<tr class="included-row-danger"><td colspan="3" class="pl-xl">↳ + skrzynki włazowe (' +
                            precoCalc.skrzynki.ilosc +
                            ' × ' +
                            fmt(precoCalc.skrzynki.cenaSzt) +
                            ' PLN)</td><td class="text-right">' +
                            fmt(precoCalc.skrzynki.suma * precoMult) +
                            ' PLN</td></tr>';
                    }
                    if (precoCalc.spadekKineta > 0) {
                        html +=
                            '<tr class="included-row-danger"><td colspan="3" class="pl-xl">↳ + spadek kinety</td><td class="text-right">' +
                            fmt(precoCalc.spadekKineta * precoMult) +
                            ' PLN</td></tr>';
                    }
                    if (precoCalc.spadekMufa > 0) {
                        html +=
                            '<tr class="included-row-danger"><td colspan="3" class="pl-xl">↳ + spadek mufy</td><td class="text-right">' +
                            fmt(precoCalc.spadekMufa * precoMult) +
                            ' PLN</td></tr>';
                    }
                    if (precoCalc.uniesienie > 0) {
                        const mm =
                            precoCalc.uniesieniaSzczegoly &&
                            precoCalc.uniesieniaSzczegoly.length > 0
                                ? precoCalc.uniesieniaSzczegoly[0].mm
                                : '';
                        html +=
                            '<tr class="included-row-danger"><td colspan="3" class="pl-xl">↳ + uniesienie' +
                            (mm ? ' (' + mm + ' mm)' : '') +
                            '</td><td class="text-right">' +
                            fmt(precoCalc.uniesienie * precoMult) +
                            ' PLN</td></tr>';
                    }
                    if (precoCalc.redukcja > 0) {
                        html +=
                            '<tr class="included-row-danger"><td colspan="3" class="pl-xl">↳ + redukcja' +
                            (precoCalc.redukcjaOpis ? ' ' + precoCalc.redukcjaOpis : '') +
                            '</td><td class="text-right">' +
                            fmt(precoCalc.redukcja * precoMult) +
                            ' PLN</td></tr>';
                    }
                    if (precoCalc.dodWloty && precoCalc.dodWloty.length > 0) {
                        for (let dwi = 0; dwi < precoCalc.dodWloty.length; dwi++) {
                            const dw = precoCalc.dodWloty[dwi];
                            const dwTyp =
                                dw.typ === 'kaskada'
                                    ? 'kaskada'
                                    : dw.typ === 'sciana'
                                      ? 'ściana'
                                      : dw.typ === 'doplyw'
                                        ? 'dopływ'
                                        : dw.typ || '';
                            html +=
                                '<tr class="included-row-danger"><td colspan="3" class="pl-xl">↳ + dod. wlot DN' +
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
                            '<tr class="included-row-danger"><td colspan="3" class="pl-xl">↳ + pełna wysokość (' +
                            precoCalc.pelnaWysokosc.metry.toFixed(2) +
                            ' m)</td><td class="text-right">' +
                            fmt(precoCalc.pelnaWysokosc.cena * precoMult) +
                            ' PLN</td></tr>';
                    }
                }
            }
        } else if (precoAlloc.error && precoAlloc.isBottomMostDennica) {
            html += `<tr class="opacity-6-sm-danger">
                <td colspan="3" class="pl-lg">↳ ⚠ Wkładka PRECO — ${precoAlloc.error}</td>
                <td class="text-right">—</td>
            </tr>`;
        }
    }

    if (isBase) {
        if (wellTransportCost > 0) {
            html += `<tr style="opacity:0.6; font-size: var(--fs-sm); color:var(--accent2);">
                <td colspan="3" class="pl-lg">↳ <i data-lucide="truck" aria-hidden="true"></i> Udział w transporcie</td>
                <td class="text-right">${fmt(wellTransportCost)} PLN</td>
            </tr>`;
        }
    }
    return html;
}

/* ===== Rejestracja globali ===== */
window.renderWellHeaderRow = renderWellHeaderRow;
window.renderWellDetailsRow = renderWellDetailsRow;
