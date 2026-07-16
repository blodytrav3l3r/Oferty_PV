// @ts-check
/* ===== ZARZĄDZANIE STUDNIAMI ===== */

// recalcGaskets, syncKineta, enforceGlobalKonusPehdRule przeniesione do actionsWellSync.js

let __refreshAllDepth = 0;
const __MAX_REFRESH_DEPTH = 5;
function refreshAll(skipSummary = false) {
    __refreshAllDepth++;
    if (__refreshAllDepth > __MAX_REFRESH_DEPTH) {
        logger.error('wellManager', '========================================');
        logger.error('wellManager', 'DETEKCJA NIESKOŃCZONEJ PĘTLI refreshAll!');
        logger.error('wellManager', 'Głębokość:', __refreshAllDepth);
        logger.error('wellManager', 'Stack trace:', new Error().stack);
        logger.error('wellManager', '========================================');
        __refreshAllDepth = 0;
        return;
    }
    enforceGlobalKonusPehdRule();

    const well = getCurrentWell();
    if (well) {
        recalcGaskets(well);
        syncKineta(well);
    }

    renderWellsList();
    renderTiles();
    renderWellConfig();
    renderWellPrzejscia();
    renderWellDiagram();
    updateSummary();
    updateDNButtons();
    syncElevationInputs();
    updateAutoLockUI();
    updateZakonczenieButton();
    updateRedukcjaButton();
    if (typeof updateRedukcjaZakButton === 'function') updateRedukcjaZakButton();
    if (typeof updatePsiaBudaButton === 'function') updatePsiaBudaButton();
    if (typeof updateStyczna1200Button === 'function') updateStyczna1200Button();
    updateParamTilesUI();
    renderWellParams();

    if (!skipSummary) {
        renderOfferSummary();
    }

    if (orderEditMode) renderOrderModeBanner();

    // Wymuszenie przetworzenia ikon tylko w zaktualizowanych kontenerach
    // globalny skan, ale szybki, bo omija te, które już stały się <svg>
    if (window.lucide) window.lucide.createIcons();
    __refreshAllDepth--;
}

/* ===== PARAMETRY OGÓLNE (KAFELKI) — przeniesione do wellUI.js ===== */

async function updateWellParam(paramKey, value) {
    if (isWellLocked()) {
        showToast(OFFER_LOCKED_MSG, 'error');
        return;
    }
    if (isWellLocked()) {
        showToast(WELL_LOCKED_MSG, 'error');
        return;
    }
    const well = getCurrentWell();
    if (!well) return;
    const oldParamVal = well[paramKey];
    well[paramKey] = value;

    // Zastosuj cenę malowania dla wszystkich studni w ofercie
    if (paramKey === 'malowanieWewCena' || paramKey === 'malowanieZewCena') {
        wells.forEach((w) => {
            w[paramKey] = value;
        });
        showToast('Zaktualizowano cenę malowania we wszystkich studniach', 'info');
    }

    // Studnia osadnikowa z wkładką PRECO → wymusz kineta=brak, spocznik=brak
    if (paramKey === 'wkladkaOsadnikPreco' && value === 'tak') {
        well.kineta = 'brak';
        well.spocznik = 'brak';
        well.precoFullHeight = 'tak';
    }

    // Domyślne "nie" dla wkładki na całą wysokość przy wyborze kinety PRECO
    if (paramKey === 'kineta' && (value === 'preco' || value === 'precotop')) {
        // Automatically default precoFullHeight to 'nie' when preco is selected for this well
        if (oldParamVal !== 'preco' && oldParamVal !== 'precotop') {
            well.precoFullHeight = 'nie';
        }
        // Wkładka PRECO → kineta zawsze 1/1
        well.spocznikH = '1/1';
    }

    // Automatyczne dopasowanie spocznika do kinety (jeśli ma ten sam materiał)
    if (paramKey === 'kineta') {
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
        if (syncValues.includes(value)) {
            well.spocznik = value;
        }
        if (typeof autoUpdateWellName === 'function') {
            const idx = wells.indexOf(well);
            autoUpdateWellName(well, idx);
            // Wywołaj renderWellsList by zaktualizować na liście po lewej stronie
            renderWellsList();
        }
    }

    // PRECO / PrecoTop → nie pozwalaj na zmianę spocznikH (wymuszenie 1/1)
    if (paramKey === 'spocznikH' && (well.kineta === 'preco' || well.kineta === 'precotop')) {
        well.spocznikH = '1/1';
        showToast('Przy wkładce PRECO kineta musi być 1/1', 'warning');
    }

    // Sprawdzenie konusa dla wkładki na zwieńczenie
    if (paramKey === 'wkladkaZwienczenie' && value !== 'brak') {
        const hasKonus =
            well.config &&
            well.config.some((c) => {
                const p = studnieProducts.find((pr) => pr.id === c.productId);
                return p && p.componentType === 'konus';
            });
        if (hasKonus && typeof window.showKonusPehdResolverModal === 'function') {
            window.showKonusPehdResolverModal(currentWellIndex);
        }
    }

    enforceLoadClassRules(well, paramKey);
    renderWellParams();
    updateParamTilesUI();
    updateAutoLockUI();

    if (typeof updateConfigToMatchParams === 'function') {
        updateConfigToMatchParams(well);
    }
    // Po zamianie elementów zawsze uruchom ponowny auto-dobór (jeśli studnia nie jest zablokowana)
    if (!well.autoLocked) {
        await autoSelectComponents(true);
    }

    refreshAll();
    /* Odśwież tabelę excela jeśli modal otwarty — tylko przy zmianie z zewnątrz */
    if (typeof window.refreshExcelFromConfig === 'function') window.refreshExcelFromConfig();
}

