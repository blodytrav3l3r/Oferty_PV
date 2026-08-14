/*
 * tests/migrations/futureMigration.test.ts
 * A4.5: Test przyszlego workflow — legacy -> baseline -> KOLEJNA migracja.
 *
 * Izolowany projekt Prisma:
 *   prisma/schema.prisma  (kopia produkcyjnego schematu)
 *   prisma/migrations/
 *     ├── 20260815000000_baseline/          (kopia baseline)
 *     └── 20260816000000_test_migration/    (dodaje kolumne testowa)
 *
 * Kroki:
 *   1. Temp baza -> db push + insert danych
 *   2. resolve --applied baseline
 *   3. migrate deploy -> testowa migracja wykonana
 *   4. migrate status = up to date
 *   5. Asercje: nowa kolumna istnieje, dane legacy nietkniete
 */
import { DatabaseSync } from 'node:sqlite';
import { addMigration, createIsolatedProject } from './helpers';

const BASELINE = '20260815000000_baseline';
const TEST_MIGRATION = '20260816000000_test_migration';

describe('A4.5 przyszly workflow migracji', () => {
    it('kolejna migracja po baseline stosuje sie normalnie, legacy dane nietkniete', () => {
        const project = createIsolatedProject('future-migration', [BASELINE]);
        addMigration(
            project,
            TEST_MIGRATION,
            `-- AlterTable\nALTER TABLE "ProductsRury" ADD COLUMN "testColumn" TEXT;`
        );
        try {
            project.runPrisma(['db', 'push', '--skip-generate']);

            const db = new DatabaseSync(project.dbPath);
            db.exec('PRAGMA foreign_keys = ON');
            db.prepare(
                'INSERT INTO ProductsRury (id, name, category, price) VALUES (?, ?, ?, ?)'
            ).run('legacy_rury_1', 'Rura legacy', 'Rury Betonowe', 200.0);
            db.close();

            project.runPrisma(['migrate', 'resolve', '--applied', BASELINE]);
            const deployOut = project.runPrisma(['migrate', 'deploy']);
            expect(deployOut).toContain(TEST_MIGRATION);

            const status = project.runPrisma(['migrate', 'status']);
            expect(/database schema is up to date/i.test(status)).toBe(true);

            const db2 = new DatabaseSync(project.dbPath, { readOnly: true });
            const cols = db2.prepare('PRAGMA table_info(ProductsRury)').all() as { name: string }[];
            const rury = db2.prepare('SELECT count(*) AS n FROM ProductsRury').get();
            db2.close();

            expect(cols.some((c) => c.name === 'testColumn')).toBe(true);
            expect((rury as { n: number }).n).toBe(1);
        } finally {
            project.cleanup();
        }
    }, 180000);
});
