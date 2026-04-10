/**
 * transitionRenderer.js
 *
 * Unified renderer for transition (przejścia) tiles.
 * Used by both the configurator (autoSelect.js) and the order modal (orderManager.js).
 *
 * This module generates HTML for a single transition row. Both consuming contexts
 * call it with the same data shape (`item`, `globalIndex`, `options`) and get
 * consistent visual output.
 */

// ──────────────────────────────────────
// Helpers
// ──────────────────────────────────────

function getFlowVisuals(flowType) {
    const isWylot = flowType === 'wylot';
    return {
        label: isWylot ? 'Wylot' : 'Wlot',
        bg: isWylot ? 'rgba(239,68,68,0.2)' : 'rgba(59,130,246,0.2)',
        color: isWylot ? '#fca5a5' : '#93c5fd',
        border: isWylot ? 'rgba(239,68,68,0.6)' : 'rgba(59,130,246,0.6)',
        icon: isWylot ? '📤' : '📥'
    };
}

function getAngleColor(angle) {
    return angle === 0 || angle === '0' ? '#6366f1' : '#818cf8';
}

function calcExecutionAngle(angle) {
    return angle === 0 || angle === 360 ? 0 : 360 - angle;
}

function calcGonyAngle(angle) {
    return (angle === 0 || angle === 360 ? 0 : ((360 - angle) * 400) / 360).toFixed(2);
}

// ──────────────────────────────────────
// Main tile renderer
// ──────────────────────────────────────

/**
 * Generates the HTML for a single transition tile row.
 *
 * @param {Object}  item         - The transition object from well.przejscia[].
 * @param {number}  globalIndex  - The index of the transition in well.przejscia.
 * @param {Object}  product      - The studnieProducts entry for item.productId.
 * @param {Object}  opts         - Rendering options.
 * @param {number}  opts.heightMm      - Height from element bottom in mm.
 * @param {boolean} opts.showDeleteBtn - Whether to show a delete button (true in configurator).
 * @param {boolean} opts.showEditBtn   - Whether to show an edit button (true in configurator).
 * @param {boolean} opts.showPrice     - Whether to show the price column (true in configurator).
 * @param {string}  opts.spadekKinetaLabel - Label for "Spadek w kinecie" (short version for mirror).
 * @param {string}  opts.spadekMufaLabel   - Label for "Spadek w mufie" (short version for mirror).
 * @param {boolean} opts.enableDragDrop    - Whether to add drag handles (true in configurator).
 * @param {number}  opts.assignedCfgIndex  - Config index for SVG highlight (if available).
 * @returns {string} HTML string.
 */
