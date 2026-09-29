// @ts-check
/* ===== POMOCNICY CENOWE (pricing/stats) ===== */
// ponytail: hoisted per-refresh derived — drillingProducts once, nie per przejście
let _cachedDrillingProducts = null;
let _cachedDrillingProductsLen = -1;
function _getDrillingProducts() {
    const len = Array.isArray(studnieProducts) ? studnieProducts.length : -1;
    if (_cachedDrillingProducts && _cachedDrillingProductsLen === len)
        return _cachedDrillingProducts;
    _cachedDrillingProducts = studnieProducts.filter((x) => x.category === 'Wiercenie');
    _cachedDrillingProductsLen = len;
    return _cachedDrillingProducts;
}

function calcPrecoPricing(well) {
    return calcPrecoPricingPure(well, {
        precoPricing: precoPricing,
        studnieProducts: studnieProducts,
        FLOW_TYPES: FLOW_TYPES,
        showToast: typeof showToast === 'function' ? showToast : undefined
    });
}

function getWellActiveDiscounts(well) {
    // W trybie edycji zamowienia cena zamowienia liczona z live wellDiscounts.
    // Snapshot (originalSnapshot.wellDiscounts) sluzy wylacznie kolumnie
    // "Cena z oferty" (jawny swap w offerSummaryTable/getOrderChanges).
    if (typeof orderEditMode !== 'undefined' && orderEditMode) {
        return wellDiscounts;
    }
    let activeDiscounts = wellDiscounts;
    if (typeof isWellOrdered === 'function' && isWellOrdered(well)) {
        const currentOfferId =
            typeof editingOfferIdStudnie !== 'undefined' ? editingOfferIdStudnie : null;
        if (currentOfferId && typeof getOrderForWellId === 'function') {
            const order = getOrderForWellId(well.id, currentOfferId);
            if (order && order.originalSnapshot && order.originalSnapshot.wellDiscounts) {
                activeDiscounts = order.originalSnapshot.wellDiscounts;
            }
        }
    }
    return activeDiscounts;
}

const ZWIENCZENIE_TYPES = [
    'konus',
    'plyta_din',
    'plyta_zamykajaca',
    'plyta_najazdowa',
    'pierscien_odciazajacy',
    'wlaz'
];

/**
 * Rabat (%) dla komponentu wg klasy nośności studni.
 * - zakończenie (konus/płyty/pierścień/właz) -> zwienczenie<KlasaZwieńcz.>
 * - dennica/kineta/styczna    -> dennica<KlasaKorpus>
 * - pozostałe (kregi, avr, nadbudowa) -> nadbudowa<KlasaKorpus>
 * Elementy E600/F900 mają wyłącznie własne rabaty klasowe: brak wpisanego
 * rabatu klasowego = 0% (nie bierzemy bazy z D400). Baza dotyczy tylko D400.
 */
/**
 * Kontrakt rabatu: discountPct ∈ [0,100], finite number. Brak klucza (null/
 * undefined) = brak rabatu → 0. Obecna lecz invalid wartość (NaN, ±Inf,
 * string, <0, >100, np. legacy/corrupt) → throw RangeError (fail-loud, nigdy
 * cichy clamp ani NaN w cenie). Ingestia (applyDiscount/updateDiscount)
 * blokuje zapis invalid, więc throw odpala tylko na danych sprzed kontraktu.
 * DECYZJA throw-vs-guard: throw na getterach/kalkulatorze (kontrakt E2).
 * Renderery NIE łapią go wprost — używają safe-wrapperów poniżej
 * (getWellDiscountPctSafe/getItemAssessedPriceSafe/safeCalcWellStats):
 * fallback cena bez rabatu (0%) + logger.warn + flaga well._discountCorrupt
 * i badge błędu w UI. Nie ciche 0 w cenie końcowej — zawsze oznaczone.
 * Ingestia (applyDiscount/updateDiscount) i throwy nietknięte.
 */
function assertDiscountPct(value, key) {
    if (typeof value !== 'number' || !Number.isFinite(value) || value < 0 || value > 100) {
        throw new RangeError(
            'Invalid discountPct' +
                (key ? " '" + key + "'" : '') +
                ': ' +
                String(value) +
                ' (oczekiwano finite number ∈ [0,100])'
        );
    }
    return value;
}

function readDiscountPct(disc, key) {
    // Brak klucza = brak rabatu → 0 (wsteczne). Jawny klucz (nawet null/
    // undefined) = stored → assert, invalid rzuca (matrix: null/undefined
    // invalid; brak klucza to nie stored).
    if (disc && Object.prototype.hasOwnProperty.call(disc, key)) {
        return assertDiscountPct(disc[key], key);
    }
    return 0;
}

