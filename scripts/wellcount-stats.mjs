#!/usr/bin/env node
// Read-only distribution report for offers_studnie_rel on PostgreSQL.
import { Client } from 'pg';

const BUCKETS = [
    [0, 0],
    [1, 10],
    [11, 50],
    [51, 68],
    [69, 200],
    [201, 500],
    [501, 1000],
    [1001, 3000],
    [3001, Infinity]
];

function percentile(sorted, percent) {
    if (!sorted.length) return 0;
    const index = Math.min(
        sorted.length - 1,
        Math.max(0, Math.ceil((percent / 100) * sorted.length) - 1)
    );
    return sorted[index];
}

function parseDatabaseUrl(rawUrl) {
    if (!rawUrl) throw new Error('DATABASE_URL is required');
    const url = new URL(rawUrl);
    if (!['postgres:', 'postgresql:'].includes(url.protocol)) {
        throw new Error('DATABASE_URL must use PostgreSQL');
    }
    const schema = url.searchParams.get('schema') || 'public';
    if (!url.hostname || url.pathname.length < 2 || !/^[A-Za-z_][A-Za-z0-9_]*$/.test(schema)) {
        throw new Error('DATABASE_URL must include a valid PostgreSQL host, database and schema');
    }
    url.searchParams.delete('schema');
    return { connectionString: url.toString(), schema, database: url.pathname.slice(1) };
}

function summarize(rows) {
    const counts = rows.map((row) => Number(row.wellCount) || 0).sort((a, b) => a - b);
    const dataLengths = rows.map((row) => Number(row.dataLen) || 0).sort((a, b) => a - b);
    const total = counts.length;
    const sum = counts.reduce((accumulator, count) => accumulator + count, 0);
    const zeros = counts.filter((count) => count === 0).length;
    const distribution = BUCKETS.map(([min, max]) => ({
        range: `${min}-${max === Infinity ? 'inf' : max}`,
        offers: counts.filter((count) => count >= min && count <= max).length
    }));
    const sample = [...rows]
        .sort((a, b) => Number(b.wellCount) - Number(a.wellCount))
        .slice(0, 8)
        .map((row) => {
            let jsonWells = -1;
            try {
                const data = JSON.parse(row.data || '{}');
                jsonWells = Array.isArray(data.wells) ? data.wells.length : -1;
            } catch {
                jsonWells = -1;
            }
            return {
                wellCount: Number(row.wellCount) || 0,
                jsonWells,
                match: jsonWells === Number(row.wellCount)
            };
        });
    return {
        offersTotal: total,
        offersEmpty: zeros,
        offersNonEmpty: total - zeros,
        wellsSum: sum,
        wellsMean: total ? Number((sum / total).toFixed(2)) : 0,
        min: counts[0] ?? 0,
        max: counts[total - 1] ?? 0,
        p50: percentile(counts, 50),
        p75: percentile(counts, 75),
        p90: percentile(counts, 90),
        p95: percentile(counts, 95),
        p99: percentile(counts, 99),
        distribution,
        dataJsonBytes: {
            p50: percentile(dataLengths, 50),
            p90: percentile(dataLengths, 90),
            p99: percentile(dataLengths, 99),
            max: dataLengths[total - 1] ?? 0
        },
        sanity: sample
    };
}

function printReport(report, asJson) {
    if (asJson) {
        console.log(JSON.stringify(report, null, 2));
        return;
    }
    console.log(`=== offers_studnie_rel wellCount | ${report.database}/${report.schema} ===`);
    console.log(
        'ofert:',
        report.offersTotal,
        '| puste:',
        report.offersEmpty,
        '| niepuste:',
        report.offersNonEmpty,
        '| studnie:',
        report.wellsSum,
        '| mean:',
        report.wellsMean
    );
    console.log(
        'percentyle:',
        `min=${report.min}`,
        `p50=${report.p50}`,
        `p75=${report.p75}`,
        `p90=${report.p90}`,
        `p95=${report.p95}`,
        `p99=${report.p99}`,
        `max=${report.max}`
    );
    console.log('rozkład (ofert/oferta):');
    for (const bucket of report.distribution)
        console.log(`  ${bucket.range.padEnd(10)} ${bucket.offers}`);
    console.log('data JSON B:', JSON.stringify(report.dataJsonBytes));
    console.log('sanity (wellCount vs JSON wells.length):');
    for (const sample of report.sanity) {
        console.log(
            `  wellCount=${sample.wellCount} | JSON=${sample.jsonWells} ${sample.match ? 'OK' : 'MISMATCH'}`
        );
    }
}

async function main() {
    const database = parseDatabaseUrl(process.env.DATABASE_URL);
    const client = new Client({ connectionString: database.connectionString });
    try {
        await client.connect();
        const result = await client.query(
            `SELECT "wellCount", octet_length(COALESCE("data", '')) AS "dataLen", "data" FROM "${database.schema}"."offers_studnie_rel"`
        );
        printReport(
            { database: database.database, schema: database.schema, ...summarize(result.rows) },
            process.argv.includes('--json')
        );
    } finally {
        await client.end();
    }
}

main().catch((error) => {
    const code =
        error && typeof error.code === 'string' && /^[A-Z0-9]+$/.test(error.code)
            ? error.code
            : 'DATABASE_ERROR';
    console.error(`[wellcount-stats] PostgreSQL read failed (${code}).`);
    process.exitCode = 2;
});