function renderTransitionTileHTML(item, globalIndex, product, opts = {}) {
    const przName = product ? product.category : 'Nieznane';
    const dn = product ? product.dn : '—';
    const price = product ? product.price : 0;

    if (!item.flowType) {
        item.flowType =
            globalIndex === 0 && (item.angle === 0 || item.angle === '0') ? 'wylot' : 'wlot';
    }

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

    // Actions column
    let actionsHTML = '';
    if (showEdit || showDelete) {
        actionsHTML = `<div style="display:flex; align-items:center; gap:0.25rem; padding-left:0.5rem; border-left:1px dashed rgba(255,255,255,0.1);">`;
        if (showEdit) {
            actionsHTML += `<button onclick="editPrzejscie(${globalIndex})" title="Edytuj" style="background:rgba(96,165,250,0.15); border:1px solid rgba(96,165,250,0.3); border-radius:8px; cursor:pointer; font-size:0.9rem; padding:0.35rem; color:#60a5fa; transition:all 0.2s;" onmouseenter="this.style.background='rgba(96,165,250,0.3)'" onmouseleave="this.style.background='rgba(96,165,250,0.15)'">✏️</button>`;
        }
        if (showDelete) {
            actionsHTML += `<button onclick="removePrzejscieFromWell(${globalIndex})" title="Usuń" style="background:rgba(239,68,68,0.15); border:1px solid rgba(239,68,68,0.3); border-radius:8px; cursor:pointer; font-size:0.9rem; padding:0.35rem; color:#ef4444; transition:all 0.2s;" onmouseenter="this.style.background='rgba(239,68,68,0.3)'" onmouseleave="this.style.background='rgba(239,68,68,0.15)'">✕</button>`;
        }
        actionsHTML += `</div>`;
    }

    // Price column
    const priceHTML = showPrice
        ? `<div style="text-align:right; min-width:60px;">
             <div class="ui-text-muted-sm">Cena</div>
             <div style="font-size:0.95rem; font-weight:800; color:var(--success); font-family:'Inter'">${typeof fmtInt === 'function' ? fmtInt(price) : price} <span style="font-size:0.6rem;">PLN</span></div>
           </div>`
        : '';

    // Ensure stable ID for QE
    if (!item.id) item.id = 'prz-legacy-' + globalIndex + '-' + Math.floor(Math.random() * 1000);

    return `<div ${dragAttrs} style="background:linear-gradient(90deg, rgba(30,58,138,0.3) 0%, rgba(30,41,59,0.8) 100%); border:1px solid rgba(255,255,255,0.05); border-left:5px solid ${flow.border}; border-radius:10px; height:49px; padding:0 0.45rem; box-sizing:border-box; position:relative; transition:all 0.2s ease; margin-bottom:0.4rem; display:flex; align-items:center; gap:0.5rem; ${cursorStyle}" ${highlightAttrs}>
      <!-- FLOW TYPE BUTTON -->
      <button onclick="openFlowTypePopup(${globalIndex})" title="Kliknij by zmienić na Wlot/Wylot" style="background:${flow.bg}; color:${flow.color}; border:1px solid ${flow.border}; border-radius:8px; padding:0.15rem 0.4rem; display:flex; flex-direction:column; align-items:center; cursor:pointer; min-width:55px; transition:all 0.2s;">
        <span style="font-size:1.1rem; margin-bottom:0px;">${flow.icon}</span>
        <span style="font-size:0.6rem; font-weight:800; text-transform:uppercase; letter-spacing:0.5px; margin-top:-2px;">${flow.label}</span>
      </button>

      <!-- DETAILS -->
      <div style="flex:1; display:flex; justify-content:space-between; align-items:center; gap:0.5rem; white-space:nowrap;">
        <div style="display:flex; flex-direction:column; gap:0.1rem; min-width:100px; overflow:hidden;">
           <div style="display:flex; align-items:center; gap:0.6rem; white-space:nowrap;">
             <span onclick="window.openChangePrzejscieTypePopup(${globalIndex})" title="Kliknij, aby zmienić typ przejścia" style="font-size:1.0rem; font-weight:800; color:var(--text-primary); cursor:pointer; transition:color 0.2s;" onmouseenter="this.style.color='#60a5fa'" onmouseleave="this.style.color='var(--text-primary)'">${przName}</span>
             <span onclick="window.openChangePrzejscieDnPopup(${globalIndex})" title="Kliknij, aby zmienić średnicę" style="font-size:1.0rem; color:#a78bfa; font-weight:800; cursor:pointer; transition:color 0.2s;" onmouseenter="this.style.color='#c084fc'" onmouseleave="this.style.color='#a78bfa'">${dnLabel}</span>
           </div>
        </div>

        <div style="display:flex; align-items:center; gap:0.8rem; margin-right: 0.4rem; white-space:nowrap;">
          <div class="ui-center-min">
            <div class="ui-text-muted-sm">${spadekKLabel} [mm]</div>
            <div data-qe-id="${item.id}" data-qe-field="spadekKineta" onclick="window.activateQuickEdit(this, ${globalIndex}, 'spadekKineta')" title="Kliknij aby edytować" style="font-size:0.9rem; font-weight:700; color:var(--text-primary); text-shadow:0 1px 2px rgba(0,0,0,0.3); cursor:pointer; padding:0.15rem 0.4rem; background:rgba(255,255,255,0.03); border-radius:4px; transition:all 0.2s; display:inline-block;" onmouseenter="this.style.color='#60a5fa'; this.style.background='rgba(255,255,255,0.1)';" onmouseleave="this.style.color='var(--text-primary)'; this.style.background='rgba(255,255,255,0.03)';">${item.spadekKineta != null && item.spadekKineta !== '' ? Math.round(parseFloat(item.spadekKineta)) + ' mm' : '—'}</div>
          </div>
          <div class="ui-center-min">
            <div class="ui-text-muted-sm">${spadekMLabel} [mm]</div>
            <div data-qe-id="${item.id}" data-qe-field="spadekMufa" onclick="window.activateQuickEdit(this, ${globalIndex}, 'spadekMufa')" title="Kliknij aby edytować" style="font-size:0.9rem; font-weight:700; color:var(--text-primary); text-shadow:0 1px 2px rgba(0,0,0,0.3); cursor:pointer; padding:0.15rem 0.4rem; background:rgba(255,255,255,0.03); border-radius:4px; transition:all 0.2s; display:inline-block;" onmouseenter="this.style.color='#60a5fa'; this.style.background='rgba(255,255,255,0.1)';" onmouseleave="this.style.color='var(--text-primary)'; this.style.background='rgba(255,255,255,0.03)';">${item.spadekMufa != null && item.spadekMufa !== '' ? Math.round(parseFloat(item.spadekMufa)) + ' mm' : '—'}</div>
          </div>
          <div style="text-align:center; min-width:60px; position:relative; padding-bottom:0.1rem;">
            <div class="ui-text-muted-sm">Kąt</div>
            <div data-qe-id="${item.id}" data-qe-field="angle" onclick="window.activateQuickEdit(this, ${globalIndex}, 'angle')" title="Kliknij aby edytować wpisując liczbę" style="font-size:1.05rem; font-weight:800; color:${angleColor}; text-shadow:0 1px 2px rgba(0,0,0,0.3); cursor:pointer; padding:0.15rem 0.5rem; background:rgba(255,255,255,0.03); border-radius:4px; transition:all 0.2s; display:inline-block;" onmouseenter="this.style.transform='scale(1.15)'; this.style.background='rgba(255,255,255,0.1)';" onmouseleave="this.style.transform='scale(1)'; this.style.background='rgba(255,255,255,0.03)';">${item.angle}°</div>
          </div>
          <div style="text-align:center; min-width:60px;">
            <div class="ui-text-muted-sm">Wysokość [mm]</div>
            <div data-qe-id="${item.id}" data-qe-field="heightMm" onclick="window.activateQuickEdit(this, ${globalIndex}, 'heightMm')" title="Wysokość od dolnej krawędzi elementu" style="font-size:1.05rem; font-weight:800; color:#f59e0b; text-shadow:0 1px 2px rgba(0,0,0,0.3); cursor:pointer; padding:0.15rem 0.4rem; background:rgba(255,255,255,0.03); border-radius:4px; transition:all 0.2s; display:inline-block;" onmouseenter="this.style.color='#fbbf24'; this.style.background='rgba(255,255,255,0.1)';" onmouseleave="this.style.color='#f59e0b'; this.style.background='rgba(255,255,255,0.03)';">${heightMm} mm</div>
          </div>
          <div style="text-align:center; min-width:55px;">
            <div class="ui-text-muted-sm">Kąt wykonania</div>
            <div style="font-size:1.0rem; font-weight:700; color:#38bdf8;" title="360° - kąt">${calcExecutionAngle(item.angle)}°</div>
          </div>
          <div class="ui-center-min" style="min-width:55px;">
            <div class="ui-text-muted-sm">Kąt gony</div>
            <div style="font-size:1.0rem; font-weight:700; color:#2dd4bf;" title="Kąt wykonania w gonach">${calcGonyAngle(item.angle)}g</div>
          </div>
          <div style="text-align:center; min-width:65px;">
            <div class="ui-text-muted-sm">Rzędna</div>
            <div data-qe-id="${item.id}" data-qe-field="rzednaWlaczenia" onclick="window.activateQuickEdit(this, ${globalIndex}, 'rzednaWlaczenia')" title="Kliknij aby edytować wpisując liczbę" style="font-size:1.05rem; font-weight:800; color:var(--text-primary); text-shadow:0 1px 2px rgba(0,0,0,0.3); cursor:pointer; padding:0.15rem 0.5rem; background:rgba(255,255,255,0.03); border-radius:4px; transition:all 0.2s; display:inline-block;" onmouseenter="this.style.color='#60a5fa'; this.style.background='rgba(255,255,255,0.1)';" onmouseleave="this.style.color='var(--text-primary)'; this.style.background='rgba(255,255,255,0.03)';">${item.rzednaWlaczenia || '—'}</div>
          </div>
          ${priceHTML}
        </div>
      </div>

      ${actionsHTML}
    </div>`;
}

