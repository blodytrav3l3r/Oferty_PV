// @ts-check
/* ===== TRANSITION MANAGER (MENEDŻER PRZEJŚĆ) ===== */

let tmSelectedTransitions = new Set();
let tmCurrentFilters = { sourceMaterial: [], dn: [], search: '' };
let tmWellData = [];

/* Blokada studni dla menedżera przejść — wzorzec z applyGlobalRecalc (popupsGlobalRecalc.js:346-352).
   isWellLocked pokrywa PZ accepted (zawsze) oraz zamówienie poza orderEditMode,
   ale NIE pokrywa PZ w statusie draft — dlatego dokładamy pzGuard.hasPzForWell. */
function tmIsWellBlocked(wellIdx) {
    const well = wells[wellIdx];
    if (!well) return true;
    if (window.pzGuard && window.pzGuard.hasPzForWell(well.id)) return true;
    return isWellLocked(wellIdx);
}

window.openTransitionManagerModal = function () {
    tmSelectedTransitions = new Set();
    if (!wells || wells.length === 0) {
        showToast('Brak studni w ofercie', 'error');
        return;
    }

    const transitionProducts = studnieProducts.filter((p) => p.componentType === 'przejscie');
    const categories = [...new Set(transitionProducts.map((p) => p.category))].sort();

    if (categories.length === 0) {
        showToast('Brak przejść w cenniku', 'error');
        return;
    }

    tmRefreshWellData();
    tmSelectedTransitions.clear();
    tmCurrentFilters = { sourceMaterial: [], dn: [], search: '' };

    const allMaterials = new Set();
    const allDNs = new Set();

    tmWellData.forEach((w) => {
        w.transitions.forEach((tr) => {
            if (tr.material !== 'Nieznany') allMaterials.add(tr.material);
            allDNs.add(tr.dnRaw);
        });
    });

    const overlay = showModal({
        id: 'transition-manager-modal',
        titleId: 'tm-title',
        html: `
    <div class="modal modal--tm">
      <div class="modal-header">
        <h3 id="tm-title"><i data-lucide="list" aria-hidden="true"></i> Menedżer Przejść</h3>
        <button class="btn-icon" aria-label="Zamknij" data-action="tmCloseTransitionManager"><i data-lucide="x" aria-hidden="true"></i></button>
      </div>
      <div class="tm-filters">
         <div class="tm-filter-group">
            <div class="tm-filter-label"><i data-lucide="layers" aria-hidden="true"></i> Kategoria źródłowa <span class="tm-filter-label-count">${allMaterials.size}</span></div>
            <div id="tm-filter-material-tiles" class="tm-filter-tiles">
               <button type="button" data-val="" data-action="tmSelectFilterMaterial" class="tm-tile active" aria-pressed="true"><i data-lucide="check" class="icon-xxs" aria-hidden="true"></i> Dowolna</button>
${[...allMaterials]
    .sort()
    .map((m) => {
        return `<button type="button" data-val="${escapeHtmlAttr(m)}" data-action="tmSelectFilterMaterial" class="tm-tile" aria-pressed="false">${escapeHtml(m)}</button>`;
    })
    .join('')}
            </div>
         </div>
         <div class="tm-filter-group">
            <label class="tm-filter-label" for="tm-filter-search"><i data-lucide="search" aria-hidden="true"></i> Szukaj</label>
            <div class="tm-search-wrap">
               <i data-lucide="search" aria-hidden="true"></i>
               <input type="text" id="tm-filter-search" class="tm-search-input" placeholder="Nazwa, materiał, DN..." maxlength="30" oninput="tmApplyFilters(); window.tmToggleSearchClear && window.tmToggleSearchClear()" autocomplete="off">
               <button type="button" id="tm-search-clear" class="tm-search-clear" aria-label="Wyczyść wyszukiwanie" onclick="document.getElementById('tm-filter-search').value=''; tmApplyFilters(); tmToggleSearchClear(); document.getElementById('tm-filter-search').focus()"><i data-lucide="x" class="icon-xxs" aria-hidden="true"></i></button>
            </div>
         </div>
         <div class="tm-filter-group tm-filter-group--full">
            <div class="tm-filter-label"><i data-lucide="ruler" aria-hidden="true"></i> Średnica DN <span class="tm-filter-label-count">${allDNs.size}</span></div>
            <div id="tm-filter-dn-tiles" class="tm-filter-tiles">
               <button type="button" data-val="" data-action="tmSelectFilterDn" class="tm-tile tm-tile--dn active" aria-pressed="true">Dowolne</button>
${[...allDNs]
    .sort((a, b) => parseFloat(a) - parseFloat(b))
    .map((dn) => {
        const dnStr = String(dn);
        return `<button type="button" data-val="${escapeHtmlAttr(dnStr)}" data-action="tmSelectFilterDn" class="tm-tile tm-tile--dn" aria-pressed="false">DN${escapeHtml(dnStr)}</button>`;
    })
    .join('')}
            </div>
         </div>
      </div>
      <div class="tm-toolbar">
         <label class="tm-toolbar-check">
            <input type="checkbox" id="tm-select-all" onchange="tmToggleSelectAll()">
            <span>Zaznacz wszystko</span>
         </label>
         <span class="tm-toolbar-sep">|</span>
         <span class="tm-toolbar-count">Widoczne: <strong id="tm-visible-count" class="text-primary">0</strong></span>
         <span class="tm-toolbar-count tm-toolbar-count--accent">Zaznaczone: <strong id="tm-selected-count" class="color-accent">0</strong></span>
         <div style="margin-left:auto; display:flex; align-items:center; gap:0.3rem;">
            <button type="button" class="btn btn-secondary btn-sm" data-action="tmSortBy" data-sort="wellName">
               <i data-lucide="arrow-up-down" class="icon-xs" aria-hidden="true"></i> Sortuj A–Z
            </button>
         </div>
      </div>
      <div class="tm-cards">
         <div id="tm-table-body"></div>
      </div>
      <div id="tm-preview-panel" class="tm-preview">
         <div id="tm-preview-content"></div>
      </div>
      <div class="tm-actions">
         <div class="tm-actions-row">
            <div class="tm-actions-main">
               <div class="tm-filter-label"><i data-lucide="arrow-right-left" aria-hidden="true"></i> Docelowa kategoria <span style="color:var(--danger-hover);">*</span></div>
               <div id="tm-target-cat-tiles" class="tm-filter-tiles">
                  <button type="button" data-val="" data-action="tmSelectTargetCat" class="tm-tile tm-tile--target active" aria-pressed="true">— Wybierz —</button>
${categories
    .map((cat) => {
        return `<button type="button" data-val="${escapeHtmlAttr(cat)}" data-action="tmSelectTargetCat" class="tm-tile tm-tile--target" aria-pressed="false">${escapeHtml(cat)}</button>`;
    })
    .join('')}
               </div>
               <div id="tm-target-hint" class="tm-apply-hint"><i data-lucide="info" aria-hidden="true"></i> Wybierz kategorię, na którą zamienić zaznaczone przejścia</div>
            </div>
            <div style="flex-shrink:0; display:flex; flex-direction:column; align-items:stretch; gap:0.3rem;">
               <button type="button" id="tm-apply-btn" class="tm-apply-btn" data-action="tmApplyChanges" disabled>
                  <i data-lucide="zap" aria-hidden="true"></i> Zastosuj <span id="tm-apply-count" style="opacity:0.85; font-weight:var(--fw-medium);"></span>
               </button>
               <span style="font-size:var(--fs-2xs); color:var(--text-muted); text-align:center;">Modyfikuje tylko zaznaczone</span>
            </div>
         </div>
      </div>
    </div>`
    });
    if (window.lucide) window.lucide.createIcons({ root: overlay });

    tmRenderTable();
    window.tmToggleSearchClear && window.tmToggleSearchClear();
    window.tmUpdateApplyState && window.tmUpdateApplyState();
};

