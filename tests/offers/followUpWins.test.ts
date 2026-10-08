/*
 * tests/offers/followUpWins.test.ts
 * P5.2: wins = oferty z latest WON przypisane autorowi wpisu latest.
 * Semantyka na prawdziwym SQLite: buildery z route (buildLatestCte +
 * buildPerRepSql) renderowane do wykonywalnego SQL na scratch DB.
 */
import fs from 'node:fs';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { Prisma } from '../../generated/prisma';
import { buildLatestCte, buildPerRepSql } from '../../src/routes/offers/followUpStats';

const ROOT = path.resolve(__dirname, '..', '..');

function toExecutable(q: unknown): string {
    if (typeof q !== 'object' || q === null) return String(q);
    const o = q as { strings?: string[]; values?: unknown[] };
    if (!Array.isArray(o.strings) || !Array.isArray(o.values)) return String(q);
    const values = o.values as unknown[];
    const quote = (v: unknown): string => {
        if (typeof v === 'number') return String(v);
        if (typeof v === 'bigint') return String(Number(v));
        return `'${String(v).replace(/'/g, "''")}'`;
    };
    let out = '';
    o.strings.forEach((s, i) => {
        out += s;
        if (i < values.length) {
            const v = values[i];
            out +=
                typeof v === 'object' &&
                v !== null &&
                Array.isArray((v as { strings?: unknown }).strings)
                    ? toExecutable(v)
                    : quote(v);
        }
    });
    return out;
}

function freshDb(): DatabaseSync {
    const tmp = path.join(ROOT, 'tests', 'tmp', `fu-wins-${Date.now()}.db`);
    fs.mkdirSync(path.dirname(tmp), { recursive: true });
    try {
        fs.rmSync(tmp, { force: true });
    } catch {
        /* ignore */
    }
    const db = new DatabaseSync(tmp);
    const base = fs.readFileSync(
        path.join(ROOT, 'prisma', 'migrations', '20261008000000_offer_follow_ups', 'migration.sql'),
        'utf8'
    );
    db.exec(base);
    return db;
}

const insert = (db: DatabaseSync) =>
    db.prepare(
        `INSERT INTO "offer_follow_ups"
         (id, offerKind, offerId, createdByUserId, contactedAt, channel, result, outcome)
         VALUES (?, 'rury', ?, ?, ?, 'PHONE', 'CONTACTED', ?)`
    );

describe('P5.2 perRep.wins z latest', () => {
    it('multi-WON: wygrywa autor latest, nie każdy WON', () => {
        const db = freshDb();
        try {
            // Oferta X: WON rep-A, potem WON rep-B (latest). Oferta Y: WON rep-A.
            insert(db).run('w1', 'o-x', 'rep-a', '2026-10-01T10:00:00.000Z', 'WON');
            insert(db).run('w2', 'o-x', 'rep-b', '2026-10-02T10:00:00.000Z', 'WON');
            insert(db).run('w3', 'o-y', 'rep-a', '2026-10-03T10:00:00.000Z', 'WON');
            insert(db).run('w4', 'o-y', 'rep-a', '2026-10-01T09:00:00.000Z', 'OPEN');

            const fuScope = Prisma.sql`1=1`;
            const sql = toExecutable(buildPerRepSql(fuScope, buildLatestCte(fuScope)));
            expect(sql).toContain('latest');
            const rows = db.prepare(sql).all() as Array<{
                u: string;
                contacts: number;
                offers: number;
                wins: number;
            }>;
            const byUser = Object.fromEntries(rows.map((r) => [r.u, r]));
            expect(byUser['rep-a']).toMatchObject({ contacts: 3, offers: 2, wins: 1 });
            expect(byUser['rep-b']).toMatchObject({ contacts: 1, offers: 1, wins: 1 });
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
