// @ts-check
/* ===== PODSUMOWANIE OFERTY — RENDEROWANIE ===== */

function toggleWellExpansion(index, event) {
    if (event) event.stopPropagation();
    if (expandedWellIndices.has(index)) {
        expandedWellIndices.delete(index);
    } else {
        expandedWellIndices.add(index);
    }
    renderOfferSummary();
}

/**
 * Główna funkcja renderująca podsumowanie oferty.
 * Zrefaktoryzowana zgodnie z zasadami SRP i limitami długości funkcji.
 */
function renderOfferSummary() {
    const container = document.getElementById('offer-summary-body');
    if (!container) return;

    const order = orderEditMode ? getCurrentOfferOrder() : null;
    const orderChanges = orderEditMode && order ? getOrderChanges({ ...order, wells: wells }) : {};

    // Auto-generate offer notes
    generateOfferNotes(false);

    // Obliczenia globalne
    const totals = calculateOfferTotals();

    let html = '';
    // Baner statusu zamówienia i postęp
    html += renderOrderBanners(order, orderChanges);

    // Tabela zestawienia
    html += renderOfferSummaryTable(order, orderChanges, totals);

    container.innerHTML = html;

    // Inicjalizacja ikon Lucide tylko dla nowo wyrenderowanego kontenera (zapobiega miganiu całego ekranu)
    if (window.lucide) window.lucide.createIcons({ root: container });

    // Aktualizacja wskaźników zewnętrznych (stopka)
    updateOfferSummaryUI(totals);

    // Synchronizacja przycisku zapisu w podsumowaniu z trybem zamówienia
    const saveBtn = document.getElementById('btn-save-studnie-offer');
    const createOrderBtn = document.getElementById('btn-create-order-offer');

    if (saveBtn) {
        if (orderEditMode) {
            saveBtn.innerHTML = '<i data-lucide="save" aria-hidden="true"></i> Zapisz zamówienie';
            saveBtn.onclick = () => {
                if (typeof saveCurrentOrder === 'function') saveCurrentOrder();
            };
            saveBtn.classList.remove('btn-primary');
            saveBtn.classList.add('btn-order-save');
            // Usuwamy ręczne style z poprzedniej iteracji, aby klasa przejęła kontrolę
            saveBtn.style.background = '';
            saveBtn.style.borderColor = '';

            // Ukryj przyciski ofertowe w trybie zamówienia
            if (createOrderBtn) createOrderBtn.style.display = 'none';
        } else {
            saveBtn.innerHTML = '<i data-lucide="save" aria-hidden="true"></i> Zapisz ofertę';
            saveBtn.onclick = () => {
                if (typeof saveOfferStudnie === 'function') saveOfferStudnie();
            };
            saveBtn.classList.remove('btn-primary');
            saveBtn.classList.add('btn-order-save');
            saveBtn.style.background = '';
            saveBtn.style.borderColor = '';

            // Pokaż przycisk "Utwórz zamówienie" w trybie oferty
            if (createOrderBtn) createOrderBtn.style.display = 'flex';
        }
        if (window.lucide) window.lucide.createIcons({ root: saveBtn });
    }
}
function generateOfferNotes(onlyIfEmpty = false) {
    const offerNotesField = document.getElementById('offer-tab-notes');
    if (!offerNotesField) return;

    if (onlyIfEmpty && offerNotesField.value.trim() !== '') {
        return;
    }

    let step1Notes = document.getElementById('offer-notes')?.value || '';
    const paramIndex = step1Notes.indexOf('Parametry techniczne:');
    if (paramIndex !== -1) {
        step1Notes = step1Notes.substring(0, paramIndex).trim();
    }
    const transportIndex = step1Notes.indexOf('Cena franco budowa bez rozładunku');
    if (transportIndex !== -1) {
        step1Notes = step1Notes.substring(0, transportIndex).trim();
    }

    const getActiveParamLabel = (param) => {
        const group = document.querySelector(`.param-group[data-param="${param}"]`);
        if (!group) return null;
        const btn = group.querySelector('button.param-tile.active');
        if (!btn) return null;
        let text = btn.textContent.replace(/<[^>]*>?/gm, '').trim();
        text = text.replace(/[\n\r]+/g, ' ').replace(/\s{2,}/g, ' ');
        return text;
    };

    const getParamLabel = (param, value) => {
        if (!value || value.toLowerCase() === 'brak') return null;
        const group = document.querySelector(`.param-group[data-param="${param}"]`);
        if (!group) return value;
        const btn = group.querySelector(`button.param-tile[data-val="${value}"]`);
        if (!btn) return value;
        let text = btn.textContent.replace(/<[^>]*>?/gm, '').trim();
        text = text.replace(/[\n\r]+/g, ' ').replace(/\s{2,}/g, ' ');
        return text;
    };

    const getParamSummary = (param, labelPrefix) => {
        if (!wells || wells.length === 0) {
            const activeVal = getActiveParamLabel(param);
            return activeVal && activeVal.toLowerCase() !== 'brak'
                ? `${labelPrefix}: ${activeVal}`
                : null;
        }

        const values = new Set();
        wells.forEach((well) => {
            const val = well[param];
            if (val && val !== 'brak') {
                const label = getParamLabel(param, val);
                if (label && label.toLowerCase() !== 'brak') {
                    values.add(label);
                }
            }
        });

        if (values.size === 0) return null;
        return `${labelPrefix}: ${Array.from(values).join(', ')}`;
    };

    const getMaterialSummary = () => {
        if (!wells || wells.length === 0) {
            const materialNadbudowy = getActiveParamLabel('nadbudowa') || 'Betonowa';
            const materialDennicy = getActiveParamLabel('dennicaMaterial') || materialNadbudowy;
            if (materialNadbudowy === materialDennicy) {
                return `Nadbudowa i Dennica: ${materialNadbudowy}`;
            } else {
                return `Nadbudowa: ${materialNadbudowy}, Dennica: ${materialDennicy}`;
            }
        }

        const nadbudowy = new Set();
        const dennice = new Set();

        wells.forEach((well) => {
            if (well.nadbudowa) {
                const label = getParamLabel('nadbudowa', well.nadbudowa);
                if (label) nadbudowy.add(label);
            }
            if (well.dennicaMaterial) {
                const label = getParamLabel('dennicaMaterial', well.dennicaMaterial);
                if (label) dennice.add(label);
            }
        });

        const nStr = Array.from(nadbudowy).filter(Boolean).join(', ') || 'Betonowa';
        const dStr = Array.from(dennice).filter(Boolean).join(', ') || nStr;

        if (nStr === dStr) {
            return `Nadbudowa i Dennica: ${nStr}`;
        } else {
            return `Nadbudowa: ${nStr}, Dennica: ${dStr}`;
        }
    };

    const getPEHDSummary = () => {
        if (!wells || wells.length === 0) {
            const wkladka = getActiveParamLabel('wkladka');
            return wkladka && wkladka.toLowerCase() !== 'brak' ? `Wkładka PEHD: ${wkladka}` : null;
        }

        const PEHDTypes = new Set();
        wells.forEach((well) => {
            if (well.wkladkaDennica && well.wkladkaDennica !== 'brak')
                PEHDTypes.add(getParamLabel('wkladka', well.wkladkaDennica));
            if (well.wkladkaNadbudowa && well.wkladkaNadbudowa !== 'brak')
                PEHDTypes.add(getParamLabel('wkladka', well.wkladkaNadbudowa));
            if (well.wkladkaZwienczenie && well.wkladkaZwienczenie !== 'brak')
                PEHDTypes.add(getParamLabel('wkladka', well.wkladkaZwienczenie));
        });

        if (PEHDTypes.size === 0) return null;
        return `Wkładka PEHD: ${Array.from(PEHDTypes).join(', ')}`;
    };

    const getNosnoscKorpusSummary = () => {
        if (!wells || wells.length === 0) {
            const klasaNosnosciK = getActiveParamLabel('klasaNosnosci_korpus');
            return klasaNosnosciK && !klasaNosnosciK.includes('D400')
                ? `Klasa nośności (Dennica + Nadbudowa): ${klasaNosnosciK}`
                : null;
        }
        const values = new Set();
        wells.forEach((well) => {
            if (well.klasaNosnosci_korpus && !well.klasaNosnosci_korpus.includes('D400')) {
                const label = getParamLabel('klasaNosnosci_korpus', well.klasaNosnosci_korpus);
                if (label) values.add(label);
            }
        });
        if (values.size === 0) return null;
        return `Klasa nośności (Dennica + Nadbudowa): ${Array.from(values).join(', ')}`;
    };

    const getNosnoscZwienczenieSummary = () => {
        if (!wells || wells.length === 0) {
            const klasaNosnosciZ = getActiveParamLabel('klasaNosnosci_zwienczenie');
            return klasaNosnosciZ && !klasaNosnosciZ.includes('D400')
                ? `Klasa nośności Zwieńczenie: ${klasaNosnosciZ}`
                : null;
        }
        const values = new Set();
        wells.forEach((well) => {
            if (
                well.klasaNosnosci_zwienczenie &&
                !well.klasaNosnosci_zwienczenie.includes('D400')
            ) {
                const label = getParamLabel(
                    'klasaNosnosci_zwienczenie',
                    well.klasaNosnosci_zwienczenie
                );
                if (label) values.add(label);
            }
        });
        if (values.size === 0) return null;
        return `Klasa nośności Zwieńczenie: ${Array.from(values).join(', ')}`;
    };

    const summaryParts = [];

    const matSum = getMaterialSummary();
    if (matSum) summaryParts.push(matSum);

    const betSum = getParamSummary('klasaBetonu', 'Klasa betonu');
    if (betSum) summaryParts.push(betSum);

    const pehdSum = getPEHDSummary();
    if (pehdSum) summaryParts.push(pehdSum);

    const chemSum = getParamSummary('agresjaChemiczna', 'Agresja chemiczna');
    if (chemSum) summaryParts.push(chemSum);

    const mrozSum = getParamSummary('agresjaMrozowa', 'Agresja mrozowa');
    if (mrozSum) summaryParts.push(mrozSum);

    const malWSum = getParamSummary('malowanieW', 'Malowanie wewnątrz');
    if (malWSum) summaryParts.push(malWSum);

    const malZSum = getParamSummary('malowanieZ', 'Malowanie zewnątrz');
    if (malZSum) summaryParts.push(malZSum);

    const kinSum = getParamSummary('kineta', 'Kineta');
    if (kinSum) summaryParts.push(kinSum);

    const stopSum = getParamSummary('stopnie', 'Rodzaj stopni');
    if (stopSum) summaryParts.push(stopSum);

    const uszczSum = getParamSummary('uszczelka', 'Uszczelka');
    if (uszczSum) summaryParts.push(uszczSum);

    const nosKSum = getNosnoscKorpusSummary();
    if (nosKSum) summaryParts.push(nosKSum);

    const nosZSum = getNosnoscZwienczenieSummary();
    if (nosZSum) summaryParts.push(nosZSum);

    // Zbieranie informacji o przejściach z faktycznych studni
    const przejsciaTypes = new Set();
    if (typeof wells !== 'undefined' && Array.isArray(wells)) {
        wells.forEach((well) => {
            if (well.przejscia && Array.isArray(well.przejscia)) {
                well.przejscia.forEach((pr) => {
                    const prProd =
                        typeof studnieProducts !== 'undefined'
                            ? studnieProducts.find((x) => x.id === pr.productId)
                            : null;
                    if (prProd) {
                        const name = prProd.category || prProd.name || '';
                        // Omijamy wiercenia
                        if (
                            name.toLowerCase().includes('wiercenie') ||
                            name.toLowerCase().includes('insitu')
                        )
                            return;

                        // Zostawiamy tylko rodzaj, omijając typowe rozmiary i zbędne słowa
                        const type = name
                            .replace(/DN\s*\d+/i, '')
                            .replace(/fi\s*\d+/i, '')
                            .trim();
                        if (type) {
                            przejsciaTypes.add(type);
                        }
                    }
                });
            }
        });
    }

    if (przejsciaTypes.size > 0) {
        const przejsciaArr = Array.from(przejsciaTypes).join(', ');
        summaryParts.push(`Przyłącza dostudzienne: ${przejsciaArr}`);
    }

    let generatedText = step1Notes ? step1Notes + '\n\n' : '';

    if (summaryParts.length > 0) {
        generatedText += 'Parametry techniczne: ' + summaryParts.join(', ') + '.';
    }

    if (generatedText) {
        generatedText += '\n';
    }
    generatedText += 'Cena franco budowa bez rozładunku przy dostawie pełnych transportów 24t.';

    offerNotesField.value = generatedText.trim();
}

