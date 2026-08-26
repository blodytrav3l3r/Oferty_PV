// @ts-check
/**
 * transitionRenderer.js
 *
 * Zunifikowany renderer dla kafelków przejść.
 * Używany zarówno przez konfigurator (autoSelect.js), jak i okno zamówienia (orderManager.js).
 *
 * Ten moduł generuje HTML dla pojedynczego wiersza przejścia. Oba konteksty wywołują go
 * z tym samym kształtem danych (`item`, `globalIndex`, `options`) i otrzymują
 * spójny wynik wizualny.
 */

// ──────────────────────────────────────
// Pomocnicy
// ──────────────────────────────────────

function getFlowVisuals(flowType) {
    const isWylot = flowType === FLOW_TYPES.WYLOT;
    return {
        label: isWylot ? 'Wylot' : 'Wlot',
        bg: isWylot ? 'rgba(var(--danger-rgb), 0.2)' : 'rgba(var(--blue-rgb), 0.2)',
        color: isWylot ? 'var(--danger-hover)' : 'var(--blue-hover)',
        border: isWylot ? 'rgba(var(--danger-rgb), 0.8)' : 'rgba(var(--blue-rgb), 0.8)',
        icon: isWylot ? '<i data-lucide="upload"></i>' : '<i data-lucide="download"></i>'
    };
}

