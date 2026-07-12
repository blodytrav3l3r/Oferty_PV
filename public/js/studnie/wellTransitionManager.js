// @ts-check
/* ===== wellTransitionManager.js — menedżer przejść (transition manager) ===== */

let tmSelectedTransitions = new Set();
let tmCurrentFilters = { sourceMaterial: [], dn: [], search: '' };
let tmWellData = [];

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
    <div class="modal" style="width:90vw; max-width:95vw; height:90vh; display:flex; flex-direction:column; background:#111827; border-radius:12px; box-shadow:0 20px 25px -5px rgba(0,0,0,0.3);">
      
      <!-- Nagłówek -->
      <div class="modal-header" style="border-bottom:1px solid var(--border); padding:1rem; flex-shrink:0;">
        <h3 id="tm-title" style="font-size:1.1rem; font-weight:700; color:var(--text);"><i data-lucide="list" aria-hidden="true"></i> Menedżer Przejść</h3>
        <button class="btn-icon" aria-label="Zamknij" data-action="closeTransitionManagerModal"><i data-lucide="x" aria-hidden="true"></i></button>
      </div>
      
      <!-- Sekcja filtrów -->
      <div style="padding:0.6rem 0.75rem; border-bottom:1px solid var(--border); background:rgba(0,0,0,0.2); flex-shrink:0; display:flex; gap:0.6rem; align-items:flex-start; flex-wrap:wrap;">
         <div style="min-width:140px; flex:1;">
            <div style="font-size:0.6rem; font-weight:600; color:var(--text-muted); text-transform:uppercase; letter-spacing:0.4px; margin-bottom:0.25rem;">Kategoria źródłowa</div>
            <div id="tm-filter-material-tiles" style="display:flex; flex-wrap:wrap; gap:0.15rem;">
                    <div data-action="tmSelectFilterMaterial" data-filter-val=""
                    class="wp-hover-border"
                    style="padding:0.2rem 0.4rem; border-radius:4px; cursor:pointer; font-size:0.62rem; font-weight:600; background:rgba(16,185,129,0.2); border:1.5px solid rgba(16,185,129,0.55); color:#a7f3d0; --hbc:rgba(16,185,129,0.7);">Dowolna</div>
               ${[...allMaterials]
                   .sort()
                   .map((m) => {
                       const safe = m.replace(/'/g, "\\'");
                       return `<div data-val="${safe}" data-action="tmSelectFilterMaterial" data-filter-val="${safe}"
                       class="wp-hover-border"
                       style="padding:0.2rem 0.4rem; border-radius:4px; cursor:pointer; font-size:0.62rem; font-weight:500; background:rgba(255,255,255,0.03); border:1.5px solid rgba(255,255,255,0.06); color:var(--text-primary); --hbc:rgba(16,185,129,0.3);">${m}</div>`;
                   })
                   .join('')}
            </div>
         </div>
         <div style="min-width:90px;">
            <div style="font-size:0.6rem; font-weight:600; color:var(--text-muted); text-transform:uppercase; letter-spacing:0.4px; margin-bottom:0.25rem;">Średnica DN</div>
            <div id="tm-filter-dn-tiles" style="display:flex; flex-wrap:wrap; gap:0.15rem;">
                <div data-action="tmSelectFilterDn" data-filter-val=""
                    class="wp-hover-border"
                    style="padding:0.2rem 0.4rem; border-radius:4px; cursor:pointer; font-size:0.62rem; font-weight:600; background:rgba(16,185,129,0.2); border:1.5px solid rgba(16,185,129,0.55); color:#a7f3d0; --hbc:rgba(16,185,129,0.7);">Dowolne</div>
               ${[...allDNs]
                   .sort((a, b) => parseFloat(a) - parseFloat(b))
                   .map((dn) => {
                       const safe = String(dn).replace(/'/g, "\\'");
                       return `<div data-val="${safe}" data-action="tmSelectFilterDn" data-filter-val="${safe}"
                       class="wp-hover-border"
                       style="padding:0.2rem 0.4rem; border-radius:4px; cursor:pointer; font-size:0.62rem; font-weight:500; background:rgba(255,255,255,0.03); border:1.5px solid rgba(255,255,255,0.06); color:var(--text-primary); --hbc:rgba(16,185,129,0.3);">${dn}</div>`;
                   })
                   .join('')}
            </div>
         </div>
         <div style="min-width:160px; flex:1;">
            <div style="font-size:0.6rem; font-weight:600; color:var(--text-muted); text-transform:uppercase; letter-spacing:0.4px; margin-bottom:0.25rem;">Szukaj</div>
                         <input type="text" id="tm-filter-search" placeholder="Nazwa, materiał, DN..." maxlength="30" data-action="tmApplyFilters"  style="width:100%; padding:0.25rem 0.4rem; font-size:0.65rem; background:#1a2536; border:1.5px solid rgba(255,255,255,0.06); border-radius:4px; color:var(--text-primary); outline:none; transition:all 0.12s;">
         </div>
      </div>

      <!-- Pasek narzędzi -->
      <div style="flex-shrink:0; display:flex; align-items:center; gap:0.75rem; padding:0.45rem 0.75rem; border-bottom:1px solid rgba(255,255,255,0.04); background:rgba(0,0,0,0.12); font-size:0.78rem; color:var(--text-muted);">
         <label style="display:flex; align-items:center; gap:0.35rem; cursor:pointer; padding:0.2rem 0.5rem; background:rgba(16,185,129,0.08); border:1px solid rgba(16,185,129,0.15); border-radius:6px; color:var(--text-primary);">
                         <input type="checkbox" id="tm-select-all" data-action="tmToggleSelectAll"  style="width:15px; height:15px; cursor:pointer;">
            <span class="fw-500">Zaznacz wszystko</span>
         </label>
         <span style="opacity:0.2;">|</span>
         <span>Widoczne: <strong id="tm-visible-count" class="text-primary">0</strong></span>
         <span>Zaznaczone: <strong id="tm-selected-count" style="color:var(--accent);">0</strong></span>
         <div style="margin-left:auto; display:flex; align-items:center; gap:0.3rem;">
            <button data-action="tmSortBy" data-column="wellName" class="wp-hover-btn" style="background:none; border:1px solid rgba(255,255,255,0.08); border-radius:6px; padding:0.25rem 0.5rem; color:var(--text-muted); cursor:pointer; font-size:0.72rem; display:flex; align-items:center; gap:0.3rem; transition:all 0.15s; --hbc:rgba(16,185,129,0.3);--hc:var(--text-primary);">
                <span>↕</span> Sortuj A–Z
            </button>
         </div>
      </div>

      <!-- Karty studni -->
      <div style="flex-grow:1; overflow-y:auto; overflow-x:hidden; padding:0.5rem 0.75rem; background:rgba(0,0,0,0.1);">
         <div id="tm-table-body"></div>
      </div>

      <!-- Panel podglądu przed apply -->
      <div id="tm-preview-panel" style="display:none; padding:0.6rem 1rem; border-top:1px solid var(--border); background:rgba(16,185,129,0.05); flex-shrink:0;">
         <div id="tm-preview-content"></div>
      </div>

      <!-- Panel Akcji -->
      <div style="padding:0.6rem 0.75rem; border-top:1px solid var(--border); background:#1e293b; flex-shrink:0;">
         <div style="display:flex; gap:0.75rem; align-items:flex-end; flex-wrap:wrap;">
            <div style="flex:1; min-width:200px;">
               <div style="font-size:0.6rem; font-weight:600; color:var(--text-muted); text-transform:uppercase; letter-spacing:0.4px; margin-bottom:0.25rem;">Docelowa kategoria (na co zamienić)</div>
               <div id="tm-target-cat-tiles" style="display:flex; flex-wrap:wrap; gap:0.2rem;">
                    <div data-action="tmSelectTargetCat"
                        class="wp-hover-border"
                        style="padding:0.25rem 0.5rem; border-radius:4px; cursor:pointer; font-size:0.65rem; font-weight:600; background:rgba(16,185,129,0.2); border:1.5px solid rgba(16,185,129,0.55); color:#a7f3d0; --hbc:rgba(16,185,129,0.7);">— Wybierz —</div>
                  ${categories
                      .map((cat) => {
                          const safe = cat.replace(/'/g, "\\'");
                          return `<div data-val="${safe}" data-action="tmSelectTargetCat" data-category="${safe}"
                          class="wp-hover-border"
                          style="padding:0.25rem 0.5rem; border-radius:4px; cursor:pointer; font-size:0.65rem; font-weight:500; background:rgba(255,255,255,0.03); border:1.5px solid rgba(255,255,255,0.06); color:var(--text-primary); --hbc:rgba(16,185,129,0.3);">${cat}</div>`;
                      })
                      .join('')}
               </div>
            </div>
            <div style="flex-shrink:0;">
                <button data-action="tmApplyChanges" class="wp-hover-bg" style="background:rgba(16,185,129,0.15); border:1.5px solid rgba(16,185,129,0.4); border-radius:5px; padding:0.35rem 0.8rem; display:flex; align-items:center; gap:0.35rem; font-size:0.72rem; font-weight:600; color:#6ee7b7; cursor:pointer; transition:all 0.15s; --hb:rgba(16,185,129,0.25);">
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
        d.style.background = isSel ? 'rgba(16,185,129,0.2)' : 'rgba(255,255,255,0.03)';
        d.style.borderColor = isSel ? 'rgba(16,185,129,0.55)' : 'rgba(255,255,255,0.06)';
        d.style.color = isSel ? '#a7f3d0' : 'var(--text-primary)';
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
        d.style.background = isSel ? 'rgba(16,185,129,0.2)' : 'rgba(255,255,255,0.03)';
        d.style.borderColor = isSel ? 'rgba(16,185,129,0.55)' : 'rgba(255,255,255,0.06)';
        d.style.color = isSel ? '#a7f3d0' : 'var(--text-primary)';
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
                const safeMaterial = tr.material.replace(/'/g, "\\'");
                const locked = isWellLocked(w.wellIndex);
                return `
            <div ${locked ? '' : `data-action="tmOpenEditTransitionPopup" data-well-idx="${w.wellIndex}" data-tr-idx="${tr.trIndex}"`}
                  style="background:${isSel ? 'rgba(16,185,129,0.15)' : '#1a2536'};
                         border:1px solid ${isSel ? 'rgba(16,185,129,0.4)' : 'rgba(255,255,255,0.06)'};
                         border-radius:8px; padding:0.4rem 0.45rem; ${locked ? 'cursor:default;' : 'cursor:pointer;'}
                         transition:all 0.2s; display:flex; flex-direction:column; gap:0.1rem;"
                  data-wp-locked="${locked}" data-wp-sel="${isSel}">
              <div style="display:flex; justify-content:space-between; align-items:center; gap:0.3rem;">
                <div style="display:flex; align-items:center; gap:0.3rem; min-width:0; flex:1;">
                  <input type="checkbox" class="tm-row-cb" value="${key}" ${isSel ? 'checked' : ''} data-action="tmToggleTransition" data-key="${key}"
                         style="width:14px; height:14px; cursor:pointer; margin:0; flex-shrink:0;" ${locked ? 'disabled' : ''}>
                  <span style="font-size:0.76rem; font-weight:700; color:var(--text-primary); white-space:nowrap; overflow:hidden; text-overflow:ellipsis;" title="${safeMaterial}">${tr.material}</span>
                  <span style="font-size:0.82rem; font-weight:800; color:#4ade80; flex-shrink:0;">DN${tr.dnRaw}</span>
                </div>
                ${
                    locked
                        ? ''
                        : `
                <button data-action="tmOpenEditTransitionPopup" data-well-idx="${w.wellIndex}" data-tr-idx="${tr.trIndex}" class="wp-hover-bg"
                        style="background:rgba(16,185,129,0.12); border:1px solid rgba(16,185,129,0.2); border-radius:4px; cursor:pointer; padding:0.05rem 0.3rem; color:#34d399; font-size:0.6rem; line-height:1.3; flex-shrink:0; transition:all 0.15s; --hb:rgba(16,185,129,0.25);">
                  ✎
                </button>`
                }
              </div>
              <div style="display:flex; gap:0.3rem; align-items:center; font-size:0.65rem; color:var(--text-muted);">
                <span>${tr.rzedna != null ? parseFloat(tr.rzedna).toFixed(2) + 'm' : '—'}</span>
                <span style="opacity:0.3;">·</span>
                <span style="color:#fcd34d; font-weight:600;">${tr.angle}°</span>
                <span style="opacity:0.3;">·</span>
                <span style="background:${tr.flowType === FLOW_TYPES.WLOT ? 'rgba(52,211,153,0.18)' : 'rgba(251,191,36,0.18)'}; color:${tr.flowType === FLOW_TYPES.WLOT ? '#34d399' : '#fbbf24'}; padding:0.02rem 0.3rem; border-radius:3px; font-size:0.6rem; font-weight:700;">${tr.flowType === FLOW_TYPES.WLOT ? 'WLOT' : 'WYLOT'}</span>
              </div>
            </div>`;
            })
            .join('');

        const wellLocked = isWellLocked(w.wellIndex);
        html += `
        <div style="background:#111827; border:1px solid ${wellLocked ? 'rgba(239,68,68,0.2)' : wellSomeSel ? 'rgba(16,185,129,0.25)' : 'rgba(255,255,255,0.06)'}; border-radius:10px; margin-bottom:0.6rem; overflow:hidden; transition:all 0.2s;${wellLocked ? ' opacity:0.7;' : ''}">
          <div style="display:flex; align-items:center; padding:0.55rem 0.75rem; background:rgba(255,255,255,0.02); border-bottom:1px solid rgba(255,255,255,0.05);">
            <input type="checkbox" ${wellAllSel ? 'checked' : ''} data-action="tmToggleWell" data-well-index="${w.wellIndex}"
                   style="width:16px; height:16px; margin-right:0.75rem; cursor:pointer;" ${wellLocked ? 'disabled' : ''}>
            <div style="flex:1; display:flex; align-items:center; gap:0.75rem; flex-wrap:wrap;">
              <span style="font-weight:700; color:var(--text-primary); font-size:0.85rem;">${w.wellName}</span>
              ${wellLocked ? '<span style="color:#f87171; font-size:0.68rem; display:flex; align-items:center; gap:0.2rem;"><i data-lucide="lock" style="width:12px;height:12px;"></i>Zablokowana</span>' : ''}
              <span style="color:var(--text-muted); font-size:0.72rem; background:rgba(255,255,255,0.04); border:1px solid rgba(255,255,255,0.06); padding:0.1rem 0.45rem; border-radius:5px; font-weight:600;">DN${w.wellDn}</span>
              <span style="color:var(--text-muted); font-size:0.72rem;">Rzędna: ${w.rzednaDna}</span>
              <span style="color:#34d399; font-weight:700; font-size:0.8rem;">${fmtInt(w.price)} PLN</span>
            </div>
            <span style="color:var(--text-muted); font-size:0.68rem; background:rgba(16,185,129,0.1); padding:0.15rem 0.55rem; border-radius:12px; white-space:nowrap; font-weight:500; border:1px solid rgba(16,185,129,0.15);">
              ${wellSelCount}/${matchingTrs.length}
            </span>
          </div>
          <div style="display:grid; grid-template-columns:repeat(auto-fill, minmax(230px, 1fr)); gap:0.45rem; padding:0.55rem;">
            ${tilesHtml}
          </div>
        </div>`;
    });

    if (visibleCount === 0) {
        html = `<div style="text-align:center; padding:3rem 1rem; color:var(--text-muted); font-size:0.9rem;">
                  <div style="font-size:2.5rem; margin-bottom:0.5rem; opacity:0.2;">⊘</div>
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
    if (isWellLocked(wellIdx)) return;
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
        if (isChecked && isWellLocked(wellIdx)) return;
        if (isChecked) tmSelectedTransitions.add(key);
        else tmSelectedTransitions.delete(key);
    });

    tmRenderTable();
};

let tmEditSelectedCat = null;
let tmEditSelectedDn = null;

window.tmOpenEditTransitionPopup = function (wellIdx, trIdx, sourceEl) {
    if (!sourceEl) return;
    if (isWellLocked(wellIdx)) {
        showToast(
            '<i data-lucide="lock"></i> Studnia zablokowana — posiada zamówienie lub zaakceptowane zlecenie produkcyjne.',
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

    const rect = sourceEl.getBoundingClientRect();
    const popupW = 340;
    let left = Math.min(rect.left, window.innerWidth - popupW - 16);
    if (left < 8) left = 8;
    const top = rect.bottom + 4;
    const maxH = Math.min(400, window.innerHeight - top - 72);

    const popup = document.createElement('div');
    popup.id = 'tm-edit-popup';
    popup.style.cssText = `position:fixed;z-index:100000;background:#1e293b;border:1px solid rgba(16,185,129,0.3);border-radius:10px;padding:0.6rem;box-shadow:0 20px 60px rgba(0,0,0,0.5);width:${popupW}px;top:${top}px;left:${left}px;animation:fadeIn 0.1s ease;`;
    if (maxH > 120) {
        popup.style.maxHeight = maxH + 'px';
        popup.style.overflowY = 'auto';
    }

    const currentLabel = currentP ? `${currentP.category} DN${currentP.dn}` : 'Nieznane';

    popup.innerHTML = `
      <div style="display:flex;justify-content:space-between;align-items:center;padding:0 0.1rem 0.4rem;border-bottom:1px solid rgba(255,255,255,0.05);margin-bottom:0.45rem;">
        <div><div style="font-weight:700;color:var(--text-primary);font-size:0.8rem;">Zmień przejście</div><div style="font-size:0.64rem;color:var(--text-muted);">Aktualnie: ${currentLabel}</div></div>
        <button data-action="closeEditPopup" style="background:rgba(255,255,255,0.05);border:none;border-radius:4px;color:var(--text-muted);cursor:pointer;font-size:0.85rem;padding:0.1rem 0.35rem;line-height:1.3;">✕</button>
      </div>
      <div style="display:flex;gap:0.5rem;">
        <div style="flex:1;min-width:0;">
          <div style="font-size:0.6rem;font-weight:600;color:var(--text-muted);text-transform:uppercase;letter-spacing:0.4px;margin-bottom:0.25rem;">Typ</div>
          <div id="tm-edit-type-list" style="display:flex;flex-direction:column;gap:0.15rem;max-height:180px;overflow-y:auto;padding-right:0.15rem;">
            ${categories
                .map((cat) => {
                    const isCur = cat === currentCat;
                    return `<div data-cat="${cat}" data-action="tmEditSelectType" data-well-idx="${wellIdx}" data-tr-idx="${trIdx}" data-wp-cur="${isCur}" class="wp-hover-border"
                   style="padding:0.3rem 0.45rem;border-radius:5px;cursor:pointer;font-size:0.7rem;font-weight:600;background:${isCur ? 'rgba(16,185,129,0.2)' : 'rgba(255,255,255,0.03)'};border:1.5px solid ${isCur ? 'rgba(16,185,129,0.55)' : 'rgba(255,255,255,0.06)'};color:${isCur ? '#a7f3d0' : 'var(--text-primary)'};transition:all 0.12s;display:flex;align-items:center;gap:0.35rem;${isCur ? 'box-shadow:0 0 8px rgba(16,185,129,0.15);' : ''}--hbc:rgba(16,185,129,0.35);">${isCur ? '<span style="color:#34d399;font-size:0.75rem;">◆</span>' : '<span style="color:transparent;font-size:0.75rem;">◆</span>'}${cat}</div>`;
                })
                .join('')}
          </div>
        </div>
        <div style="flex:1;min-width:0;">
          <div style="font-size:0.6rem;font-weight:600;color:var(--text-muted);text-transform:uppercase;letter-spacing:0.4px;margin-bottom:0.25rem;">Średnica</div>
          <div id="tm-edit-dn-list" style="display:flex;flex-direction:column;gap:0.15rem;max-height:180px;overflow-y:auto;padding-right:0.15rem;">
            ${allDNs
                .map((dn) => {
                    const isCur = dn === currentDn;
                    return `<div data-dn="${dn}" data-action="tmEditSelectDN" data-well-idx="${wellIdx}" data-tr-idx="${trIdx}" data-wp-cur="${isCur}" class="wp-hover-border"
                   style="padding:0.3rem 0.45rem;border-radius:5px;cursor:pointer;font-size:0.7rem;font-weight:700;background:${isCur ? 'rgba(52,211,153,0.2)' : 'rgba(255,255,255,0.03)'};border:1.5px solid ${isCur ? 'rgba(52,211,153,0.55)' : 'rgba(255,255,255,0.06)'};color:${isCur ? '#6ee7b7' : 'var(--text-primary)'};transition:all 0.12s;display:flex;align-items:center;gap:0.35rem;${isCur ? 'box-shadow:0 0 8px rgba(52,211,153,0.15);' : ''}--hbc:rgba(52,211,153,0.35);">${isCur ? '<span style="color:#34d399;font-size:0.75rem;">◆</span>' : '<span style="color:transparent;font-size:0.75rem;">◆</span>'}DN${dn}</div>`;
                })
                .join('')}
          </div>
        </div>
      </div>
      <div id="tm-edit-result" style="margin-top:0.45rem;padding:0.35rem 0.45rem;background:rgba(0,0,0,0.2);border-radius:6px;display:flex;justify-content:space-between;align-items:center;">
        <span style="color:var(--text-muted);font-size:0.7rem;">Wybierz typ i średnicę</span>
        <button id="tm-edit-apply-btn" data-action="tmEditApply" data-well-idx="${wellIdx}" data-tr-idx="${trIdx}" style="display:none;background:#6366f1;border:none;border-radius:5px;padding:0.28rem 0.55rem;color:#fff;font-size:0.7rem;font-weight:600;cursor:pointer;">Zastosuj</button>
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
        div.style.background = 'rgba(255,255,255,0.03)';
        div.style.borderColor = 'rgba(255,255,255,0.06)';
        div.style.color = 'var(--text-primary)';
        div.style.boxShadow = 'none';
        const dot = div.querySelector('span');
        if (dot) dot.innerHTML = '◆';
        dot.style.color = 'transparent';
    });
    el.style.background = 'rgba(16,185,129,0.2)';
    el.style.borderColor = 'rgba(16,185,129,0.55)';
    el.style.color = '#a7f3d0';
    el.style.boxShadow = '0 0 8px rgba(16,185,129,0.15)';
    const dot = el.querySelector('span');
    if (dot) dot.style.color = '#34d399';

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
        .map(
            (dn) =>
                `<div data-dn="${dn}" data-action="tmEditSelectDN" data-well-idx="${wellIdx}" data-tr-idx="${trIdx}" class="wp-hover-border" style="padding:0.3rem 0.45rem;border-radius:5px;cursor:pointer;font-size:0.7rem;font-weight:600;background:rgba(255,255,255,0.03);border:1.5px solid rgba(255,255,255,0.06);color:var(--text-primary);transition:all 0.12s;display:flex;align-items:center;gap:0.35rem;--hbc:rgba(52,211,153,0.35);"><span style="color:transparent;font-size:0.75rem;">◆</span>DN${dn}</div>`
        )
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
        div.style.background = 'rgba(255,255,255,0.03)';
        div.style.borderColor = 'rgba(255,255,255,0.06)';
        div.style.color = 'var(--text-primary)';
        div.style.boxShadow = 'none';
        const dot = div.querySelector('span');
        if (dot) dot.style.color = 'transparent';
    });
    el.style.background = 'rgba(52,211,153,0.2)';
    el.style.borderColor = 'rgba(52,211,153,0.55)';
    el.style.color = '#6ee7b7';
    el.style.boxShadow = '0 0 8px rgba(52,211,153,0.15)';
    const dot = el.querySelector('span');
    if (dot) dot.style.color = '#34d399';

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
            resultDiv.innerHTML = `<div><span style="color:var(--text-primary);font-size:0.73rem;font-weight:600;">${escapeHtml(product.category)} DN${escapeHtml(product.dn)}</span><span style="color:#34d399;font-weight:700;margin-left:0.5rem;font-size:0.7rem;">${product.price != null ? parseInt(product.price).toLocaleString('pl-PL') : '—'} PLN</span></div>
              <button data-action="tmEditApply" data-well-idx="${wellIdx}" data-tr-idx="${trIdx}" style="background:#6366f1;border:none;border-radius:5px;padding:0.28rem 0.55rem;color:#fff;font-size:0.7rem;font-weight:600;cursor:pointer;">Zastosuj</button>`;
        }
    }
}

async function tmEditApply(wellIdx, trIdx) {
    if (!tmEditSelectedCat || !tmEditSelectedDn) return;
    if (isWellLocked(wellIdx)) {
        document.getElementById('tm-edit-popup')?.remove();
        showToast('<i data-lucide="lock"></i> Studnia zablokowana.', 'error');
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
        logger.error('wellPopups', 'tmEditApply error:', e);
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

        const label = `${well.name || `Studnia ${wellIdx + 1}`} — ${p.category} DN${p.dn}`;
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
        html += `<div style="display:flex; align-items:center; gap:0.4rem; margin-bottom:0.3rem;"><span style="color:#34d399; font-weight:800;">✅ Zostanie zamienione: ${replaceList.length}</span></div>`;
        html += '<div style="display:flex; flex-wrap:wrap; gap:0.3rem; margin-bottom:0.5rem;">';
        replaceList.forEach((l) => {
            html += `<span style="background:rgba(52,211,153,0.1); border:1px solid rgba(52,211,153,0.2); color:#34d399; padding:0.1rem 0.4rem; border-radius:4px; font-size:0.72rem;">${escapeHtml(l)}</span>`;
        });
        html += '</div>';
    }
    if (skipList.length > 0) {
        html += `<div style="display:flex; align-items:center; gap:0.4rem; margin-bottom:0.3rem;"><span style="color:#f87171; font-weight:800;">⚠️ Brak odpowiednika w ${targetCat}: ${skipList.length}</span></div>`;
        html += '<div style="display:flex; flex-wrap:wrap; gap:0.3rem;">';
        skipList.forEach((l) => {
            html += `<span style="background:rgba(239,68,68,0.1); border:1px solid rgba(239,68,68,0.2); color:#f87171; padding:0.1rem 0.4rem; border-radius:4px; font-size:0.72rem;">${escapeHtml(l)}</span>`;
        });
        html += '</div>';
    }

    content.innerHTML = html;
    panel.style.display = 'block';
};

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

        if (isWellLocked(wellIdx)) {
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
            `Pominięto ${skippedLocked.size} zablokowaną studnię/studnie (zamówienie/zlecenie).`,
            'warning'
        );
    }

    if (replacedCount === 0) {
        if (skippedLocked.size > 0) {
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
            <td style="padding:0.35rem 0.6rem; white-space:nowrap;">${i + 1}</td>
            <td style="padding:0.35rem 0.6rem; white-space:nowrap;">${s.wellName}</td>
            <td style="padding:0.35rem 0.6rem; white-space:nowrap;">${s.material}</td>
            <td style="padding:0.35rem 0.6rem; text-align:center; white-space:nowrap;">${s.dn}</td>
            <td style="padding:0.35rem 0.6rem; white-space:nowrap; color:#f87171;">Brak produktu ${s.targetCat} o średnicy ${s.dn}</td>
        </tr>
    `
        )
        .join('');

    showModal({
        id: 'skipped-popup-modal',
        titleId: 'skipped-title',
        html: `
      <div style="background:var(--bg-secondary, #1e293b); border:1px solid rgba(239,68,68,0.3); border-radius:16px; padding:1.2rem 1.5rem; width:700px; max-width:92vw; max-height:85vh; overflow-y:auto; box-shadow:0 20px 60px rgba(0,0,0,0.5);">
        <div style="display:flex; align-items:center; justify-content:space-between; margin-bottom:1rem; position:sticky; top:0; background:var(--bg-secondary, #1e293b); padding-bottom:0.5rem; border-bottom:1px solid rgba(255,255,255,0.08);">
          <div id="skipped-title" style="font-size:1rem; font-weight:800; color:#f87171;"><i data-lucide="alert-triangle" aria-hidden="true"></i> Pominięte przejścia (${skippedDetails.length})</div>
          <button class="btn-icon" aria-label="Zamknij" data-action="closeModal" style="background:none; border:none; color:var(--text-muted); font-size:1.2rem; cursor:pointer; padding:0.2rem;"><i data-lucide="x" aria-hidden="true"></i></button>
        </div>
        <div style="font-size:0.8rem; color:var(--text-muted); margin-bottom:1rem;">
            Poniższe przejścia nie zostały zamienione — w kategorii <strong>${targetCat}</strong> nie istnieje produkt o podanej średnicy.
        </div>
        <table style="width:100%; font-size:0.8rem; border-collapse:collapse;">
            <thead style="position:sticky; top:0; background:#1e293b;">
                <tr style="border-bottom:1px solid rgba(255,255,255,0.08);">
                    <th style="padding:0.4rem 0.6rem; text-align:left; white-space:nowrap;">Lp.</th>
                    <th style="padding:0.4rem 0.6rem; text-align:left; white-space:nowrap;">Studnia</th>
                    <th style="padding:0.4rem 0.6rem; text-align:left; white-space:nowrap;">Obecny typ</th>
                    <th style="padding:0.4rem 0.6rem; text-align:center; white-space:nowrap;">Średnica</th>
                    <th style="padding:0.4rem 0.6rem; text-align:left; white-space:nowrap;">Powód pominięcia</th>
                </tr>
            </thead>
            <tbody>${rowsHtml}</tbody>
        </table>
        <div style="display:flex; justify-content:space-between; align-items:center; margin-top:1rem; padding-top:0.8rem; border-top:1px solid rgba(255,255,255,0.08);">
            <button class="btn btn-secondary" data-action="closeModalActivatePreview" style="font-size:0.8rem; padding:0.4rem 1rem; background:rgba(16,185,129,0.15); border:1px solid rgba(16,185,129,0.3); color:#34d399;">
                <i data-lucide="arrow-left"></i> Wróć do menedżera
            </button>
            <button class="btn btn-secondary" data-action="closeModal" style="font-size:0.8rem; padding:0.4rem 1.2rem;">Zamknij</button>
        </div>
      </div>
    `
    });
    if (window.lucide) window.lucide.createIcons();
}