function getWellDiscountPct(well, p, disc) {
    if (!disc) disc = {};
    if (ZWIENCZENIE_TYPES.includes(p.componentType)) {
        const zCls = well.klasaNosnosci_zwienczenie || 'D400';
        if (zCls !== 'D400') return readDiscountPct(disc, 'zwienczenie' + zCls);
        return readDiscountPct(disc, 'nadbudowa');
    }
    const kCls = well.klasaNosnosci_korpus || 'D400';
    if (
        p.componentType === 'dennica' ||
        p.componentType === 'kineta' ||
        p.componentType === 'styczna'
    ) {
        if (kCls !== 'D400') return readDiscountPct(disc, 'dennica' + kCls);
        return readDiscountPct(disc, 'dennica');
    }
    return getWellNadbudowaPct(well, disc);
}

/**
 * Rabat (%) nadbudowy wg klasy nośności korpusu (kregi, przejścia, wiercenia).
 * Korpus E600/F900 bez wpisanego rabatu klasowego = 0% (bez fallbacku do bazy).
 * Fallback do bazowego nadbudowa tylko dla D400.
 */
function getWellNadbudowaPct(well, disc) {
    if (!disc) disc = {};
    const kCls = well.klasaNosnosci_korpus || 'D400';
    if (kCls !== 'D400') return readDiscountPct(disc, 'nadbudowa' + kCls);
    return readDiscountPct(disc, 'nadbudowa');
}

/**
 * Rabat (%) przejścia/wiercenia wg elementu-hostu (przypisanie przez
 * buildConfigMap + findAssignedElement).
 * - host dennicowy (dennica/styczna) -> rabat dennicy wg klasy korpusu
 *   (dla stycznej z wiersza `styczne`),
 * - pozostałe hosty (krag/krag_ot/...) i brak hosta -> rabat nadbudowy wg klasy.
 * Brak wpisanego rabatu klasowego E600/F900 = 0% (bez fallbacku do bazy D400).
 * Kręgi liczone są niezależnie przez getItemAssessedPrice — tu nic nie zmieniaj.
 */
function getTransitionHostPct(well, disc, hostType) {
    if (!disc) disc = {};
    if (hostType === 'dennica' || hostType === 'styczna') {
        // Ta sama reguła co dennica (w tym 0% bez wpisanego rabatu klasowego).
        return getWellDiscountPct(well, { componentType: 'dennica' }, disc);
    }
    return getWellNadbudowaPct(well, disc);
}

