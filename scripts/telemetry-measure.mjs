#!/usr/bin/env node
/** Informational PostgreSQL growth report for telemetry and audit tables. */
import { Client } from 'pg';

const TABLES = ['ai_telemetry_logs', 'ai_telemetry_events', 'audit_logs'];
const THRESHOLDS = Object.freeze({
    telemetryRowsWarn: 500000,
    telemetryGrowthWarnBytesDay: 50 * 1024 * 1024,
    auditBytesWarn: 5 * 1024 * 1024 * 1024
});

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

function ratePerDay(rows, bytes, min, max) {
    if (!min || !max) return { rowsPerDay: null, bytesPerDay: null };
    const days = Math.max(1, (Date.parse(max) - Date.parse(min)) / 86400000);
    return {
        rowsPerDay: Math.round(rows / days),
        bytesPerDay: Math.round(bytes / days)
    };
}

async function readTableStat(client, schema, table) {
    const [counts, size] = await Promise.all([
        client.query(
            `SELECT COUNT(*)::text AS rows, MIN("createdAt")::text AS min, MAX("createdAt")::text AS max FROM "${schema}"."${table}"`
        ),
        client.query(
            "SELECT COALESCE(pg_total_relation_size(to_regclass(quote_ident($1) || '.' || quote_ident($2))), 0)::text AS bytes",
            [schema, table]
        )
    ]);
    const rows = Number(counts.rows[0].rows);
    const bytes = Number(size.rows[0].bytes);
    const { min, max } = counts.rows[0];
    return {
        rows,
        bytes,
        min,
        max,
        ...(min && max ? ratePerDay(rows, bytes, min, max) : {})
    };
}

async function main() {
    const database = parseDatabaseUrl(process.env.DATABASE_URL);
    const client = new Client({ connectionString: database.connectionString });
    try {
        await client.connect();
        const tables = Object.fromEntries(
            await Promise.all(
                TABLES.map(async (table) => [
                    table,
                    await readTableStat(client, database.schema, table)
                ])
            )
        );
        const [databaseSize] = await client
            .query('SELECT pg_database_size(current_database())::text AS bytes')
            .then((result) => result.rows);
        const report = {
            database: database.database,
            schema: database.schema,
            dbBytes: Number(databaseSize.bytes),
            tables,
            thresholds: THRESHOLDS,
            warnings: []
        };
        const telemetry = tables.ai_telemetry_logs;
        if (telemetry.rows > THRESHOLDS.telemetryRowsWarn) {
            report.warnings.push('telemetry rows powyżej progu');
        }
        if ((telemetry.bytesPerDay ?? 0) > THRESHOLDS.telemetryGrowthWarnBytesDay) {
            report.warnings.push('telemetry wzrost powyżej progu');
        }
        if (tables.audit_logs.bytes > THRESHOLDS.auditBytesWarn) {
            report.warnings.push('audit powyżej 5 GB');
        }
        console.log(JSON.stringify(report, null, 2));
    } finally {
        await client.end();
    }
}

main().catch((error) => {
    const message = error instanceof Error ? error.message : 'unknown error';
    console.error(`[measure] PostgreSQL report failed: ${message}`);
    process.exitCode = 2;
});
