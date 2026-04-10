/**
 * Antygrawity - Automatic Manhole Component Selection System
 *
 * Automatically selects manhole components for DN1000, DN1200, DN1500, DN2000, DN2500
 * with support for reduction plates, cones, DIN plates, load-bearing rings, and passages.
 */

import prisma from '../prismaClient';

// Valid DN sizes
const VALID_DN_SIZES = [1000, 1200, 1500, 2000, 2500];
const REDUCTION_OPTIONS: Record<number, number> = {
    1200: 1000,
    1500: 1000,
    2000: 1000,
    2500: 1000
};



export interface ManholeConfig {
    targetDn: number;
    targetHeight: number;
    magazyn?: string;
    zakonczenieType?: string;
    przejscia?: any[];
    hasPlytaOdciazajaca?: boolean;
    hasPierscienOdciazajacy?: boolean;
}

export interface SelectionResult {
    success: boolean;
    errors: string[];
    warnings: string[];
    components: any[];
    totalHeight: number;
    metadata?: any;
}

/**
 * Main function to automatically select manhole components
 */
export async function selectManholeComponents(config: ManholeConfig): Promise<SelectionResult> {
    const {
        targetDn,
        targetHeight,
        magazyn = 'WL',
        zakonczenieType = 'konus',
        przejscia = [],
        hasPlytaOdciazajaca = false,
        hasPierscienOdciazajacy = false
    } = config;

    const result: SelectionResult = {
        success: true,
        errors: [],
        warnings: [],
        components: [],
        totalHeight: 0,
        metadata: {
            targetDn,
            targetHeight,
            magazyn,
            zakonczenieType
        }
    };

    // Validate DN size
    if (!VALID_DN_SIZES.includes(targetDn)) {
        return {
            success: false,
            errors: [
                `Nieprawidłowa średnica DN${targetDn}. Dostępne: ${VALID_DN_SIZES.map(
                    (dn) => `DN${dn}`
                ).join(', ')}`
            ],
            warnings: [],
            components: [],
            totalHeight: 0
        };
    }

    const magazynField = `magazyn${magazyn}`;
    const formaStdField = `formaStandardowa${magazyn}`;

    try {
        // Step 1: Select bottom plate (dennica)
        const dennica = await selectDennica(targetDn, magazynField, formaStdField);
        if (!dennica) {
            result.errors.push(`Brak dostępnej dennicy dla DN${targetDn} w magazynie ${magazyn}`);
            result.success = false;
            return result;
        }
        result.components.push({
            ...dennica,
            position: 1,
            layer: 'dennica'
        });
        result.totalHeight += dennica.height || 0;

        // Step 2: Check if reduction is needed
        let currentDn = targetDn;
        const needsReduction = REDUCTION_OPTIONS[targetDn] !== undefined;
        const reductionDn = needsReduction ? REDUCTION_OPTIONS[targetDn] : targetDn;

        // Step 3: Handle load-bearing plate/ring
        if (hasPlytaOdciazajaca || hasPierscienOdciazajacy) {
            const odciazajacyHeight = hasPlytaOdciazajaca ? 200 : 150;

            const supportingRing = await selectKragByDn(
                currentDn,
                magazynField,
                formaStdField,
                targetHeight - result.totalHeight - odciazajacyHeight
            );

            if (!supportingRing) {
                result.errors.push(
                    `Brak kręgu podporowego DN${currentDn} dla płyty/pierścienia odciążającego`
                );
                result.success = false;
                return result;
            }

            result.components.push({
                ...supportingRing,
                position: 2,
                layer: 'krag_podpora'
            });
            result.totalHeight += supportingRing.height || 0;
        }

        // Step 4: Calculate remaining height for buildup
        let remainingHeight = targetHeight - result.totalHeight;

        // Account for ending (cone or DIN plate)
        const ending = await selectZakonczenie(
            reductionDn,
            zakonczenieType,
            magazynField,
            formaStdField
        );
        if (!ending) {
            result.errors.push(`Brak zakończenia ${zakonczenieType} dla DN${reductionDn}`);
            result.success = false;
            return result;
        }
        remainingHeight -= ending.height || 0;

        // Step 5: Add reduction plate if needed
        let reductionPlate: any = null;
        if (needsReduction) {
            reductionPlate = await selectPlytaRedukcyjna(
                targetDn,
                reductionDn,
                magazynField,
                formaStdField
            );
            if (!reductionPlate) {
                result.errors.push(`Brak płyty redukcyjnej DN${targetDn}/DN${reductionDn}`);
                result.success = false;
                return result;
            }
            remainingHeight -= reductionPlate.height || 0;
        }

        // Step 6: Select buildup rings
        const remainingHeightForRings = remainingHeight;
        const rings = await selectKragiNadbudowy(
            currentDn,
            remainingHeightForRings,
            magazynField,
            formaStdField
        );

        if (rings.length === 0 && remainingHeightForRings > 0) {
            result.warnings.push(
                `Nie można dobrać kręgów nadbudowy dla wysokości ${remainingHeightForRings}mm`
            );
        }

        let position = result.components.length + 1;
        rings.forEach((ring) => {
            result.components.push({
                ...ring,
                position: position++,
                layer: 'krag_nadbudowy'
            });
            result.totalHeight += ring.height || 0;
        });

        // Step 7: Add reduction plate
        if (reductionPlate) {
            result.components.push({
                ...reductionPlate,
                position: position++,
                layer: 'plyta_redukcyjna'
            });
            result.totalHeight += reductionPlate.height || 0;
            currentDn = reductionDn;
        }

        // Step 8: Add ending
        result.components.push({
            ...ending,
            position: position++,
            layer: 'zakonczenie'
        });
        result.totalHeight += ending.height || 0;

        // Step 9: Handle passages
        if (przejscia.length > 0) {
            const passageResult = await placePrzejscia(
                result.components,
                przejscia,
                magazynField,
                formaStdField
            );

            if (!passageResult.success) {
                result.errors.push(...passageResult.errors);
                result.success = false;
            }

            result.warnings.push(...passageResult.warnings);

            if (passageResult.requiresOtRing) {
                const otRing = await selectKragOt(currentDn, magazynField, formaStdField);
                if (otRing) {
                    result.components = insertOtRing(
                        result.components,
                        otRing,
                        passageResult.otPosition
                    );
                    result.success = true;
                } else {
                    result.errors.push('Wymagany krąg wiercony (OT) niedostępny');
                    result.success = false;
                }
            }
        }

        // Final validation
        if (Math.abs(result.totalHeight - targetHeight) > 100) {
            result.warnings.push(
                `Różnica wysokości: ${Math.abs(
                    result.totalHeight - targetHeight
                )}mm (cel: ${targetHeight}mm)`
            );
        }
    } catch (error: any) {
        result.success = false;
        result.errors.push(`Błąd systemu: ${error.message}`);
        console.error('[ANTYGRAWITY ERROR]', error);
    }

    return result;
}

