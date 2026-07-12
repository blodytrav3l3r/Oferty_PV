// @ts-check
/* ===== EXCEL HANDLERS — Akcje uzytkownika, zmiany konfiguracji ===== */

function excelOnCompChange(wIdx, componentType, height, value, productId, redDn) {
    _excelSaveUndoSnapshot();
    _excelMarkAsManual(wIdx);
    const well = wells[wIdx];
    const newQty = parseInt(value) || 0;
    _excelClearResCache(well);

    /* Dla kolumn redukcji: użyj targetDn zamiast well.dn do filtrowania produktów */
    const filterDn = redDn ? parseInt(redDn) : parseInt(well.dn);

    /* Zachowaj istniejące warianty — nie niszcz wyboru beton/żelbet/bez stopni */
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
        /* Zachowaj wariant — użyj pierwszego istniejącego productId, nie candidates[0] */
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

    /* Auto-konwersja krag ↔ krag_ot: jesli studnia ma przejscia → OT, jesli nie → zwykly */
    if (newQty > 0 && (componentType === 'krag' || componentType === 'krag_ot')) {
        const hasPrzejscia = well.przejscia && well.przejscia.length > 0;
        const shouldBeOT = hasPrzejscia;
        const wasAddedAsOT = componentType === 'krag_ot';

        if (shouldBeOT !== wasAddedAsOT) {
            const targetType = shouldBeOT ? 'krag_ot' : 'krag';
            /* Usuń dopiero-co dodany element złego typu */
            well.config = (well.config || []).filter((item) => {
                const p = studnieProducts.find((pr) => pr.id === item.productId);
                if (!p) return true;
                if (p.componentType !== componentType) return true;
                if (height !== undefined && parseInt(p.height) !== parseInt(height)) return true;
                return false;
            });
            /* Znajdź i usuń WSZYSTKIE istniejące elementy dobrego typu na tej wysokości */
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

    /* Komplet odciążający: pł.odc ↔ pierśc.odc — dodaj brakującą parę z tą samą wysokością */
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
        /* Sprawdź czy partner już istnieje (z tą samą wysokością) */
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
    /* Odswiez glowny panel po zmianie konfiguracji */
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
        /* Backup parametrów przed włączeniem */
        well._psiaBudaBackup = {
            kineta: well.kineta || 'beton',
            spocznik: well.spocznik || 'beton',
            spocznikH: well.spocznikH || '1/2'
        };
        well.kineta = 'brak';
        well.spocznik = 'brak';
        well.spocznikH = 'brak';
    } else {
        /* Przywróć backup */
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
        /* Brak = wyłącz redukcję */
        well.redukcjaDN1000 = false;
        well.redukcjaTargetDN = 1000;
    } else {
        well.redukcjaDN1000 = true;
        well.redukcjaTargetDN = parseInt(value) || 1000;
    }
    _excelClearResCache(well);
    _excelUpdateLeftPreview(wIdx);
    /* Wywołaj autoSelectComponents aby przeliczyć config z uwzględnieniem redukcji */
    if (!well.autoLocked && typeof autoSelectComponents === 'function') {
        well.configSource = 'AUTO';
        well.config = [];
        await autoSelectComponents(true);
    }
    /* Pełen re-render tabeli — kolumny nadbudowy redukcji mogą się zmienić */
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
    /* Użyj null tylko gdy nie da się sparsować (gdy NaN lub pusty) */
    const rzDna = rzDnaRaw !== null && !isNaN(rzDnaRaw) ? rzDnaRaw : null;

    /* Walidacja: rzędna włazu musi być większa od rzędnej dna */
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
    /* Nie wywołuj _excelDebouncedRefresh — wysokość nie zmienia kodów h3,
       a _excelRefreshAutoCells juz zaktualizowalo height/uszcz cells */
}

function excelOnPrzejscieChange(wIdx, trIdx, field, value) {
    _excelMarkAsManual(wIdx);
    if (!wells[wIdx].przejscia) wells[wIdx].przejscia = [];
    /* Nie twórz pustego przejścia, jeśli wartość jest pusta i nie ma jeszcze przejścia */
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
    /* Nadaj displayIndex */
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
    // Jeśli wyczyszczono rodzaj, usuń również productId
    if (!value) {
        wells[wIdx].przejscia[trIdx].productId = '';
    } else {
        // Sprawdź, czy dotychczas wybrany produkt pasuje do nowego rodzaju
        const currProduct = studnieProducts.find(
            (p) => p.id === wells[wIdx].przejscia[trIdx].productId
        );
        if (!currProduct || currProduct.category !== value) {
            wells[wIdx].przejscia[trIdx].productId = ''; // wyczyść, bo rodzaj się zmienił
        }
    }
    // Renderuj ponownie tabelę, by zaktualizować listę średnic (DN)
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

function _excelUpdateWellParam(wIdx, paramKey, value) {
    const well = wells[wIdx];
    if (!well) return;
    well[paramKey] = value;
    /* Cena malowania — aktualizuj we wszystkich studniach */
    if (paramKey === 'malowanieWewCena' || paramKey === 'malowanieZewCena') {
        wells.forEach(function (w) {
            w[paramKey] = value;
        });
    }
    /* Wkładka PRECO → wymuś kineta/spocznik */
    if (paramKey === 'wkladkaOsadnikPreco' && value === 'tak') {
        well.kineta = 'brak';
        well.spocznik = 'brak';
        well.precoFullHeight = 'tak';
    }
    _excelDebouncedRefresh();
    _excelRenderTable(_excelActiveTab);
    /* Odśwież popup */
    var existing = document.getElementById('excel-params-popup');
    if (existing) {
        existing.remove();
        excelOpenWellParams(wIdx);
    }
}

function _excelInsertConfigItem(well, componentType, productId, qty) {
    _excelClearResCache(well);
    /* Konus + PEHD wkładka — blokada jak w głównym konfiguratorze */
    if (
        componentType === 'konus' &&
        well.wkladkaZwienczenie &&
        well.wkladkaZwienczenie !== 'brak'
    ) {
        showToast('Nie można dodać konusa przy aktywnej wkładce PEHD zwieńczenia.', 'error');
        return;
    }
    const topTypes = [
        'wlaz',
        'plyta_din',
        'plyta_najazdowa',
        'plyta_zamykajaca',
        'konus',
        'pierscien_odciazajacy'
    ];
    const bottomTypes = ['dennica', 'kineta', 'styczna'];
    const reliefTypes = ['pierscien_odciazajacy', 'plyta_zamykajaca', 'plyta_najazdowa'];
    if (topTypes.includes(componentType)) {
        /* Właz: tylko wstaw, nie ruszaj reszty zakończeń */
        if (componentType === 'wlaz') {
            const wlazIdx = well.config.findIndex((item) => {
                const p =
                    typeof studnieProducts !== 'undefined'
                        ? studnieProducts.find((pr) => pr.id === item.productId)
                        : null;
                return p && p.componentType === 'wlaz';
            });
            const insertAt = wlazIdx >= 0 ? wlazIdx + 1 : 0;
            well.config.splice(insertAt, 0, { productId, quantity: qty, autoAdded: false });
            _excelSortConfig(well);
            return;
        }
        /* Jeśli dodajemy element odciążający: zachowaj partnera, usuń resztę */
        if (reliefTypes.includes(componentType)) {
            well.config = well.config.filter((item) => {
                const p =
                    typeof studnieProducts !== 'undefined'
                        ? studnieProducts.find((pr) => pr.id === item.productId)
                        : null;
                if (!p) return true;
                if (reliefTypes.includes(p.componentType)) {
                    return p.componentType !== componentType;
                }
                return !topTypes.includes(p.componentType);
            });
        } else {
            /* Nie-odciążający (konus/plyta_din): usuń wszystkie zakończenia */
            well.config = well.config.filter((item) => {
                const p =
                    typeof studnieProducts !== 'undefined'
                        ? studnieProducts.find((pr) => pr.id === item.productId)
                        : null;
                return !(p && topTypes.includes(p.componentType));
            });
        }
        /* Wstaw za włazem (jeśli istnieje), żeby nie rozbić kolejności góra-dół */
        const wlazIdx = well.config.findIndex((item) => {
            const p =
                typeof studnieProducts !== 'undefined'
                    ? studnieProducts.find((pr) => pr.id === item.productId)
                    : null;
            return p && p.componentType === 'wlaz';
        });
        const insertAt = wlazIdx >= 0 ? wlazIdx + 1 : 0;
        well.config.splice(insertAt, 0, { productId, quantity: qty, autoAdded: false });
        /* Auto-uzupełnij komplet odciążający — z blokadą rekurencji */
        if (!_excelAddingReliefPair && typeof window.ensureReliefRingPair === 'function') {
            _excelAddingReliefPair = true;
            window.ensureReliefRingPair(well);
            setTimeout(function () {
                _excelAddingReliefPair = false;
            }, 200);
        }
    } else if (bottomTypes.includes(componentType)) {
        well.config.push({ productId, quantity: qty, autoAdded: false });
    } else {
        const topTypesForMiddle = [
            'wlaz',
            'plyta_din',
            'plyta_najazdowa',
            'plyta_zamykajaca',
            'konus',
            'pierscien_odciazajacy'
        ];
        /* Szukaj płyty redukcyjnej — wpływa na pozycję kręgów */
        const plateIdx = well.config.findIndex((item) => {
            const p =
                typeof studnieProducts !== 'undefined'
                    ? studnieProducts.find((pr) => pr.id === item.productId)
                    : null;
            return p && p.componentType === 'plyta_redukcyjna';
        });
        if (plateIdx >= 0) {
            const prod =
                typeof studnieProducts !== 'undefined'
                    ? studnieProducts.find((pr) => pr.id === productId)
                    : null;
            const isRedDn = prod && String(prod.dn) === '1000';
            if (isRedDn) {
                /* Krąg DN1000 — wstaw NAD płytą redukcyjną, za topClosure */
                let insertIdx = 0;
                for (let i = 0; i < plateIdx; i++) {
                    const p =
                        typeof studnieProducts !== 'undefined'
                            ? studnieProducts.find((pr) => pr.id === well.config[i].productId)
                            : null;
                    if (!p || !topTypesForMiddle.includes(p.componentType)) {
                        insertIdx = i;
                        break;
                    }
                    insertIdx = i + 1;
                }
                well.config.splice(insertIdx, 0, { productId, quantity: qty, autoAdded: false });
            } else {
                /* Krąg głównego DN — wstaw ZA płytą redukcyjną */
                well.config.splice(plateIdx + 1, 0, { productId, quantity: qty, autoAdded: false });
            }
        } else {
            /* Brak płyty redukcyjnej — wstaw za topClosure, przed bottom */
            let insertAt = well.config.length;
            for (let i = 0; i < well.config.length; i++) {
                const p =
                    typeof studnieProducts !== 'undefined'
                        ? studnieProducts.find((pr) => pr.id === well.config[i].productId)
                        : null;
                if (p && bottomTypes.includes(p.componentType)) {
                    insertAt = i;
                    break;
                }
                if (!p || !topTypesForMiddle.includes(p.componentType)) {
                    insertAt = i;
                    break;
                }
            }
            well.config.splice(insertAt, 0, { productId, quantity: qty, autoAdded: false });
        }
    }
    _excelSortConfig(well);
    /* Rozwiń ilość kręgów na osobne pozycje: każdy krąg = osobny tile w konfiguratorze */
    if ((componentType === 'krag' || componentType === 'krag_ot') && qty > 1) {
        var _exp = [];
        for (var _i = 0; _i < well.config.length; _i++) {
            var _pr =
                typeof studnieProducts !== 'undefined'
                    ? studnieProducts.find(function (x) {
                          return x.id === well.config[_i].productId;
                      })
                    : null;
            if (
                _pr &&
                (_pr.componentType === 'krag' || _pr.componentType === 'krag_ot') &&
                well.config[_i].quantity > 1
            ) {
                for (var _j = 0; _j < well.config[_i].quantity; _j++) {
                    _exp.push({
                        productId: well.config[_i].productId,
                        quantity: 1,
                        autoAdded: false
                    });
                }
            } else {
                _exp.push(well.config[_i]);
            }
        }
        well.config = _exp;
    }
}

function _excelSortConfig(well) {
    if (!well || !well.config) return;
    var typeOrder = {
        wlaz: 0,
        avr: 1,
        plyta_din: 2,
        plyta_najazdowa: 2,
        plyta_zamykajaca: 2,
        konus: 2,
        pierscien_odciazajacy: 3,
        plyta_redukcyjna: 4,
        krag: 5,
        krag_ot: 5,
        dennica: 6,
        kineta: 7,
        uszczelka: 8
    };
    var sz = typeof studnieProducts !== 'undefined' ? studnieProducts : [];
    well.config = [...well.config].sort(function (a, b) {
        var pA = sz.find(function (p) {
            return p.id === a.productId;
        });
        var pB = sz.find(function (p) {
            return p.id === b.productId;
        });
        if (!pA || !pB) return 0;
        var oA = typeOrder[pA.componentType] || 100;
        var oB = typeOrder[pB.componentType] || 100;
        return oA - oB;
    });
    /* BEZWZGLĘDNA REGUŁA: właz musi być na indeksie 0 */
    _excelMoveWlazToTop(well);
}

function _excelMarkManual(well) {
    if (!well) return;
    well.autoLocked = true;
    well.configSource = 'MANUAL';
    well.autoSelect = false;
    if (typeof _excelSyncAutoManualUI === 'function') _excelSyncAutoManualUI();
    if (typeof window.updateAutoLockUI === 'function') window.updateAutoLockUI();
    /* Wymus pelny rerendem tabeli Excela — zeby btnMode.textContent == MANUAL */
    if (typeof _excelRenderTable === 'function') _excelRenderTable(_excelActiveTab);
    /* Odswiez glowny panel */
    if (typeof window.updateSummary === 'function') window.updateSummary();
    if (typeof window.renderWellDiagram === 'function') window.renderWellDiagram();
    if (typeof window.renderWellsList === 'function') window.renderWellsList();
}

function excelRemoveTransitionColumn() {
    var tab = _excelActiveTab || '1000';
    var curMax = _excelMaxTransitions[tab] || 1;
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
    var tab = _excelActiveTab || '1000';
    _excelMaxTransitions[tab] = (_excelMaxTransitions[tab] || 1) + 1;
    var newMax = _excelMaxTransitions[tab];
    /* Dodaj puste przejście TYLKO do studni z bieżącej zakładki */
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

function excelToggleFullscreen() {
    _excelFullscreen = !_excelFullscreen;
    const overlay = document.getElementById('excel-table-overlay');
    _excelPositionOverlay(overlay);
    var btn = document.getElementById('excel-fs-btn');
    if (btn) btn.textContent = _excelFullscreen ? 'Okno' : 'Pełny';
}
