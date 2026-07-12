// @ts-check
/* ===== PRZEJŚCIA — Edycja inline ===== */

const inlinePrzejsciaState = { type: null, dnId: null };

function renderInlinePrzejsciaApp(containerId) {
    const well = getCurrentWell();
    const przejsciaProducts = studnieProducts.filter(
        (p) => p.componentType === 'przejscie' && p.active !== 0
    );
    const allTypes = [...new Set(przejsciaProducts.map((p) => p.category))].sort();
    // Filtruj tylko do widocznych typów
    const types = allTypes.filter((t) => visiblePrzejsciaTypes.has(t));

    const container = document.getElementById(containerId || 'inline-przejscia-app');
    if (!container) return;

    // Zresetuj typ, jeśli został ukryty
    if (inlinePrzejsciaState.type && !types.includes(inlinePrzejsciaState.type)) {
        inlinePrzejsciaState.type = types[0] || null;
        inlinePrzejsciaState.dnId = null;
    }
    if (!inlinePrzejsciaState.type) {
        inlinePrzejsciaState.type = types[0] || null;
    }

    const hiddenCount = allTypes.length - types.length;
    const visibilityBtnLabel =
        hiddenCount > 0
            ? `<i data-lucide="eye"></i>️ Pokaż/Ukryj (${hiddenCount} ukrytych)`
            : '<i data-lucide="eye"></i>️ Pokaż/Ukryj';

    // Jeśli żadne typy nie są widoczne, pokaż stan pusty
    if (types.length === 0) {
        container.innerHTML = `
            <div style="text-align:center; padding:1.5rem; border:1px dashed rgba(99,102,241,0.2); border-radius:10px; background:rgba(15,23,42,0.3); margin:0.4rem 0;">
                <div style="font-size:1.5rem; margin-bottom:0.5rem;"><i data-lucide="ban"></i></div>
                <div style="font-size:0.75rem; font-weight:700; color:var(--text-primary); margin-bottom:0.3rem;">Wszystkie przejścia są ukryte</div>
                <div style="font-size:0.65rem; color:var(--text-muted); margin-bottom:0.8rem;">Włącz widoczność wybranych typów przejść, aby móc je dodawać.</div>
                <button class="btn btn-primary btn-sm" data-action="openPrzejsciaVisibilityPopup" data-container-id="${containerId || ''}" style="padding:0.35rem 0.8rem; font-size:0.7rem;">
                    <i data-lucide="eye"></i>️ Pokaż przejścia (${allTypes.length} dostępnych)
                </button>
            </div>
        `;
        return;
    }

    const maxPipeDn = well ? getMaxPipeDn(well.dn) : 9999;
    const dnList = inlinePrzejsciaState.type
        ? przejsciaProducts
              .filter((p) => p.category === inlinePrzejsciaState.type)
              .filter((p) => {
                  if (p.category === 'Otwór KPED') return true;
                  let pDn = 160;
                  if (typeof p.dn === 'string' && p.dn.includes('/')) {
                      pDn = parseFloat(p.dn.split('/')[0]) || 160;
                  } else {
                      pDn = parseFloat(p.dn) || 160;
                  }
                  return pDn <= maxPipeDn;
              })
              .sort((a, b) => a.dn - b.dn)
        : [];
    const selectedProduct = inlinePrzejsciaState.dnId
        ? studnieProducts.find((p) => p.id === inlinePrzejsciaState.dnId)
        : null;

    container.innerHTML = `
        <!-- Rodzaj kafelków - przewijalna siatka -->
        <div style="padding:0.4rem 0;">
            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:0.3rem;">
                <div style="font-size:0.58rem; color:var(--text-muted); text-transform:uppercase; letter-spacing:0.5px; font-weight:700;">Rodzaj materiału</div>
                <button data-action="openPrzejsciaVisibilityPopup" class="przejscia-vis-btn" data-container-id="${containerId || ''}" style="background:rgba(99,102,241,0.1); border:1px solid rgba(99,102,241,0.25); color:#a5b4fc; font-size:0.58rem; font-weight:600; padding:0.15rem 0.5rem; border-radius:5px; cursor:pointer; transition:all 0.15s;">${visibilityBtnLabel}</button>
            </div>
            <div id="przejscia-type-scroll" style="max-height:140px; overflow-y:auto; padding-right:0.2rem; scrollbar-width:thin; scrollbar-color:rgba(99,102,241,0.4) transparent;">
                <div style="display:grid; grid-template-columns:repeat(auto-fill, minmax(120px, 1fr)); gap:11px;">
                    ${types
                        .map((t) => {
                            const isActive = t === inlinePrzejsciaState.type;
                            return `
                        <div data-action="inlineSetType" data-type="${t}" data-container-id="${containerId || ''}"
                             style="padding:0.2rem 0.4rem; border-radius:6px; cursor:pointer; transition:all 0.15s ease; height:44px; display:flex; align-items:center; justify-content:center;
                                    background:${isActive ? 'rgba(99,102,241,0.2)' : 'rgba(255,255,255,0.03)'};
                                    border:1px solid ${isActive ? 'rgba(99,102,241,0.5)' : 'rgba(255,255,255,0.06)'};
                                    ${isActive ? 'box-shadow:0 0 8px rgba(99,102,241,0.15);' : ''}"
                             title="${t}">
                             <div class="${isActive ? 'color-accent' : ''}" style="font-size:${t.length > 20 ? '9px' : t.length > 14 ? '11px' : '14px'}; font-weight:700; text-align:center; line-height:1.1; word-break:break-word;">${t}</div>
                        </div>`;
                        })
                        .join('')}
                </div>
            </div>
        </div>

        <!-- Wybór DN -->
        <div style="padding:0.3rem 0;">
            <div style="font-size:0.58rem; color:var(--text-muted); text-transform:uppercase; margin-bottom:0.3rem; letter-spacing:0.5px; font-weight:700;">Średnica (DN) — ${inlinePrzejsciaState.type || ''}</div>
            <div style="display:grid; grid-template-columns:repeat(auto-fill, minmax(120px, 1fr)); gap:11px;">
                ${dnList
                    .map((p) => {
                        const isActive = p.id === inlinePrzejsciaState.dnId;
                        const dnLabel =
                            typeof p.dn === 'string' && p.dn.includes('/') ? p.dn : 'DN ' + p.dn;
                        return `
                    <div class="fs-dn-tile ${isActive ? 'active' : ''}" data-action="inlineSetDN" data-dn-id="${p.id}" data-container-id="${containerId || ''}"
                         style="padding:0.2rem 0.4rem; text-align:center; cursor:pointer; border-radius:6px; height:44px; display:flex; align-items:center; justify-content:center; transition:all 0.15s ease;
                                background:${isActive ? 'rgba(99,102,241,0.2)' : 'rgba(255,255,255,0.03)'};
                                border:1px solid ${isActive ? 'rgba(99,102,241,0.5)' : 'rgba(255,255,255,0.06)'};
                                ${isActive ? 'box-shadow:0 0 10px rgba(99,102,241,0.3);' : ''}">
                         <div class="${isActive ? 'color-accent' : ''}" style="font-size:${dnLabel.length > 18 ? '9px' : dnLabel.length > 13 ? '11px' : '15px'}; font-weight:800; text-align:center; letter-spacing:0.5px;">${dnLabel}</div>
                    </div>
                `;
                    })
                    .join('')}
            </div>
        </div>

        ${
            selectedProduct
                ? `
        <div style="background:linear-gradient(90deg, rgba(30,58,138,0.3) 0%, rgba(30,41,59,0.8) 100%); border:1px solid rgba(255,255,255,0.05); border-left:5px solid rgba(59,130,246,0.6); padding:0.6rem; border-radius:10px; margin-top:0.3rem; position:relative; box-shadow:0 4px 12px rgba(0,0,0,0.15); box-sizing:border-box;">
            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:0.4rem;">
                <span style="font-size:1.0rem; font-weight:800; color:#fff;"><i data-lucide="link"></i> ${selectedProduct.category} ${typeof selectedProduct.dn === 'string' && selectedProduct.dn.includes('/') ? selectedProduct.dn : 'DN' + selectedProduct.dn}</span>
                <span style="font-size:0.95rem; color:var(--success); font-weight:800; font-family:'Inter'">${fmtInt(selectedProduct.price)} <span style="font-size:0.6rem;">PLN</span></span>
            </div>
            <div style="display:grid; grid-template-columns:repeat(7, 1fr); gap:0.4rem; align-items:end;">
                <div class="ui-center-min">
                    <div class="ui-text-muted-sm">Rzędna [m]</div>
                    <input type="text" inputmode="decimal" class="form-input" id="inl-rzedna-${containerId || 'main'}" step="0.001" 
                           value="${well && well.rzednaDna !== null && well.rzednaDna !== undefined ? parseFloat(well.rzednaDna).toFixed(3) : ''}" 
                           placeholder="—" style="height:26px; padding:0 0.3rem; font-size:0.9rem; font-weight:700; text-align:center; color:var(--text-primary); background:rgba(255,255,255,0.03); border:1px solid rgba(255,255,255,0.08); border-radius:4px;">
                </div>
                <div class="ui-center-min">
                    <div class="ui-text-muted-sm">Kąt [°]</div>
                     <input type="number" class="form-input color-link" id="inl-angle-${containerId || 'main'}" value="0" min="0" max="360" data-action="inlineUpdateAngles" data-container-id="${containerId || 'main'}" style="height:26px; padding:0 0.3rem; font-size:0.9rem; font-weight:800; text-align:center; background:rgba(255,255,255,0.03); border:1px solid rgba(255,255,255,0.08); border-radius:4px;">
                </div>
                <div class="ui-center-min">
                    <div class="ui-text-muted-sm">Spadek w kinecie [%]</div>
                    <input type="number" class="form-input" id="inl-spadek-kineta-${containerId || 'main'}" step="1" placeholder="—" style="height:26px; padding:0 0.3rem; font-size:0.9rem; font-weight:700; text-align:center; color:var(--text-primary); background:rgba(255,255,255,0.03); border:1px solid rgba(255,255,255,0.08); border-radius:4px;">
                </div>
                <div class="ui-center-min">
                    <div class="ui-text-muted-sm">Spadek w mufie [%]</div>
                    <input type="number" class="form-input" id="inl-spadek-mufa-${containerId || 'main'}" step="1" placeholder="—" style="height:26px; padding:0 0.3rem; font-size:0.9rem; font-weight:700; text-align:center; color:var(--text-primary); background:rgba(255,255,255,0.03); border:1px solid rgba(255,255,255,0.08); border-radius:4px;">
                </div>

                <div class="text-center">
                    <div class="ui-text-muted-sm">Kąt wyk.</div>
                    <div class="color-info" style="font-size:1.0rem; font-weight:700; padding:0.15rem 0;" id="inl-exec-${containerId || 'main'}">360°</div>
                </div>
                <div class="text-center">
                    <div class="ui-text-muted-sm">Gony</div>
                    <div class="color-success" style="font-size:1.0rem; font-weight:700; padding:0.15rem 0;" id="inl-gony-${containerId || 'main'}">0.00<sup>g</sup></div>
                </div>
                <div style="display:flex; align-items:flex-end; justify-content:flex-end;">
                    <button class="btn btn-primary" data-action="inlineFinish" data-context-id="${containerId || 'main'}" data-container-id="${containerId || ''}" style="height:26px; width:100%; justify-content:center; font-size:0.7rem; padding:0;"><i data-lucide="plus"></i> Dodaj</button>
                </div>
            </div>
        </div>
        `
                : `
        <div style="text-align:center; padding:0.8rem; color:var(--text-muted); border:1px dashed rgba(255,255,255,0.06); border-radius:8px; font-size:0.7rem; margin-top:0.3rem;">
            Wybierz średnicę (DN) aby skonfigurować przejście
        </div>
        `
        }
    `;

    if (inlinePrzejsciaState.dnId) {
        window.inlineUpdateAngles(containerId || 'main');
        setTimeout(() => {
            const angleInput = document.getElementById(`inl-angle-${containerId || 'main'}`);
            if (angleInput) angleInput.focus();
        }, 10);
    }
}