/**
 * Select bottom plate (dennica) - prioritize lowest available
 */
async function selectDennica(
    dn: number,
    magazynField: string,
    formaStdField: string
): Promise<any> {
    const dennice = await (prisma as any).products_studnie_rel.findMany({
        where: {
            componentType: 'dennica',
            dn: dn,
            [magazynField]: 1
        },
        orderBy: [{ [formaStdField]: 'desc' }, { height: 'asc' }]
    });

    return dennice.length > 0 ? dennice[0] : null;
}

/**
 * Select ring by DN and approximate height
 */
async function selectKragByDn(
    dn: number,
    magazynField: string,
    formaStdField: string,
    _targetHeight?: number
): Promise<any> {
    const krags = await (prisma as any).products_studnie_rel.findMany({
        where: {
            componentType: 'krag',
            dn: dn,
            [magazynField]: 1
        },
        orderBy: [{ [formaStdField]: 'desc' }, { height: 'desc' }]
    });

    return krags.length > 0 ? krags[0] : null;
}

/**
 * Select ending (cone or DIN plate)
 */
async function selectZakonczenie(
    dn: number,
    type: string,
    magazynField: string,
    formaStdField: string
): Promise<any> {
    if (type === 'plyta_din') {
        const dinPlates = await (prisma as any).products_studnie_rel.findMany({
            where: {
                componentType: 'plyta_din',
                dn: dn,
                [magazynField]: 1
            },
            orderBy: [{ [formaStdField]: 'desc' }]
        });
        return dinPlates.length > 0 ? dinPlates[0] : null;
    } else {
        const konusy = await (prisma as any).products_studnie_rel.findMany({
            where: {
                componentType: 'konus',
                dn: dn,
                [magazynField]: 1
            },
            orderBy: [{ [formaStdField]: 'desc' }]
        });
        return konusy.length > 0 ? konusy[0] : null;
    }
}

