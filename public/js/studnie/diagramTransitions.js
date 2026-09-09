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
 *   drawTransitionGuideLine()     — odnośnik od przejścia do etykiety DN (linia + kropka)
 *   formatTransitionLift()        — podniesienie dolnej krawędzi nad dnem (`+1,00`/`-0,20`)
 *   layoutTransitionLabels()      — rozsuwanie etykiet DN bez nachodzenia (shrink 11→10px)
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

    // Prawa oś wymiarowa przejść (DN)
    const dX = 52;
    const rX = canvas.svgW - canvas.mR + (canvas.mL - dX);

    // Przygotuj wszystkie przejścia (potrzebne do rozwiązywania kolizji etykiet DN)
    const items = [];
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

        items.push({
            idx,
            px,
            prY,
            radiusW,
            radiusH,
            isRect,
            isEgg,
            isBack,
            angle,
            liftM: mmFromBottom / 1000,
            dnText: `DN ${Math.round(prH)} ${formatTransitionLift(mmFromBottom / 1000)}`.trim(),
            labelY: prY
        });
    });

    // Rozsuwanie etykiet DN: dwie kolumny na prawej osi (naprzemiennie).
    // Etykieta obrócona -90° zajmuje pionowo ~len*charW, więc rozstaw
    // liczony od połówek długości sąsiadów. Przy przepełnieniu osi
    // czcionka ściskana 11px → 10px (decyzja użytkownika).
    items.sort((a, b) => a.labelY - b.labelY);
    items.forEach((it, i) => {
        it.col = i % 2;
        it.labelX = it.col === 0 ? rX + 5 : rX + 28;
    });
    const maxLabelY = mT + drawH - 15;
    let labelFontSize = 11;
    layoutTransitionLabels(items, 11, mT, maxLabelY);
    if (transitionLabelsOverflow(items, 11)) {
        labelFontSize = 10;
        items.forEach((it) => {
            it.labelY = it.prY;
        });
        layoutTransitionLabels(items, 10, mT, maxLabelY);
    }
    items.forEach((it) => {
        it.fontSize = labelFontSize;
    });

    let svgOut = '';
    items.forEach((it) => {
        svgOut += drawTransitionShape(
            it.idx,
            it.px,
            it.prY,
            it.radiusW,
            it.radiusH,
            it.isRect,
            it.isEgg,
            it.isBack
        );
        svgOut += drawTransitionLabel(it.px, it.prY, it.angle, it.isBack);
        svgOut += drawTransitionGuideLine(it);
        svgOut += `<text x="${it.labelX}" y="${it.labelY}" transform="rotate(-90 ${it.labelX} ${it.labelY})" text-anchor="middle" style="fill:${SVG_COLORS.transitionActive}" font-size="${it.fontSize}" font-family="Inter,sans-serif" font-weight="700">${it.dnText}</text>`;
    });

    return svgOut;
}

/**
 * Formatuje podniesienie dolnej krawędzi przejścia nad dnem studni (metry).
 * Zawsze ze znakiem: dodatnie `+1,00`, ujemne `-0,20` (decyzja użytkownika).
 * Zwraca '' gdy brak danych — wtedy etykieta to sam `DN xxx`.
 */
function formatTransitionLift(liftM) {
    const v = typeof liftM === 'number' ? liftM : parseFloat(liftM);
    if (!isFinite(v)) return '';
    const rounded = Math.round(v * 100) / 100;
    const sign = rounded < 0 ? '-' : '+';
    return sign + Math.abs(rounded).toFixed(2).replace('.', ',');
}

/**
 * Połówka pionowego rozstawu etykiety (tekst obrócony -90°).
 */
function transitionLabelHalfSpan(dnText, fontSize) {
    const charW = fontSize <= 10 ? 6.0 : 6.5;
    return (dnText.length * charW) / 2 + 4;
}

/**
 * Rozsuwa etykiety w obrębie kolumn + przebieg wsteczny przy dobiciu do końca osi.
 */
