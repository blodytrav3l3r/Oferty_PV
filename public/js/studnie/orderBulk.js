// @ts-check
/* ===== HURTOWE GENEROWANIE ZLECEŃ PRODUKCYJNYCH ===== */

/**
 * Zbiera wspólne dane z formularza oferty/zamówienia (nie z formularza zlecenia).
 * Używane przez hurtowe generowanie, aby nie polegać na DOM zlecenia.
 */
function collectSharedFormData() {
    const userName = currentUser
        ? ((currentUser.firstName || '') + ' ' + (currentUser.lastName || '')).trim() ||
          currentUser.username
        : '';
    const targetUserId =
        (typeof orderEditMode !== 'undefined' &&
            orderEditMode &&
            orderEditMode.order &&
            orderEditMode.order.userId) ||
        (typeof editingOfferAssignedUserId !== 'undefined' && editingOfferAssignedUserId) ||
        (currentUser ? currentUser.id : null);
    return {
        obiekt: document.getElementById('invest-name')?.value || '',
        adres: document.getElementById('invest-address')?.value || '',
        wykonawca: document.getElementById('invest-contractor')?.value || '',
        fakturowane: document.getElementById('client-name')?.value || '',
        nazwisko: userName,
        dataProdukcji: '',
        userId: targetUserId
    };
}

/**
 * Buduje obiekt zlecenia produkcyjnego programowo (bez DOM).
 * Replikuje logikę z populateZleceniaForm + saveProductionOrder.
 */
