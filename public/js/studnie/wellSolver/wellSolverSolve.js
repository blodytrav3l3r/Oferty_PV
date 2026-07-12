// @ts-check
/**
 * wellSolverSolve.js — Solver właściwy (generowanie kandydatów)
 *
 * Zawiera solve() oraz wewnętrzną redukcję DN.
 * Wywoływane przez runJsAutoSelection() z kontekstem (ctx).
 */

// KROK 7: Solver — szuka najlepszej kombinacji
// ctx zawiera: topConfigs, dennicy, kregi, well, availProducts, requiredMm,
//   canReduce, reductionPlate, targetDn, targetDnKregi, avrRings,
//   maxReqH, isWkladkaZwienczenie, mag, holes, transitionsForDP,
//   minDenH, minLowerTotal
function solve(tolBelow, tolAbove, maxAvr, skipHolesValid, ctx) {
    const candidates = [];

    for (const topCfg of ctx.topConfigs) {
        for (const dennicaItem of ctx.dennicy) {
            const denIsMin = dennicaItem.height < ctx.maxReqH;

            let effDenH = dennicaItem.height;
            if (ctx.well.psiaBuda) effDenH -= 100;

            const targetBody = ctx.requiredMm - topCfg.height - effDenH;
            if (targetBody < 0) continue;

            const { kItems, filled } = fillKregiDP(
                targetBody,
                ctx.kregi,
                tolBelow,
                tolAbove,
                dennicaItem.height,
                ctx.transitionsForDP,
                ctx.availProducts
            );

            const otLayout = buildCandidateLayouts(
                dennicaItem,
                kItems,
                ctx.well,
                ctx.availProducts
            );
            const otKItems = otLayout.rings;

            const deficit = ctx.requiredMm - (dennicaItem.height + topCfg.height + filled);
            if (deficit > maxAvr || deficit < -tolAbove) continue;

            const { avrItems, avrH } = findBestAvrFill(deficit, maxAvr, ctx.avrRings);
            const diff = effDenH + topCfg.height + filled + avrH - ctx.requiredMm;
            const isOutOfBounds = diff < -90 || diff > 20;

            const conf = checkConflicts(
                otKItems,
                dennicaItem.height,
                0,
                topCfg.items,
                ctx.holes,
                studnieProducts,
                ctx.well
            );
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
                reductionForced: !!ctx.well.redukcjaDN1000,
                hasReduction: false,
                otCount
            });
            let score = scoreResult.score;
            score += (parseFloat(dennicaItem.height) - ctx.minDenH) * 2000;

            const runErrors = [...conf.errors];
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
    if (ctx.canReduce) {
        const topRedItems = [];
        let topRedH = 0;
        const redTargetProducts = ctx.availProducts.filter((p) => parseInt(p.dn) === ctx.targetDn);
        const redTopProducts = redTargetProducts.filter((p) =>
            [
                'konus',
                'plyta_din',
                'plyta_najazdowa',
                'plyta_zamykajaca',
                'pierscien_odciazajacy'
            ].includes(p.componentType)
        );

        const rZak = ctx.well.redukcjaZakonczenie
            ? redTopProducts.find((p) => p.id === ctx.well.redukcjaZakonczenie)
            : null;
        const rZakFinal =
            rZak ||
            getTopClosure(
                redTargetProducts.filter((p) => filterByWellParams(p, ctx.well)),
                ctx.targetDn,
                null,
                ctx.isWkladkaZwienczenie,
                ctx.mag
            );
        if (rZakFinal) {
            topRedItems.push({ productId: rZakFinal.id, quantity: 1 });
            topRedH += rZakFinal.height;

            const isPlate = ['plyta_najazdowa', 'plyta_zamykajaca'].includes(
                rZakFinal.componentType
            );
            const isRing = rZakFinal.componentType === 'pierscien_odciazajacy';

            if (isPlate || isRing) {
                const partnerType = isPlate
                    ? ['pierscien_odciazajacy']
                    : ['plyta_najazdowa', 'plyta_zamykajaca'];
                const partner = redTargetProducts.find(
                    (p) => partnerType.includes(p.componentType) && filterByWellParams(p, ctx.well)
                );
                if (partner) {
                    topRedItems.push({ productId: partner.id, quantity: 1 });
                    topRedH += partner.height;
                }
            }
        }

        let wlazItem = ctx.well.config.find(
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

        let maxHoleTop = 0;
        if (ctx.well.przejscia && ctx.well.przejscia.length > 0) {
            const rzDna = ctx.well.rzednaDna != null ? ctx.well.rzednaDna : 0;
            for (const pr of ctx.well.przejscia) {
                const pel = parseFloat(pr.rzednaWlaczenia);
                if (!isNaN(pel)) {
                    const holeBottom = (pel - rzDna) * 1000;
                    const pprod = studnieProducts.find((x) => x.id === pr.productId);
                    if (pprod) {
                        const prDN =
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

        const minLowerTotal = Math.max(ctx.well.redukcjaMinH || 0, maxHoleTop);
        let dynamicMinBottom = minLowerTotal;
        let lift = 0;
        while (lift < 40) {
            for (const dennicaItem of ctx.dennicy) {
                const bottomNeed = Math.max(dynamicMinBottom - dennicaItem.height, 0);

                const bKregi = fillKregiDP(
                    bottomNeed,
                    ctx.kregi,
                    0,
                    tolAbove + 60,
                    dennicaItem.height,
                    ctx.transitionsForDP,
                    ctx.availProducts
                );
                const bSec = dennicaItem.height + bKregi.filled;

                const targetBodyNeed = ctx.requiredMm - bSec - ctx.reductionPlate.height - topRedH;
                if (targetBodyNeed < 0) continue;

                const tTarget = fillKregiDP(
                    targetBodyNeed,
                    ctx.targetDnKregi,
                    tolBelow,
                    tolAbove,
                    bSec + ctx.reductionPlate.height,
                    ctx.transitionsForDP,
                    ctx.availProducts
                );
                const currentTotal = bSec + ctx.reductionPlate.height + topRedH + tTarget.filled;

                const deficit = ctx.requiredMm - currentTotal;
                if (deficit > maxAvr || deficit < -tolAbove) continue;
                const { avrItems, avrH } = findBestAvrFill(deficit, maxAvr, ctx.avrRings);

                const diff = currentTotal + avrH - ctx.requiredMm;
                const isOutOfBounds = diff < -90 || diff > 20;

                const redKItems = [];
                bKregi.kItems.forEach((k) => redKItems.push(k));
                redKItems.push({
                    productId: ctx.reductionPlate.id,
                    quantity: 1,
                    _h: ctx.reductionPlate.height
                });
                tTarget.kItems.forEach((k) => redKItems.push(k));

                const redOt = buildCandidateLayouts(
                    dennicaItem,
                    redKItems,
                    ctx.well,
                    ctx.availProducts
                );
                const redOtItems = redOt.rings;

                const conf = checkConflicts(
                    redOtItems,
                    dennicaItem.height,
                    bSec,
                    topRedItems,
                    ctx.holes,
                    studnieProducts,
                    ctx.well
                );

                if (!conf.valid && !skipHolesValid) {
                    if (conf.errors.some((e) => e.includes('redukcyjnej') || e.includes('konus'))) {
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
                    dn: parseInt(ctx.well.dn) || 1200,
                    otCount: redOtCount
                });
                let score = scoreResult.score;
                score += (parseFloat(dennicaItem.height) - ctx.minDenH) * 2000;

                const runErrors = [...conf.errors];
                if (isOutOfBounds)
                    runErrors.push(
                        `Uwaga: Wymuszono tolerancję wysokości (odchyłka ${diff > 0 ? '+' : ''}${diff}mm)`
                    );
                const otStack = [...redOtItems].map((ki) => ({
                    productId: ki.productId,
                    quantity: ki.quantity
                }));
                const plateIdx = otStack.findIndex((ki) => ki.productId === ctx.reductionPlate.id);
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
                        topLabel: `Redukcja DN${ctx.targetDn}`,
                        targetDn: ctx.targetDn,
                        errors: runErrors,
                        isMinimal: conf.isMinimal || dennicaItem.height < ctx.maxReqH,
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