window.closeTransitionManagerModal = function () {
    tmSelectedTransitions = new Set();
    const el = document.getElementById('transition-manager-modal');
    if (el) el.remove();
};

window.tmRefreshWellData = function () {
    tmWellData = [];
    for (let i = 0; i < wells.length; i++) {
        const well = wells[i];

        let trList = [];
        if (well.przejscia && well.przejscia.length > 0) {
            trList = well.przejscia.map((tr, trIdx) => {
                const p = studnieProducts.find((prod) => prod.id === tr.productId);
                return {
                    trIndex: trIdx,
                    angle: tr.angle || 0,
                    rzedna:
                        tr.rzednaWlaczenia !== undefined && tr.rzednaWlaczenia !== null
                            ? tr.rzednaWlaczenia
                            : well.rzednaDna,
                    productId: tr.productId,
                    material: p ? p.category : 'Nieznany',
                    dnRaw: p ? p.dn : '?',
                    flowType: tr.flowType || FLOW_TYPES.WLOT
                };
            });
        }

        let wellPrice = 0;
        if (typeof calcWellStats === 'function') {
            const stats = calcWellStats(well);
            let transportCost = 0;
            if (typeof calculateOfferTotals === 'function') {
                const totals = calculateOfferTotals();
                if (totals && totals.globalWeight > 0 && totals.totalTransportCost > 0) {
                    transportCost =
                        totals.totalTransportCost * (stats.weight / totals.globalWeight);
                }
            }
            wellPrice = stats.price + transportCost;
        }

        tmWellData.push({
            wellIndex: i,
            uid: `well_${i}`,
            wellName: well.nazwaWlasna || well.name || `Studnia ${i + 1}`,
            wellDn: well.dn,
            rzednaDna: well.rzednaDna || '0.000',
            price: wellPrice,
            transitions: trList
        });
    }
};

const tmSortState = { column: null, asc: true };
let tmTargetCat = '';

window.tmSortBy = function (column) {
    if (tmSortState.column === column) {
        tmSortState.asc = !tmSortState.asc;
    } else {
        tmSortState.column = column;
        tmSortState.asc = true;
    }
    tmRenderTable();
};

window.tmApplyFilters = function () {
    tmCurrentFilters.search = (
        document.getElementById('tm-filter-search')?.value || ''
    ).toLowerCase();
    tmRenderTable();
};

function tmHighlightTiles(containerId, selectedVal) {
    const c = document.getElementById(containerId);
    if (!c) return;
    c.querySelectorAll('[data-val]').forEach((d) => {
        const isSel = d.dataset.val === selectedVal;
        d.classList.toggle('active', isSel);
        d.setAttribute('aria-pressed', String(isSel));
    });
}

function tmHighlightTilesMulti(containerId, selectedVals) {
    const c = document.getElementById(containerId);
    if (!c) return;
    c.querySelectorAll('[data-val]').forEach((d) => {
        const isSel =
            selectedVals.length === 0
                ? d.dataset.val === ''
                : d.dataset.val !== '' && selectedVals.includes(d.dataset.val);
        d.classList.toggle('active', isSel);
        d.setAttribute('aria-pressed', String(isSel));
    });
}

