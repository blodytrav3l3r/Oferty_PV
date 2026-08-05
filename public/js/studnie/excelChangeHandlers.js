// @ts-check
/* ===== EXCEL CHANGE HANDLERS — Handlery zmian wartości w tabeli studni ===== */

/* ===== HANDLERS ===== */
function excelOnRzednaChange(wIdx) {
    const row = document.querySelector(`tr[data-widx="${wIdx}"]`);
    if (!row) return;
    const well = wells[wIdx];
    if (!well) return;
    if (!_excelGuardWellLocked(wIdx)) return;
    _excelClearResCache(well);
    const rzWlazuInput = row.querySelector('input[data-field="rzednaWlazu"]');
    const rzDnaInput = row.querySelector('input[data-field="rzednaDna"]');
    const rzWlazuRaw = rzWlazuInput ? parseFloat(rzWlazuInput.value) : null;
    const rzWlazu = rzWlazuRaw !== null && !isNaN(rzWlazuRaw) ? rzWlazuRaw : null;
    const rzDnaRaw = rzDnaInput ? parseFloat(rzDnaInput.value) : null;
    const rzDna = rzDnaRaw !== null && !isNaN(rzDnaRaw) ? rzDnaRaw : null;

    if (rzWlazu !== null && rzDna !== null && rzWlazu <= rzDna) {
        rzWlazuInput.style.outline = '1px solid var(--danger)';
        rzDnaInput.style.outline = '1px solid var(--danger)';
        showToast('Rzędna włazu musi być większa od rzędnej dna', 'error');
    } else {
        if (rzWlazuInput) rzWlazuInput.style.outline = '';
        if (rzDnaInput) rzDnaInput.style.outline = '';
    }

    well.rzednaWlazu = rzWlazu;
    well.rzednaDna = rzDna;
    _excelMarkDirty();
    _excelRefreshAutoCells(wIdx, row);
    _excelUpdateLeftPreview(wIdx);

    if (
        _excelAutoSelectEnabled &&
        well.autoSelect !== false &&
        rzWlazu !== null &&
        rzDna !== null &&
        rzWlazu > rzDna &&
        typeof autoSelectComponents === 'function'
    ) {
        _excelAutoSelectForWell(wIdx);
    } else {
        _excelMarkAsManual(wIdx);
        if (typeof _excelDebouncedRefresh === 'function') _excelDebouncedRefresh();
    }
}

/* ===== DODAWANIE / USUWANIE KOLUMNY PRZEJŚCIA ===== */
function excelRemoveTransitionColumn() {
    let tab = _excelActiveTab || '1000';
    if (_excelAnyWellLockedInTab(tab)) {
        showToast(
            'Nie można usunąć kolumny przejścia — w tej zakładce są zablokowane studnie',
            'error'
        );
        return;
    }
    let curMax = _excelMaxTransitions[tab] || 1;
    if (curMax <= 1 && wells.length > 0) {
        showToast('Nie można usunąć — minimum 1 kolumna przejścia', 'error');
        return;
    }
    const lastIdx = curMax - 1;
    let hasData = false;
    if (typeof wells !== 'undefined' && Array.isArray(wells)) {
        for (const w of wells) {
            if (!_excelWellMatchesTab(w, tab)) continue;
            if (w.przejscia && w.przejscia[lastIdx]) {
                const p = w.przejscia[lastIdx];
                if (
                    (p.rzednaWlaczenia !== null && p.rzednaWlaczenia !== '') ||
                    (p.productId !== null && p.productId !== '') ||
                    (p.kat && p.kat !== 0)
                ) {
                    hasData = true;
                    break;
                }
            }
        }
    }
    if (hasData) {
        showToast('Nie można usunąć — ostatnia kolumna zawiera dane', 'error');
        return;
    }
    if (typeof wells !== 'undefined' && Array.isArray(wells)) {
        wells.forEach((w) => {
            if (!_excelWellMatchesTab(w, tab)) return;
            if (w.przejscia && w.przejscia.length > 0) {
                w.przejscia.pop();
            }
        });
    }
    _excelMaxTransitions[tab] = Math.max(1, curMax - 1);
    _excelRenderTable(_excelActiveTab);
    _excelDebouncedRefresh();
    showToast('Usunięto kolumnę przejścia', 'info');
}
function excelAddTransitionColumn() {
    let tab = _excelActiveTab || '1000';
    if (_excelAnyWellLockedInTab(tab)) {
        showToast(
            'Nie można dodać kolumny przejścia — w tej zakładce są zablokowane studnie',
            'error'
        );
        return;
    }
    _excelMaxTransitions[tab] = (_excelMaxTransitions[tab] || 1) + 1;
    let newMax = _excelMaxTransitions[tab];
    if (typeof wells !== 'undefined' && Array.isArray(wells)) {
        wells.forEach((w) => {
            if (!_excelWellMatchesTab(w, tab)) return;
            if (!w.przejscia) w.przejscia = [];
            while (w.przejscia.length < newMax) {
                w.przejscia.push(_excelCreatePrzejscie());
            }
        });
    }
    _excelRenderTable(tab);
    _excelDebouncedRefresh();
    showToast('Dodano kolumnę przejścia', 'info');
}
function _excelCleanEmptyPrzejscia(well) {
    if (!well || !well.przejscia) return;
    well.przejscia = well.przejscia.filter(function (p) {
        return (
            (p.productId && p.productId !== '') ||
            (p.tempCategory && p.tempCategory !== '') ||
            (p.rzednaWlaczenia != null && p.rzednaWlaczenia !== '')
        );
    });
}

