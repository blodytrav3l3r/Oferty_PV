// @ts-check
/* ===== OFERTA — PRECO, przejścia, wycena liniowa (kalkulacje) ===== */

function calculatePrecoAllocationForItem(well, itemIndex) {
    let allocatedCost = 0;
    let fraction = 0;
    let isBottomMostDennica = false;
    let error = null;
    let hasPreco = false;

    if (
        (well.kineta === 'preco' ||
            well.kineta === 'precotop' ||
            well.wkladkaOsadnikPreco === 'tak') &&
        typeof calcPrecoPricing === 'function'
    ) {
        const precoCalc = calcPrecoPricing(well);
        if (precoCalc.error) {
            error = precoCalc.error;
            hasPreco = true;
        } else if (precoCalc.suma > 0) {
            hasPreco = true;
            let configMap = [];
            if (typeof buildConfigMap === 'function') {
                configMap = buildConfigMap(
                    well,
                    (id) => studnieProducts.find((pr) => pr.id === id),
                    true
                );
            } else {
                let currY = 0;
                let dennicaCount = 0;
                for (let j = well.config.length - 1; j >= 0; j--) {
                    const p = studnieProducts.find((x) => x.id === well.config[j].productId);
                    if (!p) continue;
                    let h = 0;
                    if (p.componentType === 'dennica') {
                        dennicaCount++;
                        h = (p.height || 0) - (dennicaCount > 1 ? 100 : 0);
                    } else {
                        h = (p.height || 0) * (well.config[j].quantity || 1);
                    }
                    configMap.push({
                        index: j,
                        start: currY,
                        end: currY + h,
                        componentType: p.componentType
                    });
                    currY += h;
                }
            }

            const targetCm = configMap.find((cm) => cm.index === itemIndex);
            if (targetCm) {
                const bottomDennicaCm = configMap.find(
                    (cm) => cm.componentType === 'dennica' || cm.componentType === 'styczna'
                );
                isBottomMostDennica = bottomDennicaCm && bottomDennicaCm.index === itemIndex;

                if (isBottomMostDennica) {
                    allocatedCost += precoCalc.bazowa || 0;
                    allocatedCost += precoCalc.skrzynki?.suma || 0;
                    allocatedCost += precoCalc.spadekKineta || 0;
                    allocatedCost += precoCalc.spadekMufa || 0;
                    allocatedCost += precoCalc.uniesienie || 0;
                    allocatedCost += precoCalc.redukcja || 0;
                    allocatedCost += (precoCalc.dodWloty || []).reduce((s, d) => s + d.cena, 0);
                }

                if (precoCalc.pelnaWysokosc) {
                    const startZ = precoCalc.pelnaWysokosc.startZ || 0;
                    const endZ = precoCalc.pelnaWysokosc.endZ || 0;
                    if (endZ > startZ) {
                        const overlap = Math.max(
                            0,
                            Math.min(endZ, targetCm.end) - Math.max(startZ, targetCm.start)
                        );
                        if (overlap > 0) {
                            fraction = overlap / (endZ - startZ);
                            allocatedCost += precoCalc.pelnaWysokosc.cena * fraction;
                        }
                    }
                }
            }
        }
    }

    return { hasPreco, error, allocatedCost, fraction, isBottomMostDennica };
}

