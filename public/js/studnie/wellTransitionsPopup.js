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
    overlay.style.cssText = `
        position:fixed; inset:0; z-index:9999;
        background:rgba(0,0,0,0.6); backdrop-filter:blur(6px);
        display:flex; align-items:center; justify-content:center;
        animation: fadeInOverlay 0.2s ease;
    `;
    overlay.onclick = (e) => {
        if (e.target === overlay) closePrzejsciaVisibilityPopup(containerId);
    };

    const visibleCount = allTypes.filter((t) => visiblePrzejsciaTypes.has(t)).length;

    const tilesHtml = allTypes
        .map((t) => {
            const isVisible = visiblePrzejsciaTypes.has(t);
            return `
            <div class="przejscia-vis-tile ${isVisible ? 'visible' : 'hidden-type'}"
                 onclick="togglePrzejsciaTypeVisibility('${t.replace(/'/g, "\\\\'")}')"
                 title="${t}">
                <div class="przejscia-vis-tile-name">${t}</div>
            </div>`;
        })
        .join('');

    overlay.innerHTML = `
        <div class="przejscia-vis-popup">
            <div class="przejscia-vis-header">
                <div>
                    <h3 style="margin:0; font-size:0.85rem; font-weight:800; color:var(--text-primary);">Pokaż / Ukryj przejścia</h3>
                    <div class="przejscia-vis-counter" style="font-size:0.6rem; color:var(--text-muted); margin-top:0.1rem;">Kliknij kafelek aby przełączyć widoczność. Widoczne: <strong style="color:var(--success);">${visibleCount}</strong> / ${allTypes.length}</div>
                </div>
                <button onclick="closePrzejsciaVisibilityPopup('${containerId || ''}')" style="background:none; border:none; color:var(--text-muted); font-size:1.2rem; cursor:pointer; padding:0.2rem 0.4rem; border-radius:4px; transition:all 0.15s;" onmouseenter="this.style.color='#f87171'" onmouseleave="this.style.color='var(--text-muted)'"><i data-lucide="x"></i></button>
            </div>
            <div class="przejscia-vis-actions">
                <button class="przejscia-vis-action-btn" onclick="setPrzejsciaVisibilityAll(true)">Pokaż wszystkie</button>
                <button class="przejscia-vis-action-btn" onclick="setPrzejsciaVisibilityAll(false)">Ukryj wszystkie</button>
            </div>
            <div class="przejscia-vis-grid">
                ${tilesHtml}
            </div>
        </div>
    `;

    document.body.appendChild(overlay);

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
    if (overlay) overlay.remove();
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
        counterEl.innerHTML = `Kliknij kafelek aby przełączyć widoczność. Widoczne: <strong style="color:var(--success);">${visibleCount}</strong> / ${allTypes.length}`;

    const tiles = overlay.querySelectorAll('.przejscia-vis-tile');
    tiles.forEach((tile) => {
        const type = tile.getAttribute('title');
        const isVisible = visiblePrzejsciaTypes.has(type);
        tile.classList.toggle('visible', isVisible);
        tile.classList.toggle('hidden-type', !isVisible);
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

    let modal = document.getElementById('flow-type-modal');
    if (!modal) {
        modal = document.createElement('div');
        modal.id = 'flow-type-modal';
        modal.innerHTML = `
        <div style="position:fixed; top:0; left:0; width:100%; height:100%; background:rgba(0,0,0,0.6); backdrop-filter:blur(3px); z-index:9999; display:flex; align-items:center; justify-content:center;" onclick="document.getElementById('flow-type-modal').style.display='none'">
           <div style="background:#1e293b; padding:1.5rem; border-radius:12px; border:1px solid #334155; width:300px; text-align:center; box-shadow:0 10px 25px rgba(0,0,0,0.5);" onclick="event.stopPropagation()">
               <h3 style="margin-bottom:1rem; color:#fff; font-size:1.1rem; font-weight:700;">Wybierz typ przepływu</h3>
               <div style="display:flex; gap:1rem; justify-content:center;">
                  <button id="flow-wlot-btn" style="flex:1; background:rgba(59,130,246,0.2); color:#93c5fd; border:2px solid rgba(59,130,246,0.6); padding:1.2rem; border-radius:10px; cursor:pointer; font-weight:800; font-size:1.1rem; display:flex; flex-direction:column; align-items:center; gap:0.4rem; transition:all 0.2s;" onmouseenter="this.style.background='rgba(59,130,246,0.4)'" onmouseleave="this.style.background='rgba(59,130,246,0.2)'">
                     <span style="font-size:2.5rem;"><i data-lucide="download"></i></span>WLOT
                  </button>
                  <button id="flow-wylot-btn" style="flex:1; background:rgba(239,68,68,0.2); color:#fca5a5; border:2px solid rgba(239,68,68,0.6); padding:1.2rem; border-radius:10px; cursor:pointer; font-weight:800; font-size:1.1rem; display:flex; flex-direction:column; align-items:center; gap:0.4rem; transition:all 0.2s;" onmouseenter="this.style.background='rgba(239,68,68,0.4)'" onmouseleave="this.style.background='rgba(239,68,68,0.2)'">
                     <span style="font-size:2.5rem;"><i data-lucide="upload"></i></span>WYLOT
                  </button>
               </div>
               <button style="margin-top:1.5rem; padding:0.5rem 1rem; border-radius:6px; background:rgba(255,255,255,0.05); border:1px solid rgba(255,255,255,0.1); color:var(--text-muted); cursor:pointer;" onclick="document.getElementById('flow-type-modal').style.display='none'">Anuluj</button>
           </div>
        </div>
        `;
        document.body.appendChild(modal);
    }

    const showModal = (id, display) => {
        const el = document.getElementById(id);
        if (el) el.style.display = display;
    };
    showModal('flow-type-modal', 'flex');

    document.getElementById('flow-wlot-btn').onclick = () => {
        well.przejscia[index].flowType = FLOW_TYPES.WLOT;
        well.przejscia[index].flowTypeManual = true;
        showModal('flow-type-modal', 'none');
        renderWellPrzejscia();
        window.refreshZleceniaModalIfActive();
    };

    document.getElementById('flow-wylot-btn').onclick = () => {
        well.przejscia[index].flowType = FLOW_TYPES.WYLOT;
        well.przejscia[index].flowTypeManual = true;
        showModal('flow-type-modal', 'none');
        renderWellPrzejscia();
        window.refreshZleceniaModalIfActive();
    };
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

    let modal = document.getElementById('change-prz-type-modal');
    if (!modal) {
        modal = document.createElement('div');
        modal.id = 'change-prz-type-modal';
        document.body.appendChild(modal);
    }

    modal.innerHTML = `
    <div style="position:fixed; top:0; left:0; width:100%; height:100%; background:rgba(0,0,0,0.6); backdrop-filter:blur(3px); z-index:9999; display:flex; align-items:center; justify-content:center;" onclick="document.getElementById('change-prz-type-modal').style.display='none'">
       <div style="background:#1e293b; padding:1.5rem; border-radius:12px; border:1px solid #334155; width:1120px; max-width:95%; height:850px; max-height:95vh; display:flex; flex-direction:column; text-align:center; box-shadow:0 10px 25px rgba(0,0,0,0.5);" onclick="event.stopPropagation()">
           <h3 style="margin-bottom:1rem; color:#fff; font-size:1.1rem; font-weight:700;">Zmień rodzaj przejścia</h3>
           <div style="display:grid; grid-template-columns:repeat(auto-fill, 192px); justify-content:center; gap:11px; flex:1; overflow-y:auto; padding:0.2rem;">
              ${allTypes
                  .map((t) => {
                      const isActive = t === currProduct.category;
                      return `<button onclick="window.confirmChangePrzejscieType(${index}, '${t}')"
                           class="${isActive ? 'color-accent' : ''}"
                           style="width:192px; height:44px; display:flex; align-items:center; justify-content:center; padding:0.2rem 0.6rem; border-radius:8px; cursor:pointer; font-size:14px; font-weight:700; text-align:center; transition:all 0.15s;
                                  background:${isActive ? 'rgba(99,102,241,0.2)' : 'rgba(255,255,255,0.05)'};
                                  border:1px solid ${isActive ? 'rgba(99,102,241,0.5)' : 'rgba(255,255,255,0.1)'};"
                          onmouseenter="this.style.background='rgba(99,102,241,0.15)';this.style.borderColor='rgba(99,102,241,0.3)'"
                          onmouseleave="this.style.background='${isActive ? 'rgba(99,102,241,0.2)' : 'rgba(255,255,255,0.05)'}';this.style.borderColor='${isActive ? 'rgba(99,102,241,0.5)' : 'rgba(255,255,255,0.1)'}'">\
                       ${t}
                  </button>`;
                  })
                  .join('')}
           </div>
           <button style="margin-top:1.5rem; padding:0.5rem 1rem; border-radius:6px; background:rgba(255,255,255,0.05); border:1px solid rgba(255,255,255,0.1); color:var(--text-muted); cursor:pointer;" onclick="document.getElementById('change-prz-type-modal').style.display='none'">Anuluj</button>
       </div>
    </div>
    `;
    if (modal) modal.style.display = 'flex';
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

        const m = document.getElementById('change-prz-type-modal');
        if (m) m.style.display = 'none';
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

    let modal = document.getElementById('change-prz-dn-modal');
    if (!modal) {
        modal = document.createElement('div');
        modal.id = 'change-prz-dn-modal';
        document.body.appendChild(modal);
    }

    modal.innerHTML = `
    <div style="position:fixed; top:0; left:0; width:100%; height:100%; background:rgba(0,0,0,0.6); backdrop-filter:blur(3px); z-index:9999; display:flex; align-items:center; justify-content:center;" onclick="document.getElementById('change-prz-dn-modal').style.display='none'">
       <div style="background:#1e293b; padding:1.5rem; border-radius:12px; border:1px solid #334155; width:1120px; max-width:95%; height:850px; max-height:95vh; display:flex; flex-direction:column; text-align:center; box-shadow:0 10px 25px rgba(0,0,0,0.5);" onclick="event.stopPropagation()">
           <h3 style="margin-bottom:1rem; color:#fff; font-size:1.1rem; font-weight:700;">Wybierz średnicę (DN): ${currProduct.category}</h3>
           <div style="display:grid; grid-template-columns:repeat(auto-fill, 192px); justify-content:center; align-content:start; gap:11px; flex:1; overflow-y:auto; padding:0.2rem;">
              ${available
                  .map((p) => {
                      const isActive = p.id === currId;
                      const dnLabel =
                          typeof p.dn === 'string' && p.dn.includes('/') ? p.dn : 'DN ' + p.dn;
                      return `<button onclick="window.confirmChangePrzejscieDn(${index}, '${p.id}')"
                           class="${isActive ? 'color-accent' : ''}"
                           style="width:192px; height:44px; display:flex; align-items:center; justify-content:center; padding:0.2rem 0.6rem; border-radius:8px; cursor:pointer; font-size:14px; font-weight:700; text-align:center; transition:all 0.15s;
                                  background:${isActive ? 'rgba(99,102,241,0.2)' : 'rgba(255,255,255,0.05)'};
                                  border:1px solid ${isActive ? 'rgba(99,102,241,0.5)' : 'rgba(255,255,255,0.1)'};"
                          onmouseenter="this.style.background='rgba(99,102,241,0.15)';this.style.borderColor='rgba(99,102,241,0.3)'"
                          onmouseleave="this.style.background='${isActive ? 'rgba(99,102,241,0.2)' : 'rgba(255,255,255,0.05)'}';this.style.borderColor='${isActive ? 'rgba(99,102,241,0.5)' : 'rgba(255,255,255,0.1)'}'">\
                       ${dnLabel}
                  </button>`;
                  })
                  .join('')}
           </div>
           <button style="margin-top:1.5rem; padding:0.5rem 1rem; border-radius:6px; background:rgba(255,255,255,0.05); border:1px solid rgba(255,255,255,0.1); color:var(--text-muted); cursor:pointer;" onclick="document.getElementById('change-prz-dn-modal').style.display='none'">Anuluj</button>
       </div>
    </div>
    `;
    if (modal) modal.style.display = 'flex';
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

    const m = document.getElementById('change-prz-dn-modal');
    if (m) m.style.display = 'none';
    refreshAll();
    autoSelectComponents(true);
    window.refreshZleceniaModalIfActive();
    showToast('Zmieniono średnicę przejścia', 'success');
};
