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
            <div style="text-align:center; padding:1.5rem; border:1px dashed rgba(var(--accent-rgb), 0.2); border-radius: var(--radius-sm); background:rgba(var(--slate-950-rgb), 0.3); margin:0.4rem 0;">
                <div style="font-size: var(--fs-6xl); margin-bottom:0.5rem;"><i data-lucide="ban"></i></div>
                <div style="font-size: var(--fs-base); font-weight: var(--fw-bold); color:var(--text-primary); margin-bottom:0.3rem;">Wszystkie przejścia są ukryte</div>
                <div style="font-size: var(--fs-xs); color:var(--text-muted); margin-bottom:0.8rem;">Włącz widoczność wybranych typów przejść, aby móc je dodawać.</div>
                <button class="btn btn-primary btn-sm" data-action="openPrzejsciaVisibilityPopup" data-container="${containerId || ''}" style="padding:0.35rem 0.8rem; font-size: var(--fs-sm);">
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
            <div class="flex-space-between">
                <div style="font-size: var(--fs-2xs); color:var(--text-muted); text-transform:uppercase; letter-spacing:0.5px; font-weight: var(--fw-bold);">Rodzaj materiału</div>
                <button data-action="openPrzejsciaVisibilityPopup" data-container="${containerId || ''}" style="background:rgba(var(--accent-rgb), 0.1); border:1px solid rgba(var(--accent-rgb), 0.3); color:var(--accent-text); font-size: var(--fs-2xs); font-weight: var(--fw-semibold); padding:0.15rem 0.5rem; border-radius: var(--radius-2xs); cursor:pointer; transition:all 0.15s;" onmouseenter="this.style.background='rgba(var(--accent-rgb), 0.2)';this.style.borderColor='rgba(var(--accent-rgb), 0.5)'" onmouseleave="this.style.background='rgba(var(--accent-rgb), 0.1)';this.style.borderColor='rgba(var(--accent-rgb), 0.3)'">${visibilityBtnLabel}</button>
            </div>
            <div id="przejscia-type-scroll" style="max-height:140px; overflow-y:auto; padding-right:0.2rem; scrollbar-width:thin; scrollbar-color:rgba(var(--accent-rgb), 0.5) transparent;">
                <div class="grid-auto-120">
                    ${types
                        .map((t) => {
                            const isActive = t === inlinePrzejsciaState.type;
                            return `
                        <div data-action="inlineSetType" data-t="${escapeJsStr(t)}" data-container="${escapeJsStr(containerId || '')}" 
                             style="padding:0.2rem 0.4rem; border-radius: var(--radius-sm); cursor:pointer; transition:all 0.15s ease; height:44px; display:flex; align-items:center; justify-content:center;
                                    background:${isActive ? 'rgba(var(--accent-rgb), 0.2)' : 'rgba(var(--white-rgb), 0.05)'};
                                    border:1px solid ${isActive ? 'rgba(var(--accent-rgb), 0.5)' : 'rgba(var(--white-rgb), 0.05)'};
                                    ${isActive ? 'box-shadow:0 0 8px rgba(var(--accent-rgb), 0.15);' : ''}"
                             onmouseenter="if(!${isActive})this.style.background='rgba(var(--accent-rgb), 0.1)';this.style.borderColor='rgba(var(--accent-rgb), 0.3)'"
                             onmouseleave="if(!${isActive})this.style.background='rgba(var(--white-rgb), 0.05)';this.style.borderColor='rgba(var(--white-rgb), 0.05)'"
                             title="${escapeHtmlAttr(t)}">
                             <div class="${isActive ? 'color-accent' : ''}" style="font-size:${t.length > 20 ? '9px' : t.length > 14 ? '11px' : '14px'}; font-weight: var(--fw-bold); text-align:center; line-height:1.1; word-break:break-word;">${escapeHtml(t)}</div>
                        </div>`;
                        })
                        .join('')}
                </div>
            </div>
        </div>

        <!-- Wybór DN -->
        <div style="padding:0.3rem 0;">
            <div style="font-size: var(--fs-2xs); color:var(--text-muted); text-transform:uppercase; margin-bottom:0.3rem; letter-spacing:0.5px; font-weight: var(--fw-bold);">Średnica (DN) — ${escapeHtml(inlinePrzejsciaState.type || '')}</div>
            <div class="grid-auto-120">
                ${dnList
                    .map((p) => {
                        const isActive = p.id === inlinePrzejsciaState.dnId;
                        const dnLabel =
                            typeof p.dn === 'string' && p.dn.includes('/') ? p.dn : 'DN ' + p.dn;
                        return `
                    <div class="fs-dn-tile ${isActive ? 'active' : ''}" 
                         style="padding:0.2rem 0.4rem; text-align:center; cursor:pointer; border-radius: var(--radius-sm); height:44px; display:flex; align-items:center; justify-content:center; transition:all 0.15s ease;
                                background:${isActive ? 'rgba(var(--accent-rgb), 0.2)' : 'rgba(var(--white-rgb), 0.05)'};
                                border:1px solid ${isActive ? 'rgba(var(--accent-rgb), 0.5)' : 'rgba(var(--white-rgb), 0.05)'};
                                ${isActive ? 'box-shadow:0 0 10px rgba(var(--accent-rgb), 0.3);' : ''}"
                         onmouseenter="if(!${isActive}){this.style.background='rgba(var(--accent-rgb), 0.1)';this.style.borderColor='rgba(var(--accent-rgb), 0.3)'}"
                         onmouseleave="if(!${isActive}){this.style.background='rgba(var(--white-rgb), 0.05)';this.style.borderColor='rgba(var(--white-rgb), 0.05)'}"
                         data-action="inlineSetDN" data-id="${escapeHtml(p.id)}" data-container="${escapeHtml(containerId || '')}">
                         <div class="${isActive ? 'color-accent' : ''}" style="font-size:${dnLabel.length > 18 ? '9px' : dnLabel.length > 13 ? '11px' : '15px'}; font-weight: var(--fw-extrabold); text-align:center; letter-spacing:0.5px;">${dnLabel}</div>
                    </div>
                `;
                    })
                    .join('')}
            </div>
        </div>

        ${
            selectedProduct
                ? `
        <div class="wt-add-panel">
            <div class="wt-add-details">
                <span class="wt-add-title">${escapeHtml(selectedProduct.category)}</span>
                <span class="wt-add-dn">&nbsp;${typeof selectedProduct.dn === 'string' && selectedProduct.dn.includes('/') ? selectedProduct.dn : 'DN' + selectedProduct.dn}</span>
            </div>
            <div class="wt-add-cell">
                <div class="wt-add-header">Rzędna [m]</div>
                <div class="wt-add-body">
                    <input type="text" inputmode="decimal" class="form-input" id="inl-rzedna-${containerId || 'main'}" step="0.001"
                           onclick="this.select()" onkeydown="if(event.key==='Enter') window.inlineFinish('${containerId || 'main'}', '${containerId || ''}')"
                           value="${well && well.rzednaDna !== null && well.rzednaDna !== undefined ? parseFloat(well.rzednaDna).toFixed(3) : ''}"
                           placeholder="—">
                </div>
            </div>
            <div class="wt-add-cell">
                <div class="wt-add-header">Kąt [°]</div>
                <div class="wt-add-body">
                    <input type="number" class="form-input color-link" id="inl-angle-${containerId || 'main'}" value="0" min="0" max="360" onclick="this.select()" oninput="window.inlineUpdateAngles('${containerId || 'main'}')" onkeydown="if(event.key==='Enter') window.inlineFinish('${containerId || 'main'}', '${containerId || ''}')">
                </div>
            </div>
            <div class="wt-add-cell" title="Spadek w kinecie [%]">
                <div class="wt-add-header">Spadek kin. [%]</div>
                <div class="wt-add-body">
                    <input type="number" class="form-input" id="inl-spadek-kineta-${containerId || 'main'}" step="1" onclick="this.select()" onkeydown="if(event.key==='Enter') window.inlineFinish('${containerId || 'main'}', '${containerId || ''}')" placeholder="—">
                </div>
            </div>
            <div class="wt-add-cell" title="Spadek w mufie [%]">
                <div class="wt-add-header">Spadek mufy [%]</div>
                <div class="wt-add-body">
                    <input type="number" class="form-input" id="inl-spadek-mufa-${containerId || 'main'}" step="1" onclick="this.select()" onkeydown="if(event.key==='Enter') window.inlineFinish('${containerId || 'main'}', '${containerId || ''}')" placeholder="—">
                </div>
            </div>
            <div class="wt-add-cell" title="Kąt wykonania">
                <div class="wt-add-header">Kąt wyk.</div>
                <div class="wt-add-body">
                    <div class="wt-add-value wt-add-exec" id="inl-exec-${containerId || 'main'}">360°</div>
                </div>
            </div>
            <div class="wt-add-cell" title="Kąt wykonania w gonach">
                <div class="wt-add-header">Gony</div>
                <div class="wt-add-body">
                    <div class="wt-add-value wt-add-gony" id="inl-gony-${containerId || 'main'}">0.00<sup>g</sup></div>
                </div>
            </div>
            <div class="wt-add-cell">
                <div class="wt-add-header">Cena</div>
                <div class="wt-add-body">
                    <div class="wt-add-value wt-add-price">${fmtInt(selectedProduct.price)} <span class="fs-2xs">PLN</span></div>
                </div>
            </div>
            <button class="btn btn-primary wt-add-btn" data-action="inlineFinish" data-main="${containerId || 'main'}" data-container="${containerId || ''}"><i data-lucide="plus"></i> Dodaj</button>
        </div>
        `
                : `
        <div style="text-align:center; padding:0.8rem; color:var(--text-muted); border:1px dashed rgba(var(--white-rgb), 0.05); border-radius: var(--radius-sm); font-size: var(--fs-sm); margin-top:0.3rem;">
            Wybierz średnicę (DN) aby skonfigurować przejście
        </div>
        `
        }
    `;

    if (inlinePrzejsciaState.dnId) {
        window.inlineUpdateAngles(containerId || 'main');
        setTimeout(() => {
            const rzednaInput = document.getElementById(`inl-rzedna-${containerId || 'main'}`);
            if (rzednaInput) {
                rzednaInput.focus();
                rzednaInput.select();
            }
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
            void element.offsetWidth;
            const useCalc =
                field === 'rzednaWlaczenia' || field === 'heightMm' || field === 'doplata';
            const inpType = useCalc ? 'text' : 'number';
            const inpMode = useCalc ? ' inputmode="decimal"' : '';

            element.innerHTML = `<input type="${inpType}"${inpMode} step="${step}" placeholder="${escapeHtmlAttr(String(val))}" value="${escapeHtmlAttr(String(val))}" style="width:100%; min-width:90px; height: 32px; margin-top: 2px; box-sizing: border-box; background: rgba(var(--slate-950-rgb), 0.95); color: var(--accent-text); border: 1px solid var(--accent); border-radius: var(--radius-xs); font-size: var(--fs-xl); font-weight: var(--fw-extrabold); text-align: center; padding: 0 0.4rem; outline: none; box-shadow: 0 0 8px rgba(var(--accent-rgb), 0.4);" onclick="this.select()" onblur="window.saveQuickEdit(${index}, '${field}', this.value)" onkeydown="if(event.key==='Enter') this.blur();">`;
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
            '<div class="empty-state"><i data-lucide="droplets"></i><h3>Brak przejść</h3><p>Dodaj przejście z formularza powyżej</p></div>';
        if (countEl) countEl.textContent = '';
        if (window.lucide && window.lucide.createIcons)
            window.lucide.createIcons({ root: container });
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
                '<div class="empty-state"><i data-lucide="droplets"></i><h3>Brak przejść w tym elemencie</h3><p>Przejścia tej studni należą do innych elementów</p></div>';
            if (countEl) countEl.textContent = '(0)';
            if (window.lucide && window.lucide.createIcons)
                window.lucide.createIcons({ root: container });
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
            ? assignedEntry.bg || 'rgba(var(--black-rgb), 0.3)'
            : 'rgba(var(--black-rgb), 0.3)';

        if (filterElementIndex == null && assignedIndex !== prevAssignedIndex) {
            if (index > 0) html += '<div style="height:0.5rem;"></div>';
            html += `<div style="display:flex; align-items:center; gap:0.4rem; padding:0.3rem 0.5rem; margin-top:0.4rem; margin-bottom:0.4rem; background:linear-gradient(90deg, ${assignedBg} 0%, rgba(var(--slate-800-rgb), 0.8) 100%); border-left:3px solid ${assignedBg}; border-radius: var(--radius-sm); color:var(--text-muted); font-size: var(--fs-xs); font-weight: var(--fw-bold); text-transform:uppercase; letter-spacing:0.5px; box-shadow:0 1px 3px rgba(var(--black-rgb), 0.3);">
                <span style="font-size: var(--fs-xl); filter:grayscale(0.4);"><i data-lucide="map-pin"></i></span> 
                <span>Dotyczy:</span> 
                <span style="color:var(--slate-200); font-size: var(--fs-base); padding-left:0.2rem;">${assignedName}</span>
            </div>`;
            prevAssignedIndex = assignedIndex;
        }

        const price = p ? p.price : 0;
        totalPrice += price + drillingBasePrice;

        const heightMm = computeHeightFromElement(mmFromBottom, configMap);

        // Tryb edycji dla tego kafelka
        if (editPrzejscieIdx === index) {
            const typeName = p ? p.category : '—';
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

            html += `<div style="background:linear-gradient(90deg, rgba(var(--blue-rgb), 0.8) 0%, rgba(var(--slate-800-rgb), 0.8) 100%); border:1px solid rgba(var(--blue-rgb), 0.5); border-left:4px solid var(--blue); border-radius: var(--radius-sm); min-width:max-content; padding:0.6rem; position:relative; box-shadow:0 4px 12px rgba(var(--blue-rgb), 0.15); margin-bottom:0.3rem;">
              <div class="flex-between-4">
                <div class="flex-gap-4">
                  <div style="display:flex; align-items:center; justify-content:center; background:rgba(var(--black-rgb), 0.2); padding:0.2rem 0.4rem; border-radius: var(--radius-2xs);">
                    <span style="font-size: var(--fs-xs); color:var(--text-primary); font-weight: var(--fw-bold);">${index + 1}</span>
                  </div>
                  <span style="font-size: var(--fs-base); font-weight: var(--fw-bold); color:var(--blue-hover);">Edycja wariantu</span>
                </div>
                <button data-action="cancelPrzejscieEdit" title="Krzyżyk" style="background:none; border:none; cursor:pointer; font-size: var(--fs-md); color:var(--text-muted);"><i data-lucide="x"></i></button>
              </div>
              
              <div class="fs-3xs-muted-02">Kategoria przejścia</div>
              <div style="display:flex; flex-wrap:wrap; gap:0.25rem; margin-bottom:0.5rem; max-height:80px; overflow-y:auto; scrollbar-width:thin;">
                ${allTypes
                    .map((t) => {
                        const isActive = t === editPrzejscieState.type;
                        return `<div data-action="editInlineSetType" data-t="${escapeJsStr(t)}" style="padding:0.25rem 0.45rem; font-size: var(--fs-xs); font-weight: var(--fw-semibold); border-radius: var(--radius-2xs); cursor:pointer; background:${isActive ? 'rgba(var(--blue-rgb), 0.2)' : 'rgba(var(--white-rgb), 0.05)'}; border:1px solid ${isActive ? 'rgba(var(--blue-rgb), 0.8)' : 'rgba(var(--white-rgb), 0.1)'}; color:${isActive ? 'var(--blue-hover)' : 'var(--text-primary)'}; transition:all 0.15s;">${escapeHtml(t)}</div>`;
                    })
                    .join('')}
              </div>

              <div class="fs-3xs-muted-02">Średnica (DN)</div>
              <div style="display:flex; flex-wrap:wrap; gap:0.25rem; margin-bottom:0.6rem;">
                ${currentTypeDNs
                    .map((pr) => {
                        const isActive = pr.id === editPrzejscieState.dnId;
                        const dnLbl =
                            typeof pr.dn === 'string' && pr.dn.includes('/') ? pr.dn : 'DN' + pr.dn;
                        return `<div data-action="editInlineSetDN" data-id="${escapeJsStr(pr.id)}" class="${isActive ? 'color-success' : ''}" style="padding:0.25rem 0.45rem; font-size: var(--fs-xs); font-weight: var(--fw-bold); border-radius: var(--radius-2xs); cursor:pointer; background:${isActive ? 'rgba(var(--success-rgb), 0.2)' : 'rgba(var(--white-rgb), 0.05)'}; border:1px solid ${isActive ? 'rgba(var(--success-rgb), 0.8)' : 'rgba(var(--white-rgb), 0.1)'}; transition:all 0.15s;">${escapeHtml(dnLbl)}</div>`;
                    })
                    .join('')}
              </div>

              <div style="display:grid; grid-template-columns:1fr 1fr 1fr 1fr; gap:0.5rem; margin-bottom:0.5rem;">
                <div>
                  <label class="fs-3xs-muted-block">Rzędna [m]</label>
                  <input type="text" inputmode="decimal" class="form-input fs-base-rc" id="edit-rzedna-${index}" step="0.001" value="${editPrzejscieState.rzedna}" placeholder="142.500"  onchange="window.syncEditState()" onkeydown="if(event.key==='Enter') this.blur();">
                </div>
                <div>
                  <label class="fs-3xs-muted-block">Kąt [°]</label>
                   <input type="number" class="form-input color-link" id="edit-angle-${index}" value="${editPrzejscieState.angle}" min="0" max="360" oninput="editUpdateAngles(${index}); window.syncEditState()" onkeydown="if(event.key==='Enter') this.blur();" style="padding:0.35rem; font-size: var(--fs-base); font-weight: var(--fw-extrabold); text-align:center;">
                </div>
                <div>
                  <label class="fs-3xs-muted-block">Spadek w kinecie [%]</label>
                  <input type="number" class="form-input fs-base-rc" id="edit-spadek-kineta-${index}" step="1" value="${editPrzejscieState.spadekKineta}"  onchange="window.syncEditState()" onkeydown="if(event.key==='Enter') this.blur();">
                </div>
                <div>
                  <label class="fs-3xs-muted-block">Spadek w mufie [%]</label>
                  <input type="number" class="form-input fs-base-rc" id="edit-spadek-mufa-${index}" step="1" value="${editPrzejscieState.spadekMufa}"  onchange="window.syncEditState()" onkeydown="if(event.key==='Enter') this.blur();">
                </div>
              </div>
              


              <div style="display:flex; justify-content:space-between; align-items:center; margin-top:0.6rem; padding-top:0.4rem; border-top:1px solid rgba(var(--white-rgb), 0.05);">
                <div style="display:flex; gap:0.8rem; font-size: var(--fs-xs);">
                  <span class="ui-text-mute">Wyk: <strong id="edit-exec-${index}" class="text-primary">${execAngle}°</strong></span>
                  <span class="ui-text-mute">Gony: <strong id="edit-gony-${index}" class="color-success">${gons}<sup>g</sup></strong></span>
                </div>
                <div class="flex-gap-4">
                  <button data-action="cancelPrzejscieEdit" style="padding:0.3rem 0.6rem; font-size: var(--fs-sm); border-radius: var(--radius-2xs); border:1px solid rgba(var(--white-rgb), 0.1); background:rgba(var(--white-rgb), 0.05); color:var(--text-primary); cursor:pointer;">Anuluj</button>
                  <button data-action="savePrzejscieEdit" data-index="${index}" class="btn btn-primary" style="padding:0.3rem 0.6rem; font-size: var(--fs-sm);"><i data-lucide="save"></i> Zapisz</button>
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
    html += `<div style="display:flex; justify-content:space-between; align-items:center; margin-top:0.6rem; padding:0.4rem 0.6rem; background:rgba(var(--accent-rgb), 0.1); border-radius: var(--radius-sm); border:1px solid rgba(var(--accent-rgb), 0.2);">
      <span style="font-size: var(--fs-sm); color:var(--text-muted); font-weight: var(--fw-semibold);">${countLabel}</span>
      <span style="font-size: var(--fs-lg); font-weight: var(--fw-extrabold); color:var(--success);">${fmt(totalPrice)} PLN</span>
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
        tile.style.borderTop = '2px solid var(--blue)';
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

/* ===== Delegacja kliknięć (data-action) — TASK-036 ===== */
if (typeof document !== 'undefined' && !window.__wtDelegated) {
    window.__wtDelegated = true;
    document.addEventListener('click', (e) => {
        const el = e.target.closest('[data-action]');
        if (!el) return;
        const action = el.getAttribute('data-action') || '';
        const container = el.getAttribute('data-container');
        const main = el.getAttribute('data-main');
        const id = el.getAttribute('data-id');
        const t = el.getAttribute('data-t');
        const index = el.getAttribute('data-index');
        if (action === 'openPrzejsciaVisibilityPopup') {
            window.openPrzejsciaVisibilityPopup(container || '');
        } else if (action === 'inlineSetType') {
            window.inlineSetType(t, container || '');
        } else if (action === 'inlineSetDN') {
            window.inlineSetDN(id, container || '');
        } else if (action === 'inlineFinish') {
            window.inlineFinish(main || 'main', container || '');
        } else if (action === 'cancelPrzejscieEdit') {
            window.cancelPrzejscieEdit();
        } else if (action === 'savePrzejscieEdit') {
            window.savePrzejscieEdit(parseInt(index, 10));
        } else if (action === 'editInlineSetType') {
            window.editInlineSetType(t);
        } else if (action === 'editInlineSetDN') {
            window.editInlineSetDN(id);
        }
    });
}

/* ===== Rejestracja globali ===== */
window.renderInlinePrzejsciaApp = renderInlinePrzejsciaApp;
