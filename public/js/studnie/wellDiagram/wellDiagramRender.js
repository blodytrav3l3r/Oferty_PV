// @ts-check
/* ===== WELL DIAGRAM — Renderowanie SVG (rdzeń) ===== */

const SVG_COLORS = {
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
                _cfgIdx: well.config.length - 1 - revIdx,
                _isFirst: i === 0,
                _isLast: i === item.quantity - 1,
                isPlaceholder: !!item.isPlaceholder
            });
            if (p.componentType !== 'uszczelka') {
                lastWasDennica = p.componentType === 'dennica';
            }
        }
    });

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

function getElementOuterDn(comp, bodyDN) {
    const ct = comp.componentType;
    let prodDn = comp.dn && typeof comp.dn === 'number' ? comp.dn : bodyDN;
    if (typeof prodDn !== 'number') prodDn = 1000;

    switch (ct) {
        case 'wlaz':
            return 600;
        case 'avr':
            return 625;
        case 'konus':
            return prodDn;
        case 'plyta_din':
            return prodDn;
        case 'plyta_redukcyjna':
            return prodDn;
        case 'plyta_zamykajaca':
        case 'pierscien_odciazajacy':
            return prodDn + 200;
        case 'plyta_najazdowa':
            return prodDn + 200;
        case 'dennica':
        case 'krag':
        case 'krag_ot':
        case 'osadnik':
        default:
            return prodDn;
    }
}

function calculateCanvasParams(visible, bodyDN) {
    const svgW = 340;
    const mL = 75,
        mR = 25,
        mT = 15,
        mB = 22;
    const drawW = svgW - mL - mR;

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
        const rx = 2;
        svg += `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${rx}" fill="${c.fill}" stroke="${c.stroke}" stroke-width="1.5" opacity="0.85"/>`;

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

function drawComponentDimension(y, h, heightMm) {
    if (h <= 6) return '';

    const dx = 32;
    let svg = '';
    svg += `<line x1="${dx}" y1="${y + 1}" x2="${dx}" y2="${y + h - 1}" stroke="${SVG_COLORS.dimLine}" stroke-width="0.7"/>`;
    svg += `<line x1="${dx - 3}" y1="${y + 1}" x2="${dx + 3}" y2="${y + 1}" stroke="${SVG_COLORS.dimLine}" stroke-width="0.7"/>`;
    svg += `<line x1="${dx - 3}" y1="${y + h - 1}" x2="${dx + 3}" y2="${y + h - 1}" stroke="${SVG_COLORS.dimLine}" stroke-width="0.7"/>`;
    const dimFontSize = Math.min(11, Math.max(8, h * 0.3));
    svg += `<text x="${dx - 4}" y="${y + h / 2}" transform="rotate(-90 ${dx - 4} ${y + h / 2})" text-anchor="middle" fill="${SVG_COLORS.dimText}" font-size="${dimFontSize}" font-family="Inter,sans-serif" font-weight="600">${heightMm}</text>`;
    return svg;
}

function drawAllComponents(visible, canvas) {
    const { pxMm, cx, mT } = canvas;
    const bodyDN = canvas.bodyDN;
    const mmToPx = (mm) => mm * pxMm;

    let svgOut = '';
    let y = mT;
    const dimLinesY = [];

    visible.forEach((comp) => {
        let h = (comp.height || 0) * pxMm;

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

function renderWellDiagram(targetSvg, targetWell) {
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

    const { svg: componentsSvg, dimLinesY } = drawAllComponents(visible, canvas);

    const transitionsSvg = drawTransitions(well, canvas, dimLinesY);
    const precoLineSvg = drawPrecoInsertLine(well, canvas);
    const segmentDimSvg = drawSegmentDimensions(dimLinesY, canvas.pxMm, well, canvas);
    const totalHeightSvg = drawTotalHeightBar(canvas, canvas.totalMm);
    const dnLabelSvg = drawDnLabel(canvas.cx, bodyDN, canvas);

    svg.innerHTML =
        componentsSvg + transitionsSvg + precoLineSvg + segmentDimSvg + totalHeightSvg + dnLabelSvg;
    attachSvgEvents(svg);
}
