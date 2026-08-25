// @ts-check
/* ===== Popupy dla przejść ===== */

function openPrzejsciaVisibilityPopup(containerId) {
    const przejsciaProducts = studnieProducts.filter(
        (p) => p.componentType === 'przejscie' && p.active !== 0
    );
    const allTypes = [...new Set(przejsciaProducts.map((p) => p.category))].sort();

    let overlay = document.getElementById('przejscia-visibility-overlay');
    if (overlay) overlay.remove();

    overlay = document.createElement('div');
    overlay.id = 'przejscia-visibility-overlay';
    overlay.setAttribute('role', 'dialog');
    overlay.setAttribute('aria-modal', 'true');
    overlay.setAttribute('aria-label', 'Widoczność typów przejść');
    // ponytail: 1100 (EXCEL) < 2000 (zlecenia-overlay) -> popup niewidoczny w Zleceniu Produkcyjnym. Uzycie PRZEJSCIA_VIS_POPUP (2100) > GENERIC_MODAL
    const popupZ = (typeof LAYERS !== 'undefined' && LAYERS.PRZEJSCIA_VIS_POPUP) || 2100;
    overlay.style.cssText =
        'position:fixed; inset:0; z-index:' +
        popupZ +
        ';background:rgba(var(--black-rgb), 0.8); backdrop-filter:blur(6px); display:flex; align-items:center; justify-content:center; animation:fadeInOverlay 0.2s ease;';
    overlay.onclick = (e) => {
        if (e.target === overlay) closePrzejsciaVisibilityPopup(containerId);
    };

    const visibleCount = allTypes.filter((t) => visiblePrzejsciaTypes.has(t)).length;

    const tilesHtml = allTypes
        .map((t) => {
            const isVisible = visiblePrzejsciaTypes.has(t);
            return `
            <div class="przejscia-vis-tile ${isVisible ? 'visible' : 'hidden-type'}"
                 data-action="togglePrzejsciaTypeVisibility" data-t="${escapeJsStr(t)}"
                 title="${escapeHtmlAttr(t)}">
                <div class="przejscia-vis-tile-name">${escapeHtml(t)}</div>
            </div>`;
        })
        .join('');

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
    }
    if (containerId === 'excel') {
        if (typeof _excelRenderTable === 'function') _excelRenderTable(_excelActiveTab);
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
    const przejsciaProducts = studnieProducts.filter(
        (p) => p.componentType === 'przejscie' && p.active !== 0
    );
    const allTypes = [...new Set(przejsciaProducts.map((p) => p.category))];
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

    const przejsciaProducts = studnieProducts.filter(
        (p) => p.componentType === 'przejscie' && p.active !== 0
    );
    const allTypes = [...new Set(przejsciaProducts.map((p) => p.category))].sort();
    const visibleCount = allTypes.filter((t) => visiblePrzejsciaTypes.has(t)).length;

    const counterEl = overlay.querySelector('.przejscia-vis-counter');
    if (counterEl)
        counterEl.innerHTML = `Kliknij kafelek aby przełączyć widoczność. Widoczne: <strong class="color-success">${visibleCount}</strong> / ${allTypes.length}`;

    const tiles = overlay.querySelectorAll('.przejscia-vis-tile');
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
        } else if (action === 'setPrzejsciaVisibilityAll') {
            window.setPrzejsciaVisibilityAll(val === '1');
        } else if (action === 'confirmChangePrzejscieType') {
            window.confirmChangePrzejscieType(parseInt(index, 10), t);
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
                <button class="btn-icon" aria-label="Zamknij" onclick="closeModal()"><i data-lucide="x" aria-hidden="true"></i></button>
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
                <button class="btn btn-secondary" onclick="closeModal()">Anuluj</button>
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
    renderWellPrzejscia();
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

    const currTypeId = well.przejscia[index].productId;
    const currProduct = studnieProducts.find((p) => p.id === currTypeId);
    if (!currProduct) return;

    const przejsciaProducts = studnieProducts.filter(
        (p) => p.componentType === 'przejscie' && p.active !== 0
    );
    const allTypes = [...new Set(przejsciaProducts.map((p) => p.category))].sort();

    window.showModal({
        id: 'change-prz-type-modal',
        titleId: 'change-prz-type-title',
        html: `
        <div class="modal modal--prz">
            <div class="modal-header">
                <h3 id="change-prz-type-title">Zmień rodzaj przejścia</h3>
                <button class="btn-icon" aria-label="Zamknij" onclick="closeModal()"><i data-lucide="x" aria-hidden="true"></i></button>
            </div>
            <div class="prz-grid">
                ${allTypes
                    .map((t) => {
                        const isActive = t === currProduct.category;
                        return `<button data-action="confirmChangePrzejscieType" data-index="${index}" data-t="${escapeJsStr(t)}"
                             class="prz-grid-btn ${isActive ? 'prz-grid-btn--active' : ''}">
                             ${escapeHtml(t)}
                        </button>`;
                    })
                    .join('')}
            </div>
            <div class="modal-footer" style="justify-content:center;">
                <button class="btn btn-secondary" onclick="closeModal()">Anuluj</button>
            </div>
        </div>`
    });
    if (window.lucide && window.lucide.createIcons) window.lucide.createIcons();
};

window.confirmChangePrzejscieType = function (index, newType) {
    const well = getCurrentWell();
    if (!well || !well.przejscia || !well.przejscia[index]) return;

    const available = studnieProducts
        .filter((p) => p.category === newType)
        .sort((a, b) => a.dn - b.dn);
    if (available.length > 0) {
        well.przejscia[index].productId = available[0].id;
        delete well.przejscia[index].frozenPrice;
        delete well.przejscia[index].frozenPriceBase;
        delete well.przejscia[index].frozenName;
        delete well.przejscia[index].frozenTransitionPrice;
        delete well.przejscia[index].frozenDrillingPrice;
        delete well.przejscia[index].frozenDrillingName;
        delete well.przejscia[index].frozenDrillingDn;

        closeModal();
        refreshAll();
        autoSelectComponents(true);
        window.refreshZleceniaModalIfActive();
        showToast('Zmieniono materiał przejścia', 'success');
    }
};

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

    const currId = well.przejscia[index].productId;
    const currProduct = studnieProducts.find((p) => p.id === currId);
    if (!currProduct) return;

    const available = studnieProducts
        .filter((p) => p.category === currProduct.category)
        .sort((a, b) => a.dn - b.dn);

    window.showModal({
        id: 'change-prz-dn-modal',
        titleId: 'change-prz-dn-title',
        html: `
        <div class="modal modal--prz">
            <div class="modal-header">
                <h3 id="change-prz-dn-title">Wybierz średnicę (DN): ${escapeHtml(currProduct.category)}</h3>
                <button class="btn-icon" aria-label="Zamknij" onclick="closeModal()"><i data-lucide="x" aria-hidden="true"></i></button>
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
                <button class="btn btn-secondary" onclick="closeModal()">Anuluj</button>
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
    refreshAll();
    autoSelectComponents(true);
    window.refreshZleceniaModalIfActive();
    showToast('Zmieniono średnicę przejścia', 'success');
};
