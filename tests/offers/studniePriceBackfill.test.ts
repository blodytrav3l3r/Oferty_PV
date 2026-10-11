/*
 * tests/offers/studniePriceBackfill.test.ts
 * Migracja 20261011000000: backfill totalPrice=0 z blob.totalBrutto.
 * Stwierdzenie aplikuje treść migration.sql na :memory: (1:1 jak deploy).
 */
import { DatabaseSync } from 'node:sqlite';
import fs from 'node:fs';
import path from 'node:path';

function freshDb(): DatabaseSync {
    const db = new DatabaseSync(':memory:');
    db.exec(
        `CREATE TABLE offers_studnie_rel (id TEXT PRIMARY KEY, "userId" TEXT, "createdAt" TEXT, "offer_number" TEXT, "clientName" TEXT, "totalPrice" REAL, "data" TEXT);`
    );
    const ins = db.prepare(
        'INSERT INTO offers_studnie_rel (id, "userId", "createdAt", "totalPrice", "data") VALUES (?,?,?,?,?)'
    );
    // zero + żywy blob -> do naprawy.
    ins.run('a', 'u1', '2026-10-01T00:00:00.000Z', 0, JSON.stringify({ totalBrutto: 3931.08 }));
    // NULL + żywy blob -> do naprawy.
    ins.run('b', 'u1', '2026-10-01T00:00:00.000Z', null, JSON.stringify({ totalBrutto: 100 }));
    // poprawna kolumna -> nietknięta (blob inny).
    ins.run('c', 'u1', '2026-10-01T00:00:00.000Z', 500, JSON.stringify({ totalBrutto: 999 }));
    // zero + pusty blob -> nietknięty.
    ins.run('d', 'u1', '2026-10-01T00:00:00.000Z', 0, JSON.stringify({}));
    return db;
}

describe('backfill totalPrice studni', () => {
    it('UPDATE z migration.sql naprawia tylko wiersze 0/NULL z żywym blobem', () => {
        const db = freshDb();
        try {
            const sql = fs.readFileSync(
                path.join(
                    __dirname,
                    '../../prisma/migrations/20261011000000_care_studnie_price_backfill/migration.sql'
                ),
                'utf8'
            );
            expect(sql).toContain('offers_studnie_rel');
            db.exec(sql);
            const rows = db
                .prepare('SELECT id, "totalPrice" AS p FROM offers_studnie_rel ORDER BY id')
                .all() as Array<{ id: string; p: number }>;
            const byId = new Map(rows.map((r) => [r.id, r.p]));
            expect(byId.get('a')).toBeCloseTo(3931.08, 2);
            expect(byId.get('b')).toBe(100);
            expect(byId.get('c')).toBe(500);
            expect(byId.get('d')).toBe(0);
            // Idempotentny rerun.
            db.exec(sql);
            expect(
                (db.prepare('SELECT COUNT(*) AS c FROM offers_studnie_rel').get() as { c: number })
                    .c
            ).toBe(4);
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
