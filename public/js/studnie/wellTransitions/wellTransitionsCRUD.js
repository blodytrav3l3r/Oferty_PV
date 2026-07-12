// @ts-check
/* ===== PRZEJŚCIA — CRUD i stan ===== */

function getMaxPipeDn(wellDn) {
    if (!wellDn || wellDn === 'styczna') return 9999;
    const dn = parseInt(wellDn);
    if (dn === 1000) return 600;
    if (dn === 1200) return 800;
    if (dn === 1500) return 1000;
    if (dn === 2000) return 1600;
    if (dn === 2500) return 2200;
    return 9999;
}
let editPrzejscieIdx = -1;
let editPrzejscieState = {
    type: null,
    dnId: null,
    rzedna: '',
    angle: 0,
    spadekKineta: '',
    spadekMufa: ''
};

window.editInlineSetType = function (type) {
    syncEditState();
    editPrzejscieState.type = type;
    const przejsciaProducts = studnieProducts.filter(
        (pr) => pr.componentType === 'przejscie' && pr.active !== 0
    );
    const dns = [...przejsciaProducts.filter((p) => p.category === type)].sort(
        (a, b) => a.dn - b.dn
    );
    if (dns.length > 0) editPrzejscieState.dnId = dns[0].id;
    else editPrzejscieState.dnId = null;
    renderWellPrzejscia();
};

window.editInlineSetDN = function (dnId) {
    syncEditState();
    editPrzejscieState.dnId = dnId;
    renderWellPrzejscia();
};

function movePrzejscie(index, direction) {
    if (isOfferLocked()) {
        showToast(OFFER_LOCKED_MSG, 'error');
        return;
    }
    if (isWellLocked()) {
        showToast(WELL_LOCKED_MSG, 'error');
        return;
    }
    const well = getCurrentWell();
    if (!well || !well.przejscia) return;
    const newIndex = index + direction;
    if (newIndex < 0 || newIndex >= well.przejscia.length) return;
    const temp = well.przejscia[index];
    well.przejscia[index] = well.przejscia[newIndex];
    well.przejscia[newIndex] = temp;
    renderWellPrzejscia();
    updateSummary();
    window.refreshZleceniaModalIfActive();
}

function removePrzejscieFromWell(index) {
    if (isOfferLocked()) {
        showToast(OFFER_LOCKED_MSG, 'error');
        return;
    }
    if (isWellLocked()) {
        showToast(WELL_LOCKED_MSG, 'error');
        return;
    }
    const well = getCurrentWell();
    if (!well) return;
    if (well.przejscia) {
        well.przejscia.splice(index, 1);
        refreshAll();
        autoSelectComponents(true);
        window.refreshZleceniaModalIfActive();
    }
}

function editPrzejscie(index) {
    const well = getCurrentWell();
    if (!well || !well.przejscia || !well.przejscia[index]) return;
    const item = well.przejscia[index];
    const p = studnieProducts.find((pr) => pr.id === item.productId);

    editPrzejscieIdx = index;
    editPrzejscieState = {
        type: p ? p.category : null,
        dnId: item.productId,
        rzedna: item.rzednaWlaczenia,
        angle: item.angle,

        spadekKineta: item.spadekKineta || '',
        spadekMufa: item.spadekMufa || ''
    };
    renderWellPrzejscia();
}

function savePrzejscieEdit(index) {
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

    syncEditState();

    if (!editPrzejscieState.dnId) {
        showToast('Wybierz typ i średnicę przejścia', 'error');
        return;
    }

    const newProductId = editPrzejscieState.dnId;
    const rzedna = editPrzejscieState.rzedna;
    const angle = editPrzejscieState.angle || 0;

    const spadekKineta = editPrzejscieState.spadekKineta;
    const spadekMufa = editPrzejscieState.spadekMufa;

    const exec = angle === 0 || angle === 360 ? 0 : 360 - angle;
    const gons = ((angle * 400) / 360).toFixed(2);

    well.przejscia[index] = {
        productId: newProductId,
        rzednaWlaczenia:
            rzedna !== null && rzedna !== undefined && rzedna !== ''
                ? parseCalcExpression(rzedna) !== null
                    ? parseCalcExpression(rzedna).toFixed(3)
                    : null
                : null,
        angle: angle,
        angleExecution: exec,
        angleGony: gons,

        spadekKineta: spadekKineta ? Math.round(parseFloat(spadekKineta)) : null,
        spadekMufa: spadekMufa ? Math.round(parseFloat(spadekMufa)) : null
    };

    editPrzejscieIdx = -1;
    refreshAll();
    autoSelectComponents(true);
    showToast('Zapisano zmiany przejścia', 'success');
    renderWellPrzejscia();
    window.refreshZleceniaModalIfActive();
}

