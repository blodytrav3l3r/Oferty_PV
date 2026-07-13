// @ts-check
/* ===== ZAMÓWIENIA STUDNI — IO + freeze + save ===== */

async function loadOrdersStudnie() {
    try {
        const res = await fetchWithTimeout('/api/orders-studnie', { headers: authHeaders() });
        const json = await res.json();
        return json.data || [];
    } catch (err) {
        logger.error('orderManager', 'Błąd ładowania zamówień studni:', err);
        return [];
    }
}

async function saveOrdersDataStudnie(data) {
    try {
        const res = await fetch('/api/orders-studnie', {
            method: 'PUT',
            headers: authHeaders(),
            body: JSON.stringify({ data })
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
    } catch (err) {
        logger.error('orderManager', 'Błąd zapisu zamówień studni:', err);
        showToast('Błąd zapisu zamówień', 'error');
    }
}

function freezeWellPrices(wellsArr) {
    (wellsArr || []).forEach((well) => {
        (well.config || []).forEach((item) => {
            const p = studnieProducts.find((pr) => pr.id === item.productId);
            if (!p) return;
            item.frozenPrice = getItemAssessedPrice(well, p, true, item);
            item.frozenPriceBase = getItemAssessedPrice(well, p, false, item);
            item.frozenName = p.name;
        });

        let discNadbudowa = 0;
        const discountKey = well.dn === 'styczna' ? 'styczne' : well.dn;
        if (discountKey && wellDiscounts[discountKey]) {
            discNadbudowa = wellDiscounts[discountKey].nadbudowa || 0;
        }
        const mult = 1 - discNadbudowa / 100;

        const configMap =
            typeof buildConfigMap !== 'undefined'
                ? buildConfigMap(well, (id) => studnieProducts.find((pr) => pr.id === id), true)
                : [];

        (well.przejscia || []).forEach((item) => {
            const p = studnieProducts.find((pr) => pr.id === item.productId);
            if (!p) return;

            let drillingBasePrice = 0;
            let drillProdName = '';
            let drillProdDn = '';
            const isInsitu = p.name && p.name.toUpperCase().includes('INSITU');

            if (!isInsitu && configMap.length > 0) {
                let rzDna = parseFloat(well.rzednaDna) || 0;
                let pel = parseFloat(item.rzednaWlaczenia);
                if (isNaN(pel)) pel = rzDna;
                let mmFromBottom = (pel - rzDna) * 1000;

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
                            /** @type {any} */
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
                                drillProdName = bestDrill.name;
                                drillProdDn = bestDrill.dn || '';
                            }
                        }
                    }
                }
            }

            const transPriceBase = p.price || 0;
            const bP = transPriceBase + drillingBasePrice;
            item.frozenPrice = bP * mult;
            item.frozenPriceBase = bP;
            item.frozenName = p.name || p.category;
            item.frozenTransitionPrice = transPriceBase * mult;
            item.frozenDrillingPrice = drillingBasePrice * mult;
            item.frozenDrillingName = drillProdName;
            item.frozenDrillingDn = drillProdDn;
        });
    });
}

async function saveOrderStudnie() {
    if (!editingOfferIdStudnie) return;
    const offer = offersStudnie.find((o) => o.id === editingOfferIdStudnie);
    if (!offer) return;
    const oId = normalizeId(offer.id);
    const order = ordersStudnie ? ordersStudnie.find((o) => normalizeId(o.offerId) === oId) : null;
    if (!order) return;

    freezeWellPrices(wells);

    order.wells = structuredClone(wells);
    if (typeof window.wellDiscounts !== 'undefined') {
        order.wellDiscounts = structuredClone(window.wellDiscounts);
    }
    order.visiblePrzejsciaTypes = Array.from(visiblePrzejsciaTypes);
    order.updatedAt = new Date().toISOString();

    let totalNetto = 0,
        totalWeight = 0;
    wells.forEach((well) => {
        const stats = calcWellStats(well);
        totalNetto += stats.price;
        totalWeight += stats.weight;
    });
    order.totalWeight = totalWeight;

    const transportKmVal = parseFloat(offer.transportKm) || 0;
    const transportRateVal = parseFloat(offer.transportRate) || 0;
    const orderMode = order.transportMode || offer.transportMode || 'full';
    let totalTransportCostForOffer = 0;
    if (transportKmVal > 0 && transportRateVal > 0 && totalWeight > 0) {
        totalTransportCostForOffer =
            (typeof calcTransportCount === 'function'
                ? calcTransportCount(totalWeight, orderMode)
                : Math.ceil(totalWeight / MAX_TRANSPORT_WEIGHT)) *
            transportKmVal *
            transportRateVal;
    }
    const orderTotal = totalNetto + totalTransportCostForOffer;
    order.totalNetto = orderTotal;
    order.totalBrutto = orderTotal * 1.23;

    order.wellsExport = wells.map((well) => {
        const stats = calcWellStats(well);
        const wellTransportCost =
            totalWeight > 0 ? totalTransportCostForOffer * (stats.weight / totalWeight) : 0;
        const zwienczenie =
            typeof getWellZwienczenieName === 'function' ? getWellZwienczenieName(well) : '—';
        return {
            name: well.name,
            dn: well.dn,
            height: stats.height,
            weight: stats.weight,
            zwienczenie: zwienczenie,
            price: stats.price,
            transportCost: wellTransportCost,
            totalPrice: stats.price + wellTransportCost,
            config: well.config,
            przejscia: well.przejscia
        };
    });

    await saveOrdersDataStudnie(ordersStudnie);
    showToast('<i data-lucide="package"></i> Zamówienie zaktualizowane', 'success');
}