function calculateOfferTotals() {
    let globalWeight = 0;
    wells.forEach((w) => (globalWeight += calcWellStats(w).weight));

    const transportKm = parseFloat(document.getElementById('transport-km')?.value) || 0;
    const transportRate = parseFloat(document.getElementById('transport-rate')?.value) || 0;

    let totalTransports = 0,
        transportCostPerTrip = 0,
        totalTransportCost = 0;
    if (transportKm > 0 && transportRate > 0) {
        transportCostPerTrip = transportKm * transportRate;
        if (
            typeof orderEditMode !== 'undefined' &&
            orderEditMode &&
            /** @type {any} */ (orderEditMode).order
        ) {
            const _order = /** @type {any} */ (orderEditMode).order;
            const _offer =
                typeof offersStudnie !== 'undefined' && offersStudnie
                    ? offersStudnie.find((o) => o.id === _order.offerId)
                    : null;
            const _offerWeight = _offer?.totalWeight || globalWeight;
            const _mode = _order.transportMode || currentTransportMode;
            const fullOfferCost =
                (typeof calcTransportCount === 'function'
                    ? calcTransportCount(_offerWeight, _mode)
                    : Math.ceil(_offerWeight / MAX_TRANSPORT_WEIGHT)) * transportCostPerTrip;
            totalTransportCost =
                _offerWeight > 0 ? fullOfferCost * (globalWeight / _offerWeight) : 0;
            totalTransports =
                transportCostPerTrip > 0 ? totalTransportCost / transportCostPerTrip : 0;
        } else {
            totalTransports =
                typeof calcTransportCount === 'function'
                    ? calcTransportCount(globalWeight, currentTransportMode)
                    : Math.ceil(globalWeight / MAX_TRANSPORT_WEIGHT);
            totalTransportCost = totalTransports * transportCostPerTrip;
        }
    }

    return { globalWeight, totalTransports, transportCostPerTrip, totalTransportCost };
}

function renderOrderBanners(order, orderChanges) {
    let html = '';
    const hasChanges = Object.keys(orderChanges).length > 0;

    if (order) {
        const changeCount = Object.keys(orderChanges).length;
        html += `<div style="display:flex; align-items:center; justify-content:space-between; padding:0.5rem 0.8rem; margin-bottom:0.5rem; background:${hasChanges ? 'rgba(var(--danger-rgb),0.1)' : 'rgba(var(--success-rgb),0.1)'}; border:1px solid ${hasChanges ? 'rgba(var(--danger-rgb),0.3)' : 'rgba(var(--success-rgb),0.3)'}; border-radius:8px;">
            <div style="display:flex; align-items:center; gap:0.4rem;">
                <span style="font-size:1.1rem;"><i data-lucide="package"></i></span>
                <span style="font-size:0.75rem; font-weight:700; color:${hasChanges ? 'var(--danger-hover)' : 'var(--success-hover)'};">ZAMÓWIENIE ${hasChanges ? '— ' + changeCount + ' studni zmienionych' : '— bez zmian'}</span>
            </div>
            <button class="btn btn-sm" style="background:rgba(var(--success-rgb),0.15); border:1px solid rgba(var(--success-rgb),0.3); color:var(--success-hover); font-size:0.65rem; padding:0.15rem 0.4rem;" onclick="orderEditMode ? saveCurrentOrder() : saveOrderStudnie()"><i data-lucide="package" aria-hidden="true"></i> Zapisz zamówienie</button>
        </div>`;
    }

    if (!orderEditMode && editingOfferIdStudnie && wells.length > 0) {
        html += renderPartialOrderProgress();
    }
    return html;
}

function renderPartialOrderProgress() {
    const progress =
        typeof getOfferOrderProgress === 'function'
            ? getOfferOrderProgress(editingOfferIdStudnie, wells)
            : { ordered: 0, total: wells.length, percent: 0 };
    const orderedIds =
        typeof getOrderedWellIds === 'function'
            ? getOrderedWellIds(editingOfferIdStudnie)
            : new Set();
    const availableCount = wells.filter((w) => !orderedIds.has(w.id)).length;

    if (progress.ordered === 0 && availableCount === wells.length) return '';

    const progressColor = progress.percent >= 100 ? 'var(--success-hover)' : 'var(--blue-hover)';
    return `<div style="display:flex; align-items:center; gap:0.6rem; padding:0.5rem 0.8rem; margin-bottom:0.5rem; background:rgba(var(--blue-rgb),0.08); border:1px solid rgba(var(--blue-rgb),0.2); border-radius:8px;">
        <div class="flex-1">
            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:0.3rem;">
                <span style="font-size:0.72rem; font-weight:700; color:var(--text-secondary);">
                    <i data-lucide="package" aria-hidden="true"></i> Postęp zamówień
                </span>
                <span style="font-size:0.72rem; font-weight:800; color:${progressColor};">
                    ${progress.ordered} / ${progress.total} studni (${progress.percent}%)
                </span>
            </div>
            <div style="height:6px; background:rgba(255,255,255,0.08); border-radius:3px; overflow:hidden;">
                <div style="height:100%; width:${progress.percent}%; background:${progressColor}; border-radius:3px; transition:width 0.3s ease;"></div>
            </div>
        </div>
    </div>`;
}