function getItemAssessedPrice(well, p, applyDiscount = true, item = null) {
    let itemPrice = p.price || 0;

    let discountPct = 0;
    if (applyDiscount && well.dn) {
        const discountKey = well.dn === 'styczna' ? 'styczne' : well.dn;

        const activeDiscounts = getWellActiveDiscounts(well);
        const disc = activeDiscounts[discountKey] || { dennica: 0, nadbudowa: 0 };
        discountPct = getWellDiscountPct(well, p, disc);
    }
    const mult = 1 - discountPct / 100;

    if (p.componentType === 'kineta') {
        let dennicaHeight = 0;
        const dennicaItem = well.config.find((c) => {
            const pr =
                typeof getStudnieProductById === 'function'
                    ? getStudnieProductById(c.productId)
                    : studnieProducts.find((x) => x.id === c.productId);
            return pr && pr.componentType === 'dennica';
        });
        if (dennicaItem) {
            dennicaHeight =
                (typeof getStudnieProductById === 'function'
                    ? getStudnieProductById(dennicaItem.productId)
                    : studnieProducts.find((x) => x.id === dennicaItem.productId)
                )?.height || 0;
        }

        const h1m = parseFloat(p.hMin1);
        const h1x = parseFloat(p.hMax1);
        const h2m = parseFloat(p.hMin2);
        const h2x = parseFloat(p.hMax2);
        const h3m = parseFloat(p.hMin3);
        const h3x = parseFloat(p.hMax3);

        let kinetaBase = itemPrice;
        if (!isNaN(h1m) && !isNaN(h1x) && dennicaHeight >= h1m && dennicaHeight <= h1x) {
            kinetaBase = parseFloat(p.cena1) || 0;
        } else if (!isNaN(h2m) && !isNaN(h2x) && dennicaHeight >= h2m && dennicaHeight <= h2x) {
            kinetaBase = parseFloat(p.cena2) || 0;
        } else if (!isNaN(h3m) && !isNaN(h3x) && dennicaHeight >= h3m && dennicaHeight <= h3x) {
            kinetaBase = parseFloat(p.cena3) || 0;
        }

        itemPrice = kinetaBase * mult;

        if (well.malowanieW && well.malowanieW !== 'brak' && well.malowanieWewCena) {
            if (
                well.malowanieW === 'kineta' ||
                well.malowanieW === 'kineta_dennica' ||
                well.malowanieW === 'cale'
            ) {
                const kinetaArea = calcKinetaPaintingArea(well);
                itemPrice += kinetaArea * well.malowanieWewCena;
            }
        } else if (
            well.malowanieW &&
            well.malowanieW !== 'brak' &&
            !well.malowanieWewCena &&
            p.malowanieWewnetrzne
        ) {
            if (
                well.malowanieW === 'kineta' ||
                well.malowanieW === 'kineta_dennica' ||
                well.malowanieW === 'cale'
            ) {
                itemPrice += parseFloat(p.malowanieWewnetrzne);
            }
        }
        if (well.malowanieZ === 'zewnatrz' && well.malowanieZewCena) {
            itemPrice += (p.areaExt || 0) * well.malowanieZewCena;
        } else if (
            well.malowanieZ === 'zewnatrz' &&
            p.malowanieZewnetrzne &&
            !well.malowanieZewCena
        ) {
            itemPrice += parseFloat(p.malowanieZewnetrzne);
        }

        return itemPrice;
    }

    itemPrice = itemPrice * mult;

    itemPrice += getPehdSurcharge(well, p, applyDiscount, item);

    if (well.malowanieW && well.malowanieW !== 'brak' && well.malowanieWewCena) {
        if (well.malowanieW === 'kineta_dennica' && p.componentType === 'dennica') {
        } else if (well.malowanieW === 'cale') {
            if (p.componentType === 'dennica' || p.componentType === 'styczna') {
            } else {
                itemPrice += (p.area || 0) * well.malowanieWewCena;
            }
        }
    } else if (well.malowanieW && well.malowanieW !== 'brak' && p.malowanieWewnetrzne) {
        if (
            well.malowanieW === 'cale' &&
            p.componentType !== 'dennica' &&
            p.componentType !== 'styczna'
        ) {
            itemPrice += parseFloat(p.malowanieWewnetrzne);
        }
    }

    if (well.malowanieZ === 'zewnatrz' && well.malowanieZewCena) {
        itemPrice += (p.areaExt || 0) * well.malowanieZewCena;
    } else if (well.malowanieZ === 'zewnatrz' && p.malowanieZewnetrzne && !well.malowanieZewCena) {
        itemPrice += parseFloat(p.malowanieZewnetrzne);
    }

    if (
        (well.dennicaMaterial === 'zelbetowa' || well.material === 'zelbetowa') &&
        p.componentType === 'dennica' &&
        p.doplataZelbet
    ) {
        itemPrice += parseFloat(p.doplataZelbet);
    }

    if (
        well.stopnie === 'nierdzewna' &&
        (p.componentType === 'krag_ot' || p.componentType === 'dennica') &&
        p.doplataDrabNierdzewna
    ) {
        itemPrice += parseFloat(p.doplataDrabNierdzewna);
    }

    return itemPrice;
}