window.tmSelectFilterMaterial = function (val) {
    if (val === '') {
        tmCurrentFilters.sourceMaterial = [];
    } else {
        const idx = tmCurrentFilters.sourceMaterial.indexOf(val);
        if (idx >= 0) tmCurrentFilters.sourceMaterial.splice(idx, 1);
        else tmCurrentFilters.sourceMaterial.push(val);
    }
    tmHighlightTilesMulti('tm-filter-material-tiles', tmCurrentFilters.sourceMaterial);
    tmApplyFilters();
};

window.tmSelectFilterDn = function (val) {
    if (val === '') {
        tmCurrentFilters.dn = [];
    } else {
        const idx = tmCurrentFilters.dn.indexOf(val);
        if (idx >= 0) tmCurrentFilters.dn.splice(idx, 1);
        else tmCurrentFilters.dn.push(val);
    }
    tmHighlightTilesMulti('tm-filter-dn-tiles', tmCurrentFilters.dn);
    tmApplyFilters();
};

window.tmSelectTargetCat = function (val) {
    tmTargetCat = val;
    tmHighlightTiles('tm-target-cat-tiles', val);
    tmUpdatePreview();
    window.tmUpdateApplyState && window.tmUpdateApplyState();
};

window.tmRenderTable = function () {
    const container = document.getElementById('tm-table-body');
    if (!container) return;

    const sortedWells = [...tmWellData];
    if (tmSortState.column === 'wellName') {
        sortedWells.sort((a, b) => {
            const va = a.wellName.toLowerCase();
            const vb = b.wellName.toLowerCase();
            return tmSortState.asc ? va.localeCompare(vb) : vb.localeCompare(va);
        });
    }

    let html = '';
    let visibleCount = 0;
    let allChecked = true;
    let anyChecked = false;

    sortedWells.forEach((w) => {
        const matchingTrs = [];
        w.transitions.forEach((tr) => {
            let matchMat = true,
                matchDn = true,
                matchSearch = true;
            if (
                tmCurrentFilters.sourceMaterial.length > 0 &&
                !tmCurrentFilters.sourceMaterial.includes(tr.material)
            )
                matchMat = false;
            if (tmCurrentFilters.dn.length > 0 && !tmCurrentFilters.dn.includes(String(tr.dnRaw)))
                matchDn = false;
            if (tmCurrentFilters.search) {
                const s = tmCurrentFilters.search;
                matchSearch =
                    w.wellName.toLowerCase().includes(s) ||
                    tr.material.toLowerCase().includes(s) ||
                    String(tr.dnRaw).includes(s);
            }
            if (matchMat && matchDn && matchSearch) matchingTrs.push(tr);
        });
        if (matchingTrs.length === 0) return;
        visibleCount++;

        const wellSelCount = matchingTrs.filter((tr) =>
            tmSelectedTransitions.has(`${w.wellIndex}:${tr.trIndex}`)
        ).length;
        const wellAllSel = wellSelCount === matchingTrs.length;
        const wellSomeSel = wellSelCount > 0;
        if (!wellAllSel) allChecked = false;
        if (wellSomeSel) anyChecked = true;

        const tilesHtml = matchingTrs
            .map((tr) => {
                const key = `${w.wellIndex}:${tr.trIndex}`;
                const isSel = tmSelectedTransitions.has(key);
                const safeMaterial = escapeHtmlAttr(tr.material);
                const locked = tmIsWellBlocked(w.wellIndex);
                const flowClass =
                    tr.flowType === FLOW_TYPES.WLOT ? 'tm-tr-flow--in' : 'tm-tr-flow--out';
                const flowLabel = tr.flowType === FLOW_TYPES.WLOT ? 'WLOT' : 'WYLOT';
                return `
            <div class="tm-tr-tile ${isSel ? 'is-selected' : ''} ${locked ? 'is-locked' : ''}" ${locked ? '' : `onclick="tmOpenEditTransitionPopup(${w.wellIndex}, ${tr.trIndex}, event)"`}>
              <div class="tm-tr-row">
                <div class="tm-tr-main">
                  <input type="checkbox" class="tm-row-cb" value="${key}" ${isSel ? 'checked' : ''}
                         onclick="event.stopPropagation(); tmToggleTransition('${key}', this.checked)" ${locked ? 'disabled' : ''}>
                  <span class="tm-tr-material" title="${safeMaterial}">${escapeHtml(tr.material)}</span>
                  <span class="tm-tr-dn">DN${tr.dnRaw}</span>
                </div>
                ${
                    locked
                        ? ''
                        : `
                <button type="button" class="btn-icon btn-icon-xs tm-tr-edit" aria-label="Edytuj przejście" onclick="event.stopPropagation(); tmOpenEditTransitionPopup(${w.wellIndex}, ${tr.trIndex}, event)">
                  <i data-lucide="pencil" class="icon-xxs" aria-hidden="true"></i>
                </button>`
                }
              </div>
              <div class="tm-tr-meta">
                <span>${tr.rzedna != null ? parseFloat(tr.rzedna).toFixed(2) + 'm' : '—'}</span>
                <span class="tm-tr-dot">·</span>
                <span class="tm-tr-angle">${tr.angle}°</span>
                <span class="tm-tr-dot">·</span>
                <span class="tm-tr-flow ${flowClass}">${flowLabel}</span>
              </div>
            </div>`;
            })
            .join('');

        const wellLocked = tmIsWellBlocked(w.wellIndex);
        const wellCardClass = `tm-well-card ${wellLocked ? 'is-locked' : wellSomeSel ? 'is-selected' : ''}`;
        html += `
        <div class="${wellCardClass}">
          <div class="tm-well-head">
            <input type="checkbox" ${wellAllSel ? 'checked' : ''} onchange="tmToggleWell(${w.wellIndex}, this.checked)" ${wellLocked ? 'disabled' : ''} aria-label="Zaznacz wszystkie przejścia studni ${escapeHtmlAttr(w.wellName)}">
            <div style="flex:1; display:flex; align-items:center; gap:0.75rem; flex-wrap:wrap;">
              <span class="tm-well-name">${escapeHtml(w.wellName)}</span>
              ${wellLocked ? '<span class="tm-well-lock"><i data-lucide="lock" aria-hidden="true"></i>Zablokowana</span>' : ''}
              <span class="tm-well-badge">DN${w.wellDn}</span>
              <span class="fs-sm-muted">Rzędna: ${w.rzednaDna}</span>
              <span class="tm-well-price">${fmtInt(w.price)} PLN</span>
            </div>
            <span class="tm-well-counter">
              ${wellSelCount}/${matchingTrs.length}
            </span>
          </div>
          <div class="tm-grid">
            ${tilesHtml}
          </div>
        </div>`;
    });

    if (visibleCount === 0) {
        html = `<div class="tm-empty">
                  <div class="tm-empty-icon"><i data-lucide="ban" aria-hidden="true"></i></div>
                  Brak przejść spełniających kryteria.
                </div>`;
    }

    container.innerHTML = html;
    if (window.lucide) window.lucide.createIcons({ root: container });

    const visEl = document.getElementById('tm-visible-count');
    if (visEl) visEl.textContent = String(visibleCount);
    tmUpdateSelectedCount();

    const selectAllCb = document.getElementById('tm-select-all');
    if (selectAllCb) {
        selectAllCb.disabled = visibleCount === 0;
        selectAllCb.checked = visibleCount > 0 && allChecked && anyChecked;
    }

    tmUpdatePreview();
};

