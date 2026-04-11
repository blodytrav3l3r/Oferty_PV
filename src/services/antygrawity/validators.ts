/**
 * Antygrawity — Manhole Configuration Validators
 *
 * Validates structural correctness of assembled manhole components:
 * ending diameter matches, reduction plate consistency, and load-bearing support.
 */

import { WellComponent } from '../../types';

/**
 * Validate a complete manhole component assembly.
 * Checks ending compatibility and load-bearing element support.
 */
export function validateManhole(
    components: WellComponent[],
    _config: Record<string, unknown>
): { valid: boolean; issues: string[] } {
    const issues: string[] = [];

    validateEndingCompatibility(components, issues);
    validateLoadBearingSupport(components, issues);

    return {
        valid: issues.length === 0,
        issues
    };
}

/**
 * Validate that the ending (konus/płyta DIN) matches the supporting element diameter
 */
function validateEndingCompatibility(components: WellComponent[], issues: string[]): void {
    const ending = components.find((c) => c.layer === 'zakonczenie');
    if (!ending) return;

    const supportingElement = components[components.indexOf(ending) - 1];
    if (!supportingElement) return;

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

/**
 * Validate that load-bearing plates/rings have proper supporting ring underneath
 */
function validateLoadBearingSupport(components: WellComponent[], issues: string[]): void {
    const hasLoadBearing = components.some(
        (c) =>
            c.componentType === 'plyta_odciazajaca' ||
            c.componentType === 'pierscien_odciazajacy'
    );

    if (!hasLoadBearing) return;

    const odciazajacy = components.find(
        (c) =>
            c.componentType === 'plyta_odciazajaca' ||
            c.componentType === 'pierscien_odciazajacy'
    );

    if (!odciazajacy) return;

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
