const { execFileSync } = require('node:child_process');
const { randomUUID } = require('node:crypto');
const path = require('node:path');
const { TestEnvironment } = require('jest-environment-node');
const { Client } = require('pg');
const { parsePostgresTestUrl, readPostgresTestUrl } = require('../scripts/postgres-test-url.cjs');

const projectRoot = path.resolve(__dirname, '..');
const registerCleanup = Symbol.for('sok.jest.registerPrismaCleanup');
let workerDatabaseUrl;

function getPostgresUrl() {
    if (process.env.NODE_ENV !== 'test') {
        throw new Error('PostgreSQL schema isolation is permitted only with NODE_ENV=test');
    }
    const rawUrl = readPostgresTestUrl();
    const url = parsePostgresTestUrl(rawUrl);
    process.env.POSTGRES_TEST_URL = rawUrl;
    return url;
}

async function initializeWorkerSchema() {
    const baseUrl = getPostgresUrl();
    const runId = process.env.SOK_POSTGRES_TEST_RUN_ID;
    if (!runId || !/^[a-f0-9]{16}$/.test(runId)) {
        throw new Error('SOK_POSTGRES_TEST_RUN_ID must be a 16-character lowercase hex id');
    }
    const suffix = randomUUID().replaceAll('-', '').slice(0, 12);
    const schema = `sok_jest_${runId}_${process.pid}_${suffix}`;
    const client = new Client({
        connectionString: baseUrl.toString(),
        connectionTimeoutMillis: 5_000
    });
    try {
        await client.connect();
        await client.query(`CREATE SCHEMA "${schema}"`);
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
    prismaCleanup = [];

    async setup() {
        await super.setup();
        workerDatabaseUrl ??= initializeWorkerSchema();
        this.global.process.env.DATABASE_URL = await workerDatabaseUrl;
        this.global.process.env.POSTGRES_TEST_URL = process.env.POSTGRES_TEST_URL;
        this.global[registerCleanup] = (disconnect) => this.prismaCleanup.push(disconnect);
    }

    async teardown() {
        try {
            const results = await Promise.allSettled(
                this.prismaCleanup.map(async (disconnect) => disconnect())
            );
            const failures = results.filter((result) => result.status === 'rejected');
            if (failures.length > 0) {
                throw new AggregateError(
                    failures.map((failure) => failure.reason),
                    'Failed to disconnect PostgreSQL test clients'
                );
            }
        } finally {
            await super.teardown();
        }
    }
};
