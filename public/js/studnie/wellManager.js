/* ===== WELLS MANAGEMENT ===== */

/** Read the wizard step 2 global params from the UI tiles */
function getWizardGlobalParams() {
    const params = {
        nadbudowa: 'betonowa',
        dennicaMaterial: 'betonowa',
        wkladka: 'brak',
        klasaBetonu: 'C40/50',
        agresjaChemiczna: 'XA1',
        agresjaMrozowa: 'XF1',
        malowanieW: 'brak',
        malowanieZ: 'brak',
        powlokaNameW: '',
        powlokaNameZ: '',
        kineta: 'brak',
        redukcjaKinety: 'nie',
        stopnie: 'brak',
        spocznikH: '1/2',
        usytuowanie: 'w_osi',
        uszczelka: 'brak',
        magazyn: 'Kluczbork'
    };
    // Read confirmed selections from wizard param tiles
    document.querySelectorAll('#wizard-step-2 .param-group').forEach(group => {
        const paramName = group.getAttribute('data-param');
        if (!paramName) return;
        const activeBtn = group.querySelector('.param-tile.active');
        if (activeBtn) {
            params[paramName] = activeBtn.getAttribute('data-val');
        }
    });
    // Read text inputs
    const pwW = document.getElementById('powloka-name-w');
    if (pwW) params.powlokaNameW = pwW.value || '';
    const pwZ = document.getElementById('powloka-name-z');
    if (pwZ) params.powlokaNameZ = pwZ.value || '';
    const mccW = document.getElementById('malowanie-wew-cena');
    if (mccW) params.malowanieWewCena = parseFloat(mccW.value) || 0;
    const mccZ = document.getElementById('malowanie-zew-cena');
    if (mccZ) params.malowanieZewCena = parseFloat(mccZ.value) || 0;
    return params;
}

function createNewWell(name, dn = 1000) {
    wellCounter++;
    const gp = getWizardGlobalParams();
    return {
        id: 'well-' + Date.now() + '-' + wellCounter,
        name: name || ('Studnia DN' + dn + ' (#' + wellCounter + ')'),
        dn: dn,
        config: [],
        przejscia: [],
        doplata: 0,
        rzednaWlazu: null,
        rzednaDna: null,
        numer: '',
        autoLocked: false,
        zakonczenie: offerDefaultZakonczenie,
        redukcjaDN1000: offerDefaultRedukcja,
        redukcjaMinH: offerDefaultRedukcjaMinH,
        redukcjaZakonczenie: offerDefaultRedukcjaZak,
        nadbudowa: gp.nadbudowa || gp.material || 'betonowa',
        dennicaMaterial: gp.dennicaMaterial || gp.material || 'betonowa',
        wkladka: gp.wkladka,
        klasaBetonu: gp.klasaBetonu,
        agresjaChemiczna: gp.agresjaChemiczna,
        agresjaMrozowa: gp.agresjaMrozowa,
        malowanieW: gp.malowanieW,
        malowanieZ: gp.malowanieZ,
        powlokaNameW: gp.powlokaNameW,
        powlokaNameZ: gp.powlokaNameZ,
        malowanieWewCena: gp.malowanieWewCena,
        malowanieZewCena: gp.malowanieZewCena,
        kineta: gp.kineta,
        redukcjaKinety: gp.redukcjaKinety,
        stopnie: gp.stopnie,
        spocznikH: gp.spocznikH,
        usytuowanie: gp.usytuowanie,
        uszczelka: gp.uszczelka,
        magazyn: gp.magazyn
    };
}

/* ===== OFFER LOCK (after order is created) ===== */
const OFFER_LOCKED_MSG = '🔒 Oferta zablokowana — posiada zamówienie. Edytuj zamówienie zamiast oferty.';
const WELL_LOCKED_MSG = '🔒 Studnia zablokowana — posiada zaakceptowane zlecenie produkcyjne.';
function isOfferLocked() {
    if (orderEditMode) return false; // Order editing mode is always allowed
    if (!editingOfferIdStudnie) return false;
    const offer = offersStudnie.find(o => o.id === editingOfferIdStudnie);
    if (!offer) return false;
    return !!(offer.hasOrder || ordersStudnie.some(ord => ord.offerId === offer.id));
}

function isWellLocked(wellIdx) {
    const idx = wellIdx !== undefined ? wellIdx : currentWellIndex;
    const well = wells[idx];
    if (!well) return false;
    return productionOrders.some(po => po.wellId === well.id && po.status === 'accepted');
}

