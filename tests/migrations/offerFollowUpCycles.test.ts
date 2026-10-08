/*
 * tests/migrations/offerFollowUpCycles.test.ts
 * Cykle obslugi: reopen startuje nowy cykl, limit terminalnosci obowiazuje
 * per cykl (uq_fu_terminal_per_cycle), historia append-only zostaje.
 * Scratch DB z werbatim migracji (lancuch: baza -> terminal UQ -> cykle).
 */
import fs from 'node:fs';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';

const ROOT = path.resolve(__dirname, '..', '..');
const MIG = (...parts: string[]) =>
    fs.readFileSync(path.join(ROOT, 'prisma', 'migrations', ...parts), 'utf8');

function freshDb(withLegacyData = false): DatabaseSync {
    const tmp = path.join(
        ROOT,
        'tests',
        'tmp',
        `fu-cycles-${Date.now()}-${Math.random().toString(36).slice(2)}.db`
    );
    fs.mkdirSync(path.dirname(tmp), { recursive: true });
    const db = new DatabaseSync(tmp);
    db.exec(MIG('20261008000000_offer_follow_ups', 'migration.sql'));
    if (withLegacyData) {
        // Dane sprzed migracji terminalnej: WON + pozniejsze OPEN (reopen).
        db.exec(`INSERT INTO "offer_follow_ups"
            (id, offerKind, offerId, createdByUserId, contactedAt, createdAt, channel, result, outcome)
            VALUES
            ('h1', 'rury', 'o-legacy', 'u1', '2026-10-01T10:00:00.000Z', '2026-10-01T10:00:00.000Z', 'PHONE', 'CONTACTED', 'OPEN'),
            ('h2', 'rury', 'o-legacy', 'u1', '2026-10-02T10:00:00.000Z', '2026-10-02T10:00:00.000Z', 'PHONE', 'CONTACTED', 'WON'),
            ('h3', 'rury', 'o-legacy', 'u1', '2026-10-03T10:00:00.000Z', '2026-10-03T10:00:00.000Z', 'PHONE', 'CONTACTED', 'OPEN')`);
        // Stary index nie przejdzie przy duplikatach — tu max 1 terminal, OK.
        db.exec(MIG('20261008000001_fu_terminal_uq', 'migration.sql'));
    } else {
        db.exec(MIG('20261008000001_fu_terminal_uq', 'migration.sql'));
    }
    db.exec(MIG('20261009000000_fu_cycles', 'migration.sql'));
    return db;
}

const insert = (db: DatabaseSync) =>
    db.prepare(
        `INSERT INTO "offer_follow_ups"
         (id, offerKind, offerId, cycle, createdByUserId, contactedAt, channel, result, outcome)
         VALUES (?, 'rury', ?, ?, 'u1', '2026-10-08T10:00:00.000Z', 'PHONE', 'CONTACTED', ?)`
    );

function close(db: DatabaseSync) {
    try {
        db.close();
    } catch {
        /* ignore */
    }
}

describe('cykle follow-up: reopen i ponowne zamkniecie', () => {
    it('OPEN -> WON -> OPEN(cykl 1) -> WON(cykl 1): pelny cykl reopen przechodzi', () => {
        const db = freshDb();
        try {
            insert(db).run('c1', 'o-1', 0, 'OPEN');
            insert(db).run('c2', 'o-1', 0, 'WON');
            insert(db).run('c3', 'o-1', 1, 'OPEN');
            insert(db).run('c4', 'o-1', 1, 'WON');
            const n = db.prepare('SELECT COUNT(*) AS c FROM "offer_follow_ups"').get() as {
                c: number;
            };
            expect(n.c).toBe(4);
            close(db);
        } catch (e) {
            close(db);
            throw e;
        }
    });

    it('drugi terminal w TYM SAMYM cyklu rzuca UNIQUE', () => {
        const db = freshDb();
        try {
            insert(db).run('d1', 'o-1', 0, 'WON');
            expect(() => insert(db).run('d2', 'o-1', 0, 'LOST_OTHER')).toThrow(/UNIQUE/i);
            close(db);
        } catch (e) {
            close(db);
            throw e;
        }
    });

    it('kazdy terminalny wynik ma wlasny cykl po reopen (LOST_*, ABANDONED)', () => {
        const db = freshDb();
        try {
            insert(db).run('e1', 'o-1', 0, 'WON');
            insert(db).run('e2', 'o-1', 1, 'OPEN');
            insert(db).run('e3', 'o-1', 1, 'LOST_COMPETITION');
            insert(db).run('e4', 'o-2', 0, 'WON');
            insert(db).run('e5', 'o-2', 1, 'OPEN');
            insert(db).run('e6', 'o-2', 1, 'ABANDONED');
            const rows = db.prepare('SELECT COUNT(*) AS c FROM "offer_follow_ups"').get() as {
                c: number;
            };
            expect(rows.c).toBe(6);
            close(db);
        } catch (e) {
            close(db);
            throw e;
        }
    });

    it('dowolnie wiele OPEN w cyklu + wielokrotne reopen bez zamkniecia', () => {
        const db = freshDb();
        try {
            insert(db).run('f1', 'o-1', 0, 'OPEN');
            insert(db).run('f2', 'o-1', 0, 'OPEN');
            insert(db).run('f3', 'o-1', 1, 'OPEN');
            insert(db).run('f4', 'o-1', 2, 'OPEN');
            const rows = db.prepare('SELECT COUNT(*) AS c FROM "offer_follow_ups"').get() as {
                c: number;
            };
            expect(rows.c).toBe(4);
            close(db);
        } catch (e) {
            close(db);
            throw e;
        }
    });

    it('backfill legacy: WON zostaje w cyklu 0, OPEN po nim laduje w cyklu 1', () => {
        const db = freshDb(true);
        try {
            const get = (id: string) =>
                db.prepare('SELECT cycle FROM "offer_follow_ups" WHERE id = ?').get(id) as {
                    cycle: number;
                };
            expect(get('h1').cycle).toBe(0);
            expect(get('h2').cycle).toBe(0);
            expect(get('h3').cycle).toBe(1);
            // Ponowne zamkniecie cyklu 1 przechodzi (bug sprzed naprawy).
            insert(db).run('h4', 'o-legacy', 1, 'WON');
            close(db);
        } catch (e) {
            close(db);
            throw e;
        }
    });

    it('stary index usuniety, nowy aktywny i partial', () => {
        const db = freshDb();
        try {
            const names = (
                db
                    .prepare(
                        `SELECT name FROM sqlite_master WHERE type = 'index' AND tbl_name = 'offer_follow_ups'`
                    )
                    .all() as { name: string }[]
            ).map((r) => r.name);
            expect(names).not.toContain('uq_fu_terminal_per_offer');
            expect(names).toContain('uq_fu_terminal_per_cycle');
            const row = db
                .prepare(`SELECT sql FROM sqlite_master WHERE name = 'uq_fu_terminal_per_cycle'`)
                .get() as { sql: string };
            expect(row.sql).toContain('WHERE');
            expect(row.sql).toContain('"cycle"');
            close(db);
        } catch (e) {
            close(db);
            throw e;
        }
    });
});