// ──────────────────────────────────────
// Config map builder (shared between configurator and orders)
// ──────────────────────────────────────

/**
 * Builds a mapping of well config elements to their vertical position range.
 *
 * @param {Object}   well            - The well object.
 * @param {Function} findProductFn   - A function(productId) => product, typically studnieProducts.find(...)
 * @param {boolean}  includeName     - Whether to include name and bg in the map entries.
 * @returns {Array}  Array of { index, start, end, [name], [bg] }.
 */
function buildConfigMap(well, findProductFn, includeName = false) {
    const typeBadge = {
        wlaz: { bg: '#374151' },
        plyta_din: { bg: '#1e3a5f' },
        plyta_najazdowa: { bg: '#1e3a5f' },
        plyta_zamykajaca: { bg: '#1e3a5f' },
        pierscien_odciazajacy: { bg: '#1e3a5f' },
        konus: { bg: '#7c3aed30' },
        avr: { bg: '#44403c' },
        plyta_redukcyjna: { bg: '#6d28d920' },
        krag: { bg: '#164e63' },
        krag_ot: { bg: '#312e81' },
        dennica: { bg: '#14532d' },
        kineta: { bg: '#9d174d' }
    };

    const configMap = [];
    let currY = 0;
    let dennicaProcessedCount = 0;

    for (let j = well.config.length - 1; j >= 0; j--) {
        const cItem = well.config[j];
        const p = findProductFn(cItem.productId);
        if (!p) continue;
        let h = 0;
        if (p.componentType === 'dennica') {
            for (let q = 0; q < cItem.quantity; q++) {
                dennicaProcessedCount++;
                h += (p.height || 0) - (dennicaProcessedCount > 1 ? 100 : 0);
            }
        } else {
            h = (p.height || 0) * cItem.quantity;
        }
        const entry = { index: j, start: currY, end: currY + h };
        if (includeName) {
            const badge = typeBadge[p.componentType] || { bg: '#333333' };
            entry.name = p.name;
            entry.bg = badge.bg;
        }
        configMap.push(entry);
        currY += h;
    }
    return configMap;
}

