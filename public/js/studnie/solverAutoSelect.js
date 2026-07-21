// @ts-check
/**
 * solverAutoSelect.js — Automatyczny dobór elementów studni (główny solver JS)
 *
 * Wyodrębnione z wellSolver.js (linie 185-1393):
 * - autoSelectComponents() — główne wejście (rejestrowane na window)
 * - runJsAutoSelection()   — główna pętla solvera z zagnieżdżonymi funkcjami
 *
 * Zależności globalne (ładowane przez script tagi):
 *   studnieProducts, logger, getCurrentWell, showToast, getAvailableProducts,
 *   filterByWellParams, getLowestDennicaHybrid, getTopClosure, getKregiList,
 *   getReductionPlate, optimizeRingsForDistance, buildCandidateLayouts,
 *   scoreLayout, sortWellConfigByOrder, recalcGaskets, syncKineta,
 *   renderWellConfig, renderWellDiagram, updateSummary, refreshAll, fmtInt,
 *   FLOW_TYPES
 */

/* ===== GŁÓWNY PUNKT WEJŚCIA AUTO-DOBORU ===== */
let isAutoSelectRunning = false;
window.__autoSelectCallCount = 0;
const __MAX_AUTO_SELECT_CALLS = 10;
window.autoSelectComponents = async function autoSelectComponents(autoTriggered = false) {
    window.__autoSelectCallCount++;
    if (window.__autoSelectCallCount > __MAX_AUTO_SELECT_CALLS) {
        logger.error('wellSolver', '========================================');
        logger.error('wellSolver', 'DETEKCJA NIESKOŃCZONEJ PĘTLI autoSelectComponents!');
        logger.error('wellSolver', 'Licznik wywołań:', window.__autoSelectCallCount);
        logger.error('wellSolver', 'Stack trace:', new Error().stack);
        logger.error('wellSolver', '========================================');
        window.__autoSelectCallCount = 0;
        return;
    }
    if (isAutoSelectRunning) {
        logger.warn('wellSolver', '[AutoSelect] Pomijam — już trwa auto-dobór');
        return;
    }
    isAutoSelectRunning = true;
    try {
        const well = getCurrentWell();
        if (!well) {
            if (!autoTriggered) showToast('Najpierw dodaj studnię', 'error');
            return;
        }

        if (well.autoLocked) {
            if (!autoTriggered) showToast('Auto-dobór jest zablokowany w Trybie Ręcznym.', 'error');
            return;
        }

        const dn = well.dn;
        const effectiveDn = dn === 'styczna' ? (well.stycznaNadbudowa1200 ? 1200 : 1000) : dn;
        const rzDna = well.rzednaDna != null ? well.rzednaDna : 0;

        if (well.rzednaWlazu == null || well.rzednaWlazu <= rzDna) {
            if (!autoTriggered)
                showToast(
                    'Ustaw rzędną włazu, aby auto-dobrać elementy (Rzędna Dna przyjęta jako 0)',
                    'error'
                );
            return;
        }

        const requiredMm = Math.round((well.rzednaWlazu - rzDna) * 1000);
        if (requiredMm < 500) {
            if (!autoTriggered) showToast('Wymagana wysokość za mała (min. 500mm)', 'error');
            return;
        }

        if (!studnieProducts || studnieProducts.length === 0) {
            if (!autoTriggered) showToast('Dane produktów jeszcze się ładują...', 'info');
            return;
        }

        // --- Pokaż loading w UI ---
        well.configStatus = 'LOADING';
        if (typeof refreshAll === 'function') refreshAll();

        const availProducts = getAvailableProducts(well).filter((p) => filterByWellParams(p, well));

        // === KROK 1: JS Solver ===
        const jsMsStart =
            window.performance && window.performance.now ? window.performance.now() : Date.now();
        const jsResult = await runJsAutoSelection(well, requiredMm, availProducts);
        if (jsResult.error) {
            showToast(jsResult.error, 'error');
            well.configStatus = 'ERROR';
            well.configErrors = [jsResult.error];
            refreshAll();
            return;
        }
        logger.info(
            'wellSolver',
            '[AutoSelect] JS solver OK. config.length=',
            jsResult.config?.length,
            'totalHeight=',
            jsResult.totalHeight,
            'diff=',
            jsResult.diff,
            'topLabel=',
            jsResult.topLabel,
            'fallback=',
            jsResult.fallback
        );
        if (jsResult.config)
            logger.info(
                'wellSolver',
                '[AutoSelect] config[0]=',
                JSON.stringify(jsResult.config[0])
            );

        well.config = jsResult.config;
        const errors = [...(jsResult.errors || [])];
        if (jsResult.fallback)
            errors.push(
                jsResult.fallbackReason
                    ? `Zastosowana rozszerzona tolerancja - ${jsResult.fallbackReason}`
                    : 'Zastosowana rozszerzona tolerancja'
            );
        if (errors.length > 0 && jsResult.isMinimal) {
            well.configStatus = 'WARNING';
        } else if (errors.length > 0) {
            well.configStatus = 'WARNING';
        } else {
            well.configStatus = 'OK';
        }
        well.configErrors = errors;
        well.configSource = 'AUTO_JS';

        // Wzbogacenie AI score — tylko do telemetrii, nie zmienia wyboru
        if (typeof window.mlEnrichLayout === 'function') {
            window
                .mlEnrichLayout(well.config, well)
                .then(function (enriched) {
                    if (enriched && enriched._aiScore !== undefined) {
                        well._aiScore = enriched._aiScore;
                        well._mlOnline = enriched._mlOnline;
                        well._modelVersion = enriched._modelVersion;
                    }
                })
                .catch(function () {
                    // pasywnie — ignoruj
                });
        }

        try {
            sortWellConfigByOrder();
            if (typeof recalcGaskets === 'function') recalcGaskets(well);
            if (typeof syncKineta === 'function') syncKineta(well);
            logger.info(
                'wellSolver',
                '[AutoSelect] Przed render. config.length=',
                well.config?.length
            );
            renderWellConfig();
            renderWellDiagram();
            updateSummary();
            refreshAll();
            logger.info('wellSolver', '[AutoSelect] Render OK.');
        } catch (renderErr) {
            logger.error('wellSolver', '[AutoSelect] Błąd renderowania:', renderErr);
            logger.error('wellSolver', '[AutoSelect] Stack:', renderErr.stack);
        }

        // ─── Pasywny hook telemetry AI (NIE zmienia logiki solvera) ───
        try {
            if (typeof window.telemetryRecordConfig === 'function') {
                const jsMsEnd =
                    window.performance && window.performance.now
                        ? window.performance.now()
                        : Date.now();
                window.telemetryRecordConfig({
                    well: well,
                    configItems: well.config || [],
                    solverSource: 'AUTO_JS',
                    computationMs: Math.round(jsMsEnd - jsMsStart),
                    iterationCount: 1,
                    checkedVariants: (availProducts || []).length,
                    rankingScore:
                        typeof jsResult.diff === 'number'
                            ? Math.max(0, 10 - jsResult.diff / 50)
                            : undefined,
                    selectionReason: jsResult.fallback
                        ? `fallback: ${jsResult.fallbackReason || 'extended tolerance'}`
                        : 'js_solver_standard'
                });
            }
        } catch (e) {
            // Pasywny hook — nie wpływa na wynik solvera
        }

        const diffStr = jsResult.diff >= 0 ? `+${jsResult.diff}mm` : `${jsResult.diff}mm`;
        const redLabel = jsResult.reductionUsed ? ` + Redukcja DN${jsResult.targetDn || 1000}` : '';
        const fallbackLabel = jsResult.fallback
            ? ' <i data-lucide="alert-triangle"></i> (rozszerzona tolerancja)'
            : '';
        let statusIcon = '<i data-lucide="check-circle-2"></i>';
        if (well.configStatus === 'WARNING') statusIcon = '<i data-lucide="alert-triangle"></i>';
        if (well.configStatus === 'ERROR') statusIcon = '<i data-lucide="alert-circle"></i>';
        if (!autoTriggered) {
            showToast(
                `${statusIcon} Auto-dobór: ${fmtInt(jsResult.totalHeight)} mm (${diffStr}) | ${jsResult.topLabel}${redLabel}${fallbackLabel}`,
                well.configStatus === 'OK' ? 'success' : 'warning'
            );
        }
    } finally {
        isAutoSelectRunning = false;
        if (window.__autoSelectCallCount > 0) window.__autoSelectCallCount--;
    }
};

