/**
 * S5/O3: dzienny check "dokładnie 1 aktywna wersja na typ".
 *
 * Aktywna = najnowsza APPROVED z effectiveFrom <= now. Stan jest wyliczany
 * (jak w resolverze), więc check nie mutuje bazy. LIVE_WRITE z audytu jest
 * raportowany osobno — to sygnał O3, nie warunek checku.
 */
import prisma from '../../prismaClient';
import { PRICELIST_TYPES } from './validation';
import type { PricelistType } from './validation';

export const DEFAULT_LIVE_WRITE_WINDOW_MS = 24 * 60 * 60 * 1000;

const LIVE_WRITE_ACTIONS = ['LIVE_WRITE', 'PATCH_LIVE_WRITE', 'DELETE_LIVE_WRITE'] as const;

export interface PricelistHealthVersion {
    id: string;
    type: string;
    version: string;
    status: string;
    effectiveFrom: string;
}

export interface PricelistLiveWrite {
    entityId: string;
    action: string;
    createdAt: string | null;
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
    liveWrites: {
        since: string;
        count: number;
        byType: Record<string, number>;
    };
}

function isValidDate(value: string): boolean {
    return !Number.isNaN(Date.parse(value));
}

export function evaluatePricelistHealth(
    versions: PricelistHealthVersion[],
    liveWrites: PricelistLiveWrite[],
    options: { now?: Date; since?: Date } = {}
): PricelistHealthReport {
    const now = options.now ?? new Date();
    const since = options.since ?? new Date(now.getTime() - DEFAULT_LIVE_WRITE_WINDOW_MS);
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

    const byType: Record<string, number> = {};
    for (const write of liveWrites) {
        const type = byType[write.entityId] ?? 0;
        byType[write.entityId] = type + 1;
    }

    return {
        ok: violations.length === 0,
        checkedAt: now.toISOString(),
        active,
        violations,
        liveWrites: {
            since: since.toISOString(),
            count: liveWrites.length,
            byType
        }
    };
}

export async function getPricelistHealth(
    options: { now?: Date; since?: Date } = {}
): Promise<PricelistHealthReport> {
    const now = options.now ?? new Date();
    const since = options.since ?? new Date(now.getTime() - DEFAULT_LIVE_WRITE_WINDOW_MS);

    const [versions, liveWrites] = await Promise.all([
        prisma.pricelistVersion.findMany({
            where: { status: 'APPROVED' },
            select: { id: true, type: true, version: true, status: true, effectiveFrom: true }
        }),
        prisma.audit_logs.findMany({
            where: {
                entityType: 'pricelist_live',
                action: { in: [...LIVE_WRITE_ACTIONS] },
                createdAt: { gte: since.toISOString() }
            },
            select: { entityId: true, action: true, createdAt: true }
        })
    ]);

    return evaluatePricelistHealth(versions, liveWrites, { now, since });
}