function renderOfferLockBanner() {
    // Remove order-mode banner if present (we're not in order mode)
    const orderBanner = document.getElementById('order-mode-banner');
    if (orderBanner) orderBanner.style.display = 'none';

    let lockBanner = document.getElementById('offer-lock-banner');
    if (!lockBanner) {
        const centerCol = document.querySelector('.well-center-column');
        if (!centerCol) return;
        lockBanner = document.createElement('div');
        lockBanner.id = 'offer-lock-banner';
        centerCol.insertBefore(lockBanner, centerCol.firstChild);
    }

    if (!isOfferLocked()) {
        lockBanner.style.display = 'none';
        return;
    }

    const order = ordersStudnie.find(o => o.offerId === editingOfferIdStudnie);
    const orderId = order ? order.id : '';

    lockBanner.style.cssText = `
        display:flex; align-items:center; justify-content:space-between; flex-wrap:wrap; gap:0.5rem;
        padding:0.7rem 1rem; margin-bottom:0.6rem; border-radius:10px;
        background: linear-gradient(135deg, rgba(239,68,68,0.12), rgba(245,158,11,0.08));
        border: 2px solid rgba(239,68,68,0.3);
    `;

    lockBanner.innerHTML = `
        <div style="display:flex; align-items:center; gap:0.5rem; flex-wrap:wrap;">
            <span style="font-size:1.3rem;">🔒</span>
            <div>
                <div style="font-size:0.82rem; font-weight:800; color:#f87171;">
                    OFERTA ZABLOKOWANA
                </div>
                <div style="font-size:0.65rem; color:var(--text-muted);">
                    Ta oferta posiada zamówienie — edycja jest zablokowana. Zmiany wprowadzaj na zamówieniu.
                </div>
            </div>
        </div>
        <div style="display:flex; gap:0.4rem; align-items:center;">
            ${orderId ? `<button class="btn btn-sm" onclick="window.location.href='/studnie?order=${orderId}'" style="background:rgba(16,185,129,0.2); border:1px solid rgba(16,185,129,0.4); color:#34d399; font-size:0.7rem; font-weight:700; padding:0.3rem 0.7rem;">
                📦 Edytuj zamówienie
            </button>` : ''}
        </div>
    `;
}

function addNewWell(dn = 1000) {
    if (isOfferLocked()) { showToast(OFFER_LOCKED_MSG, 'error'); return; }
    const defaultName = 'Studnia ' + wellCounter; // will use auto name if desired
    const well = createNewWell(null, dn);
    wells.push(well);
    currentWellIndex = wells.length - 1;
    // Auto switch builder tab
    const bcontentConcrete = document.getElementById('bcontent-concrete');
    if (bcontentConcrete && bcontentConcrete.style.display === 'none') {
        switchBuilderTab('concrete');
    }
    refreshAll();
    showToast(`Dodano: ${well.name}`, 'success');
}

function duplicateWell(index) {
    if (isOfferLocked()) { showToast(OFFER_LOCKED_MSG, 'error'); return; }
    const src = wells[index];
    if (!src) return;
    wellCounter++;
    const copy = JSON.parse(JSON.stringify(src));
    copy.id = 'well-' + Date.now() + '-' + wellCounter;
    copy.name = src.name + ' (kopia)';
    wells.splice(index + 1, 0, copy);
    currentWellIndex = index + 1;
    refreshAll();
    showToast(`Skopiowano: ${copy.name}`, 'success');
}

function removeWell(index) {
    if (isOfferLocked()) { showToast(OFFER_LOCKED_MSG, 'error'); return; }
    if (isWellLocked(index)) { showToast(WELL_LOCKED_MSG, 'error'); return; }
    if (!confirm(`Usunąć "${wells[index].name}"?`)) return;
    wells.splice(index, 1);
    if (currentWellIndex >= wells.length) currentWellIndex = Math.max(0, wells.length - 1);
    refreshAll();
    showToast('Studnia usunięta', 'info');
}

function selectWell(index) {
    if (index < 0 || index >= wells.length) return;
    currentWellIndex = index;
    refreshAll();
}

function renameWell(index) {
    if (isOfferLocked()) { showToast(OFFER_LOCKED_MSG, 'error'); return; }
    const well = wells[index];
    if (!well) return;
    const name = prompt('Nazwa studni:', well.name);
    if (name && name.trim()) {
        well.name = name.trim();
        renderWellsList();
        renderOfferSummary();
    }
}

function getCurrentWell() {
    if (wells.length === 0) return null;
    return wells[currentWellIndex] || wells[0];
}

