/* ===== TABELA PODSUMOWANIA OFERTY ===== */

/**
 * Wartosc transportu dla calego zestawu: kursy * km * stawka.
 * Ten sam wzor co calculateOfferTotals/pricingCalculator — SSoT wyswietlania.
 * Zwraca 0 gdy brak masy albo nieskonfigurowany transport.
 */
function calcSnapshotTransportTotal(weight, km, rate, mode) {
    const w = Number(weight) || 0;
    const k = Number(km) || 0;
    const r = Number(rate) || 0;
    if (w <= 0 || k <= 0 || r <= 0) return 0;
    const maxW =
        typeof MAX_TRANSPORT_WEIGHT !== 'undefined' && MAX_TRANSPORT_WEIGHT > 0
            ? MAX_TRANSPORT_WEIGHT
            : 24000;
    const trips =
        typeof calcTransportCount === 'function'
            ? calcTransportCount(w, mode)
            : Math.ceil(w / maxW);
    return trips * k * r;
}

/**
 * Udzial studni w transporcie proporcjonalnie do masy (jak wellsExport).
 */
function calcTransportShare(totalTransport, totalWeight, wellWeight) {
    const t = Number(totalTransport) || 0;
    const tw = Number(totalWeight) || 0;
    const ww = Number(wellWeight) || 0;
    if (t <= 0 || tw <= 0 || ww <= 0) return 0;
    return (t * ww) / tw;
}

