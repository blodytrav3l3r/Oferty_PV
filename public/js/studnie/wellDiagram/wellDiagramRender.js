// @ts-check
/* ===== WELL DIAGRAM — Renderowanie SVG ===== */

/* ===== KOLORY I TYPY KOMPONENTÓW ===== */

/** Centralna mapa kolorów SVG */
const SVG_COLORS = {
    // Component fills
    wlaz: '#1e293b',
    plyta_din: '#be185d',
    plyta_najazdowa: '#9d174d',
    plyta_zamykajaca: '#7c3aed',
    pierscien_odciazajacy: '#0891b2',
    konus: '#d97706',
    avr: '#475569',
    krag: '#4338ca',
    krag_ot: '#4338ca',
    osadnik: '#a16207',
    dennica: '#047857',
    styczna: '#059669',
    plyta_redukcyjna: '#6d28d9',
    fallback: '#334155',

    // Component strokes
    wlaz_stroke: '#334155',
    plyta_din_stroke: '#ec4899',
    plyta_najazdowa_stroke: '#f472b6',
    plyta_zamykajaca_stroke: '#a78bfa',
    pierscien_odciazajacy_stroke: '#22d3ee',
    konus_stroke: '#fbbf24',
    avr_stroke: '#94a3b8',
    krag_stroke: '#818cf8',
    krag_ot_stroke: '#c084fc',
    osadnik_stroke: '#fbbf24',
    dennica_stroke: '#34d399',
    styczna_stroke: '#34d399',
    plyta_redukcyjna_stroke: '#a78bfa',
    fallback_stroke: '#64748b',

    // Misc drawing colors
    dimLine: '#94a3b8',
    dimText: '#cbd5e1',
    dnLabel: '#64748b',
    emptyState: '#475569',
    labelWhite: '#ffffff',
    precoDash: '#ef4444',
    fillHeight: '#f59e0b',
    transitionCircle: 'rgba(15,23,42,0.7)',
    textShadow: 'rgba(0,0,0,0.8)',
    transitionActive: '#38bdf8',
    transitionStroke: '#0ea5e9',
    transitionBack: 'rgba(71,85,105,0.4)',
    transitionBackStroke: 'rgba(100,116,139,0.5)'
};

/** Mapa kolorów i etykiet dla typów komponentów studni */
const COMPONENT_THEME = {
    wlaz: { fill: SVG_COLORS.wlaz, stroke: SVG_COLORS.wlaz_stroke, label: 'Właz' },
    plyta_din: {
        fill: SVG_COLORS.plyta_din,
        stroke: SVG_COLORS.plyta_din_stroke,
        label: 'Płyta DIN'
    },
    plyta_najazdowa: {
        fill: SVG_COLORS.plyta_najazdowa,
        stroke: SVG_COLORS.plyta_najazdowa_stroke,
        label: 'Pł. Odci.'
    },
    plyta_zamykajaca: {
        fill: SVG_COLORS.plyta_zamykajaca,
        stroke: SVG_COLORS.plyta_zamykajaca_stroke,
        label: 'Pł. Odci.'
    },
    pierscien_odciazajacy: {
        fill: SVG_COLORS.pierscien_odciazajacy,
        stroke: SVG_COLORS.pierscien_odciazajacy_stroke,
        label: 'PO'
    },
    konus: { fill: SVG_COLORS.konus, stroke: SVG_COLORS.konus_stroke, label: 'Konus' },
    avr: { fill: SVG_COLORS.avr, stroke: SVG_COLORS.avr_stroke, label: 'AVR' },
    krag: { fill: SVG_COLORS.krag, stroke: SVG_COLORS.krag_stroke, label: 'Krąg' },
    krag_ot: {
        fill: SVG_COLORS.krag_ot,
        stroke: SVG_COLORS.krag_ot_stroke,
        label: 'Krąg wiercony'
    },
    osadnik: { fill: SVG_COLORS.osadnik, stroke: SVG_COLORS.osadnik_stroke, label: 'Osadnik' },
    dennica: { fill: SVG_COLORS.dennica, stroke: SVG_COLORS.dennica_stroke, label: 'Dennica' },
    styczna: { fill: SVG_COLORS.styczna, stroke: SVG_COLORS.styczna_stroke, label: 'Styczna' },
    plyta_redukcyjna: {
        fill: SVG_COLORS.plyta_redukcyjna,
        stroke: SVG_COLORS.plyta_redukcyjna_stroke,
        label: 'Płyta red.'
    }
};

