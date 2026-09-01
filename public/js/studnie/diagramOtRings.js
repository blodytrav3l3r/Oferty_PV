// @ts-check
/**
 * diagramOtRings.js — Automatyczne egzekwowanie kręgów wierconych (OT).
 *
 * Wyodrębnione z wellDiagram.js (faza 2 refaktoryzacji).
 *
 * Zawiera:
 *   enforceOtRings()         — główna reguła: krąg z przejściem = krąg wiercony
 *   enforceOtForSegment()    — sprawdza i wymusza zamianę dla jednego segmentu
 *   checkSegmentHasHole()    — sprawdza czy w segmencie jest otwór przejścia
 *   upgradeToOtRing()        — zamienia zwykły krąg na wiercony
 *   degradeFromOtRing()      — odwrotność: przywraca zwykły krąg
 *
 * Zależności globalne:
 *   SVG_COLORS (diagramTheme.js)
 *   getCurrentWell, studnieProducts, logger
 */

// MIN_OT_HEIGHT z globals.js (500mm)

/**
 * ZASADA: Krąg z przejściem = krąg wiercony TYLKO gdy OT H>=500 i istnieje w cenniku.
 * Produkty OT tworzy wyłącznie użytkownik w Cenniku — brak auto-tworzenia.
 * Jeśli brak OT w katalogu, config zostaje plain + WARNING.
 */
function enforceOtRings(targetWell) {
    const well =
        targetWell && typeof targetWell === 'object' && targetWell.config
            ? targetWell
            : typeof getCurrentWell === 'function'
              ? getCurrentWell()
              : null;
    if (!well || !well.config) return false;

    const rzDna = well.rzednaDna != null ? parseFloat(well.rzednaDna) : null;
    if (rzDna === null || isNaN(rzDna)) return false;

    // Zbuduj segmenty z config (bottom-up)
    const segments = [];
    let cy = 0;

    let mutated = false;

    // Config jest od góry (właz) do dołu (dennica) — iteruj od końca
    const configReversed = [...well.config].reverse();
    let lastWasDennica = !!well.psiaBuda;
    for (const item of configReversed) {
        const p =
            typeof getStudnieProductById === 'function'
                ? getStudnieProductById(item.productId)
                : studnieProducts.find((pr) => pr.id === item.productId);
        if (!p || !p.height) continue;
        const qty = item.quantity || 1;
        const isDennicaLike = p.componentType === 'dennica' || p.componentType === 'styczna';
        for (let i = 0; i < qty; i++) {
            let actualHeight = p.height || 0;
            if (isDennicaLike && lastWasDennica) {
                actualHeight -= 100;
            }

            segments.push({
                type: p.componentType,
                start: cy,
                end: cy + actualHeight,
                configItem: item,
                product: p
            });
            cy += actualHeight;
            lastWasDennica = isDennicaLike;
        }
    }

    // Iterujemy po segmentach by sprawdzić czy mają otwór
    for (const seg of segments) {
        if (seg.type !== 'krag' && seg.type !== 'krag_ot') continue;
        mutated = enforceOtForSegment(seg, well, rzDna) || mutated;
    }
    return mutated;
}

/**
 * Sprawdza i wymusza zamianę kręgu na wiercony (lub odwrotnie) dla jednego segmentu.
 * Wydzielone z enforceOtRings aby zmniejszyć zagnieżdżenia.
 */
function enforceOtForSegment(seg, well, rzDna) {
    const currentProd = seg.product;
    const currentId = seg.configItem.productId;

    const hasHole = checkSegmentHasHole(seg, well, rzDna);

    const isCurrentlyOt =
        currentProd.componentType === 'krag_ot' ||
        currentId.endsWith('_OT') ||
        currentId.toLowerCase().includes('-ot');

    if (hasHole && !isCurrentlyOt) {
        return upgradeToOtRing(seg, currentProd, currentId, well);
    }
    if (!hasHole && isCurrentlyOt) {
        return degradeFromOtRing(seg, currentProd, currentId, well);
    }
    return false;
}

/**
 * Sprawdza czy w danym segmencie kręgu znajduje się otwór przejścia.
 */