function getItemPriceBreakdown(well, p, applyDiscount, item) {
    let base = p.price || 0;
    let pehd = 0;
    let malowanieW = 0;
    let malowanieZ = 0;
    let zelbet = 0;
    let nierdzewna = 0;

    let discountPct = 0;
    if (applyDiscount !== false && well.dn) {
        const discountKey = well.dn === 'styczna' ? 'styczne' : well.dn;
        const activeDiscounts = getWellActiveDiscounts(well);
        const disc = activeDiscounts[discountKey] || { dennica: 0, nadbudowa: 0 };
        discountPct = getWellDiscountPct(well, p, disc);
    }
    const mult = 1 - discountPct / 100;

    if (p.componentType === 'kineta') {
        let dennicaHeight = 0;
        const dennicaItem = well.config.find(function (c) {
            const pr =
                typeof getStudnieProductById === 'function'
                    ? getStudnieProductById(c.productId)
                    : studnieProducts.find(function (x) {
                          return x.id === c.productId;
                      });
            return pr && pr.componentType === 'dennica';
        });
        if (dennicaItem) {
            const pPr =
                typeof getStudnieProductById === 'function'
                    ? getStudnieProductById(dennicaItem.productId)
                    : studnieProducts.find(function (x) {
                          return x.id === dennicaItem.productId;
                      });
            dennicaHeight = pPr ? pPr.height || 0 : 0;
        }

        const h1m = parseFloat(p.hMin1);
        const h1x = parseFloat(p.hMax1);
        const h2m = parseFloat(p.hMin2);
        const h2x = parseFloat(p.hMax2);
        const h3m = parseFloat(p.hMin3);
        const h3x = parseFloat(p.hMax3);

        let kinetaBase = base;
        if (!isNaN(h1m) && !isNaN(h1x) && dennicaHeight >= h1m && dennicaHeight <= h1x) {
            kinetaBase = parseFloat(p.cena1) || 0;
        } else if (!isNaN(h2m) && !isNaN(h2x) && dennicaHeight >= h2m && dennicaHeight <= h2x) {
            kinetaBase = parseFloat(p.cena2) || 0;
        } else if (!isNaN(h3m) && !isNaN(h3x) && dennicaHeight >= h3m && dennicaHeight <= h3x) {
            kinetaBase = parseFloat(p.cena3) || 0;
        }

        base = kinetaBase * mult;

        if (well.malowanieW && well.malowanieW !== 'brak' && well.malowanieWewCena) {
            if (
                well.malowanieW === 'kineta' ||
                well.malowanieW === 'kineta_dennica' ||
                well.malowanieW === 'cale'
            ) {
                const kinetaArea = calcKinetaPaintingArea(well);
                malowanieW = kinetaArea * well.malowanieWewCena;
            }
        } else if (
            well.malowanieW &&
            well.malowanieW !== 'brak' &&
            !well.malowanieWewCena &&
            p.malowanieWewnetrzne
        ) {
            if (
                well.malowanieW === 'kineta' ||
                well.malowanieW === 'kineta_dennica' ||
                well.malowanieW === 'cale'
            ) {
                malowanieW = parseFloat(p.malowanieWewnetrzne);
            }
        }
        if (well.malowanieZ === 'zewnatrz' && well.malowanieZewCena) {
            malowanieZ = (p.areaExt || 0) * well.malowanieZewCena;
        } else if (
            well.malowanieZ === 'zewnatrz' &&
            p.malowanieZewnetrzne &&
            !well.malowanieZewCena
        ) {
            malowanieZ = parseFloat(p.malowanieZewnetrzne);
        }

        return {
            base: base,
            pehd: 0,
            malowanieW: malowanieW,
            malowanieZ: malowanieZ,
            zelbet: 0,
            nierdzewna: 0,
            total: base + malowanieW + malowanieZ
        };
    }

    base = base * mult;

    pehd = getPehdSurcharge(well, p, applyDiscount, item);

    if (well.malowanieW && well.malowanieW !== 'brak' && well.malowanieWewCena) {
        if (well.malowanieW === 'kineta_dennica' && p.componentType === 'dennica') {
        } else if (well.malowanieW === 'cale') {
            if (p.componentType !== 'dennica' && p.componentType !== 'styczna') {
                malowanieW = (p.area || 0) * well.malowanieWewCena;
            }
        }
    } else if (well.malowanieW && well.malowanieW !== 'brak' && p.malowanieWewnetrzne) {
        if (
            well.malowanieW === 'cale' &&
            p.componentType !== 'dennica' &&
            p.componentType !== 'styczna'
        ) {
            malowanieW = parseFloat(p.malowanieWewnetrzne);
        }
    }

    if (well.malowanieZ === 'zewnatrz' && well.malowanieZewCena) {
        malowanieZ = (p.areaExt || 0) * well.malowanieZewCena;
    } else if (well.malowanieZ === 'zewnatrz' && p.malowanieZewnetrzne && !well.malowanieZewCena) {
        malowanieZ = parseFloat(p.malowanieZewnetrzne);
    }

    if (
        (well.dennicaMaterial === 'zelbetowa' || well.material === 'zelbetowa') &&
        p.componentType === 'dennica' &&
        p.doplataZelbet
    ) {
        zelbet = parseFloat(p.doplataZelbet);
    }

    if (
        well.stopnie === 'nierdzewna' &&
        (p.componentType === 'krag_ot' || p.componentType === 'dennica') &&
        p.doplataDrabNierdzewna
    ) {
        nierdzewna = parseFloat(p.doplataDrabNierdzewna);
    }

    return {
        base: base,
        pehd: pehd,
        malowanieW: malowanieW,
        malowanieZ: malowanieZ,
        zelbet: zelbet,
        nierdzewna: nierdzewna,
        total: base + pehd + malowanieW + malowanieZ + zelbet + nierdzewna
    };
}

