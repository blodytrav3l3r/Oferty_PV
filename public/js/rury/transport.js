// @ts-check
/* ===== KALKULACJA TRANSPORTU (RURY) ===== */
/* Wydzielone z app.js — odpowiedzialność: kalkulacja kursów, kosztów, rozkładu wagowego */
/* Zależności: products (globalna), getProductDiameter() z productHelpers.js */
/* fmt(), fmtInt() z shared/formatters.js */

let currentRuryTransportMode = 'full';
// Rozliczenie transportu: false = wliczony w ceny pozycji, true = osobna pozycja (TR-RURY).
let currentRuryTransportSeparate = false;

// SSoT zaokrągleń: shared/formatters.js → roundMoney (2 miejsca, half-up).
// Fallback wyłącznie dla sandboxów vm/testów bez formatters.js.
const _moneyRoundTransport =
    typeof roundMoney === 'function'
        ? roundMoney
        : (/** @type {number} */ v) => {
              const n = Number(v);
              if (!Number.isFinite(n)) return 0;
              if (Math.abs(n) >= 1e21) return n;
              const [mantissa, exponent = '0'] = Math.abs(n).toString().split('e');
              return (
                  (n < 0 ? -1 : 1) *
                  (Math.round(Number(`${mantissa}e${Number(exponent) + 2}`)) / 100)
              );
          };

// Stan zwinięcia kalkulacji transportu (collapseState, per-user; brak → zwinięta jak dziś).
try {
    if (
        typeof collapseGet === 'function' &&
        typeof window.isTransportBreakdownExpanded === 'undefined'
    )
        window.isTransportBreakdownExpanded = collapseGet('rury-transport-breakdown', false);
} catch (_e) {}

window.toggleRuryTransportMode = function () {
    currentRuryTransportMode = currentRuryTransportMode === 'full' ? 'fractional' : 'full';
    const label = document.getElementById('rury-transport-mode-label');
    if (label) label.textContent = currentRuryTransportMode === 'full' ? 'Pełne' : 'Rzeczywiste';
    if (typeof window.updateRuryModalTransportDetails === 'function')
        window.updateRuryModalTransportDetails();
    if (typeof updateOfferSummary === 'function') updateOfferSummary();
};

window.toggleRuryTransportSeparate = function () {
    currentRuryTransportSeparate = !currentRuryTransportSeparate;
    const label = document.getElementById('rury-transport-separate-label');
    if (label)
        label.textContent = currentRuryTransportSeparate ? 'Osobna pozycja' : 'W cenie elementów';
    if (typeof window.updateRuryModalTransportDetails === 'function')
        window.updateRuryModalTransportDetails();
    if (typeof updateOfferSummary === 'function') updateOfferSummary();
};

/** Czy transport rozliczany jest jako osobna pozycja (TR-RURY). */
window.isRuryTransportSeparate = function () {
    return !!currentRuryTransportSeparate;
};
window.isRuryTransportSeparate.imported = null;
window.isRuryTransportSeparate.getImported = function () {
    const order =
        window.orderEditMode && typeof window.getCurrentRuryOrder === 'function'
            ? window.getCurrentRuryOrder()
            : null;
    const imported = window.orderEditMode
        ? order && order.externalTransportCost != null
            ? {
                  cost: Number(order.externalTransportCost),
                  count: Number(order.transportCount) || 1
              }
            : null
        : window.isRuryTransportSeparate.imported;
    if (!currentRuryTransportSeparate || !imported) return null;
    if (!window.orderEditMode && window.editingOfferId !== imported.id) return null;
    if (window.orderEditMode && !order) return null;
    const km = Number(document.getElementById('transport-km')?.value) || 0;
    const rate = Number(document.getElementById('transport-rate')?.value) || 0;
    return km === 0 && rate === 0 ? imported : null;
};
window.isRuryTransportSeparate.getCalculated = function (items) {
    const count = calculateTransports(items).totalTransports;
    return { count, cost: _moneyRoundTransport(count * getCostPerTrip()) };
};

/** Zwraca liczbę transportów w zależności od trybu */
function getRuryTransportCount(items) {
    if (currentRuryTransportMode === 'fractional') {
        let totalWeight = 0;
        items.forEach((i) => {
            if (i.autoAdded || !i.weight || i.weight <= 0 || i.quantity <= 0) return;
            totalWeight += i.weight * i.quantity;
        });
        return totalWeight > 0 ? totalWeight / MAX_TRANSPORT_WEIGHT : 0;
    }
    return calculateTransports(items).totalTransports;
}

/* ===== POMOCNICY KOSZTU TRANSPORTU NA JEDNOSTKĘ ===== */

function getCostPerTrip() {
    const km = Number(document.getElementById('transport-km')?.value) || 0;
    const rate = Number(document.getElementById('transport-rate')?.value) || 0;
    return _moneyRoundTransport(km * rate);
}

/**
 * Oblicza rozkład kosztów transportu na wszystkie pozycje.
 *
 * Używa liczby transportów PO OPTYMALIZACJI (po konsolidacji)
 * i rozdziela koszt proporcjonalnie do WAGI:
 *   Całkowity koszt transportu = totalTransports (po optymalizacji) × costPerTrip
 *   Udział wagowy każdego produktu = (weightPerPiece × ilość) / całkowitaWaga
 *   Transport na jednostkę = (udziałWagowy × całkowityKosztTransportu) / ilość
 *
 * Gwarantuje to, że cięższe przedmioty płacą więcej, lżejsze mniej,
 * a suma wszystkich opłat = rzeczywisty całkowity koszt transportu.
 *
 * Zwraca obiekt: productId → transportPerUnit
 *
 * --- Pełna formuła ceny pozycji (per item) ---
 *   unitPrice                           — cena z cennika (products[].price)
 *     × (1 - discount/100)              — rabat % (item.discount, 0-100)
 *     = basePriceAfterDiscount
 *   basePriceAfterDiscount
 *     + pehdCostPerUnit                 — wkład PEHD (button w tabeli, 0 jeśli brak)
 *     + surcharge                       — dopłata żelbet (input ręczny w wierszu)
 *     = priceAfterDiscount              ← "Po rabacie" w tabeli oferty
 *   priceAfterDiscount
 *     + transportPerUnit                ← wynik TEJ funkcji
 *     = unitTotal
 *   unitTotal × quantity
 *     = netto                           ← "Razem netto" wiersza
 *
 * costPerTrip = transport-km × transport-rate (getCostPerTrip, transport.js:10)
 * Jeśli costPerTrip <= 0 → zwraca pusty obiekt (brak transportu).
 */
function calculateTransportDistribution(items, costPerTripOverride) {
    // Osobna pozycja: koszt nie wchodzi w ceny jednostkowe (wiersz TR-RURY w tabeli).
    if (currentRuryTransportSeparate) return {};
    const costPerTrip = costPerTripOverride != null ? costPerTripOverride : getCostPerTrip();
    const distribution = {};
    if (costPerTrip <= 0) return distribution;

    const transportResult = calculateTransports(items);
    if (transportResult.lines.length === 0) return distribution;

    let totalTransportCost, totalWeight;

    if (currentRuryTransportMode === 'fractional') {
        const filteredItems = items.filter(
            (i) => !i.autoAdded && i.weight && i.weight > 0 && i.quantity > 0
        );
        totalWeight = filteredItems.reduce((s, i) => s + i.weight * i.quantity, 0);
        if (totalWeight <= 0) return distribution;
        const fractionalTrips = totalWeight / MAX_TRANSPORT_WEIGHT;
        totalTransportCost = fractionalTrips * costPerTrip;

        transportResult.lines.forEach((line) => {
            const weightShare = line.totalWeight / totalWeight;
            const itemTransportCost = weightShare * totalTransportCost;
            distribution[line.productId] = _moneyRoundTransport(itemTransportCost / line.quantity);
        });
    } else {
        if (transportResult.totalTransports <= 0) return distribution;
        totalTransportCost = transportResult.totalTransports * costPerTrip;
        totalWeight = transportResult.lines.reduce((s, l) => s + l.totalWeight, 0);
        if (totalWeight <= 0) return distribution;

        transportResult.lines.forEach((line) => {
            const weightShare = line.totalWeight / totalWeight;
            const itemTransportCost = weightShare * totalTransportCost;
            distribution[line.productId] = _moneyRoundTransport(itemTransportCost / line.quantity);
        });
    }

    return distribution;
}

