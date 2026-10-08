/*
 * tests/offers/followUpLatestTie.test.ts
 * Deterministyczny latest przy remisach (contactedAt, createdAt):
 * tie-breaker "id" DESC — ta sama definicja co followUps.ts (Prisma),
 * followUpStats.ts (ROW_NUMBER) i searchUtils.ts (LIMIT 1).
 */
import fs from 'node:fs';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';

const ROOT = path.resolve(__dirname, '..', '..');

function freshDb(): DatabaseSync {
    const tmp = path.join(ROOT, 'tests', 'tmp', `fu-tie-${Date.now()}.db`);
    fs.mkdirSync(path.dirname(tmp), { recursive: true });
    const db = new DatabaseSync(tmp);
    db.exec(
        fs.readFileSync(
            path.join(
                ROOT,
                'prisma',
                'migrations',
                '20261008000000_offer_follow_ups',
                'migration.sql'
            ),
            'utf8'
        )
    );
    return db;
}

const TIE_ORDER = `"contactedAt" DESC, "createdAt" DESC, "id" DESC`;

function latestOutcome(db: DatabaseSync, offerId: string): string {
    const row = db
        .prepare(
            `SELECT outcome FROM offer_follow_ups
             WHERE "offerKind" = 'rury' AND "offerId" = ?
             ORDER BY ${TIE_ORDER} LIMIT 1`
        )
        .get(offerId) as { outcome: string };
    return row.outcome;
}

function latestCteWinner(db: DatabaseSync, offerId: string): string {
    const row = db
        .prepare(
            `WITH latest AS (
                SELECT f."offerKind", f."offerId", f."outcome",
                    ROW_NUMBER() OVER (PARTITION BY f."offerKind", f."offerId"
                        ORDER BY f."contactedAt" DESC, f."createdAt" DESC, f."id" DESC) AS "rn"
                FROM offer_follow_ups f
            ) SELECT outcome FROM latest WHERE "offerId" = ? AND "rn" = 1`
        )
        .get(offerId) as { outcome: string };
    return row.outcome;
}

describe('latest przy remisach czasowych', () => {
    it('LIMIT 1 i ROW_NUMBER zwracaja ten sam rekord (wyzsze id wygrywa)', () => {
        const db = freshDb();
        try {
            const ins = db.prepare(
                `INSERT INTO "offer_follow_ups"
                 (id, offerKind, offerId, createdByUserId, contactedAt, createdAt, channel, result, outcome)
                 VALUES (?, 'rury', 'o-tie', 'u1', '2026-10-08T10:00:00.000Z', '2026-10-08T10:00:00.000Z', 'PHONE', 'CONTACTED', ?)`
            );
            ins.run('aaa', 'OPEN');
            ins.run('zzz', 'WON');
            // Determinizm: wielokrotne odczyty ten sam wynik.
            for (let i = 0; i < 3; i++) {
                expect(latestOutcome(db, 'o-tie')).toBe('WON');
                expect(latestCteWinner(db, 'o-tie')).toBe('WON');
            }
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
