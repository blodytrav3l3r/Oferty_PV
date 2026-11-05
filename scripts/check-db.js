'use strict';

const { Client } = require('pg');

const REQUIRED_TABLES = [
    'ai_telemetry_logs',
    'ai_telemetry_events',
    'ai_config_history',
    'ai_telemetry_versions',
    'ai_transition_snapshots',
    'ai_knowledge_base',
    'ai_recommendations'
];
const PRODUCT_TABLES = [
    'PricelistVersion',
    'PricelistItemRury',
    'PricelistItemStudnie',
    'PricelistItemPrecoKonfig',
    'PricelistItemPrecoKinety',
    'PricelistItemPrecoZakresy',
    'AiModel'
];
const REQUIRED_INDEXES = ['idx_logs_well', 'idx_logs_source_well'];
const PRODUCT_DATA_CHECKS = [{ table: 'AiModel', minRows: 1 }];

function parseDatabaseUrl(rawUrl) {
    if (!rawUrl) throw new Error('DATABASE_URL is required');
    const url = new URL(rawUrl);
    if (!['postgres:', 'postgresql:'].includes(url.protocol)) {
        throw new Error('DATABASE_URL must use PostgreSQL');
    }
    if (!url.hostname || url.pathname.length < 2) {
        throw new Error('DATABASE_URL must include a PostgreSQL host and database');
    }
    const schema = url.searchParams.get('schema') || 'public';
    if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(schema)) {
        throw new Error('DATABASE_URL schema is invalid');
    }
    url.searchParams.delete('schema');
    return { connectionString: url.toString(), schema };
}

async function checkDatabase(client, schema) {
    const { rows: tableRows } = await client.query(
        `SELECT table_name FROM information_schema.tables
         WHERE table_schema = $1 AND table_type = 'BASE TABLE'`,
        [schema]
    );
    const tables = new Set(tableRows.map((row) => row.table_name));
    const missingAI = REQUIRED_TABLES.filter((table) => !tables.has(table));
    const missingProduct = PRODUCT_TABLES.filter((table) => !tables.has(table));
    const emptyProduct = [];
    for (const check of PRODUCT_DATA_CHECKS) {
        if (!tables.has(check.table)) continue;
        const result = await client.query(
            `SELECT COUNT(*)::bigint AS count FROM "${schema}"."${check.table}"`
        );
        if (Number(result.rows[0]?.count ?? 0) < check.minRows) emptyProduct.push(check.table);
    }

    const { rows: indexRows } = await client.query(
        `SELECT indexname FROM pg_catalog.pg_indexes WHERE schemaname = $1`,
        [schema]
    );
    const indexes = new Set(indexRows.map((row) => row.indexname));
    const missingIndexes = REQUIRED_INDEXES.filter((index) => !indexes.has(index));
    return { missingAI, missingProduct, emptyProduct, missingIndexes };
}

async function main() {
    let connection;
    try {
        connection = parseDatabaseUrl(process.env.DATABASE_URL);
        const client = new Client({ connectionString: connection.connectionString });
        await client.connect();
        try {
            const result = await checkDatabase(client, connection.schema);
            if (result.missingAI.length || result.missingProduct.length) {
                console.error(
                    '[check-db] MISSING TABLES: ' +
                        [...result.missingAI, ...result.missingProduct].join(', ')
                );
                process.exitCode = 1;
                return;
            }
            if (result.missingIndexes.length) {
                console.error('[check-db] MISSING INDEXES: ' + result.missingIndexes.join(', '));
                console.error('[check-db] Apply PostgreSQL migrations before starting S.O.K.');
                process.exitCode = 1;
                return;
            }
            if (result.emptyProduct.length) {
                console.error(
                    '[check-db] MISSING REQUIRED STARTER DATA: ' + result.emptyProduct.join(', ')
                );
                process.exitCode = 2;
                return;
            }
            console.log('[check-db] OK — PostgreSQL tables, indexes and starter data are present.');
        } finally {
            await client.end();
        }
    } catch (error) {
        const message = error instanceof Error ? error.message : 'unknown error';
        const safeMessage = message.replace(
            /postgres(?:ql)?:\/\/[^\s]+/gi,
            '[redacted PostgreSQL URL]'
        );
        console.error('[check-db] PostgreSQL check failed: ' + safeMessage);
        process.exitCode = 1;
    }
}

if (require.main === module) void main();

module.exports = { checkDatabase, parseDatabaseUrl };
