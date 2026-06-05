/* ===== KALKULACJA TRANSPORTU (RURY) ===== */
/* Wydzielone z app.js — odpowiedzialność: kalkulacja kursów, kosztów, rozkładu wagowego */
/* Zależności: products (globalna), getProductDiameter() z productHelpers.js */
/* fmt(), fmtInt() z shared/formatters.js */

const MAX_TRANSPORT_WEIGHT = 24000; // kg — max ładowność transportu

/* ===== POMOCNICY KOSZTU TRANSPORTU NA JEDNOSTKĘ ===== */

function getCostPerTrip() {
    const km = Number(document.getElementById('transport-km')?.value) || 0;
    const rate = Number(document.getElementById('transport-rate')?.value) || 0;
    return km * rate;
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
 */
function calculateTransportDistribution(items, costPerTripOverride) {
    const costPerTrip = costPerTripOverride != null ? costPerTripOverride : getCostPerTrip();
    const distribution = {};
    if (costPerTrip <= 0) return distribution;

    const transportResult = calculateTransports(items);
    if (transportResult.totalTransports <= 0 || transportResult.lines.length === 0)
        return distribution;

    // Użyj liczby transportów po optymalizacji (post-optimization)
    const totalTransportCost = transportResult.totalTransports * costPerTrip;

    // Oblicz całkowitą wagę wszystkich transportowanych przedmiotów
    const totalWeight = transportResult.lines.reduce((s, l) => s + l.totalWeight, 0);
    if (totalWeight <= 0) return distribution;

    // Rozdziel proporcjonalnie według wagi
    transportResult.lines.forEach((line) => {
        const weightShare = line.totalWeight / totalWeight;
        const itemTransportCost = weightShare * totalTransportCost;
        distribution[line.productId] = itemTransportCost / line.quantity;
    });

    return distribution;
}

/** Samodzielny pomocnik dla kontekstów zapisu/eksportu (bez DOM) */
function calculateTransportDistributionStandalone(items, costPerTrip) {
    return calculateTransportDistribution(items, costPerTrip);
}

/* ===== PODSUMOWANIE OFERTY ===== */

function updateOfferSummary() {
    let totalProductsNetto = 0;
    const costPerTrip = getCostPerTrip();
    const activeItems = getActiveItemsArray();

    // Pre-calculate transport distribution
    const transportDist = calculateTransportDistribution(activeItems);

    activeItems.forEach((item) => {
        const basePriceAfterDiscount = item.unitPrice * (1 - item.discount / 100);
        const pehdCost = item.pehdCostPerUnit || 0;
        const surcharge = item.surcharge || 0;
        const priceAfterDiscount = basePriceAfterDiscount + pehdCost + surcharge;
        totalProductsNetto += priceAfterDiscount * item.quantity;
    });

    // Oblicz transporty dla zestawienia
    const transportResult = calculateTransports(activeItems);

    const totalTransportCostCalc = transportResult.totalTransports * costPerTrip;
    const finalTotalNetto = totalProductsNetto + totalTransportCostCalc;
    const totalVat = finalTotalNetto * 0.23;
    const totalBrutto = finalTotalNetto + totalVat;

    const elProducts = document.getElementById('sum-netto-products');
    if (elProducts) elProducts.textContent = fmt(totalProductsNetto) + ' PLN';

    const elTransport = document.getElementById('sum-transport-cost');
    if (elTransport) {
        elTransport.innerHTML = `<i data-lucide="truck" style="width: 20px; height: 20px;"></i> ${fmt(totalTransportCostCalc)} PLN`;
        if (window.lucide) window.lucide.createIcons({ root: elTransport.parentElement });
    }

    const elTransportCount = document.getElementById('rury-transport-count');
    if (elTransportCount) elTransportCount.textContent = transportResult.totalTransports;

    const elTransportRate = document.getElementById('rury-transport-rate');
    if (elTransportRate) elTransportRate.textContent = fmt(costPerTrip) + ' PLN';

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
        const order = (window.orderEditMode && typeof getCurrentRuryOrder === 'function')
            ? getCurrentRuryOrder()
            : null;
        updateRuryOrderSummary(order);
    }
}

