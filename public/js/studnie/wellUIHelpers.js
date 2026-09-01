// @ts-check
/* ===== HELPERY UI STUDNI ===== */
/* renderDiscountPanel — panel rabatów i podsumowania w sidebarze */
/* Zależności: wells, wellDiscounts, calcWellStats, studnieProducts, fmtInt, updateDiscount, updateGlobalPehdDiscount, updateGlobalPaintingCost, getPehdEffectiveArea (globalne) */

// Cache dla orderChanges — ten sam w ofercie i zamówieniu, liczony raz na tick
let _orderChangesCache = null;
let _orderChangesCacheWells = null;
let _orderChangesCacheOrderId = null;
function _getOrderChangesCached() {
    try {
        if (typeof orderEditMode === 'undefined' || !orderEditMode || !orderEditMode.order)
            return {};
        if (typeof getOrderChanges !== 'function') return {};
        const orderId = orderEditMode.orderId || orderEditMode.order?.id || '';
        if (
            _orderChangesCache &&
            _orderChangesCacheWells === wells &&
            _orderChangesCacheOrderId === orderId
        ) {
            return _orderChangesCache;
        }
        const res = getOrderChanges({ ...orderEditMode.order, wells: wells });
        _orderChangesCache = res || {};
        _orderChangesCacheWells = wells;
        _orderChangesCacheOrderId = orderId;
        return _orderChangesCache;
    } catch (_e) {
        return {};
    }
}

