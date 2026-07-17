// @ts-check
/* ===== EXCEL REDUCTION COLUMNS — Kolumny redukcji dla tabeli konfiguracyjnej studni (Excel) ===== */

function _excelBuildReductionColumns(dn, well, cols) {
    /* 11. Redukcja — elementy nadbudowy (tylko gdy któraś studnia w zakładce ma redukcję) */
    let hasRedTab = ['1200', '1500', '2000', '2500', 'styczne'].includes(String(dn));
    let anyRed = false;
    if (hasRedTab) {
        /* Sprawdź czy KTÓRAś studnia w zakładce ma redukcję */
        let tabWellsList =
            typeof wells !== 'undefined'
                ? wells.filter(function (w) {
                      return (
                          String(w.dn) === String(dn) || (dn === 'styczne' && w.dn === 'styczna')
                      );
                  })
                : [];
        for (let ri = 0; ri < tabWellsList.length; ri++) {
            if (tabWellsList[ri].redukcjaDN1000) {
                anyRed = true;
                break;
            }
        }
        let targetDns = [];
        if (anyRed) {
            targetDns.push(1000);
            if ([1500, 2000, 2500].includes(parseInt(String(dn))) || dn === 'styczne') {
                targetDns.push(1200);
            }
        }
        if (anyRed) {
            /* refWell: preferuj studnię Z redukcją — filterByWellParams może blokować płyty redukcyjne na studni bez redukcji */
            let refWell = null;
            for (let rwi = 0; rwi < tabWellsList.length; rwi++) {
                if (tabWellsList[rwi].redukcjaDN1000) {
                    refWell = tabWellsList[rwi];
                    break;
                }
            }
            if (!refWell)
                refWell =
                    well || (typeof wells !== 'undefined' && wells.length > 0 ? wells[0] : null);
            let mainDn =
                dn === 'styczne'
                    ? refWell && refWell.stycznaNadbudowa1200
                        ? 1200
                        : 1000
                    : parseInt(String(dn));
            let mainGroups = _excelGetComponentsForDn(String(mainDn), refWell);
            let allRedPlyta = (mainGroups['plyta_redukcyjna'] || []).filter(function (p) {
                return p.dn !== null;
            });

            targetDns.forEach(function (tDn) {
                /* Buduj Zestawy kolumn DLA KAŻDEGO tDn */
                let redGroups = _excelGetComponentsForDn(String(tDn), refWell);
                let redDnSpecific = {};
                Object.keys(redGroups).forEach(function (gk) {
                    redDnSpecific[gk] = redGroups[gk].filter(function (p) {
                        return p.dn !== null;
                    });
                });

                let dnPfx = targetDns.length > 1 ? tDn + '_' : '';
                let dnLbl = targetDns.length > 1 ? '(' + tDn + ') ' : '';

                /* Red. AVR */
                (redDnSpecific['avr'] || []).forEach(function (p) {
                    let nameShort = p.name.replace(/AVR\s*/i, '').trim() || p.id;
                    let lbl = _excelShortLabel(p.name || '', 'avr');
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
                let rKonus = [...(redDnSpecific['konus'] || [])].sort(function (a, b) {
                    return (parseFloat(a.height) || 0) - (parseFloat(b.height) || 0);
                });
                let seenRKH = {};
                rKonus.forEach(function (p) {
                    let h = parseInt(p.height) || 0;
                    if (h > 0 && !seenRKH[h]) {
                        seenRKH[h] = true;
                        let matching = rKonus.filter(function (k) {
                            return parseInt(k.height) === h;
                        });
                        let lbl = _excelShortLabel(p.name || '', 'konus');
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
                    let prods = [...(redDnSpecific[ct] || [])].sort(function (a, b) {
                        return (parseFloat(a.height) || 0) - (parseFloat(b.height) || 0);
                    });
                    if (ct === 'plyta_din') {
                        prods = prods.filter(function (p) {
                            return parseInt(p.height) === 200;
                        });
                    }
                    let seenH = {};
                    prods.forEach(function (p) {
                        let h = parseInt(p.height) || 0;
                        if (h > 0 && !seenH[h]) {
                            seenH[h] = true;
                            let matching = prods.filter(function (k) {
                                return parseInt(k.height) === h;
                            });
                            let lbl = _excelShortLabel(p.name || '', ct);
                            let det = ct === 'pierscien_odciazajacy' ? '' : String(h);
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
                let rKreg = [...(redDnSpecific['krag'] || [])].sort(function (a, b) {
                    return (parseFloat(a.height) || 0) - (parseFloat(b.height) || 0);
                });
                let seenRKH2 = {};
                rKreg.forEach(function (p) {
                    let h = parseInt(p.height) || 0;
                    if (h > 0 && !seenRKH2[h]) {
                        seenRKH2[h] = true;
                        let matching = rKreg.filter(function (k) {
                            return parseInt(k.height) === h;
                        });
                        let lbl = _excelShortLabel(p.name || '', 'krag');
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
                    let lbl = _excelShortLabel(p.name || '', 'osadnik');
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
                let rKragOt = [...(redDnSpecific['krag_ot'] || [])].sort(function (a, b) {
                    return (parseFloat(a.height) || 0) - (parseFloat(b.height) || 0);
                });
                let seenROtH = {};
                rKragOt.forEach(function (p) {
                    let h = parseInt(p.height) || 0;
                    if (h > 0 && !seenROtH[h]) {
                        seenROtH[h] = true;
                        let matching = rKragOt.filter(function (k) {
                            return parseInt(k.height) === h;
                        });
                        let lbl = _excelShortLabel(p.name || '', 'krag_ot');
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
                let rDennica = [...(redDnSpecific['dennica'] || [])].sort(function (a, b) {
                    return (parseFloat(a.height) || 0) - (parseFloat(b.height) || 0);
                });
                let seenRDH = {};
                rDennica.forEach(function (p) {
                    let h = parseInt(p.height) || 0;
                    if (h > 0 && !seenRDH[h]) {
                        seenRDH[h] = true;
                        let matching = rDennica.filter(function (k) {
                            return parseInt(k.height) === h;
                        });
                        let lbl = _excelShortLabel(p.name || '', 'dennica');
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
                let lbl = _excelShortLabel(p.name || '', 'plyta_redukcyjna');
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
    return { hasRedTab: hasRedTab, anyRed: anyRed };
}
