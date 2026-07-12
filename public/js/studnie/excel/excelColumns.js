// @ts-check
/* ===== EXCEL COLUMNS — Budowa kolumn konfiguracyjnych (wyodrębnione z excelTableManager.js) ===== */

function _excelBuildComponentColumns(dn, well) {
    if (!well && typeof _excelGetReferenceWell === 'function') {
        well = _excelGetReferenceWell(dn);
    }
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
        var tabWellsList =
            typeof wells !== 'undefined'
                ? wells.filter(function (w) {
                      return (
                          String(w.dn) === String(dn) || (dn === 'styczne' && w.dn === 'styczna')
                      );
                  })
                : [];
        for (var ri = 0; ri < tabWellsList.length; ri++) {
            if (tabWellsList[ri].redukcjaDN1000) {
                anyRed = true;
                break;
            }
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
                if (tabWellsList[rwi].redukcjaDN1000) {
                    refWell = tabWellsList[rwi];
                    break;
                }
            }
            if (!refWell)
                refWell =
                    well || (typeof wells !== 'undefined' && wells.length > 0 ? wells[0] : null);
            var mainDn =
                dn === 'styczne'
                    ? refWell && refWell.stycznaNadbudowa1200
                        ? 1200
                        : 1000
                    : parseInt(String(dn));
            var mainGroups = _excelGetComponentsForDn(String(mainDn), refWell);
            var allRedPlyta = (mainGroups['plyta_redukcyjna'] || []).filter(function (p) {
                return p.dn !== null;
            });

            targetDns.forEach(function (tDn) {
                /* Buduj Zestawy kolumn DLA KAŻDEGO tDn */
                var redGroups = _excelGetComponentsForDn(String(tDn), refWell);
                var redDnSpecific = {};
                Object.keys(redGroups).forEach(function (gk) {
                    redDnSpecific[gk] = redGroups[gk].filter(function (p) {
                        return p.dn !== null;
                    });
                });

                var dnPfx = targetDns.length > 1 ? tDn + '_' : '';
                var dnLbl = targetDns.length > 1 ? '(' + tDn + ') ' : '';

                /* Red. AVR */
                (redDnSpecific['avr'] || []).forEach(function (p) {
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
                var rKonus = [...(redDnSpecific['konus'] || [])].sort(function (a, b) {
                    return (parseFloat(a.height) || 0) - (parseFloat(b.height) || 0);
                });
                var seenRKH = {};
                rKonus.forEach(function (p) {
                    var h = parseInt(p.height) || 0;
                    if (h > 0 && !seenRKH[h]) {
                        seenRKH[h] = true;
                        var matching = rKonus.filter(function (k) {
                            return parseInt(k.height) === h;
                        });
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
                [
                    'plyta_din',
                    'plyta_najazdowa',
                    'plyta_zamykajaca',
                    'pierscien_odciazajacy'
                ].forEach(function (ct) {
                    var prods = [...(redDnSpecific[ct] || [])].sort(function (a, b) {
                        return (parseFloat(a.height) || 0) - (parseFloat(b.height) || 0);
                    });
                    if (ct === 'plyta_din') {
                        prods = prods.filter(function (p) {
                            return parseInt(p.height) === 200;
                        });
                    }
                    var seenH = {};
                    prods.forEach(function (p) {
                        var h = parseInt(p.height) || 0;
                        if (h > 0 && !seenH[h]) {
                            seenH[h] = true;
                            var matching = prods.filter(function (k) {
                                return parseInt(k.height) === h;
                            });
                            var lbl = _excelShortLabel(p.name || '', ct);
                            var det = ct === 'pierscien_odciazajacy' ? '' : String(h);
                            cols.push({
                                key: 'red_' + ct + '_' + dnPfx + h + '_' + h,
                                label:
                                    'R.' +
                                    (ct === 'plyta_din'
                                        ? 'Pł.DIN'
                                        : ct === 'plyta_najazdowa'
                                          ? 'Pł.najazd'
                                          : ct === 'plyta_zamykajaca'
                                            ? 'Pł.zamyk'
                                            : 'Pierśc.odc') +
                                    ' ' +
                                    dnLbl +
                                    'H=' +
                                    h,
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
                var rKreg = [...(redDnSpecific['krag'] || [])].sort(function (a, b) {
                    return (parseFloat(a.height) || 0) - (parseFloat(b.height) || 0);
                });
                var seenRKH2 = {};
                rKreg.forEach(function (p) {
                    var h = parseInt(p.height) || 0;
                    if (h > 0 && !seenRKH2[h]) {
                        seenRKH2[h] = true;
                        var matching = rKreg.filter(function (k) {
                            return parseInt(k.height) === h;
                        });
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
                (redDnSpecific['osadnik'] || []).forEach(function (p) {
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
                var rKragOt = [...(redDnSpecific['krag_ot'] || [])].sort(function (a, b) {
                    return (parseFloat(a.height) || 0) - (parseFloat(b.height) || 0);
                });
                var seenROtH = {};
                rKragOt.forEach(function (p) {
                    var h = parseInt(p.height) || 0;
                    if (h > 0 && !seenROtH[h]) {
                        seenROtH[h] = true;
                        var matching = rKragOt.filter(function (k) {
                            return parseInt(k.height) === h;
                        });
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
                var rDennica = [...(redDnSpecific['dennica'] || [])].sort(function (a, b) {
                    return (parseFloat(a.height) || 0) - (parseFloat(b.height) || 0);
                });
                var seenRDH = {};
                rDennica.forEach(function (p) {
                    var h = parseInt(p.height) || 0;
                    if (h > 0 && !seenRDH[h]) {
                        seenRDH[h] = true;
                        var matching = rDennica.filter(function (k) {
                            return parseInt(k.height) === h;
                        });
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
            allRedPlyta.forEach(function (p) {
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
                    fromReduction: false /* płyty redukcyjne mają dn studni głównej, nie targetu */,
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
        var tabWellsListU =
            typeof wells !== 'undefined'
                ? wells.filter(function (w) {
                      return (
                          String(w.dn) === String(dn) || (dn === 'styczne' && w.dn === 'styczna')
                      );
                  })
                : [];
        for (var riU = 0; riU < tabWellsListU.length; riU++) {
            if (tabWellsListU[riU].redukcjaDN1000) {
                anyRedU = true;
                break;
            }
        }
        if (anyRedU) {
            var refWellU = null;
            for (var rwiU = 0; rwiU < tabWellsListU.length; rwiU++) {
                if (tabWellsListU[rwiU].redukcjaDN1000) {
                    refWellU = tabWellsListU[rwiU];
                    break;
                }
            }
            if (!refWellU)
                refWellU =
                    well || (typeof wells !== 'undefined' && wells.length > 0 ? wells[0] : null);
            var targetDnsU = [1000];
            if ([1500, 2000, 2500].includes(parseInt(String(dn))) || dn === 'styczne') {
                targetDnsU.push(1200);
            }
            targetDnsU.forEach(function (tDn) {
                var redGroupsU = _excelGetComponentsForDn(String(tDn), refWellU);
                var uszczProductsU = redGroupsU['uszczelka'] || [];
                if (typeof filterSealsByWellType === 'function') {
                    uszczProductsU = filterSealsByWellType(uszczProductsU, refWellU);
                }
                var dnPfxU = targetDnsU.length > 1 ? tDn + '_' : '';
                var dnLblU = targetDnsU.length > 1 ? '(' + tDn + ') ' : '';
                uszczProductsU.forEach(function (p) {
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
    mainUszczProducts.forEach(function (p) {
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
    var well =
        (typeof currentWellIndex !== 'undefined' && currentWellIndex >= 0
            ? wells[currentWellIndex]
            : null) || tabWell;
    codes.forEach(function (span, idx) {
        var isPerProduct = span.getAttribute('data-per-product') === '1';
        var ct = span.getAttribute('data-ct');
        var height = span.getAttribute('data-height');
        var redTarget =
            span.getAttribute('data-reddn') || ''
                ? well &&
                  (well.redukcjaTargetDN || parseInt(span.getAttribute('data-reddn')) || 1000)
                : null;
        if (isPerProduct) {
            /* Kolumny per-produkt: kod stały, ale cenę trzeba odświeżyć */
            if (prices && prices[idx]) {
                var ppid = span.textContent && span.textContent.trim();
                if (ppid) {
                    var _prod = (
                        typeof studnieProducts !== 'undefined' ? studnieProducts : []
                    ).find(function (pr) {
                        return pr.id === ppid;
                    });
                    if (_prod && _prod.price) {
                        var _fmt =
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
        var pid = well ? _excelGetWellProdCode(well, ct, height, redTarget) : null;
        span.textContent = pid !== null && pid !== undefined ? pid : '';
        /* Aktualizuj cenę w tym samym indeksie */
        if (prices && prices[idx]) {
            prices[idx].textContent = pid
                ? _excelGetWellProdPrice(well, ct, height, redTarget) || ''
                : '';
        }
    });
}

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
        var avail = getAvailableProducts(well).filter(function (p) {
            try {
                return filterByWellParams(p, well);
            } catch (e) {
                return true;
            }
        });
        var fallback = avail.filter(function (p) {
            return p.componentType === ct;
        });
        if (height !== undefined && height !== null && height !== '') {
            fallback = fallback.filter(function (p) {
                return parseInt(p.height) === parseInt(height);
            });
        }
        /* Dla kolumn redukcji: preferuj produkt pasujący do targetDn */
        if (targetDn !== undefined && targetDn !== null) {
            var dnMatch = fallback.filter(function (p) {
                return p.dn !== null && parseInt(p.dn) === parseInt(targetDn);
            });
            if (dnMatch.length > 0) return dnMatch[0].id;
            var univ = fallback.filter(function (p) {
                return p.dn === null;
            });
            if (univ.length > 0) return univ[0].id;
            return null;
        }
        /* Main column: preferuj produkty dla DN studni, potem uniwersalne */
        var mainMatch = fallback.filter(function (p) {
            return p.dn !== null && parseInt(p.dn) === parseInt(well.dn);
        });
        if (mainMatch.length > 0) return mainMatch[0].id;
        var mainUniv = fallback.filter(function (p) {
            return p.dn === null;
        });
        return mainUniv.length > 0 ? mainUniv[0].id : null;
        return null; /* nie pokazuj kodu z innego DN */
    }
    return null;
}

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
        var price =
            typeof getItemAssessedPrice === 'function'
                ? getItemAssessedPrice(well, resolved, true, item)
                : resolved.price || 0;
        var fmt =
            typeof fmtInt === 'function'
                ? fmtInt
                : function (n) {
                      return Math.round(n || 0).toLocaleString('pl-PL');
                  };
        return fmt(price) + ' PLN';
    }

    /* 2. FALLBACK: pierwszy dostępny produkt */
    if (typeof getAvailableProducts === 'function' && typeof filterByWellParams === 'function') {
        var avail = getAvailableProducts(well).filter(function (p) {
            return filterByWellParams(p, well);
        });
        var fallback = avail.filter(function (p) {
            return (
                p.componentType === ct &&
                (height === undefined ||
                    height === null ||
                    height === '' ||
                    parseInt(p.height) === parseInt(height))
            );
        });
        /* Dla kolumn redukcji: preferuj produkt pasujący do targetDn */
        var matchedFallback = null;
        if (targetDn !== undefined && targetDn !== null) {
            var dnMatch = fallback.filter(function (p) {
                return p.dn !== null && parseInt(p.dn) === parseInt(targetDn);
            });
            if (dnMatch.length > 0) matchedFallback = dnMatch[0];
            else {
                var univ = fallback.filter(function (p) {
                    return p.dn === null;
                });
                if (univ.length > 0) matchedFallback = univ[0];
            }
        } else {
            /* Main column: preferuj produkty dla DN studni, potem uniwersalne */
            var mainMatch = fallback.filter(function (p) {
                return p.dn !== null && parseInt(p.dn) === parseInt(well.dn);
            });
            if (mainMatch.length > 0) matchedFallback = mainMatch[0];
            else {
                var mainUniv = fallback.filter(function (p) {
                    return p.dn === null;
                });
                if (mainUniv.length > 0) matchedFallback = mainUniv[0];
            }
        }
        if (matchedFallback) {
            var price =
                typeof getItemAssessedPrice === 'function'
                    ? getItemAssessedPrice(well, matchedFallback, true, null)
                    : matchedFallback.price || 0;
            var fmt =
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
