// @ts-check
/* ===== Popupy dla przejść ===== */

function openPrzejsciaVisibilityPopup(containerId) {
    const allTypes =
        typeof getPrzejsciaCategories === 'function'
            ? getPrzejsciaCategories()
            : [
                  ...new Set(
                      studnieProducts
                          .filter((p) => p.componentType === 'przejscie' && p.active !== 0)
                          .map((p) => p.category)
                  )
              ].sort();

    let overlay = document.getElementById('przejscia-visibility-overlay');
    if (overlay) overlay.remove();

    overlay = document.createElement('div');
    overlay.id = 'przejscia-visibility-overlay';
    overlay.classList.add('js-modal-overlay');
    overlay.setAttribute('role', 'dialog');
    overlay.setAttribute('aria-modal', 'true');
    overlay.setAttribute('aria-label', 'Widoczność typów przejść');
    // ponytail: 1100 (EXCEL) < 2000 (zlecenia-overlay) -> popup niewidoczny w Zleceniu Produkcyjnym. Uzycie PRZEJSCIA_VIS_POPUP (2100) > GENERIC_MODAL
    const popupZ = (typeof LAYERS !== 'undefined' && LAYERS.PRZEJSCIA_VIS_POPUP) || 2100;
    overlay.style.cssText =
        'position:fixed; inset:0; z-index:' +
        popupZ +
        ';background:var(--shadow-color); display:flex; align-items:center; justify-content:center; animation:fadeInOverlay 0.2s ease;';
    overlay.onclick = (e) => {
        if (e.target === overlay) closePrzejsciaVisibilityPopup(containerId);
    };
    overlay.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') closePrzejsciaVisibilityPopup(containerId);
    });

    const visibleCount = allTypes.filter((t) => visiblePrzejsciaTypes.has(t)).length;

    // Zawsze ostatni kafelek: dodanie przejścia spoza cennika.
    const customTileHtml = `<div class="przejscia-vis-tile przejscia-vis-tile--custom"
                    data-action="openCustomPrzejscieFromPopup" data-container="${escapeHtmlAttr(containerId || '')}"
                    title="Dodaj przejście spoza cennika"
                    style="background:rgba(var(--accent2-rgb), 0.16); border:1px dashed rgba(var(--accent2-rgb), 0.6); color:var(--accent2-hover);">
                   <div class="przejscia-vis-tile-name" style="display:flex; align-items:center; gap:0.3rem; color:var(--accent2-hover);">
                       <i data-lucide="plus" aria-hidden="true"></i> Niestandardowe
                   </div>
               </div>`;

    const tilesHtml =
        (allTypes.length === 0
            ? `<div class="empty-state" style="padding:0.8rem; text-align:center; color:var(--text-muted); font-size: var(--fs-xs);">Brak przejść w aktywnym katalogu cennika.<br>Odśwież stronę lub sprawdź wersję ACTIVE cennika studni.</div>`
            : allTypes
                  .map((t) => {
                      const isVisible = visiblePrzejsciaTypes.has(t);
                      return `
             <div class="przejscia-vis-tile ${isVisible ? 'visible' : 'hidden-type'}"
                  data-action="togglePrzejsciaTypeVisibility" data-t="${escapeJsStr(t)}"
                  title="${escapeHtmlAttr(t)}">
                 <div class="przejscia-vis-tile-name">${escapeHtml(t)}</div>
             </div>`;
                  })
                  .join('')) + customTileHtml;

    overlay.innerHTML = `
        <div class="przejscia-vis-popup">
            <div class="przejscia-vis-header">
                <div>
                    <h3 style="margin:0; font-size: var(--fs-lg); font-weight: var(--fw-extrabold); color:var(--text-primary);">Pokaż / Ukryj przejścia</h3>
                    <div class="przejscia-vis-counter" style="font-size: var(--fs-2xs); color:var(--text-muted); margin-top:0.1rem;">Kliknij kafelek aby przełączyć widoczność. Widoczne: <strong class="color-success">${visibleCount}</strong> / ${allTypes.length}</div>
                </div>
                <button type="button" data-action="closePrzejsciaVisibilityPopup" data-container="${containerId || ''}" class="excel-icon-btn is-danger" style="font-size: var(--fs-2xl);" aria-label="Zamknij"><i data-lucide="x" aria-hidden="true"></i></button>
            </div>
            <div class="przejscia-vis-actions">
                <button class="przejscia-vis-action-btn" data-action="setPrzejsciaVisibilityAll" data-val="1">Pokaż wszystkie</button>
                <button class="przejscia-vis-action-btn" data-action="setPrzejsciaVisibilityAll" data-val="0">Ukryj wszystkie</button>
            </div>
            <div class="przejscia-vis-grid">
                ${tilesHtml}
            </div>
        </div>
    `;

    document.body.appendChild(overlay);
    if (typeof trapFocus === 'function') {
        /** @type {any} */ (overlay)._previousFocus = document.activeElement;
        trapFocus(overlay);
    }

    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    ctx.font = '700 0.85rem Inter, sans-serif';
    const maxTextWidth = Math.max(...allTypes.map((n) => ctx.measureText(n).width));
    const tileMinW = Math.ceil(maxTextWidth + 24);
    const gridEl = overlay.querySelector('.przejscia-vis-grid');
    if (gridEl) gridEl.style.setProperty('--tile-min-w', tileMinW + 'px');
}

