/* ===== PODŚWIETLANIE SVG ===== */
window.highlightSvg = function (type, index) {
    document.querySelectorAll('.svg-' + type + '-' + index).forEach((el) => {
        el.style.filter = 'drop-shadow(0px 0px 8px rgba(96, 165, 250, 0.9)) brightness(1.3)';
    });

    // Automatycznie podświetl odpowiedni kafel listy
    if (type === 'cfg') {
        const tile = document.querySelector('.config-tile[data-cfg-idx="' + index + '"]');
        if (tile) tile.style.filter = 'brightness(1.1)';
    } else if (type === 'prz') {
        const tile = document.querySelector('div[data-prz-idx="' + index + '"]');
        if (tile) tile.style.filter = 'brightness(1.1)';
    }
};
window.unhighlightSvg = function (type, index) {
    document.querySelectorAll('.svg-' + type + '-' + index).forEach((el) => {
        el.style.filter = '';
    });

    if (type === 'cfg') {
        const tile = document.querySelector('.config-tile[data-cfg-idx="' + index + '"]');
        if (tile) tile.style.filter = 'brightness(1)';
    } else if (type === 'prz') {
        const tile = document.querySelector('div[data-prz-idx="' + index + '"]');
        if (tile) tile.style.filter = 'brightness(1)';
    }
};

window.svgPointerEnter = function (ev, idx) {
    if (window.svgDragStartIndex >= 0) return; // blokowanie hovera w trkacie ciągnięcia
    window.highlightSvg('cfg', idx);
};

window.svgPointerLeave = function (ev, idx) {
    window.unhighlightSvg('cfg', idx);
};

window.svgPrzPointerEnter = function (ev, idx) {
    if (window.svgDragStartIndex >= 0) return;
    window.highlightSvg('prz', idx);
};

window.svgPrzPointerLeave = function (ev, idx) {
    window.unhighlightSvg('prz', idx);
};

/* ===== SCHEMAT STUDNI (SVG) ===== */

/**
 * ZASADA BEZWZGLĘDNA: Krąg z przejściem = ZAWSZE krąg wiercony.
 * Automatycznie zamienia zwykły krag na krag_ot w konfiguracji studni
 * jeśli w pozycji kręgu mieści się otwór przejścia.
 * Wywoływane PRZY KAŻDYM renderowaniu — dotyczy trybu auto I ręcznego.
 * NIE DO ZMIANY!
 */
function enforceOtRings() {
    const well = typeof getCurrentWell === 'function' ? getCurrentWell() : null;
    if (!well || !well.config) return false;

    const rzDna = well.rzednaDna != null ? parseFloat(well.rzednaDna) : null;
    if (rzDna === null || isNaN(rzDna)) return false;

    // Zbuduj segmenty z config (bottom-up)
    const segments = [];
    let cy = 0;

    let mutated = false;

    // Config jest od góry (właz) do dołu (dennica) — iteruj od końca
    const configReversed = [...well.config].reverse();
    let lastWasDennica = !!well.psiaBuda;
    for (const item of configReversed) {
        const p = studnieProducts.find((pr) => pr.id === item.productId);
        if (!p || !p.height) continue;
        const qty = item.quantity || 1;
        for (let i = 0; i < qty; i++) {
            let actualHeight = p.height || 0;
            if (p.componentType === 'dennica' && lastWasDennica) {
                actualHeight -= 100;
            }

            segments.push({
                type: p.componentType,
                start: cy,
                end: cy + actualHeight,
                configItem: item,
                product: p
            });
            cy += actualHeight;
            lastWasDennica = (p.componentType === 'dennica');
        }
    }

    // Iterujemy po segmentach by sprawdzić czy mają otwór
    for (const seg of segments) {
        if (seg.type !== 'krag' && seg.type !== 'krag_ot') continue;
        mutated = enforceOtForSegment(seg, well, rzDna) || mutated;
    }
    return mutated;
}

/**
 * Sprawdza i wymusza zamianę kręgu na wiercony (lub odwrotnie) dla jednego segmentu.
 * Wydzielone z enforceOtRings aby zmniejszyć zagnieżdżenia.
 */
