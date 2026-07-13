// @ts-check
/* ============================
   Well Config Rules — Akcje, layout i scoring
   ============================
   Fragment 2/2: aktualizacja konfiguracji, rozwiązywanie wariantów,
   generator layoutów i scoring.
   ============================ */

/* ===== AKTUALIZACJA KONFIGURACJI PO ZMIANIE PARAMETRÓW ===== */

window.updateConfigToMatchParams = function (well) {
    if (!well || !well.config || well.config.length === 0) return;
    const availProducts = getAvailableProducts(well).filter((p) => filterByWellParams(p, well));
    let anyChanged = false;

    well.config.forEach((item) => {
        const p = studnieProducts.find((pr) => pr.id === item.productId);
        if (!p) return;

        const isDrilled = p.componentType === 'krag_ot' || p.id.endsWith('_OT');

        if (!filterByWellParams(p, well)) {
            const substitute = availProducts.find(
                (cand) =>
                    cand.componentType === p.componentType &&
                    String(cand.dn) === String(p.dn) &&
                    parseFloat(cand.height) === parseFloat(p.height)
            );
            if (substitute) {
                item.productId = substitute.id;
                anyChanged = true;
            } else if (isDrilled) {
                const baseId = p.id.replace('_OT', '');
                const baseProd = studnieProducts.find((pr) => pr.id === baseId);
                if (baseProd) {
                    const baseSub = availProducts.find(
                        (cand) =>
                            cand.componentType === 'krag' &&
                            String(cand.dn) === String(baseProd.dn) &&
                            parseFloat(cand.height) === parseFloat(baseProd.height)
                    );
                    if (baseSub) {
                        const dynamicOtId = baseSub.id + '_OT';
                        if (!studnieProducts.find((pr) => pr.id === dynamicOtId)) {
                            const dynamicProd = structuredClone(baseSub);
                            dynamicProd.id = dynamicOtId;
                            dynamicProd.componentType = 'krag_ot';
                            if (!dynamicProd.name.endsWith(' z otworem'))
                                dynamicProd.name += ' z otworem';
                            studnieProducts.push(dynamicProd);
                        }
                        item.productId = dynamicOtId;
                        anyChanged = true;
                    }
                }
            }
        }
    });

    if (anyChanged) {
        showToast('Zaktualizowano rodzaje elementów w konfiguracji', 'info');
    }
};

/* ===== AUTOMATYCZNE DODANIE PARY ODCIĄŻAJĄCEJ ===== */
window.ensureReliefRingPair = function (well) {
    if (!well || !well.config) return;

    const hasReliefRing = well.config.some((item) => {
        const p = studnieProducts.find((pr) => pr.id === item.productId);
        return p && p.componentType === 'pierscien_odciazajacy';
    });

    const hasReliefPlate = well.config.some((item) => {
        const p = studnieProducts.find((pr) => pr.id === item.productId);
        return (
            p && (p.componentType === 'plyta_zamykajaca' || p.componentType === 'plyta_najazdowa')
        );
    });

    if (!hasReliefRing && !hasReliefPlate) return;

    let targetDn = parseInt(well.dn);
    if (well.dn === 'styczna') {
        targetDn = well.stycznaNadbudowa1200 ? 1200 : 1000;
    } else if (well.redukcjaDN1000) {
        targetDn = well.redukcjaTargetDN || 1000;
    }
    if (isNaN(targetDn)) targetDn = 1000;

    if (hasReliefRing && !hasReliefPlate) {
        const plate = getAvailableProducts(well).find(
            (p) =>
                (p.componentType === 'plyta_zamykajaca' || p.componentType === 'plyta_najazdowa') &&
                parseInt(p.dn) === targetDn
        );
        if (plate) {
            well.config.push({ productId: plate.id, quantity: 1, autoAdded: true });
            showToast('Automatycznie dodano płytę do kompletu odciążającego', 'info');
        }
    }

    if (hasReliefPlate && !hasReliefRing) {
        const ring = getAvailableProducts(well).find(
            (p) => p.componentType === 'pierscien_odciazajacy' && parseInt(p.dn) === targetDn
        );
        if (ring) {
            well.config.push({ productId: ring.id, quantity: 1, autoAdded: true });
            showToast('Automatycznie dodano pierścień odciążający do kompletu', 'info');
        }
    }
};

/* ===== ROZWIĄZYWANIE POPRAWNEGO WARIANTU PRODUKTU ===== */

/**
 * Zwraca poprawny wariant produktu dla bieżących parametrów studni.
 *
 * @param {Object} well - obiekt studni
 * @param {string} productId - ID produktu z konfiguracji
 * @param {Object} [configItem] - element konfiguracji (jeśli podany, auto-koryguje productId)
 * @returns {Object|null} poprawny produkt
 */
