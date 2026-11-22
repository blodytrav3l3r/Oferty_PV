/* ===== ZAMÓWIENIA STUDNI ===== */

/* P0.2: throttle ostrzeżeń o dużym payloadzie — max 1 na 5 minut na sesję. */
let _lastPayloadWarnAt = 0;
const PAYLOAD_WARN_THRESHOLD_BYTES = 10 * 1024 * 1024;
const PAYLOAD_WARN_COOLDOWN_MS = 5 * 60 * 1000;

/**
 * Czeka na gotowość klienckiego cennika studni (deterministyczne wejście).
 * VPT/notatki/uszczelki liczone są z katalogu — wejście przed cennikiem daje
 * niekompletny live (draft/SAVED rozjazd + gubienie VPT przy zapisie).
 * Best-effort: po timeout flaga settled albo brak cennika → false, caller idzie dalej.
 * @param {number} [timeoutMs]
 * @returns {Promise<boolean>} true = cennik gotowy
 */
async function ensureStudnieCatalogReady(timeoutMs) {
    var budget = typeof timeoutMs === 'number' ? timeoutMs : 15000;
    var start = Date.now();
    for (;;) {
        try {
            var prods = undefined;
            try {
                prods = typeof studnieProducts !== 'undefined' ? studnieProducts : undefined;
            } catch (_tdz) {}
            if (prods === undefined) prods = window.studnieProducts;
            if (Array.isArray(prods) && prods.length > 0) return true;
            if (window.__studnieProductsSettled) return false;
        } catch (_e) {}
        if (Date.now() - start >= budget) break;
        await new Promise(function (r) {
            setTimeout(r, 200);
        });
    }
    try {
        if (window.logger && typeof window.logger.warn === 'function')
            window.logger.warn(
                'orderManager',
                'Wejście bez cennika (timeout) — live może być niekompletny.'
            );
    } catch (_e2) {}
    return false;
}
window.ensureStudnieCatalogReady = ensureStudnieCatalogReady;
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

function markOrderSaved(order, updatedAt, version) {
    if (!order) return;
    if (updatedAt) order.updatedAt = updatedAt;
    // P3: version wyłącznie z serwera (SSoT) — nigdy optymistyczne +1.
    // Brak version w odpowiedzi (stary kontrakt) = zostaw dotychczasową.
    if (typeof version === 'number') order.version = version;
    order._baseUpdatedAt = order.updatedAt || null;
}

/**
 * P3: kanoniczna synchronizacja wpisu listy po zapisie/sukcesie.
 * Serwer → order (markOrderSaved) → ordersStudnie[idx] (tylko pola
 * blokady: version/updatedAt/_baseUpdatedAt; wells synchronizuje caller
 * przed PATCH z globalnych wells, lista odświeżana jest przez kartotekę).
 * @param {Object} order
 */
function syncOrdersStudnieEntry(order) {
    try {
        if (!order || !order.id) return;
        if (typeof ordersStudnie === 'undefined' || !Array.isArray(ordersStudnie)) return;
        const idx = ordersStudnie.findIndex((o) => o && o.id === order.id);
        if (idx < 0) return;
        const entry = ordersStudnie[idx];
        if (!entry || typeof entry !== 'object') return;
        if (order.updatedAt) entry.updatedAt = order.updatedAt;
        if (typeof order.version === 'number') entry.version = order.version;
        entry._baseUpdatedAt = order._baseUpdatedAt || order.updatedAt || null;
    } catch (_e) {
        // synchronizacja listy nigdy nie blokuje zapisu
    }
}

/**
 * Konflikt 409/423: podmień lokalną kopię na serwerową, toast, false (nie zapisano).
 * Przy 423 (twarda blokada) formularz zostaje — toast mowi o blokadzie.
 * @param {Object} order
 * @param {Object} serverBody odpowiedź serwera z serverOrder
 * @param {Object} [extra] opcjonalnie { lockHolder }
 * @returns {boolean} zawsze false
 */