function closePrzejsciaVisibilityPopup(containerId) {
    const overlay = document.getElementById('przejscia-visibility-overlay');
    if (overlay) {
        if (typeof untrapFocus === 'function') untrapFocus(overlay);
        overlay.remove();
        if (typeof restoreBodyScroll === 'function') restoreBodyScroll();
    }
    if (containerId === 'excel') {
        if (typeof excelRefreshActiveTable === 'function') excelRefreshActiveTable();
        return;
    }
    renderInlinePrzejsciaApp(containerId);
}

function togglePrzejsciaTypeVisibility(type) {
    if (visiblePrzejsciaTypes.has(type)) {
        visiblePrzejsciaTypes.delete(type);
    } else {
        visiblePrzejsciaTypes.add(type);
    }
    refreshPrzejsciaVisibilityTiles();
}

function setPrzejsciaVisibilityAll(visible) {
    const allTypes =
        typeof getPrzejsciaCategories === 'function'
            ? getPrzejsciaCategories()
            : [
                  ...new Set(
                      studnieProducts
                          .filter((p) => p.componentType === 'przejscie' && p.active !== 0)
                          .map((p) => p.category)
                  )
              ];
    if (visible) {
        allTypes.forEach((t) => visiblePrzejsciaTypes.add(t));
    } else {
        visiblePrzejsciaTypes.clear();
    }
    refreshPrzejsciaVisibilityTiles();
}

function refreshPrzejsciaVisibilityTiles() {
    const overlay = document.getElementById('przejscia-visibility-overlay');
    if (!overlay) return;

    const allTypes =
        typeof getPrzejsciaCategories === 'function'
            ? getPrzejsciaCategories()
            : [
                  ...new Set(
                      studnieProducts
                          .filter((p) => p.componentType === 'przejscie' && p.active !== 0)
                          .map((p) => p.category)
                  )
              ].sort();
    const visibleCount = allTypes.filter((t) => visiblePrzejsciaTypes.has(t)).length;

    const counterEl = overlay.querySelector('.przejscia-vis-counter');
    if (counterEl)
        counterEl.innerHTML = `Kliknij kafelek aby przełączyć widoczność. Widoczne: <strong class="color-success">${visibleCount}</strong> / ${allTypes.length}`;

    const tiles = overlay.querySelectorAll('.przejscia-vis-tile[data-t]');
    tiles.forEach((tile) => {
        const type = tile.getAttribute('title');
        const isVisible = visiblePrzejsciaTypes.has(type);
        tile.classList.toggle('visible', isVisible);
        tile.classList.toggle('hidden-type', !isVisible);
    });
}

