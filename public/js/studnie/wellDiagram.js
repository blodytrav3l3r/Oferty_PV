/* ===== SVG HIGHLIGHTING ===== */
window.highlightSvg = function (type, index) {
    document.querySelectorAll('.svg-' + type + '-' + index).forEach((el) => {
        el.style.filter = 'drop-shadow(0px 0px 8px rgba(96, 165, 250, 0.9)) brightness(1.3)';
    });

    // Auto-highlight corresponding list tile
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

/* ===== WELL DIAGRAM (SVG) ===== */

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
    for (const item of configReversed) {
        const p = studnieProducts.find((pr) => pr.id === item.productId);
        if (!p || !p.height) continue;
        const qty = item.quantity || 1;
        for (let i = 0; i < qty; i++) {
            segments.push({
                type: p.componentType,
                start: cy,
                end: cy + (p.height || 0),
                configItem: item,
                product: p
            });
            cy += p.height || 0;
        }
    }

    // Iterujemy po segmentach by sprawdzić czy mają otwór
    for (const seg of segments) {
        if (seg.type !== 'krag' && seg.type !== 'krag_ot') continue;

        let hasHole = false;
        const currentProd = seg.product;
        const currentId = seg.configItem.productId;

        // Sprawdzamy czy któreś przejście przypada na ten krąg
        if (well.przejscia && well.przejscia.length > 0) {
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
                    hasHole = true;
                    break;
                }
            }
        }

        const isCurrentlyOt =
            currentProd.componentType === 'krag_ot' ||
            currentId.endsWith('_OT') ||
            currentId.toLowerCase().includes('-ot');

        if (hasHole) {
            // TEN KRĄG MA PRZEJŚCIE → ZAMIEŃ NA WIERCONY
            if (!isCurrentlyOt) {
                // Szukaj wariantu OT w katalogu
                const otProd = studnieProducts.find(
                    (p) =>
                        p.componentType === 'krag_ot' &&
                        p.dn === currentProd.dn &&
                        p.height === currentProd.height
                );

                if (otProd) {
                    if (seg.configItem.productId !== otProd.id) {
                        seg.configItem.productId = otProd.id;
                        mutated = true;
                        console.log(
                            `[enforceOT] Zamiana ${currentId} → ${otProd.id} (krąg wiercony z katalogu)`
                        );
                    }
                } else {
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
                        mutated = true;
                        console.log(
                            `[enforceOT] Zamiana ${currentId} → ${dynamicOtId} (dynamiczny OT)`
                        );
                    }
                }
            }
        } else {
            // NIE MA OTWORU → DEGRADACJA JEŚLI BYŁ OT
            if (isCurrentlyOt) {
                // Najbezpieczniejsza degradacja: znajdź zwykły krąg o tym samym wymiarze w konfiguracji
                const stdProd = studnieProducts.find(
                    (p) =>
                        p.componentType === 'krag' &&
                        p.dn === currentProd.dn &&
                        p.height === currentProd.height
                );

                if (stdProd) {
                    if (seg.configItem.productId !== stdProd.id) {
                        seg.configItem.productId = stdProd.id;
                        mutated = true;
                        console.log(
                            `[enforceOT] Zamiana ${currentId} → ${stdProd.id} (powrót do kręgu)`
                        );
                    }
                } else {
                    // Fallback jeśli krąg nie jest standardowy, spróbujmy odciąć _OT
                    const baseStripped = currentId.replace(/[_-]OT$/i, '');
                    const baseProduct = studnieProducts.find((p) => p.id === baseStripped);
                    if (baseProduct) {
                        if (seg.configItem.productId !== baseProduct.id) {
                            seg.configItem.productId = baseProduct.id;
                            mutated = true;
                            console.log(
                                `[enforceOT] Zamiana ${currentId} → ${baseProduct.id} (dynamiczny powrót)`
                            );
                        }
                    }
                    // BARDZO WAŻNE: Jeśli nie znaleziono bazy, NIE nadpisujemy na nieistniejące ID,
                    // by zapobiec ucięciu z renderowania ('nie usuwa ich')
                }
            }
        }
    }
    return mutated;
}

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

    const typeOrder = {
        wlaz: 1, // Właz na samej górze
        avr: 2, // Pierścienie poniżej włazu
        plyta_din: 3, // Zwieńczenie
        plyta_najazdowa: 3,
        plyta_zamykajaca: 3, // Płyta odciążająca wyżej niż kręgi
        konus: 3, // Konus zamiennie z płytami na tej samej wysokości domyślnej
        pierscien_odciazajacy: 4, // Pierścień poniżej płyty
        krag: 5, // Kręgi pod spodem
        krag_ot: 5,
        osadnik: 5.5, // Osadnik pod krągami
        dennica: 6, // Dno na dole
        plyta_redukcyjna: 7
    };

    let totalDennice = 0;
    well.config.forEach((item) => {
        const p = studnieProducts.find((pr) => pr.id === item.productId);
        if (p && p.componentType === 'dennica') totalDennice += item.quantity;
    });

    const components = [];
    let currentDennica = 0;
    well.config.forEach((item, index) => {
        const p = studnieProducts.find((pr) => pr.id === item.productId);
        if (!p) return;
        for (let i = 0; i < item.quantity; i++) {
            let effH = p.height || 0;
            if (p.componentType === 'dennica') {
                currentDennica++;
                // The bottom-most dennica remains full height. Others get -100mm.
                if (currentDennica < totalDennice) {
                    effH = Math.max(0, effH - 100);
                }
            }
            components.push({
                ...p,
                height: effH,
                _originalHeight: p.height,
                _cfgIdx: index,
                _isFirst: i === 0,
                _isLast: i === item.quantity - 1,
                isPlaceholder: !!item.isPlaceholder
            });
        }
    });

    const visible = components.filter(
        (c) =>
            c.componentType !== 'uszczelka' &&
            ((c.height || 0) > 0 ||
                c.componentType === 'wlaz' ||
                c.componentType === 'plyta_zamykajaca' ||
                c.componentType === 'plyta_najazdowa')
    );

    // Sortowanie wyłączone - wizualizacja pokazuje elementy W DOKŁADNEJ KOLEJNOŚCI jak w tablicy config,
    // co pozwala na ręczne manipulowanie kolejnością!

    if (visible.length === 0) {
        svg.setAttribute('viewBox', '0 0 300 500');
        svg.innerHTML = `<text x="150" y="240" text-anchor="middle" fill="#64748b" font-size="12">Brak elementów z wysokością</text>`;
        return;
    }

    const totalMm = visible.reduce((s, c) => {
        let h = c.height || 0;
        return s + (h === 0 ? 18 / pxMm : h);
    }, 0);
    const bodyDN = well.dn;

    // Canvas
    const svgW = 340;
    const mL = 75,
        mR = 25,
        mT = 15,
        mB = 22; // mL=75 dla szerszego pasa wymiarowego po lewej
    const drawW = svgW - mL - mR;

    // ── Real physical outer diameters for each element type ──
    // Konus: bottom = well DN, top = 625mm standard opening
    // Płyta DIN: outer = well DN, 625mm opening hole
    // Płyta redukcyjna: outer = well DN (e.g. 1200), transitions to 1000 below
    // Płyta zamykająca / pierścień odciążający: outer rim = well DN + ~200mm
    // Płyta najazdowa: square plate = well DN + ~200mm
    // Właz: standard 600mm manhole cover
    // AVR: standard 625mm adjustment ring
    // Kręgi, dennica, osadnik: = well DN (from product dn field)

    // Get the visual outer width (in mm) for diagram rendering
    function getElementOuterDn(comp) {
        const ct = comp.componentType;
        let prodDn = comp.dn && typeof comp.dn === 'number' ? comp.dn : bodyDN;
        if (typeof prodDn !== 'number') prodDn = 1000;

        switch (ct) {
            case 'wlaz':
                return 600; // standard manhole cover diameter
            case 'avr':
                return 625; // standard adjustment ring
            case 'konus':
                return prodDn; // bottom width = well DN (top is 625, handled in rendering)
            case 'plyta_din':
                return prodDn; // coincides with well DN
            case 'plyta_redukcyjna':
                return prodDn; // outer = well DN
            case 'plyta_zamykajaca':
            case 'pierscien_odciazajacy':
                return prodDn + 200; // outer rim extends beyond well shaft
            case 'plyta_najazdowa':
                return prodDn + 200; // square plate extends beyond well shaft
            case 'dennica':
            case 'krag':
            case 'krag_ot':
            case 'osadnik':
            default:
                return prodDn;
        }
    }

    // Przewidzenie najszerszego elementu — bazujemy na DN studni (kręgi nadbudowy)
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

    // Skaler: stała proporcja dopasowana do szerokości okna
    const pxMm = drawW / maxElemWidth;

    const drawH = totalMm * pxMm;
    const svgH = drawH + mT + mB;
    svg.setAttribute('viewBox', `0 0 ${svgW} ${svgH}`);

    // Zwraca piksele z milimetrów
    const mmToPx = (mm) => mm * pxMm;
    const cx = mL + drawW / 2;

    const TC = {
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

    let svg_out = '';
    let y = mT;

    let dimLinesY = [];

    visible.forEach((comp) => {
        let h = (comp.height || 0) * pxMm;

        // Syntetyczna grubość rysowania dla elementów bez fizycznej wysokości "height"
        if (h === 0) {
            h = 18; // px wymuszone wizualnie, by element był nakładką
        }

        dimLinesY.push(y);
        dimLinesY.push(y + h);

        const outerDn = getElementOuterDn(comp);
        const w = Math.max(mmToPx(outerDn), 20);
        const x = cx - w / 2;

        let localCompType = comp.componentType;
        const c = TC[localCompType] || { fill: '#334155', stroke: '#64748b', label: '' };

        const isPlaceholder = comp.isPlaceholder;
        const pointerEvents = isPlaceholder ? 'pointer-events="none"' : '';
        const plStyle = isPlaceholder
            ? 'opacity:0.6; filter:drop-shadow(0px 0px 8px rgba(96, 165, 250, 0.9));'
            : '';

        if (comp._cfgIdx !== undefined) {
            svg_out +=
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

        if (localCompType === 'konus') {
            // Konus: trapezoid — top = 625mm opening, bottom = well DN
            const topW = Math.max(mmToPx(625), 20);
            const topX = cx - topW / 2;
            svg_out += `<polygon points="${topX},${y} ${topX + topW},${y} ${x + w},${y + h} ${x},${y + h}" fill="${c.fill}" stroke="${c.stroke}" stroke-width="1.5" opacity="0.85"/>`;
        } else if (localCompType === 'dennica' || localCompType === 'styczna') {
            // Dennica or Styczna: rectangle with thick bottom line
            svg_out += `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="3" fill="${c.fill}" stroke="${c.stroke}" stroke-width="1.5" opacity="0.85"/>`;
            svg_out += `<line x1="${x}" y1="${y + h}" x2="${x + w}" y2="${y + h}" stroke="${c.stroke}" stroke-width="3"/>`;
        } else if (localCompType === 'plyta_redukcyjna') {
            // Płyta redukcyjna: prostokąt o szerokości DN studni
            svg_out += `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="2" fill="${c.fill}" stroke="${c.stroke}" stroke-width="1.5" opacity="0.85"/>`;
        } else if (
            localCompType === 'plyta_zamykajaca' ||
            localCompType === 'pierscien_odciazajacy'
        ) {
            // Wider plate/ring with outer rim
            svg_out += `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="2" fill="${c.fill}" stroke="${c.stroke}" stroke-width="1.5" opacity="0.85"/>`;
        } else if (localCompType === 'plyta_najazdowa') {
            // Square drive-over plate
            svg_out += `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="2" fill="${c.fill}" stroke="${c.stroke}" stroke-width="1.5" opacity="0.85"/>`;
        } else if (localCompType === 'plyta_din') {
            // Same width as well shaft
            svg_out += `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="2" fill="${c.fill}" stroke="${c.stroke}" stroke-width="1.5" opacity="0.85"/>`;
        } else if (localCompType === 'wlaz') {
            // Właz: 600mm manhole cover
            svg_out += `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="1" fill="${c.fill}" stroke="${c.stroke}" stroke-width="1.5" opacity="0.95"/>`;
        } else if (localCompType === 'avr') {
            // AVR: 625mm adjustment ring
            svg_out += `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="2" fill="${c.fill}" stroke="${c.stroke}" stroke-width="1.5" opacity="0.85"/>`;
        } else if (localCompType === 'osadnik') {
            svg_out += `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="3" fill="${c.fill}" stroke="${c.stroke}" stroke-width="1.5" opacity="0.85"/>`;
            const oy = y + h * 0.65;
            svg_out += `<line x1="${x + 4}" y1="${oy}" x2="${x + w - 4}" y2="${oy}" stroke="${c.stroke}" stroke-width="0.7" stroke-dasharray="3,2" opacity="0.6"/>`;
            svg_out += `<line x1="${x + 4}" y1="${oy + h * 0.15}" x2="${x + w - 4}" y2="${oy + h * 0.15}" stroke="${c.stroke}" stroke-width="0.5" stroke-dasharray="2,2" opacity="0.4"/>`;
        } else {
            // Kręgi and other elements
            svg_out += `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="2" fill="${c.fill}" stroke="${c.stroke}" stroke-width="1.5" opacity="0.85"/>`;
            if (localCompType === 'krag_ot') {
                const hr = Math.min(h * 0.15, 7);
                if (hr > 2) {
                    svg_out += `<circle cx="${x + 10}" cy="${y + h / 2}" r="${hr}" fill="rgba(15,23,42,0.7)" stroke="${c.stroke}" stroke-width="0.8"/>`;
                    svg_out += `<circle cx="${x + w - 10}" cy="${y + h / 2}" r="${hr}" fill="rgba(15,23,42,0.7)" stroke="${c.stroke}" stroke-width="0.8"/>`;
                }
            }
        }

        // ── Label wewnątrz elementu ──
        if (h > 18) {
            const fontSize = Math.min(13, Math.max(10, h * 0.35));
            svg_out += `<text x="${cx}" y="${y + h / 2 + 4}" text-anchor="middle" fill="white" font-size="${fontSize}" font-family="Inter,sans-serif" font-weight="700" opacity="0.95">${c.label}</text>`;
        } else if (h > 8) {
            svg_out += `<text x="${cx}" y="${y + h / 2 + 3}" text-anchor="middle" fill="white" font-size="9" font-family="Inter,sans-serif" font-weight="600" opacity="0.8">${c.label}</text>`;
        }

        // ── Wymiar elementu (przeniesiony z prawej na lewą) ──
        if (h > 6) {
            const dx = 32;
            // Kreska pionowa wymiaru
            svg_out += `<line x1="${dx}" y1="${y + 1}" x2="${dx}" y2="${y + h - 1}" stroke="#94a3b8" stroke-width="0.7"/>`;
            // Kreski poziome (górny i dolny tick)
            svg_out += `<line x1="${dx - 3}" y1="${y + 1}" x2="${dx + 3}" y2="${y + 1}" stroke="#94a3b8" stroke-width="0.7"/>`;
            svg_out += `<line x1="${dx - 3}" y1="${y + h - 1}" x2="${dx + 3}" y2="${y + h - 1}" stroke="#94a3b8" stroke-width="0.7"/>`;
            // Tekst wymiaru (pionowo z lewej strony)
            const dimFontSize = Math.min(11, Math.max(8, h * 0.3));
            svg_out += `<text x="${dx - 4}" y="${y + h / 2}" transform="rotate(-90 ${dx - 4} ${y + h / 2})" text-anchor="middle" fill="#cbd5e1" font-size="${dimFontSize}" font-family="Inter,sans-serif" font-weight="600">${comp.height}</text>`;
        }

        if (comp._cfgIdx !== undefined) {
            svg_out += `</g>`;
        }

        y += h;
    });

    // Draw Przejscia
    if (well.przejscia && well.przejscia.length > 0 && well.rzednaDna !== null) {
        const bottomElev = parseFloat(well.rzednaDna) || 0;

        well.przejscia.forEach((pr, idx) => {
            const a = parseFloat(pr.katWlaczenia) || 0;
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
            } else {
                prW = prH = 160;
            }

            const mmFromBottom = (pel - bottomElev) * 1000;
            if (mmFromBottom > -5000 && mmFromBottom < totalMm + 5000) {
                const radiusW = Math.max((prW / 2) * pxMm, 3);
                const radiusH = Math.max((prH / 2) * pxMm, 3);
                const prY = mT + drawH - mmFromBottom * pxMm - radiusH;

                dimLinesY.push(prY - radiusH);
                dimLinesY.push(prY + radiusH);

                let px = cx;
                const numericBodyDN =
                    typeof bodyDN === 'number'
                        ? bodyDN
                        : visible.find(
                              (c) => c.componentType === 'styczna' || c.componentType === 'dennica'
                          )?.dn || 1000;
                const bw = mmToPx(numericBodyDN);
                const offset = Math.sin((a * Math.PI) / 180) * (bw / 2 - radiusW);
                px += offset;

                const isBack = a > 90 && a < 270;
                const pColor = isBack ? 'rgba(71,85,105,0.4)' : '#38bdf8';
                const sColor = isBack ? 'rgba(100,116,139,0.5)' : '#0ea5e9';
                const sDash = isBack ? 'stroke-dasharray="2,2"' : '';

                if (isRect) {
                    svg_out += `<g class="svg-prz-${idx}" style="transition:all 0.2s;" onmouseenter="window.svgPrzPointerEnter(event, ${idx})" onmouseleave="window.svgPrzPointerLeave(event, ${idx})"><rect x="${px - radiusW}" y="${prY - radiusH}" width="${radiusW * 2}" height="${radiusH * 2}" fill="${pColor}" stroke="${sColor}" stroke-width="1.5" ${sDash} /></g>`;
                } else if (isEgg) {
                    // SVG ellipse for jajowe pipe cross-section
                    svg_out += `<g class="svg-prz-${idx}" style="transition:all 0.2s;" onmouseenter="window.svgPrzPointerEnter(event, ${idx})" onmouseleave="window.svgPrzPointerLeave(event, ${idx})"><ellipse cx="${px}" cy="${prY}" rx="${radiusW}" ry="${radiusH}" fill="${pColor}" stroke="${sColor}" stroke-width="1.5" ${sDash} /></g>`;
                } else {
                    svg_out += `<g class="svg-prz-${idx}" style="transition:all 0.2s;" onmouseenter="window.svgPrzPointerEnter(event, ${idx})" onmouseleave="window.svgPrzPointerLeave(event, ${idx})"><circle cx="${px}" cy="${prY}" r="${radiusW}" fill="${pColor}" stroke="${sColor}" stroke-width="1.5" ${sDash} /></g>`;
                }

                const tColor = isBack ? 'rgba(148,163,184,0.7)' : '#bae6fd';
                const fSz = 11; // Nieznacznie większa czcionka

                if (!isBack) {
                    svg_out += `<text x="${px}" y="${prY + 3.5}" text-anchor="middle" fill="#ffffff" font-size="${fSz + 1}" font-weight="800" font-family="Inter,sans-serif" style="text-shadow: 1px 1px 2px rgba(0,0,0,0.8);">${a}°</text>`;
                }

                // Delikatna linia pomocnicza łącząca rurę z zunifikowaną osią wymiarową wskazująca wpięcie
                const dimColor = isBack ? '#64748b' : '#38bdf8';
                svg_out += `<line x1="25" y1="${prY}" x2="${px - radiusW - 2}" y2="${prY}" stroke="${dimColor}" stroke-width="0.8" stroke-dasharray="2,2" opacity="0.5"/>`;
            }
        });
    }

    // --- POJEDYNCZA LINIA WYMIAROWA PO LEWEJ STRONIE ---
    if (dimLinesY.length > 0) {
        dimLinesY = [...new Set(dimLinesY.map((v) => Math.round(v * 10) / 10))].sort(
            (a, b) => b - a
        );
        const dX = 52;
        const dimColor = '#94a3b8'; // neutral grey

        dimLinesY.forEach((pY) => {
            svg_out += `<line x1="${dX - 4}" y1="${pY}" x2="${dX + 4}" y2="${pY}" stroke="${dimColor}" stroke-width="1.2"/>`;
        });

        for (let i = 0; i < dimLinesY.length - 1; i++) {
            const yB = dimLinesY[i]; // dolny punkt elementu/przejścia (wartość Y rośnie w dół)
            const yT = dimLinesY[i + 1]; // górny punkt elementu/przejścia
            const distY = yB - yT;
            const distMm = Math.round(distY / pxMm);

            if (distMm > 1) {
                // Rysuj jeżeli dystans jest zauważalny
                svg_out += `<line x1="${dX}" y1="${yB}" x2="${dX}" y2="${yT}" stroke="${dimColor}" stroke-width="1.2"/>`;

                let labelText = `${distMm}`;
                let isPipe = false;

                // Sprawdzamy czy ten segment to idealnie rura/przejście
                if (well.przejscia && well.przejscia.length > 0) {
                    well.przejscia.forEach((pr) => {
                        let pel = parseFloat(pr.rzednaWlaczenia) || 0;
                        const pprod = studnieProducts.find((x) => x.id === pr.productId);
                        let prH = 160;
                        if (pprod && pprod.category === 'Otwór KPED') {
                            prH = 500;
                        } else if (
                            pprod &&
                            typeof pprod.dn === 'string' &&
                            pprod.dn.includes('/')
                        ) {
                            prH = parseFloat(pprod.dn.split('/')[1]) || 160;
                        } else if (pprod) {
                            prH = parseFloat(pprod.dn) || 160;
                        }

                        const mmFromBottom = (pel - (parseFloat(well.rzednaDna) || 0)) * 1000;
                        const radiusH = Math.max((prH / 2) * pxMm, 3);
                        const prY = mT + drawH - mmFromBottom * pxMm - radiusH;

                        const pyB = Math.round((prY + radiusH) * 10) / 10;
                        const pyT = Math.round((prY - radiusH) * 10) / 10;

                        // Compare segment rounded values with pipe boundary
                        if (Math.abs(yB - pyB) <= 1.2 && Math.abs(yT - pyT) <= 1.2) {
                            labelText = `DN ${Math.round(prH)}`; // oznacz jako rura
                            isPipe = true;
                        }
                    });
                }

                const fSz = 11;
                const textColor = isPipe ? '#38bdf8' : '#cbd5e1';
                const fW = isPipe ? '700' : '600';
                const textOpts = `text-anchor="middle" fill="${textColor}" font-size="${fSz}" font-family="Inter,sans-serif" font-weight="${fW}"`;
                svg_out += `<text x="${dX - 6}" y="${(yB + yT) / 2}" transform="rotate(-90 ${dX - 6} ${(yB + yT) / 2})" ${textOpts}>${labelText}</text>`;
            }
        }
    }

    // ── Łączna wysokość – pasek po lewej stronie ──
    const aX = 12;
    const aDimColor = '#94a3b8';
    svg_out += `<line x1="${aX}" y1="${mT}" x2="${aX}" y2="${mT + drawH}" stroke="${aDimColor}" stroke-width="1.2"/>`;
    svg_out += `<line x1="${aX - 4}" y1="${mT}" x2="${aX + 4}" y2="${mT}" stroke="${aDimColor}" stroke-width="1.2"/>`;
    svg_out += `<line x1="${aX - 4}" y1="${mT + drawH}" x2="${aX + 4}" y2="${mT + drawH}" stroke="${aDimColor}" stroke-width="1.2"/>`;
    const totalLabel = fmtInt(totalMm);
    svg_out += `<text x="${aX - 5}" y="${mT + drawH / 2}" transform="rotate(-90 ${aX - 5} ${mT + drawH / 2})" text-anchor="middle" fill="${aDimColor}" font-size="11" font-family="Inter,sans-serif" font-weight="600">${totalLabel}</text>`;

    // ── Oznaczenie DN na dole ──
    const labelDN = typeof bodyDN === 'number' ? `DN${bodyDN}` : 'Styczna';
    svg_out += `<text x="${cx}" y="${mT + drawH + mB - 2}" text-anchor="middle" fill="#64748b" font-size="11" font-family="Inter,sans-serif" font-weight="600">${labelDN}</text>`;

    svg.innerHTML = svg_out;
}