function syncGaskets(well) {
    if (!well || !well.config) return;

    // Filter out existing uszczelki
    const newConfig = well.config.filter(item => {
        const p = studnieProducts.find(pr => pr.id === item.productId);
        return !(p && p.componentType === 'uszczelka');
    });

    if (well.uszczelka && well.uszczelka !== 'brak') {
        const uType = well.uszczelka;
        const requiredGaskets = {};

        // Find the bottom-most dennica index
        let bottomDennicaIndex = -1;
        for (let i = newConfig.length - 1; i >= 0; i--) {
            const p = studnieProducts.find(pr => pr.id === newConfig[i].productId);
            if (p && p.componentType === 'dennica') {
                bottomDennicaIndex = i;
                break;
            }
        }

        // Find elements requiring a gasket
        newConfig.forEach((item, index) => {
            const p = studnieProducts.find(pr => pr.id === item.productId);
            if (p && ['krag', 'krag_ot', 'plyta_din', 'plyta_redukcyjna', 'konus'].includes(p.componentType)) {
                if (p.dn) {
                    requiredGaskets[p.dn] = (requiredGaskets[p.dn] || 0) + item.quantity;
                }
            } else if (p && p.componentType === 'dennica') {
                if (p.dn) {
                    if (index === bottomDennicaIndex) {
                        // The structural bottom dennica only needs a gasket if quantity > 1
                        if (item.quantity > 1) {
                            requiredGaskets[p.dn] = (requiredGaskets[p.dn] || 0) + (item.quantity - 1);
                        }
                    } else {
                        // All other non-bottom dennice need gaskets for themselves
                        requiredGaskets[p.dn] = (requiredGaskets[p.dn] || 0) + item.quantity;
                    }
                }
            }
        });

        // Add corresponding gaskets
        for (const dn in requiredGaskets) {
            const qty = requiredGaskets[dn];
            let gasketName = `Uszczelka GSG DN${dn}`;
            if (uType === 'GSG') gasketName = `Uszczelka GSG DN${dn}`;
            else if (uType === 'SDV') gasketName = `Uszczelka SDV DN${dn}`;
            else if (uType === 'SDV PO') gasketName = `Uszczelka SDV DN${dn} SDV z pierścieniem odciążającym`;
            else if (uType === 'NBR') gasketName = `Uszczelka GSG DN${dn} z NBR`;

            const gasketProd = studnieProducts.find(p => p.componentType === 'uszczelka' && p.name === gasketName);
            if (gasketProd) {
                newConfig.push({
                    productId: gasketProd.id,
                    quantity: qty,
                    autoAdded: true
                });
            }
        }
    }

    well.config = newConfig;
}

function syncKineta(well) {
    if (!well || !well.config) return;

    // Filter out existing kineta
    const newConfig = well.config.filter(item => {
        const p = studnieProducts.find(pr => pr.id === item.productId);
        return !(p && p.componentType === 'kineta');
    });

    const hasDennica = well.config.some(item => {
        const p = studnieProducts.find(pr => pr.id === item.productId);
        return p && p.componentType === 'dennica';
    });

    if (hasDennica && well.spocznikH && well.spocznikH !== 'brak') {
        const kinetaProd = studnieProducts.find(p => p.componentType === 'kineta' && parseInt(p.dn) === parseInt(well.dn) && p.spocznikH === well.spocznikH);
        if (kinetaProd) {
            newConfig.push({
                productId: kinetaProd.id,
                quantity: 1,
                autoAdded: true
            });
        }
    }

    well.config = newConfig;
}

function refreshAll() {
    const well = getCurrentWell();
    if (well) {
        syncGaskets(well);
        syncKineta(well);
    }

    renderWellsList();
    renderTiles();
    renderWellConfig();
    renderWellPrzejscia();
    renderWellDiagram();
    updateSummary();
    updateDNButtons();
    syncElevationInputs();
    updateAutoLockUI();
    updateZakonczenieButton();
    updateRedukcjaButton();
    updateParamTilesUI();
    renderWellParams();
    renderOfferSummary();
    if (orderEditMode) renderOrderModeBanner();
}

/* ===== GENERAL PARAMS (TILES) ===== */
function setupParamTiles() {
    document.querySelectorAll('.param-group').forEach(group => {
        const paramName = group.getAttribute('data-param');
        group.querySelectorAll('.param-tile').forEach(btn => {
            btn.addEventListener('click', async () => {
                const val = btn.getAttribute('data-val');
                const well = getCurrentWell();

                // Always toggle visual active state (for wizard step 2 without wells)
                group.querySelectorAll('.param-tile').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');

                // If a well exists, apply param + re-render
                if (well) {
                    well[paramName] = val;
                    updateParamTilesUI();
                    well.autoLocked = false;
                    updateAutoLockUI();
                    await autoSelectComponents(false);
                    refreshAll();
                }

                // Wizard tracking (always)
                wizardConfirmedParams.add(paramName);
                validateWizardStep2();
            });
        });
    });
}

function updateParamTilesUI() {
    const well = getCurrentWell();
    if (well) {
        // Sync tiles to well object when well exists
        document.querySelectorAll('.param-group').forEach(group => {
            const paramName = group.getAttribute('data-param');
            const currentVal = well[paramName] || 'brak';
            group.querySelectorAll('.param-tile').forEach(btn => {
                if (btn.getAttribute('data-val') === currentVal) {
                    btn.classList.add('active');
                } else {
                    btn.classList.remove('active');
                }
            });
        });

        // Sync powłoka inputs from well
        const powlokaWInput = document.getElementById('powloka-name-w');
        if (powlokaWInput) powlokaWInput.value = well.powlokaNameW || '';
        const powlokaZInput = document.getElementById('powloka-name-z');
        if (powlokaZInput) powlokaZInput.value = well.powlokaNameZ || '';
    }
    // Note: when no well, tiles keep their visual state from click handlers

    // Show/hide powłoka name fields based on current tile state (works with or without well)
    const malowanieWVal = getActiveTileValue('malowanieW');
    const malowanieZVal = getActiveTileValue('malowanieZ');

    const powlokaWGroup = document.getElementById('powloka-name-w-group');
    if (powlokaWGroup) powlokaWGroup.style.display = malowanieWVal !== 'brak' ? 'block' : 'none';
    const powlokaZGroup = document.getElementById('powloka-name-z-group');
    if (powlokaZGroup) powlokaZGroup.style.display = malowanieZVal !== 'brak' ? 'block' : 'none';

    if (malowanieWVal === 'brak') {
        const pwWInput = document.getElementById('powloka-name-w');
        if (pwWInput) pwWInput.value = '';
        if (well) well.powlokaNameW = '';
    }
    if (malowanieZVal === 'brak') {
        const pwZInput = document.getElementById('powloka-name-z');
        if (pwZInput) pwZInput.value = '';
        if (well) well.powlokaNameZ = '';
    }
}