function cancelPrzejscieEdit() {
    editPrzejscieIdx = -1;
    renderWellPrzejscia();
    window.refreshZleceniaModalIfActive();
}

function syncEditState() {
    if (editPrzejscieIdx < 0) return;
    const rzednaEl = document.getElementById('edit-rzedna-' + editPrzejscieIdx);
    const angleEl = document.getElementById('edit-angle-' + editPrzejscieIdx);
    if (rzednaEl) editPrzejscieState.rzedna = rzednaEl.value;
    if (angleEl) editPrzejscieState.angle = parseFloat(angleEl.value) || 0;
    const spKEl = document.getElementById('edit-spadek-kineta-' + editPrzejscieIdx);
    const spMEl = document.getElementById('edit-spadek-mufa-' + editPrzejscieIdx);
    if (spKEl) editPrzejscieState.spadekKineta = spKEl.value;
    if (spMEl) editPrzejscieState.spadekMufa = spMEl.value;
}

function editUpdateAngles(index) {
    const el = document.getElementById('edit-angle-' + index);
    if (!el) return;
    const angle = parseFloat(el.value) || 0;
    const exec = angle === 0 || angle === 360 ? 0 : 360 - angle;
    const gons = ((angle * 400) / 360).toFixed(2);
    const execEl = document.getElementById('edit-exec-' + index);
    const gonyEl = document.getElementById('edit-gony-' + index);
    if (execEl) execEl.textContent = exec + '°';
    if (gonyEl) gonyEl.innerHTML = gons + '<sup>g</sup>';
}

