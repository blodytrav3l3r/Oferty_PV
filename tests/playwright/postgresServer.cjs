/* global __dirname, process, URL, console */

const { execFileSync, spawn } = require('node:child_process');
const { randomUUID } = require('node:crypto');
const path = require('node:path');
const { Client } = require('pg');

const ROOT = path.resolve(__dirname, '..', '..');
const PORT = process.env.PLAYWRIGHT_PORT || '3199';
const ALLOWED_HOSTS = new Set(['localhost', '127.0.0.1', '::1', 'postgres']);

function getTestDatabaseUrl() {
    const rawUrl = process.env.PLAYWRIGHT_DATABASE_URL;
    if (!rawUrl) throw new Error('PLAYWRIGHT_DATABASE_URL is required; SQLite is unsupported');

    const url = new URL(rawUrl);
    const database = decodeURIComponent(url.pathname.slice(1)).toLowerCase();
    if (!['postgres:', 'postgresql:'].includes(url.protocol)) {
        throw new Error('Playwright requires a PostgreSQL URL');
    }
    if (!ALLOWED_HOSTS.has(url.hostname.toLowerCase())) {
        throw new Error('Playwright database host must be a local test service');
    }
    if (!database.endsWith('_test') && !database.endsWith('_test_db')) {
        throw new Error('Playwright database name must end with _test or _test_db');
    }
    url.searchParams.delete('schema');
    return url;
}

function executePgScript(script, ...args) {
    execFileSync(process.execPath, ['-e', script, ...args], {
        cwd: ROOT,
        stdio: 'inherit',
        timeout: 120_000
    });
}

async function main() {
    const baseUrl = getTestDatabaseUrl();
    const schema = `sok_playwright_${process.pid}_${randomUUID().replaceAll('-', '').slice(0, 10)}`;
    const databaseUrl = new URL(baseUrl);
    databaseUrl.searchParams.set('schema', schema);

    const client = new Client({ connectionString: baseUrl.toString() });
    await client.connect();
    try {
        await client.query(`CREATE SCHEMA "${schema}"`);
    } finally {
        await client.end();
    }

    const migrationEnv = { ...process.env, DATABASE_URL: databaseUrl.toString() };
    try {
        execFileSync(
            process.execPath,
            [require.resolve('prisma/build/index.js'), 'migrate', 'deploy'],
            { cwd: ROOT, env: migrationEnv, stdio: 'inherit', timeout: 120_000 }
        );
        execFileSync(process.execPath, [require.resolve('prisma/build/index.js'), 'db', 'seed'], {
            cwd: ROOT,
            env: migrationEnv,
            stdio: 'inherit',
            timeout: 120_000
        });

        const server = spawn(process.execPath, [path.join(ROOT, 'dist', 'server.js')], {
            cwd: ROOT,
            env: {
                ...process.env,
                PORT,
                NODE_ENV: 'test',
                DATABASE_URL: databaseUrl.toString(),
                RATE_LIMIT_MULT: '100',
                CARE_SYNC_THROTTLE_MS: '0'
            },
            stdio: 'inherit'
        });
        const stopServer = () => {
            if (server.exitCode === null && server.signalCode === null) server.kill('SIGTERM');
        };
        process.on('SIGINT', stopServer);
        process.on('SIGTERM', stopServer);
        const exitCode = await new Promise((resolve, reject) => {
            server.once('error', reject);
            server.once('exit', (code, signal) => resolve(code ?? (signal ? 1 : 0)));
        });
        process.exitCode = exitCode;
    } finally {
        const dropScript = [
            "const { Client } = require('pg');",
            'const client = new Client({ connectionString: process.argv[1] });',
            'client.connect()',
            '  .then(() => client.query(`DROP SCHEMA IF EXISTS "${process.argv[2]}" CASCADE`))',
            '  .catch(() => { console.error("Unable to drop isolated Playwright PostgreSQL schema"); process.exitCode = 1; })',
            '  .finally(() => client.end());'
        ].join('\n');
        executePgScript(dropScript, baseUrl.toString(), schema);
    }
}

main().catch((error) => {
    console.error(error instanceof Error ? error.message : 'Playwright PostgreSQL startup failed');
    process.exitCode = 1;
});