/* ===== PER-WELL PARAMS RENDERING ===== */
const WELL_PARAM_DEFS = [
    { key: 'nadbudowa', label: 'Nadbudowa', options: [['betonowa', 'Beton'], ['zelbetowa', 'Żelbet']] },
    { key: 'dennicaMaterial', label: 'Dennica', options: [['betonowa', 'Beton'], ['zelbetowa', 'Żelbet']] },
    { key: 'wkladka', label: 'Wkładka PEHD', options: [['brak', 'Brak'], ['3mm', '3mm'], ['4mm', '4mm']] },
    { key: 'klasaBetonu', label: 'Klasa betonu', options: [['C40/50', 'C40/50'], ['C40/50(HSR!!!!)', 'C40/50(HSR)'], ['C45/55', 'C45/55'], ['C45/55(HSR!!!!)', 'C45/55(HSR)'], ['C70/85', 'C70/85'], ['C70/80(HSR!!!!)', 'C70/80(HSR)']] },
    { key: 'agresjaChemiczna', label: 'Agresja chem.', options: [['XA1', 'XA1'], ['XA2', 'XA2'], ['XA3', 'XA3']] },
    { key: 'agresjaMrozowa', label: 'Agresja mroz.', options: [['XF1', 'XF1'], ['XF2', 'XF2'], ['XF3', 'XF3']] },
    { key: 'malowanieW', label: 'Malowanie wew.', options: [['brak', 'Brak'], ['kineta', 'Kineta'], ['kineta_dennica', 'Kineta+denn.'], ['cale', 'Całość']] },
    { key: 'malowanieZ', label: 'Malowanie zew.', options: [['brak', 'Brak'], ['zewnatrz', 'Zewnątrz']] },
    { key: 'kineta', label: 'Kineta', options: [['brak', 'Brak'], ['beton', 'Beton'], ['beton_gfk', 'Beton GFK'], ['klinkier', 'Klinkier'], ['preco', 'Preco'], ['precotop', 'PrecoTop'], ['unolith', 'UnoLith']] },
    { key: 'redukcjaKinety', label: 'Red. kinety', options: [['tak', 'Tak'], ['nie', 'Nie']] },
    { key: 'stopnie', label: 'Stopnie', options: [['brak', 'Brak'], ['drabinka', 'Drabinka'], ['nierdzewna', 'Nierdzewna']] },
    { key: 'spocznikH', label: 'Spocznik wys.', options: [['1/2', '1/2'], ['2/3', '2/3'], ['3/4', '3/4'], ['1/1', '1/1'], ['brak', 'Brak']] },
    { key: 'usytuowanie', label: 'Usytuowanie', options: [['linia_dolna', 'Linia dolna'], ['linia_gorna', 'Linia górna'], ['w_osi', 'W osi'], ['patrz_uwagi', 'Patrz uwagi']] },
    { key: 'uszczelka', label: 'Uszczelka', options: [['brak', 'Brak'], ['GSG', 'GSG'], ['SDV', 'SDV'], ['SDV PO', 'SDV PO'], ['NBR', 'NBR']] },
    { key: 'magazyn', label: 'Magazyn', options: [['Kluczbork', 'Kluczbork'], ['Włocławek', 'Włocławek']] }
];