function renderOfferSummaryTable(order, orderChanges, totals) {
    const showOrderSelection = !orderEditMode;
    const orderedWellIds =
        showOrderSelection && typeof getOrderedWellIds === 'function'
            ? getOrderedWellIds(editingOfferIdStudnie)
            : new Set();
    const showPriceComparison = orderEditMode && order && order.originalSnapshot;

    let html = `<div class="table-wrap"><table style="width:100%;">
      <thead>
        <tr>
          ${showOrderSelection ? '<th style="width:4%; min-width:40px; text-align:center;"><input type="checkbox" id="select-all-wells-for-order" onchange="toggleAllWellsForOrder(this.checked)" style="cursor:pointer; width:16px; height:16px;"></th>' : ''}
          <th style="width:1%; min-width:30px; text-align:center; white-space:nowrap;">Lp.</th>
          <th style="width:1%; min-width:20px;"></th> <!-- Expand icon -->
          <th style="width:100%;">Nazwa studni</th>
          <th style="width:1%; min-width:70px; text-align:center; white-space:nowrap; padding:0.5rem 0.5rem;">Status</th>
          <th style="width:1%; min-width:60px; text-align:right; white-space:nowrap; padding:0.5rem 0.75rem;">DN</th>
          ${showPriceComparison ? '<th style="width:1%; min-width:110px; text-align:right; white-space:nowrap; padding:0.5rem 0.75rem;">Cena z oferty</th>' : ''}
          <th style="width:1%; min-width:110px; text-align:right; white-space:nowrap; padding:0.5rem 0.75rem;">${showPriceComparison ? 'Cena zamówienia' : 'Cena'}</th>
          ${showPriceComparison ? '<th style="width:1%; min-width:90px; text-align:right; white-space:nowrap; padding:0.5rem 0.75rem;">Różnica</th>' : ''}
          <th style="width:1%; min-width:90px; text-align:right; white-space:nowrap; padding:0.5rem 0.75rem;">Akcje</th>
        </tr>
      </thead>
      <tbody>`;

    let runningTotalPrice = 0;
    let runningTotalWeight = 0;
    const dnGroups = {};

    // Posortuj studnie po DN do wyświetlenia (zachowując oryginalne indexy)
    const sortedWells = wells
        .map((well, originalIndex) => ({ well, originalIndex }))
        .sort((a, b) => {
            const dnA = a.well.dn === 'styczna' ? Infinity : parseInt(a.well.dn) || 0;
            const dnB = b.well.dn === 'styczna' ? Infinity : parseInt(b.well.dn) || 0;
            return dnA - dnB;
        });

    // Oryginalny koszt transportu z migawki (dla porównania "Cena z oferty")
    let origTotalTransportCost = 0;
    let origTotalWeight = 0;
    if (showPriceComparison && order) {
        const snap = order.originalSnapshot;
        const origSnap = Array.isArray(snap) ? null : snap;
        const origWellsArr = Array.isArray(snap) ? snap : snap.wells || [];
        origWellsArr.forEach((w) => (origTotalWeight += calcWellStats(w).weight));
        if (origSnap) {
            const oKm = parseFloat(origSnap.transportKm) || 0;
            const oRate = parseFloat(origSnap.transportRate) || 0;
            const oMode = origSnap.transportMode || 'full';
            if (oKm > 0 && oRate > 0 && origTotalWeight > 0) {
                const origOffer =
                    typeof offersStudnie !== 'undefined' && offersStudnie
                        ? offersStudnie.find((o) => o.id === order.offerId)
                        : null;
                const origOfferWeight = origOffer?.totalWeight || origTotalWeight;
                const origCostPerTrip = oKm * oRate;
                const origFullOfferCost =
                    (typeof calcTransportCount === 'function'
                        ? calcTransportCount(origOfferWeight, oMode)
                        : Math.ceil(origOfferWeight / MAX_TRANSPORT_WEIGHT)) * origCostPerTrip;
                origTotalTransportCost =
                    origOfferWeight > 0
                        ? origFullOfferCost * (origTotalWeight / origOfferWeight)
                        : 0;
            }
        }
    }

    sortedWells.forEach(({ well, originalIndex }, displayIndex) => {
        const stats = calcWellStats(well);
        const wellTransportCost =
            totals.globalWeight > 0
                ? totals.totalTransportCost * (stats.weight / totals.globalWeight)
                : 0;
        stats.price += wellTransportCost;

        runningTotalPrice += stats.price;
        runningTotalWeight += stats.weight;

        const dnKey = well.dn || '—';
        if (!dnGroups[dnKey])
            dnGroups[dnKey] = { count: 0, sumPrice: 0, sumHeight: 0, sumOfferPrice: 0 };
        dnGroups[dnKey].count++;
        dnGroups[dnKey].sumPrice += stats.price;
        dnGroups[dnKey].sumHeight += stats.height;

        // Oblicz cenę z oferty (z originalSnapshot) dla porównania
        let offerPrice = null;
        if (showPriceComparison) {
            const snap = order.originalSnapshot;
            const originalWells = Array.isArray(snap) ? snap : snap.wells || [];
            const originalDiscounts = Array.isArray(snap) ? null : snap.wellDiscounts || null;

            if (originalWells[originalIndex]) {
                const origWell = originalWells[originalIndex];

                // Tymczasowo podmień rabaty globalne na te z migawki dla poprawnego wyliczenia ceny historycznej
                const currentGlobalDiscounts =
                    typeof wellDiscounts !== 'undefined' ? structuredClone(wellDiscounts) : {};
                if (originalDiscounts && typeof wellDiscounts !== 'undefined') {
                    window.wellDiscounts = originalDiscounts;
                }

                const origStats = calcWellStats(origWell);

                // Przywróć rabaty
                if (originalDiscounts && typeof wellDiscounts !== 'undefined') {
                    window.wellDiscounts = currentGlobalDiscounts;
                }

                const origTransportCost =
                    origTotalWeight > 0
                        ? origTotalTransportCost * (origStats.weight / origTotalWeight)
                        : 0;
                offerPrice = origStats.price + origTransportCost;
                dnGroups[dnKey].sumOfferPrice += offerPrice;
            }
        }

        html += renderWellHeaderRow(
            well,
            originalIndex,
            stats,
            orderChanges[originalIndex],
            orderedWellIds.has(well.id),
            showOrderSelection,
            displayIndex + 1,
            offerPrice,
            showPriceComparison
        );
        html += renderWellDetailsRow(
            well,
            originalIndex,
            orderChanges[originalIndex],
            wellTransportCost
        );
    });

    html += renderOfferSummaryFooter(
        wells.length,
        runningTotalWeight,
        runningTotalPrice,
        showOrderSelection,
        dnGroups,
        showPriceComparison
    );
    html += '</tbody></table></div>';
    return html;
}

function renderWellHeaderRow(
    well,
    i,
    stats,
    change,
    isOrdered,
    showOrderSelection,
    lp,
    offerPrice,
    showPriceComparison
) {
    const isExpanded = expandedWellIndices.has(i);
    const rowStyle = getWellRowStyle(change, isOrdered);
    const badges = getWellBadges(change, isOrdered, well);
    const displayLp = lp !== undefined ? lp : i + 1;

    let checkbox = '';
    if (showOrderSelection) {
        checkbox = isOrdered
            ? '<td class="text-center"><i data-lucide="package-check" style="width:16px; height:16px; color:var(--accent-text);"></i></td>'
            : `<td class="text-center" onclick="event.stopPropagation()"><input type="checkbox" class="well-order-checkbox" data-well-index="${i}" onchange="updateOrderSelectionCount()" style="cursor:pointer; width:16px; height:16px;"></td>`;
    }

    let offerPriceCell = '';
    let priceDiffCell = '';
    if (offerPrice !== null) {
        const priceDiff = stats.price - offerPrice;
        const diffColor =
            priceDiff > 0
                ? 'var(--success-hover)'
                : priceDiff < 0
                  ? 'var(--danger-hover)'
                  : 'var(--text-muted)';
        const diffSign = priceDiff > 0 ? '+' : '';
        offerPriceCell = `<td class="text-right" style="font-weight:600; color:var(--text-secondary); white-space:nowrap; padding:0.5rem 0.75rem;">${fmt(offerPrice)} PLN</td>`;
        priceDiffCell = `<td class="text-right" style="font-weight:700; color:${diffColor}; white-space:nowrap; padding:0.5rem 0.75rem;">${diffSign}${fmt(priceDiff)} PLN</td>`;
    } else if (showPriceComparison) {
        // Puste komórki dla zachowania wyrównania kolumn (studnia NOWA bez ceny z oferty)
        offerPriceCell = '<td class="text-right" class="pad-sm"></td>';
        priceDiffCell = '<td class="text-right" class="pad-sm"></td>';
    }

    return `<tr class="well-row-header" style="${rowStyle}" onclick="toggleWellExpansion(${i}, event)">
        ${checkbox}
        <td style="text-align:center; color:var(--text-muted); font-weight:600;">${displayLp}</td>
        <td style="text-align:center; color:var(--accent);"><i data-lucide="${isExpanded ? 'chevron-down' : 'chevron-right'}" style="width:16px; height:16px;"></i></td>
        <td style="font-weight:700; color:${well.doplata < 0 ? 'var(--danger)' : well.doplata > 0 ? 'var(--success)' : 'var(--text-primary)'};">${escapeHtml(well.name)}</td>
        <td style="text-align:center; white-space:nowrap; padding:0.5rem 0.5rem;">${badges}</td>
        <td style="text-align:right; font-weight:600; color:var(--text-secondary); white-space:nowrap; padding:0.5rem 0.75rem;">DN${well.dn}</td>
        ${offerPriceCell}
        <td class="text-right" style="font-weight:800; color:var(--success); white-space:nowrap; padding:0.5rem 0.75rem;">${fmt(stats.price)} PLN</td>
        ${priceDiffCell}
        <td class="text-right" onclick="event.stopPropagation()" style="white-space:nowrap; padding:0.5rem 0.75rem;">
            <button class="btn btn-sm" onclick="showSection('builder'); selectWell(${i})" title="Edytuj studnię" style="font-size:0.7rem; padding:0.25rem 0.6rem; display:inline-flex; align-items:center; gap:0.3rem;">
                <i data-lucide="edit-3" style="width:12px; height:12px;"></i> Edytuj
            </button>
        </td>
    </tr>`;
}

function getWellBadges(change, isOrdered, well) {
    let html = '';
    if (change) {
        html +=
            change.type === 'added'
                ? '<span style="font-size:0.55rem; padding:1px 5px; border-radius:3px; background:rgba(var(--success-rgb),0.2); color:var(--success-hover); font-weight:700; margin-left:0.3rem;"><i data-lucide="circle-check"></i> NOWA</span>'
                : '<span style="font-size:0.55rem; padding:1px 5px; border-radius:3px; background:rgba(var(--danger-rgb),0.2); color:var(--danger-hover); font-weight:700; margin-left:0.3rem;"><i data-lucide="circle-x"></i> ZMIENIONO</span>';
    }
    if (isOrdered && well) {
        const wellOrder =
            typeof getOrderForWellId === 'function'
                ? getOrderForWellId(well.id, editingOfferIdStudnie)
                : null;
        if (wellOrder && wellOrder.orderNumber) {
            html += `<span onclick="event.stopPropagation(); window.location.href='studnie.html?order=${wellOrder.id}'"
                title="Zamówienie ${wellOrder.orderNumber} — kliknij aby otworzyć"
                style="font-size:0.55rem; padding:1px 5px; border-radius:3px; background:rgba(var(--success-rgb),0.15); color:var(--success-hover); font-weight:800; margin-left:0.3rem; cursor:pointer; border:1px solid rgba(var(--success-rgb),0.4); display:inline-flex; align-items:center; gap:3px;">
                <i data-lucide="package" aria-hidden="true"></i> ${wellOrder.orderNumber}
            </span>`;
        } else {
            html +=
                '<span style="font-size:0.55rem; padding:1px 5px; border-radius:3px; background:rgba(var(--accent-rgb),0.2); color:var(--accent-text); font-weight:700; margin-left:0.3rem;"><i data-lucide="lock"></i> ZAMÓWIENIE</span>';
        }
    }
    return html;
}

function renderWellDetailsRow(well, i, change, wellTransportCost) {
    const isExpanded = expandedWellIndices.has(i);
    if (!isExpanded)
        return `<tr id="well-details-${i}" class="well-details-row hidden"><td colspan="12"></td></tr>`;

    const stats = calcWellStats(well);
    // Mapowanie dn na klucz rabatów (styczna -> styczne)
    const discountKey = well.dn === 'styczna' ? 'styczne' : well.dn;
    const activeDiscounts =
        typeof getWellActiveDiscounts === 'function' ? getWellActiveDiscounts(well) : wellDiscounts;
    const disc = activeDiscounts[discountKey] || { dennica: 0, nadbudowa: 0 };
    const nadbudowaMult = 1 - (disc.nadbudowa || 0) / 100;

    const detailsHtml = `<tr class="well-details-row"><td colspan="12">
        <div class="well-details-container">
            <div class="well-details-grid">
                <div class="well-detail-item">
                    <span class="well-detail-label">Masa całkowita</span>
                    <span class="well-detail-value">${fmtInt(stats.weight)} kg</span>
                </div>
                <div class="well-detail-item">
                    <span class="well-detail-label">Wysokość rz.</span>
                    <span class="well-detail-value">${fmtInt(stats.height)} mm</span>
                </div>
                <div class="well-detail-item">
                    <span class="well-detail-label">Pow. wewnętrzna</span>
                    <span class="well-detail-value">${fmt(stats.areaInt)} m²</span>
                </div>
                <div class="well-detail-item">
                    <span class="well-detail-label">Pow. zewnętrzna</span>
                    <span class="well-detail-value">${fmt(stats.areaExt)} m²</span>
                </div>
            </div>
            <div style="margin-top:0.8rem; border-top:1px solid rgba(255,255,255,0.05); padding-top:0.5rem;">
                <div style="font-size:0.65rem; text-transform:uppercase; color:var(--text-muted); font-weight:600; margin-bottom:0.3rem;">Konfiguracja elementów:</div>
                <table style="width:100%; font-size:0.75rem;">
                    ${renderWellComponentsList(well, wellTransportCost, disc, nadbudowaMult, change)}
                </table>
            </div>
        </div>
    </td></tr>`;

    return detailsHtml;
}

