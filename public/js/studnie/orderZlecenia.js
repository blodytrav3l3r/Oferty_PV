// @ts-check
/* ===== ZLECENIA PRODUKCYJNE ===== */
let productionOrders = [];
let zleceniaElementsList = [];
let zleceniaSelectedIdx = -1;
let zleceniaActiveFilter = 'all';

/** Ustaw aktywny filtr dla listy elementów zleceń */
function setZleceniaFilter(filter) {
    zleceniaActiveFilter = filter;
    document.querySelectorAll('.zlecenia-filter-btn').forEach((btn) => {
        btn.classList.toggle('active', btn.dataset.filter === filter);
    });
    renderZleceniaList();
}

let wellsSnapshotBeforeZlecenia = null;

function openZleceniaProdukcyjne(targetWellId = null, targetElementIndex = null) {
    logger.info('orderManager', '[openZleceniaProdukcyjne] Initializing modal...', {
        targetWellId,
        targetElementIndex,
        wellsCount: wells.length,
        productsCount: studnieProducts.length
    });

    if (wells.length === 0) {
        showToast('Najpierw dodaj studnie lub wczytaj ofertę/zamówienie!', 'error');
        return;
    }

    wellsSnapshotBeforeZlecenia = structuredClone(wells);

    const modal = document.getElementById('zlecenia-modal');
    if (modal) modal.classList.add('active');

    const zwp = document.querySelector('.zlecenia-left');
    const dz = document.getElementById('drop-zone-diagram');
    if (zwp && dz) {
        zwp.innerHTML = '';
        zwp.appendChild(dz);
        dz.style.flex = '1';
        dz.style.border = 'none';
        dz.style.background = 'transparent';
        dz.style.padding = '0.8rem 1.2rem';
    }

    buildZleceniaWellList();

    if (zleceniaElementsList.length > 0) {
        let idxToSelect = 0;
        let foundIdx = -1;

        if (targetWellId) {
            foundIdx = zleceniaElementsList.findIndex(
                (el) =>
                    String(el.well.id) === String(targetWellId) &&
                    String(el.elementIndex) === String(targetElementIndex)
            );
            if (foundIdx === -1) {
                foundIdx = zleceniaElementsList.findIndex(
                    (el) => String(el.well.id) === String(targetWellId)
                );
            }
        } else if (targetElementIndex !== null) {
            foundIdx = zleceniaElementsList.findIndex(
                (el) => String(el.elementIndex) === String(targetElementIndex)
            );
        }

        if (foundIdx !== -1) {
            idxToSelect = foundIdx;
        }

        selectZleceniaElement(idxToSelect);
    }
}

async function closeZleceniaModal() {
    let savedNow = false;
    if (zleceniaElementsList.length > 0) {
        const shouldSave = await appConfirm(
            'Czy zapisać wszystkie zlecenia produkcyjne i zamówienie przed zamknięciem?',
            {
                title: 'Zamknięcie zlecenia',
                type: 'warning',
                okText: '<i data-lucide="save"></i> Zapisz i zamknij',
                cancelText: 'Zamknij bez zapisu'
            }
        );
        if (shouldSave) {
            await saveProductionOrdersData(productionOrders);
            await syncSourceData({ skipFreeze: true });
            wellsSnapshotBeforeZlecenia = structuredClone(wells);
            savedNow = true;
            showToast(
                '<i data-lucide="check-circle-2"></i> Zapisano zlecenia produkcyjne i zamówienie',
                'success'
            );
        }
    }

    if (!savedNow && wellsSnapshotBeforeZlecenia) {
        wells.length = 0;
        wells.push(...structuredClone(wellsSnapshotBeforeZlecenia));

        if (typeof renderWellsList === 'function') renderWellsList();
        if (typeof updateSummary === 'function') updateSummary();
        if (typeof refreshAll === 'function') refreshAll();
    }

    wellsSnapshotBeforeZlecenia = null;

    const modal = document.getElementById('zlecenia-modal');
    if (modal) modal.classList.remove('active');

    const mainLayout = document.querySelector('.well-app-layout');
    const dz = document.getElementById('drop-zone-diagram');
    if (mainLayout && dz) {
        dz.style.flex = '';
        dz.style.border = '';
        dz.style.background = '';
        dz.style.padding = '';
        mainLayout.insertBefore(dz, mainLayout.firstChild);
    }
}

function buildZleceniaWellList() {
    logger.info(
        'orderManager',
        '[buildZleceniaWellList] Building list from',
        wells.length,
        'wells'
    );
    zleceniaElementsList = [];
    wells.forEach((well, wIdx) => {
        if (!well.config) return;
        for (let eIdx = well.config.length - 1; eIdx >= 0; eIdx--) {
            const item = well.config[eIdx];
            let p = studnieProducts.find((pr) => pr.id === item.productId);

            if (!p && item.productId) {
                logger.warn(
                    'orderManager',
                    `[buildZleceniaWellList] Produkt o ID ${item.productId} nie został znaleziony w bazie! Próbuję dopasować po nazwie...`
                );
                p = {
                    id: item.productId,
                    name: 'Produkt nieznany (ID: ' + item.productId + ')',
                    componentType: 'dennica',
                    height: 0
                };
            }

            if (!p) continue;

            const realBaseIdx = findRealBaseIndex(well);
            const isBaseOfTangential = well.dn === 'styczna' && eIdx === realBaseIdx;

            if (
                p.componentType === 'dennica' ||
                p.componentType === 'krag_ot' ||
                isBaseOfTangential
            ) {
                zleceniaElementsList.push({
                    wellIndex: wIdx,
                    elementIndex: eIdx,
                    well: well,
                    product: p,
                    configItem: item
                });
            }
        }
    });

    logger.info(
        'orderManager',
        '[buildZleceniaWellList] Done. Elements found:',
        zleceniaElementsList.length
    );
    renderZleceniaList();
}

function findRealBaseIndex(well) {
    if (!well || !well.config) return -1;
    for (let i = well.config.length - 1; i >= 0; i--) {
        const item = well.config[i];
        const tmpP = studnieProducts.find((pr) => pr.id === item.productId);
        if (tmpP && tmpP.componentType !== 'uszczelka') {
            return i;
        }
    }
    return -1;
}