/* ===== KALKULACJA KURSÓW ===== */

function calculateTransports(items) {
    // Mapuj pozycje do obliczeń z najnowszymi danymi z cennika
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

    // Filtruj pozycje wymagające transportu (rury z wagą > 0, nie uszczelki)
    const transportItems = mappedItems.filter(
        (i) => i.currentWeight && i.currentWeight > 0 && i.quantity > 0 && !i.autoAdded
    );
    if (transportItems.length === 0) return { lines: [], totalTransports: 0, consolidated: [] };

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

    // Spróbuj skonsolidować częściowe transporty
    let totalDedicated = lines.reduce((s, l) => s + l.dedicatedTransports, 0);
    let saved = 0;
    const consolidated = [];

    if (partials.length > 1) {
        // Sortuj częściowe transporty według wagi malejąco (bin-packing)
        partials.sort((a, b) => b.weight - a.weight);
        const used = new Set();

        for (let i = 0; i < partials.length; i++) {
            if (used.has(i)) continue;
            const group = [partials[i]];
            let groupWeight = partials[i].weight;
            used.add(i);

            for (let j = i + 1; j < partials.length; j++) {
                if (used.has(j)) continue;
                if (groupWeight + partials[j].weight <= MAX_TRANSPORT_WEIGHT) {
                    group.push(partials[j]);
                    groupWeight += partials[j].weight;
                    used.add(j);
                }
            }

            if (group.length > 1) {
                consolidated.push({ items: group, totalWeight: groupWeight });
                saved += group.length - 1; // oszczędność (n-1) transportów
            }
        }
    }

    return {
        lines,
        totalTransports: totalDedicated - saved,
        saved,
        consolidated
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
    const totalTransportCost = result.totalTransports * costPerTrip;
    const totalWeight = result.lines.reduce((s, l) => s + l.totalWeight, 0);

    let html = `<div class="cat-header" style="cursor:pointer; display:flex; justify-content:space-between; align-items:center; user-select:none;" onclick="toggleTransportBreakdown()">
    <div><i data-lucide="truck"></i> Kalkulacja transportu <span class="cat-count">(max ${fmtInt(MAX_TRANSPORT_WEIGHT)} kg / transport)</span></div>
    <span id="transport-toggle-icon">${isTransportBreakdownExpanded ? '<i data-lucide="chevron-up"></i>' : '<i data-lucide="chevron-down"></i>'}</span>
  </div>`;
    html += `<div id="transport-breakdown-content" style="display:${isTransportBreakdownExpanded ? 'block' : 'none'}; margin-top:0.5rem;">`;
    html += `<div class="table-wrap"><table>
    <thead><tr>
      <th>Produkt</th><th class="text-right">Ilość</th><th class="text-right">Waga/szt</th>
      <th class="text-right">Łączna waga</th><th class="text-right">Max/transport</th>
      <th class="text-right">Transporty</th>
      ${costPerTrip > 0 ? '<th class="text-right">Udział wagi</th><th class="text-right">Transport/szt.</th>' : ''}
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
      <td style="max-width:250px">${l.name}</td>
      <td class="text-right">${l.quantity} szt.</td>
      <td class="text-right">${fmtInt(l.weightPerPiece)} kg</td>
      <td class="text-right">${fmtInt(l.totalWeight)} kg</td>
      <td class="text-right">${l.maxPerTransport} szt.</td>
      <td class="text-right" style="font-weight:600">${l.dedicatedTransports}</td>
      ${
          costPerTrip > 0
              ? `<td class="text-right" style="color:var(--text-secondary)">${(weightShare * 100).toFixed(1)}%</td>
      <td class="text-right" style="color:var(--warn);font-weight:600">${fmt(perUnit)} PLN</td>`
              : ''
      }
    </tr>`;
    });

    html += '</tbody></table></div>';

    if (result.saved > 0) {
        html += `<div style="margin-top:.5rem;padding:.5rem .8rem;background:rgba(16,185,129,0.08);border-radius:8px;font-size:.82rem;color:var(--success)">
      <i data-lucide="check-circle-2"></i> Optymalizacja: połączono niepełne transporty, zaoszczędzono <strong>${result.saved}</strong> transportów
      (${totalDedicated} → ${result.totalTransports})</div>`;
    }

    if (costPerTrip > 0) {
        const km = Number(document.getElementById('transport-km')?.value) || 0;
        const rate = Number(document.getElementById('transport-rate')?.value) || 0;
        html += `<div style="margin-top:.5rem;font-size:.82rem;color:var(--text-secondary)">
      ${km} km × ${fmt(rate)} PLN/km = ${fmt(costPerTrip)} PLN/kurs × ${result.totalTransports} kursów = <strong style="color:var(--warn)">${fmt(totalTransportCost)} PLN</strong> (rozdzielone proporcjonalnie na pozycje)</div>`;
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
    const transportResult = calculateTransports(getActiveItemsArray() || []);
    const costPerTrip = getCostPerTrip();
    if (transportResult.totalTransports > 0 && costPerTrip > 0) {
        const fmt = (v) => v.toFixed(2).replace('.', ',').replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
        input.value = `${transportResult.totalTransports} x ${fmt(costPerTrip)} zł`;
    } else {
        input.value = 'Brak transportu';
    }
};

