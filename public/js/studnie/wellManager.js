// @ts-check
/* ===== ZARZĄDZANIE STUDNIAMI ===== */

// recalcGaskets, syncKineta, enforceGlobalKonusPehdRule przeniesione do actionsWellSync.js

let __refreshAllDepth = 0;
const __MAX_REFRESH_DEPTH = 5;
if (typeof window !== 'undefined') window.__refreshAllDepth = __refreshAllDepth;
// P1.3 batch coalesce — during tmApplyChanges bulk solver, full refreshAll is deferred to single pass
if (typeof window !== 'undefined') window.__tmBatchDepth = window.__tmBatchDepth || 0;
function refreshAll(skipSummary = false) {
    if (typeof window !== 'undefined' && window.__tmBatchDepth > 0) {
        if (typeof refreshActiveWell === 'function') {
            try {
                refreshActiveWell();
            } catch {}
        }
        return;
    }
    // P1a quiet bulk (Excel "auto dla wszystkich"): modal zasłania panel główny,
    // więc pośrednie pełne rendery są odpadem. Wycisza WYŁĄCZNIE UI — stan
    // (wells/config), solver, AI, telemetria i walidacje działają bez zmian.
    // Końcowy render po bulk (po zdjęciu flagi) domalowuje wszystko naraz.
    if (typeof window !== 'undefined' && window.__excelBulkDepth > 0) {
        if (typeof window.__excelBulkStats === 'object' && window.__excelBulkStats !== null) {
            window.__excelBulkStats.refreshSkipped++;
        }
        return;
    }
    __refreshAllDepth++;
    if (typeof window !== 'undefined') window.__refreshAllDepth = __refreshAllDepth;
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
    try {
        const b = document.getElementById('btab-uwagi');
        if (b instanceof HTMLElement) {
            const w = typeof getCurrentWell === 'function' ? getCurrentWell() : null;
            const hu = !!(w && w.uwagi && String(w.uwagi).trim());
            b.classList.toggle('has-uwagi', hu);
            b.title = hu ? String(w.uwagi).slice(0, 80) : 'Dodaj uwagi do tej studni';
        }
    } catch (_e) {}
    updateZakonczenieButton();
    updateRedukcjaButton();
    if (typeof updateRedukcjaZakButton === 'function') updateRedukcjaZakButton();
    if (typeof updatePsiaBudaButton === 'function') updatePsiaBudaButton();
    if (typeof updateStyczna1200Button === 'function') updateStyczna1200Button();
    updateParamTilesUI();
    renderWellParams();
    applyOrderedWellSoftLockUI();

    if (!skipSummary) {
        renderOfferSummary();
    }

    if (orderEditMode) renderOrderModeBanner();

    // Wymuszenie przetworzenia ikon tylko w zaktualizowanych kontenerach
    // globalny skan, ale szybki, bo omija te, które już stały się <svg>
    if (window.lucide) window.lucide.createIcons();
    __refreshAllDepth--;
    if (typeof window !== 'undefined') window.__refreshAllDepth = __refreshAllDepth;
}

// P0.5 lightweight refresh — tylko aktywna studnia, BEZ listy/oferty/DN tiles (v1.1 kontrakt)
// NIE zmienia kolejności/semantyki operacji biznesowych, tylko zakres renderu.
// NIE: renderWellsList, renderTiles, renderOfferSummary, updateDNButtons
function refreshActiveWell() {
    // invariant: tylko 4 rendery aktywnej studni + ikony scoped
    renderWellPrzejscia();
    renderWellDiagram();
    renderWellConfig();
    updateSummary();
    if (window.lucide) window.lucide.createIcons();
}
if (typeof window !== 'undefined') window.refreshActiveWell = refreshActiveWell;

/* ===== PARAMETRY OGÓLNE (KAFELKI) — przeniesione do wellUI.js ===== */