async function handleOrderConflict(order, serverBody, extra) {
    try {
        const serverOrder = serverBody && serverBody.serverOrder;
        if (serverOrder && serverOrder.id) {
            if (typeof ordersStudnie !== 'undefined' && Array.isArray(ordersStudnie)) {
                const idx = ordersStudnie.findIndex((o) => o && o.id === serverOrder.id);
                if (idx >= 0) {
                    ordersStudnie[idx] = { ...ordersStudnie[idx], ...serverOrder };
                    // Spread nie niesie _baseUpdatedAt — baza konfliktu to updatedAt serwera.
                    ordersStudnie[idx]._baseUpdatedAt = serverOrder.updatedAt || null;
                } else {
                    const pushed = { ...serverOrder };
                    pushed._baseUpdatedAt = serverOrder.updatedAt || null;
                    ordersStudnie.push(pushed);
                }
            }
            if (
                typeof orderEditMode !== 'undefined' &&
                orderEditMode &&
                orderEditMode.orderId === serverOrder.id
            ) {
                orderEditMode.order = { ...orderEditMode.order, ...serverOrder };
                if (orderEditMode.order && serverOrder.updatedAt) {
                    orderEditMode.order._baseUpdatedAt = serverOrder.updatedAt;
                }
            }
            if (order) {
                for (const k of Object.keys(serverOrder)) {
                    if (k !== '_baseUpdatedAt') order[k] = serverOrder[k];
                }
                markOrderSaved(order, serverOrder.updatedAt, serverOrder.version);
            }
        }
    } catch (_e) {
        // konflikt obsłużony mimo błędu scalania
    }
    if (typeof showToast === 'function') {
        if (extra && extra.lockHolder && window.lockService) {
            const info = window.lockService.describeHolder(extra.lockHolder);
            showToast(
                'Zapis odrzucony — dokument edytuje ' +
                    info.name +
                    '. Skopiuj swoje zmiany. Niezapisane zmiany zachowane w drafcie.',
                'warning'
            );
        } else {
            showToast(
                'Zamówienie zmieniono w międzyczasie — wczytano aktualną wersję. Sprawdź i zapisz ponownie. Niezapisane zmiany zachowane w drafcie.',
                'warning'
            );
        }
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
        if (res.status === 409 || res.status === 423) {
            const conflictBody = await res.json().catch(() => ({}));
            const extra =
                res.status === 423 && conflictBody.holder
                    ? { lockHolder: conflictBody.holder }
                    : undefined;
            return handleOrderConflict(order, conflictBody, extra);
        }
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        // P2/P3: version/updatedAt z odpowiedzi serwera (SSoT); brak pól = legacy.
        const okPutBody = await res.json().catch(() => ({}));
        markOrderSaved(
            order,
            (okPutBody && okPutBody.updatedAt) || order.updatedAt,
            okPutBody && typeof okPutBody.version === 'number' ? okPutBody.version : undefined
        );
        syncOrdersStudnieEntry(order);
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
        // P1 PATCH: dopnij version TYLKO gdy number — serwerowy predykat
        // optimistic lock; brak version = stare zachowanie (kompatybilność).
        // Nigdy nie wysyłaj version: undefined (nie zmieniaj payloadu starych danych).
        const patchBody = { ...fields, baseUpdatedAt: getOrderBaseUpdatedAt(order) };
        if (typeof order.version === 'number') patchBody.version = order.version;
        const body = JSON.stringify(patchBody);
        measureSingleOrderPayload(body, order);
        const res = await fetch(`/api/orders-studnie/${order.id}`, {
            method: 'PATCH',
            headers: authHeaders(),
            body
        });
        if (res.status === 409 || res.status === 423) {
            const conflictBody = await res.json().catch(() => ({}));
            const extra =
                res.status === 423 && conflictBody.holder
                    ? { lockHolder: conflictBody.holder }
                    : undefined;
            return handleOrderConflict(order, conflictBody, extra);
        }
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        // P2/P3: version/updatedAt z odpowiedzi serwera (SSoT); brak pól = legacy.
        const okPatchBody = await res.json().catch(() => ({}));
        markOrderSaved(
            order,
            (okPatchBody && okPatchBody.updatedAt) || order.updatedAt,
            okPatchBody && typeof okPatchBody.version === 'number' ? okPatchBody.version : undefined
        );
        syncOrdersStudnieEntry(order);
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
 * aktualną cenę z cennika do pól frozenPrice/frozenPriceBase/frozenStandalonePrice/frozenName.
 * Przejściom przypisuje także koszt wiercenia.
 */
function freezeWellPrices(wellsArr, preserveExisting = false) {
    (wellsArr || []).forEach((well) => {
        (well.config || []).forEach((item) => {
            const p =
                typeof getStudnieProductById === 'function'
                    ? getStudnieProductById(item.productId)
                    : studnieProducts.find((pr) => pr.id === item.productId);
            if (!p) return;
            const priceBreakdown =
                typeof getItemPriceBreakdown === 'function'
                    ? getItemPriceBreakdown(well, p, true, item)
                    : null;
            if (preserveExisting && item.frozenPrice != null) {
                if (item.frozenStandalonePrice == null) {
                    item.frozenStandalonePrice = priceBreakdown?.base ?? item.frozenPrice;
                }
                return;
            }
            item.frozenPrice = getItemAssessedPrice(well, p, true, item);
            item.frozenPriceBase = getItemAssessedPrice(well, p, false, item);
            item.frozenStandalonePrice = priceBreakdown?.base ?? item.frozenPrice;
            item.frozenName = p.name;
        });

        const discountKey = well.dn === 'styczna' ? 'styczne' : well.dn;
        // Snapshot dla zamówionych (jak pozycje przez getItemAssessedPrice):
        // pieczenie z live rozjeżdżało przejścia z dennicą po zmianie rabatu
        // (dennica -40% ze snapshotu, przejścia -30% z live).
        const activeDiscounts =
            typeof getWellActiveDiscounts === 'function'
                ? getWellActiveDiscounts(well)
                : wellDiscounts;
        const disc = activeDiscounts[discountKey] || {};

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
            const isCustom =
                typeof isCustomPrzejscie === 'function'
                    ? isCustomPrzejscie(item)
                    : item.isCustom === true;
            if (!p && !isCustom) return;

            let drillingBasePrice = 0;
            let drillProdName = '';
            let drillProdDn = '';
            let hostType = null;
            const isInsitu = !!(p && p.name && p.name.toUpperCase().includes('INSITU'));

            if (p && configMap.length > 0) {
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
                            const picked =
                                typeof findDrillingProductForDn === 'function'
                                    ? findDrillingProductForDn(trDn)
                                    : null;
                            if (picked) {
                                drillingBasePrice = picked.price;
                                drillProdName = picked.drill.name;
                                drillProdDn = picked.drill.dn || '';
                            }
                        }
                    }
                }
            }

            const transPriceBase = p
                ? p.price || 0
                : typeof getPrzejscieBasePrice === 'function'
                  ? getPrzejscieBasePrice(item, null)
                  : Number(item.customPrice) || 0;
            const bP = transPriceBase + drillingBasePrice;
            const mult =
                typeof getTransitionHostPct === 'function'
                    ? 1 - getTransitionHostPct(well, disc, hostType) / 100
                    : 1 - getWellNadbudowaPct(well, disc) / 100;
            item.frozenPrice = bP * mult;
            item.frozenPriceBase = bP;
            item.frozenName =
                typeof getPrzejscieName === 'function'
                    ? getPrzejscieName(item, p)
                    : p
                      ? p.name || p.category
                      : item.customName;
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
        // Blad calc nie moze utrwalic 0 zl w zamowieniu - brak mrozenia
        // znaczy "przelicz pozniej", a nie "cena 0".
        if (preco && !preco.error && Number.isFinite(preco.suma)) {
            well.frozenPrecoSuma = preco.suma;
        } else {
            delete well.frozenPrecoSuma;
        }
    } catch (_e) {
        // pasywnie — brak mrożenia zamiast wywalenia zapisu
    }
}

