import { createHash, randomBytes } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { Client } from 'pg';
import { createIsolatedProject } from './helpers';

const ROOT = path.resolve(__dirname, '..', '..');
const RESTORE_SCRIPT = path.join(ROOT, 'scripts', 'restore-db.js');
const PRISMA_MIGRATIONS = path.join(ROOT, 'prisma', 'migrations-postgresql');

function migrationNames(): string[] {
    return fs
        .readdirSync(PRISMA_MIGRATIONS, { withFileTypes: true })
        .filter((entry) => entry.isDirectory())
        .map((entry) => entry.name)
        .filter((entry) => fs.existsSync(path.join(PRISMA_MIGRATIONS, entry, 'migration.sql')))
        .sort();
}

function hasPostgresClient(binary: string): boolean {
    try {
        execFileSync(binary, ['--version'], { stdio: 'ignore', timeout: 10_000 });
        return true;
    } catch {
        return false;
    }
}

const restoreRoundtripTest =
    hasPostgresClient(process.env.PG_DUMP_BIN || 'pg_dump') &&
    hasPostgresClient(process.env.PG_RESTORE_BIN || 'pg_restore')
        ? it
        : it.skip;

function getCliEnvironment(databaseUrl: string): NodeJS.ProcessEnv {
    const url = new URL(databaseUrl);
    const env = { ...process.env };
    delete env.DATABASE_URL;
    env.PGHOST = url.hostname;
    env.PGPORT = url.port || '5432';
    env.PGUSER = decodeURIComponent(url.username);
    env.PGPASSWORD = decodeURIComponent(url.password);
    env.PGDATABASE = decodeURIComponent(url.pathname.slice(1));
    const sslMode = url.searchParams.get('sslmode');
    if (sslMode) env.PGSSLMODE = sslMode;
    return env;
}

function createDatabaseUrl(baseUrl: string, database: string): string {
    const url = new URL(baseUrl);
    url.pathname = `/${database}`;
    url.searchParams.delete('schema');
    return url.toString();
}

async function createDatabase(baseUrl: string, database: string): Promise<void> {
    const adminUrl = createDatabaseUrl(baseUrl, 'postgres');
    const client = new Client({ connectionString: adminUrl });
    await client.connect();
    try {
        await client.query(`CREATE DATABASE "${database}"`);
    } finally {
        await client.end();
    }
}

async function dropDatabase(baseUrl: string, database: string): Promise<void> {
    const adminUrl = createDatabaseUrl(baseUrl, 'postgres');
    const client = new Client({ connectionString: adminUrl });
    await client.connect();
    try {
        await client.query(`DROP DATABASE IF EXISTS "${database}" WITH (FORCE)`);
    } finally {
        await client.end();
    }
}

describe('PostgreSQL backup restore roundtrip', () => {
    restoreRoundtripTest(
        'restores a verified custom archive into an isolated PostgreSQL database (requires host pg_dump and pg_restore)',
        async () => {
            const project = createIsolatedProject('restore-roundtrip', migrationNames());
            const sourceUrl = new URL(project.databaseUrl);
            sourceUrl.searchParams.delete('schema');
            const archivePath = path.join(project.dir, 'restore-roundtrip.dump');
            const checksumPath = `${archivePath}.sha256`;
            const databaseName = `sok_restore_${process.pid}_${randomBytes(4).toString('hex')}_test`;
            const targetDatabaseUrl = new URL(createDatabaseUrl(project.databaseUrl, databaseName));
            targetDatabaseUrl.searchParams.set('schema', project.schemaName);
            const targetUrl = targetDatabaseUrl.toString();
            let databaseCreated = false;

            try {
                project.runPrisma(['migrate', 'deploy']);
                const sentinel = `restore-${randomBytes(8).toString('hex')}`;
                project.query('INSERT INTO "settings" ("key", "value") VALUES ($1, $2)', [
                    sentinel,
                    'roundtrip-preserved'
                ]);

                execFileSync(
                    process.env.PG_DUMP_BIN || 'pg_dump',
                    [
                        '--format=custom',
                        '--no-owner',
                        '--no-acl',
                        `--schema=${project.schemaName}`,
                        '--file',
                        archivePath
                    ],
                    {
                        env: getCliEnvironment(sourceUrl.toString()),
                        stdio: 'pipe',
                        timeout: 120_000
                    }
                );
                const checksum = createHash('sha256')
                    .update(fs.readFileSync(archivePath))
                    .digest('hex');
                fs.writeFileSync(
                    checksumPath,
                    `${checksum}  ${path.basename(archivePath)}\n`,
                    'utf8'
                );
                await createDatabase(process.env.POSTGRES_TEST_URL as string, databaseName);
                databaseCreated = true;

                const output = execFileSync(
                    process.execPath,
                    [RESTORE_SCRIPT, archivePath, '--yes'],
                    {
                        cwd: ROOT,
                        encoding: 'utf8',
                        env: {
                            ...process.env,
                            DATABASE_URL: project.databaseUrl,
                            RESTORE_DB_URL: targetUrl,
                            RESTORE_PRISMA_DIR: project.dir,
                            PG_RESTORE_BIN: process.env.PG_RESTORE_BIN || 'pg_restore'
                        },
                        stdio: ['ignore', 'pipe', 'pipe'],
                        timeout: 180_000
                    }
                );
                expect(output).toContain('PostgreSQL database restored and migrations checked');

                const restoredClient = new Client({ connectionString: targetUrl });
                await restoredClient.connect();
                try {
                    await restoredClient.query(`SET search_path TO "${project.schemaName}"`);
                    const result = await restoredClient.query(
                        'SELECT "value" FROM "settings" WHERE "key" = $1',
                        [sentinel]
                    );
                    expect(result.rows).toEqual([{ value: 'roundtrip-preserved' }]);
                } finally {
                    await restoredClient.end();
                }
            } finally {
                if (databaseCreated)
                    await dropDatabase(process.env.POSTGRES_TEST_URL as string, databaseName);
                project.cleanup();
            }
        },
        300_000
    );
});
