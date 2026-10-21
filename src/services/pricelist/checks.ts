/**
 * S1b: read-only „checks" wersji — użycie, kolizja daty, różnica do LIVE,
 * porównanie z bieżącą aktywną. Zero zapisów, zero CTA. Admin only (route).
 */

import prisma from '../../prismaClient';
import { diffById, priceOverrideService } from '../priceOverrideService';
import { getVersionExport } from './export';
import { resolveActive, countVersionUsage, getPrecoReferences } from './usage';

export type CheckStatus = 'MATCH' | 'DIFFERS' | 'NO_CURRENT' | 'UNVERIFIABLE';

export interface VersionChecks {
    versionId: string;
    checkedAt: string;
    advisory: true;
    usage: { offers: number; orders: number; total: number; kind: 'offers' | 'studnieVersions' };
    collision: {
        hasCollision: boolean;
        effectiveFrom: string;
        versions: Array<{ id: string; version: string; seq: number; status: string }>;
    };
    liveDiff: { section: string; added: number; removed: number; changed: number } | null;
    baseVersion: { status: 'UNVERIFIABLE'; reason: string };
    comparisonToCurrentApproved: {
        status: CheckStatus;
        currentVersionId: string | null;
        sections: Record<string, { added: number; removed: number; changed: number }>;
    };
}

function liveSection(
    type: string,
    pkg: Awaited<ReturnType<typeof priceOverrideService.buildPricePackage>>
): { name: string; rows: Array<Record<string, unknown>> } | null {
    if (type === 'rury') return { name: 'rury', rows: pkg.rury as Array<Record<string, unknown>> };
    if (type === 'studnie') {
        return { name: 'studnie', rows: pkg.studnie as Array<Record<string, unknown>> };
    }
    if (type === 'preco') {
        return {
            name: 'preco',
            rows: [...pkg.preco.konfig, ...pkg.preco.kinety, ...pkg.preco.zakresy] as Array<
                Record<string, unknown>
            >
        };
    }
    return null;
}

export async function getVersionChecks(id: string): Promise<VersionChecks> {
    const { version, sections } = await getVersionExport(id);
    const type = version.type;

    const [usage, collisions, active, pkg] = await Promise.all([
        type === 'preco'
            ? getPrecoReferences().then((refs) => ({
                  offers: 0,
                  orders: 0,
                  total: refs.get(id)?.count ?? 0,
                  kind: 'studnieVersions' as const
              }))
            : countVersionUsage(id).then((u) => ({ ...u, kind: 'offers' as const })),
        prisma.pricelistVersion.findMany({
            where: {
                type,
                effectiveFrom: version.effectiveFrom,
                id: { not: id },
                status: 'APPROVED'
            },
            select: { id: true, version: true, seq: true, status: true },
            orderBy: { seq: 'asc' }
        }),
        resolveActive(type),
        priceOverrideService.buildPricePackage()
    ]);

    const sectionNames =
        type === 'rury'
            ? ['rury']
            : type === 'studnie'
              ? ['studnie']
              : ['konfig', 'kinety', 'zakresy'];

    const comparison: Record<string, { added: number; removed: number; changed: number }> = {};
    let comparisonStatus: CheckStatus = 'NO_CURRENT';
    if (active) {
        const activeItems = await getVersionExport(active.id);
        let differs = false;
        for (const name of sectionNames) {
            const diff = diffById(activeItems.sections[name] ?? [], sections[name] ?? []);
            comparison[name] = diff;
            if (diff.added + diff.removed + diff.changed > 0) differs = true;
        }
        comparisonStatus = differs ? 'DIFFERS' : 'MATCH';
    }

    const live = liveSection(type, pkg);
    return {
        versionId: id,
        checkedAt: new Date().toISOString(),
        advisory: true,
        usage,
        collision: {
            hasCollision: collisions.length > 0,
            effectiveFrom: version.effectiveFrom,
            versions: collisions
        },
        liveDiff: live
            ? {
                  section: live.name,
                  ...diffById(
                      live.rows,
                      sectionNames.flatMap((name) => sections[name] ?? [])
                  )
              }
            : null,
        baseVersion: {
            status: 'UNVERIFIABLE',
            reason: 'Brak zapisanego ID wersji bazowej (schemat do S3).'
        },
        comparisonToCurrentApproved: {
            status: comparisonStatus,
            currentVersionId: active?.id ?? null,
            sections: comparison
        }
    };
}

/** S2b: checks sa doradcze; edycja po checks daje checksStale=true (bez 409). */
export async function isChecksStale(versionId: string, checksCheckedAt?: string): Promise<boolean> {
    if (!checksCheckedAt) return false;
    const latest = await prisma.audit_logs.findFirst({
        where: {
            entityType: 'pricelist_version',
            entityId: versionId,
            action: 'UPDATE'
        },
        orderBy: { createdAt: 'desc' },
        select: { createdAt: true }
    });
    return latest?.createdAt != null && latest.createdAt > checksCheckedAt;
}
