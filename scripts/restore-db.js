'use strict';

const fs = require('fs');
const path = require('path');
const readline = require('readline');
const crypto = require('crypto');
const { execFileSync } = require('child_process');
const { createReadStream } = require('fs');
const { once } = require('events');

const PRISMA_CLI = path.join(__dirname, '..', 'node_modules', 'prisma', 'build', 'index.js');

function parseCliArgs(argv) {
    const args = argv.slice(2);
    let sourceArg = null;
    for (let index = 0; index < args.length; index++) {
        const argument = args[index];
        if (argument === '--target') {
            throw new Error('Restore target must be provided through RESTORE_DB_URL, not argv');
        }
        if (!argument.startsWith('--') && sourceArg === null) {
            sourceArg = argument;
        }
    }
    return {
        yes: args.includes('--yes'),
        live: args.includes('--live'),
        targetArg: null,
        sourceArg
    };
}

function parseDatabaseUrl(rawUrl) {
    if (!rawUrl) return null;
    try {
        const url = new URL(rawUrl);
        if (!['postgres:', 'postgresql:'].includes(url.protocol)) return null;
        const database = decodeURIComponent(url.pathname.slice(1));
        if (!url.hostname || !database || !url.username) return null;
        const sslMode = url.searchParams.get('sslmode');
        if (sslMode && !['disable', 'verify-full'].includes(sslMode)) {
            return null;
        }
        const host = url.hostname.replace(/^\[(.*)\]$/, '$1').toLowerCase();
        if (
            !['localhost', '127.0.0.1', '::1', 'postgres'].includes(host) &&
            sslMode !== 'verify-full'
        ) {
            return null;
        }
        return {
            protocol: 'postgresql:',
            host,
            port: url.port || '5432',
            database,
            schema: url.searchParams.get('schema') || 'public',
            url
        };
    } catch {
        return null;
    }
}

function sameDatabase(firstUrl, secondUrl) {
    const first = parseDatabaseUrl(firstUrl);
    const second = parseDatabaseUrl(secondUrl);
    return Boolean(
        first &&
        second &&
        first.protocol === second.protocol &&
        first.host === second.host &&
        first.port === second.port &&
        first.database === second.database
    );
}

function sameDatabaseRole(firstUrl, secondUrl) {
    const first = parseDatabaseUrl(firstUrl);
    const second = parseDatabaseUrl(secondUrl);
    return Boolean(
        first &&
        second &&
        sameDatabase(firstUrl, secondUrl) &&
        decodeURIComponent(first.url.username) === decodeURIComponent(second.url.username)
    );
}

function resolveTarget({
    targetArg,
    envTarget,
    live,
    runtimeUrl = process.env.DATABASE_URL,
    migrationUrl = process.env.MIGRATION_DATABASE_URL
}) {
    const rawTarget = targetArg || envTarget;
    if (!rawTarget) return { ok: false, code: 'NO_TARGET' };
    const target = parseDatabaseUrl(rawTarget);
    if (!target) return { ok: false, code: 'INVALID_TARGET' };
    const matchesRuntime = sameDatabase(rawTarget, runtimeUrl);
    const matchesMigration = sameDatabase(rawTarget, migrationUrl);
    const isLive = matchesRuntime || matchesMigration;
    if (isLive && !live) return { ok: false, code: 'LIVE_REFUSED' };
    if (live && !isLive) return { ok: false, code: 'LIVE_TARGET_MISMATCH' };
    if (
        live &&
        (!matchesMigration ||
            sameDatabaseRole(rawTarget, runtimeUrl) ||
            !sameDatabaseRole(rawTarget, migrationUrl))
    ) {
        return { ok: false, code: 'LIVE_ROLE_REQUIRED' };
    }
    const isLocalTestTarget =
        ['localhost', '127.0.0.1', '::1', 'postgres'].includes(target.host) &&
        (target.database.endsWith('_test') || target.database.endsWith('_test_db'));
    if (!live && !isLive && !isLocalTestTarget) {
        return { ok: false, code: 'NON_TEST_TARGET_REFUSED' };
    }
    return { ok: true, target: rawTarget, live: isLive };
}

