// @ts-check
/* ===== Główny moduł przejść ===== */

// Stały zbiór pól quick-edit (SSoT renderera transitionRenderer.js).
// `field` trafia do selektora i inline onblur — obce wartości odrzucane
// w buildInput (F1: brak zdalnego XSS, co najwyżej self-XSS przez devtools).
const QE_FIELD_ALLOWLIST = Object.freeze([
    'angle',
    'rzednaWlaczenia',
    'spadekKineta',
    'spadekMufa',
    'heightMm',
    'doplata'
]);

// Bezpieczne składanie selektora atrybutu (CSS.escape z fallbackiem).
function qeAttrEscape(s) {
    try {
        if (typeof CSS !== 'undefined' && CSS.escape) return CSS.escape(String(s));
    } catch (_e) {}
    return String(s).replace(/["\\]/g, '\\$&');
}

// Domknięcie lifecycle quick-edit przy zamykaniu modala PZ: zaległy zapis
// aplikuj synchronicznie do modelu (potem save/decyzja użytkownika i tak
// czyta wells albo odtwarza snapshot), timery i flagi wyczyść — callback
// nie może odpalić na zamkniętym DOM (F3).
function flushQePendingState() {
    try {
        if (typeof window.__pendingPrzejsciaApply === 'function') {
            window.__qeNoRender = true;
            window.__qeDeferHeavy = true;
            try {
                window.__pendingPrzejsciaApply();
            } finally {
                window.__qeNoRender = false;
                window.__qeDeferHeavy = false;
            }
            window.__pendingPrzejsciaApply = null;
        }
        if (window.__pendingPrzejsciaRefresh) {
            clearTimeout(window.__pendingPrzejsciaRefresh);
            window.__pendingPrzejsciaRefresh = null;
        }
        if (window.__qeHeavyTimer) {
            clearTimeout(window.__qeHeavyTimer);
            window.__qeHeavyTimer = null;
        }
        window.__qeNoRender = false;
        window.__qeDeferHeavy = false;
    } catch (_e) {}
}

window.flushQePendingState = flushQePendingState;

function renderInlinePrzejsciaApp(containerId) {
    const well = getCurrentWell();
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
        ? (typeof getPrzejsciaForCategory === 'function'
              ? getPrzejsciaForCategory(inlinePrzejsciaState.type)
              : studnieProducts.filter(
                    (p) =>
                        p.componentType === 'przejscie' &&
                        p.active !== 0 &&
                        p.category === inlinePrzejsciaState.type
                )
          )
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
        ? getStudnieProductById(inlinePrzejsciaState.dnId)
        : null;

    container.innerHTML = `
        <!-- Rodzaj kafelków - przewijalna siatka -->
        <div style="padding:0.4rem 0;">
            <div class="flex-space-between">
                <div style="font-size: 0.52rem; color:var(--text-muted); text-transform:uppercase; letter-spacing:0.35px; font-weight: var(--fw-semibold); opacity:0.9;">Rodzaj materiału</div>
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
                                    background:${isActive ? 'rgba(var(--accent-rgb), 0.2)' : 'var(--bg-secondary)'};
                                    border:1px solid ${isActive ? 'rgba(var(--accent-rgb), 0.5)' : 'var(--border)'};
                                    ${isActive ? 'box-shadow:0 0 8px rgba(var(--accent-rgb), 0.15);' : ''}"
                             onmouseenter="if(!${isActive})this.style.background='rgba(var(--accent-rgb), 0.1)';this.style.borderColor='rgba(var(--accent-rgb), 0.3)'"
                             onmouseleave="if(!${isActive})this.style.background='var(--bg-secondary)';this.style.borderColor='var(--border)'"
                             title="${escapeHtmlAttr(t)}">
                              <div class="${isActive ? 'color-accent' : ''}" style="font-size: var(--fs-xs); font-weight: var(--fw-bold); text-align:center; line-height:1.25; word-break:break-word; overflow-wrap:anywhere;">${escapeHtml(t)}</div>
                        </div>`;
                        })
                        .join('')}
                </div>
            </div>
        </div>

        <!-- Wybór DN -->
        <div style="padding:0.3rem 0;">
            <div style="font-size: 0.52rem; color:var(--text-muted); text-transform:uppercase; margin-bottom:0.3rem; letter-spacing:0.35px; font-weight: var(--fw-semibold); opacity:0.9;">Średnica (DN) — ${escapeHtml(inlinePrzejsciaState.type || '')}</div>
            <div class="grid-auto-120">
                ${dnList
                    .map((p) => {
                        const isActive = p.id === inlinePrzejsciaState.dnId;
                        const dnLabel =
                            typeof p.dn === 'string' && p.dn.includes('/') ? p.dn : 'DN ' + p.dn;
                        return `
                    <div class="fs-dn-tile ${isActive ? 'active' : ''}" 
                         style="padding:0.2rem 0.4rem; text-align:center; cursor:pointer; border-radius: var(--radius-sm); height:44px; display:flex; align-items:center; justify-content:center; transition:all 0.15s ease;
                                background:${isActive ? 'rgba(var(--accent-rgb), 0.2)' : 'var(--bg-secondary)'};
                                border:1px solid ${isActive ? 'rgba(var(--accent-rgb), 0.5)' : 'var(--border)'};
                                ${isActive ? 'box-shadow:0 0 10px rgba(var(--accent-rgb), 0.3);' : ''}"
                         onmouseenter="if(!${isActive}){this.style.background='rgba(var(--accent-rgb), 0.1)';this.style.borderColor='rgba(var(--accent-rgb), 0.3)'}"
                         onmouseleave="if(!${isActive}){this.style.background='var(--bg-secondary)';this.style.borderColor='var(--border)'}"
                         data-action="inlineSetDN" data-id="${escapeHtmlAttr(p.id)}" data-container="${escapeHtmlAttr(containerId || '')}">
                          <div class="${isActive ? 'color-accent' : ''}" style="font-size: var(--fs-xs); font-weight: var(--fw-extrabold); text-align:center; line-height:1.25; letter-spacing:0.3px; overflow-wrap:anywhere;">${dnLabel}</div>
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
                    <div class="wt-add-value wt-add-price">${fmt(selectedProduct.price)} PLN</div>
                </div>
            </div>
            <button class="btn btn-primary wt-add-btn" data-action="inlineFinish" data-main="${containerId || 'main'}" data-container="${containerId || ''}"><i data-lucide="plus"></i> Dodaj</button>
        </div>
        `
                : `
        <div style="text-align:center; padding:0.8rem; color:var(--text-muted); border:1px dashed var(--border); border-radius: var(--radius-sm); font-size: var(--fs-sm); margin-top:0.3rem;">
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

/**
 * Odświeża WSZYSTKIE widoczne listy przejść: konfigurator (well-przejscia-tiles)
 * oraz formularz zlecenia (zl-przejscia-list, z filtrem elementu).
 * Gołe renderWellPrzejscia() rysuje tylko konfigurator — w trybie zlecenia
 * edycja (ołówek / quick-edit) wyglądała na martwą. Używaj tego helpera
 * w każdym miejscu mutującym przejścia zamiast gołego renderWellPrzejscia().
 */
window.refreshPrzejsciaViews = function refreshPrzejsciaViews() {
    renderWellPrzejscia();
    if (typeof document === 'undefined' || !document.getElementById('zl-przejscia-list')) return;
    let elIdx = null;
    try {
        if (
            typeof zleceniaSelectedIdx !== 'undefined' &&
            typeof zleceniaElementsList !== 'undefined' &&
            zleceniaSelectedIdx >= 0 &&
            zleceniaElementsList[zleceniaSelectedIdx]
        ) {
            elIdx = zleceniaElementsList[zleceniaSelectedIdx].elementIndex;
        }
    } catch (_e) {
        elIdx = null;
    }
    if (elIdx === null || elIdx === undefined) return;
    renderWellPrzejscia({
        containerId: 'zl-przejscia-list',
        countElId: 'zl-przejscia-count',
        filterElementIndex: elIdx
    });
};

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

            // Jeśli inne pole jest w edycji, wymuś blur by zapisać — inaczej potrzebne 2 kliknięcia
            const _active = document.activeElement;
            let blurredInput = null;
            if (
                _active instanceof HTMLElement &&
                _active.tagName === 'INPUT' &&
                _active.closest('[data-qe-id]')
            ) {
                const _parent = _active.closest('[data-qe-id]');
                if (_parent && _parent !== element) {
                    blurredInput = _active;
                    _active.blur();
                }
            }

            // Kontener zapamiętaj NA WEJŚCIU: po przerwie asynchronicznej
            // (gałąź pending) element może być odłączony, a closest() na
            // martwym drzewie myli — input lądowałby w ukrytym konfiguratorze
            // zamiast w liście PZ (E2E: wieczny 2-klik mimo fokusu).
            const entryContainerId = element.closest('#zl-przejscia-list')
                ? 'zl-przejscia-list'
                : 'well-przejscia-tiles';

            // Tworzenie inputa po rozliczeniu ASYNC refresha modala PZ.
            // populateZleceniaForm (await fetch) ląduje PO utworzeniu inputa
            // i go niszczy — stąd konieczność 2. kliknięcia. Czekamy, aż
            // modal się rozliczy, i dopiero wtedy wstawiamy input.
            const rebuildInput = () => {
                const containerId = entryContainerId;

                if (typeof window.refreshPrzejsciaViews === 'function')
                    window.refreshPrzejsciaViews();
                else renderWellPrzejscia();

                const newList = document.getElementById(containerId);
                if (newList) {
                    const stableId = element.getAttribute('data-qe-id');
                    const newEl = newList.querySelector(
                        `[data-qe-id="${qeAttrEscape(stableId)}"][data-qe-field="${qeAttrEscape(field)}"]`
                    );
                    if (newEl) element = newEl;
                }
                // Re-sort (well.przejscia mutowane przy renderze) unieważnia
                // indeks policzony przed zapisem — przelicz po stabilnym id,
                // inaczej wartość czytamy ze złego wiersza (2. klik).
                if (typeof resolvePrzejscieIndex === 'function') {
                    const _w = typeof getCurrentWell === 'function' ? getCurrentWell() : null;
                    index = resolvePrzejscieIndex(_w, element, index);
                }
                // Komórka wypadła z DOM (np. filtr) — nie wstawiaj w próżnię.
                if (!element.isConnected) {
                    return;
                }
                // Zachowaj fokus nowszego pola, jeśli użytkownik zdążył
                // przejść dalej podczas odświeżenia.
                // Odłączony activeElement (stary input zniszczony refreshem
                // powyżej — przeglądarka trzyma go do async blur) to NIE
                // nowsze pole, tylko martwy node (E2E: brak focusin nowego).
                const _ae = document.activeElement;
                if (
                    _ae &&
                    _ae.tagName === 'INPUT' &&
                    _ae.isConnected !== false &&
                    _ae.closest('[data-qe-id]') &&
                    _ae !== blurredInput &&
                    !element.contains(_ae)
                ) {
                    return;
                }
                // Spóźniony rebuild (drugi klik utworzył input synchronicznie):
                // nie nadpisuj wpisywanego tekstu pustym inputem.
                if (element.querySelector('input')) {
                    return;
                }
                buildInput();
            };

            // Anuluj wszelkie oczekujące odświeżania po utracie fokusu (blur) przez inne pole
            if (window.__pendingPrzejsciaRefresh) {
                clearTimeout(window.__pendingPrzejsciaRefresh);
                window.__pendingPrzejsciaRefresh = null;

                // Natychmiast zapisz oczekujące zmiany — w trybie cichym:
                // pełny refresh (zwłaszcza async populate modala PZ z fetchem)
                // lądowałby PO wstawieniu nowego inputa i go niszczył (2-klik).
                // Pełne odświeżenie nastąpi przy wyjściu z edycji; ciężkie
                // rendery nadrobi scheduleQeHeavyRefresh poza taskiem clicka.
                // BEZ stempla qeApplied na activeElement: stempel lądowałby
                // na przypadkowym aktualnie sfokusowanym inpucie (F4 — późniejszy
                // blur NOWEGO pola byłby cicho pomijany = utrata edycji).
                // Ponowny blur starego pola i tak trafia w cichą ścieżkę
                // (isQeInputFocused), a zapis jest idempotentny.
                if (typeof window.__pendingPrzejsciaApply === 'function') {
                    runQeSilent(window.__pendingPrzejsciaApply);
                    window.__pendingPrzejsciaApply = null;
                }

                // Input twórz SYNCHRONICZNIE w tym samym tasku clicka:
                // async kreacja lądowała już po mouseup/click i przeglądarka
                // kradła fokus 1–2 ms po focusin albo konkurencyjny rebuild
                // niszczył świeży input (E2E focus-log). rebuildInput robi
                // własny sync refresh listy, więc await light jest zbędny.
                rebuildInput();
                return;
            }

            // function (nie const): hoisting — gałąź pending woła rebuildInput
            // po wcześniejszym return, definicja musi istnieć zawczasu (TDZ).
            function buildInput() {
                if (!QE_FIELD_ALLOWLIST.includes(field)) return;
                const well = getCurrentWell();
                if (!well || !well.przejscia || !well.przejscia[index]) {
                    return;
                }

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
                // type=number nie pozwala niezawodnie zaznaczyć wartości po
                // focus() w Chromium. Pole tekstowe z klawiaturą numeryczną
                // zachowuje edycję obliczeń i daje przewidywalny wybór tekstu
                // po pierwszym kliknięciu, także przy szybkim przejściu między polami.
                const inpType = 'text';
                const inpMode = ' inputmode="decimal"';

                element.innerHTML = `<input type="${inpType}"${inpMode} step="${step}" placeholder="${escapeHtmlAttr(String(val))}" value="${escapeHtmlAttr(String(val))}" style="width:100%; min-width:0; max-width:100%; height:30px; margin:0; box-sizing:border-box; background: var(--bg-tertiary); color: var(--text-primary); border:1px solid var(--accent); border-radius: var(--radius-xs); font-size: var(--fs-base); font-weight: var(--fw-bold); text-align:center; padding:0 0.25rem; outline:none;" onclick="this.select()" onfocus="this.select()" onblur="window.saveQuickEdit(${index}, '${field}', this.value, this)" onkeydown="if(event.key==='Enter') this.blur();">`;
                const inp = element.querySelector('input');
                inp.focus();
                try {
                    inp.select();
                } catch {}
                // dla type=number select() bywa blokowany — fallback: timeout
                setTimeout(() => {
                    try {
                        if (document.activeElement === inp) inp.select();
                    } catch {}
                }, 0);
            }
            rebuildInput();
        };

        window.__pendingPrzejsciaRefresh = null;
        // Fokus w DOWOLNYM polu quick-edit (ta sama lub inna komórka):
        // zapis ma być synchroniczny i cichy (bez renderów niszczących input).
        // Ta sama komórka też: klik z powrotem we własne pole przy uzbrojonym
        // timerze nie może go detonować pełnym refreshem w trakcie pisania.
        function isQeInputFocused() {
            try {
                if (typeof document === 'undefined') return false;
                const ae = document.activeElement;
                if (!ae || ae.tagName !== 'INPUT' || !ae.closest) return false;
                return !!ae.closest('[data-qe-id]');
            } catch (_e) {
                return false;
            }
        }
        // Ciężkie rendery (diagram/summary/config) PO rozliczeniu clicka.
        // W tasku clicka wolno ruszać tylko listę: podmiana geometrii modala
        // psuje hit-test domyślnej akcji fokusu przeglądarki (E2E: focusout
        // 1–2 ms po focusin). Odpalane tylko gdy fokus dalej w polu QE —
        // inaczej i tak leci pełny refresh ścieżki wyjścia. Koalescencja
        // przez __qeHeavyTimer (szybki hopping pól = jeden przebieg).
        function scheduleQeHeavyRefresh() {
            try {
                if (typeof setTimeout === 'undefined') return;
                if (window.__qeHeavyTimer) clearTimeout(window.__qeHeavyTimer);
                window.__qeHeavyTimer = setTimeout(() => {
                    window.__qeHeavyTimer = null;
                    try {
                        if (typeof document === 'undefined') return;
                        const ae = document.activeElement;
                        if (!ae || ae.tagName !== 'INPUT' || !ae.closest) return;
                        if (!ae.closest('[data-qe-id]')) return;
                        renderWellDiagram();
                        updateSummary();
                        if (typeof renderWellConfig === 'function') renderWellConfig();
                        if (typeof renderWellParams === 'function') renderWellParams();
                    } catch (_e) {}
                }, 0);
            } catch (_e) {}
        }
        // Cichy zapis: bez refresha listy/modala i bez ciężkich renderów
        // w tasku. Ciężkie rendery nadrabia scheduleQeHeavyRefresh poza
        // taskiem clicka. Flagi zawsze sprzątane w finally (brak wycieku
        // trybu cichego przy wyjątku z apply).
        function runQeSilent(applyFn) {
            window.__qeNoRender = true;
            window.__qeDeferHeavy = true;
            try {
                applyFn();
            } finally {
                window.__qeNoRender = false;
                window.__qeDeferHeavy = false;
            }
            scheduleQeHeavyRefresh();
        }
        window.saveQuickEdit = function (index, field, value, inputEl) {
            if (isWellLocked()) {
                showToast(WELL_LOCKED_MSG, 'error');
                return;
            }
            if (isOfferLocked()) {
                showToast(OFFER_LOCKED_MSG, 'error');
                return;
            }
            const well = getCurrentWell();
            // Blur niesie indeks sprzed ewentualnego re-sortu (mutacja
            // well.przejscia przy renderze) — przelicz po stabilnym id,
            // inaczej zapis trafi w zły wiersz.
            if (inputEl && inputEl.closest && typeof resolvePrzejscieIndex === 'function') {
                const _cell = inputEl.closest('[data-qe-id]');
                if (_cell) index = resolvePrzejscieIndex(well, _cell, index);
            }
            if (!well || !well.przejscia || !well.przejscia[index]) return;

            const applyChanges = () => {
                // Recheck locka w momencie WYKONANIA (nie uzbrojenia): timer
                // 100 ms / pending mógł przeczekać akceptację PZ lub lock
                // oferty — zapis po locku nadpisałby zatwierdzony stan (F2).
                if (isWellLocked()) return;
                if (isOfferLocked()) return;
                if (value.trim() === '') {
                    if (!window.__qeNoRender) {
                        if (typeof window.refreshPrzejsciaViews === 'function')
                            window.refreshPrzejsciaViews();
                        else renderWellPrzejscia();
                        if (typeof window.refreshZleceniaModalIfActive === 'function') {
                            window.refreshZleceniaModalIfActive();
                        }
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
                        if (
                            typeof clampRzednaWlaczenia === 'function' &&
                            typeof announceRzednaClamp === 'function'
                        ) {
                            const _c = clampRzednaWlaczenia(numVal, well);
                            announceRzednaClamp(_c);
                            numVal = _c.value;
                        } else if (typeof clampRzednaWlaczenia === 'function') {
                            const _c = clampRzednaWlaczenia(numVal, well);
                            if (_c.clampedLow)
                                showToast('Rzędna nie może być niższa niż rzędna dna!', 'error');
                            if (_c.clampedHigh)
                                showToast('Rzędna nie może być wyższa niż rzędna włazu!', 'error');
                            numVal = _c.value;
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
                        typeof getStudnieProductById === 'function'
                            ? getStudnieProductById(id)
                            : studnieProducts.find((p) => p.id === id)
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

                // Listę + modal PZ pomijaj w trakcie przełączania pól
                // (__qeNoRender): ich rebuild niszczyłby świeży input (PZ 2-klik).
                if (!window.__qeNoRender) {
                    if (typeof window.refreshPrzejsciaViews === 'function')
                        window.refreshPrzejsciaViews();
                    else renderWellPrzejscia();
                }
                // Ciężkie rendery pomijaj też, gdy odroczone (__qeDeferHeavy):
                // w tasku clicka przesuwają geometrię i psują domyślny fokus
                // (E2E) — nadrobi je scheduleQeHeavyRefresh po rozliczeniu clicka.
                // Diagram/podsumowanie renderują inne kontenery — bezpieczne async.
                if (!window.__qeDeferHeavy) {
                    renderWellDiagram();
                    updateSummary();
                    if (typeof renderWellConfig === 'function') renderWellConfig();
                    if (typeof renderWellParams === 'function') renderWellParams();
                }
                if (!window.__qeNoRender) {
                    if (typeof window.refreshZleceniaModalIfActive === 'function') {
                        window.refreshZleceniaModalIfActive();
                    }
                }
            };

            // Ujmij krótkie opóźnienie do odświeżenia, aby pozwolić na wcześniejsze wywołanie kliknięcia na następnym elemencie.
            // Przestarzały zapis aplikuj po cichu (flagi jak wyżej) — pełny
            // refresh należy do świeżego timera planowanego poniżej albo do
            // ścieżki switcha; inaczej async populate PZ niszczy nowy input.
            if (window.__pendingPrzejsciaRefresh) {
                clearTimeout(window.__pendingPrzejsciaRefresh);
                if (typeof window.__pendingPrzejsciaApply === 'function') {
                    runQeSilent(window.__pendingPrzejsciaApply);
                }
            }
            // Przełączanie pól: zapisz synchronicznie bez renderów; pełny
            // refresh nastąpi przy wyjściu z edycji (blur poza pola QE),
            // a ciężkie rendery — w scheduleQeHeavyRefresh po rozliczeniu clicka.
            if (isQeInputFocused()) {
                runQeSilent(applyChanges);
                window.__pendingPrzejsciaRefresh = null;
                window.__pendingPrzejsciaApply = null;
                return;
            }
            window.__pendingPrzejsciaApply = applyChanges;
            window.__pendingPrzejsciaRefresh = setTimeout(() => {
                // Spóźniony timer, a fokus jest już w polu QE (przebudowa
                // zniszczyła stary input i powstał nowy) — zapisz po cichu.
                if (isQeInputFocused()) {
                    runQeSilent(applyChanges);
                    window.__pendingPrzejsciaRefresh = null;
                    window.__pendingPrzejsciaApply = null;
                    return;
                }
                applyChanges();
                window.__pendingPrzejsciaRefresh = null;
                window.__pendingPrzejsciaApply = null;
            }, 100);
        };
    }

    if (!container) return;

    // Stabilne id przejść — backfill dla danych legacy (idempotentny).
    if (typeof ensurePrzejsciaIds === 'function' && well && Array.isArray(well.przejscia)) {
        ensurePrzejsciaIds(well.przejscia);
    }

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
        const findProdCheck = (id) =>
            typeof getStudnieProductById === 'function'
                ? getStudnieProductById(id)
                : studnieProducts.find((pr) => pr.id === id);
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
    const findProduct = (id) =>
        typeof getStudnieProductById === 'function'
            ? getStudnieProductById(id)
            : studnieProducts.find((pr) => pr.id === id);
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

    // Przebuduj tablicę przejść w posortowanej kolejności – pomijaj gdy Excel otwarty (mutacja psuje indeksy kolumn wklejania)
    const _isExcelOpen =
        typeof document !== 'undefined' && !!document.getElementById('excel-table-overlay');
    const _isPaste = typeof _excelPasteInProgress !== 'undefined' && _excelPasteInProgress;
    const _sortedPrzejscia = sorted.map((s) => s.item);
    // Mutuj źródło tylko poza Excelem – w Excelu kolejność kolumn = indeks, nie sort
    if (!_isExcelOpen && !_isPaste) {
        well.przejscia = _sortedPrzejscia;
    }

    let totalPrice = 0;
    let html =
        '<div style="display:flex; flex-direction:column; gap:0.4rem; overflow:visible; max-width:100%;">';

    let prevAssignedIndex = -999;
    let filteredCount = 0;

    // Główny widok: filtr pustych przejść (Opcja A) — nie renderuj i nie licz
    const _srcList = _isExcelOpen || _isPaste ? _sortedPrzejscia : well.przejscia;
    const _visiblePrzejscia =
        typeof isEmptyPrzejscie === 'function'
            ? _srcList.filter((p) => !isEmptyPrzejscie(p))
            : _srcList;
    // Nadaj displayIndex przejściom, które go nie mają (kompatybilność wsteczna)
    ensureDisplayIndices(_visiblePrzejscia);

    _visiblePrzejscia.forEach((item, index) => {
        // Globalny indeks w well.przejscia — NIE filtrowany. Przy filtrze elementu
        // (zlecenia) indeks filtrowany ≠ globalny i edycja trafiała w złe przejście.
        // data-i / data-index / editPrzejscieIdx zawsze globalne; data-prz-id jako SSoT.
        let globalIndex = well.przejscia.indexOf(item);
        if (globalIndex === -1) globalIndex = _srcList.indexOf(item);
        if (globalIndex === -1) globalIndex = index;
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
            if (globalIndex > 0) html += '<div style="height:0.5rem;"></div>';
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

        // Tryb edycji dla tego kafelka (globalIndex — stabilny przy filtrze elementu).
        // editPrzejscieId przeżywa re-sort well.przejscia; indeks jest healowany.
        let isEditingThis = editPrzejscieIdx === globalIndex;
        try {
            if (typeof editPrzejscieId !== 'undefined' && editPrzejscieId) {
                isEditingThis = item.id === editPrzejscieId;
                if (isEditingThis && editPrzejscieIdx !== globalIndex) {
                    editPrzejscieIdx = globalIndex;
                }
            }
        } catch (_e) {}
        if (isEditingThis) {
            const typeName = p ? p.category : '—';
            const allTypes =
                typeof getPrzejsciaCategories === 'function'
                    ? getPrzejsciaCategories()
                    : [
                          ...new Set(
                              studnieProducts
                                  .filter(
                                      (pr) => pr.componentType === 'przejscie' && pr.active !== 0
                                  )
                                  .map((pr) => pr.category)
                          )
                      ].sort();

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
            const baseForType =
                typeof getPrzejsciaForCategory === 'function' && editPrzejscieState.type
                    ? getPrzejsciaForCategory(editPrzejscieState.type)
                    : studnieProducts.filter(
                          (pr) =>
                              pr.componentType === 'przejscie' &&
                              pr.active !== 0 &&
                              pr.category === editPrzejscieState.type
                      );
            const currentItemProd = getStudnieProductById(item.productId);
            const currentTypeDNs = (
                currentItemProd && currentItemProd.category !== editPrzejscieState.type
                    ? [...baseForType, currentItemProd]
                    : [...baseForType]
            )
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

            html += `<div class="wt-edit-panel">
              <div class="wt-edit-head">
                <div class="flex-gap-4">
                  <span class="wt-edit-index">${globalIndex + 1}</span>
                  <span class="wt-edit-title">Edycja wariantu</span>
                </div>
                <button type="button" class="btn-icon" data-action="cancelPrzejscieEdit" aria-label="Zamknij"><i data-lucide="x" aria-hidden="true"></i></button>
              </div>

              <div class="wt-edit-section-label">Kategoria przejścia</div>
              <div class="wt-edit-grid">
                ${allTypes
                    .map((t) => {
                        const isActive = t === editPrzejscieState.type;
                        return `<button type="button" data-action="editInlineSetType" data-t="${escapeJsStr(t)}" class="wt-edit-tile ${isActive ? 'is-active' : ''}" aria-pressed="${isActive ? 'true' : 'false'}" title="${escapeHtmlAttr(t)}">${escapeHtml(t)}</button>`;
                    })
                    .join('')}
              </div>

              <div class="wt-edit-section-label">Średnica (DN)</div>
              <div class="wt-edit-grid">
                ${currentTypeDNs
                    .map((pr) => {
                        const isActive = pr.id === editPrzejscieState.dnId;
                        const dnLbl =
                            typeof pr.dn === 'string' && pr.dn.includes('/') ? pr.dn : 'DN' + pr.dn;
                        return `<button type="button" data-action="editInlineSetDN" data-id="${escapeJsStr(pr.id)}" class="wt-edit-tile wt-edit-tile--dn ${isActive ? 'is-active' : ''}" aria-pressed="${isActive ? 'true' : 'false'}">${escapeHtml(dnLbl)}</button>`;
                    })
                    .join('')}
              </div>

              <div class="wt-edit-form">
                <div class="form-group m-0">
                  <label class="fs-3xs-muted-block" for="edit-rzedna-${globalIndex}">Rzędna [m]</label>
                  <input type="text" inputmode="decimal" class="form-input fs-base-rc" id="edit-rzedna-${globalIndex}" step="0.001" value="${editPrzejscieState.rzedna}" placeholder="142.500" onchange="window.syncEditState()" onkeydown="if(event.key==='Enter') this.blur();">
                </div>
                <div class="form-group m-0">
                  <label class="fs-3xs-muted-block" for="edit-angle-${globalIndex}">Kąt [°]</label>
                  <input type="number" class="form-input color-link fs-base-rc" id="edit-angle-${globalIndex}" value="${editPrzejscieState.angle}" min="0" max="360" oninput="editUpdateAngles(${globalIndex}); window.syncEditState()" onkeydown="if(event.key==='Enter') this.blur();">
                </div>
                <div class="form-group m-0">
                  <label class="fs-3xs-muted-block" for="edit-spadek-kineta-${globalIndex}">Spadek w kinecie [%]</label>
                  <input type="number" class="form-input fs-base-rc" id="edit-spadek-kineta-${globalIndex}" step="1" value="${editPrzejscieState.spadekKineta}" onchange="window.syncEditState()" onkeydown="if(event.key==='Enter') this.blur();">
                </div>
                <div class="form-group m-0">
                  <label class="fs-3xs-muted-block" for="edit-spadek-mufa-${globalIndex}">Spadek w mufie [%]</label>
                  <input type="number" class="form-input fs-base-rc" id="edit-spadek-mufa-${globalIndex}" step="1" value="${editPrzejscieState.spadekMufa}" onchange="window.syncEditState()" onkeydown="if(event.key==='Enter') this.blur();">
                </div>
              </div>

              <div class="wt-edit-footer">
                <div class="wt-edit-meta">
                  <span>Wyk: <strong id="edit-exec-${globalIndex}" class="text-primary">${execAngle}°</strong></span>
                  <span>Gony: <strong id="edit-gony-${globalIndex}" class="color-success">${gons}<sup>g</sup></strong></span>
                </div>
                <div class="wt-edit-actions">
                  <button type="button" class="btn btn-secondary btn-sm" data-action="cancelPrzejscieEdit">Anuluj</button>
                  <button type="button" data-action="savePrzejscieEdit" data-index="${globalIndex}" data-prz-id="${escapeHtmlAttr(item.id || '')}" class="btn btn-primary btn-sm"><i data-lucide="save" aria-hidden="true"></i> Zapisz</button>
                </div>
              </div>
            </div>`;
            return;
        }

        // Uzyj wspolnego renderera kafelkow przejsc (globalIndex — stabilny przy filtrze)
        html += renderTransitionTileHTML(item, globalIndex, p, {
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

    // Pasek podsumowania — licz tylko niepuste (Opcja A)
    const _totalCount =
        typeof isEmptyPrzejscie === 'function' ? _visiblePrzejscia.length : well.przejscia.length;
    const countLabel =
        filterElementIndex != null
            ? `Przejścia tego elementu (${filteredCount} szt.)`
            : `Suma wszystkich przejść bez dopłat (${_totalCount} szt.)`;
    html += `<div style="display:flex; justify-content:space-between; align-items:center; margin-top:0.6rem; padding:0.4rem 0.6rem; background:rgba(var(--accent-rgb), 0.1); border-radius: var(--radius-sm); border:1px solid rgba(var(--accent-rgb), 0.2);">
      <span style="font-size: var(--fs-sm); color:var(--text-muted); font-weight: var(--fw-semibold);">${countLabel}</span>
      <span style="font-size: var(--fs-lg); font-weight: var(--fw-extrabold); color:var(--success);">${fmt(totalPrice)} PLN</span>
    </div>`;

    container.innerHTML = html;
    if (window.lucide && window.lucide.createIcons) {
        window.lucide.createIcons();
    }
    if (countEl)
        countEl.textContent = `(${filterElementIndex != null ? filteredCount : _totalCount})`;
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

        if (typeof window.refreshPrzejsciaViews === 'function') window.refreshPrzejsciaViews();
        else renderWellPrzejscia();
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
            const well = typeof getCurrentWell === 'function' ? getCurrentWell() : null;
            const rIdx =
                typeof resolvePrzejscieIndex === 'function'
                    ? resolvePrzejscieIndex(well, el, parseInt(index, 10))
                    : parseInt(index, 10);
            window.savePrzejscieEdit(rIdx);
        } else if (action === 'editInlineSetType') {
            window.editInlineSetType(t);
        } else if (action === 'editInlineSetDN') {
            window.editInlineSetDN(id);
        }
    });
}

/* ===== Rejestracja globali ===== */
window.renderInlinePrzejsciaApp = renderInlinePrzejsciaApp;
