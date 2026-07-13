// @ts-check
/* ===== PRZEJŚCIA — UI, widoczność, DnD ===== */

const visiblePrzejsciaTypes = new Set(); // Domyslnie wszystkie typy sa ukryte

window.openPrzejsciaVisibilityPopup = openPrzejsciaVisibilityPopup;
window.closePrzejsciaVisibilityPopup = closePrzejsciaVisibilityPopup;
window.togglePrzejsciaTypeVisibility = togglePrzejsciaTypeVisibility;
window.setPrzejsciaVisibilityAll = setPrzejsciaVisibilityAll;

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

            element.innerHTML = `<input type="${inpType}"${inpMode} step="${step}" placeholder="${val}" style="width:${Math.max(70, w + 10)}px; background:#0f172a; color:#fff; border:1px solid #3b82f6; border-radius:4px; font-size:1.15rem; font-weight:800; text-align:center; padding:0; outline:none; box-shadow:0 0 5px rgba(59,130,246,0.5);" value="" data-action="saveQuickEdit" data-index="${index}" data-field="${field}">`;
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
                <button data-action="cancelPrzejscieEdit" title="Krzyżyk" style="background:none; border:none; cursor:pointer; font-size:0.8rem; color:var(--text-muted);"><i data-lucide="x"></i></button>
              </div>
              
              <div style="font-size:0.55rem; color:var(--text-muted); margin-bottom:0.2rem;">Kategoria przejścia</div>
              <div style="display:flex; flex-wrap:wrap; gap:0.25rem; margin-bottom:0.5rem; max-height:80px; overflow-y:auto; scrollbar-width:thin;">
                ${allTypes
                    .map((t) => {
                        const isActive = t === editPrzejscieState.type;
                        return `<div data-action="editInlineSetType" data-type="${t}" style="padding:0.25rem 0.45rem; font-size:0.65rem; font-weight:600; border-radius:4px; cursor:pointer; background:${isActive ? 'rgba(96,165,250,0.2)' : 'rgba(255,255,255,0.03)'}; border:1px solid ${isActive ? 'rgba(96,165,250,0.6)' : 'rgba(255,255,255,0.08)'}; color:${isActive ? '#93c5fd' : 'var(--text-primary)'}; transition:all 0.15s;">${t}</div>`;
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
                        return `<div data-action="editInlineSetDN" data-dn-id="${pr.id}" class="${isActive ? 'color-success' : ''}" style="padding:0.25rem 0.45rem; font-size:0.65rem; font-weight:700; border-radius:4px; cursor:pointer; background:${isActive ? 'rgba(34,197,94,0.2)' : 'rgba(255,255,255,0.03)'}; border:1px solid ${isActive ? 'rgba(34,197,94,0.6)' : 'rgba(255,255,255,0.08)'}; transition:all 0.15s;">${dnLbl}</div>`;
                    })
                    .join('')}
              </div>

              <div style="display:grid; grid-template-columns:1fr 1fr 1fr 1fr; gap:0.5rem; margin-bottom:0.5rem;">
                <div>
                  <label style="font-size:0.55rem; color:var(--text-muted); display:block; margin-bottom:0.15rem;">Rzędna [m]</label>
                   <input type="text" inputmode="decimal" class="form-input" id="edit-rzedna-${index}" step="0.001" value="${editPrzejscieState.rzedna}" placeholder="142.500" style="padding:0.35rem; font-size:0.75rem; text-align:center;" data-action="syncEditState">
                </div>
                <div>
                  <label style="font-size:0.55rem; color:var(--text-muted); display:block; margin-bottom:0.15rem;">Kąt [°]</label>
                    <input type="number" class="form-input color-link" id="edit-angle-${index}" value="${editPrzejscieState.angle}" min="0" max="360" data-action="editUpdateAngles" data-index="${index}" style="padding:0.35rem; font-size:0.75rem; font-weight:800; text-align:center;">
                </div>
                <div>
                  <label style="font-size:0.55rem; color:var(--text-muted); display:block; margin-bottom:0.15rem;">Spadek w kinecie [%]</label>
                  <input type="number" class="form-input" id="edit-spadek-kineta-${index}" step="1" value="${editPrzejscieState.spadekKineta}" style="padding:0.35rem; font-size:0.75rem; text-align:center;" data-action="syncEditState">
                </div>
                <div>
                  <label style="font-size:0.55rem; color:var(--text-muted); display:block; margin-bottom:0.15rem;">Spadek w mufie [%]</label>
                  <input type="number" class="form-input" id="edit-spadek-mufa-${index}" step="1" value="${editPrzejscieState.spadekMufa}" style="padding:0.35rem; font-size:0.75rem; text-align:center;" data-action="syncEditState">
                </div>
              </div>
              

              <div style="display:flex; justify-content:space-between; align-items:center; margin-top:0.6rem; padding-top:0.4rem; border-top:1px solid rgba(255,255,255,0.05);">
                <div style="display:flex; gap:0.8rem; font-size:0.65rem;">
                  <span class="ui-text-mute">Wyk: <strong id="edit-exec-${index}" class="text-primary">${execAngle}°</strong></span>
                  <span class="ui-text-mute">Gony: <strong id="edit-gony-${index}" style="color:var(--success);">${gons}<sup>g</sup></strong></span>
                </div>
                <div style="display:flex; gap:0.4rem;">
                  <button data-action="cancelPrzejscieEdit" style="padding:0.3rem 0.6rem; font-size:0.7rem; border-radius:5px; border:1px solid rgba(255,255,255,0.1); background:rgba(255,255,255,0.05); color:var(--text-primary); cursor:pointer;">Anuluj</button>
                  <button data-action="savePrzejscieEdit" data-index="${index}" class="btn btn-primary" style="padding:0.3rem 0.6rem; font-size:0.7rem;"><i data-lucide="save"></i> Zapisz</button>
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

