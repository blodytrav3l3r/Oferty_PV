#!/usr/bin/env node
/**
 * check-pricelist-health.ts — S5/O3: dzienny check "dokładnie 1 aktywna/typ".
 *
 * Read-only. Exit: 0 = OK, 2 = naruszenia, 1 = błąd.
 * Użycie:
 *   npm run pricelist:health
 *   npm run pricelist:health -- --json
 *   npm run pricelist:health -- --since=2026-10-01T00:00:00.000Z --require-zero-live-writes
 */
import 'dotenv/config';
import prisma from '../src/prismaClient';
import { getPricelistHealth } from '../src/services/pricelist/health';
import type { PricelistHealthReport } from '../src/services/pricelist/health';

function hasFlag(name: string): boolean {
    return process.argv.slice(2).includes(`--${name}`);
}

function argValue(name: string): string | undefined {
    const prefix = `--${name}=`;
    const hit = process.argv.slice(2).find((arg) => arg.startsWith(prefix));
    return hit ? hit.slice(prefix.length) : undefined;
}

function formatText(report: PricelistHealthReport): string {
    const lines = [`# Check cenników — ${report.checkedAt}`, ''];
    for (const [type, version] of Object.entries(report.active)) {
        lines.push(
            version === null
                ? `- ${type}: BRAK AKTYWNEJ`
                : `- ${type}: ${version.version} (${version.id}) od ${version.effectiveFrom}`
        );
    }
    lines.push(
        '',
        `LIVE_WRITE od ${report.liveWrites.since}: ${report.liveWrites.count}` +
            (report.liveWrites.count > 0 ? ` (${JSON.stringify(report.liveWrites.byType)})` : ''),
        '',
        report.ok ? 'OK: dokładnie 1 aktywna wersja na typ.' : 'NARUSZENIA:'
    );
    for (const violation of report.violations) {
        lines.push(`- ${violation.type} / ${violation.code}: ${violation.message}`);
    }
    return lines.join('\n');
}

async function main(): Promise<void> {
    const sinceRaw = argValue('since');
    const since = sinceRaw ? new Date(sinceRaw) : undefined;
    if (sinceRaw && Number.isNaN(since?.getTime())) {
        throw new Error(`Niepoprawne --since=${sinceRaw} (oczekiwano ISO)`);
    }

    const report = await getPricelistHealth({ since });
    console.log(hasFlag('json') ? JSON.stringify(report, null, 2) : formatText(report));

    const failOnLiveWrites = hasFlag('require-zero-live-writes') && report.liveWrites.count > 0;
    if (!report.ok || failOnLiveWrites) process.exitCode = 2;
}

if (require.main === module) {
    main()
        .catch((err: unknown) => {
            console.error('[pricelist:health] Błąd:', err);
            process.exitCode = 1;
        })
        .finally(async () => {
            await prisma.$disconnect();
        });
}
