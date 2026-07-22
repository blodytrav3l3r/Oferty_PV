/* ===== ZLECENIA PRODUKCYJNE — RENDEROWANIE LISTY I KONFIGURACJI ===== */

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

        html += `<div style="background:var(--bg-secondary); padding:0.6rem 0.8rem; border-bottom:1px solid var(--border-glass); border-top:1px solid var(--border-glass); position:sticky; top:0; z-index:${LAYERS.STICKY_TABLE_TH}; display:flex; justify-content:space-between; align-items:center; margin-top:-1px;">
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
                        ${isSaved && !isAccepted ? `<button class="btn-icon-danger btn-icon-xs" onclick="event.stopPropagation(); deleteProductionOrder('${escapeHtml(savedOrder.id)}')" title="Usuń zlecenie"><i data-lucide="trash-2"></i></button>` : ''}
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
    renderZleceniaSvgPreview(el.well);

    populateZleceniaForm(el);
}

window.filterZleceniaList = filterZleceniaList;
window.selectZleceniaElement = selectZleceniaElement;
