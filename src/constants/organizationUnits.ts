export const ORGANIZATION_UNIT_VALUES = ['ASM_KLUCZBORK', 'WL_WLOCLAWEK'] as const;

export type OrganizationUnit = (typeof ORGANIZATION_UNIT_VALUES)[number];

export const DEFAULT_ORGANIZATION_UNIT_KEY = 'defaultOrganizationUnit';

export function isOrganizationUnit(value: unknown): value is OrganizationUnit {
    return (
        typeof value === 'string' && ORGANIZATION_UNIT_VALUES.includes(value as OrganizationUnit)
    );
}