function renderWellParams() {
    const container = document.getElementById('well-params-container');
    if (!container) return;
    const well = getCurrentWell();
    if (!well) {
        container.innerHTML = '<div style="text-align:center; padding:1rem; color:var(--text-muted); font-size:0.75rem;">Dodaj studnię aby edytować parametry</div>';
        return;
    }

    let html = `<div style="display:flex; flex-direction:column; gap:0.35rem;">`;

    WELL_PARAM_DEFS.forEach(def => {
        const currentVal = well[def.key] || '';

        html += `<div style="display:flex; align-items:center; gap:0.4rem; min-height:28px;">`;
        html += `<span style="font-size:0.62rem; color:var(--text-muted); font-weight:700; white-space:nowrap; min-width:85px; text-align:right;">${def.label}</span>`;
        html += `<div style="display:flex; gap:0.2rem; flex-wrap:wrap;">`;
        def.options.forEach(([val, lbl]) => {
            const isActive = val === currentVal;
            html += `<button onclick="updateWellParam('${def.key}','${val}')" style="
                padding:0.18rem 0.5rem; border-radius:5px; cursor:pointer; font-size:0.62rem; font-weight:${isActive ? '700' : '600'};
                border:1px solid ${isActive ? 'rgba(99,102,241,0.5)' : 'rgba(255,255,255,0.06)'};
                background:${isActive ? 'rgba(99,102,241,0.2)' : 'rgba(255,255,255,0.03)'};
                color:${isActive ? '#a78bfa' : 'var(--text-secondary)'};
                transition:all 0.15s ease;
                ${isActive ? 'box-shadow:0 0 6px rgba(99,102,241,0.15);' : ''}
            " onmouseenter="if(!${isActive}){this.style.borderColor='rgba(99,102,241,0.25)';this.style.background='rgba(255,255,255,0.06)'}"
               onmouseleave="if(!${isActive}){this.style.borderColor='rgba(255,255,255,0.06)';this.style.background='rgba(255,255,255,0.03)'}"
            >${lbl}</button>`;
        });
        html += `</div></div>`;
    });

    if (well.malowanieW && well.malowanieW !== 'brak') {
        html += `<div style="display:flex; align-items:center; gap:0.4rem; min-height:28px; margin-top:0.2rem;">`;
        html += `<span style="font-size:0.62rem; color:var(--text-muted); font-weight:700; white-space:nowrap; min-width:85px; text-align:right;">Nazwa p. wew.</span>`;
        html += `<input type="text" value="${well.powlokaNameW || ''}" onchange="updateWellParam('powlokaNameW', this.value)" placeholder="Nazwa powłoki..." style="flex:1; max-width:200px; background:rgba(0,0,0,0.2); border:1px solid rgba(255,255,255,0.1); color:var(--text-primary); padding:0.2rem 0.5rem; font-size:0.65rem; border-radius:4px;">`;
        html += `</div>`;
        html += `<div style="display:flex; align-items:center; gap:0.4rem; min-height:28px; margin-top:0.2rem;">`;
        html += `<span style="font-size:0.62rem; color:var(--text-muted); font-weight:700; white-space:nowrap; min-width:85px; text-align:right;">Koszt p. wew.</span>`;
        html += `<input type="number" step="0.01" value="${well.malowanieWewCena || ''}" onchange="updateWellParam('malowanieWewCena', parseFloat(this.value)||0)" placeholder="PLN / m²" style="width:80px; background:rgba(0,0,0,0.2); border:1px solid rgba(255,255,255,0.1); color:var(--text-primary); padding:0.2rem 0.5rem; font-size:0.65rem; border-radius:4px;">`;
        html += `</div>`;
    }

    if (well.malowanieZ && well.malowanieZ !== 'brak') {
        html += `<div style="display:flex; align-items:center; gap:0.4rem; min-height:28px; margin-top:0.2rem;">`;
        html += `<span style="font-size:0.62rem; color:var(--text-muted); font-weight:700; white-space:nowrap; min-width:85px; text-align:right;">Nazwa p. zew.</span>`;
        html += `<input type="text" value="${well.powlokaNameZ || ''}" onchange="updateWellParam('powlokaNameZ', this.value)" placeholder="Nazwa powłoki..." style="flex:1; max-width:200px; background:rgba(0,0,0,0.2); border:1px solid rgba(255,255,255,0.1); color:var(--text-primary); padding:0.2rem 0.5rem; font-size:0.65rem; border-radius:4px;">`;
        html += `</div>`;
        html += `<div style="display:flex; align-items:center; gap:0.4rem; min-height:28px; margin-top:0.2rem;">`;
        html += `<span style="font-size:0.62rem; color:var(--text-muted); font-weight:700; white-space:nowrap; min-width:85px; text-align:right;">Koszt p. zew.</span>`;
        html += `<input type="number" step="0.01" value="${well.malowanieZewCena || ''}" onchange="updateWellParam('malowanieZewCena', parseFloat(this.value)||0)" placeholder="PLN / m²" style="width:80px; background:rgba(0,0,0,0.2); border:1px solid rgba(255,255,255,0.1); color:var(--text-primary); padding:0.2rem 0.5rem; font-size:0.65rem; border-radius:4px;">`;
        html += `</div>`;
    }

    html += `</div>`;
    html += `<div style="display:flex; gap:0.4rem; margin-top:0.5rem; justify-content:flex-end;">`;
    html += `<button class="btn btn-secondary btn-sm" onclick="resetWellParamsToDefaults()" style="font-size:0.65rem; padding:0.2rem 0.5rem;">🔄 Reset do domyślnych (Krok 2)</button>`;
    html += `</div>`;

    container.innerHTML = html;
}

async function updateWellParam(paramKey, value) {
    if (isOfferLocked()) { showToast(OFFER_LOCKED_MSG, 'error'); return; }
    if (isWellLocked()) { showToast(WELL_LOCKED_MSG, 'error'); return; }
    const well = getCurrentWell();
    if (!well) return;
    well[paramKey] = value;
    renderWellParams();
    updateParamTilesUI();
    well.autoLocked = false;
    updateAutoLockUI();
    await autoSelectComponents(false);
    refreshAll();
}

function resetWellParamsToDefaults() {
    const well = getCurrentWell();
    if (!well) return;
    const gp = getWizardGlobalParams();
    WELL_PARAM_DEFS.forEach(def => {
        if (gp[def.key] !== undefined) well[def.key] = gp[def.key];
    });
    // Also reset powłoka names
    well.powlokaNameW = gp.powlokaNameW || '';
    well.powlokaNameZ = gp.powlokaNameZ || '';
    renderWellParams();
    updateParamTilesUI();
    showToast('Parametry studni zresetowane do domyślnych z Kroku 2', 'success');
}