function renderZleceniaList() {
    const container = document.getElementById('zlecenia-elements-list');
    const countEl = document.getElementById('zlecenia-el-count');
    if (!container) return;

    const search = (document.getElementById('zlecenia-search')?.value || '').toLowerCase();

    const groupedElements = {};
    let visibleCount = 0;

    const statusPriority = { accepted: 0, saved: 1, open: 2 };
    const itemsWithStatus = zleceniaElementsList.map((el, i) => ({
        el,
        index: i,
        status: getElementStatus(el)
    }));

    itemsWithStatus.sort((a, b) => statusPriority[a.status] - statusPriority[b.status]);

    itemsWithStatus.forEach((item) => {
        const el = item.el;
        const savedPO = (productionOrders || []).find(
            (po) => po.wellId === el.well.id && po.elementIndex === el.elementIndex
        );
        const poNum =
            savedPO && savedPO.productionOrderNumber
                ? savedPO.productionOrderNumber.toLowerCase()
                : '';
        const matchesSearch =
            !search ||
            el.product.name.toLowerCase().includes(search) ||
            el.well.name.toLowerCase().includes(search) ||
            ('dn' + el.well.dn).toLowerCase().includes(search) ||
            poNum.includes(search);
        if (!matchesSearch) return;

        if (zleceniaActiveFilter === 'saved' && item.status === 'open') return;
        if (zleceniaActiveFilter === 'accepted' && item.status !== 'accepted') return;

        if (!groupedElements[el.wellIndex]) {
            groupedElements[el.wellIndex] = {
                wellName: el.well.name,
                wellDn: el.well.dn,
                elements: []
            };
        }
        groupedElements[el.wellIndex].elements.push({ el, index: item.index });
        visibleCount++;
    });

    let html = '';

    Object.keys(groupedElements).forEach((wIdx) => {
        const group = groupedElements[wIdx];

        html += `<div style="background:var(--bg-secondary); padding:0.6rem 0.8rem; border-bottom:1px solid var(--border-glass); border-top:1px solid var(--border-glass); position:sticky; top:0; z-index:5; display:flex; justify-content:space-between; align-items:center; margin-top:-1px;">
            <div style="font-size:0.75rem; font-weight:800; color:var(--accent-hover); text-transform:uppercase; letter-spacing:0.5px;"><i data-lucide="tag"></i> ${group.wellName}</div>
            <div style="font-size:0.65rem; font-weight:700; color:var(--text-muted); background:var(--bg-primary); padding:0.2rem 0.5rem; border-radius:12px; border:1px solid var(--border-glass);">${group.wellDn === 'styczna' ? 'Styczna' : 'DN' + group.wellDn}</div>
        </div>
        <div style="padding: 0.4rem;">`;

        group.elements.forEach((item) => {
            const el = item.el;
            const i = item.index;
            const isSaved = (productionOrders || []).some(
                (po) => po.wellId === el.well.id && po.elementIndex === el.elementIndex
            );
            const savedOrder = (productionOrders || []).find(
                (po) => po.wellId === el.well.id && po.elementIndex === el.elementIndex
            );
            const isAccepted = savedOrder && savedOrder.status === 'accepted';
            const isActive = i === zleceniaSelectedIdx;

            const savedProdOrder = (productionOrders || []).find(
                (po) => po.wellId === el.well.id && po.elementIndex === el.elementIndex
            );
            const prodOrderNum =
                savedProdOrder && savedProdOrder.productionOrderNumber
                    ? savedProdOrder.productionOrderNumber
                    : '';

            html += `<div class="zlecenia-el-item ${isActive ? 'active' : ''} ${isSaved ? 'saved' : ''} ${isAccepted ? 'accepted' : ''}" onclick="selectZleceniaElement(${i})" style="margin-bottom:0.3rem;">
                <div style="display:flex; justify-content:space-between; align-items:center;">
                    <div style="font-size:0.75rem; font-weight:700; color:var(--text-primary);">${el.product.name}</div>
                    <div style="display:flex; align-items:center; gap:0.3rem;">
                        ${prodOrderNum ? `<div style="font-size:0.6rem; font-weight:800; color:var(--accent-hover); background:rgba(var(--accent-hover-rgb),0.1); padding:0.1rem 0.4rem; border-radius:4px; border:1px solid rgba(var(--accent-hover-rgb),0.2);">${prodOrderNum}</div>` : ''}
                        ${isSaved && !isAccepted ? `<button class="btn-icon-danger btn-icon-xs" onclick="event.stopPropagation(); deleteProductionOrder('${savedOrder.id}')" title="Usuń zlecenie"><i data-lucide="trash-2"></i></button>` : ''}
                    </div>
                </div>
                ${isAccepted ? '<div style="font-size:0.55rem; color:var(--success-hover); margin-top:0.2rem; font-weight:700;">Zaakceptowane — studnia zablokowana</div>' : isSaved ? '<div style="font-size:0.55rem; color:var(--warn-hover); margin-top:0.2rem; font-weight:700;">Wersja robocza</div>' : ''}
            </div>`;
        });

        html += `</div>`;
    });

    if (html === '') {
        let msg = 'Brak elementów (dennic / kręgów z otworem).';
        if (wells.length === 0) {
            msg = 'Najpierw dodaj studnię lub wczytaj zamówienie.';
        } else if (zleceniaElementsList.length === 0) {
            msg =
                'Brak elementów produkcyjnych (wymagana dennica lub krąg z otworem). Sprawdź czy produkty są w cenniku.';
        } else {
            msg = 'Brak elementów spełniających kryteria filtra.';
        }
        html = `<div style="text-align:center; padding:1.5rem; color:var(--text-muted); font-size:0.75rem;">${msg}</div>`;
    }

    container.style.padding = '0';
    container.innerHTML = html;

    if (countEl) countEl.textContent = visibleCount + ' elementów';
}

function filterZleceniaList() {
    renderZleceniaList();
}

function selectZleceniaElement(idx) {
    zleceniaSelectedIdx = idx;
    renderZleceniaList();
    const el = zleceniaElementsList[idx];
    if (!el) return;

    if (currentWellIndex !== el.wellIndex) {
        currentWellIndex = el.wellIndex;
    }

    renderWellDiagram();
    renderZleceniaWellConfig();

    populateZleceniaForm(el);
}

function renderZleceniaWellConfig() {
    const tbody = document.getElementById('zlecenia-well-config-body');
    if (!tbody) return;
    const well = getCurrentWell();

    if (!well || !well.config || well.config.length === 0) {
        tbody.innerHTML =
            '<div style="text-align:center;padding:1rem;color:var(--text-muted);font-size:0.7rem;">Brak elementów</div>';
        return;
    }

    const typeBadge = {
        wlaz: { bg: '#374151', label: '<i data-lucide="circle-dot"></i>' },
        plyta_din: { bg: '#1e3a5f', label: '<i data-lucide="chevron-down" class="text-xs"></i>' },
        plyta_najazdowa: {
            bg: '#1e3a5f',
            label: '<i data-lucide="chevron-down" class="text-xs"></i>'
        },
        plyta_zamykajaca: {
            bg: '#1e3a5f',
            label: '<i data-lucide="chevron-down" class="text-xs"></i>'
        },
        pierscien_odciazajacy: { bg: '#1e3a5f', label: '<i data-lucide="settings"></i>' },
        konus: { bg: '#4c1d95', label: '<i data-lucide="diamond"></i>' },
        avr: { bg: '#44403c', label: '<i data-lucide="settings"></i>' },
        plyta_redukcyjna: { bg: '#4c1d95', label: '⬛' },
        krag: { bg: '#164e63', label: '<i data-lucide="square"></i>' },
        krag_ot: { bg: '#312e81', label: '<i data-lucide="square"></i>' },
        dennica: { bg: '#14532d', label: '<i data-lucide="square"></i>' },
        kineta: { bg: '#9d174d', label: '<i data-lucide="plug"></i>' }
    };

    let html = '';
    well.config.forEach((item, index) => {
        const p = studnieProducts.find((pr) => pr.id === item.productId);
        if (!p) return;
        const badge = typeBadge[p.componentType] || { bg: '#333', label: '?' };
        const isLocked = isWellLocked();

        const isCurrentlyEdited =
            zleceniaSelectedIdx !== -1 &&
            zleceniaElementsList[zleceniaSelectedIdx] &&
            zleceniaElementsList[zleceniaSelectedIdx].elementIndex === index;

        html += `<div data-zl-idx="${index}" class="config-tile" draggable="${!isLocked}" ondragstart="handleZlCfgDragStart(event)" ondragover="handleZlCfgDragOver(event)" ondrop="handleZlCfgDrop(event)" ondragend="handleZlCfgDragEnd(event)"
                      style="background:rgba(30,41,59,0.7); border:1px solid ${isCurrentlyEdited ? 'var(--accent)' : 'rgba(255,255,255,0.05)'}; border-left:4px solid ${badge.bg}; border-radius:6px; padding:0.35rem 0.5rem; margin-bottom:0.25rem; cursor:${isLocked ? 'default' : 'grab'}; transition:all 0.15s; ${isCurrentlyEdited ? 'box-shadow: 0 0 10px rgba(var(--accent-rgb),0.2); border-color:var(--accent-hover);' : ''}">
          <div style="display:flex; justify-content:space-between; align-items:center;">
            <div style="display:flex; align-items:center; gap:0.4rem;">
                <div style="display:flex; flex-direction:column; gap:1px; align-items:center; background:rgba(0,0,0,0.2); padding:0.1rem; border-radius:3px;">
                  <button onclick="event.stopPropagation(); moveZleceniaComponent(${index}, -1)" style="background:none; border:none; color:var(--text-muted); cursor:pointer; padding:0; display:${isLocked || index === 0 ? 'none' : 'block'};"><i data-lucide="chevron-up" class="text-xs"></i></button>
                  <span style="font-size:0.55rem; color:var(--text-primary); font-weight:700;">${index + 1}</span>
                  <button onclick="event.stopPropagation(); moveZleceniaComponent(${index}, 1)" style="background:none; border:none; color:var(--text-muted); cursor:pointer; padding:0; display:${isLocked || index === well.config.length - 1 ? 'none' : 'block'};"><i data-lucide="chevron-down" class="text-xs"></i></button>
                </div>
                <div style="display:flex; flex-direction:column;">
                  <div style="font-weight:700; color:var(--text-primary); font-size:0.68rem; line-height:1.1;">${p.name}${item.quantity > 1 ? ` (x${item.quantity})` : ''}</div>
                  <div style="font-size:0.55rem; color:var(--text-muted);">${p.height ? 'H=' + p.height + 'mm' : '—'}</div>
                </div>
            </div>
            ${isCurrentlyEdited ? '<span style="font-size:0.6rem; color:var(--accent-hover);"><i data-lucide="pencil"></i></span>' : ''}
          </div>
        </div>`;
    });

    tbody.innerHTML = html;
}

