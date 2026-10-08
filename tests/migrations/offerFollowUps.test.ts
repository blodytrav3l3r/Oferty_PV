/*
 * tests/migrations/offerFollowUps.test.ts
 * P0.2: migracja 20261008000000_offer_follow_ups — tabela historii kontaktow.
 *
 * Scenariusz (izolowany projekt Prisma, nie rusza prisma/migrations w repo):
 *   1. migrate deploy wszystkich migracji prod -> exit 0
 *   2. tabela offer_follow_ups istnieje z oczekiwanymi kolumnami i indeksami
 *   3. INSERT+SELECT roundtrip dla rury i studnie, domyslne outcome = OPEN
 */
import { DatabaseSync } from 'node:sqlite';
import fs from 'node:fs';
import path from 'node:path';
import { createIsolatedProject } from './helpers';

const MIGRATIONS_DIR = path.join(__dirname, '..', '..', 'prisma', 'migrations');

function prodMigrations(): string[] {
    return fs
        .readdirSync(MIGRATIONS_DIR, { withFileTypes: true })
        .filter((d) => d.isDirectory())
        .map((d) => d.name)
        .filter((n) => fs.existsSync(path.join(MIGRATIONS_DIR, n, 'migration.sql')))
        .sort();
}

describe('P0.2 migracja offer_follow_ups', () => {
    it('deploy tworzy tabele z kolumnami, indeksami i domyslnym OPEN', () => {
        const project = createIsolatedProject('followups', prodMigrations());
        try {
            const out = project.runPrisma(['migrate', 'deploy']);
            expect(out).toContain('All migrations have been successfully applied');

            const db = new DatabaseSync(project.dbPath);
            const cols = db
                .prepare(`SELECT name FROM pragma_table_info('offer_follow_ups') ORDER BY cid`)
                .all() as Array<{ name: string }>;
            expect(cols.map((c) => c.name)).toEqual([
                'id',
                'offerKind',
                'offerId',
                'createdByUserId',
                'createdAt',
                'contactedAt',
                'channel',
                'result',
                'durationMin',
                'note',
                'nextContactAt',
                'outcome',
                'loseReason',
                'competitor',
                'competitorPrice',
                // Cykle obslugi (20261009000000_fu_cycles): reopen startuje
                // nowy cykl, limit terminalnosci per cykl.
                'cycle'
            ]);

            const idx = db
                .prepare(`SELECT name FROM pragma_index_list('offer_follow_ups') ORDER BY name`)
                .all() as Array<{ name: string }>;
            expect(idx.map((i) => i.name)).toEqual(
                expect.arrayContaining(['idx_followups_offer_contacted', 'idx_followups_user_next'])
            );

            const insert = db.prepare(
                `INSERT INTO "offer_follow_ups"
                 (id, offerKind, offerId, createdByUserId, createdAt, contactedAt,
                  channel, result, durationMin, note, nextContactAt)
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
            );
            insert.run(
                'fu-1',
                'rury',
                'offer-rury-1',
                'user-1',
                '2026-10-08T10:00:00.000Z',
                '2026-10-08T09:55:00.000Z',
                'PHONE',
                'CONTACTED',
                4,
                'Klient zainteresowany',
                '2026-10-12T09:00:00.000Z'
            );
            insert.run(
                'fu-2',
                'studnie',
                'offer-studnie-1',
                'user-1',
                '2026-10-08T11:00:00.000Z',
                '2026-10-08T10:58:00.000Z',
                'EMAIL',
                'NO_ANSWER',
                null,
                null,
                '2026-10-09T09:00:00.000Z'
            );

            const rows = db
                .prepare(`SELECT id, offerKind, outcome FROM "offer_follow_ups" ORDER BY id`)
                .all() as Array<{ id: string; offerKind: string; outcome: string }>;
            expect(rows).toEqual([
                { id: 'fu-1', offerKind: 'rury', outcome: 'OPEN' },
                { id: 'fu-2', offerKind: 'studnie', outcome: 'OPEN' }
            ]);
            db.close();
        } finally {
            project.cleanup();
        }
    }, 120000);
});
