/* ===== Extracted to wellConfigRules.js ===== */

function enforceSingularTopClosures(well, productId) {
    const product = studnieProducts.find((p) => p.id === productId);
    if (!product) return;

    const topClosureTypes = [
        'plyta_din',
        'plyta_najazdowa',
        'plyta_zamykajaca',
        'konus',
        'pierscien_odciazajacy'
    ];

    // ZASADA 1: Tylko jedno zakończenie studni
    if (topClosureTypes.includes(product.componentType)) {
        well.config = well.config.filter((item) => {
            if (item.isPlaceholder) return true;
            const p = studnieProducts.find((pr) => pr.id === item.productId);
            return p && !topClosureTypes.includes(p.componentType);
        });
    }

    // ZASADA 2: Właz - tylko 1 naraz
    if (product.componentType === 'wlaz') {
        well.config = well.config.filter((item) => {
            if (item.isPlaceholder) return true;
            const p = studnieProducts.find((pr) => pr.id === item.productId);
            return p && p.componentType !== 'wlaz';
        });
    }
}

function sortWellConfigByOrder() {
    const well = getCurrentWell();
    if (!well) return;
    const typeOrder = {
        wlaz: 0,
        avr: 1,
        plyta_din: 2,
        plyta_najazdowa: 2,
        plyta_zamykajaca: 2,
        konus: 2,
        pierscien_odciazajacy: 3,
        plyta_redukcyjna: 5,
        krag: 5,
        krag_ot: 5,
        dennica: 6,
        kineta: 7
    };
    well.config.sort((a, b) => {
        const pa = studnieProducts.find((p) => p.id === a.productId);
        const pb = studnieProducts.find((p) => p.id === b.productId);
        const oa = pa ? (typeOrder[pa.componentType] ?? 99) : 99;
        const ob = pb ? (typeOrder[pb.componentType] ?? 99) : 99;
        if (oa !== ob) return oa - ob;

        // Elementy tego samego typu zachowują swoją względną kolejność strukturalną.
        // Wcześniej kręgi były sortowane według wysokości, co mieszało pozycje krag_ot.
        return 0;
    });
}

function filterByWellParams(p, well) {
    if (!well) return true;
    const id = (p.id || '').toUpperCase();

    // 1. Kręgi (KDZ/KDB), Konus (JZW) i stopnie (-B, -D, -N)
    if (
        p.componentType === 'krag' ||
        p.componentType === 'krag_ot' ||
        p.componentType === 'konus'
    ) {
        const isZelbet = well.nadbudowa === 'zelbetowa';
        if (isZelbet && id.startsWith('KDB') && p.dn !== 2000 && p.dn !== 2500) return false;
        if (!isZelbet && id.startsWith('KDZ') && p.dn !== 2000 && p.dn !== 2500) return false;

        const stopnie = well.stopnie || 'drabinka';

        // Usuń przyrostek _OT dla walidacji
        const checkId = id.endsWith('_OT') ? id.replace('_OT', '') : id;

        // Kręgi kończą się na: -B (brak), -D (drabinka), -N-D (nierdzewna)
        const hasStepsAny = checkId.endsWith('-B') || checkId.endsWith('-D');

        if (hasStepsAny) {
            if (stopnie === 'nierdzewna') {
                if (!checkId.endsWith('-N-D')) return false;
            } else if (stopnie === 'brak') {
                if (!checkId.endsWith('-B')) return false;
            } else {
                // drabinka (domyślna)
                if (!checkId.endsWith('-D') || checkId.endsWith('-N-D')) return false;
            }
        }
    }

    // 2. Dennice (DUZ/DU)
    if (p.componentType === 'dennica') {
        const isZelbet = well.dennicaMaterial === 'zelbetowa';
        if (
            isZelbet &&
            id.startsWith('DU') &&
            !id.startsWith('DUZ') &&
            p.dn !== 2000 &&
            p.dn !== 2500
        )
            return false;
        if (!isZelbet && id.startsWith('DUZ') && p.dn !== 2000 && p.dn !== 2500) return false;
    }

    // 3. Płyty (PDZ/PD itp)
    if (
        ['plyta_najazdowa', 'plyta_zamykajaca', 'plyta_din', 'plyta_redukcyjna'].includes(
            p.componentType
        )
    ) {
        const isZelbet = well.nadbudowa === 'zelbetowa';
        if (
            isZelbet &&
            id.startsWith('PD') &&
            !id.startsWith('PDZ') &&
            p.dn !== 2000 &&
            p.dn !== 2500
        )
            return false;
        if (!isZelbet && id.startsWith('PDZ') && p.dn !== 2000 && p.dn !== 2500) return false;
        if (
            isZelbet &&
            id.startsWith('PZ') &&
            !id.startsWith('PZZ') &&
            p.dn !== 2000 &&
            p.dn !== 2500
        )
            return false;
        if (!isZelbet && id.startsWith('PZZ') && p.dn !== 2000 && p.dn !== 2500) return false;
    }

    return true;
}

