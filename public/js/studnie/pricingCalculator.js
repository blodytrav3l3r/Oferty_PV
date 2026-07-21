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
        var stats = calcWellStats(well);
        totalNetto += stats.price;
        totalWeight += stats.weight;
    });

    var globalWeightForTransport = 0;
    wells.forEach(function (w) {
        globalWeightForTransport += calcWellStats(w).weight;
    });
    var totalTransportCostForOffer = 0;
    if (transportKm > 0 && transportRate > 0) {
        var totalTransportsCount =
            typeof calcTransportCount === 'function'
                ? calcTransportCount(globalWeightForTransport, transportMode)
                : Math.ceil(globalWeightForTransport / MAX_TRANSPORT_WEIGHT);
        var costPerTrip = transportKm * transportRate;
        totalTransportCostForOffer = totalTransportsCount * costPerTrip;
    }

    var productMap = new Map(
        studnieProducts.map(function (p) {
            return [p.id, p];
        })
    );
    var wellsForExport = wells.map(function (well) {
        var stats = calcWellStats(well);
        var wellTransportCost =
            globalWeightForTransport > 0
                ? totalTransportCostForOffer * (stats.weight / globalWeightForTransport)
                : 0;
        var zwienczenie =
            typeof getWellZwienczenieName === 'function' ? getWellZwienczenieName(well) : '\u2014';
        var discountKey = well.dn === 'styczna' ? 'styczne' : well.dn || '';
        var activeDiscounts =
            typeof getWellActiveDiscounts === 'function'
                ? getWellActiveDiscounts(well)
                : typeof wellDiscounts !== 'undefined'
                  ? wellDiscounts
                  : {};
        var disc = activeDiscounts[discountKey] || { dennica: 0, nadbudowa: 0, preco: 0 };
        var nadbudowaMult = 1 - (disc.nadbudowa || 0) / 100;
        var precoMult = 1 - (disc.preco || 0) / 100;
        var assignedPrzejscia =
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
                var p = productMap.get(item.productId);
                if (!p) return Object.assign({}, item);
                if (p.componentType === 'kineta') {
                    return Object.assign({}, item, { _xskip: true, _xp: 0 });
                }
                var isDennica = ['dennica', 'styczna'].includes(p.componentType);
                var hasKineta =
                    p.componentType === 'dennica' &&
                    well.config.some(function (c) {
                        var kp = productMap.get(c.productId);
                        return kp && kp.componentType === 'kineta';
                    });
                var myPrzejscia = assignedPrzejscia[index] || [];
                var hasSurcharge = hasKineta || myPrzejscia.length > 0;
                if (!hasSurcharge && typeof getItemPriceBreakdown === 'function') {
                    var bd = getItemPriceBreakdown(well, p, false, item);
                    hasSurcharge =
                        bd.pehd > 0 ||
                        bd.malowanieW > 0 ||
                        bd.malowanieZ > 0 ||
                        bd.zelbet > 0 ||
                        bd.nierdzewna > 0;
                }
                if (!hasSurcharge && typeof calculatePrecoAllocationForItem === 'function') {
                    var pa = calculatePrecoAllocationForItem(well, index);
                    if (pa.hasPreco && pa.allocatedCost > 0) hasSurcharge = true;
                }
                if (hasSurcharge) {
                    var basePrice =
                        typeof getItemAssessedPrice === 'function'
                            ? getItemAssessedPrice(well, p, true, item)
                            : p.price || 0;
                    if (p.componentType === 'dennica') {
                        var ki = well.config.find(function (c) {
                            var kp = productMap.get(c.productId);
                            return kp && kp.componentType === 'kineta';
                        });
                        if (ki) {
                            var kp = productMap.get(ki.productId);
                            var kPrice =
                                typeof getItemAssessedPrice === 'function'
                                    ? getItemAssessedPrice(well, kp, true, ki)
                                    : 0;
                            basePrice += kPrice;
                        }
                    }
                    for (var przIdx = 0; przIdx < myPrzejscia.length; przIdx++) {
                        var prz = myPrzejscia[przIdx];
                        var pp = productMap.get(prz.productId);
                        if (!pp) continue;
                        basePrice +=
                            (pp.price || 0) * nadbudowaMult +
                            (prz._drillingBasePrice || 0) * nadbudowaMult +
                            (parseFloat(prz.doplata) || 0);
                    }
                    if (typeof calculatePrecoAllocationForItem === 'function') {
                        var pa2 = calculatePrecoAllocationForItem(well, index);
                        if (pa2.hasPreco && pa2.allocatedCost > 0) {
                            basePrice += pa2.allocatedCost * precoMult;
                        }
                    }
                    return Object.assign({}, item, { _xp: basePrice });
                }
                var discountPct = isDennica ? disc.dennica || 0 : disc.nadbudowa || 0;
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
