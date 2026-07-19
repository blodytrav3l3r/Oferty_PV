/* ===== ZAMÓWIENIA STUDNI ===== */
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

/* ===== POMOCNIKI ZAMÓWIEŃ CZĘŚCIOWYCH ===== */

/** Zwraca wszystkie zamówienia powiązane z daną ofertą */
function getOrdersForOffer(offerId) {
    if (!ordersStudnie || !offerId) return [];
    const nId = normalizeId(offerId);
    return ordersStudnie.filter((o) => normalizeId(o.offerId || o.offerStudnieId) === nId);
}

/** Zwraca Set<string> z ID studni, które są już zamówione dla danej oferty */
function getOrderedWellIds(offerId) {
    const orders = getOrdersForOffer(offerId);
    const ids = new Set();
    orders.forEach((order) => {
        (order.wells || []).forEach((w) => {
            if (w.id) ids.add(w.id);
        });
    });
    return ids;
}

/** Sprawdza, czy dana studnia jest zamówiona w ramach bieżącej oferty */
function isWellOrdered(well) {
    if (!well || !well.id || !editingOfferIdStudnie) return false;
    return getOrderedWellIds(editingOfferIdStudnie).has(well.id);
}

/** Oblicza progres zamówień dla danej oferty: { ordered, total, percent } */
function getOfferOrderProgress(offerId, offerWells) {
    const orderedIds = getOrderedWellIds(offerId);
    const total = (offerWells || []).length;
    const ordered = (offerWells || []).filter((w) => w.id && orderedIds.has(w.id)).length;
    const percent = total > 0 ? Math.round((ordered / total) * 100) : 0;
    return { ordered, total, percent };
}

/** Zwraca zamówienie, do którego należy dana studnia (jeśli istnieje) */
function getOrderForWellId(wellId, offerId) {
    if (!wellId || !ordersStudnie) return null;
    const nId = offerId ? normalizeId(offerId) : null;
    return (
        ordersStudnie.find((order) => {
            if (nId && normalizeId(order.offerId) !== nId) return false;
            return (order.wells || []).some((w) => w.id === wellId);
        }) || null
    );
}

window.getOrdersForOffer = getOrdersForOffer;
window.getOrderedWellIds = getOrderedWellIds;
window.isWellOrdered = isWellOrdered;
window.getOfferOrderProgress = getOfferOrderProgress;
window.getOrderForWellId = getOrderForWellId;

/**
 * Zamraża ceny (cennik) wszystkich pozycji w studniach, przechwytując
 * aktualną cenę z cennika do pól frozenPrice/frozenPriceBase/frozenName.
 * Przejściom przypisuje także koszt wiercenia.
 */
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

/**
 * Porównuje bieżący stan studni z zapisanym snapshotem zamówienia.
 * Zwraca obiekt { indexWell: { type, fields, priceDiff } }.
 */
function getOrderChanges(order) {
    if (!order || !order.originalSnapshot) return {};
    const changes = {};

    const originalSnapshotData = order.originalSnapshot;
    const originalWells = Array.isArray(originalSnapshotData)
        ? originalSnapshotData
        : originalSnapshotData.wells || [];
    const originalDiscounts = !Array.isArray(originalSnapshotData)
        ? originalSnapshotData.wellDiscounts || null
        : null;

    const orig = structuredClone(originalWells);
    if (typeof migrateWellData === 'function') migrateWellData(orig);
    const curr = order.wells;

    const savedDiscounts =
        typeof wellDiscounts !== 'undefined' ? structuredClone(wellDiscounts) : null;
    if (originalDiscounts && typeof wellDiscounts !== 'undefined') {
        window.wellDiscounts = originalDiscounts;
    }
    freezeWellPrices(orig);
    if (savedDiscounts && typeof wellDiscounts !== 'undefined') {
        window.wellDiscounts = savedDiscounts;
    }

    const savedPreviewMode = window.isPreviewMode;
    window.isPreviewMode = true;

    const maxLen = Math.max(orig.length, curr.length);
    for (let i = 0; i < maxLen; i++) {
        if (i >= orig.length) {
            changes[i] = { type: 'added' };
            continue;
        }
        if (i >= curr.length) {
            changes[i] = { type: 'removed', name: orig[i].name };
            continue;
        }

        const origStats = calcWellStats(orig[i]);
        const currStats = calcWellStats(curr[i]);

        if (Math.abs(currStats.price - origStats.price) > 0.01) {
            changes[i] = {
                type: 'modified',
                fields: ['price'],
                priceDiff: currStats.price - origStats.price
            };
        }
    }

    const origTransportKm = originalSnapshotData.transportKm;
    const origTransportRate = originalSnapshotData.transportRate;
    const origTransportMode = originalSnapshotData.transportMode;
    const transportChanged =
        (origTransportKm != null || origTransportRate != null) &&
        (Math.abs((order.transportKm || 0) - (origTransportKm || 0)) > 0.01 ||
            Math.abs((order.transportRate || 0) - (origTransportRate || 0)) > 0.01 ||
            (order.transportMode || 'full') !== (origTransportMode || 'full'));
    if (transportChanged) {
        for (let i = 0; i < curr.length; i++) {
            if (!changes[i] || changes[i].type !== 'added') {
                if (changes[i] && changes[i].type === 'modified') {
                    changes[i].fields.push('transport');
                } else {
                    changes[i] = { type: 'modified', fields: ['transport'], priceDiff: 0 };
                }
            }
        }
    }

    window.isPreviewMode = savedPreviewMode;

    return changes;
}

window.freezeWellPrices = freezeWellPrices;
window.getOrderChanges = getOrderChanges;
