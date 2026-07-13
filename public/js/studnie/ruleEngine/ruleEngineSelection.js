// @ts-check
/* ============================
   Rule Engine — Silnik reguł doboru elementów studni
   Część: Selection Rules (dobór dennicy, konusa, kręgów, płyt)
   Port z Logika/rules.py
   ============================ */

/**
 * Zwraca atrybut formy standardowej dla danego magazynu.
 * @param {string} warehouse - 'Włocławek' lub 'Kluczbork'
 * @returns {string} nazwa pola formy standardowej
 */
function getFormaField(warehouse) {
    const isWl = (warehouse || '').includes('oc') || (warehouse || '').includes('Włoc');
    return isWl ? 'formaStandardowa' : 'formaStandardowaKLB';
}

/**
 * Wybiera najniższą dennicę dla danego DN.
 * Priorytet: forma standardowa (malejąco), potem wysokość (rosnąco).
 *
 * Port z: Logika/rules.py → RuleEngine.get_lowest_dennica()
 *
 * Walidacja przejść (opcjonalna): Gdy podano transitions,
 * sprawdza zapasy rur WEWNĄTRZ dennicy (rury powyżej → kręgi OT).
 * Port z: rules.py:75-107 → check_dennica_internal()
 *
 * @param {Array} products - lista wszystkich dostępnych produktów
 * @param {string|number} dn - średnica studni
 * @param {string} warehouse - 'Kluczbork' lub 'Włocławek'
 * @param {Array} [transitions] - przejścia [{rzednaWlaczenia, productId}] (opcjonalne)
 * @param {number} [rzDna] - rzędna dna studni (opcjonalne, potrzebne z transitions)
 * @returns {Object|null} najlepsza dennica lub null
 */
function getLowestDennica(products, dn, warehouse, transitions, rzDna) {
    const ff = getFormaField(warehouse);

    let dennicy = products.filter((p) => {
        if (dn === 'styczna') {
            return p.componentType === 'styczna' || p.category === 'Studnie styczne';
        }
        return (
            p.componentType === 'dennica' &&
            parseInt(String(p.dn)) === parseInt(String(dn)) &&
            parseFloat(p.height) > 0
        );
    });

    if (dennicy.length === 0) return null;

    dennicy = [...dennicy].sort((a, b) => {
        const hA = parseFloat(a.height) || 0;
        const hB = parseFloat(b.height) || 0;
        if (hA !== hB) return hA - hB;
        const fA = parseInt(a[ff]) || 0;
        const fB = parseInt(b[ff]) || 0;
        return fB - fA;
    });

    if (!transitions || transitions.length === 0) {
        return dennicy[0];
    }

    const checkDennicaInternal = (d, mode) => {
        for (const pr of transitions) {
            const pel = parseFloat(pr.rzednaWlaczenia);
            if (isNaN(pel)) continue;
            const hcInvert = (pel - (rzDna || 0)) * 1000;

            if (hcInvert >= d.height) continue;

            const pprod =
                typeof studnieProducts !== 'undefined'
                    ? studnieProducts.find((x) => x.id === pr.productId)
                    : products.find((x) => x.id === pr.productId);
            if (!pprod) continue;

            let dnVal = 160;
            if (pprod.dn && typeof pprod.dn === 'string' && pprod.dn.includes('/')) {
                dnVal = parseFloat(pprod.dn.split('/')[1]) || 160;
            } else if (pprod.dn) {
                dnVal = parseFloat(pprod.dn) || 160;
            }

            const zDol = parseFloat(pprod.zapasDol) || 300;
            const zGora = parseFloat(pprod.zapasGora) || 300;
            const zDolMin = parseFloat(pprod.zapasDolMin) || 150;
            const zGoraMin = parseFloat(pprod.zapasGoraMin) || 150;

            const isNearBottom = hcInvert <= 0;
            const effZDol = isNearBottom ? -9999 : zDol;
            const effZDolMin = isNearBottom ? -9999 : zDolMin;

            const bottomClearance = hcInvert;
            const topClearance = d.height - (hcInvert + dnVal);
            const SAFETY = 15;

            if (mode === 'standard') {
                if (bottomClearance < effZDol + SAFETY || topClearance < zGora + SAFETY)
                    return false;
            } else if (mode === 'minimal') {
                if (bottomClearance < effZDolMin + SAFETY || topClearance < zGoraMin + SAFETY)
                    return false;
            } else if (mode === 'physical') {
                if (topClearance < 0) return false;
            }
        }
        return true;
    };

    for (const d of dennicy) {
        if (checkDennicaInternal(d, 'standard')) return d;
    }

    for (const d of dennicy) {
        if (checkDennicaInternal(d, 'minimal')) return d;
    }

    for (const d of dennicy) {
        if (checkDennicaInternal(d, 'physical')) return d;
    }

    return dennicy[dennicy.length - 1];
}

