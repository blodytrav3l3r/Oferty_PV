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
 * Oblicza wymagania wysokościowe sekcji dennej na podstawie przejść.
 * 
 * To jest WARSTWA 1 (Requirements Engine) w architekturze:
 * Requirements → Layout → Solver → Scoring
 * 
 * Nie wybiera dennicy. Tylko mówi: "potrzebuję tyle miejsca".
 * 
 * @param {Array} transitions - przejścia [{rzednaWlaczenia, productId, dn}]
 * @param {number} rzDna - rzędna dna studni
 * @returns {Object} { minBottomH, highestTop, hasNearBottomPipes, isSettling, needsOTRing, violations }
 */
function calculateConnectionRequirements(transitions, rzDna) {
    const result = {
        minBottomH: 0,
        highestTop: 0,
        hasNearBottomPipes: false,
        isSettling: false,
        needsOTRing: false,
        violations: [],
        pipes: []
    };

    if (!transitions || transitions.length === 0) return result;

    const SAFETY = 15;
    let allAboveBottom = true;

    for (const pr of transitions) {
        const pel = parseFloat(pr.rzednaWlaczenia);
        if (isNaN(pel)) continue;

        const hcInvert = (pel - (rzDna || 0)) * 1000;

        const pprod = typeof studnieProducts !== 'undefined'
            ? studnieProducts.find(x => x.id === pr.productId)
            : null;

        let dnVal = 160;
        if (pprod?.dn) {
            if (typeof pprod.dn === 'string' && pprod.dn.includes('/'))
                dnVal = parseFloat(pprod.dn.split('/')[1]) || 160;
            else dnVal = parseFloat(pprod.dn) || 160;
        } else if (pr.dn) {
            dnVal = parseFloat(pr.dn) || 160;
        }

        const pipeTop = hcInvert + dnVal;
        const isNearBottom = hcInvert <= 0;
        const isAboveDennica = false; // determined per-candidate later

        result.pipes.push({
            hcInvert,
            dnVal,
            pipeTop,
            isNearBottom,
            zapasDol: pprod ? parseFloat(pprod.zapasDol) || 300 : 300,
            zapasGora: pprod ? parseFloat(pprod.zapasGora) || 300 : 300,
            zapasDolMin: pprod ? parseFloat(pprod.zapasDolMin) || 150 : 150,
            zapasGoraMin: pprod ? parseFloat(pprod.zapasGoraMin) || 150 : 150
        });

        if (isNearBottom) result.hasNearBottomPipes = true;
        if (hcInvert > 1) allAboveBottom = false;
        if (pipeTop > result.highestTop) result.highestTop = pipeTop;
    }

    result.isSettling = allAboveBottom;
    return result;
}

/**
 * Szacuje minimalną wysokość sekcji dennej dla danego trybu clearance.
 * 
 * WARSTWA 1 (Requirements Engine):
 * Używa calculateConnectionRequirements() do wyliczenia constraintów,
 * zwraca minimalną wysokość bottom section dla danego trybu.
 * 
 * @param {Array} transitions - przejścia
 * @param {number} rzDna - rzędna dna
 * @param {string} mode - 'standard' | 'minimal' | 'physical'
 * @returns {Object} { requiredHeight, mode, hasViolations, details }
 */
