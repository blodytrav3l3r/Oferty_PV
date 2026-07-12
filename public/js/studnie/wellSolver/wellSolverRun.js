// @ts-check
/**
 * wellSolverRun.js — Lokalny solver JS (runJsAutoSelection)
 *
 * Główny orchestrator auto-doboru: przygotowuje dane,
 * wywołuje solve() z kontekstem, obsługuje STAGES/AI/konfigrację końcową.
 */

function runJsAutoSelection(well, requiredMm, availProducts) {
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
    topConfigs.push(buildTopConfig(topProd, well));

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
            const fbCfg = buildTopConfig(dinProd, well);
            fbCfg.label += ' (zamiennik)';
            topConfigs.push(fbCfg);
        }
    }

    // KROK 3: Przejścia — oblicz minimalne wymagania
    const holes = (well.przejscia || []).map((p) => {
        const pel = parseFloat(p.rzednaWlaczenia);
        let prDN = 160;
        const prod = availProducts.find((x) => x.id === p.productId);
        if (prod && typeof prod.dn === 'string' && prod.dn.includes('/'))
            prDN = parseFloat(prod.dn.split('/')[1]) || 160;
        else if (prod && prod.dn != null) prDN = parseFloat(prod.dn) || 160;

        const bottomEdge = isNaN(pel) ? 0 : Math.round((pel - (well.rzednaDna || 0)) * 1000);
        const center = bottomEdge + prDN / 2;

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

    const fn = typeof fmtInt === 'function' ? fmtInt : (v) => v;
    if (requiredMm < maxReqHMin) {
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
    const canReduce =
        well.redukcjaDN1000 && [1200, 1500, 2000, 2500].includes(dn) && reductionPlate;

    const upperDn = canReduce ? targetDn : effectiveDn;

    // KROK 5: DP Ring Optimizer — przygotowanie przejść
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

    // KROK 6: Wywołanie solve() z kontekstem
    const STAGES = [
        { tolBelow: 60, tolAbove: 20, maxAvr: 260, skip: false, name: 'Standard' },
        { tolBelow: 200, tolAbove: 20, maxAvr: 260, skip: false, name: 'Optymalny' },
        { tolBelow: 260, tolAbove: 20, maxAvr: 260, skip: false, name: 'Ratunkowy' },
        { tolBelow: 260, tolAbove: 500, maxAvr: 260, skip: false, name: 'Poszerzony (+500mm)' },
        { tolBelow: 260, tolAbove: 1000, maxAvr: 260, skip: false, name: 'Ekstremalny (+1000mm)' }
    ];

    const solverCtx = {
        topConfigs,
        dennicy,
        kregi,
        well,
        availProducts,
        requiredMm,
        canReduce,
        reductionPlate,
        targetDn,
        targetDnKregi,
        avrRings,
        maxReqH,
        isWkladkaZwienczenie,
        mag,
        holes,
        transitionsForDP,
        minDenH
    };

    let candidates = null;
    let fallback = false;
    let fallbackReason = '';

    for (const stage of STAGES) {
        candidates = solve(stage.tolBelow, stage.tolAbove, stage.maxAvr, stage.skip, solverCtx);
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

    const solution = candidates[0].solution;

    // AI DUAL-RANKING (shadow mode)
    if (
        candidates.length >= 3 &&
        typeof window.rankCandidates === 'function' &&
        typeof window.selectWithExploration === 'function' &&
        typeof window.recordAiRankDecision === 'function'
    ) {
        (async function () {
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
                }
            } catch (e) {
                if (typeof logger !== 'undefined' && logger.warn) {
                    logger.warn('wellSolver', '[AiRank] Shadow ranking failed:', e);
                }
            }
        })();
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

    const newConfig = [
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