/**
 * Unieważnia snapshot cen pozycji studni po edycji parametru wpływającego
 * na cenę (krąg/dennica Beton<->Żelbet, PEHD, klasa betonu, agresje, klasy
 * nośności, malowanie, kineta/spocznik, redukcja, stopnie, uszczelka,
 * geometria przejścia...).
 * Bez tego calcWellStats bierze item.frozenPrice (isFrozenPriceCtx) i cena
 * stoi mimo zmiany elementu. Obejmuje config i przejścia: Price/Base/
 * StandalonePrice/Name oraz Transition/DrillingPrice/DrillingName/DrillingDn.
 */
function invalidateFrozenPricesForWell(well) {
    if (!well) return;
    (well.config || []).forEach((item) => {
        delete item.frozenPrice;
        delete item.frozenPriceBase;
        delete item.frozenStandalonePrice;
        delete item.frozenName;
    });
    (well.przejscia || []).forEach((item) => {
        delete item.frozenPrice;
        delete item.frozenPriceBase;
        delete item.frozenName;
        delete item.frozenTransitionPrice;
        delete item.frozenDrillingPrice;
        delete item.frozenDrillingName;
        delete item.frozenDrillingDn;
    });
    delete well.frozenPrecoSuma;
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

const roundToGroszFrozen = (value) => {
    if (typeof roundMoney === 'function') return roundMoney(value);
    const numeric = Number(value);
    if (!Number.isFinite(numeric)) return 0;
    if (Math.abs(numeric) >= 1e21) return numeric;
    const [mantissa, exponent = '0'] = Math.abs(numeric).toString().split('e');
    return (
        ((numeric < 0 ? -1 : 1) * Math.round(Number(`${mantissa}e${Number(exponent) + 2}`))) / 100
    );
};

/**
 * Teoretyczny koszt transportu zamowienia (SSoT, skala oferta->zamowienie).
 * Ten sam wzor co saveCurrentOrder/enterOrderEditMode/calculateOfferTotals:
 * pelny koszt oferty x udzial masy biezacej. Bez offerWeight = liczenie wprost.
 */
function calcOrderTheoreticalTransport(currWeight, offerWeight, km, rate, mode) {
    const cw = Number(currWeight) || 0;
    const ow = Number(offerWeight) || 0 || cw;
    const k = Number(km) || 0;
    const r = Number(rate) || 0;
    if (cw <= 0 || k <= 0 || r <= 0) return 0;
    const maxW =
        typeof MAX_TRANSPORT_WEIGHT !== 'undefined' && MAX_TRANSPORT_WEIGHT > 0
            ? MAX_TRANSPORT_WEIGHT
            : 24000;
    const trips =
        typeof calcTransportCount === 'function'
            ? calcTransportCount(ow, mode)
            : Math.ceil(ow / maxW);
    const full = trips * k * r;
    return ow > 0 ? (full * cw) / ow : 0;
}

/**
 * Czysty rdzen zamrozenia transportu: rozdziela theoreticalTotal na udzialy.
 * Studnie z frozen (niezmienione) trzymaja wartosc; reszte (rezydualna)
 * dzieli wagowo na elastyczne; gdy keeps niefinnansowalne (ujemna reszta)
 * — refreeze wszystkich proporcjonalnie. Suma = theoreticalTotal co do grosza
 * (largest remainder, nigdy ujemne udzialy).
 * @param {Array<{weight:number,frozen:number|null}>} items
 * @param {number} theoreticalTotal
 * @returns {Array<number>} udzialy per studnia (zaokraglone do grosza)
 */
function redistributeFrozenTransport(items, theoreticalTotal) {
    const list = (Array.isArray(items) ? items : []).map((it) => ({
        weight: Number(it && it.weight) || 0,
        frozen: it && it.frozen != null && isFinite(Number(it.frozen)) ? Number(it.frozen) : null
    }));
    const out = new Array(list.length).fill(0);
    const T = Number(theoreticalTotal) || 0;
    if (list.length === 0 || T <= 0) return out;
    const keepSet = new Set();
    let sumKeep = 0;
    list.forEach((it, i) => {
        if (it.frozen != null) {
            keepSet.add(i);
            sumKeep += it.frozen;
        }
    });
    let flex = list.map((_, i) => i).filter((i) => !keepSet.has(i));
    let flexTarget = roundToGroszFrozen(T - sumKeep);
    if (flexTarget < 0) {
        // Keeps niefinnansowalne (np. usunieto ciezka studnie) — refreeze wszystkich.
        keepSet.clear();
        sumKeep = 0;
        flex = list.map((_, i) => i);
        flexTarget = T;
    }
    if (flex.length === 0) {
        list.forEach((it, i) => {
            out[i] = roundToGroszFrozen(it.frozen);
        });
        return out;
    }
    const flexWeight = flex.reduce((s, i) => s + list[i].weight, 0);
    const exact = flex.map((i) =>
        flexWeight > 0 ? (flexTarget * list[i].weight) / flexWeight : flexTarget / flex.length
    );
    const base = exact.map((v) => Math.floor(v * 100 + 1e-9) / 100);
    const baseSum = base.reduce((s, v) => s + v, 0);
    let leftover = Math.round(flexTarget * 100) - Math.round(baseSum * 100);
    const order = flex.map((_, k) => k).sort((a, b) => exact[b] - base[b] - (exact[a] - base[a]));
    const add = new Array(flex.length).fill(0);
    for (let k = 0; k < order.length && leftover > 0; k++) {
        add[order[k]] += 1;
        leftover -= 1;
    }
    flex.forEach((i, k) => {
        out[i] = roundToGroszFrozen(base[k] + add[k] / 100);
    });
    keepSet.forEach((i) => {
        out[i] = roundToGroszFrozen(list[i].frozen);
    });
    return out;
}

/**
 * Mrozi udzialy transportu na zywych studniach zamowienia (mutuje w miejscu).
 * Niezmienione (brak wpisu w getOrderChanges + liczbowy frozenTransportCost)
 * trzymaja wartosc, chyba ze opts.refreezeAll (zmiana km/stawki/trybu).
 * Zwraca {shares, delta} — delta to roznica teoretyczny vs suma (do linii rozliczenia).
 */
function freezeTransportShares(liveWells, opts) {
    const o = opts || {};
    const arr = Array.isArray(liveWells) ? liveWells : [];
    const statsFn =
        typeof o.statsFn === 'function'
            ? o.statsFn
            : typeof calcWellStats === 'function'
              ? calcWellStats
              : null;
    if (!statsFn || arr.length === 0) return { shares: [], delta: 0 };
    const T = Number(o.theoreticalTotal) || 0;
    if (T <= 0) {
        const zeros = arr.map(() => 0);
        arr.forEach((w) => {
            if (w) w.frozenTransportCost = 0;
        });
        return { shares: zeros, delta: 0 };
    }
    let changedIdx = null;
    if (!o.refreezeAll && o.orderLike && o.orderLike.originalSnapshot) {
        try {
            if (typeof getOrderChanges === 'function') {
                const ch = getOrderChanges(Object.assign({}, o.orderLike, { wells: arr }));
                changedIdx = new Set(
                    Object.keys((ch && ch.wells) || {}).filter((k) => k.indexOf('removed:') !== 0)
                );
            }
        } catch (_e) {
            changedIdx = null;
        }
    }
    const weights = arr.map((w) => {
        try {
            return Number(statsFn(w).weight) || 0;
        } catch (_e2) {
            return 0;
        }
    });
    const items = arr.map((w, i) => {
        const fr =
            w && w.frozenTransportCost != null && isFinite(Number(w.frozenTransportCost))
                ? Number(w.frozenTransportCost)
                : null;
        const keep =
            !o.refreezeAll && fr != null && (changedIdx == null || !changedIdx.has(String(i)));
        return { weight: weights[i], frozen: keep ? fr : null };
    });
    const shares = redistributeFrozenTransport(items, T);
    arr.forEach((w, i) => {
        if (w) w.frozenTransportCost = shares[i];
    });
    const sum = shares.reduce((s, v) => s + v, 0);
    return { shares, delta: roundToGroszFrozen(T - sum) };
}

/**
 * Cena porównywalna studni — JEDYNA definicja ceny do detekcji zmian (Faza 1, #7).
 * Kontekst frozen (isPreviewMode=true), BEZ transportu. Uzywa jej badge
 * (getOrderChanges); tabela dokleja udzial transportu do OBU kolumn
 * (Cena z oferty ze snapshotu, Cena zamowienia biezaca), wiec wyswietlana
 * Roznica tez jest z transportem, a detekcja zmian bez (transport to osobny wymiar).
 */
const roundToGroszShared = roundToGroszFrozen;
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
 * Hash kanonicznego wejścia cenowego studni (Faza 3, #5). Zwraca null gdy
 * orderDto.js niedostępny (np. kartoteka) albo hash niepoliczalny — wtedy
 * detekcja spada do samej ceny (zachowanie sprzed Fazy 3).
 */
function dtoConfigHash(well) {
    if (typeof wellConfigHash !== 'function' || typeof toWellOrderDTO !== 'function') return null;
    try {
        return wellConfigHash(toWellOrderDTO(well));
    } catch (_e) {
        return null;
    }
}

/**
 * Buduje wpis zmiany studni z rozdzielonymi wymiarami (Faza 3, #5):
 * priceChanged (cena) vs configChanged (konfiguracja). Konsumenci czytają
 * type/fields — kształt wstecznie kompatybilny.
 */
function buildWellChange(currPrice, origPrice, configChanged) {
    const priceChanged = Math.abs(currPrice - origPrice) > 0.01;
    if (!priceChanged && !configChanged) return null;
    const fields = [];
    if (priceChanged) fields.push('price');
    if (configChanged) fields.push('config');
    return {
        type: 'modified',
        fields,
        priceDiff: priceChanged ? currPrice - origPrice : 0,
        priceChanged,
        configChanged: !!configChanged
    };
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

    const roundToGrosz = roundToGroszFrozen;
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
            const origHash = slimWells[origIdx].configHash;
            const currHash = dtoConfigHash(curr[currIdx]);
            const configChanged = origHash != null && currHash !== null && currHash !== origHash;
            const change = buildWellChange(currPrice, origPrice, configChanged);
            if (change) changes[currIdx] = change;
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
                const origHash = dtoConfigHash(orig[origIdx]);
                const currHash = dtoConfigHash(curr[currIdx]);
                const configChanged =
                    origHash !== null && currHash !== null && currHash !== origHash;
                const change = buildWellChange(currPrice, origPrice, configChanged);
                if (change) changes[currIdx] = change;
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
                    normalizeTransportMode(origTransportMode) ||
                !!order.transportSeparate !== !!originalSnapshotData.transportSeparate);
    } finally {
        window.isPreviewMode = savedTransportPreviewMode;
    }

    return { wells: changes, transportChanged };
}

