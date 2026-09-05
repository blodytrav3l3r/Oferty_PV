/* ===== ZAMÓWIENIA STUDNI ===== */

/* P0.2: throttle ostrzeżeń o dużym payloadzie — max 1 na 5 minut na sesję. */
let _lastPayloadWarnAt = 0;
const PAYLOAD_WARN_THRESHOLD_BYTES = 10 * 1024 * 1024;
const PAYLOAD_WARN_COOLDOWN_MS = 5 * 60 * 1000;
async function loadOrdersStudnie() {
    try {
        const res = await fetchWithTimeout('/api/orders-studnie', { headers: authHeaders() });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const json = await res.json();
        const orders = json.data || [];
        if (typeof ensureElemIds === 'function') {
            orders.forEach((order) => {
                (order.wells || []).forEach((w) => {
                    if (w && Array.isArray(w.config)) ensureElemIds(w.config);
                });
            });
        }
        return orders;
    } catch (err) {
        logger.error('orderManager', 'Błąd ładowania zamówień studni:', err);
        return [];
    }
}

async function saveOrdersDataStudnie(data) {
    try {
        if (typeof ensureElemIds === 'function' && Array.isArray(data)) {
            data.forEach((order) => {
                (order.wells || []).forEach((w) => {
                    if (w && Array.isArray(w.config)) ensureElemIds(w.config);
                });
            });
        }
        const body = JSON.stringify({ data });
        // P0.2: pasywny pomiar rozmiaru payloadu (telemetry, throttled warn).
        try {
            if (typeof Blob !== 'undefined' && Array.isArray(data)) {
                const payloadBytes = new Blob([body]).size;
                let wellsCount = 0;
                let snapshotBytes = 0;
                data.forEach((o) => {
                    wellsCount += Array.isArray(o.wells) ? o.wells.length : 0;
                    try {
                        snapshotBytes += new Blob([JSON.stringify(o.originalSnapshot || null)])
                            .size;
                    } catch (_e) {
                        // ignoruj pojedynczy błąd pomiaru
                    }
                });
                window._lastOrderPayloadStats = {
                    ordersCount: data.length,
                    wellsCount,
                    payloadBytes,
                    snapshotBytes
                };
                const now = typeof Date !== 'undefined' ? Date.now() : 0;
                if (
                    payloadBytes > PAYLOAD_WARN_THRESHOLD_BYTES &&
                    now - _lastPayloadWarnAt > PAYLOAD_WARN_COOLDOWN_MS
                ) {
                    _lastPayloadWarnAt = now;
                    logger.warn('orderManager', '[ORDER] Large payload:', {
                        mb: (payloadBytes / 1024 / 1024).toFixed(2),
                        ordersCount: data.length,
                        wellsCount,
                        snapshotMb: (snapshotBytes / 1024 / 1024).toFixed(2)
                    });
                }
            }
        } catch (_e) {
            // pomiar nigdy nie blokuje zapisu
        }
        const res = await fetch('/api/orders-studnie', {
            method: 'PUT',
            headers: authHeaders(),
            body
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
    } catch (err) {
        logger.error('orderManager', 'Błąd zapisu zamówień studni:', err);
        showToast('Błąd zapisu zamówień', 'error');
    }
}

/* ===== POMOCNIKI ZAMÓWIEŃ CZĘŚCIOWYCH ===== */

/* Cache dla szybkiego wyszukiwania zamówień O(1) przy dużej liczbie studni i zamówień */
let _ordersCacheKey = null;
const _orderedWellIdsCacheMap = new Map(); // Map<offerIdKey, Set<wellId>>
const _wellToOrderCacheMap = new Map(); // Map<offerIdKey_wellId, Order>

function _invalidateOrdersLookupCache() {
    _ordersCacheKey = null;
    _orderedWellIdsCacheMap.clear();
    _wellToOrderCacheMap.clear();
}
window._invalidateOrdersLookupCache = _invalidateOrdersLookupCache;

function _ensureOrdersLookupCache() {
    if (typeof ordersStudnie === 'undefined' || !Array.isArray(ordersStudnie)) {
        _invalidateOrdersLookupCache();
        return;
    }
    // Prosta weryfikacja tożsamości tablicy i liczby elementów
    const key = ordersStudnie;
    if (_ordersCacheKey === key) return;

    _invalidateOrdersLookupCache();
    _ordersCacheKey = key;

    for (let i = 0; i < ordersStudnie.length; i++) {
        const order = ordersStudnie[i];
        if (!order) continue;
        const offerId = order.offerId || order.offerStudnieId || '';
        const nId = typeof normalizeId === 'function' ? normalizeId(offerId) : String(offerId);

        let set = _orderedWellIdsCacheMap.get(nId);
        if (!set) {
            set = new Set();
            _orderedWellIdsCacheMap.set(nId, set);
        }

        const wellsList = order.wells || [];
        for (let wIdx = 0; wIdx < wellsList.length; wIdx++) {
            const w = wellsList[wIdx];
            if (w && w.id) {
                set.add(w.id);
                _wellToOrderCacheMap.set(nId + '_' + w.id, order);
                _wellToOrderCacheMap.set('ANY_' + w.id, order);
            }
        }
    }
}

/** Zwraca wszystkie zamówienia powiązane z daną ofertą */
function getOrdersForOffer(offerId) {
    if (!ordersStudnie || !offerId) return [];
    const nId = normalizeId(offerId);
    return ordersStudnie.filter((o) => normalizeId(o.offerId || o.offerStudnieId) === nId);
}

/** Zwraca Set<string> z ID studni, które są już zamówione dla danej oferty */
function getOrderedWellIds(offerId) {
    if (!ordersStudnie || !offerId) return new Set();
    _ensureOrdersLookupCache();
    const nId = normalizeId(offerId);
    return _orderedWellIdsCacheMap.get(nId) || new Set();
}

/** Sprawdza, czy dana studnia jest zamówiona w ramach bieżącej oferty */
function isWellOrdered(well) {
    if (!well || !well.id || !editingOfferIdStudnie) return false;
    return getOrderedWellIds(editingOfferIdStudnie).has(well.id);
}

/* ===== FULL-LOCK: studnia na zamówieniu — wszystko zablokowane ===== */
const ORDERED_WELL_WHITELIST = new Set();

function isOrderedWellSoftLocked(well) {
    const w = well || (typeof getCurrentWell === 'function' ? getCurrentWell() : null);
    if (!w) return false;
    if (typeof orderEditMode !== 'undefined' && orderEditMode) return false;
    const hasAcceptedPO =
        typeof productionOrders !== 'undefined' &&
        Array.isArray(productionOrders) &&
        productionOrders.some((po) => po.wellId === w.id && po.status === 'accepted');
    if (hasAcceptedPO) return false;
    return isWellOrdered(w);
}

function isOrderedWellFieldAllowed(field) {
    return ORDERED_WELL_WHITELIST.has(field);
}

function canEditOrderedWellField(well, field) {
    if (!isOrderedWellSoftLocked(well)) return true;
    return isOrderedWellFieldAllowed(field);
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
    _ensureOrdersLookupCache();
    const nId = offerId ? normalizeId(offerId) : 'ANY';
    return _wellToOrderCacheMap.get(nId + '_' + wellId) || null;
}

window.getOrdersForOffer = getOrdersForOffer;
window.getOrderedWellIds = getOrderedWellIds;
window.isWellOrdered = isWellOrdered;
window.isOrderedWellSoftLocked = isOrderedWellSoftLocked;
window.isOrderedWellFieldAllowed = isOrderedWellFieldAllowed;
window.canEditOrderedWellField = canEditOrderedWellField;
window.ORDERED_WELL_WHITELIST = ORDERED_WELL_WHITELIST;
window.getOfferOrderProgress = getOfferOrderProgress;
window.getOrderForWellId = getOrderForWellId;

/**
 * Zamraża ceny (cennik) wszystkich pozycji w studniach, przechwytując
 * aktualną cenę z cennika do pól frozenPrice/frozenPriceBase/frozenName.
 * Przejściom przypisuje także koszt wiercenia.
 */
function freezeWellPrices(wellsArr, preserveExisting = false) {
    (wellsArr || []).forEach((well) => {
        (well.config || []).forEach((item) => {
            if (preserveExisting && item.frozenPrice != null) return;
            const p =
                typeof getStudnieProductById === 'function'
                    ? getStudnieProductById(item.productId)
                    : studnieProducts.find((pr) => pr.id === item.productId);
            if (!p) return;
            item.frozenPrice = getItemAssessedPrice(well, p, true, item);
            item.frozenPriceBase = getItemAssessedPrice(well, p, false, item);
            item.frozenName = p.name;
        });

        const discountKey = well.dn === 'styczna' ? 'styczne' : well.dn;
        const discNadbudowa = getWellNadbudowaPct(well, wellDiscounts[discountKey] || {});
        const mult = 1 - discNadbudowa / 100;

        const configMap =
            typeof buildConfigMap !== 'undefined'
                ? buildConfigMap(
                      well,
                      (id) =>
                          typeof getStudnieProductById === 'function'
                              ? getStudnieProductById(id)
                              : studnieProducts.find((pr) => pr.id === id),
                      true
                  )
                : [];

        (well.przejscia || []).forEach((item) => {
            if (preserveExisting && item.frozenPrice != null) return;
            const p =
                typeof getStudnieProductById === 'function'
                    ? getStudnieProductById(item.productId)
                    : studnieProducts.find((pr) => pr.id === item.productId);
            if (!p) return;

            let drillingBasePrice = 0;
            let drillProdName = '';
            let drillProdDn = '';
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
    // P1: slim snapshot [{id,name,price,weight,configHash}] — gotowe ceny,
    // bez calcWellStats na kopii. Legacy (Array | {wells}) nadal wspierane.
    const slimWells =
        !Array.isArray(originalSnapshotData) && Array.isArray(originalSnapshotData.slimWells)
            ? originalSnapshotData.slimWells
            : null;
    const originalWells = slimWells
        ? []
        : Array.isArray(originalSnapshotData)
          ? originalSnapshotData
          : originalSnapshotData.wells || [];
    const originalDiscounts = !Array.isArray(originalSnapshotData)
        ? originalSnapshotData.wellDiscounts || null
        : null;

    const roundToGrosz = (v) => Math.round(v * 100) / 100;
    const curr = order.wells;

    if (slimWells) {
        const savedPreviewMode = window.isPreviewMode;
        window.isPreviewMode = true;
        try {
            const maxLen = Math.max(slimWells.length, curr.length);
            for (let i = 0; i < maxLen; i++) {
                if (i >= slimWells.length) {
                    changes[i] = { type: 'added' };
                    continue;
                }
                if (i >= curr.length) {
                    changes[i] = { type: 'removed', name: slimWells[i].name };
                    continue;
                }
                const currStats = calcWellStats(curr[i]);
                const origPrice = roundToGrosz(slimWells[i].price);
                const currPrice = roundToGrosz(currStats.price);
                if (Math.abs(currPrice - origPrice) > 0.01) {
                    changes[i] = {
                        type: 'modified',
                        fields: ['price'],
                        priceDiff: currPrice - origPrice
                    };
                }
            }
        } finally {
            window.isPreviewMode = savedPreviewMode;
        }
    } else {
        const orig = structuredClone(originalWells);
        if (typeof migrateWellData === 'function') migrateWellData(orig);

        const savedDiscounts =
            typeof wellDiscounts !== 'undefined' ? structuredClone(wellDiscounts) : null;
        try {
            if (originalDiscounts && typeof wellDiscounts !== 'undefined') {
                window.wellDiscounts = originalDiscounts;
            }
            freezeWellPrices(orig, true);
        } finally {
            if (savedDiscounts && typeof wellDiscounts !== 'undefined') {
                window.wellDiscounts = savedDiscounts;
            }
        }

        const savedPreviewMode = window.isPreviewMode;
        window.isPreviewMode = true;

        try {
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

                const origPrice = roundToGrosz(origStats.price);
                const currPrice = roundToGrosz(currStats.price);

                if (Math.abs(currPrice - origPrice) > 0.01) {
                    changes[i] = {
                        type: 'modified',
                        fields: ['price'],
                        priceDiff: currPrice - origPrice
                    };
                }
            }
        } finally {
            window.isPreviewMode = savedPreviewMode;
        }
    }

    const savedTransportPreviewMode = window.isPreviewMode;
    window.isPreviewMode = true;

    try {
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
    } finally {
        window.isPreviewMode = savedTransportPreviewMode;
    }

    return changes;
}

window.freezeWellPrices = freezeWellPrices;
window.getOrderChanges = getOrderChanges;

/* ===== Rejestracja globali ===== */
window.loadOrdersStudnie = loadOrdersStudnie;
window.saveOrdersDataStudnie = saveOrdersDataStudnie;