/* ===== BUDOWANIE WIDOCZNYCH KOMPONENTÓW ===== */

/**
 * Buduje tablicę widocznych komponentów studni z config (od góry do dołu),
 * uwzględniając flagi psiaBuda i odfiltrowując uszczelki.
 */
function buildVisibleComponents(well) {
    const components = [];
    let lastWasDennica = !!well.psiaBuda;
    const configReversedElements = [...well.config].reverse();

    configReversedElements.forEach((item, revIdx) => {
        const p = studnieProducts.find((pr) => pr.id === item.productId);
        if (!p) return;
        for (let i = 0; i < item.quantity; i++) {
            let effH = p.height || 0;
            if (p.componentType === 'dennica' && lastWasDennica) {
                effH = Math.max(0, effH - 100);
            }

            components.push({
                ...p,
                height: effH,
                _originalHeight: p.height,
                _cfgIdx: well.config.length - 1 - revIdx, // Odzyskaj oryginalny indeks z config
                _isFirst: i === 0,
                _isLast: i === item.quantity - 1,
                isPlaceholder: !!item.isPlaceholder
            });
            if (p.componentType !== 'uszczelka') {
                lastWasDennica = p.componentType === 'dennica';
            }
        }
    });

    // Pamiętaj: components są teraz od dołu do góry. Renderowanie potrzebuje ich od GÓRY do DOŁU.
    components.reverse();

    return components.filter(
        (c) =>
            c.componentType !== 'uszczelka' &&
            ((c.height || 0) > 0 ||
                c.componentType === 'wlaz' ||
                c.componentType === 'plyta_zamykajaca' ||
                c.componentType === 'plyta_najazdowa')
    );
}

/* ===== OBLICZANIE ZEWNĘTRZNEJ ŚREDNICY WIZUALNEJ ===== */

/**
 * Pobierz wizualną szerokość zewnętrzną (w mm) elementu na schemacie.
 * Konus, płyty i właz mają specjalne rozmiary.
 */
function getElementOuterDn(comp, bodyDN) {
    const ct = comp.componentType;
    let prodDn = comp.dn && typeof comp.dn === 'number' ? comp.dn : bodyDN;
    if (typeof prodDn !== 'number') prodDn = 1000;

    switch (ct) {
        case 'wlaz':
            return 600; // standardowa średnica włazu
        case 'avr':
            return 625; // standardowy pierścień wyrównawczy
        case 'konus':
            return prodDn; // szerokość dolna = DN studni (góra ma 625, obsługiwane podczas renderowania)
        case 'plyta_din':
            return prodDn; // coincides with well DN
        case 'plyta_redukcyjna':
            return prodDn; // outer = well DN
        case 'plyta_zamykajaca':
        case 'pierscien_odciazajacy':
            return prodDn + 200; // zewnętrzna krawędź wystaje poza trzon studni
        case 'plyta_najazdowa':
            return prodDn + 200; // kwadratowa płyta wystaje poza trzon studni
        case 'dennica':
        case 'krag':
        case 'krag_ot':
        case 'osadnik':
        default:
            return prodDn;
    }
}

/* ===== OBLICZANIE PARAMETRÓW CANVAS ===== */

/**
 * Oblicza parametry skalowania i wymiarów canvas SVG.
 * @returns {{ svgW, svgH, drawW, drawH, mL, mR, mT, mB, pxMm, cx, totalMm }}
 */
function calculateCanvasParams(visible, bodyDN) {
    const svgW = 340;
    const mL = 75,
        mR = 25,
        mT = 15,
        mB = 22;
    const drawW = svgW - mL - mR;

    // Przewidzenie najszerszego elementu
    let maxElemWidth = typeof bodyDN === 'number' ? bodyDN : 1000;
    visible.forEach((c) => {
        let d = typeof c.dn === 'number' ? c.dn : 0;
        if (
            c.componentType === 'plyta_zamykajaca' ||
            c.componentType === 'pierscien_odciazajacy' ||
            c.componentType === 'plyta_najazdowa'
        ) {
            d += 200;
        }
        if (d > maxElemWidth) maxElemWidth = d;
    });
    if (maxElemWidth < 1000) maxElemWidth = 1000;

    const pxMm = drawW / maxElemWidth;

    const totalMm = visible.reduce((s, c) => {
        const h = c.height || 0;
        return s + (h === 0 ? 18 / pxMm : h);
    }, 0);

    const drawH = totalMm * pxMm;
    const svgH = drawH + mT + mB;
    const cx = mL + drawW / 2;

    return { svgW, svgH, drawW, drawH, mL, mR, mT, mB, pxMm, cx, totalMm };
}