function calcWellStats(well) {
    let price = 0,
        weight = 0,
        height = 0,
        areaInt = 0,
        areaExt = 0;
    let priceDennica = 0,
        priceNadbudowa = 0;

    let priceBase = 0,
        priceDennicaBase = 0,
        priceNadbudowaBase = 0;

    let belowType = null;
    let psiaSeed = !!well.psiaBuda;
    const configReversed = [...(well.config || [])].reverse();

    // Komplet odciążający: pierścień nachodzi na krąg (wkład 0), pod płytą
    // dylatacja RELIEF_DYLATACJA_MM. Bez tego płyta+pierścień sumowały pełne
    // height z cennika (np. 150+150 zamiast 150+50+0).
    const __reliefFind = (id) =>
        typeof getStudnieProductById === 'function'
            ? getStudnieProductById(id)
            : (typeof studnieProducts !== 'undefined' ? studnieProducts : []).find(
                  (pr) => pr.id === id
              );
    const __relief =
        typeof getReliefKompletConfigIdx === 'function'
            ? getReliefKompletConfigIdx(well.config || [], __reliefFind)
            : { ringZero: new Set(), gapAfter: new Set() };
    const __reliefDyl =
        typeof window !== 'undefined' && typeof window.RELIEF_DYLATACJA_MM === 'number'
            ? window.RELIEF_DYLATACJA_MM
            : 50;

    configReversed.forEach((item, rIdx) => {
        const topIdx = configReversed.length - 1 - rIdx;
        const p =
            typeof resolveEffectiveProduct === 'function'
                ? resolveEffectiveProduct(well, item.productId, item)
                : typeof getStudnieProductById === 'function'
                  ? getStudnieProductById(item.productId)
                  : studnieProducts.find((pr) => pr.id === item.productId);
        if (!p) return;

        const isDennicaLike = isDennicaLikeProduct(p);

        let itemPriceDisc, itemPriceBaseVal;
        const useFrozenPrice =
            item.frozenPrice != null &&
            typeof isFrozenPriceCtx === 'function' &&
            isFrozenPriceCtx();
        if (useFrozenPrice) {
            itemPriceDisc = item.frozenPrice;
            itemPriceBaseVal =
                item.frozenPriceBase != null ? item.frozenPriceBase : item.frozenPrice;
        } else {
            itemPriceDisc = getItemAssessedPrice(well, p, true, item);
            itemPriceBaseVal = getItemAssessedPrice(well, p, false, item);
        }

        const lineTotalDisc = itemPriceDisc * item.quantity;
        const lineTotalBase = itemPriceBaseVal * item.quantity;

        price += lineTotalDisc;
        priceBase += lineTotalBase;

        if (
            p.componentType === 'dennica' ||
            p.componentType === 'kineta' ||
            p.componentType === 'styczna'
        ) {
            priceDennica += lineTotalDisc;
            priceDennicaBase += lineTotalBase;
        } else {
            priceNadbudowa += lineTotalDisc;
            priceNadbudowaBase += lineTotalBase;
        }

        weight += (p.weight || 0) * item.quantity;
        areaInt += (p.area || 0) * item.quantity;
        areaExt += (p.areaExt || 0) * item.quantity;

        for (let q = 0; q < item.quantity; q++) {
            let h = p.height || 0;
            if (__relief.ringZero.has(topIdx)) h = 0;
            if (isDennicaLike) {
                h -= dennicaHeightPenalty(p, psiaSeed ? 'dennica' : belowType);
                psiaSeed = false;
                belowType = p.componentType;
            }
            height += h;
            if (p.componentType !== 'uszczelka') {
                belowType = p.componentType;
            }
        }
        if (__relief.gapAfter.has(topIdx)) height += __reliefDyl * (item.quantity || 1);
    });

    if (well.przejscia) {
        const discountKey = well.dn === 'styczna' ? 'styczne' : well.dn;
        const activeDiscounts = getWellActiveDiscounts(well);
        const disc = activeDiscounts[discountKey] || {};
        const rzDnaGlob = parseFloat(well.rzednaDna) || 0;

        let configMap = [];
        if (typeof buildConfigMap === 'function') {
            configMap = buildConfigMap(
                well,
                (id) =>
                    typeof getStudnieProductById === 'function'
                        ? getStudnieProductById(id)
                        : studnieProducts.find((pr) => pr.id === id),
                true
            );
        }

        well.przejscia.forEach((item) => {
            const p =
                typeof getStudnieProductById === 'function'
                    ? getStudnieProductById(item.productId)
                    : studnieProducts.find((pr) => pr.id === item.productId);
            if (!p) return;

            // Host przejścia (dennica/styczna vs krag/...) wg rzędnej — od niego
            // zależy rabat (dennica) i kubełek cenowy (priceDennica/priceNadbudowa).
            let hostType = null;
            if (configMap.length > 0 && typeof findAssignedElement === 'function') {
                let pelHost = parseFloat(item.rzednaWlaczenia);
                if (isNaN(pelHost)) pelHost = rzDnaGlob;
                const assignedHost = findAssignedElement((pelHost - rzDnaGlob) * 1000, configMap);
                if (assignedHost && assignedHost.entry) hostType = assignedHost.entry.componentType;
            }
            const isDennicaHost = hostType === 'dennica' || hostType === 'styczna';
            const mult = 1 - getTransitionHostPct(well, disc, hostType) / 100;

            let drillingBasePrice = 0;
            const isInsitu = p.name && p.name.toUpperCase().includes('INSITU');

            if (!isInsitu && configMap.length > 0) {
                const rzDna = parseFloat(well.rzednaDna) || 0;
                let pel = parseFloat(item.rzednaWlaczenia);
                if (isNaN(pel)) pel = rzDna;
                const mmFromBottom = (pel - rzDna) * 1000;

                if (typeof findAssignedElement === 'function') {
                    const assigned = findAssignedElement(mmFromBottom, configMap);
                    if (
                        assigned &&
                        assigned.entry &&
                        (assigned.entry.componentType === 'krag' ||
                            assigned.entry.componentType === 'krag_ot')
                    ) {
                        const trDn = parseInt(item.dn) || parseInt(p.dn) || 0;
                        if (trDn > 0) {
                            const drillingProducts = _getDrillingProducts();
                            /** @type {{ price?: number } | null} */
                            let bestDrill = null;
                            let bestDnDiff = Infinity;

                            drillingProducts.forEach((drill) => {
                                let drillDn = parseInt(drill.dn);
                                if (isNaN(drillDn)) {
                                    const match = drill.id.match(/Wiercenie-(\d+)/i);
                                    if (match) drillDn = parseInt(match[1]);
                                }
                                if (!isNaN(drillDn) && drillDn >= trDn) {
                                    if (drillDn - trDn < bestDnDiff) {
                                        bestDnDiff = drillDn - trDn;
                                        bestDrill = drill;
                                    }
                                }
                            });

                            if (bestDrill) {
                                drillingBasePrice = bestDrill.price || 0;
                            }
                        }
                    }
                }
            }

            let bP, dP;
            if (
                item.frozenPrice != null &&
                typeof isFrozenPriceCtx === 'function' &&
                isFrozenPriceCtx()
            ) {
                dP = item.frozenPrice;
                bP = item.frozenPriceBase != null ? item.frozenPriceBase : item.frozenPrice;
            } else {
                bP = (p.price || 0) + drillingBasePrice;
                dP = bP * mult;
            }

            priceBase += bP;
            if (isDennicaHost) {
                priceDennicaBase += bP;
            } else {
                priceNadbudowaBase += bP;
            }

            price += dP;
            if (isDennicaHost) {
                priceDennica += dP;
            } else {
                priceNadbudowa += dP;
            }

            if (item.doplata) {
                price += item.doplata;
                if (isDennicaHost) {
                    priceDennica += item.doplata;
                } else {
                    priceNadbudowa += item.doplata;
                }
            }

            weight += p.weight || 0;
        });
    }

    let malowanieZewTotal = 0;
    if (well.malowanieZ === 'zewnatrz' && well.malowanieZewCena) {
        malowanieZewTotal = areaExt * well.malowanieZewCena;
    }

    let hasError = false;
    let errorMessage = null;

    if (well.kineta === 'preco' || well.kineta === 'precotop') {
        // Faza 2, #4: w podglądzie (detekcja/tabela) katalogowa suma z mrożenia —
        // zmiana cennika PRECO po utworzeniu zamówienia nie flaguje studni.
        // Rabat preco celowo live (edycja rabatu to realna zmiana ceny).
        const frozenCtx = typeof isFrozenPriceCtx === 'function' && isFrozenPriceCtx();
        const frozenSuma = frozenCtx && well.frozenPrecoSuma != null ? well.frozenPrecoSuma : null;
        const precoResult = frozenSuma !== null ? { suma: frozenSuma } : calcPrecoPricing(well);
        if (precoResult.error) {
            hasError = true;
            errorMessage = precoResult.error;
        } else {
            const discountKey = well.dn === 'styczna' ? 'styczne' : well.dn;
            const activeDiscounts = getWellActiveDiscounts(well);
            const discPreco = readDiscountPct(activeDiscounts[discountKey] || {}, 'preco');
            const precoMult = 1 - discPreco / 100;
            const precoCost = precoResult.suma * precoMult;
            price += precoCost;
            priceDennica += precoCost;
            priceBase += precoResult.suma;
            priceDennicaBase += precoResult.suma;
        }
    }

    if (well.doplata) {
        price += well.doplata;
        priceDennica += well.doplata;
    }

    return {
        price: hasError ? 0 : price,
        priceBase: hasError ? 0 : priceBase,
        priceDennica: hasError ? 0 : priceDennica,
        priceDennicaBase: hasError ? 0 : priceDennicaBase,
        priceNadbudowa: hasError ? 0 : priceNadbudowa,
        priceNadbudowaBase: hasError ? 0 : priceNadbudowaBase,
        weight: Math.max(0, weight),
        height,
        areaInt,
        areaExt,
        malowanieZewTotal,
        error: errorMessage
    };
}

