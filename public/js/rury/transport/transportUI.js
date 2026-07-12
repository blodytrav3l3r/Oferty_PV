// @ts-check
/* ===== KALKULACJA TRANSPORTU (RURY) — UI I MODAL ===== */
/* Wydzielone z transport.js */
/* Zależności: products (globalna), getProductDiameter() z productHelpers.js */
/* getActiveItemsArray, getCurrentRuryOrder z orderManagerCore.js */
/* calculateTransports, getRuryTransportCount, getCostPerTrip, currentRuryTransportMode z transportCore.js */
/* fmt(), fmtInt() z shared/formatters.js */

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

    let html = `<div class="cat-header" data-action="toggleTransportBreakdown" style="cursor:pointer; display:flex; justify-content:space-between; align-items:center; user-select:none;">
    <div><i data-lucide="truck"></i> Kalkulacja transportu <span class="cat-count">(max ${fmtInt(MAX_TRANSPORT_WEIGHT)} kg / transport)</span></div>
    <span id="transport-toggle-icon">${window.isTransportBreakdownExpanded ? '<i data-lucide="chevron-up"></i>' : '<i data-lucide="chevron-down"></i>'}</span>
  </div>`;
    html += `<div id="transport-breakdown-content" style="display:${window.isTransportBreakdownExpanded ? 'block' : 'none'}; margin-top:0.5rem;">`;
    html += `<div class="table-wrap"><table>
    <thead><tr>
      <th>Produkt</th><th class="text-right">Ilość</th><th class="text-right">Waga/szt</th>
      <th class="text-right">Łączna waga</th><th class="text-right">Max/transport</th>
      <th class="text-right">Transporty</th>
      ${costPerTrip > 0 ? '<th class="text-right">Udział wagi</th><th class="text-right">Transport/szt.</th>' : ''}
    </tr></thead><tbody>`;
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
        const countLabel =
            typeof formatTransportCount === 'function'
                ? formatTransportCount(displayTransports, currentRuryTransportMode)
                : displayTransports;
        html += `<div style="margin-top:.5rem;font-size:.82rem;color:var(--text-secondary)">
      ${km} km × ${fmt(rate)} PLN/km = ${fmt(costPerTrip)} PLN/kurs × ${countLabel} kursów = <strong style="color:var(--warn)">${fmt(totalTransportCost)} PLN</strong> (rozdzielone proporcjonalnie na pozycje)</div>`;
    }

    html += `</div>`;

    container.innerHTML = html;
    if (window.lucide) lucide.createIcons();
}

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

    if (typeof pendingOrderCreationData !== 'undefined' && pendingOrderCreationData) {
        const offer = pendingOrderCreationData.offer;
        const selItems = pendingOrderCreationData.selectedItems || [];
        const allItems = offer.items || [];
        let totalOfferWeight = 0,
            selectedWeight = 0;
        allItems.forEach((i) => {
            if (i.autoAdded || !i.weight || i.weight <= 0 || i.quantity <= 0) return;
            totalOfferWeight += i.weight * i.quantity;
        });
        selItems.forEach((i) => {
            if (i.autoAdded || !i.weight || i.weight <= 0 || i.quantity <= 0) return;
            selectedWeight += i.weight * i.quantity;
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

    const activeItems = getActiveItemsArray() || [];
    let totalWeight = 0;
    activeItems.forEach((i) => {
        if (i.autoAdded || !i.weight || i.weight <= 0 || i.quantity <= 0) return;
        totalWeight += i.weight * i.quantity;
    });
    const count = totalWeight / MAX_TRANSPORT_WEIGHT;
    setValue(count, count * costPerTrip);
};

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

window.openRuryTransportPopup = function () {
    const kmInput = document.getElementById('transport-km');
    const rateInput = document.getElementById('transport-rate');
    const modalKm = document.getElementById('rury-transport-modal-km');
    const modalRate = document.getElementById('rury-transport-modal-rate');

    ruryTransportSnapshot.km = parseFloat(kmInput?.value) || 0;
    ruryTransportSnapshot.rate = parseFloat(rateInput?.value) || 0;

    if (kmInput && modalKm) modalKm.value = kmInput.value || '0';
    if (rateInput && modalRate) modalRate.value = rateInput.value || '0';

    const titleEl = document.getElementById('rury-transport-modal-title');
    if (titleEl) {
        titleEl.textContent = window.orderEditMode
            ? 'Koszty Transportu (Edycja zamówienia)'
            : 'Koszty Transportu';
    }

    if (
        typeof window.orderEditMode !== 'undefined' &&
        window.orderEditMode &&
        window.orderEditMode.order
    ) {
        currentRuryTransportMode = window.orderEditMode.order.transportMode || 'fractional';
    } else if (typeof window.currentOfferData !== 'undefined' && window.currentOfferData) {
        currentRuryTransportMode = window.currentOfferData.transportMode || 'full';
    }
    const modeLabel = document.getElementById('rury-transport-mode-label');
    if (modeLabel)
        modeLabel.textContent = currentRuryTransportMode === 'full' ? 'Pełne' : 'Rzeczywiste';

    if (typeof window.updateRuryModalTransportDetails === 'function')
        window.updateRuryModalTransportDetails();

    const modal = document.getElementById('rury-transport-modal');
    if (modal) modal.style.display = 'flex';
    if (typeof lucide !== 'undefined') lucide.createIcons();
};

window.handleRuryTransportCancel = async function () {
    const hide = () => {
        const m = document.getElementById('rury-transport-modal');
        if (m) m.style.display = 'none';
    };
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
                if (kmInput) kmInput.value = String(ruryTransportSnapshot.km);
                if (rateInput) rateInput.value = String(ruryTransportSnapshot.rate);
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
            `<div style="font-size: 1.1rem; font-weight: 800; text-transform: none; letter-spacing: normal;">${confirmTitle}</div>
             <div style="font-size: 0.9rem; line-height: 1.4; padding: 1rem 0;">${confirmBody}</div>`,
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
    const km = Number(document.getElementById('transport-km')?.value) || 0;
    const rate = Number(document.getElementById('transport-rate')?.value) || 0;
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
        } catch (_) {}
        const finalNetto = productsNetto + totalTransportCost;
        totalValEl.textContent = `${fmt(finalNetto)} PLN`;
    }
};

window.toggleTransportBreakdown = function () {
    const expanded = !window.isTransportBreakdownExpanded;
    window.isTransportBreakdownExpanded = expanded;
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

if (typeof registerCspAction === 'function') {
    registerCspAction('toggleTransportBreakdown', window.toggleTransportBreakdown);
}

window.toggleOrderTransportBreakdown = function () {
    window.toggleTransportBreakdown();
};
