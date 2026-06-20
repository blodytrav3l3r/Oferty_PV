// @ts-check
/* ============================
   Ring Optimizer — Optymalizacja kręgów (DP solver)
   Port z Logika/cp_optimizer.py (CP-SAT → Dynamic Programming)
   ============================ */



/**
 * Sprawdza czy łączenia kręgów (joint positions) nie kolidują z przejściami rur.
 * Port z: cp_optimizer.py → _classify_transitions_for_ring / constraint logic
 *
 * @param {Array} selectedRings - lista wybranych kręgów z polami: height
 * @param {Array} transitions - przejścia [{productId, rzednaWlaczenia}]
 * @param {Array} availableProducts - pełna lista produktów (do odczytu DN/zapasów)
 * @param {number} fixedBelowHeight - wysokość pod kręgami (dennica)
 * @param {string} mode - 'standard' lub 'minimal'
 * @returns {boolean} true = brak kolizji
 */
function validateRingJoints(selectedRings, transitions, availableProducts, fixedBelowHeight, mode) {
    if (!transitions || transitions.length === 0) return true;
    if (!selectedRings || selectedRings.length === 0) return true;

    // Oblicz pozycje łączeń kręgów (joint = koniec jednego kręgu / początek drugiego)
    const joints = [];
    let y = 0;
    for (const ring of selectedRings) {
        y += parseFloat(ring.height) || 0;
        joints.push(y); // pozycja łączenia WZGLĘDEM fixedBelowHeight
    }
    // Ostatni joint to góra — nie jest łączeniem z następnym kręgiem, pomijamy
    joints.pop();

    if (joints.length === 0) return true;

    const SAFETY_MARGIN = 15; // mm — spójne z validator.py:85

    for (const t of transitions) {
        const pprod = availableProducts.find(p => p.id === (t.productId || t.id));
        if (!pprod) continue;

        let dn = 160;
        if (pprod.dn && typeof pprod.dn === 'string' && pprod.dn.includes('/')) {
            dn = parseFloat(pprod.dn.split('/')[1]) || 160;
        } else if (pprod.dn) {
            dn = parseFloat(pprod.dn) || 160;
        }

        // Rzędna rury WZGLĘDEM kręgów (zero = fixedBelowHeight)
        let hcInvertAbs;
        if (t.rzednaWlaczenia !== undefined) {
            // Frontend format: rzednaWlaczenia (rzędna bezwzględna)
            hcInvertAbs = parseFloat(t.rzednaWlaczenia);
            if (isNaN(hcInvertAbs)) continue;
            // Przelicz na mm od dna (ale bez fixedBelowHeight — tego nie mamy tu)
            // Skoro to jest wewnątrz solvera, transitions w fillKregiDP nie mają tego formatu
            continue; // Ten format nie jest używany w kontekście DP
        } else if (t.height_from_bottom_mm !== undefined) {
            // Backend format
            hcInvertAbs = parseFloat(t.height_from_bottom_mm);
        } else {
            continue;
        }

        const hcInvertRel = hcInvertAbs - fixedBelowHeight;
        if (hcInvertRel < 0) continue; // Rura w dennicy, nie dotyczy kręgów

        let zDol, zGora;
        if (mode === 'standard') {
            zDol = parseFloat(pprod.zapasDol) || 300;
            zGora = parseFloat(pprod.zapasGora) || 300;
        } else {
            zDol = parseFloat(pprod.zapasDolMin) || 150;
            zGora = parseFloat(pprod.zapasGoraMin) || 150;
        }

        // Strefa niebezpieczna: od (dolna krawędź rury - zapas dolny) do (górna krawędź rury + zapas górny)
        const dangerBottom = hcInvertRel - zDol - SAFETY_MARGIN;
        const dangerTop = hcInvertRel + dn + zGora + SAFETY_MARGIN;

        // Sprawdź czy którekolwiek łączenie jest w strefie niebezpiecznej
        for (const joint of joints) {
            if (joint >= dangerBottom && joint <= dangerTop) {
                return false; // Kolizja!
            }
        }
    }

    return true;
}

/**
 * Oblicza optymalną kombinację kręgów dla zadanej wysokości, priorityzując
 * najwyższe kręgi (mniejsza ilość = łatwiejszy montaż).
 *
 * Port z: Logika/cp_optimizer.py → optimize_rings_for_distance()
 *
 * Cel optymalizacji: max Σ(count × height²) — identyczny jak w CP-SAT
 * Gwarantuje: target - toleranceBelow ≤ totalHeight ≤ target + toleranceAbove
 *
 * @param {number} targetDistance - docelowa wysokość w mm
 * @param {Array} availableRings - dostępne kręgi z polami: id, height, ...
 * @param {number} toleranceBelow - dozwolone odchylenie w dół (domyślnie 50mm)
 * @param {number} toleranceAbove - dozwolone odchylenie w górę (domyślnie 0mm)
 * @param {Array} [transitions] - przejścia (opcjonalne, do walidacji kolizji)
 * @param {Array} [availableProducts] - produkty (opcjonalne, do odczytu DN/zapasów)
 * @param {number} [fixedBelowHeight] - wysokość pod kręgami, np. dennica (opcjonalne)
 * @param {string} [mode] - 'standard' lub 'minimal' (opcjonalne)
 * @returns {{ success: boolean, selectedRings: Array }}
 */