/**
 * Dzieli kwotę transportu na pozycje w całych groszach metodą największej reszty.
 * Wynik ma klucz UID pozycji, więc duplikaty tego samego produktu pozostają osobne.
 */
function calculateTransportAllocation(items, totalCost) {
    const totalCents = Math.max(0, Math.round(_moneyRoundTransport(totalCost) * 100));
    let eligible = items
        .map((item, index) => {
            const product = getRuryProductById(item.productId);
            const weight = item.customLengthM
                ? Number(item.weight) || 0
                : Number(product?.weight ?? item.weight) || 0;
            return { item, index, weight, quantity: Number(item.quantity) || 0 };
        })
        .filter(
            ({ item, weight, quantity }) =>
                !item.autoAdded &&
                typeof item.uid === 'string' &&
                item.uid &&
                weight > 0 &&
                quantity > 0
        );
    let totalWeight = eligible.reduce((sum, entry) => sum + entry.weight * entry.quantity, 0);
    if (totalWeight <= 0) {
        eligible = items
            .map((item, index) => ({
                item,
                index,
                weight: 1,
                quantity: Number(item.quantity) || 0
            }))
            .filter(
                ({ item, quantity }) =>
                    !item.autoAdded && typeof item.uid === 'string' && item.uid && quantity > 0
            );
        totalWeight = eligible.reduce((sum, entry) => sum + entry.quantity, 0);
    }
    if (totalCents === 0 || totalWeight <= 0) return { version: 1, items: [] };

    const shares = eligible.map((entry) => {
        const exact = (totalCents * entry.weight * entry.quantity) / totalWeight;
        return { ...entry, cents: Math.floor(exact), remainder: exact - Math.floor(exact) };
    });
    const remainingCents = totalCents - shares.reduce((sum, share) => sum + share.cents, 0);
    const remainderOrder = [...shares].sort((a, b) => {
        if (b.remainder !== a.remainder) return b.remainder - a.remainder;
        const uidA = String(a.item.uid || '');
        const uidB = String(b.item.uid || '');
        return (uidA < uidB ? -1 : uidA > uidB ? 1 : 0) || a.index - b.index;
    });
    for (let index = 0; index < remainingCents; index++) {
        remainderOrder[index].cents += 1;
    }

    return {
        version: 1,
        items: shares.map(({ item, quantity, cents }) => {
            /** @type {{itemUid:string,totalCents:number,segments?:Array<{quantity:number,transportCentsPerUnit:number}>}} */
            const allocation = { itemUid: item.uid, totalCents: cents };
            if (Number.isInteger(quantity)) {
                const baseCents = Math.floor(cents / quantity);
                const extraUnits = cents % quantity;
                allocation.segments = [
                    ...(quantity - extraUnits > 0
                        ? [{ quantity: quantity - extraUnits, transportCentsPerUnit: baseCents }]
                        : []),
                    ...(extraUnits > 0
                        ? [
                              {
                                  quantity: extraUnits,
                                  transportCentsPerUnit: baseCents + 1
                              }
                          ]
                        : [])
                ];
            }
            return allocation;
        })
    };
}

/** Pure read projection: use a valid saved allocation or calculate legacy data without mutation. */
function projectTransportAllocation(items, savedAllocation, totalCost) {
    if (isTransportAllocationValid(items, savedAllocation, totalCost)) {
        const byUid = new Map(
            savedAllocation.items
                .filter((entry) => entry && typeof entry.itemUid === 'string')
                .map((entry) => [entry.itemUid, entry])
        );
        return {
            version: 1,
            items: items.flatMap((item) => {
                const entry = byUid.get(item.uid);
                return entry ? [{ ...entry }] : [];
            })
        };
    }
    return calculateTransportAllocation(items, totalCost);
}

function isTransportAllocationValid(items, allocation, totalCost) {
    if (allocation?.version !== 1 || !Array.isArray(allocation.items)) return false;
    const sourceByUid = new Map();
    for (const item of items) {
        if (!item?.uid) continue;
        if (sourceByUid.has(item.uid)) return false;
        sourceByUid.set(item.uid, item);
    }
    const seen = new Set();
    let totalCents = 0;
    for (const entry of allocation.items) {
        if (
            !entry ||
            typeof entry.itemUid !== 'string' ||
            !sourceByUid.has(entry.itemUid) ||
            seen.has(entry.itemUid) ||
            !Number.isInteger(entry.totalCents) ||
            entry.totalCents < 0
        )
            return false;
        seen.add(entry.itemUid);
        totalCents += entry.totalCents;
        const source = sourceByUid.get(entry.itemUid);
        const sourceQuantity = Number(source.orderedQuantity ?? source.quantity);
        if (!Number.isFinite(sourceQuantity) || sourceQuantity <= 0) return false;
        if (
            Number.isInteger(sourceQuantity) &&
            sourceQuantity > 0 &&
            (!Array.isArray(entry.segments) ||
                entry.segments.length < 1 ||
                entry.segments.length > 2)
        )
            return false;
        if (entry.segments === undefined) continue;
        if (!Array.isArray(entry.segments) || entry.segments.length > 2) return false;
        if (!Number.isInteger(sourceQuantity) || sourceQuantity <= 0) return false;
        let segmentQuantity = 0;
        let segmentCents = 0;
        for (const segment of entry.segments) {
            if (
                !segment ||
                !Number.isInteger(segment.quantity) ||
                segment.quantity <= 0 ||
                !Number.isInteger(segment.transportCentsPerUnit) ||
                segment.transportCentsPerUnit < 0
            )
                return false;
            segmentQuantity += segment.quantity;
            segmentCents += segment.quantity * segment.transportCentsPerUnit;
        }
        if (segmentQuantity !== sourceQuantity || segmentCents !== entry.totalCents) return false;
    }
    return totalCents === Math.max(0, Math.round(_moneyRoundTransport(totalCost) * 100));
}

function isValidCurrentOrderTransportAllocation(order) {
    const items = order?.items;
    const transportCost = Number(order?.transportCost);
    if (!Array.isArray(items) || !Number.isFinite(transportCost)) return false;
    return isTransportAllocationValid(items, order.transportAllocation, transportCost);
}

function getTransportAllocationCents(allocation, itemUid) {
    return allocation.items.find((entry) => entry.itemUid === itemUid)?.totalCents || 0;
}

function getTransportSegments(allocation, itemUid) {
    return allocation.items.find((entry) => entry.itemUid === itemUid)?.segments || [];
}

