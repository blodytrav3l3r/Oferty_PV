// @ts-check
/* ===== wellTransitionManagerModal.js — modal menedżera przejść ===== */

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

window.tmEditSelectType = tmEditSelectType;
window.tmEditSelectDN = tmEditSelectDN;
window.tmEditApply = tmEditApply;