/**
 * Kontekst ceny zamrożonej: podgląd/zamówienie (isPreviewMode) albo edycja
 * oferty ze snapshotem cen (isOfferEditFrozen). Wszystkie guardy frozen
 * (frozenPrice, frozenPrecoSuma) MUSZĄ iść przez tę funkcję (SSoT).
 */
function isFrozenPriceCtx() {
    if (typeof window === 'undefined') return false;
    return !!window.isPreviewMode || !!window.isOfferEditFrozen;
}

/* ===== SPÓJNOŚĆ PARAMETRÓW: studnia ↔ zlecenia produkcyjne =====
 * Studnia (well) jest źródłem prawdy dla parametrów widocznych w kalkulatorze,
 * Excelu i zleceniach. Każda zmiana w studni propaguje się do roboczych
 * (niezaakceptowanych) PZ, a wybór w zleceniu aktualizuje studnię
 * (orderZleceniaForm.js). Wartości per-element (krag_ot, dennica ze zwężeniem)
 * zachowują wymuszone „brak" jak w formularzu zlecenia. */
const KLASA_BETONU_WELL_TO_PZ = {
    'C40/50(HSR)': 'C40/50(HSR!!!!)',
    'C45/55(HSR)': 'C45/55(HSR!!!!)',
    'C70/80(HSR)': 'C70/80(HSR!!!!)'
};
const KLASA_BETONU_PZ_TO_WELL = {
    'C40/50(HSR!!!!)': 'C40/50(HSR)',
    'C45/55(HSR!!!!)': 'C45/55(HSR)',
    'C70/80(HSR!!!!)': 'C70/80(HSR)'
};

