const fs = require('node:fs');
const path = require('node:path');

function readPostgresTestUrl() {
    const envPath = path.join(__dirname, '..', '.env');
    return (
        process.env.POSTGRES_TEST_URL ||
        (fs.existsSync(envPath)
            ? require('dotenv').parse(fs.readFileSync(envPath, 'utf8')).POSTGRES_TEST_URL
            : undefined)
    );
}

function parsePostgresTestUrl(rawUrl) {
    if (!rawUrl) throw new Error('POSTGRES_TEST_URL is required for PostgreSQL tests');

    let url;
    let database;
    try {
        url = new URL(rawUrl);
        database = decodeURIComponent(url.pathname.slice(1)).toLowerCase();
    } catch {
        throw new Error('POSTGRES_TEST_URL must be a valid PostgreSQL URL');
    }
    if (!['postgres:', 'postgresql:'].includes(url.protocol)) {
        throw new Error('POSTGRES_TEST_URL must use PostgreSQL');
    }
    if (
        !['localhost', '127.0.0.1', '[::1]', 'postgres', 'postgres-test'].includes(
            url.hostname.toLowerCase()
        )
    ) {
        throw new Error('POSTGRES_TEST_URL host must be a local test service');
    }
    if (!database.endsWith('_test') && !database.endsWith('_test_db')) {
        throw new Error('POSTGRES_TEST_URL database name must end in _test or _test_db');
    }
    if ([...url.searchParams.keys()].some((key) => key !== 'schema' && key !== 'sslmode')) {
        throw new Error(
            'POSTGRES_TEST_URL supports only schema and sslmode query parameters. ' +
                'Remove extra parameters such as connection_limit. The test runner sets the pool size.'
        );
    }
    url.searchParams.delete('schema');
    return url;
}

module.exports = { parsePostgresTestUrl, readPostgresTestUrl };

async function checkPostgresTestConnection() {
    const url = parsePostgresTestUrl(readPostgresTestUrl());
    const { Client } = require('pg');
    const client = new Client({
        connectionString: url.toString(),
        connectionTimeoutMillis: 5_000
    });
    try {
        await client.connect();
    } catch {
        throw new Error(
            `Cannot connect to PostgreSQL test service at ${url.host}. ` +
                'Check POSTGRES_TEST_URL and start the isolated PostgreSQL test service.'
        );
    } finally {
        await client.end();
    }
}

if (require.main === module) {
    checkPostgresTestConnection().catch((error) => {
        console.error(error.message);
        process.exitCode = 1;
    });
}