function sortRuryOrdersByCreation(orders) {
    return [...orders].sort((a, b) => {
        const createdA = String(a.createdAt || a.date || '');
        const createdB = String(b.createdAt || b.date || '');
        return (
            (createdA < createdB ? -1 : createdA > createdB ? 1 : 0) ||
            (String(a.id) < String(b.id) ? -1 : String(a.id) > String(b.id) ? 1 : 0)
        );
    });
}

/** Returns saved per-unit shares for selected order quantities without changing the source. */
function selectTransportAllocation(items, allocation, sourceItems = items, orderedOffsets = {}) {
    const byUid = new Map((allocation?.items || []).map((entry) => [entry.itemUid, entry]));
    const sourceByUid = new Map(sourceItems.map((item) => [item.uid, item]));
    return {
        version: 1,
        items: items.flatMap((item) => {
            const source = byUid.get(item.uid);
            if (!source) return [];
            const selectedQuantity = Math.max(
                0,
                Number(item.orderedQuantity ?? item.quantity) || 0
            );
            const sourceQuantity = Number(sourceByUid.get(item.uid)?.quantity) || 0;
            const offset = Math.max(0, Number(orderedOffsets[item.uid]) || 0);
            if (!Number.isInteger(selectedQuantity)) {
                const startCents =
                    sourceQuantity > 0
                        ? Math.round((source.totalCents * offset) / sourceQuantity)
                        : 0;
                const endCents =
                    sourceQuantity > 0
                        ? Math.round(
                              (source.totalCents * (offset + selectedQuantity)) / sourceQuantity
                          )
                        : source.totalCents;
                const totalCents = endCents - startCents;
                return [{ itemUid: source.itemUid, totalCents }];
            }
            if (!Array.isArray(source.segments)) {
                const startCents =
                    sourceQuantity > 0
                        ? Math.round((source.totalCents * offset) / sourceQuantity)
                        : 0;
                const endCents =
                    sourceQuantity > 0
                        ? Math.round(
                              (source.totalCents * (offset + selectedQuantity)) / sourceQuantity
                          )
                        : source.totalCents;
                const totalCents = endCents - startCents;
                return [{ ...source, totalCents }];
            }
            let offsetLeft = offset;
            let left = selectedQuantity;
            const selectedSegments = [];
            for (const segment of source.segments) {
                const skipped = Math.min(offsetLeft, segment.quantity);
                offsetLeft -= skipped;
                const available = segment.quantity - skipped;
                if (available <= 0) continue;
                const quantity = Math.min(left, available);
                if (quantity > 0) {
                    selectedSegments.push({
                        quantity,
                        transportCentsPerUnit: segment.transportCentsPerUnit
                    });
                    left -= quantity;
                }
                if (left <= 0) break;
            }
            const totalCents = selectedSegments.reduce(
                (sum, segment) => sum + segment.quantity * segment.transportCentsPerUnit,
                0
            );
            return [{ ...source, totalCents, segments: selectedSegments }];
        })
    };
}

function allocateRuryOrderTransport(
    orderItems,
    sourceItems,
    sourceAllocation,
    otherOrders,
    currentOrder
) {
    const sourceByUid = new Map(sourceItems.map((item) => [item.uid, item]));
    const sourceAllocationByUid = new Map(
        (sourceAllocation?.items || []).map((entry) => [entry.itemUid, entry])
    );
    const canPreserveCurrentAllocation = isValidCurrentOrderTransportAllocation(currentOrder);
    const currentAllocationByUid = new Map(
        (canPreserveCurrentAllocation ? currentOrder.transportAllocation.items : []).map(
            (entry) => [entry.itemUid, entry]
        )
    );
    const currentQuantityByUid = new Map(
        (canPreserveCurrentAllocation ? currentOrder.items : [])
            .filter((item) => currentAllocationByUid.has(item.uid))
            .map((item) => [item.uid, Number(item.orderedQuantity ?? item.quantity) || 0])
    );
    const orderedOthers = sortRuryOrdersByCreation(
        otherOrders.filter((order) => order.id !== currentOrder?.id && !order.transportSeparate)
    );
    const result = [];

    for (const orderItem of orderItems) {
        const itemUid = orderItem.uid;
        const quantity = Math.max(0, Number(orderItem.orderedQuantity ?? orderItem.quantity) || 0);
        if (!itemUid || quantity <= 0) continue;
        const sourceItem = sourceByUid.get(itemUid);
        const source = sourceAllocationByUid.get(itemUid);
        if (!source || !sourceItem) continue;
        const sourceQuantity = Number(sourceItem.quantity) || 0;
        const hasFractionalOrder = orderedOthers.some((order) => {
            const existingItem = (order.items || []).find((item) => item.uid === itemUid);
            const existingQuantity = Number(
                existingItem?.orderedQuantity ?? existingItem?.quantity
            );
            return existingItem && !Number.isInteger(existingQuantity);
        });
        const isUnitBased =
            Number.isInteger(sourceQuantity) &&
            Number.isInteger(quantity) &&
            !hasFractionalOrder &&
            Array.isArray(source.segments);

        if (isUnitBased) {
            const pool = source.segments.map((segment) => ({
                rate: segment.transportCentsPerUnit,
                quantity: segment.quantity
            }));
            const takeUnits = (requestedQuantity, requestedSegments = null) => {
                let left = requestedQuantity;
                const picked = new Map();
                const take = (rate, available) => {
                    const poolEntry = pool.find((entry) => entry.rate === rate);
                    if (!poolEntry || poolEntry.quantity < available) return false;
                    poolEntry.quantity -= available;
                    picked.set(rate, (picked.get(rate) || 0) + available);
                    left -= available;
                    return true;
                };
                if (requestedSegments) {
                    for (const segment of requestedSegments) {
                        if (!take(segment.transportCentsPerUnit, segment.quantity)) return null;
                    }
                } else {
                    for (const entry of [...pool].sort((a, b) => a.rate - b.rate)) {
                        const available = Math.min(left, entry.quantity);
                        if (available > 0 && !take(entry.rate, available)) return null;
                        if (left <= 0) break;
                    }
                }
                if (left > 0) return null;
                return [...picked.entries()]
                    .sort(([rateA], [rateB]) => rateA - rateB)
                    .map(([transportCentsPerUnit, segmentQuantity]) => ({
                        quantity: segmentQuantity,
                        transportCentsPerUnit
                    }));
            };

            let valid = true;
            for (const other of orderedOthers) {
                const otherItem = (other.items || []).find((item) => item.uid === itemUid);
                if (!otherItem) continue;
                const otherQuantity = Number(otherItem.orderedQuantity ?? otherItem.quantity) || 0;
                if (otherQuantity <= 0) continue;
                const saved = (other.transportAllocation?.items || []).find(
                    (entry) => entry.itemUid === itemUid
                );
                const consumed = takeUnits(
                    otherQuantity,
                    Array.isArray(saved?.segments) ? saved.segments : null
                );
                if (!consumed) {
                    valid = false;
                    break;
                }
            }
            if (!valid) return { valid: false, reason: 'transport-pool-conflict' };

            const oldSegments = currentAllocationByUid.get(itemUid)?.segments || [];
            const oldQuantity = currentQuantityByUid.get(itemUid) || 0;
            const preservedQuantity = Math.min(quantity, oldQuantity);
            const preservedSegments = [];
            let preserveLeft = preservedQuantity;
            for (const segment of oldSegments) {
                const keep = Math.min(preserveLeft, segment.quantity);
                if (keep > 0) {
                    preservedSegments.push({
                        quantity: keep,
                        transportCentsPerUnit: segment.transportCentsPerUnit
                    });
                    preserveLeft -= keep;
                }
                if (preserveLeft <= 0) break;
            }
            if (preserveLeft > 0) preservedSegments.length = 0;
            const consumedPreserved = preservedSegments.length
                ? takeUnits(preservedQuantity, preservedSegments)
                : [];
            if (consumedPreserved === null)
                return { valid: false, reason: 'transport-pool-conflict' };
            const additionalSegments = takeUnits(quantity - preservedQuantity);
            if (!additionalSegments) return { valid: false, reason: 'transport-pool-conflict' };
            const combined = [...(consumedPreserved || []), ...additionalSegments];
            const grouped = new Map();
            combined.forEach((segment) => {
                grouped.set(
                    segment.transportCentsPerUnit,
                    (grouped.get(segment.transportCentsPerUnit) || 0) + segment.quantity
                );
            });
            const segments = [...grouped.entries()]
                .sort(([rateA], [rateB]) => rateA - rateB)
                .map(([transportCentsPerUnit, segmentQuantity]) => ({
                    quantity: segmentQuantity,
                    transportCentsPerUnit
                }));
            result.push({
                itemUid,
                totalCents: segments.reduce(
                    (sum, segment) => sum + segment.quantity * segment.transportCentsPerUnit,
                    0
                ),
                segments
            });
            continue;
        }

        let remainingQuantity = sourceQuantity;
        let remainingCents = Number(source.totalCents) || 0;
        const takeFraction = (takeQuantity, fixedCents = null) => {
            if (takeQuantity < 0 || takeQuantity > remainingQuantity) return null;
            const cents =
                fixedCents == null
                    ? takeQuantity >= remainingQuantity
                        ? remainingCents
                        : Math.floor((remainingCents * takeQuantity) / remainingQuantity)
                    : fixedCents;
            if (cents < 0 || cents > remainingCents) return null;
            remainingQuantity -= takeQuantity;
            remainingCents -= cents;
            return cents;
        };
        for (const other of orderedOthers) {
            const otherItem = (other.items || []).find((item) => item.uid === itemUid);
            if (!otherItem) continue;
            const otherQuantity = Number(otherItem.orderedQuantity ?? otherItem.quantity) || 0;
            if (otherQuantity <= 0) continue;
            const saved = (other.transportAllocation?.items || []).find(
                (entry) => entry.itemUid === itemUid
            );
            const consumed = takeFraction(
                otherQuantity,
                Number.isInteger(saved?.totalCents) ? saved.totalCents : null
            );
            if (consumed == null) return { valid: false, reason: 'transport-pool-conflict' };
        }

        const oldEntry = currentAllocationByUid.get(itemUid);
        const oldQuantity = currentQuantityByUid.get(itemUid) || 0;
        const preservedQuantity = Math.min(quantity, oldQuantity);
        const oldCents = Number(oldEntry?.totalCents) || 0;
        const preservedCents =
            oldQuantity > 0
                ? preservedQuantity >= oldQuantity
                    ? oldCents
                    : Math.floor((oldCents * preservedQuantity) / oldQuantity)
                : 0;
        if (takeFraction(preservedQuantity, preservedCents) == null)
            return { valid: false, reason: 'transport-pool-conflict' };
        const additionalQuantity = quantity - preservedQuantity;
        const additionalCents = takeFraction(additionalQuantity);
        if (additionalCents == null) return { valid: false, reason: 'transport-pool-conflict' };
        result.push({ itemUid, totalCents: preservedCents + additionalCents });
    }

    return {
        valid: true,
        allocation: { version: 1, items: result },
        transportCost: result.reduce((sum, item) => sum + item.totalCents, 0) / 100
    };
}

