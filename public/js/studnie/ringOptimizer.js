/* ============================
   Ring Optimizer — Optymalizacja kręgów (DP solver)
   Port z Logika/cp_optimizer.py (CP-SAT → Dynamic Programming)
   ============================ */

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
 * @returns {{ success: boolean, selectedRings: Array }}
 */
function optimizeRingsForDistance(targetDistance, availableRings, toleranceBelow = 50, toleranceAbove = 20) {
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
    // z max Σ(count × height²)
    return solveDPRings(heights, minAllowed, maxAllowed, availableRings);
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
        const ring = regularFirst.find(r =>
            parseFloat(r.height) === h && r.componentType === 'krag'
        ) || regularFirst.find(r =>
            parseFloat(r.height) === h
        );

        if (ring) {
            result.push(ring);
        }
    }

    // Sortuj: najwyższe kręgi na dole (blisko dennicy) — jak w generator.py linia 71
    result.sort((a, b) => (parseFloat(b.height) || 0) - (parseFloat(a.height) || 0));

    return result;
}
