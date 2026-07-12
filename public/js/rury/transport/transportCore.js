// @ts-check
/* ===== KALKULACJA TRANSPORTU (RURY) — FUNKCJE OBLICZENIOWE ===== */
/* Wydzielone z transport.js */
/* Zależności: products (globalna), getProductDiameter() z productHelpers.js */
/* fmt(), fmtInt() z shared/formatters.js */
/* renderTransportBreakdown z transportUI.js */

const MAX_TRANSPORT_WEIGHT = 24000;

let currentRuryTransportMode = 'full';

window.toggleRuryTransportMode = function () {
    currentRuryTransportMode = currentRuryTransportMode === 'full' ? 'fractional' : 'full';
    const label = document.getElementById('rury-transport-mode-label');
    if (label) label.textContent = currentRuryTransportMode === 'full' ? 'Pełne' : 'Rzeczywiste';
    if (typeof window.updateRuryModalTransportDetails === 'function')
        window.updateRuryModalTransportDetails();
    if (typeof updateOfferSummary === 'function') updateOfferSummary();
};

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

function getCostPerTrip() {
    const km = Number(document.getElementById('transport-km')?.value) || 0;
    const rate = Number(document.getElementById('transport-rate')?.value) || 0;
    return km * rate;
}

function calculateTransportDistribution(items, costPerTripOverride) {
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
            distribution[line.productId] = itemTransportCost / line.quantity;
        });
    } else {
        if (transportResult.totalTransports <= 0) return distribution;
        totalTransportCost = transportResult.totalTransports * costPerTrip;
        totalWeight = transportResult.lines.reduce((s, l) => s + l.totalWeight, 0);
        if (totalWeight <= 0) return distribution;

        transportResult.lines.forEach((line) => {
            const weightShare = line.totalWeight / totalWeight;
            const itemTransportCost = weightShare * totalTransportCost;
            distribution[line.productId] = itemTransportCost / line.quantity;
        });
    }

    return distribution;
}

function calculateTransportDistributionStandalone(items, costPerTrip) {
    return calculateTransportDistribution(items, costPerTrip);
}

function updateOfferSummary() {
    let totalProductsNetto = 0;
    let totalZabezpieczenie = 0;
    const costPerTrip = getCostPerTrip();
    const activeItems = getActiveItemsArray();

    const transportDist = calculateTransportDistribution(activeItems);

    activeItems.forEach((item) => {
        const basePriceAfterDiscount = item.unitPrice * (1 - item.discount / 100);
        const pehdCost = item.pehdCostPerUnit || 0;
        const surcharge = item.surcharge || 0;
        const priceAfterDiscount = basePriceAfterDiscount + pehdCost + surcharge;
        const itemTotal = priceAfterDiscount * item.quantity;
        if (item.productId && item.productId.startsWith('ZT-')) {
            totalZabezpieczenie += itemTotal;
        } else {
            totalProductsNetto += itemTotal;
        }
    });

    const transportResult = calculateTransports(activeItems);
    const displayTransports =
        typeof getRuryTransportCount === 'function'
            ? getRuryTransportCount(activeItems)
            : transportResult.totalTransports;

    const totalTransportCostCalc = displayTransports * costPerTrip;
    const finalTotalNetto = totalProductsNetto + totalTransportCostCalc + totalZabezpieczenie;
    const totalVat = finalTotalNetto * 0.23;
    const totalBrutto = finalTotalNetto + totalVat;

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
    if (elTransportRate) elTransportRate.textContent = fmt(costPerTrip) + ' PLN';

    const elZabezpieczenie = document.getElementById('sum-zabezpieczenie');
    if (elZabezpieczenie) elZabezpieczenie.textContent = fmt(totalZabezpieczenie) + ' PLN';

    const elTotalNetto = document.getElementById('sum-total-netto');
    if (elTotalNetto) elTotalNetto.textContent = fmt(finalTotalNetto) + ' PLN';

    const elBrutto = document.getElementById('sum-brutto-details');
    if (elBrutto) elBrutto.innerHTML = `Brutto z VAT: <strong>${fmt(totalBrutto)} PLN</strong>`;

    renderTransportBreakdown(transportResult, costPerTrip);

    if (typeof renderOfferSummaryTab === 'function') renderOfferSummaryTab();

    if (typeof updateRuryOrderSummary === 'function') {
        const order =
            window.orderEditMode && typeof getCurrentRuryOrder === 'function'
                ? getCurrentRuryOrder()
                : null;
        updateRuryOrderSummary(order);
    }
}

function calculateTransports(items) {
    const mappedItems = items.map((i) => {
        let baseId = i.productId;
        if (i.isPehd) {
            if (i.productId.startsWith('PEHD-3MM')) baseId = 'PEHD-3MM';
            if (i.productId.startsWith('PEHD-4MM')) baseId = 'PEHD-4MM';
        }
        const product = products.find((p) => p.id === baseId);
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

    const transportItems = mappedItems.filter(
        (i) => i.currentWeight && i.currentWeight > 0 && i.quantity > 0 && !i.autoAdded
    );
    if (transportItems.length === 0)
        return { lines: [], totalTransports: 0, saved: 0, consolidated: [] };

    const lines = [];
    const partials = [];

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
