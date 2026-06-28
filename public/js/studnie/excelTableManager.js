// @ts-check
/* ===== EXCEL TABLE MANAGER — Tabela konfiguracyjna studni (Excel-style) ===== */

let _excelMaxTransitions = {}; /* per-tab: { '1000': 1, '1200': 1, ... } */
let _excelActiveTab = '1000';
let _excelCreatingLock = false;
let _excelRefreshTimer = null;
let _excelSelectedCols = [];
let _excelSelectedCells = []; // [{wIdx, colIdx}] — selekcja pojedynczych komórek
let _excelLastClickedCell = null; // {wIdx, colIdx} dla Shift+click zakresu
let _excelLastDataCol = -1; // ostatnia fokusowana kolumna (indeks td.children) dla strzałek do/z empty-row
let _excelDragState = null; // {anchor: {wIdx,colIdx}, mode: 'new'|'add'}
let _excelDragThrottle = null;
let _excelFocusOverlayEl = null; // globalny overlay div nad aktualnie fokusowaną komórką
let _excelFocusRaf = null; // throttling dla scroll/resize update
let _excelRowSelectStates = {}; // {wIdx: bool} — checkbox column state w Excelu
let _excelDirty = false;
let _excelFullscreen = false;
let _excelPollInterval = null;
let _excelLastClickedCol = -1;
let _excelColWidths = {};
let _excelAddingReliefPair = false;
let _excelUserEditing = false; /* blokuje polling gdy user edytuje komórkę */
let _excelAutoSelectEnabled = true; /* Przełącznik auto-doboru */

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
    }, 5000);
}

function _excelStopPolling() {
    if (_excelPollInterval) {
        clearInterval(_excelPollInterval);
        _excelPollInterval = null;
    }
}

