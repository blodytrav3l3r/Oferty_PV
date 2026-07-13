// @ts-check
/* ===== OFERTA — PRECO, przejścia, wycena liniowa (renderowanie) ===== */

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
                        <td colspan="3" style="padding-left:2.0rem;">↳ ${doplPrSign} Dopłata indywidualna do przejścia</td>
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
                        <td colspan="3" style="padding-left:2.0rem;">↳ ${doplPrSign2} Dopłata indywidualna do przejścia</td>
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
                const kBd = getItemPriceBreakdown(well, kp, true, kineta);
                const kQ = kineta.quantity || 1;
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
                        const mm =
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
