/*
 * tests/migrations/rewardDedup.test.ts
 * A-11: dedup (wellId, action) przed CREATE UNIQUE INDEX w migracji
 * 20260815000001_uq_reward_well_action.
 *
 * Scenariusz: baza legacy z duplikatami aiRewardLog (bez unikalnego indeksu)
 * -> wykonanie SQL migracji -> zostaje po jednym wpisie (najnowszy) per
 * (wellId, action) i powstaje indeks uq_reward_well_action.
 */
import fs from 'node:fs';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';

const ROOT = path.resolve(__dirname, '..', '..');
const MIGRATION_SQL = path.join(
    ROOT,
    'prisma',
    'migrations',
    '20260815000001_uq_reward_well_action',
    'migration.sql'
);

describe('A-11 dedup przed unique index rewardów', () => {
    it('usuwa starsze duplikaty (wellId, action) i tworzy indeks', () => {
        const tmp = path.join(ROOT, 'tests', 'tmp', `reward-dedup-${Date.now()}.db`);
        fs.mkdirSync(path.dirname(tmp), { recursive: true });

        const db = new DatabaseSync(tmp);
        db.exec(`
            CREATE TABLE "aiRewardLog" (
                "id" TEXT NOT NULL PRIMARY KEY,
                "userId" TEXT NOT NULL,
                "wellId" TEXT NOT NULL,
                "dn" INTEGER NOT NULL,
                "action" TEXT NOT NULL,
                "reward" REAL NOT NULL,
                "scoreBefore" REAL,
                "scoreAfter" REAL,
                "wasAiRanked" BOOLEAN NOT NULL DEFAULT false,
                "configSnapshot" TEXT,
                "createdAt" TEXT NOT NULL
            );
            CREATE INDEX "idx_reward_user" ON "aiRewardLog"("userId");
            CREATE INDEX "idx_reward_action" ON "aiRewardLog"("action");
            CREATE INDEX "idx_reward_created" ON "aiRewardLog"("createdAt");
        `);
        const insert = db.prepare(
            `INSERT INTO "aiRewardLog"
             (id, userId, wellId, dn, action, reward, createdAt)
             VALUES (?, ?, ?, ?, ?, ?, ?)`
        );
        /* Duplikaty: ta sama studnia+akcja, różne id (starsze id powinny odpaść) */
        insert.run('id-1', 'u1', 'w-1', 600, 'ACCEPT', 0.5, '2026-08-01T00:00:00Z');
        insert.run('id-2', 'u1', 'w-1', 600, 'ACCEPT', 0.7, '2026-08-02T00:00:00Z');
        insert.run('id-3', 'u1', 'w-2', 1000, 'REJECT', -0.3, '2026-08-01T00:00:00Z');
        insert.run('id-4', 'u2', 'w-2', 1000, 'REJECT', -0.5, '2026-08-03T00:00:00Z');
        insert.run('id-5', 'u1', 'w-3', 400, 'MODIFY', 0.2, '2026-08-02T00:00:00Z');
        db.close();

        const sql = fs.readFileSync(MIGRATION_SQL, 'utf8');
        const db2 = new DatabaseSync(tmp);
        db2.exec(sql);
        const rows = db2
            .prepare('SELECT id, wellId, action FROM "aiRewardLog" ORDER BY id')
            .all() as Array<{ id: string; wellId: string; action: string }>;
        db2.close();

        expect(rows).toEqual([
            { id: 'id-2', wellId: 'w-1', action: 'ACCEPT' },
            { id: 'id-4', wellId: 'w-2', action: 'REJECT' },
            { id: 'id-5', wellId: 'w-3', action: 'MODIFY' }
        ]);
        fs.rmSync(tmp, { force: true });
    });

    it('nie zmienia danych gdy nie ma duplikatów (no-op)', () => {
        const tmp = path.join(ROOT, 'tests', 'tmp', `reward-dedup-clean-${Date.now()}.db`);
        fs.mkdirSync(path.dirname(tmp), { recursive: true });

        const db = new DatabaseSync(tmp);
        db.exec(`
            CREATE TABLE "aiRewardLog" (
                "id" TEXT NOT NULL PRIMARY KEY,
                "userId" TEXT NOT NULL,
                "wellId" TEXT NOT NULL,
                "dn" INTEGER NOT NULL,
                "action" TEXT NOT NULL,
                "reward" REAL NOT NULL,
                "scoreBefore" REAL,
                "scoreAfter" REAL,
                "wasAiRanked" BOOLEAN NOT NULL DEFAULT false,
                "configSnapshot" TEXT,
                "createdAt" TEXT NOT NULL
            );
        `);
        db.prepare(
            `INSERT INTO "aiRewardLog"
             (id, userId, wellId, dn, action, reward, createdAt)
             VALUES (?, ?, ?, ?, ?, ?, ?)`
        ).run('id-1', 'u1', 'w-1', 600, 'ACCEPT', 0.5, '2026-08-01T00:00:00Z');
        db.close();

        const sql = fs.readFileSync(MIGRATION_SQL, 'utf8');
        const db2 = new DatabaseSync(tmp);
        db2.exec(sql);
        const rows = db2.prepare('SELECT id FROM "aiRewardLog" ORDER BY id').all() as Array<{
            id: string;
        }>;
        const idx = db2
            .prepare(
                "SELECT name FROM sqlite_master WHERE type='index' AND name='uq_reward_well_action'"
            )
            .all() as Array<{ name: string }>;
        db2.close();

        expect(rows).toEqual([{ id: 'id-1' }]);
        expect(idx.length).toBe(1);
        fs.rmSync(tmp, { force: true });
    });
});