/**
 * Select reduction plate
 */
async function selectPlytaRedukcyjna(
    fromDn: number,
    toDn: number,
    magazynField: string,
    formaStdField: string
): Promise<any> {
    const plates = await (prisma as any).products_studnie_rel.findMany({
        where: {
            componentType: 'plyta_redukcyjna',
            dn: fromDn,
            [magazynField]: 1
        },
        orderBy: [{ [formaStdField]: 'desc' }]
    });

    for (const plate of plates) {
        if (plate.name?.includes(`DN${toDn}`) || plate.id?.includes(`${toDn}`)) {
            return plate;
        }
    }

    return plates.length > 0 ? plates[0] : null;
}

/**
 * Select buildup rings - prioritize highest first
 */
async function selectKragiNadbudowy(
    dn: number,
    totalHeight: number,
    magazynField: string,
    formaStdField: string
): Promise<any[]> {
    const selected: any[] = [];
    let remainingHeight = totalHeight;

    const availableRings = await (prisma as any).products_studnie_rel.findMany({
        where: {
            componentType: 'krag',
            dn: dn,
            [magazynField]: 1
        },
        orderBy: [{ [formaStdField]: 'desc' }, { height: 'desc' }]
    });

    if (availableRings.length === 0) {
        return selected;
    }

    while (remainingHeight > 0) {
        let bestFit = null;

        for (const ring of availableRings) {
            if ((ring.height || 0) <= remainingHeight) {
                bestFit = ring;
                break;
            }
        }

        if (bestFit) {
            selected.push(bestFit);
            remainingHeight -= bestFit.height || 0;
        } else {
            const smallRings = availableRings.filter(
                (r: any) => (r.height || 0) <= remainingHeight
            );
            if (smallRings.length > 0) {
                selected.push(smallRings[0]);
                remainingHeight -= smallRings[0].height || 0;
            } else {
                break;
            }
        }
    }

    return selected;
}

/**
 * Select drilled ring (OT - otwarty)
 */
async function selectKragOt(dn: number, magazynField: string, formaStdField: string): Promise<any> {
    const otRings = await (prisma as any).products_studnie_rel.findMany({
        where: {
            componentType: 'krag_ot',
            dn: dn,
            [magazynField]: 1
        },
        orderBy: [{ [formaStdField]: 'desc' }]
    });

    return otRings.length > 0 ? otRings[0] : null;
}

/**
 * Place passages in components with proper zapasy (clearances)
 */
async function placePrzejscia(
    components: any[],
    przejscia: any[],
    _magazynField: string,
    _formaStdField: string
): Promise<{
    success: boolean;
    errors: string[];
    warnings: string[];
    requiresOtRing: boolean;
    otPosition: number | null;
}> {
    const result = {
        success: true,
        errors: [] as string[],
        warnings: [] as string[],
        requiresOtRing: false,
        otPosition: null as number | null
    };

    for (const przejscie of przejscia) {
        const {
            dn_przejscia,
            height_from_bottom,
            angle: _angle,
            zapasDol,
            zapasGora,
            zapasDolMin,
            zapasGoraMin
        } = przejscie;

        let cumulativeHeight = 0;
        let targetComponent: any = null;
        let positionInComponent = 0;

        for (const component of components) {
            const componentTop = cumulativeHeight + (component.height || 0);

            if (height_from_bottom >= cumulativeHeight && height_from_bottom <= componentTop) {
                targetComponent = component;
                positionInComponent = height_from_bottom - cumulativeHeight;
                break;
            }

            cumulativeHeight = componentTop;
        }

        if (!targetComponent) {
            result.errors.push(
                `Przejście DN${dn_przejscia} na wysokości ${height_from_bottom}mm poza zakresem studni`
            );
            result.success = false;
            continue;
        }

        const isOnJoint =
            Math.abs(positionInComponent) < 50 ||
            Math.abs((targetComponent.height || 0) - positionInComponent) < 50;

        if (isOnJoint && targetComponent.layer !== 'dennica') {
            result.errors.push(
                `Przejście DN${dn_przejscia} wychodzi na połączeniu elementów - niedozwolone`
            );
            result.success = false;
        }

        if (
            targetComponent.layer === 'dennica' &&
            positionInComponent > (targetComponent.height || 0) * 0.8
        ) {
            result.requiresOtRing = true;
            result.otPosition = components.indexOf(targetComponent) + 1;
            result.warnings.push('Przejście podniesione w dennicy - wymagany krąg wiercony OT');
        }

        const recommendedZapasDol = zapasDol || 300;
        const recommendedZapasGora = zapasGora || 300;
        const minZapasDol = zapasDolMin || 150;
        const minZapasGora = zapasGoraMin || 150;

        const actualZapasDol = positionInComponent;
        const actualZapasGora = (targetComponent.height || 0) - positionInComponent;

        if (actualZapasDol < recommendedZapasDol) {
            if (actualZapasDol < minZapasDol) {
                result.errors.push(
                    `Przejście DN${dn_przejscia}: zapas dolny ${actualZapasDol}mm < minimalny ${minZapasDol}mm`
                );
                result.success = false;
            } else {
                result.warnings.push(
                    `Przejście DN${dn_przejscia}: zapas dolny ${actualZapasDol}mm < zalecany ${recommendedZapasDol}mm`
                );
            }
        }

        if (actualZapasGora < recommendedZapasGora) {
            if (actualZapasGora < minZapasGora) {
                result.errors.push(
                    `Przejście DN${dn_przejscia}: zapas górny ${actualZapasGora}mm < minimalny ${minZapasGora}mm`
                );
                result.success = false;
            } else {
                result.warnings.push(
                    `Przejście DN${dn_przejscia}: zapas górny ${actualZapasGora}mm < zalecany ${recommendedZapasGora}mm`
                );
            }
        }

        if (!targetComponent.przejscia) {
            targetComponent.przejscia = [];
        }
        targetComponent.przejscia.push(przejscie);
    }

    return result;
}