function excelOnPrzejscieChange(wIdx, trIdx, field, value) {
    if (!_excelGuardWellLocked(wIdx)) return;
    _excelMarkAsManual(wIdx);
    if (!wells[wIdx].przejscia) wells[wIdx].przejscia = [];
    let hasExisting = trIdx < wells[wIdx].przejscia.length;
    if (!hasExisting && (!value || value === '')) return;
    while (wells[wIdx].przejscia.length <= trIdx) {
        wells[wIdx].przejscia.push(_excelCreatePrzejscie());
    }
    const prz = wells[wIdx].przejscia[trIdx];
    prz[field] = field === 'angle' ? parseFloat(value) || 0 : value || null;
    if (field === 'angle') {
        prz.angleExecution = parseFloat(prz.angle) || 0;
        prz.angleGony = (parseFloat(prz.angle) || 0).toFixed(2);
        prz.flowType = (parseFloat(prz.angle) || 0) === 0 ? 'WYLOT' : 'WLOT';
    }
    wells[wIdx].przejscia.forEach((p, i) => {
        p.displayIndex = i;
    });
    _excelUpdateLeftPreview(wIdx);
    _excelDebouncedRefresh();
}

function excelOnPrzejscieTypeChange(wIdx, trIdx, value) {
    if (!_excelGuardWellLocked(wIdx)) return;
    if (!wells[wIdx].przejscia) wells[wIdx].przejscia = [];
    while (wells[wIdx].przejscia.length <= trIdx) {
        wells[wIdx].przejscia.push(_excelCreatePrzejscie());
    }
    wells[wIdx].przejscia[trIdx].tempCategory = value || '';
    if (!value) {
        wells[wIdx].przejscia[trIdx].productId = '';
    } else {
        const currProduct = studnieProducts.find(
            (p) => p.id === wells[wIdx].przejscia[trIdx].productId
        );
        if (!currProduct || currProduct.category !== value) {
            wells[wIdx].przejscia[trIdx].productId = '';
        }
    }
    currentWellIndex = -1;
    _excelRenderTable(_excelActiveTab);
    _excelDebouncedRefresh();
}

function excelOnWlazChange(wIdx, productId) {
    if (!_excelGuardWellLocked(wIdx)) return;
    const well = wells[wIdx];
    well.config = (well.config || []).filter((item) => {
        const p = studnieProducts.find((pr) => pr.id === item.productId);
        return !(p && p.componentType === 'wlaz');
    });
    if (productId) _excelInsertConfigItem(well, 'wlaz', productId, 1);
    _excelMarkManual(well);
    _excelUpdateLeftPreview(wIdx);
    _excelUpdateHeaderProdCodes();
    _excelDebouncedRefresh();
}