function layoutTransitionLabels(items, fontSize, mT, maxLabelY) {
    for (let col = 0; col < 2; col++) {
        let prevY = -Infinity;
        let prevHalf = 0;
        for (const it of items) {
            if (it.col !== col) continue;
            const half = transitionLabelHalfSpan(it.dnText, fontSize);
            if (prevY !== -Infinity) {
                const minGap = prevHalf + half + 4;
                if (it.labelY - prevY < minGap) {
                    it.labelY = prevY + minGap;
                }
            }
            if (it.labelY > maxLabelY) it.labelY = maxLabelY;
            prevY = it.labelY;
            prevHalf = half;
        }
        let nextY = Infinity;
        let nextHalf = 0;
        const colItems = items.filter((it) => it.col === col);
        for (let i = colItems.length - 1; i >= 0; i--) {
            const it = colItems[i];
            const half = transitionLabelHalfSpan(it.dnText, fontSize);
            if (nextY !== Infinity) {
                const minGap = half + nextHalf + 4;
                if (nextY - it.labelY < minGap) {
                    it.labelY = nextY - minGap;
                }
            }
            if (it.labelY - half < mT) it.labelY = mT + half;
            nextY = it.labelY;
            nextHalf = half;
        }
    }
}

/**
 * Sprawdza, czy po rozsunięciu zostały nakładające się etykiety.
 */
function transitionLabelsOverflow(items, fontSize) {
    for (let col = 0; col < 2; col++) {
        let prevY = -Infinity;
        let prevHalf = 0;
        for (const it of items) {
            if (it.col !== col) continue;
            const half = transitionLabelHalfSpan(it.dnText, fontSize);
            if (prevY !== -Infinity && it.labelY - prevY < prevHalf + half + 4 - 0.01) {
                return true;
            }
            prevY = it.labelY;
            prevHalf = half;
        }
    }
    return false;
}

/**
 * Parsuje geometrię przejścia — zwraca wymiary rury i pozycję.
 */
function parseTransitionGeometry(pr, bottomElev) {
    const angle = parseFloat(pr.angle ?? pr.angleExecution ?? pr.katWlaczenia) || 0;
    let pel = parseFloat(pr.rzednaWlaczenia);
    if (isNaN(pel)) pel = 0;

    const pprod =
        typeof getStudnieProductById === 'function'
            ? getStudnieProductById(pr.productId)
            : studnieProducts.find((x) => x.id === pr.productId);
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
        return `${gOpen}<rect x="${px - radiusW}" y="${prY - radiusH}" width="${radiusW * 2}" height="${radiusH * 2}" style="fill:${pColor};stroke:${sColor}" stroke-width="1.5" ${sDash} />${gClose}`;
    }
    if (isEgg) {
        return `${gOpen}<ellipse cx="${px}" cy="${prY}" rx="${radiusW}" ry="${radiusH}" style="fill:${pColor};stroke:${sColor}" stroke-width="1.5" ${sDash} />${gClose}`;
    }
    return `${gOpen}<circle cx="${px}" cy="${prY}" r="${radiusW}" style="fill:${pColor};stroke:${sColor}" stroke-width="1.5" ${sDash} />${gClose}`;
}

/**
 * Generuje etykietę kąta na przejściu (tylko dla widocznych od przodu).
 */
function drawTransitionLabel(px, prY, angle, isBack) {
    if (isBack) return '';
    const fSz = 12;
    return `<text x="${px}" y="${prY + 3.5}" text-anchor="middle" font-size="${fSz}" font-weight="800" font-family="Inter,sans-serif" style="fill:${SVG_COLORS.labelWhite}; text-shadow: 1px 1px 2px ${SVG_COLORS.textShadow};">${angle}°</text>`;
}

/**
 * Generuje odnośnik łączący przejście z jego etykietą DN (linia + kropka kotwicy).
 * Etykieta po rozsunięciu może stać daleko od rury — linia zawsze je łączy.
 */
function drawTransitionGuideLine(it) {
    const dimColor = it.isBack ? SVG_COLORS.dnLabel : SVG_COLORS.transitionActive;
    const ax = it.px + it.radiusW + 2;
    return (
        `<circle cx="${ax}" cy="${it.prY}" r="1.6" style="fill:${dimColor}" opacity="0.8"/>` +
        `<line x1="${ax}" y1="${it.prY}" x2="${it.labelX}" y2="${it.labelY}" style="stroke:${dimColor}" stroke-width="0.8" stroke-dasharray="2,2" opacity="0.5"/>`
    );
}

/* ===== Rejestracja globali ===== */
window.drawTransitions = drawTransitions;