function renderWellComponentsList(well, wellTransportCost, disc, nadbudowaMult, change) {
    let html = '';
    const assignedPrzejscia = calculateAssignedPrzejscia(well);

    well.config.forEach((item, index) => {
        const p = studnieProducts.find((pr) => pr.id === item.productId);
        if (!p || p.componentType === 'kineta') return;

        const discStr = getDiscountStr(p, disc);
        const { totalLinePrice, totalLineWeight } = calculateLinePricing(
            well,
            p,
            item,
            wellTransportCost,
            disc,
            nadbudowaMult,
            assignedPrzejscia[index],
            index
        );

        let badgesHtml = '';
        const precoAlloc =
            typeof calculatePrecoAllocationForItem === 'function'
                ? calculatePrecoAllocationForItem(well, index)
                : null;
        if (
            precoAlloc &&
            precoAlloc.hasPreco &&
            (precoAlloc.isBottomMostDennica || precoAlloc.fraction > 0) &&
            !item.disablePreco
        ) {
            badgesHtml +=
                ' <span style="font-size:0.55rem; color:#f43f5e; border:1px solid rgba(244,63,94,0.4); padding:1px 4px; border-radius:4px; background:rgba(244,63,94,0.1); margin-left:4px; font-weight:700;">PRECO</span>';
        }

        let pehdType = null;
        if (['dennica', 'styczna'].includes(p.componentType)) pehdType = well.wkladkaDennica;
        else if (
            [
                'plyta',
                'plyta_redukcyjna',
                'plyta_nastudzienna',
                'stozek',
                'zwienczenie',
                'konus',
                'plyta_din',
                'plyta_najazdowa',
                'plyta_zamykajaca',
                'pierscien_odciazajacy'
            ].includes(p.componentType)
        )
            pehdType = well.wkladkaZwienczenie;
        else if (['krag', 'krag_ot', 'rura'].includes(p.componentType))
            pehdType = well.wkladkaNadbudowa;

        if (pehdType && pehdType !== 'brak' && p.doplataPEHD && !item.disablePehd) {
            badgesHtml +=
                ' <span style="font-size:0.55rem; color:#0ea5e9; border:1px solid rgba(14,165,233,0.4); padding:1px 4px; border-radius:4px; background:rgba(14,165,233,0.1); margin-left:4px; font-weight:700;">PEHD</span>';
        }

        if (
            well.nadbudowa === 'zelbetowa' &&
            (p.componentType === 'krag' || p.componentType === 'krag_ot')
        ) {
            badgesHtml +=
                ' <span style="font-size:0.55rem; color:var(--warn); border:1px solid rgba(var(--warn-rgb),0.4); padding:1px 4px; border-radius:4px; background:rgba(var(--warn-rgb),0.1); margin-left:4px; font-weight:700;">ŻELBET</span>';
        }
        if (
            (well.dennicaMaterial === 'zelbetowa' || well.material === 'zelbetowa') &&
            p.componentType === 'dennica'
        ) {
            badgesHtml +=
                ' <span style="font-size:0.55rem; color:var(--warn); border:1px solid rgba(var(--warn-rgb),0.4); padding:1px 4px; border-radius:4px; background:rgba(var(--warn-rgb),0.1); margin-left:4px; font-weight:700;">ŻELBET</span>';
        }
        if (
            well.stopnie === 'nierdzewna' &&
            (p.componentType === 'krag' ||
                p.componentType === 'krag_ot' ||
                p.componentType === 'konus')
        ) {
            badgesHtml +=
                ' <span style="font-size:0.55rem; color:#a855f7; border:1px solid rgba(168,85,247,0.4); padding:1px 4px; border-radius:4px; background:rgba(168,85,247,0.1); margin-left:4px; font-weight:700;">NIERDZ.</span>';
        }

        html += `<tr style="opacity:0.8;">
            <td style="color:var(--text-secondary);">↳ ${p.name}${badgesHtml}${discStr}</td>
            <td style="width:60px; text-align:center;">${item.quantity} szt.</td>
            <td style="width:100px;" class="text-right">${fmtInt(totalLineWeight)} kg</td>
            <td style="width:120px;" class="text-right">${p.componentType === 'kineta' ? 'wliczone' : fmt(totalLinePrice) + ' PLN'}</td>
        </tr>`;

        // Renderowanie szczegółów dopłaty, przejść i kinety (jako sub-elementy w skróconej tabeli)
        html += renderComponentSubItems(
            well,
            p,
            item,
            assignedPrzejscia[index],
            disc,
            nadbudowaMult,
            wellTransportCost,
            index
        );
    });
    return html;
}

function calculateAssignedPrzejscia(well) {
    const assigned = {};
    const rzDna = parseFloat(well.rzednaDna) || 0;

    let configMap = [];
    if (typeof buildConfigMap === 'function') {
        configMap = buildConfigMap(well, (id) => studnieProducts.find((pr) => pr.id === id), true);
    } else {
        let currY = 0;
        let dennicaCount = 0;
        // Budujemy mapę wysokości elementów (od dołu)
        for (let j = well.config.length - 1; j >= 0; j--) {
            const p = studnieProducts.find((x) => x.id === well.config[j].productId);
            if (!p) continue;
            let h = 0;
            if (p.componentType === 'dennica') {
                dennicaCount++;
                h = (p.height || 0) - (dennicaCount > 1 ? 100 : 0);
            } else {
                h = (p.height || 0) * (well.config[j].quantity || 1);
            }
            configMap.push({
                index: j,
                start: currY,
                end: currY + h,
                componentType: p.componentType
            });
            currY += h;
        }
    }

    if (well.przejscia) {
        well.przejscia.forEach((pr) => {
            const mmFromBottom = (parseFloat(pr.rzednaWlaczenia || rzDna) - rzDna) * 1000;

            let idx = well.config.length - 1;
            let target = null;

            if (typeof findAssignedElement === 'function') {
                const fae = findAssignedElement(mmFromBottom, configMap);
                if (fae && fae.entry) {
                    idx = fae.assignedIndex;
                    target = fae.entry;
                }
            } else {
                target = configMap.find((cm) => mmFromBottom >= cm.start && mmFromBottom < cm.end);
                idx = target ? target.index : well.config.length - 1;
            }

            if (!assigned[idx]) assigned[idx] = [];

            // Kalkulacja opłaty za wiercenie dla widoku oferty
            let drillingBasePrice = 0;
            let bestDrillProd = /** @type {any} */ (null);
            const p = studnieProducts.find((x) => x.id === pr.productId);
            if (p) {
                const isInsitu = p.name && p.name.toUpperCase().includes('INSITU');
                if (
                    !isInsitu &&
                    target &&
                    (target.componentType === 'krag' || target.componentType === 'krag_ot')
                ) {
                    const trDn = parseInt(pr.dn) || parseInt(p.dn) || 0;
                    if (trDn > 0) {
                        const drillingProducts = studnieProducts.filter(
                            (x) => x.category === 'Wiercenie'
                        );
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
                                    bestDrillProd = drill;
                                }
                            }
                        });
                        if (bestDrillProd) {
                            drillingBasePrice = bestDrillProd.price || 0;
                        }
                    }
                }
            }

            assigned[idx].push({
                ...pr,
                _drillingBasePrice: drillingBasePrice,
                _drillingProd: bestDrillProd
            });
        });
    }
    return assigned;
}

