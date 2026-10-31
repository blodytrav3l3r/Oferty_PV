/**
 * S5/O3: dzienny check "dokładnie 1 aktywna wersja na typ".
 *
 * Aktywna = najnowsza APPROVED z effectiveFrom <= now. Stan jest wyliczany
 * (jak w resolverze), więc check nie mutuje bazy.
 */
import prisma from '../../prismaClient';
import { PRICELIST_TYPES } from './validation';
import type { PricelistType } from './validation';

export interface PricelistHealthVersion {
    id: string;
    type: string;
    version: string;
    status: string;
    effectiveFrom: string;
}

export type HealthViolationCode =
    'NO_ACTIVE_VERSION' | 'MULTIPLE_ACTIVE_VERSIONS' | 'INVALID_EFFECTIVE_FROM';

export interface HealthViolation {
    type: PricelistType;
    code: HealthViolationCode;
    message: string;
}

export interface PricelistHealthReport {
    ok: boolean;
    checkedAt: string;
    active: Record<PricelistType, PricelistHealthVersion | null>;
    violations: HealthViolation[];
}

function isValidDate(value: string): boolean {
    return !Number.isNaN(Date.parse(value));
}

export function evaluatePricelistHealth(
    versions: PricelistHealthVersion[],
    options: { now?: Date } = {}
): PricelistHealthReport {
    const now = options.now ?? new Date();
    const active = {} as Record<PricelistType, PricelistHealthVersion | null>;
    const violations: HealthViolation[] = [];

    for (const type of PRICELIST_TYPES) {
        const approved = versions.filter(
            (version) => version.type === type && version.status === 'APPROVED'
        );
        for (const version of approved) {
            if (!isValidDate(version.effectiveFrom)) {
                violations.push({
                    type,
                    code: 'INVALID_EFFECTIVE_FROM',
                    message: `${version.version}: niepoprawna data ${version.effectiveFrom}`
                });
            }
        }

        const eligible = approved.filter(
            (version) =>
                isValidDate(version.effectiveFrom) &&
                Date.parse(version.effectiveFrom) <= now.getTime()
        );
        if (eligible.length === 0) {
            active[type] = null;
            violations.push({
                type,
                code: 'NO_ACTIVE_VERSION',
                message: 'brak APPROVED z effectiveFrom <= now'
            });
            continue;
        }

        const latest = eligible.reduce((max, version) =>
            version.effectiveFrom > max.effectiveFrom ? version : max
        );
        const winners = eligible.filter(
            (version) => version.effectiveFrom === latest.effectiveFrom
        );
        active[type] = winners[0];
        if (winners.length > 1) {
            violations.push({
                type,
                code: 'MULTIPLE_ACTIVE_VERSIONS',
                message: `${winners.length} wersje z effectiveFrom=${latest.effectiveFrom}`
            });
        }
    }

    return {
        ok: violations.length === 0,
        checkedAt: now.toISOString(),
        active,
        violations
    };
}

export async function getPricelistHealth(
    options: { now?: Date } = {}
): Promise<PricelistHealthReport> {
    const now = options.now ?? new Date();
    const versions = await prisma.pricelistVersion.findMany({
        where: { status: 'APPROVED' },
        select: { id: true, type: true, version: true, status: true, effectiveFrom: true }
    });

    return evaluatePricelistHealth(versions, { now });
}