function getCliEnvironment(rawUrl) {
    const parsed = parseDatabaseUrl(rawUrl);
    if (!parsed) throw new Error('Restore target must be an explicit PostgreSQL URL');
    const { url } = parsed;
    const env = {
        ...process.env,
        PGHOST: parsed.host,
        PGPORT: parsed.port,
        PGUSER: decodeURIComponent(url.username),
        PGPASSWORD: decodeURIComponent(url.password),
        PGDATABASE: parsed.database
    };
    const sslMode = url.searchParams.get('sslmode');
    if (sslMode) env.PGSSLMODE = sslMode;
    for (const [parameter, variable] of [
        ['sslrootcert', 'PGSSLROOTCERT'],
        ['sslcert', 'PGSSLCERT'],
        ['sslkey', 'PGSSLKEY']
    ]) {
        const value = url.searchParams.get(parameter);
        if (value) env[variable] = value;
    }
    for (const key of [
        'DATABASE_URL',
        'MIGRATION_DATABASE_URL',
        'BACKUP_DATABASE_URL',
        'RESTORE_DB_URL',
        'POSTGRES_TEST_URL',
        'PLAYWRIGHT_DATABASE_URL'
    ]) {
        delete env[key];
    }
    return env;
}

function buildRestoreArgs(database, archivePath) {
    return [
        '--clean',
        '--if-exists',
        '--exit-on-error',
        '--single-transaction',
        '--no-owner',
        '--no-acl',
        '--dbname',
        database,
        archivePath
    ];
}

async function verifyChecksum(filePath) {
    const sidecar = `${filePath}.sha256`;
    if (!fs.existsSync(sidecar)) return false;
    const expected = fs.readFileSync(sidecar, 'utf8').trim().split(/\s+/)[0];
    if (!/^[a-f0-9]{64}$/i.test(expected)) return false;
    const hash = crypto.createHash('sha256');
    const input = createReadStream(filePath);
    input.on('data', (chunk) => hash.update(chunk));
    await once(input, 'end');
    return expected.toLowerCase() === hash.digest('hex');
}

function verifyArchive(filePath) {
    if (!fs.existsSync(filePath) || !fs.statSync(filePath).isFile()) return false;
    try {
        const env = { PATH: process.env.PATH || '' };
        if (process.env.SystemRoot) env.SystemRoot = process.env.SystemRoot;
        execFileSync(process.env.PG_RESTORE_BIN || 'pg_restore', ['--list', filePath], {
            env,
            stdio: 'pipe'
        });
        return true;
    } catch {
        return false;
    }
}

function confirm(yes, isLive) {
    if (yes) return Promise.resolve(true);
    return new Promise((resolve) => {
        const prompt = isLive
            ? 'UWAGA: przywracanie nadpisze obiekty w bazie runtime. Kontynuować? (tak/nie): '
            : 'Czy przywrócić archiwum PostgreSQL do wskazanej bazy? Obiekty z archiwum mogą zastąpić istniejące. (tak/nie): ';
        const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
        rl.question(prompt, (answer) => {
            rl.close();
            resolve(answer.toLowerCase() === 'tak');
        });
    });
}

function runPrisma(args, targetUrl) {
    const env = { ...process.env, DATABASE_URL: targetUrl };
    for (const key of [
        'MIGRATION_DATABASE_URL',
        'BACKUP_DATABASE_URL',
        'RESTORE_DB_URL',
        'POSTGRES_TEST_URL',
        'PLAYWRIGHT_DATABASE_URL'
    ]) {
        delete env[key];
    }
    return execFileSync(process.execPath, [PRISMA_CLI, ...args], {
        cwd: process.env.RESTORE_PRISMA_DIR
            ? path.resolve(process.env.RESTORE_PRISMA_DIR)
            : path.resolve(__dirname, '..'),
        encoding: 'utf8',
        env,
        stdio: ['pipe', 'pipe', 'pipe']
    });
}