function _excelMarkManual(well) {
    if (!well) return;
    well.autoLocked = true;
    well.configSource = 'MANUAL';
    well.autoSelect = false;
    if (typeof _excelSyncAutoManualUI === 'function') _excelSyncAutoManualUI();
    if (typeof window.updateAutoLockUI === 'function') window.updateAutoLockUI();
    if (typeof _excelRenderTable === 'function') _excelRenderTable(_excelActiveTab);
    if (typeof window.updateSummary === 'function') window.updateSummary();
    if (typeof window.renderWellDiagram === 'function') window.renderWellDiagram();
    if (typeof window.renderWellsList === 'function') window.renderWellsList();
}

function excelOnCompChange(wIdx, componentType, height, value, productId, redDn) {
    if (!_excelGuardWellLocked(wIdx)) return;
    _excelSaveUndoSnapshot();
    _excelMarkAsManual(wIdx);
    const well = wells[wIdx];
    const newQty = parseInt(value) || 0;
    _excelClearResCache(well);

    const filterDn = redDn
        ? parseInt(redDn)
        : well.dn === 'styczna' || well.dn === 'styczne'
          ? well.stycznaNadbudowa1200
              ? 1200
              : 1000
          : parseInt(well.dn);

    const existingItems = [];
    if (!productId) {
        for (const item of well.config || []) {
            const p = studnieProducts.find((pr) => pr.id === item.productId);
            if (!p) continue;
            if (p.componentType !== componentType) continue;
            if (height !== undefined && parseInt(p.height) !== parseInt(height)) continue;
            existingItems.push({ productId: item.productId, quantity: item.quantity });
        }
    }

    well.config = (well.config || []).filter((item) => {
        const p = studnieProducts.find((pr) => pr.id === item.productId);
        if (!p) return true;
        if (productId) return item.productId !== productId;
        if (p.componentType !== componentType) return true;
        if (height !== undefined && parseInt(p.height) !== parseInt(height)) return true;
        return false;
    });

    if (newQty > 0) {
        let candidates;
        if (productId) {
            candidates = (
                typeof getAvailableProducts === 'function'
                    ? getAvailableProducts(well)
                    : studnieProducts
            ).filter((p) => p.id === productId);
            if (typeof filterByWellParams === 'function')
                candidates = candidates.filter((p) => filterByWellParams(p, well));
        } else {
            candidates = (
                typeof getAvailableProducts === 'function'
                    ? getAvailableProducts(well)
                    : studnieProducts
            ).filter(
                (p) =>
                    p.componentType === componentType &&
                    (p.dn === null || parseInt(p.dn) === filterDn)
            );
            if (height !== undefined)
                candidates = candidates.filter((p) => parseInt(p.height) === parseInt(height));
            if (typeof filterByWellParams === 'function')
                candidates = candidates.filter((p) => filterByWellParams(p, well));
        }
        if (existingItems.length > 0 && !productId) {
            const firstPid = existingItems[0].productId;
            const stillAvail = candidates.some((c) => c.id === firstPid);
            const pid = stillAvail ? firstPid : candidates.length > 0 ? candidates[0].id : null;
            if (pid) _excelInsertConfigItem(well, componentType, pid, newQty);
        } else if (candidates.length > 0) {
            _excelInsertConfigItem(well, componentType, candidates[0].id, newQty);
        }
    }

    if (componentType === 'krag' || componentType === 'krag_ot') {
        _excelCleanEmptyPrzejscia(well);
        if (typeof enforceOtRings === 'function') {
            const savedIdx = typeof currentWellIndex !== 'undefined' ? currentWellIndex : -1;
            try {
                currentWellIndex = wIdx;
                enforceOtRings();
            } finally {
                if (savedIdx >= 0) currentWellIndex = savedIdx;
            }
        }
    }
    /* Odśwież tabelę PO konwersji krag/krag_ot — inaczej komórki kręgów
       pokazują starą wartość (re-render przed konwersją był nieaktualny). */
    _excelMarkManual(well);

    const row = document.querySelector(`tr[data-widx="${wIdx}"]`);
    if (row) _excelRefreshAutoCells(wIdx, row);
    _excelUpdateLeftPreview(wIdx);
    _excelUpdateHeaderProdCodes();
    _excelDebouncedRefresh();

    if (
        newQty > 0 &&
        (componentType === 'plyta_najazdowa' ||
            componentType === 'plyta_zamykajaca' ||
            componentType === 'pierscien_odciazajacy')
    ) {
        let isRing = componentType === 'pierscien_odciazajacy';
        let partnerTypes = isRing
            ? ['plyta_najazdowa', 'plyta_zamykajaca']
            : ['pierscien_odciazajacy'];
        let _avail =
            typeof getAvailableProducts === 'function'
                ? getAvailableProducts(well)
                : studnieProducts || [];
        let hasPartner = false;
        for (let ci = 0; ci < (well.config || []).length; ci++) {
            let cp = _avail.find(function (pr) {
                return pr.id === well.config[ci].productId;
            });
            if (cp && partnerTypes.indexOf(cp.componentType) !== -1) {
                if (height === undefined || parseInt(cp.height) === parseInt(height)) {
                    hasPartner = true;
                    break;
                }
            }
        }
        if (!hasPartner) {
            let partnerCandidates = _avail.filter(function (p) {
                return (
                    partnerTypes.indexOf(p.componentType) !== -1 &&
                    parseInt(p.dn) === parseInt(well.dn)
                );
            });
            if (height !== undefined) {
                partnerCandidates = partnerCandidates.filter(function (p) {
                    return parseInt(p.height) === parseInt(height);
                });
            }
            if (partnerCandidates.length > 0) {
                let partner = partnerCandidates[0];
                _excelInsertConfigItem(well, partner.componentType, partner.id, 1);
                _excelSortConfig(well);
                _excelRenderTable(_excelActiveTab);
            }
        }
    }
    if (typeof window.updateSummary === 'function') window.updateSummary();
    if (typeof window.renderWellDiagram === 'function') window.renderWellDiagram();
    if (typeof window.renderWellsList === 'function') window.renderWellsList();
}