function klasaBetonuWellToPz(value) {
    return KLASA_BETONU_WELL_TO_PZ[value] || value || '';
}

function klasaBetonuPzToWell(value) {
    return KLASA_BETONU_PZ_TO_WELL[value] || value || '';
}

function wellStopnieFamily(value) {
    const v = String(value == null ? '' : value);
    if (!v || v === 'brak') return 'brak';
    if (v.indexOf('szlachetna') >= 0 || v === 'nierdzewna') return 'nierdzewna';
    if (v.indexOf('stalowa') >= 0 || v === 'drabinka') return 'drabinka';
    return 'inne';
}

const STOPNIE_DEFAULT_BY_FAMILY = {
    drabinka: 'drabinka_a_stalowa',
    nierdzewna: 'drabinka_a_szlachetna',
    brak: '',
    inne: 'inne'
};

function pzFindProduct(productId) {
    if (typeof getStudnieProductById === 'function') return getStudnieProductById(productId);
    if (typeof studnieProducts === 'undefined' || !Array.isArray(studnieProducts)) return null;
    return studnieProducts.find((pr) => pr.id === productId) || null;
}

/* Produkt PZ: z zapisanego productId, inaczej z configu studni po indeksie/kluczu. */
function pzElementProduct(well, po) {
    if (po && po.productId) {
        const byId = pzFindProduct(po.productId);
        if (byId) return byId;
    }
    const config = well && Array.isArray(well.config) ? well.config : [];
    const idx = Number(po && po.elementIndex);
    let item = Number.isInteger(idx) ? config[idx] : null;
    if (!item && po && po.elementKey) {
        item = config.find((c) => c && c._elemId && c._elemId === po.elementKey) || null;
    }
    return item ? pzFindProduct(item.productId) : null;
}

