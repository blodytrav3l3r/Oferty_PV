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

/* ===== P1 HIGH: ZAPIS POJEDYNCZEGO ZAMÓWIENIA =====
 * Payload skaluje się z edytowanym zamówieniem, nie z historią N zamówień.
 * Concurrency: klient wysyła baseUpdatedAt (wersja wczytana przed edycją);
 * serwer odpowiada 409 + kopia serwerowa przy rozjeździe (optimistic locking).
 */

/**
 * @param {Object} order
 * @returns {string|null} updatedAt bazowy (wersja wczytana przed edycją)
 */
function getOrderBaseUpdatedAt(order) {
    if (!order) return null;
    return order._baseUpdatedAt || order.updatedAt || null;
}

function markOrderSaved(order, updatedAt) {
    if (!order) return;
    if (updatedAt) order.updatedAt = updatedAt;
    order._baseUpdatedAt = order.updatedAt || null;
}

/**
 * Konflikt 409: podmień lokalną kopię na serwerową, toast, false (nie zapisano).
 * @param {Object} order
 * @param {Object} serverBody odpowiedź serwera z serverOrder
 * @returns {boolean} zawsze false
 */
async function handleOrderConflict(order, serverBody) {
    try {
        const serverOrder = serverBody && serverBody.serverOrder;
        if (serverOrder && serverOrder.id) {
            if (typeof ordersStudnie !== 'undefined' && Array.isArray(ordersStudnie)) {
                const idx = ordersStudnie.findIndex((o) => o && o.id === serverOrder.id);
                if (idx >= 0) ordersStudnie[idx] = { ...ordersStudnie[idx], ...serverOrder };
                else ordersStudnie.push(serverOrder);
            }
            if (
                typeof orderEditMode !== 'undefined' &&
                orderEditMode &&
                orderEditMode.orderId === serverOrder.id
            ) {
                orderEditMode.order = { ...orderEditMode.order, ...serverOrder };
            }
            if (order) {
                for (const k of Object.keys(serverOrder)) {
                    if (k !== '_baseUpdatedAt') order[k] = serverOrder[k];
                }
                markOrderSaved(order, serverOrder.updatedAt);
            }
        }
    } catch (_e) {
        // konflikt obsłużony mimo błędu scalania
    }
    if (typeof showToast === 'function') {
        showToast(
            'Zamówienie zmieniono w międzyczasie — wczytano aktualną wersję. Sprawdź i zapisz ponownie.',
            'warning'
        );
    }
    return false;
}

/**
 * Mierzy payload pojedynczego zamówienia (telemetry P0.2, throttled warn).
 * @param {string} body
 * @param {Object} order
 */
function measureSingleOrderPayload(body, order) {
    try {
        if (typeof Blob === 'undefined') return;
        const payloadBytes = new Blob([body]).size;
        const wellsCount = order && Array.isArray(order.wells) ? order.wells.length : 0;
        let snapshotBytes = 0;
        try {
            snapshotBytes = new Blob([JSON.stringify(order.originalSnapshot || null)]).size;
        } catch (_e) {
            // ignoruj pojedynczy błąd pomiaru
        }
        window._lastOrderPayloadStats = {
            ordersCount: 1,
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
                ordersCount: 1,
                wellsCount,
                snapshotMb: (snapshotBytes / 1024 / 1024).toFixed(2)
            });
        }
    } catch (_e) {
        // pomiar nigdy nie blokuje zapisu
    }
}

/**
 * Create/single-upsert przez istniejący batch-PUT z 1-elementową tablicą.
 * @param {Object} order
 * @returns {Promise<boolean>} true = zapisano
 */
async function putSingleOrderStudnie(order) {
    try {
        if (typeof ensureElemIds === 'function' && order && Array.isArray(order.wells)) {
            order.wells.forEach((w) => {
                if (w && Array.isArray(w.config)) ensureElemIds(w.config);
            });
        }
        const body = JSON.stringify({ data: [order], baseUpdatedAt: getOrderBaseUpdatedAt(order) });
        measureSingleOrderPayload(body, order);
        const res = await fetch('/api/orders-studnie', {
            method: 'PUT',
            headers: authHeaders(),
            body
        });
        if (res.status === 409) {
            return handleOrderConflict(order, await res.json().catch(() => ({})));
        }
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        markOrderSaved(order, order.updatedAt);
        return true;
    } catch (err) {
        logger.error('orderManager', 'Błąd zapisu zamówienia studni:', err);
        showToast('Błąd zapisu zamówienia', 'error');
        return false;
    }
}

/**
 * Update przez PATCH /:id (merge po stronie serwera) + baseUpdatedAt.
 * @param {Object} order
 * @param {Object} fields pola do scalenia (bez id/type/userId)
 * @returns {Promise<boolean>} true = zapisano
 */