/* ===== LOKALNY SOLVER JS ===== */
async function runJsAutoSelection(well, requiredMm, availProducts) {
    const dn = well.dn;
    const targetDn = well.redukcjaTargetDN || 1000;
    const effectiveDn = dn === 'styczna' ? (well.stycznaNadbudowa1200 ? 1200 : 1000) : dn;
    const mag = well.magazyn || 'Kluczbork';
    const ff = mag === 'Włocławek' ? 'formaStandardowa' : 'formaStandardowaKLB';

    const dnProducts = availProducts.filter((p) => parseInt(p.dn) === parseInt(effectiveDn));
    const allProducts = availProducts;

    // KROK 1: Dennica
    const dnResult = getLowestDennicaHybrid(
        availProducts.filter((p) => filterByWellParams(p, well)),
        dn,
        mag,
        well.przejscia,
        well.rzednaDna,
        well.stycznaDn
    );
    const dennica = dnResult.dennica;
    if (!dennica) return { error: 'Brak dennic w magazynie.' };

    // KROK 2: Zakończenie
    const forcedZak = well.zakonczenie || null;
    const isWkladkaZwienczenie = well.wkladkaZwienczenie && well.wkladkaZwienczenie !== 'brak';
    let topProd = getTopClosure(
        availProducts.filter((p) => filterByWellParams(p, well)),
        effectiveDn,
        forcedZak,
        isWkladkaZwienczenie,
        mag
    );

    // Jeśli getTopClosure zwrócił coś innego niż konus (np. Płyta DIN),
    // a konus jest dostępny w katalogu i nie ma PEHD → nadpisz konusem
    if (!forcedZak && topProd && topProd.componentType !== 'konus' && !isWkladkaZwienczenie) {
        const konusFromCatalog = studnieProducts.find(
            (p) =>
                p.componentType === 'konus' &&
                (parseInt(p.dn) === parseInt(effectiveDn) || p.dn === null)
        );
        if (konusFromCatalog) {
            logger.info(
                'wellSolver',
                '[AutoSelect] Nadpisanie ' + topProd.id + ' konusem ' + konusFromCatalog.id
            );
            topProd = konusFromCatalog;
        }
    }

    if (!topProd && forcedZak) {
        topProd = studnieProducts.find(
            (p) => p.id === forcedZak && (parseInt(p.dn) === parseInt(effectiveDn) || p.dn === null)
        );
    }
    if (!topProd) {
        topProd = studnieProducts.find(
            (p) =>
                p.componentType === 'konus' &&
                (parseInt(p.dn) === parseInt(effectiveDn) || p.dn === null)
        );
    }
    if (!topProd) return { error: 'Nie znaleziono domyślnego zakończenia studni.' };

    // --- Budowa konfiguracji zakończenia górnego ---
    const topConfigs = [];
    const buildTopConfig = (topP) => {
        let items = [];
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
                items.push(
                    { productId: plate.id, quantity: 1 },
                    { productId: ring.id, quantity: 1 }
                );
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

        // Wlaz
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
    };

    topConfigs.push(buildTopConfig(topProd));

    // Fallback DIN
    const isRelief = ['plyta_zamykajaca', 'plyta_najazdowa', 'pierscien_odciazajacy'].includes(
        topProd.componentType
    );
    if (isRelief || topProd.componentType === 'konus') {
        const dinProd = getTopClosure(
            availProducts.filter((p) => filterByWellParams(p, well)),
            effectiveDn,
            null,
            true,
            mag
        );
        if (dinProd && dinProd.id !== topProd.id) {
            const fbCfg = buildTopConfig(dinProd);
            fbCfg.label += ' (zamiennik)';
            topConfigs.push(fbCfg);
        }
    }

    // KROK 3: Przejścia — oblicz minimalne wymagania
    let holes = (well.przejscia || []).map((p) => {
        let pel = parseFloat(p.rzednaWlaczenia);
        let prDN = 160;
        let prod = availProducts.find((x) => x.id === p.productId);
        if (prod && typeof prod.dn === 'string' && prod.dn.includes('/'))
            prDN = parseFloat(prod.dn.split('/')[1]) || 160;
        else if (prod && prod.dn != null) prDN = parseFloat(prod.dn) || 160;

        let bottomEdge = isNaN(pel) ? 0 : Math.round((pel - (well.rzednaDna || 0)) * 1000);
        let center = bottomEdge + prDN / 2;

        const parseHoleClearance = (val, fallback = 300) => {
            if (val === undefined || val === null || val === '') return fallback;
            const p = parseFloat(val);
            return isNaN(p) ? fallback : p;
        };

        return {
            z: center - prDN / 2,
            ruraDz: prDN,
            zdD: prod ? parseHoleClearance(prod.zapasDol, 300) : 0,
            zdDM: prod ? parseHoleClearance(prod.zapasDolMin, 150) : 0,
            zdG: prod ? parseHoleClearance(prod.zapasGora, 300) : 0,
            zdGM: prod ? parseHoleClearance(prod.zapasGoraMin, 150) : 0
        };
    });

    let maxReqH = 0;
    let maxReqHMin = 0;
    holes.forEach((h) => {
        const reqH = h.z + h.ruraDz + h.zdG;
        if (reqH > maxReqH) maxReqH = reqH;
        const reqHMin = h.z + h.ruraDz + h.zdGM;
        if (reqHMin > maxReqHMin) maxReqHMin = reqHMin;
    });

    if (requiredMm < maxReqHMin) {
        const fn = typeof fmtInt === 'function' ? fmtInt : (v) => v;
        return {
            error: `Wymagana wysokość studni (${fn(requiredMm)}mm) jest za mała. Minimum dla przejść: ${fn(maxReqHMin)}mm, zalecane: ${fn(maxReqH)}mm. Zwiększ rzędną włazu o co najmniej ${fn(maxReqHMin - requiredMm)}mm.`
        };
    }

    // KROK 4: Listy kręgów i redukcja
    let dennicy = availProducts
        .filter((p) => {
            if (dn === 'styczna') {
                const isStyczna =
                    (p.componentType === 'styczna' || p.category === 'Studnie styczne') &&
                    filterByWellParams(p, well);
                if (!isStyczna) return false;
                if (well.stycznaDn) return parseInt(p.dn) === parseInt(well.stycznaDn);
                return true;
            }
            return (
                p.componentType === 'dennica' &&
                parseInt(p.dn) === dn &&
                filterByWellParams(p, well)
            );
        })
        .sort((a, b) => {
            const aForm = a[ff] === 1 ? 1 : 0;
            const bForm = b[ff] === 1 ? 1 : 0;
            if (aForm !== bForm) return bForm - aForm;
            return a.height - b.height;
        });
    if (dennicy.length === 0) return { error: 'Brak dennic w magazynie.' };

    // Phase 5: Użyj pre-selected dennica jako minimum — solver nie próbuje niższych
    const minDenH = dennica ? parseFloat(dennica.height) || 0 : 0;
    if (minDenH > 0) {
        dennicy = dennicy.filter((d) => parseFloat(d.height || 0) >= minDenH);
        if (dennicy.length === 0) {
            return { error: 'Brak dennic spełniających wymagania wysokości.' };
        }
    }

    const avrRings = allProducts
        .filter((p) => p.componentType === 'avr')
        .sort((a, b) => b.height - a.height);

    const isDrilledRing = (p) =>
        p.componentType === 'krag_ot' ||
        (p.id && String(p.id).toLowerCase().endsWith('ot')) ||
        (p.name && String(p.name).toLowerCase().includes('z otworem'));

    const kregiFromEngine = getKregiList(
        availProducts.filter(
            (p) => filterByWellParams(p, well) && p.componentType === 'krag' && !isDrilledRing(p)
        ),
        effectiveDn,
        mag
    );
    const kregi =
        kregiFromEngine.length > 0
            ? kregiFromEngine
            : availProducts
                  .filter(
                      (p) =>
                          p.componentType === 'krag' &&
                          parseInt(p.dn) === parseInt(effectiveDn) &&
                          !isDrilledRing(p)
                  )
                  .sort((a, b) => b.height - a.height);

    const targetDnKregiEngine = getKregiList(
        availProducts.filter(
            (p) => filterByWellParams(p, well) && p.componentType === 'krag' && !isDrilledRing(p)
        ),
        targetDn,
        mag
    );
    const targetDnKregi =
        targetDnKregiEngine.length > 0
            ? targetDnKregiEngine
            : availProducts
                  .filter(
                      (p) =>
                          p.componentType === 'krag' &&
                          parseInt(p.dn) === targetDn &&
                          !isDrilledRing(p)
                  )
                  .sort((a, b) => b.height - a.height);

    let reductionPlate = getReductionPlate(availProducts, dn, well.redukcjaDN1000, targetDn);
    if (!reductionPlate) {
        reductionPlate = studnieProducts.find(
            (p) =>
                p.componentType === 'plyta_redukcyjna' &&
                parseInt(p.dn) === dn &&
                (p.name.includes('/' + targetDn) || p.name.includes(' DN' + targetDn))
        );
    }
    let canReduce = well.redukcjaDN1000 && [1200, 1500, 2000, 2500].includes(dn) && reductionPlate;

    // KROK 5: DP Ring Optimizer
    const transitionsForDP = (well.przejscia || [])
        .map((p) => {
            const pel = parseFloat(p.rzednaWlaczenia);
            return {
                id: p.productId,
                productId: p.productId,
                height_from_bottom_mm: isNaN(pel)
                    ? 0
                    : Math.round((pel - (well.rzednaDna || 0)) * 1000)
            };
        })
        .filter((t) => t.height_from_bottom_mm > 0);

    function fillKregiDP(target, kList, tolBelow, tolAbove, fixedBelowHeight = 0) {
        if (target <= 0) return { kItems: [], filled: 0 };

        logger.info(
            'wellSolver',
            '[fillKregiDP] target=',
            target,
            'kList.length=',
            kList.length,
            'dn=',
            dn,
            'mag=',
            mag
        );
        if (kList.length === 0) {
            logger.warn('wellSolver', '[fillKregiDP] Pusta lista kręgów! dn=', dn);
            return fillKregiGreedy(target, kList);
        }

        const dpResult = optimizeRingsForDistance(
            target,
            kList,
            tolBelow,
            tolAbove,
            transitionsForDP,
            availProducts,
            fixedBelowHeight
        );
        logger.info(
            'wellSolver',
            '[fillKregiDP] dpResult.success=',
            dpResult.success,
            'selectedRings=',
            dpResult.selectedRings?.length
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

    function fillKregiGreedy(target, kList) {
        let kItems = [];
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

    /**
     * Szuka optymalnej kombinacji pierścieni AVR (backtracking).
     * @returns {{ avrItems: Array, avrH: number }}
     */
    let AVR_TIMEOUT_MS = 100;
    function findBestAvrFill(deficit, maxAvr) {
        let bestAvrCombo = [];
        let bestAvrDiff = deficit;
        let bestAvrH = 0;
        const avrStartTime = Date.now();

        function backtrack(combo, sum, idx) {
            if (Date.now() - avrStartTime > AVR_TIMEOUT_MS) {
                return;
            }
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

    // KROK 6: Walidacja przejść
    function checkConflicts(kItems, denH, reduceH, topItems) {
        let segs = [];
        let y = 0;
        segs.push({ type: 'dennica', h: denH, start: 0, end: denH });
        y += denH;

        let lastWasDennica = !!well.psiaBuda;

        for (let k of kItems) {
            let actualH = k._h;
            const kp = studnieProducts.find((p) => p.id === k.productId);
            if (kp && kp.componentType === 'dennica' && lastWasDennica) {
                actualH -= 100;
            }

            if (k.productId === reductionPlate?.id) {
                segs.push({ type: 'plyta_redukcyjna', h: actualH, start: y, end: y + actualH });
            } else {
                segs.push({ type: 'krag', h: actualH, start: y, end: y + actualH });
            }
            y += actualH;
            if (kp && kp.componentType !== 'uszczelka') {
                lastWasDennica = kp.componentType === 'dennica';
            }
        }
        for (let t of [...topItems].reverse()) {
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
        let errors = [];

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

            const SAFETY_MARGIN = 15; // mm — spójne z validator.py:85
            for (let i = 0; i < segs.length; i++) {
                const s = segs[i];
                const nextSeg = segs[i + 1];
                const jointInBody = hBot < s.end && s.end <= hTop;
                const hasOTAbove = nextSeg && nextSeg.type === 'krag_ot';

                // Joint na dole krag_ot + rura przechodzi przez to połączenie → OK (ring wiercony)
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
                    // Środek rury powyżej spodu płyty = kolizja
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

    // KROK 7: Solver — szuka najlepszej kombinacji
    function solve(tolBelow, tolAbove, maxAvr, skipHolesValid) {
        let candidates = [];

        for (const topCfg of topConfigs) {
            for (const dennicaItem of dennicy) {
                let denIsMin = dennicaItem.height < maxReqH;

                let effDenH = dennicaItem.height;
                if (well.psiaBuda) effDenH -= 100;

                const targetBody = requiredMm - topCfg.height - effDenH;
                if (targetBody < 0) continue;

                const { kItems, filled } = fillKregiDP(
                    targetBody,
                    kregi,
                    tolBelow,
                    tolAbove,
                    dennicaItem.height
                );

                // Phase 3: Osadź OT warianty w layoutach
                const otLayout = buildCandidateLayouts(dennicaItem, kItems, well, availProducts);
                const otKItems = otLayout.rings;

                const deficit = requiredMm - (dennicaItem.height + topCfg.height + filled);
                if (deficit > maxAvr || deficit < -tolAbove) continue;

                const { avrItems, avrH } = findBestAvrFill(deficit, maxAvr);
                const diff = effDenH + topCfg.height + filled + avrH - requiredMm;
                const isOutOfBounds = diff < -90 || diff > 20;

                const conf = checkConflicts(otKItems, dennicaItem.height, 0, topCfg.items);
                if (!conf.valid && !skipHolesValid) continue;

                const otCount = otKItems.filter(
                    (ki) => ki.productId && String(ki.productId).endsWith('_OT')
                ).length;
                const scoreResult = scoreLayout({
                    ringCount: otKItems.length,
                    diff,
                    isOutOfBounds,
                    isMinimal: conf.isMinimal || denIsMin,
                    isFallbackClosure: topCfg.label.includes('zamiennik'),
                    isKonus: topCfg.prod && topCfg.prod.componentType === 'konus',
                    reductionForced: !!well.redukcjaDN1000,
                    hasReduction: false,
                    otCount
                });
                let score = scoreResult.score;
                score += (parseFloat(dennicaItem.height) - minDenH) * 2000;

                let runErrors = [...conf.errors];
                if (isOutOfBounds)
                    runErrors.push(
                        `Uwaga: Wymuszono tolerancję wysokości (odchyłka ${diff > 0 ? '+' : ''}${diff}mm)`
                    );

                candidates.push({
                    solution: {
                        topItems: [...topCfg.items],
                        kregItems: otKItems.map((ki) => ({
                            productId: ki.productId,
                            quantity: ki.quantity
                        })),
                        dennica: { productId: dennicaItem.id, quantity: 1 },
                        avrItems: avrItems,
                        totalHeight: effDenH + topCfg.height + filled + avrH,
                        diff: diff,
                        topLabel: topCfg.label,
                        errors: runErrors,
                        isMinimal: conf.isMinimal || denIsMin,
                        _scoreBreakdown: scoreResult.breakdown,
                        _scoreReason: scoreResult.reason
                    },
                    technicalScore: score
                });
            }
        }

        // --- Redukcja DN1000 / DN1200 ---
        if (canReduce) {
            let topRedItems = [];
            let topRedH = 0;
            const redTargetProducts = availProducts.filter((p) => parseInt(p.dn) === targetDn);
            const redTopProducts = redTargetProducts.filter((p) =>
                [
                    'konus',
                    'plyta_din',
                    'plyta_najazdowa',
                    'plyta_zamykajaca',
                    'pierscien_odciazajacy'
                ].includes(p.componentType)
            );

            const rZak = well.redukcjaZakonczenie
                ? redTopProducts.find((p) => p.id === well.redukcjaZakonczenie)
                : null;
            const rZakFinal =
                rZak ||
                getTopClosure(
                    redTargetProducts.filter((p) => filterByWellParams(p, well)),
                    targetDn,
                    null,
                    isWkladkaZwienczenie,
                    mag
                );
            if (rZakFinal) {
                topRedItems.push({ productId: rZakFinal.id, quantity: 1 });
                topRedH += rZakFinal.height;

                // AUTOMATYCZNE PAROWANIE (Płyta + Pierścień)
                const isPlate = ['plyta_najazdowa', 'plyta_zamykajaca'].includes(
                    rZakFinal.componentType
                );
                const isRing = rZakFinal.componentType === 'pierscien_odciazajacy';

                if (isPlate || isRing) {
                    const partnerType = isPlate
                        ? ['pierscien_odciazajacy']
                        : ['plyta_najazdowa', 'plyta_zamykajaca'];
                    const partner = redTargetProducts.find(
                        (p) => partnerType.includes(p.componentType) && filterByWellParams(p, well)
                    );
                    if (partner) {
                        topRedItems.push({ productId: partner.id, quantity: 1 });
                        topRedH += partner.height;
                    }
                }
            }

            // --- Dodanie włazu do konfiguracji z redukcją ---
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
                    topRedItems.unshift(wlazItem);
                    topRedH += wlazProd.height * wlazItem.quantity;
                }
            }
            // ------------------------------------------------

            let maxHoleTop = 0;
            if (well.przejscia && well.przejscia.length > 0) {
                const rzDna = well.rzednaDna != null ? well.rzednaDna : 0;
                for (const pr of well.przejscia) {
                    let pel = parseFloat(pr.rzednaWlaczenia);
                    if (!isNaN(pel)) {
                        const holeBottom = (pel - rzDna) * 1000;
                        const pprod = studnieProducts.find((x) => x.id === pr.productId);
                        if (pprod) {
                            let prDN =
                                typeof pprod.dn === 'string' && pprod.dn.includes('/')
                                    ? parseFloat(pprod.dn.split('/')[1]) || 160
                                    : parseFloat(pprod.dn) || 160;
                            const zapasGora =
                                parseFloat(pprod.zapasGora || 0) ||
                                parseFloat(pprod.zapasGoraMin || 0) ||
                                300;
                            const holeTop = holeBottom + prDN + zapasGora;
                            if (holeTop > maxHoleTop) maxHoleTop = holeTop;
                        }
                    }
                }
            }

            let minLowerTotal = Math.max(well.redukcjaMinH || 0, maxHoleTop);
            let dynamicMinBottom = minLowerTotal;
            let lift = 0;
            while (lift < 40) {
                for (const dennicaItem of dennicy) {
                    let bottomNeed = Math.max(dynamicMinBottom - dennicaItem.height, 0);

                    const bKregi = fillKregiDP(
                        bottomNeed,
                        kregi,
                        0,
                        tolAbove + 60,
                        dennicaItem.height
                    );
                    const bSec = dennicaItem.height + bKregi.filled;

                    const targetBodyNeed = requiredMm - bSec - reductionPlate.height - topRedH;
                    if (targetBodyNeed < 0) continue;

                    const tTarget = fillKregiDP(
                        targetBodyNeed,
                        targetDnKregi,
                        tolBelow,
                        tolAbove,
                        bSec + reductionPlate.height
                    );
                    const currentTotal = bSec + reductionPlate.height + topRedH + tTarget.filled;

                    const deficit = requiredMm - currentTotal;
                    if (deficit > maxAvr || deficit < -tolAbove) continue;
                    const { avrItems, avrH } = findBestAvrFill(deficit, maxAvr);

                    const diff = currentTotal + avrH - requiredMm;
                    const isOutOfBounds = diff < -90 || diff > 20;

                    let redKItems = [];
                    bKregi.kItems.forEach((k) => redKItems.push(k));
                    redKItems.push({
                        productId: reductionPlate.id,
                        quantity: 1,
                        _h: reductionPlate.height
                    });
                    tTarget.kItems.forEach((k) => redKItems.push(k));

                    const redOt = buildCandidateLayouts(
                        dennicaItem,
                        redKItems,
                        well,
                        availProducts
                    );
                    const redOtItems = redOt.rings;

                    const conf = checkConflicts(redOtItems, dennicaItem.height, bSec, topRedItems);

                    if (!conf.valid && !skipHolesValid) {
                        if (
                            conf.errors.some(
                                (e) => e.includes('redukcyjnej') || e.includes('konus')
                            )
                        ) {
                            break;
                        }
                        continue;
                    }

                    const redOtCount = redOtItems.filter(
                        (ki) => ki.productId && String(ki.productId).endsWith('_OT')
                    ).length;
                    const scoreResult = scoreLayout({
                        ringCount: bKregi.kItems.length + tTarget.kItems.length,
                        diff,
                        isOutOfBounds,
                        isMinimal: conf.isMinimal,
                        isFallbackClosure: false,
                        reductionForced: false,
                        hasReduction: true,
                        bottomSectionH: bSec,
                        minBottomTotal: minLowerTotal,
                        dn: parseInt(dn) || 1200,
                        otCount: redOtCount
                    });
                    let score = scoreResult.score;
                    score += (parseFloat(dennicaItem.height) - minDenH) * 2000;

                    let runErrors = [...conf.errors];
                    if (isOutOfBounds)
                        runErrors.push(
                            `Uwaga: Wymuszono tolerancję wysokości (odchyłka ${diff > 0 ? '+' : ''}${diff}mm)`
                        );
                    const otStack = [...redOtItems].map((ki) => ({
                        productId: ki.productId,
                        quantity: ki.quantity
                    }));
                    const plateIdx = otStack.findIndex((ki) => ki.productId === reductionPlate.id);
                    const otTop = plateIdx >= 0 ? otStack.slice(0, plateIdx).reverse() : [];
                    const otBottom = plateIdx >= 0 ? otStack.slice(plateIdx + 1).reverse() : [];
                    const otPlate = plateIdx >= 0 ? [otStack[plateIdx]] : [];

                    candidates.push({
                        solution: {
                            reductionUsed: true,
                            topItems: [...topRedItems],
                            kregItems: [...otTop, ...otPlate, ...otBottom],
                            dennica: { productId: dennicaItem.id, quantity: 1 },
                            avrItems: avrItems,
                            totalHeight: currentTotal + avrH,
                            diff: diff,
                            topLabel: `Redukcja DN${targetDn}`,
                            targetDn: targetDn,
                            errors: runErrors,
                            isMinimal: conf.isMinimal || dennicaItem.height < maxReqH,
                            _scoreBreakdown: scoreResult.breakdown,
                            _scoreReason: scoreResult.reason
                        },
                        technicalScore: score
                    });
                }
                dynamicMinBottom += 250;
                lift++;
            }
        }

        candidates.sort(function (a, b) {
            return a.technicalScore - b.technicalScore;
        });

        return candidates;
    }

    const STAGES = [
        { tolBelow: 60, tolAbove: 20, maxAvr: 260, skip: false, name: 'Standard' },
        { tolBelow: 200, tolAbove: 20, maxAvr: 260, skip: false, name: 'Optymalny' },
        { tolBelow: 260, tolAbove: 20, maxAvr: 260, skip: false, name: 'Ratunkowy' },
        { tolBelow: 260, tolAbove: 500, maxAvr: 260, skip: false, name: 'Poszerzony (+500mm)' },
        { tolBelow: 260, tolAbove: 1000, maxAvr: 260, skip: false, name: 'Ekstremalny (+1000mm)' }
    ];

    let candidates = null;
    let fallback = false;
    let fallbackReason = '';

    for (const stage of STAGES) {
        candidates = solve(stage.tolBelow, stage.tolAbove, stage.maxAvr, stage.skip);
        if (candidates && candidates.length > 0) {
            const techWinner = candidates[0].solution;
            logger.info(
                'wellSolver',
                '[AutoSelect] Rozwiązanie znalezione w stage:',
                stage.name,
                'items:',
                techWinner.kregItems?.length,
                'dennica:',
                techWinner.dennica?.productId,
                'candidates:',
                candidates.length
            );
            if (stage.name !== 'Standard') {
                fallback = true;
                fallbackReason = `tryb ${stage.name}`;
            }
            if (stage.skip) {
                fallbackReason = 'kolizje przejść ominięte awaryjnie';
            }
            break;
        }
    }

    if (!candidates || candidates.length === 0) {
        return {
            error: `Nie znaleziono pasującej kombinacji elementów dla tej wysokości (max. ± dozwolona odchyłka, max ${well.magazyn || 'Kluczbork'} avr 26cm).`
        };
    }

    let solution = candidates[0].solution;

    // === AI DUAL-RANKING ===
    if (
        candidates.length >= 3 &&
        typeof window.rankCandidates === 'function' &&
        typeof window.selectWithExploration === 'function' &&
        typeof window.recordAiRankDecision === 'function'
    ) {
        try {
            const rankResult = await window.rankCandidates({
                candidates: candidates.map(function (c, idx) {
                    return { id: idx, solution: c.solution, technicalScore: c.technicalScore };
                }),
                well: well
            });

            if (rankResult.ranked && rankResult.ranked.length > 0) {
                const explored = window.selectWithExploration(rankResult.ranked);
                const aiWinner = explored.solution;

                window.recordAiRankDecision({
                    well: well,
                    ranked: rankResult.ranked,
                    technicalWinner: solution,
                    aiWinner: aiWinner,
                    explorationTriggered: explored.explorationTriggered,
                    exploredFrom: explored.exploredFrom,
                    aiInfluencePct: rankResult.aiInfluencePct,
                    modelVersion: rankResult.modelVersion,
                    rankingVersion: rankResult.rankingVersion,
                    featureVersion: rankResult.featureVersion
                });

                if (rankResult.aiInfluencePct > 0 && aiWinner) {
                    solution = aiWinner;
                }
            }
        } catch (e) {
            if (typeof logger !== 'undefined' && logger.warn) {
                logger.warn('wellSolver', '[AiRank] Shadow ranking failed:', e);
            }
        }
    }

    const wlazItems = solution.topItems.filter((item) => {
        const p = studnieProducts.find((pr) => pr.id === item.productId);
        return p && p.componentType === 'wlaz';
    });
    const otherTopItems = solution.topItems.filter((item) => {
        const p = studnieProducts.find((pr) => pr.id === item.productId);
        return p && p.componentType !== 'wlaz';
    });

    const kregItemsOrdered = solution.reductionUsed
        ? solution.kregItems
        : [...solution.kregItems].reverse();

    let newConfig = [
        ...wlazItems,
        ...solution.avrItems,
        ...otherTopItems,
        ...kregItemsOrdered,
        solution.dennica
    ];

    for (let i = 0; i < newConfig.length - 1; i++) {
        const itemKonus = newConfig[i];
        const prodKonus = studnieProducts.find((p) => p.id === itemKonus.productId);

        if (prodKonus && prodKonus.componentType === 'konus' && (prodKonus.height || 0) <= 650) {
            let nextKragIdx = -1;
            for (let j = i + 1; j < newConfig.length; j++) {
                const pj = studnieProducts.find((p) => p.id === newConfig[j].productId);
                if (pj && (pj.componentType === 'krag' || pj.componentType === 'krag_ot')) {
                    nextKragIdx = j;
                    break;
                } else if (
                    pj &&
                    (pj.componentType === 'dennica' || pj.componentType === 'plyta_redukcyjna')
                ) {
                    break;
                }
            }

            if (nextKragIdx >= 0) {
                const itemKrag = newConfig[nextKragIdx];
                const prodKrag = studnieProducts.find((p) => p.id === itemKrag.productId);

                if (prodKrag && prodKrag.height === 250 && prodKrag.componentType === 'krag') {
                    const konusPlus = availProducts.find(
                        (p) =>
                            p.componentType === 'konus' &&
                            p.dn === prodKonus.dn &&
                            (p.height || 0) > 800
                    );
                    if (konusPlus) {
                        itemKonus.productId = konusPlus.id;
                        if (itemKrag.quantity > 1) {
                            itemKrag.quantity--;
                        } else {
                            newConfig.splice(nextKragIdx, 1);
                        }
                    }
                }
            }
            break;
        }
    }

    if (solution.errors && solution.errors.length > 0) {
        logger.warn('wellSolver', '[AutoSelect] Uwagi:', solution.errors.join('; '));
    }
    logger.info(
        'wellSolver',
        '[AutoSelect] runJsAutoSelection zwraca config.length=',
        newConfig.length,
        'pierwszy=',
        newConfig[0]?.productId
    );

    return {
        config: newConfig,
        totalHeight: solution.totalHeight,
        diff: solution.diff,
        isMinimal: solution.isMinimal,
        errors: solution.errors,
        topLabel: solution.topLabel,
        fallback,
        fallbackReason
    };
}