window.tmToggleWell = function (wellIdx, isChecked) {
    if (tmIsWellBlocked(wellIdx)) return;
    const wData = tmWellData.find((w) => w.wellIndex === wellIdx);
    if (!wData) return;
    wData.transitions.forEach((tr) => {
        const key = `${wellIdx}:${tr.trIndex}`;
        if (isChecked) tmSelectedTransitions.add(key);
        else tmSelectedTransitions.delete(key);
    });
    tmRenderTable();
};

window.tmToggleTransition = function (key, isChecked) {
    if (isChecked) tmSelectedTransitions.add(key);
    else tmSelectedTransitions.delete(key);
    tmRenderTable();
};

window.tmToggleSelectAll = function () {
    const isChecked = document.getElementById('tm-select-all').checked;
    const visibleCbs = document.querySelectorAll('.tm-row-cb');

    visibleCbs.forEach((cb) => {
        const key = cb.value;
        const wellIdx = parseInt(key.split(':')[0], 10);
        if (isChecked && tmIsWellBlocked(wellIdx)) return;
        if (isChecked) tmSelectedTransitions.add(key);
        else tmSelectedTransitions.delete(key);
    });

    tmRenderTable();
};

let tmEditSelectedCat = null;
let tmEditSelectedDn = null;

window.tmOpenEditTransitionPopup = function (wellIdx, trIdx, event) {
    event.stopPropagation();
    if (tmIsWellBlocked(wellIdx)) {
        showToast(
            '<i data-lucide="lock"></i> Studnia zablokowana — posiada zamówienie lub zlecenie produkcyjne.',
            'error'
        );
        return;
    }
    const existing = document.getElementById('tm-edit-popup');
    if (existing) existing.remove();
    tmEditSelectedCat = null;
    tmEditSelectedDn = null;

    const well = wells[wellIdx];
    if (!well || !well.przejscia || !well.przejscia[trIdx]) return;
    const tr = well.przejscia[trIdx];
    const currentP = studnieProducts.find((p) => p.id === tr.productId);

    const allProducts = studnieProducts.filter((p) => p.componentType === 'przejscie');
    const categories = [...new Set(allProducts.map((p) => p.category))].sort();
    const allDNs = [...new Set(allProducts.map((p) => p.dn))].sort(
        (a, b) => parseFloat(a) - parseFloat(b)
    );

    const currentCat = currentP ? currentP.category : '';
    const currentDn = currentP ? currentP.dn : '';

    const rect = event.currentTarget.getBoundingClientRect();
    const popupW = 340;
    let left = Math.min(rect.left, window.innerWidth - popupW - 16);
    if (left < 8) left = 8;
    const top = rect.bottom + 4;
    /* rezerwuj 72px na dolny pasek nawigacji (wizard-nav-fixed: height 60px + margines) */
    const maxH = Math.min(400, window.innerHeight - top - 72);

    const popup = document.createElement('div');
    popup.id = 'tm-edit-popup';
    popup.className = 'tm-edit-popup';
    popup.style.cssText = `top:${top}px;left:${left}px;width:${popupW}px;`;
    if (maxH > 120) {
        popup.style.maxHeight = maxH + 'px';
        popup.style.overflowY = 'auto';
    }

    const currentLabel = currentP
        ? `${escapeHtml(currentP.category)} DN${escapeHtml(currentP.dn)}`
        : 'Nieznane';

    popup.innerHTML = `
      <div class="tm-edit-head">
        <div><div class="tm-edit-title">Zmień przejście</div><div class="fs-xs-muted">Aktualnie: ${currentLabel}</div></div>
        <button class="btn-icon" aria-label="Zamknij" data-action="tmCloseEditPopup"><i data-lucide="x" class="icon-xs" aria-hidden="true"></i></button>
      </div>
      <div class="tm-edit-cols">
        <div class="tm-edit-col">
          <div class="tm-filter-label">Typ</div>
          <div id="tm-edit-type-list" class="tm-edit-list">
            ${categories
                .map((cat) => {
                    const isCur = cat === currentCat;
                    return `<button type="button" data-cat="${escapeHtmlAttr(cat)}" data-action="tmEditSelectType" data-well="${wellIdx}" data-tr="${trIdx}" class="tm-edit-opt ${isCur ? 'active' : ''}" aria-pressed="${isCur ? 'true' : 'false'}"><span class="tm-edit-dot ${isCur ? 'tm-edit-dot--visible' : 'tm-edit-dot--hidden'}"><i data-lucide="check" class="icon-xxs" aria-hidden="true"></i></span>${escapeHtml(cat)}</button>`;
                })
                .join('')}
          </div>
        </div>
        <div class="tm-edit-col">
          <div class="tm-filter-label">Średnica</div>
          <div id="tm-edit-dn-list" class="tm-edit-list">
            ${allDNs
                .map((dn) => {
                    const isCur = dn === currentDn;
                    const dnStr = String(dn);
                    return `<button type="button" data-dn="${escapeHtmlAttr(dnStr)}" data-action="tmEditSelectDN" data-well="${wellIdx}" data-tr="${trIdx}" class="tm-edit-opt ${isCur ? 'active' : ''}" aria-pressed="${isCur ? 'true' : 'false'}"><span class="tm-edit-dot ${isCur ? 'tm-edit-dot--visible' : 'tm-edit-dot--hidden'}"><i data-lucide="check" class="icon-xxs" aria-hidden="true"></i></span>DN${escapeHtml(dnStr)}</button>`;
                })
                .join('')}
          </div>
        </div>
      </div>
      <div id="tm-edit-result" class="tm-edit-result">
        <span class="fs-xs-muted">Wybierz typ i średnicę</span>
        <button id="tm-edit-apply-btn" class="btn btn-primary btn-sm" style="display:none;" data-action="tmEditApply" data-well="${wellIdx}" data-tr="${trIdx}">Zastosuj</button>
      </div>`;

    document.body.appendChild(popup);
    if (window.lucide) window.lucide.createIcons({ root: popup });

    const closeHandler = function (e) {
        if (!popup.contains(e.target)) {
            popup.remove();
            document.removeEventListener('click', closeHandler);
        }
    };
    setTimeout(() => document.addEventListener('click', closeHandler), 10);
};