window.resolveEffectiveProduct = function (well, productId, configItem) {
    const p = studnieProducts.find((pr) => pr.id === productId);
    if (!p) return null;

    if (filterByWellParams(p, well)) return p;

    const availProducts = getAvailableProducts(well).filter((ap) => filterByWellParams(ap, well));
    const isDrilled = p.componentType === 'krag_ot' || p.id.endsWith('_OT');

    const substitute = availProducts.find(
        (cand) =>
            cand.componentType === p.componentType &&
            String(cand.dn) === String(p.dn) &&
            parseFloat(cand.height) === parseFloat(p.height)
    );

    if (substitute) {
        if (configItem) configItem.productId = substitute.id;
        return substitute;
    }

    if (isDrilled) {
        const baseId = p.id.replace('_OT', '');
        const baseProd = studnieProducts.find((pr) => pr.id === baseId);
        if (baseProd) {
            const baseSub = availProducts.find(
                (cand) =>
                    cand.componentType === 'krag' &&
                    String(cand.dn) === String(baseProd.dn) &&
                    parseFloat(cand.height) === parseFloat(baseProd.height)
            );
            if (baseSub) {
                const dynamicOtId = baseSub.id + '_OT';
                let dynamicProd = studnieProducts.find((pr) => pr.id === dynamicOtId);
                if (!dynamicProd) {
                    dynamicProd = structuredClone(baseSub);
                    dynamicProd.id = dynamicOtId;
                    dynamicProd.componentType = 'krag_ot';
                    if (!dynamicProd.name.endsWith(' z otworem')) dynamicProd.name += ' z otworem';
                    studnieProducts.push(dynamicProd);
                }
                if (configItem) configItem.productId = dynamicOtId;
                return dynamicProd;
            }
        }
    }

    return p;
};

/* ===== GENERATOR KANDYDATÓW KONFIGURACJI (Layout Engine) ===== */

/**
 * Osadza OT warianty kręgów tam, gdzie przejścia wymagają wiercenia.
 *
 * @param {Object} dennicaItem - produkt dennicy (lub obiekt z productId)
 * @param {Array} ringItems - wybrane kręgi z DP [{productId, quantity, _h}]
 * @param {Object} well - obiekt studni
 * @param {Array} availProducts - dostępne produkty
 * @returns {Object} { rings: Array<{productId, quantity}>, needsTallerDennica: boolean }
 */
function buildCandidateLayouts(dennicaItem, ringItems, well, availProducts) {
    const result = { rings: [], needsTallerDennica: false };
    if (!well.przejscia || well.przejscia.length === 0) {
        result.rings = (ringItems || []).map((ki) => ({
            productId: ki.productId,
            quantity: ki.quantity || 1
        }));
        return result;
    }

    const rzDna = well.rzednaDna != null ? parseFloat(well.rzednaDna) : 0;
    const denH = dennicaItem && dennicaItem.height ? parseFloat(dennicaItem.height) : 0;

    const flatItems = [];
    let y = 0;
    flatItems.push({
        productId: dennicaItem?.productId || '',
        height: denH,
        start: 0,
        end: denH,
        origItem: dennicaItem,
        isDennica: true,
        si: 0
    });
    y = denH;
    for (const ki of ringItems || []) {
        const qty = ki.quantity || 1;
        for (let q = 0; q < qty; q++) {
            const h = ki._h || 0;
            flatItems.push({
                productId: ki.productId,
                height: h,
                start: y,
                end: y + h,
                origItem: ki,
                isDennica: false,
                si: flatItems.length
            });
            y += h;
        }
    }

    const segsToReplace = new Map();
    const alreadyNeedsOT = new Set();

    for (const pr of well.przejscia) {
        const pel = parseFloat(pr.rzednaWlaczenia);
        if (isNaN(pel)) continue;
        const mmFromBottom = (pel - rzDna) * 1000;
        const pprod = studnieProducts.find((x) => x.id === pr.productId);
        if (!pprod) continue;

        let dnVal = 160;
        if (pprod.dn && typeof pprod.dn === 'string' && pprod.dn.includes('/'))
            dnVal = parseFloat(pprod.dn.split('/')[1]) || 160;
        else if (pprod.dn) dnVal = parseFloat(pprod.dn) || 160;

        const holeCenter = mmFromBottom + dnVal / 2;
        const pipeTop = mmFromBottom + dnVal;

        const crossesJoint = denH > 0 && mmFromBottom < denH && pipeTop > denH;
        if (crossesJoint) {
            result.needsTallerDennica = true;
        }

        if (denH > 0 && holeCenter < denH && !crossesJoint) continue;

        for (let si = 1; si < flatItems.length; si++) {
            const fi = flatItems[si];
            if (fi.isDennica) continue;
            if (
                ((holeCenter >= fi.start && holeCenter < fi.end) ||
                    (crossesJoint && si === 1 && holeCenter < fi.start)) &&
                !alreadyNeedsOT.has(si)
            ) {
                alreadyNeedsOT.add(si);

                const ringProd = studnieProducts.find((p) => p.id === fi.productId);
                if (!ringProd) break;
                if (ringProd.componentType !== 'krag') break;

                let otProd = availProducts.find(
                    (p) =>
                        (p.componentType === 'krag_ot' ||
                            String(p.id).toLowerCase().endsWith('ot') ||
                            String(p.name).toLowerCase().includes('wiercony')) &&
                        p.dn === ringProd.dn &&
                        p.height === ringProd.height
                );

                if (!otProd) {
                    const dynamicId = ringProd.id + '_OT';
                    otProd = studnieProducts.find((p) => p.id === dynamicId);
                    if (!otProd) {
                        otProd = structuredClone(ringProd);
                        otProd.id = dynamicId;
                        otProd.componentType = 'krag_ot';
                        if (!otProd.name.includes('wiercony')) otProd.name += ' wiercony';
                        studnieProducts.push(otProd);
                    }
                }

                fi.productId = otProd.id;
                segsToReplace.set(si, otProd.id);
                break;
            }
        }
    }

    const flatResult = [];
    for (let si = 1; si < flatItems.length; si++) {
        const fi = flatItems[si];
        if (fi.isDennica) continue;
        flatResult.push({ productId: fi.productId, quantity: 1, _h: fi.height });
    }
    result.rings = flatResult;
    return result;
}