function editChangePrzejscieType(index) {
    const typeSelect = document.getElementById('edit-type-' + index);
    const dnSelect = document.getElementById('edit-dn-' + index);
    if (!typeSelect || !dnSelect) return;
    const newType = typeSelect.value;
    const przejsciaProducts = studnieProducts.filter(
        (pr) => pr.componentType === 'przejscie' && pr.active !== 0 && pr.category === newType
    );
    dnSelect.innerHTML = przejsciaProducts
        .map((pr) => {
            const dnLbl = typeof pr.dn === 'string' && pr.dn.includes('/') ? pr.dn : 'DN' + pr.dn;
            return `<option value="${pr.id}">${dnLbl} — ${fmtInt(pr.price)} PLN</option>`;
        })
        .join('');
}

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
        <div id="flow-type-modal-backdrop" style="position:fixed; top:0; left:0; width:100%; height:100%; background:rgba(0,0,0,0.6); backdrop-filter:blur(3px); z-index:9999; display:flex; align-items:center; justify-content:center;" data-action="closeModal" data-modal-id="flow-type-modal">
           <div data-action="ignoreClick" style="background:#1e293b; padding:1.5rem; border-radius:12px; border:1px solid #334155; width:300px; text-align:center; box-shadow:0 10px 25px rgba(0,0,0,0.5);">
               <h3 style="margin-bottom:1rem; color:#fff; font-size:1.1rem; font-weight:700;">Wybierz typ przepływu</h3>
               <div style="display:flex; gap:1rem; justify-content:center;">
                   <button id="flow-wlot-btn" style="flex:1; background:rgba(59,130,246,0.2); color:#93c5fd; border:2px solid rgba(59,130,246,0.6); padding:1.2rem; border-radius:10px; cursor:pointer; font-weight:800; font-size:1.1rem; display:flex; flex-direction:column; align-items:center; gap:0.4rem; transition:all 0.2s;">
                      <span style="font-size:2.5rem;"><i data-lucide="download"></i></span>WLOT
                   </button>
                   <button id="flow-wylot-btn" style="flex:1; background:rgba(239,68,68,0.2); color:#fca5a5; border:2px solid rgba(239,68,68,0.6); padding:1.2rem; border-radius:10px; cursor:pointer; font-weight:800; font-size:1.1rem; display:flex; flex-direction:column; align-items:center; gap:0.4rem; transition:all 0.2s;">
                      <span style="font-size:2.5rem;"><i data-lucide="upload"></i></span>WYLOT
                   </button>
               </div>
               <button data-action="closeModal" data-modal-id="flow-type-modal" style="margin-top:1.5rem; padding:0.5rem 1rem; border-radius:6px; background:rgba(255,255,255,0.05); border:1px solid rgba(255,255,255,0.1); color:var(--text-muted); cursor:pointer;">Anuluj</button>
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
    <div style="position:fixed; top:0; left:0; width:100%; height:100%; background:rgba(0,0,0,0.6); backdrop-filter:blur(3px); z-index:9999; display:flex; align-items:center; justify-content:center;" data-action="closeModal" data-modal-id="change-prz-type-modal">
       <div data-action="ignoreClick" style="background:#1e293b; padding:1.5rem; border-radius:12px; border:1px solid #334155; width:1120px; max-width:95%; height:850px; max-height:95vh; display:flex; flex-direction:column; text-align:center; box-shadow:0 10px 25px rgba(0,0,0,0.5);">
            <h3 style="margin-bottom:1rem; color:#fff; font-size:1.1rem; font-weight:700;">Zmień rodzaj przejścia</h3>
            <div style="display:grid; grid-template-columns:repeat(auto-fill, 192px); justify-content:center; gap:11px; flex:1; overflow-y:auto; padding:0.2rem;">
               ${allTypes
                   .map((t) => {
                       const isActive = t === currProduct.category;
                       return `<button data-action="confirmChangePrzejscieType" data-index="${index}" data-type="${t}" 
                            class="${isActive ? 'color-accent' : ''}"
                            style="width:192px; height:44px; display:flex; align-items:center; justify-content:center; padding:0.2rem 0.6rem; border-radius:8px; cursor:pointer; font-size:14px; font-weight:700; text-align:center; transition:all 0.15s;
                                   background:${isActive ? 'rgba(99,102,241,0.2)' : 'rgba(255,255,255,0.05)'};
                                   border:1px solid ${isActive ? 'rgba(99,102,241,0.5)' : 'rgba(255,255,255,0.1)'};">\
                        ${t}
                    </button>`;
                   })
                   .join('')}
            </div>
            <button data-action="closeModal" data-modal-id="change-prz-type-modal" style="margin-top:1.5rem; padding:0.5rem 1rem; border-radius:6px; background:rgba(255,255,255,0.05); border:1px solid rgba(255,255,255,0.1); color:var(--text-muted); cursor:pointer;">Anuluj</button>
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
    <div style="position:fixed; top:0; left:0; width:100%; height:100%; background:rgba(0,0,0,0.6); backdrop-filter:blur(3px); z-index:9999; display:flex; align-items:center; justify-content:center;" data-action="closeModal" data-modal-id="change-prz-dn-modal">
       <div data-action="ignoreClick" style="background:#1e293b; padding:1.5rem; border-radius:12px; border:1px solid #334155; width:1120px; max-width:95%; height:850px; max-height:95vh; display:flex; flex-direction:column; text-align:center; box-shadow:0 10px 25px rgba(0,0,0,0.5);">
            <h3 style="margin-bottom:1rem; color:#fff; font-size:1.1rem; font-weight:700;">Wybierz średnicę (DN): ${currProduct.category}</h3>
            <div style="display:grid; grid-template-columns:repeat(auto-fill, 192px); justify-content:center; align-content:start; gap:11px; flex:1; overflow-y:auto; padding:0.2rem;">
               ${available
                   .map((p) => {
                       const isActive = p.id === currId;
                       const dnLabel =
                           typeof p.dn === 'string' && p.dn.includes('/') ? p.dn : 'DN ' + p.dn;
                       return `<button data-action="confirmChangePrzejscieDn" data-index="${index}" data-product-id="${p.id}" 
                            class="${isActive ? 'color-accent' : ''}"
                            style="width:192px; height:44px; display:flex; align-items:center; justify-content:center; padding:0.2rem 0.6rem; border-radius:8px; cursor:pointer; font-size:14px; font-weight:700; text-align:center; transition:all 0.15s;
                                   background:${isActive ? 'rgba(99,102,241,0.2)' : 'rgba(255,255,255,0.05)'};
                                   border:1px solid ${isActive ? 'rgba(99,102,241,0.5)' : 'rgba(255,255,255,0.1)'};">\
                        ${dnLabel}
                    </button>`;
                   })
                   .join('')}
            </div>
            <button data-action="closeModal" data-modal-id="change-prz-dn-modal" style="margin-top:1.5rem; padding:0.5rem 1rem; border-radius:6px; background:rgba(255,255,255,0.05); border:1px solid rgba(255,255,255,0.1); color:var(--text-muted); cursor:pointer;">Anuluj</button>
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

window.editPrzejscie = editPrzejscie;
window.savePrzejscieEdit = savePrzejscieEdit;
window.cancelPrzejscieEdit = cancelPrzejscieEdit;
window.editUpdateAngles = editUpdateAngles;
window.editChangePrzejscieType = editChangePrzejscieType;
