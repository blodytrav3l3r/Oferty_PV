// @ts-check
/**
 * diagramPreco.js — Linia wysokości wkładki PRECO na diagramie SVG studni.
 *
 * Wyodrębnione z wellDiagram.js (faza 2 refaktoryzacji).
 *
 * Zawiera:
 *   calculatePrecoInsertHeight()    — oblicza wysokość wkładki PRECO (mm od dna)
 *   buildTransitionRanges()         — buduje zakresy pionowe przejść
 *   mergeOverlappingRanges()        — scala nachodzące zakresy (interval merging)
 *   drawPrecoInsertLine()           — rysuje przerywaną czerwoną linię PRECO
 *
 * Zależności globalne:
 *   SVG_COLORS (diagramTheme.js)
 *   studnieProducts
 */

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

/**
 * Rysuje przerywaną czerwoną linię na schemacie SVG wskazującą
 * górną granicę wkładki PRECO. Włączenia poniżej tej linii
 * są realizowane w wkładce, powyżej — w ścianie studni.
 */
function drawPrecoInsertLine(well, canvas) {
    if (well.kineta !== 'preco' && well.kineta !== 'precotop' && well.wkladkaOsadnikPreco !== 'tak')
        return '';

    let insertHeightMm = null;
    let kinetaLabel = '';

    if (well.wkladkaOsadnikPreco === 'tak') {
        insertHeightMm = parseFloat(well.wkladkaOsadnikH) || null;
        kinetaLabel = 'Wkładka osadnika';
    } else {
        insertHeightMm = calculatePrecoInsertHeight(well);
        kinetaLabel = well.kineta === 'precotop' ? 'PrecoTop' : 'Preco';
    }

    if (!insertHeightMm || insertHeightMm <= 0) return '';

    const { pxMm, mT, drawH, cx, bodyDN } = canvas;
    const numericBodyDN = typeof bodyDN === 'number' ? bodyDN : 1000;
    const rightEdge = cx + (numericBodyDN * pxMm) / 2;
    const leftEdge = cx - (numericBodyDN * pxMm) / 2;
    const xStart = leftEdge - 5;
    const xEnd = rightEdge;
    let svg = '';

    const lineY = mT + drawH - insertHeightMm * pxMm;
    // Sprawdź czy linia mieści się w obszarze diagramu
    if (lineY >= mT && lineY <= mT + drawH) {
        // Przerywana czerwona linia
        svg += `<line x1="${xStart}" y1="${lineY}" x2="${xEnd}" y2="${lineY}" stroke="${SVG_COLORS.precoDash}" stroke-width="1.5" stroke-dasharray="6,3" opacity="0.85"/>`;
        // Mały trójkąt / strzałka wskazująca na linię z lewej
        svg += `<polygon points="${xStart - 3},${lineY - 3} ${xStart - 3},${lineY + 3} ${xStart},${lineY}" fill="${SVG_COLORS.precoDash}" opacity="0.85"/>`;
        // Etykieta wewnątrz grafiki po prawej stronie
        svg += `<text x="${rightEdge - 4}" y="${lineY + 10}" text-anchor="end" fill="${SVG_COLORS.precoDash}" font-size="8" font-family="Inter,sans-serif" font-weight="700" opacity="0.9">▼ ${kinetaLabel}</text>`;
    }

    // Jeśli pełna wysokość dennicy jest włączona, narysuj drugą linię
    if (well.precoFullHeight === 'tak' || well.precoFullHeight === true) {
        let dennicaHeight = 0;
        if (well.config) {
            well.config.forEach((item) => {
                const p = studnieProducts.find((pr) => pr.id === item.productId);
                if (p && (p.componentType === 'dennica' || p.componentType === 'styczna')) {
                    dennicaHeight += (p.height || 0) * (item.quantity || 1);
                }
            });
        }

        if (dennicaHeight > insertHeightMm) {
            const lineYFull = mT + drawH - dennicaHeight * pxMm;
            if (lineYFull >= mT && lineYFull <= mT + drawH) {
                // Druga przerywana linia dla pełnej wysokości (pomarańczowa)
                svg += `<line x1="${xStart}" y1="${lineYFull}" x2="${xEnd}" y2="${lineYFull}" stroke="${SVG_COLORS.fillHeight}" stroke-width="1.5" stroke-dasharray="4,2" opacity="0.9"/>`;
                svg += `<polygon points="${xStart - 3},${lineYFull - 3} ${xStart - 3},${lineYFull + 3} ${xStart},${lineYFull}" fill="${SVG_COLORS.fillHeight}" opacity="0.9"/>`;
                svg += `<text x="${rightEdge - 4}" y="${lineYFull + 10}" text-anchor="end" fill="${SVG_COLORS.fillHeight}" font-size="8" font-family="Inter,sans-serif" font-weight="700" opacity="0.9">▼ Uzupełnienie do pełnej wysokości</text>`;
            }
        }
    }

    return svg;
}
