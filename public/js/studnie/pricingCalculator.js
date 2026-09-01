// @ts-check
/* ===== KALKULATOR WYCENY OFERTY (STUDNIE) ===== */
/* Wydzielone z offerSave.js — odpowiedzialność: kalkulacja cen, transportu, i eksportu studni */
/* Zależności: calcWellStats, studnieProducts, wellDiscounts, getWellZwienczenieName, getWellActiveDiscounts,
   calculateAssignedPrzejscia, getItemPriceBreakdown, calculatePrecoAllocationForItem,
   getItemAssessedPrice, calcTransportCount, MAX_TRANSPORT_WEIGHT (wszystkie globalne) */

/**
 * Oblicza pełną wycenę oferty studni: sumy, koszty transportu, dane eksportowe.
 * @param {Array} wells
 * @param {number} transportKm
 * @param {number} transportRate
 * @param {string} transportMode
 * @returns {{totalNetto:number,totalWeight:number,totalTransportCostForOffer:number,wellsForExport:Array}}
 */
function calculateOfferPricing(wells, transportKm, transportRate, transportMode) {
    let totalNetto = 0;
    let totalWeight = 0;
    wells.forEach(function (well) {
        const stats = calcWellStats(well);
        totalNetto += stats.price;
        totalWeight += stats.weight;
    });

    let globalWeightForTransport = 0;
    wells.forEach(function (w) {
        globalWeightForTransport += calcWellStats(w).weight;
    });
    let totalTransportCostForOffer = 0;
    if (transportKm > 0 && transportRate > 0) {
        const totalTransportsCount =
            typeof calcTransportCount === 'function'
                ? calcTransportCount(globalWeightForTransport, transportMode)
                : Math.ceil(globalWeightForTransport / MAX_TRANSPORT_WEIGHT);
        const costPerTrip = transportKm * transportRate;
        totalTransportCostForOffer = totalTransportsCount * costPerTrip;
    }

    const productMap =
        typeof studnieProductsById !== 'undefined' && studnieProductsById
            ? studnieProductsById
            : new Map(
                  studnieProducts.map(function (p) {
                      return [p.id, p];
                  })
              );
    const wellsForExport = wells.map(function (well) {
        const stats = calcWellStats(well);
        const wellTransportCost =
            globalWeightForTransport > 0
                ? totalTransportCostForOffer * (stats.weight / globalWeightForTransport)
                : 0;
        const zwienczenie =
            typeof getWellZwienczenieName === 'function' ? getWellZwienczenieName(well) : '\u2014';
        const discountKey = well.dn === 'styczna' ? 'styczne' : well.dn || '';
        const activeDiscounts =
            typeof getWellActiveDiscounts === 'function'
                ? getWellActiveDiscounts(well)
                : typeof wellDiscounts !== 'undefined'
                  ? wellDiscounts
                  : {};
        const disc = activeDiscounts[discountKey] || { dennica: 0, nadbudowa: 0, preco: 0 };
        const nadbudowaMult = 1 - getWellNadbudowaPct(well, disc) / 100;
        const precoMult = 1 - (disc.preco || 0) / 100;
        const assignedPrzejscia =
            typeof calculateAssignedPrzejscia === 'function'
                ? calculateAssignedPrzejscia(well)
                : {};
        return {
            name: well.name,
            dn: well.dn,
            height: stats.height,
            weight: stats.weight,
            zwienczenie: zwienczenie,
            price: stats.price,
            transportCost: wellTransportCost,
            totalPrice: stats.price + wellTransportCost,
            rzednaWlazu: well.rzednaWlazu,
            rzednaDna: well.rzednaDna,
            magazyn: well.magazyn,
            config: (well.config || []).map(function (item, index) {
                const p = productMap.get(item.productId);
                if (!p) return Object.assign({}, item);
                if (p.componentType === 'kineta') {
                    return Object.assign({}, item, { _xskip: true, _xp: 0 });
                }
                const hasKineta =
                    p.componentType === 'dennica' &&
                    well.config.some(function (c) {
                        const kp = productMap.get(c.productId);
                        return kp && kp.componentType === 'kineta';
                    });
                const myPrzejscia = assignedPrzejscia[index] || [];
                let hasSurcharge = hasKineta || myPrzejscia.length > 0;
                if (!hasSurcharge && typeof getItemPriceBreakdown === 'function') {
                    const bd = getItemPriceBreakdown(well, p, false, item);
                    hasSurcharge =
                        bd.pehd > 0 ||
                        bd.malowanieW > 0 ||
                        bd.malowanieZ > 0 ||
                        bd.zelbet > 0 ||
                        bd.nierdzewna > 0;
                }
                if (!hasSurcharge && typeof calculatePrecoAllocationForItem === 'function') {
                    const pa = calculatePrecoAllocationForItem(well, index);
                    if (pa.hasPreco && pa.allocatedCost > 0) hasSurcharge = true;
                }
                if (hasSurcharge) {
                    let basePrice =
                        typeof getItemAssessedPrice === 'function'
                            ? getItemAssessedPrice(well, p, true, item)
                            : p.price || 0;
                    if (p.componentType === 'dennica') {
                        const ki = well.config.find(function (c) {
                            const kp = productMap.get(c.productId);
                            return kp && kp.componentType === 'kineta';
                        });
                        if (ki) {
                            const kp = productMap.get(ki.productId);
                            const kPrice =
                                typeof getItemAssessedPrice === 'function'
                                    ? getItemAssessedPrice(well, kp, true, ki)
                                    : 0;
                            basePrice += kPrice;
                        }
                    }
                    for (let przIdx = 0; przIdx < myPrzejscia.length; przIdx++) {
                        const prz = myPrzejscia[przIdx];
                        const pp = productMap.get(prz.productId);
                        if (!pp) continue;
                        basePrice +=
                            (pp.price || 0) * nadbudowaMult +
                            (prz._drillingBasePrice || 0) * nadbudowaMult +
                            (parseFloat(prz.doplata) || 0);
                    }
                    if (typeof calculatePrecoAllocationForItem === 'function') {
                        const pa2 = calculatePrecoAllocationForItem(well, index);
                        if (pa2.hasPreco && pa2.allocatedCost > 0) {
                            basePrice += pa2.allocatedCost * precoMult;
                        }
                    }
                    return Object.assign({}, item, { _xp: basePrice });
                }
                const discountPct = getWellDiscountPct(well, p, disc);
                return Object.assign({}, item, { _xp: p.price || 0, _xd: discountPct });
            }),
            przejscia: well.przejscia
        };
    });

    return {
        totalNetto: totalNetto,
        totalWeight: totalWeight,
        totalTransportCostForOffer: totalTransportCostForOffer,
        wellsForExport: wellsForExport
    };
}

window.calculateOfferPricing = calculateOfferPricing;
