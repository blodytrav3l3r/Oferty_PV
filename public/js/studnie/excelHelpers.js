// @ts-check
/* ===== EXCEL HELPERS — Funkcje pomocnicze dla tabeli konfiguracyjnej studni ===== */

function _excelGetWellConfigHash(well) {
    if (!well) return '';
    let wellParams = [
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
    let parts = (well.config || [])
        .map(function (item) {
            return (item.productId || '') + ':' + (item.quantity || 0);
        })
        .join(',');
    return wellParams + '|' + parts;
}

/* Helper: sprawdź czy studnia ma obsługę redukcji (DN1200-2500) */
function getHasReduction(well, dn) {
    if (!well) return !!dn && ['1200', '1500', '2000', '2500'].includes(String(dn));
    return ['1200', '1500', '2000', '2500'].includes(String(well.dn));
}

/* Sprawdza czy zmieniła się struktura kolumn (wymaga pełnego re-renderu, nie tylko updatu kodów) */
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

function _excelWellMatchesTab(well, tab) {
    if (tab === 'styczne') return well.dn === 'styczna';
    return String(well.dn) === String(tab);
}

/* Helper: znajdź referencyjną studnię do budowy kolumn gdy zakładka pusta */
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
    for (let _i = 0; _i < wells.length; _i++) {
        if (_excelWellMatchesTab(wells[_i], dn)) return wells[_i];
    }
    return wells[0];
}

