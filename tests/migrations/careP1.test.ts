/*
 * tests/migrations/careP1.test.ts
 * P1 migracja additive: tabele + indeksy, idempotentny rerun (IF NOT EXISTS).
 */
import fs from 'node:fs';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';

const SQL = fs.readFileSync(
    path.join(__dirname, '../../prisma/migrations/20261010000000_care_p1_states_sla/migration.sql'),
    'utf8'
);

describe('P1 migracja care', () => {
    it('tworzy care_states + care_sla_config, rerun bezpieczny', () => {
        const db = new DatabaseSync(':memory:');
        try {
            db.exec(SQL);
            db.exec(SQL);
            const tables = db
                .prepare(
                    "SELECT name FROM sqlite_master WHERE name IN ('care_states','care_sla_config') ORDER BY name"
                )
                .all() as Array<{ name: string }>;
            expect(tables.map((t) => t.name)).toEqual(['care_sla_config', 'care_states']);
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
