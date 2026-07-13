// @ts-check
/* ===== EXCEL HANDLERS — Zarządzanie konfiguracją studni ===== */

function _excelUpdateWellParam(wIdx, paramKey, value) {
    const well = wells[wIdx];
    if (!well) return;
    well[paramKey] = value;
    if (paramKey === 'malowanieWewCena' || paramKey === 'malowanieZewCena') {
        wells.forEach(function (w) {
            w[paramKey] = value;
        });
    }
    if (paramKey === 'wkladkaOsadnikPreco' && value === 'tak') {
        well.kineta = 'brak';
        well.spocznik = 'brak';
        well.precoFullHeight = 'tak';
    }
    _excelDebouncedRefresh();
    _excelRenderTable(_excelActiveTab);
    var existing = document.getElementById('excel-params-popup');
    if (existing) {
        existing.remove();
        excelOpenWellParams(wIdx);
    }
}

function _excelInsertConfigItem(well, componentType, productId, qty) {
    _excelClearResCache(well);
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
            well.config = well.config.filter((item) => {
                const p =
                    typeof studnieProducts !== 'undefined'
                        ? studnieProducts.find((pr) => pr.id === item.productId)
                        : null;
                return !(p && topTypes.includes(p.componentType));
            });
        }
        const wlazIdx = well.config.findIndex((item) => {
            const p =
                typeof studnieProducts !== 'undefined'
                    ? studnieProducts.find((pr) => pr.id === item.productId)
                    : null;
            return p && p.componentType === 'wlaz';
        });
        const insertAt = wlazIdx >= 0 ? wlazIdx + 1 : 0;
        well.config.splice(insertAt, 0, { productId, quantity: qty, autoAdded: false });
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
                well.config.splice(plateIdx + 1, 0, { productId, quantity: qty, autoAdded: false });
            }
        } else {
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
    _excelMoveWlazToTop(well);
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
