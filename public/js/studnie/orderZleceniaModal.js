// @ts-check
/* ===== ZLECENIA PRODUKCYJNE — MODAL + ZAPIS ===== */

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
window.saveProductionOrder = saveProductionOrder;
