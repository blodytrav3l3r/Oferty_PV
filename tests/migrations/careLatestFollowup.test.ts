/*
 * tests/migrations/careLatestFollowup.test.ts
 * P1 migracja latest_followup: tabela + 5 triggerów + backfill, rerun 2x.
 * Równoważność z regułą latest (contactedAt DESC, createdAt DESC, id DESC):
 * INSERT/UPDATE/DELETE-latest/DELETE-last/UPDATE klucza.
 */
import fs from 'node:fs';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';

const SQL = fs.readFileSync(
    path.join(
        __dirname,
        '../../prisma/migrations/20261014000000_care_latest_followup/migration.sql'
    ),
    'utf8'
);

function boot(): DatabaseSync {
    const db = new DatabaseSync(':memory:');
    db.exec(`CREATE TABLE offer_follow_ups (id TEXT PRIMARY KEY, "offerKind" TEXT, "offerId" TEXT, "createdByUserId" TEXT, "contactedAt" TEXT, "createdAt" TEXT, "updatedAt" TEXT, outcome TEXT, "nextContactAt" TEXT, note TEXT);
        CREATE TABLE offers_rel (id TEXT PRIMARY KEY);
        CREATE TABLE offers_studnie_rel (id TEXT PRIMARY KEY);`);
    db.exec(SQL);
    db.exec(SQL);
    return db;
}

function latest(db: DatabaseSync, kind: string, id: string) {
    return db
        .prepare('SELECT * FROM "latest_followup" WHERE "offerKind" = ? AND "offerId" = ?')
        .get(kind, id) as Record<string, unknown> | undefined;
}

const put = (db: DatabaseSync, id: string, contacted: string, created: string) =>
    db
        .prepare(
            'INSERT INTO offer_follow_ups (id, "offerKind", "offerId", "createdByUserId", "contactedAt", "createdAt", outcome) VALUES (?,?,?,?,?,?,?)'
        )
        .run(id, 'rury', 'o1', 'u1', contacted, created, 'OPEN');

describe('P1 migracja latest_followup', () => {
    it('tabela + 5 triggerów, rerun bezpieczny', () => {
        const db = boot();
        try {
            const tables = db
                .prepare("SELECT name FROM sqlite_master WHERE name = 'latest_followup'")
                .all() as Array<{ name: string }>;
            expect(tables.map((t) => t.name)).toEqual(['latest_followup']);
            const trigs = db
                .prepare(
                    "SELECT name FROM sqlite_master WHERE type = 'trigger' AND name LIKE 'trg_%latest%' ORDER BY name"
                )
                .all() as Array<{ name: string }>;
            expect(trigs.map((t) => t.name)).toEqual([
                'trg_fu_latest_ad',
                'trg_fu_latest_ai',
                'trg_fu_latest_au',
                'trg_offers_latest_ad',
                'trg_offersstud_latest_ad'
            ]);
        } finally {
            db.close();
        }
    });

    it('INSERT/UPDATE/DELETE-latest/DELETE-last wg reguły latest', () => {
        const db = boot();
        try {
            put(db, 'f1', '2026-10-01T00:00:00.000Z', '2026-10-01T00:00:00.000Z');
            expect(latest(db, 'rury', 'o1')?.followupId).toBe('f1');
            // Późniejszy zapis z wcześniejszą datą nie wygrywa.
            put(db, 'f2', '2026-09-01T00:00:00.000Z', '2026-10-02T00:00:00.000Z');
            expect(latest(db, 'rury', 'o1')?.followupId).toBe('f1');
            // UPDATE contactedAt promuje f2.
            db.prepare('UPDATE offer_follow_ups SET "contactedAt" = ? WHERE "id" = ?').run(
                '2026-11-01T00:00:00.000Z',
                'f2'
            );
            expect(latest(db, 'rury', 'o1')?.followupId).toBe('f2');
            // DELETE-latest promuje f1; DELETE-last czyści wiersz.
            db.prepare('DELETE FROM offer_follow_ups WHERE "id" = ?').run('f2');
            expect(latest(db, 'rury', 'o1')?.followupId).toBe('f1');
            db.prepare('DELETE FROM offer_follow_ups WHERE "id" = ?').run('f1');
            expect(latest(db, 'rury', 'o1')).toBeUndefined();
        } finally {
            db.close();
        }
    });

    it('tie contactedAt: wyższe id wygrywa; UPDATE klucza przenosi', () => {
        const db = boot();
        try {
            put(db, 'a1', '2026-10-01T00:00:00.000Z', '2026-10-01T00:00:00.000Z');
            put(db, 'a2', '2026-10-01T00:00:00.000Z', '2026-10-01T00:00:00.000Z');
            expect(latest(db, 'rury', 'o1')?.followupId).toBe('a2');
            db.prepare('UPDATE offer_follow_ups SET "offerId" = ? WHERE "id" = ?').run('o2', 'a2');
            expect(latest(db, 'rury', 'o1')?.followupId).toBe('a1');
            expect(latest(db, 'rury', 'o2')?.followupId).toBe('a2');
        } finally {
            db.close();
        }
    });

    it('backfill odtwarza latest z istniejących wierszy', () => {
        const db = new DatabaseSync(':memory:');
        try {
            db.exec(`CREATE TABLE offer_follow_ups (id TEXT PRIMARY KEY, "offerKind" TEXT, "offerId" TEXT, "createdByUserId" TEXT, "contactedAt" TEXT, "createdAt" TEXT, "updatedAt" TEXT, outcome TEXT, "nextContactAt" TEXT, note TEXT);
                CREATE TABLE offers_rel (id TEXT PRIMARY KEY);
                CREATE TABLE offers_studnie_rel (id TEXT PRIMARY KEY);`);
            put(db, 'f1', '2026-10-01T00:00:00.000Z', '2026-10-01T00:00:00.000Z');
            put(db, 'f2', '2026-10-03T00:00:00.000Z', '2026-10-03T00:00:00.000Z');
            db.exec(SQL);
            expect(latest(db, 'rury', 'o1')?.followupId).toBe('f2');
            // Rerun nie duplikuje ani nie psuje.
            db.exec(SQL);
            const n = db.prepare('SELECT COUNT(*) AS n FROM "latest_followup"').get() as {
                n: number;
            };
            expect(n.n).toBe(1);
        } finally {
            db.close();
        }
    });

    it('DELETE oferty sprząta sierotę z cache', () => {
        const db = boot();
        try {
            db.prepare('INSERT INTO offers_rel (id) VALUES (?)').run('o1');
            put(db, 'f1', '2026-10-01T00:00:00.000Z', '2026-10-01T00:00:00.000Z');
            expect(latest(db, 'rury', 'o1')?.followupId).toBe('f1');
            db.prepare('DELETE FROM offers_rel WHERE "id" = ?').run('o1');
            expect(latest(db, 'rury', 'o1')).toBeUndefined();
        } finally {
            db.close();
        }
    });
});