/* ===== SAFE-WRAPPERY RENDERU (corrupt stored → fallback 0% + flaga) ===== */
// Getter/kalkulator powyżej MUSZĄ rzucać (kontrakt E2). Render woła tylko
// wrappery stąd: fallback bez rabatu + logger.warn + well._discountCorrupt.
function _warnDiscountCorrupt(where, err, extra) {
    const msg =
        '[discount-corrupt] ' +
        where +
        ': fallback 0% (' +
        String((err && err.message) || err) +
        ')' +
        (extra ? ' ' + extra : '');
    try {
        if (typeof logger !== 'undefined' && logger && typeof logger.warn === 'function') {
            logger.warn('pricing', msg);
            return;
        }
    } catch (_e) {}
    try {
        if (
            typeof window !== 'undefined' &&
            window.logger &&
            typeof window.logger.warn === 'function'
        ) {
            window.logger.warn('pricing', msg);
            return;
        }
    } catch (_e2) {}
    try {
        if (typeof console !== 'undefined' && console.warn) console.warn(msg);
    } catch (_e3) {}
}

function markWellDiscountCorrupt(well) {
    try {
        if (well && typeof well === 'object') well._discountCorrupt = true;
    } catch (_e) {}
}

function clearWellDiscountCorrupt(well) {
    try {
        if (well && typeof well === 'object') well._discountCorrupt = false;
    } catch (_e) {}
}

