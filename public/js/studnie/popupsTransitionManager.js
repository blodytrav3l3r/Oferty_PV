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
    <div class="modal" style="width:90vw; max-width:95vw; height:90vh; display:flex; flex-direction:column; background: var(--bg-secondary); border-radius: var(--radius); box-shadow:0 20px 25px -5px rgba(var(--black-rgb), 0.3);">
      
      <!-- Nagłówek -->
      <div class="modal-header" style="border-bottom:1px solid var(--border); padding:1rem; flex-shrink:0;">
        <h3 id="tm-title" style="font-size: var(--fs-3xl); font-weight: var(--fw-bold); color:var(--text-primary);"><i data-lucide="list" aria-hidden="true"></i> Menedżer Przejść</h3>
        <button class="btn-icon" aria-label="Zamknij" data-action="tmCloseTransitionManager"><i data-lucide="x" aria-hidden="true"></i></button>
      </div>
      
      <!-- Sekcja filtrów -->
      <div style="padding:0.6rem 0.75rem; border-bottom:1px solid var(--border); background:rgba(var(--black-rgb), 0.2); flex-shrink:0; display:flex; gap:0.6rem; align-items:flex-start; flex-wrap:wrap;">
         <div style="min-width:140px; flex:1;">
            <div class="label-sec">Kategoria źródłowa</div>
            <div id="tm-filter-material-tiles" class="flex-wrap-15">
               <div data-val="" data-action="tmSelectFilterMaterial" data-val=""
                    class="tile-active"
                    onmouseenter="this.style.borderColor='rgba(var(--success-rgb), 0.8)'" onmouseleave="this.style.borderColor='rgba(var(--success-rgb), 0.8)'">Dowolna</div>
${[...allMaterials]
    .sort()
    .map((m) => {
        return `<div data-val="${escapeHtmlAttr(m)}" data-action="tmSelectFilterMaterial" data-val="${escapeJsStr(m)}"
                       class="tile-idle"
                       onmouseenter="this.style.borderColor='rgba(var(--success-rgb), 0.3)'" onmouseleave="this.style.borderColor='rgba(var(--white-rgb), 0.05)'">${escapeHtml(m)}</div>`;
    })
    .join('')}
            </div>
         </div>
         <div style="min-width:90px;">
            <div class="label-sec">Średnica DN</div>
            <div id="tm-filter-dn-tiles" class="flex-wrap-15">
               <div data-val="" data-action="tmSelectFilterDn" data-val=""
                    class="tile-active"
                    onmouseenter="this.style.borderColor='rgba(var(--success-rgb), 0.8)'" onmouseleave="this.style.borderColor='rgba(var(--success-rgb), 0.8)'">Dowolne</div>
