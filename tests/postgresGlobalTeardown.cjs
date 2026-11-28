const { Client } = require('pg');
const { parsePostgresTestUrl, readPostgresTestUrl } = require('../scripts/postgres-test-url.cjs');

module.exports = async function postgresGlobalTeardown() {
    const runId = process.env.SOK_POSTGRES_TEST_RUN_ID;
    if (!runId || !/^[a-f0-9]{16}$/.test(runId)) {
        throw new Error('SOK_POSTGRES_TEST_RUN_ID must be a 16-character lowercase hex id');
    }

    const baseUrl = parsePostgresTestUrl(readPostgresTestUrl());
    const client = new Client({
        connectionString: baseUrl.toString(),
        connectionTimeoutMillis: 5_000
    });
    const schemaPrefix = `sok_jest_${runId}_`;

    try {
        await client.connect();
        const { rows } = await client.query(
            'SELECT nspname FROM pg_namespace WHERE left(nspname, char_length($1)) = $1',
            [schemaPrefix]
        );
        const schemas = rows
            .map((row) => row.nspname)
            .filter((schema) => schema.startsWith(schemaPrefix) && /^[a-z0-9_]+$/.test(schema));

        for (const schema of schemas) {
            await client.query(`DROP SCHEMA IF EXISTS "${schema}" CASCADE`);
        }
    } finally {
        await client.end();
    }
};