window.updateWellParam = updateWellParam;
window.resetWellParamsToDefaults = resetWellParamsToDefaults;

async function updateParamInput(paramName, value) {
    const well = getCurrentWell();
    if (!well) return;
    well[paramName] = value;
    well.autoLocked = false;
    updateAutoLockUI();
    await autoSelectComponents(false);
    refreshAll();
}

/* ===== AUTO-LOCK (MANUAL MODE) ===== */
function toggleAutoLock() {
    const well = getCurrentWell();
    if (!well) { showToast('Najpierw dodaj studnię', 'error'); return; }
    well.autoLocked = !well.autoLocked;
    updateAutoLockUI();
}

function updateAutoLockUI() {
    const well = getCurrentWell();
    const btnLock = document.getElementById('btn-lock-auto');
    const btnAuto = document.getElementById('btn-auto-select');
    if (!btnLock || !btnAuto) return;
    if (!well) {
        btnLock.innerHTML = '🔓 Ręczny';
        btnLock.style.backgroundColor = 'var(--bg-glass)';
        btnLock.style.borderColor = 'var(--border-glass)';
        btnAuto.disabled = true;
        btnAuto.style.opacity = '0.4';
        return;
    }

    if (well.autoLocked) {
        btnLock.innerHTML = '🔒 Tryb ręczny (Włączony)';
        btnLock.style.backgroundColor = 'rgba(239, 68, 68, 0.2)'; // amber/red
        btnLock.style.borderColor = 'rgba(239, 68, 68, 0.5)';
        btnAuto.disabled = true;
        btnAuto.style.opacity = '0.4';
        btnAuto.style.cursor = 'not-allowed';
    } else {
        btnLock.innerHTML = '🔓 Tryb ręczny (Wyłączony)';
        btnLock.style.backgroundColor = 'var(--bg-glass)';
        btnLock.style.borderColor = 'var(--border-glass)';
        btnAuto.disabled = false;
        btnAuto.style.opacity = '1';
        btnAuto.style.cursor = 'pointer';
    }
}



/* ===== DISCOUNT PANEL ===== */
function updateDiscount(dn, type, value) {
    if (isOfferLocked()) { showToast(OFFER_LOCKED_MSG, 'error'); return; }
    if (!wellDiscounts[dn]) wellDiscounts[dn] = { dennica: 0, nadbudowa: 0 };
    wellDiscounts[dn][type] = parseFloat(value) || 0;
    renderDiscountPanel();
    updateSummary();
    renderOfferSummary();
    renderWellConfig();
}

function getDiscountedTotal() {
    let grandTotal = 0;
    wells.forEach(w => {
        const s = calcWellStats(w);
        grandTotal += s.price;
    });
    return grandTotal;
}