function isWellDiscountCorrupt(well) {
    try {
        return !!(well && well._discountCorrupt);
    } catch (_e) {
        return false;
    }
}

// Badge błędu rabatu — wygląd jak getDiscountStr, kolor danger (nie cichy).
function discountCorruptBadge() {
    return ' <span style="font-size: var(--fs-2xs); color:var(--danger); margin-left:0.3rem;" title="Nieprawidłowy zapis rabatu (legacy/draft) — cena bez rabatu">(⚠ rabat)</span>';
}

function getWellDiscountPctSafe(well, p, disc) {
    try {
        return getWellDiscountPct(well, p, disc);
    } catch (e) {
        if (!(e instanceof RangeError)) throw e;
        _warnDiscountCorrupt('getWellDiscountPct', e, 'dn=' + ((well && well.dn) || '?'));
        markWellDiscountCorrupt(well);
        return 0;
    }
}

function getWellNadbudowaPctSafe(well, disc) {
    try {
        return getWellNadbudowaPct(well, disc);
    } catch (e) {
        if (!(e instanceof RangeError)) throw e;
        _warnDiscountCorrupt('getWellNadbudowaPct', e, 'dn=' + ((well && well.dn) || '?'));
        markWellDiscountCorrupt(well);
        return 0;
    }
}

function getTransitionHostPctSafe(well, disc, hostType) {
    try {
        return getTransitionHostPct(well, disc, hostType);
    } catch (e) {
        if (!(e instanceof RangeError)) throw e;
        _warnDiscountCorrupt(
            'getTransitionHostPct',
            e,
            'dn=' + ((well && well.dn) || '?') + ' host=' + String(hostType)
        );
        markWellDiscountCorrupt(well);
        return 0;
    }
}

// Bezpośrednie odczyty (disc.preco || 0) omijają assert — sanituj: invalid → 0 + flaga.
function safePrecoPct(well, disc) {
    try {
        const v = disc ? disc.preco : 0;
        if (typeof v !== 'number' || !Number.isFinite(v) || v < 0 || v > 100)
            throw new RangeError('Invalid discountPct preco: ' + String(v));
        return v;
    } catch (e) {
        if (!(e instanceof RangeError)) throw e;
        _warnDiscountCorrupt('preco', e, 'dn=' + ((well && well.dn) || '?'));
        markWellDiscountCorrupt(well);
        return 0;
    }
}

function getItemAssessedPriceSafe(well, p, applyDiscount, item) {
    try {
        return getItemAssessedPrice(well, p, applyDiscount, item);
    } catch (e) {
        if (!(e instanceof RangeError)) throw e;
        _warnDiscountCorrupt(
            'getItemAssessedPrice',
            e,
            'dn=' + ((well && well.dn) || '?') + ' prod=' + ((p && p.id) || '?')
        );
        markWellDiscountCorrupt(well);
        try {
            return getItemAssessedPrice(well, p, false, item);
        } catch (_e2) {
            return (p && p.price) || 0;
        }
    }
}

function getItemPriceBreakdownSafe(well, p, applyDiscount, item) {
    try {
        return getItemPriceBreakdown(well, p, applyDiscount, item);
    } catch (e) {
        if (!(e instanceof RangeError)) throw e;
        _warnDiscountCorrupt(
            'getItemPriceBreakdown',
            e,
            'dn=' + ((well && well.dn) || '?') + ' prod=' + ((p && p.id) || '?')
        );
        markWellDiscountCorrupt(well);
        return null;
    }
}

function _sanitizeDisc(disc) {
    const clean = {};
    try {
        for (const k of Object.keys(disc || {})) {
            const v = disc[k];
            clean[k] = typeof v === 'number' && Number.isFinite(v) && v >= 0 && v <= 100 ? v : 0;
        }
    } catch (_e) {}
    return clean;
}