function renderComponentSubItems(
    well,
    p,
    item,
    itemPrzejscia,
    disc,
    nadbudowaMult,
    wellTransportCost,
    itemIndex
) {
    let html = '';
    const isBase = p.componentType === 'dennica' || p.componentType === 'styczna';

    const bd =
        typeof getItemPriceBreakdown === 'function'
            ? getItemPriceBreakdown(well, p, true, item)
            : null;
    if (bd) {
        var pehdLabel = '';
        if (bd.pehd > 0) {
            if (['dennica', 'styczna'].indexOf(p.componentType) !== -1)
                pehdLabel = well.wkladkaDennica;
            else if (
                [
                    'plyta',
                    'plyta_redukcyjna',
                    'plyta_nastudzienna',
                    'stozek',
                    'zwienczenie',
                    'konus',
                    'plyta_din',
                    'plyta_najazdowa',
                    'plyta_zamykajaca',
                    'pierscien_odciazajacy'
                ].indexOf(p.componentType) !== -1
            )
                pehdLabel = well.wkladkaZwienczenie;
            else if (['krag', 'krag_ot', 'rura'].indexOf(p.componentType) !== -1)
                pehdLabel = well.wkladkaNadbudowa;
        }
        if (bd.pehd > 0 && pehdLabel) {
            html +=
                '<tr style="opacity:0.5; font-size:0.65rem; color:#0ea5e9;"><td colspan="3" class="pl-lg">w cenie: wkładka PEHD ' +
                pehdLabel +
                '</td><td class="text-right">' +
                fmt(bd.pehd) +
                ' PLN</td></tr>';
        }
        if (bd.malowanieW > 0) {
            html +=
                '<tr style="opacity:0.5; font-size:0.65rem; color:#8b5cf6;"><td colspan="3" class="pl-lg">w cenie: malowanie wewnątrz</td><td class="text-right">' +
                fmt(bd.malowanieW) +
                ' PLN</td></tr>';
        }
        if (bd.malowanieZ > 0) {
            html +=
                '<tr style="opacity:0.5; font-size:0.65rem; color:#8b5cf6;"><td colspan="3" class="pl-lg">w cenie: malowanie zewnątrz</td><td class="text-right">' +
                fmt(bd.malowanieZ) +
                ' PLN</td></tr>';
        }
        if (bd.zelbet > 0) {
            html +=
                '<tr style="opacity:0.5; font-size:0.65rem; color:var(--warn);"><td colspan="3" class="pl-lg">w cenie: dopłata żelbet</td><td class="text-right">' +
                fmt(bd.zelbet) +
                ' PLN</td></tr>';
        }
        if (bd.nierdzewna > 0) {
            html +=
                '<tr style="opacity:0.5; font-size:0.65rem; color:#a855f7;"><td colspan="3" class="pl-lg">w cenie: drabinka nierdzewna</td><td class="text-right">' +
                fmt(bd.nierdzewna) +
                ' PLN</td></tr>';
        }
    }

    if (isBase && well.doplata) {
        const doplataWellColor = well.doplata > 0 ? 'var(--success)' : 'var(--danger)';
        const doplataWellSign = well.doplata > 0 ? '+' : '';
        html += `<tr style="opacity:0.6; font-size:0.7rem; color:${doplataWellColor};">
            <td colspan="3" class="pl-lg">↳ ${doplataWellSign} Dopłata indywidualna</td>
            <td class="text-right">${fmt(well.doplata)} PLN</td>
        </tr>`;
    }

    if (item._osadnikCost > 0) {
        // Zgodnie z nową logiką osadnika ta część zwykle jest ukryta, bo _osadnikCost zostało usunięte
        html += `<tr style="opacity:0.6; font-size:0.7rem; color:var(--warn);">
            <td colspan="3" class="pl-lg">↳ + Wkładka osadnika (przestarzałe)</td>
            <td class="text-right">${fmt(item._osadnikCost)} PLN</td>
        </tr>`;
    }

    if (itemPrzejscia) {
        itemPrzejscia.forEach((pr) => {
            const prProd = studnieProducts.find((x) => x.id === pr.productId);
            if (!prProd) return;

            if (pr.frozenTransitionPrice != null) {
                // TRYB ZAMÓWIENIA (zamrożone ceny)
                html += `<tr style="opacity:0.6; font-size:0.7rem; color:var(--accent-hover);">
                    <td colspan="3" class="pl-lg">↳ + Przejście: ${pr.frozenName || prProd.category} ${prProd.dn || ''} (${pr.angle}°)</td>
                    <td class="text-right">${fmt(pr.frozenTransitionPrice)} PLN</td>
                </tr>`;
                if (pr.doplata) {
                    const doplPrColor = pr.doplata > 0 ? 'var(--success)' : 'var(--danger)';
                    const doplPrSign = pr.doplata > 0 ? '+' : '';
                    html += `<tr style="opacity:0.6; font-size:0.7rem; color:${doplPrColor};">
                        <td style="padding-left:2.0rem;">↳ ${doplPrSign} Dopłata indywidualna do przejścia</td>
                        <td class="text-right">${fmt(pr.doplata)} PLN</td>
                    </tr>`;
                }
                if (pr.frozenDrillingPrice > 0) {
                    html += `<tr style="opacity:0.6; font-size:0.7rem; color:#f97316;">
                        <td colspan="3" class="pl-lg">↳ + ${pr.frozenDrillingName || 'Wiercenie'} ${pr.frozenDrillingDn || ''}</td>
                        <td class="text-right">${fmt(pr.frozenDrillingPrice)} PLN</td>
                    </tr>`;
                }
            } else {
                // TRYB OFERTY (dynamiczne ceny)
                const prPrice = (prProd.price || 0) * nadbudowaMult;
                html += `<tr style="opacity:0.6; font-size:0.7rem; color:var(--accent-hover);">
                    <td colspan="3" class="pl-lg">↳ + Przejście: ${prProd.category} ${prProd.dn} (${pr.angle}°)</td>
                    <td class="text-right">${fmt(prPrice)} PLN</td>
                </tr>`;
                if (pr.doplata) {
                    const doplPrColor2 = pr.doplata > 0 ? 'var(--success)' : 'var(--danger)';
                    const doplPrSign2 = pr.doplata > 0 ? '+' : '';
                    html += `<tr style="opacity:0.6; font-size:0.7rem; color:${doplPrColor2};">
                        <td style="padding-left:2.0rem;">↳ ${doplPrSign2} Dopłata indywidualna do przejścia</td>
                        <td class="text-right">${fmt(pr.doplata)} PLN</td>
                    </tr>`;
                }
                if (pr._drillingBasePrice > 0 && pr._drillingProd) {
                    const drillPrice = pr._drillingBasePrice * nadbudowaMult;
                    html += `<tr style="opacity:0.6; font-size:0.7rem; color:#f97316;">
                        <td colspan="3" class="pl-lg">↳ + ${pr._drillingProd.name} ${pr._drillingProd.dn || ''}</td>
                        <td class="text-right">${fmt(drillPrice)} PLN</td>
                    </tr>`;
                }
            }
        });
    }

    if (isBase) {
        const kineta = well.config.find(
            (c) => studnieProducts.find((x) => x.id === c.productId)?.componentType === 'kineta'
        );
        if (kineta) {
            const kp = studnieProducts.find((x) => x.id === kineta.productId);
            const kPrice =
                (kineta.frozenPrice != null && window.isPreviewMode
                    ? kineta.frozenPrice
                    : getItemAssessedPrice(well, kp, true, kineta)) * (kineta.quantity || 1);
            html +=
                '<tr style="opacity:0.6; font-size:0.7rem; color:#f472b6;"><td colspan="3" class="pl-lg">↳ + ' +
                (kp ? kp.name : 'Kineta') +
                '</td><td class="text-right">' +
                fmt(kPrice) +
                ' PLN</td></tr>';

            if (kp && typeof getItemPriceBreakdown === 'function') {
                var kBd = getItemPriceBreakdown(well, kp, true, kineta);
                var kQ = kineta.quantity || 1;
                if (kBd.malowanieW > 0) {
                    html +=
                        '<tr style="opacity:0.5; font-size:0.65rem; color:#f9a8d4;"><td colspan="3" class="pl-lg">w cenie: malowanie wewnątrz</td><td class="text-right">' +
                        fmt(kBd.malowanieW * kQ) +
                        ' PLN</td></tr>';
                }
                if (kBd.malowanieZ > 0) {
                    html +=
                        '<tr style="opacity:0.5; font-size:0.65rem; color:#f9a8d4;"><td colspan="3" class="pl-lg">w cenie: malowanie zewnątrz</td><td class="text-right">' +
                        fmt(kBd.malowanieZ * kQ) +
                        ' PLN</td></tr>';
                }
            }
        }
    }

    const precoAlloc = calculatePrecoAllocationForItem(well, itemIndex);
    if (precoAlloc.hasPreco) {
        if (precoAlloc.allocatedCost > 0) {
            const discKey = well.dn === 'styczna' ? 'styczne' : well.dn;
            const discPreco = (wellDiscounts[discKey] || {}).preco || 0;
            const precoMult = 1 - discPreco / 100;
            const precoCost = precoAlloc.allocatedCost * precoMult;
            const fracPerc =
                precoAlloc.fraction > 0 && precoAlloc.fraction < 1
                    ? Math.round(precoAlloc.fraction * 100)
                    : 0;
            let kinetaLabel;
            if (well.wkladkaOsadnikPreco === 'tak') {
                let h = well.wkladkaOsadnikH || 1000;
                if (!well.wkladkaOsadnikH) {
                    let dennicaH = 0;
                    if (well.config) {
                        well.config.forEach((c) => {
                            const prod = studnieProducts.find((pr) => pr.id === c.productId);
                            if (
                                prod &&
                                (prod.componentType === 'dennica' ||
                                    prod.componentType === 'styczna')
                            ) {
                                dennicaH += (prod.height || 0) * (c.quantity || 1);
                            }
                        });
                    }
                    h = dennicaH || 1000;
                }
                if (precoAlloc.isBottomMostDennica) {
                    kinetaLabel = `osadnika (Dno + ${fracPerc ? fracPerc + '% ścian z ' : 'Ściany '}${h} mm)`;
                } else {
                    kinetaLabel = `osadnika (${fracPerc ? fracPerc + '% ścian z ' : 'Ściany '}${h} mm)`;
                }
            } else {
                const baseName = well.kineta === 'precotop' ? 'PrecoTop' : 'Preco';
                if (precoAlloc.isBottomMostDennica) {
                    kinetaLabel =
                        baseName + (fracPerc ? ` (Baza + ${fracPerc}% uzupełnienia)` : '');
                } else {
                    kinetaLabel =
                        baseName +
                        ` (${fracPerc ? fracPerc + '% uzupełnienia' : 'Wkładka uzupełniająca'})`;
                }
            }
            html += `<tr style="opacity:0.6; font-size:0.7rem; color:var(--danger);">
                <td colspan="3" class="pl-lg">↳ + Wkładka ${kinetaLabel}${discPreco > 0 ? ' <span style="font-size:0.6rem; color:var(--success);">(-' + discPreco + '%)</span>' : ''}</td>
                <td class="text-right">${fmt(precoCost)} PLN</td>
            </tr>`;
            if (precoAlloc.isBottomMostDennica && typeof calcPrecoPricing === 'function') {
                var precoCalc = calcPrecoPricing(well);
                if (precoCalc && precoCalc.suma > 0) {
                    if (precoCalc.bazowa > 0 && precoCalc.kinetaGlowna) {
                        var dnParts = precoCalc.kinetaGlowna.dn.map(function (d) {
                            return 'DN' + d;
                        });
                        var etyParts = precoCalc.kinetaGlowna.etykiety.map(function (e) {
                            return '[' + e + ']';
                        });
                        html +=
                            '<tr style="opacity:0.5; font-size:0.65rem; color:#fb7185;"><td colspan="3" class="pl-xl">↳ Kineta bazowa (' +
                            dnParts.join(' / ') +
                            ') ' +
                            etyParts.join(' / ') +
                            '</td><td class="text-right">' +
                            fmt(precoCalc.bazowa * precoMult) +
                            ' PLN</td></tr>';
                    }
                    if (precoCalc.skrzynki && precoCalc.skrzynki.suma > 0) {
                        html +=
                            '<tr style="opacity:0.5; font-size:0.65rem; color:#fb7185;"><td colspan="3" class="pl-xl">↳ + skrzynki włazowe (' +
                            precoCalc.skrzynki.ilosc +
                            ' × ' +
                            fmt(precoCalc.skrzynki.cenaSzt) +
                            ' PLN)</td><td class="text-right">' +
                            fmt(precoCalc.skrzynki.suma * precoMult) +
                            ' PLN</td></tr>';
                    }
                    if (precoCalc.spadekKineta > 0) {
                        html +=
                            '<tr style="opacity:0.5; font-size:0.65rem; color:#fb7185;"><td colspan="3" class="pl-xl">↳ + spadek kinety</td><td class="text-right">' +
                            fmt(precoCalc.spadekKineta * precoMult) +
                            ' PLN</td></tr>';
                    }
                    if (precoCalc.spadekMufa > 0) {
                        html +=
                            '<tr style="opacity:0.5; font-size:0.65rem; color:#fb7185;"><td colspan="3" class="pl-xl">↳ + spadek mufy</td><td class="text-right">' +
                            fmt(precoCalc.spadekMufa * precoMult) +
                            ' PLN</td></tr>';
                    }
                    if (precoCalc.uniesienie > 0) {
                        var mm =
                            precoCalc.uniesieniaSzczegoly &&
                            precoCalc.uniesieniaSzczegoly.length > 0
                                ? precoCalc.uniesieniaSzczegoly[0].mm
                                : '';
                        html +=
                            '<tr style="opacity:0.5; font-size:0.65rem; color:#fb7185;"><td colspan="3" class="pl-xl">↳ + uniesienie' +
                            (mm ? ' (' + mm + ' mm)' : '') +
                            '</td><td class="text-right">' +
                            fmt(precoCalc.uniesienie * precoMult) +
                            ' PLN</td></tr>';
                    }
                    if (precoCalc.redukcja > 0) {
                        html +=
                            '<tr style="opacity:0.5; font-size:0.65rem; color:#fb7185;"><td colspan="3" class="pl-xl">↳ + redukcja' +
                            (precoCalc.redukcjaOpis ? ' ' + precoCalc.redukcjaOpis : '') +
                            '</td><td class="text-right">' +
                            fmt(precoCalc.redukcja * precoMult) +
                            ' PLN</td></tr>';
                    }
                    if (precoCalc.dodWloty && precoCalc.dodWloty.length > 0) {
                        for (var dwi = 0; dwi < precoCalc.dodWloty.length; dwi++) {
                            var dw = precoCalc.dodWloty[dwi];
                            var dwTyp =
                                dw.typ === 'kaskada'
                                    ? 'kaskada'
                                    : dw.typ === 'sciana'
                                      ? 'ściana'
                                      : dw.typ === 'doplyw'
                                        ? 'dopływ'
                                        : dw.typ || '';
                            html +=
                                '<tr style="opacity:0.5; font-size:0.65rem; color:#fb7185;"><td colspan="3" class="pl-xl">↳ + dod. wlot DN' +
                                dw.dn +
                                (dwTyp ? ' (' + dwTyp + ')' : '') +
                                ' [' +
                                (dw.label || '') +
                                ']</td><td class="text-right">' +
                                fmt(dw.cena * precoMult) +
                                ' PLN</td></tr>';
                        }
                    }
                    if (precoCalc.pelnaWysokosc && precoCalc.pelnaWysokosc.cena > 0) {
                        html +=
                            '<tr style="opacity:0.5; font-size:0.65rem; color:#fb7185;"><td colspan="3" class="pl-xl">↳ + pełna wysokość (' +
                            precoCalc.pelnaWysokosc.metry.toFixed(2) +
                            ' m)</td><td class="text-right">' +
                            fmt(precoCalc.pelnaWysokosc.cena * precoMult) +
                            ' PLN</td></tr>';
                    }
                }
            }
        } else if (precoAlloc.error && precoAlloc.isBottomMostDennica) {
            html += `<tr style="opacity:0.6; font-size:0.7rem; color:var(--danger);">
                <td colspan="3" class="pl-lg">↳ ⚠ Wkładka PRECO — ${precoAlloc.error}</td>
                <td class="text-right">—</td>
            </tr>`;
        }
    }

    if (isBase) {
        if (wellTransportCost > 0) {
            html += `<tr style="opacity:0.6; font-size:0.7rem; color:#a855f7;">
                <td colspan="3" class="pl-lg">↳ <i data-lucide="truck" aria-hidden="true"></i> Udział w transporcie</td>
                <td class="text-right">${fmt(wellTransportCost)} PLN</td>
            </tr>`;
        }
    }
    return html;
}