function optimizeRingsForDistance(
    targetDistance,
    availableRings,
    toleranceBelow = 50,
    toleranceAbove = 20,
    transitions = null,
    availableProducts = null,
    fixedBelowHeight = 0,
    mode = 'standard'
) {
    if (targetDistance <= 0) {
        return { success: true, selectedRings: [] };
    }

    if (!availableRings || availableRings.length === 0) {
        return { success: false, selectedRings: [] };
    }

    // Unikalne wysokości dostępne (posortowane malejąco jak w CP-SAT)
    const heightsSet = new Set();
    for (const r of availableRings) {
        const h = parseFloat(r.height);
        if (h > 0) heightsSet.add(h);
    }

    const heights = Array.from(heightsSet).sort((a, b) => b - a);
    if (heights.length === 0) {
        return { success: false, selectedRings: [] };
    }

    const minAllowed = targetDistance - toleranceBelow;
    const maxAllowed = targetDistance + toleranceAbove;

    // DP: szukamy rozwiązania w zakresie [minAllowed, maxAllowed]
    const dpResult = solveDPRings(heights, minAllowed, maxAllowed, availableRings);

    if (!dpResult.success) {
        return dpResult;
    }

    // Walidacja kolizji łączeń z przejściami (transition-aware)
    if (transitions && transitions.length > 0 && availableProducts) {
        const isValid = validateRingJoints(
            dpResult.selectedRings, transitions, availableProducts,
            fixedBelowHeight, mode
        );

        if (!isValid) {
            // Próbuj alternatywne rozwiązania DP z lekko zmienionym targetem
            const alternativeResult = findAlternativeDPSolution(
                heights, minAllowed, maxAllowed, availableRings,
                transitions, availableProducts, fixedBelowHeight, mode
            );
            if (alternativeResult) {
                return alternativeResult;
            }
            // Fallback: zwróć oryginalne rozwiązanie (bez walidacji)
            // — solver wyżej (checkConflicts) i tak to sprawdzi
            logger.warn('ringOptimizer', '[ringOptimizer] Żadne rozwiązanie DP nie przeszło walidacji przejść — fallback do najlepszego DP');
        }
    }

    return dpResult;
}

/**
 * Szuka alternatywnego rozwiązania DP, które nie koliduje z przejściami.
 * Przegląda wszystkie dopuszczalne wysokości w zakresie [minAllowed, maxAllowed]
 * i dla każdej sprawdza walidację kolizji.
 *
 * @returns {{ success: boolean, selectedRings: Array }|null}
 */
function findAlternativeDPSolution(
    heights, minAllowed, maxAllowed, availableRings,
    transitions, availableProducts, fixedBelowHeight, mode
) {
    const cap = maxAllowed;

    // Zbuduj pełne DP (identyczne jak solveDPRings)
    const dp = new Array(cap + 1).fill(null);
    dp[0] = { score: 0, prevH: -1, addedHeight: 0 };

    for (let h = 1; h <= cap; h++) {
        for (const ringH of heights) {
            if (ringH > h) continue;
            const prev = dp[h - ringH];
            if (prev === null) continue;
            const newScore = prev.score + ringH * ringH;
            if (dp[h] === null || newScore > dp[h].score) {
                dp[h] = { score: newScore, prevH: h - ringH, addedHeight: ringH };
            }
        }
    }

    // Zbierz wszystkie dopuszczalne wysokości posortowane wg score (malejąco)
    const candidates = [];
    for (let h = Math.max(0, minAllowed); h <= cap; h++) {
        if (dp[h] !== null) {
            candidates.push({ h, score: dp[h].score });
        }
    }
    candidates.sort((a, b) => b.score - a.score);

    // Sprawdź walidację dla każdego kandydata (pomijając najlepszy, bo już sprawdzony)
    for (let i = 1; i < candidates.length && i < 20; i++) {
        const candidateH = candidates[i].h;

        const selectedHeights = [];
        let current = candidateH;
        while (current > 0 && dp[current] !== null) {
            selectedHeights.push(dp[current].addedHeight);
            current = dp[current].prevH;
        }

        const selectedRings = mapHeightsToProducts(selectedHeights, availableRings);

        const isValid = validateRingJoints(
            selectedRings, transitions, availableProducts,
            fixedBelowHeight, mode
        );

        if (isValid) {
            logger.info('ringOptimizer', '[ringOptimizer] Znaleziono alternatywne rozwiązanie DP bez kolizji przejść');
            return { success: true, selectedRings };
        }
    }

    return null; // Żadne alternatywne rozwiązanie nie przeszło walidacji
}