function excelOnKinetaChange(wIdx, value) {
    if (!_excelGuardWellLocked(wIdx)) return;
    _excelMarkAsManual(wIdx);
    wells[wIdx].kineta = value;
    if (typeof syncKineta === 'function') syncKineta(wells[wIdx]);
    _excelUpdateLeftPreview(wIdx);
    _excelDebouncedRefresh();
}

function excelOnPsiaBudaChange(wIdx, checked) {
    if (!_excelGuardWellLocked(wIdx)) return;
    _excelMarkAsManual(wIdx);
    const well = wells[wIdx];
    if (checked) {
        well._psiaBudaBackup = {
            kineta: well.kineta || 'beton',
            spocznik: well.spocznik || 'beton',
            spocznikH: well.spocznikH || '1/2'
        };
        well.kineta = 'brak';
        well.spocznik = 'brak';
        well.spocznikH = 'brak';
    } else {
        if (well._psiaBudaBackup) {
            well.kineta = well._psiaBudaBackup.kineta;
            well.spocznik = well._psiaBudaBackup.spocznik;
            well.spocznikH = well._psiaBudaBackup.spocznikH;
            delete well._psiaBudaBackup;
        }
    }
    well.psiaBuda = checked;
    const row = document.querySelector(`tr[data-widx="${wIdx}"]`);
    if (row) _excelRefreshAutoCells(wIdx, row);
    _excelUpdateLeftPreview(wIdx);
    _excelDebouncedRefresh();
}

/* ===== Redukcja — pojedynczy select: Brak / DN1000 / DN1200 ===== */
async function excelOnReductionSelectChange(wIdx, value) {
    if (!_excelGuardWellLocked(wIdx)) return;
    _excelSaveUndoSnapshot();
    let well = wells[wIdx];
    if (!well) return;
    if (!value) {
        well.redukcjaDN1000 = false;
        well.redukcjaTargetDN = 1000;
    } else {
        well.redukcjaDN1000 = true;
        well.redukcjaTargetDN = parseInt(value) || 1000;
    }
    _excelClearResCache(well);
    _excelUpdateLeftPreview(wIdx);
    if (!well.autoLocked && typeof autoSelectComponents === 'function') {
        well.configSource = 'AUTO';
        well.config = [];
        await autoSelectComponents(true);
    }
    _excelRenderTable(_excelActiveTab);
    _excelDebouncedRefresh();
}
