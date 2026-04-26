/* ============================
   Well Config Rules — Reguły walidacji i filtrowania studni
   ============================ */

/**
 * Filtruje listę produktów na podstawie parametrów studni.
 * 
 * @param {Object} p - produkt z bazy
 * @param {Object} well - aktualnie edytowana studnia
 * @returns {boolean} czy produkt jest dostępny
 */
function filterByWellParams(p, well) {
    if (!well) return true;

    try {
        const id = p.id || '';
        // Strip OT suffix for step checking (both static -OT z cennika and dynamic _OT z solvera)
        let checkId = id;
        if (checkId.endsWith('_OT')) checkId = checkId.slice(0, -3);
        else if (checkId.endsWith('-OT')) checkId = checkId.slice(0, -3);

        // 1. Filtrowanie materiału (Beton / Żelbet)
        // Kręgi
        if (p.componentType === 'krag') {
            const isZelbet = well.nadbudowa === 'zelbetowa';
            // Blokada KDB dla żelbetu i KDZ dla betonu (z wyjątkiem DN2000/2500, które są zawsze żelbetowe)
            if (isZelbet && id.startsWith('KDB') && p.dn !== 2000 && p.dn !== 2500) return false;
            if (!isZelbet && id.startsWith('KDZ') && p.dn !== 2000 && p.dn !== 2500) return false;
        }

        // Kręgi z otworem (krag_ot) - filtrowane beton/żelbet tak samo jak zwykłe kręgi
        if (p.componentType === 'krag_ot') {
            const isZelbet = well.nadbudowa === 'zelbetowa';
            if (isZelbet && id.startsWith('KDB') && p.dn !== 2000 && p.dn !== 2500) return false;
            if (!isZelbet && id.startsWith('KDZ') && p.dn !== 2000 && p.dn !== 2500) return false;
        }

        // Dennice
        if (p.componentType === 'dennica') {
            const isZelbet = well.dennicaMaterial === 'zelbetowa';
            // Dla DN1200 dennice zaczynają się od DDD i są uniwersalne
            // Dla DN2000/2500 też są uniwersalne (wszystko jest żelbetowe w standardzie)
            if (p.dn !== 1200 && p.dn !== 2000 && p.dn !== 2500) {
                if (isZelbet && id.startsWith('DU') && !id.startsWith('DUZ')) return false;
                if (!isZelbet && id.startsWith('DUZ')) return false;
            }
        }

        // 2. Filtrowanie stopni (tylko dla kręgów i konusów)
        // Kręgi z otworem (krag_ot) są zawsze widoczne niezależnie od rodzaju stopni
        if (p.componentType === 'krag' || p.componentType === 'konus') {
            const isNierdzewna = checkId.endsWith('-N-D');
            const isDrabinka = !isNierdzewna && checkId.endsWith('-D');
            const isBrak = checkId.endsWith('-B');
            const hasStepSuffix = isNierdzewna || isDrabinka || isBrak;

            if (well.stopnie === 'brak') {
                // Brak stopni: pokaż tylko warianty -B, odrzuć -D i -N-D
                if (hasStepSuffix && !isBrak) return false;
            } else if (well.stopnie === 'nierdzewna') {
                // Drabinka nierdzewna: pokaż tylko -N-D, odrzuć -D i -B
                if (isBrak || isDrabinka) return false;
                if (!isNierdzewna) return false;
            } else {
                // Drabinka standardowa: pokaż tylko -D, odrzuć -N-D i -B
                if (isBrak || isNierdzewna) return false;
                if (!hasStepSuffix) return false;
            }
        }
        // Kręgi z otworem (krag_ot) są zawsze widoczne niezależnie od rodzaju stopni
        // Rozróżnienie tylko na beton/żelbet (obsługiwane w sekcji 1 powyżej)

        // 3. Płyta redukcyjna - tylko gdy zaznaczona redukcja
        if (p.componentType === 'plyta_redukcyjna' && !well.redukcjaDN1000) {
            return false;
        }

        // 4. Inne elementy (płyty DIN, zamykające, pierścienie odciążające) są uniwersalne
        return true;
    } catch (e) {
        console.error('Błąd w filterByWellParams:', e, p, well);
        return true;
    }
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
    if (!well || !studnieProducts) return [];
    const mag = well.magazyn || 'Kluczbork';
    const isWl = mag.includes('oc') || mag.includes('Włoc');
    const field = isWl ? 'magazynWL' : 'magazynKLB';

    return studnieProducts.filter((p) => {
        // Luźne porównanie: akceptuje zarówno 1 (number) jak i "1" (string)
        // Produkty bez ustawionego pola magazynu (undefined) również traktujemy jako dostępne
        const val = p[field];
        return val === 1 || val === '1' || val === undefined;
    });
}

