// @ts-check
/* ===== EXCEL HELPERS — UI i logika danych ===== */

function _excelOverlaySelectHtml(opts, curVal, actionDef, width, disabled) {
    var label = '';
    for (var i = 0; i < opts.length; i++) {
        if (opts[i][0] === curVal) {
            label = opts[i][1];
            break;
        }
    }
    var optHtml = '';
    for (var i = 0; i < opts.length; i++) {
        optHtml +=
            '<option value="' +
            (opts[i][0] || '').replace(/"/g, '&quot;') +
            '"' +
            (opts[i][0] === curVal ? ' selected' : '') +
            '>' +
            opts[i][1] +
            '</option>';
    }
    var extraClass = disabled ? ' disabled' : '';
    var selectAttrs = disabled ? ' disabled' : ' tabindex="-1" data-action="excelOverlaySync"';
    if (actionDef && typeof actionDef === 'object') {
        selectAttrs += ' data-oa="' + (actionDef.a || '').replace(/"/g, '&quot;') + '"';
        if (actionDef.p) {
            for (var k in actionDef.p) {
                if (Object.prototype.hasOwnProperty.call(actionDef.p, k)) {
                    selectAttrs +=
                        ' data-op-' +
                        k +
                        '="' +
                        String(actionDef.p[k]).replace(/"/g, '&quot;') +
                        '"';
                }
            }
        }
    }
    return (
        '<div class="excel-sel-wrap' +
        extraClass +
        '" tabindex="0" style="display:inline-flex;position:relative;width:auto;min-width:40px;outline:none;' +
        (width ? 'width:' + width + 'px;' : '') +
        '">' +
        '<select style="position:absolute;inset:0;width:100%;height:100%;opacity:0;cursor:pointer;z-index:2;"' +
        selectAttrs +
        '>' +
        optHtml +
        '</select>' +
        '<div style="pointer-events:none;background:#13151f;border:1px solid rgba(255,255,255,0.08);border-radius:2px;padding:0.2rem 0.3rem;font-size:0.6rem;color:#e2e8f0;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;text-align:left;width:100%;">' +
        (label || '&mdash;') +
        '</div>' +
        '</div>'
    );
}

function _excelPositionOverlay(overlay) {
    if (!overlay) return;
    if (_excelFullscreen) {
        overlay.style.cssText =
            'position:fixed;inset:0;z-index:10000;background:rgba(0,0,0,0.75);backdrop-filter:blur(6px);display:flex;align-items:center;justify-content:center;';
        return;
    }
    const diagramPanel = document.querySelector('.well-diagram-panel');
    const isVisible = diagramPanel && diagramPanel.offsetParent !== null;
    if (isVisible) {
        const diaRect = diagramPanel.getBoundingClientRect();
        const topBar = document.querySelector('header') || document.querySelector('.header');
        const bottomBar = document.getElementById('offer-summary-footer-fixed');
        const topOffset = topBar ? topBar.getBoundingClientRect().bottom : diaRect.top;
        const bottomOffset =
            bottomBar && bottomBar.offsetHeight > 0
                ? bottomBar.getBoundingClientRect().top
                : diaRect.top + diaRect.height;
        const h = Math.max(bottomOffset - topOffset, 100);
        overlay.style.cssText = `position:fixed;top:${topOffset}px;left:${diaRect.right}px;width:calc(100vw - ${diaRect.right}px);min-width:400px;height:${h}px;z-index:10000;background:rgba(0,0,0,0.75);backdrop-filter:blur(6px);display:flex;align-items:center;justify-content:center;`;
    } else {
        overlay.style.cssText =
            'position:fixed;inset:0;z-index:10000;background:rgba(0,0,0,0.75);backdrop-filter:blur(6px);display:flex;align-items:center;justify-content:center;';
    }
}

function _excelMarkDirty() {
    _excelDirty = true;
}

function _excelMarkClean() {
    _excelDirty = false;
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

function _excelCreatePrzejscie() {
    return {
        id: 'prz-' + Date.now() + '-' + Math.floor(Math.random() * 1000),
        productId: '',
        rzednaWlaczenia: null,
        angle: 0,
        flowType: 'WYLOT',
        angleExecution: 0,
        angleGony: '0.00',
        displayIndex: 0
    };
}

function _excelWellMatchesTab(well, tab) {
    if (tab === 'styczne') return well.dn === 'styczna';
    return String(well.dn) === String(tab);
}

function _excelGetComponentsForDn(dn, well) {
    if (typeof studnieProducts === 'undefined' || !studnieProducts) return {};
    const mag =
        well && well.magazyn
            ? well.magazyn
            : typeof wells !== 'undefined' && wells.length > 0
              ? wells[0].magazyn || 'Kluczbork'
              : 'Kluczbork';
    const isWl = mag.includes('oc') || mag.includes('Włoc');
    const field = isWl ? 'magazynWL' : 'magazynKLB';

    let products = studnieProducts.filter((p) => {
        const val = p[field];
        return val === 1 || val === '1' || val === undefined;
    });

    if (dn === 'styczna') {
        const effDn = well && well.stycznaNadbudowa1200 ? 1200 : 1000;
        products = products.filter(
            (p) =>
                p.dn === 'styczna' ||
                p.dn === null ||
                p.componentType === 'styczna' ||
                parseInt(p.dn) === effDn
        );
    } else {
        products = products.filter((p) => parseInt(p.dn) === parseInt(dn) || p.dn === null);
    }

    if (well && typeof filterByWellParams === 'function') {
        try {
            products = products.filter((p) => filterByWellParams(p, well));
        } catch (e) {
            logger && logger.warn('excelTableManager', 'Błąd filterByWellParams:', e);
        }
    }

    const groups = {};
    products.forEach((p) => {
        const ct = p.componentType;
        if (!ct || ct === 'przejscie' || ct === 'kineta') return;
        if (!groups[ct]) groups[ct] = [];
        groups[ct].push(p);
    });

    return groups;
}

function _excelGetResolution(well, item) {
    if (!well.__resCache) well.__resCache = {};
    var key = item.productId;
    if (!well.__resCache[key]) {
        var sz = typeof studnieProducts !== 'undefined' ? studnieProducts : [];
        well.__resCache[key] =
            typeof resolveEffectiveProduct === 'function'
                ? resolveEffectiveProduct(well, item.productId, item)
                : sz.find(function (pr) {
                      return pr.id === item.productId;
                  });
    }
    return well.__resCache[key];
}

function _excelClearResCache(well) {
    if (well) delete well.__resCache;
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

function _excelGetWellConfigHash(well) {
    if (!well) return '';
    var wellParams = [
        well.nadbudowa || '',
        well.wkladkaZwienczenie || '',
        well.klasaNosnosci_korpus || '',
        well.stopnie || '',
        well.spocznik || '',
        well.magazyn || '',
        well.dennicaMaterial || '',
        well.uszczelka || '',
        well.kineta || '',
        well.klasaBetonu || '',
        well.redukcjaDN1000 ? '1' : '0',
        well.redukcjaMinH || '',
        well.redukcjaTargetDN || '',
        well.prealLuna ? '1' : '0',
        well.precoFullHeight || '',
        well.spocznikH || '',
        well.wkladkaOsadnikPreco || '',
        well.stycznaNadbudowa1200 ? '1' : '0',
        well.malowanieW || '',
        well.malowanieZ || '',
        well.powlokaNameW || '',
        well.powlokaNameZ || ''
    ].join('|');
    var parts = (well.config || [])
        .map(function (item) {
            return (item.productId || '') + ':' + (item.quantity || 0);
        })
        .join(',');
    return wellParams + '|' + parts;
}

function _excelGetColumnStructureHash(well) {
    if (!well) return '';
    const hasRed = getHasReduction(well);
    return [
        well.nadbudowa || '',
        well.stopnie || '',
        well.spocznik || '',
        well.kineta || '',
        well.wkladkaZwienczenie || '',
        well.wkladkaOsadnikPreco || '',
        well.stycznaNadbudowa1200 ? '1' : '0',
        hasRed ? '1' : '0',
        well.dennicaMaterial || ''
    ].join('|');
}

function _excelCalcUszczelkaCount(well) {
    let count = 0;
    (well.config || []).forEach((item) => {
        const p = _excelGetResolution(well, item);
        if (p && p.componentType === 'uszczelka') {
            count += item.quantity;
        }
    });
    return count;
}

function _excelCountProductInConfig(well, componentType, height, productId, targetDn) {
    let count = 0;
    var filterDn = targetDn !== undefined && targetDn !== null ? targetDn : well.dn;
    (well.config || []).forEach((item) => {
        const p = _excelGetResolution(well, item);
        if (!p) return;
        if (productId) {
            if (p.id !== productId) return;
        } else {
            if (p.dn !== null && parseInt(p.dn) !== parseInt(filterDn)) return;
            if (p.componentType !== componentType) return;
            if (!_excelSafeHeightMatch(p.height, height)) return;
        }
        count += item.quantity;
    });
    return count;
}

function _excelGetReferenceWell(dn) {
    if (typeof wells === 'undefined' || !wells || wells.length === 0) {
        return {
            magazyn: 'Kluczbork',
            dn: dn,
            nadbudowa: 'betonowa',
            dennicaMaterial: 'betonowa',
            stycznaNadbudowa1200: false,
            redukcjaDN1000: false,
            wkladkaZwienczenie: 'brak',
            wkladkaOsadnikPreco: 'brak',
            uszczelka: 'GSG',
            spocznik: 'brak',
            stopnie: 'brak',
            kineta: 'brak'
        };
    }
    for (var _i = 0; _i < wells.length; _i++) {
        if (_excelWellMatchesTab(wells[_i], dn)) return wells[_i];
    }
    return wells[0];
}

function _excelGetMaxTransitions() {
    var tab = typeof _excelActiveTab !== 'undefined' ? _excelActiveTab : '1000';
    var tabWells =
        typeof wells !== 'undefined' && Array.isArray(wells)
            ? wells.filter(function (w) {
                  return _excelWellMatchesTab(w, tab);
              })
            : [];
    var max = tabWells.reduce(function (m, w) {
        return w.przejscia && w.przejscia.length > m ? w.przejscia.length : m;
    }, 0);
    return Math.max(max, _excelMaxTransitions[tab] || 1);
}
