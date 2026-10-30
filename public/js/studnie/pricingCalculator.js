// @ts-check
/* ===== KALKULATOR WYCENY OFERTY (STUDNIE) ===== */
/* Wydzielone z offerSave.js — odpowiedzialność: kalkulacja cen, transportu, i eksportu studni */
/* Zależności: calcWellStats, studnieProducts, wellDiscounts, getWellZwienczenieName, getWellActiveDiscounts,
   calculateAssignedPrzejscia, getItemPriceBreakdown, calculatePrecoAllocationForItem,
   getItemAssessedPrice, calcTransportCount, MAX_TRANSPORT_WEIGHT (wszystkie globalne) */

// SSoT zaokrągleń: shared/formatters.js → roundMoney (2 miejsca, half-up).
// Fallback wyłącznie dla sandboxów vm/testów bez formatters.js.
const _moneyRoundPricingCalc =
    typeof roundMoney === 'function'
        ? roundMoney
        : (/** @type {number} */ v) => {
              const n = Number(v);
              if (!Number.isFinite(n)) return 0;
              const sign = n < 0 ? -1 : 1;
              return sign * (Math.round((Math.abs(n) + Number.EPSILON) * 100) / 100);
          };

/**
 * Kopia pozycji config do `wellsExport`. `_elemId` to tożsamość elementu PZ
 * (`orderZleceniaData`), a nie treść oferty — w eksporcie nieużywana, a przy
 * tysiącach studni to ~0,5 MB payloadu zapisu.
 * @param {object} item
 * @param {object} extra
 * @returns {object}
 */
function _exportConfigItem(item, extra) {
    const copy = Object.assign({}, item, extra);
    delete copy._elemId;
    return copy;
}

/**
 * Oblicza pełną wycenę oferty studni: sumy, koszty transportu, dane eksportowe.
 * @param {Array} wells
 * @param {number} transportKm
 * @param {number} transportRate
 * @param {string} transportMode
 * @returns {{totalNetto:number,totalWeight:number,totalTransportCostForOffer:number,wellsForExport:Array,hasPricingError:boolean,errorWells:Array}}
 */