window.moveZleceniaComponent = function (index, dir) {
    if (isWellLocked()) return;
    const well = getCurrentWell();
    const newIdx = index + dir;
    if (newIdx < 0 || newIdx >= well.config.length) return;

    const currentElObj =
        zleceniaSelectedIdx !== -1 ? zleceniaElementsList[zleceniaSelectedIdx].configItem : null;

    const temp = well.config[index];
    well.config[index] = well.config[newIdx];
    well.config[newIdx] = temp;

    well.configSource = 'MANUAL';
    well.autoLocked = true;

    rebuildZleceniaListAndFocus(currentElObj);
    refreshZleceniaModal();
};

function rebuildZleceniaListAndFocus(targetObj) {
    initializeZleceniaModal();

    if (targetObj) {
        const newIdx = zleceniaElementsList.findIndex((el) => el.configItem === targetObj);
        if (newIdx !== -1) {
            zleceniaSelectedIdx = newIdx;
        }
    }
}

function refreshZleceniaModal() {
    renderZleceniaWellConfig();
    const well = getCurrentWell();
    const svg = document.getElementById('zlecenia-svg-preview');
    if (svg && well) {
        renderWellDiagram(svg, well);
    }
    renderZleceniaList();
}

let draggedZlIdx = null;

window.handleZlCfgDragStart = function (e) {
    if (isWellLocked()) {
        e.preventDefault();
        return;
    }
    draggedZlIdx = parseInt(e.currentTarget.getAttribute('data-zl-idx'));
    e.dataTransfer.effectAllowed = 'move';
    e.currentTarget.style.opacity = '0.4';
};

window.handleZlCfgDragOver = function (e) {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
};

window.handleZlCfgDrop = function (e) {
    e.preventDefault();
    const tile = e.target.closest('[data-zl-idx]');
    if (tile && draggedZlIdx !== null) {
        const dropIdx = parseInt(tile.getAttribute('data-zl-idx'));
        if (draggedZlIdx === dropIdx) return;

        const well = getCurrentWell();
        const currentElObj =
            zleceniaSelectedIdx !== -1
                ? zleceniaElementsList[zleceniaSelectedIdx].configItem
                : null;

        const item = well.config.splice(draggedZlIdx, 1)[0];
        well.config.splice(dropIdx, 0, item);

        well.configSource = 'MANUAL';
        well.autoLocked = true;

        rebuildZleceniaListAndFocus(currentElObj);
        refreshZleceniaModal();
    }
};

window.handleZlCfgDragEnd = function (e) {
    e.currentTarget.style.opacity = '1';
    draggedZlIdx = null;
};

function renderZleceniaSvgPreview(well) {
    const svg = document.getElementById('zlecenia-svg-preview');
    const info = document.getElementById('zlecenia-well-info-mini');
    if (!svg) return;

    renderWellDiagram(svg, well);
    renderZleceniaWellConfig();

    if (info) {
        const stats = calcWellStats(well);
        info.innerHTML =
            '<strong>' +
            escapeHtml(well.name) +
            '</strong> — DN' +
            escapeHtml(String(well.dn ?? '')) +
            ' — H: ' +
            fmtInt(stats.height) +
            'mm — ' +
            fmtInt(stats.weight) +
            'kg';
    }
}

