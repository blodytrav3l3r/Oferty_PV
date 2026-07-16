/* ===== KALKULACJA CEN I KOSZTÓW TRANSPORTU ===== */

function calculateOfferTotals() {
    let globalWeight = 0;
    wells.forEach((w) => (globalWeight += calcWellStats(w).weight));

    const transportKm = parseFloat(document.getElementById('transport-km')?.value) || 0;
    const transportRate = parseFloat(document.getElementById('transport-rate')?.value) || 0;

    let totalTransports = 0,
        transportCostPerTrip = 0,
        totalTransportCost = 0;
    if (transportKm > 0 && transportRate > 0) {
        transportCostPerTrip = transportKm * transportRate;
        if (
            typeof orderEditMode !== 'undefined' &&
            orderEditMode &&
            /** @type {any} */ (orderEditMode).order
        ) {
            const _order = /** @type {any} */ (orderEditMode).order;
            const _offer =
                typeof offersStudnie !== 'undefined' && offersStudnie
                    ? offersStudnie.find((o) => o.id === _order.offerId)
                    : null;
            const _offerWeight = _offer?.totalWeight || globalWeight;
            const _mode = _order.transportMode || currentTransportMode;
            const fullOfferCost =
                (typeof calcTransportCount === 'function'
                    ? calcTransportCount(_offerWeight, _mode)
                    : Math.ceil(_offerWeight / MAX_TRANSPORT_WEIGHT)) * transportCostPerTrip;
            totalTransportCost =
                _offerWeight > 0 ? fullOfferCost * (globalWeight / _offerWeight) : 0;
            totalTransports =
                transportCostPerTrip > 0 ? totalTransportCost / transportCostPerTrip : 0;
        } else {
            totalTransports =
                typeof calcTransportCount === 'function'
                    ? calcTransportCount(globalWeight, currentTransportMode)
                    : Math.ceil(globalWeight / MAX_TRANSPORT_WEIGHT);
            totalTransportCost = totalTransports * transportCostPerTrip;
        }
    }

    return { globalWeight, totalTransports, transportCostPerTrip, totalTransportCost };
}

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
