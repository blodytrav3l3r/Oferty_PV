// @ts-check
/**
 * solverHeuristics.js — Czyste funkcje heurystyczne solvera studni
 *
 * Wyodrębnione z solverAutoSelect.js. Nie mają efektów ubocznych ani
 * zależności od zamknięcia (closure) — wszystkie parametry jawne.
 */

/* ===== parseHoleClearance ===== */
window.parseHoleClearance = function parseHoleClearance(val, fallback) {
    if (fallback === undefined) fallback = 300;
    if (val === undefined || val === null || val === '') return fallback;
    var p = parseFloat(val);
    return isNaN(p) ? fallback : p;
};

/* ===== buildTopConfig ===== */
window.buildTopConfig = function buildTopConfig(topP, well, studnieProducts) {
    var items = [];
    var h = 0;
    var lbl = '';
    if (
        ['plyta_zamykajaca', 'plyta_najazdowa', 'pierscien_odciazajacy'].indexOf(
            topP.componentType
        ) !== -1
    ) {
        var sameDn = studnieProducts.filter(function (p) {
            return parseInt(p.dn) === parseInt(topP.dn);
        });
        var ring = null;
        for (var ri = 0; ri < sameDn.length; ri++) {
            if (sameDn[ri].componentType === 'pierscien_odciazajacy') {
                ring = sameDn[ri];
                break;
            }
        }
        var plate =
            topP.componentType === 'pierscien_odciazajacy'
                ? (function () {
                      for (var pi = 0; pi < sameDn.length; pi++) {
                          var pt = sameDn[pi];
                          if (
                              pt.componentType === 'plyta_zamykajaca' ||
                              pt.componentType === 'plyta_najazdowa'
                          ) {
                              return pt;
                          }
                      }
                      return null;
                  })()
                : topP;
        if (ring && plate) {
            items.push({ productId: plate.id, quantity: 1 });
            items.push({ productId: ring.id, quantity: 1 });
            h += plate.height + ring.height;
            lbl = plate.name + ' + Pierscien';
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

    // Wlaz
    var wlazItem = null;
    if (well && well.config) {
        for (var ci = 0; ci < well.config.length; ci++) {
            var c = well.config[ci];
            for (var spi = 0; spi < studnieProducts.length; spi++) {
                if (
                    studnieProducts[spi].id === c.productId &&
                    studnieProducts[spi].componentType === 'wlaz'
                ) {
                    wlazItem = c;
                    break;
                }
            }
            if (wlazItem) break;
        }
    }
    if (!wlazItem) {
        for (var spi2 = 0; spi2 < studnieProducts.length; spi2++) {
            if (studnieProducts[spi2].id === 'WLAZ-150') {
                wlazItem = { productId: studnieProducts[spi2].id, quantity: 1 };
                break;
            }
        }
    }
    if (wlazItem) {
        var wlazProd = null;
        for (var spi3 = 0; spi3 < studnieProducts.length; spi3++) {
            if (studnieProducts[spi3].id === wlazItem.productId) {
                wlazProd = studnieProducts[spi3];
                break;
            }
        }
        if (wlazProd) {
            items.unshift(wlazItem);
            h += wlazProd.height * wlazItem.quantity;
            lbl = wlazProd.name + ' + ' + lbl;
        }
    }
    return { items: items, height: h, label: lbl, prod: topP };
};

/* ===== fillKregiGreedy ===== */
window.fillKregiGreedy = function fillKregiGreedy(target, kList) {
    var kItems = [];
    var filled = 0;
    if (target > 0) {
        var left = target;
        for (var i = 0; i < kList.length; i++) {
            if (left <= 0) break;
            var k = kList[i];
            var h = parseFloat(k.height);
            if (!h || h <= 0) continue;
            var qty = Math.floor(left / h);
            for (var j = 0; j < qty; j++) {
                kItems.push({ productId: k.id, quantity: 1, _h: h });
                filled += h;
                left -= h;
            }
        }
    }
    return { kItems: kItems, filled: filled };
};

/* ===== findBestAvrFill ===== */
var AVR_TIMEOUT_MS = 100;
window.findBestAvrFill = function findBestAvrFill(deficit, maxAvr, avrRings) {
    var bestAvrCombo = [];
    var bestAvrDiff = deficit;
    var bestAvrH = 0;
    var avrStartTime = Date.now();

    function backtrack(combo, sum, idx) {
        if (Date.now() - avrStartTime > AVR_TIMEOUT_MS) return;
        var d = Math.abs(deficit - sum);
        if (d < bestAvrDiff) {
            bestAvrDiff = d;
            bestAvrCombo = combo.slice();
            bestAvrH = sum;
        } else if (d === bestAvrDiff && combo.length < bestAvrCombo.length) {
            bestAvrCombo = combo.slice();
            bestAvrH = sum;
        }
        for (var bi = idx; bi < avrRings.length; bi++) {
            if (sum + avrRings[bi].height <= maxAvr) {
                combo.push(avrRings[bi]);
                backtrack(combo, sum + avrRings[bi].height, bi);
                combo.pop();
            }
        }
    }

    if (deficit >= 30) backtrack([], 0, 0);

    var cMap = {};
    for (var ai = 0; ai < bestAvrCombo.length; ai++) {
        var aid = bestAvrCombo[ai].id;
        cMap[aid] = (cMap[aid] || 0) + 1;
    }
    var avrItems = [];
    for (var id in cMap) {
        if (cMap.hasOwnProperty(id)) avrItems.push({ productId: id, quantity: cMap[id] });
    }

    return { avrItems: avrItems, avrH: bestAvrH };
};

/* ===== checkConflicts ===== */
/* ===== fillKregiDP ===== */
window.fillKregiDP = function fillKregiDP(
    target,
    kList,
    tolBelow,
    tolAbove,
    dn,
    mag,
    transitionsForDP,
    availProducts,
    fixedBelowHeight
) {
    if (fixedBelowHeight === undefined) fixedBelowHeight = 0;
    if (target <= 0) return { kItems: [], filled: 0 };

    if (typeof logger !== 'undefined') {
        logger.info(
            'wellSolver',
            '[fillKregiDP] target=',
            target,
            'kList.length=',
            kList ? kList.length : 0,
            'dn=',
            dn,
            'mag=',
            mag
        );
    }
    if (!kList || kList.length === 0) {
        if (typeof logger !== 'undefined')
            logger.warn('wellSolver', '[fillKregiDP] Pusta lista kregow! dn=', dn);
        return window.fillKregiGreedy(target, kList || []);
    }

    var dpResult = optimizeRingsForDistance(
        target,
        kList,
        tolBelow,
        tolAbove,
        transitionsForDP,
        availProducts,
        fixedBelowHeight
    );
    if (typeof logger !== 'undefined') {
        logger.info(
            'wellSolver',
            '[fillKregiDP] dpResult.success=',
            dpResult.success,
            'selectedRings=',
            dpResult.selectedRings ? dpResult.selectedRings.length : 0
        );
    }

    if (dpResult.success && dpResult.selectedRings && dpResult.selectedRings.length > 0) {
        var kItems = dpResult.selectedRings.map(function (ring) {
            return { productId: ring.id, quantity: 1, _h: parseFloat(ring.height) };
        });
        var filled = 0;
        for (var fi = 0; fi < kItems.length; fi++) filled += kItems[fi]._h;
        return { kItems: kItems, filled: filled };
    }

    return window.fillKregiGreedy(target, kList);
};

window.checkConflicts = function checkConflicts(
    kItems,
    denH,
    reduceH,
    topItems,
    well,
    studnieProducts,
    reductionPlate,
    holes
) {
    var segs = [];
    var y = 0;
    segs.push({ type: 'dennica', h: denH, start: 0, end: denH });
    y += denH;

    var lastWasDennica = !!(well && well.psiaBuda);

    for (var ki = 0; ki < kItems.length; ki++) {
        var k = kItems[ki];
        var actualH = k._h;
        var kp = null;
        for (var sp4 = 0; sp4 < studnieProducts.length; sp4++) {
            if (studnieProducts[sp4].id === k.productId) {
                kp = studnieProducts[sp4];
                break;
            }
        }
        if (kp && kp.componentType === 'dennica' && lastWasDennica) actualH -= 100;

        if (reductionPlate && k.productId === reductionPlate.id) {
            segs.push({ type: 'plyta_redukcyjna', h: actualH, start: y, end: y + actualH });
        } else {
            segs.push({ type: 'krag', h: actualH, start: y, end: y + actualH });
        }
        y += actualH;
        if (kp && kp.componentType !== 'uszczelka') {
            lastWasDennica = kp.componentType === 'dennica';
        }
    }

    var topReversed = [];
    for (var ti = topItems.length - 1; ti >= 0; ti--) topReversed.push(topItems[ti]);
    for (var ti2 = 0; ti2 < topReversed.length; ti2++) {
        var t = topReversed[ti2];
        var tp = null;
        for (var sp5 = 0; sp5 < studnieProducts.length; sp5++) {
            if (studnieProducts[sp5].id === t.productId) {
                tp = studnieProducts[sp5];
                break;
            }
        }
        if (tp) {
            var actualH2 = tp.height;
            if (tp.componentType === 'dennica' && lastWasDennica) actualH2 -= 100;
            segs.push({ type: tp.componentType, h: actualH2, start: y, end: y + actualH2 });
            y += actualH2;
            if (tp.componentType !== 'uszczelka') {
                lastWasDennica = tp.componentType === 'dennica';
            }
        }
    }

    var isMinimal = false;
    var valid = true;
    var errors = [];

    for (var hi = 0; hi < holes.length; hi++) {
        var h = holes[hi];
        var hTop = h.z + h.ruraDz;
        var hBot = h.z;
        var effZdD = h.z === 0 ? 0 : h.zdD;
        var resTop = hTop + h.zdG;
        var resBot = hBot - effZdD;
        var resTopMin = hTop + h.zdGM;
        var effZdDM = h.z === 0 ? 0 : h.zdDM;
        var resBotMin = hBot - effZdDM;

        var strictValid = true;
        var minValid = true;
        var SAFETY_MARGIN = 15;

        for (var si = 0; si < segs.length; si++) {
            var s = segs[si];
            var nextSeg = segs[si + 1];
            var jointInBody = hBot < s.end && s.end <= hTop;
            var hasOTAbove = !!(nextSeg && nextSeg.type === 'krag_ot');

            if (hasOTAbove && jointInBody) {
                // ring wiercony — pomijamy walidacje
            } else {
                if (s.end >= resBot - SAFETY_MARGIN && s.end <= resTop + SAFETY_MARGIN)
                    strictValid = false;
                if (s.end >= resBotMin - SAFETY_MARGIN && s.end <= resTopMin + SAFETY_MARGIN)
                    minValid = false;
            }

            var isForbidden =
                ['konus', 'plyta_din', 'plyta_redukcyjna', 'pierscien_odciazajacy'].indexOf(
                    s.type
                ) !== -1;
            if (isForbidden) {
                if (hTop > s.start && hBot < s.end) {
                    strictValid = false;
                    minValid = false;
                    errors.push('Kolizja otworu z elementem ' + s.type);
                }
            }
            if (s.type === 'plyta_redukcyjna') {
                var holeCenter = hBot + h.ruraDz / 2;
                if (holeCenter >= s.start) {
                    strictValid = false;
                    minValid = false;
                    errors.push('Przejscie nie moze byc powyzej plyty redukcyjnej');
                }
            }
        }

        if (!strictValid) {
            if (minValid) {
                isMinimal = true;
            } else {
                valid = false;
                errors.push('Kolizja otworu Z=' + h.z + ' ze zlaczami');
            }
        }
    }

    return { valid: valid, isMinimal: isMinimal, errors: errors };
};
