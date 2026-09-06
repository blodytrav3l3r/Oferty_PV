/*
 * P0-H audit:integrity — JSON + exit-code na fiksturach.
 * PASS na czystej bazie, FAIL na dublach/sierotach/kolizji recycled/regresji licznika.
 */
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';

const ROOT = path.resolve(__dirname, '..');
const SCRIPT = path.join(ROOT, 'scripts', 'audit-integrity.mjs');

function makeDb(setup: (db: DatabaseSync) => void): string {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'audit-'));
    const dbPath = path.join(dir, 't.db');
    const db = new DatabaseSync(dbPath);
    db.exec(`CREATE TABLE production_orders_rel (
        id TEXT PRIMARY KEY, "userId" TEXT, data TEXT, "productionNumber" TEXT, version INTEGER DEFAULT 1
    )`);
    db.exec(
        `CREATE UNIQUE INDEX uq_prod_user_number ON production_orders_rel("userId", "productionNumber")`
    );
    db.exec(
        `CREATE TABLE production_order_counters ("userId" TEXT, year INTEGER, "lastNumber" INTEGER)`
    );
    db.exec(
        `CREATE TABLE recycled_production_numbers ("userId" TEXT, year INTEGER, "seqNumber" INTEGER)`
    );
    db.exec(`CREATE TABLE offers_rel (id TEXT PRIMARY KEY, "userId" TEXT)`);
    db.exec(`CREATE TABLE offer_items_rel (id TEXT PRIMARY KEY, "offerId" TEXT)`);
    setup(db);
    db.close();
    return dbPath;
}

function run(dbPath: string) {
    const r = spawnSync(process.execPath, [SCRIPT], {
        encoding: 'utf8',
        env: { ...process.env, AUDIT_DB_PATH: dbPath }
    });
    return { status: r.status, json: JSON.parse(String(r.stdout)) };
}

describe('P0-H audit:integrity', () => {
    test('czysta baza → PASS, exit 0', () => {
        const dbPath = makeDb((db) => {
            db.prepare(
                `INSERT INTO production_orders_rel (id, "userId", data, "productionNumber") VALUES (?, ?, ?, ?)`
            ).run(
                'a',
                'u1',
                JSON.stringify({ productionOrderNumber: 'S/N/00001/26' }),
                'S/N/00001/26'
            );
            db.prepare(`INSERT INTO production_order_counters VALUES (?, ?, ?)`).run('u1', 2026, 1);
            db.prepare(`INSERT INTO offers_rel VALUES (?, ?)`).run('o1', 'u1');
            db.prepare(`INSERT INTO offer_items_rel VALUES (?, ?)`).run('i1', 'o1');
        });
        const r = run(dbPath);
        expect(r.status).toBe(0);
        expect(r.json.status).toBe('PASS');
    });

    test('dubel numeru → FAIL duplicateProductionNumbers, exit 1', () => {
        // UNIQUE w fiksturze zablokowałby insert — testuje skaner, więc bez indeksu.
        const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'audit-'));
        const dbPath = path.join(dir, 't.db');
        const db = new DatabaseSync(dbPath);
        db.exec(`CREATE TABLE production_orders_rel (
            id TEXT PRIMARY KEY, "userId" TEXT, data TEXT, "productionNumber" TEXT, version INTEGER DEFAULT 1
        )`);
        const ins = db.prepare(
            `INSERT INTO production_orders_rel (id, "userId", data, "productionNumber") VALUES (?, ?, ?, ?)`
        );
        ins.run('a', 'u1', '{}', 'S/N/00001/26');
        ins.run('b', 'u1', '{}', 'S/N/00001/26');
        db.close();
        const r = run(dbPath);
        expect(r.status).toBe(1);
        expect(r.json.status).toBe('FAIL');
        expect(r.json.checks.duplicateProductionNumbers).toBe(1);
    });

    test('sierota + kolizja recycled + regresja licznika → FAIL', () => {
        const dbPath = makeDb((db) => {
            db.prepare(`INSERT INTO offers_rel VALUES (?, ?)`).run('o1', 'u1');
            db.prepare(`INSERT INTO offer_items_rel VALUES (?, ?)`).run('iX', 'o-missing');
            db.prepare(
                `INSERT INTO production_orders_rel (id, "userId", data, "productionNumber") VALUES (?, ?, ?, ?)`
            ).run(
                'a',
                'u1',
                JSON.stringify({ productionOrderNumber: 'S/N/00007/26' }),
                'S/N/00007/26'
            );
            db.prepare(`INSERT INTO recycled_production_numbers VALUES (?, ?, ?)`).run(
                'u1',
                2026,
                7
            );
            db.prepare(`INSERT INTO production_order_counters VALUES (?, ?, ?)`).run('u1', 2026, 3);
        });
        const r = run(dbPath);
        expect(r.status).toBe(1);
        expect(r.json.checks.orphanOfferItems).toBe(1);
        expect(r.json.checks.recycledCollision).toBe(1);
        expect(r.json.checks.counterRegression).toBe(1);
    });
});
