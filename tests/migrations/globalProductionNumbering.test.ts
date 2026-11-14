import fs from 'node:fs';
import path from 'node:path';
import { createIsolatedProject } from './helpers';

const ROOT = path.join(__dirname, '..', '..');
const MIGRATIONS_DIR = path.join(ROOT, 'prisma', 'migrations-postgresql');
const PREVIOUS_MIGRATIONS = [
    '0001_initial',
    '0002_care_latest_followup_triggers',
    '0003_partial_unique_invariants',
    '0004_client_contact_excluded'
];
const GLOBAL_NUMBERING_MIGRATION = '0005_global_production_numbering';

describe('global production numbering migration', () => {
    it('preserves history, merges recycled sequences, and carries the global high-water mark', () => {
        const project = createIsolatedProject('global-numbering', PREVIOUS_MIGRATIONS);
        try {
            project.runPrisma(['migrate', 'deploy']);
            project.query(
                `INSERT INTO "users" ("id", "username", "password", "role", "productionOrderStartNumber")
                 VALUES ('user-a', 'user-a', 'x', 'user', 15), ('user-b', 'user-b', 'x', 'user', 22)`
            );
            project.query(
                `INSERT INTO "production_order_counters" ("userId", "year", "lastNumber")
                 VALUES ('user-a', 2026, 8), ('user-b', 2026, 12)`
            );
            project.query(
                `INSERT INTO "production_orders_rel" ("id", "userId", "productionNumber", "data")
                 VALUES ('history-a', 'user-a', 'SA/A/00030/26', NULL),
                        ('history-b', 'user-b', NULL, '{"productionOrderNumber":"KK/A/00040/26"}'),
                        ('history-current', 'user-a', 'C/00039/26', NULL),
                        ('history-large', 'user-b', 'AB/A/9999999999/26', NULL)`
            );
            project.query(
                `INSERT INTO "recycled_production_numbers" ("userId", "year", "seqNumber")
                 VALUES ('user-b', 2026, 20), ('user-a', 2026, 20), ('user-a', 2026, 21), ('user-b', 2026, 40)`
            );
            fs.cpSync(
                path.join(MIGRATIONS_DIR, GLOBAL_NUMBERING_MIGRATION),
                path.join(project.migrationsDir, GLOBAL_NUMBERING_MIGRATION),
                { recursive: true }
            );

            project.runPrisma(['migrate', 'deploy']);

            expect(
                project.query<{ value: string }>(
                    `SELECT "value" FROM "settings" WHERE "key" = 'production_order_start_number'`
                )
            ).toEqual([{ value: '22' }]);
            expect(
                project.query<{ lastNumber: number }>(
                    `SELECT "lastNumber" FROM "production_global_order_counters" WHERE "year" = 2026`
                )
            ).toEqual([{ lastNumber: 40 }]);
            expect(
                project.query<{ userId: string; seqNumber: number }>(
                    `SELECT "userId", "seqNumber" FROM "recycled_production_numbers_global"
                     WHERE "year" = 2026 ORDER BY "seqNumber"`
                )
            ).toEqual([
                { userId: 'user-a', seqNumber: 20 },
                { userId: 'user-a', seqNumber: 21 }
            ]);
            expect(
                project.query<{ productionNumber: string | null }>(
                    `SELECT "productionNumber" FROM "production_orders_rel"
                     WHERE "id" IN ('history-a', 'history-b') ORDER BY "id"`
                )
            ).toEqual([{ productionNumber: 'SA/A/00030/26' }, { productionNumber: null }]);
            expect(
                project.query<{ indexname: string }>(
                    `SELECT indexname FROM pg_indexes WHERE schemaname = current_schema()
                     AND indexname = 'uq_prod_global_number_year_sequence'`
                )
            ).toEqual([{ indexname: 'uq_prod_global_number_year_sequence' }]);
            expect(
                project.query<{ userId: string; year: number; seqNumber: number }>(
                    `SELECT "userId", "year", "seqNumber" FROM "production_global_number_claims"
                     WHERE "year" = 2026 AND "seqNumber" = 39`
                )
            ).toEqual([{ userId: 'user-a', year: 2026, seqNumber: 39 }]);
            project.query(
                `INSERT INTO "production_orders_rel" ("id", "userId", "productionNumber")
                 VALUES ('new-global-a', 'user-a', 'A/00041/26')`
            );
            expect(() =>
                project.query(
                    `INSERT INTO "production_orders_rel" ("id", "userId", "productionNumber")
                     VALUES ('new-global-b', 'user-b', 'B/41/26')`
                )
            ).toThrow();
        } finally {
            project.cleanup();
        }
    }, 180_000);
});