// PRECO error-state: calcWellStats zwraca price:0 + error (nie throw —
// kontrakt throw E2 dotyczy tylko getterow rabatu). Callery biorace .price
// bez checka sumowaly ciche 0 do totalu; ten helper + badge jawnie oznacza
// studnie z bledem w UI. Uzywaja: pricingCalculator, offerDiscountsPopup,
// offerTransport, offerSummaryTable.
function isWellPricingError(well, stats) {
    try {
        if (stats && stats.error) return true;
        if (well && well._pricingError) return true;
        return false;
    } catch (_e) {
        return false;
    }
}

function markWellPricingError(well, msg) {
    try {
        if (well && typeof well === 'object') well._pricingError = msg || true;
    } catch (_e) {}
}

function clearWellPricingError(well) {
    try {
        if (well && typeof well === 'object') well._pricingError = false;
    } catch (_e) {}
}

// Badge bledu ceny — wyglad jak discountCorruptBadge, kolor danger (nie cichy).
function pricingErrorBadge(msg) {
    const title = 'Błąd wyceny (PRECO): ' + String((msg && (msg.error || msg)) || 'brak ceny');
    let safe = title;
    try {
        safe =
            typeof escapeHtmlAttr === 'function'
                ? escapeHtmlAttr(title)
                : String(title).replace(/"/g, '&quot;');
    } catch (_e) {}
    return (
        ' <span style="font-size: var(--fs-2xs); color:var(--danger); margin-left:0.3rem;" title="' +
        safe +
        '">(⚠ cena)</span>'
    );
}

function _emptyWellStats(discountError) {
    return {
        price: 0,
        priceBase: 0,
        priceDennica: 0,
        priceDennicaBase: 0,
        priceNadbudowa: 0,
        priceNadbudowaBase: 0,
        weight: 0,
        height: 0,
        areaInt: 0,
        areaExt: 0,
        malowanieZewTotal: 0,
        error: null,
        discountError: !!discountError
    };
}

// Renderowy kalkulator: corrupt → retry na sanitowanych rabatach (cena 0%),
// wynik oznaczony discountError:true + well._discountCorrupt.
function safeCalcWellStats(well) {
    try {
        const s = calcWellStats(well);
        if (isWellDiscountCorrupt(well)) s.discountError = true;
        else clearWellDiscountCorrupt(well);
        if (s && s.error) markWellPricingError(well, s.error);
        else clearWellPricingError(well);
        return s;
    } catch (e) {
        if (!(e instanceof RangeError)) throw e;
        _warnDiscountCorrupt('calcWellStats', e, 'dn=' + ((well && well.dn) || '?'));
        markWellDiscountCorrupt(well);
        try {
            const dk = well && (well.dn === 'styczna' ? 'styczne' : well.dn);
            let saved;
            let had = false;
            const g =
                typeof wellDiscounts !== 'undefined'
                    ? wellDiscounts
                    : typeof window !== 'undefined'
                      ? window.wellDiscounts
                      : undefined;
            if (g && dk && g[dk]) {
                saved = g[dk];
                had = true;
                g[dk] = _sanitizeDisc(saved);
            }
            try {
                const s2 = calcWellStats(well);
                s2.discountError = true;
                return s2;
            } finally {
                if (had) g[dk] = saved;
            }
        } catch (e2) {
            _warnDiscountCorrupt('calcWellStats-fallback', e2, '');
            const f = _emptyWellStats(true);
            f.error = 'Błąd rabatu — cena bez rabatu';
            return f;
        }
    }
}

window.getItemPriceBreakdown = getItemPriceBreakdown;
window.getWellDiscountPct = getWellDiscountPct;
window.getWellNadbudowaPct = getWellNadbudowaPct;
window.getTransitionHostPct = getTransitionHostPct;
window.getWellDiscountPctSafe = getWellDiscountPctSafe;
window.getWellNadbudowaPctSafe = getWellNadbudowaPctSafe;
window.getTransitionHostPctSafe = getTransitionHostPctSafe;
window.safePrecoPct = safePrecoPct;
window.getItemAssessedPriceSafe = getItemAssessedPriceSafe;
window.getItemPriceBreakdownSafe = getItemPriceBreakdownSafe;
window.isWellPricingError = isWellPricingError;
window.markWellPricingError = markWellPricingError;
window.clearWellPricingError = clearWellPricingError;
window.pricingErrorBadge = pricingErrorBadge;
window.safeCalcWellStats = safeCalcWellStats;
window.isWellDiscountCorrupt = isWellDiscountCorrupt;
window.discountCorruptBadge = discountCorruptBadge;

/* ===== Rejestracja globali ===== */
window.calcWellStats = calcWellStats;
