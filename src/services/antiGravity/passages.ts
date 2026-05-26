/**
 * Antygrawity — Logika rozmieszczania przejść (Passages)
 *
 * Obsługuje umieszczanie przejść rur w elementach studni,
 * sprawdza zapasy oraz wstawia kręgi wiercone OT, gdy jest to wymagane.
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
 * Rozmieszcza przejścia w elementach z odpowiednimi zapasami.
 * Sprawdza, czy przejścia nie wypadały na połączeniach i czy mają wystarczający zapas.
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
 * Przetwarza pojedyncze przejście i aktualizuje wynik o błędy/ostrzeżenia
 */
function processPassage(
    components: WellComponent[],
    przejscie: PassageConfig,
    result: PassagePlacementResult
): void {
    const { dn_przejscia, height_from_bottom, zapasDol, zapasGora, zapasDolMin, zapasGoraMin } =
        przejscie;
    const hFromBottom = Number(height_from_bottom ?? 0);

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
 * Znajduje, w którym elemencie znajduje się przejście na podstawie wysokości od dna
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
 * Sprawdza, czy przejście wypada na połączeniu elementów (niedozwolone)
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
 * Sprawdza, czy przejście w dennicy wymaga kręgu wierconego OT
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
 * Waliduje dolne i górne zapasy względem wartości zalecanych i minimalnych
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
    const recommendedZapasDol = Number(clearances.zapasDol ?? 300);
    const recommendedZapasGora = Number(clearances.zapasGora ?? 300);
    const minZapasDol = Number(clearances.zapasDolMin ?? 150);
    const minZapasGora = Number(clearances.zapasGoraMin ?? 150);

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
 * Waliduje pojedynczą wartość zapasu względem progów zalecanych i minimalnych
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
 * Wstawia krąg OT na określonej pozycji, przesuwając kolejne elementy
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