/**
 * Hybrydowy dobór dennicy — Phase 1.
 *
 * Phase 1: Wrapper wokół starego kodu z telemetrią i pre-filtrowaniem
 * przez Requirements Engine.
 *
 * Phase 2: Zastąpi całkowicie getLowestDennica().
 *
 * @param {Array} products - lista wszystkich dostępnych produktów
 * @param {string|number} dn - średnica studni
 * @param {string} warehouse - 'Kluczbork' lub 'Włocławek'
 * @param {Array} [transitions] - przejścia [{rzednaWlaczenia, productId}]
 * @param {number} [rzDna] - rzędna dna studni
 * @param {*} [preferredDn] - preferowana średnica (opcjonalne)
 * @returns {Object} { dennica: Object|null, reason: string }
 */
function getLowestDennicaHybrid(products, dn, warehouse, transitions, rzDna, preferredDn) {
    const ff = getFormaField(warehouse);

    let dennicy = products.filter((p) => {
        if (dn === 'styczna') {
            const isStyczna = p.componentType === 'styczna' || p.category === 'Studnie styczne';
            if (!isStyczna) return false;
            if (preferredDn) return parseInt(String(p.dn)) === parseInt(String(preferredDn));
            return true;
        }
        return (
            p.componentType === 'dennica' &&
            parseInt(String(p.dn)) === parseInt(String(dn)) &&
            parseFloat(p.height) > 0
        );
    });

    if (dennicy.length === 0) return { dennica: null, reason: 'no_dennice' };

    dennicy = [...dennicy].sort((a, b) => {
        const hA = parseFloat(a.height) || 0;
        const hB = parseFloat(b.height) || 0;
        if (hA !== hB) return hA - hB;
        const fA = parseInt(a[ff]) || 0;
        const fB = parseInt(b[ff]) || 0;
        return fB - fA;
    });

    if (!transitions || transitions.length === 0) {
        return { dennica: dennicy[0], reason: 'no_transitions' };
    }

    const candidates = dennicy;

    const checkInternal = (d, mode) => {
        for (const pr of transitions) {
            const pel = parseFloat(pr.rzednaWlaczenia);
            if (isNaN(pel)) continue;
            const hcInvert = (pel - (rzDna || 0)) * 1000;
            if (hcInvert >= d.height) continue;

            const pprod =
                typeof studnieProducts !== 'undefined'
                    ? studnieProducts.find((x) => x.id === pr.productId)
                    : products.find((x) => x.id === pr.productId);
            if (!pprod) continue;

            let dnVal = 160;
            if (pprod.dn && typeof pprod.dn === 'string' && pprod.dn.includes('/'))
                dnVal = parseFloat(pprod.dn.split('/')[1]) || 160;
            else if (pprod.dn) dnVal = parseFloat(pprod.dn) || 160;

            const zDol = parseFloat(pprod.zapasDol) || 300;
            const zGora = parseFloat(pprod.zapasGora) || 300;
            const zDolMin = parseFloat(pprod.zapasDolMin) || 150;
            const zGoraMin = parseFloat(pprod.zapasGoraMin) || 150;
            const isNearBottom = hcInvert <= 0;
            const effZDol = isNearBottom ? -9999 : zDol;
            const effZDolMin = isNearBottom ? -9999 : zDolMin;
            const bottomClearance = hcInvert;
            const topClearance = d.height - (hcInvert + dnVal);
            const SAFETY = 15;

            if (mode === 'standard') {
                if (bottomClearance < effZDol + SAFETY || topClearance < zGora + SAFETY)
                    return false;
            } else if (mode === 'minimal') {
                if (bottomClearance < effZDolMin + SAFETY || topClearance < zGoraMin + SAFETY)
                    return false;
            }
        }
        return true;
    };

    for (const mode of ['standard', 'minimal']) {
        for (const d of candidates) {
            if (checkInternal(d, mode)) {
                return { dennica: d, reason: 'hybrid_' + mode };
            }
        }
    }

    return { dennica: dennicy[0], reason: 'fallback_lowest' };
}