function getCurrentRuryTransportAllocation(items, totalCost) {
    const order =
        window.orderEditMode && typeof window.getCurrentRuryOrder === 'function'
            ? window.getCurrentRuryOrder()
            : null;
    if (!order) {
        return currentRuryTransportSeparate
            ? { version: 1, items: [] }
            : calculateTransportAllocation(items, totalCost);
    }
    if (order.transportSeparate) return { version: 1, items: [] };
    if (order.transportAllocation?.version === 1) {
        const savedOrderCost = Number(order.transportCost);
        return projectTransportAllocation(
            items,
            order.transportAllocation,
            Number.isFinite(savedOrderCost) ? savedOrderCost : totalCost
        );
    }

    const snapshot = order.originalSnapshot || {};
    const sourceItems = snapshot.transportSourceItems || snapshot.items || [];
    const sourceCost =
        Number(snapshot.transportCost) ||
        withOfferTransportFlags(snapshot, () => getRuryTransportCount(sourceItems)) *
            ((Number(snapshot.transportKm) || 0) * (Number(snapshot.transportRate) || 0));
    const sourceAllocation = projectTransportAllocation(
        sourceItems,
        snapshot.transportAllocation,
        sourceCost
    );
    const projection = allocateRuryOrderTransport(
        items,
        sourceItems,
        sourceAllocation,
        typeof ordersRury !== 'undefined' ? ordersRury : [],
        order
    );
    return projection.valid ? projection.allocation : { version: 1, items: [] };
}

/** Samodzielny pomocnik dla kontekstów zapisu/eksportu (bez DOM) */
function calculateTransportDistributionStandalone(items, costPerTrip) {
    return calculateTransportDistribution(items, costPerTrip);
}

/**
 * Wykonuje fn z flagami transportu danej oferty (tryb + osobna pozycja),
 * odtwarzając poprzedni runtime po zakończeniu. Do wydruków/eksportów,
 * gdzie liczona oferta nie musi być aktualnie otwarta.
 */
function withOfferTransportFlags(offer, fn) {
    const savedMode = currentRuryTransportMode;
    const savedSeparate = currentRuryTransportSeparate;
    if (offer) {
        if (offer.transportMode) currentRuryTransportMode = offer.transportMode;
        currentRuryTransportSeparate = !!offer.transportSeparate;
    }
    try {
        return fn();
    } finally {
        currentRuryTransportMode = savedMode;
        currentRuryTransportSeparate = savedSeparate;
    }
}

/* ===== PODSUMOWANIE OFERTY ===== */

/**
 * Przelicza całą ofertę i aktualizuje sekcje UI: produkty, transport, RAZEM netto/VAT/brutto.
 *
 * Składniki sumy RAZEM Netto:
 *   totalProductsNetto = Σ (priceAfterDiscount × quantity)            ← per pozycja
 *   totalTransportCost = totalTransports (po konsolidacji) × costPerTrip
 *   finalTotalNetto    = totalProductsNetto + totalTransportCost
 *   totalVat (23%)     = finalTotalNetto × 0.23
 *   totalBrutto        = finalTotalNetto + totalVat
 *
 * Efekty uboczne: renderuje breakdown transportu, zakładkę Oferta, sync tabeli kroku 5.
 */
