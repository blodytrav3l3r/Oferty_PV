/* global __dirname, process, URL */

const { execFileSync } = require('node:child_process');
const { randomUUID } = require('node:crypto');
const path = require('node:path');
const { Client } = require('pg');

const ROOT = path.resolve(__dirname, '..', '..');
const ALLOWED_HOSTS = new Set(['localhost', '127.0.0.1', '::1', 'postgres']);

function getBaseUrl() {
    const rawUrl = process.env.PLAYWRIGHT_DATABASE_URL || process.env.DATABASE_URL;
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

function dropSchema(baseUrl, schema) {
    const script = [
        "const { Client } = require('pg');",
        'const client = new Client({ connectionString: process.argv[1] });',
        'client.connect()',
        '  .then(() => client.query(`DROP SCHEMA IF EXISTS "${process.argv[2]}" CASCADE`))',
        '  .catch(() => { console.error("Unable to clean up isolated PostgreSQL schema"); process.exitCode = 1; })',
        '  .finally(() => client.end());'
    ].join('\n');
    execFileSync(process.execPath, ['-e', script, baseUrl, schema], {
        cwd: ROOT,
        stdio: 'inherit',
        timeout: 30_000
    });
}

async function createIsolatedPostgresSchema(name) {
    const baseUrl = getBaseUrl();
    const safeName = String(name)
        .toLowerCase()
        .replace(/[^a-z0-9_]/g, '_')
        .slice(0, 18);
    const schema = `sok_pw_${safeName}_${process.pid}_${randomUUID().replaceAll('-', '').slice(0, 8)}`;
    const databaseUrl = new URL(baseUrl);
    databaseUrl.searchParams.set('schema', schema);
    const client = new Client({ connectionString: baseUrl.toString() });
    await client.connect();
    try {
        await client.query(`CREATE SCHEMA "${schema}"`);
    } finally {
        await client.end();
    }

    const env = { ...process.env, DATABASE_URL: databaseUrl.toString() };
    try {
        execFileSync(
            process.execPath,
            [require.resolve('prisma/build/index.js'), 'migrate', 'deploy'],
            {
                cwd: ROOT,
                env,
                stdio: 'inherit',
                timeout: 120_000
            }
        );
        execFileSync(process.execPath, [require.resolve('prisma/build/index.js'), 'db', 'seed'], {
            cwd: ROOT,
            env,
            stdio: 'inherit',
            timeout: 120_000
        });
    } catch (error) {
        dropSchema(baseUrl.toString(), schema);
        throw error;
    }

    let isCleaned = false;
    const cleanup = () => {
        if (isCleaned) return;
        isCleaned = true;
        dropSchema(baseUrl.toString(), schema);
    };
    process.once('exit', cleanup);
    return { databaseUrl: databaseUrl.toString() };
}

module.exports = { createIsolatedPostgresSchema };