/**
 * Solver Dynamic Programming — szuka najlepszej kombinacji kręgów.
 *
 * Algorytm:
 * 1. Buduj DP od 0 do maxAllowed (capacity)
 * 2. Dla każdej wysokości h, rozważ dodanie kręgu
 * 3. Score = Σ(count × h²) — preferuje duże kręgi
 * 4. Z dopuszczalnych rozwiązań [minAllowed, maxAllowed] wybierz najlepsze (max score)
 *
 * @param {number[]} heights - unikalne wysokości kręgów, posortowane malejąco
 * @param {number} minAllowed - minimalna dopuszczalna wysokość
 * @param {number} maxAllowed - maksymalna dopuszczalna wysokość
 * @param {Array} availableRings - pełna lista kręgów (do mapowania na produkty)
 * @returns {{ success: boolean, selectedRings: Array }}
 */
function solveDPRings(heights, minAllowed, maxAllowed, availableRings) {
    // Jeśli minAllowed <= 0, puste rozwiązanie jest dopuszczalne
    if (minAllowed <= 0) {
        return { success: true, selectedRings: [] };
    }

    const cap = maxAllowed;

    // dp[h] = { score, prevH, addedHeight }
    // score = max Σ(count × height²) dla osiągnięcia dokładnej wysokości h
    const dp = new Array(cap + 1).fill(null);
    dp[0] = { score: 0, prevH: -1, addedHeight: 0 };

    for (let h = 1; h <= cap; h++) {
        for (const ringH of heights) {
            if (ringH > h) continue;
            const prev = dp[h - ringH];
            if (prev === null) continue;

            // Score to Σ(count × height²) — każde dodanie kręgu o wys. ringH
            // zwiększa score o ringH² (bo to kolejna sztuka)
            const newScore = prev.score + ringH * ringH;

            if (dp[h] === null || newScore > dp[h].score) {
                dp[h] = { score: newScore, prevH: h - ringH, addedHeight: ringH };
            }
        }
    }

    // Znajdź najlepsze rozwiązanie w dopuszczalnym zakresie
    let bestH = -1;
    let bestScore = -1;

    for (let h = Math.max(0, minAllowed); h <= cap; h++) {
        if (dp[h] !== null && dp[h].score > bestScore) {
            bestScore = dp[h].score;
            bestH = h;
        }
    }

    if (bestH < 0) {
        return { success: false, selectedRings: [] };
    }

    // Odtwórz rozwiązanie wstecz
    const selectedHeights = [];
    let current = bestH;
    while (current > 0 && dp[current] !== null) {
        selectedHeights.push(dp[current].addedHeight);
        current = dp[current].prevH;
    }

    // Zmapuj wysokości na modele produktów
    // Port z: cp_optimizer.py → linia 63-67
    // Dla każdej wysokości wybierz pierwszy pasujący krąg (available_rings
    // są już posortowane wg formy standardowej przez getKregiList)
    const selectedRings = mapHeightsToProducts(selectedHeights, availableRings);

    return { success: true, selectedRings };
}

/**
 * Mapuje listę wysokości na konkretne produkty kręgów.
 * Preferuje kręgi typu 'krag' (nie 'krag_ot') i formy standardowe.
 *
 * @param {number[]} selectedHeights - lista wybranych wysokości
 * @param {Array} availableRings - dostępne kręgi (posortowane wg preferencji)
 * @returns {Array} lista wybranych produktów
 */
function mapHeightsToProducts(selectedHeights, availableRings) {
    const result = [];

    // Preferuj zwykłe kręgi (nie OT) — OT zostaną zamienione później
    // przez applyDrilledRings() jeśli trzeba
    const regularFirst = [...availableRings].sort((a, b) => {
        if (a.componentType === 'krag' && b.componentType === 'krag_ot') return -1;
        if (a.componentType === 'krag_ot' && b.componentType === 'krag') return 1;
        return 0;
    });

    for (const h of selectedHeights) {
        const ring =
            regularFirst.find((r) => parseFloat(r.height) === h && r.componentType === 'krag') ||
            regularFirst.find((r) => parseFloat(r.height) === h);

        if (ring) {
            result.push(ring);
        }
    }

    // Sortuj: najwyższe kręgi na dole (blisko dennicy) — jak w generator.py linia 71
    result.sort((a, b) => (parseFloat(b.height) || 0) - (parseFloat(a.height) || 0));

    return result;
}