function pzNextElementProduct(well, po) {
    const config = well && Array.isArray(well.config) ? well.config : [];
    const idx = Number(po && po.elementIndex);
    const start = Number.isInteger(idx) ? idx : -1;
    for (let i = start + 1; i < config.length; i++) {
        const product = pzFindProduct(config[i].productId);
        if (product && product.componentType !== 'uszczelka') return product;
    }
    return null;
}

/**
 * Parametry, które PZ musi dzielić ze studnią. `forceBrak` = element nie ma
 * dna kinety (krag_ot albo dennica ze zwężeniem/psia buda) — jak w formularzu.
 * Puste pole studni (legacy) nie nadpisuje wartości już zapisanej w PZ.
 */
function buildPzParamsFromWell(well, po) {
    if (!well) return null;
    const product = pzElementProduct(well, po);
    const type = product ? product.componentType : '';
    const next = type === 'dennica' ? pzNextElementProduct(well, po) : null;
    const nextIsDennicaLike =
        next && (next.componentType === 'dennica' || next.componentType === 'styczna');
    const forceBrak =
        type === 'krag_ot' ||
        (type === 'dennica' && (nextIsDennicaLike || (well.psiaBuda && !next)));

    const pick = (wellValue, poValue, fallback) => wellValue || poValue || fallback || '';

    const kineta = forceBrak ? 'brak' : pick(well.kineta, po.kineta, 'brak');
    let spocznikH = forceBrak ? 'brak' : pick(well.spocznikH, po.spocznikH, 'brak');
    if (kineta === 'preco' || kineta === 'precotop' || kineta === 'unolith') spocznikH = '1/1';

    const warehousePart =
        product && typeof partForProduct === 'function'
            ? partForProduct(product)
            : type === 'dennica' || type === 'kineta' || type === 'styczna'
              ? 'dennica'
              : 'nadbudowa';
    const magazyn =
        typeof resolveWellMagazyn === 'function'
            ? resolveWellMagazyn(well, warehousePart)
            : (warehousePart === 'dennica' ? well.magazynDennica : well.magazynNadbudowa) ||
              well.magazyn ||
              'Kluczbork';
    const hasConfiguredWarehouse = Boolean(
        well.magazyn || well.magazynDennica || well.magazynNadbudowa
    );

    return {
        ...(hasConfiguredWarehouse ? { magazyn } : {}),
        kineta,
        spocznik: forceBrak ? 'brak' : pick(well.spocznik, po.spocznik, 'brak'),
        spocznikH,
        redukcjaKinety: forceBrak ? 'nie' : pick(well.redukcjaKinety, po.redukcjaKinety, ''),
        usytuowanie: pick(well.usytuowanie, po.usytuowanie, ''),
        klasaBetonu: klasaBetonuWellToPz(pick(well.klasaBetonu, po.klasaBetonu, ''))
    };
}