function calculatePrecoAllocationForItem(well, itemIndex) {
    let allocatedCost = 0;
    let fraction = 0;
    let isBottomMostDennica = false;
    let error = null;
    let hasPreco = false;

    if (
        (well.kineta === 'preco' ||
            well.kineta === 'precotop' ||
            well.wkladkaOsadnikPreco === 'tak') &&
        typeof calcPrecoPricing === 'function'
    ) {
        const precoCalc = calcPrecoPricing(well);
        if (precoCalc.error) {
            error = precoCalc.error;
            hasPreco = true;
        } else if (precoCalc.suma > 0) {
            hasPreco = true;
            let configMap = [];
            if (typeof buildConfigMap === 'function') {
                configMap = buildConfigMap(
                    well,
                    (id) => studnieProducts.find((pr) => pr.id === id),
                    true
                );
            } else {
                let currY = 0;
                let dennicaCount = 0;
                for (let j = well.config.length - 1; j >= 0; j--) {
                    const p = studnieProducts.find((x) => x.id === well.config[j].productId);
                    if (!p) continue;
                    let h = 0;
                    if (p.componentType === 'dennica') {
                        dennicaCount++;
                        h = (p.height || 0) - (dennicaCount > 1 ? 100 : 0);
                    } else {
                        h = (p.height || 0) * (well.config[j].quantity || 1);
                    }
                    configMap.push({
                        index: j,
                        start: currY,
                        end: currY + h,
                        componentType: p.componentType
                    });
                    currY += h;
                }
            }

            const targetCm = configMap.find((cm) => cm.index === itemIndex);
            if (targetCm) {
                const bottomDennicaCm = configMap.find(
                    (cm) => cm.componentType === 'dennica' || cm.componentType === 'styczna'
                );
                isBottomMostDennica = bottomDennicaCm && bottomDennicaCm.index === itemIndex;

                if (isBottomMostDennica) {
                    allocatedCost += precoCalc.bazowa || 0;
                    allocatedCost += precoCalc.skrzynki?.suma || 0;
                    allocatedCost += precoCalc.spadekKineta || 0;
                    allocatedCost += precoCalc.spadekMufa || 0;
                    allocatedCost += precoCalc.uniesienie || 0;
                    allocatedCost += precoCalc.redukcja || 0;
                    allocatedCost += (precoCalc.dodWloty || []).reduce((s, d) => s + d.cena, 0);
                }

                if (precoCalc.pelnaWysokosc) {
                    const startZ = precoCalc.pelnaWysokosc.startZ || 0;
                    const endZ = precoCalc.pelnaWysokosc.endZ || 0;
                    if (endZ > startZ) {
                        const overlap = Math.max(
                            0,
                            Math.min(endZ, targetCm.end) - Math.max(startZ, targetCm.start)
                        );
                        if (overlap > 0) {
                            fraction = overlap / (endZ - startZ);
                            allocatedCost += precoCalc.pelnaWysokosc.cena * fraction;
                        }
                    }
                }
            }
        }
    }

    return { hasPreco, error, allocatedCost, fraction, isBottomMostDennica };
}

function calculateLinePricing(
    well,
    p,
    item,
    wellTransportCost,
    disc,
    nadbudowaMult,
    itemPrzejscia,
    itemIndex
) {
    // W zamówieniu użyj zamrożonej ceny tylko w podglądzie; w ofercie/edycji przelicz na nowo
    const itemPrice =
        item.frozenPrice != null && window.isPreviewMode
            ? item.frozenPrice
            : getItemAssessedPrice(well, p, true, item);
    let totalLinePrice = itemPrice * item.quantity;
    let totalLineWeight = (p.weight || 0) * item.quantity;

    if (p.componentType === 'dennica' || p.componentType === 'styczna') {
        totalLinePrice += wellTransportCost;
        if (well.doplata) totalLinePrice += well.doplata;
    }

    const precoAlloc = calculatePrecoAllocationForItem(well, itemIndex);
    if (precoAlloc.hasPreco && precoAlloc.allocatedCost > 0) {
        const discKey = well.dn === 'styczna' ? 'styczne' : well.dn;
        const discPreco = (wellDiscounts[discKey] || {}).preco || 0;
        const precoMult = 1 - discPreco / 100;
        totalLinePrice += precoAlloc.allocatedCost * precoMult;
    }

    if (itemPrzejscia) {
        itemPrzejscia.forEach((pr) => {
            const prProd = studnieProducts.find((x) => x.id === pr.productId);
            if (prProd) {
                if (pr.frozenTransitionPrice != null) {
                    totalLinePrice +=
                        pr.frozenTransitionPrice +
                        (pr.doplata || 0) +
                        (pr.frozenDrillingPrice || 0);
                } else {
                    totalLinePrice += (prProd.price || 0) * nadbudowaMult + (pr.doplata || 0);
                    if (pr._drillingBasePrice > 0) {
                        totalLinePrice += pr._drillingBasePrice * nadbudowaMult;
                    }
                }
                totalLineWeight += prProd.weight || 0;
            }
        });
    }

    return { totalLinePrice, totalLineWeight };
}

