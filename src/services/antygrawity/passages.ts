/**
 * Antygrawity — Passage Placement Logic
 *
 * Handles placing pipe passages (przejścia) within manhole components,
 * checking clearances (zapasy), and inserting OT rings when needed.
 */

import { WellComponent, PassageConfig } from '../../types';

export interface PassagePlacementResult {
    success: boolean;
    errors: string[];
    warnings: string[];
    requiresOtRing: boolean;
    otPosition: number | null;
}

/**
 * Place passages in components with proper clearances (zapasy).
 * Validates that passages don't land on joints and have sufficient clearance.
 */
export async function placePrzejscia(
    components: WellComponent[],
    przejscia: PassageConfig[],
    _magazynField: string,
    _formaStdField: string
): Promise<PassagePlacementResult> {
    const result: PassagePlacementResult = {
        success: true,
        errors: [],
        warnings: [],
        requiresOtRing: false,
        otPosition: null
    };

    for (const przejscie of przejscia) {
        processPassage(components, przejscie, result);
    }

    return result;
}

/**
 * Process a single passage and update the result with errors/warnings
 */
function processPassage(
    components: WellComponent[],
    przejscie: PassageConfig,
    result: PassagePlacementResult
): void {
    const { dn_przejscia, height_from_bottom, zapasDol, zapasGora, zapasDolMin, zapasGoraMin } =
        przejscie;
    const hFromBottom = (height_from_bottom as number) || 0;

    const placement = findTargetComponent(components, hFromBottom);

    if (!placement) {
        result.errors.push(
            `Przejście DN${dn_przejscia || '?'} na wysokości ${hFromBottom}mm poza zakresem studni`
        );
        result.success = false;
        return;
    }

    const { component: targetComponent, positionInComponent } = placement;

    validateJointClearance(targetComponent, positionInComponent, dn_przejscia, result);
    checkDennicaOtRequirement(components, targetComponent, positionInComponent, result);
    validateClearances(targetComponent, positionInComponent, dn_przejscia, result, {
        zapasDol,
        zapasGora,
        zapasDolMin,
        zapasGoraMin
    });

    if (!targetComponent.przejscia) {
        targetComponent.przejscia = [];
    }
    targetComponent.przejscia.push(przejscie);
}

/**
 * Find which component a passage falls within based on height from bottom
 */
function findTargetComponent(
    components: WellComponent[],
    hFromBottom: number
): { component: WellComponent; positionInComponent: number } | null {
    let cumulativeHeight = 0;

    for (const component of components) {
        const componentTop = cumulativeHeight + (component.height || 0);

        if (hFromBottom >= cumulativeHeight && hFromBottom <= componentTop) {
            return {
                component,
                positionInComponent: hFromBottom - cumulativeHeight
            };
        }

        cumulativeHeight = componentTop;
    }

    return null;
}

/**
 * Check if passage lands on a component joint (niedozwolone)
 */
function validateJointClearance(
    targetComponent: WellComponent,
    positionInComponent: number,
    dnPrzejscia: string | number | undefined,
    result: PassagePlacementResult
): void {
    const isOnJoint =
        Math.abs(positionInComponent) < 50 ||
        Math.abs((targetComponent.height || 0) - positionInComponent) < 50;

    if (isOnJoint && targetComponent.layer !== 'dennica') {
        result.errors.push(
            `Przejście DN${dnPrzejscia || '?'} wychodzi na połączeniu elementów - niedozwolone`
        );
        result.success = false;
    }
}

/**
 * Check if passage in dennica requires an OT ring
 */
function checkDennicaOtRequirement(
    components: WellComponent[],
    targetComponent: WellComponent,
    positionInComponent: number,
    result: PassagePlacementResult
): void {
    if (
        targetComponent.layer === 'dennica' &&
        positionInComponent > (targetComponent.height || 0) * 0.8
    ) {
        result.requiresOtRing = true;
        result.otPosition = components.indexOf(targetComponent) + 1;
        result.warnings.push('Przejście podniesione w dennicy - wymagany krąg wiercony OT');
    }
}

/**
 * Validate bottom and top clearances against recommended and minimum values
 */
function validateClearances(
    targetComponent: WellComponent,
    positionInComponent: number,
    dnPrzejscia: string | number | undefined,
    result: PassagePlacementResult,
    clearances: {
        zapasDol?: number;
        zapasGora?: number;
        zapasDolMin?: number;
        zapasGoraMin?: number;
    }
): void {
    const recommendedZapasDol = (clearances.zapasDol as number) || 300;
    const recommendedZapasGora = (clearances.zapasGora as number) || 300;
    const minZapasDol = (clearances.zapasDolMin as number) || 150;
    const minZapasGora = (clearances.zapasGoraMin as number) || 150;

    const actualZapasDol = positionInComponent;
    const actualZapasGora = (targetComponent.height || 0) - positionInComponent;
    const dn = dnPrzejscia || '?';

    validateSingleClearance(actualZapasDol, recommendedZapasDol, minZapasDol, 'dolny', dn, result);
    validateSingleClearance(
        actualZapasGora,
        recommendedZapasGora,
        minZapasGora,
        'górny',
        dn,
        result
    );
}

/**
 * Validate a single clearance value against recommended and minimum thresholds
 */
function validateSingleClearance(
    actual: number,
    recommended: number,
    minimum: number,
    direction: string,
    dn: string | number,
    result: PassagePlacementResult
): void {
    if (actual >= recommended) return;

    if (actual < minimum) {
        result.errors.push(
            `Przejście DN${dn}: zapas ${direction} ${actual}mm < minimalny ${minimum}mm`
        );
        result.success = false;
    } else {
        result.warnings.push(
            `Przejście DN${dn}: zapas ${direction} ${actual}mm < zalecany ${recommended}mm`
        );
    }
}

/**
 * Insert OT ring at specified position, shifting subsequent components
 */
export function insertOtRing(
    components: WellComponent[],
    otRing: WellComponent,
    position: number | null
): WellComponent[] {
    const safePosition = position || 0;

    // Tworzenie całkowicie nowych klonów dla zmienionych pozycji
    const newComponents = components.map((comp, idx) => {
        if (idx >= safePosition) {
            return { ...comp, position: (comp.position || 0) + 1 };
        }
        return comp; // Jeśli pozycja nie wymaga zmiany zostaw oryginalną (Płytka referencja)
    });

    // Pełny klon pierścienia dodany do struktury
    const newOtRing = {
        ...otRing,
        position: safePosition + 1,
        layer: 'krag_ot'
    };

    newComponents.splice(safePosition, 0, newOtRing);

    return newComponents;
}
