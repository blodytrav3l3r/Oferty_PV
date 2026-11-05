import { createInterface } from 'node:readline/promises';
import { stdin, stdout } from 'node:process';
import { pathToFileURL } from 'node:url';
import { Client } from 'pg';

const INITIAL_MIGRATION = '0001_initial';
const RECOVERY_LOCK = 783214;
const RECOVERY_LOCK_KEY = 1;
const RECOVERY_DATABASE = 'sok';
const RECOVERY_HOSTS = new Set(['postgres', 'localhost', '127.0.0.1', '::1']);

export function assertRecoveryTarget(databaseUrl) {
    let url;
    try {
        url = new URL(databaseUrl);
    } catch {
        throw new Error('Recovery target must be a valid local PostgreSQL URL for database sok.');
    }

    const host = url.hostname.replace(/^\[(.*)\]$/, '$1').toLowerCase();
    const database = decodeURIComponent(url.pathname.slice(1));
    const schema = url.searchParams.get('schema') ?? 'public';
    if (
        !['postgres:', 'postgresql:'].includes(url.protocol) ||
        !RECOVERY_HOSTS.has(host) ||
        database !== RECOVERY_DATABASE ||
        schema !== 'public'
    ) {
        throw new Error(
            'Recovery is limited to the local S.O.K. database sok and schema public; no reset was performed.'
        );
    }
}

export function shouldResetFailedInitialMigration(rows) {
    const failed = rows.filter((row) => row.finished_at == null && row.rolled_back_at == null);
    if (failed.length === 0) {
        return false;
    }

    const completed = rows.filter((row) => row.finished_at != null);
    const onlyInitialMigration = rows.every((row) => row.migration_name === INITIAL_MIGRATION);
    if (failed.length !== 1 || completed.length > 0 || !onlyInitialMigration) {
        throw new Error(
            'Database contains migration history beyond one failed initial migration. Manual review is required.'
        );
    }

    return true;
}

async function hasMigrationTable(client) {
    const result = await client.query(
        `SELECT to_regclass('public."_prisma_migrations"') IS NOT NULL AS exists`
    );
    return result.rows[0]?.exists === true;
}

async function getMigrationRows(client) {
    const result = await client.query(
        'SELECT migration_name, started_at, finished_at, rolled_back_at FROM public."_prisma_migrations" ORDER BY started_at'
    );
    return result.rows;
}

async function assertNoOtherClientSessions(client) {
    const result = await client.query(
        `SELECT count(*)::int AS count
         FROM pg_stat_activity
         WHERE datname = current_database()
           AND backend_type = 'client backend'
           AND pid <> pg_backend_pid()`
    );
    if (result.rows[0]?.count !== 0) {
        throw new Error(
            'Other database clients are connected. Stop S.O.K. and database tools before schema recovery.'
        );
    }
}

function quoteIdentifier(identifier) {
    if (typeof identifier !== 'string' || identifier.length === 0) {
        throw new Error('Could not verify public schema tables; refusing schema recovery.');
    }
    return `"${identifier.replace(/"/g, '""')}"`;
}

export async function assertNoPublicBusinessData(client) {
    const tableResult = await client.query(
        `SELECT c.relname, c.relrowsecurity, c.relforcerowsecurity
         FROM pg_class c
         JOIN pg_namespace n ON n.oid = c.relnamespace
         WHERE n.nspname = 'public'
           AND c.relkind IN ('r', 'p', 'm', 'f')
           AND c.relname <> '_prisma_migrations'
         ORDER BY c.relname`
    );
    if (!Array.isArray(tableResult?.rows)) {
        throw new Error('Could not verify public schema tables; refusing schema recovery.');
    }

    for (const row of tableResult.rows) {
        if (row.relrowsecurity !== false || row.relforcerowsecurity !== false) {
            throw new Error(
                'Could not verify rows in a row-secured public table; refusing schema recovery.'
            );
        }
        const tableName = quoteIdentifier(row?.relname);
        const dataResult = await client.query(
            `SELECT EXISTS (SELECT 1 FROM public.${tableName} LIMIT 1) AS has_rows`
        );
        if (!Array.isArray(dataResult?.rows) || dataResult.rows[0]?.has_rows !== false) {
            throw new Error(
                `Could not verify that public.${tableName} is empty; refusing schema recovery.`
            );
        }
    }
}