function calculateOfferPricing(wells, transportKm, transportRate, transportMode) {
    let totalNetto = 0;
    let totalWeight = 0;
    // Render/export: corrupt stored → safe fallback 0% (kontrakt throw nietknięty).
    const _calcStats = typeof safeCalcWellStats === 'function' ? safeCalcWellStats : calcWellStats;
    const _isPricingErr =
        typeof isWellPricingError === 'function'
            ? isWellPricingError
            : function (_w, s) {
                  return !!(s && s.error);
              };
    let hasPricingError = false;
    const errorWells = [];
    wells.forEach(function (well) {
        const stats = _calcStats(well);
        if (_isPricingErr(well, stats)) {
            hasPricingError = true;
            errorWells.push(well && well.id !== undefined ? well.id : null);
        }
        totalNetto += stats.price;
        totalWeight += stats.weight;
    });

    // F8: drugi pass wag skasowany — ta sama suma w tej samej kolejności co wyżej
    // (brak mutacji pomiędzy), więc bit-identyczna; _calcStats determinystyczny per tick.
    const globalWeightForTransport = totalWeight;
    let totalTransportCostForOffer = 0;
    if (transportKm > 0 && transportRate > 0) {
        const totalTransportsCount =
            typeof calcTransportCount === 'function'
                ? calcTransportCount(globalWeightForTransport, transportMode)
                : Math.ceil(globalWeightForTransport / MAX_TRANSPORT_WEIGHT);
        const costPerTrip = transportKm * transportRate;
        totalTransportCostForOffer = totalTransportsCount * costPerTrip;
    }

    const productMap =
        typeof studnieProductsById !== 'undefined' && studnieProductsById
            ? studnieProductsById
            : new Map(
                  studnieProducts.map(function (p) {
                      return [p.id, p];
                  })
              );
    const wellsForExport = wells.map(function (well) {
        const stats = _calcStats(well);
        const wellTransportCost =
            globalWeightForTransport > 0
                ? totalTransportCostForOffer * (stats.weight / globalWeightForTransport)
                : 0;
        const zwienczenie =
            typeof getWellZwienczenieName === 'function' ? getWellZwienczenieName(well) : '\u2014';
        const discountKey = well.dn === 'styczna' ? 'styczne' : well.dn || '';
        const activeDiscounts =
            typeof getWellActiveDiscounts === 'function'
                ? getWellActiveDiscounts(well)
                : typeof wellDiscounts !== 'undefined'
                  ? wellDiscounts
                  : {};
        const disc = activeDiscounts[discountKey] || { dennica: 0, nadbudowa: 0, preco: 0 };
        const _nadbPct =
            typeof getWellNadbudowaPctSafe === 'function'
                ? getWellNadbudowaPctSafe(well, disc)
                : getWellNadbudowaPct(well, disc);
        const nadbudowaMult = 1 - _nadbPct / 100;
        const precoMult =
            1 -
            (typeof safePrecoPct === 'function' ? safePrecoPct(well, disc) : disc.preco || 0) / 100;
        const assignedPrzejscia =
            typeof calculateAssignedPrzejscia === 'function'
                ? calculateAssignedPrzejscia(well)
                : {};
        // P4-P0: kontekst Preco raz per studnia (nie per pozycja).
        const precoCtx =
            typeof computePrecoWellContext === 'function'
                ? computePrecoWellContext(well)
                : undefined;
        const _wPricingErr = _isPricingErr(well, stats);
        return {
            name: well.name,
            dn: well.dn,
            height: stats.height,
            weight: stats.weight,
            zwienczenie: zwienczenie,
            price: stats.price,
            pricingError: _wPricingErr ? stats.error || true : false,
            transportCost: wellTransportCost,
            totalPrice: stats.price + wellTransportCost,
            rzednaWlazu: well.rzednaWlazu,
            rzednaDna: well.rzednaDna,
            magazyn: well.magazyn,
            config: (well.config || []).map(function (item, index) {
                const p = productMap.get(item.productId);
                if (!p) return _exportConfigItem(item, {});
                if (p.componentType === 'kineta') {
                    return _exportConfigItem(item, { _xskip: true, _xp: 0 });
                }
                const hasKineta =
                    p.componentType === 'dennica' &&
                    well.config.some(function (c) {
                        const kp = productMap.get(c.productId);
                        return kp && kp.componentType === 'kineta';
                    });
                const myPrzejscia = assignedPrzejscia[index] || [];
                let hasSurcharge = hasKineta || myPrzejscia.length > 0;
                if (!hasSurcharge && typeof getItemPriceBreakdown === 'function') {
                    const bd = getItemPriceBreakdown(well, p, false, item);
                    hasSurcharge =
                        bd.pehd > 0 ||
                        bd.malowanieW > 0 ||
                        bd.malowanieZ > 0 ||
                        bd.zelbet > 0 ||
                        bd.nierdzewna > 0;
                }
                if (!hasSurcharge && typeof calculatePrecoAllocationForItem === 'function') {
                    const pa = calculatePrecoAllocationForItem(well, index, precoCtx);
                    if (pa.hasPreco && pa.allocatedCost > 0) hasSurcharge = true;
                }
                if (hasSurcharge) {
                    const _assessed =
                        typeof getItemAssessedPriceSafe === 'function'
                            ? getItemAssessedPriceSafe
                            : getItemAssessedPrice;
                    let basePrice =
                        typeof _assessed === 'function'
                            ? _assessed(well, p, true, item)
                            : p.price || 0;
                    if (p.componentType === 'dennica') {
                        const ki = well.config.find(function (c) {
                            const kp = productMap.get(c.productId);
                            return kp && kp.componentType === 'kineta';
                        });
                        if (ki) {
                            const kp = productMap.get(ki.productId);
                            const kPrice =
                                typeof _assessed === 'function' ? _assessed(well, kp, true, ki) : 0;
                            basePrice += kPrice;
                        }
                    }
                    for (let przIdx = 0; przIdx < myPrzejscia.length; przIdx++) {
                        const prz = myPrzejscia[przIdx];
                        const pp = productMap.get(prz.productId);
                        if (!pp) continue;
                        // Rabat wg hosta przejścia: dennica/styczna -> dennicowy, reszta -> nadbudowa.
                        const przMult =
                            typeof getTransitionHostPctSafe === 'function'
                                ? 1 - getTransitionHostPctSafe(well, disc, prz._hostType) / 100
                                : typeof getTransitionHostPct === 'function'
                                  ? 1 - getTransitionHostPct(well, disc, prz._hostType) / 100
                                  : nadbudowaMult;
                        basePrice +=
                            (pp.price || 0) * przMult +
                            (prz._drillingBasePrice || 0) * przMult +
                            (parseFloat(prz.doplata) || 0);
                    }
                    if (typeof calculatePrecoAllocationForItem === 'function') {
                        const pa2 = calculatePrecoAllocationForItem(well, index, precoCtx);
                        if (pa2.hasPreco && pa2.allocatedCost > 0) {
                            basePrice += pa2.allocatedCost * precoMult;
                        }
                    }
                    return _exportConfigItem(item, { _xp: basePrice });
                }
                const discountPct =
                    typeof getWellDiscountPctSafe === 'function'
                        ? getWellDiscountPctSafe(well, p, disc)
                        : getWellDiscountPct(well, p, disc);
                const _dErr =
                    typeof isWellDiscountCorrupt === 'function' && isWellDiscountCorrupt(well);
                return _exportConfigItem(
                    item,
                    _dErr
                        ? { _xp: p.price || 0, _xd: 0, _discountError: true }
                        : { _xp: p.price || 0, _xd: discountPct }
                );
            }),
            przejscia: well.przejscia
        };
    });

    return {
        totalNetto: _moneyRoundPricingCalc(totalNetto),
        totalWeight: totalWeight,
        totalTransportCostForOffer: _moneyRoundPricingCalc(totalTransportCostForOffer),
        wellsForExport: wellsForExport,
        hasPricingError: hasPricingError,
        errorWells: errorWells
    };
}

window.calculateOfferPricing = calculateOfferPricing;
