import fs from 'node:fs';
import path from 'node:path';
import { addMigration, createIsolatedProject } from './helpers';

const MIGRATIONS_DIR = path.join(__dirname, '..', '..', 'prisma', 'migrations-postgresql');
const TRAINING_USERS_MIGRATION = '20261126220000_training_users_default';

function postgresMigrations(): string[] {
    return fs
        .readdirSync(MIGRATIONS_DIR, { withFileTypes: true })
        .filter((entry) => entry.isDirectory())
        .map((entry) => entry.name)
        .filter((entry) => fs.existsSync(path.join(MIGRATIONS_DIR, entry, 'migration.sql')))
        .sort();
}

function addTrainingUsersMigration(project: ReturnType<typeof createIsolatedProject>) {
    const sql = fs.readFileSync(
        path.join(MIGRATIONS_DIR, TRAINING_USERS_MIGRATION, 'migration.sql'),
        'utf8'
    );
    addMigration(project, TRAINING_USERS_MIGRATION, sql);
}

describe('PostgreSQL training user defaults', () => {
    it('preserves the existing user population when upgrading an unconfigured installation', () => {
        const migrations = postgresMigrations().filter((name) => name !== TRAINING_USERS_MIGRATION);
        const project = createIsolatedProject('training-users-upgrade', migrations);
        try {
            project.runPrisma(['migrate', 'deploy']);
            project.query(
                'INSERT INTO "users" ("id", "username", "password", "role") VALUES ($1, $2, $3, $4), ($5, $6, $7, $8)',
                [
                    'legacy-a',
                    'legacy-a',
                    'test-password-a',
                    'USER',
                    'legacy-b',
                    'legacy-b',
                    'test-password-b',
                    'ADMIN'
                ]
            );
            addTrainingUsersMigration(project);

            project.runPrisma(['migrate', 'deploy']);

            expect(
                project.query<{ value: string }>(
                    'SELECT "value" FROM "settings" WHERE "key" = $1',
                    ['ai_training_user_ids']
                )
            ).toEqual([{ value: '["legacy-a", "legacy-b"]' }]);
            expect(
                project.query<{ value: string }>(
                    'SELECT "value" FROM "settings" WHERE "key" = $1',
                    ['ai_training_user_ids_migrated']
                )
            ).toEqual([{ value: '1' }]);
        } finally {
            project.cleanup();
        }
    }, 180_000);

    it('keeps a configured allowlist unchanged during migration', () => {
        const migrations = postgresMigrations().filter((name) => name !== TRAINING_USERS_MIGRATION);
        const project = createIsolatedProject('training-users-configured', migrations);
        try {
            project.runPrisma(['migrate', 'deploy']);
            project.query('INSERT INTO "settings" ("key", "value") VALUES ($1, $2)', [
                'ai_training_user_ids',
                '["chosen-user"]'
            ]);
            addTrainingUsersMigration(project);

            project.runPrisma(['migrate', 'deploy']);

            expect(
                project.query<{ value: string }>(
                    'SELECT "value" FROM "settings" WHERE "key" = $1',
                    ['ai_training_user_ids']
                )
            ).toEqual([{ value: '["chosen-user"]' }]);
        } finally {
            project.cleanup();
        }
    }, 180_000);

    it('starts a fresh installation with training disabled', () => {
        const project = createIsolatedProject('training-users-fresh', postgresMigrations());
        try {
            project.runPrisma(['migrate', 'deploy']);

            expect(
                project.query<{ value: string }>(
                    'SELECT "value" FROM "settings" WHERE "key" = $1',
                    ['ai_training_user_ids']
                )
            ).toEqual([{ value: '[]' }]);
            expect(
                project.query<{ value: string }>(
                    'SELECT "value" FROM "settings" WHERE "key" = $1',
                    ['ai_training_user_ids_migrated']
                )
            ).toEqual([]);
        } finally {
            project.cleanup();
        }
    }, 180_000);
});
