// @ts-check
/* ===== EXCEL TABLE MANAGER — Tabela konfiguracyjna studni (Excel-style) ===== */

let _excelMaxTransitions = 1;
let _excelActiveTab = '1000';
let _excelCreatingLock = false;
let _excelRefreshTimer = null;
let _excelSelectedCols = [];
let _excelPollInterval = null;
let _excelLastClickedCol = -1;
let _excelColWidths = {};
let _excelAddingReliefPair = false;
let _excelUserEditing = false; /* blokuje polling gdy user edytuje komórkę */

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
    var parts = (well.config || []).map(function(item) {
        return (item.productId || '') + ':' + (item.quantity || 0);
    }).join(',');
    return wellParams + '|' + parts;
}

/* Helper: sprawdź czy studnia ma obsługę redukcji (DN1000-2500) */
function getHasReduction(well, dn) {
    if (!well) return !!dn && ['1000', '1200', '1500', '2000', '2500'].includes(String(dn));
    return ['1000', '1200', '1500', '2000', '2500'].includes(String(well.dn));
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

function _excelStartPolling() {
    if (_excelPollInterval) return;
    var lastConfigHash = null;
    var lastColHash = null;
    _excelPollInterval = setInterval(function() {
        if (_excelUserEditing) return; /* pomiń gdy user edytuje komórkę */
        var well = typeof currentWellIndex !== 'undefined' && currentWellIndex >= 0
            ? wells[currentWellIndex] : null;
        if (!well) return;
        /* Sprawdź najpierw strukturę kolumn — jeśli się zmieniła, pełen re-render */
        var colHash = _excelGetColumnStructureHash(well);
        if (lastColHash !== null && lastColHash !== colHash) {
            _excelRenderTable(_excelActiveTab);
            lastConfigHash = _excelGetWellConfigHash(well);
            lastColHash = colHash;
            return;
        }
        if (lastColHash === null) lastColHash = colHash;
        
        /* Jeśli tylko config się zmienił — odśwież tylko kody */
        var configHash = _excelGetWellConfigHash(well);
        if (lastConfigHash !== null && lastConfigHash !== configHash) {
            _excelUpdateHeaderProdCodes();
        }
        lastConfigHash = configHash;
    }, 300);
}

function _excelStopPolling() {
    if (_excelPollInterval) {
        clearInterval(_excelPollInterval);
        _excelPollInterval = null;
    }
}

function _excelDebouncedRefresh() {
    if (_excelRefreshTimer) clearTimeout(_excelRefreshTimer);
    _excelRefreshTimer = setTimeout(() => {
        _excelRefreshTimer = null;
        if (typeof refreshAll === 'function') refreshAll(true);
        _excelUpdateHeaderProdCodes(); /* odśwież kody po zmianie configu przez refreshAll */
    }, 300);
}

const KINETA_OPTIONS = [
    ['brak', 'Brak'],
    ['beton', 'Beton'],
    ['beton_gfk', 'Beton z GFK'],
    ['klinkier', 'Klinkier'],
    ['preco', 'Preco'],
    ['precotop', 'PrecoTop'],
    ['unolith', 'UnoLith'],
    ['predl', 'Predl'],
    ['kamionka', 'Kamionka']
];

const DN_TABS = ['1000', '1200', '1500', '2000', '2500', 'styczne'];
const DN_COLORS = {
    1000: {
        bg: 'rgba(59,130,246,0.12)',
        border: '#3b82f6',
        text: '#93c5fd',
        activeBg: 'rgba(59,130,246,0.25)'
    },
    1200: {
        bg: 'rgba(16,185,129,0.12)',
        border: '#10b981',
        text: '#6ee7b7',
        activeBg: 'rgba(16,185,129,0.25)'
    },
    1500: {
        bg: 'rgba(245,158,11,0.12)',
        border: '#f59e0b',
        text: '#fbbf24',
        activeBg: 'rgba(245,158,11,0.25)'
    },
    2000: {
        bg: 'rgba(168,85,247,0.12)',
        border: '#a855f7',
        text: '#c4b5fd',
        activeBg: 'rgba(168,85,247,0.25)'
    },
    2500: {
        bg: 'rgba(239,68,68,0.12)',
        border: '#ef4444',
        text: '#fca5a5',
        activeBg: 'rgba(239,68,68,0.25)'
    },
    styczne: {
        bg: 'rgba(236,72,153,0.12)',
        border: '#ec4899',
        text: '#f9a8d4',
        activeBg: 'rgba(236,72,153,0.25)'
    }
};

const _EXCEL_FONT = 'font-size:0.7rem;font-family:Inter,Segoe UI,sans-serif;letter-spacing:0.1px;';

function _excelWellMatchesTab(well, tab) {
    if (tab === 'styczne') return well.dn === 'styczna';
    return String(well.dn) === String(tab);
}

function _excelGetMaxTransitions() {
    let max = 1;
    if (typeof wells !== 'undefined' && Array.isArray(wells)) {
        wells.forEach((w) => {
            if (w.przejscia && w.przejscia.length > max) max = w.przejscia.length;
        });
    }
    return Math.max(max, _excelMaxTransitions);
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

function _excelGetComponentsForDn(dn, well) {
    if (typeof studnieProducts === 'undefined' || !studnieProducts) return {};
    const mag =
        well && well.magazyn ? well.magazyn
            : (typeof wells !== 'undefined' && wells.length > 0
                ? wells[0].magazyn || 'Kluczbork'
                : 'Kluczbork');
    const isWl = mag.includes('oc') || mag.includes('Włoc');
    const field = isWl ? 'magazynWL' : 'magazynKLB';

    let products = studnieProducts.filter((p) => {
        const val = p[field];
        return val === 1 || val === '1' || val === undefined;
    });

    if (dn === 'styczna') {
        const effDn = well && well.stycznaNadbudowa1200 ? 1200 : 1000;
        products = products.filter(
            (p) => p.dn === 'styczna' || p.dn === null || p.componentType === 'styczna' ||
                  parseInt(p.dn) === effDn
        );
    } else {
        products = products.filter((p) => parseInt(p.dn) === parseInt(dn) || p.dn === null);
    }

    /* Filtruj wg parametrów studni (materiał, stopnie itd.) jeśli podano well */
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

function _excelBuildComponentColumns(dn, well) {
    const groups = _excelGetComponentsForDn(dn, well);
    const cols = [];

    /* 1. Właz */
    const wlazProducts = groups['wlaz'] || [];
    if (wlazProducts.length > 0) {
        cols.push({
            key: 'wlaz',
            label: 'Właz',
            type: 'select',
            componentType: 'wlaz',
            products: wlazProducts
        });
    }

    /* 2. AVR / Pierścienie — per produkt (osobna kolumna każdy) */
    const avrProducts = groups['avr'] || [];
    avrProducts.forEach((p) => {
        const nameShort = p.name.replace(/AVR\s*/i, '').trim() || p.id;
        const lbl = _excelShortLabel(p.name || '', 'avr');
        cols.push({
            key: 'avr_' + p.id,
            label: 'AVR ' + nameShort,
            shortLabel: lbl.short,
            detailLabel: lbl.detail,
            type: 'number',
            componentType: 'avr',
            productId: p.id,
            height: p.height
        });
    });

    /* 3. Konus / Stożek — grupowany po wysokości, jak krąg */
    const konusProducts = [...(groups['konus'] || [])].sort(
        (a, b) => (parseFloat(a.height) || 0) - (parseFloat(b.height) || 0)
    );
    const seenKonusH = new Set();
    konusProducts.forEach((p) => {
        const h = parseInt(p.height) || 0;
        if (h > 0 && !seenKonusH.has(h)) {
            seenKonusH.add(h);
            const matching = konusProducts.filter((k) => parseInt(k.height) === h);
            const lbl = _excelShortLabel(p.name || '', 'konus');
            cols.push({
                key: 'konus_' + h,
                label: lbl.short + ' H=' + h,
                shortLabel: lbl.short,
                detailLabel: String(h),
                type: 'number',
                componentType: 'konus',
                height: h,
                products: matching
            });
        }
    });

    /* 4. Płyty nakrywające — per componentType per wysokość */
    ['plyta_din', 'plyta_najazdowa', 'plyta_zamykajaca', 'pierscien_odciazajacy'].forEach((ct) => {
        let prods = [...(groups[ct] || [])].sort(
            (a, b) => (parseFloat(a.height) || 0) - (parseFloat(b.height) || 0)
        );
        /* Ogranicz do wysokości wskazanych przez użytkownika */
        if (ct === 'plyta_din') {
            prods = prods.filter((p) => parseInt(p.height) === 200);
        }
        const seenH = new Set();
        const ctLabels = {
            plyta_din: 'Pł. DIN',
            plyta_najazdowa: 'Pł. najazd.',
            plyta_zamykajaca: 'Pł. zamyk.',
            pierscien_odciazajacy: 'Pierśc. odciąż.'
        };
        prods.forEach((p) => {
            const h = parseInt(p.height) || 0;
            if (h > 0 && !seenH.has(h)) {
                seenH.add(h);
                const matching = prods.filter((k) => parseInt(k.height) === h);
                const lbl = _excelShortLabel(p.name || '', ct);
                cols.push({
                    key: ct + '_' + h,
                    label: (ctLabels[ct] || ct) + ' H=' + h,
                    shortLabel: lbl.short,
                    detailLabel:
                        ct === 'pierscien_odciazajacy'
                            ? ''
                            : ct === 'plyta_din' || ct === 'plyta_zamykajaca'
                              ? String(h)
                              : lbl.detail + ' H=' + h,
                    type: 'number',
                    componentType: ct,
                    height: h,
                    products: matching
                });
            }
        });
        /* produkty bez wysokości — osobna kolumna */
        const noHeight = prods.filter((p) => !parseInt(p.height));
        noHeight.forEach((p) => {
            const lbl = _excelShortLabel(p.name || '', ct);
            cols.push({
                key: ct + '_' + p.id,
                label:
                    (ctLabels[ct] || ct) +
                    ' ' +
                    (p.name.length > 15 ? p.name.substring(0, 13) + '…' : p.name),
                shortLabel: lbl.short,
                detailLabel: lbl.detail,
                type: 'number',
                componentType: ct,
                productId: p.id
            });
        });
    });

    /* 5. Płyty redukcyjne */
    const plytaRedProducts = groups['plyta_redukcyjna'] || [];
    plytaRedProducts.forEach((p) => {
        const lbl = _excelShortLabel(p.name || '', 'plyta_redukcyjna');
        cols.push({
            key: 'plyta_redukcyjna_' + p.id,
            label: p.name,
            shortLabel: lbl.short,
            detailLabel: lbl.detail,
            type: 'number',
            componentType: 'plyta_redukcyjna',
            productId: p.id,
            height: p.height
        });
    });

    /* 6. Kręgi — per wysokość */
    const kregProducts = [...(groups['krag'] || [])].sort(
        (a, b) => (parseFloat(a.height) || 0) - (parseFloat(b.height) || 0)
    );
    const seenKregH = new Set();
    kregProducts.forEach((p) => {
        const h = parseInt(p.height) || 0;
        if (h > 0 && !seenKregH.has(h)) {
            seenKregH.add(h);
            const matching = kregProducts.filter((k) => parseInt(k.height) === h);
            const lbl = _excelShortLabel(p.name || '', 'krag');
            cols.push({
                key: 'krag_' + h,
                label: 'Krąg H=' + h,
                shortLabel: lbl.short,
                detailLabel: lbl.detail,
                type: 'number',
                componentType: 'krag',
                height: h,
                products: matching
            });
        }
    });

    /* 7. Kręgi OT — per wysokość */
    const kragOtProducts = [...(groups['krag_ot'] || [])].sort(
        (a, b) => (parseFloat(a.height) || 0) - (parseFloat(b.height) || 0)
    );
    const seenOtH = new Set();
    kragOtProducts.forEach((p) => {
        const h = parseInt(p.height) || 0;
        if (h > 0 && !seenOtH.has(h)) {
            seenOtH.add(h);
            const matching = kragOtProducts.filter((k) => parseInt(k.height) === h);
            const lbl = _excelShortLabel(p.name || '', 'krag_ot');
            cols.push({
                key: 'krag_ot_' + h,
                label: 'Krąg OT H=' + h,
                shortLabel: lbl.short,
                detailLabel: lbl.detail,
                type: 'number',
                componentType: 'krag_ot',
                height: h,
                products: matching
            });
        }
    });

    /* 8. Dennica — per wysokość lub per produkt */
    const dennicaProducts = [...(groups['dennica'] || [])].sort(
        (a, b) => (parseFloat(a.height) || 0) - (parseFloat(b.height) || 0)
    );
    const seenDenH = new Set();
    dennicaProducts.forEach((p) => {
        const h = parseInt(p.height) || 0;
        if (h > 0 && !seenDenH.has(h)) {
            seenDenH.add(h);
            const matching = dennicaProducts.filter((k) => parseInt(k.height) === h);
            const lbl = _excelShortLabel(p.name || '', 'dennica');
            cols.push({
                key: 'dennica_' + h,
                label: 'Dennica H=' + h,
                shortLabel: lbl.short,
                detailLabel: lbl.detail,
                type: 'number',
                componentType: 'dennica',
                height: h,
                products: matching
            });
        }
    });
    dennicaProducts
        .filter((p) => !parseInt(p.height))
        .forEach((p) => {
            const lbl = _excelShortLabel(p.name || '', 'dennica');
            cols.push({
                key: 'dennica_' + p.id,
                label: 'Dennica ' + (p.name.length > 12 ? p.name.substring(0, 10) + '…' : p.name),
                shortLabel: lbl.short,
                detailLabel: lbl.detail,
                type: 'number',
                componentType: 'dennica',
                productId: p.id
            });
        });

    /* 9. Osadniki */
    const osadnikProducts = groups['osadnik'] || [];
    osadnikProducts.forEach((p) => {
        const lbl = _excelShortLabel(p.name || '', 'osadnik');
        cols.push({
            key: 'osadnik_' + p.id,
            label: p.name,
            shortLabel: lbl.short,
            detailLabel: lbl.detail,
            type: 'number',
            componentType: 'osadnik',
            productId: p.id,
            height: p.height
        });
    });

    /* 10. Studnie Styczne (tylko dla dn='styczna') */
    if (dn === 'styczna') {
        const stycznaProducts = groups['styczna'] || [];
        stycznaProducts.forEach((p) => {
            const lbl = _excelShortLabel(p.name || '', 'styczna');
            cols.push({
                key: 'styczna_' + p.id,
                label: p.name,
                shortLabel: lbl.short,
                detailLabel: lbl.detail,
                type: 'number',
                componentType: 'styczna',
                productId: p.id,
                dn: p.dn
            });
        });
    }

    /* 11. Uszczelki — ilość (auto: kręgi + 1) */
    cols.push({ key: 'uszczelka', label: 'Uszczelki', type: 'auto', componentType: 'uszczelka' });

    /* 12. Redukcja — elementy nadbudowy (tylko gdy któraś studnia w zakładce ma redukcję) */
    var hasRedTab = ['1200', '1500', '2000', '2500', 'styczne'].includes(String(dn));
    if (hasRedTab) {
        /* Znajdź target DN z pierwszej studni która ma redukcję */
        var firstRedWell = null;
        var tabWellsList = typeof wells !== 'undefined' ? wells.filter(function(w) { return (String(w.dn) === String(dn)) || ((dn === 'styczne') && w.dn === 'styczna'); }) : [];
        for (var ri = 0; ri < tabWellsList.length; ri++) {
            if (tabWellsList[ri].redukcjaDN1000) { firstRedWell = tabWellsList[ri]; break; }
        }
        var targetDns = [];
        if (firstRedWell) {
            targetDns.push(parseInt(firstRedWell.redukcjaTargetDN) || 1000);
        }
        if (targetDns.length > 0) {
        /* Użyj well do filtrowania produktów jeśli podano */
        var refWell = well || (typeof wells !== 'undefined' && wells.length > 0 ? wells[0] : null);
        targetDns.forEach(function(tDn) {
            var redGroups = _excelGetComponentsForDn(String(tDn), refWell);
            /* Pobierz też płyty redukcyjne dla średnicy studni — w głównym systemie są dla dn, nie dla tDn */
            var mainDn = dn === 'styczne' ? (refWell && refWell.stycznaNadbudowa1200 ? 1200 : 1000) : parseInt(String(dn));
            var mainGroups = _excelGetComponentsForDn(String(mainDn), refWell);
            var allRedPlyta = (mainGroups['plyta_redukcyjna'] || []).filter(function(p) { return p.dn !== null; });
            /* Usuń produkty uniwersalne (dn===null) — są już w głównych kolumnach */
            var redDnSpecific = {};
            Object.keys(redGroups).forEach(function(gk) {
                redDnSpecific[gk] = redGroups[gk].filter(function(p) { return p.dn !== null; });
            });
            /* Red. AVR */
            (redDnSpecific['avr'] || []).forEach(function(p) {
                var nameShort = p.name.replace(/AVR\s*/i, '').trim() || p.id;
                var lbl = _excelShortLabel(p.name || '', 'avr');
                cols.push({
                    key: 'red_avr_' + tDn + '_' + p.id,
                    label: 'R.AVR ' + nameShort,
                    shortLabel: 'R.' + lbl.short,
                    detailLabel: lbl.detail,
                    type: 'number',
                    componentType: 'avr',
                    productId: p.id,
                    height: p.height,
                    fromReduction: true,
                    redDn: tDn
                });
            });
            /* Red. Konus */
            var rKonus = [...(redDnSpecific['konus'] || [])].sort(function(a,b) { return (parseFloat(a.height)||0) - (parseFloat(b.height)||0); });
            var seenRKH = {};
            rKonus.forEach(function(p) {
                var h = parseInt(p.height) || 0;
                if (h > 0 && !seenRKH[h]) {
                    seenRKH[h] = true;
                    var matching = rKonus.filter(function(k) { return parseInt(k.height) === h; });
                    var lbl = _excelShortLabel(p.name || '', 'konus');
                    cols.push({
                        key: 'red_konus_' + tDn + '_' + h,
                        label: 'R.' + lbl.short + ' H=' + h,
                        shortLabel: 'R.' + lbl.short,
                        detailLabel: String(h),
                        type: 'number',
                        componentType: 'konus',
                        height: h,
                        products: matching,
                        fromReduction: true,
                        redDn: tDn
                    });
                }
            });
            /* Red. Płyty nakrywające */
            ['plyta_din','plyta_najazdowa','plyta_zamykajaca','pierscien_odciazajacy'].forEach(function(ct) {
                var prods = [...(redDnSpecific[ct] || [])].sort(function(a,b) { return (parseFloat(a.height)||0) - (parseFloat(b.height)||0); });
                if (ct === 'plyta_din') {
                    prods = prods.filter(function(p) { return parseInt(p.height) === 200; });
                }
                var seenH = {};
                prods.forEach(function(p) {
                    var h = parseInt(p.height) || 0;
                    if (h > 0 && !seenH[h]) {
                        seenH[h] = true;
                        var matching = prods.filter(function(k) { return parseInt(k.height) === h; });
                        var lbl = _excelShortLabel(p.name || '', ct);
                        cols.push({
                            key: 'red_' + ct + '_' + tDn + '_' + h,
                            label: 'R.' + (ct === 'plyta_din' ? 'Pł.DIN' : ct === 'plyta_najazdowa' ? 'Pł.najazd' : ct === 'plyta_zamykajaca' ? 'Pł.zamyk' : 'Pierśc.odc') + ' H=' + h,
                            shortLabel: 'R.' + lbl.short,
                            detailLabel: lbl.detail,
                            type: 'number',
                            componentType: ct,
                            height: h,
                            products: matching,
                            fromReduction: true,
                            redDn: tDn
                        });
                    }
                });
            });
            /* Red. Kręgi */
            var rKreg = [...(redDnSpecific['krag'] || [])].sort(function(a,b) { return (parseFloat(a.height)||0) - (parseFloat(b.height)||0); });
            var seenRKH2 = {};
            rKreg.forEach(function(p) {
                var h = parseInt(p.height) || 0;
                if (h > 0 && !seenRKH2[h]) {
                    seenRKH2[h] = true;
                    var matching = rKreg.filter(function(k) { return parseInt(k.height) === h; });
                    var lbl = _excelShortLabel(p.name || '', 'krag');
                    cols.push({
                        key: 'red_krag_' + tDn + '_' + h,
                        label: 'R.Krąg H=' + h,
                        shortLabel: 'R.' + lbl.short,
                        detailLabel: lbl.detail,
                        type: 'number',
                        componentType: 'krag',
                        height: h,
                        products: matching,
                        fromReduction: true,
                        redDn: tDn
                    });
                }
            });
            /* Red. Osadniki (per produkt) */
            (redDnSpecific['osadnik'] || []).forEach(function(p) {
                var lbl = _excelShortLabel(p.name || '', 'osadnik');
                cols.push({
                    key: 'red_osadnik_' + tDn + '_' + p.id,
                    label: 'R.' + p.name,
                    shortLabel: 'R.' + lbl.short,
                    detailLabel: lbl.detail,
                    type: 'number',
                    componentType: 'osadnik',
                    productId: p.id,
                    height: p.height,
                    fromReduction: true,
                    redDn: tDn
                });
            });
            /* Red. Uszczelki (przez filterSealsByWellType) */
            var uszczProducts = redDnSpecific['uszczelka'] || [];
            if (typeof filterSealsByWellType === 'function') {
                uszczProducts = filterSealsByWellType(uszczProducts, refWell);
            }
            uszczProducts.forEach(function(p) {
                var lbl = _excelShortLabel(p.name || '', 'uszczelka');
                cols.push({
                    key: 'red_uszczelka_' + tDn + '_' + p.id,
                    label: 'R.' + p.name,
                    shortLabel: 'R.' + lbl.short,
                    detailLabel: lbl.detail,
                    type: 'number',
                    componentType: 'uszczelka',
                    productId: p.id,
                    height: p.height,
                    fromReduction: true,
                    redDn: tDn
                });
            });
            /* Red. Płyty redukcyjne — w głównym systemie: dn === (średnica studni) + matchesTargetDn */
            /* Filtruj z allRedPlyta (produkty dla średnicy studni) tylko pasujące do tDn */
            allRedPlyta.forEach(function(p) {
                var nameUC = (p.name || '').toUpperCase();
                var tDnStr = String(tDn);
                var matches = nameUC.includes('/' + tDnStr) ||
                    nameUC.includes(' DN' + tDnStr) ||
                    nameUC.includes('X' + tDnStr) ||
                    nameUC.includes(' NA ' + tDnStr) ||
                    nameUC.includes('→DN' + tDnStr) ||
                    nameUC.includes('→' + tDnStr) ||
                    nameUC.includes('->DN' + tDnStr) ||
                    nameUC.includes('->' + tDnStr) ||
                    nameUC.includes('DO ' + tDnStr);
                if (!matches) return;
                var lbl = _excelShortLabel(p.name || '', 'plyta_redukcyjna');
                cols.push({
                    key: 'red_plyta_redukcyjna_' + tDn + '_' + p.id,
                    label: 'R.' + p.name,
                    shortLabel: 'R.' + lbl.short,
                    detailLabel: lbl.detail,
                    type: 'number',
                    componentType: 'plyta_redukcyjna',
                    productId: p.id,
                    height: p.height,
                    fromReduction: true,
                    redDn: tDn
                });
            });
            /* Red. Kręgi OT */
            var rKragOt = [...(redDnSpecific['krag_ot'] || [])].sort(function(a,b) { return (parseFloat(a.height)||0) - (parseFloat(b.height)||0); });
            var seenROtH = {};
            rKragOt.forEach(function(p) {
                var h = parseInt(p.height) || 0;
                if (h > 0 && !seenROtH[h]) {
                    seenROtH[h] = true;
                    var matching = rKragOt.filter(function(k) { return parseInt(k.height) === h; });
                    var lbl = _excelShortLabel(p.name || '', 'krag_ot');
                    cols.push({
                        key: 'red_krag_ot_' + tDn + '_' + h,
                        label: 'R.Kr.OT H=' + h,
                        shortLabel: 'R.' + lbl.short,
                        detailLabel: lbl.detail,
                        type: 'number',
                        componentType: 'krag_ot',
                        height: h,
                        products: matching,
                        fromReduction: true,
                        redDn: tDn
                    });
                }
            });
        }); /* koniec targetDns.forEach */
        } /* koniec targetDns */
    } /* koniec hasRedTab */

    return cols;
}

/* ===== SHORT LABEL GENERATOR dla dwóch wierszy nagłówka ===== */
function _excelShortLabel(name, componentType) {
    var n = (name || '').trim();
    switch (componentType) {
        case 'avr': {
            var size = n.replace(/Pierścień AVR\s*/i, '').trim().replace(/mm$/i, '') || '';
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
            // Tylko wysokość — modyfikator (bez stopni, drabinka) zależy od studni
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
            return { short: short, detail: detail };
        }
        case 'plyta_najazdowa': {
            var short = 'Pł.najazd';
            var detail = name.replace(/^Płyta najazdowa\s*/i, '').trim();
            if (!detail) detail = name;
            return { short: short, detail: detail };
        }
        case 'plyta_zamykajaca': {
            return { short: 'Pł.odc', detail: '200' };
        }
        case 'pierscien_odciazajacy': {
            return { short: 'Pierśc.odc', detail: '' };
        }
        case 'plyta_redukcyjna': {
            var short = 'Pł.red.';
            var detail = name.replace(/^Płyta redukcyjna\s*/i, '').trim();
            return { short: short, detail: detail };
        }
        case 'osadnik': {
            var short = 'Osadnik';
            var detail = name.length > 14 ? name.substring(0, 12) + '…' : name;
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

/* ===== WRAP DETAIL — łamie wariant na nowy wiersz ===== */
function _excelWrapDetail(detail) {
    if (!detail || detail === '·') return '·';
    // Łam przed "bez stopni", "drabinka nierdzewna", "z otworami"
    var br = detail.replace(
        /\s+(bez stopni|drabinka nierdzewna|z otworami?)\s*$/i,
        '<br>$1'
    );
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

function _excelCalcUszczelkaCount(well) {
    let count = 0;
    (well.config || []).forEach((item) => {
        const p =
            typeof studnieProducts !== 'undefined'
                ? studnieProducts.find((pr) => pr.id === item.productId)
                : null;
        if (p && p.componentType === 'uszczelka') {
            count += item.quantity;
        }
    });
    return count;
}

function _excelCountProductInConfig(well, componentType, height, productId) {
    let count = 0;
    (well.config || []).forEach((item) => {
        const p =
            typeof studnieProducts !== 'undefined'
                ? studnieProducts.find((pr) => pr.id === item.productId)
                : null;
        if (!p) return;
        if (productId) {
            if (item.productId !== productId) return;
        } else {
            if (p.componentType !== componentType) return;
            if (height !== undefined && parseInt(p.height) !== parseInt(height)) return;
        }
        count += item.quantity;
    });
    return count;
}

/* Cache dla resolveEffectiveProduct — unikaj O(n²) */
function _excelGetResolution(well, item) {
    if (!well.__resCache) well.__resCache = {};
    var key = item.productId + ':' + (item.quantity || 0);
    if (!well.__resCache[key]) {
        var sz = typeof studnieProducts !== 'undefined' ? studnieProducts : [];
        well.__resCache[key] = typeof resolveEffectiveProduct === 'function'
            ? resolveEffectiveProduct(well, item.productId, item)
            : sz.find(function(pr) { return pr.id === item.productId; });
    }
    return well.__resCache[key];
}

/* Czyść cache resolution przy zmianie konfiguracji studni */
function _excelClearResCache(well) {
    if (well) delete well.__resCache;
}

/* ===== Dynamiczny kod produktu w h3 — pobrany z configu zaznaczonej studni ===== */
function _excelGetWellProdCode(well, ct, height) {
    if (!well || !well.config || !ct) return null;
    var sz = typeof studnieProducts !== 'undefined' ? studnieProducts : [];

    /* 1. Szukaj w configu z resolveEffectiveProduct — to samo co "Wybór elementów" */
    for (var i = 0; i < well.config.length; i++) {
        var item = well.config[i];
        if (item.quantity <= 0) continue;
        var resolved = _excelGetResolution(well, item);
        if (!resolved) continue;
        if (resolved.componentType !== ct) continue;
        if (height !== undefined && height !== null && height !== ''
            && parseInt(resolved.height) !== parseInt(height)) continue;
        return resolved.id;
    }

    /* 2. FALLBACK: pierwszy dostępny produkt dla tego ct+height — zgodnie z filtrami studni */
    if (typeof getAvailableProducts === 'function' && typeof filterByWellParams === 'function') {
        var avail = getAvailableProducts(well).filter(function(p) {
            try { return filterByWellParams(p, well); } catch (e) { return true; }
        });
        var fallback = avail.filter(function(p) { return p.componentType === ct; });
        if (height !== undefined && height !== null && height !== '') {
            fallback = fallback.filter(function(p) { return parseInt(p.height) === parseInt(height); });
        }
        return fallback.length > 0 ? fallback[0].id : null;
    }
    return null;
}

/* ===== Cena elementu w h3 — per sztuka, zgodnie z getItemAssessedPrice ===== */
function _excelGetWellProdPrice(well, ct, height) {
    if (!well || !well.config || !ct) return '';
    var sz = typeof studnieProducts !== 'undefined' ? studnieProducts : [];

    /* 1. Szukaj w configu — to samo co _excelGetWellProdCode */
    for (var i = 0; i < well.config.length; i++) {
        var item = well.config[i];
        if (item.quantity <= 0) continue;
        var resolved = _excelGetResolution(well, item);
        if (!resolved) continue;
        if (resolved.componentType !== ct) continue;
        if (height !== undefined && height !== null && height !== ''
            && parseInt(resolved.height) !== parseInt(height)) continue;
        /* Mamy dopasowany config item — pobierz cenę */
        var price = typeof getItemAssessedPrice === 'function'
            ? getItemAssessedPrice(well, resolved, true, item)
            : (resolved.price || 0);
        var fmt = typeof fmtInt === 'function' ? fmtInt : function(n) { return Math.round(n || 0).toLocaleString('pl-PL'); };
        return fmt(price) + ' PLN';
    }
    
    /* 2. FALLBACK: pierwszy dostępny produkt */
    if (typeof getAvailableProducts === 'function' && typeof filterByWellParams === 'function') {
        var avail = getAvailableProducts(well).filter(function(p) { return filterByWellParams(p, well); });
        var fallbackP = avail.find(function(p) {
            return p.componentType === ct
                && (height === undefined || height === null || height === ''
                    || parseInt(p.height) === parseInt(height));
        });
        if (fallbackP) {
            var price = typeof getItemAssessedPrice === 'function'
                ? getItemAssessedPrice(well, fallbackP, true, null)
                : (fallbackP.price || 0);
            var fmt = typeof fmtInt === 'function' ? fmtInt : function(n) { return Math.round(n || 0).toLocaleString('pl-PL'); };
            return fmt(price) + ' PLN';
        }
    }
    
    return ''; /* brak ceny */
}

function _excelUpdateHeaderProdCodes() {
    var container = document.getElementById('excel-table-container');
    if (!container) return;
    var codes = container.querySelectorAll('thead .h3-prodcode');
    if (!codes.length) return;
    var prices = container.querySelectorAll('thead .h3-prodprice');
    var well = typeof currentWellIndex !== 'undefined' && currentWellIndex >= 0
        ? wells[currentWellIndex] : null;
    codes.forEach(function(span, idx) {
        var isPerProduct = span.getAttribute('data-per-product') === '1';
        if (isPerProduct) return; /* kolumny per-produkt mają stały kod z definicji */
        var ct = span.getAttribute('data-ct');
        var height = span.getAttribute('data-height');
        var pid = well ? _excelGetWellProdCode(well, ct, height) : null;
        span.textContent = pid !== null && pid !== undefined ? pid : '';
        /* Aktualizuj cenę w tym samym indeksie */
        if (prices && prices[idx]) {
            prices[idx].textContent = pid ? (_excelGetWellProdPrice(well, ct, height) || '') : '';
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
        .filter((p) => p.componentType === 'wlaz' && (p.dn == null || parseInt(p.dn) === parseInt(well.dn)))
        .filter((p) => typeof filterByWellParams !== 'function' || filterByWellParams(p, well));
    if (avail.length === 0) return;
    const defaultWlazH = typeof window.offerDefaultWlazH !== 'undefined' ? window.offerDefaultWlazH : 150;
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
    return `background:transparent;border:1px solid transparent;border-radius:2px;color:var(--text-primary);${_EXCEL_FONT}text-align:right;outline:none;transition:border-color 0.15s,background 0.15s;`;
}

/* ===== OPEN MODAL ===== */
function openExcelTableModal() {
    if (typeof wells === 'undefined' || !Array.isArray(wells)) {
        window.wells = [];
    }

    _excelMaxTransitions = _excelGetMaxTransitions();

    const existing = document.getElementById('excel-table-overlay');
    if (existing) existing.remove();

    const overlay = document.createElement('div');
    overlay.id = 'excel-table-overlay';

    // Pozycjonuj overlay obok lewego panelu (jeśli widoczny)
    const diagramPanel = document.querySelector('.well-diagram-panel');
    const isDiagramVisible = diagramPanel && diagramPanel.offsetParent !== null;
    if (isDiagramVisible) {
        const rect = diagramPanel.getBoundingClientRect();
        overlay.style.cssText = `position:fixed;top:${rect.top}px;left:${rect.right}px;width:calc(100vw - ${rect.right}px);height:${rect.height}px;z-index:10000;background:rgba(0,0,0,0.75);backdrop-filter:blur(6px);display:flex;align-items:center;justify-content:center;`;
    } else {
        overlay.style.cssText =
            'position:fixed;inset:0;z-index:10000;background:rgba(0,0,0,0.75);backdrop-filter:blur(6px);display:flex;align-items:center;justify-content:center;';
    }

    overlay.addEventListener('click', (e) => {
        if (e.target === overlay) closeExcelTableModal();
    });
    overlay.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') closeExcelTableModal();
    });

    const modal = document.createElement('div');
    if (isDiagramVisible) {
        modal.style.cssText =
            'width:calc(100% - 1rem);height:calc(100% - 1rem);background:#0c0e14;border:1px solid rgba(255,255,255,0.06);border-radius:4px;display:flex;flex-direction:column;overflow:hidden;box-shadow:0 20px 60px rgba(0,0,0,0.6);';
    } else {
        modal.style.cssText =
            'width:96vw;height:96vh;background:#0c0e14;border:1px solid rgba(255,255,255,0.06);border-radius:4px;display:flex;flex-direction:column;overflow:hidden;box-shadow:0 20px 60px rgba(0,0,0,0.6);';
    }

    modal.innerHTML = `
        <style>
            #excel-table-overlay ::-webkit-scrollbar { width:8px; height:10px; }
            #excel-table-overlay ::-webkit-scrollbar-track { background:rgba(255,255,255,0.04); }
            #excel-table-overlay ::-webkit-scrollbar-thumb { background:rgba(255,255,255,0.25); border-radius:4px; }
            #excel-table-overlay ::-webkit-scrollbar-thumb:hover { background:rgba(255,255,255,0.35); }
            #excel-table-overlay ::-webkit-scrollbar-corner { background:transparent; }
            #excel-table-container input:focus { border-color:rgba(99,102,241,0.5) !important; }
            #excel-table-container select:focus { border-color:rgba(99,102,241,0.5) !important; }
            #excel-table-container td.excel-col-selected { background:rgba(99,102,241,0.12) !important; box-shadow:inset 0 0 0 1px rgba(99,102,241,0.25); }
            #excel-table-container th.excel-col-selected { background:rgba(99,102,241,0.25) !important; box-shadow:inset 0 0 0 1px rgba(99,102,241,0.35); }
            #excel-table-container table { min-width:100%; border-collapse:collapse; }
            #excel-table-container .h3-prodcode { font-size:0.5rem;font-weight:600;color:#a4b3cb;line-height:1.45; }
            #excel-table-container .h3-prodprice { font-size:0.55rem;color:#34d399;font-weight:700;line-height:1.4;white-space:nowrap;background:rgba(52,211,153,0.07);border-radius:3px;padding:1px 5px;margin-top:2px;display:inline-block; }
            #excel-table-container tbody tr:hover { background:rgba(255,255,255,0.02) !important; }
            #excel-table-container .excel-resize-handle { width:4px !important;background:rgba(255,255,255,0.08); }
            #excel-table-container .excel-resize-handle:hover { background:rgba(99,102,241,0.5) !important; }
            #excel-table-container thead th { position:relative; }
        </style>
        <div style="display:flex;align-items:center;justify-content:space-between;padding:0.45rem 0.8rem;background:#10131a;border-bottom:1px solid rgba(255,255,255,0.06);flex-shrink:0;">
            <div style="display:flex;align-items:center;gap:0.6rem;">
                <i data-lucide="table" style="width:16px;height:16px;color:#10b981;"></i>
                <span style="font-size:0.75rem;font-weight:700;color:#e2e8f0;letter-spacing:0.3px;">Tabela konfiguracyjna</span>
                <span id="excel-well-count" style="font-size:0.6rem;color:#64748b;padding:0.1rem 0.5rem;background:rgba(255,255,255,0.04);border-radius:3px;"></span>
            </div>
            <div style="display:flex;gap:0.4rem;align-items:center;">
                <button onclick="excelAddWellToTab()" id="excel-add-btn" title="Dodaj studnię do bieżącej zakładki" style="background:rgba(59,130,246,0.15);color:#93c5fd;border:1px solid rgba(59,130,246,0.25);padding:0.3rem 0.7rem;border-radius:3px;font-size:0.65rem;font-weight:600;cursor:pointer;display:flex;align-items:center;gap:0.3rem;"><i data-lucide="plus" style="width:12px;height:12px;"></i> Dodaj</button>
                <button onclick="excelSaveAll()" style="background:rgba(16,185,129,0.15);color:#6ee7b7;border:1px solid rgba(16,185,129,0.3);padding:0.3rem 0.9rem;border-radius:3px;font-size:0.65rem;font-weight:700;cursor:pointer;">Gotowe (Zapisz)</button>
                <button onclick="closeExcelTableModal()" style="background:rgba(239,68,68,0.1);color:#fca5a5;border:1px solid rgba(239,68,68,0.2);padding:0.3rem 0.7rem;border-radius:3px;font-size:0.65rem;font-weight:600;cursor:pointer;">✕</button>
            </div>
        </div>
        <div id="excel-tabs" style="display:flex;gap:0;padding:0;background:#10131a;border-bottom:1px solid rgba(255,255,255,0.06);flex-shrink:0;"></div>
        <div id="excel-table-container" style="flex:1;overflow:auto;background:#0c0e14;"></div>
    `;

    overlay.appendChild(modal);
    document.body.appendChild(overlay);

    // Delegowany klik na wiersze — bardziej niezawodny niż inline onclick
    const container = document.getElementById('excel-table-container');
    if (container) {
        container.addEventListener('keydown', (e) => {
            if (e.key.startsWith('Arrow')) {
                e.stopPropagation();
                _excelHandleArrow(e);
            }
        });
        /* Delegowany klik — zamiast inline onclick na każdym TR */
        container.addEventListener('click', function(e) {
            var row = e.target.closest('tr[data-widx]');
            if (row && !e.target.closest('button') && !e.target.closest('input') && !e.target.closest('select')) {
                excelSelectRow(parseInt(row.getAttribute('data-widx')));
            }
        });
    }

    _excelActiveTab = DN_TABS[0];
    _excelRenderTabs();
    _excelRenderTable(_excelActiveTab);
    _excelUpdateHeaderProdCodes(); /* natychmiast po renderze — bez czekania na polling */
    _excelStartPolling();
    _excelUpdateWellCount();

    if (typeof lucide !== 'undefined') lucide.createIcons({ root: overlay });
}

/* ===== WYBÓR WIERSZA ===== */
function _excelUpdateLeftPreview(wIdx) {
    const well = typeof wells !== 'undefined' && wells[wIdx] ? wells[wIdx] : null;
    if (!well) return;
    if (typeof currentWellIndex !== 'undefined') {
        currentWellIndex = wIdx;
    }
    if (typeof renderWellDiagram === 'function') {
        renderWellDiagram();
    }
}

function excelSelectRow(wIdx) {
    const container = document.getElementById('excel-table-container');
    if (!container) return;
    const prevIdx = typeof currentWellIndex !== 'undefined' ? currentWellIndex : -1;
    currentWellIndex = wIdx;

    // Przywróć poprzedni wiersz do oryginalnego tła (z data-base-bg)
    if (prevIdx >= 0) {
        const prevRow = container.querySelector(`tr[data-widx="${prevIdx}"]`);
        if (prevRow) {
            const base = prevRow.getAttribute('data-base-bg');
            if (base) {
                prevRow.style.background = base;
                prevRow.setAttribute('data-orig-bg', base);
            }
        }
    }

    // Zaznacz nowy aktywny wiersz
    const newRow = container.querySelector(`tr[data-widx="${wIdx}"]`);
    if (newRow) {
        const activeBg = newRow.getAttribute('data-active-bg');
        if (activeBg) {
            newRow.style.background = activeBg;
            newRow.setAttribute('data-orig-bg', activeBg);
        }
    }

    _excelUpdateLeftPreview(wIdx);
    _excelUpdateHeaderProdCodes();
}

function closeExcelTableModal() {
    _excelStopPolling();
    const overlay = document.getElementById('excel-table-overlay');
    if (overlay) overlay.remove();
}

/* ===== TABS (always all visible) ===== */
function _excelRenderTabs() {
    const container = document.getElementById('excel-tabs');
    if (!container) return;

    const dnCounts = {};
    wells.forEach((w) => {
        const key = w.dn === 'styczna' ? 'styczne' : String(w.dn);
        dnCounts[key] = (dnCounts[key] || 0) + 1;
    });

    let html = '';
    DN_TABS.forEach((tab) => {
        const count = dnCounts[tab] || 0;
        const c = DN_COLORS[tab] || DN_COLORS['1000'];
        const isActive = tab === _excelActiveTab;
        const tabLabel = tab === 'styczne' ? 'Styczne' : 'DN' + tab;
        html += `<button onclick="excelSwitchTab('${tab}')" style="
            padding:0.4rem 1rem;border:none;cursor:pointer;font-size:0.67rem;font-weight:600;
            border-bottom:2px solid ${isActive ? c.border : c.border + '66'};
            background:${isActive ? c.activeBg : c.bg};
            color:${isActive ? c.text : c.border + '99'};
            transition:all 0.12s;letter-spacing:0.2px;">
            ${tabLabel}<span style="opacity:0.5;margin-left:0.3rem;font-size:0.6rem;">${count}</span>
        </button>`;
    });
    container.innerHTML = html;
}

function _excelUpdateWellCount() {
    const el = document.getElementById('excel-well-count');
    if (el) el.textContent = wells.length + ' studni';
}

function excelSwitchTab(tab) {
    _excelActiveTab = tab;
    _excelRenderTabs();
    _excelRenderTable(tab);
}

/* ===== ADD WELL TO CURRENT TAB ===== */
function excelAddWellToTab() {
    const dn = _excelActiveTab === 'styczne' ? 'styczna' : parseInt(_excelActiveTab);

    let well;
    if (typeof createNewWell === 'function') {
        well = createNewWell(null, /** @type {any} */ (dn));
    } else {
        well = {
            id: 'well_' + Date.now() + '_' + Math.floor(Math.random() * 10000),
            name:
                (dn === 'styczna' ? 'Studnia Styczna' : 'Studnia DN' + dn) +
                ' (#' +
                (wells.length + 1) +
                ')',
            dn: dn,
            config: [],
            przejscia: [],
            rzednaWlazu: null,
            rzednaDna: null,
            kineta: 'brak',
            psiaBuda: false,
            redukcjaDN1000: false,
            redukcjaMinH: 2500
        };
    }

    wells.push(well);
    _excelAutoSetWlaz(well);
    _excelMaxTransitions = _excelGetMaxTransitions();
    _excelRenderTabs();
    _excelRenderTable(_excelActiveTab);
    _excelUpdateWellCount();
    const newWIdx = wells.length - 1;
    setTimeout(() => excelSelectRow(newWIdx), 50);
    _excelDebouncedRefresh();
    showToast('Dodano: ' + well.name, 'success');
}

/* ===== TABLE RENDER (Excel-style) ===== */
function _excelRenderTable(dn) {
    const container = document.getElementById('excel-table-container');
    if (!container) return;

    const tabWells = wells.filter((w) => _excelWellMatchesTab(w, dn));
    const maxTr = _excelMaxTransitions;
    const compCols = _excelBuildComponentColumns(dn, tabWells[0]);
    const hasReduction = ['1200', '1500', '2000', '2500', 'styczne'].includes(dn);

    const dnColor = (DN_COLORS[dn === 'styczne' ? 'styczne' : dn] || DN_COLORS['1000']).border;
    const dnBg = (DN_COLORS[dn === 'styczne' ? 'styczne' : dn] || DN_COLORS['1000']).activeBg;

    let html = '<table style="width:100%;border-collapse:separate;border-spacing:0;table-layout:auto;">';

    /* THEAD — sticky, trzy wiersze */
    html += '<thead>';
    let h1 = ''; // rząd 2: skrócone etykiety
    let h2 = ''; // rząd 3: szczegóły
    let h3 = ''; // rząd 1: średnica (DN)

    const thBase =
        'padding:0.4rem 0.5rem;font-size:0.65rem;font-weight:600;text-transform:uppercase;letter-spacing:0.4px;white-space:nowrap;';
    const th2Base =
        'padding:0.2rem 0.5rem;font-size:0.6rem;font-weight:400;white-space:pre-wrap;word-break:break-word;max-width:100px;opacity:0.7;line-height:1.3;';
    const th3Base =
        'padding:0.1rem 0.5rem;font-size:0.55rem;font-weight:500;color:#64748b;text-align:center;white-space:nowrap;';

    const dnLabel = dn === 'styczne' ? 'Styczne' : 'DN' + dn;
    const dnTh3 = (ct) => (ct === 'avr' ? 'uniw.' : dnLabel);

    h1 += `<th style="${thBase}background:#161923;color:#94a3b8;position:sticky;left:0;z-index:30;min-width:130px;text-align:left;">Nr Studni</th>`;
    h2 += `<th style="${th2Base}background:#161923;color:#94a3b8;position:sticky;left:0;z-index:30;min-width:130px;text-align:left;">·</th>`;
    h3 += `<th style="${th3Base}background:#161923;color:#94a3b8;position:sticky;left:0;z-index:30;min-width:130px;text-align:left;">·</th>`;
    h1 += `<th style="${thBase}background:#161923;color:#94a3b8;min-width:78px;text-align:right;">Rz. Włazu</th>`;
    h2 += `<th style="${th2Base}background:#161923;color:#94a3b8;min-width:78px;text-align:right;">·</th>`;
    h3 += `<th style="${th3Base}background:#161923;color:#94a3b8;min-width:78px;text-align:right;">·</th>`;
    h1 += `<th style="${thBase}background:#161923;color:#94a3b8;min-width:78px;text-align:right;">Rz. Dna</th>`;
    h2 += `<th style="${th2Base}background:#161923;color:#94a3b8;min-width:78px;text-align:right;">·</th>`;
    h3 += `<th style="${th3Base}background:#161923;color:#94a3b8;min-width:78px;text-align:right;">·</th>`;
    h1 += `<th style="${thBase}background:#161923;color:${dnColor};min-width:65px;text-align:center;">Wys.</th>`;
    h2 += `<th style="${th2Base}background:#161923;color:${dnColor};min-width:65px;text-align:center;">auto</th>`;
    h3 += `<th style="${th3Base}background:#161923;color:${dnColor};min-width:65px;text-align:center;">·</th>`;

    for (let i = 0; i < maxTr; i++) {
        h1 += `<th style="${thBase}background:#13151f;color:${dnColor};min-width:78px;text-align:right;">Rz.wlot ${i}</th>`;
        h2 += `<th style="${th2Base}background:#13151f;color:${dnColor};min-width:78px;text-align:right;">·</th>`;
        h3 += `<th style="${th3Base}background:#13151f;color:${dnColor};min-width:78px;text-align:right;">·</th>`;
        h1 += `<th style="${thBase}background:#13151f;color:${dnColor};min-width:55px;text-align:center;">Kąt ${i}°</th>`;
        h2 += `<th style="${th2Base}background:#13151f;color:${dnColor};min-width:55px;text-align:center;">·</th>`;
        h3 += `<th style="${th3Base}background:#13151f;color:${dnColor};min-width:55px;text-align:center;">·</th>`;
        h1 += `<th style="${thBase}background:#13151f;color:${dnColor};min-width:125px;text-align:left;">Rodzaj ${i}</th>`;
        h2 += `<th style="${th2Base}background:#13151f;color:${dnColor};min-width:125px;text-align:left;">·</th>`;
        h3 += `<th style="${th3Base}background:#13151f;color:${dnColor};min-width:125px;text-align:left;">·</th>`;
        h1 += `<th style="${thBase}background:#13151f;color:${dnColor};min-width:110px;text-align:left;">Średnica ${i}</th>`;
        h2 += `<th style="${th2Base}background:#13151f;color:${dnColor};min-width:110px;text-align:left;">·</th>`;
        h3 += `<th style="${th3Base}background:#13151f;color:${dnColor};min-width:110px;text-align:left;">·</th>`;
    }

    // Przyciski +/-
    h1 += `<th style="${thBase}background:#13151f;color:#64748b;min-width:24px;text-align:center;padding:0;"><button onclick="excelRemoveTransitionColumn()" title="Usuń ostatnią kolumnę przejścia" style="background:transparent;color:#ef4444;border:none;cursor:pointer;font-size:0.9rem;font-weight:700;padding:0.15rem 0;width:100%;transition:color 0.1s;" onmouseenter="this.style.color='#f87171'" onmouseleave="this.style.color='#ef4444'">−</button></th>`;
    h2 += `<th style="${th2Base}background:#13151f;color:#64748b;min-width:24px;text-align:center;padding:0;">·</th>`;
    h3 += `<th style="${th3Base}background:#13151f;color:#64748b;min-width:24px;text-align:center;padding:0;">·</th>`;
    h1 += `<th style="${thBase}background:#13151f;color:#64748b;min-width:24px;text-align:center;padding:0;"><button onclick="excelAddTransitionColumn()" title="Dodaj kolumnę przejścia" style="background:transparent;color:#64748b;border:none;cursor:pointer;font-size:0.9rem;font-weight:700;padding:0.15rem 0;width:100%;transition:color 0.1s;" onmouseenter="this.style.color='#94a3b8'" onmouseleave="this.style.color='#64748b'">+</button></th>`;
    h2 += `<th style="${th2Base}background:#13151f;color:#64748b;min-width:24px;text-align:center;padding:0;">·</th>`;
    h3 += `<th style="${th3Base}background:#13151f;color:#64748b;min-width:24px;text-align:center;padding:0;">·</th>`;

    // Właz
    h1 += `<th style="${thBase}background:#0f1a15;color:#6ee7b7;min-width:65px;text-align:left;">Właz</th>`;
    h2 += `<th style="${th2Base}background:#0f1a15;color:#6ee7b7;min-width:65px;text-align:left;">·</th>`;
    h3 += `<th style="${th3Base}background:#0f1a15;color:#6ee7b7;min-width:65px;text-align:left;">·</th>`;

    // Komponenty — trzy wiersze (rz1=DN, rz2=skrót, rz3=szczegół)
    compCols.forEach((col) => {
        if (col.type === 'auto' || col.type === 'select') return;
        /** @type {any} */
        const c = col;
        const ct = c.componentType;
        const hc =
            ct === 'avr'
                ? '#fbbf24'
                : ct === 'krag' || ct === 'krag_ot'
                  ? '#34d399'
                  : ct === 'dennica'
                    ? '#f97316'
                    : ct === 'konus'
                      ? '#fb923c'
                      : ct === 'plyta_din' ||
                          ct === 'plyta_najazdowa' ||
                          ct === 'plyta_zamykajaca' ||
                          ct === 'pierscien_odciazajacy'
                        ? '#60a5fa'
                        : ct === 'plyta_redukcyjna'
                          ? '#f472b6'
                          : ct === 'osadnik'
                            ? '#a78bfa'
                            : ct === 'styczna'
                              ? '#f472b6'
                              : '#93c5fd';
        const colLabel = c.shortLabel || c.label;
        const colDetail = _excelWrapDetail(c.detailLabel) || '·';
        var isPerProduct = c.productId ? true : false;
        var colCodeId;
        if (isPerProduct) {
            /* Kolumna per-produkt — zawsze pokazuje swój stały kod */
            colCodeId = c.productId;
        } else {
            /* Kolumna grupowana — dynamicznie z configu zaznaczonej studni */
            var dynProdCode = null;
            if (typeof currentWellIndex !== 'undefined' && currentWellIndex >= 0 && wells[currentWellIndex]) {
                dynProdCode = _excelGetWellProdCode(wells[currentWellIndex], ct, c.height);
            }
            var fallbackCode = c.products && c.products[0] && c.products[0].id || null;
            colCodeId = dynProdCode || fallbackCode;
        }
        const codeDisp = colCodeId || null;
        const perProdAttr = isPerProduct ? ' data-per-product="1"' : '';
        const fallbackAttr = isPerProduct ? '' : ` data-fallback="${escapeHtml(c.products && c.products[0] && c.products[0].id || '')}"`;
        const colCode = codeDisp
            ? `<br><span class="h3-prodcode" data-ct="${ct}" data-height="${c.height != null ? c.height : ''}"${perProdAttr}${fallbackAttr} style="overflow:hidden;text-overflow:ellipsis;display:block;max-width:95px;">${escapeHtml(codeDisp)}</span><br><span class="h3-prodprice" data-ct="${ct}" data-height="${c.height != null ? c.height : ''}"${perProdAttr} style="display:block;"></span>`
            : '';
        const h3Pad = colCodeId ? '0.25rem 0.5rem 0.2rem' : '0.15rem 0.5rem';
        h1 += `<th style="${thBase}background:#13151f;color:${hc};min-width:62px;text-align:center;">${colLabel}</th>`;
        h2 += `<th style="${th2Base}background:#13151f;color:${hc};min-width:62px;text-align:center;">${colDetail}</th>`;
        h3 += `<th style="padding:${h3Pad};font-size:0.55rem;font-weight:500;color:#64748b;text-align:center;white-space:nowrap;background:#13151f;color:${hc};min-width:62px;text-align:center;">${dnTh3(ct)}${colCode}</th>`;
    });

    if (hasReduction) {
        /* Redukcja — pojedynczy select: Brak / DN1000 / DN1200 */
        h1 += `<th style="${thBase}background:#1a1215;color:#fca5a5;min-width:110px;text-align:center;">Redukcja</th>`;
        h2 += `<th style="${th2Base}background:#1a1215;color:#fca5a5;min-width:110px;text-align:center;">·</th>`;
        h3 += `<th style="${th3Base}background:#1a1215;color:#fca5a5;min-width:110px;text-align:center;">·</th>`;
    }

    h1 += `<th style="${thBase}background:#1a170f;color:#fbbf24;min-width:60px;text-align:center;">H denn</th>`;
    h2 += `<th style="${th2Base}background:#1a170f;color:#fbbf24;min-width:60px;text-align:center;">auto</th>`;
    h3 += `<th style="${th3Base}background:#1a170f;color:#fbbf24;min-width:60px;text-align:center;">·</th>`;
    h1 += `<th style="${thBase}background:#1a170f;color:#fbbf24;min-width:50px;text-align:center;">Uszcz</th>`;
    h2 += `<th style="${th2Base}background:#1a170f;color:#fbbf24;min-width:50px;text-align:center;">auto</th>`;
    h3 += `<th style="${th3Base}background:#1a170f;color:#fbbf24;min-width:50px;text-align:center;">·</th>`;
    h1 += `<th style="${thBase}background:#150f1a;color:#c4b5fd;min-width:95px;text-align:left;">Kineta</th>`;
    h2 += `<th style="${th2Base}background:#150f1a;color:#c4b5fd;min-width:95px;text-align:left;">·</th>`;
    h3 += `<th style="${th3Base}background:#150f1a;color:#c4b5fd;min-width:95px;text-align:left;">·</th>`;
    h1 += `<th style="${thBase}background:#161923;color:#94a3b8;min-width:55px;text-align:center;">P.Buda</th>`;
    h2 += `<th style="${th2Base}background:#161923;color:#94a3b8;min-width:55px;text-align:center;">·</th>`;
    h3 += `<th style="${th3Base}background:#161923;color:#94a3b8;min-width:55px;text-align:center;">·</th>`;
    h1 += `<th style="${thBase}background:#161923;color:#94a3b8;min-width:90px;text-align:center;">Akcje</th>`;
    h2 += `<th style="${th2Base}background:#161923;color:#94a3b8;min-width:90px;text-align:center;">·</th>`;
    h3 += `<th style="${th3Base}background:#161923;color:#94a3b8;min-width:90px;text-align:center;">·</th>`;

    html += `<tr style="position:sticky;top:0;z-index:20;">${h3}</tr>`;
    html += `<tr style="position:sticky;top:1.4rem;z-index:20;">${h1}</tr>`;
    html += `<tr style="position:sticky;top:3.2rem;z-index:20;">${h2}</tr>`;
    html += '</thead><tbody>';

    /* Wykryj duplikaty nazw — we wszystkich średnicach */
    const nameCounts = {};
    const nameDnMap = {}; // nazwa -> [{dn, label}]
    wells.forEach((w) => {
        const n = (w.name || '').trim().toLowerCase();
        if (n) {
            nameCounts[n] = (nameCounts[n] || 0) + 1;
            const dnKey = w.dn === 'styczna' ? 'styczne' : String(w.dn);
            if (!nameDnMap[n]) nameDnMap[n] = [];
            const dnC = DN_COLORS[dnKey] || DN_COLORS['1000'];
            const dnLabel = dnKey === 'styczne' ? 'Styczne' : 'DN' + dnKey;
            if (!nameDnMap[n].find((x) => x.dn === dnKey)) {
                nameDnMap[n].push({ dn: dnKey, label: dnLabel, color: dnC.border });
            }
        }
    });
    const dupNames = new Set(Object.keys(nameCounts).filter((n) => nameCounts[n] > 1));


    tabWells.forEach((well, idx) => {
        const wIdx = wells.indexOf(well);
        const isEven = idx % 2 === 0;
        const isActive = typeof currentWellIndex !== 'undefined' && wIdx === currentWellIndex;
        const nameKey = (well.name || '').trim().toLowerCase();
        const isDup = dupNames.has(nameKey);
        const tabKey = dn === 'styczne' ? 'styczne' : String(dn);
        const dnKey = dn === 'styczne' ? 'styczne' : dn;
        // Wykryj duplikaty między-średnicowe — pokaż kolor innej zakładki
        const nameDnList = nameDnMap[nameKey] || [];
        const otherDns = nameDnList.filter(d => d.dn !== dnKey);
        const dupColorKey = isDup && otherDns.length > 0 ? otherDns[0].dn : dnKey;
        const baseBg = isEven ? '#0a0d16' : '#181c28';

        // Solidne kolory wierszy — wszystkie nieprzezroczyste
        const rowDupSolid = {
            1000: '#162650',
            1200: '#0e2a1e',
            1500: '#2a2210',
            2000: '#241b36',
            2500: '#301818',
            styczne: '#2c1422'
        }[dupColorKey] || '#162650';
        const rowActiveDupSolid = {
            1000: '#1e3a6b',
            1200: '#164530',
            1500: '#3d3018',
            2000: '#352552',
            2500: '#4a2020',
            styczne: '#4a1a38'
        }[dupColorKey] || '#1e3a6b';
        const rowBg = isDup && isActive ? rowActiveDupSolid : isDup ? rowDupSolid : isActive ? '#1a2645' : baseBg;

        // Solidne hover kolory
        const hoverDupSolid = {
            1000: '#1d3460',
            1200: '#143e2e',
            1500: '#383018',
            2000: '#2e2248',
            2500: '#3e2020',
            styczne: '#3a1a2e'
        }[dupColorKey] || '#1d3460';
        const hoverActiveDupSolid = {
            1000: '#2a4a80',
            1200: '#1d5a3e',
            1500: '#4d3d20',
            2000: '#452e66',
            2500: '#602a2a',
            styczne: '#602848'
        }[dupColorKey] || '#2a4a80';
        const hoverBg = isDup && isActive ? hoverActiveDupSolid : isDup ? hoverDupSolid : isActive ? '#263460' : '#141722';
        const rowBorder = 'none';
        const przejscia = well.przejscia || [];

        html += `<tr data-widx="${wIdx}" data-base-bg="${rowBg}" data-orig-bg="${rowBg}" data-hover-bg="${hoverBg}" data-active-bg="${isDup && isActive ? rowActiveDupSolid : isDup ? hoverDupSolid : '#1a2645'}" style="background:${rowBg};outline:${rowBorder};transition:background 0.15s;" onmouseenter="this.style.background=this.getAttribute('data-hover-bg')" onmouseleave="this.style.background=this.getAttribute('data-orig-bg')">`

        const tdBase = `${_EXCEL_FONT}`;

        /* Nr. Studni — edytowalny input + badge duplikatu, sticky */
        html += `<td style="${tdBase}position:sticky;left:0;z-index:5;background:inherit;"><input type="text" value="${escapeHtml(well.name)}" onchange="excelOnNameChange(${wIdx},this.value)" onfocus="excelCellFocus(this)" data-row-input="true" onblur="excelCellBlur(this)" style="${_excelCellInp(125)}text-align:left;" /></td>`;

        /* Rz. Włazu */
        html += `<td style="${tdBase}text-align:right;"><input type="number" step="0.01" data-field="rzednaWlazu" value="${well.rzednaWlazu != null ? well.rzednaWlazu : ''}" onchange="excelOnRzednaChange(${wIdx})" onfocus="excelCellFocus(this)" onblur="excelCellBlur(this)" style="${_excelCellInp(72)}" /></td>`;

        /* Rz. Dna */
        html += `<td style="${tdBase}text-align:right;"><input type="number" step="0.01" data-field="rzednaDna" value="${well.rzednaDna != null ? well.rzednaDna : ''}" onchange="excelOnRzednaChange(${wIdx})" onfocus="excelCellFocus(this)" onblur="excelCellBlur(this)" style="${_excelCellInp(72)}" /></td>`;

        /* Wys. — auto */
        const height = _excelCalcWellHeight(well);
        html += `<td style="${tdBase}text-align:center;color:${dnColor};font-weight:600;" data-cell="height-${wIdx}">${height || '—'}</td>`;

        /* Przejścia */
        for (let i = 0; i < maxTr; i++) {
            const prz = przejscia[i] || {};
            const hasExplicitRzWl = prz.rzednaWlaczenia != null && prz.rzednaWlaczenia !== '';
            const rzWlPlaceholder =
                !hasExplicitRzWl && well.rzednaDna != null
                    ? 'auto (' + well.rzednaDna.toFixed(3) + ')' : '';
            const przProducts =
                typeof studnieProducts !== 'undefined' && typeof getMaxPipeDn === 'function'
                    ? studnieProducts.filter(
                          (p) =>
                              p.componentType === 'przejscie' &&
                              p.active !== 0 &&
                              parseInt(p.dn) <= getMaxPipeDn(well.dn)
                      )
                    : [];

            // Znajdź obecny produkt
            const currProduct = przProducts.find((p) => p.id === prz.productId);
            // Wybierz unikalne kategorie (Rodzaje) dla tej studni
            const categories = [...new Set(przProducts.map((p) => p.category))].sort();

            // Określ aktywny rodzaj
            const activeCategory = currProduct ? currProduct.category : prz.tempCategory || '';

            let typeSel = `<select onchange="excelOnPrzejscieTypeChange(${wIdx},${i},this.value)" style="${_excelCellInp(120)}text-align:left;cursor:pointer;">`;
            typeSel += '<option value="">—</option>';
            categories.forEach((cat) => {
                typeSel += `<option value="${cat}"${activeCategory === cat ? ' selected' : ''}>${cat}</option>`;
            });
            typeSel += '</select>';

            // Wybierz średnice dostępne tylko dla wybranego rodzaju
            const availDns = activeCategory
                ? [...przProducts.filter((p) => p.category === activeCategory)].sort(
                      (a, b) => parseFloat(a.dn) - parseFloat(b.dn)
                  )
                : [];

            let dnSel = `<select onchange="excelOnPrzejscieChange(${wIdx},${i},'productId',this.value)" style="${_excelCellInp(110)}text-align:left;cursor:pointer;"${!activeCategory ? ' disabled' : ''}>`;
            dnSel += '<option value="">—</option>';
            availDns.forEach((p) => {
                const dnLabel =
                    typeof p.dn === 'string' && p.dn.includes('/') ? p.dn : 'DN ' + p.dn;
                dnSel += `<option value="${p.id}"${prz.productId === p.id ? ' selected' : ''}>${dnLabel}</option>`;
            });
            dnSel += '</select>';

            html += `<td style="${tdBase}text-align:right;"><input type="number" step="0.01" value="${hasExplicitRzWl ? prz.rzednaWlaczenia : ''}" placeholder="${rzWlPlaceholder}" onchange="excelOnPrzejscieChange(${wIdx},${i},'rzednaWlaczenia',this.value)" onfocus="excelCellFocus(this)" onblur="excelCellBlur(this)" style="${_excelCellInp(72)}" /></td>`;
            html += `<td style="${tdBase}text-align:center;"><input type="number" step="1" value="${prz.angle != null ? prz.angle : ''}" onchange="excelOnPrzejscieChange(${wIdx},${i},'angle',this.value)" onfocus="excelCellFocus(this)" onblur="excelCellBlur(this)" style="${_excelCellInp(50)}text-align:center;" /></td>`;
            html += `<td style="${tdBase}text-align:left;">${typeSel}</td>`;
            html += `<td style="${tdBase}text-align:left;">${dnSel}</td>`;
        }

        html += `<td style="padding:0.3rem 0;font-size:0.67rem;font-family:Consolas,Menlo,monospace;text-align:center;color:#1e293b;background:#0c0e14;"></td><td style="padding:0.3rem 0;font-size:0.67rem;font-family:Consolas,Menlo,monospace;text-align:center;color:#1e293b;background:#0c0e14;"></td>`;
                /* Właz — użyj produktów z definicji kolumny (spójne z nagłówkiem) */
        const wlazCol = compCols.find((c) => c.componentType === 'wlaz');
        const wlazProducts = wlazCol
            ? wlazCol.products.filter(
                  (p) => typeof filterByWellParams !== 'function' || filterByWellParams(p, well)
              )
            : [];
        const wlazVal = _excelGetWlazFromConfig(well);
        let wlazSel = `<select onchange="excelOnWlazChange(${wIdx},this.value)" style="${_excelCellInp(62)}text-align:left;cursor:pointer;">`;
        wlazSel += '<option value="">—</option>';
        wlazProducts.forEach((p) => {
            const hCm = Math.round(parseInt(p.height) || 0) / 10;
            const label = hCm > 0 ? hCm + ' cm' : (p.name.length > 20 ? p.name.substring(0, 18) + '…' : p.name);
            wlazSel += `<option value="${p.id}"${wlazVal === p.id ? ' selected' : ''}>${label}</option>`;
        });
        wlazSel += '</select>';
        html += `<td style="${tdBase}text-align:left;">${wlazSel}</td>`;

        /* Komponenty — ilości z kodem produktu */
        compCols.forEach((col) => {
            if (col.type === 'select' || col.type === 'auto') return;
            const c = /** @type {any} */ (col);
            const count = _excelCountProductInConfig(well, c.componentType, c.height, c.productId);
            const pidArg = c.productId ? `'${c.productId}'` : 'null';
            const hArg = c.height != null ? c.height : 'null';
            // Pobierz kod produktu z konfiguracji studni
            let cellCode = '';
            if (count > 0 && !c.productId) {
                // Kolumna grupowana — znajdź pierwszy produkt w config
                for (const item of well.config || []) {
                    const p = typeof studnieProducts !== 'undefined'
                        ? studnieProducts.find(pr => pr.id === item.productId)
                        : null;
                    if (p && p.componentType === c.componentType &&
                        parseInt(p.height) === parseInt(c.height) && item.quantity > 0) {
                        cellCode = p.id;
                        break;
                    }
                }
            }
            const codeHtml = cellCode
                ? `<div style="font-size:0.4rem;color:#64748b;opacity:0.6;line-height:1.2;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;max-width:58px;">${escapeHtml(cellCode)}</div>`
                : '';
            /* Redukcja nadbudowa — wyłącz input gdy studnia nie ma pasującej redukcji */
            var redDisabled = c.fromReduction && (!well.redukcjaDN1000 || parseInt(c.redDn) !== parseInt(well.redukcjaTargetDN));
            var disabledAttr = redDisabled ? ' disabled' : '';
            html += `<td style="${tdBase}text-align:center;min-width:62px;">`
                + `<input type="number" min="0" step="1" value="${count || ''}"${disabledAttr} oninput="excelOnCompChange(${wIdx},'${c.componentType}',${hArg},this.value,${pidArg})" onfocus="excelCellFocus(this)" onblur="excelCellBlur(this)" style="${_excelCellInp(50)}text-align:center;width:52px;" />`
                + codeHtml
                + `</td>`;
        });

        /* Redukcja — pojedynczy select: Brak / DN1000 / DN1200 */
        if (hasReduction) {
            var redActive = well.redukcjaDN1000;
            var redTarget = well.redukcjaTargetDN || 1000;
            /* DN1200 dostępne tylko dla DN>=1500 lub stycznych */
            var can1200 = [1500, 2000, 2500].includes(parseInt(well.dn)) || well.dn === 'styczna';
            var redOpts = '<option value="">Brak</option>';
            redOpts += '<option value="1000"' + (redActive && redTarget === 1000 ? ' selected' : '') + '>DN1000</option>';
            if (can1200) {
                redOpts += '<option value="1200"' + (redActive && redTarget === 1200 ? ' selected' : '') + '>DN1200</option>';
            }
            html += `<td style="${tdBase}text-align:center;"><select onchange="excelOnReductionSelectChange(${wIdx},this.value)" style="${_excelCellInp(105)}text-align:center;cursor:pointer;">${redOpts}</select></td>`;
        }

        /* H dennica — auto */
        const dennH = _excelCalcDennicaHeight(well);
        html += `<td style="${tdBase}text-align:center;color:#fbbf24;font-weight:600;" data-cell="denn-${wIdx}">${dennH || '—'}</td>`;

        /* Uszczelki — auto (z compCols) */
        const uszczCount = _excelCalcUszczelkaCount(well);
        html += `<td style="${tdBase}text-align:center;color:#f97316;font-weight:600;" data-cell="uszcz-${wIdx}">${uszczCount}</td>`;

        /* Kineta */
        let kinSel = `<select onchange="excelOnKinetaChange(${wIdx},this.value)" style="${_excelCellInp(90)}text-align:left;cursor:pointer;">`;
        KINETA_OPTIONS.forEach(([val, label]) => {
            kinSel += `<option value="${val}"${well.kineta === val ? ' selected' : ''}>${label}</option>`;
        });
        kinSel += '</select>';
        html += `<td style="${tdBase}text-align:left;">${kinSel}</td>`;

        /* Psia buda */
        html += `<td style="${tdBase}text-align:center;"><input type="checkbox"${well.psiaBuda ? ' checked' : ''} onchange="excelOnPsiaBudaChange(${wIdx},this.checked)" style="accent-color:#f59e0b;cursor:pointer;" /></td>`;

        /* Akcje: Param, Duplikuj, Usuń */
        html += `<td style="${tdBase}text-align:center;white-space:nowrap;">`;
        html += '<div style="display:flex;gap:2px;justify-content:center;">';
        html += `<button onclick="excelOpenWellParams(${wIdx})" title="Parametry" style="background:transparent;color:#818cf8;border:1px solid rgba(129,140,248,0.2);padding:0.15rem 0.3rem;border-radius:2px;font-size:0.55rem;cursor:pointer;font-weight:600;transition:all 0.1s;" onmouseenter="this.style.background='rgba(129,140,248,0.1)'" onmouseleave="this.style.background='transparent'">⋯</button>`;
        html += `<button onclick="excelDuplicateWell(${wIdx})" title="Duplikuj" style="background:transparent;color:#60a5fa;border:1px solid rgba(96,165,250,0.2);padding:0.15rem 0.3rem;border-radius:2px;font-size:0.55rem;cursor:pointer;font-weight:600;transition:all 0.1s;" onmouseenter="this.style.background='rgba(96,165,250,0.1)'" onmouseleave="this.style.background='transparent'">⧉</button>`;
        html += `<button onclick="excelDeleteWell(${wIdx})" title="Usuń" style="background:transparent;color:#f87171;border:1px solid rgba(248,113,113,0.2);padding:0.15rem 0.3rem;border-radius:2px;font-size:0.55rem;cursor:pointer;font-weight:600;transition:all 0.1s;" onmouseenter="this.style.background='rgba(239,68,68,0.15)'" onmouseleave="this.style.background='transparent'">✕</button>`;
        html += '</div></td>';

        html += '</tr>';
    });

    /* ===== EMPTY ROW — wiersz na nową studnię ===== */
    const emptyRowBg = '#0a0c10';
    html += `<tr id="excel-empty-row" style="background:${emptyRowBg};">`;

    const tdBase = `${_EXCEL_FONT}`;
    const tdEmpty = `${tdBase}color:#334155;`;

    /* Nazwa — sticky left */
    /* Nazwa — sticky left */
    html += `<td style="${tdEmpty}position:sticky;left:0;z-index:5;background:${emptyRowBg};"><input type="text" placeholder="Nazwa studni… (Enter/zmiana dodaje)" id="excel-empty-name" onkeydown="if(event.key==='Enter')excelCreateFromEmpty()" onblur="excelCreateFromEmpty(event)" onfocus="excelCellFocus(this)" style="${_excelCellInp(125)}text-align:left;color:#94a3b8;" /></td>`;

    /* Rz. Włazu */
    html += `<td style="${tdEmpty}text-align:right;"><input type="number" step="0.01" placeholder="—" id="excel-empty-rzw" onfocus="excelCellFocus(this)" style="${_excelCellInp(72)}" /></td>`;

    /* Rz. Dna */
    html += `<td style="${tdEmpty}text-align:right;"><input type="number" step="0.01" placeholder="—" id="excel-empty-rzd" onfocus="excelCellFocus(this)" style="${_excelCellInp(72)}" /></td>`;

    /* Wys. — placeholder */
    html += `<td style="${tdEmpty}text-align:center;color:#1e293b;" data-cell="height-empty">—</td>`;

    /* Przejścia — puste */
    for (let i = 0; i < maxTr; i++) {
        html += `<td style="${tdEmpty}text-align:right;"><input type="number" step="0.01" placeholder="—" disabled style="${_excelCellInp(72)}opacity:0.3;" /></td>`;
        html += `<td style="${tdEmpty}text-align:center;"><input type="number" step="1" placeholder="—" disabled style="${_excelCellInp(50)}opacity:0.3;" /></td>`;
        html += `<td style="${tdEmpty}text-align:left;"><select disabled style="${_excelCellInp(120)}opacity:0.3;"><option value="">—</option></select></td>`;
        html += `<td style="${tdEmpty}text-align:left;"><select disabled style="${_excelCellInp(110)}opacity:0.3;"><option value="">—</option></select></td>`;
    }

    html += `<td style="padding:0.3rem 0;font-size:0.67rem;font-family:Consolas,Menlo,monospace;color:#334155;background:#0a0c10;"></td><td style="padding:0.3rem 0;font-size:0.67rem;font-family:Consolas,Menlo,monospace;color:#334155;background:#0a0c10;"></td>`;
            /* Właz */
    html += `<td style="${tdEmpty}text-align:left;"><select disabled style="${_excelCellInp(125)}opacity:0.3;"><option value="">—</option></select></td>`;

    /* Komponenty */
    compCols.forEach((col) => {
        if (col.type === 'select' || col.type === 'auto') return;
        html += `<td style="${tdEmpty}text-align:center;"><input type="number" min="0" step="1" placeholder="—" disabled style="${_excelCellInp(50)}opacity:0.3;" /></td>`;
    });

    /* Redukcja — pusty wiersz, disabled select */
    if (hasReduction) {
        html += `<td style="${tdEmpty}text-align:center;"><select disabled style="${_excelCellInp(105)}opacity:0.3;cursor:default;"><option value="">—</option></select></td>`;
    }

    /* Auto-kolumny — placeholder */
    html += `<td style="${tdEmpty}text-align:center;color:#1e293b;" data-cell="denn-empty">—</td>`;
    html += `<td style="${tdEmpty}text-align:center;color:#1e293b;" data-cell="uszcz-empty">—</td>`;

    /* Kineta */
    html += `<td style="${tdEmpty}text-align:left;"><select disabled style="${_excelCellInp(90)}opacity:0.3;"><option value="">—</option></select></td>`;

    /* P.Buda */
    html += `<td style="${tdEmpty}text-align:center;"><input type="checkbox" disabled style="opacity:0.3;" /></td>`;

    /* Akcje */
    html += `<td style="${tdEmpty}text-align:center;color:#1e293b;font-size:0.6rem;" data-cell="empty-actions">nowa</td>`;

    html += '</tr>';

    html += '</tbody></table>';
    container.innerHTML = html;
    /* Zastosuj zapisane szerokości kolumn */
    if (_excelColWidths) {
        var tbl = container.querySelector('table');
        if (tbl) {
            Object.keys(_excelColWidths).forEach(function(key) {
                var d = key.split('-', 1)[0];
                if (d === dn) {
                    var ci = parseInt(key.split('-')[1]);
                    var th = tbl.querySelectorAll('thead tr:first-child th')[ci];
                    if (th) {
                        th.style.minWidth = _excelColWidths[key] + 'px';
                        th.style.width = _excelColWidths[key] + 'px';
                    }
                }
            });
        }
    }
    _excelInitColumnResize();
    _excelInitColumnSelect();
    _excelUpdateHeaderProdCodes();
}

/* ===== RESIZE COLUMNS (Excel-like drag handles) ===== */
function _excelInitColumnResize() {
    const container = document.getElementById('excel-table-container');
    if (!container) return;
    const table = container.querySelector('table');
    if (!table) return;

    const headers = table.querySelectorAll('thead tr:first-child th');
    headers.forEach((th) => {
        th.style.position = 'relative';

        const handle = document.createElement('div');
        handle.className = 'excel-col-resize-handle';
        handle.style.cssText =
            'position:absolute;top:2px;right:-1px;width:3px;height:calc(100% - 4px);cursor:col-resize;z-index:40;' +
            'background:rgba(148,163,184,0.15);border-radius:2px;transition:background 0.12s,width 0.12s,box-shadow 0.12s;';
        handle.addEventListener('mouseenter', () => {
            handle.style.background = 'rgba(99,102,241,0.45)';
            handle.style.width = '4px';
            handle.style.boxShadow = '0 0 6px rgba(99,102,241,0.25)';
        });
        handle.addEventListener('mouseleave', () => {
            handle.style.background = 'rgba(148,163,184,0.15)';
            handle.style.width = '3px';
            handle.style.boxShadow = 'none';
        });

        let startX = 0;
        let startWidth = 0;
        let lastDiff = 0;

        handle.addEventListener('mousedown', (/** @type {MouseEvent} */ e) => {
            startX = e.clientX;
            startWidth = /** @type {HTMLElement} */ (th).offsetWidth;
            lastDiff = 0;
            e.preventDefault();

            const colIndex = Array.from(headers).indexOf(th);
            const rows = table.querySelectorAll('tr');

            const onMove = (/** @type {MouseEvent} */ e2) => {
                const diff = e2.clientX - startX;
                lastDiff = diff;
                const newWidth = Math.max(30, startWidth + diff);

                // Które kolumny zmieniamy: wszystkie zaznaczone (jeśli ta jest zaznaczona) albo tylko tę
                const colsToResize =
                    _excelSelectedCols.includes(colIndex)
                        ? _excelSelectedCols
                        : [colIndex];

                colsToResize.forEach((ci) => {
                    rows.forEach((row) => {
                        const cell = row.children[ci];
                        if (cell) {
                            cell.style.minWidth = newWidth + 'px';
                            cell.style.width = newWidth + 'px';
                        }
                    });
                });
            };

            const onUp = () => {
                document.removeEventListener('mousemove', onMove);
                document.removeEventListener('mouseup', onUp);
                document.body.style.cursor = '';
                document.body.style.userSelect = '';
                /* Zapisz szerokości dla trwałości po re-renderze */
                const newWidth = Math.max(30, startWidth + lastDiff);
                const colsToResize =
                    _excelSelectedCols.includes(colIndex)
                        ? _excelSelectedCols
                        : [colIndex];
                colsToResize.forEach((ci) => {
                    _excelColWidths[_excelActiveTab + '-' + ci] = newWidth;
                });
            };

            document.addEventListener('mousemove', onMove);
            document.addEventListener('mouseup', onUp);
            document.body.style.cursor = 'col-resize';
            document.body.style.userSelect = 'none';
        });

        th.appendChild(handle);
    });
}

/* ===== COLUMN SELECTION (Ctrl+Click / Shift+Click) ===== */
function _excelInitColumnSelect() {
    const container = document.getElementById('excel-table-container');
    if (!container) return;
    const table = container.querySelector('table');
    if (!table) return;

    const headers = table.querySelectorAll('thead tr:first-child th');
    headers.forEach((th, colIdx) => {
        th.addEventListener('mousedown', (/** @type {MouseEvent} */ e) => {
            if (e.target.closest('.excel-col-resize-handle')) return;
            if (e.target.closest('button')) return;
            if (!e.ctrlKey && !e.shiftKey) {
                _excelSelectCol(colIdx, false, false);
                e.preventDefault();
                return;
            }
            e.preventDefault();
            _excelSelectCol(colIdx, e.ctrlKey || e.metaKey, e.shiftKey);
        });
    });

    // Klik w wiersz/tbody odznacza kolumny
    table.addEventListener('mousedown', (/** @type {MouseEvent} */ e) => {
        if (e.target.closest('thead')) return;
        if (e.ctrlKey || e.shiftKey) return;
        if (_excelSelectedCols.length > 0) _excelDeselectAllCols();
    });
}

function _excelSelectCol(colIdx, ctrl, shift) {
    const container = document.getElementById('excel-table-container');
    if (!container) return;
    const table = container.querySelector('table');
    if (!table) return;

    if (!ctrl && !shift) {
        _excelDeselectAllCols();
    }

    if (shift && _excelLastClickedCol >= 0 && _excelLastClickedCol !== colIdx) {
        const start = Math.min(_excelLastClickedCol, colIdx);
        const end = Math.max(_excelLastClickedCol, colIdx);
        for (let i = start; i <= end; i++) {
            if (!_excelSelectedCols.includes(i)) {
                _excelSelectedCols.push(i);
                _excelToggleColClass(i, true);
            }
        }
    }

    if (ctrl) {
        const idx = _excelSelectedCols.indexOf(colIdx);
        if (idx >= 0) {
            _excelSelectedCols.splice(idx, 1);
            _excelToggleColClass(colIdx, false);
        } else {
            _excelSelectedCols.push(colIdx);
            _excelToggleColClass(colIdx, true);
        }
    } else if (!shift) {
        _excelSelectedCols = [colIdx];
        _excelToggleColClass(colIdx, true);
    }

    _excelLastClickedCol = colIdx;
}

function _excelDeselectAllCols() {
    if (_excelSelectedCols.length === 0) return;
    const copy = [..._excelSelectedCols];
    _excelSelectedCols = [];
    _excelLastClickedCol = -1;
    copy.forEach((idx) => _excelToggleColClass(idx, false));
}

function _excelToggleColClass(colIdx, add) {
    const container = document.getElementById('excel-table-container');
    if (!container) return;
    const table = container.querySelector('table');
    if (!table) return;
    const rows = table.querySelectorAll('tr');
    rows.forEach((row) => {
        const cell = row.children[colIdx];
        if (cell) {
            if (add) cell.classList.add('excel-col-selected');
            else cell.classList.remove('excel-col-selected');
        }
    });
}

/* ===== EMPTY ROW HANDLER — tworzenie studni z wiersza ===== */
function excelCreateFromEmpty() {
    if (_excelCreatingLock) return;
    _excelCreatingLock = true;

    const nameEl = document.getElementById('excel-empty-name');
    const rzwEl = document.getElementById('excel-empty-rzw');
    const rzdEl = document.getElementById('excel-empty-rzd');
    if (!nameEl) {
        _excelCreatingLock = false;
        return;
    }

    const name = (nameEl.value || '').trim();
    const rzwRaw = rzwEl ? rzwEl.value : '';
    const rzdRaw = rzdEl ? rzdEl.value : '';
    const rzw = rzwRaw !== '' ? parseFloat(rzwRaw) : null;
    const rzd = rzdRaw !== '' ? parseFloat(rzdRaw) : null;

    if (!name && rzw === null && rzd === null) {
        _excelCreatingLock = false;
        return;
    }

    const dn = _excelActiveTab === 'styczne' ? 'styczna' : parseInt(_excelActiveTab);
    const autoName =
        name ||
        (dn === 'styczna' ? 'Studnia Styczna' : 'Studnia DN' + dn) +
            ' (#' +
            (wells.length + 1) +
            ')';

    let well;
    try {
        if (typeof createNewWell === 'function') {
            well = createNewWell(autoName, /** @type {any} */ (dn));
            if (name) {
                well.numer = name;
                well.name = name;
            }
        } else {
            well = {
                id: 'well_' + Date.now() + '_' + Math.floor(Math.random() * 10000),
                name: autoName,
                dn: dn,
                config: [],
                przejscia: [],
                rzednaWlazu: rzw,
                rzednaDna: rzd,
                kineta: 'brak',
                psiaBuda: false,
                redukcjaDN1000: false,
                redukcjaMinH: 2500
            };
        }

        if (rzw !== null) well.rzednaWlazu = rzw;
        if (rzd !== null) well.rzednaDna = rzd;

        wells.push(well);
        _excelAutoSetWlaz(well);
        _excelMaxTransitions = _excelGetMaxTransitions();
        _excelRenderTabs();
        _excelRenderTable(_excelActiveTab);
        _excelUpdateWellCount();
        _excelDebouncedRefresh();
        showToast('Dodano: ' + autoName, 'success');
    } finally {
        setTimeout(() => {
            _excelCreatingLock = false;
            const newIdx = wells.length - 1;
            const row = document.querySelector(`tr[data-widx="${newIdx}"]`);
            const rzwEl = row && row.querySelector('input[data-field="rzednaWlazu"]');
            if (rzwEl) { rzwEl.focus(); rzwEl.select(); }
        }, 100);
    }
}

/* ===== CELL FOCUS (Excel highlight) ===== */
function excelCellFocus(el) {
    el.style.outline = '1px solid rgba(99,102,241,0.5)';
    el.style.background = 'rgba(99,102,241,0.06)';
    el.select();
    _excelUserEditing = true; /* blokuje polling */

    // Ustaw aktywną studnię = wiersz w którym jest kursor
    var tr = el.closest('tr[data-widx]');
    if (tr) {
        var wIdx = parseInt(tr.getAttribute('data-widx'), 10);
        if (!isNaN(wIdx) && (typeof currentWellIndex === 'undefined' || wIdx !== currentWellIndex)) {
            excelSelectRow(wIdx);
        }
    }
}
function excelCellBlur(el) {
    el.style.outline = 'none';
    el.style.background = 'transparent';
    _excelUserEditing = false; /* wznawia polling */
}

/* ===== TAB KEY NAVIGATION ===== */
function _excelHandleTab(e) {
    const target = e.target;
    if (!target || (target.tagName !== 'INPUT' && target.tagName !== 'SELECT')) return;

    const container = document.getElementById('excel-table-container');
    if (!container || !container.contains(target)) return;

    const inputs = Array.from(
        container.querySelectorAll('input:not([disabled]), select:not([disabled])')
    );
    const idx = inputs.indexOf(target);
    if (idx === -1) return;

    e.preventDefault();
    const next = e.shiftKey ? inputs[idx - 1] : inputs[idx + 1];
    if (next) {
        next.focus();
        if (next.tagName === 'INPUT') next.select();
    }
}

/* ===== ARROW KEY NAVIGATION (Excel-like) ===== */
function _excelHandleArrow(e) {
    const target = e.target;
    if (!target || (target.tagName !== 'INPUT' && target.tagName !== 'SELECT')) return;

    const container = document.getElementById('excel-table-container');
    if (!container || !container.contains(target)) return;

    const tr = target.closest('tr');
    if (!tr) return;

    // Znajdź wszystkie wiersze data (pomiń empty-row)
    const allRows = Array.from(container.querySelectorAll('tbody tr'));
    const dataRows = allRows.filter(r => r.hasAttribute('data-widx'));
    const currentRowIdx = dataRows.indexOf(tr);
    if (currentRowIdx === -1) return;

    // Indeks kolumny wśród WSZYSTKICH input/select w wierszu (w tym disabled — dla spójności indeksów)
    const rowEls = Array.from(tr.querySelectorAll('input, select'));
    const colIdx = rowEls.indexOf(target);
    if (colIdx === -1) return;

    let next = null;

    if (e.key === 'ArrowRight') {
        next = rowEls[colIdx + 1] || null;
    } else if (e.key === 'ArrowLeft') {
        next = rowEls[colIdx - 1] || null;
    } else if (e.key === 'ArrowDown') {
        const nextRow = dataRows[currentRowIdx + 1];
        if (nextRow) {
            /* Aktualizuj lewy panel — select nowej studni */
            var downWIdx = parseInt(nextRow.getAttribute('data-widx'));
            if (!isNaN(downWIdx) && typeof currentWellIndex !== 'undefined' && downWIdx !== currentWellIndex) {
                excelSelectRow(downWIdx);
            }
            const nextEls = Array.from(
                nextRow.querySelectorAll('input, select')
            );
            next = nextEls[Math.min(colIdx, nextEls.length - 1)] || null;
        }
    } else if (e.key === 'ArrowUp') {
        const prevRow = dataRows[currentRowIdx - 1];
        if (prevRow) {
            /* Aktualizuj lewy panel — select nowej studni */
            var upWIdx = parseInt(prevRow.getAttribute('data-widx'));
            if (!isNaN(upWIdx) && typeof currentWellIndex !== 'undefined' && upWIdx !== currentWellIndex) {
                excelSelectRow(upWIdx);
            }
            const prevEls = Array.from(
                prevRow.querySelectorAll('input, select')
            );
            next = prevEls[Math.min(colIdx, prevEls.length - 1)] || null;
        }
    }

    // Pomijaj disabled elementy przy focusowaniu
    function _focusNext(el) {
        if (!el) return;
        if (el.disabled) return; // disabled input/select — nie da się focusować
        el.focus();
    }

    // Zawsze handle nav dla INPUT, nawet jeśli next jest null (blokuj scroll)
    if (target.tagName === 'INPUT') {
        e.preventDefault();
        if (next) {
            _focusNext(next);
            // select() tylko dla INPUT, nigdy dla SELECT (brak metody)
            if (next.tagName === 'INPUT' && !next.disabled && next.select) next.select();
        }
    } else if (target.tagName === 'SELECT' && next) {
        // select z open dropdown — nie blokuj (zachowaj natywne nawigowanie opcji)
        // ale jeśli navigate OUT to innej komórki, zróbmy to
        e.preventDefault();
        _focusNext(next);
        if (next.tagName === 'INPUT' && !next.disabled && next.select) next.select();
    }
}

/* ===== HANDLERS ===== */
function excelOnRzednaChange(wIdx) {
    const row = document.querySelector(`tr[data-widx="${wIdx}"]`);
    if (!row) return;
    _excelClearResCache(wells[wIdx]);
    const rzWlazuInput = row.querySelector('input[data-field="rzednaWlazu"]');
    const rzDnaInput = row.querySelector('input[data-field="rzednaDna"]');
    const rzWlazu = rzWlazuInput ? parseFloat(rzWlazuInput.value) || null : null;
    const rzDna = rzDnaInput ? parseFloat(rzDnaInput.value) || null : null;

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
    _excelDebouncedRefresh();
}

/* ===== DODAWANIE / USUWANIE KOLUMNY PRZEJŚCIA ===== */
function excelRemoveTransitionColumn() {
    if (_excelMaxTransitions <= 1 && wells.length > 0) {
        showToast('Nie można usunąć — minimum 1 kolumna przejścia', 'error');
        return;
    }
    const lastIdx = _excelMaxTransitions - 1;
    let hasData = false;
    if (typeof wells !== 'undefined' && Array.isArray(wells)) {
        for (const w of wells) {
            if (w.przejscia && w.przejscia[lastIdx]) {
                const p = w.przejscia[lastIdx];
                if (p.rzednaWlaczenia !== null && p.rzednaWlaczenia !== '' || p.productId !== null && p.productId !== '' || (p.kat && p.kat !== 0)) {
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
            if (w.przejscia && w.przejscia.length > 0) {
                w.przejscia.pop();
            }
        });
    }
    _excelMaxTransitions = Math.max(0, _excelMaxTransitions - 1);
    _excelRenderTable(_excelActiveTab);
    _excelDebouncedRefresh();
    showToast('Usunięto kolumnę przejścia', 'info');
}

function excelAddTransitionColumn() {
    _excelMaxTransitions = (_excelMaxTransitions || 1) + 1;
    /* Dodaj puste przejście do każdej studni, która ma mniej niż nowe max */
    if (typeof wells !== 'undefined' && Array.isArray(wells)) {
        wells.forEach((w) => {
            if (!w.przejscia) w.przejscia = [];
            while (w.przejscia.length < _excelMaxTransitions) {
                w.przejscia.push(_excelCreatePrzejscie());
            }
        });
    }
    _excelRenderTable(_excelActiveTab);
    _excelDebouncedRefresh();
    showToast('Dodano kolumnę przejścia', 'info');
}
function excelOnPrzejscieChange(wIdx, trIdx, field, value) {
    if (!wells[wIdx].przejscia) wells[wIdx].przejscia = [];
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
    _excelRenderTable(_excelActiveTab);
    _excelUpdateLeftPreview(wIdx);
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

function _excelMarkManual(well) {
    if (!well) return;
    well.autoLocked = true;
    well.configSource = 'MANUAL';
}

function _excelInsertConfigItem(well, componentType, productId, qty) {
    _excelClearResCache(well);
    /* Konus + PEHD wkładka — blokada jak w głównym konfiguratorze */
    if (componentType === 'konus' && well.wkladkaZwienczenie && well.wkladkaZwienczenie !== 'brak') {
        showToast('Nie można dodać konusa przy aktywnej wkładce PEHD zwieńczenia.', 'error');
        return;
    }
    const topTypes = ['wlaz', 'plyta_din', 'plyta_najazdowa', 'plyta_zamykajaca', 'konus', 'pierscien_odciazajacy'];
    const bottomTypes = ['dennica', 'kineta', 'styczna'];
    const reliefTypes = ['pierscien_odciazajacy', 'plyta_zamykajaca', 'plyta_najazdowa'];
    if (topTypes.includes(componentType)) {
        /* Właz: tylko wstaw, nie ruszaj reszty zakończeń */
        if (componentType === 'wlaz') {
            const wlazIdx = well.config.findIndex((item) => {
                const p = typeof studnieProducts !== 'undefined'
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
                const p = typeof studnieProducts !== 'undefined'
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
                const p = typeof studnieProducts !== 'undefined'
                    ? studnieProducts.find((pr) => pr.id === item.productId)
                    : null;
                return !(p && topTypes.includes(p.componentType));
            });
        }
        /* Wstaw za włazem (jeśli istnieje), żeby nie rozbić kolejności góra-dół */
        const wlazIdx = well.config.findIndex((item) => {
            const p = typeof studnieProducts !== 'undefined'
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
            setTimeout(function() { _excelAddingReliefPair = false; }, 200);
        }
    } else if (bottomTypes.includes(componentType)) {
        well.config.push({ productId, quantity: qty, autoAdded: false });
    } else {
        const topTypesForMiddle = ['wlaz', 'plyta_din', 'plyta_najazdowa', 'plyta_zamykajaca', 'konus', 'pierscien_odciazajacy'];
        /* Szukaj płyty redukcyjnej — wpływa na pozycję kręgów */
        const plateIdx = well.config.findIndex((item) => {
            const p = typeof studnieProducts !== 'undefined'
                ? studnieProducts.find((pr) => pr.id === item.productId)
                : null;
            return p && p.componentType === 'plyta_redukcyjna';
        });
        if (plateIdx >= 0) {
            const prod = typeof studnieProducts !== 'undefined'
                ? studnieProducts.find((pr) => pr.id === productId)
                : null;
            const isRedDn = prod && String(prod.dn) === '1000';
            if (isRedDn) {
                /* Krąg DN1000 — wstaw NAD płytą redukcyjną, za topClosure */
                let insertIdx = 0;
                for (let i = 0; i < plateIdx; i++) {
                    const p = typeof studnieProducts !== 'undefined'
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
                const p = typeof studnieProducts !== 'undefined'
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
            var _pr = typeof studnieProducts !== 'undefined'
                ? studnieProducts.find(function (x) { return x.id === well.config[_i].productId; })
                : null;
            if (_pr && (_pr.componentType === 'krag' || _pr.componentType === 'krag_ot') && well.config[_i].quantity > 1) {
                for (var _j = 0; _j < well.config[_i].quantity; _j++) {
                    _exp.push({ productId: well.config[_i].productId, quantity: 1, autoAdded: false });
                }
            } else {
                _exp.push(well.config[_i]);
            }
        }
        well.config = _exp;
    }
}

/* Posortuj konfig wg typów: właz→AVR→zakończenia→kręgi→dennica */
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
    well.config.sort(function (a, b) {
        var pA = sz.find(function (p) { return p.id === a.productId; });
        var pB = sz.find(function (p) { return p.id === b.productId; });
        if (!pA || !pB) return 0;
        var oA = typeOrder[pA.componentType] || 100;
        var oB = typeOrder[pB.componentType] || 100;
        return oA - oB;
    });
    /* BEZWZGLĘDNA REGUŁA: właz musi być na indeksie 0 */
    _excelMoveWlazToTop(well);
}

/* Wymuś właz na pozycji 0 configu — wyciągnij go z dowolnego miejsca i wstaw na początek */
function _excelMoveWlazToTop(well) {
    if (!well || !well.config || well.config.length < 2) return;
    var sz = typeof studnieProducts !== 'undefined' ? studnieProducts : [];
    var found = null;
    for (var i = 0; i < well.config.length; i++) {
        var p = sz.find(function (pr) { return pr.id === well.config[i].productId; });
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

function excelOnCompChange(wIdx, componentType, height, value, productId) {
    const well = wells[wIdx];
    const newQty = parseInt(value) || 0;
    _excelClearResCache(well);

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
            ).filter(
                (p) => p.componentType === componentType && parseInt(p.dn) === parseInt(well.dn)
            );
            if (height !== undefined)
                candidates = candidates.filter((p) => parseInt(p.height) === parseInt(height));
            if (typeof filterByWellParams === 'function')
                candidates = candidates.filter((p) => filterByWellParams(p, well));
        }
        /* Zachowaj wariant — użyj pierwszego istniejącego productId, nie candidates[0] */
        if (existingItems.length > 0 && !productId) {
            const firstPid = existingItems[0].productId;
            const stillAvail = candidates.some((c) => c.id === firstPid);
            const pid = stillAvail ? firstPid : (candidates.length > 0 ? candidates[0].id : null);
            if (pid) _excelInsertConfigItem(well, componentType, pid, newQty);
        } else if (candidates.length > 0) {
            _excelInsertConfigItem(well, componentType, candidates[0].id, newQty);
        }
    }
    _excelMarkManual(well);

    /* Auto-konwersja krag ↔ krag_ot: jeśli studnia ma przejścia → OT, jeśli nie → zwykły */
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
                if (_p && _p.componentType === targetType && parseInt(_p.dn) === parseInt(well.dn)
                    && (height === undefined || parseInt(_p.height) === parseInt(height))) {
                    totalExistingQty += _item.quantity || 1;
                } else {
                    _tmpConfig.push(_item);
                }
            }
            well.config = _tmpConfig;
            const totalQty = totalExistingQty + newQty;
            if (totalQty > 0) {
                const avail = typeof getAvailableProducts === 'function'
                    ? getAvailableProducts(well) : studnieProducts;
                let cand = avail.filter((p) =>
                    p.componentType === targetType && parseInt(p.dn) === parseInt(well.dn)
                    && (height === undefined || parseInt(p.height) === parseInt(height))
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
    if (newQty > 0 && (componentType === 'plyta_najazdowa' || componentType === 'plyta_zamykajaca' || componentType === 'pierscien_odciazajacy')) {
        var isRing = componentType === 'pierscien_odciazajacy';
        var partnerTypes = isRing ? ['plyta_najazdowa', 'plyta_zamykajaca'] : ['pierscien_odciazajacy'];
        var _avail = typeof getAvailableProducts === 'function' ? getAvailableProducts(well) : (studnieProducts || []);
        /* Sprawdź czy partner już istnieje (z tą samą wysokością) */
        var hasPartner = false;
        for (var ci = 0; ci < (well.config || []).length; ci++) {
            var cp = _avail.find(function (pr) { return pr.id === well.config[ci].productId; });
            if (cp && partnerTypes.indexOf(cp.componentType) !== -1) {
                if (height === undefined || parseInt(cp.height) === parseInt(height)) {
                    hasPartner = true;
                    break;
                }
            }
        }
        if (!hasPartner) {
            var partnerCandidates = _avail.filter(function (p) {
                return partnerTypes.indexOf(p.componentType) !== -1 && parseInt(p.dn) === parseInt(well.dn);
            });
            if (height !== undefined) {
                partnerCandidates = partnerCandidates.filter(function (p) { return parseInt(p.height) === parseInt(height); });
            }
            if (partnerCandidates.length > 0) {
                var partner = partnerCandidates[0];
                _excelInsertConfigItem(well, partner.componentType, partner.id, 1);
                _excelSortConfig(well);
                _excelRenderTable(_excelActiveTab);
            }
        }
    }
}

function excelOnKinetaChange(wIdx, value) {
    wells[wIdx].kineta = value;
    if (typeof syncKineta === 'function') syncKineta(wells[wIdx]);
    _excelUpdateLeftPreview(wIdx);
    _excelDebouncedRefresh();
}

function excelOnPsiaBudaChange(wIdx, checked) {
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

/* ===== Redukcja — pojedynczy select: Brak / DN1000 / DN1200 ===== */
async function excelOnReductionSelectChange(wIdx, value) {
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

function _excelRefreshAutoCells(wIdx, row) {
    const well = wells[wIdx];
    if (!well) return;

    const dnColor = (
        DN_COLORS[well.dn === 'styczna' ? 'styczne' : String(well.dn)] || DN_COLORS['1000']
    ).border;

    const height = _excelCalcWellHeight(well);
    const hCell = row.querySelector(`[data-cell="height-${wIdx}"]`);
    if (hCell) hCell.textContent = height || '—';

    const dennH = _excelCalcDennicaHeight(well);
    const dCell = row.querySelector(`[data-cell="denn-${wIdx}"]`);
    if (dCell) dCell.textContent = dennH || '—';

    const uszcz = _excelCalcUszczelkaCount(well);
    const uCell = row.querySelector(`[data-cell="uszcz-${wIdx}"]`);
    if (uCell) uCell.textContent = uszcz;
}

/* ===== NATYCHMIASTOWE ODŚWIEŻENIE KOLORÓW DUPLIKATÓW (bez re-rendera) ===== */
function _excelRefreshDupColors() {
    const container = document.getElementById('excel-table-container');
    if (!container) return;
    const dn = _excelActiveTab === 'styczne' ? 'styczne' : _excelActiveTab;
    const dnKey = dn === 'styczne' ? 'styczne' : dn;

    // Przelicz duplikaty i mapę DN-we wszystkich średnicach
    const nameCounts = {};
    const nameDnMap = {};
    wells.forEach((w) => {
        const n = (w.name || '').trim().toLowerCase();
        if (n) {
            nameCounts[n] = (nameCounts[n] || 0) + 1;
            const wDn = w.dn === 'styczna' ? 'styczne' : String(w.dn);
            if (!nameDnMap[n]) nameDnMap[n] = [];
            if (!nameDnMap[n].find((x) => x.dn === wDn)) {
                nameDnMap[n].push({ dn: wDn });
            }
        }
    });
    const dupNames = new Set(Object.keys(nameCounts).filter((n) => nameCounts[n] > 1));

    const rowDupSolid = { 1000: '#162650', 1200: '#0e2a1e', 1500: '#2a2210', 2000: '#241b36', 2500: '#301818', styczne: '#2c1422' };
    const rowActiveDupSolid = { 1000: '#1e3a6b', 1200: '#164530', 1500: '#3d3018', 2000: '#352552', 2500: '#4a2020', styczne: '#4a1a38' };
    const hoverDupSolid = { 1000: '#1d3460', 1200: '#143e2e', 1500: '#383018', 2000: '#2e2248', 2500: '#3e2020', styczne: '#3a1a2e' };
    const hoverActiveDupSolid = { 1000: '#2a4a80', 1200: '#1d5a3e', 1500: '#4d3d20', 2000: '#452e66', 2500: '#602a2a', styczne: '#602848' };

    const tabWells = wells.filter((w) => _excelWellMatchesTab(w, dn));
    tabWells.forEach((well, idx) => {
        const wIdx = wells.indexOf(well);
        const row = container.querySelector(`tr[data-widx="${wIdx}"]`);
        if (!row) return;

        const isEven = idx % 2 === 0;
        const isActive = typeof currentWellIndex !== 'undefined' && wIdx === currentWellIndex;
        const nameKey = (well.name || '').trim().toLowerCase();
        const isDup = dupNames.has(nameKey);
        // Wykryj duplikaty między-średnicowe
        const nameDnList = nameDnMap[nameKey] || [];
        const otherDns = nameDnList.filter(d => d.dn !== dnKey);
        const dupColorKey = isDup && otherDns.length > 0 ? otherDns[0].dn : dnKey;
        const baseBg = isEven ? '#0a0d16' : '#181c28';

        const rowBg = isDup && isActive ? rowActiveDupSolid[dupColorKey] || '#1e3a6b' : isDup ? rowDupSolid[dupColorKey] || '#162650' : isActive ? '#1a2645' : baseBg;
        const hoverBg = isDup && isActive ? hoverActiveDupSolid[dupColorKey] || '#2a4a80' : isDup ? hoverDupSolid[dupColorKey] || '#1d3460' : isActive ? '#263460' : '#141722';
        const activeBg = isDup && isActive ? rowActiveDupSolid[dupColorKey] || '#1e3a6b' : isDup ? hoverDupSolid[dupColorKey] || '#1d3460' : '#1a2645';

        row.setAttribute('data-base-bg', rowBg);
        row.setAttribute('data-orig-bg', rowBg);
        row.setAttribute('data-hover-bg', hoverBg);
        row.setAttribute('data-active-bg', activeBg);
        row.style.background = rowBg;
    });
}

/* ===== SAVE ===== */
function excelSaveAll() {
    if (typeof refreshAll === 'function') refreshAll();
    showToast('Zapisano zmiany w tabeli', 'success');
    closeExcelTableModal();
}

/* ===== PARAM. BUTTON — popup parametrów studni w Excelu — kafelki ===== */
function excelOpenWellParams(wIdx) {
    const well = wells[wIdx];
    if (!well) return;

    const existing = document.getElementById('excel-params-popup');
    if (existing) existing.remove();

    const overlay = document.createElement('div');
    overlay.id = 'excel-params-popup';
    overlay.style.cssText = 'position:fixed;inset:0;z-index:10001;background:rgba(0,0,0,0.6);backdrop-filter:blur(4px);display:flex;align-items:center;justify-content:center;';
    overlay.addEventListener('click', (e) => { if (e.target === overlay) overlay.remove(); });

    /* Oblicz szerokość okna dynamicznie: wszystkie kafelki ten sam rozmiar, brak zawijania */
    const maxOptions = Math.max(...WELL_PARAM_DEFS.map(d => d.options.length));
    const TILE_W = 90;
    const gapPx = 5.6;
    const gridW = maxOptions * TILE_W + (maxOptions - 1) * gapPx;
    const popupW = Math.min(Math.round(gridW + 185 + 42), 1200);

    const modal = document.createElement('div');
    modal.style.cssText = `width:${popupW}px;max-height:90vh;background:var(--bg-primary);border:1px solid rgba(255,255,255,0.06);border-radius:6px;display:flex;flex-direction:column;overflow:hidden;box-shadow:0 20px 60px rgba(0,0,0,0.6);`;

    let bodyHtml = `<div style="display:flex;flex-direction:column;gap:0.55rem;">`;
    if (typeof WELL_PARAM_DEFS !== 'undefined') {
        const isOsadnik = typeof isSettlingWell === 'function' && isSettlingWell(well);
        WELL_PARAM_DEFS.forEach((def) => {
            if (def.key === 'precoFullHeight' && well.kineta !== 'preco' && well.kineta !== 'precotop') return;

            let isGreyedOut = false;
            if (def.key === 'wkladkaOsadnikPreco' && !isOsadnik) isGreyedOut = true;
            if (def.key === 'spocznikH' && (well.kineta === 'preco' || well.kineta === 'precotop')) isGreyedOut = true;
            if (well.wkladkaOsadnikPreco === 'tak' && (def.key === 'kineta' || def.key === 'spocznik')) return;

            const currentVal = well[def.key] || '';
            bodyHtml += `<div style="display:flex;align-items:center;gap:0.2rem;${isGreyedOut ? 'opacity:0.5;' : ''}">`;
            bodyHtml += `<span style="font-size:0.85rem;color:var(--text-muted);font-weight:700;white-space:nowrap;min-width:185px;text-align:left;">${def.label}</span>`;
            const cols = def.options.length;
            bodyHtml += `<div style="display:grid;grid-template-columns:repeat(${cols}, ${TILE_W}px);gap:0.35rem;flex:1;">`;
            def.options.forEach(([val, lbl]) => {
                const active = val === currentVal;
                bodyHtml += `<button onclick="updateWellParam('${def.key}','${val}');excelRefreshParamsPopup(${wIdx})" style="height:34px;border-radius:8px;cursor:pointer;font-size:0.85rem;font-weight:${active?'800':'600'};border:1px solid ${active?'rgba(99,102,241,0.6)':'rgba(255,255,255,0.08)'};background:${active?'rgba(99,102,241,0.25)':'rgba(255,255,255,0.04)'};color:${active?'#a5b4fc':'var(--text-secondary)'};transition:all 0.15s ease;display:flex;align-items:center;justify-content:center;${active?'box-shadow:0 0 10px rgba(99,102,241,0.2);':''}" onmouseenter="if(!${active}){this.style.borderColor='rgba(99,102,241,0.3)';this.style.background='rgba(255,255,255,0.08)'}" onmouseleave="if(!${active}){this.style.borderColor='rgba(255,255,255,0.08)';this.style.background='rgba(255,255,255,0.04)'}">${lbl}</button>`;
            });
            bodyHtml += `</div></div>`;

            /* Pola dodatkowe — malowanie wew. */
            if (def.key === 'malowanieW' && well.malowanieW && well.malowanieW !== 'brak') {
                bodyHtml += `<div style="display:flex;align-items:center;gap:0.2rem;min-height:32px;margin-top:0.3rem;">`;
                bodyHtml += `<span style="font-size:0.85rem;color:var(--text-muted);font-weight:700;white-space:nowrap;min-width:185px;text-align:left;">Nazwa p. wew.</span>`;
                bodyHtml += `<input type="text" value="${escapeHtml(well.powlokaNameW || '')}" onclick="this.select()" onchange="updateWellParam('powlokaNameW',this.value);excelRefreshParamsPopup(${wIdx})" placeholder="Nazwa powłoki..." style="flex:1;max-width:260px;height:36px;background:rgba(0,0,0,0.2);border:1px solid rgba(255,255,255,0.1);color:var(--text-primary);padding:0 0.7rem;font-size:0.85rem;border-radius:6px;">`;
                bodyHtml += `</div>`;
                bodyHtml += `<div style="display:flex;align-items:center;gap:0.2rem;min-height:32px;margin-top:0.3rem;">`;
                bodyHtml += `<span style="font-size:0.85rem;color:var(--text-muted);font-weight:700;white-space:nowrap;min-width:185px;text-align:left;">Koszt p. wew.</span>`;
                bodyHtml += `<input type="number" step="0.01" value="${well.malowanieWewCena || ''}" onclick="this.select()" onchange="updateWellParam('malowanieWewCena',parseFloat(this.value)||0);excelRefreshParamsPopup(${wIdx})" placeholder="PLN / m²" style="width:100px;height:36px;background:rgba(0,0,0,0.2);border:1px solid rgba(255,255,255,0.1);color:var(--text-primary);padding:0 0.7rem;font-size:0.85rem;border-radius:6px;">`;
                bodyHtml += `</div>`;
            }
            /* Pola dodatkowe — malowanie zew. */
            if (def.key === 'malowanieZ' && well.malowanieZ && well.malowanieZ !== 'brak') {
                bodyHtml += `<div style="display:flex;align-items:center;gap:0.2rem;min-height:32px;margin-top:0.3rem;">`;
                bodyHtml += `<span style="font-size:0.85rem;color:var(--text-muted);font-weight:700;white-space:nowrap;min-width:185px;text-align:left;">Nazwa p. zew.</span>`;
                bodyHtml += `<input type="text" value="${escapeHtml(well.powlokaNameZ || '')}" onclick="this.select()" onchange="updateWellParam('powlokaNameZ',this.value);excelRefreshParamsPopup(${wIdx})" placeholder="Nazwa powłoki..." style="flex:1;max-width:260px;height:36px;background:rgba(0,0,0,0.2);border:1px solid rgba(255,255,255,0.1);color:var(--text-primary);padding:0 0.7rem;font-size:0.85rem;border-radius:6px;">`;
                bodyHtml += `</div>`;
                bodyHtml += `<div style="display:flex;align-items:center;gap:0.2rem;min-height:32px;margin-top:0.3rem;">`;
                bodyHtml += `<span style="font-size:0.85rem;color:var(--text-muted);font-weight:700;white-space:nowrap;min-width:185px;text-align:left;">Koszt p. zew.</span>`;
                bodyHtml += `<input type="number" step="0.01" value="${well.malowanieZewCena || ''}" onclick="this.select()" onchange="updateWellParam('malowanieZewCena',parseFloat(this.value)||0);excelRefreshParamsPopup(${wIdx})" placeholder="PLN / m²" style="width:100px;height:36px;background:rgba(0,0,0,0.2);border:1px solid rgba(255,255,255,0.1);color:var(--text-primary);padding:0 0.7rem;font-size:0.85rem;border-radius:6px;">`;
                bodyHtml += `</div>`;
            }
        });
    }
    bodyHtml += `</div>`;

    modal.innerHTML = `
        <div style="display:flex;align-items:center;justify-content:space-between;padding:0.5rem 0.8rem;background:#10131a;border-bottom:1px solid rgba(255,255,255,0.06);flex-shrink:0;">
            <span style="font-size:0.85rem;font-weight:700;color:var(--text-primary);">Parametry: ${escapeHtml(well.name)}</span>
            <button onclick="document.getElementById('excel-params-popup').remove()" style="background:transparent;color:var(--text-muted);border:none;cursor:pointer;font-size:1.1rem;">✕</button>
        </div>
        <div style="flex:1;overflow-y:auto;padding:0.8rem;">
            ${bodyHtml}
        </div>
        <div style="display:flex;gap:0.5rem;justify-content:flex-end;padding:0.5rem 0.8rem;background:#10131a;border-top:1px solid rgba(255,255,255,0.06);flex-shrink:0;">
            <button onclick="document.getElementById('excel-params-popup').remove()" style="background:rgba(255,255,255,0.06);color:var(--text-secondary);border:1px solid rgba(255,255,255,0.1);padding:0.4rem 1.2rem;border-radius:6px;font-size:0.8rem;cursor:pointer;font-weight:600;">Zamknij</button>
        </div>
    `;

    overlay.appendChild(modal);
    document.body.appendChild(overlay);
}

/* Odświeżenie popupa parametrów po zmianie kafelka */
function excelRefreshParamsPopup(wIdx) {
    _excelDebouncedRefresh();
    _excelRenderTable(_excelActiveTab);
    const existing = document.getElementById('excel-params-popup');
    if (existing) { existing.remove(); excelOpenWellParams(wIdx); }
}

/* ===== EDYCJA NAZWY STUDNI ===== */
function excelOnNameChange(wIdx, value) {
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

/* ===== DUPLIKOWANIE STUDNI Z TABELI ===== */
function excelDuplicateWell(wIdx) {
    const src = wells[wIdx];
    if (!src) return;
    const copy = structuredClone(src);
    copy.id = 'well_' + Date.now() + '_' + Math.floor(Math.random() * 10000);
    copy.name = src.name + ' (kopia)';
    wells.splice(wIdx + 1, 0, copy);
    _excelMaxTransitions = _excelGetMaxTransitions();
    _excelRenderTabs();
    _excelRenderTable(_excelActiveTab);
    _excelUpdateWellCount();
    setTimeout(() => excelSelectRow(wIdx + 1), 50);
    _excelDebouncedRefresh();
    showToast('Skopiowano: ' + copy.name, 'success');
}

/* ===== USUWANIE STUDNI Z TABELI ===== */
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
    _excelMaxTransitions = _excelGetMaxTransitions();
    _excelRenderTabs();
    _excelRenderTable(_excelActiveTab);
    _excelUpdateWellCount();
    _excelDebouncedRefresh();
    if (typeof renderWellConfig === 'function') renderWellConfig();
    showToast('Studnia usunięta', 'info');
}

/* ===== GLOBALNA ODSWIEŻALKA — wołana z konfiguratora przy zmianie parametrów ===== */
window.refreshExcelFromConfig = function () {
    if (!document.getElementById('excel-table-overlay')) return; // modal zamknięty
    _excelRenderTable(_excelActiveTab);
};
