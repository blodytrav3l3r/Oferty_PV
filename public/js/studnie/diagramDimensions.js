// @ts-check
/**
 * diagramDimensions.js — Linie wymiarowe i etykiety na diagramie SVG studni.
 *
 * Wyodrębnione z wellDiagram.js (faza 2 refaktoryzacji).
 *
 * Zawiera:
 *   drawSegmentDimensions()    — zunifikowana linia wymiarowa po lewej stronie
 *   resolveSegmentLabel()      — określa etykietę segmentu (DN rury lub mm)
 *   drawTotalHeightBar()       — pasek łącznej wysokości studni
 *   drawDnLabel()              — etykieta DN na dole diagramu
 *
 * Zależności globalne:
 *   SVG_COLORS (diagramTheme.js)
 *   studnieProducts, fmtInt
 */

/* ===== LINIA WYMIAROWA SEGMENTÓW ===== */

/**
 * Generuje zunifikowaną linię wymiarową po lewej stronie diagramu,
 * z oznaczeniem odległości między elementami i rurami (DN).
 */
function drawSegmentDimensions(dimLinesY, pxMm, well, canvas) {
    if (dimLinesY.length === 0) return '';

    const { mT, drawH } = canvas;
    const uniqueY = [...new Set(dimLinesY.map((v) => Math.round(v * 10) / 10))].sort(
        (a, b) => b - a
    );
    const dX = 52;
    const dimColor = SVG_COLORS.dimLine;

    let svgOut = '';

    // Tickmarks na każdej pozycji Y
    uniqueY.forEach((pY) => {
        svgOut += `<line x1="${dX - 4}" y1="${pY}" x2="${dX + 4}" y2="${pY}" stroke="${dimColor}" stroke-width="1.2"/>`;
    });

    // Segmenty między tickmarkami
    for (let i = 0; i < uniqueY.length - 1; i++) {
        const yB = uniqueY[i];
        const yT = uniqueY[i + 1];
        const distY = yB - yT;
        const distMm = Math.round(distY / pxMm);

        if (distMm <= 1) continue;

        svgOut += `<line x1="${dX}" y1="${yB}" x2="${dX}" y2="${yT}" stroke="${dimColor}" stroke-width="1.2"/>`;

        const { labelText, isPipe } = resolveSegmentLabel(distMm, yB, yT, well, pxMm, canvas);
        const textColor = isPipe ? SVG_COLORS.transitionActive : SVG_COLORS.dimText;
        const fW = isPipe ? '700' : '600';
        svgOut += `<text x="${dX - 6}" y="${(yB + yT) / 2}" transform="rotate(-90 ${dX - 6} ${(yB + yT) / 2})" text-anchor="middle" fill="${textColor}" font-size="11" font-family="Inter,sans-serif" font-weight="${fW}">${labelText}</text>`;
    }

    return svgOut;
}

/**
 * Określa czy dany segment wymiarowy odpowiada rurze — jeśli tak, zwraca "DN xxx".
 */
function resolveSegmentLabel(distMm, yB, yT, well, pxMm, canvas) {
    const { mT, drawH } = canvas;
    let labelText = `${distMm}`;
    let isPipe = false;

    if (!well.przejscia || well.przejscia.length === 0) {
        return { labelText, isPipe };
    }

    well.przejscia.forEach((pr) => {
        const pel = parseFloat(pr.rzednaWlaczenia) || 0;
        const pprod = studnieProducts.find((x) => x.id === pr.productId);
        let prH = 160;

        if (pprod && pprod.category === 'Otwór KPED') {
            prH = 500;
        } else if (pprod && typeof pprod.dn === 'string' && pprod.dn.includes('/')) {
            prH = parseFloat(pprod.dn.split('/')[1]) || 160;
        } else if (pprod) {
            prH = parseFloat(pprod.dn) || 160;
        }

        const mmFromBottom = (pel - (parseFloat(well.rzednaDna) || 0)) * 1000;
        const radiusH = Math.max((prH / 2) * pxMm, 3);
        const prY = mT + drawH - mmFromBottom * pxMm - radiusH;

        const pyB = Math.round((prY + radiusH) * 10) / 10;
        const pyT = Math.round((prY - radiusH) * 10) / 10;

        if (Math.abs(yB - pyB) <= 1.2 && Math.abs(yT - pyT) <= 1.2) {
            labelText = `DN ${Math.round(prH)}`;
            isPipe = true;
        }
    });

    return { labelText, isPipe };
}

/* ===== ŁĄCZNA WYSOKOŚĆ I ETYKIETA DN ===== */

/**
 * Generuje pasek łącznej wysokości studni po lewej stronie diagramu.
 */
function drawTotalHeightBar(canvas, totalMm) {
    const { mT, drawH } = canvas;
    const aX = 12;
    const aDimColor = SVG_COLORS.dimLine;

    let svg = '';
    svg += `<line x1="${aX}" y1="${mT}" x2="${aX}" y2="${mT + drawH}" stroke="${aDimColor}" stroke-width="1.2"/>`;
    svg += `<line x1="${aX - 4}" y1="${mT}" x2="${aX + 4}" y2="${mT}" stroke="${aDimColor}" stroke-width="1.2"/>`;
    svg += `<line x1="${aX - 4}" y1="${mT + drawH}" x2="${aX + 4}" y2="${mT + drawH}" stroke="${aDimColor}" stroke-width="1.2"/>`;
    const totalLabel = fmtInt(totalMm);
    svg += `<text x="${aX - 5}" y="${mT + drawH / 2}" transform="rotate(-90 ${aX - 5} ${mT + drawH / 2})" text-anchor="middle" fill="${aDimColor}" font-size="11" font-family="Inter,sans-serif" font-weight="600">${totalLabel}</text>`;
    return svg;
}

/**
 * Generuje etykietę DN na dole diagramu.
 */
function drawDnLabel(cx, bodyDN, canvas) {
    const { mT, drawH, mB } = canvas;
    const labelDN = typeof bodyDN === 'number' ? `DN${bodyDN}` : 'Styczna';
    return `<text x="${cx}" y="${mT + drawH + mB - 2}" text-anchor="middle" fill="${SVG_COLORS.dnLabel}" font-size="11" font-family="Inter,sans-serif" font-weight="600">${labelDN}</text>`;
}
