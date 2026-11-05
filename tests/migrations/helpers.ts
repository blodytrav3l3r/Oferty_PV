import { randomBytes } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(__dirname, '..', '..');
const TMP_ROOT = path.join(ROOT, 'tests', 'tmp');
const PRISMA_CLI = path.join(ROOT, 'node_modules', 'prisma', 'build', 'index.js');
const MIGRATIONS_SRC = path.join(ROOT, 'prisma', 'migrations-postgresql');
const ALLOWED_HOSTS = new Set(['localhost', '127.0.0.1', '::1', 'postgres']);

export interface IsolatedProject {
    dir: string;
    schemaName: string;
    databaseUrl: string;
    schemaPath: string;
    migrationsDir: string;
    env: NodeJS.ProcessEnv;
    runPrisma: (args: string[]) => string;
    query: <T extends Record<string, unknown>>(sql: string, values?: unknown[]) => T[];
    cleanup: () => void;
}

function getValidatedTestUrl(): URL {
    if (process.env.NODE_ENV !== 'test') {
        throw new Error('Isolated migration tests require NODE_ENV=test');
    }
    const rawUrl = process.env.POSTGRES_TEST_URL;
    if (!rawUrl) throw new Error('POSTGRES_TEST_URL is required for isolated migration tests');

    const url = new URL(rawUrl);
    const database = decodeURIComponent(url.pathname.slice(1)).toLowerCase();
    if (!['postgres:', 'postgresql:'].includes(url.protocol)) {
        throw new Error('Isolated migration tests require PostgreSQL');
    }
    if (!ALLOWED_HOSTS.has(url.hostname.toLowerCase())) {
        throw new Error('Isolated migration tests require a local PostgreSQL host');
    }
    if (!database.endsWith('_test') && !database.endsWith('_test_db')) {
        throw new Error('Isolated migration test database name must end in _test or _test_db');
    }
    url.searchParams.delete('schema');
    return url;
}

function runPgScript(
    connectionString: string,
    schemaName: string,
    mode: 'create' | 'drop' | 'query',
    payload?: string
): string {
    const script = [
        "const { Client } = require('pg');",
        'const client = new Client({ connectionString: process.argv[1] });',
        '(async () => {',
        '  await client.connect();',
        '  const schema = process.argv[2];',
        '  await client.query(`SET search_path TO "${schema}"`);',
        '  if (process.argv[3] === "create") { await client.query(`CREATE SCHEMA "${schema}"`); return; }',
        '  if (process.argv[3] === "drop") { await client.query(`DROP SCHEMA IF EXISTS "${schema}" CASCADE`); return; }',
        '  const payload = JSON.parse(require("node:fs").readFileSync(0, "utf8"));',
        '  const result = await client.query(payload.sql, payload.values);',
        '  process.stdout.write(JSON.stringify(result.rows));',
        '})().catch(() => { console.error("Isolated PostgreSQL migration query failed"); process.exitCode = 1; }).finally(() => client.end());'
    ].join('\n');

    return execFileSync(process.execPath, ['-e', script, connectionString, schemaName, mode], {
        cwd: ROOT,
        encoding: 'utf8',
        input: payload,
        stdio: ['pipe', 'pipe', 'pipe'],
        timeout: 30_000
    });
}