function renderDiscountPanel() {
    const panel = document.getElementById('wells-discount-panel');
    if (!panel) return;

    const dktCap = [1000, 1200, 1500, 2000, 2500, 'styczna'];
    const activeDNs = dktCap.filter((dn) => wells.some((w) => w.dn === dn));

    if (activeDNs.length === 0) {
        panel.innerHTML =
            '<div class="discount-empty"><i data-lucide="banknote" style="width:20px;height:20px;opacity:0.5;display:block;margin:0 auto 0.4rem;"></i>Brak studni.<br>Dodaj studnię aby ustawić rabaty.</div>';
        if (typeof lucide !== 'undefined' && lucide.createIcons)
            lucide.createIcons({ root: panel });
        return;
    }

    let grandTotal = 0;
    let grandDiscounted = 0;

    let html =
        '<div class="discount-header"><i data-lucide="banknote" style="width:14px;height:14px;"></i> Rabaty i podsumowanie</div>';

    activeDNs.forEach((dn) => {
        const groupWells = wells.filter((w) => w.dn === dn);
        const discountDn = dn === 'styczna' ? 'styczne' : dn;
        let dennicaBaseSum = 0;
        let nadbudowaBaseSum = 0;
        let dennicaAfterSum = 0;
        let nadbudowaAfterSum = 0;
        groupWells.forEach((w) => {
            const s = calcWellStats(w);
            dennicaBaseSum += s.priceDennicaBase;
            nadbudowaBaseSum += s.priceNadbudowaBase;
            dennicaAfterSum += s.priceDennica;
            nadbudowaAfterSum += s.priceNadbudowa;
        });
        const totalDN = dennicaBaseSum + nadbudowaBaseSum;
        const disc = wellDiscounts[discountDn] || { dennica: 0, nadbudowa: 0, preco: 0, pehd: 0 };
        const totalAfter = dennicaAfterSum + nadbudowaAfterSum;

        const korpusClasses = [
            ...new Set(
                groupWells.map((w) => w.klasaNosnosci_korpus).filter((k) => k && k !== 'D400')
            )
        ];
        const zwienczenieClasses = [
            ...new Set(
                groupWells.map((w) => w.klasaNosnosci_zwienczenie).filter((k) => k && k !== 'D400')
            )
        ];

        grandTotal += totalDN;
        grandDiscounted += totalAfter;

        const dnLabel = dn === 'styczna' ? 'Studnia Styczna' : 'DN' + dn;
        const hasPrecoInGroup = groupWells.some(
            (w) => w.kineta === 'preco' || w.kineta === 'precotop'
        );

        html += '<div class="discount-card">';
        html +=
            '<div class="discount-card-head"><span class="discount-card-title">' +
            dnLabel +
            '</span><span class="discount-card-count">' +
            groupWells.length +
            ' szt.</span></div>';
        html += '<div class="discount-grid">';
        html +=
            '<span class="discount-label">Dennica / Baza</span><div class="discount-input-wrap"><input type="number" min="0" max="100" step="0.5" value="' +
            (disc.dennica || 0) +
            '" id="disc-' +
            discountDn +
            '-dennica" class="discount-input" onclick="this.select()" onchange="updateDiscount(\'' +
            discountDn +
            "','dennica',this.value)\" aria-label=\"Rabat dennica " +
            dnLabel +
            '"><span class="discount-suffix">%</span></div>';
        html +=
            '<span class="discount-label">Nadbudowa</span><div class="discount-input-wrap"><input type="number" min="0" max="100" step="0.5" value="' +
            (disc.nadbudowa || 0) +
            '" id="disc-' +
            discountDn +
            '-nadbudowa" class="discount-input" onclick="this.select()" onchange="updateDiscount(\'' +
            discountDn +
            "','nadbudowa',this.value)\" aria-label=\"Rabat nadbudowa " +
            dnLabel +
            '"><span class="discount-suffix">%</span></div>';

        korpusClasses.forEach((cls) => {
            const isAccent = true;
            html += '<div class="discount-section" style="grid-column:1/-1"></div>';
            html +=
                '<div style="grid-column:1/-1" class="discount-section-title ' +
                (isAccent ? 'discount-section-title--accent' : 'discount-section-title--warn') +
                '"><span class="discount-dot ' +
                (isAccent ? 'discount-dot--accent' : 'discount-dot--warn') +
                '"></span>Korpus ' +
                cls +
                '</div>';
            html +=
                '<span class="discount-label discount-label--accent">Korpus ' +
                cls +
                ' Dennica/Kineta</span><div class="discount-input-wrap"><input type="number" min="0" max="100" step="0.5" value="' +
                (disc['dennica' + cls] || 0) +
                '" id="disc-' +
                discountDn +
                '-dennica' +
                cls +
                '" class="discount-input" onclick="this.select()" onchange="updateDiscount(\'' +
                discountDn +
                "','dennica" +
                cls +
                '\',this.value)" aria-label="Rabat dennica ' +
                cls +
                ' ' +
                dnLabel +
                '"><span class="discount-suffix">%</span></div>';
            html +=
                '<span class="discount-label discount-label--accent">Korpus ' +
                cls +
                ' Nadbudowa</span><div class="discount-input-wrap"><input type="number" min="0" max="100" step="0.5" value="' +
                (disc['nadbudowa' + cls] || 0) +
                '" id="disc-' +
                discountDn +
                '-nadbudowa' +
                cls +
                '" class="discount-input" onclick="this.select()" onchange="updateDiscount(\'' +
                discountDn +
                "','nadbudowa" +
                cls +
                '\',this.value)" aria-label="Rabat nadbudowa ' +
                cls +
                ' ' +
                dnLabel +
                '"><span class="discount-suffix">%</span></div>';
        });

        zwienczenieClasses.forEach((cls) => {
            const dotCls = cls === 'E600' ? 'discount-dot--accent' : 'discount-dot--warn';
            const titleCls =
                cls === 'E600' ? 'discount-section-title--accent' : 'discount-section-title--warn';
            // jeśli korpus już dodał sekcję dla tego cls, nie duplikuj nagłówka — ale zwienczenie to osobna linia
            const alreadyHasHeader = korpusClasses.includes(cls);
            if (!alreadyHasHeader) {
                html += '<div class="discount-section" style="grid-column:1/-1"></div>';
                html +=
                    '<div style="grid-column:1/-1" class="discount-section-title ' +
                    titleCls +
                    '"><span class="discount-dot ' +
                    dotCls +
                    '"></span>Klasa ' +
                    cls +
                    '</div>';
            }
            html +=
                '<span class="discount-label ' +
                (cls === 'E600' ? 'discount-label--accent' : 'discount-label--warn') +
                '">Zako\u0144czenie ' +
                cls +
                '</span><div class="discount-input-wrap"><input type="number" min="0" max="100" step="0.5" value="' +
                (disc['zwienczenie' + cls] || 0) +
                '" id="disc-' +
                discountDn +
                '-zwienczenie' +
                cls +
                '" class="discount-input" onclick="this.select()" onchange="updateDiscount(\'' +
                discountDn +
                "','zwienczenie" +
                cls +
                '\',this.value)" aria-label="Rabat zako\u0144czenie ' +
                cls +
                ' ' +
                dnLabel +
                '"><span class="discount-suffix">%</span></div>';
        });

        if (hasPrecoInGroup) {
            html +=
                '<span class="discount-label discount-label--danger">Wk\u0142adka PRECO</span><div class="discount-input-wrap"><input type="number" min="0" max="100" step="0.5" value="' +
                (disc.preco || 0) +
                '" id="disc-' +
                discountDn +
                '-preco" class="discount-input discount-input--danger" onclick="this.select()" onchange="updateDiscount(\'' +
                discountDn +
                "','preco',this.value)\" aria-label=\"Rabat PRECO " +
                dnLabel +
                '"><span class="discount-suffix discount-suffix--danger">%</span></div>';
        }

        html += '</div>';
        const isDiscounted = totalAfter < totalDN;
        html +=
            '<div class="discount-card-foot"><span class="discount-foot-label">Po rabacie:</span><span class="discount-foot-value ' +
            (isDiscounted ? 'discount-foot-value--discounted' : 'discount-foot-value--plain') +
            '">' +
            fmtInt(totalAfter) +
            ' PLN</span></div>';
        html += '</div>';
    });

    // Sekcja wkładki PEHD (globalna)
    const anyPehd = wells.some(
        (w) =>
            (w.wkladkaDennica && w.wkladkaDennica !== 'brak') ||
            (w.wkladkaNadbudowa && w.wkladkaNadbudowa !== 'brak') ||
            (w.wkladkaZwienczenie && w.wkladkaZwienczenie !== 'brak')
    );
    if (anyPehd) {
        const pehdDiscountValue = wells[0] && wells[0].pehdDiscount ? wells[0].pehdDiscount : 0;
        let currentPehdPrice = 0;
        for (const p of studnieProducts) {
            if (
                p.area > 0 &&
                p.doplataPEHD > 0 &&
                p.componentType !== 'przejscie' &&
                p.componentType !== 'kineta' &&
                p.componentType !== 'konus'
            ) {
                currentPehdPrice = Math.round(p.doplataPEHD / getPehdEffectiveArea(p));
                break;
            }
        }
        const currentPehdPriceAfter = currentPehdPrice * (1 - pehdDiscountValue / 100);

        html += '<div class="discount-card discount-card--pehd">';
        html +=
            '<div class="discount-card-head"><span class="discount-card-title discount-card-title--pehd"><i data-lucide="shield" style="width:14px;height:14px;"></i> Wk\u0142adka PEHD</span><span class="discount-pehd-price">Bazowo: ' +
            currentPehdPrice +
            ' PLN/m²</span></div>';
        html +=
            '<div style="text-align:right; margin-bottom:0.35rem;"><span class="discount-pehd-after" id="sidebar-pehd-price-after">' +
            currentPehdPriceAfter.toFixed(2) +
            ' PLN/m²</span></div>';
        html +=
            '<div class="discount-grid"><span class="discount-label discount-label--blue">Globalny Rabat</span><div class="discount-input-wrap"><input type="number" min="0" step="1" value="' +
            pehdDiscountValue +
            '" id="disc-global-pehd" class="discount-input discount-input--blue" onclick="this.select()" onchange="updateGlobalPehdDiscount(this.value)" aria-label="Globalny rabat PEHD"><span class="discount-suffix discount-suffix--blue">%</span></div></div>';
        html += '</div>';
    }

    // Sekcja kosztów malowania (globalna)
    const anyMalowanieW = wells.some((w) => w.malowanieW && w.malowanieW !== 'brak');
    const anyMalowanieZ = wells.some((w) => w.malowanieZ && w.malowanieZ !== 'brak');

    if (anyMalowanieW || anyMalowanieZ) {
        const refWell = wells[0] || {};
        const malWCena = refWell.malowanieWewCena || '';
        const malZCena = refWell.malowanieZewCena || '';

        html += '<div class="discount-card discount-card--paint">';
        html +=
            '<div class="discount-card-head"><span class="discount-card-title discount-card-title--paint"><i data-lucide="paintbrush" style="width:14px;height:14px;"></i> Koszt malowania</span><span class="discount-pehd-price">PLN / m²</span></div>';
        html += '<div class="discount-grid">';

        if (anyMalowanieW) {
            html +=
                '<span class="discount-label discount-label--purple">Wewn\u0119trzne</span><div class="discount-input-wrap"><input type="number" min="0" step="0.01" value="' +
                malWCena +
                '" id="disc-mal-wew-cena" class="discount-input discount-input--purple" onclick="this.select()" onchange="updateGlobalPaintingCost(\'malowanieWewCena\', this.value)" aria-label="Koszt malowania wewn\u0119trznego"><span class="discount-suffix discount-suffix--purple">z\u0142</span></div>';
        }

        if (anyMalowanieZ) {
            html +=
                '<span class="discount-label discount-label--purple">Zewn\u0119trzne</span><div class="discount-input-wrap"><input type="number" min="0" step="0.01" value="' +
                malZCena +
                '" id="disc-mal-zew-cena" class="discount-input discount-input--purple" onclick="this.select()" onchange="updateGlobalPaintingCost(\'malowanieZewCena\', this.value)" aria-label="Koszt malowania zewn\u0119trznego"><span class="discount-suffix discount-suffix--purple">z\u0142</span></div>';
        }

        html += '</div></div>';
    }

    // Suma całkowita
    const hasDiscount = grandDiscounted < grandTotal;
    html +=
        '<div class="discount-total"><span class="discount-total-label">Suma ca\u0142kowita</span><div class="discount-total-values">';
    if (hasDiscount)
        html += '<span class="discount-total-crossed">' + fmtInt(grandTotal) + ' PLN</span>';
    html +=
        '<span class="discount-total-main">' + fmtInt(grandDiscounted) + ' PLN</span></div></div>';

    panel.innerHTML = html;
    if (typeof lucide !== 'undefined' && lucide.createIcons) lucide.createIcons({ root: panel });
}

