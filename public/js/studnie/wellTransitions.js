// @ts-check
/* ===== Główny moduł przejść ===== */

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
                <button class="btn btn-primary btn-sm" onclick="openPrzejsciaVisibilityPopup('${containerId || ''}')" style="padding:0.35rem 0.8rem; font-size:0.7rem;">
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
                <button onclick="openPrzejsciaVisibilityPopup('${containerId || ''}')" style="background:rgba(99,102,241,0.1); border:1px solid rgba(99,102,241,0.25); color:#a5b4fc; font-size:0.58rem; font-weight:600; padding:0.15rem 0.5rem; border-radius:5px; cursor:pointer; transition:all 0.15s;" onmouseenter="this.style.background='rgba(99,102,241,0.2)';this.style.borderColor='rgba(99,102,241,0.4)'" onmouseleave="this.style.background='rgba(99,102,241,0.1)';this.style.borderColor='rgba(99,102,241,0.25)'">${visibilityBtnLabel}</button>
            </div>
            <div id="przejscia-type-scroll" style="max-height:140px; overflow-y:auto; padding-right:0.2rem; scrollbar-width:thin; scrollbar-color:rgba(99,102,241,0.4) transparent;">
                <div style="display:grid; grid-template-columns:repeat(auto-fill, minmax(120px, 1fr)); gap:11px;">
                    ${types
                        .map((t) => {
                            const isActive = t === inlinePrzejsciaState.type;
                            return `
                        <div onclick="window.inlineSetType('${t}', '${containerId || ''}')" 
                             style="padding:0.2rem 0.4rem; border-radius:6px; cursor:pointer; transition:all 0.15s ease; height:44px; display:flex; align-items:center; justify-content:center;
                                    background:${isActive ? 'rgba(99,102,241,0.2)' : 'rgba(255,255,255,0.03)'};
                                    border:1px solid ${isActive ? 'rgba(99,102,241,0.5)' : 'rgba(255,255,255,0.06)'};
                                    ${isActive ? 'box-shadow:0 0 8px rgba(99,102,241,0.15);' : ''}"
                             onmouseenter="if(!${isActive})this.style.background='rgba(99,102,241,0.1)';this.style.borderColor='rgba(99,102,241,0.3)'"
                             onmouseleave="if(!${isActive})this.style.background='rgba(255,255,255,0.03)';this.style.borderColor='rgba(255,255,255,0.06)'"
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
                    <div class="fs-dn-tile ${isActive ? 'active' : ''}" 
                         style="padding:0.2rem 0.4rem; text-align:center; cursor:pointer; border-radius:6px; height:44px; display:flex; align-items:center; justify-content:center; transition:all 0.15s ease;
                                background:${isActive ? 'rgba(99,102,241,0.2)' : 'rgba(255,255,255,0.03)'};
                                border:1px solid ${isActive ? 'rgba(99,102,241,0.5)' : 'rgba(255,255,255,0.06)'};
                                ${isActive ? 'box-shadow:0 0 10px rgba(99,102,241,0.3);' : ''}"
                         onmouseenter="if(!${isActive}){this.style.background='rgba(99,102,241,0.1)';this.style.borderColor='rgba(99,102,241,0.3)'}"
                         onmouseleave="if(!${isActive}){this.style.background='rgba(255,255,255,0.03)';this.style.borderColor='rgba(255,255,255,0.06)'}"
                         onclick="window.inlineSetDN('${p.id}', '${containerId || ''}')">
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
                           onclick="this.select()" onkeydown="if(event.key==='Enter') window.inlineFinish('${containerId || 'main'}', '${containerId || ''}')"
                           value="${well && well.rzednaDna !== null && well.rzednaDna !== undefined ? parseFloat(well.rzednaDna).toFixed(3) : ''}" 
                           placeholder="—" style="height:26px; padding:0 0.3rem; font-size:0.9rem; font-weight:700; text-align:center; color:var(--text-primary); background:rgba(255,255,255,0.03); border:1px solid rgba(255,255,255,0.08); border-radius:4px;">
                </div>
                <div class="ui-center-min">
                    <div class="ui-text-muted-sm">Kąt [°]</div>
                     <input type="number" class="form-input color-link" id="inl-angle-${containerId || 'main'}" value="0" min="0" max="360" onclick="this.select()" oninput="window.inlineUpdateAngles('${containerId || 'main'}')" onkeydown="if(event.key==='Enter') window.inlineFinish('${containerId || 'main'}', '${containerId || ''}')" style="height:26px; padding:0 0.3rem; font-size:0.9rem; font-weight:800; text-align:center; background:rgba(255,255,255,0.03); border:1px solid rgba(255,255,255,0.08); border-radius:4px;">
                </div>
                <div class="ui-center-min">
                    <div class="ui-text-muted-sm">Spadek w kinecie [%]</div>
                    <input type="number" class="form-input" id="inl-spadek-kineta-${containerId || 'main'}" step="1" onclick="this.select()" onkeydown="if(event.key==='Enter') window.inlineFinish('${containerId || 'main'}', '${containerId || ''}')" placeholder="—" style="height:26px; padding:0 0.3rem; font-size:0.9rem; font-weight:700; text-align:center; color:var(--text-primary); background:rgba(255,255,255,0.03); border:1px solid rgba(255,255,255,0.08); border-radius:4px;">
                </div>
                <div class="ui-center-min">
                    <div class="ui-text-muted-sm">Spadek w mufie [%]</div>
                    <input type="number" class="form-input" id="inl-spadek-mufa-${containerId || 'main'}" step="1" onclick="this.select()" onkeydown="if(event.key==='Enter') window.inlineFinish('${containerId || 'main'}', '${containerId || ''}')" placeholder="—" style="height:26px; padding:0 0.3rem; font-size:0.9rem; font-weight:700; text-align:center; color:var(--text-primary); background:rgba(255,255,255,0.03); border:1px solid rgba(255,255,255,0.08); border-radius:4px;">
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
                    <button class="btn btn-primary" onclick="window.inlineFinish('${containerId || 'main'}', '${containerId || ''}')" style="height:26px; width:100%; justify-content:center; font-size:0.7rem; padding:0;"><i data-lucide="plus"></i> Dodaj</button>
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

window.renderWellPrzejscia = function renderWellPrzejscia(opts) {
    const _opts = opts || {};
    const container = document.getElementById(_opts.containerId || 'well-przejscia-tiles');
    const countEl = document.getElementById(_opts.countElId || 'przejscia-count');
    const filterElementIndex = _opts.filterElementIndex != null ? _opts.filterElementIndex : null;
    const well = getCurrentWell();

    if (!window.activateQuickEdit) {
        window.activateQuickEdit = function (element, index, field) {
            if (element.querySelector('input')) return; // Przerwij jesli juz w trybie edycji
            if (isWellLocked()) {
                showToast(WELL_LOCKED_MSG, 'error');
                return;
            }
            if (isOfferLocked()) {
                showToast(OFFER_LOCKED_MSG, 'error');
                return;
            }

            // Anuluj wszelkie oczekujące odświeżania po utracie fokusu (blur) przez inne pole
            if (window.__pendingPrzejsciaRefresh) {
                clearTimeout(window.__pendingPrzejsciaRefresh);
                window.__pendingPrzejsciaRefresh = null;

                // Natychmiast zapisz oczekujące zmiany!
                if (typeof window.__pendingPrzejsciaApply === 'function') {
                    window.__pendingPrzejsciaApply();
                    window.__pendingPrzejsciaApply = null;
                }

                // Do którego kontenera należy ten element?
                const containerId = element.closest('#zl-przejscia-list')
                    ? 'zl-przejscia-list'
                    : 'well-przejscia-tiles';

                renderWellPrzejscia();
                if (typeof window.refreshZleceniaModalIfActive === 'function')
                    window.refreshZleceniaModalIfActive();

                const newList = document.getElementById(containerId);
                if (newList) {
                    const stableId = element.getAttribute('data-qe-id');
                    const newEl = newList.querySelector(
                        `[data-qe-id="${stableId}"][data-qe-field="${field}"]`
                    );
                    if (newEl) element = newEl;
                }
            }

            const well = getCurrentWell();
            if (!well || !well.przejscia || !well.przejscia[index]) return;

            let val, step;
            if (field === 'angle') {
                val = well.przejscia[index].angle;
                step = '1';
            } else if (field === 'spadekKineta') {
                val = well.przejscia[index].spadekKineta || '';
                step = '1';
            } else if (field === 'spadekMufa') {
                val = well.przejscia[index].spadekMufa || '';
                step = '1';
            } else if (field === 'heightMm') {
                val = '';
                step = '1';
            } else if (field === 'doplata') {
                val = well.przejscia[index].doplata || '0';
                step = '1';
            } else {
                val =
                    well.przejscia[index].rzednaWlaczenia !== null &&
                    well.przejscia[index].rzednaWlaczenia !== undefined
                        ? well.przejscia[index].rzednaWlaczenia
                        : '';
                step = '0.001';
            }
            const w = element.offsetWidth;
            const useCalc =
                field === 'rzednaWlaczenia' || field === 'heightMm' || field === 'doplata';
            const inpType = useCalc ? 'text' : 'number';
            const inpMode = useCalc ? ' inputmode="decimal"' : '';

            element.innerHTML = `<input type="${inpType}"${inpMode} step="${step}" placeholder="${val}" style="width:${Math.max(70, w + 10)}px; background:#0f172a; color:#fff; border:1px solid #3b82f6; border-radius:4px; font-size:1.15rem; font-weight:800; text-align:center; padding:0; outline:none; box-shadow:0 0 5px rgba(59,130,246,0.5);" value="" onclick="this.select()" onblur="window.saveQuickEdit(${index}, '${field}', this.value)" onkeydown="if(event.key==='Enter') this.blur();">`;
            const inp = element.querySelector('input');
            inp.focus();
        };

        window.__pendingPrzejsciaRefresh = null;
        window.saveQuickEdit = function (index, field, value) {
            if (isWellLocked()) {
                showToast(WELL_LOCKED_MSG, 'error');
                return;
            }
            if (isOfferLocked()) {
                showToast(OFFER_LOCKED_MSG, 'error');
                return;
            }
            const well = getCurrentWell();
            if (!well || !well.przejscia || !well.przejscia[index]) return;

            const applyChanges = () => {
                if (value.trim() === '') {
                    renderWellPrzejscia();
                    if (typeof window.refreshZleceniaModalIfActive === 'function') {
                        window.refreshZleceniaModalIfActive();
                    }
                    return;
                }

                let numVal = parseCalcExpression(value);
                if (field === 'angle') {
                    if (isNaN(numVal)) numVal = 0;
                    if (numVal < 0) numVal = 0;
                    if (numVal > 360) numVal = 360;
                    well.przejscia[index].angle = numVal;
                    well.przejscia[index].angleExecution =
                        numVal === 0 || numVal === 360 ? 0 : 360 - numVal;
                    well.przejscia[index].angleGony = ((numVal * 400) / 360).toFixed(2);

                    if (!well.przejscia[index].flowTypeManual) {
                        well.przejscia[index].flowType =
                            numVal === 0 ? FLOW_TYPES.WYLOT : FLOW_TYPES.WLOT;
                    }
                } else if (field === 'rzednaWlaczenia') {
                    if (isNaN(numVal)) {
                        well.przejscia[index].rzednaWlaczenia = '';
                    } else {
                        const rzWlazu = parseFloat(well.rzednaWlazu);
                        const rzDna = parseFloat(well.rzednaDna);
                        if (!isNaN(rzDna) && numVal < rzDna) {
                            showToast('Rzędna nie może być niższa niż rzędna dna!', 'error');
                            numVal = rzDna;
                        }
                        if (!isNaN(rzWlazu) && numVal > rzWlazu) {
                            showToast('Rzędna nie może być wyższa niż rzędna włazu!', 'error');
                            numVal = rzWlazu;
                        }
                        well.przejscia[index].rzednaWlaczenia = numVal.toFixed(3);
                    }
                } else if (field === 'spadekKineta') {
                    well.przejscia[index].spadekKineta = isNaN(numVal) ? null : Math.round(numVal);
                } else if (field === 'spadekMufa') {
                    well.przejscia[index].spadekMufa = isNaN(numVal) ? null : Math.round(numVal);
                } else if (field === 'heightMm') {
                    const rzDnaQ = parseFloat(well.rzednaDna) || 0;
                    const cfgMap = buildConfigMap(well, (id) =>
                        studnieProducts.find((p) => p.id === id)
                    );
                    let curRz = parseFloat(well.przejscia[index].rzednaWlaczenia);
                    if (isNaN(curRz)) curRz = rzDnaQ;
                    const curMm = (curRz - rzDnaQ) * 1000;
                    const { entry: assigned } = findAssignedElement(curMm, cfgMap);
                    const elStart = assigned ? assigned.start : 0;
                    if (isNaN(numVal)) numVal = 0;
                    if (numVal < 0) numVal = 0;
                    const newRzedna = rzDnaQ + (elStart + numVal) / 1000;
                    well.przejscia[index].rzednaWlaczenia = newRzedna.toFixed(3);
                } else if (field === 'doplata') {
                    well.przejscia[index].doplata = isNaN(numVal) ? 0 : numVal;
                }

                if (field === 'rzednaWlaczenia' || field === 'heightMm') {
                    const isNowOsadnik =
                        typeof isSettlingWell === 'function' ? isSettlingWell(well) : false;
                    if (!isNowOsadnik && well.wkladkaOsadnikPreco === 'tak') {
                        well.wkladkaOsadnikPreco = 'brak';
                        if (window.showToast)
                            window.showToast(
                                'Studnia przestała być osadnikiem. Wyłączono wkładkę.',
                                'info'
                            );
                    }
                }

                renderWellPrzejscia();
                renderWellDiagram();
                updateSummary();
                if (typeof renderWellConfig === 'function') renderWellConfig();
                if (typeof renderWellParams === 'function') renderWellParams();
                if (typeof window.refreshZleceniaModalIfActive === 'function') {
                    window.refreshZleceniaModalIfActive();
                }
            };

            // Ujmij krótkie opóźnienie do odświeżenia, aby pozwolić na wcześniejsze wywołanie kliknięcia na następnym elemencie
            if (window.__pendingPrzejsciaRefresh) {
                clearTimeout(window.__pendingPrzejsciaRefresh);
                if (typeof window.__pendingPrzejsciaApply === 'function') {
                    window.__pendingPrzejsciaApply();
                }
            }
            window.__pendingPrzejsciaApply = applyChanges;
            window.__pendingPrzejsciaRefresh = setTimeout(() => {
                applyChanges();
                window.__pendingPrzejsciaRefresh = null;
                window.__pendingPrzejsciaApply = null;
            }, 100);
        };
    }

    if (!container) return;

    if (!well || !well.przejscia || well.przejscia.length === 0) {
        container.innerHTML =
            '<div style="text-align:center; padding:1.2rem; color:var(--text-muted); font-size:0.75rem; border:1px dashed rgba(255,255,255,0.08); border-radius:8px;">Brak zdefiniowanych przejść.<br>Dodaj przejście z formularza powyżej.</div>';
        if (countEl) countEl.textContent = '';
        return;
    }

    // Jeśli ustawiono filterElementIndex, sprawdź, czy DOWOLNE przejście należy do elementu
    if (filterElementIndex != null) {
        const rzDnaCheck = parseFloat(well.rzednaDna) || 0;
        const findProdCheck = (id) => studnieProducts.find((pr) => pr.id === id);
        const cfgMapCheck = buildConfigMap(well, findProdCheck);
        const hasAny = well.przejscia.some((item) => {
            let pel = parseFloat(item.rzednaWlaczenia);
            if (isNaN(pel)) pel = rzDnaCheck;
            const mm = (pel - rzDnaCheck) * 1000;
            const { assignedIndex } = findAssignedElement(mm, cfgMapCheck);
            return assignedIndex === filterElementIndex;
        });
        if (!hasAny) {
            container.innerHTML =
                '<div style="text-align:center; padding:1.2rem; color:var(--text-muted); font-size:0.75rem; border:1px dashed rgba(255,255,255,0.08); border-radius:8px;">Brak przejść szczelnych<br>w tym elemencie.</div>';
            if (countEl) countEl.textContent = '(0)';
            return;
        }
    }

    const rzDna = parseFloat(well.rzednaDna) || 0;
    const findProduct = (id) => studnieProducts.find((pr) => pr.id === id);
    const configMap = buildConfigMap(well, findProduct, true);

    // Automatyczne sortowanie według poziomu elementu (assignedIndex), a następnie według kąta
    const sorted = well.przejscia
        .map((item) => {
            let pel = parseFloat(item.rzednaWlaczenia);
            if (isNaN(pel)) pel = rzDna;
            const mmFromBottom = (pel - rzDna) * 1000;
            const { assignedIndex } = findAssignedElement(mmFromBottom, configMap);
            return { item, assignedIndex };
        })
        .sort((a, b) => {
            if (a.assignedIndex !== b.assignedIndex) {
                return b.assignedIndex - a.assignedIndex;
            }
            return (a.item.angle || 0) - (b.item.angle || 0);
        });

    // Przebuduj tablicę przejść w posortowanej kolejności
    well.przejscia = sorted.map((s) => s.item);

    let totalPrice = 0;
    let html =
        '<div style="display:grid; grid-template-columns:1fr; gap:0.5rem; overflow-x:auto; padding-bottom:0.5rem;">';

    let prevAssignedIndex = -999;
    let filteredCount = 0;

    // Nadaj displayIndex przejściom, które go nie mają (kompatybilność wsteczna)
    ensureDisplayIndices(well.przejscia);

    well.przejscia.forEach((item, index) => {
        let pel = parseFloat(item.rzednaWlaczenia);
        if (isNaN(pel)) pel = rzDna;
        const mmFromBottom = (pel - rzDna) * 1000;

        const { assignedIndex, entry: assignedEntry } = findAssignedElement(
            mmFromBottom,
            configMap
        );

        // Oblicz cene wiercenia dla tego przejscia
        let drillingBasePrice = 0;
        let bestDrillProd = null;
        const p = findProduct(item.productId);
        if (p) {
            const isInsitu = p.name && p.name.toUpperCase().includes('INSITU');
            if (
                !isInsitu &&
                assignedEntry &&
                (assignedEntry.componentType === 'krag' ||
                    assignedEntry.componentType === 'krag_ot')
            ) {
                const trDn = parseInt(item.dn) || parseInt(p.dn) || 0;
                if (trDn > 0) {
                    const drillingProducts = studnieProducts.filter(
                        (x) => x.category === 'Wiercenie'
                    );
                    let bestDnDiff = Infinity;
                    drillingProducts.forEach((drill) => {
                        let drillDn = parseInt(drill.dn);
                        if (isNaN(drillDn)) {
                            const match = drill.id.match(/Wiercenie-(\d+)/i);
                            if (match) drillDn = parseInt(match[1]);
                        }
                        if (!isNaN(drillDn) && drillDn >= trDn) {
                            if (drillDn - trDn < bestDnDiff) {
                                bestDnDiff = drillDn - trDn;
                                bestDrillProd = drill;
                            }
                        }
                    });
                    if (bestDrillProd) {
                        drillingBasePrice = /** @type {any} */ (bestDrillProd).price || 0;
                    }
                }
            }
        }

        // Pomin przejscia nieprzypisane do tego elementu podczas filtrowania
        if (filterElementIndex != null && assignedIndex !== filterElementIndex) return;
        filteredCount++;

        const assignedName = assignedEntry
            ? assignedEntry.name || 'Brak dopasowania'
            : 'Brak dopasowania';
        const assignedBg = assignedEntry
            ? assignedEntry.bg || 'rgba(0,0,0,0.25)'
            : 'rgba(0,0,0,0.25)';

        if (filterElementIndex == null && assignedIndex !== prevAssignedIndex) {
            const rawRGB = assignedBg.length > 7 ? assignedBg.substring(0, 7) : assignedBg;
            if (index > 0) html += '<div style="height:0.5rem;"></div>';
            html += `<div style="display:flex; align-items:center; gap:0.4rem; padding:0.3rem 0.5rem; margin-top:0.4rem; margin-bottom:0.4rem; background:linear-gradient(90deg, ${assignedBg} 0%, rgba(30,41,59,0.8) 100%); border-left:3px solid ${rawRGB}; border-radius:6px; color:var(--text-muted); font-size:0.65rem; font-weight:700; text-transform:uppercase; letter-spacing:0.5px; box-shadow:0 1px 3px rgba(0,0,0,0.3);">
                <span style="font-size:0.9rem; filter:grayscale(0.4);"><i data-lucide="map-pin"></i></span> 
                <span>Dotyczy:</span> 
                <span style="color:#e2e8f0; font-size:0.75rem; padding-left:0.2rem;">${assignedName}</span>
            </div>`;
            prevAssignedIndex = assignedIndex;
        }

        const price = p ? p.price : 0;
        totalPrice += price + drillingBasePrice;

        const heightMm = computeHeightFromElement(mmFromBottom, configMap);

        // Tryb edycji dla tego kafelka
        if (editPrzejscieIdx === index) {
            const typeName = p ? p.category : 'Nieznane';
            const przejsciaProducts = studnieProducts.filter(
                (pr) => pr.componentType === 'przejscie' && pr.active !== 0
            );
            const allTypes = [...new Set(przejsciaProducts.map((pr) => pr.category))].sort();

            // Synchronizuj fallback do aktualnie renderowanego, jesli stan jest pusty
            if (!editPrzejscieState.type) {
                editPrzejscieState.type = typeName;
                editPrzejscieState.dnId = item.productId;
                editPrzejscieState.rzedna = item.rzednaWlaczenia || '';
                editPrzejscieState.angle = item.angle || 0;

                editPrzejscieState.spadekKineta = item.spadekKineta || '';
                editPrzejscieState.spadekMufa = item.spadekMufa || '';
            }

            const maxPipeDn = well ? getMaxPipeDn(well.dn) : 9999;
            const currentTypeDNs = przejsciaProducts
                .filter((pr) => pr.category === editPrzejscieState.type || pr.id === item.productId)
                .filter((pr) => {
                    if (pr.category === 'Otwór KPED') return true;
                    let pDn = 160;
                    if (typeof pr.dn === 'string' && pr.dn.includes('/')) {
                        pDn = parseFloat(pr.dn.split('/')[0]) || 160;
                    } else {
                        pDn = parseFloat(pr.dn) || 160;
                    }
                    return pDn <= maxPipeDn || pr.id === item.productId;
                })
                .sort((a, b) => a.dn - b.dn);
            const execAngle =
                editPrzejscieState.angle === 0 || editPrzejscieState.angle === 360
                    ? 0
                    : 360 - editPrzejscieState.angle;
            const gons = ((editPrzejscieState.angle * 400) / 360).toFixed(2);

            html += `<div style="background:linear-gradient(90deg, rgba(30,58,138,0.8) 0%, rgba(30,41,59,0.95) 100%); border:1px solid rgba(96,165,250,0.5); border-left:4px solid #3b82f6; border-radius:8px; min-width:max-content; padding:0.6rem; position:relative; box-shadow:0 4px 12px rgba(96,165,250,0.15); margin-bottom:0.3rem;">
              <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:0.4rem;">
                <div style="display:flex; align-items:center; gap:0.4rem;">
                  <div style="display:flex; align-items:center; justify-content:center; background:rgba(0,0,0,0.2); padding:0.2rem 0.4rem; border-radius:4px;">
                    <span style="font-size:0.65rem; color:var(--text-primary); font-weight:700;">${index + 1}</span>
                  </div>
                  <span style="font-size:0.75rem; font-weight:700; color:#60a5fa;">Edycja wariantu</span>
                </div>
                <button onclick="cancelPrzejscieEdit()" title="Krzyżyk" style="background:none; border:none; cursor:pointer; font-size:0.8rem; color:var(--text-muted);"><i data-lucide="x"></i></button>
              </div>
              
              <div style="font-size:0.55rem; color:var(--text-muted); margin-bottom:0.2rem;">Kategoria przejścia</div>
              <div style="display:flex; flex-wrap:wrap; gap:0.25rem; margin-bottom:0.5rem; max-height:80px; overflow-y:auto; scrollbar-width:thin;">
                ${allTypes
                    .map((t) => {
                        const isActive = t === editPrzejscieState.type;
                        return `<div onclick="window.editInlineSetType('${t}')" style="padding:0.25rem 0.45rem; font-size:0.65rem; font-weight:600; border-radius:4px; cursor:pointer; background:${isActive ? 'rgba(96,165,250,0.2)' : 'rgba(255,255,255,0.03)'}; border:1px solid ${isActive ? 'rgba(96,165,250,0.6)' : 'rgba(255,255,255,0.08)'}; color:${isActive ? '#93c5fd' : 'var(--text-primary)'}; transition:all 0.15s;">${t}</div>`;
                    })
                    .join('')}
              </div>

              <div style="font-size:0.55rem; color:var(--text-muted); margin-bottom:0.2rem;">Średnica (DN)</div>
              <div style="display:flex; flex-wrap:wrap; gap:0.25rem; margin-bottom:0.6rem;">
                ${currentTypeDNs
                    .map((pr) => {
                        const isActive = pr.id === editPrzejscieState.dnId;
                        const dnLbl =
                            typeof pr.dn === 'string' && pr.dn.includes('/') ? pr.dn : 'DN' + pr.dn;
                        return `<div onclick="window.editInlineSetDN('${pr.id}')" class="${isActive ? 'color-success' : ''}" style="padding:0.25rem 0.45rem; font-size:0.65rem; font-weight:700; border-radius:4px; cursor:pointer; background:${isActive ? 'rgba(34,197,94,0.2)' : 'rgba(255,255,255,0.03)'}; border:1px solid ${isActive ? 'rgba(34,197,94,0.6)' : 'rgba(255,255,255,0.08)'}; transition:all 0.15s;">${dnLbl}</div>`;
                    })
                    .join('')}
              </div>

              <div style="display:grid; grid-template-columns:1fr 1fr 1fr 1fr; gap:0.5rem; margin-bottom:0.5rem;">
                <div>
                  <label style="font-size:0.55rem; color:var(--text-muted); display:block; margin-bottom:0.15rem;">Rzędna [m]</label>
                  <input type="text" inputmode="decimal" class="form-input" id="edit-rzedna-${index}" step="0.001" value="${editPrzejscieState.rzedna}" placeholder="142.500" style="padding:0.35rem; font-size:0.75rem; text-align:center;" onchange="window.syncEditState()">
                </div>
                <div>
                  <label style="font-size:0.55rem; color:var(--text-muted); display:block; margin-bottom:0.15rem;">Kąt [°]</label>
                   <input type="number" class="form-input color-link" id="edit-angle-${index}" value="${editPrzejscieState.angle}" min="0" max="360" oninput="editUpdateAngles(${index}); window.syncEditState()" style="padding:0.35rem; font-size:0.75rem; font-weight:800; text-align:center;">
                </div>
                <div>
                  <label style="font-size:0.55rem; color:var(--text-muted); display:block; margin-bottom:0.15rem;">Spadek w kinecie [%]</label>
                  <input type="number" class="form-input" id="edit-spadek-kineta-${index}" step="1" value="${editPrzejscieState.spadekKineta}" style="padding:0.35rem; font-size:0.75rem; text-align:center;" onchange="window.syncEditState()">
                </div>
                <div>
                  <label style="font-size:0.55rem; color:var(--text-muted); display:block; margin-bottom:0.15rem;">Spadek w mufie [%]</label>
                  <input type="number" class="form-input" id="edit-spadek-mufa-${index}" step="1" value="${editPrzejscieState.spadekMufa}" style="padding:0.35rem; font-size:0.75rem; text-align:center;" onchange="window.syncEditState()">
                </div>
              </div>
              


              <div style="display:flex; justify-content:space-between; align-items:center; margin-top:0.6rem; padding-top:0.4rem; border-top:1px solid rgba(255,255,255,0.05);">
                <div style="display:flex; gap:0.8rem; font-size:0.65rem;">
                  <span class="ui-text-mute">Wyk: <strong id="edit-exec-${index}" class="text-primary">${execAngle}°</strong></span>
                  <span class="ui-text-mute">Gony: <strong id="edit-gony-${index}" style="color:var(--success);">${gons}<sup>g</sup></strong></span>
                </div>
                <div style="display:flex; gap:0.4rem;">
                  <button onclick="cancelPrzejscieEdit()" style="padding:0.3rem 0.6rem; font-size:0.7rem; border-radius:5px; border:1px solid rgba(255,255,255,0.1); background:rgba(255,255,255,0.05); color:var(--text-primary); cursor:pointer;">Anuluj</button>
                  <button onclick="savePrzejscieEdit(${index})" class="btn btn-primary" style="padding:0.3rem 0.6rem; font-size:0.7rem;"><i data-lucide="save"></i> Zapisz</button>
                </div>
              </div>
            </div>`;
            return;
        }

        // Uzyj wspolnego renderera kafelkow przejsc
        html += renderTransitionTileHTML(item, index, p, {
            heightMm,
            showEditBtn: true,
            showDeleteBtn: true,
            showPrice: true,
            enableDragDrop: true,
            assignedCfgIndex: assignedIndex,
            drillingBasePrice: drillingBasePrice,
            drillingProd: bestDrillProd
        });
    });

    html += '</div>';

    // Pasek podsumowania
    const countLabel =
        filterElementIndex != null
            ? `Przejścia tego elementu (${filteredCount} szt.)`
            : `Suma wszystkich przejść (${well.przejscia.length} szt.)`;
    html += `<div style="display:flex; justify-content:space-between; align-items:center; margin-top:0.6rem; padding:0.4rem 0.6rem; background:rgba(99,102,241,0.08); border-radius:6px; border:1px solid rgba(99,102,241,0.2);">
      <span style="font-size:0.7rem; color:var(--text-muted); font-weight:600;">${countLabel}</span>
      <span style="font-size:0.85rem; font-weight:800; color:var(--success);">${fmt(totalPrice)} PLN</span>
    </div>`;

    container.innerHTML = html;
    if (window.lucide && window.lucide.createIcons) {
        window.lucide.createIcons();
    }
    if (countEl)
        countEl.textContent = `(${filterElementIndex != null ? filteredCount : well.przejscia.length})`;
};

/* ===== PRZECIĄGNIJ I UPUŚĆ DLA PRZEJŚĆ ===== */

window.handlePrzDragStart = function (e) {
    draggedPrzIndex = parseInt(e.currentTarget.getAttribute('data-prz-idx'));
    e.dataTransfer.effectAllowed = 'move';
    e.currentTarget.style.opacity = '0.4';
};

window.handlePrzDragOver = function (e) {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    const tile = e.target.closest('[data-prz-idx]');
    if (tile) {
        tile.style.borderTop = '2px solid #3b82f6';
    }
};

window.handlePrzDrop = function (e) {
    e.preventDefault();
    e.stopPropagation();
    if (isOfferLocked()) {
        showToast(OFFER_LOCKED_MSG, 'error');
        return;
    }
    if (isWellLocked()) {
        showToast(WELL_LOCKED_MSG, 'error');
        return;
    }
    const tile = e.target.closest('[data-prz-idx]');
    if (tile && draggedPrzIndex !== null) {
        tile.style.borderTop = '';
        const dropIndex = parseInt(tile.getAttribute('data-prz-idx'));
        if (draggedPrzIndex === dropIndex) return;

        const well = getCurrentWell();
        if (!well) return;

        // Wyodrębnij przeciągany element
        const draggedItem = well.przejscia.splice(draggedPrzIndex, 1)[0];

        // Wstaw w nowej pozycji
        well.przejscia.splice(dropIndex, 0, draggedItem);

        renderWellPrzejscia();
        updateSummary();
    }
};

window.handlePrzDragEnd = function (e) {
    e.currentTarget.style.opacity = '1';
    document.querySelectorAll('[data-prz-idx]').forEach((t) => (t.style.borderTop = ''));
    draggedPrzIndex = null;
};
