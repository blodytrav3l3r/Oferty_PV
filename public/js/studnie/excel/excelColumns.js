// @ts-check
/* ===== EXCEL COLUMNS — Kolumny konfiguracyjne (barrel) ===== */
/* _excelBuildComponentColumns przeniesione do excelColumnsBuild.js */

function _excelUpdateHeaderProdCodes() {
    var container = document.getElementById('excel-table-container');
    if (!container) return;

    var headerRow = container.querySelector('.excel-header-row');
    if (!headerRow) return;

    var cells = headerRow.querySelectorAll('.excel-header-cell');
    cells.forEach(function (cell) {
        var type = cell.getAttribute('data-component-type');
        var productId = cell.getAttribute('data-product-id');
        var targetDn = cell.getAttribute('data-target-dn');

        if (type && productId) {
            var code = _excelGetWellProdCode(
                well,
                type,
                cell.getAttribute('data-height'),
                targetDn
            );
            if (code) {
                cell.setAttribute('data-prod-code', code);
            }
        }
    });
}

function _excelGetWellProdCode(well, ct, height, targetDn) {
    var prodCode = '';
    if (!well || !ct) return prodCode;

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

    if (targetDn) {
        try {
            var dnKey = 'DN' + targetDn;
            var productMap =
                typeof window.productCacheByDn !== 'undefined' ? window.productCacheByDn : null;
            if (productMap && productMap[dnKey]) {
                for (var pi = 0; pi < productMap[dnKey].length; pi++) {
                    if (productMap[dnKey][pi].id === prodCode) {
                        return productMap[dnKey][pi].price || 0;
                    }
                }
            }
        } catch (e) {
            /* ignore */
        }
        return 0;
    }

    try {
        var allProds = typeof excelProducts !== 'undefined' ? excelProducts : [];
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