/**
 * Szuka płyty redukcyjnej (z DN do DN1000 lub DN1200).
 *
 * Port z: Logika/rules.py → RuleEngine.get_reduction_plate()
 *
 * @param {Array} products - lista produktów
 * @param {string|number} dn - średnica studni
 * @param {boolean} useReduction - czy redukcja jest aktywna
 * @param {number} targetDn - średnica docelowa (domyślnie 1000)
 * @returns {Object|null} płyta redukcyjna lub null
 */
function getReductionPlate(products, dn, useReduction, targetDn = 1000) {
    if (!useReduction || parseInt(String(dn)) <= 1000) return null;
    const tDn = targetDn || 1000;

    const plates = products.filter((p) => {
        if (p.componentType !== 'plyta_redukcyjna') return false;
        if (parseInt(String(p.dn)) !== parseInt(String(dn))) return false;

        const nameUpper = (p.name || '').toUpperCase();
        return (
            nameUpper.includes('/' + tDn) ||
            nameUpper.includes(' DN' + tDn) ||
            nameUpper.includes('X' + tDn) ||
            nameUpper.includes(' NA ' + tDn) ||
            nameUpper.includes('→DN' + tDn) ||
            nameUpper.includes('→' + tDn) ||
            nameUpper.includes('->DN' + tDn) ||
            nameUpper.includes('->' + tDn)
        );
    });

    return plates.length > 0 ? plates[0] : null;
}

/**
 * Dobór zakończenia studni (konus / płyta DIN).
 *
 * Port z: Logika/rules.py → RuleEngine.get_top_closure()
 *
 * Logika:
 * 1. Jeśli użytkownik wymusił ID → użyj go (jeśli pasuje do DN)
 * 2. Jeśli fallbackToDin → preferuj Płytę DIN (kolizja z przejściem w konusie)
 * 3. Domyślnie → preferuj Konus, potem Płytę DIN
 *
 * @param {Array} products - lista produktów
 * @param {number} topDn - DN sekcji górnej (nach redukcji może być 1000)
 * @param {string|null} forcedId - wymuszony ID zakończenia
 * @param {boolean} fallbackToDin - wymuszenie Płyty DIN (np. kolizja)
 * @param {string} warehouse - 'Kluczbork' lub 'Włocławek'
 * @returns {Object|null} element zakończenia
 */
function getTopClosure(products, topDn, forcedId, fallbackToDin, warehouse) {
    const ff = getFormaField(warehouse);
    const dn = parseInt(String(topDn));
    const blockKonus = fallbackToDin;

    if (forcedId && !fallbackToDin) {
        const forced = products.find((p) => p.id === forcedId);
        if (forced && (parseInt(forced.dn) === dn || forced.dn === null)) {
            return forced;
        }
        return null;
    }

    const konusy = blockKonus
        ? []
        : products
              .filter((p) => p.componentType === 'konus' && parseInt(p.dn) === dn)
              .sort((a, b) => (parseInt(b[ff]) || 0) - (parseInt(a[ff]) || 0));

    const dinPlates = products
        .filter((p) => p.componentType === 'plyta_din' && parseInt(p.dn) === dn)
        .sort((a, b) => (parseInt(b[ff]) || 0) - (parseInt(a[ff]) || 0));

    if (fallbackToDin) {
        if (dinPlates.length > 0) return dinPlates[0];
        if (konusy.length > 0) return konusy[0];
        return null;
    }

    if (konusy.length > 0) return konusy[0];
    if (dinPlates.length > 0) return dinPlates[0];

    return null;
}

/**
 * Zwraca listę kręgów dla danej średnicy, posortowanych wg formy standardowej.
 *
 * Port z: Logika/rules.py → RuleEngine.get_kregi_list()
 *
 * @param {Array} products - lista produktów
 * @param {string|number} dn - średnica
 * @param {string} warehouse - 'Kluczbork' lub 'Włocławek'
 * @returns {Array} posortowana lista kręgów
 */
function getKregiList(products, dn, warehouse) {
    const ff = getFormaField(warehouse);

    const effectiveDn = dn === 'styczna' ? 1000 : dn;
    const kregi = products.filter(
        (p) =>
            (p.componentType === 'krag' || p.componentType === 'krag_ot') &&
            parseInt(String(p.dn)) === parseInt(String(effectiveDn)) &&
            parseFloat(p.height) > 0
    );

    const kregiSorted = [...kregi].sort((a, b) => {
        const fA = parseInt(a[ff]) || 0;
        const fB = parseInt(b[ff]) || 0;
        if (fA !== fB) return fB - fA;
        return (parseFloat(b.height) || 0) - (parseFloat(a.height) || 0);
    });

    return kregiSorted;
}