function populateZleceniaForm(el) {
    const { well, product, configItem, elementIndex, wellIndex } = el;
    const container = document.getElementById('zlecenia-form-content');
    if (!container) return;

    const parsed = parseWysokoscGlebokosc(product.name);

    let displayDN = well.dn === 'styczna' ? 'Styczna' : 'DN' + well.dn;
    let displayGlebokosc = parsed.glebokosc || '—';
    let displayWysokosc = parsed.wysokosc || product.height || 0;
    let dnoKinetaVal = parsed.wysokosc - parsed.glebokosc;
    let displayDnoKineta = dnoKinetaVal > 0 ? dnoKinetaVal : '—';

    let actualNextProduct = null;
    for (let i = elementIndex + 1; i < well.config.length; i++) {
        const _p = studnieProducts.find((p) => p.id === well.config[i].productId);
        if (_p && _p.componentType !== 'uszczelka') {
            actualNextProduct = _p;
            break;
        }
    }

    const shouldReduce =
        product.componentType === 'dennica' &&
        ((actualNextProduct && actualNextProduct.componentType === 'dennica') ||
            (well.psiaBuda && !actualNextProduct));

    if (shouldReduce) {
        const reducedH = (product.height || 0) - 100;
        displayWysokosc = reducedH;
        displayGlebokosc = reducedH;
        displayDnoKineta = 0;
    }

    if (well.dn === 'styczna') {
        const dnMatch = (product.name || '').match(/DN\s*(\d+)/i);
        if (dnMatch) displayDN = `Styczna DN${dnMatch[1]}`;

        displayGlebokosc = product.height || '—';
        displayWysokosc = parsed.wysokosc || displayWysokosc;
        displayDnoKineta =
            parsed.wysokosc > 0 && parsed.glebokosc > 0 ? parsed.wysokosc - parsed.glebokosc : '—';
    }

    const din = getStudniaDIN(well.dn);
    const todayStr = new Date().toISOString().split('T')[0];
    const orderNumber = orderEditMode
        ? orderEditMode.order.number
        : document.getElementById('offer-number')?.value || '';

    const userName = currentUser
        ? ((currentUser.firstName || '') + ' ' + (currentUser.lastName || '')).trim() ||
          currentUser.username
        : '';
    const clientName = document.getElementById('client-name')?.value || '';
    const investName = document.getElementById('invest-name')?.value || '';
    const investAddress = document.getElementById('invest-address')?.value || '';
    const investContractor = document.getElementById('invest-contractor')?.value || '';

    const existing = (productionOrders || []).find(
        (po) => po.wellId === well.id && po.elementIndex === elementIndex
    );
    const isAccepted = existing && existing.status === 'accepted';

    const btnAccept = document.getElementById('zl-btn-accept');
    const btnRevoke = document.getElementById('zl-btn-revoke');
    const btnDelete = document.getElementById('zl-btn-delete');
    const btnSave = document.getElementById('zl-btn-save');

    if (btnAccept) btnAccept.style.display = isAccepted ? 'none' : 'block';
    if (btnRevoke) btnRevoke.style.display = isAccepted ? 'block' : 'none';
    if (btnDelete) btnDelete.style.display = isAccepted ? 'none' : 'block';
    if (btnSave) btnSave.style.display = isAccepted ? 'none' : 'block';

    const rzDna = parseFloat(well.rzednaDna) || 0;
    const findProductFn = (id) => studnieProducts.find((pr) => pr.id === id);
    const configMap = buildConfigMap(well, findProductFn, true);

    const assignedPrzejscia = (well.przejscia || []).filter((item) => {
        let pel = parseFloat(item.rzednaWlaczenia);
        if (isNaN(pel)) pel = rzDna;
        const mmFromBottom = (pel - rzDna) * 1000;
        const { assignedIndex } = findAssignedElement(mmFromBottom, configMap);
        return assignedIndex === elementIndex;
    });
    const przejsciaCount = assignedPrzejscia.length;

    const stopnieOptions = [
        ['', 'Brak'],
        ['drabinka_a_stalowa', 'Drabinka Typ A/stalowa'],
        ['drabinka_a_szlachetna', 'Drabinka Typ A/stal szlachetna'],
        ['drabinka_b_stalowa', 'Drabinka Typ B/stalowa'],
        ['drabinka_b_szlachetna', 'Drabinka Typ B/stal szlachetna'],
        ['inne', 'Inne']
    ];

    let baseKatStopni = '';
    let baseRodzajStopni = '';
    const dennicaConfigIdx = well.config.findIndex((c) => {
        const p = findProductFn(c.productId);
        return p && p.componentType === 'dennica';
    });

    if (dennicaConfigIdx >= 0 && elementIndex !== dennicaConfigIdx) {
        const dennicaPo = (productionOrders || []).find(
            (po) => po.wellId === well.id && po.elementIndex === dennicaConfigIdx
        );
        if (dennicaPo) {
            if (dennicaPo.katStopni) baseKatStopni = dennicaPo.katStopni;
            if (dennicaPo.rodzajStopni) baseRodzajStopni = dennicaPo.rodzajStopni;
        }
    }

    if (!baseRodzajStopni) {
        if (well._selectedRodzajStopni) {
            baseRodzajStopni = well._selectedRodzajStopni;
        } else if (well.stopnie === 'drabinka') {
            baseRodzajStopni = 'drabinka_a_stalowa';
        } else if (well.stopnie === 'nierdzewna') {
            baseRodzajStopni = 'drabinka_a_szlachetna';
        } else if (well.stopnie === 'brak') {
            baseRodzajStopni = '';
        }
    }

    const katStopni = existing?.katStopni || baseKatStopni || '';
    const wykonanie = katStopni ? calcStopnieExecution(katStopni) : '';
    const stopnieVal = existing?.rodzajStopni || baseRodzajStopni || '';

    const isKragOt = product && product.componentType === 'krag_ot';
    const isAnyKrag = product && product.componentType && product.componentType.startsWith('krag');
    const shouldForceBrak = shouldReduce || isKragOt;
    const redKinetyVal =
        existing?.redukcjaKinety ?? (shouldForceBrak ? 'nie' : (well.redukcjaKinety ?? ''));
    const spocznikHVal = existing?.spocznikH ?? (shouldForceBrak ? 'brak' : (well.spocznikH ?? ''));
    const usytuowanieVal = existing?.usytuowanie ?? well.usytuowanie ?? '';
    const kinetaVal = existing?.kineta ?? (shouldForceBrak ? 'brak' : (well.kineta ?? ''));
    const klasaBetonuVal = existing?.klasaBetonu ?? well.klasaBetonu ?? '';

    const katOptions = ['90', '135', '180', '270'];

    const spocznikMatOptions = [
        ['brak', 'Brak'],
        ['beton', 'Beton'],
        ['beton_gfk', 'Beton z GFK'],
        ['klinkier', 'Klinkier'],
        ['preco', 'Preco'],
        ['precotop', 'Preco Top'],
        ['unolith', 'UnoLith'],
        ['predl', 'Predl'],
        ['kamionka', 'Kamionka']
    ];

    const rodzajStudniOptions = [
        ['beton', 'Beton'],
        ['zelbet', 'Żelbet']
    ];

    const dinVal = existing?.din ?? din;
    const spocznikMatVal = existing?.spocznik ?? (shouldForceBrak ? 'brak' : (well.spocznik ?? ''));

    let domyslnyRodzajStudni = '';
    if (product && product.componentType === 'dennica') {
        domyslnyRodzajStudni = well.dennicaMaterial === 'zelbetowa' ? 'zelbet' : 'beton';
    } else {
        domyslnyRodzajStudni = well.nadbudowa === 'zelbetowa' ? 'zelbet' : 'beton';
    }
    const rodzajStudniVal = existing?.rodzajStudni || domyslnyRodzajStudni;

    const kinetaOptions = [
        ['brak', 'Brak'],
        ['beton', 'Beton'],
        ['beton_gfk', 'Beton z GFK'],
        ['klinkier', 'Klinkier'],
        ['preco', 'Preco'],
        ['precotop', 'PrecoTop'],
        ['unolith', 'UnoLith'],
        ['predl', 'Predl'],
        ['kamionka', 'Kamionka']
    ];
    const spocznikOptions = [
        ['1/2', '1/2'],
        ['2/3', '2/3'],
        ['3/4', '3/4'],
        ['1/1', '1/1'],
        ['brak', 'Brak']
    ];
    const usytOptions = [
        ['linia_dolna', 'Linia dolna'],
        ['linia_gorna', 'Linia górna'],
        ['w_osi', 'W osi'],
        ['patrz_uwagi', 'Patrz uwagi']
    ];
    const redKinetyOptions = [
        ['tak', 'Tak'],
        ['nie', 'Nie']
    ];
    const klasaBetonuOptions = [
        ['C40/50', 'C40/50'],
        ['C40/50(HSR!!!!)', 'C40/50 HSR'],
        ['C45/55', 'C45/55'],
        ['C45/55(HSR!!!!)', 'C45/55 HSR'],
        ['C70/85', 'C70/85'],
        ['C70/80(HSR!!!!)', 'C70/80 HSR']
    ];

    let autoUwagi = [];

    if (well.agresjaChemiczna === 'XA2' || well.agresjaChemiczna === 'XA3')
        autoUwagi.push('Agresja chem. ' + well.agresjaChemiczna);

    if (well.agresjaMrozowa === 'XF2' || well.agresjaMrozowa === 'XF3')
        autoUwagi.push('Agresja mroz. ' + well.agresjaMrozowa);

    let wklUwagi = [];
    if (well.wkladkaDennica && well.wkladkaDennica !== 'brak')
        wklUwagi.push('Dennica ' + well.wkladkaDennica);
    if (well.wkladkaNadbudowa && well.wkladkaNadbudowa !== 'brak')
        wklUwagi.push('Nadbudowa ' + well.wkladkaNadbudowa);
    if (well.wkladkaZwienczenie && well.wkladkaZwienczenie !== 'brak')
        wklUwagi.push('Zwieńczenie ' + well.wkladkaZwienczenie);
    if (wklUwagi.length > 0) autoUwagi.push('PEHD: ' + wklUwagi.join(', '));

    if (well.malowanieW && well.malowanieW !== 'brak') {
        let malWDesc = '';
        if (well.malowanieW === 'kineta') malWDesc = 'Kineta';
        else if (well.malowanieW === 'kineta_dennica') malWDesc = 'Kineta+denn.';
        else if (well.malowanieW === 'cale') malWDesc = 'Całość';
        if (malWDesc) {
            autoUwagi.push(
                'Malowanie wew. ' + malWDesc + (well.powlokaNameW ? ' ' + well.powlokaNameW : '')
            );
        }
    }

    if (well.malowanieZ === 'zewnatrz') {
        autoUwagi.push(
            'Malowanie zew. Zewnątrz' + (well.powlokaNameZ ? ' ' + well.powlokaNameZ : '')
        );
    }

    if (well.dn === 'styczna') autoUwagi.push('STYCZNA');

    if (well.klasaNosnosci_korpus === 'E600' || well.klasaNosnosci_korpus === 'F900') {
        autoUwagi.push('Kl. nośn. ' + well.klasaNosnosci_korpus);
    }

    if (well.psiaBuda && !actualNextProduct) {
        autoUwagi.push('UWAGA ! PSIA BUDA');
    }
    if (
        product.componentType === 'dennica' &&
        actualNextProduct &&
        actualNextProduct.componentType === 'dennica'
    ) {
        autoUwagi.push('UWAGA ! KRĄG NA FORMIE STUDNI');
    }

    const defaultUwagiStr = autoUwagi.join(', ');
    const finalUwagi = existing?.uwagi !== undefined ? existing.uwagi : defaultUwagiStr;

    let bannerHtml = '';
    if (isAccepted) {
        bannerHtml = `
            <div style="background:rgba(var(--danger-rgb),0.15); border:2px solid rgba(var(--danger-rgb),0.4); border-radius:10px; padding:0.8rem 1rem; display:flex; align-items:center; gap:0.8rem; margin-bottom:0.5rem;">
                <span style="font-size:1.5rem;"><i data-lucide="lock"></i></span>
                <div style="flex:1;">
                    <div style="font-size:0.85rem; font-weight:800; color:var(--danger-hover); text-transform:uppercase; letter-spacing:0.5px;">Zlecenie zaakceptowane</div>
                    <div style="font-size:0.7rem; color:var(--text-muted);">Edycja jest zablokowana. Aby wprowadzić zmiany, najpierw cofnij akceptację przyciskiem na górze.</div>
                </div>
            </div>
        `;
    }

    recalculateWellErrors(well);
    const liveErrors = well.configErrors || [];
    let errorsHtml = '';
    if (liveErrors.length > 0) {
        errorsHtml = `
            <div style="margin-bottom: 0.5rem; padding: 0.4rem 0.6rem; background: rgba(var(--danger-rgb), 0.08); border: 1px solid rgba(var(--danger-rgb), 0.3); border-radius: 6px; color: var(--danger); font-size: 0.75rem; font-weight: 600; line-height: 1.4;">
                <i data-lucide="alert-triangle"></i> Błędy w konfiguracji studni:<br>
                ${liveErrors.map((e) => `• ${e}`).join('<br>')}
            </div>
        `;
    }

    let przejsciaAppVisible = false;
    const existingPrzejsciaContainer = document.getElementById('zl-inline-przejscia-app-container');
    if (existingPrzejsciaContainer && existingPrzejsciaContainer.style.display !== 'none') {
        przejsciaAppVisible = true;
    }

    let daneZleceniaVisible = false;
    const existingDaneZlecenia = document.getElementById('zl-dane-zlecenia-container');
    if (existingDaneZlecenia && existingDaneZlecenia.style.display !== 'none') {
        daneZleceniaVisible = true;
    }

    let daneElementuVisible = true;
    const existingDaneElementu = document.getElementById('zl-dane-elementu-content');
    if (existingDaneElementu) {
        daneElementuVisible = existingDaneElementu.style.display !== 'none';
    }

    container.innerHTML = `
    ${bannerHtml}
    ${errorsHtml}
    <div class="card card-compact" style="margin-bottom:0.5rem;">
        <div class="card-title-sm" onclick="const b=this.nextElementSibling; b.style.display=b.style.display==='none'?'grid':'none'; this.querySelector('.zl-toggle').innerHTML=b.style.display==='none'?'<i data-lucide=\\'chevron-down\\'></i>':'<i data-lucide=\\'chevron-up\\'></i>'; if(window.lucide) window.lucide.createIcons();" style="cursor:pointer; user-select:none; display:flex; justify-content:space-between; align-items:center;">
            <span><i data-lucide="clipboard-list"></i> Dane zlecenia <span style="margin-left:8px; color:var(--accent-hover); font-weight:800;">${escapeHtml(existing?.productionOrderNumber || '— nowy —')}</span></span>
            <span class="zl-toggle" class="text-xs">${daneZleceniaVisible ? '<i data-lucide="chevron-up"></i>' : '<i data-lucide="chevron-down"></i>'}</span>
        </div>
        <div id="zl-dane-zlecenia-container" style="display:${daneZleceniaVisible ? 'grid' : 'none'}; grid-template-columns:1fr 1fr; gap:0.5rem; padding:0.2rem 0;">
            <div class="form-group-sm" style="margin:0;">
                <label class="form-label-sm ui-text-sec">Obiekt</label>
                <input type="text" id="zl-obiekt" class="form-input form-input-sm" value="${escapeHtml(existing?.obiekt || investName)}" placeholder="Nazwa obiektu...">
            </div>
            <div class="form-group-sm" style="margin:0;">
                <label class="form-label-sm ui-text-sec">Data</label>
                <input type="text" id="zl-data" class="form-input form-input-sm" value="${escapeHtml(existing?.data || todayStr)}" readonly style="background:rgba(255,255,255,0.02); color:var(--accent-hover); font-weight:700;">
            </div>
            <div class="form-group-sm" style="margin:0;">
                <label class="form-label-sm ui-text-sec">Adres</label>
                <input type="text" id="zl-adres" class="form-input form-input-sm" value="${escapeHtml(existing?.adres || investAddress)}" placeholder="Adres obiektu...">
            </div>
            <div class="form-group-sm" style="margin:0;">
                <label class="form-label-sm ui-text-sec">Nazwisko (przygotował)</label>
                <input type="text" id="zl-nazwisko" class="form-input form-input-sm" value="${escapeHtml(existing?.nazwisko || userName)}" readonly style="background:rgba(255,255,255,0.02); color:var(--accent-hover); font-weight:700;">
            </div>
            <div class="form-group-sm" style="margin:0;">
                <label class="form-label-sm ui-text-sec">Wykonawca</label>
                <input type="text" id="zl-wykonawca" class="form-input form-input-sm" value="${escapeHtml(existing?.wykonawca || investContractor)}" placeholder="Wykonawca...">
            </div>
            <div class="form-group-sm" style="margin:0;">
                <label class="form-label-sm ui-text-sec">Data produkcji</label>
                <input type="date" id="zl-data-produkcji" class="form-input form-input-sm" value="${escapeHtml(existing?.dataProdukcji || '')}">
            </div>
            <div class="form-group-sm" style="grid-column: 1 / -1; margin:0;">
                <label class="form-label-sm ui-text-sec">Fakturowane na</label>
                <input type="text" id="zl-fakturowane" class="form-input form-input-sm" value="${escapeHtml(existing?.fakturowane || clientName)}" readonly style="background:rgba(255,255,255,0.02); color:var(--accent-hover); font-weight:700;">
            </div>
        </div>
    </div>

    <div id="zl-dane-elementu-grid" style="display:grid; grid-template-columns:${daneElementuVisible ? '230px' : '36px'} 1fr; gap:0.5rem; margin-bottom:0.5rem; transition:grid-template-columns 0.25s ease;">
        <div class="card card-compact" style="overflow:hidden; min-width:0; transition:all 0.25s ease; position:relative;">
            <div id="zl-dane-elementu-header-full" class="card-title-sm" onclick="window.toggleDaneElementu()" style="cursor:pointer; user-select:none; display:${daneElementuVisible ? 'flex' : 'none'}; justify-content:space-between; align-items:center;">
                <span><i data-lucide="hard-hat"></i> Dane elementu</span>
                <span class="text-xs"><i data-lucide="chevron-left"></i></span>
            </div>
            <div id="zl-dane-elementu-header-collapsed" onclick="window.toggleDaneElementu()" style="cursor:pointer; user-select:none; display:${daneElementuVisible ? 'none' : 'flex'}; flex-direction:column; align-items:center; justify-content:center; height:100%; gap:0.5rem; padding:0.5rem 0;">
                <span class="text-xs"><i data-lucide="chevron-right"></i></span>
                <span style="writing-mode:vertical-lr; text-orientation:mixed; font-size:0.7rem; font-weight:700; color:var(--text-secondary); letter-spacing:1px; text-transform:uppercase;">Dane elementu</span>
            </div>
            <div id="zl-dane-elementu-content" style="display:${daneElementuVisible ? 'flex' : 'none'}; flex-direction:column; gap:0.5rem; font-size:0.75rem;">
                <div style="display:flex; align-items:center; gap:0.5rem;">
                    <span style="color:var(--text-secondary); font-size:0.75rem; text-transform:uppercase; font-weight:600;">Numer studni</span>
                    <span style="font-weight:bold; color:var(--accent-hover); font-size:0.85rem;">${escapeHtml(well.name || '')}</span>
                </div>

                <div style="display:grid; grid-template-columns:1fr 1fr; gap:0.5rem; margin-top:0.2rem; background:#0d1520; padding:0.6rem; border-radius:var(--radius-sm); border:1px solid var(--border-glass);">
                    <div style="display:flex; flex-direction:column; gap:0.2rem;">
                        <span style="color:var(--text-muted); font-size:0.65rem; text-transform:uppercase;">Średnica</span>
                        <span style="font-weight:bold; color:var(--text-primary); font-size:0.75rem;">${displayDN}</span>
                        <input type="hidden" id="zl-srednica" value="${displayDN}">
                    </div>
                    <div style="display:flex; flex-direction:column; gap:0.2rem;">
                        <span style="color:var(--text-muted); font-size:0.65rem; text-transform:uppercase;">Głębokość</span>
                        <span style="font-weight:bold; color:var(--text-primary); font-size:0.75rem;">${displayGlebokosc}${typeof displayGlebokosc === 'number' ? ' mm' : ''}</span>
                        <input type="hidden" id="zl-glebokosc" value="${displayGlebokosc}">
                    </div>
                    <div style="display:flex; flex-direction:column; gap:0.2rem;">
                        <span style="color:var(--text-muted); font-size:0.65rem; text-transform:uppercase;">Wysokość</span>
                        <span style="font-weight:bold; color:var(--text-primary); font-size:0.75rem;">${displayWysokosc}${typeof displayWysokosc === 'number' ? ' mm' : ''}</span>
                        <input type="hidden" id="zl-wysokosc" value="${displayWysokosc}">
                    </div>
                    <div style="display:flex; flex-direction:column; gap:0.2rem;">
                        <span style="color:var(--text-muted); font-size:0.65rem; text-transform:uppercase;">Gr. dna</span>
                        <span style="font-weight:bold; color:var(--text-primary); font-size:0.75rem;">${displayDnoKineta}</span>
                        <input type="hidden" id="zl-dno-kineta" value="${displayDnoKineta}">
                    </div>
                </div>

                <div class="form-group-sm" style="margin-top:0.3rem;">
                    <label class="form-label-sm ui-text-sec">Rodzaj studni</label>
                    <div style="display:grid; grid-template-columns:1fr 1fr; gap:0.5rem; margin-top:0.3rem;" class="zl-param-group">
                        ${rodzajStudniOptions
                            .map(
                                ([v, l]) =>
                                    `<button type="button" class="param-tile ${v === rodzajStudniVal ? 'active' : ''}" style="padding:0.6rem; font-size:0.85rem; font-weight:800; letter-spacing:0.5px; border-radius:8px;" onclick="selectZleceniaTile(this, 'zl-rodzaj-studni', '${v}')">${l}</button>`
                            )
                            .join('')}
                    </div>
                    <input type="hidden" id="zl-rodzaj-studni" value="${rodzajStudniVal}">
                </div>

            </div>
        </div>

        <div style="display:flex; flex-direction:column; gap:0.5rem; min-width:0;">
            <div class="card card-compact" style="padding:0.5rem 0.6rem;">
                <div class="card-title-sm" style="display:flex; align-items:center; justify-content:space-between; cursor:pointer; margin-bottom:0; font-size:0.78rem; padding:0.15rem 0;" onclick="window.toggleCard('zl-inline-przejscia-app-container', 'zl-przejscia-app-icon')">
                    <span><i data-lucide="plus"></i> Dodaj Przejście Szczelne</span>
                    <span id="zl-przejscia-app-icon" class="text-xs"><i data-lucide="chevron-up"></i></span>
                </div>
                <div id="zl-inline-przejscia-app-container" class="card-content" style="margin-top:0.5rem; display:block;">
                    <div id="zl-inline-przejscia-app"></div>
                </div>
            </div>

            <div class="card card-compact" style="display:flex; flex-direction:column; box-sizing:border-box; overflow-x:auto; padding:0.5rem 0.6rem; flex:1;">
                <div class="card-title-sm" style="display:flex; justify-content:space-between; margin-bottom:0.5rem;">
                    <span><i data-lucide="link"></i> Lista przejść</span>
                    <span id="zl-przejscia-count" style="color:var(--text-muted); font-size:0.7rem;">(${przejsciaCount})</span>
                </div>
                <div id="zl-przejscia-list" style="flex:1; border-radius:var(--radius-sm); font-size:0.72rem; color:var(--text-secondary); display:flex; flex-direction:column; overflow-y:auto; overflow-x:auto; min-width:100%;">
                </div>
            </div>
        </div>
    </div>

    <div class="card card-compact" style="margin-bottom:0.5rem; display:flex; flex-direction:column;">
        <div class="card-title-sm"><i data-lucide="edit"></i> Uwagi</div>
        <div class="form-group-sm" style="flex:1; display:flex; flex-direction:column; margin-bottom:0;">
            <textarea id="zl-uwagi" class="form-textarea" placeholder="Uwagi do zlecenia..." style="flex:1; min-height:80px; resize:none;">${finalUwagi}</textarea>
        </div>
    </div>

    <div class="card card-compact" style="margin-bottom:0.5rem;">
        <div class="card-title-sm"><i data-lucide="settings"></i> Parametry studni</div>

        <div style="display:grid; grid-template-columns:1fr 1fr; gap:0.5rem; align-items:start;">
            <div style="display:flex; flex-direction:column; gap:0.5rem;">
                <div class="form-group-sm" ${isAnyKrag ? 'style="opacity:0.5; pointer-events:none;"' : ''}>
                    <label class="form-label-sm">Redukcja kinety</label>
                    <div class="ui-row-gap zl-param-group">
                        ${redKinetyOptions
                            .map(
                                ([v, l]) =>
                                    `<button type="button" class="param-tile ui-badge ${v === redKinetyVal ? 'active' : ''}" onclick="selectZleceniaTile(this, 'zl-red-kinety', '${v}')">${l}</button>`
                            )
                            .join('')}
                    </div>
                    <input type="hidden" id="zl-red-kinety" value="${redKinetyVal}">
                </div>

                <div class="form-group-sm">
                    <label class="form-label-sm">Studnia wd. DIN</label>
                    <div class="ui-row-gap zl-param-group">
                        <input type="text" id="zl-din" class="form-input form-input-sm" value="${dinVal}" style="width:100%; color:var(--accent-hover); font-weight:700;">
                    </div>
                </div>

                <div class="form-group-sm">
                    <label class="form-label-sm">Rodzaj stopni</label>
                    <div class="ui-row-gap zl-param-group">
                        ${stopnieOptions
                            .map(
                                ([v, l]) =>
                                    `<button type="button" class="param-tile ui-badge ${v === stopnieVal ? 'active' : ''}" onclick="selectZleceniaTile(this, 'zl-rodzaj-stopni', '${v}')">${l}</button>`
                            )
                            .join('')}
                    </div>
                    <input type="hidden" id="zl-rodzaj-stopni" value="${stopnieVal}">
                </div>

                <div id="zl-stopnie-inne-wrap" style="display:${stopnieVal === 'inne' ? 'block' : 'none'};">
                    <div class="form-group-sm">
                        <label class="form-label-sm">Inne (opis)</label>
                        <input type="text" id="zl-stopnie-inne" class="form-input form-input-sm" value="${existing?.stopnieInne || ''}" placeholder="Opis...">
                    </div>
                </div>

                <div class="form-group-sm">
                    <label class="form-label-sm">Ustalanie kąta stopni / Wykonanie</label>
                    <div style="display:flex; gap:0.25rem; flex-wrap:wrap; margin-top:0.2rem; align-items:center;" class="zl-param-group">
                        <input type="number" id="zl-kat-stopni" class="form-input form-input-sm" value="${katStopni}" placeholder="np. 90" min="0" max="360" onclick="this.select()" oninput="onZleceniaKatChange()" style="width:70px;">
                        <span style="font-size:1.2rem; color:var(--text-muted); margin: 0 4px;">→</span>
                        <input type="text" id="zl-wykonanie" class="form-input form-input-sm" value="${wykonanie ? wykonanie + '°' : ''}" readonly style="width:70px; color:var(--accent-hover); font-weight:700; margin-right:5px; pointer-events:none;">
                        ${katOptions
                            .map(
                                (v) =>
                                    `<button type="button" class="param-tile ui-badge" onclick="document.getElementById('zl-kat-stopni').value='${v}'; onZleceniaKatChange();">${v}°</button>`
                            )
                            .join('')}
                    </div>
                </div>
            </div>

            <div style="display:flex; flex-direction:column; gap:0.5rem;">
                <div class="form-group-sm" ${isKragOt ? 'style="opacity:0.5; pointer-events:none;"' : ''}>
                    <label class="form-label-sm">Wysokość spocznika</label>
                    <div class="ui-row-gap zl-param-group">
                        ${spocznikOptions
                            .map(
                                ([v, l]) =>
                                    `<button type="button" class="param-tile ui-badge ${v === spocznikHVal ? 'active' : ''}" onclick="selectZleceniaTile(this, 'zl-spocznik-h', '${v}')">${l}</button>`
                            )
                            .join('')}
                    </div>
                    <input type="hidden" id="zl-spocznik-h" value="${spocznikHVal}">
                </div>

                <div class="form-group-sm">
                    <label class="form-label-sm">Usytuowanie</label>
                    <div class="ui-row-gap zl-param-group">
                        ${usytOptions
                            .map(
                                ([v, l]) =>
                                    `<button type="button" class="param-tile ui-badge ${v === usytuowanieVal ? 'active' : ''}" onclick="selectZleceniaTile(this, 'zl-usytuowanie', '${v}')">${l}</button>`
                            )
                            .join('')}
                    </div>
                    <input type="hidden" id="zl-usytuowanie" value="${usytuowanieVal}">
                </div>

                <div class="form-group-sm" ${isKragOt ? 'style="opacity:0.5; pointer-events:none;"' : ''}>
                    <label class="form-label-sm">Kineta</label>
                    <div class="ui-row-gap zl-param-group">
                        ${kinetaOptions
                            .map(
                                ([v, l]) =>
                                    `<button type="button" class="param-tile ui-badge ${v === kinetaVal ? 'active' : ''}" onclick="selectZleceniaTile(this, 'zl-kineta', '${v}')">${l}</button>`
                            )
                            .join('')}
                    </div>
                    <input type="hidden" id="zl-kineta" value="${kinetaVal}">
                </div>

                <div class="form-group-sm" ${isKragOt ? 'style="opacity:0.5; pointer-events:none;"' : ''}>
                    <label class="form-label-sm">Spocznik</label>
                    <div class="ui-row-gap zl-param-group">
                        ${spocznikMatOptions
                            .map(
                                ([v, l]) =>
                                    `<button type="button" class="param-tile ui-badge ${v === spocznikMatVal ? 'active' : ''}" onclick="selectZleceniaTile(this, 'zl-spocznik', '${v}')">${l}</button>`
                            )
                            .join('')}
                    </div>
                    <input type="hidden" id="zl-spocznik" value="${spocznikMatVal}">
                </div>

                <div class="form-group-sm">
                    <label class="form-label-sm">Klasa betonu</label>
                    <div class="ui-row-gap zl-param-group">
                        ${klasaBetonuOptions
                            .map(
                                ([v, l]) =>
                                    `<button type="button" class="param-tile ui-badge ${v === klasaBetonuVal ? 'active' : ''}" onclick="selectZleceniaTile(this, 'zl-klasa-betonu', '${v}')">${l}</button>`
                            )
                            .join('')}
                    </div>
                    <input type="hidden" id="zl-klasa-betonu" value="${klasaBetonuVal}">
                </div>
            </div>
        </div>
    </div>
    `;

    if (isAccepted) {
        setTimeout(() => {
            container.querySelectorAll('input, textarea, button').forEach((el) => {
                el.disabled = true;
                if (el.tagName === 'BUTTON' && el.classList.contains('param-tile')) {
                    el.style.opacity = '0.7';
                    el.style.cursor = 'not-allowed';
                }
            });
            const transitionsApp = document.getElementById('zl-inline-przejscia-app-container');
            if (transitionsApp) {
                transitionsApp.style.pointerEvents = 'none';
                transitionsApp.style.opacity = '0.6';
            }
        }, 10);
    }

    renderInlinePrzejsciaApp('zl-inline-przejscia-app');
    renderWellPrzejscia({
        containerId: 'zl-przejscia-list',
        countElId: 'zl-przejscia-count',
        filterElementIndex: elementIndex
    });

    if (window.lucide) {
        window.lucide.createIcons();
    }
}

