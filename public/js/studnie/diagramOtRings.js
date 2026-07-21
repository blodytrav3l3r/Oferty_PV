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

/**
 * ZASADA BEZWZGLĘDNA: Krąg z przejściem = ZAWSZE krąg wiercony.
 * Automatycznie zamienia zwykły krag na krag_ot w konfiguracji studni
 * jeśli w pozycji kręgu mieści się otwór przejścia.
 * Wywoływane PRZY KAŻDYM renderowaniu — dotyczy trybu auto I ręcznego.
 * NIE DO ZMIANY!
 */
function enforceOtRings() {
    const well = typeof getCurrentWell === 'function' ? getCurrentWell() : null;
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
        const p = studnieProducts.find((pr) => pr.id === item.productId);
        if (!p || !p.height) continue;
        const qty = item.quantity || 1;
        for (let i = 0; i < qty; i++) {
            let actualHeight = p.height || 0;
            if (p.componentType === 'dennica' && lastWasDennica) {
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
            lastWasDennica = p.componentType === 'dennica';
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
        return upgradeToOtRing(seg, currentProd, currentId);
    }
    if (!hasHole && isCurrentlyOt) {
        return degradeFromOtRing(seg, currentProd, currentId);
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
        const pprod = studnieProducts.find((x) => x.id === pr.productId);
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
 * Zamienia zwykły krąg na wiercony (OT) — szuka w katalogu lub tworzy dynamiczny.
 */
function upgradeToOtRing(seg, currentProd, currentId) {
    const otProd = studnieProducts.find(
        (p) =>
            p.componentType === 'krag_ot' &&
            p.dn === currentProd.dn &&
            p.height === currentProd.height
    );

    if (otProd) {
        if (seg.configItem.productId !== otProd.id) {
            seg.configItem.productId = otProd.id;
            logger.info(
                'wellDiagram',
                `[enforceOT] Zamiana ${currentId} → ${otProd.id} (krąg wiercony z katalogu)`
            );
            return true;
        }
        return false;
    }

    // Dynamiczny OT
    const dynamicOtId = currentId + '_OT';
    if (!studnieProducts.find((p) => p.id === dynamicOtId)) {
        const dynamicProd = structuredClone(currentProd);
        dynamicProd.id = dynamicOtId;
        dynamicProd.componentType = 'krag_ot';
        if (!dynamicProd.name.includes('wiercony')) {
            dynamicProd.name = dynamicProd.name.replace('Krąg', 'Krąg wiercony');
        }
        studnieProducts.push(dynamicProd);
    }
    if (seg.configItem.productId !== dynamicOtId) {
        seg.configItem.productId = dynamicOtId;
        logger.info(
            'wellDiagram',
            `[enforceOT] Zamiana ${currentId} → ${dynamicOtId} (dynamiczny OT)`
        );
        return true;
    }
    return false;
}

/**
 * Degradacja kręgu wierconego (OT) na zwykły — gdy nie ma przejścia.
 */
function degradeFromOtRing(seg, currentProd, currentId) {
    // Najbezpieczniejsza degradacja: znajdź zwykły krąg o tym samym wymiarze
    const stdProd = studnieProducts.find(
        (p) =>
            p.componentType === 'krag' && p.dn === currentProd.dn && p.height === currentProd.height
    );

    if (stdProd) {
        if (seg.configItem.productId !== stdProd.id) {
            seg.configItem.productId = stdProd.id;
            logger.info(
                'wellDiagram',
                `[enforceOT] Zamiana ${currentId} → ${stdProd.id} (powrót do kręgu)`
            );
            return true;
        }
        return false;
    }

    // Fallback jeśli krąg nie jest standardowy, spróbujmy odciąć _OT
    const baseStripped = currentId.replace(/[_-]OT$/i, '');
    const baseProduct = studnieProducts.find((p) => p.id === baseStripped);
    if (baseProduct && seg.configItem.productId !== baseProduct.id) {
        seg.configItem.productId = baseProduct.id;
        logger.info(
            'wellDiagram',
            `[enforceOT] Zamiana ${currentId} → ${baseProduct.id} (dynamiczny powrót)`
        );
        return true;
    }
    // BARDZO WAŻNE: Jeśli nie znaleziono bazy, NIE nadpisujemy na nieistniejące ID,
    // by zapobiec ucięciu z renderowania ('nie usuwa ich')
    return false;
}