function escapeHtmlAttr(str) {
    if (typeof window.escapeHtmlAttr === 'function' && window.escapeHtmlAttr !== escapeHtmlAttr) {
        return window.escapeHtmlAttr(str);
    }
    return escapeHtml(str).replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

function getAngleColor(angle) {
    return angle === 0 || angle === '0' ? 'var(--accent)' : 'var(--accent-hover)';
}

function calcExecutionAngle(angle) {
    return angle === 0 || angle === 360 ? 0 : 360 - angle;
}

function calcGonyAngle(angle) {
    return (angle === 0 || angle === 360 ? 0 : ((360 - angle) * 400) / 360).toFixed(2);
}

function getClockIndex(item, opts) {
    if (item.displayIndex !== undefined && item.displayIndex !== null) {
        return item.displayIndex;
    }
    let w = opts.well;
    if (!w && typeof window.getCurrentWell === 'function') {
        w = window.getCurrentWell();
    }
    if (!w || !w.przejscia) return '';

    const sorted = [...w.przejscia].sort((a, b) => {
        return (parseFloat(a.angle) || 0) - (parseFloat(b.angle) || 0);
    });
    const idx = sorted.indexOf(item);
    return idx >= 0 ? idx + 1 : '';
}

// ──────────────────────────────────────
// Klasyfikacja flowType
// ──────────────────────────────────────

function classifyFlowType(item, globalIndex) {
    if (!item.flowTypeManual) {
        item.flowType = item.angle === 0 || item.angle === '0' ? FLOW_TYPES.WYLOT : FLOW_TYPES.WLOT;
    }
    if (!item.flowType) {
        item.flowType =
            globalIndex === 0 && (item.angle === 0 || item.angle === '0')
                ? FLOW_TYPES.WYLOT
                : FLOW_TYPES.WLOT;
    }
}

// ──────────────────────────────────────
// Główny renderer kafelków
// ──────────────────────────────────────

/**
 * Generuje HTML dla pojedynczego wiersza kafelka przejścia.
 *
 * @param {Object}  item         - Obiekt przejścia z well.przejscia[].
 * @param {number}  globalIndex  - Indeks przejścia w well.przejscia.
 * @param {Object}  product      - Wpis z studnieProducts dla item.productId.
 * @param {Object}  opts         - Opcje renderowania.
 * @param {number}  [opts.heightMm]      - Wysokość od dna elementu w mm.
 * @param {boolean} [opts.showDeleteBtn] - Czy pokazać przycisk usuwania (true w konfiguratorze).
 * @param {boolean} [opts.showEditBtn]   - Czy pokazać przycisk edycji (true w konfiguratorze).
 * @param {boolean} [opts.showPrice]     - Czy pokazać kolumnę ceny (true w konfiguratorze).
 * @param {string}  [opts.spadekKinetaLabel] - Etykieta dla "Spadek w kinecie".
 * @param {string}  [opts.spadekMufaLabel]   - Etykieta dla "Spadek w mufie".
 * @param {boolean} [opts.enableDragDrop]    - Czy dodać uchwyty do przeciągania (true w konfiguratorze).
 * @param {number}  [opts.assignedCfgIndex]  - Indeks konfiguracji do podświetlenia SVG (jeśli dostępny).
 * @param {number}  [opts.drillingBasePrice=0] - Cena bazowa wiercenia.
 * @param {Object}  [opts.drillingProd]        - Produkt wiercenia (opcjonalnie).
 * @param {Object}  [opts.well]                - Obiekt studni (opcjonalnie).
 * @returns {string} Ciąg HTML.
 */
function renderTransitionTileHTML(item, globalIndex, product, opts = {}) {
    const przName = product ? product.category : '—';
    const dn = product ? product.dn : '—';
    const price = product ? product.price : 0;

    classifyFlowType(item, globalIndex);

    const flow = getFlowVisuals(item.flowType);
    const angleColor = getAngleColor(item.angle);
    const heightMm = opts.heightMm != null ? opts.heightMm : 0;

    const spadekKLabel = opts.spadekKinetaLabel || 'Spadek w kinecie';
    const spadekMLabel = opts.spadekMufaLabel || 'Spadek w mufie';

    const showEdit = opts.showEditBtn !== false;
    const showDelete = opts.showDeleteBtn !== false;
    const showPrice = opts.showPrice !== false;
    const enableDrag = opts.enableDragDrop === true;

    const dragAttrs = enableDrag
        ? `data-prz-idx="${globalIndex}" draggable="true" ondragstart="handlePrzDragStart(event)" ondragover="handlePrzDragOver(event)" ondrop="handlePrzDrop(event)" ondragend="handlePrzDragEnd(event)"`
        : '';
    const cursorStyle = enableDrag ? 'cursor:grab;' : '';

    const assignedCfgIdx = opts.assignedCfgIndex != null ? opts.assignedCfgIndex : -1;
    const highlightAttrs =
        enableDrag && assignedCfgIdx >= 0
            ? `onmouseenter="this.style.filter='brightness(1.1)'; window.highlightSvg('prz', ${globalIndex}); window.highlightSvg('cfg', ${assignedCfgIdx});" onmouseleave="this.style.filter='brightness(1)'; window.unhighlightSvg('prz', ${globalIndex}); window.unhighlightSvg('cfg', ${assignedCfgIdx});"`
            : '';

    const dnLabel = typeof dn === 'string' && dn.includes('/') ? dn : 'DN ' + dn;

    // Kolumna akcji — ikony jedna pod drugą, kompaktowe by wykorzystać szerokość
    let actionsHTML = '';
    if (showEdit || showDelete) {
        actionsHTML = `<div class="prz-actions-col">`;
        if (showEdit) {
            actionsHTML += `<button data-action="editPrzejscie" data-i="${globalIndex}" title="Edytuj" class="prz-btn-edit"><i data-lucide="pencil"></i></button>`;
        }
        if (showDelete) {
            actionsHTML += `<button data-action="removePrzejscieFromWell" data-i="${globalIndex}" title="Usuń" class="prz-btn-delete"><i data-lucide="x"></i></button>`;
        }
        actionsHTML += `</div>`;
    }

    let priceSubInfo = '';
    if (opts.drillingBasePrice > 0 && opts.drillingProd) {
        priceSubInfo = `<div class="prz-drill-info" title="${escapeHtmlAttr(opts.drillingProd.name)}">+ Wiercenie: ${typeof fmt === 'function' ? fmt(opts.drillingBasePrice) : opts.drillingBasePrice} PLN</div>`;
    }

    const priceStr = typeof fmt === 'function' ? fmt(price) : String(price);
    const priceFont = priceStr.replace(/[^0-9]/g, '').length >= 6 ? 'var(--fs-md)' : 'var(--fs-lg)';
    const priceHTML = showPrice
        ? `<div class="prz-col prz-col--price">
             <div class="prz-col-header ellipsis-center">Cena</div>
             <div class="prz-col-body" style="flex-direction:column; justify-content:center; align-items:center; min-width:0;">
               <div style="font-size: ${priceFont}; font-weight: var(--fw-extrabold); color:var(--success); font-family:'Inter'; padding:0 0.15rem; line-height:1.1; text-align:center; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; max-width:100%; font-variant-numeric:tabular-nums; display:inline-flex; align-items:center; justify-content:center; gap:0.2rem;" title="${escapeHtmlAttr(priceStr)} PLN"><span>${priceStr}</span><span class="fs-2xs">PLN</span></div>
               ${priceSubInfo}
             </div>
           </div>`
        : '';

    // Kolumna dopłata (non-discountable)
    const doplataVal = item.doplata != null ? item.doplata : 0;
    const doplataStr = typeof fmt === 'function' ? fmt(doplataVal) : String(doplataVal);
    const doplataFont =
        doplataStr.replace(/[^0-9]/g, '').length >= 6 ? 'var(--fs-md)' : 'var(--fs-lg)';
    const doplataColor =
        doplataVal > 0 ? 'var(--success)' : doplataVal < 0 ? 'var(--danger)' : 'var(--warn-hover)';
    const doplataHTML = showPrice
        ? `<div class="prz-col prz-col--price" title="Pole nie rabatowane">
             <div class="prz-col-header ellipsis-center">Dopłata</div>
             <div class="prz-col-body" style="justify-content:center; align-items:center; min-width:0;">
               <div data-qe-id="${escapeHtmlAttr(item.id)}" data-qe-field="doplata" data-action="activateQuickEdit" data-i="${globalIndex}" data-field="doplata" class="prz-field-doplata" style="font-size: ${doplataFont}; font-weight: var(--fw-extrabold); color:${doplataColor}; font-family:'Inter'; text-align:center; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; max-width:100%; font-variant-numeric:tabular-nums; display:inline-flex; align-items:center; justify-content:center; gap:0.2rem;" title="${escapeHtmlAttr(doplataStr)} PLN"><span>${doplataStr}</span><span class="fs-2xs">PLN</span></div>
             </div>
           </div>`
        : '';

    // Zapewnij stabilny identyfikator dla QE (Quick Edit)
    if (!item.id) item.id = 'prz-legacy-' + globalIndex + '-' + Math.floor(Math.random() * 1000);

    const clockIdx = getClockIndex(item, opts);
    const numDisplay =
        clockIdx !== '' && clockIdx !== undefined
            ? `<div title="Oznaczenie zegarowe" style="position:absolute; top:-6px; right:-6px; background:var(--slate-800); border:1px solid ${flow.border}; border-radius:50%; width:18px; height:18px; display:flex; align-items:center; justify-content:center; font-size: var(--fs-2xs); font-weight: var(--fw-extrabold); color:${flow.color}; box-shadow:0 1px 3px rgba(var(--black-rgb), 0.5);">${clockIdx}</div>`
            : '';

    const extraPadding = opts.drillingBasePrice > 0 && opts.drillingProd ? '0.75rem' : '0.35rem';
    return `<div ${dragAttrs} class="prz-tile" style="border-left-color:${flow.border}; padding-bottom:${extraPadding}; ${cursorStyle}" ${highlightAttrs}>
       <!-- FLOW TYPE BUTTON -->
      <button data-action="openFlowTypePopup" data-i="${globalIndex}" title="Kliknij by zmienić na Wlot/Wylot" style="position:relative; background:${flow.bg}; color:${flow.color}; border:1px solid ${flow.border}; border-radius: var(--radius-2xs); padding:0.08rem 0.22rem; display:flex; flex-direction:column; align-items:center; cursor:pointer; width:38px; min-width:38px; transition:all 0.2s;">
        ${numDisplay}
        <span style="font-size: var(--fs-lg); line-height:1; margin-bottom:0px; display:inline-flex;">${flow.icon}</span>
        <span style="font-size: 0.48rem; font-weight: var(--fw-extrabold); text-transform:uppercase; letter-spacing:0.2px; margin-top:1px; line-height:1;">${flow.label}</span>
      </button>

      <!-- SZCZEGÓŁY -->
      <div class="prz-main">
        <div class="prz-name-wrap" title="${escapeHtmlAttr(przName + ' ' + dnLabel)}">
          <span data-action="openChangePrzejscieTypePopup" data-i="${globalIndex}" title="${escapeHtmlAttr(przName)} — kliknij, aby zmienić typ" class="prz-field-color">${escapeHtml(przName)}</span>
          <span data-action="openChangePrzejscieDnPopup" data-i="${globalIndex}" title="${escapeHtmlAttr(dnLabel)} — kliknij, aby zmienić średnicę" class="prz-field-dn">${escapeHtml(dnLabel)}</span>
        </div>

        <div class="prz-cols">
          <div class="prz-col">
            <div class="prz-col-header" title="${spadekKLabel} [mm]">Spadek kin. [%]</div>
            <div class="prz-col-body">
              <div data-qe-id="${item.id}" data-qe-field="spadekKineta" data-action="activateQuickEdit" data-i="${globalIndex}" data-field="spadekKineta" title="Kliknij aby edytować" class="prz-field fs-2xl-bold-primary-shadow" >${item.spadekKineta != null && item.spadekKineta !== '' && parseFloat(item.spadekKineta) !== 0 ? Math.round(parseFloat(item.spadekKineta)) + ' %' : '—'}</div>
            </div>
          </div>
          <div class="prz-col">
            <div class="prz-col-header" title="${spadekMLabel} [mm]">Spadek mufy [%]</div>
            <div class="prz-col-body">
              <div data-qe-id="${item.id}" data-qe-field="spadekMufa" data-action="activateQuickEdit" data-i="${globalIndex}" data-field="spadekMufa" title="Kliknij aby edytować" class="prz-field fs-2xl-bold-primary-shadow" >${item.spadekMufa != null && item.spadekMufa !== '' && parseFloat(item.spadekMufa) !== 0 ? Math.round(parseFloat(item.spadekMufa)) + ' %' : '—'}</div>
            </div>
          </div>
          <div class="prz-col">
            <div class="prz-col-header">Kąt</div>
            <div class="prz-col-body">
              <div data-qe-id="${item.id}" data-qe-field="angle" data-action="activateQuickEdit" data-i="${globalIndex}" data-field="angle" title="Kliknij aby edytować wpisując liczbę" class="prz-field-angle" style="font-size: var(--fs-xl); font-weight: var(--fw-extrabold); color:${angleColor}; text-shadow:0 1px 2px rgba(var(--black-rgb), 0.3);">${item.angle}°</div>
            </div>
          </div>
          <div class="prz-col">
            <div class="prz-col-header" title="Wysokość [mm]">Wysokość [mm]</div>
            <div class="prz-col-body">
              <div data-qe-id="${item.id}" data-qe-field="heightMm" data-action="activateQuickEdit" data-i="${globalIndex}" data-field="heightMm" title="Wysokość od dolnej krawędzi elementu" class="prz-field-height" style="font-size: var(--fs-xl); font-weight: var(--fw-extrabold); color:var(--warn); text-shadow:0 1px 2px rgba(var(--black-rgb), 0.3);">${heightMm} mm</div>
            </div>
          </div>
          <div class="prz-col">
            <div class="prz-col-header" title="Kąt wykonania (360° - kąt)">Kąt wyk.</div>
            <div class="prz-col-body">
              <div style="font-size: var(--fs-xl); font-weight: var(--fw-bold); color:var(--blue-alt); padding:0.1rem 0.25rem;" title="360° - kąt">${calcExecutionAngle(item.angle)}°</div>
            </div>
          </div>
          <div class="prz-col">
            <div class="prz-col-header" title="Kąt wykonania w gonach">Gony</div>
            <div class="prz-col-body">
              <div style="font-size: var(--fs-xl); font-weight: var(--fw-bold); color:var(--success-hover); padding:0.1rem 0.25rem;" title="Kąt wykonania w gonach">${calcGonyAngle(item.angle)}g</div>
            </div>
          </div>
          <div class="prz-col">
            <div class="prz-col-header">Rzędna</div>
            <div class="prz-col-body">
              <div data-qe-id="${item.id}" data-qe-field="rzednaWlaczenia" data-action="activateQuickEdit" data-i="${globalIndex}" data-field="rzednaWlaczenia" title="Kliknij aby edytować wpisując liczbę" class="prz-field-rzedna" style="font-size: var(--fs-xl); font-weight: var(--fw-extrabold); color:var(--text-primary); text-shadow:0 1px 2px rgba(var(--black-rgb), 0.3);">${item.rzednaWlaczenia || '—'}</div>
            </div>
          </div>
          ${priceHTML}
          ${doplataHTML}
        </div>
      </div>

      ${actionsHTML}
    </div>`;
}

// ──────────────────────────────────────
// Budowniczy mapy konfiguracji (współdzielony między konf. a zamówieniami)
// ──────────────────────────────────────

/**
 * Buduje mapowanie elementów konfiguracji studni na ich pionowe zakresy pozycji.
 *
 * @param {Object}   well            - Obiekt studni.
 * @param {Function} findProductFn   - Funkcja(productId) => produkt, zazwyczaj studnieProducts.find(...)
 * @param {boolean}  includeName     - Czy uwzględnić nazwę i tło we wpisach mapy.
 * @returns {Array}  Tablica { index, start, end, [name], [bg] }.
 */
function buildConfigMap(well, findProductFn, includeName = false) {
    const typeBadge = {
        wlaz: { bg: 'var(--slate-800)' },
        plyta_din: { bg: 'var(--cmp-plyta-din)' },
        plyta_najazdowa: { bg: 'var(--cmp-plyta-najazdowa)' },
        plyta_zamykajaca: { bg: 'var(--cmp-plyta-zamykajaca)' },
        pierscien_odciazajacy: { bg: 'var(--cmp-pierscien)' },
        konus: { bg: 'var(--cmp-konus)' },
        avr: { bg: 'var(--cmp-avr)' },
        plyta_redukcyjna: { bg: 'var(--cmp-plyta-redukcyjna)' },
        krag: { bg: 'var(--cmp-krag)' },
        krag_ot: { bg: 'var(--cmp-krag)' },
        dennica: { bg: 'var(--cmp-dennica)' },
        kineta: { bg: 'var(--cmp-kineta)' }
    };

    const configMap = [];
    let currY = 0;
    let dennicaProcessedCount = 0;

    for (let j = well.config.length - 1; j >= 0; j--) {
        const cItem = well.config[j];
        const p = findProductFn(cItem.productId);
        if (!p) continue;
        let h = 0;
        const isDennicaLike = p.componentType === 'dennica' || p.componentType === 'styczna';
        if (isDennicaLike) {
            for (let q = 0; q < cItem.quantity; q++) {
                dennicaProcessedCount++;
                h += (p.height || 0) - (dennicaProcessedCount > 1 ? 100 : 0);
            }
        } else {
            h = (p.height || 0) * cItem.quantity;
        }
        const entry = {
            index: j,
            start: currY,
            end: currY + h,
            componentType: p.componentType,
            productId: p.id
        };
        if (includeName) {
            const badge = typeBadge[p.componentType] || { bg: 'var(--slate-700)' };
            entry.name = p.name;
            entry.bg = badge.bg;
        }
        configMap.push(entry);
        currY += h;
    }
    return configMap;
}

/**
 * Określa, do którego wpisu configMap należy przejście.
 *
 * @param {number}  mmFromBottom - Wartość mm-od-dna dla przejścia.
 * @param {Array}   configMap    - Mapa konfiguracji z buildConfigMap().
 * @returns {{ assignedIndex: number, entry: Object|null }}
 */
function findAssignedElement(mmFromBottom, configMap) {
    for (const cm of configMap) {
        if (mmFromBottom >= cm.start && mmFromBottom < cm.end) {
            return { assignedIndex: cm.index, entry: cm };
        }
    }
    // Powrót do pierwszego lub ostatniego
    if (configMap.length > 0) {
        const tgt = mmFromBottom < 0 ? configMap[0] : configMap[configMap.length - 1];
        return { assignedIndex: tgt.index, entry: tgt };
    }
    return { assignedIndex: -1, entry: null };
}

/**
 * Oblicza wysokość od dna elementu dla przejścia.
 *
 * @param {number} mmFromBottom - mm od dna studni.
 * @param {Array}  configMap    - Mapa konfiguracji z buildConfigMap().
 * @returns {number} Wysokość w mm od dolnej krawędzi elementu.
 */
function computeHeightFromElement(mmFromBottom, configMap) {
    let elementStartMm = 0;
    for (const cm of configMap) {
        if (mmFromBottom >= cm.start && mmFromBottom < cm.end) {
            elementStartMm = cm.start;
            break;
        }
    }
    return Math.round(mmFromBottom - elementStartMm);
}

// ──────────────────────────────────────

/**
 * Nadaje displayIndex przejściom na podstawie kątów (ruch wskazówek zegara).
 * Przejścia na tym samym kącie dostają ten sam numer.
 * Kąt 0° (wylot) = indeks 0.
 */
function ensureDisplayIndices(przejscia) {
    if (!przejscia || przejscia.length === 0) return;

    const sorted = [...przejscia].sort((a, b) => {
        return (parseFloat(a.angle) || 0) - (parseFloat(b.angle) || 0);
    });

    sorted.forEach((p, idx) => {
        p.displayIndex = idx;
    });
}
/* ===== Delegacja kliknięć (data-action) — TASK-036 ===== */
if (typeof document !== 'undefined' && !window.__trDelegated) {
    window.__trDelegated = true;
    // mousedown dla szybkiego przełączania między polami — naprawia 2-kliki
    document.addEventListener('mousedown', (e) => {
        const el = e.target.closest('[data-action="activateQuickEdit"]');
        if (!el) return;
        if (el.querySelector('input')) return;
        const i = el.getAttribute('data-i');
        const field = el.getAttribute('data-field');
        // Jeśli inne pole jest w edycji, aktywuj na mousedown (przed blur niszczącym click)
        const active = document.activeElement;
        if (active && active.tagName === 'INPUT' && active.closest('[data-qe-id]')) {
            e.preventDefault();
            window.activateQuickEdit(el, parseInt(i, 10), field);
            el.setAttribute('data-qe-handled', '1');
            setTimeout(() => el.removeAttribute('data-qe-handled'), 300);
        }
    });
    document.addEventListener('click', (e) => {
        const el = e.target.closest('[data-action]');
        if (!el) return;
        const action = el.getAttribute('data-action') || '';
        const i = el.getAttribute('data-i');
        const field = el.getAttribute('data-field');
        if (action === 'editPrzejscie') {
            window.editPrzejscie(parseInt(i, 10));
        } else if (action === 'removePrzejscieFromWell') {
            window.removePrzejscieFromWell(parseInt(i, 10));
        } else if (action === 'openFlowTypePopup') {
            window.openFlowTypePopup(parseInt(i, 10));
        } else if (action === 'openChangePrzejscieTypePopup') {
            window.openChangePrzejscieTypePopup(parseInt(i, 10));
        } else if (action === 'openChangePrzejscieDnPopup') {
            window.openChangePrzejscieDnPopup(parseInt(i, 10));
        } else if (action === 'activateQuickEdit') {
            if (el.getAttribute('data-qe-handled') === '1') {
                el.removeAttribute('data-qe-handled');
                return;
            }
            window.activateQuickEdit(el, parseInt(i, 10), field);
        }
    });
}

window.renderTransitionTileHTML = renderTransitionTileHTML;
window.buildConfigMap = buildConfigMap;
window.findAssignedElement = findAssignedElement;
window.computeHeightFromElement = computeHeightFromElement;
window.ensureDisplayIndices = ensureDisplayIndices;