function getSortedConfig(config) {
    if (!config) return [];
    return [...config].sort((a, b) => {
        const pA = studnieProducts.find((p) => p.id === a.productId);
        const pB = studnieProducts.find((p) => p.id === b.productId);
        if (!pA || !pB) return 0;

        const order = ['Wlaz', 'Pokrywa', 'Plyta DIN', 'Konus', 'Krąg', 'Dennica'];
        const typeA = pA.componentType;
        const typeB = pB.componentType;

        const idxA = order.findIndex((t) => typeA.toLowerCase().includes(t.toLowerCase()));
        const idxB = order.findIndex((t) => typeB.toLowerCase().includes(t.toLowerCase()));

        if (idxA !== -1 && idxB !== -1) return idxA - idxB;
        return 0;
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
window.ensureReliefRingPair = function (well) {
    if (!well || !well.config) return;

    const hasReliefRing = well.config.some((item) => {
        const p = studnieProducts.find((pr) => pr.id === item.productId);
        return p && p.componentType === 'pierscien_odciazajacy';
    });

    const hasReliefPlate = well.config.some((item) => {
        const p = studnieProducts.find((pr) => pr.id === item.productId);
        return p && (p.componentType === 'plyta_zamykajaca' || p.componentType === 'plyta_najazdowa');
    });

    // Jeśli nie ma żadnego elementu odciążającego, nic nie robimy
    if (!hasReliefRing && !hasReliefPlate) return;

    // Określ docelowe DN dla elementów odciążających
    let targetDn = parseInt(well.dn);
    if (well.dn === 'styczna') {
        targetDn = well.stycznaNadbudowa1200 ? 1200 : 1000;
    } else if (well.redukcjaDN1000) {
        targetDn = well.redukcjaTargetDN || 1000;
    }
    if (isNaN(targetDn)) targetDn = 1000;

    // 1. Jeśli jest pierścień a nie ma płyty -> dodaj płytę
    if (hasReliefRing && !hasReliefPlate) {
        const plate = getAvailableProducts(well).find(
            (p) => (p.componentType === 'plyta_zamykajaca' || p.componentType === 'plyta_najazdowa') && 
                   parseInt(p.dn) === targetDn
        );
        if (plate) {
            well.config.push({ productId: plate.id, quantity: 1, autoAdded: true });
            showToast('Automatycznie dodano płytę do kompletu odciążającego', 'info');
        }
    }

    // 2. Jeśli jest płyta a nie ma pierścienia -> dodaj pierścień
    if (hasReliefPlate && !hasReliefRing) {
        const ring = getAvailableProducts(well).find(
            (p) => p.componentType === 'pierscien_odciazajacy' && 
                   parseInt(p.dn) === targetDn
        );
        if (ring) {
            well.config.push({ productId: ring.id, quantity: 1, autoAdded: true });
            showToast('Automatycznie dodano pierścień odciążający do kompletu', 'info');
        }
    }
};

// Eksportuj do window
window.filterByWellParams = filterByWellParams;
window.getAvailableProducts = getAvailableProducts;
window.getSortedConfig = getSortedConfig;
window.filterSealsByWellType = filterSealsByWellType;
