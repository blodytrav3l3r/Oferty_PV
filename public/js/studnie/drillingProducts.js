// @ts-check
/**
 * drillingProducts.js — SSoT wyboru produktu "Wiercenie" dla przejścia.
 *
 * Jedno miejsce dla wyceny (actionsWellPricing), walidacji (solverValidation)
 * i renderu (wellTransitions, orderHelpers, offerWellComponentsHelpers).
 * Reguła: najmniejszy DN >= DN przejścia; gdy brak (np. DN powyżej maksimum
 * cennika) — największy dostępny ("podobny rozmiar", zgodnie z ustaleniem).
 *
 * Zależności globalne: studnieProducts (cennik studni).
 */

// ponytail: hoisted per-refresh derived — drillingProducts once, nie per przejście
let _cachedDrillingProducts = null;
let _cachedDrillingProductsLen = -1;

function _getDrillingProducts() {
    const len = Array.isArray(studnieProducts) ? studnieProducts.length : -1;
    if (_cachedDrillingProducts && _cachedDrillingProductsLen === len)
        return _cachedDrillingProducts;
    _cachedDrillingProducts = studnieProducts.filter((x) => x.category === 'Wiercenie');
    _cachedDrillingProductsLen = len;
    return _cachedDrillingProducts;
}

/**
 * @param {number} trDn DN przejścia (mm)
 * @returns {{drill: any, price: number, dn: number, exact: boolean} | null}
 *   null = brak jakiegokolwiek Wiercenia w cenniku (cicha cena 0).
 */
function findDrillingProductForDn(trDn) {
    if (!(trDn > 0)) return null;
    /** @type {any} */
    let bestDrill = null;
    let bestDnDiff = Infinity;
    /** @type {any} */
    let largestDrill = null;
    let largestDn = -Infinity;
    _getDrillingProducts().forEach((drill) => {
        let drillDn = parseInt(drill.dn);
        if (isNaN(drillDn)) {
            const match = drill.id.match(/Wiercenie-(\d+)/i);
            if (match) drillDn = parseInt(match[1]);
        }
        if (isNaN(drillDn)) return;
        if (drillDn >= trDn && drillDn - trDn < bestDnDiff) {
            bestDnDiff = drillDn - trDn;
            bestDrill = drill;
        }
        if (drillDn > largestDn) {
            largestDn = drillDn;
            largestDrill = drill;
        }
    });
    const picked = bestDrill || largestDrill;
    if (!picked) return null;
    return {
        drill: picked,
        price: picked.price || 0,
        dn: bestDrill ? trDn + bestDnDiff : largestDn,
        exact: !!bestDrill
    };
}

window.findDrillingProductForDn = findDrillingProductForDn;