function calculateAssignedPrzejscia(well) {
    const assigned = {};
    const rzDna = parseFloat(well.rzednaDna) || 0;

    let configMap = [];
    if (typeof buildConfigMap === 'function') {
        configMap = buildConfigMap(well, (id) => studnieProducts.find((pr) => pr.id === id), true);
    } else {
        let currY = 0;
        let dennicaCount = 0;
        for (let j = well.config.length - 1; j >= 0; j--) {
            const p = studnieProducts.find((x) => x.id === well.config[j].productId);
            if (!p) continue;
            let h = 0;
            if (p.componentType === 'dennica') {
                dennicaCount++;
                h = (p.height || 0) - (dennicaCount > 1 ? 100 : 0);
            } else {
                h = (p.height || 0) * (well.config[j].quantity || 1);
            }
            configMap.push({
                index: j,
                start: currY,
                end: currY + h,
                componentType: p.componentType
            });
            currY += h;
        }
    }

    if (well.przejscia) {
        well.przejscia.forEach((pr) => {
            const mmFromBottom = (parseFloat(pr.rzednaWlaczenia || rzDna) - rzDna) * 1000;

            let idx = well.config.length - 1;
            let target = null;

            if (typeof findAssignedElement === 'function') {
                const fae = findAssignedElement(mmFromBottom, configMap);
                if (fae && fae.entry) {
                    idx = fae.assignedIndex;
                    target = fae.entry;
                }
            } else {
                target = configMap.find((cm) => mmFromBottom >= cm.start && mmFromBottom < cm.end);
                idx = target ? target.index : well.config.length - 1;
            }

            if (!assigned[idx]) assigned[idx] = [];

            let drillingBasePrice = 0;
            let bestDrillProd = /** @type {any} */ (null);
            const p = studnieProducts.find((x) => x.id === pr.productId);
            if (p) {
                const isInsitu = p.name && p.name.toUpperCase().includes('INSITU');
                if (
                    !isInsitu &&
                    target &&
                    (target.componentType === 'krag' || target.componentType === 'krag_ot')
                ) {
                    const trDn = parseInt(pr.dn) || parseInt(p.dn) || 0;
                    if (trDn > 0) {
                        const drillingProducts = studnieProducts.filter(
                            (x) => x.category === 'Wiercenie'
                        );
                        let bestDnDiff = Infinity;
                        drillingProducts.forEach((drill) => {
                            let drillDn = parseInt(drill.dn);
                            if (isNaN(drillDn)) {
                                const match = drill.id.match(/Wiercenie-(\d+)/i);
                                if (match) drillDn = parseInt(match[1]);
                            }
                            if (!isNaN(drillDn) && drillDn >= trDn) {
                                if (drillDn - trDn < bestDnDiff) {
                                    bestDnDiff = drillDn - trDn;
                                    bestDrillProd = drill;
                                }
                            }
                        });
                        if (bestDrillProd) {
                            drillingBasePrice = bestDrillProd.price || 0;
                        }
                    }
                }
            }

            assigned[idx].push({
                ...pr,
                _drillingBasePrice: drillingBasePrice,
                _drillingProd: bestDrillProd
            });
        });
    }
    return assigned;
}

function calculateLinePricing(
    well,
    p,
    item,
    wellTransportCost,
    disc,
    nadbudowaMult,
    itemPrzejscia,
    itemIndex
) {
    const itemPrice =
        item.frozenPrice != null && window.isPreviewMode
            ? item.frozenPrice
            : getItemAssessedPrice(well, p, true, item);
    let totalLinePrice = itemPrice * item.quantity;
    let totalLineWeight = (p.weight || 0) * item.quantity;

    if (p.componentType === 'dennica' || p.componentType === 'styczna') {
        totalLinePrice += wellTransportCost;
        if (well.doplata) totalLinePrice += well.doplata;
    }

    const precoAlloc = calculatePrecoAllocationForItem(well, itemIndex);
    if (precoAlloc.hasPreco && precoAlloc.allocatedCost > 0) {
        const discKey = well.dn === 'styczna' ? 'styczne' : well.dn;
        const discPreco = (wellDiscounts[discKey] || {}).preco || 0;
        const precoMult = 1 - discPreco / 100;
        totalLinePrice += precoAlloc.allocatedCost * precoMult;
    }

    if (itemPrzejscia) {
        itemPrzejscia.forEach((pr) => {
            const prProd = studnieProducts.find((x) => x.id === pr.productId);
            if (prProd) {
                if (pr.frozenTransitionPrice != null) {
                    totalLinePrice +=
                        pr.frozenTransitionPrice +
                        (pr.doplata || 0) +
                        (pr.frozenDrillingPrice || 0);
                } else {
                    totalLinePrice += (prProd.price || 0) * nadbudowaMult + (pr.doplata || 0);
                    if (pr._drillingBasePrice > 0) {
                        totalLinePrice += pr._drillingBasePrice * nadbudowaMult;
                    }
                }
                totalLineWeight += prProd.weight || 0;
            }
        });
    }

    return { totalLinePrice, totalLineWeight };
}

function getDiscountStr(p, disc) {
    const isDen =
        p.componentType === 'dennica' ||
        p.componentType === 'kineta' ||
        p.componentType === 'styczna';
    const val = isDen ? disc.dennica : disc.nadbudowa;
    return val > 0
        ? ` <span style="font-size:0.6rem; color:var(--success); margin-left:0.3rem;">(-${val}%)</span>`
        : '';
}
