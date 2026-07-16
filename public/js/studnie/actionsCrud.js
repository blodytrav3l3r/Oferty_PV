// @ts-check
/* ===== actionsCrud.js — add/remove/update/clear komponentów studni ===== */

function addWellComponent(productId) {
    if (isOfferLocked()) {
        showToast(OFFER_LOCKED_MSG, 'error');
        return;
    }
    if (isWellLocked()) {
        showToast(WELL_LOCKED_MSG, 'error');
        return;
    }
    const product = studnieProducts.find((p) => p.id === productId);
    if (!product) return;

    const well = getCurrentWell();
    if (!well) {
        showToast('Najpierw dodaj studnię', 'error');
        return;
    }

    if (!well.autoLocked) {
        well.autoLocked = true;
        updateAutoLockUI();
        showToast('Włączono tryb ręczny.', 'info');
        if (typeof window._excelSyncAutoManualUI === 'function') window._excelSyncAutoManualUI();
    }
    well.configSource = 'MANUAL';

    const topClosureTypes = [
        'plyta_din',
        'plyta_najazdowa',
        'plyta_zamykajaca',
        'konus',
        'pierscien_odciazajacy'
    ];
    const reliefTypes = ['pierscien_odciazajacy', 'plyta_zamykajaca', 'plyta_najazdowa'];

    if (topClosureTypes.includes(product.componentType)) {
        if (
            product.componentType === 'konus' &&
            well.wkladkaZwienczenie &&
            well.wkladkaZwienczenie !== 'brak'
        ) {
            if (typeof window.showKonusPehdResolverModal === 'function') {
                window.showKonusPehdResolverModal(currentWellIndex);
            } else {
                showToast(
                    'Nie można dodać konusa przy aktywnej wkładce PEHD zwieńczenia.',
                    'error'
                );
            }
            return;
        }

        well.config = well.config.filter((item) => {
            const p = studnieProducts.find((pr) => pr.id === item.productId);
            if (!p) return true;

            if (reliefTypes.includes(product.componentType)) {
                if (reliefTypes.includes(p.componentType)) {
                    return p.componentType !== product.componentType;
                }
                return !topClosureTypes.includes(p.componentType);
            }

            return !topClosureTypes.includes(p.componentType);
        });
    }

    if (product.componentType === 'plyta_redukcyjna') {
        well.config = well.config.filter((item) => {
            const p = studnieProducts.find((pr) => pr.id === item.productId);
            return p && p.componentType !== 'plyta_redukcyjna';
        });
    }

    if (product.componentType === 'wlaz') {
        well.config = well.config.filter((item) => {
            const p = studnieProducts.find((pr) => pr.id === item.productId);
            return p && p.componentType !== 'wlaz';
        });
    }

    const addSingle = (prod) => {
        const topClosureTypes = [
            'plyta_din',
            'plyta_najazdowa',
            'plyta_zamykajaca',
            'konus',
            'pierscien_odciazajacy',
            'wlaz'
        ];
        const isTop = topClosureTypes.includes(prod.componentType);
        const isBottom = ['dennica', 'kineta', 'styczna'].includes(prod.componentType);

        if (isTop) {
            well.config.unshift({ productId: prod.id, quantity: 1, _addedAt: Date.now() });
            if (typeof window.injectPairIfReliefComponent === 'function') {
                window.injectPairIfReliefComponent(well, prod.id, 0);
            }
            return;
        }

        if (isBottom) {
            well.config.push({ productId: prod.id, quantity: 1, _addedAt: Date.now() });
            return;
        }

        const plateIdx = well.config.findIndex((c) => {
            const p = studnieProducts.find((pr) => pr.id === c.productId);
            return p && p.componentType === 'plyta_redukcyjna';
        });

        if (plateIdx >= 0) {
            const plate = studnieProducts.find((p) => p.id === well.config[plateIdx].productId);
            const isRedDn = prod.dn === 1000;

            if (isRedDn) {
                let insertIdx = 0;
                for (let i = 0; i < plateIdx; i++) {
                    const p = studnieProducts.find((pr) => pr.id === well.config[i].productId);
                    if (!topClosureTypes.includes(p.componentType)) {
                        insertIdx = i;
                        break;
                    }
                    insertIdx = i + 1;
                }
                well.config.splice(insertIdx, 0, {
                    productId: prod.id,
                    quantity: 1,
                    _addedAt: Date.now()
                });
            } else {
                well.config.splice(plateIdx + 1, 0, {
                    productId: prod.id,
                    quantity: 1,
                    _addedAt: Date.now()
                });
            }
        } else {
            let insertIdx = 0;
            for (let i = 0; i < well.config.length; i++) {
                const p = studnieProducts.find((pr) => pr.id === well.config[i].productId);
                if (!topClosureTypes.includes(p.componentType)) {
                    insertIdx = i;
                    break;
                }
                insertIdx = i + 1;
            }
            well.config.splice(insertIdx, 0, {
                productId: prod.id,
                quantity: 1,
                _addedAt: Date.now()
            });
        }
    };

    addSingle(product);

    if (typeof window.ensureReliefRingPair === 'function') {
        window.ensureReliefRingPair(well);
    }

    if (typeof window.telemetryRecordEvent === 'function') {
        window.telemetryRecordEvent({
            eventType: 'component_add',
            wellId: well.id || well.name,
            componentId: productId,
            componentName: product.name,
            configSource: 'MANUAL'
        });
    }

    sortWellConfigByOrder();
    recalcGaskets(well);
    renderWellConfig();
    renderWellDiagram();
    updateSummary();
    renderWellsList();
    renderTiles();
    updateHeightIndicator();
    if (typeof window.refreshExcelFromConfig === 'function') window.refreshExcelFromConfig();

    if (typeof window.mlRewardHooks !== 'undefined' && window.mlRewardHooks.onWellModified) {
        window.mlRewardHooks.onWellModified();
    }

    if (topClosureTypes.includes(product.componentType) && well.rzednaWlazu != null) {
        const rzDna = well.rzednaDna != null ? well.rzednaDna : 0;
        if (well.rzednaWlazu > rzDna) {
            showToast(`Wybrano zakończenie: ${product.name}`, 'success');

            if (!well.autoLocked) {
                autoSelectComponents(true);
                return;
            }
        } else {
            showToast(`Dodano: ${product.name}`, 'success');
        }
    } else {
        showToast(`Dodano: ${product.name}`, 'success');
    }
}

