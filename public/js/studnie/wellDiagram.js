// @ts-check
/**
 * wellDiagram.js — BACKWARD-COMPATIBLE WRAPPER
 *
 * Funkcje wyodrębnione do osobnych plików:
 *   diagramTheme.js        → SVG_COLORS, COMPONENT_THEME
 *   diagramOtRings.js      → enforceOtRings(), enforceOtForSegment(),
 *                            checkSegmentHasHole(), upgradeToOtRing(), degradeFromOtRing()
 *   diagramComponents.js   → buildVisibleComponents(), getElementOuterDn(),
 *                            calculateCanvasParams(), drawComponentShape(),
 *                            drawComponentLabel(), drawComponentDimension(), drawAllComponents()
 *   diagramTransitions.js  → drawTransitions(), parseTransitionGeometry(),
 *                            drawTransitionShape(), drawTransitionLabel(), drawTransitionGuideLine()
 *   diagramDimensions.js   → drawSegmentDimensions(), resolveSegmentLabel(),
 *                            drawTotalHeightBar(), drawDnLabel()
 *   diagramPreco.js        → calculatePrecoInsertHeight(), buildTransitionRanges(),
 *                            mergeOverlappingRanges(), drawPrecoInsertLine()
 *   diagramRenderer.js     → renderWellDiagram(), window.highlightSvg(),
 *                            window.unhighlightSvg(), window.svgPointerEnter(),
 *                            window.svgPointerLeave(), window.svgPrzPointerEnter(),
 *                            window.svgPrzPointerLeave()
 *
 * Ten plik pozostaje dla zachowania wstecznej kompatybilności.
 * Nowy kod ładuje 7 plików diagram-* przed tym plikiem
 * (kolejność script tagów w studnie.html).
 *
 * Zależności globalne: SVG_COLORS, COMPONENT_THEME, studnieProducts,
 *   getCurrentWell, logger, fmtInt, renderWellConfig
 */
