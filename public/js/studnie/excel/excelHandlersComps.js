// @ts-check
/* ===== EXCEL HANDLERS — Akcje użytkownika ===== */

function excelOnCompChange(wIdx, componentType, height, value, productId, redDn) {
    _excelSaveUndoSnapshot();
    _excelMarkAsManual(wIdx);
    const well = wells[wIdx];
    const newQty = parseInt(value) || 0;
    _excelClearResCache(well);

    const filterDn = redDn ? parseInt(redDn) : parseInt(well.dn);

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
            ).filter((p) => p.componentType === componentType && parseInt(p.dn) === filterDn);
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
    _excelMarkManual(well);

    if (newQty > 0 && (componentType === 'krag' || componentType === 'krag_ot')) {
        const hasPrzejscia = well.przejscia && well.przejscia.length > 0;
        const shouldBeOT = hasPrzejscia;
        const wasAddedAsOT = componentType === 'krag_ot';

        if (shouldBeOT !== wasAddedAsOT) {
            const targetType = shouldBeOT ? 'krag_ot' : 'krag';
            well.config = (well.config || []).filter((item) => {
                const p = studnieProducts.find((pr) => pr.id === item.productId);
                if (!p) return true;
                if (p.componentType !== componentType) return true;
                if (height !== undefined && parseInt(p.height) !== parseInt(height)) return true;
                return false;
            });
            let totalExistingQty = 0;
            const _tmpConfig = [];
            for (const _item of well.config || []) {
                const _p = studnieProducts.find((_pr) => _pr.id === _item.productId);
                if (
                    _p &&
                    _p.componentType === targetType &&
                    parseInt(_p.dn) === parseInt(well.dn) &&
                    (height === undefined || parseInt(_p.height) === parseInt(height))
                ) {
                    totalExistingQty += _item.quantity || 1;
                } else {
                    _tmpConfig.push(_item);
                }
            }
            well.config = _tmpConfig;
            const totalQty = totalExistingQty + newQty;
            if (totalQty > 0) {
                const avail =
                    typeof getAvailableProducts === 'function'
                        ? getAvailableProducts(well)
                        : studnieProducts;
                let cand = avail.filter(
                    (p) =>
                        p.componentType === targetType &&
                        parseInt(p.dn) === parseInt(well.dn) &&
                        (height === undefined || parseInt(p.height) === parseInt(height))
                );
                if (typeof filterByWellParams === 'function')
                    cand = cand.filter((p) => filterByWellParams(p, well));
                if (cand.length > 0) {
                    let pid = cand[0].id;
                    if (productId) {
                        const prefix = productId.split('-').slice(0, 2).join('-');
                        const match = cand.find((c) => c.id.startsWith(prefix));
                        if (match) pid = match.id;
                    }
                    _excelInsertConfigItem(well, targetType, pid, totalQty);
                }
            }
        }
    }

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
        var isRing = componentType === 'pierscien_odciazajacy';
        var partnerTypes = isRing
            ? ['plyta_najazdowa', 'plyta_zamykajaca']
            : ['pierscien_odciazajacy'];
        var _avail =
            typeof getAvailableProducts === 'function'
                ? getAvailableProducts(well)
                : studnieProducts || [];
        var hasPartner = false;
        for (var ci = 0; ci < (well.config || []).length; ci++) {
            var cp = _avail.find(function (pr) {
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
            var partnerCandidates = _avail.filter(function (p) {
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
                var partner = partnerCandidates[0];
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
    _excelMarkAsManual(wIdx);
    wells[wIdx].kineta = value;
    if (typeof syncKineta === 'function') syncKineta(wells[wIdx]);
    _excelUpdateLeftPreview(wIdx);
    _excelDebouncedRefresh();
}

function excelOnPsiaBudaChange(wIdx, checked) {
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

async function excelOnReductionSelectChange(wIdx, value) {
    _excelSaveUndoSnapshot();
    var well = wells[wIdx];
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

function excelOnRzednaChange(wIdx) {
    const row = document.querySelector(`tr[data-widx="${wIdx}"]`);
    if (!row) return;
    _excelMarkAsManual(wIdx);
    _excelClearResCache(wells[wIdx]);
    const rzWlazuInput = row.querySelector('input[data-field="rzednaWlazu"]');
    const rzDnaInput = row.querySelector('input[data-field="rzednaDna"]');
    const rzWlazu = rzWlazuInput ? parseDecimal(rzWlazuInput.value) : null;
    const rzDnaRaw = rzDnaInput ? parseDecimal(rzDnaInput.value) : null;
    const rzDna = rzDnaRaw !== null && !isNaN(rzDnaRaw) ? rzDnaRaw : null;

    if (rzWlazu !== null && rzDna !== null && rzWlazu <= rzDna) {
        rzWlazuInput.style.outline = '1px solid #ef4444';
        rzDnaInput.style.outline = '1px solid #ef4444';
        showToast('Rzędna włazu musi być większa od rzędnej dna', 'error');
    } else {
        if (rzWlazuInput) rzWlazuInput.style.outline = '';
        if (rzDnaInput) rzDnaInput.style.outline = '';
    }

    wells[wIdx].rzednaWlazu = rzWlazu;
    wells[wIdx].rzednaDna = rzDna;
    _excelRefreshAutoCells(wIdx, row);
    _excelUpdateLeftPreview(wIdx);
    if (
        _excelAutoSelectEnabled &&
        rzWlazu !== null &&
        rzDna !== null &&
        rzWlazu > rzDna &&
        typeof autoSelectComponents === 'function'
    ) {
        _excelAutoSelectForWell(wIdx);
    }
}

function excelOnPrzejscieChange(wIdx, trIdx, field, value) {
    _excelMarkAsManual(wIdx);
    if (!wells[wIdx].przejscia) wells[wIdx].przejscia = [];
    var hasExisting = trIdx < wells[wIdx].przejscia.length;
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

function excelOnNameChange(wIdx, value) {
    _excelSaveUndoSnapshot();
    _excelMarkAsManual(wIdx);
    const name = (value || '').trim();
    if (!name) return;
    wells[wIdx].name = name;
    wells[wIdx].numer = name.replace(/ (PRE|UTH)$/, '');
    if (typeof autoUpdateWellName === 'function') {
        autoUpdateWellName(wells[wIdx], wIdx);
    }
    _excelRefreshDupColors();
    _excelRenderTabs();
    _excelUpdateWellCount();
    _excelDebouncedRefresh();
}

function excelDuplicateWell(wIdx) {
    const src = wells[wIdx];
    if (!src) return;
    const copy = structuredClone(src);
    copy.id = 'well_' + Date.now() + '_' + Math.floor(Math.random() * 10000);
    copy.name = src.name + ' (kopia)';
    wells.splice(wIdx + 1, 0, copy);
    _excelMaxTransitions[_excelActiveTab] = _excelGetMaxTransitions();
    _excelRenderTabs();
    _excelRenderTable(_excelActiveTab);
    _excelUpdateWellCount();
    setTimeout(() => excelSelectRow(wIdx + 1), 50);
    _excelDebouncedRefresh();
    showToast('Skopiowano: ' + copy.name, 'success');
}

async function excelDeleteWell(wIdx) {
    const well = wells[wIdx];
    if (!well) return;
    if (typeof isWellLocked === 'function' && isWellLocked(wIdx)) {
        showToast('Ta studnia jest zablokowana — nie można usunąć', 'error');
        return;
    }
    if (!(await appConfirm(`Usunąć "${well.name}"?`, { title: 'Usuwanie studni', type: 'danger' })))
        return;
    wells.splice(wIdx, 1);
    if (typeof currentWellIndex !== 'undefined' && currentWellIndex >= wells.length) {
        currentWellIndex = Math.max(0, wells.length - 1);
    }
    _excelMaxTransitions[_excelActiveTab] = _excelGetMaxTransitions();
    _excelRenderTabs();
    _excelRenderTable(_excelActiveTab);
    _excelUpdateWellCount();
    _excelDebouncedRefresh();
    if (typeof renderWellConfig === 'function') renderWellConfig();
    showToast('Studnia usunięta', 'info');
}

function excelSaveAll() {
    var btn = document.getElementById('excel-save-btn');
    if (btn) {
        btn.disabled = true;
        btn.textContent = 'Zapisywanie...';
        btn.style.opacity = '0.5';
        btn.style.cursor = 'not-allowed';
    }
    if (typeof refreshAll === 'function') refreshAll();
    showToast('Zapisano zmiany w tabeli', 'success');
    _excelDirty = false;
    closeExcelTableModal();
}
