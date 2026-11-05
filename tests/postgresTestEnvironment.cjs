const { execFileSync } = require('node:child_process');
const { randomUUID } = require('node:crypto');
const path = require('node:path');
const { TestEnvironment } = require('jest-environment-node');
const { Client } = require('pg');

const projectRoot = path.resolve(__dirname, '..');
let workerDatabaseUrl;

function getPostgresUrl() {
    if (process.env.NODE_ENV !== 'test') {
        throw new Error('PostgreSQL schema isolation is permitted only with NODE_ENV=test');
    }
    const rawUrl = process.env.POSTGRES_TEST_URL;
    if (!rawUrl) throw new Error('POSTGRES_TEST_URL is required for backend tests');

    const url = new URL(rawUrl);
    if (!['postgres:', 'postgresql:'].includes(url.protocol)) {
        throw new Error('Backend tests require a PostgreSQL URL');
    }
    if (!['localhost', '127.0.0.1', '[::1]', 'postgres'].includes(url.hostname.toLowerCase())) {
        throw new Error('PostgreSQL test URL host must be a local test service');
    }
    const database = decodeURIComponent(url.pathname.slice(1)).toLowerCase();
    if (!database.endsWith('_test') && !database.endsWith('_test_db')) {
        throw new Error('PostgreSQL test database name must end with _test or _test_db');
    }
    if ([...url.searchParams.keys()].some((key) => key !== 'schema' && key !== 'sslmode')) {
        throw new Error('PostgreSQL test URL supports only schema and sslmode query parameters');
    }
    url.searchParams.delete('schema');
    return url;
}

function registerSchemaCleanup(baseUrl, schema) {
    process.once('exit', () => {
        const dropScript = [
            "const { Client } = require('pg');",
            'const client = new Client({ connectionString: process.env.DATABASE_URL });',
            'client.connect()',
            '  .then(() => client.query(`DROP SCHEMA "${process.argv[1]}" CASCADE`))',
            '  .catch(() => { console.error("Unable to drop isolated PostgreSQL test schema"); process.exitCode = 1; })',
            '  .finally(() => client.end());'
        ].join('\n');
        try {
            execFileSync(process.execPath, ['-e', dropScript, schema], {
                cwd: projectRoot,
                env: { ...process.env, DATABASE_URL: baseUrl },
                stdio: 'inherit',
                timeout: 30_000
            });
        } catch {
            process.stderr.write(`Unable to drop isolated PostgreSQL Jest schema ${schema}.\n`);
            process.exitCode = 1;
        }
    });
}

async function initializeWorkerSchema() {
    const baseUrl = getPostgresUrl();
    const suffix = randomUUID().replaceAll('-', '').slice(0, 12);
    const schema = `sok_jest_${process.pid}_${suffix}`;
    const client = new Client({ connectionString: baseUrl.toString() });
    try {
        await client.connect();
        await client.query(`CREATE SCHEMA "${schema}"`);
        registerSchemaCleanup(baseUrl.toString(), schema);
    } finally {
        await client.end();
    }

    const workerUrl = new URL(baseUrl);
    workerUrl.searchParams.set('schema', schema);
    const databaseUrl = workerUrl.toString();
    execFileSync(
        process.execPath,
        [require.resolve('prisma/build/index.js'), 'migrate', 'deploy'],
        {
            cwd: projectRoot,
            env: {
                ...process.env,
                DATABASE_URL: databaseUrl,
                // Schemat jest świeży i należy wyłącznie do tego workera.
                PRISMA_SCHEMA_DISABLE_ADVISORY_LOCK: '1'
            },
            stdio: 'inherit',
            timeout: 120_000
        }
    );
    return databaseUrl;
}

module.exports = class PostgresTestEnvironment extends TestEnvironment {
    async setup() {
        await super.setup();
        workerDatabaseUrl ??= initializeWorkerSchema();
        this.global.process.env.DATABASE_URL = await workerDatabaseUrl;
    }
};
