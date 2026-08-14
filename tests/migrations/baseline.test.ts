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

describe('A3 baseline migracji', () => {
    it('deploy na czystej bazie tworzy pelny schemat zgodny z schema.prisma', () => {
        const project = createIsolatedProject('baseline', [BASELINE]);
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