/* ===== MODAL EDYCJI TRANSPORTU (Kliknięcie w kartę "Koszt transportu" na dolnym pasku) ===== */

const ruryTransportSnapshot = { km: 0, rate: 0 };

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
    if (typeof renderOfferItems === 'function' && typeof getActiveItemsArray === 'function'
        && getActiveItemsArray().length > 0) {
        renderOfferItems();
    } else if (typeof updateOfferSummary === 'function') {
        updateOfferSummary();
    }
};

window.openRuryTransportPopup = function () {
    const kmInput = document.getElementById('transport-km');
    const rateInput = document.getElementById('transport-rate');
    const modalKm = document.getElementById('rury-transport-modal-km');
    const modalRate = document.getElementById('rury-transport-modal-rate');

    ruryTransportSnapshot.km = parseFloat(kmInput?.value) || 0;
    ruryTransportSnapshot.rate = parseFloat(rateInput?.value) || 0;

    if (kmInput && modalKm) modalKm.value = kmInput.value || 0;
    if (rateInput && modalRate) modalRate.value = rateInput.value || 0;

    const titleEl = document.getElementById('rury-transport-modal-title');
    if (titleEl) {
        titleEl.textContent = window.orderEditMode
            ? 'Koszty Transportu (Edycja zamówienia)'
            : 'Koszty Transportu';
    }

    if (typeof window.updateRuryModalTransportDetails === 'function') window.updateRuryModalTransportDetails();

    document.getElementById('rury-transport-modal').style.display = 'flex';
    if (typeof lucide !== 'undefined') lucide.createIcons();
};

window.handleRuryTransportCancel = async function () {
    const modalKm = parseFloat(document.getElementById('rury-transport-modal-km')?.value) || 0;
    const modalRate = parseFloat(document.getElementById('rury-transport-modal-rate')?.value) || 0;

    if (modalKm !== ruryTransportSnapshot.km || modalRate !== ruryTransportSnapshot.rate) {
        if (typeof window.appConfirm === 'function') {
            const confirmed = await window.appConfirm(
                `<div style="font-size: 1.1rem; font-weight: 800; text-transform: none; letter-spacing: normal;">Wyjdź bez zapisywania</div>
                 <div style="font-size: 0.9rem; line-height: 1.4; padding: 1rem 0;">Wprowadzono nowe współrzędne transportu. Czy wyjść z okna i odrzucić zmiany w formularzu?</div>`,
                { allowHtml: true, okText: 'Odrzuć zmiany', cancelText: 'Zostań' }
            );

            if (confirmed) {
                const kmInput = document.getElementById('transport-km');
                const rateInput = document.getElementById('transport-rate');
                if (kmInput) kmInput.value = ruryTransportSnapshot.km;
                if (rateInput) rateInput.value = ruryTransportSnapshot.rate;
                if (typeof updateOfferSummary === 'function') updateOfferSummary();

                document.getElementById('rury-transport-modal').style.display = 'none';
            }
        } else {
            document.getElementById('rury-transport-modal').style.display = 'none';
        }
    } else {
        document.getElementById('rury-transport-modal').style.display = 'none';
    }
};