/* ===== RYSOWANIE KSZTAŁTU POJEDYNCZEGO KOMPONENTU ===== */

/**
 * Generuje SVG kształtu dla jednego komponentu studni.
 * Obsługuje konus (trapez), dennicę (gruba linia), osadnik (linie poziomu) itd.
 */
function drawComponentShape(comp, x, y, w, h, cx, pxMm, c) {
    const ct = comp.componentType;
    let svg = '';

    if (ct === 'konus') {
        const topW = Math.max(pxMm * 625, 20);
        const topX = cx - topW / 2;
        svg += `<polygon points="${topX},${y} ${topX + topW},${y} ${x + w},${y + h} ${x},${y + h}" fill="${c.fill}" stroke="${c.stroke}" stroke-width="1.5" opacity="0.85"/>`;
    } else if (ct === 'dennica' || ct === 'styczna') {
        svg += `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="3" fill="${c.fill}" stroke="${c.stroke}" stroke-width="1.5" opacity="0.85"/>`;
        svg += `<line x1="${x}" y1="${y + h}" x2="${x + w}" y2="${y + h}" stroke="${c.stroke}" stroke-width="3"/>`;
    } else if (ct === 'wlaz') {
        svg += `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="1" fill="${c.fill}" stroke="${c.stroke}" stroke-width="1.5" opacity="0.95"/>`;
    } else if (ct === 'osadnik') {
        svg += `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="3" fill="${c.fill}" stroke="${c.stroke}" stroke-width="1.5" opacity="0.85"/>`;
        const oy = y + h * 0.65;
        svg += `<line x1="${x + 4}" y1="${oy}" x2="${x + w - 4}" y2="${oy}" stroke="${c.stroke}" stroke-width="0.7" stroke-dasharray="3,2" opacity="0.6"/>`;
        svg += `<line x1="${x + 4}" y1="${oy + h * 0.15}" x2="${x + w - 4}" y2="${oy + h * 0.15}" stroke="${c.stroke}" stroke-width="0.5" stroke-dasharray="2,2" opacity="0.4"/>`;
    } else {
        // Kręgi, płyty, pierścienie, AVR i inne prostokątne elementy
        const rx =
            ct === 'avr' ||
            ct === 'plyta_din' ||
            ct === 'plyta_redukcyjna' ||
            ct === 'plyta_zamykajaca' ||
            ct === 'pierscien_odciazajacy' ||
            ct === 'plyta_najazdowa'
                ? 2
                : 2;
        svg += `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${rx}" fill="${c.fill}" stroke="${c.stroke}" stroke-width="1.5" opacity="0.85"/>`;

        // Otwory wierconego kręgu
        if (ct === 'krag_ot') {
            const hr = Math.min(h * 0.15, 7);
            if (hr > 2) {
                svg += `<circle cx="${x + 10}" cy="${y + h / 2}" r="${hr}" fill="${SVG_COLORS.transitionCircle}" stroke="${c.stroke}" stroke-width="0.8"/>`;
                svg += `<circle cx="${x + w - 10}" cy="${y + h / 2}" r="${hr}" fill="${SVG_COLORS.transitionCircle}" stroke="${c.stroke}" stroke-width="0.8"/>`;
            }
        }
    }

    return svg;
}

/* ===== RYSOWANIE ETYKIETY I WYMIARU KOMPONENTU ===== */

/**
 * Generuje etykietę tekstową wewnątrz komponentu (nazwa typu).
 */
function drawComponentLabel(cx, y, h, label) {
    if (h > 18) {
        const fontSize = Math.min(13, Math.max(10, h * 0.35));
        return `<text x="${cx}" y="${y + h / 2 + 4}" text-anchor="middle" fill="${SVG_COLORS.labelWhite}" font-size="${fontSize}" font-family="Inter,sans-serif" font-weight="700" opacity="0.95">${label}</text>`;
    }
    if (h > 8) {
        return `<text x="${cx}" y="${y + h / 2 + 3}" text-anchor="middle" fill="${SVG_COLORS.labelWhite}" font-size="9" font-family="Inter,sans-serif" font-weight="600" opacity="0.8">${label}</text>`;
    }
    return '';
}

