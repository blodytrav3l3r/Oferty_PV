// @ts-check
/* ===== EXCEL CONFIG MANAGER — Zarządzanie konfiguracją studni (config items) ===== */

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

function _excelMoveWlazToTop(well) {
    if (!well || !well.config || well.config.length < 2) return;
    var sz = typeof studnieProducts !== 'undefined' ? studnieProducts : [];
    var found = null;
    for (var i = 0; i < well.config.length; i++) {
        var p = sz.find(function (pr) {
            return pr.id === well.config[i].productId;
        });
        if (p && p.componentType === 'wlaz') {
            found = i;
            break;
        }
    }
    if (found !== null && found !== 0) {
        var item = well.config.splice(found, 1)[0];
        well.config.unshift(item);
    }
}