function enforceOtForSegment(seg, well, rzDna) {
    const currentProd = seg.product;
    const currentId = seg.configItem.productId;

    const hasHole = checkSegmentHasHole(seg, well, rzDna);

    const isCurrentlyOt =
        currentProd.componentType === 'krag_ot' ||
        currentId.endsWith('_OT') ||
        currentId.toLowerCase().includes('-ot');

    if (hasHole && !isCurrentlyOt) {
        return upgradeToOtRing(seg, currentProd, currentId);
    }
    if (!hasHole && isCurrentlyOt) {
        return degradeFromOtRing(seg, currentProd, currentId);
    }
    return false;
}

/**
 * Sprawdza czy w danym segmencie kręgu znajduje się otwór przejścia.
 */
function checkSegmentHasHole(seg, well, rzDna) {
    if (!well.przejscia || well.przejscia.length === 0) return false;

    for (const pr of well.przejscia) {
        const pel = parseFloat(pr.rzednaWlaczenia);
        if (isNaN(pel)) continue;

        const mmFromBottom = (pel - rzDna) * 1000;
        const pprod = studnieProducts.find((x) => x.id === pr.productId);
        if (!pprod) continue;

        let prDN = 160;
        if (pprod.dn && typeof pprod.dn === 'string' && pprod.dn.includes('/')) {
            prDN = parseFloat(pprod.dn.split('/')[1]) || 160;
        } else if (pprod.dn) {
            prDN = parseFloat(pprod.dn) || 160;
        }

        const holeCenter = mmFromBottom + prDN / 2;
        if (holeCenter >= seg.start && holeCenter < seg.end) {
            return true;
        }
    }
    return false;
}

/**
 * Zamienia zwykły krąg na wiercony (OT) — szuka w katalogu lub tworzy dynamiczny.
 */
function upgradeToOtRing(seg, currentProd, currentId) {
    const otProd = studnieProducts.find(
        (p) =>
            p.componentType === 'krag_ot' &&
            p.dn === currentProd.dn &&
            p.height === currentProd.height
    );

    if (otProd) {
        if (seg.configItem.productId !== otProd.id) {
            seg.configItem.productId = otProd.id;
            console.log(`[enforceOT] Zamiana ${currentId} → ${otProd.id} (krąg wiercony z katalogu)`);
            return true;
        }
        return false;
    }

    // Dynamiczny OT
    const dynamicOtId = currentId + '_OT';
    if (!studnieProducts.find((p) => p.id === dynamicOtId)) {
        const dynamicProd = JSON.parse(JSON.stringify(currentProd));
        dynamicProd.id = dynamicOtId;
        dynamicProd.componentType = 'krag_ot';
        if (!dynamicProd.name.includes('wiercony')) {
            dynamicProd.name = dynamicProd.name.replace('Krąg', 'Krąg wiercony');
        }
        studnieProducts.push(dynamicProd);
    }
    if (seg.configItem.productId !== dynamicOtId) {
        seg.configItem.productId = dynamicOtId;
        console.log(`[enforceOT] Zamiana ${currentId} → ${dynamicOtId} (dynamiczny OT)`);
        return true;
    }
    return false;
}

/**
 * Degradacja kręgu wierconego (OT) na zwykły — gdy nie ma przejścia.
 */
function degradeFromOtRing(seg, currentProd, currentId) {
    // Najbezpieczniejsza degradacja: znajdź zwykły krąg o tym samym wymiarze
    const stdProd = studnieProducts.find(
        (p) =>
            p.componentType === 'krag' &&
            p.dn === currentProd.dn &&
            p.height === currentProd.height
    );

    if (stdProd) {
        if (seg.configItem.productId !== stdProd.id) {
            seg.configItem.productId = stdProd.id;
            console.log(`[enforceOT] Zamiana ${currentId} → ${stdProd.id} (powrót do kręgu)`);
            return true;
        }
        return false;
    }

    // Fallback jeśli krąg nie jest standardowy, spróbujmy odciąć _OT
    const baseStripped = currentId.replace(/[_-]OT$/i, '');
    const baseProduct = studnieProducts.find((p) => p.id === baseStripped);
    if (baseProduct && seg.configItem.productId !== baseProduct.id) {
        seg.configItem.productId = baseProduct.id;
        console.log(`[enforceOT] Zamiana ${currentId} → ${baseProduct.id} (dynamiczny powrót)`);
        return true;
    }
    // BARDZO WAŻNE: Jeśli nie znaleziono bazy, NIE nadpisujemy na nieistniejące ID,
    // by zapobiec ucięciu z renderowania ('nie usuwa ich')
    return false;
}