/**
 * Generuje wymiarówkę (lewa strona) dla jednego komponentu.
 */
function drawComponentDimension(y, h, heightMm) {
    if (h <= 6) return '';

    const dx = 32;
    let svg = '';
    // Kreska pionowa wymiaru
    svg += `<line x1="${dx}" y1="${y + 1}" x2="${dx}" y2="${y + h - 1}" stroke="${SVG_COLORS.dimLine}" stroke-width="0.7"/>`;
    // Kreski poziome (górny i dolny tick)
    svg += `<line x1="${dx - 3}" y1="${y + 1}" x2="${dx + 3}" y2="${y + 1}" stroke="${SVG_COLORS.dimLine}" stroke-width="0.7"/>`;
    svg += `<line x1="${dx - 3}" y1="${y + h - 1}" x2="${dx + 3}" y2="${y + h - 1}" stroke="${SVG_COLORS.dimLine}" stroke-width="0.7"/>`;
    // Tekst wymiaru (pionowo z lewej strony)
    const dimFontSize = Math.min(11, Math.max(8, h * 0.3));
    svg += `<text x="${dx - 4}" y="${y + h / 2}" transform="rotate(-90 ${dx - 4} ${y + h / 2})" text-anchor="middle" fill="${SVG_COLORS.dimText}" font-size="${dimFontSize}" font-family="Inter,sans-serif" font-weight="600">${heightMm}</text>`;
    return svg;
}

/* ===== RYSOWANIE WSZYSTKICH KOMPONENTÓW ===== */

/**
 * Iteruje po widocznych komponentach i generuje SVG elementów, etykiet, wymiarów.
 * Zwraca { svg, dimLinesY } — wygenerowany SVG-string i tablicę pozycji Y wymiarówek.
 */
function drawAllComponents(visible, canvas) {
    const { pxMm, cx, mT } = canvas;
    const bodyDN = canvas.bodyDN;
    const mmToPx = (mm) => mm * pxMm;

    let svgOut = '';
    let y = mT;
    const dimLinesY = [];

    visible.forEach((comp) => {
        let h = (comp.height || 0) * pxMm;

        // Syntetyczna grubość rysowania dla elementów bez fizycznej wysokości
        if (h === 0) {
            h = 18;
        }

        dimLinesY.push(y);
        dimLinesY.push(y + h);

        const outerDn = getElementOuterDn(comp, bodyDN);
        const w = Math.max(mmToPx(outerDn), 20);
        const x = cx - w / 2;

        const c = COMPONENT_THEME[comp.componentType] || {
            fill: SVG_COLORS.fallback,
            stroke: SVG_COLORS.fallback_stroke,
            label: ''
        };

        const isPlaceholder = comp.isPlaceholder;
        const pointerEvents = isPlaceholder ? 'pointer-events="none"' : '';
        const plStyle = isPlaceholder
            ? 'opacity:0.6; filter:drop-shadow(0px 0px 8px rgba(96, 165, 250, 0.9));'
            : '';

        // Otwieramy grupę SVG z event handlerami (drag & drop, hover)
        // Handlers are attached via JS event delegation in attachSvgEvents()
        if (comp._cfgIdx !== undefined) {
            svgOut +=
                `<g class="diag-comp-grp svg-cfg-${comp._cfgIdx}" style="transition:all 0.2s; ${plStyle}" cursor="grab" ${pointerEvents} ` +
                `data-cfg-idx="${comp._cfgIdx}" draggable="true">`;
        }

        svgOut += drawComponentShape(comp, x, y, w, h, cx, pxMm, c);
        svgOut += drawComponentLabel(cx, y, h, c.label);
        svgOut += drawComponentDimension(y, h, comp.height);

        if (comp._cfgIdx !== undefined) {
            svgOut += `</g>`;
        }

        y += h;
    });

    return { svg: svgOut, dimLinesY };
}

/* ===== RYSOWANIE PRZEJŚĆ (RUR) ===== */

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

/**
 * Attaches SVG event listeners after render.
 * Uses JS delegation on the SVG element for CSP compliance.
 * Called after every svg.innerHTML = ... in renderWellDiagram.
 */
