// @ts-check
/* ===== WELL DIAGRAM — SVG events i OT ringi ===== */
window.highlightSvg = function (type, index) {
    document.querySelectorAll('.svg-' + type + '-' + index).forEach((el) => {
        el.style.filter = 'drop-shadow(0px 0px 8px rgba(96, 165, 250, 0.9)) brightness(1.3)';
    });

    // Automatycznie podświetl odpowiedni kafel listy
    if (type === 'cfg') {
        const tile = document.querySelector('.config-tile[data-cfg-idx="' + index + '"]');
        if (tile) tile.style.filter = 'brightness(1.1)';
    } else if (type === 'prz') {
        const tile = document.querySelector('div[data-prz-idx="' + index + '"]');
        if (tile) tile.style.filter = 'brightness(1.1)';
    }
};
window.unhighlightSvg = function (type, index) {
    document.querySelectorAll('.svg-' + type + '-' + index).forEach((el) => {
        el.style.filter = '';
    });

    if (type === 'cfg') {
        const tile = document.querySelector('.config-tile[data-cfg-idx="' + index + '"]');
        if (tile) tile.style.filter = 'brightness(1)';
    } else if (type === 'prz') {
        const tile = document.querySelector('div[data-prz-idx="' + index + '"]');
        if (tile) tile.style.filter = 'brightness(1)';
    }
};

window.svgPointerEnter = function (ev, idx) {
    if (window.svgDragStartIndex >= 0) return; // blokowanie hovera w trkacie ciągnięcia
    window.highlightSvg('cfg', idx);
};

window.svgPointerLeave = function (ev, idx) {
    window.unhighlightSvg('cfg', idx);
};

window.svgPrzPointerEnter = function (ev, idx) {
    if (window.svgDragStartIndex >= 0) return;
    window.highlightSvg('prz', idx);
};

window.svgPrzPointerLeave = function (ev, idx) {
    window.unhighlightSvg('prz', idx);
};

/* ===== SCHEMAT STUDNI (SVG) ===== */

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

/* ===== LINIA WYSOKOŚCI WKŁADKI PRECO ===== */

/**
 * Oblicza wysokość wkładki PRECO (mm od dna studni).
 * Algorytm: merge overlapping intervals — scal nachodzące zakresy przejść
 * i zwróć górną krawędź dolnej grupy. Przejścia powyżej (rozdzielone)
 * są realizowane w ścianie, nie w wkładce.
 */
function calculatePrecoInsertHeight(well) {
    if (!well.przejscia || well.przejscia.length === 0) return null;

    const rzDna = parseFloat(well.rzednaDna);
    if (isNaN(rzDna)) return null;

    // 1. Zbierz zakresy pionowe [bottom, top] dla każdego przejścia
    const ranges = buildTransitionRanges(well.przejscia, rzDna);
    if (ranges.length === 0) return null;

    // 2. Scal nachodzące zakresy i zwróć top dolnej grupy
    const mergedGroups = mergeOverlappingRanges(ranges);
    return mergedGroups[0].top;
}

/**
 * Buduje tablicę zakresów pionowych { bottom, top } (mm od dna)
 * dla każdego przejścia z niepustym DN.
 */
function buildTransitionRanges(przejscia, rzDna) {
    return przejscia
        .map((p) => {
            const prod = studnieProducts.find((pr) => pr.id === p.productId);
            let dnRury = parseInt(p.dn) || 0;
            if (!dnRury && prod) dnRury = parseInt(prod.dn) || 0;
            if (dnRury <= 0) return null;

            const rzWlaczenia = parseFloat(p.rzednaWlaczenia) || rzDna;
            const mmFromBottom = (rzWlaczenia - rzDna) * 1000;
            return { bottom: mmFromBottom, top: mmFromBottom + dnRury };
        })
        .filter(Boolean);
}

/**
 * Scala nachodzące zakresy (interval merging).
 * Sortuje po bottom rosnąco, łączy gdy next.bottom < current.top (strict <).
 * Zwraca tablicę scalonych grup [{ bottom, top }, ...] od najniższej.
 */
function mergeOverlappingRanges(ranges) {
    const sorted = [...ranges].sort((a, b) => a.bottom - b.bottom);

    const merged = [{ ...sorted[0] }];
    for (let i = 1; i < sorted.length; i++) {
        const current = merged[merged.length - 1];
        const next = sorted[i];

        if (next.bottom < current.top) {
            current.top = Math.max(current.top, next.top);
        } else {
            merged.push({ ...next });
        }
    }

    return merged;
}