function renderDiscountPanel() {
    const panel = document.getElementById('wells-discount-panel');
    if (!panel) return;

    const dktCap = [1000, 1200, 1500, 2000, 2500];
    const activeDNs = dktCap.filter(dn => wells.some(w => w.dn === dn));

    if (activeDNs.length === 0) {
        panel.innerHTML = '';
        return;
    }

    let grandDennica = 0, grandNadbudowa = 0, grandTotal = 0, grandDiscounted = 0;

    let html = `<div style="padding:0.4rem; border-bottom:1px solid rgba(255,255,255,0.08);">
        <div style="font-size:0.65rem; text-transform:uppercase; color:var(--text-muted); font-weight:700; letter-spacing:0.5px; margin-bottom:0.3rem;">💰 Rabaty i podsumowanie</div>`;

    activeDNs.forEach(dn => {
        const groupWells = wells.filter(w => w.dn === dn);
        let dennicaBaseSum = 0, nadbudowaBaseSum = 0;
        let dennicaAfterSum = 0, nadbudowaAfterSum = 0;
        groupWells.forEach(w => {
            const s = calcWellStats(w);
            dennicaBaseSum += s.priceDennicaBase;
            nadbudowaBaseSum += s.priceNadbudowaBase;
            dennicaAfterSum += s.priceDennica;
            nadbudowaAfterSum += s.priceNadbudowa;
        });
        const totalDN = dennicaBaseSum + nadbudowaBaseSum;

        const disc = wellDiscounts[dn] || { dennica: 0, nadbudowa: 0 };
        const totalAfter = dennicaAfterSum + nadbudowaAfterSum;

        grandDennica += dennicaBaseSum;
        grandNadbudowa += nadbudowaBaseSum;
        grandTotal += totalDN;
        grandDiscounted += totalAfter;

        html += `<div style="background:rgba(255,255,255,0.03); border-radius:6px; padding:0.35rem 0.4rem; margin-bottom:0.25rem;">
          <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:0.2rem;">
            <span style="font-size:0.7rem; font-weight:700; color:#a78bfa;">DN${dn}</span>
            <span style="font-size:0.65rem; color:var(--text-muted);">${groupWells.length} szt.</span>
          </div>
          <div style="display:grid; grid-template-columns:1fr auto auto; gap:0.15rem 0.3rem; font-size:0.62rem; align-items:center;">
            <span class="ui-text-mute">Dennica</span>
            <span style="color:var(--text-secondary); text-align:right;">${fmtInt(dennicaBaseSum)}</span>
            <div style="display:flex; align-items:center; gap:0.15rem;">
              <input type="number" min="0" max="100" step="0.5" value="${disc.dennica || 0}"
                style="width:38px; padding:1px 3px; font-size:0.6rem; text-align:center; background:rgba(255,255,255,0.08); border:1px solid rgba(255,255,255,0.15); border-radius:3px; color:#fff;"
                onchange="updateDiscount(${dn},'dennica',this.value)" oninput="updateDiscount(${dn},'dennica',this.value)">
              <span class="ui-text-mute">%</span>
            </div>
            <span class="ui-text-mute">Nadbudowa</span>
            <span style="color:var(--text-secondary); text-align:right;">${fmtInt(nadbudowaBaseSum)}</span>
            <div style="display:flex; align-items:center; gap:0.15rem;">
              <input type="number" min="0" max="100" step="0.5" value="${disc.nadbudowa || 0}"
                style="width:38px; padding:1px 3px; font-size:0.6rem; text-align:center; background:rgba(255,255,255,0.08); border:1px solid rgba(255,255,255,0.15); border-radius:3px; color:#fff;"
                onchange="updateDiscount(${dn},'nadbudowa',this.value)" oninput="updateDiscount(${dn},'nadbudowa',this.value)">
              <span class="ui-text-mute">%</span>
            </div>
          </div>
          <div style="display:flex; justify-content:space-between; margin-top:0.2rem; padding-top:0.15rem; border-top:1px solid rgba(255,255,255,0.06);">
            <span style="font-size:0.6rem; color:var(--text-muted);">Po rabacie:</span>
            <span style="font-size:0.65rem; font-weight:700; color:${totalAfter < totalDN ? '#34d399' : 'var(--text-secondary)'};">${fmtInt(totalAfter)} PLN</span>
          </div>
        </div>`;
    });

    // Grand total
    const hasDiscount = grandDiscounted < grandTotal;
    html += `<div style="display:flex; justify-content:space-between; align-items:center; padding:0.3rem 0.2rem 0.1rem; border-top:1px solid rgba(255,255,255,0.1); margin-top:0.2rem;">
      <span style="font-size:0.7rem; font-weight:700; color:var(--text-primary);">Suma</span>
      <div style="text-align:right;">
        ${hasDiscount ? `<div style="font-size:0.55rem; color:var(--text-muted); text-decoration:line-through;">${fmtInt(grandTotal)} PLN</div>` : ''}
        <div style="font-size:0.75rem; font-weight:700; color:#6366f1;">${fmtInt(grandDiscounted)} PLN</div>
      </div>
    </div>`;

    html += `</div>`;
    panel.innerHTML = html;
}

/* ===== WELL STATS ===== */

