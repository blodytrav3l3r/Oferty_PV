/* ===== STATYSTYKI STUDNI — CENY ===== */

function getWellActiveDiscounts(well) {
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

function getItemAssessedPrice(well, p, applyDiscount = true, item = null) {
    let itemPrice = p.price || 0;

    let discountPct = 0;
    if (applyDiscount && well.dn) {
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