/* ===== Delegacja kliknięć (data-action) — TASK-036 ===== */
if (typeof document !== 'undefined' && !window.__wtpDelegated) {
    window.__wtpDelegated = true;
    document.addEventListener('click', (e) => {
        const el = e.target.closest('[data-action]');
        if (!el) return;
        const action = el.getAttribute('data-action') || '';
        const t = el.getAttribute('data-t');
        const container = el.getAttribute('data-container');
        const val = el.getAttribute('data-val');
        const index = el.getAttribute('data-index');
        const id = el.getAttribute('data-id');
        if (action === 'wtSetFlow') {
            window.confirmPrzejscieFlow(parseInt(index, 10), el.getAttribute('data-flow'));
        } else if (action === 'togglePrzejsciaTypeVisibility') {
            window.togglePrzejsciaTypeVisibility(t);
        } else if (action === 'closePrzejsciaVisibilityPopup') {
            window.closePrzejsciaVisibilityPopup(container || '');
        } else if (action === 'openCustomPrzejscieFromPopup') {
            window.closePrzejsciaVisibilityPopup(container || '');
            if (typeof window.openCustomPrzejscieTypeModal === 'function')
                window.openCustomPrzejscieTypeModal({ mode: 'create' });
        } else if (action === 'setPrzejsciaVisibilityAll') {
            window.setPrzejsciaVisibilityAll(val === '1');
        } else if (action === 'confirmChangePrzejscieType') {
            window.confirmChangePrzejscieType(parseInt(index, 10), t);
        } else if (action === 'confirmChangeCustomPrzejscieType') {
            window.confirmChangeCustomPrzejscieType(
                parseInt(index, 10),
                el.getAttribute('data-type') || ''
            );
        } else if (action === 'confirmChangePrzejscieDn') {
            window.confirmChangePrzejscieDn(parseInt(index, 10), id);
        }
    });
}

window.openPrzejsciaVisibilityPopup = openPrzejsciaVisibilityPopup;
window.closePrzejsciaVisibilityPopup = closePrzejsciaVisibilityPopup;
window.togglePrzejsciaTypeVisibility = togglePrzejsciaTypeVisibility;
window.setPrzejsciaVisibilityAll = setPrzejsciaVisibilityAll;

/* ===== Flow type, change type, change DN popupy ===== */

window.openFlowTypePopup = function (index) {
    if (isOfferLocked()) {
        showToast(OFFER_LOCKED_MSG, 'error');
        return;
    }
    if (isWellLocked()) {
        showToast(WELL_LOCKED_MSG, 'error');
        return;
    }
    const well = getCurrentWell();
    if (!well || !well.przejscia || !well.przejscia[index]) return;

    window.showModal({
        id: 'flow-type-modal',
        titleId: 'flow-type-title',
        html: `
        <div class="modal modal--prz-flow">
            <div class="modal-header">
                <h3 id="flow-type-title">Wybierz typ przepływu</h3>
                <button class="btn-icon" aria-label="Zamknij" data-csp="closeModal" data-csp-args="[]"><i data-lucide="x" aria-hidden="true"></i></button>
            </div>
            <div style="display:flex; gap:0.8rem; justify-content:center; padding:0.4rem 0;">
                <button id="flow-wlot-btn" class="prz-flow-btn prz-flow-btn--wlot"
                    data-action="wtSetFlow" data-index="${index}" data-flow="${FLOW_TYPES.WLOT}">
                    <i data-lucide="download" aria-hidden="true"></i>WLOT
                </button>
                <button id="flow-wylot-btn" class="prz-flow-btn prz-flow-btn--wylot"
                    data-action="wtSetFlow" data-index="${index}" data-flow="${FLOW_TYPES.WYLOT}">
                    <i data-lucide="upload" aria-hidden="true"></i>WYLOT
                </button>
            </div>
            <div class="modal-footer" style="justify-content:center;">
                <button class="btn btn-secondary" data-csp="closeModal" data-csp-args="[]">Anuluj</button>
            </div>
        </div>`
    });
    if (window.lucide && window.lucide.createIcons) window.lucide.createIcons();
};

window.confirmPrzejscieFlow = function (index, flow) {
    const well = getCurrentWell();
    if (!well || !well.przejscia || !well.przejscia[index]) return;
    if (flow !== FLOW_TYPES.WLOT && flow !== FLOW_TYPES.WYLOT) return;
    well.przejscia[index].flowType = flow;
    well.przejscia[index].flowTypeManual = true;
    closeModal();
    if (typeof window.refreshPrzejsciaViews === 'function') window.refreshPrzejsciaViews();
    else renderWellPrzejscia();
    window.refreshZleceniaModalIfActive();
};

