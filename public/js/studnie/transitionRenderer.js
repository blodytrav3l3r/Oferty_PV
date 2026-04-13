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
    const isWylot = flowType === 'wylot';
    return {
        label: isWylot ? 'Wylot' : 'Wlot',
        bg: isWylot ? 'rgba(239,68,68,0.2)' : 'rgba(59,130,246,0.2)',
        color: isWylot ? '#fca5a5' : '#93c5fd',
        border: isWylot ? 'rgba(239,68,68,0.6)' : 'rgba(59,130,246,0.6)',
        icon: isWylot ? '<i data-lucide="upload"></i>' : '<i data-lucide="download"></i>'
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
    return idx >= 0 ? (idx + 1) : '';
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
 * @param {number}  opts.heightMm      - Wysokość od dna elementu w mm.
 * @param {boolean} opts.showDeleteBtn - Czy pokazać przycisk usuwania (true w konfiguratorze).
 * @param {boolean} opts.showEditBtn   - Czy pokazać przycisk edycji (true w konfiguratorze).
 * @param {boolean} opts.showPrice     - Czy pokazać kolumnę ceny (true w konfiguratorze).
 * @param {string}  opts.spadekKinetaLabel - Etykieta dla "Spadek w kinecie".
 * @param {string}  opts.spadekMufaLabel   - Etykieta dla "Spadek w mufie".
 * @param {boolean} opts.enableDragDrop    - Czy dodać uchwyty do przeciągania (true w konfiguratorze).
 * @param {number}  opts.assignedCfgIndex  - Indeks konfiguracji do podświetlenia SVG (jeśli dostępny).
 * @returns {string} Ciąg HTML.
 */
function renderTransitionTileHTML(item, globalIndex, product, opts = {}) {
    const przName = product ? product.category : 'Nieznane';
    const dn = product ? product.dn : '—';
    const price = product ? product.price : 0;

    if (!item.flowTypeManual) {
        item.flowType = (item.angle === 0 || item.angle === '0') ? 'wylot' : 'wlot';
    }
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

    // Kolumna akcji
    let actionsHTML = '';
    if (showEdit || showDelete) {
        actionsHTML = `<div style="display:flex; align-items:center; gap:0.25rem; padding-left:0.5rem; border-left:1px dashed rgba(255,255,255,0.1);">`;
        if (showEdit) {
            actionsHTML += `<button onclick="editPrzejscie(${globalIndex})" title="Edytuj" style="background:rgba(96,165,250,0.15); border:1px solid rgba(96,165,250,0.3); border-radius:8px; cursor:pointer; font-size:0.9rem; padding:0.35rem; color:#60a5fa; transition:all 0.2s;" onmouseenter="this.style.background='rgba(96,165,250,0.3)'" onmouseleave="this.style.background='rgba(96,165,250,0.15)'"><i data-lucide="pencil"></i></button>`;
        }
        if (showDelete) {
            actionsHTML += `<button onclick="removePrzejscieFromWell(${globalIndex})" title="Usuń" style="background:rgba(239,68,68,0.15); border:1px solid rgba(239,68,68,0.3); border-radius:8px; cursor:pointer; font-size:0.9rem; padding:0.35rem; color:#ef4444; transition:all 0.2s;" onmouseenter="this.style.background='rgba(239,68,68,0.3)'" onmouseleave="this.style.background='rgba(239,68,68,0.15)'"><i data-lucide="x"></i></button>`;
        }
        actionsHTML += `</div>`;
    }

    // Kolumna ceny
    const priceHTML = showPrice
        ? `<div style="width:90px; flex-shrink:0; height:44px; display:flex; flex-direction:column; justify-content:flex-start; align-items:flex-end;">
             <div class="ui-text-muted-sm" style="overflow:hidden; text-overflow:ellipsis; white-space:nowrap; width:100%; text-align:right;">Cena</div>
             <div style="font-size:1.0rem; font-weight:800; color:var(--success); font-family:'Inter'; margin-top:2px; padding:0.15rem 0.4rem;">${typeof fmtInt === 'function' ? fmtInt(price) : price} <span style="font-size:0.6rem;">PLN</span></div>
           </div>`
        : '';

    // Kolumna dopłata (non-discountable)
    const doplataVal = item.doplata != null ? item.doplata : 0;
    const doplataHTML = showPrice
        ? `<div style="width:90px; flex-shrink:0; height:44px; display:flex; flex-direction:column; justify-content:flex-start; align-items:flex-end; position:relative;" title="Pole nie rabatowane">
             <div class="ui-text-muted-sm" style="overflow:hidden; text-overflow:ellipsis; white-space:nowrap; width:100%; text-align:right;">Dopłata</div>
             <div data-qe-id="${item.id}" data-qe-field="doplata" onclick="window.activateQuickEdit(this, ${globalIndex}, 'doplata')" style="font-size:1.0rem; font-weight:800; color:#fbbf24; font-family:'Inter'; cursor:pointer; padding:0.15rem 0.4rem; background:rgba(255,255,255,0.03); border-radius:4px; transition:all 0.2s; margin-top:2px;" onmouseenter="this.style.background='rgba(255,255,255,0.1)';" onmouseleave="this.style.background='rgba(255,255,255,0.03)';">${typeof fmtInt === 'function' ? fmtInt(doplataVal) : doplataVal} <span style="font-size:0.6rem;">PLN</span></div>
           </div>`
        : '';

    // Zapewnij stabilny identyfikator dla QE (Quick Edit)
    if (!item.id) item.id = 'prz-legacy-' + globalIndex + '-' + Math.floor(Math.random() * 1000);

    const clockIdx = getClockIndex(item, opts);
    const numDisplay = clockIdx !== '' && clockIdx !== undefined ? `<div title="Oznaczenie zegarowe" style="position:absolute; top:-6px; right:-6px; background:#1e293b; border:1px solid ${flow.border}; border-radius:50%; width:18px; height:18px; display:flex; align-items:center; justify-content:center; font-size:0.6rem; font-weight:800; color:${flow.color}; box-shadow:0 1px 3px rgba(0,0,0,0.5);">${clockIdx}</div>` : '';

    return `<div ${dragAttrs} style="background:linear-gradient(90deg, rgba(30,58,138,0.3) 0%, rgba(30,41,59,0.8) 100%); border:1px solid rgba(255,255,255,0.05); border-left:5px solid ${flow.border}; border-radius:10px; height:54px; padding:0 0.45rem; box-sizing:border-box; position:relative; transition:all 0.2s ease; margin-bottom:0.4rem; display:flex; align-items:center; gap:0.5rem; ${cursorStyle}" ${highlightAttrs}>
      <!-- FLOW TYPE BUTTON -->
      <button onclick="openFlowTypePopup(${globalIndex})" title="Kliknij by zmienić na Wlot/Wylot" style="position:relative; background:${flow.bg}; color:${flow.color}; border:1px solid ${flow.border}; border-radius:8px; padding:0.15rem 0.4rem; display:flex; flex-direction:column; align-items:center; cursor:pointer; width:55px; min-width:55px; transition:all 0.2s;">
        ${numDisplay}
        <span style="font-size:1.1rem; margin-bottom:0px;">${flow.icon}</span>
        <span style="font-size:0.6rem; font-weight:800; text-transform:uppercase; letter-spacing:0.5px; margin-top:-2px;">${flow.label}</span>
      </button>

      <!-- SZCZEGÓŁY -->
      <div style="flex:1; display:flex; justify-content:space-between; align-items:center; gap:0.5rem;">
        <div style="display:flex; flex-direction:column; gap:0.1rem; flex:1; min-width:200px; white-space:normal; padding-right:0.5rem;">
           <div style="display:flex; flex-wrap:wrap; align-items:center; gap:0.5rem;">
             <span onclick="window.openChangePrzejscieTypePopup(${globalIndex})" title="Kliknij, aby zmienić typ przejścia" style="font-size:0.95rem; font-weight:800; color:var(--text-primary); cursor:pointer; transition:color 0.2s;" onmouseenter="this.style.color='#60a5fa'" onmouseleave="this.style.color='var(--text-primary)'">${przName}</span>
             <span onclick="window.openChangePrzejscieDnPopup(${globalIndex})" title="Kliknij, aby zmienić średnicę" style="font-size:0.95rem; color:#a78bfa; font-weight:800; cursor:pointer; transition:color 0.2s;" onmouseenter="this.style.color='#c084fc'" onmouseleave="this.style.color='#a78bfa'">${dnLabel}</span>
           </div>
        </div>

        <div style="display:flex; align-items:center; gap:0.5rem; margin-right: 0.2rem; white-space:nowrap; flex-shrink:0;">
          <div style="width:135px; flex-shrink:0; height:44px; display:flex; flex-direction:column; justify-content:flex-start; align-items:center;">
            <div class="ui-text-muted-sm" style="overflow:hidden; text-overflow:ellipsis; white-space:nowrap; width:100%; text-align:center;">${spadekKLabel} [mm]</div>
            <div data-qe-id="${item.id}" data-qe-field="spadekKineta" onclick="window.activateQuickEdit(this, ${globalIndex}, 'spadekKineta')" title="Kliknij aby edytować" style="font-size:1.0rem; font-weight:700; color:var(--text-primary); text-shadow:0 1px 2px rgba(0,0,0,0.3); cursor:pointer; padding:0.15rem 0.4rem; background:rgba(255,255,255,0.03); border-radius:4px; transition:all 0.2s; display:inline-block; margin-top:2px;" onmouseenter="this.style.color='#60a5fa'; this.style.background='rgba(255,255,255,0.1)';" onmouseleave="this.style.color='var(--text-primary)'; this.style.background='rgba(255,255,255,0.03)';">${item.spadekKineta != null && item.spadekKineta !== '' ? Math.round(parseFloat(item.spadekKineta)) + ' mm' : '—'}</div>
          </div>
          <div style="width:135px; flex-shrink:0; height:44px; display:flex; flex-direction:column; justify-content:flex-start; align-items:center;">
            <div class="ui-text-muted-sm" style="overflow:hidden; text-overflow:ellipsis; white-space:nowrap; width:100%; text-align:center;">${spadekMLabel} [mm]</div>
            <div data-qe-id="${item.id}" data-qe-field="spadekMufa" onclick="window.activateQuickEdit(this, ${globalIndex}, 'spadekMufa')" title="Kliknij aby edytować" style="font-size:1.0rem; font-weight:700; color:var(--text-primary); text-shadow:0 1px 2px rgba(0,0,0,0.3); cursor:pointer; padding:0.15rem 0.4rem; background:rgba(255,255,255,0.03); border-radius:4px; transition:all 0.2s; display:inline-block; margin-top:2px;" onmouseenter="this.style.color='#60a5fa'; this.style.background='rgba(255,255,255,0.1)';" onmouseleave="this.style.color='var(--text-primary)'; this.style.background='rgba(255,255,255,0.03)';">${item.spadekMufa != null && item.spadekMufa !== '' ? Math.round(parseFloat(item.spadekMufa)) + ' mm' : '—'}</div>
          </div>
          <div style="width:65px; flex-shrink:0; position:relative; height:44px; display:flex; flex-direction:column; justify-content:flex-start; align-items:center;">
            <div class="ui-text-muted-sm" style="overflow:hidden; text-overflow:ellipsis; white-space:nowrap; width:100%; text-align:center;">Kąt</div>
            <div data-qe-id="${item.id}" data-qe-field="angle" onclick="window.activateQuickEdit(this, ${globalIndex}, 'angle')" title="Kliknij aby edytować wpisując liczbę" style="font-size:1.0rem; font-weight:800; color:${angleColor}; text-shadow:0 1px 2px rgba(0,0,0,0.3); cursor:pointer; padding:0.15rem 0.4rem; background:rgba(255,255,255,0.03); border-radius:4px; transition:all 0.2s; display:inline-block; margin-top:2px;" onmouseenter="this.style.transform='scale(1.15)'; this.style.background='rgba(255,255,255,0.1)';" onmouseleave="this.style.transform='scale(1)'; this.style.background='rgba(255,255,255,0.03)';">${item.angle}°</div>
          </div>
          <div style="width:95px; flex-shrink:0; height:44px; display:flex; flex-direction:column; justify-content:flex-start; align-items:center;">
            <div class="ui-text-muted-sm" style="overflow:hidden; text-overflow:ellipsis; white-space:nowrap; width:100%; text-align:center;">Wysokość [mm]</div>
            <div data-qe-id="${item.id}" data-qe-field="heightMm" onclick="window.activateQuickEdit(this, ${globalIndex}, 'heightMm')" title="Wysokość od dolnej krawędzi elementu" style="font-size:1.0rem; font-weight:800; color:#f59e0b; text-shadow:0 1px 2px rgba(0,0,0,0.3); cursor:pointer; padding:0.15rem 0.4rem; background:rgba(255,255,255,0.03); border-radius:4px; transition:all 0.2s; display:inline-block; margin-top:2px;" onmouseenter="this.style.color='#fbbf24'; this.style.background='rgba(255,255,255,0.1)';" onmouseleave="this.style.color='#f59e0b'; this.style.background='rgba(255,255,255,0.03)';">${heightMm} mm</div>
          </div>
          <div style="width:90px; flex-shrink:0; height:44px; display:flex; flex-direction:column; justify-content:flex-start; align-items:center;">
            <div class="ui-text-muted-sm" style="overflow:hidden; text-overflow:ellipsis; white-space:nowrap; width:100%; text-align:center;">Kąt wykonania</div>
            <div style="font-size:1.0rem; font-weight:700; color:#38bdf8; display:inline-block; padding:0.15rem 0.4rem; margin-top:2px;" title="360° - kąt">${calcExecutionAngle(item.angle)}°</div>
          </div>
          <div style="width:70px; flex-shrink:0; height:44px; display:flex; flex-direction:column; justify-content:flex-start; align-items:center;">
            <div class="ui-text-muted-sm" style="overflow:hidden; text-overflow:ellipsis; white-space:nowrap; width:100%; text-align:center;">Kąt gony</div>
            <div style="font-size:1.0rem; font-weight:700; color:#2dd4bf; display:inline-block; padding:0.15rem 0.4rem; margin-top:2px;" title="Kąt wykonania w gonach">${calcGonyAngle(item.angle)}g</div>
          </div>
          <div style="width:80px; flex-shrink:0; height:44px; display:flex; flex-direction:column; justify-content:flex-start; align-items:center;">
            <div class="ui-text-muted-sm" style="overflow:hidden; text-overflow:ellipsis; white-space:nowrap; width:100%; text-align:center;">Rzędna</div>
            <div data-qe-id="${item.id}" data-qe-field="rzednaWlaczenia" onclick="window.activateQuickEdit(this, ${globalIndex}, 'rzednaWlaczenia')" title="Kliknij aby edytować wpisując liczbę" style="font-size:1.0rem; font-weight:800; color:var(--text-primary); text-shadow:0 1px 2px rgba(0,0,0,0.3); cursor:pointer; padding:0.15rem 0.4rem; background:rgba(255,255,255,0.03); border-radius:4px; transition:all 0.2s; display:inline-block; margin-top:2px;" onmouseenter="this.style.color='#60a5fa'; this.style.background='rgba(255,255,255,0.1)';" onmouseleave="this.style.color='var(--text-primary)'; this.style.background='rgba(255,255,255,0.03)';">${item.rzednaWlaczenia || '—'}</div>
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
// Renderuj odfiltrowaną listę przejść (tryb lustrzany dla zamówień)
// ──────────────────────────────────────

/**
 * Renderuje odfiltrowaną listę przejść do kontenera.
 * Używane przez okno zamówienia do wyświetlania tylko przejść dla konkretnego elementu.
 *
 * @param {HTMLElement} container       - Element DOM do renderowania.
 * @param {Array}       items           - Podzbiór well.przejscia przypisany do tego elementu.
 * @param {Object}      well            - Pełny obiekt studni (do wyszukania globalIndex).
 * @param {Function}    findProductFn   - Funkcja(productId) => produkt.
 * @param {Array}       configMap       - Mapa konfiguracji z buildConfigMap().
 * @param {number}      rzDna           - Rzędna dna ze studni.
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
                enableDragDrop: false,
                well: well
            });
        })
        .join('');
}

// Eksport do okna (window) dla użycia bez modułów
window.renderTransitionTileHTML = renderTransitionTileHTML;
window.buildConfigMap = buildConfigMap;
window.findAssignedElement = findAssignedElement;
window.computeHeightFromElement = computeHeightFromElement;
window.renderMirrorTransitions = renderMirrorTransitions;

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

    let currentIdx = 0;
    let prevAngle = null;

    sorted.forEach(p => {
        const angle = parseFloat(p.angle) || 0;
        if (prevAngle !== null && angle !== prevAngle) {
            currentIdx++;
        }
        p.displayIndex = currentIdx;
        prevAngle = angle;
    });
}
window.ensureDisplayIndices = ensureDisplayIndices;