function renderOfferSummaryFooter(
    count,
    weight,
    price,
    showOrderSelection,
    dnGroups,
    showPriceComparison
) {
    // Oblicz colspan dla pierwszych kolumn (stałe)
    // Baza: Lp. (1) + Expand (1) + Nazwa (1) + Status (1) + DN (1) = 5 kolumn stałych
    // Dodatkowe w trybie wyboru: Checkbox (1)
    let baseColspan = 5;
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
            const avgPrice = g.sumPrice / g.count;
            const avgHeight = g.sumHeight / g.count;

            // Oblicz różnicę cen dla grupy DN (jeśli w trybie porównania)
            let priceDiffCell = '';
            let offerPriceCell = '';
            if (showPriceComparison) {
                if (g.sumOfferPrice > 0) {
                    const priceDiff = g.sumPrice - g.sumOfferPrice;
                    const diffColor =
                        priceDiff > 0
                            ? 'var(--success-hover)'
                            : priceDiff < 0
                              ? 'var(--danger-hover)'
                              : 'var(--text-muted)';
                    const diffSign = priceDiff > 0 ? '+' : '';
                    offerPriceCell = `<td class="text-right" style="font-size:0.8rem; color:var(--text-secondary); white-space:nowrap; padding:0.5rem 0.75rem;">${fmt(g.sumOfferPrice)} PLN</td>`;
                    priceDiffCell = `<td class="text-right" style="font-size:0.8rem; color:${diffColor}; white-space:nowrap; padding:0.5rem 0.75rem;">${diffSign}${fmt(priceDiff)} PLN</td>`;
                } else {
                    offerPriceCell = '<td class="text-right" class="pad-sm"></td>';
                    priceDiffCell = '<td class="text-right" class="pad-sm"></td>';
                }
            }

            html += `<tr style="border-top:1px solid rgba(255,255,255,0.05);">
              <td colspan="${baseColspan}" style="padding:0.6rem 0.5rem; font-size:0.85rem; color:var(--text-secondary); white-space:nowrap;">Podsumowanie DN${dn} — ${g.count} szt.</td>
              ${offerPriceCell}
              <td class="text-right" style="font-size:0.85rem; color:var(--success); font-weight:700; white-space:nowrap; padding:0.5rem 0.75rem;">${fmt(g.sumPrice)} PLN</td>
              ${priceDiffCell}
              <td class="text-right" style="font-size:0.8rem; color:var(--text-muted); white-space:nowrap; padding:0.5rem 0.75rem;">śr. ${fmtInt(avgHeight)} mm</td>
            </tr>`;
        });
    }

    // Oblicz sumę cen z oferty dla wszystkich studni
    let totalOfferPrice = 0;
    let totalPriceDiffCell = '';
    let totalOfferPriceCell = '';
    if (showPriceComparison) {
        Object.values(dnGroups).forEach((g) => {
            totalOfferPrice += g.sumOfferPrice || 0;
        });
        if (totalOfferPrice > 0) {
            const totalDiff = price - totalOfferPrice;
            const diffColor =
                totalDiff > 0
                    ? 'var(--success-hover)'
                    : totalDiff < 0
                      ? 'var(--danger-hover)'
                      : 'var(--text-muted)';
            const diffSign = totalDiff > 0 ? '+' : '';
            totalOfferPriceCell = `<td class="text-right" style="font-weight:700; font-size:0.85rem; color:var(--text-secondary); white-space:nowrap; padding:0.5rem 0.75rem;">${fmt(totalOfferPrice)} PLN</td>`;
            totalPriceDiffCell = `<td class="text-right" style="font-weight:700; font-size:0.85rem; color:${diffColor}; white-space:nowrap; padding:0.5rem 0.75rem;">${diffSign}${fmt(totalDiff)} PLN</td>`;
        } else {
            totalOfferPriceCell = '<td class="text-right" class="pad-sm"></td>';
            totalPriceDiffCell = '<td class="text-right" class="pad-sm"></td>';
        }
    }

    html += `<tr style="border-top:2px solid var(--border-glass);">
          <td colspan="${baseColspan}" style="font-weight:700; font-size:0.9rem; color:var(--text-primary); padding:1rem 0.5rem; white-space:nowrap;">RAZEM (${count} studni)</td>
          ${totalOfferPriceCell}
          <td class="text-right" style="font-weight:800; font-size:1rem; color:var(--success); white-space:nowrap; padding:0.5rem 0.75rem;">${fmt(price)} PLN</td>
          ${totalPriceDiffCell}
          <td class="text-right" style="font-weight:700; font-size:0.85rem; color:var(--text-muted); white-space:nowrap; padding:0.5rem 0.75rem;">${fmtInt(weight)} kg</td>
        </tr>
      </tfoot>`;
    return html;
}

function updateOfferSummaryUI(totals) {
    const totalEl = document.getElementById('sum-total-netto');
    const bruttoEl = document.getElementById('sum-brutto-details');
    const weightEl = document.getElementById('sum-netto-weight');
    const transCostEl = document.getElementById('sum-transport-cost');

    if (totals.totalTransportCost > 0) {
        if (transCostEl)
            transCostEl.innerHTML = `<i data-lucide="truck" class="icon-md"></i> ${escapeHtml(fmt(totals.totalTransportCost))} PLN`;

        const activeTransportInfo = document.getElementById('offer-active-transport-info');
        if (activeTransportInfo) {
            activeTransportInfo.innerHTML = `
                <div style="margin-bottom: 2px;">Ilość aut: <span style="color: #cbd5e1; font-weight: 600;">${typeof formatTransportCount === 'function' ? formatTransportCount(totals.totalTransports, typeof orderEditMode !== 'undefined' && orderEditMode ? 'fractional' : currentTransportMode) : totals.totalTransports}</span></div>
                <div>Cena rejsu: <span style="color: #cbd5e1; font-weight: 600;">${fmt(totals.transportCostPerTrip)} PLN</span></div>
            `;
        }
    } else {
        if (transCostEl)
            transCostEl.innerHTML = '<i data-lucide="truck" class="icon-md"></i> 0 PLN';

        const activeTransportInfo = document.getElementById('offer-active-transport-info');
        if (activeTransportInfo) {
            activeTransportInfo.innerHTML = '<span style="opacity: 0.5;">Brak transportu</span>';
        }
    }

    let finalNetto = 0;
    let finalWeight = 0;
    wells.forEach((w) => {
        const s = calcWellStats(w);
        finalNetto +=
            s.price +
            (totals.globalWeight > 0
                ? totals.totalTransportCost * (s.weight / totals.globalWeight)
                : 0);
        finalWeight += s.weight;
    });

    if (totalEl) totalEl.textContent = fmt(finalNetto) + ' PLN';
    if (bruttoEl) bruttoEl.textContent = 'Brutto: ' + fmt(finalNetto * 1.23) + ' PLN';
    if (weightEl) weightEl.textContent = fmtInt(finalWeight) + ' kg';

    const productsEl = document.getElementById('sum-netto-products');
    if (productsEl) {
        const productsNetto = Math.max(0, finalNetto - (totals.totalTransportCost || 0));
        productsEl.textContent = fmt(productsNetto) + ' PLN';
    }

    const transportModalTotalEl = document.getElementById('transport-modal-total-val');
    if (transportModalTotalEl) transportModalTotalEl.textContent = fmt(finalNetto) + ' PLN';

    const discountsInfoEl = document.getElementById('offer-active-discounts-info');
    if (discountsInfoEl) {
        const activeDiscounts = typeof wellDiscounts !== 'undefined' ? wellDiscounts : {};
        const wellsList = typeof wells !== 'undefined' ? wells : [];

        // Fixed grid layout: 4 columns × 2 rows
        // Wiersz 1: DN1000, DN1500, DN2500, PEHD
        // Wiersz 2: DN1200, DN2000, Styczna, Malowanie
        const tileBase =
            'padding:2px 4px; border-radius:5px; text-align:center; display:flex; flex-direction:column; align-items:center; justify-content:center; gap:0; min-width:0;';
        const labelStyle =
            'font-size:0.72rem; font-weight:800; line-height:1.15; color:var(--text-primary);';
        const detailStyle =
            'font-size:0.65rem; font-weight:600; line-height:1.15; color:rgba(255,255,255,0.85);';
        const dimVal = 'opacity:0.5; color:rgba(255,255,255,0.6);';
        const disabledTile = `${tileBase} background:rgba(255,255,255,0.02); color:rgba(100,116,139,0.5); border:1px solid rgba(255,255,255,0.04);`;

        /** Formatuje pojedynczą wartość rabatu — aktywną lub przyciemnioną */
        const fmtDisc = (prefix, val, color) => {
            const v = Number(val || 0).toFixed(2);
            if (val > 0)
                return color
                    ? `<span style="color:${color};">${prefix}${v}%</span>`
                    : `${prefix}${v}%`;
            return `<span style="${dimVal}">${prefix}${v}%</span>`;
        };

        /** Buduje kafelek średnicy — zawsze pokazuje D, N, P */
        const buildDnTile = (dn) => {
            const label = dn === 'styczne' ? 'Stycz' : `DN${dn}`;
            const hasWells = wellsList.some((w) =>
                dn === 'styczne' ? w.type === 'styczna' || w.dn === 'styczna' : w.dn == dn
            );
            if (!hasWells)
                return `<div style="${disabledTile}"><span style="${labelStyle}">${label}</span></div>`;

            const d = activeDiscounts[dn] || {};
            const hasDisc = d.dennica > 0 || d.nadbudowa > 0 || d.preco > 0;
            const bg = hasDisc
                ? 'background:rgba(var(--accent-rgb),0.12); color:var(--accent-text); border:1px solid rgba(var(--accent-rgb),0.3);'
                : 'background:rgba(var(--accent-rgb),0.06); color:rgba(165,180,252,0.5); border:1px solid rgba(var(--accent-rgb),0.12);';
            const details = `${fmtDisc('D:', d.dennica)} ${fmtDisc('N:', d.nadbudowa)} ${fmtDisc('P:', d.preco, d.preco > 0 ? 'var(--danger-hover)' : null)}`;
            return `<div style="${tileBase} ${bg}"><span style="${labelStyle}">${label}</span><span style="${detailStyle}">${details}</span></div>`;
        };

        /** Buduje kafelek PEHD */
        const buildPehdTile = () => {
            const anyPehd = wellsList.some(
                (w) =>
                    (w.wkladkaDennica && w.wkladkaDennica !== 'brak') ||
                    (w.wkladkaNadbudowa && w.wkladkaNadbudowa !== 'brak') ||
                    (w.wkladkaZwienczenie && w.wkladkaZwienczenie !== 'brak')
            );
            if (!anyPehd)
                return `<div style="${disabledTile}"><span style="${labelStyle}">PEHD</span></div>`;

            const pehdDisc =
                wellsList[0] && wellsList[0].pehdDiscount ? wellsList[0].pehdDiscount : 0;
            let basePrice = 0;
            if (typeof studnieProducts !== 'undefined') {
                for (const p of studnieProducts) {
                    if (
                        p.area > 0 &&
                        p.doplataPEHD > 0 &&
                        p.componentType !== 'przejscie' &&
                        p.componentType !== 'kineta'
                    ) {
                        basePrice = Math.round(p.doplataPEHD / getPehdEffectiveArea(p));
                        break;
                    }
                }
            }
            const afterPrice = basePrice * (1 - pehdDisc / 100);
            const discDetail =
                pehdDisc > 0
                    ? `${afterPrice.toFixed(0)} zł/m² (-${Number(pehdDisc).toFixed(2)}%)`
                    : `${afterPrice.toFixed(0)} zł/m²`;
            return `<div style="${tileBase} background:rgba(14,165,233,0.12); color:#38bdf8; border:1px solid rgba(14,165,233,0.3);"><span style="${labelStyle}"><i data-lucide="shield" style="width:9px;height:9px;display:inline;vertical-align:middle;margin-right:1px;"></i>PEHD</span><span style="${detailStyle}">${discDetail}</span></div>`;
        };

        /** Buduje kafelek Malowania */
        const buildMalTile = () => {
            const anyW = wellsList.some((w) => w.malowanieW && w.malowanieW !== 'brak');
            const anyZ = wellsList.some((w) => w.malowanieZ && w.malowanieZ !== 'brak');
            if (!anyW && !anyZ)
                return `<div style="${disabledTile}"><span style="${labelStyle}">Malowanie</span></div>`;

            const ref = wellsList[0] || {};
            const parts = [];
            if (anyW) parts.push(`W:${ref.malowanieWewCena || 0}`);
            if (anyZ) parts.push(`Z:${ref.malowanieZewCena || 0}`);
            return `<div style="${tileBase} background:rgba(168,85,247,0.12); color:#c084fc; border:1px solid rgba(168,85,247,0.3);"><span style="${labelStyle}"><i data-lucide="paintbrush" style="width:9px;height:9px;display:inline;vertical-align:middle;margin-right:1px;"></i>Malowanie</span><span style="${detailStyle}">${parts.join(' ')} zł/m²</span></div>`;
        };

        discountsInfoEl.innerHTML = `
            <div style="display:grid; grid-template-columns:repeat(4, 1fr); gap:3px; width:100%;">
                ${buildDnTile('1000')}
                ${buildDnTile('1500')}
                ${buildDnTile('2500')}
                ${buildPehdTile()}
                ${buildDnTile('1200')}
                ${buildDnTile('2000')}
                ${buildDnTile('styczne')}
                ${buildMalTile()}
            </div>`;
        if (typeof lucide !== 'undefined' && lucide.createIcons)
            lucide.createIcons({ root: discountsInfoEl });
    }
}

