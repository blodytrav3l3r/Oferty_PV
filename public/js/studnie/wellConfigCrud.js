// @ts-check
/* ===== wellConfigCrud.js — add, remove, move, quantity, clear ===== */

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

    // Włączenie trybu ręcznego jeśli dodano jakikolwiek element z palety
    if (!well.autoLocked) {
        well.autoLocked = true;
        updateAutoLockUI();
        showToast('Włączono tryb ręczny.', 'info');
        if (typeof window._excelSyncAutoManualUI === 'function') window._excelSyncAutoManualUI();
    }
    well.configSource = 'MANUAL';

    // ZASADA 1: Tylko jedno zakończenie studni (z wyjątkiem kompletu odciążającego)
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

        // Usuń poprzednie elementy zakończenia
        well.config = well.config.filter((item) => {
            const p = studnieProducts.find((pr) => pr.id === item.productId);
            if (!p) return true;

            // Jeśli dodajemy element odciążający (np. pierścień)
            if (reliefTypes.includes(product.componentType)) {
                // Jeśli istniejący element to też element odciążający...
                if (reliefTypes.includes(p.componentType)) {
                    // ...ale innego typu (partner), to go zostawiamy
                    return p.componentType !== product.componentType;
                }
                // Inne typy zakończeń (nie-odciążające) usuwamy
                return !topClosureTypes.includes(p.componentType);
            }

            // Jeśli dodajemy element NIE-odciążający (np. konus), usuwamy WSZYSTKIE zakończenia
            return !topClosureTypes.includes(p.componentType);
        });
    }

    // ZASADA: Płyta redukcyjna - tylko 1 na studnię
    if (product.componentType === 'plyta_redukcyjna') {
        well.config = well.config.filter((item) => {
            const p = studnieProducts.find((pr) => pr.id === item.productId);
            return p && p.componentType !== 'plyta_redukcyjna';
        });
    }

    // ZASADA 2: Właz - tylko 1 naraz
    if (product.componentType === 'wlaz') {
        well.config = well.config.filter((item) => {
            const p = studnieProducts.find((pr) => pr.id === item.productId);
            return p && p.componentType !== 'wlaz';
        });
    }

    // Pomocnik do dodawania pojedynczego produktu do konfiguracji studni w odpowiedniej pozycji
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
            // Zakończenia zawsze na samą górę (indeks 0 lub za włazem, ale właz jest już filtrowany wyżej)
            well.config.unshift({ productId: prod.id, quantity: 1, _addedAt: Date.now() });
            if (typeof window.injectPairIfReliefComponent === 'function') {
                window.injectPairIfReliefComponent(well, prod.id, 0);
            }
            return;
        }

        if (isBottom) {
            // Dennice zawsze na sam dół (koniec tablicy)
            well.config.push({ productId: prod.id, quantity: 1, _addedAt: Date.now() });
            return;
        }

        // Dla rur (krag, krag_ot) szukamy odpowiedniego miejsca
        const plateIdx = well.config.findIndex((c) => {
            const p = studnieProducts.find((pr) => pr.id === c.productId);
            return p && p.componentType === 'plyta_redukcyjna';
        });

        if (plateIdx >= 0) {
            const plate = studnieProducts.find((p) => p.id === well.config[plateIdx].productId);
            // Wykrywamy czy krąg jest DN główny (np. 1500) czy redukcyjny (1000)
            const mainDn = well.dn;
            const isRedDn = prod.dn === 1000;

            if (isRedDn) {
                // Krąg DN1000 -> wstawiamy NAD płytą redukcyjną (przed płytą w tablicy)
                // Ale za włazem/konusem
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

    // Po dodaniu upewnij się, że mamy parę jeśli to element odciążający
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
    renderTiles(); // Aktualizacja podświetlenia
    updateHeightIndicator(); // Odśwież błędy
    if (typeof window.refreshExcelFromConfig === 'function') window.refreshExcelFromConfig();

    // ML Reward: modyfikacja konfiguracji
    if (typeof window.mlRewardHooks !== 'undefined' && window.mlRewardHooks.onWellModified) {
        window.mlRewardHooks.onWellModified();
    }

    if (topClosureTypes.includes(product.componentType) && well.rzednaWlazu != null) {
        const rzDna = well.rzednaDna != null ? well.rzednaDna : 0;
        if (well.rzednaWlazu > rzDna) {
            showToast(`Wybrano zakończenie: ${product.name}`, 'success');

            // Auto-dobór (gdy dodajemy płyte starym "klikiem",
            // ale teraz tryb ręczny blokuje autodobór, wiec nigdy to nie zajdzie, chyba ze go odblokujemy)
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
            // 1. Obsługa usuwania kompletu odciążającego
            const reliefTypes = ['pierscien_odciazajacy', 'plyta_zamykajaca', 'plyta_najazdowa'];
            if (reliefTypes.includes(p.componentType)) {
                well.config = well.config.filter((item) => {
                    const prod = studnieProducts.find((pr) => pr.id === item.productId);
                    return !prod || !reliefTypes.includes(prod.componentType);
                });
                showToast('Usunięto komplet odciążający', 'info');
            }

            // 2. Obsługa usuwania redukcji
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
    renderTiles(); // Update highlight
    updateHeightIndicator(); // Odśwież błędy
    if (typeof window.refreshExcelFromConfig === 'function') window.refreshExcelFromConfig();
    /* Patch v=3.71 - sync Excel UI (AUTO/MAN mode button + Run button) */
    if (typeof window._excelSyncAutoManualUI === 'function') window._excelSyncAutoManualUI();

    // ML Reward: modyfikacja konfiguracji (usunięcie)
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
    // Nie pozwalamy na zmianę ilości na > 1 dla elementów betonowych, ale zachowujemy funkcję do usuwania
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
    renderTiles(); // podświetlenie elementów
    updateHeightIndicator(); // Odśwież błędy
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

function moveWellComponent(index, direction) {
    const well = getCurrentWell();
    if (!well) return;
    if (isOfferLocked()) {
        showToast(OFFER_LOCKED_MSG, 'error');
        return;
    }
    if (isWellLocked()) {
        showToast(WELL_LOCKED_MSG, 'error');
        return;
    }
    const newIndex = index + direction;
    if (newIndex < 0 || newIndex >= well.config.length) return;

    // Swap elements
    const temp = well.config[index];
    well.config[index] = well.config[newIndex];
    well.config[newIndex] = temp;

    // Wlacz tryb reczny poniewaz uzytkownik zmienia kolejnosc
    if (!well.autoLocked) {
        well.autoLocked = true;
        updateAutoLockUI();
    }
    well.configSource = 'MANUAL';

    renderWellConfig();
    renderWellDiagram();
    updateSummary();
    updateHeightIndicator(); // Odśwież błędy po przesunięciu
}

/**
 * Wstrzykuje parę dla elementu odciążającego (płyta <-> pierścień)
 */
window.injectPairIfReliefComponent = function (well, productId) {
    if (typeof window.ensureReliefRingPair === 'function') {
        window.ensureReliefRingPair(well);
    }
};

window.toggleLinerDisabled = function (index, type) {
    const well = getCurrentWell();
    if (!well || !well.config || !well.config[index]) return;

    const item = well.config[index];
    const p = studnieProducts.find((pr) => pr.id === item.productId);

    if (type === 'pehd') {
        item.disablePehd = !item.disablePehd;
        showToast(
            `Wkładka PEHD na "${p ? p.name : 'Elemencie'}" została ${item.disablePehd ? 'wyłączona' : 'włączona'}.`,
            item.disablePehd ? 'warning' : 'success'
        );
    } else if (type === 'preco') {
        item.disablePreco = !item.disablePreco;
        showToast(
            `Wkładka PRECO na "${p ? p.name : 'Elemencie'}" została ${item.disablePreco ? 'wyłączona' : 'włączona'}.`,
            item.disablePreco ? 'warning' : 'success'
        );
    }

    well.autoLocked = true; // Zabezpieczenie elementu przed nadpisaniem auto-doboru
    if (typeof updateAutoLockUI === 'function') updateAutoLockUI();

    refreshAll();
};