/**
 * Propaguje parametry studni do roboczych PZ tej studni. Zwraca liczbę
 * zmienionych rekordów; każdy zmieniony jest oznaczany jako oczekujący zapisu
 * („Zapisz i zamknij” utrwali go). Zaakceptowane PZ są zamrożone — pomijane.
 */
function syncWellParamsToProductionOrders(well) {
    if (!well || !well.id) return 0;
    if (typeof productionOrders === 'undefined' || !Array.isArray(productionOrders)) return 0;

    const stopniePref = well._selectedRodzajStopni || '';
    const wellFamily = wellStopnieFamily(stopniePref || well.stopnie);
    let changedCount = 0;

    productionOrders.forEach((po) => {
        if (!po || String(po.wellId) !== String(well.id) || po.status === 'accepted') return;

        const params = buildPzParamsFromWell(well, po);
        if (!params) return;
        let dirty = false;
        Object.keys(params).forEach((key) => {
            if (po[key] !== params[key]) {
                po[key] = params[key];
                dirty = true;
            }
        });

        // Stopnie: pełny wybór z konfiguratora wygrywa; inaczej dopasuj rodzinę
        // (drabinka/nierdzewna), nie nadpisując wariantu A/B wybranego w zleceniu.
        // Studnia bez ustawionych stopni (legacy) nie nadpisuje PZ.
        const wellHasStopnie = Boolean(stopniePref || well.stopnie);
        if (stopniePref) {
            if (po.rodzajStopni !== stopniePref) {
                po.rodzajStopni = stopniePref;
                dirty = true;
            }
        } else if (wellHasStopnie && wellStopnieFamily(po.rodzajStopni) !== wellFamily) {
            po.rodzajStopni = STOPNIE_DEFAULT_BY_FAMILY[wellFamily] || '';
            dirty = true;
        }

        // Beton/Żelbet zależy od elementu: dennica vs nadbudowa.
        const product = pzElementProduct(well, po);
        if (product && product.componentType) {
            const material =
                product.componentType === 'dennica' ? well.dennicaMaterial : well.nadbudowa;
            if (material === 'zelbetowa' || material === 'betonowa') {
                const expected = material === 'zelbetowa' ? 'zelbet' : 'beton';
                if (po.rodzajStudni !== expected) {
                    po.rodzajStudni = expected;
                    dirty = true;
                }
            }
        }

        if (!dirty) return;
        changedCount += 1;
        if (typeof markProductionOrderPending === 'function') markProductionOrderPending(po);
    });

    return changedCount;
}

