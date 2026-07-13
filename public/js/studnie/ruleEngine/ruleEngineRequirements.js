// @ts-check
/* ============================
   Rule Engine — Silnik reguł doboru elementów studni
   Część: Requirements Engine (WARSTWA 1)
   Port z Logika/rules.py
   ============================ */

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

        const pprod =
            typeof studnieProducts !== 'undefined'
                ? studnieProducts.find((x) => x.id === pr.productId)
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
        const isAboveDennica = false;

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
        const zGora = mode === 'standard' ? p.zapasGora : mode === 'minimal' ? p.zapasGoraMin : 0;
        const zDol = mode === 'standard' ? p.zapasDol : mode === 'minimal' ? p.zapasDolMin : 0;

        if (p.isNearBottom) {
            const needed = p.pipeTop + zGora + SAFETY;
            if (needed > requiredHeight) requiredHeight = needed;
        } else {
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