function resetWellParamsToDefaults() {
    const well = getCurrentWell();
    if (!well) return;
    const gp = getWizardGlobalParams();
    WELL_PARAM_DEFS.forEach((def) => {
        if (gp[def.key] !== undefined) well[def.key] = gp[def.key];
    });
    // Zresetuj również nazwy powłok
    well.powlokaNameW = gp.powlokaNameW || '';
    well.powlokaNameZ = gp.powlokaNameZ || '';
    renderWellParams();
    updateParamTilesUI();
    showToast('Parametry studni zresetowane do domyślnych z Kroku 2', 'success');
}

window.updateWellParam = updateWellParam;
window.resetWellParamsToDefaults = resetWellParamsToDefaults;

/* ===== ZASTOSUJ PARAMETRY GLOBALNE DO WSZYSTKICH STUDNI ===== */
async function applyGlobalParamsToAllWells() {
    const gp = getWizardGlobalParams();
    if (wells.length === 0) {
        showToast('Brak studni w ofercie. Dodaj studnię przed zastosowaniem parametrów.', 'info');
        return;
    }
    // Podziel studnie na edytowalne i zablokowane
    const editable = [];
    const locked = [];
    wells.forEach((w, i) => {
        if (isWellLocked(i)) {
            locked.push(w);
        } else {
            editable.push({ well: w, index: i });
        }
    });
    if (editable.length === 0) {
        showToast('Wszystkie studnie są zablokowane. Nie można zastosować parametrów.', 'error');
        return;
    }
    let msg = `Zastosować parametry ogólne do ${editable.length} studni?`;
    if (locked.length > 0) {
        msg += `\n${locked.length} studni zostanie pominiętych (zablokowane).`;
    }
    if (!confirm(msg)) return;
    const prevWellIndex = currentWellIndex;
    for (const { well, index } of editable) {
        for (const key of Object.keys(gp)) {
            well[key] = gp[key];
        }
        // Kineta → spocznik i reguły PRECO
        const kinetaVal = gp.kineta;
        if (kinetaVal) {
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
            if (syncValues.includes(kinetaVal)) {
                well.spocznik = kinetaVal;
            }
            if (kinetaVal === 'preco' || kinetaVal === 'precotop') {
                well.spocznikH = '1/1';
                well.precoFullHeight = gp.precoFullHeight || 'nie';
            }
        }
        enforceLoadClassRules(well, 'klasaNosnosci_korpus');
        enforceLoadClassRules(well, 'nadbudowa');
        enforceLoadClassRules(well, 'dennicaMaterial');
        // Konus + PEHD — wyzeruj wkładkę zwieńczenia
        if (well.wkladkaZwienczenie && well.wkladkaZwienczenie !== 'brak') {
            const hasKonus =
                well.config &&
                well.config.some((c) => {
                    const p = studnieProducts.find((pr) => pr.id === c.productId);
                    return p && p.componentType === 'konus';
                });
            if (hasKonus) well.wkladkaZwienczenie = 'brak';
        }
        if (typeof updateConfigToMatchParams === 'function') {
            updateConfigToMatchParams(well);
        }
        currentWellIndex = index;
        if (
            !well.autoLocked &&
            well.rzednaWlazu != null &&
            well.rzednaDna != null &&
            well.rzednaWlazu > well.rzednaDna
        ) {
            await autoSelectComponents(true);
        }
    }
    currentWellIndex = prevWellIndex;
    refreshAll();
    updateParamTilesUI();
    updateAutoLockUI();
    showToast(`Zastosowano parametry ogólne do ${editable.length} studni`, 'success');
}
window.applyGlobalParamsToAllWells = applyGlobalParamsToAllWells;

// enforceLoadClassRules, enforceLoadClassRulesWizard przeniesione do actionsWellSync.js

async function updateParamInput(paramName, value) {
    const well = getCurrentWell();
    if (!well) return;
    well[paramName] = value;

    // Zastosuj cenę malowania dla wszystkich studni w ofercie
    if (paramName === 'malowanieWewCena' || paramName === 'malowanieZewCena') {
        wells.forEach((w) => {
            w[paramName] = value;
        });
    }

    updateAutoLockUI();
    await autoSelectComponents(true);
    refreshAll();
}

/* ===== AUTO-BLOKADA (TRYB RĘCZNY) ===== */
function toggleAutoLock() {
    const well = getCurrentWell();
    if (!well) {
        showToast('Najpierw dodaj studnię', 'error');
        return;
    }
    well.autoLocked = !well.autoLocked;
    /* Sync z Excelem - ustaw configSource na MANUAL gdy blokujemy */
    well.configSource = well.autoLocked ? 'MANUAL' : 'AUTO';
    well.autoSelect = !well.autoLocked;
    updateAutoLockUI();
    /* Odswiez Excel jesli otwarty */
    if (typeof window._excelSyncAutoManualUI === 'function') window._excelSyncAutoManualUI();
    if (typeof window.refreshExcelFromConfig === 'function') window.refreshExcelFromConfig();
}

// updateAutoLockUI() przeniesiona do wellUI.js

// handleAppConfirm, confirmApp, updateDiscount, applyDiscount,
// updateGlobalPaintingCost, updateGlobalPehdDiscount, getDiscountedTotal
// przeniesione do actionsWellDiscounts.js

// getWellActiveDiscounts, getItemAssessedPrice, getItemPriceBreakdown,
// calcWellStats, calcPrecoPricing przeniesione do actionsWellPricing.js
