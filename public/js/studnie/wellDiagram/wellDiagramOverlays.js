// @ts-check
/* ===== WELL DIAGRAM — Nakładki (wysokość, DN, PRECO) ===== */

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

function drawDnLabel(cx, bodyDN, canvas) {
    const { mT, drawH, mB } = canvas;
    const labelDN = typeof bodyDN === 'number' ? `DN${bodyDN}` : 'Styczna';
    return `<text x="${cx}" y="${mT + drawH + mB - 2}" text-anchor="middle" fill="${SVG_COLORS.dnLabel}" font-size="11" font-family="Inter,sans-serif" font-weight="600">${labelDN}</text>`;
}

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
    if (lineY >= mT && lineY <= mT + drawH) {
        svg += `<line x1="${xStart}" y1="${lineY}" x2="${xEnd}" y2="${lineY}" stroke="${SVG_COLORS.precoDash}" stroke-width="1.5" stroke-dasharray="6,3" opacity="0.85"/>`;
        svg += `<polygon points="${xStart - 3},${lineY - 3} ${xStart - 3},${lineY + 3} ${xStart},${lineY}" fill="${SVG_COLORS.precoDash}" opacity="0.85"/>`;
        svg += `<text x="${rightEdge - 4}" y="${lineY + 10}" text-anchor="end" fill="${SVG_COLORS.precoDash}" font-size="8" font-family="Inter,sans-serif" font-weight="700" opacity="0.9">▼ ${kinetaLabel}</text>`;
    }

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
                svg += `<line x1="${xStart}" y1="${lineYFull}" x2="${xEnd}" y2="${lineYFull}" stroke="${SVG_COLORS.fillHeight}" stroke-width="1.5" stroke-dasharray="4,2" opacity="0.9"/>`;
                svg += `<polygon points="${xStart - 3},${lineYFull - 3} ${xStart - 3},${lineYFull + 3} ${xStart},${lineYFull}" fill="${SVG_COLORS.fillHeight}" opacity="0.9"/>`;
                svg += `<text x="${rightEdge - 4}" y="${lineYFull + 10}" text-anchor="end" fill="${SVG_COLORS.fillHeight}" font-size="8" font-family="Inter,sans-serif" font-weight="700" opacity="0.9">▼ Uzupełnienie do pełnej wysokości</text>`;
            }
        }
    }

    return svg;
}
