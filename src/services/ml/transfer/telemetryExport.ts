import prisma from '../../../prismaClient';
import { getTrainingUserIds } from '../trainingUsers';

/**
 * P7.5 Extended — wybrane agregaty telemetryczne (opt-in).
 *
 * Informacyjne: importer weryfikuje checksumę, pokazuje liczby w podglądzie,
 * NIC nie zapisuje do DB celu (agregaty operacyjne, nie stan AI/ML).
 */
export interface TelemetryAggregates {
    generatedAt: string;
    windowDays: number;
    rowsIncluded: number;
    byDaySource: Array<{
        day: string;
        solverSource: string;
        count: number;
        accepted: number;
        rejected: number;
        modified: number;
    }>;
}

const SCAN_CAP = 5000;
const MIN_DISTINCT_OWNERS = 5;
const MAX_ROWS_PER_OWNER_PER_GROUP = 20;

export async function buildTelemetryAggregates(
    windowDays = 30,
    allowedUserIds?: readonly string[]
): Promise<TelemetryAggregates> {
    const since = new Date(Date.now() - windowDays * 24 * 3600 * 1000).toISOString().slice(0, 10);
    const allowlist = allowedUserIds ?? (await getTrainingUserIds());
    if (allowlist.length === 0) {
        return {
            generatedAt: new Date().toISOString(),
            windowDays,
            rowsIncluded: 0,
            byDaySource: []
        };
    }
    const rows = await prisma.ai_telemetry_logs.findMany({
        where: {
            userId: { in: [...allowlist] },
            trainingEligible: true,
            createdAt: { gte: since }
        },
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        take: SCAN_CAP,
        select: {
            userId: true,
            createdAt: true,
            solverSource: true,
            wasAccepted: true,
            wasRejected: true,
            wasModified: true
        }
    });
    const groups = new Map<
        string,
        {
            aggregate: TelemetryAggregates['byDaySource'][number];
            owners: Set<string>;
            ownerRows: Map<string, number>;
        }
    >();
    for (const r of rows) {
        if (!r.userId) continue;
        const day = String(r.createdAt).slice(0, 10);
        if (day < since) continue;
        const key = `${day}|${r.solverSource ?? 'unknown'}`;
        let group = groups.get(key);
        if (!group) {
            group = {
                aggregate: {
                    day,
                    solverSource: r.solverSource ?? 'unknown',
                    count: 0,
                    accepted: 0,
                    rejected: 0,
                    modified: 0
                },
                owners: new Set(),
                ownerRows: new Map()
            };
            groups.set(key, group);
        }
        const ownerRows = group.ownerRows.get(r.userId) ?? 0;
        if (ownerRows >= MAX_ROWS_PER_OWNER_PER_GROUP) continue;
        const g = group.aggregate;
        group.owners.add(r.userId);
        group.ownerRows.set(r.userId, ownerRows + 1);
        g.count++;
        if (r.wasAccepted) g.accepted++;
        if (r.wasRejected) g.rejected++;
        if (r.wasModified) g.modified++;
    }
    const publishedGroups = [...groups.values()]
        .filter((group) => group.owners.size >= MIN_DISTINCT_OWNERS)
        .map((group) => group.aggregate)
        .sort((a, b) => (a.day < b.day ? -1 : a.day > b.day ? 1 : 0));
    return {
        generatedAt: new Date().toISOString(),
        windowDays,
        rowsIncluded: publishedGroups.reduce((total, group) => total + group.count, 0),
        byDaySource: publishedGroups
    };
}