function buildAutoOrderData(el, sharedData) {
    const { well, product, elementIndex, wellIndex } = el;
    const parsed = parseWysokoscGlebokosc(product.name);
    const findProductFn = (id) =>
        typeof studnieProducts !== 'undefined' ? studnieProducts.find((pr) => pr.id === id) : null;

    let displayDN = well.dn === 'styczna' ? 'Styczna' : 'DN' + well.dn;
    let displayGlebokosc = parsed.glebokosc || '—';
    let displayWysokosc = parsed.wysokosc || product.height || 0;
    let dnoKinetaVal = parsed.wysokosc - parsed.glebokosc;
    let displayDnoKineta = dnoKinetaVal > 0 ? dnoKinetaVal : '—';

    let actualNextProduct = null;
    for (let i = elementIndex + 1; i < well.config.length; i++) {
        const _p = findProductFn(well.config[i].productId);
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

    const isKragOt = product && product.componentType === 'krag_ot';
    const shouldForceBrak = shouldReduce || isKragOt;

    let domyslnyRodzajStudni =
        product.componentType === 'dennica'
            ? well.dennicaMaterial === 'zelbetowa'
                ? 'zelbet'
                : 'beton'
            : well.nadbudowa === 'zelbetowa'
              ? 'zelbet'
              : 'beton';

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
    const katStopni = baseKatStopni || '';
    const wykonanie = katStopni ? calcStopnieExecution(katStopni) : '';

    const autoUwagi = [];
    if (well.agresjaChemiczna === 'XA2' || well.agresjaChemiczna === 'XA3')
        autoUwagi.push('Agresja chem. ' + well.agresjaChemiczna);
    if (well.agresjaMrozowa === 'XF2' || well.agresjaMrozowa === 'XF3')
        autoUwagi.push('Agresja mroz. ' + well.agresjaMrozowa);
    let wklUwagi2 = [];
    if (well.wkladkaDennica && well.wkladkaDennica !== 'brak')
        wklUwagi2.push('Dennica ' + well.wkladkaDennica);
    if (well.wkladkaNadbudowa && well.wkladkaNadbudowa !== 'brak')
        wklUwagi2.push('Nadbudowa ' + well.wkladkaNadbudowa);
    if (well.wkladkaZwienczenie && well.wkladkaZwienczenie !== 'brak')
        wklUwagi2.push('Zwieńczenie ' + well.wkladkaZwienczenie);
    if (wklUwagi2.length > 0) autoUwagi.push('PEHD: ' + wklUwagi2.join(', '));
    if (well.malowanieW && well.malowanieW !== 'brak') {
        let malWDesc = '';
        if (well.malowanieW === 'kineta') malWDesc = 'Kineta';
        else if (well.malowanieW === 'kineta_dennica') malWDesc = 'Kineta+denn.';
        else if (well.malowanieW === 'cale') malWDesc = 'Całość';
        if (malWDesc)
            autoUwagi.push(
                'Malowanie wew. ' + malWDesc + (well.powlokaNameW ? ' ' + well.powlokaNameW : '')
            );
    }
    if (well.malowanieZ === 'zewnatrz')
        autoUwagi.push(
            'Malowanie zew. Zewnątrz' + (well.powlokaNameZ ? ' ' + well.powlokaNameZ : '')
        );
    if (well.dn === 'styczna') autoUwagi.push('STYCZNA');
    if (well.klasaNosnosci_korpus === 'E600' || well.klasaNosnosci_korpus === 'F900')
        autoUwagi.push('Kl. nośn. ' + well.klasaNosnosci_korpus);
    if (well.psiaBuda && !actualNextProduct) autoUwagi.push('UWAGA ! PSIA BUDA');
    if (
        product.componentType === 'dennica' &&
        actualNextProduct &&
        actualNextProduct.componentType === 'dennica'
    )
        autoUwagi.push('UWAGA ! KRĄG NA FORMIE STUDNI');

    const rzDna = parseFloat(well.rzednaDna) || 0;
    const configMap =
        typeof buildConfigMap !== 'undefined' ? buildConfigMap(well, findProductFn, true) : [];
    const allPrzejscia = well.przejscia || [];
    const assignedPrzejscia =
        configMap.length > 0
            ? allPrzejscia.filter((p) => {
                  let pel = parseFloat(p.rzednaWlaczenia);
                  if (isNaN(pel)) pel = rzDna;
                  const mmFromBottom = (pel - rzDna) * 1000;
                  const { assignedIndex } = findAssignedElement(mmFromBottom, configMap);
                  return assignedIndex === elementIndex;
              })
            : allPrzejscia;

    const przejsciaSnapshot = assignedPrzejscia.map((p) => {
        const clone = structuredClone(p);
        const prod = findProductFn(p.productId);
        if (prod) {
            clone.productCategory = prod.category || '';
            clone.productDn = prod.dn || '';
        }
        return clone;
    });

    const todayStr = new Date().toISOString().split('T')[0];

    return {
        id: 'prodorder_' + Date.now() + '_' + wellIndex + '_' + elementIndex,
        productionOrderNumber: '',
        userId: sharedData.userId || null,
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
        obiekt: sharedData.obiekt || '',
        data: todayStr,
        adres: sharedData.adres || '',
        nazwisko: sharedData.nazwisko || '',
        wykonawca: sharedData.wykonawca || '',
        dataProdukcji: sharedData.dataProdukcji || '',
        fakturowane: sharedData.fakturowane || '',
        snr: well.numer || '',
        srednica: displayDN,
        wysokosc: String(displayWysokosc),
        glebokosc: String(displayGlebokosc),
        dnoKineta: String(displayDnoKineta),
        rodzajStudni: domyslnyRodzajStudni,
        przejscia: przejsciaSnapshot,
        etykietaElementy: buildEtykietaElementsSnapshot(well),
        uwagi: autoUwagi.join(', '),
        redukcjaKinety: shouldForceBrak ? 'nie' : (well.redukcjaKinety ?? ''),
        spocznikH: shouldForceBrak ? 'brak' : (well.spocznikH ?? ''),
        din: getStudniaDIN(well.dn),
        rodzajStopni: baseRodzajStopni || '',
        stopnieInne: '',
        katStopni: katStopni,
        wykonanie: wykonanie ? wykonanie + '°' : '',
        usytuowanie: well.usytuowanie ?? '',
        kineta: shouldForceBrak ? 'brak' : (well.kineta ?? ''),
        spocznik: shouldForceBrak ? 'brak' : (well.spocznik ?? ''),
        klasaBetonu: well.klasaBetonu ?? '',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        status: 'draft'
    };
}

/**
 * Pobiera numer zlecenia produkcyjnego i zapisuje zlecenie przez API.
 * Zwraca zapisany obiekt zlecenia z przydzielonym numerem.
 */
async function claimAndSaveSingleOrder(orderData, userId) {
    if (!orderData.productionOrderNumber && userId) {
        const claimResp = await fetch('/api/orders-studnie/claim-production-number/' + userId, {
            method: 'POST',
            headers: authHeaders()
        });
        if (claimResp.ok) {
            const claimData = await claimResp.json();
            if (claimData.number) orderData.productionOrderNumber = claimData.number;
        }
    }
    const res = await fetch('/api/orders-studnie/production', {
        method: 'POST',
        headers: authHeaders(),
        body: JSON.stringify(orderData)
    });
    const resData = await res.json();
    if (!res.ok) throw new Error(resData.error || 'Server error');
    return orderData;
}

/**
 * Otwiera popup z drag & drop listą studni do ustalenia kolejności generowania.
 */
function openBulkOrderSequencePopup() {
    if (wells.length === 0) {
        showToast('Brak studni do wygenerowania zleceń', 'error');
        return;
    }
    buildZleceniaWellList();

    const wellGroups = {};
    zleceniaElementsList.forEach((el) => {
        if (!wellGroups[el.wellIndex]) {
            wellGroups[el.wellIndex] = {
                wellIndex: el.wellIndex,
                wellName: el.well.name,
                wellDn: el.well.dn,
                totalCount: 0,
                openCount: 0
            };
        }
        wellGroups[el.wellIndex].totalCount++;
        if (getElementStatus(el) === 'open') wellGroups[el.wellIndex].openCount++;
    });

    const groupList = Object.values(wellGroups);
    const hasAnyOpen = groupList.some((g) => g.openCount > 0);
    if (!hasAnyOpen) {
        showToast('Wszystkie elementy mają już zlecenia produkcyjne', 'info');
        return;
    }

    let itemsHtml = groupList
        .map((g) => {
            const disabled = g.openCount === 0;
            const dnLabel = g.wellDn === 'styczna' ? 'Styczna' : 'DN' + g.wellDn;
            return `<div class="bulk-seq-item ${disabled ? 'bulk-seq-disabled' : ''}"
                    draggable="${!disabled}" data-well-index="${g.wellIndex}"
                    style="display:flex; align-items:center; gap:0.6rem; padding:0.6rem 0.8rem;
                    background:${disabled ? 'rgba(255,255,255,0.02)' : 'rgba(var(--accent2-rgb),0.08)'};
                    border:1px solid ${disabled ? 'rgba(255,255,255,0.05)' : 'rgba(var(--accent2-rgb),0.25)'};
                    border-radius:8px; cursor:${disabled ? 'default' : 'grab'};
                    opacity:${disabled ? '0.4' : '1'}; transition:all 0.15s; margin-bottom:0.3rem;">
                <input type="text" inputmode="numeric" class="bulk-seq-num" ${disabled ? 'disabled' : ''} value=""
                    onfocus="this.dataset.old = this.value; this.value = '';"
                    onblur="reorderBulkSeqList(this)"
                    onkeydown="if(event.key === 'Enter') this.blur();"
                    style="width:72px; height:28px; text-align:center; padding:0;
                    background:${disabled ? 'rgba(255,255,255,0.05)' : 'rgba(var(--accent2-rgb),0.15)'};
                    border:1px solid ${disabled ? 'transparent' : 'rgba(var(--accent2-rgb),0.4)'}; border-radius:6px;
                    font-size:0.75rem; font-weight:800; color:${disabled ? 'var(--text-muted)' : '#c4b5fd'}; outline:none;">
                <span style="font-size:1rem; color:${disabled ? 'var(--text-muted)' : 'var(--accent2-hover)'}; cursor:grab;">⠿</span>
                <div style="flex:1;">
                    <div style="font-weight:700; font-size:0.8rem; color:var(--text-primary);">${g.wellName}</div>
                    <div style="font-size:0.65rem; color:var(--text-muted);">${dnLabel} • ${g.openCount}/${g.totalCount} do wygenerowania</div>
                </div>
                ${
                    !disabled
                        ? `<button onclick="toggleBulkSeqItem(this)" class="btn btn-sm" style="background:transparent; border:none; color:var(--danger-hover); padding:0.2rem; cursor:pointer;" title="Pomiń studnię">
                    <i data-lucide="trash-2" style="width:16px; height:16px;"></i>
                </button>`
                        : ''
                }
            </div>`;
        })
        .join('');

    let overlay = document.getElementById('bulk-seq-overlay');
    if (overlay) overlay.remove();
    overlay = document.createElement('div');
    overlay.id = 'bulk-seq-overlay';
    overlay.style.cssText =
        'position:fixed; inset:0; background:rgba(0,0,0,0.7); z-index:100000; display:flex; align-items:center; justify-content:center; backdrop-filter:blur(4px);';
    overlay.innerHTML = `
        <div style="background:var(--bg-secondary); border:1px solid rgba(var(--accent2-rgb),0.3); border-radius:14px; padding:1.5rem; width:420px; max-height:80vh; display:flex; flex-direction:column; box-shadow:0 20px 60px rgba(0,0,0,0.5);">
            <div style="display:flex; align-items:center; justify-content:space-between; margin-bottom:1rem;">
                <div>
                    <div style="font-size:1rem; font-weight:800; color:var(--accent2-hover);"><i data-lucide="list-ordered"></i> Kolejność generowania</div>
                    <div style="font-size:0.7rem; color:var(--text-muted);">Przeciągnij studnie, aby ustalić kolejność numerów produkcyjnych</div>
                </div>
                <button onclick="closeBulkOrderPopup()" class="btn btn-sm" style="background:rgba(var(--danger-rgb),0.1); border:1px solid rgba(var(--danger-rgb),0.3); color:var(--danger-hover); padding:0.3rem 0.6rem;">
                    <i data-lucide="x"></i>
                </button>
            </div>
            <div id="bulk-seq-list" style="flex:1; overflow-y:auto; padding:0.3rem 0;">${itemsHtml}</div>
            <button onclick="executeBulkFromPopup()" class="btn btn-sm" style="margin-top:1rem; width:100%; background:rgba(var(--accent2-rgb),0.2); border:1px solid rgba(var(--accent2-rgb),0.4); color:var(--accent2-hover); font-weight:800; padding:0.6rem; font-size:0.85rem; border-radius:8px;">
                <i data-lucide="zap"></i> Generuj w tej kolejności
            </button>
        </div>
    `;
    document.body.appendChild(overlay);

    updateBulkSeqNumbers();

    const list = document.getElementById('bulk-seq-list');
    let dragEl = null;
    list.addEventListener('dragstart', (e) => {
        dragEl = e.target.closest('.bulk-seq-item');
        if (dragEl) dragEl.style.opacity = '0.4';
    });
    list.addEventListener('dragover', (e) => {
        e.preventDefault();
        const target = e.target.closest('.bulk-seq-item');
        if (target && target !== dragEl && !target.classList.contains('bulk-seq-disabled')) {
            const rect = target.getBoundingClientRect();
            const after = e.clientY > rect.top + rect.height / 2;
            if (after) target.after(dragEl);
            else target.before(dragEl);
        }
    });
    list.addEventListener('dragend', () => {
        if (dragEl) dragEl.style.opacity = '1';
        dragEl = null;
        updateBulkSeqNumbers();
    });

    if (window.lucide) window.lucide.createIcons();
}

/** Aktualizuje widoczne numery kolejności w popupie drag & drop */
function updateBulkSeqNumbers() {
    const items = document.querySelectorAll('#bulk-seq-list .bulk-seq-item');
    let counter = 1;
    items.forEach((item) => {
        const numEl = item.querySelector('.bulk-seq-num');
        if (!numEl) return;
        if (
            item.classList.contains('bulk-seq-disabled') ||
            item.classList.contains('bulk-seq-excluded')
        ) {
            numEl.value = '';
            numEl.placeholder = '—';
        } else {
            numEl.value = String(counter);
            counter++;
        }
    });
}

/** Przestawia element na liście na podstawie wpisanego numeru */
function reorderBulkSeqList(inputEl) {
    const newVal = parseInt(inputEl.value, 10);
    if (isNaN(newVal) || newVal < 1) {
        if (inputEl.dataset.old) {
            inputEl.value = inputEl.dataset.old;
        }
        updateBulkSeqNumbers();
        return;
    }

    const item = inputEl.closest('.bulk-seq-item');
    if (!item) return;

    const list = document.getElementById('bulk-seq-list');
    const items = Array.from(
        list.querySelectorAll('.bulk-seq-item:not(.bulk-seq-disabled):not(.bulk-seq-excluded)')
    );

    const oldIndex = items.indexOf(item);
    let newIndex = newVal - 1;

    if (newIndex >= items.length) newIndex = items.length - 1;
    if (newIndex < 0) newIndex = 0;

    if (oldIndex === newIndex) {
        updateBulkSeqNumbers();
        return;
    }

    items.splice(oldIndex, 1);
    items.splice(newIndex, 0, item);

    const excludedItems = Array.from(list.querySelectorAll('.bulk-seq-item.bulk-seq-excluded'));
    const disabledItems = Array.from(list.querySelectorAll('.bulk-seq-item.bulk-seq-disabled'));

    items.forEach((el) => list.appendChild(el));
    excludedItems.forEach((el) => list.appendChild(el));
    disabledItems.forEach((el) => list.appendChild(el));

    updateBulkSeqNumbers();
}

/** Wyklucza/przywraca element z kolejki generowania */
function toggleBulkSeqItem(btn) {
    const item = btn.closest('.bulk-seq-item');
    if (!item) return;

    const isExcluded = item.classList.contains('bulk-seq-excluded');

    if (isExcluded) {
        item.classList.remove('bulk-seq-excluded');
        item.style.opacity = '1';
        item.setAttribute('draggable', 'true');

        const input = item.querySelector('.bulk-seq-num');
        input.removeAttribute('disabled');
        input.style.background = 'rgba(var(--accent2-rgb),0.15)';

        btn.innerHTML = '<i data-lucide="trash-2" style="width:16px; height:16px;"></i>';
        btn.style.color = 'var(--danger-hover)';
        btn.title = 'Pomiń studnię';
    } else {
        item.classList.add('bulk-seq-excluded');
        item.style.opacity = '0.4';
        item.setAttribute('draggable', 'false');

        const input = item.querySelector('.bulk-seq-num');
        input.setAttribute('disabled', 'true');
        input.value = '';
        input.placeholder = '—';
        input.style.background = 'rgba(255,255,255,0.05)';

        btn.innerHTML = '<i data-lucide="plus" style="width:16px; height:16px;"></i>';
        btn.style.color = 'var(--success-hover)';
        btn.title = 'Przywróć studnię';
    }

    if (window.lucide) window.lucide.createIcons();

    const list = document.getElementById('bulk-seq-list');
    const activeItems = Array.from(
        list.querySelectorAll('.bulk-seq-item:not(.bulk-seq-disabled):not(.bulk-seq-excluded)')
    );
    const excludedItems = Array.from(list.querySelectorAll('.bulk-seq-item.bulk-seq-excluded'));
    const disabledItems = Array.from(list.querySelectorAll('.bulk-seq-item.bulk-seq-disabled'));

    activeItems.forEach((el) => list.appendChild(el));
    excludedItems.forEach((el) => list.appendChild(el));
    disabledItems.forEach((el) => list.appendChild(el));

    updateBulkSeqNumbers();
}

function closeBulkOrderPopup() {
    const overlay = document.getElementById('bulk-seq-overlay');
    if (overlay) overlay.remove();
}

/**
 * Wywołane z popupu kolejności — odczytuje kolejność studni z DOM i generuje.
 */
async function executeBulkFromPopup() {
    const items = document.querySelectorAll(
        '#bulk-seq-list .bulk-seq-item:not(.bulk-seq-disabled):not(.bulk-seq-excluded)'
    );
    const orderedIndexes = Array.from(items).map((el) => parseInt(el.dataset.wellIndex, 10));

    closeBulkOrderPopup();

    buildZleceniaWellList();
    const unsaved = [];
    orderedIndexes.forEach((wIdx) => {
        zleceniaElementsList
            .filter((el) => el.wellIndex === wIdx && getElementStatus(el) === 'open')
            .forEach((el) => unsaved.push(el));
    });

    if (unsaved.length === 0) {
        showToast('Brak elementów do wygenerowania', 'info');
        return;
    }

    const msg = `Wygenerować zlecenia dla ${unsaved.length} elementów w wybranej kolejności?`;
    if (
        !(await appConfirm(msg, {
            title: 'Generuj w kolejności',
            type: 'warning',
            okText: 'Generuj'
        }))
    )
        return;

    await executeBulkGeneration(unsaved);
}

/**
 * Wspólna pętla generowania zleceń hurtowo dla podanej listy elementów.
 */
async function executeBulkGeneration(elements) {
    const sharedData = collectSharedFormData();
    const newOrders = [];
    let errorCount = 0;

    for (const el of elements) {
        try {
            const orderData = buildAutoOrderData(el, sharedData);
            const saved = await claimAndSaveSingleOrder(orderData, sharedData.userId);
            productionOrders.push(saved);
            newOrders.push(saved);
        } catch (e) {
            logger.error('orderManager', 'Błąd generowania zlecenia dla', el.product.name, ':', e);
            errorCount++;
        }
    }

    buildZleceniaWellList();
    renderZleceniaList();
    if (zleceniaSelectedIdx >= 0 && zleceniaElementsList[zleceniaSelectedIdx]) {
        populateZleceniaForm(zleceniaElementsList[zleceniaSelectedIdx]);
    }
    refreshGlobalMetrics();

    if (wellsSnapshotBeforeZlecenia) {
        wellsSnapshotBeforeZlecenia = structuredClone(wells);
    }

    const errMsg = errorCount > 0 ? ` (${errorCount} błędów)` : '';
    showToast(
        `<i data-lucide="zap"></i> Wygenerowano ${newOrders.length} zleceń produkcyjnych${errMsg}`,
        newOrders.length > 0 ? 'success' : 'error'
    );
}

window.openBulkOrderSequencePopup = openBulkOrderSequencePopup;
window.closeBulkOrderPopup = closeBulkOrderPopup;
window.executeBulkFromPopup = executeBulkFromPopup;
window.reorderBulkSeqList = reorderBulkSeqList;
window.toggleBulkSeqItem = toggleBulkSeqItem;

/** Usuwa zlecenie produkcyjne dla aktualnie wybranego elementu */
async function deleteSelectedProductionOrder() {
    if (zleceniaSelectedIdx < 0 || !zleceniaElementsList[zleceniaSelectedIdx]) {
        showToast('Najpierw wybierz element z listy', 'error');
        return;
    }

    const el = zleceniaElementsList[zleceniaSelectedIdx];
    const po = (productionOrders || []).find(
        (p) => p.wellId === el.well.id && p.elementIndex === el.elementIndex
    );
    if (!po) {
        showToast('To zlecenie nie zostało jeszcze zapisane', 'info');
        return;
    }
    await deleteProductionOrder(po.id);
}
window.deleteSelectedProductionOrder = deleteSelectedProductionOrder;