async function updateWellParam(paramKey, value) {
    const well = getCurrentWell();
    if (!well) return;
    if (typeof isOrderedWellSoftLocked === 'function' && isOrderedWellSoftLocked(well)) {
        showToast(OFFER_LOCKED_MSG, 'error');
        return;
    }
    if (isWellLocked()) {
        const hasAcceptedPO = (
            typeof productionOrders !== 'undefined' && productionOrders ? productionOrders : []
        ).some((po) => po.wellId === well.id && po.status === 'accepted');
        showToast(hasAcceptedPO ? WELL_LOCKED_MSG : OFFER_LOCKED_MSG, 'error');
        return;
    }
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
    }
    if (
        paramKey === 'kineta' &&
        (value === 'preco' || value === 'precotop' || value === 'unolith')
    ) {
        // Wkładka PRECO/UnoLith → spocznik zawsze 1/1
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

    // PRECO / PrecoTop / UnoLith → nie pozwalaj na zmianę spocznikH (wymuszenie 1/1)
    if (
        paramKey === 'spocznikH' &&
        (well.kineta === 'preco' || well.kineta === 'precotop' || well.kineta === 'unolith')
    ) {
        well.spocznikH = '1/1';
        showToast('Przy wkładce PRECO kineta musi być 1/1', 'warning');
    }

    // Sprawdzenie konusa dla wkładki na zwieńczenie
    if (paramKey === 'wkladkaZwienczenie' && value !== 'brak') {
        const hasKonus =
            well.config &&
            well.config.some((c) => {
                const p =
                    typeof getStudnieProductById === 'function'
                        ? getStudnieProductById(c.productId)
                        : studnieProducts.find((pr) => pr.id === c.productId);
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
    if (typeof isOrderedWellSoftLocked === 'function' && isOrderedWellSoftLocked(well)) {
        showToast(OFFER_LOCKED_MSG, 'error');
        return;
    }
    if (isWellLocked()) {
        showToast(WELL_LOCKED_MSG, 'error');
        return;
    }
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
    if (!(await appConfirm(msg, { title: 'Parametry ogólne' }))) return;
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
                well.precoFullHeight = gp.precoFullHeight || 'nie';
            }
            if (kinetaVal === 'preco' || kinetaVal === 'precotop' || kinetaVal === 'unolith') {
                well.spocznikH = '1/1';
            }
        }
        // Psia buda → dennica zawsze bez dna: parametry globalne nie nadpisują braku
        if (well.psiaBuda) {
            well.kineta = 'brak';
            well.spocznik = 'brak';
            well.spocznikH = 'brak';
        }
        enforceLoadClassRules(well, 'klasaNosnosci_korpus');
        enforceLoadClassRules(well, 'nadbudowa');
        enforceLoadClassRules(well, 'dennicaMaterial');
        // Konus + PEHD — wyzeruj wkładkę zwieńczenia
        if (well.wkladkaZwienczenie && well.wkladkaZwienczenie !== 'brak') {
            const hasKonus =
                well.config &&
                well.config.some((c) => {
                    const p =
                        typeof getStudnieProductById === 'function'
                            ? getStudnieProductById(c.productId)
                            : studnieProducts.find((pr) => pr.id === c.productId);
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
    if (typeof isOrderedWellSoftLocked === 'function' && isOrderedWellSoftLocked(well)) {
        showToast(OFFER_LOCKED_MSG, 'error');
        return;
    }
    if (isWellLocked()) {
        showToast(WELL_LOCKED_MSG, 'error');
        return;
    }
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
    if (typeof isOrderedWellSoftLocked === 'function' && isOrderedWellSoftLocked(well)) {
        showToast(OFFER_LOCKED_MSG, 'error');
        return;
    }
    if (isWellLocked()) {
        showToast(WELL_LOCKED_MSG, 'error');
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
    /* Odblokowanie = faktyczny auto-dobor (solver nadpisze configSource
       na AUTO_JS/AUTO_AI); bez tego stary manualny config zostalby
       klamliwie oznaczony jako automatyczny. */
    if (!well.autoLocked && typeof window.autoSelectComponents === 'function') {
        window.autoSelectComponents(true);
    }
}

// updateAutoLockUI() przeniesiona do wellUI.js

// handleAppConfirm, confirmApp, updateDiscount, applyDiscount,
// updateGlobalPaintingCost, updateGlobalPehdDiscount, getDiscountedTotal
// przeniesione do actionsWellDiscounts.js

// getWellActiveDiscounts, getItemAssessedPrice, getItemPriceBreakdown,
// calcWellStats, calcPrecoPricing przeniesione do actionsWellPricing.js

/* ===== FULL-LOCK UI: Konfiguracja studni — wszystko zablokowane dla studni na zamówieniu ===== */
function applyOrderedWellSoftLockUI() {
    const well = typeof getCurrentWell === 'function' ? getCurrentWell() : null;
    const softLocked =
        typeof isOrderedWellSoftLocked === 'function' && isOrderedWellSoftLocked(well);
    const idsToLock = [
        'input-well-numer',
        'input-rzedna-wlazu',
        'input-rzedna-dna',
        'input-doplata',
        'redukcja-min-h'
    ];
    idsToLock.forEach((id) => {
        const el = document.getElementById(id);
        if (!(el instanceof HTMLElement)) return;
        el.disabled = !!softLocked;
        el.style.opacity = softLocked ? '0.5' : '';
        el.style.cursor = softLocked ? 'not-allowed' : '';
        el.title = softLocked ? 'Studnia na zamówieniu — pole zablokowane' : '';
    });
    const btnIdsToLock = [
        'btn-redukcja',
        'btn-styczna-1200',
        'btn-redukcja-zak',
        'btn-lock-auto',
        'btn-auto-select',
        'btn-psia-buda',
        'btn-zakonczenie'
    ];
    btnIdsToLock.forEach((id) => {
        const el = document.getElementById(id);
        if (!(el instanceof HTMLElement)) return;
        el.disabled = !!softLocked;
        el.style.opacity = softLocked ? '0.5' : '';
        el.style.cursor = softLocked ? 'not-allowed' : '';
        el.style.pointerEvents = softLocked ? 'none' : '';
        if (softLocked) el.title = 'Studnia na zamówieniu — edycja zablokowana';
        else el.removeAttribute('title');
    });
    const clearBtn = document.querySelector('button[onclick="clearWellConfig()"]');
    if (clearBtn) {
        clearBtn.disabled = !!softLocked;
        clearBtn.style.opacity = softLocked ? '0.5' : '';
        clearBtn.style.cursor = softLocked ? 'not-allowed' : '';
        clearBtn.style.pointerEvents = softLocked ? 'none' : '';
    }
    document.querySelectorAll('.dn-btn').forEach((b) => {
        if (!(b instanceof HTMLElement)) return;
        b.disabled = !!softLocked;
        b.style.opacity = softLocked ? '0.5' : '';
        b.style.cursor = softLocked ? 'not-allowed' : '';
        b.style.pointerEvents = softLocked ? 'none' : '';
        if (softLocked) b.title = 'Studnia na zamówieniu — edycja zablokowana';
        else b.removeAttribute('title');
    });
}
window.applyOrderedWellSoftLockUI = applyOrderedWellSoftLockUI;

/* ===== Rejestracja globali ===== */
window.toggleAutoLock = toggleAutoLock;

/* ===== Rejestracja globali ===== */
window.updateParamInput = updateParamInput;