/** Synchronizuje wyłącznie magazyn między konfiguracją a roboczymi PZ studni. */
function syncWellWarehouseToProductionOrders(well) {
    if (
        !well ||
        !well.id ||
        typeof productionOrders === 'undefined' ||
        !Array.isArray(productionOrders)
    )
        return 0;
    let changedCount = 0;
    productionOrders.forEach((po) => {
        if (!po || String(po.wellId) !== String(well.id) || po.status === 'accepted') return;
        const product = pzElementProduct(well, po);
        if (!product) return;
        const part =
            typeof partForProduct === 'function'
                ? partForProduct(product)
                : ['dennica', 'kineta', 'styczna'].includes(product.componentType)
                  ? 'dennica'
                  : 'nadbudowa';
        const warehouse =
            typeof resolveWellMagazyn === 'function'
                ? resolveWellMagazyn(well, part)
                : (part === 'dennica' ? well.magazynDennica : well.magazynNadbudowa) ||
                  well.magazyn ||
                  'Kluczbork';
        if (po.magazyn === warehouse) return;
        po.magazyn = warehouse;
        changedCount += 1;
        if (typeof markProductionOrderPending === 'function') markProductionOrderPending(po);
    });
    return changedCount;
}

function syncAllWellParamsToProductionOrders() {
    if (typeof wells === 'undefined' || !Array.isArray(wells)) return 0;
    let total = 0;
    wells.forEach((well) => {
        total += syncWellParamsToProductionOrders(well);
    });
    return total;
}

window.syncWellParamsToProductionOrders = syncWellParamsToProductionOrders;
window.syncWellWarehouseToProductionOrders = syncWellWarehouseToProductionOrders;
window.syncAllWellParamsToProductionOrders = syncAllWellParamsToProductionOrders;
window.buildPzParamsFromWell = buildPzParamsFromWell;
window.klasaBetonuPzToWell = klasaBetonuPzToWell;
window.klasaBetonuWellToPz = klasaBetonuWellToPz;

window.freezeWellPrices = freezeWellPrices;
window.invalidateFrozenPricesForWell = invalidateFrozenPricesForWell;
window.isFrozenPriceCtx = isFrozenPriceCtx;
window.getOrderChanges = getOrderChanges;
window.normalizeTransportMode = normalizeTransportMode;
window.DEFAULT_TRANSPORT_MODE = DEFAULT_TRANSPORT_MODE;
window.calcOrderTheoreticalTransport = calcOrderTheoreticalTransport;
window.redistributeFrozenTransport = redistributeFrozenTransport;
window.freezeTransportShares = freezeTransportShares;
window.calcComparableWellPrice = calcComparableWellPrice;
window.matchWellPairs = matchWellPairs;
window.freezeWellPreco = freezeWellPreco;
window.dtoConfigHash = dtoConfigHash;
window.buildWellChange = buildWellChange;

/* ===== Rejestracja globali ===== */
window.loadOrdersStudnie = loadOrdersStudnie;
window.saveOrdersDataStudnie = saveOrdersDataStudnie;
window.putSingleOrderStudnie = putSingleOrderStudnie;
window.patchSingleOrderStudnie = patchSingleOrderStudnie;
window.handleOrderConflict = handleOrderConflict;
window.markOrderSaved = markOrderSaved;
window.syncOrdersStudnieEntry = syncOrdersStudnieEntry;
window.getOrderBaseUpdatedAt = getOrderBaseUpdatedAt;
