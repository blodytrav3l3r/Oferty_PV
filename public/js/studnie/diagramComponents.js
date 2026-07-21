// @ts-check
/**
 * diagramComponents.js — Budowanie i rysowanie komponentów studni na diagramie SVG.
 *
 * Wyodrębnione z wellDiagram.js (faza 2 refaktoryzacji).
 *
 * Zawiera:
 *   buildVisibleComponents()    — buduje tablicę widocznych komponentów z config
 *   getElementOuterDn()         — pobiera wizualną szerokość zewnętrzną elementu
 *   calculateCanvasParams()     — oblicza parametry skalowania i wymiarów canvas SVG
 *   drawComponentShape()        — generuje SVG kształtu dla jednego komponentu
 *   drawComponentLabel()        — generuje etykietę tekstową wewnątrz komponentu
 *   drawComponentDimension()    — generuje wymiarówkę (lewa strona) dla komponentu
 *   drawAllComponents()         — iteruje po komponentach i generuje pełny SVG
 *
 * Zależności globalne:
 *   SVG_COLORS, COMPONENT_THEME (diagramTheme.js)
 *   studnieProducts
 */

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
        const coneH = Math.min(625, comp.height || h / pxMm);
        const coneHpx = coneH * pxMm;
        const ringHpx = Math.max(0, h - coneHpx);
        if (ringHpx > 2) {
            const ringY = y + h - ringHpx;
            svg += `<rect x="${x}" y="${ringY}" width="${w}" height="${ringHpx}" rx="2" fill="${c.fill}" stroke="${c.stroke}" stroke-width="1.5" opacity="0.85"/>`;
            svg += `<polygon points="${topX},${y} ${topX + topW},${y} ${x + w},${ringY} ${x},${ringY}" fill="${c.fill}" stroke="${c.stroke}" stroke-width="1.5" opacity="0.85"/>`;
        } else {
            svg += `<polygon points="${topX},${y} ${topX + topW},${y} ${x + w},${y + h} ${x},${y + h}" fill="${c.fill}" stroke="${c.stroke}" stroke-width="1.5" opacity="0.85"/>`;
        }
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
        if (comp._cfgIdx !== undefined) {
            svgOut +=
                `<g class="diag-comp-grp svg-cfg-${comp._cfgIdx}" style="transition:all 0.2s; ${plStyle}" cursor="grab" ${pointerEvents} ` +
                `data-cfg-idx="${comp._cfgIdx}" draggable="true" ` +
                `ondragstart="window.handleCfgDragStart(event)" ` +
                `ondragend="window.handleCfgDragEnd(event)" ` +
                `onmousedown="window.svgPointerDown(event, ${comp._cfgIdx})" ` +
                `onmouseenter="window.svgPointerEnter(event, ${comp._cfgIdx})" ` +
                `onmouseleave="window.svgPointerLeave(event, ${comp._cfgIdx})" ` +
                `onmouseup="window.svgPointerUp(event, ${comp._cfgIdx})" ` +
                `ontouchstart="window.svgTouchStart(event, ${comp._cfgIdx})" ` +
                `ontouchend="window.svgTouchEnd(event)">`;
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