/* ===== KOLORY I TYPY KOMPONENTÓW ===== */

/** Mapa kolorów i etykiet dla typów komponentów studni */
const COMPONENT_THEME = {
    wlaz: { fill: '#1e293b', stroke: '#334155', label: 'Właz' },
    plyta_din: { fill: '#be185d', stroke: '#ec4899', label: 'Płyta DIN' },
    plyta_najazdowa: { fill: '#9d174d', stroke: '#f472b6', label: 'Pł. Odci.' },
    plyta_zamykajaca: { fill: '#7c3aed', stroke: '#a78bfa', label: 'Pł. Odci.' },
    pierscien_odciazajacy: { fill: '#0891b2', stroke: '#22d3ee', label: 'PO' },
    konus: { fill: '#d97706', stroke: '#fbbf24', label: 'Konus' },
    avr: { fill: '#475569', stroke: '#94a3b8', label: 'AVR' },
    krag: { fill: '#4338ca', stroke: '#818cf8', label: 'Krąg' },
    krag_ot: { fill: '#4338ca', stroke: '#c084fc', label: 'Krąg wiercony' },
    osadnik: { fill: '#a16207', stroke: '#fbbf24', label: 'Osadnik' },
    dennica: { fill: '#047857', stroke: '#34d399', label: 'Dennica' },
    styczna: { fill: '#059669', stroke: '#34d399', label: 'Styczna' },
    plyta_redukcyjna: { fill: '#6d28d9', stroke: '#a78bfa', label: 'Płyta red.' }
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
                lastWasDennica = (p.componentType === 'dennica');
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
    const mL = 75, mR = 25, mT = 15, mB = 22;
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
        const rx = (ct === 'avr' || ct === 'plyta_din' || ct === 'plyta_redukcyjna' ||
                    ct === 'plyta_zamykajaca' || ct === 'pierscien_odciazajacy' ||
                    ct === 'plyta_najazdowa') ? 2 : 2;
        svg += `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${rx}" fill="${c.fill}" stroke="${c.stroke}" stroke-width="1.5" opacity="0.85"/>`;

        // Otwory wierconego kręgu
        if (ct === 'krag_ot') {
            const hr = Math.min(h * 0.15, 7);
            if (hr > 2) {
                svg += `<circle cx="${x + 10}" cy="${y + h / 2}" r="${hr}" fill="rgba(15,23,42,0.7)" stroke="${c.stroke}" stroke-width="0.8"/>`;
                svg += `<circle cx="${x + w - 10}" cy="${y + h / 2}" r="${hr}" fill="rgba(15,23,42,0.7)" stroke="${c.stroke}" stroke-width="0.8"/>`;
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
        return `<text x="${cx}" y="${y + h / 2 + 4}" text-anchor="middle" fill="white" font-size="${fontSize}" font-family="Inter,sans-serif" font-weight="700" opacity="0.95">${label}</text>`;
    }
    if (h > 8) {
        return `<text x="${cx}" y="${y + h / 2 + 3}" text-anchor="middle" fill="white" font-size="9" font-family="Inter,sans-serif" font-weight="600" opacity="0.8">${label}</text>`;
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
    svg += `<line x1="${dx}" y1="${y + 1}" x2="${dx}" y2="${y + h - 1}" stroke="#94a3b8" stroke-width="0.7"/>`;
    // Kreski poziome (górny i dolny tick)
    svg += `<line x1="${dx - 3}" y1="${y + 1}" x2="${dx + 3}" y2="${y + 1}" stroke="#94a3b8" stroke-width="0.7"/>`;
    svg += `<line x1="${dx - 3}" y1="${y + h - 1}" x2="${dx + 3}" y2="${y + h - 1}" stroke="#94a3b8" stroke-width="0.7"/>`;
    // Tekst wymiaru (pionowo z lewej strony)
    const dimFontSize = Math.min(11, Math.max(8, h * 0.3));
    svg += `<text x="${dx - 4}" y="${y + h / 2}" transform="rotate(-90 ${dx - 4} ${y + h / 2})" text-anchor="middle" fill="#cbd5e1" font-size="${dimFontSize}" font-family="Inter,sans-serif" font-weight="600">${heightMm}</text>`;
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

        const c = COMPONENT_THEME[comp.componentType] || { fill: '#334155', stroke: '#64748b', label: '' };

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
        const numericBodyDN = typeof bodyDN === 'number'
            ? bodyDN
            : 1000;
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
    let prW = 160, prH = 160, isEgg = false, isRect = false;

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
    const pColor = isBack ? 'rgba(71,85,105,0.4)' : '#38bdf8';
    const sColor = isBack ? 'rgba(100,116,139,0.5)' : '#0ea5e9';
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
    return `<text x="${px}" y="${prY + 3.5}" text-anchor="middle" fill="#ffffff" font-size="${fSz}" font-weight="800" font-family="Inter,sans-serif" style="text-shadow: 1px 1px 2px rgba(0,0,0,0.8);">${angle}°</text>`;
}

/**
 * Generuje delikatną linię pomocniczą łączącą przejście z osią wymiarową.
 */
function drawTransitionGuideLine(px, prY, radiusW, isBack) {
    const dimColor = isBack ? '#64748b' : '#38bdf8';
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
    const uniqueY = [...new Set(dimLinesY.map((v) => Math.round(v * 10) / 10))].sort((a, b) => b - a);
    const dX = 52;
    const dimColor = '#94a3b8';

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
        const textColor = isPipe ? '#38bdf8' : '#cbd5e1';
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
    const aDimColor = '#94a3b8';

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
    return `<text x="${cx}" y="${mT + drawH + mB - 2}" text-anchor="middle" fill="#64748b" font-size="11" font-family="Inter,sans-serif" font-weight="600">${labelDN}</text>`;
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

    if (!well || well.config.length === 0) {
        svg.setAttribute('viewBox', '0 0 300 500');
        svg.innerHTML = `
      <text x="150" y="240" text-anchor="middle" fill="#64748b" font-size="13" font-family="Inter,sans-serif">Dodaj elementy</text>
      <text x="150" y="260" text-anchor="middle" fill="#475569" font-size="11" font-family="Inter,sans-serif">aby zobaczyć podgląd</text>`;
        return;
    }

    // Sortowanie wyłączone - wizualizacja pokazuje elementy W DOKŁADNEJ KOLEJNOŚCI jak w tablicy config
    const visible = buildVisibleComponents(well);

    if (visible.length === 0) {
        svg.setAttribute('viewBox', '0 0 300 500');
        svg.innerHTML = `<text x="150" y="240" text-anchor="middle" fill="#64748b" font-size="12">Brak elementów z wysokością</text>`;
        return;
    }

    const bodyDN = well.dn;
    const canvas = calculateCanvasParams(visible, bodyDN);
    canvas.bodyDN = bodyDN;

    svg.setAttribute('viewBox', `0 0 ${canvas.svgW} ${canvas.svgH}`);

    // Rysowanie elementów studni (kręgi, płyty, konus, dennica, itp.)
    const { svg: componentsSvg, dimLinesY } = drawAllComponents(visible, canvas);

    // Rysowanie przejść (rury)
    const transitionsSvg = drawTransitions(well, canvas, dimLinesY);

    // Zunifikowana linia wymiarowa segmentów
    const segmentDimSvg = drawSegmentDimensions(dimLinesY, canvas.pxMm, well, canvas);

    // Łączna wysokość studni (pasek po lewej)
    const totalHeightSvg = drawTotalHeightBar(canvas, canvas.totalMm);

    // Oznaczenie DN na dole
    const dnLabelSvg = drawDnLabel(canvas.cx, bodyDN, canvas);

    svg.innerHTML = componentsSvg + transitionsSvg + segmentDimSvg + totalHeightSvg + dnLabelSvg;
}