function tmEditSelectType(el, wellIdx, trIdx) {
    const list = document.getElementById('tm-edit-type-list');
    list.querySelectorAll('[data-cat]').forEach((div) => {
        div.classList.remove('active');
        div.setAttribute('aria-pressed', 'false');
        const dot = div.querySelector('.tm-edit-dot');
        if (dot) {
            dot.classList.remove('tm-edit-dot--visible');
            dot.classList.add('tm-edit-dot--hidden');
        }
    });
    el.classList.add('active');
    el.setAttribute('aria-pressed', 'true');
    const dot = el.querySelector('.tm-edit-dot');
    if (dot) {
        dot.classList.remove('tm-edit-dot--hidden');
        dot.classList.add('tm-edit-dot--visible');
    }

    tmEditSelectedCat = el.dataset.cat;
    tmEditSelectedDn = null;

    const products = studnieProducts.filter(
        (p) => p.componentType === 'przejscie' && p.category === tmEditSelectedCat
    );
    const dns = [...new Set(products.map((p) => p.dn))].sort(
        (a, b) => parseFloat(a) - parseFloat(b)
    );

    const dnList = document.getElementById('tm-edit-dn-list');
    dnList.innerHTML = dns
        .map((dn) => {
            const dnStr = String(dn);
            return `<button type="button" data-dn="${escapeHtmlAttr(dnStr)}" data-action="tmEditSelectDN" data-well="${wellIdx}" data-tr="${trIdx}" class="tm-edit-opt" aria-pressed="false"><span class="tm-edit-dot tm-edit-dot--hidden"><i data-lucide="check" class="icon-xxs" aria-hidden="true"></i></span>DN${escapeHtml(dnStr)}</button>`;
        })
        .join('');
    if (window.lucide) window.lucide.createIcons({ root: dnList });

    const resultSpan = document.querySelector('#tm-edit-result span');
    if (resultSpan) resultSpan.textContent = 'Wybierz średnicę';
    const applyBtn = document.getElementById('tm-edit-apply-btn');
    if (applyBtn) applyBtn.style.display = 'none';

    const currentP = studnieProducts.find(
        (p) => p.id === wells[wellIdx]?.przejscia?.[trIdx]?.productId
    );
    if (currentP && currentP.category === tmEditSelectedCat) {
        dnList.querySelectorAll('[data-dn]').forEach((div) => {
            if (div.dataset.dn === currentP.dn) tmEditSelectDN(div, wellIdx, trIdx);
        });
    }
}

