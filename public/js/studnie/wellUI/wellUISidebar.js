// @ts-check
/* ===== WELL UI — Lista boczna, podsumowanie, zakładki ===== */

/** Przełącznik zakładek paska bocznego (Lista vs Rabaty) */
function switchSidebarTab(tabName) {
    const listContent = document.getElementById('sidebar-list-content');
    const discContent = document.getElementById('sidebar-discounts-content');
    const tabList = document.getElementById('stab-list');
    const tabDisc = document.getElementById('stab-discounts');

    if (!listContent || !discContent || !tabList || !tabDisc) return;

    if (tabName === 'list') {
        listContent.style.display = 'flex';
        discContent.style.display = 'none';
        tabList.classList.add('active');
        tabDisc.classList.remove('active');
    } else {
        listContent.style.display = 'none';
        discContent.style.display = 'flex';
        tabList.classList.remove('active');
        tabDisc.classList.add('active');
    }
}

function switchBuilderTab(tab) {
    const btabConcrete = document.getElementById('btab-concrete');
    const btabTransitions = document.getElementById('btab-transitions');
    const bcontentConcrete = document.getElementById('bcontent-concrete');
    const bcontentTransitions = document.getElementById('bcontent-transitions');

    if (btabConcrete) btabConcrete.classList.toggle('active', tab === 'concrete');
    if (btabTransitions) btabTransitions.classList.toggle('active', tab === 'transitions');
    if (bcontentConcrete) bcontentConcrete.style.display = tab === 'concrete' ? 'block' : 'none';
    if (bcontentTransitions)
        bcontentTransitions.style.display = tab === 'transitions' ? 'block' : 'none';

    if (tab === 'transitions') {
        if (typeof renderInlinePrzejsciaApp === 'function') renderInlinePrzejsciaApp();
        if (typeof renderWellPrzejscia === 'function') renderWellPrzejscia();
        const przejsciaContainer = document.getElementById('inline-przejscia-app-container');
        const przejsciaIcon = document.getElementById('przejscia-app-icon');
        if (przejsciaContainer && przejsciaContainer.style.display === 'none') {
            przejsciaContainer.style.display = 'block';
            if (przejsciaIcon)
                przejsciaIcon.innerHTML =
                    '<span class="text-xs"><i data-lucide="chevron-up"></i></span>';
            if (window.lucide) window.lucide.createIcons({ root: przejsciaIcon });
        }
    }
}

window.switchSidebarTab = switchSidebarTab;
window.switchBuilderTab = switchBuilderTab;

