// @ts-check
/**
 * diagramRenderer.js — Główna funkcja renderująca diagram studni oraz podświetlanie SVG.
 *
 * Wyodrębnione z wellDiagram.js (faza 2 refaktoryzacji).
 * Ładowany jako ostatni z grupy diagram-*.
 *
 * Zawiera:
 *   renderWellDiagram()        — główna funkcja renderowania schematu studni
 *   window.highlightSvg()      — podświetla elementy SVG
 *   window.unhighlightSvg()    — usuwa podświetlenie
 *   window.svgPointerEnter()   — hover na elemencie konfiguracji
 *   window.svgPointerLeave()   — koniec hovera konfiguracji
 *   window.svgPrzPointerEnter() — hover na przejściu
 *   window.svgPrzPointerLeave() — koniec hovera przejścia
 *
 * Zależności globalne:
 *   SVG_COLORS (diagramTheme.js)
 *   enforceOtRings, buildVisibleComponents, calculateCanvasParams,
 *   drawAllComponents, drawTransitions, drawPrecoInsertLine,
 *   drawSegmentDimensions, drawTotalHeightBar, drawDnLabel
 *   getCurrentWell, renderWellConfig
 */

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
    if (window.svgDragStartIndex >= 0) return; // blokowanie hovera w trakcie ciągnięcia
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
        return;
    }

    // Sortowanie wyłączone - wizualizacja pokazuje elementy W DOKŁADNEJ KOLEJNOŚCI jak w tablicy config
    const visible = buildVisibleComponents(well);

    if (visible.length === 0) {
        svg.setAttribute('viewBox', '0 0 300 500');
        svg.innerHTML = `<text x="150" y="240" text-anchor="middle" fill="${SVG_COLORS.dnLabel}" font-size="12">Brak elementów z wysokością</text>`;
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
}
