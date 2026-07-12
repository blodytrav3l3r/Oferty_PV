// @ts-check
/* ===== EXCEL COLUMNS BUILD — Budowa kolumn (wyodrębnione z excelColumns.js) ===== */

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
        if (anyRed) {
            /* Znajdź pierwszą studnię z redukcją jako reference well */
            var refWellRed = null;
            for (var rwi = 0; rwi < tabWellsList.length; rwi++) {
                if (tabWellsList[rwi].redukcjaDN1000) {
                    refWellRed = tabWellsList[rwi];
                    break;
                }
            }
            if (!refWellRed)
                refWellRed =
                    well || (typeof wells !== 'undefined' && wells.length > 0 ? wells[0] : null);

            var targetDnsRed = [1000];
            if ([1500, 2000, 2500].includes(parseInt(String(dn))) || dn === 'styczne') {
                targetDnsRed.push(1200);
            }

            targetDnsRed.forEach(function (tDn) {
                var groupsForRedDn = _excelGetComponentsForDn(String(tDn), refWellRed);

                /* Kregi dla redukcji — zawsze */
                var redKregProducts = groupsForRedDn['krag'] || [];
                redKregProducts.forEach(function (p) {
                    var lbl = _excelShortLabel(p.name || '', 'krag');
                    cols.push({
                        key: 'red_krag_' + tDn + '_' + p.id,
                        label: 'R.Krąg(' + tDn + ') ' + p.name,
                        shortLabel: 'R.' + lbl.short,
                        detailLabel: lbl.detail,
                        type: 'number',
                        componentType: 'krag',
                        productId: p.id,
                        height: p.height,
                        fromReduction: true,
                        targetDn: tDn
                    });
                });

                /* Kręgi OT dla redukcji */
                var redKregOtProducts = groupsForRedDn['krag_ot'] || [];
                redKregOtProducts.forEach(function (p) {
                    var lbl = _excelShortLabel(p.name || '', 'krag_ot');
                    cols.push({
                        key: 'red_krag_ot_' + tDn + '_' + p.id,
                        label: 'R.K.OT(' + tDn + ') ' + p.name,
                        shortLabel: 'R.' + lbl.short,
                        detailLabel: lbl.detail,
                        type: 'number',
                        componentType: 'krag_ot',
                        productId: p.id,
                        height: p.height,
                        fromReduction: true,
                        targetDn: tDn
                    });
                });

                /* Dennice dla redukcji */
                var redDennicaProducts = groupsForRedDn['dennica'] || [];
                redDennicaProducts.forEach(function (p) {
                    var lbl = _excelShortLabel(p.name || '', 'dennica');
                    cols.push({
                        key: 'red_dennica_' + tDn + '_' + p.id,
                        label: 'R.Denn.(' + tDn + ') ' + p.name,
                        shortLabel: 'R.' + lbl.short,
                        detailLabel: lbl.detail,
                        type: 'number',
                        componentType: 'dennica',
                        productId: p.id,
                        height: p.height,
                        fromReduction: true,
                        targetDn: tDn
                    });
                });

                /* Osadnik dla redukcji */
                var redOsadnikProducts = groupsForRedDn['osadnik'] || [];
                redOsadnikProducts.forEach(function (p) {
                    var lbl = _excelShortLabel(p.name || '', 'osadnik');
                    cols.push({
                        key: 'red_osadnik_' + tDn + '_' + p.id,
                        label: 'R.Osad.(' + tDn + ') ' + p.name,
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
            });
        }
    }

    /* 3. Konus */
    const konusProducts = [...(groups['konus'] || [])].sort(
        (a, b) => (parseInt(a.height) || 0) - (parseInt(b.height) || 0)
    );
    const seenKonusH = new Set();
    konusProducts.forEach((p) => {
        const h = parseInt(p.height) || 0;
        if (!seenKonusH.has(h)) {
            seenKonusH.add(h);
            const matching = konusProducts.filter((k) => parseInt(k.height) === h);
            const lbl = _excelShortLabel(p.name || '', 'konus');
            cols.push({
                key: 'konus_' + h,
                label: 'Konus ' + p.name,
                shortLabel: lbl.short,
                detailLabel: lbl.detail,
                type: 'select',
                componentType: 'konus',
                products: matching,
                height: h
            });
        }
    });

    /* 3b. Kregi, denn. / osadnik, styczne — generyczne grupowanie po typie */
    ['krag', 'krag_ot', 'dennica', 'osadnik'].forEach(function (ct) {
        let prods = [...(groups[ct] || [])].sort(
            (a, b) => (parseInt(a.height) || 0) - (parseInt(b.height) || 0)
        );
        const seenH = new Set();
        const ctLabels = {
            krag: { single: 'Krąg', prefix: 'K.' },
            krag_ot: { single: 'K.OT', prefix: 'K.OT ' },
            dennica: { single: 'Dennica', prefix: 'D.' },
            osadnik: { single: 'Osadnik', prefix: 'Os.' }
        };
        prods.forEach((p) => {
            const h = parseInt(p.height) || 0;
            if (!seenH.has(h)) {
                seenH.add(h);
                const matching = prods.filter((k) => parseInt(k.height) === h);
                const lbl = _excelShortLabel(p.name || '', ct);
                cols.push({
                    key: ct + '_' + h,
                    label: ctLabels[ct].single + ' ' + h + ' mm',
                    shortLabel: ctLabels[ct].prefix + lbl.short,
                    detailLabel: lbl.detail,
                    type: 'select',
                    componentType: ct,
                    products: matching,
                    height: h
                });
            }
        });
        /* Kolumny bez wysokości (osadnik może nie mieć height) */
        const noHeight = prods.filter((p) => !parseInt(p.height));
        if (noHeight.length > 0) {
            const lbl = _excelShortLabel(noHeight[0].name || '', ct);
            cols.push({
                key: ct + '_noheight',
                label: ctLabels[ct].single + ' (inne)',
                shortLabel: ctLabels[ct].prefix + lbl.short,
                detailLabel: lbl.detail,
                type: 'select',
                componentType: ct,
                products: noHeight
            });
        }
    });

    /* 4. Płyty redukcyjne — osobna sekcja */
    const plytaRedProducts = groups['plyta_redukcyjna'] || [];
    plytaRedProducts.forEach((p) => {
        const lbl = _excelShortLabel(p.name || '', 'plyta_redukcyjna');
        cols.push({
            key: 'plyta_redukcyjna_' + p.id,
            label: 'Płyta red. ' + p.name,
            shortLabel: lbl.short,
            detailLabel: lbl.detail,
            type: 'number',
            componentType: 'plyta_redukcyjna',
            productId: p.id,
            height: p.height
        });
    });

    /* 5. Styczne — osobna sekcja (dedykowane kolumny per product) */
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
            height: p.height
        });
    });

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