function updateOfferSummary() {
    let totalProductsNetto = 0;
    let totalZabezpieczenie = 0;
    const costPerTrip = getCostPerTrip();
    const activeItems = getActiveItemsArray();

    activeItems.forEach((item) => {
        const basePriceAfterDiscount = item.unitPrice * (1 - item.discount / 100);
        const pehdCost = item.pehdCostPerUnit || 0;
        const surcharge = item.surcharge || 0;
        const priceAfterDiscount = _moneyRoundTransport(
            basePriceAfterDiscount + pehdCost + surcharge
        );
        const itemTotal = _moneyRoundTransport(priceAfterDiscount * item.quantity);
        if (item.productId && item.productId.startsWith('ZT-')) {
            totalZabezpieczenie += itemTotal;
        } else {
            totalProductsNetto += itemTotal;
        }
    });

    // Oblicz transporty dla zestawienia
    const transportResult = calculateTransports(activeItems);
    const importedTransport = window.isRuryTransportSeparate.getImported();
    const displayTransports = importedTransport
        ? importedTransport.count
        : typeof getRuryTransportCount === 'function'
          ? getRuryTransportCount(activeItems)
          : transportResult.totalTransports;
    const totalTransportCostCalc = _moneyRoundTransport(
        importedTransport ? importedTransport.cost : displayTransports * costPerTrip
    );
    const finalTotalNetto = _moneyRoundTransport(
        totalProductsNetto + totalTransportCostCalc + totalZabezpieczenie
    );
    // VAT liczony od zaokrąglonej sumy netto; brutto = netto + zaokrąglony VAT.
    const totalVat = _moneyRoundTransport(finalTotalNetto * 0.23);
    const totalBrutto = _moneyRoundTransport(finalTotalNetto + totalVat);

    const elProducts = document.getElementById('sum-netto-products');
    if (elProducts) elProducts.textContent = fmt(totalProductsNetto) + ' PLN';

    const elTransport = document.getElementById('sum-transport-cost');
    if (elTransport) {
        elTransport.innerHTML = `<i data-lucide="truck" class="icon-md"></i> ${fmt(totalTransportCostCalc)} PLN`;
        if (window.lucide) window.lucide.createIcons({ root: elTransport.parentElement });
    }

    const elTransportCount = document.getElementById('rury-transport-count');
    if (elTransportCount)
        elTransportCount.textContent =
            typeof formatTransportCount === 'function'
                ? formatTransportCount(displayTransports, currentRuryTransportMode)
                : displayTransports;

    const elTransportRate = document.getElementById('rury-transport-rate');
    if (elTransportRate)
        elTransportRate.textContent = importedTransport ? '—' : fmt(costPerTrip) + ' PLN';

    const elZabezpieczenie = document.getElementById('sum-zabezpieczenie');
    if (elZabezpieczenie) elZabezpieczenie.textContent = fmt(totalZabezpieczenie) + ' PLN';

    const elTotalNetto = document.getElementById('sum-total-netto');
    if (elTotalNetto) elTotalNetto.textContent = fmt(finalTotalNetto) + ' PLN';

    const elBrutto = document.getElementById('sum-brutto-details');
    if (elBrutto) elBrutto.innerHTML = `Brutto z VAT: <strong>${fmt(totalBrutto)} PLN</strong>`;

    // Renderuj zestawienie transportu
    renderTransportBreakdown(transportResult, costPerTrip);

    // Renderuj nową zakładkę Oferta
    if (typeof renderOfferSummaryTab === 'function') renderOfferSummaryTab();

    // Synchronizuj tabelę w kroku 5 (Zamówienie) — kopiuje z #offer-items-body do #order-items-body
    if (typeof updateRuryOrderSummary === 'function') {
        const order =
            window.orderEditMode && typeof getCurrentRuryOrder === 'function'
                ? getCurrentRuryOrder()
                : null;
        updateRuryOrderSummary(order);
    }
}

/* ===== KALKULACJA KURSÓW ===== */

/**
 * Liczy liczbę kursów transportu z bin-packing konsolidacją.
 *
 * MAX_TRANSPORT_WEIGHT = 24000 kg/kurs (stała na górze pliku).
 *
 * Per pozycja (po mapowaniu produktu):
 *   maxByWeight = floor(24000 / currentWeight)
 *   maxByCount  = product.transport   (limit z cennika)  lub maxByWeight
 *   maxPerTransport = min(maxByWeight, maxByCount)
 *   fullTransports  = floor(quantity / maxPerTransport)
 *   remainder       = quantity %  maxPerTransport
 *   dedicatedTransports = fullTransports + (remainder > 0 ? 1 : 0)
 *
 * Konsolidacja partials (bin-packing, sort malejąco po wadze):
 *   Jeśli 2+ pozycje mają remainder > 0, pakuje je do wspólnych kursów
 *   dopóki sumaryczna waga ≤ 24000. Oszczędność = Σ (group.length - 1).
 *
 * totalTransports = Σ dedicatedTransports - saved
 *
 * Filtruje autoAdded (uszczelki/zt) i pozycje z weight <= 0.
 *
 * @returns {{ lines: Array, totalTransports: number, saved: number, consolidated: Array }}
 *   lines[i] = { productId, name, quantity, weightPerPiece, totalWeight,
 *                maxPerTransport, fullTransports, remainder, dedicatedTransports }
 */
function calculateTransports(items) {
    // Mapuj pozycje do obliczeń z najnowszymi danymi z cennika
    const mappedItems = items.map((i) => {
        let baseId = i.productId;
        if (i.isPehd) {
            if (i.productId.startsWith('PEHD-3MM')) baseId = 'PEHD-3MM';
            if (i.productId.startsWith('PEHD-4MM')) baseId = 'PEHD-4MM';
        }
        const product = getRuryProductById(baseId);
        return {
            ...i,
            currentWeight: i.customLengthM ? i.weight : product ? product.weight : i.weight || 0,
            currentTransport: i.customLengthM
                ? i.transport
                : product
                  ? product.transport
                  : i.transport || 0
        };
    });

    // Filtruj pozycje wymagające transportu (rury z wagą > 0, nie uszczelki)
    const transportItems = mappedItems.filter(
        (i) => i.currentWeight && i.currentWeight > 0 && i.quantity > 0 && !i.autoAdded
    );
    if (transportItems.length === 0)
        return { lines: [], totalTransports: 0, saved: 0, consolidated: [] };

    const lines = [];
    const partials = []; // pozostałość z ostatniego transportu każdego produktu

    transportItems.forEach((item) => {
        const maxByWeight = Math.floor(MAX_TRANSPORT_WEIGHT / item.currentWeight);
        const maxByCount = item.currentTransport || maxByWeight;
        const maxPerTransport = Math.min(maxByWeight, maxByCount);
        if (maxPerTransport <= 0) return;

        const fullTransports = Math.floor(item.quantity / maxPerTransport);
        const remainder = item.quantity % maxPerTransport;
        const totalForItem = fullTransports + (remainder > 0 ? 1 : 0);

        const line = {
            productId: item.productId,
            name: item.name,
            quantity: item.quantity,
            weightPerPiece: item.currentWeight,
            totalWeight: item.currentWeight * item.quantity,
            maxPerTransport,
            fullTransports,
            remainder,
            dedicatedTransports: totalForItem
        };
        lines.push(line);

        // Śledź częściowe transporty do konsolidacji
        if (remainder > 0) {
            partials.push({
                productId: item.productId,
                name: item.name,
                pieces: remainder,
                weight: remainder * item.currentWeight,
                maxPerTransport
            });
        }
    });

    const totalDedicated = lines.reduce((s, l) => s + l.dedicatedTransports, 0);

    // Deleguj bin-packing do współdzielonej funkcji
    const tripItems = partials.map((p) => ({ weight: p.weight, transport: 0, quantity: 1 }));
    const tripsResult = calculateTransportTrips(tripItems);
    const saved = tripsResult.saved;

    return {
        lines,
        totalTransports: totalDedicated - saved,
        saved,
        consolidated: []
    };
}

/* ===== RENDEROWANIE ZESTAWIENIA TRANSPORTU ===== */