async function confirmSchemaReset(databaseName) {
    if (!stdin.isTTY || !stdout.isTTY) {
        throw new Error(
            'A failed initial migration needs a schema reset. Rerun the installer in an interactive terminal to confirm it.'
        );
    }

    process.stdout.write(
        `\n[WARN] PostgreSQL records a failed initial migration in database "${databaseName}". The migration may have left part of the schema in place.\n` +
            '[WARN] Confirming will remove every table, type, index and other object from schema public in this database, then retry the initial migration.\n' +
            '[WARN] The PostgreSQL volume, backup volume and active-pricelist artifact file will not be deleted. Confirm only for this interrupted new-PC installation.\n'
    );
    const readline = createInterface({ input: stdin, output: stdout });
    try {
        const answer = await readline.question('Type RESET FAILED SCHEMA to continue: ');
        return answer === 'RESET FAILED SCHEMA';
    } finally {
        readline.close();
    }
}

async function resetPublicSchema(client) {
    await client.query('BEGIN');
    try {
        if (!(await hasMigrationTable(client))) {
            await client.query('ROLLBACK');
            process.stdout.write(
                '[OK] Migration recovery was already completed by another installer.\n'
            );
            return false;
        }

        const rows = await getMigrationRows(client);
        if (!shouldResetFailedInitialMigration(rows)) {
            await client.query('ROLLBACK');
            process.stdout.write('[OK] Migration state changed; no schema reset is needed.\n');
            return false;
        }

        await assertNoOtherClientSessions(client);
        await assertNoPublicBusinessData(client);
        await client.query('DROP SCHEMA public CASCADE');
        await client.query('CREATE SCHEMA public AUTHORIZATION CURRENT_USER');
        await client.query('GRANT USAGE ON SCHEMA public TO sok_app, sok_backup');
        await client.query('COMMIT');
        process.stdout.write(
            '[OK] Partial initial schema cleared. PostgreSQL migration can now retry from a clean schema.\n'
        );
        return true;
    } catch (error) {
        await client.query('ROLLBACK');
        throw error;
    }
}

async function main() {
    const databaseUrl = process.env.DATABASE_URL;
    if (!databaseUrl) {
        throw new Error('DATABASE_URL must be set to the migration-role PostgreSQL URL.');
    }

    const client = new Client({ connectionString: databaseUrl });
    await client.connect();
    let lockAcquired = false;
    try {
        await client.query('SELECT pg_advisory_lock($1, $2)', [RECOVERY_LOCK, RECOVERY_LOCK_KEY]);
        lockAcquired = true;
        if (!(await hasMigrationTable(client))) {
            process.stdout.write('[OK] No prior Prisma migration history needs recovery.\n');
            return;
        }

        const rows = await getMigrationRows(client);
        if (!shouldResetFailedInitialMigration(rows)) {
            process.stdout.write('[OK] No failed initial migration needs recovery.\n');
            return;
        }

        assertRecoveryTarget(databaseUrl);
        await assertNoPublicBusinessData(client);

        const databaseResult = await client.query('SELECT current_database() AS name');
        const confirmed = await confirmSchemaReset(databaseResult.rows[0].name);
        if (!confirmed) {
            throw new Error(
                'Schema reset cancelled. The existing PostgreSQL volume was not changed.'
            );
        }

        await resetPublicSchema(client);
    } finally {
        if (lockAcquired) {
            await client.query('SELECT pg_advisory_unlock($1, $2)', [
                RECOVERY_LOCK,
                RECOVERY_LOCK_KEY
            ]);
        }
        await client.end();
    }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
    main().catch((error) => {
        process.stderr.write(`[ERROR] Initial migration recovery stopped: ${error.message}\n`);
        process.exitCode = 1;
    });
}