function removeWellComponent(index) {
    if (isOfferLocked()) {
        showToast(OFFER_LOCKED_MSG, 'error');
        return;
    }
    if (isWellLocked()) {
        showToast(WELL_LOCKED_MSG, 'error');
        return;
    }
    const well = getCurrentWell();
    well.configSource = 'MANUAL';

    const removedItem = well.config.splice(index, 1)[0];

    if (removedItem) {
        const p = studnieProducts.find((pr) => pr.id === removedItem.productId);
        if (p) {
            const reliefTypes = ['pierscien_odciazajacy', 'plyta_zamykajaca', 'plyta_najazdowa'];
            if (reliefTypes.includes(p.componentType)) {
                well.config = well.config.filter((item) => {
                    const prod = studnieProducts.find((pr) => pr.id === item.productId);
                    return !prod || !reliefTypes.includes(prod.componentType);
                });
                showToast('Usunięto komplet odciążający', 'info');
            }

            if (p.componentType === 'redukcja') {
                well.redukcjaDN1000 = false;
                const redToggle = document.getElementById('well-redukcja-toggle');
                if (redToggle) redToggle.checked = false;
                if (typeof updateAutoLockUI === 'function') updateAutoLockUI();
                showToast('Usunięto redukcję ze studni.', 'info');
            }
        }
    }

    if (typeof window.telemetryRecordEvent === 'function') {
        const removedProd = removedItem
            ? studnieProducts.find(function (p) {
                  return p.id === removedItem.productId;
              })
            : null;
        window.telemetryRecordEvent({
            eventType: 'component_remove',
            wellId: well.id || well.name,
            componentId: removedItem ? removedItem.productId : undefined,
            componentName: removedProd ? removedProd.name : undefined,
            configSource: 'MANUAL'
        });
    }

    recalcGaskets(well);
    renderWellConfig();
    renderWellDiagram();
    updateSummary();
    renderWellsList();
    renderTiles();
    updateHeightIndicator();
    if (typeof window.refreshExcelFromConfig === 'function') window.refreshExcelFromConfig();
    if (typeof window._excelSyncAutoManualUI === 'function') window._excelSyncAutoManualUI();

    if (typeof window.mlRewardHooks !== 'undefined' && window.mlRewardHooks.onWellModified) {
        window.mlRewardHooks.onWellModified();
    }
}

function updateWellQuantity(index, value) {
    if (isOfferLocked()) {
        showToast(OFFER_LOCKED_MSG, 'error');
        return;
    }
    if (isWellLocked()) {
        showToast(WELL_LOCKED_MSG, 'error');
        return;
    }
    const qty = parseInt(value);
    if (qty <= 0) {
        removeWellComponent(index);
        return;
    }
    const well = getCurrentWell();
    well.configSource = 'MANUAL';
    well.autoSelect = false;
    well.autoLocked = true;
    if (typeof window._excelSyncAutoManualUI === 'function') window._excelSyncAutoManualUI();
    well.config[index].quantity = 1;

    if (typeof window.telemetryRecordEvent === 'function') {
        window.telemetryRecordEvent({
            eventType: 'component_qty_change',
            wellId: well.id || well.name,
            componentId: well.config[index] ? well.config[index].productId : undefined,
            configSource: 'MANUAL'
        });
    }

    renderWellConfig();
    renderWellDiagram();
    updateSummary();
    renderTiles();
    updateHeightIndicator();
}

function clearWellConfig() {
    if (isOfferLocked()) {
        showToast(OFFER_LOCKED_MSG, 'error');
        return;
    }
    if (isWellLocked()) {
        showToast(WELL_LOCKED_MSG, 'error');
        return;
    }
    const well = getCurrentWell();
    if (!well) return;
    well.configSource = 'MANUAL';
    well.autoSelect = false;
    well.autoLocked = true;
    if (typeof window._excelSyncAutoManualUI === 'function') window._excelSyncAutoManualUI();
    well.config = [];
    refreshAll();
    showToast('Wyczyszczono konfigurację studni', 'info');
}