/**
 * Wygeneruj HTML karty studni dla listy bocznej.
 * Współdzielone przez wellUI.js i wellVirtual.js dla zachowania 100% spójności wizualnej.
 * @param {any} w Studnia z tablicy wells
 * @param {number} i Indeks studni w tablicy wells (wIdx)
 * @param {number|null} [logicalRow] Indeks logiczny w przefiltrowanej tablicy (opcjonalnie)
 * @param {number} [transportVal] Przeliczona wartość transportu (opcjonalnie)
 * @param {any} [stats] Przeliczone statystyki studni (opcjonalnie)
 */
function _wellBuildCardHtml(w, i, logicalRow, transportVal, stats) {
    if (!w) return '';
    const isActive = typeof currentWellIndex !== 'undefined' && i === currentWellIndex;
    if (!stats && typeof calcWellStats === 'function') stats = calcWellStats(w);
    if (!stats) stats = { price: 0, weight: 0, height: 0 };

    const hasElevations = w.rzednaWlazu != null && w.rzednaDna != null;
    const requiredH = hasElevations ? Math.round((w.rzednaWlazu - w.rzednaDna) * 1000) : null;

    if (transportVal === undefined || transportVal === null) transportVal = 0;

    let changeStyling = '';
    let changeBadge = '';
    const orderChangesObj = _getOrderChangesCached();
    if (orderChangesObj && orderChangesObj[i]) {
        const changeType = orderChangesObj[i].type;
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
                      .map((e) =>
                          (typeof escapeHtml === 'function' ? escapeHtml(e) : String(e)).replace(
                              /"/g,
                              '&quot;'
                          )
                      )
                      .join('; ') +
                  '" class="ml-3"><i data-lucide="alert-triangle"></i></span>'
                : w.configStatus === 'OK'
                  ? '<span class="ml-3"><i data-lucide="check-circle-2"></i></span>'
                  : '';

    let sourceBadge = '';
    if (w.configSource === 'AUTO_AI') {
        sourceBadge =
            '<span title="Dobór AI / ML" style="font-size: var(--fs-base); margin-left:0.3rem; filter: sepia(100%) hue-rotate(160deg) saturate(300%);"><i data-lucide="bot"></i></span>';
    } else if (w.configSource === 'AUTO_JS' || w.configSource === 'AUTO') {
        sourceBadge =
            '<span title="Dobór Automatyczny" style="font-size: var(--fs-base); margin-left:0.3rem; filter: sepia(100%) hue-rotate(30deg) saturate(300%);"><i data-lucide="settings"></i></span>';
    } else {
        sourceBadge =
            '<span title="Dobór Ręczny" style="font-size: var(--fs-base); margin-left:0.3rem; filter: grayscale(1);"><i data-lucide="user"></i></span>';
    }

    let wellLockBadge = '';
    const isLocked = typeof isWellLocked === 'function' ? isWellLocked(i) : false;
    if (isLocked) {
        const wellOrder =
            typeof getOrderForWellId === 'function'
                ? getOrderForWellId(
                      w.id,
                      typeof editingOfferIdStudnie !== 'undefined' ? editingOfferIdStudnie : null
                  )
                : null;
        if (wellOrder && wellOrder.orderNumber) {
            wellLockBadge = `<span title="Studnia na zamówieniu ${typeof escapeHtml === 'function' ? escapeHtml(wellOrder.orderNumber).replace(/"/g, '&quot;') : String(wellOrder.orderNumber)} — kliknij aby otworzyć"
                onclick="event.stopPropagation(); window.location.href='studnie.html?order=${typeof escapeHtml === 'function' ? escapeHtml(wellOrder.id) : String(wellOrder.id)}'"
                style="font-size: var(--fs-3xs); background:rgba(var(--success-rgb), 0.15); color:var(--success-hover); border:1px solid rgba(var(--success-rgb), 0.5); padding:1px 5px; border-radius: var(--radius-2xs); font-weight: var(--fw-extrabold); margin-left:0.3rem; cursor:pointer; display:inline-flex; align-items:center; gap:2px; vertical-align:middle;">
                <i data-lucide="package" style="width:10px; height:10px;"></i>${typeof escapeHtml === 'function' ? escapeHtml(wellOrder.orderNumber) : String(wellOrder.orderNumber)}
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
        const bgRgba = isNeg ? 'rgba(var(--danger-rgb), 0.15)' : 'rgba(var(--success-rgb), 0.15)';
        const borderRgba = isNeg ? 'rgba(var(--danger-rgb), 0.5)' : 'rgba(var(--success-rgb), 0.5)';
        const fmtFn =
            typeof fmt === 'function'
                ? fmt
                : function (n) {
                      return String(n);
                  };
        doplataBadge = `<span title="${badgeLabel}: ${fmtFn(w.doplata)} PLN" style="font-size: var(--fs-2xs); background:${bgRgba}; color:${colorHex}; border:1px solid ${borderRgba}; padding:1px 4px; border-radius: var(--radius-2xs); font-weight: var(--fw-extrabold); margin-left:0.3rem; vertical-align:middle;">${badgeLabel}</span>`;
    }

    const hasErrors = (function () {
        if (!w) return false;
        if (w.rzednaWlazu != null && w.rzednaDna != null) {
            const req = Math.round((w.rzednaWlazu - w.rzednaDna) * 1000);
            if (stats.height - req > 20 || req - stats.height > 100) return true;
        }
        if (
            w.configStatus === 'ERROR' ||
            (w.configErrors && w.configErrors.length > 0 && w.configStatus !== 'OK')
        )
            return true;
        return false;
    })();

    const errorStyling = hasErrors ? ' background:rgba(var(--danger-rgb), 0.15) !important;' : '';
    const errorNameStyle = hasErrors
        ? 'color:var(--danger) !important; font-weight: var(--fw-bold) !important;'
        : '';

    const hasBadges = wellLockBadge || sourceBadge || statusBadge || changeBadge || doplataBadge;
    const badgesHtml = hasBadges
        ? `<div style="display:flex; align-items:center; gap:0.15rem; flex-wrap:wrap; margin-bottom:0.3rem; margin-top:-0.1rem;">
             ${wellLockBadge}${sourceBadge}${statusBadge}${changeBadge}${doplataBadge}
           </div>`
        : '';

    const hasUwagi = !!(w.uwagi && String(w.uwagi).trim());
    const escAttr =
        typeof escapeHtmlAttr === 'function'
            ? escapeHtmlAttr
            : function (s) {
                  return String(s);
              };
    const escFn =
        typeof escapeHtml === 'function'
            ? escapeHtml
            : function (s) {
                  return String(s);
              };
    const fmtIntFn =
        typeof fmtInt === 'function'
            ? fmtInt
            : function (n) {
                  return String(n);
              };

    const uwagiTitle = hasUwagi
        ? `Uwagi: ${escAttr(String(w.uwagi).slice(0, 80))}${String(w.uwagi).length > 80 ? '…' : ''} — kliknij aby edytować`
        : 'Dodaj uwagi do studni';

    const logRowAttr =
        logicalRow !== undefined && logicalRow !== null ? ` data-logical-row="${logicalRow}"` : '';

    const minH = hasElevations ? 104 : 76;
    let html = `<div class="well-list-item ${isActive ? 'active' : ''}" data-widx="${i}" data-well-idx="${i}"${logRowAttr} style="min-height:${minH}px;box-sizing:border-box;${changeStyling}${isLocked ? ' opacity:0.7;' : ''}${errorStyling}" onclick="selectWell(${i})">
      <div class="well-list-header" style="display:flex; align-items:center; gap:0.4rem; ${hasBadges ? 'margin-bottom:0.2rem;' : ''}">
        <div class="well-list-name" style="flex:1; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; ${errorNameStyle}" title="${escFn(w.name || '').replace(/"/g, '&quot;')}">${escFn(w.name || '')}</div>
        <div class="well-list-actions">
          <button class="well-list-action ${hasUwagi ? 'has-uwagi' : ''}" title="${uwagiTitle}" aria-label="Uwagi" onclick="event.stopPropagation(); openWellNotesModal(${i})"><i data-lucide="file-text" aria-hidden="true"></i></button>
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
        <span class="well-list-price">${fmtIntFn(stats.price + transportVal)} PLN</span>
      </div>`;

    if (hasElevations) {
        html += `<div class="well-list-elevations">
          <span>↑ <strong>${Number(w.rzednaWlazu).toFixed(3)}</strong></span>
          <span>↓ <strong>${Number(w.rzednaDna).toFixed(3)}</strong></span>
          <span style="margin-left:auto;">H=<strong>${requiredH}</strong>mm</span>
        </div>`;
    }
    html += `</div>`;
    return html;
}

window.renderDiscountPanel = renderDiscountPanel;
window._wellBuildCardHtml = _wellBuildCardHtml;