window.inlineSetType = (t, containerId = '') => {
    inlinePrzejsciaState.type = t;
    inlinePrzejsciaState.dnId = null;
    renderInlinePrzejsciaApp(containerId);
};

window.inlineSetDN = (id, containerId = '') => {
    inlinePrzejsciaState.dnId = id;
    renderInlinePrzejsciaApp(containerId);
};

window.inlineUpdateAngles = (contextId = 'main') => {
    const el = document.getElementById(`inl-angle-${contextId}`);
    if (!el) return;
    const angle = parseFloat(el.value) || 0;
    const exec = angle === 0 || angle === 360 ? 0 : 360 - angle;
    const gons = ((angle * 400) / 360).toFixed(2);

    const execEl = document.getElementById(`inl-exec-${contextId}`);
    const gonyEl = document.getElementById(`inl-gony-${contextId}`);
    if (execEl) execEl.textContent = exec + '°';
    if (gonyEl) gonyEl.innerHTML = gons + '<sup>g</sup>';
};

window.inlineFinish = (contextId = 'main', containerId = '') => {
    if (isOfferLocked()) {
        showToast(OFFER_LOCKED_MSG, 'error');
        return;
    }
    if (isWellLocked()) {
        showToast(WELL_LOCKED_MSG, 'error');
        return;
    }
    const id = inlinePrzejsciaState.dnId;
    if (!id) return;

    const rzednaEl = document.getElementById(`inl-rzedna-${contextId}`);
    const angleEl = document.getElementById(`inl-angle-${contextId}`);

    const spadekKinetaEl = document.getElementById(`inl-spadek-kineta-${contextId}`);
    const spadekMufaEl = document.getElementById(`inl-spadek-mufa-${contextId}`);

    const rzedna = rzednaEl ? rzednaEl.value : '';
    const angle = angleEl ? parseFloat(angleEl.value) || 0 : 0;

    const spadekKineta = spadekKinetaEl ? spadekKinetaEl.value.trim() : '';
    const spadekMufa = spadekMufaEl ? spadekMufaEl.value.trim() : '';

    const exec = angle === 0 || angle === 360 ? 0 : 360 - angle;
    const gons = ((angle * 400) / 360).toFixed(2);

    const well = getCurrentWell();
    if (!well) {
        showToast('Najpierw dodaj studnię', 'error');
        return;
    }
    if (!well.przejscia) well.przejscia = [];

    const isFirst = well.przejscia ? well.przejscia.length === 0 : true;
    const flowType = isFirst && angle === 0 ? FLOW_TYPES.WYLOT : FLOW_TYPES.WLOT;

    well.przejscia.push({
        id: 'prz-' + Date.now() + '-' + Math.floor(Math.random() * 1000),
        productId: id,
        rzednaWlaczenia:
            rzedna !== null && rzedna !== undefined && rzedna !== ''
                ? parseCalcExpression(rzedna) !== null
                    ? parseCalcExpression(rzedna).toFixed(3)
                    : null
                : null,
        angle: angle,
        angleExecution: exec,
        angleGony: gons,

        flowType: flowType,
        spadekKineta: spadekKineta ? Math.round(parseFloat(spadekKineta)) : null,
        spadekMufa: spadekMufa ? Math.round(parseFloat(spadekMufa)) : null
    });

    refreshAll();
    autoSelectComponents(true);
    showToast('Dodano przejście szczelne', 'success');
    renderInlinePrzejsciaApp(containerId);
    window.refreshZleceniaModalIfActive();
};