function runRoleGrants(migrationUrl) {
    const env = { ...process.env, MIGRATION_DATABASE_URL: migrationUrl };
    for (const key of [
        'DATABASE_URL',
        'BACKUP_DATABASE_URL',
        'RESTORE_DB_URL',
        'POSTGRES_TEST_URL',
        'PLAYWRIGHT_DATABASE_URL'
    ]) {
        delete env[key];
    }
    return execFileSync(process.execPath, [path.join(__dirname, 'grant-postgres-roles.mjs')], {
        env,
        stdio: ['pipe', 'pipe', 'pipe']
    });
}

async function main() {
    let options;
    try {
        options = parseCliArgs(process.argv);
    } catch {
        console.error(
            '[ERROR] Provide the restore target through RESTORE_DB_URL, not command arguments.'
        );
        process.exitCode = 1;
        return;
    }
    const { yes, live, targetArg, sourceArg } = options;
    if (!sourceArg) {
        console.error(
            'Usage: RESTORE_DB_URL=<postgresql-url> node scripts/restore-db.js <backup.dump> [--live] [--yes]'
        );
        process.exitCode = 1;
        return;
    }
    const target = resolveTarget({
        targetArg,
        envTarget: process.env.RESTORE_DB_URL,
        live,
        runtimeUrl: process.env.DATABASE_URL,
        migrationUrl: process.env.MIGRATION_DATABASE_URL
    });
    if (!target.ok) {
        const messages = {
            NO_TARGET: 'Explicit PostgreSQL restore target required via RESTORE_DB_URL.',
            INVALID_TARGET: 'Restore target must be a PostgreSQL URL with host, user and database.',
            LIVE_REFUSED: 'Runtime database restore requires the explicit --live flag.',
            LIVE_TARGET_MISMATCH:
                '--live is valid only when target matches DATABASE_URL or MIGRATION_DATABASE_URL.',
            LIVE_ROLE_REQUIRED:
                'Live restore requires RESTORE_DB_URL to use the distinct MIGRATION_DATABASE_URL role.',
            NON_TEST_TARGET_REFUSED:
                'Restore targets must be local test databases unless --live targets MIGRATION_DATABASE_URL.'
        };
        console.error(`[ERROR] ${messages[target.code]}`);
        process.exitCode = 1;
        return;
    }

    const sourcePath = path.resolve(sourceArg);
    if (!fs.existsSync(sourcePath) || !fs.statSync(sourcePath).isFile()) {
        console.error('[ERROR] PostgreSQL backup archive not found.');
        process.exitCode = 1;
        return;
    }
    if (!(await verifyChecksum(sourcePath))) {
        console.error('[ERROR] Backup checksum is missing or invalid.');
        process.exitCode = 1;
        return;
    }
    if (!verifyArchive(sourcePath)) {
        console.error('[ERROR] pg_restore could not read the PostgreSQL archive.');
        process.exitCode = 1;
        return;
    }
    if (!(await confirm(yes, target.live))) {
        console.log('Cancelled.');
        return;
    }

    const cliEnv = getCliEnvironment(target.target);
    try {
        execFileSync(
            process.env.PG_RESTORE_BIN || 'pg_restore',
            buildRestoreArgs(parseDatabaseUrl(target.target).database, sourcePath),
            { env: cliEnv, stdio: 'pipe' }
        );
        const migrationUrl = target.live ? process.env.MIGRATION_DATABASE_URL : target.target;
        runPrisma(['migrate', 'deploy'], migrationUrl);
        if (target.live) runRoleGrants(migrationUrl);
        console.log('PostgreSQL database restored and migrations checked.');
    } catch {
        console.error(
            '[ERROR] PostgreSQL restore failed; inspect the target with the database operator.'
        );
        process.exitCode = 1;
    }
}

if (require.main === module) void main();

module.exports = {
    parseCliArgs,
    parseDatabaseUrl,
    sameDatabase,
    sameDatabaseRole,
    resolveTarget,
    verifyChecksum,
    verifyArchive,
    buildRestoreArgs
};