function checkSegmentHasHole(seg, well, rzDna) {
    if (!well.przejscia || well.przejscia.length === 0) return false;

    for (const pr of well.przejscia) {
        const pel = parseFloat(pr.rzednaWlaczenia);
        if (isNaN(pel)) continue;

        const mmFromBottom = (pel - rzDna) * 1000;
        const pprod =
            typeof getStudnieProductById === 'function'
                ? getStudnieProductById(pr.productId)
                : studnieProducts.find((x) => x.id === pr.productId);
        if (!pprod) continue;

        let prDN = 160;
        if (pprod.dn && typeof pprod.dn === 'string' && pprod.dn.includes('/')) {
            prDN = parseFloat(pprod.dn.split('/')[1]) || 160;
        } else if (pprod.dn) {
            prDN = parseFloat(pprod.dn) || 160;
        }

        const holeCenter = mmFromBottom + prDN / 2;
        if (holeCenter >= seg.start && holeCenter < seg.end) {
            return true;
        }
    }
    return false;
}

/**
 * Pomocnik bezpiecznej zmiany productId dla segmentu — wyodrębnia 1 sztukę gdy quantity > 1.
 */
function _applyProductIdToSeg(seg, targetProductId, well) {
    if (!seg || !seg.configItem) return false;
    if (seg.configItem.productId === targetProductId) return false;

    const qty = seg.configItem.quantity || 1;
    if (qty > 1) {
        seg.configItem.quantity = qty - 1;
        const newItem = {
            productId: targetProductId,
            quantity: 1,
            autoAdded: !!seg.configItem.autoAdded
        };
        if (well && Array.isArray(well.config)) {
            const idx = well.config.indexOf(seg.configItem);
            if (idx >= 0) {
                well.config.splice(idx + 1, 0, newItem);
            } else {
                well.config.push(newItem);
            }
        }
        seg.configItem = newItem;
    } else {
        seg.configItem.productId = targetProductId;
    }
    return true;
}

/**
 * Zamienia zwykły krąg na wiercony (OT) — szuka w katalogu, NIE tworzy dynamicznie.
 * OT może utworzyć tylko użytkownik w Cenniku; min H = 500.
 */
function upgradeToOtRing(seg, currentProd, currentId, well) {
    const minH = typeof MIN_OT_HEIGHT !== 'undefined' ? MIN_OT_HEIGHT : 500;
    const h = parseInt(currentProd.height) || 0;
    if (h > 0 && h < minH) return false;
    const otProd = studnieProducts.find(
        (p) =>
            p.componentType === 'krag_ot' &&
            String(p.dn) === String(currentProd.dn) &&
            parseInt(p.height) === parseInt(currentProd.height)
    );
    if (!otProd) {
        if (well) {
            well.configStatus = well.configStatus === 'ERROR' ? 'ERROR' : 'WARNING';
            const msg = `Brak kręgu wierconego DN${currentProd.dn} H=${h} w cenniku — dodaj go ręcznie w Cenniku studni`;
            if (!well.configErrors) well.configErrors = [];
            if (!well.configErrors.includes(msg)) well.configErrors.push(msg);
        }
        return false;
    }
    const targetId = otProd.id;
    const changed = _applyProductIdToSeg(seg, targetId, well);
    if (changed) {
        logger.info(
            'wellDiagram',
            `[enforceOT] Zamiana ${currentId} → ${targetId} (krąg wiercony)`
        );
    }
    return changed;
}

/**
 * Degradacja kręgu wierconego (OT) na zwykły — gdy nie ma przejścia.
 */
function degradeFromOtRing(seg, currentProd, currentId, well) {
    // Najbezpieczniejsza degradacja: znajdź zwykły krąg o tym samym wymiarze ( String/parseInt dla każdej średnicy/wysokości )
    const stdProd = studnieProducts.find(
        (p) =>
            p.componentType === 'krag' &&
            String(p.dn) === String(currentProd.dn) &&
            parseInt(p.height) === parseInt(currentProd.height)
    );

    let targetId = null;
    if (stdProd) {
        targetId = stdProd.id;
    } else {
        const baseStripped = currentId.replace(/[_-]OT$/i, '');
        const baseProduct =
            typeof getStudnieProductById === 'function'
                ? getStudnieProductById(baseStripped)
                : studnieProducts.find((p) => p.id === baseStripped);
        if (baseProduct) {
            targetId = baseProduct.id;
        }
    }

    if (targetId) {
        const changed = _applyProductIdToSeg(seg, targetId, well);
        if (changed) {
            logger.info(
                'wellDiagram',
                `[enforceOT] Zamiana ${currentId} → ${targetId} (powrót do kręgu)`
            );
        }
        return changed;
    }
    return false;
}

/* ===== Rejestracja globali ===== */
if (typeof window !== 'undefined') {
    window.enforceOtRings = enforceOtRings;
}