function estimateBottomSection(transitions, rzDna, mode) {
    const req = calculateConnectionRequirements(transitions, rzDna);
    if (!transitions || transitions.length === 0 || req.pipes.length === 0) {
        return { requiredHeight: 0, mode, hasViolations: false, details: null };
    }

    const SAFETY = 15;
    let requiredHeight = 0;

    for (const p of req.pipes) {
        const zGora = mode === 'standard' ? p.zapasGora
                    : mode === 'minimal' ? p.zapasGoraMin
                    : 0;
        const zDol = mode === 'standard' ? p.zapasDol
                   : mode === 'minimal' ? p.zapasDolMin
                   : 0;

        // Rura przy dnie: tylko top clearance ma znaczenie
        if (p.isNearBottom) {
            // pipeTop = hcInvert + dnVal, ale hcInvert <=0, więc pipeTop <= dnVal
            const needed = p.pipeTop + zGora + SAFETY;
            if (needed > requiredHeight) requiredHeight = needed;
        } else {
            // Rura powyżej dna: bottom clearance + DN + top clearance
            const bottomPart = Math.max(0, p.hcInvert - zDol - SAFETY);
            const needed = bottomPart + p.dnVal + zGora + SAFETY;
            if (needed > requiredHeight) requiredHeight = needed;
        }
    }

    return {
        requiredHeight: Math.ceil(requiredHeight),
        mode,
        hasViolations: false,
        details: {
            pipeCount: req.pipes.length,
            highestTop: req.highestTop,
            hasNearBottomPipes: req.hasNearBottomPipes
        }
    };
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
 * @param {number} dn - średnica studni
 * @param {string} warehouse - 'Kluczbork' lub 'Włocławek'
 * @param {Array} [transitions] - przejścia [{rzednaWlaczenia, productId}] (opcjonalne)
 * @param {number} [rzDna] - rzędna dna studni (opcjonalne, potrzebne z transitions)
 * @returns {Object|null} najlepsza dennica lub null
 */
function getLowestDennica(products, dn, warehouse, transitions, rzDna) {
    const ff = getFormaField(warehouse);

    const dennicy = products.filter((p) => {
        if (dn === 'styczna') {
            return p.componentType === 'styczna' || p.category === 'Studnie styczne';
        }
        return p.componentType === 'dennica' && parseInt(p.dn) === parseInt(dn) && parseFloat(p.height) > 0;
    });

    if (dennicy.length === 0) return null;

    // Sortowanie: (height, -forma_std) — najniższa dennica PRIORYTET, potem forma standardowa
    // Spójne z backend: rules.py → get_lowest_dennica() linia 73
    dennicy.sort((a, b) => {
        const hA = parseFloat(a.height) || 0;
        const hB = parseFloat(b.height) || 0;
        if (hA !== hB) return hA - hB; // najniższa najpierw
        const fA = parseInt(a[ff]) || 0;
        const fB = parseInt(b[ff]) || 0;
        return fB - fA; // potem forma malejąco
    });

    // Bez przejść — zwróć najniższą (zachowanie wsteczne)
    if (!transitions || transitions.length === 0) {
        return dennicy[0];
    }

    // Z przejściami — sprawdź zapasy wewnątrz dennicy
    const checkDennicaInternal = (d, mode) => {
        for (const pr of transitions) {
            const pel = parseFloat(pr.rzednaWlaczenia);
            if (isNaN(pel)) continue;
            const hcInvert = (pel - (rzDna || 0)) * 1000; // mm od dna

            // Rura powyżej dennicy → trafi do kręgu OT, nie sprawdzaj
            if (hcInvert >= d.height) continue;

            const pprod = typeof studnieProducts !== 'undefined'
                ? studnieProducts.find(x => x.id === pr.productId)
                : products.find(x => x.id === pr.productId);
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

            // Próg: rura blisko dna → ignoruj zapas dolny (studnie osadnikowe)
            const isNearBottom = hcInvert <= 0; // Jeśli Z=0 to nie wymagaj zapasu z dołu
            const effZDol = isNearBottom ? -9999 : zDol;
            const effZDolMin = isNearBottom ? -9999 : zDolMin;

            const bottomClearance = hcInvert;
            const topClearance = d.height - (hcInvert + dnVal);
            const SAFETY = 15; // mm (zbieżne z checkConflicts i validator.py)

            if (mode === 'standard') {
                if (bottomClearance < (effZDol + SAFETY) || topClearance < (zGora + SAFETY)) return false;
            } else if (mode === 'minimal') {
                if (bottomClearance < (effZDolMin + SAFETY) || topClearance < (zGoraMin + SAFETY)) return false;
            } else if (mode === 'physical') {
                if (topClearance < 0) return false;
            }
        }
        return true;
    };

    // 1. Najniższa dennica z zapasami standardowymi
    for (const d of dennicy) {
        if (checkDennicaInternal(d, 'standard')) return d;
    }

    // 2. Najniższa dennica z zapasami minimalnymi
    for (const d of dennicy) {
        if (checkDennicaInternal(d, 'minimal')) return d;
    }

    // 3. Najniższa dennica, w której rury fizycznie się mieszczą (nawet bez zapasów)
    for (const d of dennicy) {
        if (checkDennicaInternal(d, 'physical')) return d;
    }

    // 4. Fallback absolutny: najwyższa dostępna dennica (aby zminimalizować kolizję)
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
 * @param {number} dn - średnica studni
 * @param {string} warehouse - 'Kluczbork' lub 'Włocławek'
 * @param {Array} [transitions] - przejścia [{rzednaWlaczenia, productId}]
 * @param {number} [rzDna] - rzędna dna studni
 * @returns {Object} { dennica: Object|null, reason: string }
 */
function getLowestDennicaHybrid(products, dn, warehouse, transitions, rzDna, preferredDn) {
    const ff = getFormaField(warehouse);

    const dennicy = products.filter((p) => {
        if (dn === 'styczna') {
            const isStyczna = p.componentType === 'styczna' || p.category === 'Studnie styczne';
            if (!isStyczna) return false;
            if (preferredDn) return parseInt(p.dn) === parseInt(preferredDn);
            return true;
        }
        return p.componentType === 'dennica' && parseInt(p.dn) === parseInt(dn) && parseFloat(p.height) > 0;
    });

    if (dennicy.length === 0) return { dennica: null, reason: 'no_dennice' };

    dennicy.sort((a, b) => {
        const hA = parseFloat(a.height) || 0;
        const hB = parseFloat(b.height) || 0;
        if (hA !== hB) return hA - hB;
        const fA = parseInt(a[ff]) || 0;
        const fB = parseInt(b[ff]) || 0;
        return fB - fA;
    });

    // Bez przejść — zwróć najniższą
    if (!transitions || transitions.length === 0) {
        return { dennica: dennicy[0], reason: 'no_transitions' };
    }

    // Nie filtruj dennicy po fizycznym minimum — pozwól solverowi + OT obsłużyć krzyżujące się rury
    const candidates = dennicy;

    // Helper: sprawdź luz wewnętrzny używając prekompilowanych danych lub fallbacku
    const checkInternal = (d, mode) => {
        for (const pr of transitions) {
            const pel = parseFloat(pr.rzednaWlaczenia);
            if (isNaN(pel)) continue;
            const hcInvert = (pel - (rzDna || 0)) * 1000;
            if (hcInvert >= d.height) continue;

            const pprod = typeof studnieProducts !== 'undefined'
                ? studnieProducts.find(x => x.id === pr.productId)
                : products.find(x => x.id === pr.productId);
            if (!pprod) continue;

            let dnVal = 160;
            if (pprod.dn && typeof pprod.dn === 'string' && pprod.dn.includes('/'))
                dnVal = parseFloat(pprod.dn.split('/')[1]) || 160;
            else if (pprod.dn)
                dnVal = parseFloat(pprod.dn) || 160;

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
                if (bottomClearance < (effZDol + SAFETY) || topClearance < (zGora + SAFETY)) return false;
            } else if (mode === 'minimal') {
                if (bottomClearance < (effZDolMin + SAFETY) || topClearance < (zGoraMin + SAFETY)) return false;
            }
        }
        return true;
    };

    // Spróbuj standardowego/minimalnego na wszystkich kandydatach
    for (const mode of ['standard', 'minimal']) {
        for (const d of candidates) {
            if (checkInternal(d, mode)) {
                return { dennica: d, reason: 'hybrid_' + mode };
            }
        }
    }

    // Fallback: zwróć najniższy — solver zdecyduje o OT
    return { dennica: dennicy[0], reason: 'fallback_lowest' };
}

/**
 * Szuka płyty redukcyjnej (z DN do DN1000 lub DN1200).
 *
 * Port z: Logika/rules.py → RuleEngine.get_reduction_plate()
 *
 * @param {Array} products - lista produktów
 * @param {number} dn - średnica studni
 * @param {boolean} useReduction - czy redukcja jest aktywna
 * @param {number} targetDn - średnica docelowa (domyślnie 1000)
 * @returns {Object|null} płyta redukcyjna lub null
 */
function getReductionPlate(products, dn, useReduction, targetDn = 1000) {
    if (!useReduction || parseInt(dn) <= 1000) return null;
    const tDn = targetDn || 1000;

    const plates = products.filter((p) => {
        if (p.componentType !== 'plyta_redukcyjna') return false;
        if (parseInt(p.dn) !== parseInt(dn)) return false;

        // Szukamy w nazwie wzorców pasujących do docelowej średnicy (np. →DN1000, /1000, DN1000)
        const nameUpper = (p.name || '').toUpperCase();
        return nameUpper.includes('/' + tDn) || 
               nameUpper.includes(' DN' + tDn) || 
               nameUpper.includes('X' + tDn) || 
               nameUpper.includes(' NA ' + tDn) ||
               nameUpper.includes('→DN' + tDn) ||
               nameUpper.includes('→' + tDn) ||
               nameUpper.includes('->DN' + tDn) ||
               nameUpper.includes('->' + tDn);
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
    const dn = parseInt(topDn);
    // Przekazany fallbackToDin z reguły oznacza wkładkę PEHD. Użyjmy go jako flagi do całkowitej blokady Konusa, bo PEHD tego wymaga.
    const blockKonus = fallbackToDin;

    // 1. Wymuszony przez użytkownika — jeśli nie znaleziony, zwróć null
    //    (caller ma fallback do pełnego katalogu + zwykłego konusa)
    if (forcedId && !fallbackToDin) {
        const forced = products.find((p) => p.id === forcedId);
        if (forced && (parseInt(forced.dn) === dn || forced.dn === null)) {
            return forced;
        }
        return null;
    }

    // Kandydaci
    const konusy = blockKonus ? [] : products
        .filter((p) => p.componentType === 'konus' && parseInt(p.dn) === dn)
        .sort((a, b) => (parseInt(b[ff]) || 0) - (parseInt(a[ff]) || 0));

    const dinPlates = products
        .filter((p) => p.componentType === 'plyta_din' && parseInt(p.dn) === dn)
        .sort((a, b) => (parseInt(b[ff]) || 0) - (parseInt(a[ff]) || 0));

    // 2. Fallback do DIN (kolizja z konusem lub wymuszony PEHD)
    if (fallbackToDin) {
        if (dinPlates.length > 0) return dinPlates[0];
        if (konusy.length > 0) return konusy[0]; // Jeżeli blockKonus zadziałał to będzie puste
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
            parseInt(p.dn) === parseInt(effectiveDn) &&
            parseFloat(p.height) > 0
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
