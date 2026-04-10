/* ============================
   Rule Engine — Silnik reguł doboru elementów studni
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
 * @param {Array} products - lista wszystkich dostępnych produktów
 * @param {number} dn - średnica studni
 * @param {string} warehouse - 'Kluczbork' lub 'Włocławek'
 * @returns {Object|null} najlepsza dennica lub null
 */
function getLowestDennica(products, dn, warehouse) {
    const ff = getFormaField(warehouse);

    const dennicy = products.filter((p) => {
        if (dn === 'styczna') {
            return p.componentType === 'styczna' || p.category === 'Studnie styczne';
        }
        return p.componentType === 'dennica' && parseInt(p.dn) === parseInt(dn);
    });

    if (dennicy.length === 0) return null;

    // Sortowanie: (-forma_std, height) — standardowe formy na górze, potem najniższa
    dennicy.sort((a, b) => {
        const fA = parseInt(a[ff]) || 0;
        const fB = parseInt(b[ff]) || 0;
        if (fA !== fB) return fB - fA; // malejąco forma
        return (parseFloat(a.height) || 0) - (parseFloat(b.height) || 0); // rosnąco wysokość
    });

    return dennicy[0];
}

/**
 * Szuka płyty redukcyjnej (z DN do DN1000).
 *
 * Port z: Logika/rules.py → RuleEngine.get_reduction_plate()
 *
 * @param {Array} products - lista produktów
 * @param {number} dn - średnica studni
 * @param {boolean} useReduction - czy redukcja jest aktywna
 * @returns {Object|null} płyta redukcyjna lub null
 */
function getReductionPlate(products, dn, useReduction) {
    if (!useReduction || parseInt(dn) <= 1000) return null;

    const plates = products.filter(
        (p) => p.componentType === 'plyta_redukcyjna' && parseInt(p.dn) === parseInt(dn)
    );

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
    const dn = parseInt(topDn);

    // 1. Wymuszony przez użytkownika
    if (forcedId && !fallbackToDin) {
        const forced = products.find((p) => p.id === forcedId);
        if (forced && (parseInt(forced.dn) === dn || forced.dn === null)) {
            return forced;
        }
    }

    // Kandydaci
    const konusy = products
        .filter((p) => p.componentType === 'konus' && parseInt(p.dn) === dn)
        .sort((a, b) => (parseInt(b[ff]) || 0) - (parseInt(a[ff]) || 0));

    const dinPlates = products
        .filter((p) => p.componentType === 'plyta_din' && parseInt(p.dn) === dn)
        .sort((a, b) => (parseInt(b[ff]) || 0) - (parseInt(a[ff]) || 0));

    // 2. Fallback do DIN (kolizja z konusem)
    if (fallbackToDin) {
        if (dinPlates.length > 0) return dinPlates[0];
        if (konusy.length > 0) return konusy[0];
        return null;
    }

    // 3. Preferuj Konus, potem DIN
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
 * @param {number} dn - średnica
 * @param {string} warehouse - 'Kluczbork' lub 'Włocławek'
 * @returns {Array} posortowana lista kręgów
 */
function getKregiList(products, dn, warehouse) {
    const ff = getFormaField(warehouse);

    const effectiveDn = dn === 'styczna' ? 1000 : dn;
    const kregi = products.filter(
        (p) =>
            (p.componentType === 'krag' || p.componentType === 'krag_ot') &&
            parseInt(p.dn) === parseInt(effectiveDn)
    );

    // Sortowanie: (-forma_std, -height) — standardowe i najwyższe na górze
    kregi.sort((a, b) => {
        const fA = parseInt(a[ff]) || 0;
        const fB = parseInt(b[ff]) || 0;
        if (fA !== fB) return fB - fA;
        return (parseFloat(b.height) || 0) - (parseFloat(a.height) || 0);
    });

    return kregi;
}