/**
 * Insert OT ring at specified position
 */
function insertOtRing(components: any[], otRing: any, position: number | null): any[] {
    const newComponents = [...components];

    newComponents.forEach((comp, idx) => {
        if (position !== null && idx >= position) {
            comp.position = comp.position + 1;
        }
    });

    otRing.position = (position || 0) + 1;
    otRing.layer = 'krag_ot';
    newComponents.splice(position || 0, 0, otRing);

    return newComponents;
}

/**
 * Get available components for a given DN and warehouse
 */
export async function getAvailableComponents(dn: number, magazyn: string = 'WL'): Promise<any[]> {
    const magazynField = `magazyn${magazyn}`;
    const formaStdField = `formaStandardowa${magazyn}`;

    const components = await (prisma as any).products_studnie_rel.findMany({
        where: {
            dn: dn,
            [magazynField]: 1
        },
        orderBy: [{ componentType: 'asc' }, { [formaStdField]: 'desc' }, { height: 'desc' }]
    });

    return components;
}

/**
 * Validate manhole configuration
 */
export function validateManhole(
    components: any[],
    _config: any
): { valid: boolean; issues: string[] } {
    const issues: string[] = [];

    const ending = components.find((c) => c.layer === 'zakonczenie');
    if (ending) {
        const supportingElement = components[components.indexOf(ending) - 1];
        if (supportingElement) {
            const hasReduction = supportingElement.componentType === 'plyta_redukcyjna';
            if (!hasReduction && ending.dn !== supportingElement.dn) {
                issues.push(
                    `Zakończenie DN${ending.dn} nie zgadza się ze średnicą elementu podporowego DN${supportingElement.dn}`
                );
            }
            if (hasReduction && ending.dn !== 1000) {
                issues.push(
                    `Zakończenie DN${ending.dn} nie zgadza się ze średnicą redukcyjną DN1000`
                );
            }
        }
    }

    const hasPlytaOdciazajaca = components.some((c) => c.componentType === 'plyta_odciazajaca');
    const hasPierscienOdciazajacy = components.some(
        (c) => c.componentType === 'pierscien_odciazajacy'
    );

    if (hasPlytaOdciazajaca || hasPierscienOdciazajacy) {
        const odciazajacy = components.find(
            (c) =>
                c.componentType === 'plyta_odciazajaca' ||
                c.componentType === 'pierscien_odciazajacy'
        );

        if (odciazajacy) {
            const supportingRing = components[components.indexOf(odciazajacy) - 1];
            if (
                !supportingRing ||
                supportingRing.componentType !== 'krag' ||
                supportingRing.dn !== odciazajacy.dn
            ) {
                issues.push(
                    'Płyta/pierścień odciążający wymaga kręgu podporowego tej samej średnicy'
                );
            }
        }
    }

    return {
        valid: issues.length === 0,
        issues
    };
}

export { VALID_DN_SIZES, REDUCTION_OPTIONS };
