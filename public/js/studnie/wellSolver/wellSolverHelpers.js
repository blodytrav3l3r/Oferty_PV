// @ts-check
/**
 * wellSolverHelpers.js — Funkcje pomocnicze solvera
 * Wyodrębnione z runJsAutoSelection() dla zmniejszenia rozmiaru pliku.
 */

/* ===== buildTopConfig — buduje konfigurację zakończenia górnego ===== */
function buildTopConfig(topP, well) {
    const items = [];
    let h = 0;
    let lbl = '';
    if (
        ['plyta_zamykajaca', 'plyta_najazdowa', 'pierscien_odciazajacy'].includes(
            topP.componentType
        )
    ) {
        const sameDn = studnieProducts.filter((p) => parseInt(p.dn) === parseInt(topP.dn));
        const ring = sameDn.find((p) => p.componentType === 'pierscien_odciazajacy');
        const plate =
            topP.componentType === 'pierscien_odciazajacy'
                ? sameDn.find(
                      (p) =>
                          p.componentType === 'plyta_zamykajaca' ||
                          p.componentType === 'plyta_najazdowa'
                  )
                : topP;
        if (ring && plate) {
            items.push({ productId: plate.id, quantity: 1 }, { productId: ring.id, quantity: 1 });
            h += plate.height + ring.height;
            lbl = plate.name + ' + Pierścień';
        } else {
            items.push({ productId: topP.id, quantity: 1 });
            h += topP.height;
            lbl = topP.name;
        }
    } else {
        items.push({ productId: topP.id, quantity: 1 });
        h += topP.height;
        lbl = topP.name;
    }

    let wlazItem = well.config.find(
        (c) => studnieProducts.find((p) => p.id === c.productId)?.componentType === 'wlaz'
    );
    if (!wlazItem) {
        const wlaz150 = studnieProducts.find((p) => p.id === 'WLAZ-150');
        if (wlaz150) wlazItem = { productId: wlaz150.id, quantity: 1 };
    }
    if (wlazItem) {
        const wlazProd = studnieProducts.find((p) => p.id === wlazItem.productId);
        if (wlazProd) {
            items.unshift(wlazItem);
            h += wlazProd.height * wlazItem.quantity;
            lbl = wlazProd.name + ' + ' + lbl;
        }
    }
    return { items, height: h, label: lbl, prod: topP };
}

/* ===== fillKregiDP — optymalizacja kręgów (DP) ===== */
function fillKregiDP(
    target,
    kList,
    tolBelow,
    tolAbove,
    fixedBelowHeight,
    transitionsForDP,
    availProducts
) {
    if (target <= 0) return { kItems: [], filled: 0 };

    logger.info(
        'wellSolver',
        '[fillKregiDP] target=',
        target,
        'kList.length=',
        kList.length,
        'tolBelow=',
        tolBelow,
        'tolAbove=',
        tolAbove
    );

    const dpResult = optimizeRingsForDistance(
        target,
        kList,
        tolBelow,
        tolAbove,
        transitionsForDP,
        availProducts,
        fixedBelowHeight
    );

    if (dpResult.success && dpResult.selectedRings.length > 0) {
        const kItems = dpResult.selectedRings.map((ring) => ({
            productId: ring.id,
            quantity: 1,
            _h: parseFloat(ring.height)
        }));
        const filled = kItems.reduce((sum, k) => sum + k._h, 0);
        return { kItems, filled };
    }

    return fillKregiGreedy(target, kList);
}

/* ===== fillKregiGreedy — zachłanne wypełnienie kręgami ===== */
function fillKregiGreedy(target, kList) {
    const kItems = [];
    let filled = 0;
    if (target > 0) {
        let left = target;
        for (const k of kList) {
            if (left <= 0) break;
            const h = parseFloat(k.height);
            if (!h || h <= 0) continue;
            const qty = Math.floor(left / h);
            for (let i = 0; i < qty; i++) {
                kItems.push({ productId: k.id, quantity: 1, _h: h });
                filled += h;
                left -= h;
            }
        }
    }
    return { kItems, filled };
}

