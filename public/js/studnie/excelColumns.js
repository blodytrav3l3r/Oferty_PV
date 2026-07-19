// @ts-check
/* ===== EXCEL COLUMNS — Budowa kolumn dla tabeli konfiguracyjnej studni (Excel) ===== */

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
    if (!well && typeof _excelGetReferenceWell === 'function') {
        well = _excelGetReferenceWell(dn);
    }
    const groups = _excelGetComponentsForDn(dn, well);
    const cols = [];

    /* 1. Właz */
    const wlazProducts = groups['wlaz'] || [];
    if (wlazProducts.length > 0) {
        cols.push({
            id: 'wlaz',
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
            id: 'avr_' + p.id,
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
    let _redResult = _excelBuildReductionColumns(dn, well, cols);
    let hasRedTab = _redResult.hasRedTab;
    let anyRed = _redResult.anyRed;

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
                id: 'konus_' + h,
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
                    id: ct + '_' + h,
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
                id: ct + '_' + p.id,
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
                id: 'plyta_redukcyjna_' + p.id,
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
                id: 'krag_' + h,
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
                id: 'krag_ot_' + h,
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
                id: 'dennica_' + h,
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
                id: 'dennica_' + p.id,
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
            id: 'osadnik_' + p.id,
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
                id: 'styczna_' + p.id,
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
    let hasRedTabU = ['1200', '1500', '2000', '2500', 'styczne'].includes(String(dn));
    if (hasRedTabU) {
        let anyRedU = false;
        let tabWellsListU =
            typeof wells !== 'undefined'
                ? wells.filter(function (w) {
                      return (
                          String(w.dn) === String(dn) || (dn === 'styczne' && w.dn === 'styczna')
                      );
                  })
                : [];
        for (let riU = 0; riU < tabWellsListU.length; riU++) {
            if (tabWellsListU[riU].redukcjaDN1000) {
                anyRedU = true;
                break;
            }
        }
        if (anyRedU) {
            let refWellU = null;
            for (let rwiU = 0; rwiU < tabWellsListU.length; rwiU++) {
                if (tabWellsListU[rwiU].redukcjaDN1000) {
                    refWellU = tabWellsListU[rwiU];
                    break;
                }
            }
            if (!refWellU)
                refWellU =
                    well || (typeof wells !== 'undefined' && wells.length > 0 ? wells[0] : null);
            let targetDnsU = [1000];
            if ([1500, 2000, 2500].includes(parseInt(String(dn))) || dn === 'styczne') {
                targetDnsU.push(1200);
            }
            targetDnsU.forEach(function (tDn) {
                let redGroupsU = _excelGetComponentsForDn(String(tDn), refWellU);
                let uszczProductsU = redGroupsU['uszczelka'] || [];
                if (typeof filterSealsByWellType === 'function') {
                    uszczProductsU = filterSealsByWellType(uszczProductsU, refWellU);
                }
                let dnPfxU = targetDnsU.length > 1 ? tDn + '_' : '';
                let dnLblU = targetDnsU.length > 1 ? '(' + tDn + ') ' : '';
                uszczProductsU.forEach(function (p) {
                    let lbl = _excelShortLabel(p.name || '', 'uszczelka');
                    cols.push({
                        id: 'red_uszczelka_' + dnPfxU + p.id,
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
    let mainUszczProducts = groups['uszczelka'] || [];
    if (typeof filterSealsByWellType === 'function') {
        mainUszczProducts = filterSealsByWellType(mainUszczProducts, well);
    }
    mainUszczProducts.forEach(function (p) {
        let lbl = _excelShortLabel(p.name || '', 'uszczelka');
        cols.push({
            id: 'uszczelka_' + p.id,
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