function renderOfferSummaryTable(order, orderChanges, totals) {
    const wellChanges = (orderChanges && orderChanges.wells) || {};
    const showOrderSelection = !orderEditMode;
    const orderedWellIds =
        showOrderSelection && typeof getOrderedWellIds === 'function'
            ? getOrderedWellIds(editingOfferIdStudnie)
            : new Set();
    const showPriceComparison = orderEditMode && order && order.originalSnapshot;
    const separateTransport =
        typeof isTransportSeparateRow === 'function' ? isTransportSeparateRow(order) : false;

    let html = `<div class="table-wrap"><table class="w-100">
      <thead>
        <tr>
          ${showOrderSelection ? '<th scope="col" style="width:4%; min-width:40px; text-align:center;"><input type="checkbox" id="select-all-wells-for-order" onchange="toggleAllWellsForOrder(this.checked)" class="cursor-icon-16"></th>' : ''}
          <th scope="col" style="width:1%; min-width:30px; text-align:center; white-space:nowrap;">Lp.</th>
          <th scope="col" style="width:1%; min-width:20px;"></th> <!-- Expand icon -->
          <th scope="col" class="w-100" style="text-align:left;">Nazwa studni</th>
          <th scope="col" style="width:1%; min-width:80px; text-align:right; white-space:nowrap; padding:0.5rem 0.5rem;">Cechy</th>
          <th scope="col" style="width:1%; min-width:70px; text-align:right; white-space:nowrap; padding:0.5rem 0.5rem;">Status</th>
          <th scope="col" style="width:1%; min-width:30px; text-align:right; white-space:nowrap; padding:0.5rem 0.5rem;" title="Błędy konfiguracji studni">Błąd</th>
          <th scope="col" style="width:1%; min-width:60px; text-align:right; white-space:nowrap; padding:0.5rem 0.75rem;">DN</th>
          ${showPriceComparison ? '<th scope="col" style="width:1%; min-width:110px; text-align:right; white-space:nowrap;">Cena z oferty</th>' : ''}
          <th scope="col" style="width:1%; min-width:110px; text-align:right; white-space:nowrap;">${showPriceComparison ? 'Cena zamówienia' : 'Cena'}</th>
          ${showPriceComparison ? '<th scope="col" class="th-r-90">Różnica</th>' : ''}
          <th scope="col" class="th-r-90">Akcje</th>
        </tr>
      </thead>
      <tbody>`;

    let runningTotalPrice = 0;
    let runningTotalWeight = 0;
    const dnGroups = {};

    const sortedWells = wells
        .map((well, originalIndex) => ({ well, originalIndex }))
        .sort((a, b) => {
            const dnA = a.well.dn === 'styczna' ? Infinity : parseInt(a.well.dn) || 0;
            const dnB = b.well.dn === 'styczna' ? Infinity : parseInt(b.well.dn) || 0;
            return dnA - dnB;
        });

    // Faza 1, #3+#7: lookup oryginału po ID + cena porównywalna (bez transportu).
    // Ta sama definicja ceny co badge (calcComparableWellPrice). Detekcja zmian
    // operuje na cenach BEZ transportu; transport doklejany jest do OBU kolumn
    // wyswietlanych (Cena z oferty i Cena zamówienia), wiec Różnica tez go widzi.
    let origLookup = null;
    let origTransportTotal = 0;
    let origWeightTotal = 0;
    const origWeightById = new Map();
    if (showPriceComparison && order) {
        const snap = order.originalSnapshot;
        const slimWellsArr =
            !Array.isArray(snap) && Array.isArray(snap.slimWells) ? snap.slimWells : null;
        const originalWells = slimWellsArr || (Array.isArray(snap) ? snap : snap.wells || []);
        const byId = new Map();
        originalWells.forEach((w) => {
            const id = w && w.id != null && String(w.id) !== '' ? String(w.id) : null;
            if (id !== null && !byId.has(id)) byId.set(id, w);
        });
        origLookup = {
            slim: !!slimWellsArr,
            list: originalWells,
            byId,
            discounts: Array.isArray(snap) ? null : snap.wellDiscounts || null
        };
        // Transport snapshotu (nie biezacy): udzial wagowy per studnia,
        // zeby "Cena z oferty" zgadzala sie z widokiem oferty (SA/ZS/000043/2026).
        if (!Array.isArray(snap)) {
            const origKm = parseFloat(snap.transportKm) || 0;
            const origRate = parseFloat(snap.transportRate) || 0;
            const origMode =
                typeof normalizeTransportMode === 'function'
                    ? normalizeTransportMode(snap.transportMode)
                    : snap.transportMode;
            originalWells.forEach((w) => {
                let ww = 0;
                if (slimWellsArr) {
                    ww = Number(w.weight) || 0;
                } else {
                    try {
                        ww = typeof calcWellStats === 'function' ? calcWellStats(w).weight || 0 : 0;
                    } catch (_e) {
                        ww = 0;
                    }
                }
                origWeightTotal += ww;
                const wid = w && w.id != null && String(w.id) !== '' ? String(w.id) : null;
                if (wid !== null && !origWeightById.has(wid)) origWeightById.set(wid, ww);
            });
            origTransportTotal = calcSnapshotTransportTotal(
                origWeightTotal,
                origKm,
                origRate,
                origMode
            );
        }
    }

    sortedWells.forEach(({ well, originalIndex }, displayIndex) => {
        const stats = calcWellStats(well);
        const wellTransportCost =
            totals.globalWeight > 0
                ? totals.totalTransportCost * (stats.weight / totals.globalWeight)
                : 0;
        // Tryb zamowienia: zamrozony udzial zamiast proporcji na zywo.
        // Osobna pozycja: udzial 0, transport idzie wierszem TR-STUDNIE w stopce.
        const frozenShare =
            showPriceComparison &&
            well &&
            well.frozenTransportCost != null &&
            isFinite(Number(well.frozenTransportCost))
                ? Number(well.frozenTransportCost)
                : null;
        const share = separateTransport ? 0 : frozenShare != null ? frozenShare : wellTransportCost;
        stats.price += share;

        const comparable =
            typeof calcComparableWellPrice === 'function'
                ? calcComparableWellPrice(well)
                : stats.price;
        // Cena zamowienia z transportem (jak widok oferty); porownanie
        // w tej samej definicji po obu stronach.
        const comparableIncl = comparable + share;
        runningTotalPrice += stats.price;
        runningTotalWeight += stats.weight;

        const dnKey = well.dn || '—';
        if (!dnGroups[dnKey])
            dnGroups[dnKey] = {
                count: 0,
                sumPrice: 0,
                sumHeight: 0,
                sumOfferPrice: 0,
                sumComparable: 0
            };
        dnGroups[dnKey].count++;
        dnGroups[dnKey].sumPrice += stats.price;
        dnGroups[dnKey].sumHeight += stats.height;
        dnGroups[dnKey].sumComparable += comparableIncl;

        let offerPrice = null;
        if (origLookup) {
            const wellId =
                well && well.id != null && String(well.id) !== '' ? String(well.id) : null;
            const origWell =
                (wellId !== null && origLookup.byId.get(wellId)) ||
                (wellId === null ? origLookup.list[originalIndex] : undefined);
            if (origWell) {
                let offerBase = 0;
                let origW = 0;
                if (origLookup.slim) {
                    // P1: gotowa cena ze snapshotu, bez calcWellStats.
                    offerBase = origWell.price || 0;
                    origW =
                        (wellId !== null && origWeightById.has(wellId)
                            ? origWeightById.get(wellId)
                            : origWell.weight) || 0;
                } else {
                    const currentGlobalDiscounts =
                        typeof wellDiscounts !== 'undefined' ? structuredClone(wellDiscounts) : {};
                    try {
                        if (origLookup.discounts && typeof wellDiscounts !== 'undefined') {
                            window.wellDiscounts = origLookup.discounts;
                        }
                        offerBase = calcComparableWellPrice(origWell);
                        try {
                            origW =
                                typeof calcWellStats === 'function'
                                    ? calcWellStats(origWell).weight || 0
                                    : 0;
                        } catch (_e2) {
                            origW = 0;
                        }
                    } finally {
                        if (origLookup.discounts && typeof wellDiscounts !== 'undefined') {
                            window.wellDiscounts = currentGlobalDiscounts;
                        }
                    }
                }
                // Cena z oferty Z transportem: zamrozony udzial ze snapshotu,
                // fallback do proporcji dla starych snapshotow bez pola transport.
                // Osobna pozycja: sama cena bez transportu (wiersz TR-STUDNIE w stopce).
                const snapShare =
                    origLookup.slim &&
                    origWell.transport != null &&
                    isFinite(Number(origWell.transport))
                        ? Number(origWell.transport)
                        : calcTransportShare(origTransportTotal, origWeightTotal, origW);
                offerPrice = separateTransport ? offerBase : offerBase + snapShare;
                dnGroups[dnKey].sumOfferPrice += offerPrice;
            }
        }

        html += renderWellHeaderRow(
            well,
            originalIndex,
            stats,
            wellChanges[originalIndex],
            orderedWellIds.has(well.id),
            showOrderSelection,
            displayIndex + 1,
            offerPrice,
            showPriceComparison,
            comparableIncl
        );
        html += renderWellDetailsRow(
            well,
            originalIndex,
            wellChanges[originalIndex],
            share,
            getOfferColumnsCount(showOrderSelection, showPriceComparison)
        );
    });

    const theoreticalTransport = (totals && totals.totalTransportCost) || 0;
    let transportInfo = null;
    // Wiersz transportu tylko jako osobna pozycja: przy cenie wliczonej koszt
    // siedzi w cenach studni, więc brak wiersza "Transport bez rozładunku".
    if (showPriceComparison) {
        if (separateTransport) {
            transportInfo = {
                origTotal: origTransportTotal,
                sumFrozen: theoreticalTransport,
                theoretical: theoreticalTransport
            };
        }
    } else if (separateTransport && theoreticalTransport > 0) {
        transportInfo = {
            separate: true,
            total: theoreticalTransport,
            trips: (totals && totals.totalTransports) || 0,
            perTrip: (totals && totals.transportCostPerTrip) || 0
        };
    }
    html += renderOfferSummaryFooter(
        wells.length,
        runningTotalWeight,
        runningTotalPrice,
        showOrderSelection,
        dnGroups,
        showPriceComparison,
        transportInfo,
        separateTransport
    );
    html += '</tbody></table></div>';
    return html;
}