window.openChangePrzejscieTypePopup = function (index) {
    if (isOfferLocked()) {
        showToast(OFFER_LOCKED_MSG, 'error');
        return;
    }
    if (isWellLocked()) {
        showToast(WELL_LOCKED_MSG, 'error');
        return;
    }
    const well = getCurrentWell();
    if (!well || !well.przejscia || !well.przejscia[index]) return;

    const item = well.przejscia[index];
    const isCustomCurr = typeof isCustomPrzejscie === 'function' && isCustomPrzejscie(item);
    const currTypeId = item.productId;
    const currProduct = isCustomCurr
        ? null
        : typeof getStudnieProductById === 'function'
          ? getStudnieProductById(currTypeId)
          : studnieProducts.find((p) => p.id === currTypeId);
    if (!isCustomCurr && !currProduct) return;

    const allTypes =
        typeof getPrzejsciaCategories === 'function'
            ? getPrzejsciaCategories()
            : [
                  ...new Set(
                      studnieProducts
                          .filter((p) => p.componentType === 'przejscie' && p.active !== 0)
                          .map((p) => p.category)
                  )
              ].sort();
    const customTypes =
        typeof getCustomPrzejsciaTypesList === 'function' ? getCustomPrzejsciaTypesList() : [];
    const currCustomTypeId = isCustomCurr ? String(item.customTypeId || '') : '';

    window.showModal({
        id: 'change-prz-type-modal',
        titleId: 'change-prz-type-title',
        html: `
        <div class="modal modal--prz">
            <div class="modal-header">
                <h3 id="change-prz-type-title">Zmień rodzaj przejścia</h3>
                <button class="btn-icon" aria-label="Zamknij" data-csp="closeModal" data-csp-args="[]"><i data-lucide="x" aria-hidden="true"></i></button>
            </div>
            <div class="prz-grid">
                ${allTypes
                    .map((t) => {
                        const isActive = !!currProduct && t === currProduct.category;
                        return `<button data-action="confirmChangePrzejscieType" data-index="${index}" data-t="${escapeJsStr(t)}"
                             class="prz-grid-btn ${isActive ? 'prz-grid-btn--active' : ''}">
                             ${escapeHtml(t)}
                        </button>`;
                    })
                    .join('')}
                ${customTypes
                    .map((ct) => {
                        const isActive = String(ct.id) === currCustomTypeId;
                        return `<button data-action="confirmChangeCustomPrzejscieType" data-index="${index}" data-type="${escapeHtmlAttr(String(ct.id))}"
                             class="prz-grid-btn ${isActive ? 'prz-grid-btn--active' : ''}">
                             ${escapeHtml(ct.name)}
                        </button>`;
                    })
                    .join('')}
            </div>
            <div class="modal-footer" style="justify-content:center;">
                <button class="btn btn-secondary" data-csp="closeModal" data-csp-args="[]">Anuluj</button>
            </div>
        </div>`
    });
    if (window.lucide && window.lucide.createIcons) window.lucide.createIcons();
};

window.confirmChangePrzejscieType = function (index, newType) {
    const well = getCurrentWell();
    if (!well || !well.przejscia || !well.przejscia[index]) return;

    const maxPipeDnType = typeof getMaxPipeDn === 'function' && well ? getMaxPipeDn(well.dn) : 9999;
    const allForType =
        typeof getPrzejsciaForCategory === 'function'
            ? getPrzejsciaForCategory(newType)
            : studnieProducts.filter((p) => p.category === newType);
    let available = allForType
        .filter((p) => {
            if (p.category === 'Otwór KPED') return true;
            let pDn = 160;
            if (typeof p.dn === 'string' && p.dn.includes('/')) {
                pDn = parseFloat(p.dn.split('/')[0]) || 160;
            } else {
                pDn = parseFloat(p.dn) || 160;
            }
            return pDn <= maxPipeDnType;
        })
        .sort((a, b) => a.dn - b.dn);
    // fallback: brak produktu w limicie — użyj pełnej listy (legacy)
    if (available.length === 0) {
        available = [...allForType].sort((a, b) => a.dn - b.dn);
    }
    if (available.length > 0) {
        const item = well.przejscia[index];
        item.productId = available[0].id;
        delete item.isCustom;
        delete item.customName;
        delete item.customPrice;
        delete item.customWeight;
        delete item.customTypeId;
        delete item.dn;
        delete item.frozenPrice;
        delete item.frozenPriceBase;
        delete item.frozenName;
        delete item.frozenTransitionPrice;
        delete item.frozenDrillingPrice;
        delete item.frozenDrillingName;
        delete item.frozenDrillingDn;

        closeModal();
        if (typeof refreshActiveWell === 'function') refreshActiveWell();
        else refreshAll();
        autoSelectComponents(true);
        window.refreshZleceniaModalIfActive();
        showToast('Zmieniono materiał przejścia', 'success');
    }
};

