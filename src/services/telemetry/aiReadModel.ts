import prisma from '../../prismaClient';

export interface WellSelectionItem {
    wellId: string;
    dn: string | null;
    warehouse: string | null;
    modelVersion: string | null;
    count: number;
    lastSeenAt: string | null;
}

export interface WellSelectionsReport {
    totalWells: number;
    totalSelections: number;
    items: WellSelectionItem[];
}

// Indeks idx_logs_source_well (solverSource, wellId) — filtr po solverSource.
// Limit 500 najnowszych: jedyny konsument (aiDashboard.js) pokazuje slice(0, 20)
// po lastSeenAt desc — paginacja zbędna (YAGNI).
export async function getWellSelections(limit = 500): Promise<WellSelectionsReport> {
    const logs = await prisma.ai_telemetry_logs.findMany({
        where: { solverSource: 'AI_SUGGEST' },
        select: {
            wellId: true,
            dn: true,
            warehouse: true,
            aiVersion: true,
            createdAt: true
        },
        orderBy: { createdAt: 'desc' },
        take: limit
    });

    // Agregacja w pamieci — dane sa male (brak groupBy w Prisma/SQLite dla tego modelu).
    const byWell = new Map<string, WellSelectionItem>();

    for (const log of logs) {
        if (!log.wellId) continue;
        const existing = byWell.get(log.wellId);
        if (!existing) {
            byWell.set(log.wellId, {
                wellId: log.wellId,
                dn: log.dn ?? null,
                warehouse: log.warehouse ?? null,
                modelVersion: log.aiVersion ?? null,
                count: 1,
                lastSeenAt: log.createdAt ?? null
            });
        } else {
            existing.count += 1;
            if (
                log.createdAt &&
                (!existing.lastSeenAt ||
                    Date.parse(log.createdAt) > Date.parse(existing.lastSeenAt))
            ) {
                existing.lastSeenAt = log.createdAt;
            }
        }
    }

    const items = Array.from(byWell.values()).sort((a, b) => {
        const ta = a.lastSeenAt ? Date.parse(a.lastSeenAt) : 0;
        const tb = b.lastSeenAt ? Date.parse(b.lastSeenAt) : 0;
        return tb - ta;
    });

    return {
        totalWells: items.length,
        totalSelections: items.reduce((sum, w) => sum + w.count, 0),
        items
    };
}

export interface PredictionStats {
    total: number;
    actions: Record<string, number>;
    recentScores: number[];
    recentCount: number;
}

export async function getPredictionStats(recentLimit = 100): Promise<PredictionStats> {
    const total = await prisma.aiRewardLog.count();
    const byAction = await prisma.aiRewardLog.groupBy({
        by: ['action'],
        _count: { _all: true }
    });
    const actions: Record<string, number> = {};
    for (const row of byAction) {
        actions[row.action] = row._count._all;
    }
    const recent = await prisma.aiRewardLog.findMany({
        where: { scoreBefore: { not: null } },
        orderBy: { createdAt: 'desc' },
        take: recentLimit
    });
    const scores = recent
        .map((r) => r.scoreBefore)
        .filter((s): s is number => typeof s === 'number');
    return { total, actions, recentScores: scores, recentCount: scores.length };
}

export async function getTrainingRuns(limit = 20) {
    return prisma.aiTrainingRun.findMany({
        orderBy: { startedAt: 'desc' },
        take: limit
    });
}

export async function getTrainingRunById(id: string) {
    return prisma.aiTrainingRun.findUnique({ where: { id } });
}