function renderSavedOffersStudnie() {
    const container = document.getElementById('saved-offers-list');
    if (!container) return;

    if (offersStudnie.length === 0) {
        container.innerHTML = `<div class="empty-state">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M9 12h6m-3-3v6m-7 4h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"/></svg>
            <h3>Brak zapisanych ofert</h3><p>Utwórz nową ofertę w zakładce "Oferta"</p></div>`;
        return;
    }

    container.innerHTML = offersStudnie
        .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
        .map((o) => {
            const oId = normalizeId(o.id);
            // Oblicz postęp zamówień częściowych
            const progress =
                typeof getOfferOrderProgress === 'function'
                    ? getOfferOrderProgress(oId, o.wells)
                    : { ordered: 0, total: (o.wells || []).length, percent: 0 };

            const hasOrder = progress.ordered > 0;
            const isFullyOrdered = progress.percent >= 100;

            let orderBadge = '';
            if (hasOrder) {
                const badgeColor = isFullyOrdered ? 'var(--success-hover)' : 'var(--blue-hover)';
                const badgeBg = isFullyOrdered
                    ? 'rgba(var(--success-rgb),0.15)'
                    : 'rgba(var(--blue-rgb),0.15)';
                const badgeBorder = isFullyOrdered
                    ? 'rgba(var(--success-rgb),0.4)'
                    : 'rgba(var(--blue-rgb),0.4)';

                orderBadge = `<div style="display:inline-flex; align-items:center; gap:0.3rem; padding:0.2rem 0.6rem; background:${badgeBg}; border:2px solid ${badgeBorder}; border-radius:6px; margin-top:0.3rem;">
                <span style="font-size:0.85rem;"><i data-lucide="${isFullyOrdered ? 'check-circle' : 'package'}"></i></span>
                <span style="font-size:0.68rem; font-weight:800; color:${badgeColor}; text-transform:uppercase; letter-spacing:0.5px;">
                    ${isFullyOrdered ? 'Zrealizowana' : 'W realizacji'} (${progress.ordered}/${progress.total})
                </span>
               </div>`;
            }

            return `
        <div class="offer-list-item" ${hasOrder ? `style="border-left:3px solid ${isFullyOrdered ? 'var(--success-hover)' : 'var(--blue-hover)'};"` : ''}>
            <div class="offer-info" style="min-width:0;">
                <div style="display:flex; justify-content:space-between; align-items:flex-start; flex-wrap:wrap; gap:0.5rem;">
                    <div style="display:flex; align-items:center; gap:0.5rem; flex-wrap:wrap;">
                        <h3 style="margin-bottom:0.2rem; word-break:break-all;">${o.number}</h3>
                        ${orderBadge}
                    </div>
                    <div style="font-weight:700; color:var(--text-primary); font-size: 0.9rem; white-space:nowrap;">
                        <i data-lucide="banknote" aria-hidden="true"></i> ${fmt(o.totalBrutto)} PLN
                    </div>
                </div>
                <div class="meta" style="margin-top:0.3rem;">
                    <span><i data-lucide="calendar" aria-hidden="true"></i> <strong>${o.date}</strong></span>
                    <span><i data-lucide="folder-open" aria-hidden="true"></i> <strong>${o.wells.length}</strong> studnie</span>
                    ${(() => {
                        const resolveName = (rawName) => {
                            if (!rawName) return '';
                            if (window.globalUsersMap && window.globalUsersMap.has(rawName))
                                return window.globalUsersMap.get(rawName);
                            if (
                                typeof currentUser !== 'undefined' &&
                                currentUser &&
                                (rawName === currentUser.username || rawName === currentUser.id)
                            )
                                return currentUser.displayName || currentUser.username || rawName;
                            return rawName;
                        };
                        const creatorName = resolveName(o.createdByUserName || o.userName);
                        const assignedName = resolveName(o.userName);

                        let html = '';
                        const isClickable =
                            currentUser &&
                            (currentUser.role === 'admin' || currentUser.role === 'pro');
                        if (creatorName === assignedName && creatorName) {
                            html += `<span style="color:var(--accent-hover)${isClickable ? '; cursor:pointer' : ''}" ${isClickable ? `onclick="changeOfferUserFromListStudnie('${oId}')"` : ''}><i data-lucide="user" aria-hidden="true"></i> Autor i Opiekun: <strong>${creatorName}</strong></span>`;
                        } else {
                            if (creatorName)
                                html += `<span style="display:inline-block; margin-right:10px; color:#888;"><i data-lucide="pen-tool" aria-hidden="true"></i> Autor: <strong>${creatorName}</strong></span>`;
                            if (assignedName)
                                html += `<span style="color:var(--accent-hover)${isClickable ? '; cursor:pointer' : ''}" ${isClickable ? `onclick="changeOfferUserFromListStudnie('${oId}')"` : ''}><i data-lucide="user" aria-hidden="true"></i> Opiekun: <strong>${assignedName}</strong></span>`;
                        }
                        return html;
                    })()}
                    
                    <div style="display:inline-flex; gap:0.3rem; margin-left:0.5rem; font-size:0.65rem;">
                        <span style="background: rgba(var(--success-hover-rgb), 0.1); color: var(--success-hover); padding: 1px 5px; border-radius: 4px; border: 1px solid rgba(var(--success-hover-rgb), 0.3);"><i data-lucide="save"></i> Zapisano</span>
                    </div>
                </div>
                ${
                    o.clientName || o.investName || o.clientContact
                        ? `
                <div class="offer-client-badges">
                    ${o.clientName ? `<div class="badge-client"><i data-lucide="building-2" aria-hidden="true"></i> <strong>Klient:</strong> <span style="font-weight:500">${o.clientName}</span></div>` : ''}
                    ${o.investName ? `<div class="badge-invest"><i data-lucide="hard-hat" aria-hidden="true"></i> <strong>Budowa:</strong> <span style="font-weight:500">${o.investName}</span></div>` : ''}
                </div>`
                        : ''
                }
            </div>
            <div class="offer-actions">
                <button class="btn btn-sm btn-primary" onclick="loadSavedOfferStudnie('${oId}')" title="Wczytaj" style="font-size:0.72rem; padding:0.3rem 0.6rem;">Wczytaj</button>
                <button class="btn btn-sm btn-secondary" style="font-size:0.72rem; padding:0.3rem 0.6rem; background: rgba(var(--danger-rgb), 0.15); border: 1px solid rgba(var(--danger-rgb), 0.3); color: var(--danger-hover); font-weight: 700;" onclick="window.showUniversalPrintModal('${oId}')" title="Drukuj ofertę / kartę budowy"><i data-lucide="printer" aria-hidden="true"></i> Drukuj</button>
                <button class="btn btn-sm btn-secondary" onclick="exportJSONStudnie('${oId}')" title="Pobierz plik JSON" style="font-size:0.72rem; padding:0.3rem 0.6rem;"><i data-lucide="save" aria-hidden="true"></i> JSON</button>
                ${currentUser && (currentUser.role === 'admin' || currentUser.role === 'pro') ? `<button class="btn btn-sm btn-secondary" onclick="changeOfferUserFromListStudnie('${oId}')" title="Zmień opiekuna" style="font-size:0.72rem; padding:0.3rem 0.6rem;"><i data-lucide="user" aria-hidden="true"></i> Opiekun</button>` : ''}
                ${o.history && o.history.length > 0 ? `<button class="btn btn-sm btn-secondary" onclick="showOfferHistoryStudnie('${oId}')" title="Historia zmian" style="font-size:0.72rem; padding:0.3rem 0.6rem;"><i data-lucide="hourglass" aria-hidden="true"></i> Historia</button>` : ''}
                <button class="btn btn-sm btn-danger" onclick="deleteOfferStudnie('${oId}')" title="Usuń" style="font-size:0.72rem; padding:0.3rem 0.6rem;"><i data-lucide="trash-2" aria-hidden="true"></i> Usuń</button>
                ${
                    hasOrder
                        ? (() => {
                              const offerOrders = getOrdersForOffer(oId);
                              let buttonsHtml = '';
                              offerOrders.forEach((order) => {
                                  buttonsHtml += `
                                    <button class="btn btn-sm" style="background:rgba(var(--success-rgb),0.15); border:1px solid rgba(var(--success-rgb),0.3); color:var(--success-hover); font-size:0.68rem; font-weight:800; padding:0.25rem 0.5rem;" onclick="window.location.href='studnie.html?order=${order.id}'" title="Otwórz zamówienie ${order.orderNumber || ''}"><i data-lucide="package" aria-hidden="true"></i> Zamówienie ${order.orderNumber || ''}</button>
                                    <button class="btn btn-sm" style="background:rgba(var(--danger-rgb),0.1); border:1px solid rgba(var(--danger-rgb),0.2); color:var(--danger-hover); font-size:0.6rem; padding:0.25rem 0.4rem;" onclick="deleteOrderStudnie('${order.id}')" title="Usuń zamówienie ${order.orderNumber || ''}"><i data-lucide="trash-2"></i></button>
                                `;
                              });
                              return buttonsHtml;
                          })()
                        : ''
                }
            </div>
        </div>
        `;
        })
        .join('');
}
