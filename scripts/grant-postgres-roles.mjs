import { Client } from 'pg';

const databaseUrl = process.env.MIGRATION_DATABASE_URL;
if (!databaseUrl) throw new Error('MIGRATION_DATABASE_URL is required');

const client = new Client({ connectionString: databaseUrl });
try {
    await client.connect();
    await client.query('GRANT USAGE ON SCHEMA public TO sok_app, sok_backup');
    await client.query(
        'GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO sok_app'
    );
    await client.query('GRANT SELECT ON ALL TABLES IN SCHEMA public TO sok_backup');
    await client.query('GRANT USAGE, SELECT, UPDATE ON ALL SEQUENCES IN SCHEMA public TO sok_app');
    await client.query('GRANT SELECT ON ALL SEQUENCES IN SCHEMA public TO sok_backup');
    await client.query(
        'ALTER DEFAULT PRIVILEGES FOR ROLE sok_migrator IN SCHEMA public GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO sok_app'
    );
    await client.query(
        'ALTER DEFAULT PRIVILEGES FOR ROLE sok_migrator IN SCHEMA public GRANT SELECT ON TABLES TO sok_backup'
    );
    await client.query(
        'ALTER DEFAULT PRIVILEGES FOR ROLE sok_migrator IN SCHEMA public GRANT USAGE, SELECT, UPDATE ON SEQUENCES TO sok_app'
    );
    await client.query(
        'ALTER DEFAULT PRIVILEGES FOR ROLE sok_migrator IN SCHEMA public GRANT SELECT ON SEQUENCES TO sok_backup'
    );
} catch {
    console.error('Unable to grant PostgreSQL runtime and backup privileges.');
    process.exitCode = 1;
} finally {
    await client.end();
}