function _excelGetMaxTransitions() {
    let tab = typeof _excelActiveTab !== 'undefined' ? _excelActiveTab : '1000';
    let tabWells =
        typeof wells !== 'undefined' && Array.isArray(wells)
            ? wells.filter(function (w) {
                  return _excelWellMatchesTab(w, tab);
              })
            : [];
    let max = tabWells.reduce(function (m, w) {
        return w.przejscia && w.przejscia.length > m ? w.przejscia.length : m;
    }, 0);
    return Math.max(max, _excelMaxTransitions[tab] || 1);
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

/* ===== SHORT LABEL GENERATOR ===== */
function _excelShortLabel(name, componentType) {
    let n = (name || '').trim();
    switch (componentType) {
        case 'avr': {
            let size =
                n
                    .replace(/Pierścień AVR\s*/i, '')
                    .trim()
                    .replace(/mm$/i, '') || '';
            return { short: 'AVR', detail: size };
        }
        case 'konus': {
            let isPlus = n.indexOf('Konus+') === 0;
            let short = isPlus ? 'Konus+' : 'Konus';
            let detail = n.replace(/^Konus\+?\s*/i, '').trim();
            return { short: short, detail: detail };
        }
        case 'krag': {
            let isZelb = n.indexOf('żelbetowy') >= 0;
            let short = isZelb ? 'Kr.żelb' : 'Krąg';
            let detail = n.replace(/^Krąg\s+żelbetowy\s*/i, '').trim();
            if (detail === n) detail = n.replace(/^Krąg\s*/i, '').trim();
            detail = detail.replace(/^DN\d+\//, '').trim();
            // Tylko wysokość — modyfikator (bez stopni, drabinka) zależy od studni
            detail = detail.replace(/\s+(bez stopni|drabinka nierdzewna)$/i, '').trim();
            return { short: short, detail: detail };
        }
        case 'krag_ot': {
            let isZelb2 = n.indexOf('żelbetowy') >= 0;
            let short = isZelb2 ? 'Kr.OT żelb' : 'Kr. OT';
            let detail = n.replace(/^Krąg\s+żelbetowy\s*/i, '').trim();
            if (detail === n) detail = n.replace(/^Krąg\s*/i, '').trim();
            detail = detail.replace(/^DN\d+\//, '').trim();
            detail = detail.replace(/\s*z otworami?\s*$/i, '').trim();
            return { short: short, detail: detail };
        }
        case 'dennica': {
            let short = 'Dennica';
            let detail = name.replace(/^Dennica\s*/i, '').trim();
            detail = detail.replace(/^DN\d+\s*H=\d+\/(\d+)/, '$1');
            return { short: short, detail: detail };
        }
        case 'plyta_din': {
            let short = 'Pł.DIN';
            let detail = name.replace(/^Płyta DIN\s*/i, '').trim();
            let hMatch = detail.match(/H[=:]?\s*(\d+)/i);
            if (hMatch) detail = hMatch[1];
            return { short: short, detail: detail };
        }
        case 'plyta_najazdowa': {
            let short = 'Pł.najazd';
            let detail = name.replace(/^Płyta najazdowa\s*/i, '').trim();
            let hMatch = detail.match(/H[=:]?\s*(\d+)/i);
            if (hMatch) detail = hMatch[1];
            if (!detail) detail = name;
            return { short: short, detail: detail };
        }
        case 'plyta_zamykajaca': {
            let short = 'Pł.zamyk';
            let detail = name.replace(/^Płyta zamykająca\s*/i, '').trim();
            let hMatch = detail.match(/H[=:]?\s*(\d+)/i);
            if (hMatch) detail = hMatch[1];
            return { short: short, detail: detail };
        }
        case 'pierscien_odciazajacy': {
            let short = 'Pierśc.odc';
            let detail = name.replace(/^Pierście[ńn] odciążający\s*/i, '').trim();
            let hMatch = detail.match(/H[=:]?\s*(\d+)/i);
            if (hMatch) detail = hMatch[1];
            return { short: short, detail: detail };
        }
        case 'plyta_redukcyjna': {
            let short = 'Pł.red.';
            let detail = name.replace(/^Płyta redukcyjna\s*/i, '').trim();
            let hMatch = detail.match(/H[=:]?\s*(\d+)/i);
            if (hMatch) detail = hMatch[1];
            return { short: short, detail: detail };
        }
        case 'osadnik': {
            let short = 'Osadnik';
            let detail = name.length > 14 ? name.substring(0, 12) + '…' : name;
            return { short: short, detail: detail };
        }
        case 'uszczelka': {
            let short = 'Uszcz.';
            let detail = name.replace(/^Uszczelka\s*/i, '').trim() || name;
            let uType = (detail.match(/\b(GSG|SDV)\b/i) || [])[1] || '';
            let uDn = (detail.match(/DN(\d+)/i) || [])[0] || '';
            let uSuf = /\bpier/i.test(detail) ? ' PO' : /\bNBR\b/i.test(detail) ? ' NBR' : '';
            if (uType) {
                detail = uType.toUpperCase() + (uDn ? ' ' + uDn.toUpperCase() : '') + uSuf;
            } else if (detail.length > 14) {
                detail = detail.substring(0, 12) + '…';
            }
            return { short: short, detail: detail };
        }
        case 'styczna': {
            let hasKorek = n.indexOf('korkiem') >= 0;
            let short = hasKorek ? 'Stycz.korek' : 'Styczna';
            let detail = n.replace(/^Studnia styczna(\s*z korkiem)?\s*/i, '').trim();
            return { short: short, detail: detail };
        }
        default:
            return { short: (componentType || '').substring(0, 8), detail: name };
    }
}

/* ===== WRAP DETAIL — łamie wariant na nowy wiersz ===== */
function _excelWrapDetail(detail) {
    if (!detail || detail === '·') return '·';
    // Łam przed "bez stopni", "drabinka nierdzewna", "z otworami"
    let br = detail.replace(/\s+(bez stopni|drabinka nierdzewna|z otworami?)\s*$/i, '<br>$1');
    return br;
}

function _excelCalcWellHeight(well) {
    return Math.round(((well.rzednaWlazu || 0) - (well.rzednaDna || 0)) * 1000);
}

function _excelCalcDennicaHeight(well) {
    let dennH = 0;
    (well.config || []).forEach((item) => {
        const p =
            typeof studnieProducts !== 'undefined'
                ? studnieProducts.find((pr) => pr.id === item.productId)
                : null;
        if (p && p.componentType === 'dennica' && p.height) {
            dennH += p.height * item.quantity;
        }
    });
    return dennH;
}

/* Bezpieczne porównanie wysokości — obsługa null/undefined/'null' */
function _excelSafeHeightMatch(pHeight, h) {
    if (h === undefined || h === null || h === '' || h === 'null') return true;
    if (pHeight === undefined || pHeight === null) return false;
    let ph = parseInt(pHeight);
    let hh = parseInt(h);
    if (isNaN(ph) || isNaN(hh)) return false;
    return ph === hh;
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
    let filterDn = targetDn !== undefined && targetDn !== null ? targetDn : well.dn;
    (well.config || []).forEach((item) => {
        const p = _excelGetResolution(well, item);
        if (!p) return;
        if (productId) {
            /* Per-product: dokładne dopasowanie (np. plyta_redukcyjna z dn studni) */
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

/* Cache dla resolveEffectiveProduct — unikaj O(n²) */
function _excelGetResolution(well, item) {
    if (!well.__resCache) well.__resCache = {};
    let key = item.productId;
    if (!well.__resCache[key]) {
        let sz = typeof studnieProducts !== 'undefined' ? studnieProducts : [];
        well.__resCache[key] =
            typeof resolveEffectiveProduct === 'function'
                ? resolveEffectiveProduct(well, item.productId, item)
                : sz.find(function (pr) {
                      return pr.id === item.productId;
                  });
    }
    return well.__resCache[key];
}

/* Czyść cache resolution przy zmianie konfiguracji studni */
function _excelClearResCache(well) {
    if (well) delete well.__resCache;
}

/* ===== Dynamiczny kod produktu w h3 — pobrany z configu zaznaczonej studni ===== */
function _excelGetWellProdCode(well, ct, height, targetDn) {
    if (!well || !well.config || !ct) return null;
    let sz = typeof studnieProducts !== 'undefined' ? studnieProducts : [];

    /* 1. Szukaj w configu z resolveEffectiveProduct — to samo co "Wybór elementów" */
    for (let i = 0; i < well.config.length; i++) {
        let item = well.config[i];
        if (item.quantity <= 0) continue;
        let resolved = _excelGetResolution(well, item);
        if (!resolved) continue;
        if (resolved.componentType !== ct) continue;
        if (
            height !== undefined &&
            height !== null &&
            height !== '' &&
            parseInt(resolved.height) !== parseInt(height)
        )
            continue;
        /* Dla kolumn redukcji: produkt musi pasować do targetDn */
        if (targetDn !== undefined && targetDn !== null) {
            if (resolved.dn !== null && parseInt(resolved.dn) !== parseInt(targetDn)) continue;
        } else {
            /* Main column: preferuj produkt dla DN studni */
            if (resolved.dn !== null && parseInt(resolved.dn) !== parseInt(well.dn)) continue;
        }
        return resolved.id;
    }

    /* 2. FALLBACK: pierwszy dostępny produkt dla tego ct+height — zgodnie z filtrami studni */
    if (typeof getAvailableProducts === 'function' && typeof filterByWellParams === 'function') {
        let avail = getAvailableProducts(well).filter(function (p) {
            try {
                return filterByWellParams(p, well);
            } catch (e) {
                return true;
            }
        });
        let fallback = avail.filter(function (p) {
            return p.componentType === ct;
        });
        if (height !== undefined && height !== null && height !== '') {
            fallback = fallback.filter(function (p) {
                return parseInt(p.height) === parseInt(height);
            });
        }
        /* Dla kolumn redukcji: preferuj produkt pasujący do targetDn */
        if (targetDn !== undefined && targetDn !== null) {
            let dnMatch = fallback.filter(function (p) {
                return p.dn !== null && parseInt(p.dn) === parseInt(targetDn);
            });
            if (dnMatch.length > 0) return dnMatch[0].id;
            let univ = fallback.filter(function (p) {
                return p.dn === null;
            });
            if (univ.length > 0) return univ[0].id;
            return null;
        }
        /* Main column: preferuj produkty dla DN studni, potem uniwersalne */
        let mainMatch = fallback.filter(function (p) {
            return p.dn !== null && parseInt(p.dn) === parseInt(well.dn);
        });
        if (mainMatch.length > 0) return mainMatch[0].id;
        let mainUniv = fallback.filter(function (p) {
            return p.dn === null;
        });
        return mainUniv.length > 0 ? mainUniv[0].id : null;
        return null; /* nie pokazuj kodu z innego DN */
    }
    return null;
}

/* ===== Cena elementu w h3 — per sztuka, zgodnie z getItemAssessedPrice ===== */
function _excelGetWellProdPrice(well, ct, height, targetDn) {
    if (!well || !well.config || !ct) return '';
    let sz = typeof studnieProducts !== 'undefined' ? studnieProducts : [];

    /* 1. Szukaj w configu — to samo co _excelGetWellProdCode */
    for (let i = 0; i < well.config.length; i++) {
        let item = well.config[i];
        if (item.quantity <= 0) continue;
        let resolved = _excelGetResolution(well, item);
        if (!resolved) continue;
        if (resolved.componentType !== ct) continue;
        if (
            height !== undefined &&
            height !== null &&
            height !== '' &&
            parseInt(resolved.height) !== parseInt(height)
        )
            continue;
        /* Dla kolumn redukcji: produkt musi pasować do targetDn */
        if (targetDn !== undefined && targetDn !== null) {
            if (resolved.dn !== null && parseInt(resolved.dn) !== parseInt(targetDn)) continue;
        } else {
            /* Main column: preferuj produkt dla DN studni */
            if (resolved.dn !== null && parseInt(resolved.dn) !== parseInt(well.dn)) continue;
        }
        /* Mamy dopasowany config item — pobierz cenę */
        let price =
            typeof getItemAssessedPrice === 'function'
                ? getItemAssessedPrice(well, resolved, true, item)
                : resolved.price || 0;
        let fmt =
            typeof fmtInt === 'function'
                ? fmtInt
                : function (n) {
                      return Math.round(n || 0).toLocaleString('pl-PL');
                  };
        return fmt(price) + ' PLN';
    }

    /* 2. FALLBACK: pierwszy dostępny produkt */
    if (typeof getAvailableProducts === 'function' && typeof filterByWellParams === 'function') {
        let avail = getAvailableProducts(well).filter(function (p) {
            return filterByWellParams(p, well);
        });
        let fallback = avail.filter(function (p) {
            return (
                p.componentType === ct &&
                (height === undefined ||
                    height === null ||
                    height === '' ||
                    parseInt(p.height) === parseInt(height))
            );
        });
        /* Dla kolumn redukcji: preferuj produkt pasujący do targetDn */
        let matchedFallback = null;
        if (targetDn !== undefined && targetDn !== null) {
            let dnMatch = fallback.filter(function (p) {
                return p.dn !== null && parseInt(p.dn) === parseInt(targetDn);
            });
            if (dnMatch.length > 0) matchedFallback = dnMatch[0];
            else {
                let univ = fallback.filter(function (p) {
                    return p.dn === null;
                });
                if (univ.length > 0) matchedFallback = univ[0];
            }
        } else {
            /* Main column: preferuj produkty dla DN studni, potem uniwersalne */
            let mainMatch = fallback.filter(function (p) {
                return p.dn !== null && parseInt(p.dn) === parseInt(well.dn);
            });
            if (mainMatch.length > 0) matchedFallback = mainMatch[0];
            else {
                let mainUniv = fallback.filter(function (p) {
                    return p.dn === null;
                });
                if (mainUniv.length > 0) matchedFallback = mainUniv[0];
            }
        }
        if (matchedFallback) {
            let price =
                typeof getItemAssessedPrice === 'function'
                    ? getItemAssessedPrice(well, matchedFallback, true, null)
                    : matchedFallback.price || 0;
            let fmt =
                typeof fmtInt === 'function'
                    ? fmtInt
                    : function (n) {
                          return Math.round(n || 0).toLocaleString('pl-PL');
                      };
            return fmt(price) + ' PLN';
        }
    }

    return ''; /* brak ceny */
}

function _excelUpdateHeaderProdCodes() {
    let container = document.getElementById('excel-table-container');
    if (!container) return;
    let codes = container.querySelectorAll('thead .h3-prodcode');
    if (!codes.length) return;
    let prices = container.querySelectorAll('thead .h3-prodprice');
    /* Użyj pierwszej studni z AKTYWNEJ zakładki, nie globalnej currentWellIndex */
    let tabWell = null;
    if (typeof _excelActiveTab !== 'undefined' && _excelActiveTab && typeof wells !== 'undefined') {
        for (let i = 0; i < wells.length; i++) {
            if (_excelWellMatchesTab(wells[i], _excelActiveTab)) {
                tabWell = wells[i];
                break;
            }
        }
    }
    let well =
        (typeof currentWellIndex !== 'undefined' && currentWellIndex >= 0
            ? wells[currentWellIndex]
            : null) || tabWell;
    codes.forEach(function (span, idx) {
        let isPerProduct = span.getAttribute('data-per-product') === '1';
        let ct = span.getAttribute('data-ct');
        let height = span.getAttribute('data-height');
        let redTarget =
            span.getAttribute('data-reddn') || ''
                ? well &&
                  (well.redukcjaTargetDN || parseInt(span.getAttribute('data-reddn')) || 1000)
                : null;
        if (isPerProduct) {
            /* Kolumny per-produkt: kod stały, ale cenę trzeba odświeżyć */
            if (prices && prices[idx]) {
                let ppid = span.textContent && span.textContent.trim();
                if (ppid) {
                    let _prod = (
                        typeof studnieProducts !== 'undefined' ? studnieProducts : []
                    ).find(function (pr) {
                        return pr.id === ppid;
                    });
                    if (_prod && _prod.price) {
                        let _fmt =
                            typeof fmtInt === 'function'
                                ? fmtInt
                                : function (n) {
                                      return Math.round(n || 0).toLocaleString('pl-PL');
                                  };
                        prices[idx].textContent = _fmt(_prod.price) + ' PLN';
                    }
                }
            }
            return;
        }
        let pid = well ? _excelGetWellProdCode(well, ct, height, redTarget) : null;
        span.textContent = pid !== null && pid !== undefined ? pid : '';
        /* Aktualizuj cenę w tym samym indeksie */
        if (prices && prices[idx]) {
            prices[idx].textContent = pid
                ? _excelGetWellProdPrice(well, ct, height, redTarget) || ''
                : '';
        }
    });
}

function _excelGetWlazFromConfig(well) {
    for (const item of well.config || []) {
        const p =
            typeof studnieProducts !== 'undefined'
                ? studnieProducts.find((pr) => pr.id === item.productId)
                : null;
        if (p && p.componentType === 'wlaz') return p.id;
    }
    return '';
}

function _excelAutoSetWlaz(well) {
    if (!well) return;
    const avail = (typeof getAvailableProducts === 'function' ? getAvailableProducts(well) : [])
        .filter(
            (p) =>
                p.componentType === 'wlaz' && (p.dn == null || parseInt(p.dn) === parseInt(well.dn))
        )
        .filter((p) => typeof filterByWellParams !== 'function' || filterByWellParams(p, well));
    if (avail.length === 0) return;
    const defaultWlazH =
        typeof window.offerDefaultWlazH !== 'undefined' ? window.offerDefaultWlazH : 150;
    const chosen = avail.find((p) => parseInt(p.height) === defaultWlazH) || avail[0];
    well.config = (well.config || []).filter((item) => {
        const p = studnieProducts.find((pr) => pr.id === item.productId);
        return !(p && p.componentType === 'wlaz');
    });
    well.config.unshift({ productId: chosen.id, quantity: 1, autoAdded: false });
}

/* ===== CELL STYLES (Excel-like) ===== */
/** @param {number} [w] */
function _excelCellInp(w) {
    return `background:#13151f;border:1px solid rgba(255,255,255,0.08);border-radius:2px;color:var(--text-primary);${_EXCEL_FONT}text-align:right;outline:none;transition:border-color 0.15s,background 0.15s;`;
}

/* ===== OVERLAY SELECT ===== */
function _excelOverlaySelectHtml(opts, curVal, onChange, width, disabled) {
    let label = '';
    for (let i = 0; i < opts.length; i++) {
        if (opts[i][0] === curVal) {
            label = opts[i][1];
            break;
        }
    }
    let optHtml = '';
    for (let i = 0; i < opts.length; i++) {
        optHtml +=
            '<option value="' +
            (opts[i][0] || '').replace(/"/g, '&quot;') +
            '"' +
            (opts[i][0] === curVal ? ' selected' : '') +
            '>' +
            opts[i][1] +
            '</option>';
    }
    let extraClass = disabled ? ' disabled' : '';
    let wrapperEvents = disabled
        ? ''
        : " onfocus=\"excelCellFocus(this);_excelSelWrapFocus(this)\" onblur=\"excelCellBlur(this)\" onkeydown=\"if(event.key==='Enter'||event.key===' '){event.preventDefault();var s=this.querySelector('select');if(typeof s.showPicker==='function'){s.showPicker()}else{s.focus();s.click()}}\"";
    let selectEvents = disabled
        ? ' disabled'
        : ' tabindex="-1" onchange="' +
          (onChange || '').replace(/"/g, '&quot;') +
          ';this.nextElementSibling.textContent=this.options[this.selectedIndex].text"';
    return (
        '<div class="excel-sel-wrap' +
        extraClass +
        '" tabindex="0" style="display:inline-flex;position:relative;width:auto;min-width:40px;outline:none;' +
        (width ? 'width:' + width + 'px;' : '') +
        '"' +
        wrapperEvents +
        '>' +
        '<select style="position:absolute;inset:0;width:100%;height:100%;opacity:0;cursor:pointer;z-index:2;"' +
        selectEvents +
        '>' +
        optHtml +
        '</select>' +
        '<div style="pointer-events:none;background:#13151f;border:1px solid rgba(255,255,255,0.08);border-radius:2px;padding:0.2rem 0.3rem;font-size:0.6rem;color:#e2e8f0;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;text-align:left;width:100%;">' +
        (label || '&mdash;') +
        '</div>' +
        '</div>'
    );
}

/* ===== OVERLAY POSITIONING ===== */
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

function excelToggleFullscreen() {
    _excelFullscreen = !_excelFullscreen;
    const overlay = document.getElementById('excel-table-overlay');
    _excelPositionOverlay(overlay);
    let btn = document.getElementById('excel-fs-btn');
    if (btn) btn.textContent = _excelFullscreen ? 'Okno' : 'Pełny';
}

/* ===== DIRTY FLAG ===== */
function _excelMarkDirty() {
    _excelDirty = true;
}
function _excelMarkClean() {
    _excelDirty = false;
}

/* ===== SEARCH / FILTER ===== */
function excelFilterWells(value) {
    const q = (value || '').trim().toLowerCase();
    const container = document.getElementById('excel-table-container');
    if (!container) return;
    const rows = container.querySelectorAll('tbody tr[data-widx]');
    rows.forEach(function (row) {
        if (!q) {
            row.style.display = '';
            return;
        }
        /* Najpierw szukaj inputa — dopiero potem fallback do TD */
        let nameInp = row.querySelector('td:nth-child(2) input');
        let name = nameInp
            ? nameInp.value
            : (row.querySelector('td:nth-child(2)') || {}).textContent || '';
        name = (name || '').toLowerCase();
        row.style.display = name.indexOf(q) >= 0 ? '' : 'none';
    });
}