async function saveCurrentOrder(options = {}) {
    if (!orderEditMode) {
        showToast('Brak trybu zamówienia', 'error');
        return;
    }

    const order = orderEditMode.order;

    if (!options.skipFreeze) {
        freezeWellPrices(wells);
    }

    order.wells = structuredClone(wells);
    if (typeof window.wellDiscounts !== 'undefined') {
        order.wellDiscounts = structuredClone(window.wellDiscounts);
    }
    order.visiblePrzejsciaTypes = Array.from(visiblePrzejsciaTypes);
    order.updatedAt = new Date().toISOString();

    let totalNetto = 0,
        totalWeight = 0;
    wells.forEach((well) => {
        const stats = calcWellStats(well);
        totalNetto += stats.price;
        totalWeight += stats.weight;
    });
    order.totalWeight = totalWeight;

    const offer = offersStudnie ? offersStudnie.find((o) => o.id === order.offerId) : null;
    const transportKmVal = parseFloat(document.getElementById('transport-km')?.value) || 0;
    const transportRateVal = parseFloat(document.getElementById('transport-rate')?.value) || 0;

    order.transportKm = transportKmVal;
    order.transportRate = transportRateVal;
    order.transportMode = currentTransportMode;

    let totalTransportCostForOffer = 0;
    if (transportKmVal > 0 && transportRateVal > 0 && totalWeight > 0) {
        const offerTotalWeight = offer?.totalWeight || totalWeight;
        const fullOfferCost =
            (typeof calcTransportCount === 'function'
                ? calcTransportCount(offerTotalWeight, currentTransportMode)
                : Math.ceil(offerTotalWeight / MAX_TRANSPORT_WEIGHT)) *
            transportKmVal *
            transportRateVal;
        totalTransportCostForOffer =
            offerTotalWeight > 0 ? fullOfferCost * (totalWeight / offerTotalWeight) : 0;
    }
    const orderTotal = totalNetto + totalTransportCostForOffer;
    order.totalNetto = orderTotal;
    order.totalBrutto = orderTotal * 1.23;

    order.wellsExport = wells.map((well) => {
        const stats = calcWellStats(well);
        const wellTransportCost =
            totalWeight > 0 ? totalTransportCostForOffer * (stats.weight / totalWeight) : 0;
        const zwienczenie =
            typeof getWellZwienczenieName === 'function' ? getWellZwienczenieName(well) : '—';
        return {
            name: well.name,
            dn: well.dn,
            height: stats.height,
            weight: stats.weight,
            zwienczenie: zwienczenie,
            price: stats.price,
            transportCost: wellTransportCost,
            totalPrice: stats.price + wellTransportCost,
            config: well.config,
            przejscia: well.przejscia
        };
    });

    try {
        await fetch(`/api/orders-studnie/${order.id}`, {
            method: 'PATCH',
            headers: authHeaders(),
            body: JSON.stringify({
                wells: order.wells,
                wellDiscounts: order.wellDiscounts,
                kartaBudowy: order.kartaBudowy,
                updatedAt: order.updatedAt,
                wellsExport: order.wellsExport,
                totalWeight: order.totalWeight,
                totalNetto: order.totalNetto,
                totalBrutto: order.totalBrutto,
                transportKm: order.transportKm,
                transportRate: order.transportRate,
                transportMode: order.transportMode
            })
        });
        showToast('<i data-lucide="package"></i> Zamówienie zapisane', 'success');
        renderOrderModeBanner();
        if (typeof renderOfferSummary === 'function') renderOfferSummary();
    } catch (err) {
        logger.error('orderManager', 'Błąd zapisu zamówienia:', err);
        showToast('Błąd zapisu zamówienia', 'error');
    }
}

window.loadOrdersStudnie = loadOrdersStudnie;
window.saveOrdersDataStudnie = saveOrdersDataStudnie;
window.freezeWellPrices = freezeWellPrices;
window.saveOrderStudnie = saveOrderStudnie;
window.saveCurrentOrder = saveCurrentOrder;