function attachSvgEvents(svg) {
    svg.querySelectorAll('[data-cfg-idx]').forEach(function (g) {
        var idx = parseInt(g.dataset.cfgIdx, 10);
        g.addEventListener('dragstart', function (e) {
            if (window.handleCfgDragStart) window.handleCfgDragStart(e);
        });
        g.addEventListener('dragend', function (e) {
            if (window.handleCfgDragEnd) window.handleCfgDragEnd(e);
        });
        g.addEventListener('mousedown', function (e) {
            if (window.svgPointerDown) window.svgPointerDown(e, idx);
        });
        g.addEventListener('mouseenter', function (e) {
            if (window.svgPointerEnter) window.svgPointerEnter(e, idx);
        });
        g.addEventListener('mouseleave', function (e) {
            if (window.svgPointerLeave) window.svgPointerLeave(e, idx);
        });
        g.addEventListener('mouseup', function (e) {
            if (window.svgPointerUp) window.svgPointerUp(e, idx);
        });
        g.addEventListener('touchstart', function (e) {
            if (window.svgTouchStart) window.svgTouchStart(e, idx);
        });
        g.addEventListener('touchend', function (e) {
            if (window.svgTouchEnd) window.svgTouchEnd(e);
        });
    });

    svg.querySelectorAll('[data-prz-idx]').forEach(function (g) {
        var idx = parseInt(g.dataset.przIdx, 10);
        g.addEventListener('mouseenter', function (e) {
            if (window.svgPrzPointerEnter) window.svgPrzPointerEnter(e, idx);
        });
        g.addEventListener('mouseleave', function (e) {
            if (window.svgPrzPointerLeave) window.svgPrzPointerLeave(e, idx);
        });
    });
}

/* ===== GŁÓWNA FUNKCJA RENDEROWANIA SCHEMATU ===== */

function renderWellDiagram(targetSvg, targetWell) {
    // BEZWZGLĘDNA REGUŁA: zamień zwykłe kręgi na wiercone i na odwrót w zależności od przejść
    if (!targetWell) {
        if (enforceOtRings()) {
            if (typeof renderWellConfig === 'function') renderWellConfig();
        }
    }

    const svg = targetSvg || document.getElementById('well-diagram');
    const well = targetWell || getCurrentWell();

    if (!svg) return;

    if (!well || well.config.length === 0) {
        svg.setAttribute('viewBox', '0 0 300 500');
        svg.innerHTML = `
      <text x="150" y="240" text-anchor="middle" fill="${SVG_COLORS.dnLabel}" font-size="13" font-family="Inter,sans-serif">Dodaj elementy</text>
      <text x="150" y="260" text-anchor="middle" fill="${SVG_COLORS.emptyState}" font-size="11" font-family="Inter,sans-serif">aby zobaczyć podgląd</text>`;
        attachSvgEvents(svg);
        return;
    }

    // Sortowanie wyłączone - wizualizacja pokazuje elementy W DOKŁADNEJ KOLEJNOŚCI jak w tablicy config
    const visible = buildVisibleComponents(well);

    if (visible.length === 0) {
        svg.setAttribute('viewBox', '0 0 300 500');
        svg.innerHTML = `<text x="150" y="240" text-anchor="middle" fill="${SVG_COLORS.dnLabel}" font-size="12">Brak elementów z wysokością</text>`;
        attachSvgEvents(svg);
        return;
    }

    const bodyDN = well.dn;
    const canvas = /** @type {any} */ (calculateCanvasParams(visible, bodyDN));
    canvas.bodyDN = bodyDN;

    svg.setAttribute('viewBox', `0 0 ${canvas.svgW} ${canvas.svgH}`);

    // Rysowanie elementów studni (kręgi, płyty, konus, dennica, itp.)
    const { svg: componentsSvg, dimLinesY } = drawAllComponents(visible, canvas);

    // Rysowanie przejść (rury)
    const transitionsSvg = drawTransitions(well, canvas, dimLinesY);

    // Linia wysokości wkładki PRECO (przerywana czerwona)
    const precoLineSvg = drawPrecoInsertLine(well, canvas);

    // Zunifikowana linia wymiarowa segmentów
    const segmentDimSvg = drawSegmentDimensions(dimLinesY, canvas.pxMm, well, canvas);

    // Łączna wysokość studni (pasek po lewej)
    const totalHeightSvg = drawTotalHeightBar(canvas, canvas.totalMm);

    // Oznaczenie DN na dole
    const dnLabelSvg = drawDnLabel(canvas.cx, bodyDN, canvas);

    svg.innerHTML =
        componentsSvg + transitionsSvg + precoLineSvg + segmentDimSvg + totalHeightSvg + dnLabelSvg;
    attachSvgEvents(svg);
}
