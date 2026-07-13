// @ts-check
/* ===== WELL DIAGRAM — Renderowanie przejść (rur) i wymiarów ===== */

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

function drawTransitionShape(idx, px, prY, radiusW, radiusH, isRect, isEgg, isBack) {
    const pColor = isBack ? SVG_COLORS.transitionBack : SVG_COLORS.transitionActive;
    const sColor = isBack ? SVG_COLORS.transitionBackStroke : SVG_COLORS.transitionStroke;
    const sDash = isBack ? 'stroke-dasharray="2,2"' : '';

    const gOpen = `<g class="svg-prz-${idx}" style="transition:all 0.2s;" data-prz-idx="${idx}">`;
    const gClose = '</g>';

    if (isRect) {
        return `${gOpen}<rect x="${px - radiusW}" y="${prY - radiusH}" width="${radiusW * 2}" height="${radiusH * 2}" fill="${pColor}" stroke="${sColor}" stroke-width="1.5" ${sDash} />${gClose}`;
    }
    if (isEgg) {
        return `${gOpen}<ellipse cx="${px}" cy="${prY}" rx="${radiusW}" ry="${radiusH}" fill="${pColor}" stroke="${sColor}" stroke-width="1.5" ${sDash} />${gClose}`;
    }
    return `${gOpen}<circle cx="${px}" cy="${prY}" r="${radiusW}" fill="${pColor}" stroke="${sColor}" stroke-width="1.5" ${sDash} />${gClose}`;
}

function drawTransitionLabel(px, prY, angle, isBack) {
    if (isBack) return '';
    const fSz = 12;
    return `<text x="${px}" y="${prY + 3.5}" text-anchor="middle" fill="${SVG_COLORS.labelWhite}" font-size="${fSz}" font-weight="800" font-family="Inter,sans-serif" style="text-shadow: 1px 1px 2px ${SVG_COLORS.textShadow};">${angle}°</text>`;
}

function drawTransitionGuideLine(px, prY, radiusW, isBack) {
    const dimColor = isBack ? SVG_COLORS.dnLabel : SVG_COLORS.transitionActive;
    return `<line x1="25" y1="${prY}" x2="${px - radiusW - 2}" y2="${prY}" stroke="${dimColor}" stroke-width="0.8" stroke-dasharray="2,2" opacity="0.5"/>`;
}

function drawSegmentDimensions(dimLinesY, pxMm, well, canvas) {
    if (dimLinesY.length === 0) return '';

    const { mT, drawH } = canvas;
    const uniqueY = [...new Set(dimLinesY.map((v) => Math.round(v * 10) / 10))].sort(
        (a, b) => b - a
    );
    const dX = 52;
    const dimColor = SVG_COLORS.dimLine;

    let svgOut = '';

    uniqueY.forEach((pY) => {
        svgOut += `<line x1="${dX - 4}" y1="${pY}" x2="${dX + 4}" y2="${pY}" stroke="${dimColor}" stroke-width="1.2"/>`;
    });

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
