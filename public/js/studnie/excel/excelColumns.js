// @ts-check
/* ===== EXCEL COLUMNS — Kolumny konfiguracyjne (barrel) ===== */
/* _excelBuildComponentColumns przeniesione do excelColumnsBuild.js */

function _excelUpdateHeaderProdCodes() {
    var container = document.getElementById('excel-table-container');
    if (!container) return;
    var wellIdx =
        typeof currentWellIndex !== 'undefined' && currentWellIndex >= 0 ? currentWellIndex : null;
    if (wellIdx === null || !wells[wellIdx]) return;

    var fmt =
        typeof fmtInt === 'function'
            ? fmtInt
            : function (n) {
                  return Math.round(n || 0).toLocaleString('pl-PL');
              };
    var spans = container.querySelectorAll('thead tr:first-child .h3-prodcode');
    spans.forEach(function (span) {
        var ct = span.getAttribute('data-ct');
        var height = span.getAttribute('data-height');
        var perProd = span.getAttribute('data-per-product');
        var fallback = span.getAttribute('data-fallback');
        var redDn = span.getAttribute('data-reddn');
        if (!ct) return;

        var code;
        if (perProd) {
            code = span.textContent;
        } else {
            code =
                _excelGetWellProdCode(wells[wellIdx], ct, height || null, redDn || null) ||
                fallback ||
                null;
        }

        if (!code) return;
        span.textContent = code;
        var priceSpan = span.parentElement.querySelector('.h3-prodprice');
        if (!priceSpan) return;
        try {
            var prod = (typeof studnieProducts !== 'undefined' ? studnieProducts : []).find(
                function (p) {
                    return p.id === code;
                }
            );
            if (prod && prod.price) {
                priceSpan.textContent = fmt(prod.price) + ' PLN';
            } else {
                priceSpan.textContent = '';
            }
        } catch (e) {
            priceSpan.textContent = '';
        }
    });
}

function _excelGetWellProdCode(well, ct, height, targetDn) {
    var prodCode = '';
    if (!well || !ct) return prodCode;

    var prods = typeof studnieProducts !== 'undefined' ? studnieProducts : [];

    if (well.config && Array.isArray(well.config)) {
        for (var ci = 0; ci < well.config.length; ci++) {
            var item = well.config[ci];
            if (!item || !item.productId) continue;
            var p = prods.find(function (pr) {
                return pr.id === item.productId;
            });
            if (!p) continue;
            if (p.componentType !== ct) continue;
            if (targetDn && parseInt(p.dn) !== parseInt(targetDn)) continue;
            if (height !== undefined && height !== null && height !== '') {
                var ph = parseInt(p.height);
                var ht = parseInt(height);
                if (!isNaN(ph) && !isNaN(ht) && ph !== ht) continue;
            }
            prodCode = item.productId;
            break;
        }
        if (prodCode) return prodCode;
    }

    var componentData =
        well.components || well.wellsComponents || (well.data && well.data.components) || well.data;

    if (!componentData && typeof window.getWellComponentData === 'function') {
        componentData = window.getWellComponentData(well, ct, null);
    }

    if (!componentData) return prodCode;

    var comps = componentData[ct];
    if (!comps) return prodCode;

    if (targetDn) {
        if (comps.reduction && comps.reduction[targetDn]) {
            var redArr = comps.reduction[targetDn];
            for (var ri = 0; ri < redArr.length; ri++) {
                if (redArr[ri].productId) {
                    prodCode = redArr[ri].productId;
                    if (height && redArr[ri].height) {
                        var hVal = parseInt(height);
                        if (!isNaN(hVal) && parseInt(redArr[ri].height) === hVal) {
                            prodCode = redArr[ri].productId;
                            break;
                        }
                    }
                }
            }
        }
        return prodCode;
    }

    if (Array.isArray(comps)) {
        for (var i = 0; i < comps.length; i++) {
            var c = comps[i];
            if (c && c.productId) {
                prodCode = c.productId;
                if (height && c.height) {
                    var ch = parseInt(height);
                    if (!isNaN(ch) && parseInt(c.height) === ch) {
                        prodCode = c.productId;
                        break;
                    }
                } else if (!height) {
                    prodCode = c.productId;
                }
            }
        }
    } else if (comps.productId) {
        prodCode = comps.productId;
    }

    return prodCode;
}

function _excelGetWellProdPrice(well, ct, height, targetDn) {
    var prodCode = _excelGetWellProdCode(well, ct, height, targetDn);
    if (!prodCode) return 0;

    try {
        var allProds = typeof studnieProducts !== 'undefined' ? studnieProducts : [];
        for (var pi2 = 0; pi2 < allProds.length; pi2++) {
            if (allProds[pi2].id === prodCode) {
                return allProds[pi2].price || 0;
            }
        }
    } catch (e) {
        /* ignore */
    }

    return 0;
}