async function patchSingleOrderStudnie(order, fields) {
    try {
        if (!order || !order.id) throw new Error('Brak ID zamówienia');
        const body = JSON.stringify({ ...fields, baseUpdatedAt: getOrderBaseUpdatedAt(order) });
        measureSingleOrderPayload(body, order);
        const res = await fetch(`/api/orders-studnie/${order.id}`, {
            method: 'PATCH',
            headers: authHeaders(),
            body
        });
        if (res.status === 409) {
            return handleOrderConflict(order, await res.json().catch(() => ({})));
        }
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        markOrderSaved(order, order.updatedAt);
        return true;
    } catch (err) {
        logger.error('orderManager', 'Błąd zapisu zamówienia studni:', err);
        showToast('Błąd zapisu zamówienia', 'error');
        return false;
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
        const disc = wellDiscounts[discountKey] || {};

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
            let hostType = null;
            const isInsitu = p.name && p.name.toUpperCase().includes('INSITU');

            if (configMap.length > 0) {
                const rzDna = parseFloat(well.rzednaDna) || 0;
                let pel = parseFloat(item.rzednaWlaczenia);
                if (isNaN(pel)) pel = rzDna;
                const mmFromBottom = (pel - rzDna) * 1000;

                if (typeof findAssignedElement === 'function') {
                    const assigned = findAssignedElement(mmFromBottom, configMap);
                    if (assigned && assigned.entry) hostType = assigned.entry.componentType;
                    if (
                        !isInsitu &&
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
            const mult =
                typeof getTransitionHostPct === 'function'
                    ? 1 - getTransitionHostPct(well, disc, hostType) / 100
                    : 1 - getWellNadbudowaPct(well, disc) / 100;
            item.frozenPrice = bP * mult;
            item.frozenPriceBase = bP;
            item.frozenName = p.name || p.category;
            item.frozenTransitionPrice = transPriceBase * mult;
            item.frozenDrillingPrice = drillingBasePrice * mult;
            item.frozenDrillingName = drillProdName;
            item.frozenDrillingDn = drillProdDn;
        });

        freezeWellPreco(well, preserveExisting);
    });
}

/**
 * Mrozi katalogową sumę PRECO studni (Faza 2, #4). Spike: PRECO to jedyny
 * składnik calcWellStats czytany z live cennika (precoPricing) — reszta jest
 * mrożona (frozenPrice*) albo polami studni. Rabat preco zostaje live
 * (celowa edycja rabatu to realna zmiana). Warunek identyczny z konsumpcją
 * w calcWellStats — brak mrożenia tam, gdzie cena go nie używa.
 */
function freezeWellPreco(well, preserveExisting = false) {
    if (!well) return;
    if (preserveExisting && well.frozenPrecoSuma != null) return;
    if (well.kineta !== 'preco' && well.kineta !== 'precotop') {
        delete well.frozenPrecoSuma;
        return;
    }
    if (typeof calcPrecoPricing !== 'function') return;
    try {
        const preco = calcPrecoPricing(well);
        well.frozenPrecoSuma = preco && !preco.error ? preco.suma || 0 : 0;
    } catch (_e) {
        // pasywnie — brak mrożenia zamiast wywalenia zapisu
    }
}

/**
 * Jedyny dozwolony default trybu transportu (Faza 0, #1).
 * Snapshot, order i odczyt w enterOrderEditMode MUSZĄ używać tej funkcji —
 * rozjazd defaultów ('full' vs 'fractional') flagował kiedyś wszystkie studnie.
 */
const DEFAULT_TRANSPORT_MODE = 'fractional';
function normalizeTransportMode(mode) {
    return mode === 'full' || mode === 'fractional' ? mode : DEFAULT_TRANSPORT_MODE;
}

/**
 * Cena porównywalna studni — JEDYNA definicja ceny do detekcji zmian (Faza 1, #7).
 * Kontekst frozen (isPreviewMode=true), BEZ transportu. Używają jej badge
 * (getOrderChanges) i tabela (kolumna Różnica) — ta sama liczba w obu miejscach.
 */
const roundToGroszShared = (v) => Math.round((Number(v) || 0) * 100) / 100;
function calcComparableWellPrice(well) {
    const saved = window.isPreviewMode;
    window.isPreviewMode = true;
    try {
        return roundToGroszShared(calcWellStats(well).price);
    } finally {
        window.isPreviewMode = saved;
    }
}

/**
 * Parowanie oryginał↔bieżące po ID (Faza 1, #3). ID = tożsamość, kolejność
 * nie jest zmianą. Fallback pozycyjny TYLKO dla studni bez ID (legacy).
 * @returns {Array<{origIdx: number|null, currIdx: number|null}>}
 */