export function createIsolatedProject(name: string, migrations: string[]): IsolatedProject {
    const testUrl = getValidatedTestUrl();
    const suffix = randomBytes(5).toString('hex');
    const safeName = name
        .replace(/[^a-z0-9_]/gi, '_')
        .toLowerCase()
        .slice(0, 16);
    const schemaName = `sok_mig_${safeName}_${process.pid}_${suffix}`;
    const schemaUrl = new URL(testUrl);
    schemaUrl.searchParams.set('schema', schemaName);
    const databaseUrl = schemaUrl.toString();
    const pgConnectionUrl = new URL(schemaUrl);
    pgConnectionUrl.searchParams.delete('schema');
    const dir = path.join(TMP_ROOT, `${safeName}-${process.pid}-${suffix}`);
    const migrationsDir = path.join(dir, 'prisma', 'migrations-postgresql');
    const schemaPath = path.join(dir, 'prisma', 'schema.prisma');

    fs.mkdirSync(migrationsDir, { recursive: true });
    fs.copyFileSync(path.join(ROOT, 'prisma', 'schema.prisma'), schemaPath);
    fs.copyFileSync(
        path.join(MIGRATIONS_SRC, 'migration_lock.toml'),
        path.join(migrationsDir, 'migration_lock.toml')
    );
    for (const migration of migrations) {
        const source = path.join(MIGRATIONS_SRC, migration);
        if (!fs.existsSync(path.join(source, 'migration.sql'))) {
            throw new Error(`PostgreSQL migration ${migration} does not exist`);
        }
        fs.cpSync(source, path.join(migrationsDir, migration), { recursive: true });
    }

    const config = `import 'dotenv/config';\nimport { defineConfig, env } from 'prisma/config';\n\nexport default defineConfig({\n    schema: 'prisma/schema.prisma',\n    migrations: { path: 'prisma/migrations-postgresql', seed: 'ts-node prisma/seed.ts' },\n    datasource: { url: env('DATABASE_URL') }\n});\n`;
    fs.writeFileSync(path.join(dir, 'prisma.config.ts'), config, 'utf8');
    runPgScript(testUrl.toString(), schemaName, 'create');

    const env = { ...process.env, DATABASE_URL: databaseUrl };
    const runPrisma = (args: string[]) =>
        execFileSync(process.execPath, [PRISMA_CLI, ...args], {
            cwd: dir,
            encoding: 'utf8',
            env,
            stdio: ['ignore', 'pipe', 'pipe'],
            timeout: 120_000
        });
    const query = <T extends Record<string, unknown>>(sql: string, values: unknown[] = []): T[] =>
        JSON.parse(
            runPgScript(
                pgConnectionUrl.toString(),
                schemaName,
                'query',
                JSON.stringify({ sql, values })
            )
        ) as T[];
    const cleanup = () => {
        const resolvedDir = path.resolve(dir);
        const relativeDir = path.relative(TMP_ROOT, resolvedDir);
        if (
            !relativeDir ||
            relativeDir === '..' ||
            relativeDir.startsWith(`..${path.sep}`) ||
            path.isAbsolute(relativeDir)
        ) {
            throw new Error('Refusing to remove a migration fixture outside tests/tmp.');
        }
        try {
            runPgScript(testUrl.toString(), schemaName, 'drop');
        } finally {
            if (process.platform === 'win32') {
                execFileSync(
                    'powershell.exe',
                    [
                        '-NoLogo',
                        '-NoProfile',
                        '-NonInteractive',
                        '-Command',
                        'Remove-Item -LiteralPath $env:SOK_MIGRATION_TMP_PATH -Recurse -Force'
                    ],
                    {
                        stdio: 'pipe',
                        timeout: 30_000,
                        env: { ...process.env, SOK_MIGRATION_TMP_PATH: resolvedDir }
                    }
                );
            } else {
                fs.rmSync(resolvedDir, {
                    recursive: true,
                    force: true,
                    maxRetries: 10,
                    retryDelay: 250
                });
            }
        }
    };

    return {
        dir,
        schemaName,
        databaseUrl,
        schemaPath,
        migrationsDir,
        env,
        runPrisma,
        query,
        cleanup
    };
}

export function addMigration(project: IsolatedProject, migrationName: string, sql: string): string {
    const destination = path.join(project.migrationsDir, migrationName);
    fs.mkdirSync(destination, { recursive: true });
    fs.writeFileSync(path.join(destination, 'migration.sql'), sql, 'utf8');
    return destination;
}
