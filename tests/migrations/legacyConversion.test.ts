/*
 * tests/migrations/legacyConversion.test.ts
 * A4: Test automatyczny konwersji legacy (db push -> migration-managed).
 *
 * Scenariusz (izolowany projekt, bez dotykania prod i repo):
 *   1. Temp baza -> prisma db push (tabele bez _prisma_migrations)
 *   2. Wstaw rekordy testowe (ProductsRury, offers_rel po 1)
 *   3. Uruchom scripts/db-to-migrations.mjs -> migrate resolve --applied baseline
 *   4. Asercje: _prisma_migrations utworzona, baseline finished, rekordy nietkniete
 *   5. migrate deploy PO resolve -> migrate status = up to date
 */
import { execFileSync } from 'node:child_process';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { createIsolatedProject } from './helpers';

const ROOT = path.resolve(__dirname, '..', '..');
const BASELINE = '20260815000000_baseline';
const SCRIPT = path.join(ROOT, 'scripts', 'db-to-migrations.mjs');

describe('A4 konwersja legacy db push', () => {
    it('resolve --applied oznacza baseline jako finished bez dotykania danych', () => {
        const project = createIsolatedProject('legacy-conversion', [BASELINE]);
        try {
            project.runPrisma(['db', 'push', '--skip-generate']);

            const db = new DatabaseSync(project.dbPath);
            db.exec('PRAGMA foreign_keys = ON');
            db.prepare(
                'INSERT INTO ProductsRury (id, name, category, price) VALUES (?, ?, ?, ?)'
            ).run('test_rury_1', 'Rura testowa', 'Rury Betonowe', 100.5);
            db.prepare(
                'INSERT INTO offers_rel (id, offer_number, clientName, data, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?, ?)'
            ).run(
                'test_offer_1',
                'TEST/2026/001',
                'Klient Testowy',
                '{}',
                '2026-08-14T08:00:00.000Z',
                '2026-08-14T08:00:00.000Z'
            );
            db.close();

            const out = execFileSync(
                process.execPath,
                [SCRIPT, project.dbPath, BASELINE, project.dir],
                {
                    cwd: ROOT,
                    encoding: 'utf8',
                    env: project.env,
                    stdio: ['ignore', 'pipe', 'pipe']
                }
            );
            expect(out).toContain('Konwersja zakonczona pomyslnie');

            const db2 = new DatabaseSync(project.dbPath, { readOnly: true });
            const mig = db2
                .prepare(
                    'SELECT migration_name, finished_at FROM _prisma_migrations WHERE migration_name = ?'
                )
                .get(BASELINE);
            const rury = db2.prepare('SELECT count(*) AS n FROM ProductsRury').get();
            const offer = db2.prepare('SELECT count(*) AS n FROM offers_rel').get();
            db2.close();

            expect(mig).toBeDefined();
            expect((mig as { finished_at: string | null }).finished_at).not.toBeNull();
            expect((rury as { n: number }).n).toBe(1);
            expect((offer as { n: number }).n).toBe(1);

            const status = project.runPrisma(['migrate', 'status']);
            expect(/database schema is up to date/i.test(status)).toBe(true);
        } finally {
            project.cleanup();
        }
    }, 180000);
});