function openPrzejsciaVisibilityPopup(containerId) {
    const przejsciaProducts = studnieProducts.filter(
        (p) => p.componentType === 'przejscie' && p.active !== 0
    );
    const allTypes = [...new Set(przejsciaProducts.map((p) => p.category))].sort();

    // Utwórz nakładkę
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
                 data-action="togglePrzejsciaTypeVisibility" data-type="${t.replace(/'/g, "\\'")}"
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
                <button data-action="closePrzejsciaVisibilityPopup" data-container-id="${containerId || ''}" style="background:none; border:none; color:var(--text-muted); font-size:1.2rem; cursor:pointer; padding:0.2rem 0.4rem; border-radius:4px; transition:all 0.15s;"><i data-lucide="x"></i></button>
            </div>
            <div class="przejscia-vis-actions">
                <button class="przejscia-vis-action-btn" data-action="setPrzejsciaVisibilityAll" data-visible="true">Pokaż wszystkie</button>
                <button class="przejscia-vis-action-btn" data-action="setPrzejsciaVisibilityAll" data-visible="false">Ukryj wszystkie</button>
            </div>
            <div class="przejscia-vis-grid">
                ${tilesHtml}
            </div>
        </div>
    `;

    document.body.appendChild(overlay);

    // Zmierz najdłuższą nazwę kafelka i ustaw jednolitą szerokość kolumny
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    ctx.font = '700 0.85rem Inter, sans-serif';
    const maxTextWidth = Math.max(...allTypes.map((n) => ctx.measureText(n).width));
    const tileMinW = Math.ceil(maxTextWidth + 24); // +24 dla marginesu wewnętrznego
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

    // Aktualizuj tekst licznika
    const counterEl = overlay.querySelector('.przejscia-vis-counter');
    if (counterEl)
        counterEl.innerHTML = `Kliknij kafelek aby przełączyć widoczność. Widoczne: <strong style="color:var(--success);">${visibleCount}</strong> / ${allTypes.length}`;

    // Aktualizuj kazdy kafelek w miejscu
    const tiles = overlay.querySelectorAll('.przejscia-vis-tile');
    tiles.forEach((tile) => {
        const type = tile.getAttribute('title');
        const isVisible = visiblePrzejsciaTypes.has(type);
        tile.classList.toggle('visible', isVisible);
        tile.classList.toggle('hidden-type', !isVisible);
    });
}

/* ===== PRZECIĄGNIJ I UPUŚĆ DLA PRZEJŚĆ ===== */
let draggedPrzIndex = null;

window.handlePrzDragStart = function (e) {
    var target = /** @type {HTMLElement} */ (e.currentTarget);
    draggedPrzIndex = parseInt(target.getAttribute('data-prz-idx'));
    e.dataTransfer.effectAllowed = 'move';
    target.style.opacity = '0.4';
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
    var target = /** @type {HTMLElement} */ (e.currentTarget);
    target.style.opacity = '1';
    document.querySelectorAll('[data-prz-idx]').forEach((t) => (t.style.borderTop = ''));
    draggedPrzIndex = null;
};

if (typeof registerCspAction === 'function') {
    registerCspAction('cancelPrzejscieEdit', window.cancelPrzejscieEdit);
    registerCspAction('openPrzejsciaVisibilityPopup', {
        handler: function ({ containerId }) {
            openPrzejsciaVisibilityPopup(containerId);
        },
        params: ['containerId']
    });
    registerCspAction('inlineUpdateAngles', function (t) {
        window.inlineUpdateAngles(t.dataset.containerId);
    });
    registerCspAction('syncEditState', function () {
        window.syncEditState();
    });
    registerCspAction('editUpdateAngles', function (t) {
        editUpdateAngles(parseInt(t.dataset.index, 10));
        window.syncEditState();
    });

    // New CSP actions from migration
    registerCspAction('inlineSetType', {
        handler: function ({ type, containerId }) {
            window.inlineSetType(type, containerId);
        },
        params: ['type', 'containerId']
    });
    registerCspAction('inlineSetDN', {
        handler: function ({ dnId, containerId }) {
            window.inlineSetDN(dnId, containerId);
        },
        params: ['dnId', 'containerId']
    });
    registerCspAction('inlineFinish', {
        handler: function ({ contextId, containerId }) {
            window.inlineFinish(contextId, containerId);
        },
        params: ['contextId', 'containerId']
    });
    registerCspAction('saveQuickEdit', function (t) {
        const index = parseInt(t.dataset.index, 10);
        const field = t.dataset.field;
        const value = t.value;
        if (typeof window.saveQuickEdit === 'function') {
            window.saveQuickEdit(index, field, value);
        }
    });
    registerCspAction('editInlineSetType', {
        handler: function ({ type }) {
            window.editInlineSetType(type);
        },
        params: ['type']
    });
    registerCspAction('editInlineSetDN', {
        handler: function ({ dnId }) {
            window.editInlineSetDN(dnId);
        },
        params: ['dnId']
    });
    registerCspAction('savePrzejscieEdit', {
        handler: function ({ index }) {
            savePrzejscieEdit(parseInt(index, 10));
        },
        params: ['index']
    });
    registerCspAction('togglePrzejsciaTypeVisibility', {
        handler: function ({ type }) {
            togglePrzejsciaTypeVisibility(type);
        },
        params: ['type']
    });
    registerCspAction('closePrzejsciaVisibilityPopup', {
        handler: function ({ containerId }) {
            closePrzejsciaVisibilityPopup(containerId);
        },
        params: ['containerId']
    });
    registerCspAction('setPrzejsciaVisibilityAll', {
        handler: function ({ visible }) {
            setPrzejsciaVisibilityAll(visible === 'true');
        },
        params: ['visible']
    });
    registerCspAction('closeModal', {
        handler: function ({ modalId }) {
            const m = document.getElementById(modalId);
            if (m) m.style.display = 'none';
        },
        params: ['modalId']
    });
    registerCspAction('ignoreClick', function () {});
    registerCspAction('confirmChangePrzejscieType', {
        handler: function ({ index, type }) {
            window.confirmChangePrzejscieType(parseInt(index, 10), type);
        },
        params: ['index', 'type']
    });
    registerCspAction('confirmChangePrzejscieDn', {
        handler: function ({ index, productId }) {
            window.confirmChangePrzejscieDn(parseInt(index, 10), productId);
        },
        params: ['index', 'productId']
    });
}
/* CSP-safe: CSS hover replacement */
(function () {
    const s = document.createElement('style');
    s.textContent =
        '.przejscia-vis-btn:hover{background:rgba(99,102,241,0.2)!important;border-color:rgba(99,102,241,0.4)!important}';
    document.head.appendChild(s);
})();