/* ===== SCORING ENGINE ===== */

/**
 * Unifikuje scoring layoutów z obu ścieżek (standardowej i redukcyjnej).
 *
 * @param {Object} opts
 * @param {number} opts.ringCount - liczba kręgów
 * @param {number} opts.diff - odchyłka wysokości [mm]
 * @param {boolean} opts.isOutOfBounds - czy odchyłka poza zakresem
 * @param {boolean} opts.isMinimal - czy minimalny zapas
 * @param {boolean} opts.isFallbackClosure - czy zamiennik zakończenia
 * @param {boolean} [opts.needsTallerDennica] - czy przejście przecina joint
 * @param {boolean} opts.reductionForced - czy redukcja wymagana ale nie użyta
 * @param {boolean} [opts.hasReduction] - czy to ścieżka redukcyjna
 * @param {number} [opts.bottomSectionH] - wysokość sekcji dennej (redukcja)
 * @param {number} [opts.minBottomTotal] - minimalna wysokość sekcji dennej (redukcja)
 * @param {number} [opts.dn] - średnica studni (redukcja)
 * @param {number} [opts.otCount] - liczba kręgów wierconych
 * @param {boolean} [opts.isKonus] - czy zakończenie to konus
 * @returns {{ score: number, breakdown: Array<{factor:string,value:number}>, reason: string }}
 */
function scoreLayout(opts = {}) {
    let score = 0;
    const breakdown = [];

    if (opts.ringCount > 0) {
        const v = opts.ringCount * 10;
        score += v;
        breakdown.push({ factor: 'rings', value: v });
    }

    if (opts.diff !== 0) {
        const mult = opts.hasReduction ? 15 : 5;
        const v = Math.abs(opts.diff) * mult;
        score += v;
        breakdown.push({ factor: 'diff', value: v });
    }

    if (opts.isOutOfBounds) {
        const v = opts.hasReduction ? 50000 : 20000;
        score += v;
        breakdown.push({ factor: 'outOfBounds', value: v });
    }

    if (opts.isMinimal) {
        score += 50000;
        breakdown.push({ factor: 'minimal', value: 50000 });
    }

    if (opts.otCount > 0) {
        const v = -opts.otCount * 20000;
        score += v;
        breakdown.push({ factor: 'ot_bonus', value: v });
    }

    if (opts.isFallbackClosure) {
        score += 100000;
        breakdown.push({ factor: 'fallbackClosure', value: 100000 });
    }

    if (opts.isKonus) {
        score -= 500000;
        breakdown.push({ factor: 'konus_bonus', value: -500000 });
    }

    if (opts.hasReduction && opts.bottomSectionH > 0) {
        const dnFactor = (parseInt(String(opts.dn)) || 1200) / 400;
        const v = opts.bottomSectionH * dnFactor;
        score += v;
        breakdown.push({ factor: 'bottomSection', value: v });

        if (opts.minBottomTotal > 0 && opts.bottomSectionH > opts.minBottomTotal) {
            const oversized = (opts.bottomSectionH - opts.minBottomTotal) * 50;
            score += oversized;
            breakdown.push({ factor: 'oversizedBottom', value: oversized });
        }
    }

    if (opts.reductionForced) {
        score += 5000000;
        breakdown.push({ factor: 'reductionForced', value: 5000000 });
    }

    let reason = 'ok';
    if (opts.reductionForced) reason = 'reductionForced';
    else if (opts.isFallbackClosure) reason = 'fallbackClosure';
    else if (opts.isMinimal) reason = 'minimal';
    else if (opts.isOutOfBounds) reason = 'outOfBounds';
    else if (opts.diff !== 0) reason = 'diff';

    return { score, breakdown, reason };
}

window.buildCandidateLayouts = buildCandidateLayouts;
window.scoreLayout = scoreLayout;