function tmEditSelectDN(el, wellIdx, trIdx) {
    const list = document.getElementById('tm-edit-dn-list');
    list.querySelectorAll('[data-dn]').forEach((div) => {
        div.classList.remove('active');
        div.setAttribute('aria-pressed', 'false');
        const dot = div.querySelector('.tm-edit-dot');
        if (dot) {
            dot.classList.remove('tm-edit-dot--visible');
            dot.classList.add('tm-edit-dot--hidden');
        }
    });
    el.classList.add('active');
    el.setAttribute('aria-pressed', 'true');
    const dot = el.querySelector('.tm-edit-dot');
    if (dot) {
        dot.classList.remove('tm-edit-dot--hidden');
        dot.classList.add('tm-edit-dot--visible');
    }

    tmEditSelectedDn = el.dataset.dn;

    if (tmEditSelectedCat && tmEditSelectedDn) {
        const product = studnieProducts.find(
            (p) =>
                p.componentType === 'przejscie' &&
                p.category === tmEditSelectedCat &&
                String(p.dn) === tmEditSelectedDn
        );
        if (product) {
            const resultDiv = document.getElementById('tm-edit-result');
            resultDiv.innerHTML = `<div><span class="text-primary fw-600" style="font-size:var(--fs-sm);">${escapeHtml(product.category)} DN${product.dn}</span><span class="color-success fw-700" style="margin-left:0.5rem;font-size:var(--fs-sm);">${product.price != null ? parseInt(product.price).toLocaleString('pl-PL') : '—'} PLN</span></div>
              <button class="btn btn-primary btn-sm" data-action="tmEditApply" data-well="${wellIdx}" data-tr="${trIdx}">Zastosuj</button>`;
        }
    }
}

async function tmEditApply(wellIdx, trIdx) {
    if (!tmEditSelectedCat || !tmEditSelectedDn) return;
    if (tmIsWellBlocked(wellIdx)) {
        document.getElementById('tm-edit-popup')?.remove();
        showToast(
            '<i data-lucide="lock"></i> Studnia zablokowana — posiada zamówienie lub zlecenie produkcyjne.',
            'error'
        );
        return;
    }
    const product = studnieProducts.find(
        (p) =>
            p.componentType === 'przejscie' &&
            p.category === tmEditSelectedCat &&
            String(p.dn) === tmEditSelectedDn
    );
    if (!product) {
        showToast('Nie znaleziono produktu', 'error');
        return;
    }

    const tr = wells[wellIdx]?.przejscia?.[trIdx];
    if (!tr) return;
    tr.productId = product.id;

    document.getElementById('tm-edit-popup')?.remove();
    tmEditSelectedCat = null;
    tmEditSelectedDn = null;

    try {
        currentWellIndex = wellIdx;
        await autoSelectComponents(true);
        refreshAll();
    } catch (e) {
        logger.error('popupsTransitionManager', 'tmEditApply error:', e);
    }
    tmRefreshWellData();
    tmRenderTable();
    showToast(`Zmieniono na ${product.category} DN${product.dn}`, 'success');
}

window.tmUpdateSelectedCount = function () {
    const countEl = document.getElementById('tm-selected-count');
    if (countEl) countEl.textContent = String(tmSelectedTransitions.size);
    window.tmUpdateApplyState && window.tmUpdateApplyState();
};

window.tmToggleSearchClear = function () {
    const input = document.getElementById('tm-filter-search');
    const btn = document.getElementById('tm-search-clear');
    if (!input || !btn) return;
    const hasVal = (input.value || '').length > 0;
    btn.classList.toggle('is-visible', hasVal);
};

window.tmUpdateApplyState = function () {
    const btn = document.getElementById('tm-apply-btn');
    const hint = document.getElementById('tm-target-hint');
    const countEl = document.getElementById('tm-apply-count');
    if (!btn) return;
    const hasCat = !!tmTargetCat;
    const hasSel = tmSelectedTransitions.size > 0;
    const canApply = hasCat && hasSel;
    btn.disabled = !canApply;
    btn.setAttribute('aria-disabled', String(!canApply));
    if (countEl) {
        countEl.textContent = hasSel ? `(${tmSelectedTransitions.size})` : '';
    }
    if (hint) {
        if (!hasCat && !hasSel)
            hint.innerHTML =
                '<i data-lucide="info" aria-hidden="true"></i> Wybierz kategorię i zaznacz przejścia';
        else if (!hasCat)
            hint.innerHTML =
                '<i data-lucide="alert-circle" aria-hidden="true"></i> Wybierz kategorię docelową';
        else if (!hasSel)
            hint.innerHTML =
                '<i data-lucide="check-square" aria-hidden="true"></i> Zaznacz co najmniej jedno przejście';
        else
            hint.innerHTML = `<i data-lucide="zap" aria-hidden="true"></i> Gotowe do zamiany: ${tmSelectedTransitions.size} × → ${escapeHtml(tmTargetCat)}`;
        if (window.lucide) window.lucide.createIcons({ root: hint });
    }
};

