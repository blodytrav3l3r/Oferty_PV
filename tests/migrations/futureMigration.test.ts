import fs from 'node:fs';
import path from 'node:path';
import { addMigration, createIsolatedProject } from './helpers';

const MIGRATIONS_DIR = path.join(__dirname, '..', '..', 'prisma', 'migrations-postgresql');
const FUTURE_MIGRATION = '9999_test_additive_migration';

function postgresMigrations(): string[] {
    return fs
        .readdirSync(MIGRATIONS_DIR, { withFileTypes: true })
        .filter((entry) => entry.isDirectory())
        .map((entry) => entry.name)
        .filter((entry) => fs.existsSync(path.join(MIGRATIONS_DIR, entry, 'migration.sql')))
        .sort();
}

describe('PostgreSQL future migration workflow', () => {
    it('applies an additive migration without changing existing rows', () => {
        const project = createIsolatedProject('future-migration', postgresMigrations());
        try {
            project.runPrisma(['migrate', 'deploy']);
            project.query('INSERT INTO "settings" ("key", "value") VALUES ($1, $2)', [
                'migration-test',
                'preserve-me'
            ]);
            addMigration(
                project,
                FUTURE_MIGRATION,
                'CREATE TABLE "migration_probe" ("id" TEXT PRIMARY KEY, "created_at" TIMESTAMPTZ NOT NULL DEFAULT now());'
            );

            expect(project.runPrisma(['migrate', 'deploy'])).toContain(FUTURE_MIGRATION);
            expect(project.runPrisma(['migrate', 'status'])).toMatch(/up to date/i);
            expect(
                project.query<{ value: string }>(
                    'SELECT "value" FROM "settings" WHERE "key" = $1',
                    ['migration-test']
                )
            ).toEqual([{ value: 'preserve-me' }]);
            expect(
                project.query<{ relation: string | null }>(
                    `SELECT to_regclass(current_schema() || '.migration_probe')::text AS relation`
                )[0].relation
            ).not.toBeNull();
            expect(project.runPrisma(['migrate', 'deploy'])).toMatch(/no pending migrations/i);
        } finally {
            project.cleanup();
        }
    }, 180_000);
});
