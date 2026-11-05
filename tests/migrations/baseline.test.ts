import fs from 'node:fs';
import path from 'node:path';
import { createIsolatedProject } from './helpers';

const MIGRATIONS_DIR = path.join(__dirname, '..', '..', 'prisma', 'migrations-postgresql');

function postgresMigrations(): string[] {
    return fs
        .readdirSync(MIGRATIONS_DIR, { withFileTypes: true })
        .filter((entry) => entry.isDirectory())
        .map((entry) => entry.name)
        .filter((entry) => fs.existsSync(path.join(MIGRATIONS_DIR, entry, 'migration.sql')))
        .sort();
}

describe('PostgreSQL migration baseline', () => {
    it('deploys the canonical PostgreSQL history, is idempotent, and matches the Prisma schema', () => {
        const migrations = postgresMigrations();
        expect(migrations.length).toBeGreaterThan(0);
        const project = createIsolatedProject('baseline', migrations);

        try {
            const firstDeploy = project.runPrisma(['migrate', 'deploy']);
            expect(firstDeploy).toMatch(/successfully applied|no pending migrations/i);

            const migrationRows = project.query<{
                migration_name: string;
                finished_at: string | null;
                rolled_back_at: string | null;
            }>(
                'SELECT migration_name, finished_at, rolled_back_at FROM "_prisma_migrations" ORDER BY migration_name'
            );
            expect(migrationRows.map((row) => row.migration_name)).toEqual(migrations);
            expect(
                migrationRows.every(
                    (row) => row.finished_at !== null && row.rolled_back_at === null
                )
            ).toBe(true);

            const secondDeploy = project.runPrisma(['migrate', 'deploy']);
            expect(secondDeploy).toMatch(/no pending migrations/i);
            expect(project.runPrisma(['migrate', 'status'])).toMatch(/up to date/i);

            const requiredRelations = project.query<{ relation_name: string; present: boolean }>(
                `SELECT required.relation_name,
                        EXISTS (
                            SELECT 1 FROM pg_class AS relation
                            JOIN pg_namespace AS namespace ON namespace.oid = relation.relnamespace
                            WHERE namespace.nspname = current_schema()
                              AND relation.relname = required.relation_name
                              AND relation.relkind IN ('r', 'p')
                        ) AS present
                 FROM unnest(ARRAY[
                    'offers_rel', 'offers_studnie_rel', 'offer_items_rel', 'offer_studnie_items_rel',
                    'PricelistVersion', 'PricelistItemRury', 'PricelistItemStudnie',
                    'PricelistItemPrecoKonfig', 'PricelistItemPrecoKinety', 'PricelistItemPrecoZakresy',
                    'AiTransfer', 'client_contacts_rel', 'user_preferences', 'care_states',
                    'care_sla_config', 'care_sla_scopes', 'care_notifications',
                    'offer_follow_ups', 'latest_followup'
                 ]) AS required(relation_name)`
            );
            expect(requiredRelations.every((row) => row.present)).toBe(true);

            const requiredIndexes = project.query<{ indexname: string }>(
                `SELECT indexname FROM pg_indexes
                 WHERE schemaname = current_schema()
                   AND indexname = ANY($1::text[])
                 ORDER BY indexname`,
                [
                    [
                        'idx_care_done',
                        'idx_care_snooze',
                        'idx_carenotif_offer',
                        'idx_carenotif_user_read',
                        'idx_caresla_scope',
                        'uq_fu_terminal_per_cycle',
                        'uq_reward_well_action',
                        'uq_carenotif_unread_per_offer',
                        'uq_pricelist_version_approved',
                        'ux_pricelist_version_one_draft'
                    ]
                ]
            );
            expect(requiredIndexes.map((row) => row.indexname)).toEqual([
                'idx_care_done',
                'idx_care_snooze',
                'idx_carenotif_offer',
                'idx_carenotif_user_read',
                'idx_caresla_scope',
                'uq_carenotif_unread_per_offer',
                'uq_fu_terminal_per_cycle',
                'uq_pricelist_version_approved',
                'uq_reward_well_action',
                'ux_pricelist_version_one_draft'
            ]);
        } finally {
            project.cleanup();
        }
    }, 120_000);
});
