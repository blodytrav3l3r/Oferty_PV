/* ===== STATYSTYKI STUDNI — KALKULACJA ===== */

function calcWellStats(well) {
    let price = 0,
        weight = 0,
        height = 0,
        areaInt = 0,
        areaExt = 0;
    let priceDennica = 0,
        priceNadbudowa = 0;

    let priceBase = 0,
        priceDennicaBase = 0,
        priceNadbudowaBase = 0;

    let lastWasDennica = !!well.psiaBuda;
    const configReversed = [...(well.config || [])].reverse();

    configReversed.forEach((item) => {
        const p =
            typeof resolveEffectiveProduct === 'function'
                ? resolveEffectiveProduct(well, item.productId, item)
                : studnieProducts.find((pr) => pr.id === item.productId);
        if (!p) return;

        let itemPriceDisc, itemPriceBaseVal;
        const useFrozenPrice = item.frozenPrice != null && window.isPreviewMode;
        if (useFrozenPrice) {
            itemPriceDisc = item.frozenPrice;
            itemPriceBaseVal =
                item.frozenPriceBase != null ? item.frozenPriceBase : item.frozenPrice;
        } else {
            itemPriceDisc = getItemAssessedPrice(well, p, true, item);
            itemPriceBaseVal = getItemAssessedPrice(well, p, false, item);
        }

        const lineTotalDisc = itemPriceDisc * item.quantity;
        const lineTotalBase = itemPriceBaseVal * item.quantity;

        price += lineTotalDisc;
        priceBase += lineTotalBase;

        if (
            p.componentType === 'dennica' ||
            p.componentType === 'kineta' ||
            p.componentType === 'styczna'
        ) {
            priceDennica += lineTotalDisc;
            priceDennicaBase += lineTotalBase;
        } else {
            priceNadbudowa += lineTotalDisc;
            priceNadbudowaBase += lineTotalBase;
        }

        weight += (p.weight || 0) * item.quantity;
        areaInt += (p.area || 0) * item.quantity;
        areaExt += (p.areaExt || 0) * item.quantity;

        for (let q = 0; q < item.quantity; q++) {
            let h = p.height || 0;
            if (p.componentType === 'dennica' && lastWasDennica) {
                h -= 100;
            }
            height += h;
            if (p.componentType !== 'uszczelka') {
                lastWasDennica = p.componentType === 'dennica';
            }
        }
    });

    if (well.przejscia) {
        let discNadbudowa = 0;
        const discountKey = well.dn === 'styczna' ? 'styczne' : well.dn;
        const activeDiscounts = getWellActiveDiscounts(well);
        if (discountKey && activeDiscounts[discountKey]) {
            discNadbudowa = activeDiscounts[discountKey].nadbudowa || 0;
        }
        const mult = 1 - discNadbudowa / 100;

        let configMap = [];
        if (typeof buildConfigMap === 'function') {
            configMap = buildConfigMap(
                well,
                (id) => studnieProducts.find((pr) => pr.id === id),
                true
            );
        }

        well.przejscia.forEach((item) => {
            const p = studnieProducts.find((pr) => pr.id === item.productId);
            if (!p) return;

            let drillingBasePrice = 0;
            const isInsitu = p.name && p.name.toUpperCase().includes('INSITU');

            if (!isInsitu && configMap.length > 0) {
                const rzDna = parseFloat(well.rzednaDna) || 0;
                let pel = parseFloat(item.rzednaWlaczenia);
                if (isNaN(pel)) pel = rzDna;
                const mmFromBottom = (pel - rzDna) * 1000;

                if (typeof findAssignedElement === 'function') {
                    const assigned = findAssignedElement(mmFromBottom, configMap);
                    if (
                        assigned &&
                        assigned.entry &&
                        (assigned.entry.componentType === 'krag' ||
                            assigned.entry.componentType === 'krag_ot')
                    ) {
                        const trDn = parseInt(item.dn) || parseInt(p.dn) || 0;
                        if (trDn > 0) {
                            const drillingProducts = studnieProducts.filter(
                                (x) => x.category === 'Wiercenie'
                            );
                            let bestDrill = null;
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
                                        bestDrill = drill;
                                    }
                                }
                            });

                            if (bestDrill) {
                                drillingBasePrice = bestDrill.price || 0;
                            }
                        }
                    }
                }
            }

            let bP, dP;
            if (item.frozenPrice != null && window.isPreviewMode) {
                dP = item.frozenPrice;
                bP = item.frozenPriceBase != null ? item.frozenPriceBase : item.frozenPrice;
            } else {
                bP = (p.price || 0) + drillingBasePrice;
                dP = bP * mult;
            }

            priceBase += bP;
            priceNadbudowaBase += bP;

            price += dP;
            priceNadbudowa += dP;

            if (item.doplata) {
                price += item.doplata;
                priceNadbudowa += item.doplata;
            }

            weight += p.weight || 0;
        });
    }

    let malowanieZewTotal = 0;
    if (well.malowanieZ === 'zewnatrz' && well.malowanieZewCena) {
        malowanieZewTotal = areaExt * well.malowanieZewCena;
    }

    let hasError = false;
    let errorMessage = null;

    if (well.kineta === 'preco' || well.kineta === 'precotop') {
        const precoResult = calcPrecoPricing(well);
        if (precoResult.error) {
            hasError = true;
            errorMessage = precoResult.error;
        } else {
            const discountKey = well.dn === 'styczna' ? 'styczne' : well.dn;
            const activeDiscounts = getWellActiveDiscounts(well);
            const discPreco = (activeDiscounts[discountKey] || {}).preco || 0;
            const precoMult = 1 - discPreco / 100;
            const precoCost = precoResult.suma * precoMult;
            price += precoCost;
            priceDennica += precoCost;
            priceBase += precoResult.suma;
            priceDennicaBase += precoResult.suma;
        }
    }

    if (well.doplata) {
        price += well.doplata;
        priceDennica += well.doplata;
    }

    return {
        price: hasError ? 0 : price,
        priceBase: hasError ? 0 : priceBase,
        priceDennica: hasError ? 0 : priceDennica,
        priceDennicaBase: hasError ? 0 : priceDennicaBase,
        priceNadbudowa: hasError ? 0 : priceNadbudowa,
        priceNadbudowaBase: hasError ? 0 : priceNadbudowaBase,
        weight,
        height,
        areaInt,
        areaExt,
        malowanieZewTotal,
        error: errorMessage
    };
}

window.getItemPriceBreakdown = getItemPriceBreakdown;

if (typeof registerCspAction === 'function') {
    registerCspAction('resetWellParamsToDefaults', window.resetWellParamsToDefaults);
}