window.confirmChangeCustomPrzejscieType = function (index, typeId) {
    const well = getCurrentWell();
    if (!well || !well.przejscia || !well.przejscia[index]) return;
    const type =
        typeof getCustomPrzejsciaTypesList === 'function'
            ? getCustomPrzejsciaTypesList().find((t) => t && String(t.id) === String(typeId))
            : null;
    const variants =
        type && typeof window.sortCustomPrzejsciaVariants === 'function'
            ? window.sortCustomPrzejsciaVariants(type.variants)
            : type
              ? type.variants || []
              : [];
    const variant = variants[0];
    if (!type || !variant) {
        showToast('Ten typ przejścia nie ma zapisanych średnic', 'error');
        return;
    }

    const item = well.przejscia[index];
    item.isCustom = true;
    item.productId = '';
    item.customTypeId = type.id;
    item.customName = type.name;
    item.dn = variant.dn;
    item.customPrice = variant.price;
    item.customWeight = variant.weight;
    delete item.frozenPrice;
    delete item.frozenPriceBase;
    delete item.frozenName;
    delete item.frozenTransitionPrice;
    delete item.frozenDrillingPrice;
    delete item.frozenDrillingName;
    delete item.frozenDrillingDn;

    closeModal();
    if (typeof refreshActiveWell === 'function') refreshActiveWell();
    else refreshAll();
    autoSelectComponents(true);
    window.refreshZleceniaModalIfActive();
    showToast('Zmieniono materiał przejścia', 'success');
};

/** Popup wyboru średnicy dla przejścia niestandardowego (typ z wariantami DN). */
function openCustomPrzejscieDnPopup(index, item) {
    const type =
        typeof findCustomPrzejsciaTypeByKey === 'function'
            ? findCustomPrzejsciaTypeByKey(customPrzejsciaTypeKey(item.customTypeId))
            : null;
    if (!type || !Array.isArray(type.variants) || type.variants.length === 0) {
        showToast('Ten typ przejścia nie ma zapisanych średnic', 'error');
        return;
    }
    const variants =
        typeof window.sortCustomPrzejsciaVariants === 'function'
            ? window.sortCustomPrzejsciaVariants(type.variants)
            : type.variants;
    const currDn = String(item.dn == null ? '' : item.dn);
    window.showModal({
        id: 'change-prz-dn-modal',
        titleId: 'change-prz-dn-title',
        html: `
        <div class="modal modal--prz">
            <div class="modal-header">
                <h3 id="change-prz-dn-title">Wybierz średnicę (DN): ${escapeHtml(type.name)}</h3>
                <button class="btn-icon" aria-label="Zamknij" data-csp="closeModal" data-csp-args="[]"><i data-lucide="x" aria-hidden="true"></i></button>
            </div>
            <div class="prz-grid">
                ${variants
                    .map((v) => {
                        const isActive = String(v.dn) === currDn;
                        return `<button data-action="confirmChangeCustomPrzejscieDn" data-index="${index}" data-dn="${escapeHtmlAttr(String(v.dn))}"
                             class="prz-grid-btn ${isActive ? 'prz-grid-btn--active' : ''}">
                             ${escapeHtml('DN ' + v.dn)}
                        </button>`;
                    })
                    .join('')}
            </div>
            <div class="modal-footer" style="justify-content:center;">
                <button class="btn btn-secondary" data-csp="closeModal" data-csp-args="[]">Anuluj</button>
            </div>
        </div>`
    });
    if (window.lucide && window.lucide.createIcons) window.lucide.createIcons();
}

