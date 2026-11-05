/** Give each Jest worker an isolated PostgreSQL schema and apply migrations. */
import { execFileSync } from 'node:child_process';
import path from 'node:path';

function getPostgresUrl(): URL {
    if (process.env.NODE_ENV !== 'test') {
        throw new Error('PostgreSQL schema isolation is permitted only with NODE_ENV=test');
    }
    const rawUrl = process.env.POSTGRES_TEST_URL;
    if (!rawUrl) {
        throw new Error('POSTGRES_TEST_URL is required for backend tests');
    }

    let parsedUrl: URL;
    try {
        parsedUrl = new URL(rawUrl);
    } catch {
        throw new Error('Backend tests require a valid PostgreSQL connection URL');
    }

    if (!['postgres:', 'postgresql:'].includes(parsedUrl.protocol)) {
        throw new Error('Backend tests require PostgreSQL; SQLite URLs are unsupported');
    }
    if (!parsedUrl.hostname || parsedUrl.pathname.length < 2) {
        throw new Error('The PostgreSQL test URL must include a host and database name');
    }
    const host = parsedUrl.hostname.toLowerCase();
    const database = decodeURIComponent(parsedUrl.pathname.slice(1)).toLowerCase();
    if (!['localhost', '127.0.0.1', '::1', 'postgres'].includes(host)) {
        throw new Error('PostgreSQL test URL host must be a local test service');
    }
    if (!database.endsWith('_test') && !database.endsWith('_test_db')) {
        throw new Error('PostgreSQL test database name must end with _test or _test_db');
    }

    return parsedUrl;
}

function initializeWorkerSchema(): void {
    const testUrl = getPostgresUrl();
    if (process.env.SOK_PG_TEST_SCHEMA_READY === '1') {
        const activeDatabaseUrl = process.env.DATABASE_URL;
        if (!activeDatabaseUrl) {
            throw new Error('SOK_PG_TEST_SCHEMA_READY requires an isolated Jest schema URL');
        }
        const activeUrl = new URL(activeDatabaseUrl);
        const expectedUrl = new URL(testUrl);
        const activeSchema = activeUrl.searchParams.get('schema') ?? '';
        activeUrl.searchParams.delete('schema');
        expectedUrl.searchParams.delete('schema');
        if (
            !/^sok_jest_\d+_\d+$/.test(activeSchema) ||
            activeUrl.toString() !== expectedUrl.toString()
        ) {
            throw new Error('SOK_PG_TEST_SCHEMA_READY requires the validated test database URL');
        }
        return;
    }

    const workerId = process.env.JEST_WORKER_ID ?? '1';
    if (!/^\d+$/.test(workerId)) throw new Error('JEST_WORKER_ID must be numeric');
    const schemaName = `sok_jest_${process.pid}_${workerId}`;
    const workerUrl = testUrl;
    workerUrl.searchParams.set('schema', schemaName);

    const createSchemaScript = [
        "const { Client } = require('pg');",
        'const client = new Client({ connectionString: process.argv[1] });',
        'client.connect()',
        "  .then(() => client.query('CREATE SCHEMA IF NOT EXISTS \"' + process.argv[2] + '\"'))",
        "  .catch(() => { console.error('Unable to create isolated PostgreSQL test schema'); process.exitCode = 1; })",
        '  .finally(() => client.end());'
    ].join('\n');

    const projectRoot = path.resolve(__dirname, '..');
    execFileSync(process.execPath, ['-e', createSchemaScript, testUrl.toString(), schemaName], {
        cwd: projectRoot,
        stdio: 'inherit',
        timeout: 30_000
    });
    execFileSync(
        process.execPath,
        [
            path.join(projectRoot, 'node_modules', 'prisma', 'build', 'index.js'),
            'migrate',
            'deploy'
        ],
        {
            cwd: projectRoot,
            env: { ...process.env, DATABASE_URL: workerUrl.toString() },
            stdio: 'inherit',
            timeout: 120_000
        }
    );

    process.env.DATABASE_URL = workerUrl.toString();
    process.env.SOK_PG_TEST_SCHEMA_READY = '1';
    process.on('exit', () => {
        const dropSchemaScript = [
            "const { Client } = require('pg');",
            'const client = new Client({ connectionString: process.argv[1] });',
            'client.connect()',
            "  .then(() => client.query('DROP SCHEMA IF EXISTS \"' + process.argv[2] + '\" CASCADE'))",
            "  .catch(() => { console.error('Unable to drop isolated PostgreSQL test schema'); process.exitCode = 1; })",
            '  .finally(() => client.end());'
        ].join('\n');

        try {
            execFileSync(
                process.execPath,
                ['-e', dropSchemaScript, testUrl.toString(), schemaName],
                {
                    cwd: projectRoot,
                    stdio: 'inherit',
                    timeout: 30_000
                }
            );
        } catch {
            process.stderr.write(`Unable to drop isolated PostgreSQL Jest schema ${schemaName}.\n`);
            process.exitCode = 1;
        }
    });
}

initializeWorkerSchema();