function renderTransportBreakdown(result, costPerTrip) {
    const container = document.getElementById('transport-breakdown');
    if (result.lines.length === 0) {
        container.innerHTML = '';
        return;
    }

    const totalDedicated = result.lines.reduce((s, l) => s + l.dedicatedTransports, 0);
    const displayTransports =
        typeof getRuryTransportCount === 'function'
            ? getRuryTransportCount(getActiveItemsArray() || [])
            : result.totalTransports;
    const totalTransportCost = displayTransports * costPerTrip;
    const totalWeight = result.lines.reduce((s, l) => s + l.totalWeight, 0);

    let html = `<div class="cat-header" style="cursor:pointer; display:flex; justify-content:space-between; align-items:center; user-select:none;" data-csp="toggleTransportBreakdown" data-csp-args="[]">
    <div><i data-lucide="truck"></i> Kalkulacja transportu <span class="cat-count">(max ${fmtInt(MAX_TRANSPORT_WEIGHT)} kg / transport)</span></div>
    <span id="transport-toggle-icon">${window.isTransportBreakdownExpanded ? '<i data-lucide="chevron-up"></i>' : '<i data-lucide="chevron-down"></i>'}</span>
  </div>`;
    html += `<div id="transport-breakdown-content" style="display:${window.isTransportBreakdownExpanded ? 'block' : 'none'}; margin-top:0.5rem;">`;
    html += `<div class="table-wrap"><table><thead><tr>
      <th scope="col">Produkt</th><th scope="col" class="text-right">Ilość</th><th scope="col" class="text-right">Waga/szt</th>
      <th scope="col" class="text-right">Łączna waga</th><th scope="col" class="text-right">Max/transport</th>
      <th scope="col" class="text-right">Transporty</th>
      ${costPerTrip > 0 ? '<th scope="col" class="text-right">Udział wagi</th><th scope="col" class="text-right">Transport/szt.</th>' : ''}
    </tr></thead><tbody>`;
    // Sort lines: by diameter (smallest to largest), egg-shaped ("jajowe") always last
    const sortedLines = [...result.lines].sort((a, b) => {
        const aJaj = a.name.toUpperCase().includes('JAJOW');
        const bJaj = b.name.toUpperCase().includes('JAJOW');
        if (aJaj !== bJaj) return aJaj ? 1 : -1;
        const dA = getProductDiameter(a.productId) || 99999;
        const dB = getProductDiameter(b.productId) || 99999;
        return dA - dB;
    });

    sortedLines.forEach((l) => {
        const weightShare = totalWeight > 0 ? l.totalWeight / totalWeight : 0;
        const itemTransportCost = weightShare * totalTransportCost;
        const perUnit = l.quantity > 0 ? itemTransportCost / l.quantity : 0;
        html += `<tr>
      <td style="max-width:250px">${escapeHtml(l.name)}</td>
      <td class="text-right">${l.quantity} szt.</td>
      <td class="text-right">${fmtInt(l.weightPerPiece)} kg</td>
      <td class="text-right">${fmtInt(l.totalWeight)} kg</td>
      <td class="text-right">${l.maxPerTransport} szt.</td>
      <td class="text-right" style="font-weight: var(--fw-semibold)">${l.dedicatedTransports}</td>
      ${
          costPerTrip > 0
              ? `<td class="text-right text-secondary" >${(weightShare * 100).toFixed(1)}%</td>
      <td class="text-right" style="color:var(--warn);font-weight: var(--fw-semibold)">${fmt(perUnit)} PLN</td>`
              : ''
      }
    </tr>`;
    });

    html += '</tbody></table></div>';

    if (result.saved > 0) {
        html += `<div style="margin-top:.5rem;padding:.5rem .8rem;background:rgba(var(--success-rgb), 0.1);border-radius: var(--radius-sm);font-size: var(--fs-md);color:var(--success)">
      <i data-lucide="check-circle-2"></i> Optymalizacja: połączono niepełne transporty, zaoszczędzono <strong>${result.saved}</strong> transportów
      (${totalDedicated} → ${result.totalTransports})</div>`;
    }

    if (costPerTrip > 0) {
        const km = Number(document.getElementById('transport-km')?.value) || 0;
        const rate = Number(document.getElementById('transport-rate')?.value) || 0;
        const countLabel =
            typeof formatTransportCount === 'function'
                ? formatTransportCount(displayTransports, currentRuryTransportMode)
                : displayTransports;
        html += `<div style="margin-top:.5rem;font-size: var(--fs-md);color:var(--text-secondary)">
      ${km} km × ${fmt(rate)} PLN/km = ${fmt(costPerTrip)} PLN/kurs × ${countLabel} kursów = <strong class="color-warn">${fmt(totalTransportCost)} PLN</strong> (rozdzielone proporcjonalnie na pozycje)</div>`;
    }

    html += `</div>`; // Close transport-breakdown-content

    container.innerHTML = html;
    if (window.lucide) lucide.createIcons();
}

/* ===== AKTUALIZACJA POLA "WYLICZONY TRANSPORT" W KARCIE BUDOWY ===== */
/* Reaguje na zmiany km/stawki/przedmiotów — analogicznie do studnie/offerManager.js */

window.updateTransportCostSummary = function () {
    const input = document.getElementById('step4-wyliczony-transport');
    if (!input) return;
    const costPerTrip = getCostPerTrip();
    const setValue = (count, totalCost) => {
        if (count > 0 && costPerTrip > 0) {
            const fmt = (v) =>
                v
                    .toFixed(2)
                    .replace('.', ',')
                    .replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
            const countLabel =
                typeof formatTransportCount === 'function'
                    ? formatTransportCount(count, 'fractional')
                    : count.toFixed(2).replace('.', ',');
            input.value = `${countLabel} x ${fmt(costPerTrip)} zł = ${fmt(totalCost)} zł`;
        } else {
            input.value = 'Brak transportu';
        }
    };

    // Tryb tworzenia zamówienia — transport proporcjonalny (jak studnie)
    if (typeof window.pendingOrderCreationData !== 'undefined' && window.pendingOrderCreationData) {
        const offer = window.pendingOrderCreationData.offer;
        const selItems = window.pendingOrderCreationData.selectedItems || [];
        const allItems = offer.items || [];
        let totalOfferWeight = 0,
            selectedWeight = 0;
        allItems.forEach((i) => {
            if (i.autoAdded || !i.weight || i.weight <= 0 || i.quantity <= 0) return;
            totalOfferWeight += i.weight * i.quantity;
        });
        selItems.forEach((i) => {
            const qty = i.orderedQuantity || i.quantity || 0;
            if (i.autoAdded || !i.weight || i.weight <= 0 || qty <= 0) return;
            selectedWeight += i.weight * qty;
        });
        if (totalOfferWeight > 0 && selectedWeight > 0 && costPerTrip > 0) {
            const offerMode = offer.transportMode || 'full';
            const totalCount =
                typeof calcTransportCount === 'function'
                    ? calcTransportCount(totalOfferWeight, offerMode)
                    : Math.ceil(totalOfferWeight / MAX_TRANSPORT_WEIGHT);
            const count = totalCount * (selectedWeight / totalOfferWeight);
            setValue(count, count * costPerTrip);
            return;
        }
    }

    // Fallback: bezpośrednio z aktywnych pozycji
    const activeItems = getActiveItemsArray() || [];
    let totalWeight = 0;
    activeItems.forEach((i) => {
        if (i.autoAdded || !i.weight || i.weight <= 0 || i.quantity <= 0) return;
        totalWeight += i.weight * i.quantity;
    });
    const count = totalWeight / MAX_TRANSPORT_WEIGHT;
    setValue(count, count * costPerTrip);
};

