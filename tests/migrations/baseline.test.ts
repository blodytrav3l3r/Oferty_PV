/*
 * tests/migrations/baseline.test.ts
 * A3: Test automatyczny baseline — izolowany projekt Prisma.
 *
 * Scenariusz:
 *   1. migrate deploy -> exit 0
 *   2. _prisma_migrations istnieje, zawiera 20260815000000_baseline jako finished
 *   3. migrate diff -> puste (baza == schemat po deploy)
 */
import { DatabaseSync } from 'node:sqlite';
import { createIsolatedProject } from './helpers';

const BASELINE = '20260815000000_baseline';
const AI_TRAINING_RUN = '20260816000000_ai_training_run';
const UQ_REWARD = '20260815000001_uq_reward_well_action';
const SHARES = '20260828000000_add_document_shares';
const ADD_WELLCOUNT = '20260831000000_add_wellcount';
const ADD_TOTALPRICE = '20260902000000_add_totalprice';
const ADD_PERF_INDEXES = '20260902000001_add_performance_indexes';
const ADD_PROD_WELL_INDEX = '20260905000000_add_prod_well_index';

describe('A3 baseline migracji', () => {
    it('deploy na czystej bazie tworzy pelny schemat zgodny z schema.prisma', () => {
        const project = createIsolatedProject('baseline', [
            BASELINE,
            UQ_REWARD,
            AI_TRAINING_RUN,
            SHARES,
            ADD_WELLCOUNT,
            ADD_TOTALPRICE,
            ADD_PERF_INDEXES,
            ADD_PROD_WELL_INDEX
        ]);
        try {
            const out = project.runPrisma(['migrate', 'deploy']);
            expect(out).toContain('All migrations have been successfully applied');

            const db = new DatabaseSync(project.dbPath, { readOnly: true });
            const row = db
                .prepare(
                    `SELECT migration_name, finished_at FROM _prisma_migrations WHERE migration_name = ?`
                )
                .get(BASELINE);
            db.close();
            expect(row).toBeDefined();
            expect((row as { finished_at: string | null }).finished_at).not.toBeNull();

            const diff = project.runPrisma([
                'migrate',
                'diff',
                '--from-schema-datasource',
                'prisma/schema.prisma',
                '--to-schema-datamodel',
                'prisma/schema.prisma'
            ]);
            expect(/no difference detected/i.test(diff)).toBe(true);
        } finally {
            project.cleanup();
        }
    }, 120000);
});