async function selectZleceniaTile(btn, targetId, val) {
    const group = btn.closest('.zl-param-group');
    if (group) {
        group.querySelectorAll('.param-tile').forEach((b) => b.classList.remove('active'));
    }
    btn.classList.add('active');

    const input = document.getElementById(targetId);
    if (input) {
        input.value = val;
    }

    if (targetId === 'zl-rodzaj-stopni') {
        onZleceniaStopnieChange();
    }

    if (
        [
            'zl-rodzaj-studni',
            'zl-rodzaj-stopni',
            'zl-red-kinety',
            'zl-spocznik-h',
            'zl-usytuowanie',
            'zl-kineta',
            'zl-spocznik',
            'zl-klasa-betonu'
        ].includes(targetId)
    ) {
        if (typeof zleceniaSelectedIdx === 'number' && zleceniaElementsList) {
            const el = zleceniaElementsList[zleceniaSelectedIdx];
            if (el && el.well && el.product) {
                const tempUwagi = document.getElementById('zl-uwagi')
                    ? document.getElementById('zl-uwagi').value
                    : '';

                const existing = productionOrders.find(
                    (po) => po.wellId === el.well.id && po.elementIndex === el.elementIndex
                );

                if (targetId === 'zl-rodzaj-studni') {
                    if (el.product.componentType === 'dennica') {
                        el.well.dennicaMaterial = val === 'zelbet' ? 'zelbetowa' : 'betonowa';
                    } else {
                        el.well.nadbudowa = val === 'zelbet' ? 'zelbetowa' : 'betonowa';
                    }
                    if (existing) existing.rodzajStudni = val;
                } else if (targetId === 'zl-red-kinety') {
                    el.well.redukcjaKinety = val;
                    if (existing) existing.redukcjaKinety = val;
                } else if (targetId === 'zl-spocznik-h') {
                    el.well.spocznikH = val;
                    if (existing) existing.spocznikH = val;
                } else if (targetId === 'zl-usytuowanie') {
                    el.well.usytuowanie = val;
                    if (existing) existing.usytuowanie = val;
                } else if (targetId === 'zl-kineta') {
                    el.well.kineta = val;
                    if (existing) existing.kineta = val;

                    const syncValues = [
                        'beton',
                        'beton_gfk',
                        'klinkier',
                        'preco',
                        'precotop',
                        'unolith',
                        'predl',
                        'kamionka',
                        'brak'
                    ];
                    if (syncValues.includes(val)) {
                        const spocznikInput = document.getElementById('zl-spocznik');
                        if (spocznikInput) {
                            const group = spocznikInput.closest('.form-group-sm');
                            if (group) {
                                const targetBtn = group.querySelector(
                                    `.param-tile[onclick*="'zl-spocznik', '${val}'"]`
                                );
                                if (targetBtn && !targetBtn.classList.contains('active')) {
                                    targetBtn.click();
                                }
                            }
                        }
                    }
                } else if (targetId === 'zl-spocznik') {
                    el.well.spocznik = val;
                    if (existing) existing.spocznik = val;
                } else if (targetId === 'zl-klasa-betonu') {
                    el.well.klasaBetonu = val;
                    if (existing) existing.klasaBetonu = val;
                } else if (targetId === 'zl-rodzaj-stopni') {
                    let newStopnie = null;
                    if (val === '' || val === 'brak') {
                        newStopnie = 'brak';
                        el.well._selectedRodzajStopni = '';
                    } else if (val.includes('szlachetna')) {
                        newStopnie = 'nierdzewna';
                        el.well._selectedRodzajStopni = val;
                    } else if (val.includes('stalowa')) {
                        newStopnie = 'drabinka';
                        el.well._selectedRodzajStopni = val;
                    } else if (val === 'inne') {
                        el.well._selectedRodzajStopni = val;
                    }

                    const stopnieIndexChanged =
                        newStopnie !== null && newStopnie !== el.well.stopnie;
                    if (stopnieIndexChanged) {
                        el.well.stopnie = newStopnie;
                    }
                    if (existing) existing.rodzajStopni = val;

                    if (!stopnieIndexChanged) {
                        return;
                    }
                }

                if (typeof window.updateParamTilesUI === 'function') window.updateParamTilesUI();

                const oldWellIdx = el.wellIndex;
                const oldCat = el.product.category;
                const oldElementIndex = el.elementIndex;

                if (targetId === 'zl-rodzaj-studni' || targetId === 'zl-rodzaj-stopni') {
                    if (typeof window.updateAutoLockUI === 'function') window.updateAutoLockUI();

                    if (typeof window.updateConfigToMatchParams === 'function') {
                        window.updateConfigToMatchParams(el.well);
                    }
                }

                if (typeof window.refreshAll === 'function') {
                    window.refreshAll();
                } else {
                    if (typeof window.renderWellConfig === 'function') window.renderWellConfig();
                    if (typeof window.renderWellDiagram === 'function') window.renderWellDiagram();
                    if (typeof window.updateSummary === 'function') window.updateSummary();
                    if (typeof window.renderWellParams === 'function') window.renderWellParams();
                }

                if (typeof window.buildZleceniaWellList === 'function') {
                    window.buildZleceniaWellList();
                }

                let newTargetIdx = zleceniaElementsList.findIndex(
                    (e) => e.wellIndex === oldWellIdx && e.elementIndex === oldElementIndex
                );
                if (newTargetIdx === -1) {
                    newTargetIdx = zleceniaElementsList.findIndex(
                        (e) =>
                            e.wellIndex === oldWellIdx && e.product && e.product.category === oldCat
                    );
                }
                if (newTargetIdx === -1) {
                    newTargetIdx = zleceniaElementsList.findIndex(
                        (e) => e.wellIndex === oldWellIdx
                    );
                }

                if (newTargetIdx >= 0 && typeof window.selectZleceniaElement === 'function') {
                    window.selectZleceniaElement(newTargetIdx);
                    if (document.getElementById('zl-uwagi')) {
                        document.getElementById('zl-uwagi').value = tempUwagi;
                    }
                }
            }
        }
    }
}

