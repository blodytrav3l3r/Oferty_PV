// @ts-check
/* ===== WELL UI RENDERING (WRAPPER) ===== */
/* UI modules extracted to: uiLockBanners.js, uiParamTiles.js, uiWellParams.js, uiTabSwitcher.js */

/* ===== RENDEROWANIE LISTY STUDNI ===== */
window.renderWellsList = function renderWellsList() {
    const container = document.getElementById('wells-list');
    if (!container) return;

    // Przelicz bezwzględnie wszystkie studnie z tła, aby uzyskać aktualne błędy grubości rur / luzów
    refreshAllWellErrors();

    // Funkcja szybkoskanująca uchybienia studni (luzy, braki wysokości), aktualizując obiekt przed wyrysowaniem
    const validateAutomatedErrors = (well) => {
        if (!well) return false;
        let isError = false;

        // 1. Sprawdzamy wysokość
        if (well.rzednaWlazu != null && well.rzednaDna != null) {
            const req = Math.round((well.rzednaWlazu - well.rzednaDna) * 1000);
            const stats = calcWellStats(well);
            if (stats.height - req > 20 || req - stats.height > 100) isError = true;
        }

        // 2. Status 'ERROR' nakazany przez główną funkcję updateHeightIndicator lub backend OR-TOOLS
        if (
            well.configStatus === 'ERROR' ||
            (well.configErrors && well.configErrors.length > 0 && well.configStatus !== 'OK')
        ) {
            isError = true;
        }

        return isError;
    };

    const searchTerm = (document.getElementById('wells-search-input')?.value || '')
        .toLowerCase()
        .trim();

    let html = '';
    const dktCap = [1000, 1200, 1500, 2000, 2500, 'styczna'];

    // Oblicz mapę transportu dla wszystkich studni (proporcjonalnie do wagi)
    let transportMap = new Map();
    if (typeof calculateWellTransportMap === 'function') {
        const result = calculateWellTransportMap(wells);
        transportMap = result.map;
    }

    // Sprawdź zmiany w zamówieniu, jeśli w trybie edycji
    let orderChanges = {};
    if (orderEditMode) {
        orderChanges = getOrderChanges({ ...orderEditMode.order, wells: wells });
    }

    dktCap.forEach((dnGroup) => {
        const groupWells = wells
            .map((w, i) => ({ w, i }))
            .filter((item) => {
                const matchesDN = item.w.dn === dnGroup;
                const matchesSearch = !searchTerm || item.w.name.toLowerCase().includes(searchTerm);
                return matchesDN && matchesSearch;
            });
        if (groupWells.length === 0) return;

        const groupTitle = dnGroup === 'styczna' ? 'Studnie Styczne' : `Studnie DN${dnGroup}`;
        html += `<div style="font-size: var(--fs-xs); color:var(--text-muted); text-transform:uppercase; margin: 0.8rem 0 0.35rem 0.3rem; letter-spacing:0.8px; font-weight: var(--fw-extrabold); opacity:0.7;">${groupTitle}</div>`;

        groupWells.forEach(({ w, i }) => {
            const isActive = i === currentWellIndex;
            const stats = calcWellStats(w);
            const hasElevations = w.rzednaWlazu != null && w.rzednaDna != null;
            const requiredH = hasElevations
                ? Math.round((w.rzednaWlazu - w.rzednaDna) * 1000)
                : null;

            let changeStyling = '';
            let changeBadge = '';
            if (orderEditMode && orderChanges[i]) {
                const changeType = orderChanges[i].type;
                if (changeType === 'added') {
                    changeStyling =
                        'border-left: 3px solid var(--success); background: rgba(var(--success-rgb), 0.05);';
                    changeBadge =
                        '<span style="font-size: var(--fs-2xs); color:var(--success); font-weight: var(--fw-bold); margin-left:0.3rem;">[NOWA]</span>';
                } else if (changeType === 'modified') {
                    changeStyling =
                        'border-left: 3px solid var(--danger); background: rgba(var(--danger-rgb), 0.05);';
                    changeBadge =
                        '<span style="font-size: var(--fs-2xs); color:var(--danger); font-weight: var(--fw-bold); margin-left:0.3rem;">[ZMIENIONA]</span>';
                }
            }

            const statusBadge =
                w.configStatus === 'LOADING'
                    ? '<span title="Trwa auto-dobór..." class="ml-3"><span class="loading-spinner-inline"></span></span>'
                    : w.configStatus === 'ERROR'
                      ? '<span title="Błąd konfiguracji" class="ml-3"><i data-lucide="x-circle"></i></span>'
                      : w.configStatus === 'WARNING'
                        ? '<span title="' +
                          (w.configErrors || [])
                              .map((e) => escapeHtml(e).replace(/"/g, '&quot;'))
                              .join('; ') +
                          '" class="ml-3"><i data-lucide="alert-triangle"></i></span>'
                        : w.configStatus === 'OK'
                          ? '<span class="ml-3"><i data-lucide="check-circle-2"></i></span>'
                          : '';

            // Ikona źródła konfiguracji
            let sourceBadge = '';
            if (w.configSource === 'AUTO_AI') {
                sourceBadge =
                    '<span title="Dobór AI / ML" style="font-size: var(--fs-base); margin-left:0.3rem; filter: sepia(100%) hue-rotate(160deg) saturate(300%);"><i data-lucide="bot"></i></span>';
            } else if (w.configSource === 'AUTO_JS' || w.configSource === 'AUTO') {
                sourceBadge =
                    '<span title="Dobór Automatyczny" style="font-size: var(--fs-base); margin-left:0.3rem; filter: sepia(100%) hue-rotate(30deg) saturate(300%);"><i data-lucide="settings"></i></span>';
            } else {
                sourceBadge =
                    '<span title="Dobór Ręczny" style="font-size: var(--fs-base); margin-left:0.3rem; filter: grayscale(1);"><i data-lucide="hand"></i></span>';
            }

            let wellLockBadge = '';
            if (isWellLocked(i)) {
                // Sprawdź, czy blokada pochodzi z zamówienia (pokaż numer zamówienia)
                const wellOrder =
                    typeof getOrderForWellId === 'function'
                        ? getOrderForWellId(w.id, editingOfferIdStudnie)
                        : null;
                if (wellOrder && wellOrder.orderNumber) {
                    wellLockBadge = `<span title="Studnia na zamówieniu ${escapeHtml(wellOrder.orderNumber).replace(/"/g, '&quot;')} — kliknij aby otworzyć"
                        onclick="event.stopPropagation(); window.location.href='studnie.html?order=${escapeHtml(wellOrder.id)}'"
                        style="font-size: var(--fs-3xs); background:rgba(var(--success-rgb), 0.15); color:var(--success-hover); border:1px solid rgba(var(--success-rgb), 0.5); padding:1px 5px; border-radius: var(--radius-2xs); font-weight: var(--fw-extrabold); margin-left:0.3rem; cursor:pointer; display:inline-flex; align-items:center; gap:2px; vertical-align:middle;">
                        <i data-lucide="package" style="width:10px; height:10px;"></i>${escapeHtml(wellOrder.orderNumber)}
                    </span>`;
                } else {
                    wellLockBadge =
                        '<span title="Studnia zablokowana — zaakceptowane zlecenie produkcyjne" style="font-size: var(--fs-base); margin-left:0.3rem;"><i data-lucide="lock"></i></span>';
                }
            }

            let doplataBadge = '';
            if (w.doplata && w.doplata !== 0) {
                const isNeg = w.doplata < 0;
                const badgeLabel = isNeg ? 'UPUST' : 'DOPŁATA';
                const colorHex = isNeg ? 'var(--danger)' : 'var(--success)';
                const bgRgba = isNeg
                    ? 'rgba(var(--danger-rgb), 0.15)'
                    : 'rgba(var(--success-rgb), 0.15)';
                const borderRgba = isNeg
                    ? 'rgba(var(--danger-rgb), 0.5)'
                    : 'rgba(var(--success-rgb), 0.5)';
                doplataBadge = `<span title="${badgeLabel}: ${fmt(w.doplata)} PLN" style="font-size: var(--fs-2xs); background:${bgRgba}; color:${colorHex}; border:1px solid ${borderRgba}; padding:1px 4px; border-radius: var(--radius-2xs); font-weight: var(--fw-extrabold); margin-left:0.3rem; vertical-align:middle;">${badgeLabel}</span>`;
            }

            // Automatyczne sprawdzenie w locie dla wszystkich kart
            const hasErrors = validateAutomatedErrors(w);

            const errorStyling = hasErrors
                ? ' background:rgba(var(--danger-rgb), 0.15) !important;'
                : '';
            const errorNameStyle = hasErrors
                ? 'color:var(--danger) !important; font-weight: var(--fw-bold) !important;'
                : '';

            const hasBadges =
                wellLockBadge || sourceBadge || statusBadge || changeBadge || doplataBadge;
            const badgesHtml = hasBadges
                ? `
              <div style="display:flex; align-items:center; gap:0.15rem; flex-wrap:wrap; margin-bottom:0.3rem; margin-top:-0.1rem;">
                 ${wellLockBadge}${sourceBadge}${statusBadge}${changeBadge}${doplataBadge}
              </div>`
                : '';

            const hasUwagi = !!(w.uwagi && String(w.uwagi).trim());
            const uwagiTitle = hasUwagi
                ? `Uwagi: ${escapeHtmlAttr(String(w.uwagi).slice(0, 80))}${String(w.uwagi).length > 80 ? '…' : ''} — kliknij aby edytować`
                : 'Dodaj uwagi do studni';
            html += `<div class="well-list-item ${isActive ? 'active' : ''}" style="${changeStyling}${isWellLocked(i) ? ' opacity:0.7;' : ''}${errorStyling}" onclick="selectWell(${i})">
              <div class="well-list-header" style="display:flex; align-items:center; gap:0.4rem; ${hasBadges ? 'margin-bottom:0.2rem;' : ''}">
                <div class="well-list-name" style="flex:1; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; ${errorNameStyle}" title="${escapeHtml(w.name).replace(/"/g, '&quot;')}">${escapeHtml(w.name)}</div>
                <div class="well-list-actions">
                  <button class="well-list-action ${hasUwagi ? 'has-uwagi' : ''}" title="${uwagiTitle}" aria-label="Uwagi" onclick="event.stopPropagation(); openWellNotesModal(${i})"><i data-lucide="message-square" aria-hidden="true"></i></button>
                  <button class="well-list-action" title="Duplikuj" aria-label="Duplikuj" onclick="event.stopPropagation(); duplicateWell(${i})"><i data-lucide="clipboard-list" aria-hidden="true"></i></button>
                  <button class="well-list-action del" title="Usuń" aria-label="Usuń" onclick="event.stopPropagation(); removeWell(${i})"><i data-lucide="x" aria-hidden="true"></i></button>
                </div>
              </div>
              ${badgesHtml}
              <div class="well-list-meta">
                <div style="display:flex; gap:0.6rem;">
                  <span>Elementy: <strong>${(w.config || []).length}</strong></span>
                  <span>Przejścia: <strong>${w.przejscia ? w.przejscia.length : 0}</strong></span>
                </div>
                <span class="well-list-price">${fmtInt(stats.price + (transportMap.get(w) || 0))} PLN</span>
              </div>
              ${
                  hasElevations
                      ? `<div class="well-list-elevations">
                <span>↑ <strong>${w.rzednaWlazu.toFixed(3)}</strong></span>
                <span>↓ <strong>${w.rzednaDna.toFixed(3)}</strong></span>
                <span style="margin-left:auto;">H=<strong>${requiredH}</strong>mm</span>
              </div>`
                      : ''
              }
            </div>`;
        });
    });

    if (wells.length === 0) {
        html = `<div style="padding:2rem; text-align:center; color:var(--text-muted); font-size: var(--fs-lg);">Brak dodanych studni.<br>Wybierz średnicę z przycisków powyżej.</div>`;
    }

    container.innerHTML = html;
    if (window.lucide) window.lucide.createIcons({ root: container });

    const counter = document.getElementById('wells-counter');
    if (counter) counter.textContent = `(${wells.length})`;

    renderDiscountPanel();
};

/* ===== PODSUMOWANIE ===== */
window.updateSummary = function updateSummary() {
    const well = getCurrentWell();
    if (!well) {
        const el = (id) => document.getElementById(id);
        const sp = el('sum-price');
        const sw = el('sum-weight');
        const sh = el('sum-height');
        const sai = el('sum-area-int');
        const sae = el('sum-area-ext');
        if (sp) sp.textContent = '0 PLN';
        if (sw) sw.textContent = '0 kg';
        if (sh) sh.textContent = '0 mm';
        if (sai) sai.textContent = '0,00 m²';
        if (sae) sae.textContent = '0,00 m²';

        const wsHeight = document.getElementById('ws-height');
        const wsReq = document.getElementById('ws-req-height');
        const wsDiff = document.getElementById('ws-diff-height');
        const wsPrice = document.getElementById('ws-price');
        if (wsHeight) wsHeight.textContent = '0 mm';
        if (wsReq) wsReq.textContent = '—';
        if (wsDiff) {
            wsDiff.textContent = '—';
            wsDiff.style.color = 'var(--text-muted)';
        }
        if (wsPrice) wsPrice.textContent = '0';

        updateHeightIndicator();
        return;
    }
    const stats = calcWellStats(well);

    let wellTransportCost = 0;
    if (typeof calculateOfferTotals === 'function') {
        const totals = calculateOfferTotals();
        if (totals && totals.globalWeight > 0 && totals.totalTransportCost > 0) {
            wellTransportCost = totals.totalTransportCost * (stats.weight / totals.globalWeight);
        }
    }
    const finalPrice = stats.price + wellTransportCost;

    // Dolny pasek
    const priceEl = document.getElementById('sum-price');
    if (stats.error) {
        if (priceEl) {
            priceEl.textContent = 'BŁĄD';
            priceEl.style.color = 'var(--danger)';
        }
    } else {
        if (priceEl) {
            priceEl.textContent = fmt(finalPrice) + ' PLN';
            priceEl.style.color = '';
        }
    }

    const swEl = document.getElementById('sum-weight');
    const shEl = document.getElementById('sum-height');
    const saiEl = document.getElementById('sum-area-int');
    const saeEl = document.getElementById('sum-area-ext');
    if (swEl) swEl.textContent = fmtInt(stats.weight) + ' kg';
    if (shEl) shEl.textContent = fmtInt(stats.height) + ' mm';
    if (saiEl) saiEl.textContent = fmt(stats.areaInt) + ' m²';
    if (saeEl) saeEl.textContent = fmt(stats.areaExt) + ' m²';

    let reqMmText = '—';
    let diffMmText = '—';
    let diffColor = 'var(--text-muted)';

    const rzWlazu = parseFloat(well.rzednaWlazu);
    const rzDna = isNaN(parseFloat(well.rzednaDna))
        ? isNaN(rzWlazu)
            ? NaN
            : 0
        : parseFloat(well.rzednaDna);

    if (!isNaN(rzWlazu) && !isNaN(rzDna) && rzWlazu > rzDna) {
        const reqMm = Math.round((rzWlazu - rzDna) * 1000);
        reqMmText = fmtInt(reqMm) + ' mm';
        const diff = reqMm - stats.height;

        if (diff > 0) {
            diffMmText = '-' + fmtInt(diff) + ' mm';
            diffColor = 'var(--danger-hover)'; // czerwony
        } else if (diff < 0) {
            diffMmText = '+' + fmtInt(Math.abs(diff)) + ' mm';
            diffColor = 'var(--warn-hover)'; // żółty/pomarańczowy
        } else {
            diffMmText = 'OK';
            diffColor = 'var(--success-hover)'; // zielony
        }
    }

    const wsHeight = document.getElementById('ws-height');
    const wsReq = document.getElementById('ws-req-height');
    const wsDiff = document.getElementById('ws-diff-height');
    const wsPrice = document.getElementById('ws-price');

    if (wsHeight) wsHeight.textContent = fmtInt(stats.height) + ' mm';
    if (wsReq) wsReq.textContent = reqMmText;
    if (wsDiff) {
        wsDiff.textContent = diffMmText;
        wsDiff.style.color = diffColor;
    }
    if (wsPrice) {
        if (stats.error) {
            wsPrice.textContent = 'BŁĄD';
            wsPrice.style.color = 'var(--danger)';
        } else {
            wsPrice.textContent = fmt(finalPrice);
            wsPrice.style.color = '';
        }
    }

    // Height indicator
    updateHeightIndicator();

    // Odśwież panel boczny z cenami studni (aby cena była zawsze aktualna)
    // Guard: pomijaj jeśli renderWellsList jest już w trakcie (np. z refreshAll)
    if (typeof renderWellsList === 'function' && !window._renderingWellsList) {
        window._renderingWellsList = true;
        renderWellsList();
        window._renderingWellsList = false;
    }
};