/* ===== MODAL EDYCJI TRANSPORTU (Kliknięcie w kartę "Koszt transportu" na dolnym pasku) ===== */

const ruryTransportSnapshot = { km: 0, rate: 0, mode: 'full', separate: false };

window.onRuryTransportFormChange = function () {
    const modal = document.getElementById('rury-transport-modal');
    if (modal && modal.style.display === 'flex') {
        const kmVal = document.getElementById('transport-km')?.value;
        const rateVal = document.getElementById('transport-rate')?.value;
        const modalKm = document.getElementById('rury-transport-modal-km');
        const modalRate = document.getElementById('rury-transport-modal-rate');
        if (modalKm && kmVal != null) modalKm.value = kmVal;
        if (modalRate && rateVal != null) modalRate.value = rateVal;
        if (typeof window.updateRuryModalTransportDetails === 'function')
            window.updateRuryModalTransportDetails();
    }
    if (
        typeof renderOfferItems === 'function' &&
        typeof getActiveItemsArray === 'function' &&
        getActiveItemsArray().length > 0
    ) {
        renderOfferItems();
    } else if (typeof updateOfferSummary === 'function') {
        updateOfferSummary();
    }
};

if (typeof document !== 'undefined' && typeof document.addEventListener === 'function') {
    document.addEventListener('input', (event) => {
        const target = event.target;
        if (!(target instanceof HTMLInputElement)) return;
        if (target.id !== 'transport-km' && target.id !== 'transport-rate') return;
        window.onRuryTransportFormChange();
    });
}

/**
 * Odtwarza overlay #rury-transport-modal, gdy go nie ma w DOM.
 * Brak modala = wyścig partiali (fetch jeszcze trwa) albo bare closeModal()
 * (modalCore, bez ID) usunął statyczny overlay przy zamykaniu innego okna.
 */
async function ensureRuryTransportModal() {
    if (document.getElementById('rury-transport-modal')) return true;
    try {
        const res = await fetch('partials/rury/transport-modal.html?v=' + Date.now());
        if (!res.ok) return false;
        const host = document.getElementById('partial-transport-modal') || document.body;
        host.innerHTML = await res.text();
        return !!document.getElementById('rury-transport-modal');
    } catch (_e) {
        return false;
    }
}

window.openRuryTransportPopup = function () {
    const modal = document.getElementById('rury-transport-modal');
    if (!modal) {
        console.warn('[transport] Brak #rury-transport-modal w DOM — odtwarzam z partialu.');
        ensureRuryTransportModal().then(function (ok) {
            if (ok) window.openRuryTransportPopup();
            else if (typeof showToast === 'function')
                showToast('Okno transportu w trakcie ładowania — kliknij ponownie', 'warning');
        });
        return;
    }
    const kmInput = document.getElementById('transport-km');
    const rateInput = document.getElementById('transport-rate');
    const modalKm = document.getElementById('rury-transport-modal-km');
    const modalRate = document.getElementById('rury-transport-modal-rate');

    ruryTransportSnapshot.km = parseFloat(kmInput?.value) || 0;
    ruryTransportSnapshot.rate = parseFloat(rateInput?.value) || 0;
    ruryTransportSnapshot.mode = currentRuryTransportMode || 'full';
    ruryTransportSnapshot.separate = !!currentRuryTransportSeparate;

    if (kmInput && modalKm) modalKm.value = kmInput.value || '0';
    if (rateInput && modalRate) modalRate.value = rateInput.value || '0';

    const titleEl = document.getElementById('rury-transport-modal-title');
    if (titleEl) {
        titleEl.textContent = window.orderEditMode
            ? 'Koszty Transportu (Edycja zamówienia)'
            : 'Koszty Transportu';
    }

    // Wczytaj tryb transportu z zamówienia lub oferty (window.orderEditMode to boolean)
    if (window.orderEditMode && typeof getCurrentRuryOrder === 'function') {
        const cur = getCurrentRuryOrder();
        if (cur && cur.transportMode) currentRuryTransportMode = cur.transportMode;
        if (cur && cur.transportSeparate != null)
            currentRuryTransportSeparate = !!cur.transportSeparate;
    } else if (
        typeof window.currentOfferData !== 'undefined' &&
        window.currentOfferData &&
        window.currentOfferData.transportMode
    ) {
        currentRuryTransportMode = window.currentOfferData.transportMode;
    }
    if (
        typeof window.currentOfferData !== 'undefined' &&
        window.currentOfferData &&
        window.currentOfferData.transportSeparate != null
    ) {
        currentRuryTransportSeparate = !!window.currentOfferData.transportSeparate;
    }
    const modeLabel = document.getElementById('rury-transport-mode-label');
    if (modeLabel)
        modeLabel.textContent = currentRuryTransportMode === 'full' ? 'Pełne' : 'Rzeczywiste';
    const separateLabel = document.getElementById('rury-transport-separate-label');
    if (separateLabel)
        separateLabel.textContent = currentRuryTransportSeparate
            ? 'Osobna pozycja'
            : 'W cenie elementów';

    // Pokaż NAJPIERW — błąd w podglądzie kalkulacji nie może blokować otwarcia.
    modal.style.display = 'flex';
    try {
        if (typeof window.updateRuryModalTransportDetails === 'function')
            window.updateRuryModalTransportDetails();
        if (typeof lucide !== 'undefined') lucide.createIcons();
    } catch (e) {
        console.warn('[transport] Błąd podglądu kalkulacji (modal otwarty):', e);
    }
};

window.handleRuryTransportCancel = async function () {
    const hide = () => {
        const m = document.getElementById('rury-transport-modal');
        if (m) m.style.display = 'none';
    };
    const modalKm = parseFloat(document.getElementById('rury-transport-modal-km')?.value) || 0;
    const modalRate = parseFloat(document.getElementById('rury-transport-modal-rate')?.value) || 0;
    const modeChanged =
        (currentRuryTransportMode || 'full') !== (ruryTransportSnapshot.mode || 'full');
    const separateChanged = !!currentRuryTransportSeparate !== !!ruryTransportSnapshot.separate;

    if (
        modalKm !== ruryTransportSnapshot.km ||
        modalRate !== ruryTransportSnapshot.rate ||
        modeChanged ||
        separateChanged
    ) {
        if (typeof window.appConfirm === 'function') {
            const confirmed = await window.appConfirm(
                `<div class="fs-3xl-eb">Wyjdź bez zapisywania</div>
                 <div class="fs-xl">Wprowadzono nowe współrzędne transportu. Czy wyjść z okna i odrzucić zmiany w formularzu?</div>`,
                { allowHtml: true, okText: 'Odrzuć zmiany', cancelText: 'Zostań' }
            );

            if (confirmed) {
                const kmInput = document.getElementById('transport-km');
                const rateInput = document.getElementById('transport-rate');
                if (kmInput) kmInput.value = String(ruryTransportSnapshot.km);
                if (rateInput) rateInput.value = String(ruryTransportSnapshot.rate);
                currentRuryTransportMode = ruryTransportSnapshot.mode || 'full';
                const modeLabel = document.getElementById('rury-transport-mode-label');
                if (modeLabel)
                    modeLabel.textContent =
                        currentRuryTransportMode === 'full' ? 'Pełne' : 'Rzeczywiste';
                currentRuryTransportSeparate = !!ruryTransportSnapshot.separate;
                const separateLabel = document.getElementById('rury-transport-separate-label');
                if (separateLabel)
                    separateLabel.textContent = currentRuryTransportSeparate
                        ? 'Osobna pozycja'
                        : 'W cenie elementów';
                if (typeof updateOfferSummary === 'function') updateOfferSummary();

                hide();
            }
        } else {
            hide();
        }
    } else {
        hide();
    }
};