window.handleRuryTransportSave = async function () {
    const isOrderMode = !!window.orderEditMode;
    const confirmTitle = isOrderMode
        ? 'Zapisz nową konfigurację transportu'
        : 'Zapisz nową konfigurację transportu';
    const confirmBody = isOrderMode
        ? 'Czy na pewno chcesz zapisać te parametry przewozu do dokumentu zamówienia?'
        : 'Czy na pewno chcesz zapisać te parametry przewozu do dokumentu oferty?';
    const okText = isOrderMode ? 'Zapisz Zamówienie' : 'Zapisz Ofertę';

    const persist = () => {
        document.getElementById('rury-transport-modal').style.display = 'none';
        if (isOrderMode) {
            if (typeof saveRuryOrder === 'function') saveRuryOrder();
            else if (typeof saveOffer === 'function') saveOffer();
        } else {
            if (typeof saveOffer === 'function') saveOffer();
        }
    };

    if (typeof window.appConfirm === 'function') {
        const confirmed = await window.appConfirm(
            `<div style="font-size: 1.1rem; font-weight: 800; text-transform: none; letter-spacing: normal;">${confirmTitle}</div>
             <div style="font-size: 0.9rem; line-height: 1.4; padding: 1rem 0;">${confirmBody}</div>`,
            { allowHtml: true, okText, cancelText: 'Anuluj' }
        );

        if (confirmed) persist();
    } else {
        persist();
    }
};

window.syncRuryTransportFromModal = function () {
    const kmInput = document.getElementById('transport-km');
    const rateInput = document.getElementById('transport-rate');
    const modalKm = document.getElementById('rury-transport-modal-km');
    const modalRate = document.getElementById('rury-transport-modal-rate');

    if (kmInput && modalKm) kmInput.value = modalKm.value || 0;
    if (rateInput && modalRate) rateInput.value = modalRate.value || 0;

    if (typeof updateOfferSummary === 'function') updateOfferSummary();
    if (typeof window.updateRuryModalTransportDetails === 'function') window.updateRuryModalTransportDetails();

    if (typeof renderOfferItems === 'function' && typeof getActiveItemsArray === 'function'
        && getActiveItemsArray().length > 0) {
        renderOfferItems();
    }
};

window.updateRuryModalTransportDetails = function () {
    const km = Number(document.getElementById('transport-km')?.value) || 0;
    const rate = Number(document.getElementById('transport-rate')?.value) || 0;
    const costPerTrip = km * rate;

    const transportResult = (typeof calculateTransports === 'function')
        ? calculateTransports(getActiveItemsArray() || [])
        : { totalTransports: 0 };
    const totalTransports = transportResult.totalTransports || 0;
    const totalTransportCost = costPerTrip * totalTransports;

    const fmt = (v) => v.toFixed(2).replace('.', ',').replace(/\B(?=(\d{3})+(?!\d))/g, ' ');

    const tripsInfo = document.getElementById('rury-transport-modal-trips-info');
    if (tripsInfo) tripsInfo.innerHTML = `Łączna odległość: <strong>${km} km</strong> &bull; Stawka: <strong>${fmt(rate)} PLN/km</strong>`;

    const costPerTripEl = document.getElementById('rury-transport-modal-cost-per-trip');
    if (costPerTripEl) costPerTripEl.textContent = `${fmt(costPerTrip)} PLN`;

    const countEl = document.getElementById('rury-transport-modal-count');
    if (countEl) countEl.textContent = totalTransports;

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
        } catch (_) {}
        const finalNetto = productsNetto + totalTransportCost;
        totalValEl.textContent = `${fmt(finalNetto)} PLN`;
    }
};