function renderOfferSummaryFooter(
    count,
    weight,
    price,
    showOrderSelection,
    dnGroups,
    showPriceComparison,
    transportInfo,
    separateTransport
) {
    let baseColspan = 7;
    if (showOrderSelection) baseColspan += 1;

    let html = '<tfoot>';

    if (dnGroups && Object.keys(dnGroups).length > 0) {
        const sortedDnKeys = Object.keys(dnGroups).sort((a, b) => {
            const dnA = a === 'styczna' ? Infinity : parseInt(a) || 0;
            const dnB = b === 'styczna' ? Infinity : parseInt(b) || 0;
            return dnA - dnB;
        });

        sortedDnKeys.forEach((dn) => {
            const g = dnGroups[dn];
            const avgHeight = g.sumHeight / g.count;

            let priceDiffCell = '';
            let offerPriceCell = '';
            if (showPriceComparison) {
                if (g.sumOfferPrice > 0) {
                    const priceDiff = g.sumComparable - g.sumOfferPrice;
                    const diffColor =
                        priceDiff > 0
                            ? 'var(--success-hover)'
                            : priceDiff < 0
                              ? 'var(--danger-hover)'
                              : 'var(--text-muted)';
                    const diffSign = priceDiff > 0 ? '+' : '';
                    offerPriceCell = `<td class="text-right" style="font-size: var(--fs-md); color:var(--text-secondary); white-space:nowrap; padding:0.5rem 0.75rem;">${fmt(g.sumOfferPrice)} PLN</td>`;
                    priceDiffCell = `<td class="text-right" style="font-size: var(--fs-md); color:${diffColor}; white-space:nowrap; padding:0.5rem 0.75rem;">${diffSign}${fmt(priceDiff)} PLN</td>`;
                } else {
                    offerPriceCell = '<td class="text-right pad-sm" ></td>';
                    priceDiffCell = '<td class="text-right pad-sm" ></td>';
                }
            }

            html += `<tr class="border-top-white05">
              <td colspan="${baseColspan}" style="padding:0.6rem 0.5rem; font-size: var(--fs-lg); color:var(--text-secondary); white-space:nowrap;">Podsumowanie DN${dn} — ${g.count} szt.</td>
              ${offerPriceCell}
              <td class="text-right" style="font-size: var(--fs-lg); color:var(--success); font-weight: var(--fw-bold); white-space:nowrap; padding:0.5rem 0.75rem;">${fmt(g.sumPrice)} PLN</td>
              ${priceDiffCell}
              <td class="text-right" style="font-size: var(--fs-md); color:var(--text-muted); white-space:nowrap; padding:0.5rem 0.75rem;">śr. ${fmtInt(avgHeight)} mm</td>
            </tr>`;
        });
    }

    let totalOfferPrice = 0;
    let totalComparable = 0;
    let totalPriceDiffCell = '';
    let totalOfferPriceCell = '';
    // Osobna pozycja: RAZEM obejmuje transport (osobno od cen studni).
    const separateOrderTransport =
        separateTransport && showPriceComparison && transportInfo
            ? Number(transportInfo.sumFrozen) || 0
            : 0;
    const separateOfferTransport =
        separateTransport && showPriceComparison && transportInfo
            ? Number(transportInfo.origTotal) || 0
            : 0;
    if (showPriceComparison) {
        Object.values(dnGroups).forEach((g) => {
            totalOfferPrice += g.sumOfferPrice || 0;
            totalComparable += g.sumComparable || 0;
        });
        totalOfferPrice += separateOfferTransport;
        totalComparable += separateOrderTransport;
        if (totalOfferPrice > 0) {
            const totalDiff = totalComparable - totalOfferPrice;
            const diffColor =
                totalDiff > 0
                    ? 'var(--success-hover)'
                    : totalDiff < 0
                      ? 'var(--danger-hover)'
                      : 'var(--text-muted)';
            const diffSign = totalDiff > 0 ? '+' : '';
            totalOfferPriceCell = `<td class="text-right" style="font-weight: var(--fw-bold); font-size: var(--fs-lg); color:var(--text-secondary); white-space:nowrap; padding:0.5rem 0.75rem;">${fmt(totalOfferPrice)} PLN</td>`;
            totalPriceDiffCell = `<td class="text-right" style="font-weight: var(--fw-bold); font-size: var(--fs-lg); color:${diffColor}; white-space:nowrap; padding:0.5rem 0.75rem;">${diffSign}${fmt(totalDiff)} PLN</td>`;
        } else {
            totalOfferPriceCell = '<td class="text-right pad-sm" ></td>';
            totalPriceDiffCell = '<td class="text-right pad-sm" ></td>';
        }
    }

    // Osobna pozycja w widoku oferty: wiersz transportu przed RAZEM.
    if (transportInfo && transportInfo.separate) {
        const sepTotal = Number(transportInfo.total) || 0;
        const sepTrips = Number(transportInfo.trips) || 0;
        const sepPerTrip = Number(transportInfo.perTrip) || 0;
        price += sepTotal;
        html += `<tr id="offer-transport-row">
          <td colspan="${baseColspan}" style="font-size: var(--fs-md); color:var(--text-muted); padding:0.5rem 0.5rem; white-space:nowrap;" title="${escapeHtmlAttr(String(sepTrips))} × ${fmt(sepPerTrip)} PLN/kurs">Transport bez rozładunku</td>
          <td class="text-right" style="font-size: var(--fs-md); font-weight: var(--fw-bold); color:var(--success); white-space:nowrap; padding:0.5rem 0.75rem;">${fmt(sepTotal)} PLN</td>
          <td class="text-right pad-sm"></td>
        </tr>`;
    }

    html += `<tr class="border-top-glass2" id="offer-total-row">
          <td colspan="${baseColspan}" style="font-weight: var(--fw-bold); font-size: var(--fs-xl); color:var(--text-primary); padding:1rem 0.5rem; white-space:nowrap;">RAZEM (${count} studni)</td>
          ${totalOfferPriceCell}
          <td class="text-right" style="font-weight: var(--fw-extrabold); font-size: var(--fs-2xl); color:var(--success); white-space:nowrap; padding:0.5rem 0.75rem;">${fmt(price)} PLN</td>
          ${totalPriceDiffCell}
          <td class="text-right" style="font-weight: var(--fw-bold); font-size: var(--fs-lg); color:var(--text-muted); white-space:nowrap; padding:0.5rem 0.75rem;">${fmtInt(weight)} kg</td>
        </tr>`;
    html += '</tfoot>';
    return html;
}

/* ===== Rejestracja globali ===== */
window.renderOfferSummaryTable = renderOfferSummaryTable;
window.calcSnapshotTransportTotal = calcSnapshotTransportTotal;
window.calcTransportShare = calcTransportShare;
