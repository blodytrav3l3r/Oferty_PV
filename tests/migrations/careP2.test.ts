/*
 * tests/migrations/careP2.test.ts
 * P2 migracja additive: tabela + indeksy, idempotentny rerun.
 */
import fs from 'node:fs';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';

const SQL = fs.readFileSync(
    path.join(
        __dirname,
        '../../prisma/migrations/20261010000001_care_p2_notifications/migration.sql'
    ),
    'utf8'
);

describe('P2 migracja care_notifications', () => {
    it('tworzy tabelę + indeksy, rerun bezpieczny', () => {
        const db = new DatabaseSync(':memory:');
        try {
            db.exec(SQL);
            db.exec(SQL);
            const tables = db
                .prepare("SELECT name FROM sqlite_master WHERE name = 'care_notifications'")
                .all() as Array<{ name: string }>;
            expect(tables).toHaveLength(1);
            const idx = db
                .prepare(
                    "SELECT name FROM sqlite_master WHERE tbl_name = 'care_notifications' AND type = 'index'"
                )
                .all() as Array<{ name: string }>;
            expect(idx.map((i) => i.name).sort()).toEqual(
                expect.arrayContaining(['idx_carenotif_offer', 'idx_carenotif_user_read'])
            );
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
