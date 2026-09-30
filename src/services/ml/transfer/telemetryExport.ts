import prisma from '../../../prismaClient';

/**
 * P7.5 Extended — wybrane agregaty telemetryczne (opt-in).
 *
 * Informacyjne: importer weryfikuje checksumę, pokazuje liczby w podglądzie,
 * NIC nie zapisuje do DB celu (agregaty operacyjne, nie stan AI/ML).
 */
export interface TelemetryAggregates {
    generatedAt: string;
    windowDays: number;
    rowsScanned: number;
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

export async function buildTelemetryAggregates(windowDays = 30): Promise<TelemetryAggregates> {
    const since = new Date(Date.now() - windowDays * 24 * 3600 * 1000).toISOString().slice(0, 10);
    const rows = await prisma.ai_telemetry_logs.findMany({
        orderBy: { createdAt: 'desc' },
        take: SCAN_CAP,
        select: {
            createdAt: true,
            solverSource: true,
            wasAccepted: true,
            wasRejected: true,
            wasModified: true
        }
    });
    const groups = new Map<string, TelemetryAggregates['byDaySource'][number]>();
    for (const r of rows) {
        const day = String(r.createdAt).slice(0, 10);
        if (day < since) continue;
        const key = `${day}|${r.solverSource ?? 'unknown'}`;
        let g = groups.get(key);
        if (!g) {
            g = {
                day,
                solverSource: r.solverSource ?? 'unknown',
                count: 0,
                accepted: 0,
                rejected: 0,
                modified: 0
            };
            groups.set(key, g);
        }
        g.count++;
        if (r.wasAccepted) g.accepted++;
        if (r.wasRejected) g.rejected++;
        if (r.wasModified) g.modified++;
    }
    return {
        generatedAt: new Date().toISOString(),
        windowDays,
        rowsScanned: rows.length,
        byDaySource: [...groups.values()].sort((a, b) =>
            a.day < b.day ? -1 : a.day > b.day ? 1 : 0
        )
    };
}
