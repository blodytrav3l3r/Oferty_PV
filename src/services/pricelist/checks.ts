/**
 * S1b: read-only „checks" wersji — użycie, kolizja daty, porównanie z bieżącą
 * aktywną. Zero zapisów, zero CTA. Admin only (route).
 *
 * Etap 2: brak diffu do tabel LIVE — jedynym punktem odniesienia jest bieżąca
 * wersja APPROVED (`comparisonToCurrentApproved`).
 */

import prisma from '../../prismaClient';
import { diffById } from './canonical';
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
    baseVersion: { status: 'UNVERIFIABLE'; reason: string };
    comparisonToCurrentApproved: {
        status: CheckStatus;
        currentVersionId: string | null;
        sections: Record<string, { added: number; removed: number; changed: number }>;
    };
}

export async function getVersionChecks(id: string): Promise<VersionChecks> {
    const { version, sections } = await getVersionExport(id);
    const type = version.type;

    const [usage, collisions, active] = await Promise.all([
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
        resolveActive(type)
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
