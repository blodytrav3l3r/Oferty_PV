// @ts-check
/* ===== PRINT MANAGER — Grafika SVG i Powłoka ===== */

function getPowlokaString(well) {
    if (!well) return 'Brak';
    let parts = [];
    if (well.malowanieW && well.malowanieW !== 'brak') {
        let malWDesc = '';
        if (well.malowanieW === 'kineta') malWDesc = 'Kineta';
        else if (well.malowanieW === 'kineta_dennica') malWDesc = 'Kineta+denn.';
        else if (well.malowanieW === 'cale') malWDesc = 'Całość';
        if (malWDesc) {
            let p = 'Wew: ' + malWDesc;
            if (well.powlokaNameW) p += ' (' + well.powlokaNameW + ')';
            parts.push(p);
        }
    }
    if (well.malowanieZ === 'zewnatrz') {
        let p = 'Zew:';
        if (well.powlokaNameZ) p += ' (' + well.powlokaNameZ + ')';
        parts.push(p);
    }
    return parts.length > 0 ? parts.join('<br>') : 'Brak';
}

function generateWellSvg(data) {
    const well = data.well || data;
    if (!well || !well.przejscia) return '';
    let przejscia = well.przejscia || [];
    const rzDna = parseFloat(well.rzednaDna) || 0;

    let blindKinetaPrzejscia = [];
    if (
        data.elementIndex !== undefined &&
        typeof buildConfigMap !== 'undefined' &&
        typeof findAssignedElement !== 'undefined'
    ) {
        const findProductFn = (id) =>
            typeof studnieProducts !== 'undefined'
                ? studnieProducts.find((pr) => pr.id === id)
                : null;
        const configMap = buildConfigMap(well, findProductFn, true);
        if (configMap.length > 0) {
            przejscia = przejscia.filter((p) => {
                let pel = parseFloat(p.rzednaWlaczenia);
                if (isNaN(pel)) pel = rzDna;
                const mmFromBottom = (pel - rzDna) * 1000;
                const { assignedIndex } = findAssignedElement(mmFromBottom, configMap);
                return assignedIndex === data.elementIndex;
            });
            const isDennica = data.product && data.product.componentType === 'dennica';
            if (isDennica) {
                blindKinetaPrzejscia = findBlindKinetaEntries(
                    well,
                    data.elementIndex,
                    configMap,
                    rzDna
                );
            }
        }
    }

    if (przejscia.length === 0 && blindKinetaPrzejscia.length === 0) return '';

    const size = 400;
    const center = size / 2;
    const radius = 58;
    const labelFontSize = 11;
    const angleFontSize = 9;
    const lineHeight = 10;

    let useKatWykonania = false;
    let angleTypeTitle = 'Wg Kąt Stopień';
    const dnStr = String(well.dn || '');
    const match = dnStr.match(/(\d{3,4})/);
    const numDn = match ? parseInt(match[1]) : 0;

    let isKragOt = false;
    if (data.product && data.product.componentType === 'krag_ot') {
        isKragOt = true;
    }

    if (isKragOt) {
        useKatWykonania = false;
        angleTypeTitle = 'Kąty: Kąt Stopień';
    } else if (numDn === 2000 || numDn === 2500) {
        useKatWykonania = false;
        angleTypeTitle = 'Kąty: Kąt Stopień';
    } else if ([1000, 1200, 1500].includes(numDn)) {
        useKatWykonania = true;
        angleTypeTitle = 'Kąty: Kąt Wykonania';
    }

    const svgParts = [];

    svgParts.push(
        `<circle cx="${center}" cy="${center}" r="${radius}" fill="none" stroke="#222" stroke-width="2.5" />`
    );
    svgParts.push(
        `<line x1="${center}" y1="${center - 5}" x2="${center}" y2="${center + 5}" stroke="#999" stroke-width="0.8" />`
    );
    svgParts.push(
        `<line x1="${center - 5}" y1="${center}" x2="${center + 5}" y2="${center}" stroke="#999" stroke-width="0.8" />`
    );
    svgParts.push(
        `<line x1="${center}" y1="${center + radius}" x2="${center}" y2="${center + radius + 10}" stroke="#777" stroke-width="1.5" />`
    );
    svgParts.push(
        `<text x="${center}" y="${center + radius + 20}" text-anchor="middle" font-family="Arial, sans-serif" font-size="10" font-weight="bold" fill="#666">0°</text>`
    );

    const wylot = przejscia.find(
        (p) => p.flowType === FLOW_TYPES.WYLOT || parseFloat(p.angle) === 0
    );
    ensureDisplayIndices(przejscia);

    if (blindKinetaPrzejscia.length > 0) {
        ensureDisplayIndices(well.przejscia || []);
    }

    const labelsMap = new Map();
    przejscia.forEach((p) => {
        const prefix = p.flowType === FLOW_TYPES.WYLOT ? 'Wylot' : 'Wlot';
        labelsMap.set(p, `${prefix} ${p.displayIndex}`);
    });
    blindKinetaPrzejscia.forEach((p) => {
        labelsMap.set(p, `Ślepa ${p.displayIndex}`);
    });

    const labels = [];

    function drawTransitionSvg(p, isBlind) {
        const baseAngle = parseFloat(p.angle) || 0;
        let angleDeg = baseAngle;
        if (useKatWykonania) {
            angleDeg =
                p.angleExecution !== undefined
                    ? parseFloat(p.angleExecution)
                    : baseAngle === 0 || baseAngle === 360
                      ? 0
                      : 360 - baseAngle;
        }

        const rad = (angleDeg * Math.PI) / 180;
        const x = center - radius * Math.sin(rad);
        const y = center + radius * Math.cos(rad);

        const isWylot = p === wylot;
        if (isBlind) {
            svgParts.push(
                `<line x1="${center}" y1="${center}" x2="${x}" y2="${y}" stroke="#999" stroke-width="1.5" stroke-dasharray="4,3" />`
            );
        } else {
            svgParts.push(
                `<line x1="${center}" y1="${center}" x2="${x}" y2="${y}" stroke="${isWylot ? '#000' : '#444'}" stroke-width="${isWylot ? 3.5 : 1.8}" />`
            );
        }

        const product =
            typeof studnieProducts !== 'undefined'
                ? studnieProducts.find((pr) => pr.id === p.productId)
                : null;
        const rodzaj = isBlind ? 'ŚLEPA' : product ? product.category : '';
        const dn = product ? product.dn : '';
        const pel = parseFloat(p.rzednaWlaczenia) || rzDna;
        const hMm = Math.round((pel - rzDna) * 1000);
        const uwagiText = isBlind ? 'ślepa' : hMm > 0 ? `+${hMm}mm` : '';

        const labelRadius = radius + 40;
        const lx = center - labelRadius * Math.sin(rad);
        const ly = center + labelRadius * Math.cos(rad);

        let anchor = 'middle';
        let offsetX = 0;
        if (lx < center - 15) {
            anchor = 'end';
            offsetX = -4;
        } else if (lx > center + 15) {
            anchor = 'start';
            offsetX = 4;
        }

        const prefix = labelsMap.get(p) || 'Wlot';
        const fullName = `${prefix}${rodzaj ? ' ' + rodzaj.toUpperCase() : ''}${dn ? ' DN' + dn : ''}`;
        const maxLineLen = 16;
        const words = fullName.split(' ');
        const lines = [];
        let currentLine = '';
        for (const word of words) {
            if (currentLine.length + word.length + 1 > maxLineLen && currentLine.length > 0) {
                lines.push(currentLine);
                currentLine = word;
            } else {
                currentLine = currentLine ? currentLine + ' ' + word : word;
            }
        }
        if (currentLine) lines.push(currentLine);

        labels.push({
            origX: lx,
            origY: ly,
            lx,
            ly,
            anchor,
            offsetX,
            isRight: lx >= center,
            lines,
            textAngle: `${angleDeg}°${uwagiText ? ' (' + uwagiText + ')' : ''}`,
            isBlind
        });
    }

    przejscia.forEach((p) => drawTransitionSvg(p, false));
    blindKinetaPrzejscia.forEach((p) => drawTransitionSvg(p, true));
    const leftLabels = labels.filter((l) => !l.isRight).sort((a, b) => a.ly - b.ly);
    const rightLabels = labels.filter((l) => l.isRight).sort((a, b) => a.ly - b.ly);

    function spreadLabels(arr) {
        const requiredGapBase = 8 + lineHeight;
        for (let loops = 0; loops < 15; loops++) {
            for (let i = 0; i < arr.length - 1; i++) {
                const aLines = arr[i].lines.length;
                const requiredGap = requiredGapBase + aLines * lineHeight;
                const diff = arr[i + 1].ly - arr[i].ly;
                if (diff < requiredGap) {
                    const push = (requiredGap - diff) / 2;
                    arr[i].ly -= push;
                    arr[i + 1].ly += push;
                }
            }
        }
    }
    spreadLabels(leftLabels);
    spreadLabels(rightLabels);

    let minX = center - radius - 5;
    let maxX = center + radius + 5;
    let minY = center - radius - 5;
    let maxY = center + radius + 5;

    labels.forEach((l) => {
        const textHeight = (l.lines.length + 1) * lineHeight;
        if (l.ly - 5 < minY) minY = l.ly - 5;
        if (l.ly + textHeight > maxY) maxY = l.ly + textHeight;

        const maxTextLen = Math.max(...l.lines.map((ln) => ln.length), l.textAngle.length);
        const textW = maxTextLen * 8;
        if (l.anchor === 'end') {
            if (l.lx - textW - 10 < minX) minX = l.lx - textW - 10;
        } else if (l.anchor === 'start') {
            if (l.lx + textW + 10 > maxX) maxX = l.lx + textW + 10;
        } else {
            if (l.lx - textW / 2 - 10 < minX) minX = l.lx - textW / 2 - 10;
            if (l.lx + textW / 2 + 10 > maxX) maxX = l.lx + textW / 2 + 10;
        }

        if (Math.abs(l.origY - l.ly) > 2) {
            const lineDist = l.ly > l.origY ? -8 : 8;
            svgParts.push(
                `<line x1="${l.origX}" y1="${l.origY}" x2="${l.lx}" y2="${l.ly + lineDist}" stroke="#ccc" stroke-dasharray="2,2" stroke-width="0.8" />`
            );
        }
        const textFill = l.isBlind ? '#999' : '#000';
        const subFill = l.isBlind ? '#aaa' : '#444';
        let textSvg = `<text x="${l.lx + l.offsetX}" y="${l.ly}" text-anchor="${l.anchor}" font-family="Arial, sans-serif" font-size="${labelFontSize}" font-weight="bold" fill="${textFill}">`;
        l.lines.forEach((line, li) => {
            textSvg += `<tspan x="${l.lx + l.offsetX}" dy="${li === 0 ? '0' : '1.1em'}" fill="${textFill}">${line}</tspan>`;
        });
        textSvg += `<tspan x="${l.lx + l.offsetX}" dy="1.1em" font-size="${angleFontSize}" font-weight="normal" fill="${subFill}">${l.textAngle}</tspan>`;
        textSvg += `</text>`;
        svgParts.push(textSvg);
    });

    const pad = 4;
    const vbX = Math.floor(minX - pad);
    const vbY = Math.floor(minY - pad);
    const vbW = Math.ceil(maxX - minX + pad * 2);
    const vbH = Math.ceil(maxY - minY + pad * 2);

    let svg = `<svg viewBox="${vbX} ${vbY} ${vbW} ${vbH}" style="width:100%; max-height:115px; background:transparent; display:block; margin:0 auto;">`;
    svg += svgParts.join('');
    svg += `</svg>`;
    return svg;
}
