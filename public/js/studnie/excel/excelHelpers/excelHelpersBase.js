// @ts-check
/* ===== EXCEL HELPERS — Podstawowe funkcje pomocnicze ===== */

const _EXCEL_FONT = 'font-size:0.7rem;font-family:Inter,Segoe UI,sans-serif;letter-spacing:0.1px;';

function getHasReduction(well, dn) {
    if (!well) return !!dn && ['1200', '1500', '2000', '2500'].includes(String(dn));
    return ['1200', '1500', '2000', '2500'].includes(String(well.dn));
}

function _excelShortLabel(name, componentType) {
    var n = (name || '').trim();
    switch (componentType) {
        case 'avr': {
            var size =
                n
                    .replace(/Pierścień AVR\s*/i, '')
                    .trim()
                    .replace(/mm$/i, '') || '';
            return { short: 'AVR', detail: size };
        }
        case 'konus': {
            var isPlus = n.indexOf('Konus+') === 0;
            var short = isPlus ? 'Konus+' : 'Konus';
            var detail = n.replace(/^Konus\+?\s*/i, '').trim();
            return { short: short, detail: detail };
        }
        case 'krag': {
            var isZelb = n.indexOf('żelbetowy') >= 0;
            var short = isZelb ? 'Kr.żelb' : 'Krąg';
            var detail = n.replace(/^Krąg\s+żelbetowy\s*/i, '').trim();
            if (detail === n) detail = n.replace(/^Krąg\s*/i, '').trim();
            detail = detail.replace(/^DN\d+\//, '').trim();
            detail = detail.replace(/\s+(bez stopni|drabinka nierdzewna)$/i, '').trim();
            return { short: short, detail: detail };
        }
        case 'krag_ot': {
            var isZelb2 = n.indexOf('żelbetowy') >= 0;
            var short = isZelb2 ? 'Kr.OT żelb' : 'Kr. OT';
            var detail = n.replace(/^Krąg\s+żelbetowy\s*/i, '').trim();
            if (detail === n) detail = n.replace(/^Krąg\s*/i, '').trim();
            detail = detail.replace(/^DN\d+\//, '').trim();
            detail = detail.replace(/\s*z otworami?\s*$/i, '').trim();
            return { short: short, detail: detail };
        }
        case 'dennica': {
            var short = 'Dennica';
            var detail = name.replace(/^Dennica\s*/i, '').trim();
            detail = detail.replace(/^DN\d+\s*H=\d+\/(\d+)/, '$1');
            return { short: short, detail: detail };
        }
        case 'plyta_din': {
            var short = 'Pł.DIN';
            var detail = name.replace(/^Płyta DIN\s*/i, '').trim();
            var hMatch = detail.match(/H[=:]?\s*(\d+)/i);
            if (hMatch) detail = hMatch[1];
            return { short: short, detail: detail };
        }
        case 'plyta_najazdowa': {
            var short = 'Pł.najazd';
            var detail = name.replace(/^Płyta najazdowa\s*/i, '').trim();
            var hMatch = detail.match(/H[=:]?\s*(\d+)/i);
            if (hMatch) detail = hMatch[1];
            if (!detail) detail = name;
            return { short: short, detail: detail };
        }
        case 'plyta_zamykajaca': {
            var short = 'Pł.zamyk';
            var detail = name.replace(/^Płyta zamykająca\s*/i, '').trim();
            var hMatch = detail.match(/H[=:]?\s*(\d+)/i);
            if (hMatch) detail = hMatch[1];
            return { short: short, detail: detail };
        }
        case 'pierscien_odciazajacy': {
            var short = 'Pierśc.odc';
            var detail = name.replace(/^Pierście[ńn] odciążający\s*/i, '').trim();
            var hMatch = detail.match(/H[=:]?\s*(\d+)/i);
            if (hMatch) detail = hMatch[1];
            return { short: short, detail: detail };
        }
        case 'plyta_redukcyjna': {
            var short = 'Pł.red.';
            var detail = name.replace(/^Płyta redukcyjna\s*/i, '').trim();
            var hMatch = detail.match(/H[=:]?\s*(\d+)/i);
            if (hMatch) detail = hMatch[1];
            return { short: short, detail: detail };
        }
        case 'osadnik': {
            var short = 'Osadnik';
            var detail = name.length > 14 ? name.substring(0, 12) + '…' : name;
            return { short: short, detail: detail };
        }
        case 'uszczelka': {
            var short = 'Uszcz.';
            var detail = name.replace(/^Uszczelka\s*/i, '').trim() || name;
            var uType = (detail.match(/\b(GSG|SDV)\b/i) || [])[1] || '';
            var uDn = (detail.match(/DN(\d+)/i) || [])[0] || '';
            var uSuf = /\bpier/i.test(detail) ? ' PO' : /\bNBR\b/i.test(detail) ? ' NBR' : '';
            if (uType) {
                detail = uType.toUpperCase() + (uDn ? ' ' + uDn.toUpperCase() : '') + uSuf;
            } else if (detail.length > 14) {
                detail = detail.substring(0, 12) + '…';
            }
            return { short: short, detail: detail };
        }
        case 'styczna': {
            var hasKorek = n.indexOf('korkiem') >= 0;
            var short = hasKorek ? 'Stycz.korek' : 'Styczna';
            var detail = n.replace(/^Studnia styczna(\s*z korkiem)?\s*/i, '').trim();
            return { short: short, detail: detail };
        }
        default:
            return { short: (componentType || '').substring(0, 8), detail: name };
    }
}

function _excelWrapDetail(detail) {
    if (!detail || detail === '·') return '·';
    var br = detail.replace(/\s+(bez stopni|drabinka nierdzewna|z otworami?)\s*$/i, '<br>$1');
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

function _excelSafeHeightMatch(pHeight, h) {
    if (h === undefined || h === null || h === '' || h === 'null') return true;
    if (pHeight === undefined || pHeight === null) return false;
    var ph = parseInt(pHeight);
    var hh = parseInt(h);
    if (isNaN(ph) || isNaN(hh)) return false;
    return ph === hh;
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

function _excelCellInp(w) {
    return `background:#13151f;border:1px solid rgba(255,255,255,0.08);border-radius:2px;color:var(--text-primary);${_EXCEL_FONT}text-align:right;outline:none;transition:border-color 0.15s,background 0.15s;`;
}
