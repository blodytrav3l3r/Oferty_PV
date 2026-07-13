// @ts-check
/* ============================
   Well Config Rules — Filtry i sortowanie
   ============================
   Fragment 1/2: funkcje filtrujące, sortujące i budujące mapę segmentów.
   ============================ */

/**
 * Buduje tablicę segmentów z konfiguracji (odwróconej).
 *
 * @param {Array} configItems - konfiguracja [{productId, quantity}]
 * @param {boolean} psiaBuda - czy jest psia buda
 * @returns {Array<ConfigSegment>} segmenty z start/end
 */
function buildConfigSegmentMap(configItems, psiaBuda) {
    let y = 0;
    let lastWasD = !!psiaBuda;
    if (!configItems) return [];
    return configItems.map((item, idx) => {
        const prod = studnieProducts.find((p) => p.id === item.productId);
        let h = prod ? parseFloat(prod.height) || 0 : 0;
        if (prod && prod.componentType === 'dennica' && lastWasD) {
            h -= 100;
        }
        const seg = {
            itemBase: item,
            start: y,
            end: y + h,
            index: idx,
            type: prod ? prod.componentType : ''
        };
        y += h;
        lastWasD = prod && prod.componentType === 'dennica';
        return seg;
    });
}

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
        let checkId = id;
        if (checkId.endsWith('_OT')) checkId = checkId.slice(0, -3);
        else if (checkId.endsWith('-OT')) checkId = checkId.slice(0, -3);

        if (p.componentType === 'krag') {
            const isZelbet = well.nadbudowa === 'zelbetowa';
            if (isZelbet && id.startsWith('KDB') && p.dn !== 2000 && p.dn !== 2500) return false;
            if (!isZelbet && id.startsWith('KDZ') && p.dn !== 2000 && p.dn !== 2500) return false;
        }

        if (p.componentType === 'krag_ot') {
            const isZelbet = well.nadbudowa === 'zelbetowa';
            if (isZelbet && id.startsWith('KDB') && p.dn !== 2000 && p.dn !== 2500) return false;
            if (!isZelbet && id.startsWith('KDZ') && p.dn !== 2000 && p.dn !== 2500) return false;
        }

        if (p.componentType === 'krag' || p.componentType === 'konus') {
            const isNierdzewna = checkId.endsWith('-N-D');
            const isDrabinka = !isNierdzewna && checkId.endsWith('-D');
            const isBrak = checkId.endsWith('-B');
            const hasStepSuffix = isNierdzewna || isDrabinka || isBrak;

            if (well.stopnie === 'brak') {
                if (!isBrak) return false;
            } else if (well.stopnie === 'nierdzewna') {
                if (isBrak || isDrabinka) return false;
                if (!isNierdzewna) return false;
            } else {
                if (isBrak || isNierdzewna) return false;
                if (!hasStepSuffix) return false;
            }
        }

        if (p.componentType === 'plyta_redukcyjna' && !well.redukcjaDN1000) {
            return false;
        }

        return true;
    } catch (e) {
        logger.error('wellConfigRules', 'Błąd w filterByWellParams:', e, p, well);
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

window.filterByWellParams = filterByWellParams;
window.getAvailableProducts = getAvailableProducts;
window.getSortedConfig = getSortedConfig;
window.filterSealsByWellType = filterSealsByWellType;
window.buildConfigSegmentMap = buildConfigSegmentMap;