function getItemAssessedPrice(well, p, applyDiscount = true) {
    let itemPrice = p.price || 0;

    let discountPct = 0;
    if (applyDiscount && well.dn) {
        const disc = wellDiscounts[well.dn] || { dennica: 0, nadbudowa: 0 };
        if (p.componentType === 'dennica' || p.componentType === 'kineta') {
            discountPct = disc.dennica || 0;
        } else {
            discountPct = disc.nadbudowa || 0;
        }
    }
    const mult = 1 - (discountPct / 100);

    if (p.componentType === 'kineta') {
        let dennicaHeight = 0;
        const dennicaItem = well.config.find(c => {
            const pr = studnieProducts.find(x => x.id === c.productId);
            return pr && pr.componentType === 'dennica';
        });
        if (dennicaItem) {
            dennicaHeight = studnieProducts.find(x => x.id === dennicaItem.productId)?.height || 0;
        }

        const h1m = parseFloat(p.hMin1); const h1x = parseFloat(p.hMax1);
        const h2m = parseFloat(p.hMin2); const h2x = parseFloat(p.hMax2);
        const h3m = parseFloat(p.hMin3); const h3x = parseFloat(p.hMax3);

        let kinetaBase = itemPrice;
        if (!isNaN(h1m) && !isNaN(h1x) && dennicaHeight >= h1m && dennicaHeight <= h1x) {
            kinetaBase = parseFloat(p.cena1) || 0;
        } else if (!isNaN(h2m) && !isNaN(h2x) && dennicaHeight >= h2m && dennicaHeight <= h2x) {
            kinetaBase = parseFloat(p.cena2) || 0;
        } else if (!isNaN(h3m) && !isNaN(h3x) && dennicaHeight >= h3m && dennicaHeight <= h3x) {
            kinetaBase = parseFloat(p.cena3) || 0;
        }

        itemPrice = kinetaBase * mult;

        // Add malowanie to kineta before early return
        if (well.malowanieW && well.malowanieW !== 'brak' && well.malowanieWewCena) {
            if (well.malowanieW === 'kineta' || well.malowanieW === 'cale') {
                itemPrice += (p.area || 0) * well.malowanieWewCena;
            }
        }
        if (well.malowanieZ === 'zewnatrz' && well.malowanieZewCena) {
            itemPrice += (p.areaExt || 0) * well.malowanieZewCena;
        } else if (well.malowanieZ === 'zewnatrz' && p.malowanieZewnetrzne && !well.malowanieZewCena) {
            itemPrice += parseFloat(p.malowanieZewnetrzne);
        }

        return itemPrice;
    }

    itemPrice = itemPrice * mult;

    // Wkładka PEHD
    if (well.wkladka && well.wkladka !== 'brak' && p.doplataPEHD) {
        itemPrice += parseFloat(p.doplataPEHD);
    }

    // Malowanie wewnątrz (z ceny za m2)
    if (well.malowanieW && well.malowanieW !== 'brak' && well.malowanieWewCena) {
        if (well.malowanieW === 'kineta_dennica' && p.componentType === 'dennica') {
            itemPrice += (p.area || 0) * well.malowanieWewCena;
        } else if (well.malowanieW === 'cale') {
            itemPrice += (p.area || 0) * well.malowanieWewCena;
        }
    } else if (well.malowanieW && well.malowanieW !== 'brak' && p.malowanieWewnetrzne) {
        if (well.malowanieW === 'cale' || p.componentType === 'dennica') {
            itemPrice += parseFloat(p.malowanieWewnetrzne);
        }
    }

    // Malowanie zewnątrz (z ceny za m2 i stara opcja)
    if (well.malowanieZ === 'zewnatrz' && well.malowanieZewCena) {
        itemPrice += (p.areaExt || 0) * well.malowanieZewCena;
    } else if (well.malowanieZ === 'zewnatrz' && p.malowanieZewnetrzne && !well.malowanieZewCena) {
        itemPrice += parseFloat(p.malowanieZewnetrzne);
    }

    // Żelbet (dopłata dla dennicy)
    if ((well.dennicaMaterial === 'zelbetowa' || well.material === 'zelbetowa') && p.componentType === 'dennica' && p.doplataZelbet) {
        itemPrice += parseFloat(p.doplataZelbet);
    }

    // Drabinka nierdzewna
    if (well.stopnie === 'nierdzewna' && p.doplataDrabNierdzewna) {
        itemPrice += parseFloat(p.doplataDrabNierdzewna);
    }

    return itemPrice;
}

function calcWellStats(well) {
    let price = 0, weight = 0, height = 0, areaInt = 0, areaExt = 0;
    let priceDennica = 0, priceNadbudowa = 0;

    // Base prices (undiscounted)
    let priceBase = 0, priceDennicaBase = 0, priceNadbudowaBase = 0;

    let dennicaCount = 0;

    well.config.forEach(item => {
        const p = studnieProducts.find(pr => pr.id === item.productId);
        if (!p) return;

        let itemPriceDisc = getItemAssessedPrice(well, p, true);
        let itemPriceBaseVal = getItemAssessedPrice(well, p, false);

        const lineTotalDisc = itemPriceDisc * item.quantity;
        const lineTotalBase = itemPriceBaseVal * item.quantity;

        price += lineTotalDisc;
        priceBase += lineTotalBase;

        // Split into dennica vs nadbudowa
        if (p.componentType === 'dennica' || p.componentType === 'kineta') {
            priceDennica += lineTotalDisc;
            priceDennicaBase += lineTotalBase;
        } else {
            priceNadbudowa += lineTotalDisc;
            priceNadbudowaBase += lineTotalBase;
        }

        weight += (p.weight || 0) * item.quantity;
        areaInt += (p.area || 0) * item.quantity;
        areaExt += (p.areaExt || 0) * item.quantity;

        if (p.componentType === 'dennica') {
            for (let q = 0; q < item.quantity; q++) {
                dennicaCount++;
                height += (p.height || 0) - (dennicaCount > 1 ? 100 : 0);
            }
        } else {
            height += (p.height || 0) * item.quantity;
        }
    });

    if (well.przejscia) {
        let discNadbudowa = 0;
        if (well.dn && wellDiscounts[well.dn]) {
            discNadbudowa = wellDiscounts[well.dn].nadbudowa || 0;
        }
        const mult = 1 - (discNadbudowa / 100);

        well.przejscia.forEach(item => {
            const p = studnieProducts.find(pr => pr.id === item.productId);
            if (!p) return;
            const bP = p.price || 0;
            const dP = bP * mult;

            priceBase += bP;
            priceNadbudowaBase += bP;

            price += dP;
            priceNadbudowa += dP;

            weight += (p.weight || 0);
        });
    }

    let malowanieZewTotal = 0;
    if (well.malowanieZ === 'zewnatrz' && well.malowanieZewCena) {
        malowanieZewTotal = areaExt * well.malowanieZewCena;
    }

    if (well.doplata) {
        price += well.doplata;
        priceBase += well.doplata;
        priceDennica += well.doplata;
        priceDennicaBase += well.doplata;
    }

    return {
        price, priceBase,
        priceDennica, priceDennicaBase,
        priceNadbudowa, priceNadbudowaBase,
        weight, height, areaInt, areaExt, malowanieZewTotal
    };
}