window.toggleDaneElementu = function () {
    const grid = document.getElementById('zl-dane-elementu-grid');
    const content = document.getElementById('zl-dane-elementu-content');
    const headerFull = document.getElementById('zl-dane-elementu-header-full');
    const headerCollapsed = document.getElementById('zl-dane-elementu-header-collapsed');

    if (!grid || !content) return;

    const isVisible = content.style.display !== 'none';

    if (isVisible) {
        content.style.display = 'none';
        if (headerFull) headerFull.style.display = 'none';
        if (headerCollapsed) headerCollapsed.style.display = 'flex';
        grid.style.gridTemplateColumns = '36px 1fr';
    } else {
        content.style.display = 'flex';
        if (headerFull) headerFull.style.display = 'flex';
        if (headerCollapsed) headerCollapsed.style.display = 'none';
        grid.style.gridTemplateColumns = '230px 1fr';
    }
};

function onZleceniaStopnieChange() {
    const hiddenInput = document.getElementById('zl-rodzaj-stopni');
    const wrap = document.getElementById('zl-stopnie-inne-wrap');
    if (hiddenInput && wrap) {
        wrap.style.display = hiddenInput.value === 'inne' ? 'block' : 'none';
    }
}

function onZleceniaKatChange() {
    const katInput = document.getElementById('zl-kat-stopni');
    const wykInput = document.getElementById('zl-wykonanie');
    if (katInput && wykInput) {
        const angle = parseFloat(katInput.value) || 0;
        const exec = angle > 0 ? calcStopnieExecution(angle) : '';
        wykInput.value = exec ? exec + '°' : '';
    }
}