${[...allDNs]
    .sort((a, b) => parseFloat(a) - parseFloat(b))
    .map((dn) => {
        const dnStr = String(dn);
        return `<div data-val="${escapeHtmlAttr(dnStr)}" data-action="tmSelectFilterDn" data-val="${escapeJsStr(dnStr)}"
                       class="tile-idle"
                       onmouseenter="this.style.borderColor='rgba(var(--success-rgb), 0.3)'" onmouseleave="this.style.borderColor='rgba(var(--white-rgb), 0.05)'">${escapeHtml(dnStr)}</div>`;
    })
    .join('')}
            </div>
         </div>
         <div style="min-width:160px; flex:1;">
            <div class="label-sec">Szukaj</div>
            <input type="text" id="tm-filter-search" placeholder="Nazwa, materiał, DN..." maxlength="30" oninput="tmApplyFilters()" style="width:100%; padding:0.25rem 0.4rem; font-size: var(--fs-xs); background:var(--bg-tile); border:1.5px solid rgba(var(--white-rgb), 0.05); border-radius: var(--radius-2xs); color:var(--text-primary); outline:none; transition:all 0.12s;" onfocus="this.style.borderColor='rgba(var(--success-rgb), 0.5)'" onblur="this.style.borderColor='rgba(var(--white-rgb), 0.05)'">
         </div>
      </div>

      <!-- Pasek narzędzi -->
      <div style="flex-shrink:0; display:flex; align-items:center; gap:0.75rem; padding:0.45rem 0.75rem; border-bottom:1px solid rgba(var(--white-rgb), 0.05); background:rgba(var(--black-rgb), 0.1); font-size: var(--fs-base); color:var(--text-muted);">
         <label style="display:flex; align-items:center; gap:0.35rem; cursor:pointer; padding:0.2rem 0.5rem; background:rgba(var(--success-rgb), 0.1); border:1px solid rgba(var(--success-rgb), 0.15); border-radius: var(--radius-sm); color:var(--text-primary);">
            <input type="checkbox" id="tm-select-all" onchange="tmToggleSelectAll()" style="width:15px; height:15px; cursor:pointer;">
            <span class="fw-500">Zaznacz wszystko</span>
         </label>
         <span style="opacity:0.2;">|</span>
         <span>Widoczne: <strong id="tm-visible-count" class="text-primary">0</strong></span>
         <span>Zaznaczone: <strong id="tm-selected-count" class="color-accent">0</strong></span>
         <div style="margin-left:auto; display:flex; align-items:center; gap:0.3rem;">
            <button data-action="tmSortBy" data-sort="wellName" style="background:none; border:1px solid rgba(var(--white-rgb), 0.1); border-radius: var(--radius-sm); padding:0.25rem 0.5rem; color:var(--text-muted); cursor:pointer; font-size: var(--fs-sm); display:flex; align-items:center; gap:0.3rem; transition:all 0.15s;" onmouseover="this.style.borderColor='rgba(var(--success-rgb), 0.3)';this.style.color='var(--text-primary)'" onmouseout="this.style.borderColor='rgba(var(--white-rgb), 0.1)';this.style.color='var(--text-muted)'">
               <span>↕</span> Sortuj A–Z
            </button>
         </div>
      </div>

      <!-- Karty studni -->
      <div style="flex-grow:1; overflow-y:auto; overflow-x:hidden; padding:0.5rem 0.75rem; background:rgba(var(--black-rgb), 0.1);">
         <div id="tm-table-body"></div>
      </div>

      <!-- Panel podglądu przed apply -->
      <div id="tm-preview-panel" style="display:none; padding:0.6rem 1rem; border-top:1px solid var(--border); background:rgba(var(--success-rgb), 0.05); flex-shrink:0;">
         <div id="tm-preview-content"></div>
      </div>

      <!-- Panel Akcji -->
      <div style="padding:0.6rem 0.75rem; border-top:1px solid var(--border); background:var(--slate-800); flex-shrink:0;">
         <div style="display:flex; gap:0.75rem; align-items:flex-end; flex-wrap:wrap;">
            <div style="flex:1; min-width:200px;">
               <div class="label-sec">Docelowa kategoria (na co zamienić)</div>
               <div id="tm-target-cat-tiles" style="display:flex; flex-wrap:wrap; gap:0.2rem;">
                  <div data-val="" data-action="tmSelectTargetCat" data-val=""
                       style="padding:0.25rem 0.5rem; border-radius: var(--radius-2xs); cursor:pointer; font-size: var(--fs-xs); font-weight: var(--fw-semibold); background:rgba(var(--success-rgb), 0.2); border:1.5px solid rgba(var(--success-rgb), 0.8); color:var(--success-hover); transition:all 0.12s;"
                       onmouseenter="this.style.borderColor='rgba(var(--success-rgb), 0.8)'" onmouseleave="this.style.borderColor='rgba(var(--success-rgb), 0.8)'">— Wybierz —</div>
