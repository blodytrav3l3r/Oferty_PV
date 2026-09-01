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
    const topClosureTypes = [
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
                        ? typeof getStudnieProductById === 'function'
                            ? getStudnieProductById(item.productId)
                            : studnieProducts.find((pr) => pr.id === item.productId)
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
                        ? typeof getStudnieProductById === 'function'
                            ? getStudnieProductById(item.productId)
                            : studnieProducts.find((pr) => pr.id === item.productId)
                        : null;
                if (!p) return true;
                if (reliefTypes.includes(p.componentType)) {
                    return p.componentType !== componentType;
                }
                return !topClosureTypes.includes(p.componentType);
            });
        } else {
            well.config = well.config.filter((item) => {
                const p =
                    typeof studnieProducts !== 'undefined'
                        ? typeof getStudnieProductById === 'function'
                            ? getStudnieProductById(item.productId)
                            : studnieProducts.find((pr) => pr.id === item.productId)
                        : null;
                return !(p && topClosureTypes.includes(p.componentType));
            });
        }
        const wlazIdx = well.config.findIndex((item) => {
            const p =
                typeof studnieProducts !== 'undefined'
                    ? typeof getStudnieProductById === 'function'
                        ? getStudnieProductById(item.productId)
                        : studnieProducts.find((pr) => pr.id === item.productId)
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
                    ? typeof getStudnieProductById === 'function'
                        ? getStudnieProductById(item.productId)
                        : studnieProducts.find((pr) => pr.id === item.productId)
                    : null;
            return p && p.componentType === 'plyta_redukcyjna';
        });
        if (plateIdx >= 0) {
            const prod =
                typeof studnieProducts !== 'undefined'
                    ? typeof getStudnieProductById === 'function'
                        ? getStudnieProductById(productId)
                        : studnieProducts.find((pr) => pr.id === productId)
                    : null;
            const isRedDn = prod && String(prod.dn) === '1000';
            if (isRedDn) {
                let insertIdx = 0;
                for (let i = 0; i < plateIdx; i++) {
                    const p =
                        typeof studnieProducts !== 'undefined'
                            ? typeof getStudnieProductById === 'function'
                                ? getStudnieProductById(well.config[i].productId)
                                : studnieProducts.find((pr) => pr.id === well.config[i].productId)
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
                        ? typeof getStudnieProductById === 'function'
                            ? getStudnieProductById(well.config[i].productId)
                            : studnieProducts.find((pr) => pr.id === well.config[i].productId)
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
    // Wszystkie elementy jako pojedyncze pozycje qty=1 (jak w gł. konfiguratorze).
    // Singular types (top closure / wlaz / redukcyjna) clamp do 1, reszta expand N x qty1.
    // Uszczelki są auto (recalcGaskets) — nie expandujemy ich z excel.
    const singularTypes = new Set([
        'wlaz',
        'konus',
        'plyta_din',
        'plyta_najazdowa',
        'plyta_zamykajaca',
        'pierscien_odciazajacy',
        'plyta_redukcyjna',
        'uszczelka'
    ]);
    if (singularTypes.has(componentType) && qty > 1) {
        // Nadpisz ostatnio wstawiony element na qty=1 (singular jak w addWellComponent)
        for (let _i = well.config.length - 1; _i >= 0; _i--) {
            if (well.config[_i].productId === productId && well.config[_i].quantity > 1) {
                well.config[_i].quantity = 1;
                break;
            }
        }
        qty = 1;
    }
    // Expand wszystkie stackowalne z qty>1 na N x qty1 (jak kręgi dotąd). Dzięki temu
    // 5x AVR wpisane w excelu = 5 pojedynczych pozycji w configu (jak 5 klików w konfiguratorze).
    // Uszczelki pomijamy — są auto.
    const needsExpand = well.config.some(function (it) {
        if (it.quantity <= 1) return false;
        const pr =
            typeof studnieProducts !== 'undefined'
                ? studnieProducts.find(function (x) {
                      return x.id === it.productId;
                  })
                : null;
        return pr && !singularTypes.has(pr.componentType) && pr.componentType !== 'uszczelka';
    });
    if (needsExpand) {
        const _exp = [];
        for (let _i = 0; _i < well.config.length; _i++) {
            const _pr =
                typeof studnieProducts !== 'undefined'
                    ? studnieProducts.find(function (x) {
                          return x.id === well.config[_i].productId;
                      })
                    : null;
            const _shouldExpand =
                _pr &&
                !singularTypes.has(_pr.componentType) &&
                _pr.componentType !== 'uszczelka' &&
                well.config[_i].quantity > 1;
            if (_shouldExpand) {
                const _total = well.config[_i].quantity;
                for (let _j = 0; _j < _total; _j++) {
                    const _isLast = _j === _total - 1;
                    _exp.push({
                        productId: well.config[_i].productId,
                        quantity: 1,
                        autoAdded: false,
                        ...(_pr.componentType === 'dennica' && !_isLast ? { isPsiaBuda: true } : {})
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
    const typeOrder = {
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
    const sz = typeof studnieProducts !== 'undefined' ? studnieProducts : [];
    well.config = [...well.config].sort(function (a, b) {
        const pA = sz.find(function (p) {
            return p.id === a.productId;
        });
        const pB = sz.find(function (p) {
            return p.id === b.productId;
        });
        if (!pA || !pB) return 0;
        const oA = typeOrder[pA.componentType] || 100;
        const oB = typeOrder[pB.componentType] || 100;
        return oA - oB;
    });
    _excelMoveWlazToTop(well);
}

function _excelMoveWlazToTop(well) {
    if (!well || !well.config || well.config.length < 2) return;
    const sz = typeof studnieProducts !== 'undefined' ? studnieProducts : [];
    let found = null;
    for (let i = 0; i < well.config.length; i++) {
        const p = sz.find(function (pr) {
            return pr.id === well.config[i].productId;
        });
        if (p && p.componentType === 'wlaz') {
            found = i;
            break;
        }
    }
    if (found !== null && found !== 0) {
        const item = well.config.splice(found, 1)[0];
        well.config.unshift(item);
    }
}