async function saveProductionOrder() {
    if (zleceniaSelectedIdx < 0 || !zleceniaElementsList[zleceniaSelectedIdx]) {
        showToast('Najpierw wybierz element z listy', 'error');
        return;
    }

    const el = zleceniaElementsList[zleceniaSelectedIdx];
    const { well, product, elementIndex, wellIndex } = el;

    const existingIdx = productionOrders.findIndex(
        (po) => po.wellId === well.id && po.elementIndex === elementIndex
    );
    if (existingIdx >= 0 && productionOrders[existingIdx].status === 'accepted') {
        showToast(
            'Nie można zapisać zaakceptowanego zlecenia. Najpierw cofnij akceptację.',
            'error'
        );
        return;
    }

    let currentOrderNumber =
        existingIdx >= 0 ? productionOrders[existingIdx].productionOrderNumber || '' : '';

    if (!currentOrderNumber) {
        try {
            const targetUserId =
                (typeof orderEditMode !== 'undefined' &&
                    orderEditMode &&
                    orderEditMode.order &&
                    orderEditMode.order.userId) ||
                (typeof editingOfferAssignedUserId !== 'undefined' && editingOfferAssignedUserId) ||
                (currentUser ? currentUser.id : null);

            if (targetUserId) {
                const claimResp = await fetch(
                    '/api/orders-studnie/claim-production-number/' + targetUserId,
                    {
                        method: 'POST',
                        headers: authHeaders()
                    }
                );
                if (claimResp.ok) {
                    const claimData = await claimResp.json();
                    if (claimData.number) {
                        currentOrderNumber = claimData.number;
                    }
                }
            }
        } catch (e) {
            logger.error('orderManager', 'Błąd poboru numeru zlecenia dla wersji roboczej', e);
        }
    }

    const order = {
        id: existingIdx >= 0 ? productionOrders[existingIdx].id : 'prodorder_' + Date.now(),
        productionOrderNumber: currentOrderNumber,
        userId:
            (typeof orderEditMode !== 'undefined' &&
                orderEditMode &&
                orderEditMode.order &&
                orderEditMode.order.userId) ||
            (typeof editingOfferAssignedUserId !== 'undefined' && editingOfferAssignedUserId) ||
            (currentUser ? currentUser.id : null),
        wellId: well.id,
        wellName: well.name,
        offerId: typeof editingOfferIdStudnie !== 'undefined' ? editingOfferIdStudnie : '',
        orderId:
            (typeof orderEditMode !== 'undefined' && orderEditMode && orderEditMode.orderId) || '',
        salesOrderNumber:
            typeof orderEditMode !== 'undefined' &&
            orderEditMode &&
            typeof currentOrder !== 'undefined' &&
            currentOrder
                ? currentOrder.orderNumber
                : '',
        elementIndex: elementIndex,
        productName: product.name,
        productId: product.id,
        dn: well.dn,

        obiekt: document.getElementById('zl-obiekt')?.value || '',
        data: document.getElementById('zl-data')?.value || '',
        adres: document.getElementById('zl-adres')?.value || '',
        nazwisko: document.getElementById('zl-nazwisko')?.value || '',
        wykonawca: document.getElementById('zl-wykonawca')?.value || '',
        dataProdukcji: document.getElementById('zl-data-produkcji')?.value || '',
        fakturowane: document.getElementById('zl-fakturowane')?.value || '',

        snr: well.numer || '',
        srednica: document.getElementById('zl-srednica')?.value || well.dn,
        wysokosc: document.getElementById('zl-wysokosc')?.value || '',
        glebokosc: document.getElementById('zl-glebokosc')?.value || '',
        dnoKineta: document.getElementById('zl-dno-kineta')?.value || '',
        rodzajStudni: document.getElementById('zl-rodzaj-studni')?.value || '',

        przejscia: (() => {
            const allPrzejscia = well.przejscia || [];
            const rzDna = parseFloat(well.rzednaDna) || 0;
            const findProductFn = (id) =>
                typeof studnieProducts !== 'undefined'
                    ? studnieProducts.find((pr) => pr.id === id)
                    : null;
            const configMap =
                typeof buildConfigMap !== 'undefined'
                    ? buildConfigMap(well, findProductFn, true)
                    : [];

            const assigned =
                configMap.length > 0
                    ? allPrzejscia.filter((p) => {
                          let pel = parseFloat(p.rzednaWlaczenia);
                          if (isNaN(pel)) pel = rzDna;
                          const mmFromBottom = (pel - rzDna) * 1000;
                          const { assignedIndex } = findAssignedElement(mmFromBottom, configMap);
                          return assignedIndex === elementIndex;
                      })
                    : allPrzejscia;

            return assigned.map((p) => {
                const clone = structuredClone(p);
                const prod = findProductFn(p.productId);
                if (prod) {
                    clone.productCategory = prod.category || '';
                    clone.productDn = prod.dn || '';
                }
                return clone;
            });
        })(),

        etykietaElementy: buildEtykietaElementsSnapshot(well),

        uwagi: document.getElementById('zl-uwagi')?.value || '',

        redukcjaKinety: document.getElementById('zl-red-kinety')?.value || '',
        spocznikH: document.getElementById('zl-spocznik-h')?.value || '',
        din: document.getElementById('zl-din')?.value || getStudniaDIN(well.dn),
        rodzajStopni: document.getElementById('zl-rodzaj-stopni')?.value || '',
        stopnieInne: document.getElementById('zl-stopnie-inne')?.value || '',
        katStopni: document.getElementById('zl-kat-stopni')?.value || '',
        wykonanie: document.getElementById('zl-wykonanie')?.value || '',
        usytuowanie: document.getElementById('zl-usytuowanie')?.value || '',
        kineta: document.getElementById('zl-kineta')?.value || '',
        spocznik: document.getElementById('zl-spocznik')?.value || '',
        klasaBetonu: document.getElementById('zl-klasa-betonu')?.value || '',

        createdAt:
            existingIdx >= 0 ? productionOrders[existingIdx].createdAt : new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        status: existingIdx >= 0 ? productionOrders[existingIdx].status || 'draft' : 'draft'
    };

    if (existingIdx >= 0) {
        productionOrders[existingIdx] = order;
    } else {
        productionOrders.push(order);
    }

    try {
        await saveProductionOrdersData(productionOrders);

        if (wellsSnapshotBeforeZlecenia) {
            wellsSnapshotBeforeZlecenia = structuredClone(wells);
        }

        renderZleceniaList();
        renderZleceniaWellConfig();
        if (zleceniaSelectedIdx >= 0 && zleceniaElementsList[zleceniaSelectedIdx]) {
            populateZleceniaForm(zleceniaElementsList[zleceniaSelectedIdx]);
        }
        refreshGlobalMetrics();
        showToast(`<i data-lucide="check-circle-2"></i> Zlecenie produkcyjne zapisane`, 'success');
    } catch (err) {
        logger.error('orderManager', 'saveProductionOrder error:', err);
        showToast('<i data-lucide="x-circle"></i> Błąd zapisu: ' + err.message, 'error');
    }
}

window.openZleceniaProdukcyjne = openZleceniaProdukcyjne;
window.closeZleceniaModal = closeZleceniaModal;
window.selectZleceniaElement = selectZleceniaElement;
window.filterZleceniaList = filterZleceniaList;
window.saveProductionOrder = saveProductionOrder;
window.onZleceniaStopnieChange = onZleceniaStopnieChange;
window.onZleceniaKatChange = onZleceniaKatChange;