function matchWellPairs(origArr, currArr) {
    const orig = origArr || [];
    const curr = currArr || [];
    const pairs = [];
    const usedOrig = new Set();
    const wellIdOf = (w) => (w && w.id != null && String(w.id) !== '' ? String(w.id) : null);
    const byId = new Map();
    orig.forEach((w, idx) => {
        const id = wellIdOf(w);
        if (id === null) return;
        if (!byId.has(id)) byId.set(id, []);
        byId.get(id).push(idx);
    });
    const pendingCurr = [];
    curr.forEach((w, idx) => {
        const id = wellIdOf(w);
        if (id !== null && byId.has(id) && byId.get(id).length > 0) {
            const origIdx = byId.get(id).shift();
            usedOrig.add(origIdx);
            pairs.push({ origIdx, currIdx: idx });
        } else {
            pendingCurr.push(idx);
        }
    });
    const freeOrigNoId = [];
    orig.forEach((w, idx) => {
        if (usedOrig.has(idx)) return;
        if (wellIdOf(w) === null) freeOrigNoId.push(idx);
        else pairs.push({ origIdx: idx, currIdx: null });
    });
    pendingCurr.forEach((currIdx) => {
        if (wellIdOf(curr[currIdx]) === null && freeOrigNoId.length > 0) {
            pairs.push({ origIdx: freeOrigNoId.shift(), currIdx });
        } else {
            pairs.push({ origIdx: null, currIdx });
        }
    });
    freeOrigNoId.forEach((origIdx) => pairs.push({ origIdx, currIdx: null }));
    return pairs;
}

/**
 * Porównuje bieżący stan studni z zapisanym snapshotem zamówienia.
 * Zwraca { wells: { indexWell: { type, fields, priceDiff } }, transportChanged: bool }.
 * Zmiana transportu NIGDY nie flaguje studni — to osobny wymiar (Faza 0, #2).
 */
function getOrderChanges(order) {
    if (!order || !order.originalSnapshot) return { wells: {}, transportChanged: false };
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
        for (const { origIdx, currIdx } of matchWellPairs(slimWells, curr)) {
            if (origIdx === null) {
                changes[currIdx] = { type: 'added' };
                continue;
            }
            if (currIdx === null) {
                const origWell = slimWells[origIdx];
                changes['removed:' + (origWell.id ?? 'idx' + origIdx)] = {
                    type: 'removed',
                    name: origWell.name
                };
                continue;
            }
            const currPrice = calcComparableWellPrice(curr[currIdx]);
            const origPrice = roundToGrosz(slimWells[origIdx].price);
            if (Math.abs(currPrice - origPrice) > 0.01) {
                changes[currIdx] = {
                    type: 'modified',
                    fields: ['price'],
                    priceDiff: currPrice - origPrice
                };
            }
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
            for (const { origIdx, currIdx } of matchWellPairs(orig, curr)) {
                if (origIdx === null) {
                    changes[currIdx] = { type: 'added' };
                    continue;
                }
                if (currIdx === null) {
                    changes['removed:' + (orig[origIdx].id ?? 'idx' + origIdx)] = {
                        type: 'removed',
                        name: orig[origIdx].name
                    };
                    continue;
                }

                const origPrice = calcComparableWellPrice(orig[origIdx]);
                const currPrice = calcComparableWellPrice(curr[currIdx]);

                if (Math.abs(currPrice - origPrice) > 0.01) {
                    changes[currIdx] = {
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

    let transportChanged = false;
    try {
        const origTransportKm = originalSnapshotData.transportKm;
        const origTransportRate = originalSnapshotData.transportRate;
        const origTransportMode = originalSnapshotData.transportMode;
        // Tryb bez skonfigurowanego transportu (km/stawka 0) nie zmienia ceny —
        // różnica defaultów w legacy snapshotach ('full' vs 'fractional') to szum.
        const transportConfigured =
            (order.transportKm || 0) > 0 ||
            (origTransportKm || 0) > 0 ||
            (order.transportRate || 0) > 0 ||
            (origTransportRate || 0) > 0;
        transportChanged =
            transportConfigured &&
            (origTransportKm != null || origTransportRate != null) &&
            (Math.abs((order.transportKm || 0) - (origTransportKm || 0)) > 0.01 ||
                Math.abs((order.transportRate || 0) - (origTransportRate || 0)) > 0.01 ||
                normalizeTransportMode(order.transportMode) !==
                    normalizeTransportMode(origTransportMode));
    } finally {
        window.isPreviewMode = savedTransportPreviewMode;
    }

    return { wells: changes, transportChanged };
}

window.freezeWellPrices = freezeWellPrices;
window.getOrderChanges = getOrderChanges;
window.normalizeTransportMode = normalizeTransportMode;
window.DEFAULT_TRANSPORT_MODE = DEFAULT_TRANSPORT_MODE;
window.calcComparableWellPrice = calcComparableWellPrice;
window.matchWellPairs = matchWellPairs;
window.freezeWellPreco = freezeWellPreco;

/* ===== Rejestracja globali ===== */
window.loadOrdersStudnie = loadOrdersStudnie;
window.saveOrdersDataStudnie = saveOrdersDataStudnie;
window.putSingleOrderStudnie = putSingleOrderStudnie;
window.patchSingleOrderStudnie = patchSingleOrderStudnie;
window.handleOrderConflict = handleOrderConflict;
window.markOrderSaved = markOrderSaved;
window.getOrderBaseUpdatedAt = getOrderBaseUpdatedAt;