${categories
    .map((cat) => {
        return `<div data-val="${escapeHtmlAttr(cat)}" data-action="tmSelectTargetCat" data-val="${escapeJsStr(cat)}"
                          style="padding:0.25rem 0.5rem; border-radius: var(--radius-2xs); cursor:pointer; font-size: var(--fs-xs); font-weight: var(--fw-medium); background:rgba(var(--white-rgb), 0.05); border:1.5px solid rgba(var(--white-rgb), 0.05); color:var(--text-primary); transition:all 0.12s;"
                          onmouseenter="this.style.borderColor='rgba(var(--success-rgb), 0.3)'" onmouseleave="this.style.borderColor='rgba(var(--white-rgb), 0.05)'">${escapeHtml(cat)}</div>`;
    })
    .join('')}
               </div>
            </div>
            <div style="flex-shrink:0;">
               <button data-action="tmApplyChanges" style="background:rgba(var(--success-rgb), 0.15); border:1.5px solid rgba(var(--success-rgb), 0.5); border-radius: var(--radius-2xs); padding:0.35rem 0.8rem; display:flex; align-items:center; gap:0.35rem; font-size: var(--fs-sm); font-weight: var(--fw-semibold); color:var(--success-hover); cursor:pointer; transition:all 0.15s;" onmouseenter="this.style.background='rgba(var(--success-rgb), 0.3)'" onmouseleave="this.style.background='rgba(var(--success-rgb), 0.15)'">
                  <i data-lucide="zap"></i> Zastosuj
               </button>
            </div>
         </div>
      </div>

    </div>`
    });
    if (window.lucide) window.lucide.createIcons({ root: overlay });

    tmRenderTable();
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
        d.style.background = isSel
            ? 'rgba(var(--success-rgb), 0.2)'
            : 'rgba(var(--white-rgb), 0.05)';
        d.style.borderColor = isSel
            ? 'rgba(var(--success-rgb), 0.8)'
            : 'rgba(var(--white-rgb), 0.05)';
        d.style.color = isSel ? 'var(--success-hover)' : 'var(--text-primary)';
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
        d.style.background = isSel
            ? 'rgba(var(--success-rgb), 0.2)'
            : 'rgba(var(--white-rgb), 0.05)';
        d.style.borderColor = isSel
            ? 'rgba(var(--success-rgb), 0.8)'
            : 'rgba(var(--white-rgb), 0.05)';
        d.style.color = isSel ? 'var(--success-hover)' : 'var(--text-primary)';
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
                return `
            <div ${locked ? '' : `onclick="tmOpenEditTransitionPopup(${w.wellIndex}, ${tr.trIndex}, event)"`}
                  style="background:${isSel ? 'rgba(var(--success-rgb), 0.15)' : 'var(--bg-tile)'};
                         border:1px solid ${isSel ? 'rgba(var(--success-rgb), 0.5)' : 'rgba(var(--white-rgb), 0.05)'};
                         border-radius: var(--radius-sm); padding:0.4rem 0.45rem; ${locked ? 'cursor:default;' : 'cursor:pointer;'}
                         transition:all 0.2s; display:flex; flex-direction:column; gap:0.1rem;"
                  ${locked ? '' : "onmouseenter=\"this.style.borderColor='rgba(var(--success-rgb), 0.3)';this.style.transform='translateY(-2px)';this.style.boxShadow='0 6px 20px rgba(var(--black-rgb), 0.3)'\""}
                  ${locked ? '' : `onmouseleave="this.style.borderColor='${isSel ? 'rgba(var(--success-rgb), 0.5)' : 'rgba(var(--white-rgb), 0.05)'}';this.style.transform='none';this.style.boxShadow='none'"`}>
              <div style="display:flex; justify-content:space-between; align-items:center; gap:0.3rem;">
                <div style="display:flex; align-items:center; gap:0.3rem; min-width:0; flex:1;">
                  <input type="checkbox" class="tm-row-cb" value="${key}" ${isSel ? 'checked' : ''}
                         onclick="event.stopPropagation(); tmToggleTransition('${key}', this.checked)"
                         style="width:14px; height:14px; cursor:pointer; margin:0; flex-shrink:0;" ${locked ? 'disabled' : ''}>
                  <span style="font-size: var(--fs-base); font-weight: var(--fw-bold); color:var(--text-primary); white-space:nowrap; overflow:hidden; text-overflow:ellipsis;" title="${safeMaterial}">${escapeHtml(tr.material)}</span>
                  <span style="font-size: var(--fs-md); font-weight: var(--fw-extrabold); color:var(--success-hover); flex-shrink:0;">DN${tr.dnRaw}</span>
                </div>
                ${
                    locked
                        ? ''
                        : `
                <button onclick="event.stopPropagation(); tmOpenEditTransitionPopup(${w.wellIndex}, ${tr.trIndex}, event)"
                        style="background:rgba(var(--success-rgb), 0.1); border:1px solid rgba(var(--success-rgb), 0.2); border-radius: var(--radius-2xs); cursor:pointer; padding:0.05rem 0.3rem; color:var(--success-hover); font-size: var(--fs-2xs); line-height:1.3; flex-shrink:0; transition:all 0.15s;"
                        onmouseenter="this.style.background='rgba(var(--success-rgb), 0.3)'"
                        onmouseleave="this.style.background='rgba(var(--success-rgb), 0.1)'">
                  ✎
                </button>`
                }
              </div>
              <div style="display:flex; gap:0.3rem; align-items:center; font-size: var(--fs-xs); color:var(--text-muted);">
                <span>${tr.rzedna != null ? parseFloat(tr.rzedna).toFixed(2) + 'm' : '—'}</span>
                <span class="opacity-3">·</span>
                <span style="color:var(--warn-hover); font-weight: var(--fw-semibold);">${tr.angle}°</span>
                <span class="opacity-3">·</span>
                <span style="background:${tr.flowType === FLOW_TYPES.WLOT ? 'rgba(var(--success-rgb), 0.2)' : 'rgba(var(--warn-rgb), 0.2)'}; color:${tr.flowType === FLOW_TYPES.WLOT ? 'var(--success-hover)' : 'var(--warn-hover)'}; padding:0.02rem 0.3rem; border-radius: var(--radius-2xs); font-size: var(--fs-2xs); font-weight: var(--fw-bold);">${tr.flowType === FLOW_TYPES.WLOT ? 'WLOT' : 'WYLOT'}</span>
              </div>
            </div>`;
            })
            .join('');

        const wellLocked = tmIsWellBlocked(w.wellIndex);
        html += `
        <div style="background: var(--bg-secondary); border:1px solid ${wellLocked ? 'rgba(var(--danger-rgb), 0.2)' : wellSomeSel ? 'rgba(var(--success-rgb), 0.3)' : 'rgba(var(--white-rgb), 0.05)'}; border-radius: var(--radius-sm); margin-bottom:0.6rem; overflow:hidden; transition:all 0.2s;${wellLocked ? ' opacity:0.7;' : ''}">
          <div style="display:flex; align-items:center; padding:0.55rem 0.75rem; background:rgba(var(--white-rgb), 0.05); border-bottom:1px solid rgba(var(--white-rgb), 0.05);">
            <input type="checkbox" ${wellAllSel ? 'checked' : ''} onchange="tmToggleWell(${w.wellIndex}, this.checked)"
                   style="width:16px; height:16px; margin-right:0.75rem; cursor:pointer;" ${wellLocked ? 'disabled' : ''}>
            <div style="flex:1; display:flex; align-items:center; gap:0.75rem; flex-wrap:wrap;">
              <span style="font-weight: var(--fw-bold); color:var(--text-primary); font-size: var(--fs-lg);">${escapeHtml(w.wellName)}</span>
              ${wellLocked ? '<span style="color:var(--danger-hover); font-size: var(--fs-xs); display:flex; align-items:center; gap:0.2rem;"><i data-lucide="lock" class="icon-12"></i>Zablokowana</span>' : ''}
              <span style="color:var(--text-muted); font-size: var(--fs-sm); background:rgba(var(--white-rgb), 0.05); border:1px solid rgba(var(--white-rgb), 0.05); padding:0.1rem 0.45rem; border-radius: var(--radius-2xs); font-weight: var(--fw-semibold);">DN${w.wellDn}</span>
              <span class="fs-sm-muted">Rzędna: ${w.rzednaDna}</span>
              <span style="color:var(--success-hover); font-weight: var(--fw-bold); font-size: var(--fs-md);">${fmtInt(w.price)} PLN</span>
            </div>
            <span style="color:var(--text-muted); font-size: var(--fs-xs); background:rgba(var(--success-rgb), 0.1); padding:0.15rem 0.55rem; border-radius: var(--radius); white-space:nowrap; font-weight: var(--fw-medium); border:1px solid rgba(var(--success-rgb), 0.15);">
              ${wellSelCount}/${matchingTrs.length}
            </span>
          </div>
          <div class="grid-auto-230">
            ${tilesHtml}
          </div>
        </div>`;
    });

    if (visibleCount === 0) {
        html = `<div style="text-align:center; padding:3rem 1rem; color:var(--text-muted); font-size: var(--fs-xl);">
                  <div style="font-size: var(--fs-8xl); margin-bottom:0.5rem; opacity:0.2;">⊘</div>
                  Brak przejść spełniających kryteria.
                </div>`;
    }

    container.innerHTML = html;

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
    popup.style.cssText = `position:fixed;z-index:${LAYERS.TRANSITION_EDIT};background:var(--slate-800);border:1px solid rgba(var(--success-rgb), 0.3);border-radius: var(--radius-sm);padding:0.6rem;box-shadow:0 20px 60px rgba(var(--black-rgb), 0.5);width:${popupW}px;top:${top}px;left:${left}px;animation:fadeIn 0.1s ease;`;
    if (maxH > 120) {
        popup.style.maxHeight = maxH + 'px';
        popup.style.overflowY = 'auto';
    }

    const currentLabel = currentP
        ? `${escapeHtml(currentP.category)} DN${escapeHtml(currentP.dn)}`
        : 'Nieznane';

    popup.innerHTML = `
      <div style="display:flex;justify-content:space-between;align-items:center;padding:0 0.1rem 0.4rem;border-bottom:1px solid rgba(var(--white-rgb), 0.05);margin-bottom:0.45rem;">
        <div><div style="font-weight: var(--fw-bold);color:var(--text-primary);font-size: var(--fs-md);">Zmień przejście</div><div class="fs-xs-muted">Aktualnie: ${currentLabel}</div></div>
        <button data-action="tmCloseEditPopup" style="background:rgba(var(--white-rgb), 0.05);border:none;border-radius: var(--radius-2xs);color:var(--text-muted);cursor:pointer;font-size: var(--fs-lg);padding:0.1rem 0.35rem;line-height:1.3;">✕</button>
      </div>
      <div style="display:flex;gap:0.5rem;">
        <div class="flex-1">
          <div class="label-sec">Typ</div>
          <div id="tm-edit-type-list" class="flex-gap-2-col">
            ${categories
                .map((cat) => {
                    const isCur = cat === currentCat;
                    return `<div data-cat="${escapeHtmlAttr(cat)}" data-action="tmEditSelectType" data-well="${wellIdx}" data-tr="${trIdx}"
                   style="padding:0.3rem 0.45rem;border-radius: var(--radius-2xs);cursor:pointer;font-size: var(--fs-sm);font-weight: var(--fw-semibold);background:${isCur ? 'rgba(var(--success-rgb), 0.2)' : 'rgba(var(--white-rgb), 0.05)'};border:1.5px solid ${isCur ? 'rgba(var(--success-rgb), 0.8)' : 'rgba(var(--white-rgb), 0.05)'};color:${isCur ? 'var(--success-hover)' : 'var(--text-primary)'};transition:all 0.12s;display:flex;align-items:center;gap:0.35rem;${isCur ? 'box-shadow:0 0 8px rgba(var(--success-rgb), 0.15);' : ''}"
                   onmouseenter="this.style.borderColor='rgba(var(--success-rgb), 0.3)'" onmouseleave="this.style.borderColor='${isCur ? 'rgba(var(--success-rgb), 0.8)' : 'rgba(var(--white-rgb), 0.05)'}'">${isCur ? '<span class="color-success-hover">◆</span>' : '<span class="fs-base-invisible">◆</span>'}${escapeHtml(cat)}</div>`;
                })
                .join('')}
          </div>
        </div>
        <div class="flex-1">
          <div class="label-sec">Średnica</div>
          <div id="tm-edit-dn-list" class="flex-gap-2-col">
            ${allDNs
                .map((dn) => {
                    const isCur = dn === currentDn;
                    const dnStr = String(dn);
                    return `<div data-dn="${escapeHtmlAttr(dnStr)}" data-action="tmEditSelectDN" data-well="${wellIdx}" data-tr="${trIdx}"
                   style="padding:0.3rem 0.45rem;border-radius: var(--radius-2xs);cursor:pointer;font-size: var(--fs-sm);font-weight: var(--fw-bold);background:${isCur ? 'rgba(var(--success-rgb), 0.2)' : 'rgba(var(--white-rgb), 0.05)'};border:1.5px solid ${isCur ? 'rgba(var(--success-rgb), 0.8)' : 'rgba(var(--white-rgb), 0.05)'};color:${isCur ? 'var(--success-hover)' : 'var(--text-primary)'};transition:all 0.12s;display:flex;align-items:center;gap:0.35rem;${isCur ? 'box-shadow:0 0 8px rgba(var(--success-rgb), 0.15);' : ''}"
                   onmouseenter="this.style.borderColor='rgba(var(--success-rgb), 0.3)'" onmouseleave="this.style.borderColor='${isCur ? 'rgba(var(--success-rgb), 0.8)' : 'rgba(var(--white-rgb), 0.05)'}'">${isCur ? '<span class="color-success-hover">◆</span>' : '<span class="fs-base-invisible">◆</span>'}DN${escapeHtml(dnStr)}</div>`;
                })
                .join('')}
          </div>
        </div>
      </div>
      <div id="tm-edit-result" style="margin-top:0.45rem;padding:0.35rem 0.45rem;background:rgba(var(--black-rgb), 0.2);border-radius: var(--radius-sm);display:flex;justify-content:space-between;align-items:center;">
        <span style="color:var(--text-muted);font-size: var(--fs-sm);">Wybierz typ i średnicę</span>
        <button id="tm-edit-apply-btn" style="display:none;background:var(--accent);border:none;border-radius: var(--radius-2xs);padding:0.28rem 0.55rem;color:var(--white);font-size: var(--fs-sm);font-weight: var(--fw-semibold);cursor:pointer;" data-action="tmEditApply" data-well="${wellIdx}" data-tr="${trIdx}">Zastosuj</button>
      </div>`;

    document.body.appendChild(popup);

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
        div.style.background = 'rgba(var(--white-rgb), 0.05)';
        div.style.borderColor = 'rgba(var(--white-rgb), 0.05)';
        div.style.color = 'var(--text-primary)';
        div.style.boxShadow = 'none';
        const dot = div.querySelector('span');
        if (dot) dot.innerHTML = '◆';
        dot.style.color = 'transparent';
    });
    el.style.background = 'rgba(var(--success-rgb), 0.2)';
    el.style.borderColor = 'rgba(var(--success-rgb), 0.8)';
    el.style.color = 'var(--success-hover)';
    el.style.boxShadow = '0 0 8px rgba(var(--success-rgb), 0.15)';
    const dot = el.querySelector('span');
    if (dot) dot.style.color = 'var(--success-hover)';

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
            return `<div data-dn="${escapeHtmlAttr(dnStr)}" data-action="tmEditSelectDN" data-well="${wellIdx}" data-tr="${trIdx}" style="padding:0.3rem 0.45rem;border-radius: var(--radius-2xs);cursor:pointer;font-size: var(--fs-sm);font-weight: var(--fw-semibold);background:rgba(var(--white-rgb), 0.05);border:1.5px solid rgba(var(--white-rgb), 0.05);color:var(--text-primary);transition:all 0.12s;display:flex;align-items:center;gap:0.35rem;" onmouseenter="this.style.borderColor='rgba(var(--success-rgb), 0.3)'" onmouseleave="this.style.borderColor='rgba(var(--white-rgb), 0.05)'"><span class="fs-base-invisible">◆</span>DN${escapeHtml(dnStr)}</div>`;
        })
        .join('');

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
        div.style.background = 'rgba(var(--white-rgb), 0.05)';
        div.style.borderColor = 'rgba(var(--white-rgb), 0.05)';
        div.style.color = 'var(--text-primary)';
        div.style.boxShadow = 'none';
        const dot = div.querySelector('span');
        if (dot) dot.style.color = 'transparent';
    });
    el.style.background = 'rgba(var(--success-rgb), 0.2)';
    el.style.borderColor = 'rgba(var(--success-rgb), 0.8)';
    el.style.color = 'var(--success-hover)';
    el.style.boxShadow = '0 0 8px rgba(var(--success-rgb), 0.15)';
    const dot = el.querySelector('span');
    if (dot) dot.style.color = 'var(--success-hover)';

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
            resultDiv.innerHTML = `<div><span style="color:var(--text-primary);font-size: var(--fs-sm);font-weight: var(--fw-semibold);">${escapeHtml(product.category)} DN${product.dn}</span><span style="color:var(--success-hover);font-weight: var(--fw-bold);margin-left:0.5rem;font-size: var(--fs-sm);">${product.price != null ? parseInt(product.price).toLocaleString('pl-PL') : '—'} PLN</span></div>
              <button style="background:var(--accent);border:none;border-radius: var(--radius-2xs);padding:0.28rem 0.55rem;color:var(--white);font-size: var(--fs-sm);font-weight: var(--fw-semibold);cursor:pointer;" data-action="tmEditApply" data-well="${wellIdx}" data-tr="${trIdx}">Zastosuj</button>`;
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
};

window.tmUpdatePreview = function () {
    const panel = document.getElementById('tm-preview-panel');
    const content = document.getElementById('tm-preview-content');
    if (!panel || !content) return;

    const targetCat = tmTargetCat;
    if (!targetCat || tmSelectedTransitions.size === 0) {
        panel.style.display = 'none';
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
        panel.style.display = 'none';
        return;
    }

    let html = '';
    if (replaceList.length > 0) {
        html += `<div class="flex-gap-4-mb3"><span style="color:var(--success-hover); font-weight: var(--fw-extrabold);">✅ Zostanie zamienione: ${replaceList.length}</span></div>`;
        html += '<div style="display:flex; flex-wrap:wrap; gap:0.3rem; margin-bottom:0.5rem;">';
        replaceList.forEach((l) => {
            html += `<span style="background:rgba(var(--success-rgb), 0.1); border:1px solid rgba(var(--success-rgb), 0.2); color:var(--success-hover); padding:0.1rem 0.4rem; border-radius: var(--radius-2xs); font-size: var(--fs-sm);">${l}</span>`;
        });
        html += '</div>';
    }
    if (skipList.length > 0) {
        html += `<div class="flex-gap-4-mb3"><span style="color:var(--danger-hover); font-weight: var(--fw-extrabold);">⚠️ Brak odpowiednika w ${escapeHtml(targetCat)}: ${skipList.length}</span></div>`;
        html += '<div style="display:flex; flex-wrap:wrap; gap:0.3rem;">';
        skipList.forEach((l) => {
            html += `<span style="background:rgba(var(--danger-rgb), 0.1); border:1px solid rgba(var(--danger-rgb), 0.2); color:var(--danger-hover); padding:0.1rem 0.4rem; border-radius: var(--radius-2xs); font-size: var(--fs-sm);">${l}</span>`;
        });
        html += '</div>';
    }

    content.innerHTML = html;
    panel.style.display = 'block';
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