window.tmUpdatePreview = function () {
    const panel = document.getElementById('tm-preview-panel');
    const content = document.getElementById('tm-preview-content');
    if (!panel || !content) return;

    const targetCat = tmTargetCat;
    if (!targetCat || tmSelectedTransitions.size === 0) {
        panel.classList.remove('is-visible');
        return;
    }

    const replaceList = [];
    const skipList = [];

    tmSelectedTransitions.forEach((key) => {
        const [wellIdxStr, trIdxStr] = key.split(':');
        const wellIdx = parseInt(wellIdxStr, 10);
        const trIdx = parseInt(trIdxStr, 10);
        const well = wells[wellIdx];
        if (!well || !well.przejscia || !well.przejscia[trIdx]) return;
        const tr = well.przejscia[trIdx];
        const p = studnieProducts.find((prod) => prod.id === tr.productId);
        if (!p || p.category === targetCat) return;

        const replacement = studnieProducts.find(
            (pr) =>
                pr.componentType === 'przejscie' &&
                pr.category === targetCat &&
                pr.active !== 0 &&
                pr.dn === p.dn
        );

        const label = `${escapeHtml(well.name || `Studnia ${wellIdx + 1}`)} — ${escapeHtml(p.category)} DN${p.dn}`;
        if (replacement) {
            replaceList.push(label);
        } else {
            skipList.push(label);
        }
    });

    if (replaceList.length === 0 && skipList.length === 0) {
        panel.classList.remove('is-visible');
        return;
    }

    let html = '';
    if (replaceList.length > 0) {
        html += `<div class="tm-preview-section"><span class="tm-preview-title--ok"><i data-lucide="check-circle" class="icon-xs" aria-hidden="true"></i> Zostanie zamienione: ${replaceList.length}</span></div>`;
        html += '<div class="tm-preview-section" style="margin-bottom:0.5rem;">';
        replaceList.forEach((l) => {
            html += `<span class="tm-preview-chip tm-preview-chip--ok">${l}</span>`;
        });
        html += '</div>';
    }
    if (skipList.length > 0) {
        html += `<div class="tm-preview-section"><span class="tm-preview-title--warn"><i data-lucide="alert-triangle" class="icon-xs" aria-hidden="true"></i> Brak odpowiednika w ${escapeHtml(targetCat)}: ${skipList.length}</span></div>`;
        html += '<div class="tm-preview-section">';
        skipList.forEach((l) => {
            html += `<span class="tm-preview-chip tm-preview-chip--warn">${l}</span>`;
        });
        html += '</div>';
    }

    content.innerHTML = html;
    panel.classList.add('is-visible');
    if (window.lucide) window.lucide.createIcons({ root: panel });
};

/* ===== Delegacja kliknięć (data-action) — TASK-036 ===== */
if (typeof document !== 'undefined' && !window.__tmDelegated) {
    window.__tmDelegated = true;
    document.addEventListener('click', (e) => {
        const el = e.target.closest('[data-action]');
        if (!el) return;
        const action = el.getAttribute('data-action') || '';
        const val = el.getAttribute('data-val');
        const sort = el.getAttribute('data-sort');
        const well = el.getAttribute('data-well');
        const tr = el.getAttribute('data-tr');
        if (action === 'tmSelectFilterMaterial') {
            window.tmSelectFilterMaterial(val);
        } else if (action === 'tmSelectFilterDn') {
            window.tmSelectFilterDn(val);
        } else if (action === 'tmSelectTargetCat') {
            window.tmSelectTargetCat(val);
        } else if (action === 'tmSortBy') {
            window.tmSortBy(sort);
        } else if (action === 'tmApplyChanges') {
            window.tmApplyChanges();
        } else if (action === 'tmCloseTransitionManager') {
            window.closeTransitionManagerModal();
        } else if (action === 'tmEditSelectType') {
            window.tmEditSelectType(el, parseInt(well, 10), parseInt(tr, 10));
        } else if (action === 'tmEditSelectDN') {
            window.tmEditSelectDN(el, parseInt(well, 10), parseInt(tr, 10));
        } else if (action === 'tmEditApply') {
            window.tmEditApply(parseInt(well, 10), parseInt(tr, 10));
        } else if (action === 'tmCloseModal') {
            window.closeModal();
        } else if (action === 'tmCloseEditPopup') {
            el.closest('#tm-edit-popup').remove();
        }
    });
}

window.activatePreviewPanel = function () {
    setTimeout(tmUpdatePreview, 100);
};

