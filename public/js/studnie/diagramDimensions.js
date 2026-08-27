// @ts-check
/**
 * diagramDimensions.js — Linie wymiarowe i etykiety na diagramie SVG studni.
 *
 * Wyodrębnione z wellDiagram.js (faza 2 refaktoryzacji).
 *
 * Zawiera:
 *   drawSegmentDimensions()    — lewa linia wymiarowa (odległości mm między elementami)
 *   drawTotalHeightBar()       — pasek łącznej wysokości studni
 *   drawDnLabel()              — etykieta DN na dole diagramu
 *
 * Zależności globalne:
 *   SVG_COLORS (diagramTheme.js)
 *   fmtInt
 */

function _dimFmt(mm) {
    try {
        if (typeof formatHeightValue === 'function' && typeof getDisplayUnit === 'function')
            return formatHeightValue(mm, getDisplayUnit());
    } catch (_e) {}
    return typeof fmtInt === 'function' ? fmtInt(mm) : String(Math.round(mm));
}

/* ===== LINIA WYMIAROWA SEGMENTÓW ===== */

/**
 * Generuje zunifikowaną linię wymiarową po lewej stronie diagramu,
 * z oznaczeniem odległości między elementami.
 */
function drawSegmentDimensions(dimLinesY, pxMm) {
    if (dimLinesY.length === 0) return '';

    const uniqueY = [...new Set(dimLinesY.map((v) => Math.round(v * 10) / 10))].sort(
        (a, b) => b - a
    );
    const dX = 52;
    const dimColor = SVG_COLORS.dimLine;

    let svgOut = '';

    // Tickmarks na każdej pozycji Y
    uniqueY.forEach((pY) => {
        svgOut += `<line x1="${dX - 4}" y1="${pY}" x2="${dX + 4}" y2="${pY}" style="stroke:${dimColor}" stroke-width="1.2"/>`;
    });

    // Segmenty między tickmarkami
    for (let i = 0; i < uniqueY.length - 1; i++) {
        const yB = uniqueY[i];
        const yT = uniqueY[i + 1];
        const distY = yB - yT;
        const distMm = Math.round(distY / pxMm);

        if (distMm <= 1) continue;

        svgOut += `<line x1="${dX}" y1="${yB}" x2="${dX}" y2="${yT}" style="stroke:${dimColor}" stroke-width="1.2"/>`;

        svgOut += `<text x="${dX - 6}" y="${(yB + yT) / 2}" transform="rotate(-90 ${dX - 6} ${(yB + yT) / 2})" text-anchor="middle" style="fill:${SVG_COLORS.dimText}" font-size="11" font-family="Inter,sans-serif" font-weight="600">${_dimFmt(distMm)}</text>`;
    }

    return svgOut;
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
    svg += `<line x1="${aX}" y1="${mT}" x2="${aX}" y2="${mT + drawH}" style="stroke:${aDimColor}" stroke-width="1.2"/>`;
    svg += `<line x1="${aX - 4}" y1="${mT}" x2="${aX + 4}" y2="${mT}" style="stroke:${aDimColor}" stroke-width="1.2"/>`;
    svg += `<line x1="${aX - 4}" y1="${mT + drawH}" x2="${aX + 4}" y2="${mT + drawH}" style="stroke:${aDimColor}" stroke-width="1.2"/>`;
    const totalLabel = _dimFmt(totalMm);
    svg += `<text x="${aX - 5}" y="${mT + drawH / 2}" transform="rotate(-90 ${aX - 5} ${mT + drawH / 2})" text-anchor="middle" style="fill:${aDimColor}" font-size="11" font-family="Inter,sans-serif" font-weight="600">${totalLabel}</text>`;
    return svg;
}

/**
 * Generuje etykietę DN na dole diagramu.
 */
function drawDnLabel(cx, bodyDN, canvas) {
    const { mT, drawH, mB } = canvas;
    const labelDN = typeof bodyDN === 'number' ? `DN${bodyDN}` : 'Styczna';
    return `<text x="${cx}" y="${mT + drawH + mB - 2}" text-anchor="middle" style="fill:${SVG_COLORS.dnLabel}" font-size="11" font-family="Inter,sans-serif" font-weight="600">${labelDN}</text>`;
}

/* ===== Rejestracja globali ===== */
window.drawSegmentDimensions = drawSegmentDimensions;
window.drawTotalHeightBar = drawTotalHeightBar;
window.drawDnLabel = drawDnLabel;