function _excelDebouncedRefresh() {
    _excelMarkDirty();
    if (_excelRefreshTimer) clearTimeout(_excelRefreshTimer);
    _excelRefreshTimer = setTimeout(() => {
        _excelRefreshTimer = null;
        /* Tylko odśwież kody h3 — NIE refreshAll (zbyt wolne przy 50+ studniach) */
        _excelUpdateHeaderProdCodes();
    }, 800);
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
    var tab = typeof _excelActiveTab !== 'undefined' ? _excelActiveTab : '1000';
    var tabWells = typeof wells !== 'undefined' && Array.isArray(wells)
        ? wells.filter(function(w) { return _excelWellMatchesTab(w, tab); })
        : [];
    var max = tabWells.reduce(function(m, w) {
        return (w.przejscia && w.przejscia.length > m) ? w.przejscia.length : m;
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

    /* ===== SEKCJA REDUKCJI ===== */
    /* 11. Redukcja — elementy nadbudowy (tylko gdy któraś studnia w zakładce ma redukcję) */
    var hasRedTab = ['1200', '1500', '2000', '2500', 'styczne'].includes(String(dn));
    if (hasRedTab) {
        /* Sprawdź czy KTÓRAŚ studnia w zakładce ma redukcję */
        var anyRed = false;
        var tabWellsList = typeof wells !== 'undefined' ? wells.filter(function(w) {
            return (String(w.dn) === String(dn)) || ((dn === 'styczne') && w.dn === 'styczna');
        }) : [];
        for (var ri = 0; ri < tabWellsList.length; ri++) {
            if (tabWellsList[ri].redukcjaDN1000) { anyRed = true; break; }
        }
        var targetDns = [];
        if (anyRed) {
            targetDns.push(1000);
            if ([1500, 2000, 2500].includes(parseInt(String(dn))) || dn === 'styczne') {
                targetDns.push(1200);
            }
        }
        if (anyRed) {
            /* refWell: preferuj studnię Z redukcją — filterByWellParams może blokować płyty redukcyjne na studni bez redukcji */
            var refWell = null;
            for (var rwi = 0; rwi < tabWellsList.length; rwi++) {
                if (tabWellsList[rwi].redukcjaDN1000) { refWell = tabWellsList[rwi]; break; }
            }
            if (!refWell) refWell = well || (typeof wells !== 'undefined' && wells.length > 0 ? wells[0] : null);
            var mainDn = dn === 'styczne' ? (refWell && refWell.stycznaNadbudowa1200 ? 1200 : 1000) : parseInt(String(dn));
            var mainGroups = _excelGetComponentsForDn(String(mainDn), refWell);
            var allRedPlyta = (mainGroups['plyta_redukcyjna'] || []).filter(function(p) { return p.dn !== null; });

            targetDns.forEach(function(tDn) {
                /* Buduj Zestawy kolumn DLA KAŻDEGO tDn */
                var redGroups = _excelGetComponentsForDn(String(tDn), refWell);
                var redDnSpecific = {};
                Object.keys(redGroups).forEach(function(gk) {
                    redDnSpecific[gk] = redGroups[gk].filter(function(p) { return p.dn !== null; });
                });

                var dnPfx = targetDns.length > 1 ? tDn + '_' : '';
                var dnLbl = targetDns.length > 1 ? '(' + tDn + ') ' : '';

                /* Red. AVR */
                (redDnSpecific['avr'] || []).forEach(function(p) {
                    var nameShort = p.name.replace(/AVR\s*/i, '').trim() || p.id;
                    var lbl = _excelShortLabel(p.name || '', 'avr');
                    cols.push({
                        key: 'red_avr_' + dnPfx + p.id,
                        label: 'R.AVR ' + dnLbl + nameShort,
                        shortLabel: 'R.' + lbl.short,
                        detailLabel: lbl.detail,
                        type: 'number',
                        componentType: 'avr',
                        productId: p.id,
                        height: p.height,
                        fromReduction: true,
                        targetDn: tDn
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
                            key: 'red_konus_' + dnPfx + h,
                            label: 'R.' + lbl.short + ' ' + dnLbl + 'H=' + h,
                            shortLabel: 'R.' + lbl.short,
                            detailLabel: String(h),
                            type: 'number',
                            componentType: 'konus',
                            height: h,
                            products: matching,
                            fromReduction: true,
                            targetDn: tDn
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
                            var det = ct === 'pierscien_odciazajacy' ? '' : String(h);
                            cols.push({
                                key: 'red_' + ct + '_' + dnPfx + h + '_' + h,
                                label: 'R.' + (ct === 'plyta_din' ? 'Pł.DIN' : ct === 'plyta_najazdowa' ? 'Pł.najazd' : ct === 'plyta_zamykajaca' ? 'Pł.zamyk' : 'Pierśc.odc') + ' ' + dnLbl + 'H=' + h,
                                shortLabel: 'R.' + lbl.short,
                                detailLabel: det,
                                type: 'number',
                                componentType: ct,
                                height: h,
                                products: matching,
                                fromReduction: true,
                                targetDn: tDn
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
                            key: 'red_krag_' + dnPfx + h,
                            label: 'R.Krąg ' + dnLbl + 'H=' + h,
                            shortLabel: 'R.' + lbl.short,
                            detailLabel: lbl.detail,
                            type: 'number',
                            componentType: 'krag',
                            height: h,
                            products: matching,
                            fromReduction: true,
                            targetDn: tDn
                        });
                    }
                });
                /* Red. Osadniki (per produkt) */
                (redDnSpecific['osadnik'] || []).forEach(function(p) {
                    var lbl = _excelShortLabel(p.name || '', 'osadnik');
                    cols.push({
                        key: 'red_osadnik_' + dnPfx + p.id,
                        label: 'R.' + dnLbl + p.name,
                        shortLabel: 'R.' + lbl.short,
                        detailLabel: lbl.detail,
                        type: 'number',
                        componentType: 'osadnik',
                        productId: p.id,
                        height: p.height,
                        fromReduction: true,
                        targetDn: tDn
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
                            key: 'red_krag_ot_' + dnPfx + h,
                            label: 'R.Kr.OT ' + dnLbl + 'H=' + h,
                            shortLabel: 'R.' + lbl.short,
                            detailLabel: lbl.detail,
                            type: 'number',
                            componentType: 'krag_ot',
                            height: h,
                            products: matching,
                            fromReduction: true,
                            targetDn: tDn
                        });
                    }
                });
                /* R.Dennica */
                var rDennica = [...(redDnSpecific['dennica'] || [])].sort(function(a,b) { return (parseFloat(a.height)||0) - (parseFloat(b.height)||0); });
                var seenRDH = {};
                rDennica.forEach(function(p) {
                    var h = parseInt(p.height) || 0;
                    if (h > 0 && !seenRDH[h]) {
                        seenRDH[h] = true;
                        var matching = rDennica.filter(function(k) { return parseInt(k.height) === h; });
                        var lbl = _excelShortLabel(p.name || '', 'dennica');
                        cols.push({
                            key: 'red_dennica_' + dnPfx + h,
                            label: 'R.Dennica ' + dnLbl + 'H=' + h,
                            shortLabel: 'R.' + lbl.short,
                            detailLabel: lbl.detail,
                            type: 'number',
                            componentType: 'dennica',
                            height: h,
                            products: matching,
                            fromReduction: true,
                            targetDn: tDn
                        });
                    }
                });
            }); // koniec tDn loop

            /* Płyty redukcyjne — dodawane RAZ (niezależnie od targetDns, bo mają dn studni głównej) */
            allRedPlyta.forEach(function(p) {
                var lbl = _excelShortLabel(p.name || '', 'plyta_redukcyjna');
                cols.push({
                    key: 'red_plyta_red_' + p.id,
                    label: 'R.' + p.name,
                    shortLabel: 'R.' + lbl.short,
                    detailLabel: p.height ? String(p.height) : lbl.detail,
                    type: 'number',
                    componentType: 'plyta_redukcyjna',
                    productId: p.id,
                    height: p.height,
                    fromReduction: false, /* płyty redukcyjne mają dn studni głównej, nie targetu */
                    targetDn: null
                });
            });
        } /* koniec anyRed */
    } /* koniec hasRedTab */

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

    /* 5. Płyty redukcyjne — tylko gdy brak sekcji redukcji (bo wtedy są w sekcji R.*) */
    if (!hasRedTab || !anyRed) {
        const plytaRedProducts = groups['plyta_redukcyjna'] || [];
        plytaRedProducts.forEach((p) => {
            const lbl = _excelShortLabel(p.name || '', 'plyta_redukcyjna');
            cols.push({
                key: 'plyta_redukcyjna_' + p.id,
                label: p.name,
                shortLabel: lbl.short,
                detailLabel: p.height ? String(p.height) : lbl.detail,
                type: 'number',
                componentType: 'plyta_redukcyjna',
                productId: p.id,
                height: p.height
            });
        });
    }

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

    /* ===== NOWE: Uszczelki ===== */
    /* R.Uszczelki — dla każdego targetDn (tylko gdy redukcja aktywna) */
    var hasRedTabU = ['1200', '1500', '2000', '2500', 'styczne'].includes(String(dn));
    if (hasRedTabU) {
        var anyRedU = false;
        var tabWellsListU = typeof wells !== 'undefined' ? wells.filter(function(w) {
            return (String(w.dn) === String(dn)) || ((dn === 'styczne') && w.dn === 'styczna');
        }) : [];
        for (var riU = 0; riU < tabWellsListU.length; riU++) {
            if (tabWellsListU[riU].redukcjaDN1000) { anyRedU = true; break; }
        }
        if (anyRedU) {
            var refWellU = null;
            for (var rwiU = 0; rwiU < tabWellsListU.length; rwiU++) {
                if (tabWellsListU[rwiU].redukcjaDN1000) { refWellU = tabWellsListU[rwiU]; break; }
            }
            if (!refWellU) refWellU = well || (typeof wells !== 'undefined' && wells.length > 0 ? wells[0] : null);
            var targetDnsU = [1000];
            if ([1500, 2000, 2500].includes(parseInt(String(dn))) || dn === 'styczne') {
                targetDnsU.push(1200);
            }
            targetDnsU.forEach(function(tDn) {
                var redGroupsU = _excelGetComponentsForDn(String(tDn), refWellU);
                var uszczProductsU = redGroupsU['uszczelka'] || [];
                if (typeof filterSealsByWellType === 'function') {
                    uszczProductsU = filterSealsByWellType(uszczProductsU, refWellU);
                }
                var dnPfxU = targetDnsU.length > 1 ? tDn + '_' : '';
                var dnLblU = targetDnsU.length > 1 ? '(' + tDn + ') ' : '';
                uszczProductsU.forEach(function(p) {
                    var lbl = _excelShortLabel(p.name || '', 'uszczelka');
                    cols.push({
                        key: 'red_uszczelka_' + dnPfxU + p.id,
                        label: 'R.' + dnLblU + p.name,
                        shortLabel: 'R.' + lbl.short,
                        detailLabel: lbl.detail,
                        type: 'number',
                        componentType: 'uszczelka',
                        productId: p.id,
                        height: p.height,
                        fromReduction: true,
                        targetDn: tDn
                    });
                });
            });
        }
    }
    /* Main Uszczelki — per-product (jak R.Uszczelki, dla głównego DN) */
    var mainUszczProducts = groups['uszczelka'] || [];
    if (typeof filterSealsByWellType === 'function') {
        mainUszczProducts = filterSealsByWellType(mainUszczProducts, well);
    }
    mainUszczProducts.forEach(function(p) {
        var lbl = _excelShortLabel(p.name || '', 'uszczelka');
        cols.push({
            key: 'uszczelka_' + p.id,
            label: p.name,
            shortLabel: lbl.short,
            detailLabel: lbl.detail,
            type: 'number',
            componentType: 'uszczelka',
            productId: p.id,
            height: p.height
        });
    });

    return cols;
}

/* ===== SHORT LABEL GENERATOR ===== */
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

/* Bezpieczne porównanie wysokości — obsługa null/undefined/'null' */
function _excelSafeHeightMatch(pHeight, h) {
    if (h === undefined || h === null || h === '' || h === 'null') return true;
    if (pHeight === undefined || pHeight === null) return false;
    var ph = parseInt(pHeight);
    var hh = parseInt(h);
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
    var filterDn = (targetDn !== undefined && targetDn !== null) ? targetDn : well.dn;
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
    var key = item.productId;
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
function _excelGetWellProdCode(well, ct, height, targetDn) {
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
        var avail = getAvailableProducts(well).filter(function(p) {
            try { return filterByWellParams(p, well); } catch (e) { return true; }
        });
        var fallback = avail.filter(function(p) { return p.componentType === ct; });
        if (height !== undefined && height !== null && height !== '') {
            fallback = fallback.filter(function(p) { return parseInt(p.height) === parseInt(height); });
        }
        /* Dla kolumn redukcji: preferuj produkt pasujący do targetDn */
        if (targetDn !== undefined && targetDn !== null) {
            var dnMatch = fallback.filter(function(p) { return p.dn !== null && parseInt(p.dn) === parseInt(targetDn); });
            if (dnMatch.length > 0) return dnMatch[0].id;
            var univ = fallback.filter(function(p) { return p.dn === null; });
            if (univ.length > 0) return univ[0].id;
            return null;
        }
        /* Main column: preferuj produkty dla DN studni, potem uniwersalne */
        var mainMatch = fallback.filter(function(p) { return p.dn !== null && parseInt(p.dn) === parseInt(well.dn); });
        if (mainMatch.length > 0) return mainMatch[0].id;
        var mainUniv = fallback.filter(function(p) { return p.dn === null; });
        return mainUniv.length > 0 ? mainUniv[0].id : null;
        return null; /* nie pokazuj kodu z innego DN */
    }
    return null;
}

/* ===== Cena elementu w h3 — per sztuka, zgodnie z getItemAssessedPrice ===== */
function _excelGetWellProdPrice(well, ct, height, targetDn) {
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
        /* Dla kolumn redukcji: produkt musi pasować do targetDn */
        if (targetDn !== undefined && targetDn !== null) {
            if (resolved.dn !== null && parseInt(resolved.dn) !== parseInt(targetDn)) continue;
        } else {
            /* Main column: preferuj produkt dla DN studni */
            if (resolved.dn !== null && parseInt(resolved.dn) !== parseInt(well.dn)) continue;
        }
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
        var fallback = avail.filter(function(p) {
            return p.componentType === ct
                && (height === undefined || height === null || height === ''
                    || parseInt(p.height) === parseInt(height));
        });
        /* Dla kolumn redukcji: preferuj produkt pasujący do targetDn */
        var matchedFallback = null;
        if (targetDn !== undefined && targetDn !== null) {
            var dnMatch = fallback.filter(function(p) { return p.dn !== null && parseInt(p.dn) === parseInt(targetDn); });
            if (dnMatch.length > 0) matchedFallback = dnMatch[0];
            else {
                var univ = fallback.filter(function(p) { return p.dn === null; });
                if (univ.length > 0) matchedFallback = univ[0];
            }
        } else {
            /* Main column: preferuj produkty dla DN studni, potem uniwersalne */
            var mainMatch = fallback.filter(function(p) { return p.dn !== null && parseInt(p.dn) === parseInt(well.dn); });
            if (mainMatch.length > 0) matchedFallback = mainMatch[0];
            else {
                var mainUniv = fallback.filter(function(p) { return p.dn === null; });
                if (mainUniv.length > 0) matchedFallback = mainUniv[0];
            }
        }
        if (matchedFallback) {
            var price = typeof getItemAssessedPrice === 'function'
                ? getItemAssessedPrice(well, matchedFallback, true, null)
                : (matchedFallback.price || 0);
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
    /* Użyj pierwszej studni z AKTYWNEJ zakładki, nie globalnej currentWellIndex */
    var tabWell = null;
    if (typeof _excelActiveTab !== 'undefined' && _excelActiveTab && typeof wells !== 'undefined') {
        for (var i = 0; i < wells.length; i++) {
            if (_excelWellMatchesTab(wells[i], _excelActiveTab)) {
                tabWell = wells[i];
                break;
            }
        }
    }
    var well = (typeof currentWellIndex !== 'undefined' && currentWellIndex >= 0 ? wells[currentWellIndex] : null) || tabWell;
    codes.forEach(function(span, idx) {
        var isPerProduct = span.getAttribute('data-per-product') === '1';
        var ct = span.getAttribute('data-ct');
        var height = span.getAttribute('data-height');
        var redTarget = (span.getAttribute('data-reddn') || '') ? (well && (well.redukcjaTargetDN || parseInt(span.getAttribute('data-reddn')) || 1000)) : null;
        if (isPerProduct) {
            /* Kolumny per-produkt: kod stały, ale cenę trzeba odświeżyć */
            if (prices && prices[idx]) {
                var ppid = span.textContent && span.textContent.trim();
                if (ppid) {
                    var _prod = (typeof studnieProducts !== 'undefined' ? studnieProducts : []).find(function(pr) { return pr.id === ppid; });
                    if (_prod && _prod.price) {
                        var _fmt = typeof fmtInt === 'function' ? fmtInt : function(n) { return Math.round(n || 0).toLocaleString('pl-PL'); };
                        prices[idx].textContent = _fmt(_prod.price) + ' PLN';
                    }
                }
            }
            return;
        }
        var pid = well ? _excelGetWellProdCode(well, ct, height, redTarget) : null;
        span.textContent = pid !== null && pid !== undefined ? pid : '';
        /* Aktualizuj cenę w tym samym indeksie */
        if (prices && prices[idx]) {
            prices[idx].textContent = pid ? (_excelGetWellProdPrice(well, ct, height, redTarget) || '') : '';
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
    return `background:#13151f;border:1px solid rgba(255,255,255,0.08);border-radius:2px;color:var(--text-primary);${_EXCEL_FONT}text-align:right;outline:none;transition:border-color 0.15s,background 0.15s;`;
}

/* ===== OVERLAY SELECT ===== */
function _excelOverlaySelectHtml(opts, curVal, onChange, width) {
    var label = '';
    for (var i = 0; i < opts.length; i++) {
        if (opts[i][0] === curVal) { label = opts[i][1]; break; }
    }
    var optHtml = '';
    for (var i = 0; i < opts.length; i++) {
        optHtml += '<option value="' + (opts[i][0] || '').replace(/"/g, '&quot;') + '"' + (opts[i][0] === curVal ? ' selected' : '') + '>' + opts[i][1] + '</option>';
    }
    var escOnCh = onChange.replace(/"/g, '&quot;');
    return '<div class="excel-sel-wrap" tabindex="0" style="display:inline-flex;position:relative;width:auto;min-width:40px;outline:none;' + (width ? 'width:' + width + 'px;' : '') + '"'
        + ' onfocus="excelCellFocus(this);_excelSelWrapFocus(this)" onblur="excelCellBlur(this)" onkeydown="if(event.key===\'Enter\'||event.key===\' \'){event.preventDefault();var s=this.querySelector(\'select\');if(typeof s.showPicker===\'function\'){s.showPicker()}else{s.focus();s.click()}}">'
        + '<select style="position:absolute;inset:0;width:100%;height:100%;opacity:0;cursor:pointer;z-index:2;" tabindex="-1"'
        + ' onchange="' + escOnCh + ';this.nextElementSibling.textContent=this.options[this.selectedIndex].text">'
        + optHtml + '</select>'
        + '<div style="pointer-events:none;background:#13151f;border:1px solid rgba(255,255,255,0.08);border-radius:2px;padding:0.2rem 0.3rem;font-size:0.6rem;color:#e2e8f0;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;text-align:left;width:100%;">' + (label || '&mdash;') + '</div>'
        + '</div>';
}

/* ===== OVERLAY POSITIONING ===== */
function _excelPositionOverlay(overlay) {
    if (!overlay) return;
    if (_excelFullscreen) {
        overlay.style.cssText = 'position:fixed;inset:0;z-index:10000;background:rgba(0,0,0,0.75);backdrop-filter:blur(6px);display:flex;align-items:center;justify-content:center;';
        return;
    }
    const diagramPanel = document.querySelector('.well-diagram-panel');
    const isVisible = diagramPanel && diagramPanel.offsetParent !== null;
    if (isVisible) {
        const diaRect = diagramPanel.getBoundingClientRect();
        const topBar = document.querySelector('header') || document.querySelector('.header');
        const bottomBar = document.getElementById('offer-summary-footer-fixed');
        const topOffset = topBar ? topBar.getBoundingClientRect().bottom : diaRect.top;
        const bottomOffset = (bottomBar && bottomBar.offsetHeight > 0) ? bottomBar.getBoundingClientRect().top : (diaRect.top + diaRect.height);
        const h = Math.max(bottomOffset - topOffset, 100);
        overlay.style.cssText = `position:fixed;top:${topOffset}px;left:${diaRect.right}px;width:calc(100vw - ${diaRect.right}px);min-width:400px;height:${h}px;z-index:10000;background:rgba(0,0,0,0.75);backdrop-filter:blur(6px);display:flex;align-items:center;justify-content:center;`;
    } else {
        overlay.style.cssText = 'position:fixed;inset:0;z-index:10000;background:rgba(0,0,0,0.75);backdrop-filter:blur(6px);display:flex;align-items:center;justify-content:center;';
    }
}

function excelToggleFullscreen() {
    _excelFullscreen = !_excelFullscreen;
    const overlay = document.getElementById('excel-table-overlay');
    _excelPositionOverlay(overlay);
    var btn = document.getElementById('excel-fs-btn');
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
    rows.forEach(function(row) {
        if (!q) {
            row.style.display = '';
            return;
        }
        /* Najpierw szukaj inputa — dopiero potem fallback do TD */
        var nameInp = row.querySelector('td:nth-child(2) input');
        var name = nameInp ? nameInp.value : (row.querySelector('td:nth-child(2)') || {}).textContent || '';
        name = (name || '').toLowerCase();
        row.style.display = name.indexOf(q) >= 0 ? '' : 'none';
    });
}

/* ===== OPEN MODAL ===== */
function openExcelTableModal() {
    if (typeof wells === 'undefined' || !Array.isArray(wells)) {
        window.wells = [];
    }

    /* Wyczyść puste przejścia przy otwarciu (PRZED obliczeniem maxTr) */
    if (typeof wells !== 'undefined') {
        for (var _rwo = 0; _rwo < wells.length; _rwo++) {
            _excelCleanEmptyPrzejscia(wells[_rwo]);
        }
    }

    /* Inicjalizuj _excelMaxTransitions dla WSZYSTKICH zakładek */
    var _allTabs = ['1000', '1200', '1500', '2000', '2500', 'styczne'];
    _allTabs.forEach(function(t) {
        var _tw = (typeof wells !== 'undefined' && Array.isArray(wells))
            ? wells.filter(function(w) { return _excelWellMatchesTab(w, t); })
            : [];
        var _tm = _tw.reduce(function(m, w) {
            return (w.przejscia && w.przejscia.length > m) ? w.przejscia.length : m;
        }, 0);
        _excelMaxTransitions[t] = Math.max(1, _tm);
    });

    /* Zainicjuj stan — brak zmian */
    _excelDirty = false;

    const existing = document.getElementById('excel-table-overlay');
    if (existing) {
        /* Wyczyść stary capture handler przed usunięciem overlay */
        var _oldContainer = document.getElementById('excel-table-container');
        if (_oldContainer && /** @type {any} */ (_oldContainer)._arrowHandler) {
            document.removeEventListener('keydown', /** @type {any} */ (_oldContainer)._arrowHandler, true);
        }
        /* Wyczyść stary capture paste handler */
        if (_oldContainer) {
            _oldContainer.removeEventListener('paste', _excelHandlePaste, true);
        }
        existing.remove();
    }

    const overlay = document.createElement('div');
    overlay.id = 'excel-table-overlay';
    overlay.setAttribute('role', 'dialog');
    overlay.setAttribute('aria-modal', 'true');
    overlay.setAttribute('aria-label', 'Tabela konfiguracyjna studni');

    // Pozycjonuj overlay między górnym banerem a dolnym paskiem, przylegający do lewego panelu
    _excelPositionOverlay(overlay);

    overlay.addEventListener('click', (e) => {
        if (e.target === overlay) closeExcelTableModal();
    });
    overlay.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') closeExcelTableModal();
    });

    /* Nasłuchuj resize — odśwież pozycjonowanie */
    var _resizeHandler = function() { _excelPositionOverlay(overlay); };
    window.addEventListener('resize', _resizeHandler);
    /* Zapisz handler do usunięcia przy close */
    /** @type {any} */ (overlay)._resizeHandler = _resizeHandler;

    const diagramPanel = document.querySelector('.well-diagram-panel');
    const isDiagramVisible = diagramPanel && diagramPanel.offsetParent !== null;
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
            #excel-table-container td:focus-within { box-shadow:inset 0 0 0 1px rgba(99,102,241,0.25) !important; }
            #excel-table-container td.excel-col-selected { outline:2px solid rgba(99,102,241,0.3); outline-offset:-2px; }
            #excel-table-container td.excel-col-selected .excel-sel-wrap { outline:inherit; outline-offset:-2px; }
            #excel-table-container td.cell-selected { outline:2px solid rgba(99,102,241,0.5); outline-offset:-2px; background:rgba(99,102,241,0.06); }
            #excel-table-container td.cell-selected .excel-sel-wrap { outline:inherit; outline-offset:-2px; }
            #excel-table-container td.drag-preview { outline:2px dashed rgba(99,102,241,0.5); outline-offset:-2px; background:rgba(99,102,241,0.03); }
            #excel-table-container td.drag-preview .excel-sel-wrap { outline:inherit; outline-offset:-2px; }
            #excel-table-container th.excel-col-selected { background:rgba(99,102,241,0.25) !important; box-shadow:inset 0 0 0 1px rgba(99,102,241,0.35); }
            #excel-table-container .h3-prodcode { font-size:0.5rem;font-weight:600;color:#a4b3cb;line-height:1.45; }
            #excel-table-container .h3-prodprice { font-size:0.55rem;color:#34d399;font-weight:700;line-height:1.4;white-space:nowrap;background:rgba(52,211,153,0.07);border-radius:3px;padding:1px 5px;margin-top:2px;display:inline-block; }
            #excel-table-container tbody tr:hover { background:rgba(255,255,255,0.02); }
            #excel-table-container .excel-resize-handle { width:4px !important;background:rgba(255,255,255,0.08); }
            #excel-table-container .excel-resize-handle:hover { background:rgba(99,102,241,0.5) !important; }
            #excel-table-container thead { position:sticky;top:0;z-index:50;background:#161923;isolation:isolate; }
        </style>
        <div style="display:flex;align-items:center;justify-content:space-between;padding:0.45rem 0.8rem;background:#10131a;border-bottom:1px solid rgba(255,255,255,0.06);flex-shrink:0;">
            <div style="display:flex;align-items:center;gap:0.6rem;">
                <i data-lucide="table" style="width:16px;height:16px;color:#10b981;"></i>
                <span style="font-size:0.75rem;font-weight:700;color:#e2e8f0;letter-spacing:0.3px;">Tabela konfiguracyjna</span>
                <span id="excel-well-count" style="font-size:0.6rem;color:#64748b;padding:0.1rem 0.5rem;background:rgba(255,255,255,0.04);border-radius:3px;"></span>
            </div>
            <div style="display:flex;gap:0.4rem;align-items:center;">
                <div style="position:relative;" id="excel-add-menu-container">
                    <button onclick="_excelToggleAddMenu()" id="excel-add-btn" title="Dodaj studnię do bieżącej zakładki" style="background:rgba(59,130,246,0.15);color:#93c5fd;border:1px solid rgba(59,130,246,0.25);padding:0.3rem 0.7rem;border-radius:3px;font-size:0.65rem;font-weight:600;cursor:pointer;display:flex;align-items:center;gap:0.3rem;"><i data-lucide="plus" style="width:12px;height:12px;"></i> + Dodaj</button>
                    <div id="excel-add-dropdown" style="display:none;position:absolute;top:100%;left:0;margin-top:4px;background:#161923;border:1px solid rgba(255,255,255,0.1);border-radius:4px;padding:0.4rem;z-index:100;min-width:180px;box-shadow:0 8px 24px rgba(0,0,0,0.4);">
                        <label style="display:flex;align-items:center;gap:0.4rem;padding:0.3rem 0.4rem;font-size:0.65rem;color:#94a3b8;cursor:pointer;white-space:nowrap;border-bottom:1px solid rgba(255,255,255,0.05);margin-bottom:0.3rem;">
                            <input type="checkbox" id="excel-auto-select-check" ${_excelAutoSelectEnabled ? 'checked' : ''} onchange="_excelAutoSelectEnabled=this.checked;window._excelAutoSelectEnabled=this.checked" style="accent-color:#6366f1;cursor:pointer;" />
                            Auto-dobór
                        </label>
                        <button onclick="excelAddWellToTab();_excelToggleAddMenu()" style="display:block;width:100%;text-align:left;background:rgba(59,130,246,0.1);color:#93c5fd;border:none;padding:0.3rem 0.5rem;border-radius:3px;font-size:0.65rem;cursor:pointer;font-weight:500;margin-bottom:2px;transition:background 0.1s;" onmouseenter="this.style.background='rgba(59,130,246,0.2)'" onmouseleave="this.style.background='rgba(59,130,246,0.1)'">Szybko (puste)</button>
                        <button onclick="excelShowAddDialog();_excelToggleAddMenu()" style="display:block;width:100%;text-align:left;background:rgba(255,255,255,0.04);color:#e2e8f0;border:none;padding:0.3rem 0.5rem;border-radius:3px;font-size:0.65rem;cursor:pointer;font-weight:500;margin-bottom:2px;transition:background 0.1s;" onmouseenter="this.style.background='rgba(255,255,255,0.08)'" onmouseleave="this.style.background='rgba(255,255,255,0.04)'">Ręcznie (parametry)</button>
                        <button onclick="excelShowPasteDialog();_excelToggleAddMenu()" style="display:block;width:100%;text-align:left;background:rgba(255,255,255,0.04);color:#e2e8f0;border:none;padding:0.3rem 0.5rem;border-radius:3px;font-size:0.65rem;cursor:pointer;font-weight:500;transition:background 0.1s;" onmouseenter="this.style.background='rgba(255,255,255,0.08)'" onmouseleave="this.style.background='rgba(255,255,255,0.04)'">Wklej listę</button>
                    </div>
                </div>
                <input type="text" id="excel-search-input" placeholder="Szukaj studni..." oninput="excelFilterWells(this.value)" style="background:#13151f;border:1px solid rgba(255,255,255,0.08);border-radius:3px;padding:0.25rem 0.4rem;font-size:0.6rem;color:#e2e8f0;outline:none;width:100px;" />
                <button onclick="excelToggleFullscreen()" id="excel-fs-btn" title="Pełny ekran / okno" style="background:rgba(99,102,241,0.1);color:#a5b4fc;border:1px solid rgba(99,102,241,0.15);padding:0.25rem 0.5rem;border-radius:3px;font-size:0.6rem;font-weight:600;cursor:pointer;">Pełny</button>
                <button onclick="excelSaveAll()" id="excel-save-btn" title="Zapisz wszystkie zmiany i zamknij" style="background:rgba(16,185,129,0.15);color:#6ee7b7;border:1px solid rgba(16,185,129,0.3);padding:0.3rem 0.9rem;border-radius:3px;font-size:0.65rem;font-weight:700;cursor:pointer;">Gotowe (Zapisz)</button>
                <button onclick="closeExcelTableModal()" title="Zamknij bez zapisywania" style="background:rgba(239,68,68,0.1);color:#fca5a5;border:1px solid rgba(239,68,68,0.2);padding:0.3rem 0.7rem;border-radius:3px;font-size:0.65rem;font-weight:600;cursor:pointer;">✕</button>
            </div>
        </div>
        <div id="excel-tabs" style="display:flex;gap:0;padding:0;background:#10131a;border-bottom:1px solid rgba(255,255,255,0.06);flex-shrink:0;"></div>
        <div id="excel-table-container" style="flex:1;overflow:auto;background:#0c0e14;"></div>
    `;

    overlay.appendChild(modal);
    document.body.appendChild(overlay);

    // Delegowany klik na wiersze — bardziej niezawodny niż inline onclick
    const container = document.getElementById('excel-table-container');
    if (container && !/** @type {any} */ (container)._excelListenersAttached) {
        /** @type {any} */ (container)._excelListenersAttached = true;
        /* Capture phase — przechwytuje strzałki ZANIM input/select je przetworzy */
        var _arrowHandler = function(e) {
            var tgt = e.target;
            if (!tgt || !container.contains(tgt)) return;
            if (!e.key.startsWith('Arrow')) return;
            e.stopPropagation();
            e.stopImmediatePropagation();
            e.preventDefault();
            _excelHandleArrow(e);
        };
        document.addEventListener('keydown', _arrowHandler, true);
        /** @type {any} */ (container)._arrowHandler = _arrowHandler;
        /* Delegowany focusin — aktywuje wiersz dla każdego elementu który dostanie focus */
        container.addEventListener('focusin', function(e) {
            var row = e.target.closest('tr[data-widx]');
            if (!row) return;
            var wIdx = parseInt(row.getAttribute('data-widx'), 10);
            if (!isNaN(wIdx) && (typeof currentWellIndex === 'undefined' || wIdx !== currentWellIndex)) {
                excelSelectRow(wIdx);
            }
        });
        /* Delegowany klik — excel-like cell selection */
        container.addEventListener('click', function(e) {
            if (e.target.closest('button')) return;
            var td = e.target.closest('td');
            var row = e.target.closest('tr[data-widx]');
            if (!row || !td) return;
            var wIdx = parseInt(row.getAttribute('data-widx'), 10);
            if (isNaN(wIdx)) return;
            var colIdx = Array.from(row.children).indexOf(td);
            /* Shift+click = zakres */
            if (e.shiftKey) {
                e.stopPropagation();
                _excelSelectCell(wIdx, colIdx, false, true);
                return;
            }
            /* Ctrl+click = toggle */
            if (e.ctrlKey) {
                e.stopPropagation();
                _excelSelectCell(wIdx, colIdx, true, false);
                return;
            }
            /* Zwykły klik = zaznacz komórkę + wiersz */
            _excelSelectCell(wIdx, colIdx, false, false);
            if (typeof currentWellIndex === 'undefined' || wIdx !== currentWellIndex) {
                excelSelectRow(wIdx);
            }
        });
        /* Bind copy na document, paste z capture na kontenerze */
        document.addEventListener('copy', _excelHandleCopy);
        /* useCapture=true: wychwytuje event ZANIM dotrze do inputów w tabeli */
        container.addEventListener('paste', _excelHandlePaste, true);
        /* Bind keydown dla skrótów */
        container.addEventListener('keydown', _excelHandleKeydown);
        /* Checkbox column change listener */
        container.addEventListener('change', _excelOnRowSelectChange);
        /* Drag-selection: mousedown + mousemove + mouseup */
        container.addEventListener('mousedown', _excelOnMouseDown);
        document.addEventListener('mousemove', _excelOnMouseMove);
        document.addEventListener('mouseup', _excelOnMouseUp);
        /* Focus overlay - singleton div podążający za aktualnie fokusowaną komórką */
        if (!document.getElementById('excel-focus-overlay')) {
            var ov = document.createElement('div');
            ov.id = 'excel-focus-overlay';
            ov.style.cssText = 'position:fixed;pointer-events:none;z-index:99998;border:2px solid rgba(99,102,241,0.6);border-radius:3px;box-sizing:border-box;display:none;transition:all 0.1s ease;box-shadow:0 0 0 1px rgba(0,0,0,0.3);';
            document.body.appendChild(ov);
            _excelFocusOverlayEl = ov;
        } else {
            _excelFocusOverlayEl = document.getElementById('excel-focus-overlay');
            _excelFocusOverlayEl.style.display = 'none';
        }
        container.addEventListener('focusin', _excelOnFocusIn);
        container.addEventListener('focusout', _excelOnFocusOut);
        document.addEventListener('scroll', _excelOnOverlayScroll, true);
        window.addEventListener('resize', _excelOnOverlayScroll);
    }

    _excelActiveTab = DN_TABS[0];
    _excelRenderTabs();
    _excelRenderTable(_excelActiveTab);
    /* Nie zaznaczaj żadnego wiersza przy otwarciu — usuń aktywny styl z pierwszej studni */
    if (typeof currentWellIndex !== 'undefined' && currentWellIndex >= 0) {
        var firstRow = document.querySelector('#excel-table-container tr[data-widx="' + currentWellIndex + '"]');
        if (firstRow) {
            var baseRef = firstRow.getAttribute('data-base-bg');
            if (baseRef) {
                firstRow.style.background = baseRef;
                firstRow.setAttribute('data-orig-bg', baseRef);
                /* Przywróć tło sticky kolumn */
                var stTds = firstRow.querySelectorAll('td:nth-child(-n+5)');
                stTds.forEach(function(td) { td.style.background = baseRef; });
            }
        }
        currentWellIndex = -1;
    }
    _excelStopPolling();
    _excelStartPolling();
    _excelUpdateWellCount();
    /* Migracja autoSelect - wszystkie istniejace studnie dostaja default true */
    if (typeof wells !== 'undefined') {
        wells.forEach(function(w) {
            if (w && typeof w.autoSelect === 'undefined') w.autoSelect = true;
        });
    }
    _excelUpdateBulkButtons();

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
            /* Przywróć tło sticky kolumn do base-bg */
            var prevStickyTds = prevRow.querySelectorAll('td:nth-child(-n+5)');
            var baseBg = prevRow.getAttribute('data-base-bg') || '#0a0d16';
            prevStickyTds.forEach(function(td) { td.style.background = baseBg; });
        }
    }

    // Zaznacz nowy aktywny wiersz - tylko tło, zero ramek
    const newRow = container.querySelector(`tr[data-widx="${wIdx}"]`);
    if (newRow) {
        const activeBg = newRow.getAttribute('data-active-bg');
        if (activeBg) {
            newRow.style.background = activeBg;
            newRow.setAttribute('data-orig-bg', activeBg);
            /* Zaktualizuj tło sticky kolumn (Lp, NrStudni, RzWlazu, RzDna, Wys) */
            var stickyTds = newRow.querySelectorAll('td:nth-child(-n+5)');
            stickyTds.forEach(function(td) { td.style.background = activeBg; });
        }
    }

    _excelUpdateLeftPreview(wIdx);
    /* Aktualizuj h3 — kody produktów ZALEŻĄ od zaznaczonej studni */
    _excelUpdateHeaderProdCodes();
}

/* ===== CLOSE ===== */
function closeExcelTableModal() {
    if (_excelDirty && typeof appConfirm === 'function') {
        if (!appConfirm('Są niezapisane zmiany. Czy na pewno zamknąć?')) return;
    }
    _excelStopPolling();
    const overlay = document.getElementById('excel-table-overlay');
    if (overlay) {
        /* Usuń handler resize */
        if (/** @type {any} */ (overlay)._resizeHandler) {
            window.removeEventListener('resize', /** @type {any} */ (overlay)._resizeHandler);
        }
        /* Usuń handler strzałek (capture phase) */
        var _container = document.getElementById('excel-table-container');
        if (_container && /** @type {any} */ (_container)._arrowHandler) {
            document.removeEventListener('keydown', /** @type {any} */ (_container)._arrowHandler, true);
        }
        /* Usuń globalne handlery copy/paste */
        document.removeEventListener('copy', _excelHandleCopy);
        document.removeEventListener('paste', _excelHandlePaste);
        if (_container) _container.removeEventListener('paste', _excelHandlePaste, true);
        /* Drag-selection cleanup */
        if (_container) _container.removeEventListener('mousedown', _excelOnMouseDown);
        document.removeEventListener('mousemove', _excelOnMouseMove);
        document.removeEventListener('mouseup', _excelOnMouseUp);
        /* Focus overlay cleanup */
        if (_container) {
            _container.removeEventListener('focusin', _excelOnFocusIn);
            _container.removeEventListener('focusout', _excelOnFocusOut);
            _container.removeEventListener('change', _excelOnRowSelectChange);
        }
        document.removeEventListener('scroll', _excelOnOverlayScroll, true);
        window.removeEventListener('resize', _excelOnOverlayScroll);
        if (_excelFocusOverlayEl) _excelFocusOverlayEl.style.display = 'none';
        overlay.remove();
    }
    _excelDirty = false;
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
    _excelUpdateHeaderProdCodes();
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
    _excelMaxTransitions[_excelActiveTab] = _excelGetMaxTransitions();
    _excelRenderTabs();
    _excelRenderTable(_excelActiveTab);
    _excelUpdateWellCount();
    const newWIdx = wells.length - 1;
    setTimeout(() => excelSelectRow(newWIdx), 50);
    _excelDebouncedRefresh();
    showToast('Dodano: ' + well.name, 'success');
}

/* ===== EXCEL AUTO-DOBÓR ===== */
async function _excelAutoSelectForWell(wIdx) {
    const well = wells[wIdx];
    if (!well) return;
    if (well.rzednaWlazu == null || well.rzednaDna == null) return;
    if (well.autoSelect === false) return; /* Manual skip */
    if (typeof autoSelectComponents !== 'function') return;
    var savedIdx = typeof currentWellIndex !== 'undefined' ? currentWellIndex : -1;
    try {
        currentWellIndex = wIdx;
        await autoSelectComponents(true);
        _excelClearResCache(well);
        _excelRenderTable(_excelActiveTab);
        _excelUpdateHeaderProdCodes();
    } finally {
        if (savedIdx >= 0) currentWellIndex = savedIdx;
    }
}

/* ===== TABLE RENDER (Excel-style) ===== */
function _excelRenderTable(dn) {
    const container = document.getElementById('excel-table-container');
    if (!container) return;

    // Zapisz aktualny fokus przed re-renderem
    let savedFocus = null;
    const activeEl = document.activeElement;
    if (activeEl && container.contains(activeEl)) {
        const tr = activeEl.closest('tr');
        if (tr) {
            const wIdx = tr.getAttribute('data-widx');
            if (wIdx !== null) {
                // Spróbuj zidentyfikować po atrybucie data-field (dla INPUT)
                const field = activeEl.getAttribute('data-field');
                // Jeśli to select wrapper (DIV), to ma data-field na wewnętrznym select lub divie?
                // Sprawdźmy po prostu indeks elementu w wierszu dla uniwersalności
                const navEls = _excelGetNavElements(tr);
                const colIdx = navEls.indexOf(activeEl);
                savedFocus = {
                    wIdx: parseInt(wIdx),
                    field: field,
                    colIdx: colIdx
                };
            }
        }
    }

    /* Wyczyść puste przejścia we wszystkich studniach */
    if (typeof wells !== 'undefined') {
        for (var _rwi = 0; _rwi < wells.length; _rwi++) {
            _excelCleanEmptyPrzejscia(wells[_rwi]);
        }
    }

    const tabWells = wells.filter((w) => _excelWellMatchesTab(w, dn));
    const maxTr = _excelMaxTransitions[dn] || 1;
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
        'padding:0.2rem 0.5rem;font-size:0.6rem;font-weight:400;white-space:pre-wrap;word-break:break-word;max-width:100px;line-height:1.3;';
    const th3Base =
        'padding:0.1rem 0.5rem;font-size:0.55rem;font-weight:500;color:#64748b;text-align:center;white-space:nowrap;background:#161923;';

    const dnLabel = dn === 'styczne' ? 'Styczne' : 'DN' + dn;
    const dnTh3 = (ct) => (ct === 'avr' ? 'uniw.' : dnLabel);

    /* === KOLUMNA 0: Checkbox (select-all) — nie sticky === */
    h3 += `<th style="${th3Base}background:#161923;color:#94a3b8;text-align:center;width:28px;border-right:1px solid rgba(255,255,255,0.06);">` +
          `<input type="checkbox" id="excel-select-all" onchange="_excelToggleSelectAll(this.checked)" tabindex="-1" style="cursor:pointer;accent-color:rgba(99,102,241,0.7);" />` +
          `</th>`;
    h2 += `<th style="${th2Base}background:#161923;color:#94a3b8;text-align:center;width:28px;border-right:1px solid rgba(255,255,255,0.06);">·</th>`;
    h1 += `<th style="${thBase}background:#161923;color:#94a3b8;text-align:center;width:28px;border-right:1px solid rgba(255,255,255,0.06);"></th>`;
    /* === KOLUMNA 1: Tryb Auto/Manual — nie sticky === */
    var _bulkAutoBtn = `<button type="button" id="excel-bulk-auto" onclick="_excelBulkSetMode(true)" style="background:rgba(99,102,241,0.15);border:1px solid rgba(99,102,241,0.3);color:#c7d2fe;padding:2px 6px;border-radius:3px;cursor:pointer;font-size:0.6rem;font-weight:600;width:44px;">Auto (0)</button>`;
    var _bulkManualBtn = `<button type="button" id="excel-bulk-manual" onclick="_excelBulkSetMode(false)" style="background:rgba(245,158,11,0.15);border:1px solid rgba(245,158,11,0.3);color:#fbbf24;padding:2px 6px;border-radius:3px;cursor:pointer;font-size:0.6rem;font-weight:600;width:44px;">Manual (0)</button>`;
    h1 += `<th style="${thBase}background:#161923;color:#94a3b8;text-align:center;width:54px;padding:2px;border-right:1px solid rgba(255,255,255,0.06);"><div style="display:flex;gap:3px;justify-content:center;">${_bulkAutoBtn}${_bulkManualBtn}</div></th>`;
    h2 += `<th style="${th2Base}background:#161923;color:#94a3b8;text-align:center;width:54px;border-right:1px solid rgba(255,255,255,0.06);">Tryb</th>`;
    h3 += `<th style="${th3Base}background:#161923;color:#94a3b8;text-align:right;width:80px;">Auto/M</th>`;
    /* === KOLUMNA 2: Lp. — sticky left:0 === */
    h1 += `<th style="${thBase}background:#161923;color:#94a3b8;position:sticky;left:0;z-index:30;min-width:32px;text-align:center;border-right:1px solid rgba(255,255,255,0.08);">Lp.</th>`;
    h2 += `<th style="${th2Base}background:#161923;color:#94a3b8;position:sticky;left:0;z-index:30;min-width:32px;text-align:center;border-right:1px solid rgba(255,255,255,0.08);">·</th>`;
    h3 += `<th style="${th3Base}background:#161923;color:#94a3b8;position:sticky;left:0;z-index:30;min-width:32px;text-align:center;border-right:1px solid rgba(255,255,255,0.08);">·</th>`;
    h1 += `<th style="${thBase}background:#161923;color:#94a3b8;position:sticky;left:32px;z-index:30;min-width:130px;text-align:left;border-right:1px solid rgba(255,255,255,0.1);">Nr Studni</th>`;
    h2 += `<th style="${th2Base}background:#161923;color:#94a3b8;position:sticky;left:32px;z-index:30;min-width:130px;text-align:left;">·</th>`;
    h3 += `<th style="${th3Base}background:#161923;color:#94a3b8;position:sticky;left:32px;z-index:30;min-width:130px;text-align:left;">·</th>`;
    h1 += `<th style="${thBase}background:#161923;color:#94a3b8;position:sticky;left:162px;z-index:30;min-width:78px;text-align:right;">Rz. Włazu</th>`;
    h2 += `<th style="${th2Base}background:#161923;color:#94a3b8;position:sticky;left:162px;z-index:30;min-width:78px;text-align:right;">·</th>`;
    h3 += `<th style="${th3Base}background:#161923;color:#94a3b8;position:sticky;left:162px;z-index:30;min-width:78px;text-align:right;">·</th>`;
    h1 += `<th style="${thBase}background:#161923;color:#94a3b8;position:sticky;left:240px;z-index:30;min-width:78px;text-align:right;">Rz. Dna</th>`;
    h2 += `<th style="${th2Base}background:#161923;color:#94a3b8;position:sticky;left:240px;z-index:30;min-width:78px;text-align:right;">·</th>`;
    h3 += `<th style="${th3Base}background:#161923;color:#94a3b8;position:sticky;left:240px;z-index:30;min-width:78px;text-align:right;">·</th>`;
    h1 += `<th style="${thBase}background:#161923;color:${dnColor};position:sticky;left:318px;z-index:30;min-width:65px;text-align:center;">Wys.</th>`;
    h2 += `<th style="${th2Base}background:#161923;color:${dnColor};position:sticky;left:318px;z-index:30;min-width:65px;text-align:center;">auto</th>`;
    h3 += `<th style="${th3Base}background:#161923;color:${dnColor};position:sticky;left:318px;z-index:30;min-width:65px;text-align:center;">·</th>`;

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
    h1 += `<th style="${thBase}background:#13151f;color:#64748b;min-width:24px;text-align:center;padding:0;"><button onclick="excelRemoveTransitionColumn()" title="Usuń ostatnią kolumnę przejścia" style="background:#13151f;color:#ef4444;border:none;cursor:pointer;font-size:0.9rem;font-weight:700;padding:0.15rem 0;width:100%;transition:color 0.1s;" onmouseenter="this.style.color='#f87171'" onmouseleave="this.style.color='#ef4444'">−</button></th>`;
    h2 += `<th style="${th2Base}background:#13151f;color:#64748b;min-width:24px;text-align:center;padding:0;">·</th>`;
    h3 += `<th style="${th3Base}background:#13151f;color:#64748b;min-width:24px;text-align:center;padding:0;">·</th>`;
    h1 += `<th style="${thBase}background:#13151f;color:#64748b;min-width:24px;text-align:center;padding:0;"><button onclick="excelAddTransitionColumn()" title="Dodaj kolumnę przejścia" style="background:#13151f;color:#64748b;border:none;cursor:pointer;font-size:0.9rem;font-weight:700;padding:0.15rem 0;width:100%;transition:color 0.1s;" onmouseenter="this.style.color='#94a3b8'" onmouseleave="this.style.color='#64748b'">+</button></th>`;
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
                dynProdCode = _excelGetWellProdCode(wells[currentWellIndex], ct, c.height, c.fromReduction ? (c.targetDn || wells[currentWellIndex].redukcjaTargetDN || 1000) : null);
            }
            var fallbackCode = c.products && c.products[0] && c.products[0].id || null;
            colCodeId = dynProdCode || fallbackCode;
        }
        const codeDisp = colCodeId || null;
        const perProdAttr = isPerProduct ? ' data-per-product="1"' : '';
        const fallbackAttr = isPerProduct ? '' : ` data-fallback="${escapeHtml(c.products && c.products[0] && c.products[0].id || '')}"`;

        const colCode = codeDisp
            ? (function() {
                var priceHtml = '';
                if (isPerProduct && codeDisp) {
                    try {
                        /* Znajdź produkt w studnieProducts i pobierz cenę bez filtrowania */
                        var prod = (typeof studnieProducts !== 'undefined' ? studnieProducts : []).find(function(pr) { return pr.id === codeDisp; });
                        if (prod && prod.price) {
                            var fmt = typeof fmtInt === 'function' ? fmtInt : function(n) { return Math.round(n || 0).toLocaleString('pl-PL'); };
                            priceHtml = fmt(prod.price) + ' PLN';
                        }
                    } catch(e) { console.error('priceHtml error:', e); }
                }
                return '<br><span class="h3-prodcode" data-ct="' + ct + '" data-height="' + (c.height != null ? c.height : '') + '"' + perProdAttr + fallbackAttr + ' data-reddn="' + (c.fromReduction ? (c.targetDn || '1000') : '') + '" style="overflow:hidden;text-overflow:ellipsis;display:block;max-width:130px;">' + escapeHtml(codeDisp) + '</span><br><span class="h3-prodprice" data-ct="' + ct + '" data-height="' + (c.height != null ? c.height : '') + '"' + perProdAttr + ' style="display:block;">' + priceHtml + '</span>';
            })()
            : '';
        const h3Pad = colCodeId ? '0.25rem 0.5rem 0.2rem' : '0.15rem 0.5rem';
        /* Dla kolumn redukcji pokaż target DN zamiast głównego DN zakładki */
        const colDnLabel = c.fromReduction ? 'DN' + (c.targetDn || (wells[currentWellIndex] && wells[currentWellIndex].redukcjaTargetDN) || 1000) : dnTh3(ct);
        h1 += `<th style="${thBase}background:#13151f;color:${hc};min-width:95px;text-align:center;">${colLabel}</th>`;
        h2 += `<th style="${th2Base}background:#13151f;color:${hc};min-width:95px;text-align:center;">${colDetail}</th>`;
        h3 += `<th style="padding:${h3Pad};font-size:0.55rem;font-weight:500;color:#64748b;text-align:center;white-space:nowrap;background:#13151f;color:${hc};min-width:95px;text-align:center;">${colDnLabel}${colCode}</th>`;
    });

    h1 += `<th style="${thBase}background:#1a170f;color:#fbbf24;min-width:60px;text-align:center;">H denn</th>`;
    h2 += `<th style="${th2Base}background:#1a170f;color:#fbbf24;min-width:60px;text-align:center;">auto</th>`;
    h3 += `<th style="${th3Base}background:#1a170f;color:#fbbf24;min-width:60px;text-align:center;">·</th>`;
    h1 += `<th style="${thBase}background:#1a170f;color:#fbbf24;min-width:50px;text-align:center;">Uszcz</th>`;
    h2 += `<th style="${th2Base}background:#1a170f;color:#fbbf24;min-width:50px;text-align:center;">auto</th>`;
    h3 += `<th style="${th3Base}background:#1a170f;color:#fbbf24;min-width:50px;text-align:center;">·</th>`;

    if (hasReduction) {
        /* Redukcja — pojedynczy select: Brak / DN1000 / DN1200 */
        h1 += `<th style="${thBase}background:#1a1215;color:#fca5a5;min-width:110px;text-align:center;">Redukcja</th>`;
        h2 += `<th style="${th2Base}background:#1a1215;color:#fca5a5;min-width:110px;text-align:center;">·</th>`;
        h3 += `<th style="${th3Base}background:#1a1215;color:#fca5a5;min-width:110px;text-align:center;">·</th>`;
    }

    h1 += `<th style="${thBase}background:#150f1a;color:#c4b5fd;min-width:95px;text-align:left;">Kineta</th>`;
    h2 += `<th style="${th2Base}background:#150f1a;color:#c4b5fd;min-width:95px;text-align:left;">·</th>`;
    h3 += `<th style="${th3Base}background:#150f1a;color:#c4b5fd;min-width:95px;text-align:left;">·</th>`;
    h1 += `<th style="${thBase}background:#161923;color:#94a3b8;min-width:55px;text-align:center;">P.Buda</th>`;
    h2 += `<th style="${th2Base}background:#161923;color:#94a3b8;min-width:55px;text-align:center;">·</th>`;
    h3 += `<th style="${th3Base}background:#161923;color:#94a3b8;min-width:55px;text-align:center;">·</th>`;
    h1 += `<th style="${thBase}background:#161923;color:#94a3b8;min-width:90px;text-align:center;">Akcje</th>`;
    h2 += `<th style="${th2Base}background:#161923;color:#94a3b8;min-width:90px;text-align:center;">·</th>`;
    h3 += `<th style="${th3Base}background:#161923;color:#94a3b8;min-width:90px;text-align:center;">·</th>`;

    html += `<tr style="position:sticky;top:0;z-index:20;background:#161923;">${h3}</tr>`;
    html += `<tr style="position:sticky;top:1.4rem;z-index:20;background:#161923;">${h1}</tr>`;
    html += `<tr style="position:sticky;top:3.2rem;z-index:20;background:#161923;">${h2}</tr>`;
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
        const przejscia = well.przejscia || [];

        html += `<tr data-widx="${wIdx}" data-base-bg="${rowBg}" data-orig-bg="${rowBg}" data-hover-bg="${hoverBg}" data-active-bg="${isDup && isActive ? rowActiveDupSolid : isDup ? hoverDupSolid : '#1a2645'}" style="background:${rowBg};transition:background 0.15s;" onmouseenter="this.style.background=this.getAttribute('data-hover-bg')" onmouseleave="this.style.background=this.getAttribute('data-orig-bg')">`

        const tdBase = `${_EXCEL_FONT}`;

        /* Checkbox column - NIE sticky, normalnie w flow */
        const cbChecked = _excelRowSelectStates[wIdx] ? ' checked' : '';
        const isAuto = well.autoSelect !== false;
        const autoBg = isAuto ? 'rgba(99,102,241,0.2)' : 'rgba(245,158,11,0.25)';
        const autoColor = isAuto ? '#c7d2fe' : '#fbbf24';
        html += `<td style="${tdBase}background:${rowBg};text-align:center;padding:2px;border-right:1px solid rgba(255,255,255,0.06);width:28px;">
            <input type="checkbox" class="excel-row-select" data-widx="${wIdx}"${cbChecked} tabindex="-1" style="cursor:pointer;accent-color:rgba(99,102,241,0.7);" />
        </td>`;
        /* AUTO/MAN mode badge column - NIE sticky */
        html += `<td style="${tdBase}background:${rowBg};text-align:center;padding:2px;border-right:1px solid rgba(255,255,255,0.06);width:54px;">
            <span class="excel-mode-badge" title="${isAuto ? 'Auto (komponenty dobierane automatycznie)' : 'Manual (komponenty ustawione ręcznie)'}" style="display:inline-block;padding:2px 6px;border-radius:3px;font-size:0.55rem;cursor:help;background:${autoBg};color:${autoColor};border:1px solid ${autoBg};font-weight:600;">${isAuto ? 'AUTO' : 'MAN'}</span>
        </td>`;

        /* Lp. */
        html += `<td style="${tdBase}position:sticky;left:0;z-index:5;background:${rowBg};text-align:center;color:#64748b;font-size:0.65rem;border-right:1px solid rgba(255,255,255,0.08);min-width:32px;">${idx + 1}</td>`;

        /* Nr. Studni — edytowalny input + badge duplikatu, sticky */
        html += `<td style="${tdBase}position:sticky;left:32px;z-index:5;background:${rowBg};border-right:1px solid rgba(255,255,255,0.08);"><input type="text" value="${escapeHtml(well.name)}" onchange="excelOnNameChange(${wIdx},this.value)" onfocus="excelCellFocus(this);_excelSelWrapFocus(this)" onblur="excelCellBlur(this)" style="${_excelCellInp(120)}text-align:left;width:118px;" /></td>`;

        /* Rz. Włazu */
        html += `<td style="${tdBase}position:sticky;left:162px;z-index:5;background:${rowBg};text-align:right;"><input type="number" step="0.01" data-field="rzednaWlazu" value="${well.rzednaWlazu != null ? well.rzednaWlazu : ''}" onchange="excelOnRzednaChange(${wIdx})" onfocus="excelCellFocus(this);_excelSelWrapFocus(this)" onblur="excelCellBlur(this)" style="${_excelCellInp(72)}" /></td>`;

        /* Rz. Dna */
        html += `<td style="${tdBase}position:sticky;left:240px;z-index:5;background:${rowBg};text-align:right;"><input type="number" step="0.01" data-field="rzednaDna" value="${well.rzednaDna != null ? well.rzednaDna : ''}" onchange="excelOnRzednaChange(${wIdx})" onfocus="excelCellFocus(this);_excelSelWrapFocus(this)" onblur="excelCellBlur(this)" style="${_excelCellInp(72)}" /></td>`;

        /* Wys. — auto */
        const height = _excelCalcWellHeight(well);
        html += `<td style="${tdBase}position:sticky;left:318px;z-index:5;background:${rowBg};text-align:center;color:${dnColor};font-weight:600;" data-cell="height-${wIdx}">${height || '\u2014'}</td>`;

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

            var catOpts2 = [['', '&mdash;']];
            categories.forEach(function(c) { catOpts2.push([c, c]); });
            var typeHtml = _excelOverlaySelectHtml(catOpts2, activeCategory,
                'excelOnPrzejscieTypeChange(' + wIdx + ',' + i + ',this.value)', 120);

            // Wybierz średnice dostępne tylko dla wybranego rodzaju
            const availDns = activeCategory
                ? [...przProducts.filter((p) => p.category === activeCategory)].sort(
                      (a, b) => parseFloat(a.dn) - parseFloat(b.dn)
                  )
                : [];

            var dnOpts2 = [['', '&mdash;']];
            availDns.forEach(function(p) {
                var dnLabel2 = typeof p.dn === 'string' && p.dn.indexOf('/') >= 0 ? p.dn : 'DN ' + p.dn;
                dnOpts2.push([p.id, dnLabel2]);
            });
            var dnHtml = _excelOverlaySelectHtml(dnOpts2, prz.productId,
                "excelOnPrzejscieChange(" + wIdx + "," + i + ",'productId',this.value)", 110);

            html += `<td style="${tdBase}text-align:right;"><input type="number" step="0.01" value="${hasExplicitRzWl ? prz.rzednaWlaczenia : ''}" placeholder="${rzWlPlaceholder}" onchange="excelOnPrzejscieChange(${wIdx},${i},'rzednaWlaczenia',this.value)" onfocus="excelCellFocus(this);_excelSelWrapFocus(this)" onblur="excelCellBlur(this)" style="${_excelCellInp(72)}" /></td>`;
            html += `<td style="${tdBase}text-align:center;"><input type="number" step="1" value="${prz.angle != null ? prz.angle : ''}" onchange="excelOnPrzejscieChange(${wIdx},${i},'angle',this.value)" onfocus="excelCellFocus(this);_excelSelWrapFocus(this)" onblur="excelCellBlur(this)" style="${_excelCellInp(50)}text-align:center;" /></td>`;
            html += `<td style="${tdBase}text-align:left;">${typeHtml}</td>`;
            html += `<td style="${tdBase}text-align:left;">${dnHtml}</td>`;
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
        var wlazOpts2 = [['', '—']];
        wlazProducts.forEach(function(p) {
            var hCm2 = Math.round(parseInt(p.height) || 0) / 10;
            var lbl2 = hCm2 > 0 ? hCm2 + ' cm' : (p.name.length > 20 ? p.name.substring(0, 18) + '…' : p.name);
            wlazOpts2.push([p.id, lbl2]);
        });
        html += '<td style="text-align:left;">' + _excelOverlaySelectHtml(wlazOpts2, wlazVal,
            "excelOnWlazChange(" + wIdx + ",this.value)", 62) + '</td>';

        /* Komponenty — ilości z kodem produktu */
        compCols.forEach((col) => {
            if (col.type === 'select' || col.type === 'auto') return;
            const c = /** @type {any} */ (col);
            const count = _excelCountProductInConfig(well, c.componentType, c.height, c.productId, c.fromReduction ? (c.targetDn || well.redukcjaTargetDN || 1000) : null);
            const pidArg = c.productId ? `'${c.productId}'` : 'null';
            const hArg = c.height != null ? c.height : 'null';
            const redArg = c.fromReduction ? `,${well.redukcjaTargetDN || 1000}` : '';
            var disabledAttr = '';
            html += `<td style="${tdBase}text-align:center;min-width:95px;">`
                + `<input type="number" min="0" step="1" value="${count || ''}"${disabledAttr} oninput="excelOnCompChange(${wIdx},'${c.componentType}',${hArg},this.value,${pidArg}${redArg})" onfocus="excelCellFocus(this);_excelSelWrapFocus(this)" onblur="excelCellBlur(this)" style="${_excelCellInp(50)}text-align:center;width:52px;" />`
                + `</td>`;
        });

        /* H dennica — auto */
        const dennH = _excelCalcDennicaHeight(well);
        html += `<td style="${tdBase}text-align:center;color:#fbbf24;font-weight:600;" data-cell="denn-${wIdx}">${dennH || '—'}</td>`;

        /* Uszczelki — auto (z compCols) */
        const uszczCount = _excelCalcUszczelkaCount(well);
        html += `<td style="${tdBase}text-align:center;color:#f97316;font-weight:600;" data-cell="uszcz-${wIdx}">${uszczCount}</td>`;

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
            var redOpts2 = [['', 'Brak']];
            if (redActive) {
                if (redTarget === 1000) redOpts2.push(['1000', 'DN1000']);
                if (redTarget === 1200) redOpts2.push(['1200', 'DN1200']);
            } else {
                redOpts2.push(['1000', 'DN1000']);
                if (can1200) redOpts2.push(['1200', 'DN1200']);
            }
            html += '<td style="text-align:center;">' + _excelOverlaySelectHtml(redOpts2, redActive ? String(redTarget) : '',
                "excelOnReductionSelectChange(" + wIdx + ",this.value)", 105) + '</td>';
        }

        /* Kineta */
        var kinOpts2 = [['', '—']];
        KINETA_OPTIONS.forEach(function(ko) { kinOpts2.push([ko[0], ko[1]]); });
        html += '<td style="text-align:left;">' + _excelOverlaySelectHtml(kinOpts2, well.kineta || '',
            "excelOnKinetaChange(" + wIdx + ",this.value)", 90) + '</td>';

        /* Psia buda */
        html += `<td style="${tdBase}text-align:center;"><input type="checkbox"${well.psiaBuda ? ' checked' : ''} onchange="excelOnPsiaBudaChange(${wIdx},this.checked)" style="accent-color:#f59e0b;cursor:pointer;" /></td>`;

        /* Akcje: Param, Duplikuj, Usuń */
        html += `<td style="${tdBase}text-align:center;white-space:nowrap;">`;
        html += '<div style="display:flex;gap:2px;justify-content:center;">';
        html += `<button onclick="excelOpenWellParams(${wIdx})" title="Parametry" style="background:#13151f;color:#818cf8;border:1px solid rgba(129,140,248,0.2);padding:0.15rem 0.3rem;border-radius:2px;font-size:0.55rem;cursor:pointer;font-weight:600;transition:all 0.1s;" onmouseenter="this.style.background='rgba(129,140,248,0.1)'" onmouseleave="this.style.background='#13151f'">⋯</button>`;
        html += `<button onclick="excelDuplicateWell(${wIdx})" title="Duplikuj" style="background:#13151f;color:#60a5fa;border:1px solid rgba(96,165,250,0.2);padding:0.15rem 0.3rem;border-radius:2px;font-size:0.55rem;cursor:pointer;font-weight:600;transition:all 0.1s;" onmouseenter="this.style.background='rgba(96,165,250,0.1)'" onmouseleave="this.style.background='#13151f'">⧉</button>`;
        html += `<button onclick="excelDeleteWell(${wIdx})" title="Usuń" style="background:#13151f;color:#f87171;border:1px solid rgba(248,113,113,0.2);padding:0.15rem 0.3rem;border-radius:2px;font-size:0.55rem;cursor:pointer;font-weight:600;transition:all 0.1s;" onmouseenter="this.style.background='rgba(239,68,68,0.15)'" onmouseleave="this.style.background='#13151f'">✕</button>`;
        html += '</div></td>';

        html += '</tr>';
    });

    /* ===== EMPTY ROW — wiersz na nową studnię ===== */
    const emptyRowBg = '#0a0c10';
    html += `<tr id="excel-empty-row" style="background:${emptyRowBg};">`;

    const tdBase = `${_EXCEL_FONT}`;
    const tdEmpty = `${tdBase}color:#334155;`;

    /* Lp. */
    html += `<td style="${tdEmpty}position:sticky;left:0;z-index:5;background:${emptyRowBg};text-align:center;color:#334155;font-size:0.65rem;border-right:1px solid rgba(255,255,255,0.08);min-width:32px;">—</td>`;

    /* Nazwa — sticky left */
    html += `<td style="${tdEmpty}position:sticky;left:32px;z-index:5;background:${emptyRowBg};"><input type="text" placeholder="Nazwa studni… (Enter/zmiana dodaje)" id="excel-empty-name" onkeydown="if(event.key==='Enter')excelCreateFromEmpty()" onblur="excelCreateFromEmpty(event)" onfocus="excelCellFocus(this);_excelSelWrapFocus(this)" style="${_excelCellInp(125)}text-align:left;color:#94a3b8;" /></td>`;

    /* Rz. Włazu */
    html += `<td style="${tdEmpty}position:sticky;left:162px;z-index:5;background:${emptyRowBg};text-align:right;"><input type="number" step="0.01" placeholder="—" id="excel-empty-rzw" onfocus="excelCellFocus(this);_excelSelWrapFocus(this)" style="${_excelCellInp(72)}" /></td>`;

    /* Rz. Dna */
    html += `<td style="${tdEmpty}position:sticky;left:240px;z-index:5;background:${emptyRowBg};text-align:right;"><input type="number" step="0.01" placeholder="—" id="excel-empty-rzd" onfocus="excelCellFocus(this);_excelSelWrapFocus(this)" style="${_excelCellInp(72)}" /></td>`;

    /* Wys. — placeholder */
    html += `<td style="${tdEmpty}position:sticky;left:318px;z-index:5;background:${emptyRowBg};text-align:center;color:#1e293b;" data-cell="height-empty">—</td>`;

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

    /* Auto-kolumny — placeholder */
    html += `<td style="${tdEmpty}text-align:center;color:#1e293b;" data-cell="denn-empty">—</td>`;
    html += `<td style="${tdEmpty}text-align:center;color:#1e293b;" data-cell="uszcz-empty">—</td>`;

    /* Redukcja — pusty wiersz, disabled select */
    if (hasReduction) {
        html += `<td style="${tdEmpty}text-align:center;"><select disabled style="${_excelCellInp(105)}opacity:0.3;cursor:default;"><option value="">—</option></select></td>`;
    }

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
    _excelApplyStickyColumns();
    /* Odśwież ikony Lucide w kontenerze (nie skanuj całego dokumentu) */
    if (typeof lucide !== 'undefined' && lucide.createIcons) {
        try { lucide.createIcons({ root: container }); } catch(e) {}
    }

    // Przywróć fokus po re-renderze
    if (savedFocus) {
        const targetRow = container.querySelector(`tr[data-widx="${savedFocus.wIdx}"]`);
        if (targetRow) {
            const navEls = _excelGetNavElements(targetRow);
            const restoreEl = navEls[savedFocus.colIdx];
            if (restoreEl && !restoreEl.disabled) {
                /* Ustaw currentWellIndex ZANIM focus, by excelCellFocus nie
                   wywolal excelSelectRow (focus triggeruje onfocus -> excelCellFocus) */
                if (typeof savedFocus.wIdx !== 'undefined' && !isNaN(savedFocus.wIdx)) {
                    currentWellIndex = savedFocus.wIdx;
                }
                restoreEl.focus();
                // Jeśli to input, zaznacz zawartość
                if (restoreEl.tagName === 'INPUT' && restoreEl.select) {
                    restoreEl.select();
                }
            }
        }
    }
    /* Ponownie zastosuj filtr wyszukiwarki po re-renderze */
    var searchInput = document.getElementById('excel-search-input');
    if (searchInput && searchInput.value) excelFilterWells(searchInput.value);
}

/** Wymuś poprawne sticky left — dopasowuje do rzeczywistej szerokości kolumn */
function _excelApplyStickyColumns() {
    const container = document.getElementById('excel-table-container');
    if (!container) return;
    const table = container.querySelector('table');
    if (!table) return;
    /* Zmierz rzeczywiste szerokości pierwszych 7 kolumn (checkbox, tryb, Lp, NrStudni, RzWlazu, RzDna, Wys) */
    const firstRow = table.querySelector('thead tr');
    if (!firstRow) return;
    const stickyThs = firstRow.querySelectorAll('th:nth-child(-n+7)');
    if (stickyThs.length < 2) return;
    var leftPos = 0;
    var offsets = [0];
    for (var i = 0; i < stickyThs.length - 1; i++) {
        leftPos += /** @type {HTMLElement} */ (stickyThs[i]).offsetWidth;
        offsets.push(leftPos);
    }
    /* Zastosuj do wszystkich th i td w pierwszych 7 kolumnach */
    var sel = 'th:nth-child(-n+7), td:nth-child(-n+7)';
    var cells = table.querySelectorAll(sel);
    for (var i = 0; i < cells.length; i++) {
        var colIdx = 0;
        var el = cells[i];
        var prev = el.previousElementSibling;
        while (prev) { colIdx++; prev = prev.previousElementSibling; }
        if (colIdx < 7 && offsets[colIdx] != null) {
            el.style.left = offsets[colIdx] + 'px';
            el.style.position = 'sticky';
            // Z-index: 30 dla thead, 5 dla tbody
            if (el.closest('thead')) {
                el.style.zIndex = '30';
            } else {
                el.style.zIndex = '5';
            }
        }
    }
}

/* ===== RESIZE COLUMNS (Excel-like drag handles) ===== */
function _excelInitColumnResize() {
    const container = document.getElementById('excel-table-container');
    if (!container) return;
    const table = container.querySelector('table');
    if (!table) return;

    const headers = table.querySelectorAll('thead tr:first-child th');
    headers.forEach((th) => {
        // Tylko ustaw position:relative dla kolumn ktore nie maja sticky w inline
        // (sticky columns maja position:sticky;left:N ustawione przez _excelApplyStickyColumns)
        if (th.style.position !== 'sticky') {
            th.style.position = 'relative';
        }

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

/* ===== CELL SELECTION (Excel-like) ===== */
function _excelToggleCellClass(wIdx, colIdx, add) {
    const container = document.getElementById('excel-table-container');
    if (!container) return;
    const td = container.querySelector('tr[data-widx="' + wIdx + '"] td:nth-child(' + (colIdx + 1) + ')');
    if (!td) return;
    if (add) td.classList.add('cell-selected');
    else td.classList.remove('cell-selected');
}

function _excelSelectCell(wIdx, colIdx, ctrl, shift) {
    if (shift && _excelLastClickedCell) {
        _excelDeselectAllCells();
        var minR = Math.min(_excelLastClickedCell.wIdx, wIdx);
        var maxR = Math.max(_excelLastClickedCell.wIdx, wIdx);
        var minC = Math.min(_excelLastClickedCell.colIdx, colIdx);
        var maxC = Math.max(_excelLastClickedCell.colIdx, colIdx);
        for (var r = minR; r <= maxR; r++) {
            for (var c = minC; c <= maxC; c++) {
                _excelSelectedCells.push({ wIdx: r, colIdx: c });
                _excelToggleCellClass(r, c, true);
            }
        }
    } else if (ctrl) {
        var idx = _excelSelectedCells.findIndex(function(cell) { return cell.wIdx === wIdx && cell.colIdx === colIdx; });
        if (idx >= 0) {
            _excelSelectedCells.splice(idx, 1);
            _excelToggleCellClass(wIdx, colIdx, false);
        } else {
            _excelSelectedCells.push({ wIdx: wIdx, colIdx: colIdx });
            _excelToggleCellClass(wIdx, colIdx, true);
        }
    } else {
        _excelDeselectAllCells();
        _excelSelectedCells.push({ wIdx: wIdx, colIdx: colIdx });
        _excelToggleCellClass(wIdx, colIdx, true);
    }
    _excelLastClickedCell = { wIdx: wIdx, colIdx: colIdx };
}

function _excelOnMouseDown(e) {
    if (e.button !== 0) return; // tylko lewy przycisk
    var td = e.target.closest('td');
    if (!td) return;
    var tr = td.closest('tr[data-widx]');
    if (!tr || !tr.children) return;
    var wIdx = parseInt(tr.getAttribute('data-widx'), 10);
    var colIdx = Array.prototype.indexOf.call(tr.children, td);
    if (isNaN(wIdx) || colIdx < 0) return;

    _excelDragState = {
        anchor: { wIdx: wIdx, colIdx: colIdx },
        mode: (e.ctrlKey || e.metaKey) ? 'add' : 'new',
        end: { wIdx: wIdx, colIdx: colIdx },
        active: true,
        thresholdMet: false,
        additiveFromShift: false
    };

    /* Zaznacz anchor natychmiast (action-only-on-mousedown dla czystego drag) */
    if (!e.ctrlKey && !e.shiftKey) {
        _excelDeselectAllCells();
        _excelSelectCell(wIdx, colIdx, false, false);
    } else if (e.shiftKey && _excelLastClickedCell) {
        _excelDeselectAllCells();
        for (var r = Math.min(_excelLastClickedCell.wIdx, wIdx); r <= Math.max(_excelLastClickedCell.wIdx, wIdx); r++) {
            for (var c = Math.min(_excelLastClickedCell.colIdx, colIdx); c <= Math.max(_excelLastClickedCell.colIdx, colIdx); c++) {
                _excelSelectCell(r, c, false, false);
            }
        }
    }
    /* Dla ctrl: nic nie rob (toggle bedzie przy mouseup) */
}

function _excelOnMouseMove(e) {
    if (!_excelDragState || !_excelDragState.active) return;
    /* nie aktualizuj jeszcze dragu, czekaj na dragstart */
    var td = e.target.closest('td');
    if (!td) return;
    var tr = td.closest('tr[data-widx]');
    if (!tr || !tr.children) return;
    var wIdx = parseInt(tr.getAttribute('data-widx'), 10);
    var colIdx = Array.prototype.indexOf.call(tr.children, td);
    if (isNaN(wIdx) || colIdx < 0) return;
    if (wIdx === _excelDragState.end.wIdx && colIdx === _excelDragState.end.colIdx) return;

    _excelDragState.end = { wIdx: wIdx, colIdx: colIdx };
    /* Live preview */
    if (_excelDragThrottle) return;
    _excelDragThrottle = true;
    requestAnimationFrame(function() {
        _excelDragThrottle = false;
        if (!_excelDragState) return;
        _excelClearDragPreview();
        var s = _excelDragState.anchor;
        var e2 = _excelDragState.end;
        var rMin = Math.min(s.wIdx, e2.wIdx);
        var rMax = Math.max(s.wIdx, e2.wIdx);
        var cMin = Math.min(s.colIdx, e2.colIdx);
        var cMax = Math.max(s.colIdx, e2.colIdx);
        for (var r = rMin; r <= rMax; r++) {
            for (var c = cMin; c <= cMax; c++) {
                var row = document.querySelector('tr[data-widx="' + r + '"]');
                if (!row || !row.children[c]) continue;
                /* Nie nadpisuj juz-faktycznie-zaznaczonych komorek, tylko preview */
                if (_excelDragState.mode === 'new') {
                    row.children[c].classList.add('drag-preview');
                }
            }
        }
    });
}

function _excelOnMouseUp() {
    if (!_excelDragState) return;
    if (_excelDragThrottle) {
        _excelDragThrottle = false;
    }
    var s = _excelDragState.anchor;
    var en = _excelDragState.end;
    var mode = _excelDragState.mode;
    var minR = Math.min(s.wIdx, en.wIdx);
    var maxR = Math.max(s.wIdx, en.wIdx);
    var minC = Math.min(s.colIdx, en.colIdx);
    var maxC = Math.max(s.colIdx, en.colIdx);

    /* Real selection commmit */
    if ((maxR - minR) > 0 || (maxC - minC) > 0) {
        /* rzeczywiscie drag (nie klik) */
        if (mode === 'new') {
            _excelDeselectAllCells();
            _excelSelectRange(s.wIdx, s.colIdx, en.wIdx, en.colIdx, false);
        } else {
            /* 'add' mode: dodaj zakres do istniejacej selekcji */
            _excelSelectRange(s.wIdx, s.colIdx, en.wIdx, en.colIdx, true);
        }
    } else if (mode === 'new') {
        /* Sam anchor replacement: pojedyncze klikniecie = zaznacz komorke */
        _excelDeselectAllCells();
        _excelSelectCell(s.wIdx, s.colIdx, false, false);
    }
    _excelClearDragPreview();
    _excelDragState = null;
}

/* ===== FOCUS OVERLAY ===== */
function _excelPositionFocusOverlay(td) {
    if (!_excelFocusOverlayEl) return;
    if (!td || !document.body.contains(td)) {
        _excelFocusOverlayEl.style.display = 'none';
        return;
    }
    var r = td.getBoundingClientRect();
    if (r.width === 0 || r.height === 0) {
        _excelFocusOverlayEl.style.display = 'none';
        return;
    }
    _excelFocusOverlayEl.style.display = 'block';
    _excelFocusOverlayEl.style.top = (r.top - 2) + 'px';
    _excelFocusOverlayEl.style.left = (r.left - 2) + 'px';
    _excelFocusOverlayEl.style.width = (r.width + 4) + 'px';
    _excelFocusOverlayEl.style.height = (r.height + 4) + 'px';
}

function _excelOnFocusIn(e) {
    if (!_excelFocusOverlayEl) return;
    var target = e.target;
    if (!target) return;
    /* Dla overlay select: target = .excel-sel-wrap (lub inner button/input/select);
       szukamy td */
    var td = target.closest('td');
    if (!td) return;
    /* Wymazujemy timer jezeli jest */
    if (_excelFocusRaf) cancelAnimationFrame(_excelFocusRaf);
    _excelFocusRaf = requestAnimationFrame(function() {
        _excelFocusRaf = null;
        _excelPositionFocusOverlay(td);
    });
}

/* Alternatywna wersja - wywolywana bezposrednio dla overlay select (.excel-sel-wrap) */
function _excelSelWrapFocus(selWrap) {
    if (!_excelFocusOverlayEl) return;
    var td = selWrap.closest('td');
    if (!td) return;
    if (_excelFocusRaf) cancelAnimationFrame(_excelFocusRaf);
    _excelFocusRaf = requestAnimationFrame(function() {
        _excelFocusRaf = null;
        _excelPositionFocusOverlay(td);
    });
}

/* ===== ROW SELECT CHEKBOX CHANGE HANDLER ===== */
function _excelOnRowSelectChange(e) {
    var target = e.target;
    if (!target) return;
    /* Row checkbox - per studnia */
    if (target.classList && target.classList.contains('excel-row-select')) {
        var wIdx = parseInt(target.getAttribute('data-widx'), 10);
        if (!isNaN(wIdx)) {
            _excelRowSelectStates[wIdx] = target.checked;
            _excelUpdateBulkButtons();
            /* sync select-all checkbox */
            var allBoxes = document.querySelectorAll('#excel-table-container tbody tr[data-widx] input.excel-row-select');
            var allChecked = Array.from(allBoxes).every(function(cb) { return cb.checked; });
            var hdrAll = document.getElementById('excel-select-all');
            if (hdrAll && hdrAll !== document.activeElement) hdrAll.checked = allChecked;
        }
    }
    /* Select-all checkbox jest obslugiwany inline onchange -> _excelToggleSelectAll */
}

function _excelOnFocusOut(e) {
    if (!_excelFocusOverlayEl) return;
    /* Delay — sprawdzamy czy focus nie przeskoczyl do innej komórki w kontenerze */
    setTimeout(function() {
        var ae = document.activeElement;
        var stillInContainer = ae && document.getElementById('excel-table-container') && document.getElementById('excel-table-container').contains(ae);
        if (!stillInContainer) {
            if (_excelFocusOverlayEl) _excelFocusOverlayEl.style.display = 'none';
        }
    }, 30);
}

function _excelOnOverlayScroll() {
    if (!_excelFocusOverlayEl) return;
    if (_excelFocusOverlayEl.style.display === 'none') return;
    /* throttling: jeden requestAnimationFrame na wiele scroll events */
    if (_excelFocusRaf) return;
    _excelFocusRaf = requestAnimationFrame(function() {
        _excelFocusRaf = null;
        var ae = document.activeElement;
        if (!ae) return;
        var td = ae.closest('td');
        if (!td) return;
        _excelPositionFocusOverlay(td);
    });
}

function _excelDeselectAllCells() {
    if (_excelSelectedCells.length === 0) return;
    const copy = [..._excelSelectedCells];
    _excelSelectedCells = [];
    copy.forEach(function(cell) { _excelToggleCellClass(cell.wIdx, cell.colIdx, false); });
}

/* ===== DRAG SELECTION ===== */
function _excelClearDragPreview() {
    document.querySelectorAll('#excel-table-container td.drag-preview').forEach(function(td) {
        td.classList.remove('drag-preview');
    });
}

function _excelSelectedCount() {
    return _excelSelectedCells.length;
}

/* ===== SELECT ALL ===== */
function _excelSelectAllCells() {
    _excelDeselectAllCells();
    _excelDeselectAllCols();
    var rows = document.querySelectorAll('#excel-table-container tbody tr[data-widx]');
    for (var r = 0; r < rows.length; r++) {
        var tds = rows[r].querySelectorAll('td');
        for (var c = 0; c < tds.length; c++) {
            var td = tds[c];
            if (td.querySelector('input,select')) {
                _excelSelectCell(r, c, false, false);
            }
        }
    }
}

/* ===== ROW CHECKBOX + AUTO/MANUAL BATCH ===== */
function _excelBulkSetMode(enabled) {
    if (typeof wells === 'undefined') return;
    var sel = [];
    for (var i = 0; i < wells.length; i++) {
        if (_excelRowSelectStates[i]) sel.push(i);
    }
    var targets;
    if (sel.length === 0) {
        targets = [];
        for (var i = 0; i < wells.length; i++) {
            if (wells[i]) targets.push(i);
        }
        if (targets.length === 0) return;
        showToast('Brak zaznaczonych — zastosowano do ' + targets.length + ' studni', 'info');
    } else {
        targets = sel;
        showToast((enabled ? 'Auto' : 'Manual') + ' dla ' + targets.length + ' studni', 'success');
    }
    _excelSaveUndoSnapshot();
    targets.forEach(function(i) {
        if (wells[i]) wells[i].autoSelect = enabled;
    });
    _excelRenderTable(_excelActiveTab);
}

function _excelToggleSelectAll(checked) {
    _excelRowSelectStates = {};
    if (typeof wells !== 'undefined') {
        for (var i = 0; i < wells.length; i++) {
            _excelRowSelectStates[i] = checked;
        }
    }
    var boxes = document.querySelectorAll('.excel-row-select');
    boxes.forEach(function(cb) { cb.checked = checked; });
    var hdrAll = document.getElementById('excel-select-all');
    if (hdrAll && hdrAll !== document.activeElement) hdrAll.checked = checked;
    _excelUpdateBulkButtons();
}

function _excelUpdateBulkButtons() {
    var btnAuto = document.getElementById('excel-bulk-auto');
    var btnManual = document.getElementById('excel-bulk-manual');
    var count = 0;
    for (var k in _excelRowSelectStates) {
        if (_excelRowSelectStates.hasOwnProperty(k) && _excelRowSelectStates[k]) count++;
    }
    if (btnAuto) btnAuto.textContent = 'Auto (' + count + ')';
    if (btnManual) btnManual.textContent = 'Manual (' + count + ')';
}

function _excelSelectRange(startW, startC, endW, endC, additive) {
    if (!additive) _excelDeselectAllCells();
    var rMin = Math.min(startW, endW);
    var rMax = Math.max(startW, endW);
    var cMin = Math.min(startC, endC);
    var cMax = Math.max(startC, endC);
    for (var r = rMin; r <= rMax; r++) {
        for (var c = cMin; c <= cMax; c++) {
            var row = document.querySelector('tr[data-widx="' + r + '"]');
            if (!row || !row.children[c]) continue;
            var existing = _excelSelectedCells.find(function(cl){ return cl.wIdx===r && cl.colIdx===c; });
            if (!existing) _excelSelectCell(r, c, false, false);
        }
    }
}

/* ===== COPY / PASTE (Excel-like) ===== */

function _excelGetPasteColIdx(row) {
    if (!row) return 2;
    var active = document.activeElement;
    if (active && row.contains(active)) {
        var td = active.closest('td');
        if (td) {
            var ci = Array.from(row.children).indexOf(td);
            if (ci >= 2) return ci;
        }
    }
    return 2; /* fallback: pierwsza kolumna po Lp+NrStudni */
}
function _excelHandleCopy(e) {
    /* Tylko gdy Excel otwarty */
    if (!document.getElementById('excel-table-overlay')) return;
    if (_excelSelectedCells.length === 0 && _excelSelectedCols.length === 0) return;
    e.preventDefault();
    var rows = document.querySelectorAll('#excel-table-container tbody tr[data-widx]');
    if (rows.length === 0) return;
    var text = '';
    if (_excelSelectedCells.length > 0) {
        var cellMap = {};
        var minR = Infinity, maxR = -Infinity, minC = Infinity, maxC = -Infinity;
        _excelSelectedCells.forEach(function(cell) {
            if (!cellMap[cell.wIdx]) cellMap[cell.wIdx] = {};
            cellMap[cell.wIdx][cell.colIdx] = true;
            if (cell.wIdx < minR) minR = cell.wIdx;
            if (cell.wIdx > maxR) maxR = cell.wIdx;
            if (cell.colIdx < minC) minC = cell.colIdx;
            if (cell.colIdx > maxC) maxC = cell.colIdx;
        });
        for (var r = minR; r <= maxR; r++) {
            var line = [];
            for (var c = minC; c <= maxC; c++) {
                var val = '';
                if (cellMap[r] && cellMap[r][c]) {
                    var row = rows[r];
                    if (row) {
                        var td = row.children[c];
                        var target = td ? td.querySelector('input, select') : null;
                        if (target) { var _sel = /** @type {HTMLSelectElement} */ (target); val = _sel.tagName === 'SELECT' ? (_sel.options[_sel.selectedIndex] ? _sel.options[_sel.selectedIndex].text : '') : (/** @type {HTMLInputElement} */(target)).value || ''; }
                    }
                }
                line.push(val);
            }
            text += line.join('\t') + '\n';
        }
    } else if (_excelSelectedCols.length > 0) {
        var cols = _excelSelectedCols.sort(function(a,b){return a-b;});
        rows.forEach(function(row) {
            var line = [];
            cols.forEach(function(colIdx) {
                var td = row.children[colIdx];
                var target = td ? td.querySelector('input, select') : null;
                line.push(target ? (function(t){var _s=/** @type {HTMLSelectElement} */(t);return _s.tagName==='SELECT'?(_s.options[_s.selectedIndex]?_s.options[_s.selectedIndex].text:''):(/** @type {HTMLInputElement} */(t)).value||'';})(target) : '');
            });
            text += line.join('\t') + '\n';
        });
    }
    if (text) {
        if (e.clipboardData) {
            e.clipboardData.setData('text/plain', text);
        } else if (window.clipboardData) {
            window.clipboardData.setData('text', text);
        }
    }
}

function _excelHandlePaste(e) {
    /* Tylko gdy Excel otwarty */
    if (!document.getElementById('excel-table-overlay')) return;
    var cb = e.clipboardData || window.clipboardData;
    if (!cb) return;
    var text = cb.getData('text');
    if (!text || !text.trim()) return;
    /* Zawsze przejmij event gdy jesteśmy w kontenerze (capture phase) */
    e.preventDefault();
    e.stopPropagation();

    /* Paste w pusty wiersz → utwórz nowe studnie */
    var _emptyInput = document.getElementById('excel-empty-name');
    if (_emptyInput && _emptyInput === document.activeElement) {
        _excelPasteCreateWells(text);
        return;
    }

    var rows = document.querySelectorAll('#excel-table-container tbody tr[data-widx]');
    if (rows.length === 0) return;
    var lines = text.trim().split('\n');
    for (var _pi = 0; _pi < lines.length; _pi++) {
        lines[_pi] = lines[_pi].replace(/\r$/, '');
    }
    if (_excelSelectedCells.length > 0) {
        var cellList = _excelSelectedCells.sort(function(a,b){return a.wIdx-b.wIdx||a.colIdx-b.colIdx;});
        var cellRows = {};
        cellList.forEach(function(c) {
            if (!cellRows[c.wIdx]) cellRows[c.wIdx] = [];
            cellRows[c.wIdx].push(c.colIdx);
        });
        var widxArr = Object.keys(cellRows).map(Number).sort(function(a,b){return a-b;});
        var _baseWIdx = widxArr.length > 0 ? widxArr[0] : 0;
        var _baseCols = widxArr.length > 0 && cellRows[_baseWIdx] ? cellRows[_baseWIdx] : [_excelGetPasteColIdx(rows[0])];
        /* Przy cell-selection NIE dodawaj nowych wierszy — obetnij do dostępnej liczby */
        var availableRows = rows.length - _baseWIdx;
        if (lines.length > availableRows) {
            lines = lines.slice(0, availableRows);
            if (lines.length === 0) { showToast('Kliknij w istniejący wiersz — tu nie ma miejsca', 'warning'); return; }
            showToast('Wklejono ' + lines.length + ' (obcięte — koniec tabeli)', 'warning');
        }
        var _firstCol = _baseCols.length > 0 ? _baseCols[0] : 0;
        /* Użyj batch/sync paste — obsłuż duże zestawy */
        var _pasteFn = lines.length > 100 ? _excelPasteBatch : _excelPasteSync;
        _pasteFn(lines, _baseWIdx, _firstCol, null);
    } else if (_excelSelectedCols.length > 0) {
        var cols = _excelSelectedCols.sort(function(a,b){return a-b;});
        /* Przy column-selection NIE dodawaj nowych wierszy — obetnij */
        if (lines.length > rows.length) {
            lines = lines.slice(0, rows.length);
            showToast('Wklejono ' + lines.length + ' (obcięte — koniec tabeli)', 'warning');
        }
        lines.forEach(function(line, i) {
            var parts = line.split('	');
            cols.forEach(function(colIdx, ci) {
                if (ci >= parts.length) return;
                var tdInner = rows[i] ? rows[i].children[colIdx] : null;
                var target = tdInner ? tdInner.querySelector('input, select') : null;
                if (!target) return;
                _excelSetCellValue(target, parts[ci].trim());
            });
        });
    } else {
        /* Wykryj startowy wiersz z aktywnego elementu w tabeli */
        var startWIdx = -1; // -1 = nie wykryto aktywnego wiersza
        var _ae = document.activeElement;
        if (_ae) {
            var _tr = _ae.closest('tr[data-widx]');
            if (_tr) startWIdx = parseInt(_tr.getAttribute('data-widx') || '0') || 0;
        }
        if (startWIdx < 0) {
            /* brak fokusu w konkretnym wierszu — szukaj input/select wewnatrz kontenera jako fallback */
            var focusedInput = document.querySelector('#excel-table-container input:focus, #excel-table-container select:focus, #excel-table-container .excel-sel-wrap:focus-within');
            if (focusedInput) {
                var _ftr = focusedInput.closest('tr[data-widx]');
                if (_ftr) startWIdx = parseInt(_ftr.getAttribute('data-widx') || '0') || 0;
            }
        }
        if (startWIdx < 0) {
            /* nadal brak — paste do wszystkich istniejących wierszy od 0 */
            startWIdx = 0;
        }
        var colIdx = _excelGetPasteColIdx(
            document.querySelector('tr[data-widx="' + startWIdx + '"]') || rows[0]
        );
        /* Wkleja tylko w istniejące — obcina nadmiar (bez auto-add nowych pustych wierszy) */
        var availableRows = rows.length - startWIdx;
        if (lines.length > availableRows) {
            lines = lines.slice(0, availableRows);
            if (lines.length === 0) { showToast('Kliknij w istniejący wiersz — tu nie ma miejsca', 'warning'); return; }
            showToast('Wklejono ' + lines.length + ' (obcięte — koniec tabeli)', 'warning');
        }
        /* Użyj batch/sync paste — obsłuż duże zestawy */
        (lines.length > 100 ? _excelPasteBatch : _excelPasteSync)(lines, startWIdx, colIdx, null);
    }
    showToast('Wklejono', 'info');
}

/* ===== BATCH PASTE (async chunked) ===== */
var _excelPasteCancelFlag = false;

function _excelShowPasteProgress(now, total) {
    var pct = Math.min(100, Math.round(now / total * 100));
    var el = document.getElementById('excel-paste-progress');
    if (!el) {
        el = document.createElement('div');
        el.id = 'excel-paste-progress';
        el.style.cssText = 'position:fixed;bottom:1rem;right:1rem;z-index:99999;background:#1a1d27;border:1px solid rgba(255,255,255,0.1);border-radius:6px;padding:0.75rem 1rem;min-width:260px;box-shadow:0 4px 20px rgba(0,0,0,0.4);';
        el.innerHTML = '<div style="font-size:0.65rem;color:#94a3b8;margin-bottom:0.35rem;">Wklejanie... <span id="excel-paste-pct">0%</span></div>'
            + '<div style="height:4px;background:#0c0e14;border-radius:2px;overflow:hidden;">'
            + '<div id="excel-paste-bar" style="height:100%;width:0%;background:linear-gradient(90deg,#6366f1,#22c55e);transition:width 0.15s;"></div></div>';
        document.body.appendChild(el);
    }
    var bar = document.getElementById('excel-paste-bar');
    var pctEl = document.getElementById('excel-paste-pct');
    if (bar) bar.style.width = pct + '%';
    if (pctEl) pctEl.textContent = pct + '%';
}

function _excelHidePasteProgress() {
    var el = document.getElementById('excel-paste-progress');
    if (el) el.remove();
}

/**
 * Wkleja dane wsadowo w chunkach przez requestAnimationFrame.
 * Nie blokuje UI.
 */
function _excelPasteBatch(lines, startWIdx, startColIdx, doneCallback) {
    var CHUNK = 50;
    var idx = 0;
    var total = lines.length;
    if (total < 100) {
        _excelPasteSync(lines, startWIdx, startColIdx);
        if (doneCallback) doneCallback();
        return;
    }
    _excelShowPasteProgress(0, total);
    function tick() {
        var end = Math.min(idx + CHUNK, total);
        for (; idx < end; idx++) {
            if (_excelPasteCancelFlag) {
                _excelHidePasteProgress();
                _excelPasteCancelFlag = false;
                showToast('Wklejanie przerwane', 'warning');
                return;
            }
            var line = lines[idx];
            var parts = line.split('	');
            var wIdx = startWIdx + idx;
            parts.forEach(function(v, ci) {
                var colIdx = startColIdx + ci;
                var row = document.querySelector('tr[data-widx="' + wIdx + '"]');
                if (!row) return;
                var tdEl = row.children[colIdx];
                var target = tdEl ? tdEl.querySelector('input, select') : null;
                if (target) _excelSetCellValue(target, v.trim());
            });
        }
        _excelShowPasteProgress(idx, total);
        if (idx < total) {
            requestAnimationFrame(tick);
        } else {
            _excelHidePasteProgress();
            if (doneCallback) doneCallback();
        }
    }
    requestAnimationFrame(tick);
}

/** Synchroniczne wklejenie (do 99 wierszy) */
function _excelPasteSync(lines, startWIdx, startColIdx) {
    for (var si = 0; si < lines.length; si++) {
        var parts = lines[si].split('	');
        var wIdx = startWIdx + si;
        parts.forEach(function(v, ci) {
            var colIdx = startColIdx + ci;
            var row = document.querySelector('tr[data-widx="' + wIdx + '"]');
            if (!row) return;
            var tdEl = row.children[colIdx];
            var target = tdEl ? tdEl.querySelector('input, select') : null;
            if (target) _excelSetCellValue(target, v.trim());
        });
    }
}

/**
 * Ustawia wartość komórki (input lub select) i dispatchuje eventy.
 * @param {Element} target
 * @param {string} val
 */
function _excelSetCellValue(target, val) {
    if (target.tagName === 'SELECT') {
        var _sel = /** @type {HTMLSelectElement} */ (target);
        var opt = Array.from(_sel.options).find(function(o) { return o.value === val || o.text === val; });
        if (opt) { _sel.value = opt.value; _sel.dispatchEvent(new Event('change', { bubbles: true })); }
    } else if (target.tagName === 'INPUT') {
        /* Normalizuj separator dziesietny — MS Excel z PL wysyla przecinek, input type=number wymaga kropki */
        var normalizedVal = val;
        var inputType = /** @type {HTMLInputElement} */ (target).type;
        if (inputType === 'number' && typeof normalizedVal === 'string' && normalizedVal.indexOf(',') >= 0 && normalizedVal.indexOf('.') < 0) {
            normalizedVal = normalizedVal.replace(',', '.');
        }
        /** @type {HTMLInputElement} */ (target).value = normalizedVal;
        target.dispatchEvent(new Event('input', { bubbles: true }));
        target.dispatchEvent(new Event('change', { bubbles: true }));
    }
}

/**
 * Zapewnia że tabela ma co najmniej `neededTotal` wierszy w aktywnym tabie.
 * Tworzy brakujące studnie, re-renderuje tabelę i zwraca zaktualizowany NodeList rows.
 * @param {number} neededTotal
 * @param {NodeListOf<Element>} currentRows
 * @returns {NodeListOf<Element>}
 */
function _excelEnsureRowCount(neededTotal, currentRows) {
    var deficit = neededTotal - currentRows.length;
    if (deficit <= 0) return currentRows;
    var dn = _excelActiveTab === 'styczne' ? 'styczna' : parseInt(_excelActiveTab, 10);
    _excelSaveUndoSnapshot();
    for (var i = 0; i < deficit; i++) {
        var well = typeof createNewWell === 'function'
            ? createNewWell(null, /** @type {any} */ (dn))
            : {
                id: 'well_' + Date.now() + '_' + i,
                name: (dn === 'styczna' ? 'Studnia Styczna' : 'Studnia DN' + dn) + ' (#' + (wells.length + 1) + ')',
                dn: dn, config: [], przejscia: [], rzednaWlazu: null, rzednaDna: null,
                kineta: 'brak', psiaBuda: false, redukcjaDN1000: false, redukcjaMinH: 2500
            };
        wells.push(well);
        _excelAutoSetWlaz(well);
    }
    _excelMaxTransitions[_excelActiveTab] = _excelGetMaxTransitions();
    _excelRenderTabs();
    _excelRenderTable(_excelActiveTab);
    _excelUpdateWellCount();
    return document.querySelectorAll('#excel-table-container tbody tr[data-widx]');
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
        _excelMaxTransitions[_excelActiveTab] = _excelGetMaxTransitions();
        _excelRenderTabs();
        _excelRenderTable(_excelActiveTab);
        _excelUpdateWellCount();
        _excelDebouncedRefresh();
        var newWIdx = wells.length - 1;
        if (_excelAutoSelectEnabled && rzw !== null && rzd !== null && rzw > rzd) {
            setTimeout(function() { _excelAutoSelectForWell(newWIdx); }, 200);
        }
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
    if (el.tagName === 'INPUT') {
        el.select();
    }
    _excelUserEditing = true; /* blokuje polling */
    /* Wybór wiersza obsługuje delegowany focusin na container — nie dubluj logiki */
}
function excelCellBlur(el) {
    /* Przywróć tło komórki z data-orig-bg na TD (nie na INPUT) */
    if (el.tagName === 'INPUT') {
        var td = el.closest('td');
        if (td) td.style.boxShadow = '';
    }
    _excelUserEditing = false; /* wznawia polling */
}

/* ===== TAB KEY NAVIGATION ===== */
function _excelHandleTab(e) {
    let target = e.target;
    if (!target) return;
    // Normalizuj target — SELECT → wrapper, wrapper OK, INPUT OK
    if (target.tagName === 'SELECT') {
        var w = target.closest('.excel-sel-wrap');
        if (w) target = w;
    } else if (target.tagName !== 'INPUT' && !(target.classList && target.classList.contains('excel-sel-wrap'))) {
        return;
    }

    const container = document.getElementById('excel-table-container');
    if (!container || !container.contains(target)) return;

    const tr = target.closest('tr');
    if (!tr) return;
    const navEls = _excelGetNavElements(tr);
    var idx = navEls.indexOf(target);
    if (idx === -1) return;

    // Szukaj następnego/poprzedniego nawigacyjnego elementu w wierszu lub następnych wierszach
    e.preventDefault();
    var allRows = Array.from(container.querySelectorAll('tbody tr[data-widx]'));
    var rowIdx = allRows.indexOf(tr);
    var next = null;
    if (!e.shiftKey) {
        next = navEls[idx + 1];
        if (!next && allRows[rowIdx + 1]) {
            var nextRowEls = _excelGetNavElements(allRows[rowIdx + 1]);
            next = nextRowEls[0];
        }
    } else {
        next = navEls[idx - 1];
        if (!next && allRows[rowIdx - 1]) {
            var prevRowEls = _excelGetNavElements(allRows[rowIdx - 1]);
            next = prevRowEls[prevRowEls.length - 1];
        }
    }
    if (next) {
        _excelFocusNavEl(next, navEls, e.shiftKey ? 'left' : 'right');
    }
}

/* ===== ARROW KEY NAVIGATION (Excel-like) ===== */
function _excelHandleArrow(e) {
    /* Kiedy focus jest w pustym wierszu — obsłuż strzałki specjalnie */
    var emptyInput = document.getElementById('excel-empty-name');
    var emptyRzw = document.getElementById('excel-empty-rzw');
    var emptyRzd = document.getElementById('excel-empty-rzd');
    if (emptyInput && (e.target === emptyInput || e.target === emptyRzw || e.target === emptyRzd)) {
        e.preventDefault();
        if (e.key === 'ArrowDown') {
            return; /* nic poniżej */
        }
        if (e.key === 'ArrowUp') {
            e.preventDefault();
            var drUp = document.querySelectorAll('#excel-table-container tbody tr[data-widx]');
            var lastRowUp = drUp[drUp.length - 1];
            if (lastRowUp) {
                var lastElsUp = _excelGetNavElements(lastRowUp);
                /* Wybor kolumny z zapisanej wartosci _excelLastDataCol */
                var targetEl = null;
                var savedCol = typeof _excelLastDataCol === 'number' ? _excelLastDataCol : -1;
                if (savedCol >= 0 && savedCol < lastRowUp.children.length) {
                    var tdAtCol = lastRowUp.children[savedCol];
                    if (tdAtCol) {
                        var inpAtCol = tdAtCol.querySelector('input, select, .excel-sel-wrap');
                        if (inpAtCol) targetEl = inpAtCol;
                    }
                }
                if (!targetEl && lastElsUp.length > 0) {
                    /* Fallback: ostatni focusowalny element w ostatnim wierszu */
                    targetEl = lastElsUp[lastElsUp.length - 1];
                }
                if (targetEl) _excelFocusNavEl(targetEl, lastElsUp, 'up');
            }
            return;
        }
        if (e.key === 'ArrowRight' || e.key === 'Tab') {
            e.preventDefault();
            if (e.target === emptyInput && emptyRzw) emptyRzw.focus();
            else if (e.target === emptyRzw && emptyRzd) emptyRzd.focus();
            return;
        }
        if (e.key === 'ArrowLeft' || (e.key === 'Tab' && e.shiftKey)) {
            e.preventDefault();
            if (e.target === emptyRzd && emptyRzw) emptyRzw.focus();
            else if (e.target === emptyRzw && emptyInput) emptyInput.focus();
            return;
        }
        return;
    }

    let target = e.target;
    if (!target) return;

    // Normalizuj target do elementu nawigacyjnego: INPUT lub DIV.excel-sel-wrap
    target = _excelNormalizeNavTarget(target);
    if (!target) return;

    const container = document.getElementById('excel-table-container');
    if (!container || !container.contains(target)) return;

    const tr = target.closest('tr');
    if (!tr) return;

    // Znajdź wiersze data (pomiń empty-row)
    const allRows = Array.from(container.querySelectorAll('tbody tr'));
    const dataRows = allRows.filter(r => r.hasAttribute('data-widx'));
    const currentRowIdx = dataRows.indexOf(tr);
    if (currentRowIdx === -1) return;

    // Zbierz fokusowalne elementy: INPUT + DIV.excel-sel-wrap
    const rowEls = _excelGetNavElements(tr);
    const colIdx = rowEls.indexOf(target);
    if (colIdx === -1) {
        if (typeof window.logger !== 'undefined') window.logger.warn('excel-nav', 'colIdx=-1 target=' + target.tagName + ' class=' + (target.className || ''));
        return;
    }

    let next = null;

    if (e.key === 'ArrowRight') {
        next = rowEls[colIdx + 1] || null;
    } else if (e.key === 'ArrowLeft') {
        next = rowEls[colIdx - 1] || null;
    } else if (e.key === 'ArrowDown') {
        var nextRow = dataRows[currentRowIdx + 1];
        if (!nextRow) {
            /* zapamietaj indeks td.children (nie index z rowEls) */
            var tddx = target.closest('td');
            if (tddx && tddx.parentElement === tr) {
                _excelLastDataCol = Array.prototype.indexOf.call(tr.children, tddx);
            }
            /* ostatni rzad danych — przejdz do pustego wiersza */
            var emptyInput = document.getElementById('excel-empty-name');
            if (emptyInput) {
                e.preventDefault();
                _excelFocusNavEl(emptyInput, [], 'down');
            }
            return;
        }
        var downWIdx = parseInt(nextRow.getAttribute('data-widx'));
        if (!isNaN(downWIdx) && typeof currentWellIndex !== 'undefined' && downWIdx !== currentWellIndex) {
            excelSelectRow(downWIdx);
        }
        var nextEls = _excelGetNavElements(nextRow);
        next = nextEls[Math.min(colIdx, nextEls.length - 1)] || null;
        next = _excelSkipDisabled(next, nextEls, colIdx, 1);
    } else if (e.key === 'ArrowUp') {
        const prevRow = dataRows[currentRowIdx - 1];
        if (prevRow) {
            var upWIdx = parseInt(prevRow.getAttribute('data-widx'));
            if (!isNaN(upWIdx) && typeof currentWellIndex !== 'undefined' && upWIdx !== currentWellIndex) {
                excelSelectRow(upWIdx);
            }
            const prevEls = _excelGetNavElements(prevRow);
            next = prevEls[Math.min(colIdx, prevEls.length - 1)] || null;
            next = _excelSkipDisabled(next, prevEls, colIdx, -1);
        }
    }

    if (next) {
        _excelFocusNavEl(next, rowEls, e.key.replace('Arrow', '').toLowerCase());
    }
}

/** Normalizuj dowolny target do elementu nawigacyjnego (INPUT lub DIV.excel-sel-wrap) */
function _excelNormalizeNavTarget(el) {
    if (!el) return null;
    // INPUT — OK
    if (el.tagName === 'INPUT') return el;
    // SELECT — szukaj wrappera, fallback na sam SELECT
    if (el.tagName === 'SELECT') {
        var wrap = el.closest('.excel-sel-wrap');
        return wrap || el;
    }
    // DIV.excel-sel-wrap — OK
    if (el.classList && el.classList.contains('excel-sel-wrap')) return el;
    // Inny element wewnątrz wrappera
    if (el.closest) {
        var parentWrap = el.closest('.excel-sel-wrap');
        if (parentWrap) return parentWrap;
    }
    return null;
}

/** Zbierz fokusowalne elementy nawigacji w wierszu: INPUT + DIV.excel-sel-wrap */
function _excelGetNavElements(row) {
    var els = [];
    var cells = row.querySelectorAll('td');
    for (var i = 0; i < cells.length; i++) {
        // Priorytet: wrapper selecta (DIV.excel-sel-wrap)
        var wrap = cells[i].querySelector('.excel-sel-wrap');
        if (wrap) {
            els.push(wrap);
            continue;
        }
        // INPUT
        var inp = cells[i].querySelector('input');
        if (inp) {
            els.push(inp);
            continue;
        }
        // Fallback: natywny select bez wrappera
        var sel = cells[i].querySelector('select');
        if (sel) {
            els.push(sel);
        }
    }
    return els;
}

/** Pomiń disabled elementy — szukaj enabled w kierunku +1/-1 */
function _excelSkipDisabled(el, els, startIdx, dir) {
    if (!el || !_excelIsDisabledNav(el)) return el;
    var from = Math.min(startIdx, els.length - 1);
    // Szukaj dalej w kierunku dir
    for (var i = from + dir; i >= 0 && i < els.length; i += dir) {
        if (!_excelIsDisabledNav(els[i])) return els[i];
    }
    // Szukaj w przeciwnym kierunku
    for (i = from - dir; i >= 0 && i < els.length; i -= dir) {
        if (!_excelIsDisabledNav(els[i])) return els[i];
    }
    return null;
}

/** Sprawdź czy element nawigacyjny jest disabled */
function _excelIsDisabledNav(el) {
    if (!el) return true;
    if (el.disabled) return true;
    // Wrapper z disabled selectem
    if (el.classList && el.classList.contains('excel-sel-wrap')) {
        var sel = el.querySelector('select');
        return sel && sel.disabled;
    }
    return false;
}

/** Focusuj element nawigacji, pomijając disabled — iteracyjnie (bez ryzyka stack overflow) */
function _excelFocusNavEl(el, rowEls, dir) {
    if (!el) return;
    var step = (dir === 'right' || dir === 'down') ? 1 : -1;
    var limit = rowEls.length + 1; /* max iteracji = rozmiar wiersza + 1 */
    var cur = el;
    while (cur && limit-- > 0) {
        if (!_excelIsDisabledNav(cur)) {
            cur.focus();
            /* Scroll-into-view bez scrollIntoView (nie uwzglednia sticky headera) */
            var container = document.getElementById('excel-table-container');
            var headerEl = document.querySelector('#excel-table-container thead');
            var headerH = headerEl ? (/** @type {HTMLElement} */ (headerEl)).offsetHeight : 60;
            var MARGIN = 5;
            /* Reczna korekta scroll — element MUSI byc widoczny ponizej sticky headera */
            if (container) {
                var elRect = cur.getBoundingClientRect();
                var containerRect = container.getBoundingClientRect();
                /* Jesli element jest nad widocznym obszarem (elRect.top < containerRect.top + headerH)
                   lub calkowicie poza viewport — przewin w dol */
                if (elRect.top < containerRect.top + headerH + MARGIN) {
                    /* Element za wysoko / zakryty headerm — przewin w dol */
                    var diffDown = (containerRect.top + headerH + MARGIN) - elRect.top;
                    container.scrollTop -= diffDown;
                } else if (elRect.top + elRect.height > containerRect.bottom) {
                    /* Element za nisko — przewin w gore (w gore kontenera) */
                    var diffUp = elRect.bottom - containerRect.bottom + MARGIN;
                    container.scrollTop += diffUp;
                }
            }
            if (cur.tagName === 'INPUT' && !cur.disabled && cur.select) cur.select();
            var tr = cur.closest('tr[data-widx]');
            if (tr) {
                var wIdx = parseInt(tr.getAttribute('data-widx'), 10);
                if (!isNaN(wIdx) && (typeof currentWellIndex === 'undefined' || wIdx !== currentWellIndex)) {
                    excelSelectRow(wIdx);
                }
            }
            return;
        }
        var curIdx = rowEls.indexOf(cur);
        cur = rowEls[curIdx + step] || null;
    }
}

/* ===== HANDLERS ===== */
function excelOnRzednaChange(wIdx) {
    const row = document.querySelector(`tr[data-widx="${wIdx}"]`);
    if (!row) return;
    _excelClearResCache(wells[wIdx]);
    const rzWlazuInput = row.querySelector('input[data-field="rzednaWlazu"]');
    const rzDnaInput = row.querySelector('input[data-field="rzednaDna"]');
    const rzWlazu = rzWlazuInput ? parseFloat(rzWlazuInput.value) : null;
    const rzDnaRaw = rzDnaInput ? parseFloat(rzDnaInput.value) : null;
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
    if (_excelAutoSelectEnabled && rzWlazu !== null && rzDna !== null && rzWlazu > rzDna
        && typeof autoSelectComponents === 'function') {
        _excelAutoSelectForWell(wIdx);
    }
    /* Nie wywołuj _excelDebouncedRefresh — wysokość nie zmienia kodów h3,
       a _excelRefreshAutoCells juz zaktualizowalo height/uszcz cells */
}

/* ===== DODAWANIE / USUWANIE KOLUMNY PRZEJŚCIA ===== */
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
function _excelCleanEmptyPrzejscia(well) {
    if (!well || !well.przejscia) return;
    /* Zachowaj tylko przejścia z productId LUB w trakcie wyboru (tempCategory, rzednaWlaczenia) */
    well.przejscia = well.przejscia.filter(function(p) {
        return (p.productId && p.productId !== '') || (p.tempCategory && p.tempCategory !== '') || (p.rzednaWlaczenia != null && p.rzednaWlaczenia !== '');
    });
}

function excelOnPrzejscieChange(wIdx, trIdx, field, value) {
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

function excelOnCompChange(wIdx, componentType, height, value, productId, redDn) {
    _excelSaveUndoSnapshot();
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
            ).filter(
                (p) => p.componentType === componentType && parseInt(p.dn) === filterDn
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

/* ===== PARAM. BUTTON — popup parametrów studni w Excelu — kafelki ===== */
function _excelUpdateWellParam(wIdx, paramKey, value) {
    const well = wells[wIdx];
    if (!well) return;
    well[paramKey] = value;
    /* Cena malowania — aktualizuj we wszystkich studniach */
    if (paramKey === 'malowanieWewCena' || paramKey === 'malowanieZewCena') {
        wells.forEach(function(w) { w[paramKey] = value; });
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
    if (existing) { existing.remove(); excelOpenWellParams(wIdx); }
}

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
                bodyHtml += `<button onclick="_excelUpdateWellParam(${wIdx},'${def.key}','${val}')" style="height:34px;border-radius:8px;cursor:pointer;font-size:0.85rem;font-weight:${active?'800':'600'};border:1px solid ${active?'rgba(99,102,241,0.6)':'rgba(255,255,255,0.08)'};background:${active?'rgba(99,102,241,0.25)':'rgba(255,255,255,0.04)'};color:${active?'#a5b4fc':'var(--text-secondary)'};transition:all 0.15s ease;display:flex;align-items:center;justify-content:center;${active?'box-shadow:0 0 10px rgba(99,102,241,0.2);':''}" onmouseenter="if(!${active}){this.style.borderColor='rgba(99,102,241,0.3)';this.style.background='rgba(255,255,255,0.08)'}" onmouseleave="if(!${active}){this.style.borderColor='rgba(255,255,255,0.08)';this.style.background='rgba(255,255,255,0.04)'}">${lbl}</button>`;
            });
            bodyHtml += `</div></div>`;

            /* Pola dodatkowe — malowanie wew. */
            if (def.key === 'malowanieW' && well.malowanieW && well.malowanieW !== 'brak') {
                bodyHtml += `<div style="display:flex;align-items:center;gap:0.2rem;min-height:32px;margin-top:0.3rem;">`;
                bodyHtml += `<span style="font-size:0.85rem;color:var(--text-muted);font-weight:700;white-space:nowrap;min-width:185px;text-align:left;">Nazwa p. wew.</span>`;
                bodyHtml += `<input type="text" value="${escapeHtml(well.powlokaNameW || '')}" onclick="this.select()" onchange="_excelUpdateWellParam('powlokaNameW',this.value);excelRefreshParamsPopup(${wIdx})" placeholder="Nazwa powłoki..." style="flex:1;max-width:260px;height:36px;background:rgba(0,0,0,0.2);border:1px solid rgba(255,255,255,0.1);color:var(--text-primary);padding:0 0.7rem;font-size:0.85rem;border-radius:6px;">`;
                bodyHtml += `</div>`;
                bodyHtml += `<div style="display:flex;align-items:center;gap:0.2rem;min-height:32px;margin-top:0.3rem;">`;
                bodyHtml += `<span style="font-size:0.85rem;color:var(--text-muted);font-weight:700;white-space:nowrap;min-width:185px;text-align:left;">Koszt p. wew.</span>`;
                bodyHtml += `<input type="number" step="0.01" value="${well.malowanieWewCena || ''}" onclick="this.select()" onchange="_excelUpdateWellParam('malowanieWewCena',parseFloat(this.value)||0);excelRefreshParamsPopup(${wIdx})" placeholder="PLN / m²" style="width:100px;height:36px;background:rgba(0,0,0,0.2);border:1px solid rgba(255,255,255,0.1);color:var(--text-primary);padding:0 0.7rem;font-size:0.85rem;border-radius:6px;">`;
                bodyHtml += `</div>`;
            }
            /* Pola dodatkowe — malowanie zew. */
            if (def.key === 'malowanieZ' && well.malowanieZ && well.malowanieZ !== 'brak') {
                bodyHtml += `<div style="display:flex;align-items:center;gap:0.2rem;min-height:32px;margin-top:0.3rem;">`;
                bodyHtml += `<span style="font-size:0.85rem;color:var(--text-muted);font-weight:700;white-space:nowrap;min-width:185px;text-align:left;">Nazwa p. zew.</span>`;
                bodyHtml += `<input type="text" value="${escapeHtml(well.powlokaNameZ || '')}" onclick="this.select()" onchange="_excelUpdateWellParam('powlokaNameZ',this.value);excelRefreshParamsPopup(${wIdx})" placeholder="Nazwa powłoki..." style="flex:1;max-width:260px;height:36px;background:rgba(0,0,0,0.2);border:1px solid rgba(255,255,255,0.1);color:var(--text-primary);padding:0 0.7rem;font-size:0.85rem;border-radius:6px;">`;
                bodyHtml += `</div>`;
                bodyHtml += `<div style="display:flex;align-items:center;gap:0.2rem;min-height:32px;margin-top:0.3rem;">`;
                bodyHtml += `<span style="font-size:0.85rem;color:var(--text-muted);font-weight:700;white-space:nowrap;min-width:185px;text-align:left;">Koszt p. zew.</span>`;
                bodyHtml += `<input type="number" step="0.01" value="${well.malowanieZewCena || ''}" onclick="this.select()" onchange="_excelUpdateWellParam('malowanieZewCena',parseFloat(this.value)||0);excelRefreshParamsPopup(${wIdx})" placeholder="PLN / m²" style="width:100px;height:36px;background:rgba(0,0,0,0.2);border:1px solid rgba(255,255,255,0.1);color:var(--text-primary);padding:0 0.7rem;font-size:0.85rem;border-radius:6px;">`;
                bodyHtml += `</div>`;
            }
        });
    }
    bodyHtml += `</div>`;

    modal.innerHTML = `
        <div style="display:flex;align-items:center;justify-content:space-between;padding:0.5rem 0.8rem;background:#10131a;border-bottom:1px solid rgba(255,255,255,0.06);flex-shrink:0;">
            <span style="font-size:0.85rem;font-weight:700;color:var(--text-primary);">Parametry: ${escapeHtml(well.name)}</span>
            <button onclick="document.getElementById('excel-params-popup').remove()" style="background:#13151f;color:var(--text-muted);border:none;cursor:pointer;font-size:1.1rem;">✕</button>
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
    _excelSaveUndoSnapshot();
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
    _excelMaxTransitions[_excelActiveTab] = _excelGetMaxTransitions();
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
    _excelMaxTransitions[_excelActiveTab] = _excelGetMaxTransitions();
    _excelRenderTabs();
    _excelRenderTable(_excelActiveTab);
    _excelUpdateWellCount();
    _excelDebouncedRefresh();
    if (typeof renderWellConfig === 'function') renderWellConfig();
    showToast('Studnia usunięta', 'info');
}

/* ===== DROPDOWN MENU DODAJ ===== */
function _excelToggleAddMenu() {
    var menu = document.getElementById('excel-add-dropdown');
    if (!menu) return;
    menu.style.display = menu.style.display === 'none' ? 'block' : 'none';
    if (menu.style.display === 'block') {
        var close = function(e) {
            if (!e.target.closest('#excel-add-menu-container')) {
                menu.style.display = 'none';
                document.removeEventListener('click', close);
            }
        };
        setTimeout(function() { document.addEventListener('click', close); }, 10);
    }
}

/* ===== DODAWANIE RĘCZNE — DIALOG ===== */
function excelShowAddDialog() {
    var dns = ['1000','1200','1500','2000','2500','styczne'];
    var dnOpts = dns.map(function(d) {
        var label = d === 'styczne' ? 'Styczna' : 'DN' + d;
        var sel = d === _excelActiveTab || (d === 'styczne' && _excelActiveTab === 'styczne') ? ' selected' : '';
        return '<option value="' + d + '"' + sel + '>' + label + '</option>';
    }).join('');

    var html = '<div id="excel-add-dialog-overlay" style="position:fixed;inset:0;z-index:10001;background:rgba(0,0,0,0.6);display:flex;align-items:center;justify-content:center;">'
        + '<div style="background:#1a1d27;border:1px solid rgba(255,255,255,0.08);border-radius:6px;padding:1.2rem;min-width:380px;max-width:460px;box-shadow:0 20px 60px rgba(0,0,0,0.5);">'
        + '<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:1rem;">'
        + '<strong style="color:#e2e8f0;font-size:0.75rem;">Dodaj studnię</strong>'
        + '<button onclick="document.getElementById(\'excel-add-dialog-overlay\').remove()" style="background:none;border:none;color:#64748b;font-size:0.8rem;cursor:pointer;">✕</button>'
        + '</div>'
        + '<div style="display:grid;grid-template-columns:80px 1fr;gap:0.5rem 0.7rem;font-size:0.65rem;color:#94a3b8;margin-bottom:1rem;">'
        + '<label>Nazwa</label><input id="dlg-name" type="text" placeholder="np. a1" style="padding:0.3rem 0.5rem;background:#13151f;border:1px solid rgba(255,255,255,0.08);border-radius:3px;color:#e2e8f0;font-size:0.65rem;" />'
        + '<label>DN</label><select id="dlg-dn" style="padding:0.3rem 0.5rem;background:#13151f;border:1px solid rgba(255,255,255,0.08);border-radius:3px;color:#e2e8f0;font-size:0.65rem;">' + dnOpts + '</select>'
        + '<label>Rz. włazu</label><input id="dlg-rzw" type="number" step="0.01" placeholder="np. 5.00" style="padding:0.3rem 0.5rem;background:#13151f;border:1px solid rgba(255,255,255,0.08);border-radius:3px;color:#e2e8f0;font-size:0.65rem;" />'
        + '<label>Rz. dna</label><input id="dlg-rzd" type="number" step="0.01" placeholder="np. 0.00" value="0" style="padding:0.3rem 0.5rem;background:#13151f;border:1px solid rgba(255,255,255,0.08);border-radius:3px;color:#e2e8f0;font-size:0.65rem;" />'
        + '</div>'
        + '<div style="border-top:1px solid rgba(255,255,255,0.06);padding-top:0.7rem;display:flex;gap:0.5rem;justify-content:flex-end;">'
        + '<button onclick="document.getElementById(\'excel-add-dialog-overlay\').remove()" style="padding:0.3rem 0.7rem;background:transparent;border:1px solid rgba(255,255,255,0.1);border-radius:3px;color:#94a3b8;font-size:0.65rem;cursor:pointer;">Anuluj</button>'
        + '<button onclick="_excelCreateFromDialog()" style="padding:0.3rem 1rem;background:rgba(16,185,129,0.2);border:1px solid rgba(16,185,129,0.3);border-radius:3px;color:#6ee7b7;font-size:0.65rem;font-weight:700;cursor:pointer;">Dodaj</button>'
        + '</div></div></div>';
    document.body.insertAdjacentHTML('beforeend', html);
    if (typeof lucide !== 'undefined') lucide.createIcons();
    setTimeout(function() { var inp = document.getElementById('dlg-name'); if (inp) inp.focus(); }, 100);
    var container = document.getElementById('excel-add-dialog-overlay');
    if (container) {
        container.addEventListener('keydown', function(e) {
            if (e.key === 'Enter') _excelCreateFromDialog();
            if (e.key === 'Escape') container.remove();
        });
    }
}

function _excelCreateFromDialog() {
    var name = (document.getElementById('dlg-name')?.value || '').trim();
    var dn = document.getElementById('dlg-dn')?.value || '1000';
    var rzwParsed = parseFloat(document.getElementById('dlg-rzw')?.value);
    var rzdParsed = parseFloat(document.getElementById('dlg-rzd')?.value);
    var rzw = isNaN(rzwParsed) ? null : rzwParsed;
    var rzd = isNaN(rzdParsed) ? null : rzdParsed;
    if (!name) { showToast('Podaj nazwę studni', 'error'); return; }
    if (wells.some(function(w) { return w.name === name; })) { showToast('Nazwa "' + name + '" już istnieje', 'error'); return; }
    if (rzw === null) { showToast('Podaj rządną włazu', 'error'); return; }
    if (rzd === null) rzd = 0;
    if (rzw <= rzd) { showToast('Rzędna włazu musi być > rzędnej dna', 'error'); return; }
    var dnVal = dn === 'styczne' ? 'styczna' : parseInt(dn);
    var well = typeof createNewWell === 'function' ? createNewWell(name, dnVal) : { id: 'well_' + Date.now(), name: name, dn: dnVal, config: [], przejscia: [], rzednaWlazu: rzw, rzednaDna: rzd, kineta: 'brak', psiaBuda: false, redukcjaDN1000: false, redukcjaMinH: 2500 };
    well.name = name; well.rzednaWlazu = rzw; well.rzednaDna = rzd;
    wells.push(well);
    _excelAutoSetWlaz(well);
    _excelMaxTransitions[_excelActiveTab] = _excelGetMaxTransitions();
    _excelRenderTabs(); _excelRenderTable(_excelActiveTab); _excelUpdateWellCount();
    var overlay = document.getElementById('excel-add-dialog-overlay');
    if (overlay) overlay.remove();
    var newWIdx = wells.length - 1;
    if (_excelAutoSelectEnabled && rzw != null && rzd != null) { setTimeout(function() { _excelAutoSelectForWell(newWIdx); }, 100); }
    setTimeout(function() { excelSelectRow(newWIdx); }, 50);
    _excelDebouncedRefresh();
    showToast('Dodano: ' + name, 'success');
}

/* ===== WKLEJ LISTĘ STUDNI ===== */
function excelShowPasteDialog() {
    if (!document.getElementById('excel-table-overlay')) return;
    var html = '<div id="excel-paste-dialog-overlay" style="position:fixed;inset:0;z-index:10001;background:rgba(0,0,0,0.6);display:flex;align-items:center;justify-content:center;">'
        + '<div style="background:#1a1d27;border:1px solid rgba(255,255,255,0.08);border-radius:6px;padding:1.2rem;min-width:420px;max-width:520px;box-shadow:0 20px 60px rgba(0,0,0,0.5);">'
        + '<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:0.7rem;">'
        + '<strong style="color:#e2e8f0;font-size:0.75rem;">Wklej listę studni</strong>'
        + '<button onclick="document.getElementById(\'excel-paste-dialog-overlay\').remove()" style="background:none;border:none;color:#64748b;font-size:0.8rem;cursor:pointer;">✕</button>'
        + '</div>'
        + '<div style="font-size:0.6rem;color:#64748b;margin-bottom:0.5rem;">Wklej dane z arkusza (TAB, przecinek, średnik, | lub odstęp)</div>'
        + '<textarea id="paste-textarea" style="width:100%;height:140px;padding:0.5rem;background:#0c0e14;border:1px solid rgba(255,255,255,0.08);border-radius:3px;color:#e2e8f0;font-size:0.65rem;font-family:Consolas,Menlo,monospace;resize:vertical;white-space:pre;tab-size:2;" placeholder="Nazwa	DN	Rz.włazu	Rz.dna&#10;a1	1000	5.00	0.00&#10;a2	1000	4.50	0.00"></textarea>'
        + '<div id="paste-preview" style="font-size:0.6rem;color:#64748b;max-height:60px;overflow-y:auto;margin:0.3rem 0;padding:0.2rem;background:#0c0e14;border-radius:3px;"></div>'
        + '<div style="display:flex;gap:0.5rem;justify-content:flex-end;">'
        + '<button onclick="document.getElementById(\'excel-paste-dialog-overlay\').remove()" style="padding:0.3rem 0.7rem;background:transparent;border:1px solid rgba(255,255,255,0.1);border-radius:3px;color:#94a3b8;font-size:0.65rem;cursor:pointer;">Anuluj</button>'
        + '<button onclick="_excelImportPasteList()" style="padding:0.3rem 1rem;background:rgba(59,130,246,0.2);border:1px solid rgba(59,130,246,0.3);border-radius:3px;color:#93c5fd;font-size:0.65rem;font-weight:700;cursor:pointer;">Importuj</button>'
        + '</div></div></div>';
    document.body.insertAdjacentHTML('beforeend', html);
    if (typeof lucide !== 'undefined') lucide.createIcons();
    var ta = document.getElementById('paste-textarea');
    if (ta) { ta.addEventListener('input', _excelUpdatePastePreview); ta.focus(); }
    var c = document.getElementById('excel-paste-dialog-overlay');
    if (c) c.addEventListener('keydown', function(e) { if (e.key === 'Escape') c.remove(); });
}

function _excelUpdatePastePreview() {
    var ta = document.getElementById('paste-textarea');
    var prev = document.getElementById('paste-preview');
    if (!ta || !prev) return;
    var text = ta.value.trim();
    if (!text) { prev.textContent = ''; return; }
    var rows = _excelParsePasteData(text);
    prev.innerHTML = rows.length > 0 ? 'Rozpoznano <strong>' + rows.length + '</strong> studni' : '(brak danych)';
}

function _excelParsePasteData(text) {
    var lines = text.split('\n').map(function(l) { return l.trim(); }).filter(function(l) { return l; });
    if (lines.length === 0) return [];
    var sep = '\t';
    if (!lines[0].includes('\t')) {
        if (lines[0].includes('|')) sep = '|';
        else if (lines[0].includes(';')) sep = ';';
        else if (lines[0].includes(',')) sep = ',';
        else sep = null;
    }
    var rows = [], headerKeys = null;
    for (var i = 0; i < lines.length; i++) {
        var parts = sep ? lines[i].split(sep).map(function(p) { return p.trim(); }) : lines[i].split(/\s+/).filter(function(p) { return p; });
        if (parts.length < 2) continue;
        var lower = parts.map(function(p) { return p.toLowerCase(); });
        if (lower.some(function(p) { return p === 'nazwa' || p === 'nr' || p === 'lp'; })) {
            headerKeys = parts.map(function(p) { return _excelDetectColumn(p); });
            continue;
        }
        var row = {};
        if (headerKeys) { for (var j = 0; j < Math.min(parts.length, headerKeys.length); j++) { if (headerKeys[j]) row[headerKeys[j]] = parts[j]; } }
        else { row.name = parts[0]; row.dn = parts[1]; row.rzednaWlazu = parts[2]; row.rzednaDna = parts[3]; }
        if (row.name) rows.push(row);
    }
    return rows;
}

function _excelDetectColumn(label) {
    var l = label.toLowerCase();
    if (l === 'nazwa' || l === 'name' || l === 'nr' || l === 'lp' || l === 'studnia') return 'name';
    if (l === 'dn' || l === 'średnica' || l === 'srednica') return 'dn';
    if (l === 'rz.włazu' || l === 'rz wlazu' || l === 'rzędna włazu' || l === 'rz.w' || l === 'wlazu') return 'rzednaWlazu';
    if (l === 'rz.dna' || l === 'rz dna' || l === 'rzędna dna' || l === 'rz.d' || l === 'dna') return 'rzednaDna';
    return null;
}

function _excelImportPasteList() {
    var ta = document.getElementById('paste-textarea');
    if (!ta) return;
    var text = ta.value.trim();
    if (!text) { showToast('Wklej dane studni', 'error'); return; }
    var rows = _excelParsePasteData(text);
    if (rows.length === 0) { showToast('Nie rozpoznano danych', 'error'); return; }
    var added = 0;
    rows.forEach(function(row) {
        var name = String(row.name || '');
        if (!name) return;
        if (wells.some(function(w) { return w.name === name; })) return;
        var dn = row.dn || String(_excelActiveTab);
        var dnVal = dn === 'styczne' || dn === 'styczna' ? 'styczna' : parseInt(dn, 10);
        if (typeof dnVal === 'number' && isNaN(dnVal)) dnVal = 1000;
        var rzw = row.rzednaWlazu ? parseFloat(String(row.rzednaWlazu).replace(',','.')) : null;
        var rzd = row.rzednaDna ? parseFloat(String(row.rzednaDna).replace(',','.')) : 0;
        var well = typeof createNewWell === 'function' ? createNewWell(name, dnVal) : { id: 'well_' + Date.now() + '_' + added, name: name, dn: dnVal, config: [], przejscia: [], rzednaWlazu: rzw, rzednaDna: rzd, kineta: 'brak', psiaBuda: false, redukcjaDN1000: false, redukcjaMinH: 2500 };
        if (rzw !== null) well.rzednaWlazu = rzw;
        if (rzd !== null) well.rzednaDna = rzd;
        wells.push(well);
        _excelAutoSetWlaz(well);
        added++;
    });
    var overlay = document.getElementById('excel-paste-dialog-overlay');
    if (added === 0) { showToast('Nie dodano żadnej studni (duplikaty?)', 'info'); return; }
    _excelMaxTransitions[_excelActiveTab] = _excelGetMaxTransitions();
    _excelRenderTabs();
    _excelRenderTable(_excelActiveTab);
    _excelUpdateWellCount();
    if (_excelAutoSelectEnabled) {
        for (var k = 0; k < added; k++) {
            (function(idx) {
                setTimeout(function() {
                    var nwi = wells.length - added + idx;
                    var w = wells[nwi];
                    if (w && w.rzednaWlazu != null && w.rzednaDna != null) {
                        _excelAutoSelectForWell(nwi).catch(function(e) {
                            if (console.warn) console.warn('AutoSelect pominiety dla nowej studni:', e.message || e);
                        });
                    }
                }, 200 + idx * 300);
            })(k);
        }
    }
    _excelDebouncedRefresh();
}

/* ===== UNDO / REDO (simple snapshot stack) ===== */
let _excelUndoStack = [];
let _excelRedoStack = [];
const _EXCEL_UNDO_LIMIT = 20;

function _excelSaveUndoSnapshot() {
    if (typeof wells === 'undefined') return;
    _excelUndoStack.push(JSON.parse(JSON.stringify(wells)));
    if (_excelUndoStack.length > _EXCEL_UNDO_LIMIT) _excelUndoStack.shift();
    _excelRedoStack = [];
}

function _excelUndo() {
    if (_excelUndoStack.length === 0) return;
    _excelRedoStack.push(JSON.parse(JSON.stringify(wells)));
    var snap = _excelUndoStack.pop();
    wells.splice(0, wells.length, ...snap);
    _excelRenderTable(_excelActiveTab);
    showToast('Cofnięto', 'info');
}

function _excelRedo() {
    if (_excelRedoStack.length === 0) return;
    _excelUndoStack.push(JSON.parse(JSON.stringify(wells)));
    var snap = _excelRedoStack.pop();
    wells.splice(0, wells.length, ...snap);
    _excelRenderTable(_excelActiveTab);
    showToast('Przywrócono', 'info');
}

/* ===== PASTE DO PUSTEGO WIERSZA → nowe studnie ===== */
function _excelPasteCreateWells(text) {
    var parsed = _excelParsePasteData(text);
    /* Jesli parser nie rozpoznal danych, sprobuj prostrzy format: kazda linia = nazwa studni */
    if (parsed.length === 0) {
        var lines = text.trim().split(String.fromCharCode(10)).map(function(l) { return l.replace(String.fromCharCode(13), '').trim(); }).filter(function(l) { return l; });
        if (lines.length > 0) {
            var dn = _excelActiveTab || '1000';
            _excelSaveUndoSnapshot();
            var added = 0;
            for (var fi = 0; fi < lines.length; fi++) {
                var name = lines[fi];
                if (!name) continue;
                var dnVal = dn === 'styczne' ? 'styczna' : parseInt(dn, 10);
                if (typeof dnVal === 'number' && isNaN(dnVal)) dnVal = 1000;
                var well = typeof createNewWell === 'function' ? createNewWell(name, dnVal) : { id: 'well_' + Date.now() + '_' + added, name: name, dn: dnVal, config: [], przejscia: [], rzednaWlazu: null, rzednaDna: null, kineta: 'brak', psiaBuda: false, redukcjaDN1000: false, redukcjaMinH: 2500 };
                well.name = name; /* pozwól na duplikaty */
                wells.push(well);
                _excelAutoSetWlaz(well);
                added++;
            }
            if (added > 0) {
                _excelMaxTransitions[_excelActiveTab] = _excelGetMaxTransitions();
                _excelRenderTabs(); _excelRenderTable(_excelActiveTab); _excelUpdateWellCount();
                _excelDebouncedRefresh();
                showToast('Dodano ' + added + ' studni', 'success');
                return;
            }
            showToast('Brak danych do wklejenia', 'info');
            return;
        }
        showToast('Nie rozpoznano danych', 'error');
        return;
    }
    var dn = _excelActiveTab || '1000';
    _excelSaveUndoSnapshot();
    var added = 0;
    parsed.forEach(function(row) {
        var name = String(row.name || '').trim();
        if (!name) return;
        /* pozwól na duplikaty — nie sprawdzamy 'wells.some' */
        var dnVal = row.dn || String(dn);
        dnVal = dnVal === 'styczne' || dnVal === 'styczna' ? 'styczna' : parseInt(dnVal, 10);
        if (typeof dnVal === 'number' && isNaN(dnVal)) dnVal = 1000;
        var rzw = row.rzednaWlazu ? parseFloat(String(row.rzednaWlazu).replace(',','.')) : null;
        var rzd = row.rzednaDna ? parseFloat(String(row.rzednaDna).replace(',','.')) : 0;
        var well = typeof createNewWell === 'function' ? createNewWell(name, dnVal) : { id: 'well_' + Date.now() + '_' + added, name: name, dn: dnVal, config: [], przejscia: [], rzednaWlazu: rzw, rzednaDna: rzd, kineta: 'brak', psiaBuda: false, redukcjaDN1000: false, redukcjaMinH: 2500 };
        if (rzw !== null) well.rzednaWlazu = rzw;
        if (rzd !== null) well.rzednaDna = rzd;
        wells.push(well);
        _excelAutoSetWlaz(well);
        added++;
    });
    if (added === 0) { showToast('Nie dodano żadnej studni', 'info'); return; }
    _excelMaxTransitions[_excelActiveTab] = _excelGetMaxTransitions();
    _excelRenderTabs(); _excelRenderTable(_excelActiveTab); _excelUpdateWellCount();
    if (_excelAutoSelectEnabled) {
        for (var k = 0; k < added; k++) {
            (function(idx) {
                setTimeout(function() {
                    var nwi = wells.length - added + idx;
                    var w = wells[nwi];
                    if (w && w.rzednaWlazu != null && w.rzednaDna != null) {
                        _excelAutoSelectForWell(nwi).catch(function(e) {
                            if (console.warn) console.warn('AutoSelect pominiety dla nowej studni:', e.message || e);
                        });
                    }
                }, 200 + idx * 300);
            })(k);
        }
    }
    _excelDebouncedRefresh();
    showToast('Dodano ' + added + ' studni', 'success');
}

/* ===== KEYBOARD SHORTCUTS (Excel-like) ===== */
function _excelHandleKeydown(e) {
    /* Tylko gdy kontener Excela jest otwarty */
    var overlay = document.getElementById('excel-table-overlay');
    if (!overlay) return;

    var isCtrl = e.ctrlKey || e.metaKey;

    /* Ctrl+Z = undo */
    if (isCtrl && !e.shiftKey && e.key === 'z') { e.preventDefault(); _excelUndo(); return; }
    /* Ctrl+Y / Ctrl+Shift+Z = redo */
    if ((isCtrl && !e.shiftKey && e.key === 'y') || (isCtrl && e.shiftKey && (e.key === 'z' || e.key === 'Z'))) { e.preventDefault(); _excelRedo(); return; }

    /* Delete = wyczyść zaznaczone komórki */
    if (e.key === 'Delete' || e.key === 'Backspace') {
        if (e.target.tagName === 'INPUT' || e.target.tagName === 'SELECT') return; /* edycja w komórce */
        if (_excelSelectedCells.length === 0) return;
        e.preventDefault();
        _excelSaveUndoSnapshot();
        var rows = document.querySelectorAll('#excel-table-container tbody tr[data-widx]');
        _excelSelectedCells.forEach(function(cell) {
            var row = document.querySelector('tr[data-widx="' + cell.wIdx + '"]');
            if (!row) return;
            var inputs = row.querySelectorAll('input, select');
            var target = inputs[cell.colIdx];
            if (!target) return;
            if (target.tagName === 'SELECT') {
                /** @type {HTMLSelectElement} */ (target).value = '';
                target.dispatchEvent(new Event('change', { bubbles: true }));
            } else if (target.tagName === 'INPUT') {
                /** @type {HTMLInputElement} */ (target).value = '';
                target.dispatchEvent(new Event('input', { bubbles: true }));
                target.dispatchEvent(new Event('change', { bubbles: true }));
            }
        });
        showToast('Wyczyszczono ' + _excelSelectedCells.length + ' komórek', 'info');
        return;
    }

    /* Ctrl+A = zaznacz wszystko */
    if (isCtrl && (e.key === 'a' || e.key === 'A')) {
        e.preventDefault();
        var allRows = document.querySelectorAll('#excel-table-container tbody tr[data-widx]');
        _excelDeselectAllCells();
        allRows.forEach(function(row, rIdx) {
            var tds = row.querySelectorAll('td');
            tds.forEach(function(td, cIdx) {
                if (cIdx < 2) return; /* pomiń Lp + Nr Studni */
                _excelSelectedCells.push({ wIdx: rIdx, colIdx: cIdx });
                td.classList.add('cell-selected');
            });
        });
        _excelLastClickedCell = null;
        showToast('Zaznaczono wszystkie komórki', 'info');
        return;
    }

    /* Ctrl+X = wytnij */
    if (isCtrl && (e.key === 'x' || e.key === 'X')) {
        if (_excelSelectedCells.length === 0) return;
        e.preventDefault();
        /* Uzyj oryginalnego eventu — clipboardData istnieje w keydown */
        _excelHandleCopy(/** @type {any} */ (e));
        /* Potem wyczyść */
        _excelSaveUndoSnapshot();
        var rows = document.querySelectorAll('#excel-table-container tbody tr[data-widx]');
        _excelSelectedCells.forEach(function(cell) {
            var row = document.querySelector('tr[data-widx="' + cell.wIdx + '"]');
            if (!row) return;
            var inputs = row.querySelectorAll('input, select');
            var target = inputs[cell.colIdx];
            if (!target) return;
            if (target.tagName === 'SELECT') {
                /** @type {HTMLSelectElement} */ (target).value = '';
                target.dispatchEvent(new Event('change', { bubbles: true }));
            } else if (target.tagName === 'INPUT') {
                /** @type {HTMLInputElement} */ (target).value = '';
                target.dispatchEvent(new Event('input', { bubbles: true }));
                target.dispatchEvent(new Event('change', { bubbles: true }));
            }
        });
        showToast('Wycinanie: ' + _excelSelectedCells.length + ' komórek', 'info');
        return;
    }

    /* Ctrl+D = kopiuj w dół */
    if (isCtrl && (e.key === 'd' || e.key === 'D')) {
        if (_excelSelectedCells.length === 0) return;
        e.preventDefault();
        _excelSaveUndoSnapshot();
        var rows = document.querySelectorAll('#excel-table-container tbody tr[data-widx]');
        _excelSelectedCells.forEach(function(cell) {
            if (cell.wIdx === 0) return;
            var srcRow = document.querySelector('tr[data-widx="' + (cell.wIdx - 1) + '"]');
            var dstRow = document.querySelector('tr[data-widx="' + cell.wIdx + '"]');
            if (!srcRow || !dstRow) return;
            var tdDst = dstRow.children[cell.colIdx];
            var tdSrc = srcRow.children[cell.colIdx];
            var target = tdDst ? tdDst.querySelector('input, select') : null;
            var src = tdSrc ? tdSrc.querySelector('input, select') : null;
            if (!target || !src) return;
            if (target.tagName === 'SELECT') {
                /** @type {HTMLSelectElement} */ (target).value = /** @type {HTMLSelectElement} */ (src).value;
                target.dispatchEvent(new Event('change', { bubbles: true }));
            } else if (target.tagName === 'INPUT') {
                /** @type {HTMLInputElement} */ (target).value = /** @type {HTMLInputElement} */ (src).value;
                target.dispatchEvent(new Event('input', { bubbles: true }));
                target.dispatchEvent(new Event('change', { bubbles: true }));
            }
        });
        showToast('Skopiowano w dół', 'info');
        return;
    }

    /* Ctrl+R = kopiuj w prawo */
    if (isCtrl && (e.key === 'r' || e.key === 'R')) {
        if (_excelSelectedCells.length === 0) return;
        e.preventDefault();
        _excelSaveUndoSnapshot();
        var rows = document.querySelectorAll('#excel-table-container tbody tr[data-widx]');
        _excelSelectedCells.forEach(function(cell) {
            if (cell.colIdx <= 1) return;
            var row = document.querySelector('tr[data-widx="' + cell.wIdx + '"]');
            if (!row) return;
            var tdR = row.children[cell.colIdx];
            var tdRSrc = row.children[cell.colIdx - 1];
            var target = tdR ? tdR.querySelector('input, select') : null;
            var src = tdRSrc ? tdRSrc.querySelector('input, select') : null;
            if (!target || !src) return;
            if (target.tagName === 'SELECT') {
                /** @type {HTMLSelectElement} */ (target).value = /** @type {HTMLSelectElement} */ (src).value;
                target.dispatchEvent(new Event('change', { bubbles: true }));
            } else if (target.tagName === 'INPUT') {
                /** @type {HTMLInputElement} */ (target).value = /** @type {HTMLInputElement} */ (src).value;
                target.dispatchEvent(new Event('input', { bubbles: true }));
                target.dispatchEvent(new Event('change', { bubbles: true }));
            }
        });
        showToast('Skopiowano w prawo', 'info');
        return;
    }
}

/* ===== GLOBALNA ODSWIEŻALKA ===== */
window.refreshExcelFromConfig = function () {
    if (!document.getElementById('excel-table-overlay')) return; // modal zamknięty
    _excelRenderTable(_excelActiveTab);
};