window.openChangePrzejscieDnPopup = function (index) {
    if (isOfferLocked()) {
        showToast(OFFER_LOCKED_MSG, 'error');
        return;
    }
    if (isWellLocked()) {
        showToast(WELL_LOCKED_MSG, 'error');
        return;
    }
    const well = getCurrentWell();
    if (!well || !well.przejscia || !well.przejscia[index]) return;

    if (typeof isCustomPrzejscie === 'function' && isCustomPrzejscie(well.przejscia[index])) {
        openCustomPrzejscieDnPopup(index, well.przejscia[index]);
        return;
    }

    const currId = well.przejscia[index].productId;
    const currProduct =
        typeof getStudnieProductById === 'function'
            ? getStudnieProductById(currId)
            : studnieProducts.find((p) => p.id === currId);
    if (!currProduct) return;

    const maxPipeDn = typeof getMaxPipeDn === 'function' && well ? getMaxPipeDn(well.dn) : 9999;
    let baseAvail =
        typeof getPrzejsciaForCategory === 'function'
            ? getPrzejsciaForCategory(currProduct.category)
            : studnieProducts.filter((p) => p.category === currProduct.category && p.active !== 0);
    // indeks zawiera tylko active — dopisz current jeśli inactive
    if (currProduct.active === 0 && !baseAvail.some((p) => p.id === currId))
        baseAvail = [...baseAvail, currProduct];
    const available = baseAvail
        .filter((p) => {
            if (p.category === 'Otwór KPED') return true;
            let pDn = 160;
            if (typeof p.dn === 'string' && p.dn.includes('/')) {
                pDn = parseFloat(p.dn.split('/')[0]) || 160;
            } else {
                pDn = parseFloat(p.dn) || 160;
            }
            return pDn <= maxPipeDn || p.id === currId;
        })
        .sort((a, b) => a.dn - b.dn);

    window.showModal({
        id: 'change-prz-dn-modal',
        titleId: 'change-prz-dn-title',
        html: `
        <div class="modal modal--prz">
            <div class="modal-header">
                <h3 id="change-prz-dn-title">Wybierz średnicę (DN): ${escapeHtml(currProduct.category)}</h3>
                <button class="btn-icon" aria-label="Zamknij" data-csp="closeModal" data-csp-args="[]"><i data-lucide="x" aria-hidden="true"></i></button>
            </div>
            <div class="prz-grid">
                ${available
                    .map((p) => {
                        const isActive = p.id === currId;
                        const dnLabel =
                            typeof p.dn === 'string' && p.dn.includes('/') ? p.dn : 'DN ' + p.dn;
                        return `<button data-action="confirmChangePrzejscieDn" data-index="${index}" data-id="${escapeJsStr(p.id)}"
                             class="prz-grid-btn ${isActive ? 'prz-grid-btn--active' : ''}">
                             ${escapeHtml(dnLabel)}
                        </button>`;
                    })
                    .join('')}
            </div>
            <div class="modal-footer" style="justify-content:center;">
                <button class="btn btn-secondary" data-csp="closeModal" data-csp-args="[]">Anuluj</button>
            </div>
        </div>`
    });
    if (window.lucide && window.lucide.createIcons) window.lucide.createIcons();
};

window.confirmChangePrzejscieDn = function (index, newProductId) {
    const well = getCurrentWell();
    if (!well || !well.przejscia || !well.przejscia[index]) return;

    well.przejscia[index].productId = newProductId;
    delete well.przejscia[index].frozenPrice;
    delete well.przejscia[index].frozenPriceBase;
    delete well.przejscia[index].frozenName;
    delete well.przejscia[index].frozenTransitionPrice;
    delete well.przejscia[index].frozenDrillingPrice;
    delete well.przejscia[index].frozenDrillingName;
    delete well.przejscia[index].frozenDrillingDn;

    closeModal();
    if (typeof refreshActiveWell === 'function') refreshActiveWell();
    else refreshAll();
    autoSelectComponents(true);
    window.refreshZleceniaModalIfActive();
    showToast('Zmieniono średnicę przejścia', 'success');
};

window.confirmChangeCustomPrzejscieDn = function (index, dn) {
    const well = getCurrentWell();
    if (!well || !well.przejscia || !well.przejscia[index]) return;
    const item = well.przejscia[index];

    const type =
        typeof findCustomPrzejsciaTypeByKey === 'function'
            ? findCustomPrzejsciaTypeByKey(customPrzejsciaTypeKey(item.customTypeId))
            : null;
    const variant = type ? (type.variants || []).find((v) => String(v.dn) === String(dn)) : null;
    if (!variant) {
        showToast('Wybrany wariant przejścia już nie istnieje', 'error');
        return;
    }

    item.dn = variant.dn;
    item.customName = type.name;
    item.customPrice = variant.price;
    item.customWeight = variant.weight;
    delete item.frozenPrice;
    delete item.frozenPriceBase;
    delete item.frozenName;
    delete item.frozenTransitionPrice;
    delete item.frozenDrillingPrice;
    delete item.frozenDrillingName;
    delete item.frozenDrillingDn;

    closeModal();
    if (typeof refreshActiveWell === 'function') refreshActiveWell();
    else refreshAll();
    autoSelectComponents(true);
    window.refreshZleceniaModalIfActive();
    showToast('Zmieniono średnicę przejścia', 'success');
};
