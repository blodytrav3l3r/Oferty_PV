/* ===== STATYSTYKI STUDNI ===== */

function getWellActiveDiscounts(well) {
    let activeDiscounts = wellDiscounts;
    // Jeśli studnia jest w zamówieniu (Zablokowana), użyj rabatów z momentu utworzenia zamówienia (z migawki)
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

function getItemAssessedPrice(well, p, applyDiscount = true, item = null) {
    let itemPrice = p.price || 0;

    let discountPct = 0;
    if (applyDiscount && well.dn) {
        // Mapowanie dn na klucz rabatów (styczna -> styczne)
        const discountKey = well.dn === 'styczna' ? 'styczne' : well.dn;

        const activeDiscounts = getWellActiveDiscounts(well);
        const disc = activeDiscounts[discountKey] || { dennica: 0, nadbudowa: 0 };
        if (
            p.componentType === 'dennica' ||
            p.componentType === 'kineta' ||
            p.componentType === 'styczna'
        ) {
            discountPct = disc.dennica || 0;
        } else {
            discountPct = disc.nadbudowa || 0;
        }
    }
    const mult = 1 - discountPct / 100;

    if (p.componentType === 'kineta') {
        let dennicaHeight = 0;
        const dennicaItem = well.config.find((c) => {
            const pr = studnieProducts.find((x) => x.id === c.productId);
            return pr && pr.componentType === 'dennica';
        });
        if (dennicaItem) {
            dennicaHeight =
                studnieProducts.find((x) => x.id === dennicaItem.productId)?.height || 0;
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

        // Dodaj malowanie do kinety przed wczesnym wyjściem
        // Dynamiczna powierzchnia — obliczona z geometrii rur, kątów i spocznika
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
            // Legacy malowanie wewnątrz (fixed-price) — kineta
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

    // Wkładka PEHD
    let pehdType = null;
    if (['dennica', 'styczna'].includes(p.componentType)) {
        pehdType = well.wkladkaDennica;
    } else if (
        [
            'plyta',
            'plyta_redukcyjna',
            'plyta_nastudzienna',
            'stozek',
            'zwienczenie',
            'konus',
            'plyta_din',
            'plyta_najazdowa',
            'plyta_zamykajaca',
            'pierscien_odciazajacy'
        ].includes(p.componentType)
    ) {
        pehdType = well.wkladkaZwienczenie;
    } else if (['krag', 'krag_ot', 'rura'].includes(p.componentType)) {
        pehdType = well.wkladkaNadbudowa;
    }

    if (pehdType && pehdType !== 'brak' && p.doplataPEHD) {
        if (!item || !item.disablePehd) {
            let pehdSurcharge = parseFloat(p.doplataPEHD);
            if (applyDiscount && well.pehdDiscount) {
                pehdSurcharge *= 1 - well.pehdDiscount / 100;
            }
            itemPrice += pehdSurcharge;
        }
    }

    // Malowanie wewnątrz (z ceny za m2)
    if (well.malowanieW && well.malowanieW !== 'brak' && well.malowanieWewCena) {
        if (well.malowanieW === 'kineta_dennica' && p.componentType === 'dennica') {
            // Pominięte — calcKinetaPaintingArea() na kinecie już obejmuje
            // pełne wnętrze dennicy (dno + ścianki + korytka).
            // Dodanie p.area dennicy spowodowałoby podwójne liczenie.
        } else if (well.malowanieW === 'cale') {
            if (p.componentType === 'dennica' || p.componentType === 'styczna') {
                // Pominięte — j.w., kineta pokrywa wnętrze dennicy
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
        // Pominięte: dennica przy kineta_dennica i cale — kineta już obejmuje wnętrze dennicy
    }

    // Malowanie zewnątrz (z ceny za m2 i stara opcja)
    if (well.malowanieZ === 'zewnatrz' && well.malowanieZewCena) {
        itemPrice += (p.areaExt || 0) * well.malowanieZewCena;
    } else if (well.malowanieZ === 'zewnatrz' && p.malowanieZewnetrzne && !well.malowanieZewCena) {
        itemPrice += parseFloat(p.malowanieZewnetrzne);
    }

    // Żelbet (dopłata dla dennicy) - dodawana do ceny gdy dennicaMaterial === 'zelbetowa'
    if (
        (well.dennicaMaterial === 'zelbetowa' || well.material === 'zelbetowa') &&
        p.componentType === 'dennica' &&
        p.doplataZelbet
    ) {
        itemPrice += parseFloat(p.doplataZelbet);
    }

    // Drabinka nierdzewna (dla kręgów z otworami i dennic)
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
        if (
            p.componentType === 'dennica' ||
            p.componentType === 'kineta' ||
            p.componentType === 'styczna'
        ) {
            discountPct = disc.dennica || 0;
        } else {
            discountPct = disc.nadbudowa || 0;
        }
    }
    const mult = 1 - discountPct / 100;

    if (p.componentType === 'kineta') {
        let dennicaHeight = 0;
        const dennicaItem = well.config.find(function (c) {
            const pr = studnieProducts.find(function (x) {
                return x.id === c.productId;
            });
            return pr && pr.componentType === 'dennica';
        });
        if (dennicaItem) {
            const pPr = studnieProducts.find(function (x) {
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

    let pehdType = null;
    if (['dennica', 'styczna'].indexOf(p.componentType) !== -1) {
        pehdType = well.wkladkaDennica;
    } else if (
        [
            'plyta',
            'plyta_redukcyjna',
            'plyta_nastudzienna',
            'stozek',
            'zwienczenie',
            'konus',
            'plyta_din',
            'plyta_najazdowa',
            'plyta_zamykajaca',
            'pierscien_odciazajacy'
        ].indexOf(p.componentType) !== -1
    ) {
        pehdType = well.wkladkaZwienczenie;
    } else if (['krag', 'krag_ot', 'rura'].indexOf(p.componentType) !== -1) {
        pehdType = well.wkladkaNadbudowa;
    }

    if (pehdType && pehdType !== 'brak' && p.doplataPEHD) {
        if (!item || !item.disablePehd) {
            pehd = parseFloat(p.doplataPEHD);
            if (applyDiscount !== false && well.pehdDiscount) {
                pehd *= 1 - well.pehdDiscount / 100;
            }
        }
    }

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

    // Ceny bazowe (bez rabatu)
    let priceBase = 0,
        priceDennicaBase = 0,
        priceNadbudowaBase = 0;

    let lastWasDennica = !!well.psiaBuda;
    const configReversed = [...(well.config || [])].reverse();

    configReversed.forEach((item) => {
        // Rozwiąż poprawny wariant produktu wg parametrów studni (auto-korekta productId)
        const p =
            typeof resolveEffectiveProduct === 'function'
                ? resolveEffectiveProduct(well, item.productId, item)
                : studnieProducts.find((pr) => pr.id === item.productId);
        if (!p) return;

        // Ceny bazowe (bez rabatu)
        let itemPriceDisc, itemPriceBaseVal;
        const useFrozenPrice = item.frozenPrice != null && window.isPreviewMode;
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

        // Podział na dennicę i nadbudowę
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

        // Liczenie wysokości z uwzględnieniem dennic piętrowych (adjacency check)
        // Idziemy od dołu do góry, więc lastWasDennica oznacza dennicę PONIŻEJ
        for (let q = 0; q < item.quantity; q++) {
            let h = p.height || 0;
            if (p.componentType === 'dennica' && lastWasDennica) {
                h -= 100;
            }
            height += h;
            if (p.componentType !== 'uszczelka') {
                lastWasDennica = p.componentType === 'dennica';
            }
        }
    });

    if (well.przejscia) {
        let discNadbudowa = 0;
        // Mapowanie dn na klucz rabatów (styczna -> styczne)
        const discountKey = well.dn === 'styczna' ? 'styczne' : well.dn;
        const activeDiscounts = getWellActiveDiscounts(well);
        if (discountKey && activeDiscounts[discountKey]) {
            discNadbudowa = activeDiscounts[discountKey].nadbudowa || 0;
        }
        const mult = 1 - discNadbudowa / 100;

        // Budowa configMap do sprawdzania, czy przejście jest w kręgu
        let configMap = [];
        if (typeof buildConfigMap === 'function') {
            configMap = buildConfigMap(
                well,
                (id) => studnieProducts.find((pr) => pr.id === id),
                true
            );
        }

        well.przejscia.forEach((item) => {
            const p = studnieProducts.find((pr) => pr.id === item.productId);
            if (!p) return;

            // Wyliczanie opłaty za wiercenie, jeśli przejście znajduje się w kręgu
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
                            const drillingProducts = studnieProducts.filter(
                                (x) => x.category === 'Wiercenie'
                            );
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
                                drillingBasePrice = /** @type {any} */ (bestDrill).price || 0;
                            }
                        }
                    }
                }
            }

            // Użyj zamrożonej ceny tylko w podglądzie; w edycji przelicz na nowo
            let bP, dP;
            if (item.frozenPrice != null && window.isPreviewMode) {
                dP = item.frozenPrice;
                bP = item.frozenPriceBase != null ? item.frozenPriceBase : item.frozenPrice;
            } else {
                bP = (p.price || 0) + drillingBasePrice;
                dP = bP * mult;
            }

            priceBase += bP;
            priceNadbudowaBase += bP;

            price += dP;
            priceNadbudowa += dP;

            if (item.doplata) {
                price += item.doplata;
                priceNadbudowa += item.doplata;
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

    // Wycena PRECO — dodaj cenę kinety PRECO jeśli well.kineta === 'preco' lub 'precotop'
    if (well.kineta === 'preco' || well.kineta === 'precotop') {
        const precoResult = calcPrecoPricing(well);
        if (precoResult.error) {
            hasError = true;
            errorMessage = precoResult.error;
        } else {
            const discountKey = well.dn === 'styczna' ? 'styczne' : well.dn;
            const activeDiscounts = getWellActiveDiscounts(well);
            const discPreco = (activeDiscounts[discountKey] || {}).preco || 0;
            const precoMult = 1 - discPreco / 100;
            const precoCost = precoResult.suma * precoMult;
            price += precoCost;
            priceDennica += precoCost;
            priceBase += precoResult.suma;
            priceDennicaBase += precoResult.suma;
        }
    }

    // Dopłata wliczona do dennicy / studni stycznej — NIE podlega rabatowi
    // Nie dodajemy do priceBase/priceDennicaBase, aby nie zawyżać podstawy rabatu
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
        weight,
        height,
        areaInt,
        areaExt,
        malowanieZewTotal,
        error: errorMessage
    };
}

window.getItemPriceBreakdown = getItemPriceBreakdown;

if (typeof registerCspAction === 'function') {
    registerCspAction('resetWellParamsToDefaults', window.resetWellParamsToDefaults);
}

// switchSidebarTab() przeniesiona do wellUI.js