/**
 * Determines which configMap entry a transition belongs to.
 *
 * @param {number}  mmFromBottom - The mm-from-bottom value for the transition.
 * @param {Array}   configMap    - The config map from buildConfigMap().
 * @returns {{ assignedIndex: number, entry: Object|null }}
 */
function findAssignedElement(mmFromBottom, configMap) {
    for (const cm of configMap) {
        if (mmFromBottom >= cm.start && mmFromBottom < cm.end) {
            return { assignedIndex: cm.index, entry: cm };
        }
    }
    // Fallback to first or last
    if (configMap.length > 0) {
        const tgt = mmFromBottom < 0 ? configMap[0] : configMap[configMap.length - 1];
        return { assignedIndex: tgt.index, entry: tgt };
    }
    return { assignedIndex: -1, entry: null };
}

/**
 * Computes the height from element bottom for a transition.
 *
 * @param {number} mmFromBottom - mm from the well bottom.
 * @param {Array}  configMap    - The config map from buildConfigMap().
 * @returns {number} Height in mm from the element's bottom edge.
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
// Render a filtered list of transitions (mirror mode for orders)
// ──────────────────────────────────────

/**
 * Renders a filtered list of transitions into a container.
 * Used by the order modal to display only transitions for a specific element.
 *
 * @param {HTMLElement} container       - The DOM element to render into.
 * @param {Array}       items           - Subset of well.przejscia assigned to this element.
 * @param {Object}      well            - The full well object (to look up globalIndex).
 * @param {Function}    findProductFn   - A function(productId) => product.
 * @param {Array}       configMap       - The config map from buildConfigMap().
 * @param {number}      rzDna           - The rzednaDna from the well.
 */
function renderMirrorTransitions(container, items, well, findProductFn, configMap, rzDna) {
    if (!container) return;

    if (items.length === 0) {
        container.innerHTML =
            '<div style="padding:1.2rem; text-align:center; color:var(--text-muted); border:1px dashed rgba(255,255,255,0.1); border-radius:8px; font-size:0.75rem;">Brak przejść szczelnych<br>w tym elemencie.</div>';
        return;
    }

    container.innerHTML = items
        .map((item) => {
            const globalIndex = well.przejscia.indexOf(item);
            const product = findProductFn(item.productId);

            let pel = parseFloat(item.rzednaWlaczenia);
            if (isNaN(pel)) pel = rzDna;
            const mmFromBottom = (pel - rzDna) * 1000;
            const heightMm = computeHeightFromElement(mmFromBottom, configMap);

            return renderTransitionTileHTML(item, globalIndex, product, {
                heightMm,
                showEditBtn: false,
                showDeleteBtn: false,
                showPrice: false,
                spadekKinetaLabel: 'Spadek w k.',
                spadekMufaLabel: 'Spadek w m.',
                enableDragDrop: false
            });
        })
        .join('');
}

// Export to window for non-module usage
window.renderTransitionTileHTML = renderTransitionTileHTML;
window.buildConfigMap = buildConfigMap;
window.findAssignedElement = findAssignedElement;
window.computeHeightFromElement = computeHeightFromElement;
window.renderMirrorTransitions = renderMirrorTransitions;
