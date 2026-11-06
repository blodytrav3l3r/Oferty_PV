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
    const client = new Client({
        connectionString: baseUrl.toString(),
        connectionTimeoutMillis: 5_000
    });
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