/* ===== RENDEROWANIE LISTY STUDNI ===== */
window.renderWellsList = function renderWellsList() {
    const container = document.getElementById('wells-list');
    if (!container) return;

    // Przelicz bezwzględnie wszystkie studnie z tła, aby uzyskać aktualne błędy grubości rur / luzów
    wells.forEach((w) => recalculateWellErrors(w));

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
        html += `<div style="font-size:0.68rem; color:var(--text-muted); text-transform:uppercase; margin: 0.8rem 0 0.35rem 0.3rem; letter-spacing:0.8px; font-weight:800; opacity:0.7;">${groupTitle}</div>`;

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
                        'border-left: 3px solid #10b981; background: rgba(16,185,129,0.05);';
                    changeBadge =
                        '<span style="font-size:0.6rem; color:#10b981; font-weight:700; margin-left:0.3rem;">[NOWA]</span>';
                } else if (changeType === 'modified') {
                    changeStyling =
                        'border-left: 3px solid #ef4444; background: rgba(239,68,68,0.05);';
                    changeBadge =
                        '<span style="font-size:0.6rem; color:#ef4444; font-weight:700; margin-left:0.3rem;">[ZMIENIONA]</span>';
                }
            }

            const statusBadge =
                w.configStatus === 'LOADING'
                    ? '<span title="Trwa auto-dobór..." style="margin-left:0.3rem;"><span class="loading-spinner-inline"></span></span>'
                    : w.configStatus === 'ERROR'
                      ? '<span title="Błąd konfiguracji" style="margin-left:0.3rem;"><i data-lucide="x-circle"></i></span>'
                      : w.configStatus === 'WARNING'
                        ? '<span title="' +
                          (w.configErrors || []).map((e) => escapeHtml(e)).join('; ') +
                          '" style="margin-left:0.3rem;"><i data-lucide="alert-triangle"></i></span>'
                        : w.configStatus === 'OK'
                          ? '<span style="margin-left:0.3rem;"><i data-lucide="check-circle-2"></i></span>'
                          : '';

            // Ikona źródła konfiguracji
            let sourceBadge = '';
            if (w.configSource === 'AUTO_JS' || w.configSource === 'AUTO_AI') {
                sourceBadge =
                    '<span title="Dobór Automatyczny" style="font-size:0.75rem; margin-left:0.3rem; filter: sepia(100%) hue-rotate(30deg) saturate(300%);"><i data-lucide="settings"></i></span>';
            } else {
                sourceBadge =
                    '<span title="Dobór Ręczny" style="font-size:0.75rem; margin-left:0.3rem; filter: grayscale(1);"><i data-lucide="hand"></i></span>';
            }

            let errorsHtml = '';
            if (w.configErrors && w.configErrors.length > 0) {
                const color = w.configStatus === 'ERROR' ? '#ef4444' : '#f59e0b';
                errorsHtml = `<div style="font-size:0.65rem; color:${color}; padding:0.2rem 0; line-height:1.2;">${w.configErrors.map((e) => escapeHtml(e)).join('<br>')}</div>`;
            }

            let wellLockBadge = '';
            if (isWellLocked(i)) {
                // Sprawdź, czy blokada pochodzi z zamówienia (pokaż numer zamówienia)
                const wellOrder =
                    typeof getOrderForWellId === 'function'
                        ? getOrderForWellId(w.id, editingOfferIdStudnie)
                        : null;
                if (wellOrder && wellOrder.orderNumber) {
                    wellLockBadge = `<span title="Studnia na zamówieniu ${wellOrder.orderNumber} — kliknij aby otworzyć"
                        data-action="navigateToOrderWell" data-order-id="${wellOrder.id}"
                        style="font-size:0.55rem; background:rgba(16,185,129,0.15); color:#34d399; border:1px solid rgba(16,185,129,0.4); padding:1px 5px; border-radius:4px; font-weight:800; margin-left:0.3rem; cursor:pointer; display:inline-flex; align-items:center; gap:2px; vertical-align:middle;">
                        <i data-lucide="package" style="width:10px; height:10px;"></i>${wellOrder.orderNumber}
                    </span>`;
                } else {
                    wellLockBadge =
                        '<span title="Studnia zablokowana — zaakceptowane zlecenie produkcyjne" style="font-size:0.75rem; margin-left:0.3rem;"><i data-lucide="lock"></i></span>';
                }
            }

            let doplataBadge = '';
            if (w.doplata && w.doplata !== 0) {
                const isNeg = w.doplata < 0;
                const badgeLabel = isNeg ? 'UPUST' : 'DOPŁATA';
                const colorHex = isNeg ? '#ef4444' : '#10b981';
                const bgRgba = isNeg ? 'rgba(239,68,68,0.15)' : 'rgba(16,185,129,0.15)';
                const borderRgba = isNeg ? 'rgba(239,68,68,0.4)' : 'rgba(16,185,129,0.4)';
                doplataBadge = `<span title="${badgeLabel}: ${fmt(w.doplata)} PLN" style="font-size:0.6rem; background:${bgRgba}; color:${colorHex}; border:1px solid ${borderRgba}; padding:1px 4px; border-radius:3px; font-weight:800; margin-left:0.3rem; vertical-align:middle;">${badgeLabel}</span>`;
            }

            // Automatyczne sprawdzenie w locie dla wszystkich kart
            const hasErrors = validateAutomatedErrors(w);

            const errorStyling = hasErrors
                ? ' border:2px solid #ef4444 !important; background:rgba(239,68,68,0.15) !important;'
                : '';
            const errorNameStyle = hasErrors
                ? 'color:#ef4444 !important; font-weight:700 !important;'
                : '';

            const hasBadges =
                wellLockBadge || sourceBadge || statusBadge || changeBadge || doplataBadge;
            const badgesHtml = hasBadges
                ? `
              <div style="display:flex; align-items:center; gap:0.15rem; flex-wrap:wrap; margin-bottom:0.3rem; margin-top:-0.1rem;">
                 ${wellLockBadge}${sourceBadge}${statusBadge}${changeBadge}${doplataBadge}
              </div>`
                : '';

            html += `<div class="well-list-item ${isActive ? 'active' : ''}" style="${changeStyling}${isWellLocked(i) ? ' opacity:0.7;' : ''}${errorStyling}" data-action="selectWell" data-well-index="${i}">
              <div class="well-list-header" style="display:flex; align-items:center; gap:0.4rem; ${hasBadges ? 'margin-bottom:0.2rem;' : ''}">
                <div class="well-list-name" style="flex:1; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; ${errorNameStyle}" title="${escapeHtml(w.name)}">${escapeHtml(w.name)}</div>
                <div class="well-list-actions">
                  <button class="well-list-action" title="Duplikuj" aria-label="Duplikuj" data-action="duplicateWell" data-well-index="${i}"><i data-lucide="clipboard-list" aria-hidden="true"></i></button>
                  <button class="well-list-action del" title="Usuń" aria-label="Usuń" data-action="removeWell" data-well-index="${i}"><i data-lucide="x" aria-hidden="true"></i></button>
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
        html = `<div style="padding:2rem; text-align:center; color:var(--text-muted); font-size:0.85rem;">Brak dodanych studni.<br>Wybierz średnicę z przycisków powyżej.</div>`;
    }

    container.innerHTML = html;

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
            priceEl.style.color = 'var(--danger, #ef4444)';
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
            diffColor = '#f87171'; // czerwony
        } else if (diff < 0) {
            diffMmText = '+' + fmtInt(Math.abs(diff)) + ' mm';
            diffColor = '#facc15'; // żółty/pomarańczowy
        } else {
            diffMmText = 'OK';
            diffColor = '#4ade80'; // zielony
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
            wsPrice.style.color = 'var(--danger, #ef4444)';
        } else {
            wsPrice.textContent = fmt(finalPrice);
            wsPrice.style.color = '';
        }
    }

    // Height indicator
    updateHeightIndicator();

    if (typeof registerCspAction === 'function') {
        registerCspAction('selectWell', {
            handler: function ({ wellIndex }) {
                selectWell(parseInt(wellIndex, 10));
            },
            params: ['wellIndex']
        });
    }

    // Odśwież panel boczny z cenami studni (aby cena była zawsze aktualna)
    // Guard: pomijaj jeśli renderWellsList jest już w trakcie (np. z refreshAll)
    if (typeof renderWellsList === 'function' && !window._renderingWellsList) {
        window._renderingWellsList = true;
        renderWellsList();
        window._renderingWellsList = false;
    }
};

if (typeof registerCspAction === 'function') {
    registerCspAction('updateDiscount', function (t) {
        updateDiscount(t.dataset.dn, t.dataset.component, t.value);
    });
    registerCspAction('updateGlobalPehdDiscount', function (t) {
        updateGlobalPehdDiscount(t.value);
    });
    registerCspAction('updateGlobalPaintingCost', function (t) {
        updateGlobalPaintingCost(t.dataset.field, t.value);
    });
    registerCspAction('updateWellParam', function (t) {
        let v = t.value;
        if (
            t.dataset.field === 'malowanieWewCena' ||
            t.dataset.field === 'malowanieZewCena' ||
            t.dataset.field === 'wkladkaOsadnikH'
        )
            v = parseFloat(v) || 0;
        updateWellParam(t.dataset.field, v);
    });
    registerCspAction('updateWellParamQuick', function (t) {
        updateWellParam(t.dataset.field, t.dataset.val);
    });
    registerCspAction('navigateToOrderWell', {
        handler: function ({ orderId }) {
            window.location.href = 'studnie.html?order=' + orderId;
        },
        params: ['orderId']
    });
    registerCspAction('duplicateWell', {
        handler: function ({ wellIndex }) {
            duplicateWell(parseInt(wellIndex, 10));
        },
        params: ['wellIndex']
    });
    registerCspAction('removeWell', {
        handler: function ({ wellIndex }) {
            removeWell(parseInt(wellIndex, 10));
        },
        params: ['wellIndex']
    });
}