function filterSealsByWellType(sealItems, well) {
    if (!well.uszczelka || well.uszczelka === 'brak' || well.uszczelka === 'smar') {
        return [];
    }
    const keyword = well.uszczelka.replace('Uszczelka ', '').toUpperCase();
    return sealItems.filter((p) => {
        const nameUpper = p.name.toUpperCase();
        const idUpper = p.id.toUpperCase();

        if (keyword === 'SDV') {
            return (
                nameUpper.includes('SDV') &&
                !nameUpper.includes('PIERŚCIENIEM') &&
                !nameUpper.includes('PO')
            );
        }
        if (keyword === 'SDV PO') {
            return (
                nameUpper.includes('SDV') &&
                (nameUpper.includes('PIERŚCIENIEM') || nameUpper.includes('PO'))
            );
        }
        if (keyword === 'GSG') {
            return nameUpper.includes('GSG') && !nameUpper.includes('NBR');
        }
        if (keyword === 'NBR') {
            return nameUpper.includes('NBR');
        }
        return nameUpper.includes(keyword) || idUpper.includes(keyword);
    });
}

function getAvailableProducts(well) {
    const mag = well.magazyn || 'Kluczbork';
    const isWl = mag.includes('oc') || mag.includes('Włoc');
    const magField = isWl ? 'magazynWL' : 'magazynKLB';
    const formaField = isWl ? 'formaStandardowa' : 'formaStandardowaKLB';
    return studnieProducts
        .filter((p) => p[magField] === 1)
        .sort((a, b) => {
            // 1. Priorytet dla formy standardowej (malejąco: 1 -> 0)
            const fA = b[formaField] || 0;
            const fB = a[formaField] || 0;
            if (fA !== fB) return fA - fB;

            // 2. Sortowanie wg wysokości (rosnąco: 250, 500, 750, 1000)
            const hA = parseFloat(a.height) || 0;
            const hB = parseFloat(b.height) || 0;
            return hA - hB;
        });
}


/* ===== AKTUALIZACJA KONFIGURACJI PO ZMIANIE PARAMETRÓW ===== */

window.updateConfigToMatchParams = function (well) {
    if (!well || !well.config || well.config.length === 0) return;
    const availProducts = getAvailableProducts(well).filter((p) => filterByWellParams(p, well));
    let anyChanged = false;

    well.config.forEach((item) => {
        const p = studnieProducts.find((pr) => pr.id === item.productId);
        if (!p) return;

        // Upewnij się, że poprawnie obsługujemy dynamicznie generowane kręgi wiercone
        const isDrilled = p.componentType === 'krag_ot' || p.id.endsWith('_OT');

        if (!filterByWellParams(p, well)) {
            // Znajdź zamiennik
            const substitute = availProducts.find(
                (cand) =>
                    cand.componentType === p.componentType &&
                    cand.dn === p.dn &&
                    parseFloat(cand.height) === parseFloat(p.height)
            );
            if (substitute) {
                item.productId = substitute.id;
                anyChanged = true;
            } else if (isDrilled) {
                // Dla dynamicznych kręgów wierconych znajdujemy zamiennik dla kręgu bazowego, a następnie dodajemy _OT
                const baseId = p.id.replace('_OT', '');
                const baseProd = studnieProducts.find((pr) => pr.id === baseId);
                if (baseProd) {
                    const baseSub = availProducts.find(
                        (cand) =>
                            cand.componentType === 'krag' &&
                            cand.dn === baseProd.dn &&
                            parseFloat(cand.height) === parseFloat(baseProd.height)
                    );
                    if (baseSub) {
                        const dynamicOtId = baseSub.id + '_OT';
                        if (!studnieProducts.find((pr) => pr.id === dynamicOtId)) {
                            const dynamicProd = JSON.parse(JSON.stringify(baseSub));
                            dynamicProd.id = dynamicOtId;
                            dynamicProd.componentType = 'krag_ot';
                            if (!dynamicProd.name.endsWith(' z otworem'))
                                dynamicProd.name += ' z otworem';
                            studnieProducts.push(dynamicProd);
                        }
                        item.productId = dynamicOtId;
                        anyChanged = true;
                    }
                }
            }
        }
    });

    if (anyChanged) {
        showToast('Zaktualizowano rodzaje elementów w konfiguracji', 'info');
    }
};

/* ===== AUTOMATYCZNE DODANIE PARY ODCIĄŻAJĄCEJ ===== */

window.injectPairIfReliefComponent = function (well, productId, baseIndex) {
    const prod = studnieProducts.find((x) => x.id === productId);
    if (!prod) return;

    if (prod.componentType === 'pierscien_odciazajacy') {
        const pair = getAvailableProducts(well).find(
            (x) =>
                (x.componentType === 'plyta_najazdowa' || x.componentType === 'plyta_zamykajaca') &&
                parseInt(x.dn) === parseInt(prod.dn) &&
                filterByWellParams(x, well)
        );
        if (pair) {
            well.config.splice(baseIndex, 0, {
                productId: pair.id,
                quantity: 1,
                _addedAt: Date.now()
            });
            showToast('Dodano komplet: Płyta + Pierścień odciążający', 'info');
        }
    } else if (
        prod.componentType === 'plyta_najazdowa' ||
        prod.componentType === 'plyta_zamykajaca' ||
        (prod.name && prod.name.toLowerCase().includes('odciążając'))
    ) {
        const pair = getAvailableProducts(well).find(
            (x) =>
                x.componentType === 'pierscien_odciazajacy' &&
                parseInt(x.dn) === parseInt(prod.dn) &&
                filterByWellParams(x, well)
        );
        if (pair) {
            well.config.splice(baseIndex + 1, 0, {
                productId: pair.id,
                quantity: 1,
                _addedAt: Date.now()
            });
            showToast('Dodano komplet: Płyta + Pierścień odciążający', 'info');
        }
    }
};

module.exports = { filterByWellParams };