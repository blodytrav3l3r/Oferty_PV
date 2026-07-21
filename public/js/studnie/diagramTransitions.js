// @ts-check
/**
 * diagramTransitions.js — Rysowanie przejść (rur) na schemacie SVG studni.
 *
 * Wyodrębnione z wellDiagram.js (faza 2 refaktoryzacji).
 *
 * Zawiera:
 *   drawTransitions()             — główna funkcja generująca SVG przejść
 *   parseTransitionGeometry()     — parsuje geometrię przejścia (wymiary, pozycja)
 *   drawTransitionShape()         — generuje kształt SVG (kółko/elipsa/prostokąt)
 *   drawTransitionLabel()         — etykieta kąta na przejściu
 *   drawTransitionGuideLine()     — linia pomocnicza od przejścia do osi wymiarowej
 *
 * Zależności globalne:
 *   SVG_COLORS (diagramTheme.js)
 *   studnieProducts
 */

/**
 * Generuje SVG przejść (rur) na schemacie studni.
 * Rury są rysowane jako kółka, elipsy lub prostokąty w zależności od typu.
 */
function drawTransitions(well, canvas, dimLinesY) {
    if (!well.przejscia || well.przejscia.length === 0 || well.rzednaDna === null) {
        return '';
    }

    const { pxMm, cx, mT, drawH, bodyDN, totalMm } = canvas;
    const mmToPx = (mm) => mm * pxMm;
    const bottomElev = parseFloat(well.rzednaDna) || 0;

    let svgOut = '';

    well.przejscia.forEach((pr, idx) => {
        const parsed = parseTransitionGeometry(pr, bottomElev);
        if (!parsed) return;

        const { mmFromBottom, prW, prH, isEgg, isRect, angle } = parsed;
        if (mmFromBottom <= -5000 || mmFromBottom >= totalMm + 5000) return;

        const radiusW = Math.max((prW / 2) * pxMm, 3);
        const radiusH = Math.max((prH / 2) * pxMm, 3);
        const prY = mT + drawH - mmFromBottom * pxMm - radiusH;

        dimLinesY.push(prY - radiusH);
        dimLinesY.push(prY + radiusH);

        // Oblicz offset X na podstawie kąta włączenia
        const numericBodyDN = typeof bodyDN === 'number' ? bodyDN : 1000;
        const bw = mmToPx(numericBodyDN);
        const offset = Math.sin((angle * Math.PI) / 180) * (bw / 2 - radiusW);
        const px = cx + offset;

        const isBack = angle > 90 && angle < 270;

        svgOut += drawTransitionShape(idx, px, prY, radiusW, radiusH, isRect, isEgg, isBack);
        svgOut += drawTransitionLabel(px, prY, angle, isBack);
        svgOut += drawTransitionGuideLine(px, prY, radiusW, isBack);
    });

    return svgOut;
}

/**
 * Parsuje geometrię przejścia — zwraca wymiary rury i pozycję.
 */
function parseTransitionGeometry(pr, bottomElev) {
    const angle = parseFloat(pr.katWlaczenia) || 0;
    let pel = parseFloat(pr.rzednaWlaczenia);
    if (isNaN(pel)) pel = 0;

    const pprod = studnieProducts.find((x) => x.id === pr.productId);
    let prW = 160,
        prH = 160,
        isEgg = false,
        isRect = false;

    if (pprod && pprod.category === 'Otwór KPED') {
        prW = 1020;
        prH = 500;
        isRect = true;
    } else if (pprod && typeof pprod.dn === 'string' && pprod.dn.includes('/')) {
        const parts = pprod.dn.split('/');
        prW = parseFloat(parts[0]) || 160;
        prH = parseFloat(parts[1]) || prW;
        isEgg = true;
    } else if (pprod) {
        prW = parseFloat(pprod.dn) || 160;
        prH = prW;
    }

    const mmFromBottom = (pel - bottomElev) * 1000;
    return { mmFromBottom, prW, prH, isEgg, isRect, angle };
}

/**
 * Generuje kształt SVG przejścia (kółko / elipsa / prostokąt).
 */
function drawTransitionShape(idx, px, prY, radiusW, radiusH, isRect, isEgg, isBack) {
    const pColor = isBack ? SVG_COLORS.transitionBack : SVG_COLORS.transitionActive;
    const sColor = isBack ? SVG_COLORS.transitionBackStroke : SVG_COLORS.transitionStroke;
    const sDash = isBack ? 'stroke-dasharray="2,2"' : '';

    const gOpen = `<g class="svg-prz-${idx}" style="transition:all 0.2s;" onmouseenter="window.svgPrzPointerEnter(event, ${idx})" onmouseleave="window.svgPrzPointerLeave(event, ${idx})">`;
    const gClose = '</g>';

    if (isRect) {
        return `${gOpen}<rect x="${px - radiusW}" y="${prY - radiusH}" width="${radiusW * 2}" height="${radiusH * 2}" fill="${pColor}" stroke="${sColor}" stroke-width="1.5" ${sDash} />${gClose}`;
    }
    if (isEgg) {
        return `${gOpen}<ellipse cx="${px}" cy="${prY}" rx="${radiusW}" ry="${radiusH}" fill="${pColor}" stroke="${sColor}" stroke-width="1.5" ${sDash} />${gClose}`;
    }
    return `${gOpen}<circle cx="${px}" cy="${prY}" r="${radiusW}" fill="${pColor}" stroke="${sColor}" stroke-width="1.5" ${sDash} />${gClose}`;
}

/**
 * Generuje etykietę kąta na przejściu (tylko dla widocznych od przodu).
 */
function drawTransitionLabel(px, prY, angle, isBack) {
    if (isBack) return '';
    const fSz = 12;
    return `<text x="${px}" y="${prY + 3.5}" text-anchor="middle" fill="${SVG_COLORS.labelWhite}" font-size="${fSz}" font-weight="800" font-family="Inter,sans-serif" style="text-shadow: 1px 1px 2px ${SVG_COLORS.textShadow};">${angle}°</text>`;
}

/**
 * Generuje delikatną linię pomocniczą łączącą przejście z osią wymiarową.
 */
function drawTransitionGuideLine(px, prY, radiusW, isBack) {
    const dimColor = isBack ? SVG_COLORS.dnLabel : SVG_COLORS.transitionActive;
    return `<line x1="25" y1="${prY}" x2="${px - radiusW - 2}" y2="${prY}" stroke="${dimColor}" stroke-width="0.8" stroke-dasharray="2,2" opacity="0.5"/>`;
}