window.tmApplyChanges = async function () {
    if (tmSelectedTransitions.size === 0) {
        showToast('Zaznacz co najmniej jedno przejście', 'warning');
        return;
    }

    const targetCat = tmTargetCat;

    if (!targetCat) {
        showToast('Wybierz docelową kategorię przejść', 'error');
        return;
    }

    let replacedCount = 0;
    const skippedDetails = [];
    const skippedLocked = new Set();
    const modifiedWellsIndices = new Set();

    tmSelectedTransitions.forEach((key) => {
        const [wellIdxStr, trIdxStr] = key.split(':');
        const wellIdx = parseInt(wellIdxStr, 10);
        const trIdx = parseInt(trIdxStr, 10);
        const well = wells[wellIdx];

        if (tmIsWellBlocked(wellIdx)) {
            skippedLocked.add(wellIdx);
            return;
        }

        if (!well || !well.przejscia || !well.przejscia[trIdx]) return;

        const tr = well.przejscia[trIdx];
        const p = studnieProducts.find((prod) => prod.id === tr.productId);
        if (!p) return;
        if (p.category === targetCat) return;

        const replacement = studnieProducts.find(
            (pr) =>
                pr.componentType === 'przejscie' &&
                pr.category === targetCat &&
                pr.active !== 0 &&
                pr.dn === p.dn
        );

        if (replacement) {
            well.przejscia[trIdx].productId = replacement.id;
            replacedCount++;
            modifiedWellsIndices.add(wellIdx);
        } else {
            skippedDetails.push({
                wellName: well.nazwaWlasna || well.name || `Studnia ${wellIdx + 1}`,
                material: p.category,
                dn: p.dn,
                targetCat: targetCat
            });
        }
    });

    if (skippedLocked.size > 0) {
        showToast(
            `<i data-lucide="lock"></i> Pominięto ${skippedLocked.size} zablokowaną studnię/studnie (zamówienie/zlecenie produkcyjne).`,
            'warning'
        );
    }

    if (replacedCount === 0) {
        if (skippedLocked.size > 0) {
            // toast został już pokazany powyżej
        } else if (skippedDetails.length > 0) {
            showSkippedPopup(skippedDetails, targetCat);
        } else {
            showToast('Nie znaleziono pasujących przejść do zamiany.', 'info');
        }
        return;
    }

    showToast(`Trwa przeliczanie zmodyfikowanych studni (${modifiedWellsIndices.size})...`, 'info');

    for (const wellIdx of modifiedWellsIndices) {
        const originalIndex = currentWellIndex;
        currentWellIndex = wellIdx;
        await autoSelectComponents(true);
        currentWellIndex = originalIndex;
    }

    refreshAll();

    if (skippedDetails.length > 0) {
        showSkippedPopup(skippedDetails, targetCat);
    }

    const msg = `Zakończono. Zamieniono ${replacedCount} przejść w ${modifiedWellsIndices.size} studniach.`;
    showToast(msg, 'success');

    tmSelectedTransitions.clear();
    tmRefreshWellData();

    tmRenderTable();
};

function showSkippedPopup(skippedDetails, targetCat) {
    const rowsHtml = skippedDetails
        .map(
            (s, i) => `
        <tr>
            <td class="th-l-35">${i + 1}</td>
            <td class="th-l-35">${escapeHtml(s.wellName)}</td>
            <td class="th-l-35">${escapeHtml(s.material)}</td>
            <td style="padding:0.35rem 0.6rem; text-align:center; white-space:nowrap;">${escapeHtml(s.dn)}</td>
            <td style="padding:0.35rem 0.6rem; white-space:nowrap; color:var(--danger-hover);">Brak produktu ${escapeHtml(s.targetCat)} o średnicy ${escapeHtml(s.dn)}</td>
        </tr>
    `
        )
        .join('');

    showModal({
        id: 'skipped-popup-modal',
        titleId: 'skipped-title',
        html: `
      <div style="background:var(--bg-secondary, var(--slate-800)); border:1px solid rgba(var(--danger-rgb), 0.3); border-radius: var(--radius-md); padding:1.2rem 1.5rem; width:700px; max-width:92vw; max-height:85vh; overflow-y:auto; box-shadow:0 20px 60px rgba(var(--black-rgb), 0.5);">
        <div class="modal-head-sticky">
          <div id="skipped-title" style="font-size: var(--fs-2xl); font-weight: var(--fw-extrabold); color:var(--danger-hover);"><i data-lucide="alert-triangle" aria-hidden="true"></i> Pominięte przejścia (${skippedDetails.length})</div>
          <button class="btn-icon btn-close-4xl" aria-label="Zamknij" data-action="tmCloseModal" ><i data-lucide="x" aria-hidden="true"></i></button>
        </div>
        <div style="font-size: var(--fs-md); color:var(--text-muted); margin-bottom:1rem;">
            Poniższe przejścia nie zostały zamienione — w kategorii <strong>${escapeHtml(targetCat)}</strong> nie istnieje produkt o podanej średnicy.
        </div>
        <table style="width:100%; font-size: var(--fs-md); border-collapse:collapse;">
            <thead style="position:sticky; top:0; background:var(--slate-800);">
                <tr style="border-bottom:1px solid rgba(var(--white-rgb), 0.1);">
                    <th scope="col" class="th-l-nowrap">Lp.</th>
                    <th scope="col" class="th-l-nowrap">Studnia</th>
                    <th scope="col" class="th-l-nowrap">Obecny typ</th>
                    <th scope="col" style="padding:0.4rem 0.6rem; text-align:center; white-space:nowrap;">Średnica</th>
                    <th scope="col" class="th-l-nowrap">Powód pominięcia</th>
                </tr>
            </thead>
            <tbody>${rowsHtml}</tbody>
        </table>
        <div style="display:flex; justify-content:space-between; align-items:center; margin-top:1rem; padding-top:0.8rem; border-top:1px solid rgba(var(--white-rgb), 0.1);">
            <button class="btn btn-secondary" onclick="closeModal(); window.activatePreviewPanel && window.activatePreviewPanel()" style="font-size: var(--fs-md); padding:0.4rem 1rem; background:rgba(var(--success-rgb), 0.15); border:1px solid rgba(var(--success-rgb), 0.3); color:var(--success-hover);">
                <i data-lucide="arrow-left"></i> Wróć do menedżera
            </button>
            <button class="btn btn-secondary" data-action="tmCloseModal" style="font-size: var(--fs-md); padding:0.4rem 1.2rem;">Zamknij</button>
        </div>
      </div>
    `
    });
    if (window.lucide) window.lucide.createIcons();
}

/* ===== Rejestracja globali ===== */
window.tmEditSelectType = tmEditSelectType;

/* ===== Rejestracja globali ===== */
window.tmEditApply = tmEditApply;