window.handleRuryTransportSave = async function () {
    const hide = () => {
        const m = document.getElementById('rury-transport-modal');
        if (m) m.style.display = 'none';
    };
    const isOrderMode = !!window.orderEditMode;
    const confirmTitle = isOrderMode
        ? 'Zapisz nową konfigurację transportu'
        : 'Zapisz nową konfigurację transportu';
    const confirmBody = isOrderMode
        ? 'Czy na pewno chcesz zapisać te parametry przewozu do dokumentu zamówienia?'
        : 'Czy na pewno chcesz zapisać te parametry przewozu do dokumentu oferty?';
    const okText = isOrderMode ? 'Zapisz Zamówienie' : 'Zapisz Ofertę';

    const persist = async () => {
        if (typeof window.syncRuryTransportFromModal === 'function')
            window.syncRuryTransportFromModal();
        hide();
        if (isOrderMode) {
            if (typeof saveRuryOrder === 'function') await saveRuryOrder();
            else if (typeof saveOffer === 'function') await saveOffer();
        } else {
            if (typeof saveOffer === 'function') await saveOffer();
        }
    };

    if (typeof window.appConfirm === 'function') {
        const confirmed = await window.appConfirm(
            `<div class="fs-3xl-eb">${confirmTitle}</div>
             <div class="fs-xl">${confirmBody}</div>`,
            { allowHtml: true, okText, cancelText: 'Anuluj' }
        );

        if (confirmed) await persist();
    } else {
        await persist();
    }
};

window.syncRuryTransportFromModal = function () {
    const kmInput = document.getElementById('transport-km');
    const rateInput = document.getElementById('transport-rate');
    const modalKm = document.getElementById('rury-transport-modal-km');
    const modalRate = document.getElementById('rury-transport-modal-rate');

    if (kmInput && modalKm) kmInput.value = modalKm.value || '0';
    if (rateInput && modalRate) rateInput.value = modalRate.value || '0';

    if (typeof updateOfferSummary === 'function') updateOfferSummary();
    if (typeof window.updateRuryModalTransportDetails === 'function')
        window.updateRuryModalTransportDetails();

    if (
        typeof renderOfferItems === 'function' &&
        typeof getActiveItemsArray === 'function' &&
        getActiveItemsArray().length > 0
    ) {
        renderOfferItems();
    }

    if (window.orderEditMode && typeof renderOrderModeBanner === 'function') {
        const order = typeof getCurrentRuryOrder === 'function' ? getCurrentRuryOrder() : null;
        if (order) renderOrderModeBanner(order);
    }
};

window.updateRuryModalTransportDetails = function () {
    // Podgląd liczy z inputów modalu (gdy otwarty), nie z pól głównych — inaczej widać stare liczby.
    const modalOpen = document.getElementById('rury-transport-modal')?.style.display === 'flex';
    const kmSrc = modalOpen
        ? document.getElementById('rury-transport-modal-km')?.value
        : document.getElementById('transport-km')?.value;
    const rateSrc = modalOpen
        ? document.getElementById('rury-transport-modal-rate')?.value
        : document.getElementById('transport-rate')?.value;
    const km = Number(kmSrc) || 0;
    const rate = Number(rateSrc) || 0;
    const costPerTrip = km * rate;

    const activeItems =
        typeof getActiveItemsArray === 'function' ? getActiveItemsArray() || [] : [];
    const totalTransports =
        typeof getRuryTransportCount === 'function' ? getRuryTransportCount(activeItems) : 0;
    const totalTransportCost = costPerTrip * totalTransports;

    const fmt = (v) =>
        v
            .toFixed(2)
            .replace('.', ',')
            .replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
    const countLabel =
        typeof formatTransportCount === 'function'
            ? formatTransportCount(totalTransports, currentRuryTransportMode)
            : totalTransports;

    const tripsInfo = document.getElementById('rury-transport-modal-trips-info');
    if (tripsInfo)
        tripsInfo.innerHTML = `Łączna odległość: <strong>${km} km</strong> &bull; Stawka: <strong>${fmt(rate)} PLN/km</strong>`;

    const costPerTripEl = document.getElementById('rury-transport-modal-cost-per-trip');
    if (costPerTripEl) costPerTripEl.textContent = `${fmt(costPerTrip)} PLN`;

    const countEl = document.getElementById('rury-transport-modal-count');
    if (countEl) countEl.textContent = countLabel;

    const totalEl = document.getElementById('rury-transport-modal-total-cost');
    if (totalEl) totalEl.textContent = `${fmt(totalTransportCost)} PLN`;

    const totalValEl = document.getElementById('rury-transport-modal-total-val');
    if (totalValEl) {
        let productsNetto = 0;
        try {
            if (typeof getActiveItemsArray === 'function') {
                const items = getActiveItemsArray();
                productsNetto = items.reduce((s, it) => {
                    const c = Number(it.unitPrice) || 0;
                    const q = Number(it.quantity) || 0;
                    const r = Number(it.discount ?? it.rabat) || 0;
                    const pehdCost = Number(it.pehdCostPerUnit) || 0;
                    const surcharge = Number(it.surcharge) || 0;
                    const priceAfterDiscount = c * (1 - r / 100) + pehdCost + surcharge;
                    return s + priceAfterDiscount * q;
                }, 0);
            }
        } catch (err) {
            logger.error('transport', '[transport] Błąd kalkulacji wartości netto:', err);
            showToast('Błąd przeliczania wartości zamówienia', 'error');
            productsNetto = 0;
        }
        const finalNetto = productsNetto + totalTransportCost;
        totalValEl.textContent = `${fmt(finalNetto)} PLN`;
    }
};

window.toggleTransportBreakdown = function () {
    const expanded = !window.isTransportBreakdownExpanded;
    window.isTransportBreakdownExpanded = expanded;
    try {
        if (typeof collapseSet === 'function') collapseSet('rury-transport-breakdown', expanded);
    } catch (_e) {}
    const contents = document.querySelectorAll(
        '#transport-breakdown-content, #order-transport-breakdown-content'
    );
    const icons = document.querySelectorAll('#transport-toggle-icon, #order-transport-toggle-icon');
    contents.forEach((c) => {
        c.style.display = expanded ? 'block' : 'none';
    });
    icons.forEach((i) => {
        i.innerHTML = expanded
            ? '<i data-lucide="chevron-up"></i>'
            : '<i data-lucide="chevron-down"></i>';
    });
    if (window.lucide) window.lucide.createIcons();
};

window.toggleOrderTransportBreakdown = function () {
    window.toggleTransportBreakdown();
};

/* ===== Rejestracja globali ===== */
window.calculateTransportDistributionStandalone = calculateTransportDistributionStandalone;
window.calculateTransportAllocation = calculateTransportAllocation;
window.projectTransportAllocation = projectTransportAllocation;
window.isTransportAllocationValid = isTransportAllocationValid;
window.getTransportAllocationCents = getTransportAllocationCents;
window.getTransportSegments = getTransportSegments;
window.selectTransportAllocation = selectTransportAllocation;
window.getCurrentRuryTransportAllocation = getCurrentRuryTransportAllocation;
window.allocateRuryOrderTransport = allocateRuryOrderTransport;
window.withOfferTransportFlags = withOfferTransportFlags;
