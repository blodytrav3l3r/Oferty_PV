/*
 * tests/migrations/offerFollowUpTerminalUq.test.ts
 * P5.1: partial unique index uq_fu_terminal_per_offer — enforcement na DB.
 * Scratch DB (nie rusza prisma/migrations ani dev DB): tabela z migracji
 * bazowej + indeks z nowej migracji, werbatim z plików SQL.
 */
import fs from 'node:fs';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';

const ROOT = path.resolve(__dirname, '..', '..');

function freshDb(): DatabaseSync {
    const tmp = path.join(ROOT, 'tests', 'tmp', `fu-terminal-${Date.now()}.db`);
    fs.mkdirSync(path.dirname(tmp), { recursive: true });
    const db = new DatabaseSync(tmp);
    const base = fs.readFileSync(
        path.join(ROOT, 'prisma', 'migrations', '20261008000000_offer_follow_ups', 'migration.sql'),
        'utf8'
    );
    db.exec(base);
    const idx = fs.readFileSync(
        path.join(ROOT, 'prisma', 'migrations', '20261008000001_fu_terminal_uq', 'migration.sql'),
        'utf8'
    );
    db.exec(idx);
    return db;
}

const insert = (db: DatabaseSync) =>
    db.prepare(
        `INSERT INTO "offer_follow_ups"
         (id, offerKind, offerId, createdByUserId, contactedAt, channel, result, outcome)
         VALUES (?, 'rury', ?, 'u1', '2026-10-08T10:00:00.000Z', 'PHONE', 'CONTACTED', ?)`
    );

describe('P5.1 uq_fu_terminal_per_offer', () => {
    it('wiele OPEN na oferte OK, drugi terminalny rzuca UNIQUE', () => {
        const db = freshDb();
        try {
            insert(db).run('a1', 'o-1', 'OPEN');
            insert(db).run('a2', 'o-1', 'OPEN');
            insert(db).run('a3', 'o-1', 'WON');
            expect(() => insert(db).run('a4', 'o-1', 'LOST_OTHER')).toThrow(/UNIQUE/i);
            db.close();
        } catch (e) {
            try {
                db.close();
            } catch {
                /* ignore */
            }
            throw e;
        }
    });

    it('terminalne na roznych ofertach niezalezne + reopen jako OPEN po WON', () => {
        const db = freshDb();
        try {
            insert(db).run('b1', 'o-1', 'WON');
            insert(db).run('b2', 'o-2', 'WON');
            insert(db).run('b3', 'o-1', 'OPEN');
            const n = db.prepare('SELECT COUNT(*) AS c FROM "offer_follow_ups"').get() as {
                c: number;
            };
            expect(n.c).toBe(3);
            db.close();
        } catch (e) {
            try {
                db.close();
            } catch {
                /* ignore */
            }
            throw e;
        }
    });

    it('indeks jest partial (WHERE outcome terminalny)', () => {
        const db = freshDb();
        try {
            const row = db
                .prepare(`SELECT sql FROM sqlite_master WHERE name = 'uq_fu_terminal_per_offer'`)
                .get() as { sql: string };
            expect(row.sql).toContain('WHERE');
            expect(row.sql).toContain('ABANDONED');
            db.close();
        } catch (e) {
            try {
                db.close();
            } catch {
                /* ignore */
            }
            throw e;
        }
    });
});