/* ===== findBestAvrFill — optymalna kombinacja pierścieni AVR ===== */
function findBestAvrFill(deficit, maxAvr, avrRings) {
    let bestAvrCombo = [];
    let bestAvrDiff = deficit;
    let bestAvrH = 0;

    function backtrack(combo, sum, idx) {
        const d = Math.abs(deficit - sum);
        if (d < bestAvrDiff) {
            bestAvrDiff = d;
            bestAvrCombo = [...combo];
            bestAvrH = sum;
        } else if (d === bestAvrDiff && combo.length < bestAvrCombo.length) {
            bestAvrCombo = [...combo];
            bestAvrH = sum;
        }
        for (let i = idx; i < avrRings.length; i++) {
            if (sum + avrRings[i].height <= maxAvr) {
                combo.push(avrRings[i]);
                backtrack(combo, sum + avrRings[i].height, i);
                combo.pop();
            }
        }
    }

    if (deficit >= 30) backtrack([], 0, 0);

    const cMap = {};
    for (const a of bestAvrCombo) cMap[a.id] = (cMap[a.id] || 0) + 1;
    const avrItems = [];
    for (const id in cMap) avrItems.push({ productId: id, quantity: cMap[id] });

    return { avrItems, avrH: bestAvrH };
}

/* ===== checkConflicts — walidacja kolizji przejść ===== */
function checkConflicts(kItems, denH, reduceH, topItems, holes, studnieProducts, well) {
    const segs = [];
    let y = 0;
    segs.push({ type: 'dennica', h: denH, start: 0, end: denH });
    y += denH;

    let lastWasDennica = !!well.psiaBuda;

    for (const k of kItems) {
        let actualH = k._h;
        const kp = studnieProducts.find((p) => p.id === k.productId);
        if (kp && kp.componentType === 'dennica' && lastWasDennica) {
            actualH -= 100;
        }

        if (kp && kp.componentType !== 'uszczelka') {
            lastWasDennica = kp.componentType === 'dennica';
        }

        segs.push({ type: kp ? kp.componentType : 'krag', h: actualH, start: y, end: y + actualH });
        y += actualH;
    }
    for (const t of [...topItems].reverse()) {
        const tp = studnieProducts.find((p) => p.id === t.productId);
        if (tp) {
            let actualH = tp.height;
            if (tp.componentType === 'dennica' && lastWasDennica) actualH -= 100;

            segs.push({ type: tp.componentType, h: actualH, start: y, end: y + actualH });
            y += actualH;
            if (tp.componentType !== 'uszczelka') {
                lastWasDennica = tp.componentType === 'dennica';
            }
        }
    }

    let isMinimal = false;
    let valid = true;
    const errors = [];

    holes.forEach((h) => {
        const hTop = h.z + h.ruraDz;
        const hBot = h.z;
        const effZdD = h.z === 0 ? 0 : h.zdD;
        const resTop = hTop + h.zdG;
        const resBot = hBot - effZdD;
        const resTopMin = hTop + h.zdGM;
        const effZdDM = h.z === 0 ? 0 : h.zdDM;
        const resBotMin = hBot - effZdDM;

        let strictValid = true;
        let minValid = true;

        const SAFETY_MARGIN = 15;
        for (let i = 0; i < segs.length; i++) {
            const s = segs[i];
            const nextSeg = segs[i + 1];
            const jointInBody = hBot < s.end && s.end <= hTop;
            const hasOTAbove = nextSeg && nextSeg.type === 'krag_ot';

            if (hasOTAbove && jointInBody) {
                // Pomijamy walidację — rura przechodzi przez krag_ot
            } else {
                if (s.end >= resBot - SAFETY_MARGIN && s.end <= resTop + SAFETY_MARGIN)
                    strictValid = false;
                if (s.end >= resBotMin - SAFETY_MARGIN && s.end <= resTopMin + SAFETY_MARGIN)
                    minValid = false;
            }

            const isForbidden = [
                'konus',
                'plyta_din',
                'plyta_redukcyjna',
                'pierscien_odciazajacy'
            ].includes(s.type);
            if (isForbidden) {
                if (hTop > s.start && hBot < s.end) {
                    strictValid = false;
                    minValid = false;
                    errors.push(`Kolizja otworu z elementem ${s.type}`);
                }
            }
            if (s.type === 'plyta_redukcyjna') {
                const holeCenter = hBot + h.ruraDz / 2;
                if (holeCenter >= s.start) {
                    strictValid = false;
                    minValid = false;
                    errors.push(`Przejście nie może być powyżej płyty redukcyjnej`);
                }
            }
        }

        if (!strictValid) {
            if (minValid) {
                isMinimal = true;
            } else {
                valid = false;
                errors.push(`Kolizja otworu Z=${h.z} ze złączami`);
            }
        }
    });

    return { valid, isMinimal, errors };
}
