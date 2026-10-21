import fs from 'node:fs';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';

const MIGRATION = path.resolve(
    __dirname,
    '..',
    '..',
    'prisma',
    'migrations',
    '20261021000000_pricelist_approved',
    'migration.sql'
);

function boot(): DatabaseSync {
    const db = new DatabaseSync(':memory:');
    db.exec(
        'CREATE TABLE "PricelistVersion" (' +
            '"id" TEXT PRIMARY KEY, "type" TEXT, "seq" INTEGER, "version" TEXT, ' +
            '"status" TEXT, "effectiveFrom" TEXT)'
    );
    return db;
}

function insert(db: DatabaseSync, rows: Array<[string, string, string]>): void {
    const stmt = db.prepare(
        'INSERT INTO "PricelistVersion" ("id","type","seq","version","status","effectiveFrom") ' +
            'VALUES (?,?,?,?,?,?)'
    );
    rows.forEach(([id, status, effectiveFrom], index) => {
        stmt.run(id, 'rury', index + 1, `v${index + 1}`, status, effectiveFrom);
    });
}

function statuses(db: DatabaseSync): Record<string, string> {
    const rows = db
        .prepare('SELECT "id","status" FROM "PricelistVersion" ORDER BY "id"')
        .all() as Array<{ id: string; status: string }>;
    return Object.fromEntries(rows.map((row) => [row.id, row.status]));
}

function indexExists(db: DatabaseSync): boolean {
    const rows = db
        .prepare(
            "SELECT name FROM sqlite_master WHERE type='index' AND name='uq_pricelist_version_approved'"
        )
        .all();
    return rows.length === 1;
}

describe('migracja 20261021000000_pricelist_approved', () => {
    const sql = fs.readFileSync(MIGRATION, 'utf8');

    test('mapuje 6 statusów do DRAFT/APPROVED i tworzy partial unique', () => {
        const db = boot();
        insert(db, [
            ['a', 'ACTIVE', '2026-01-01T00:00:00.000Z'],
            ['b', 'SCHEDULED', '2026-02-01T00:00:00.000Z'],
            ['c', 'ARCHIVED', '2025-01-01T00:00:00.000Z'],
            ['d', 'BACKDATE', '2024-01-01T00:00:00.000Z'],
            ['e', 'BACKDATE_REQUESTED', '2024-02-01T00:00:00.000Z'],
            ['f', 'DRAFT', '2024-03-01T00:00:00.000Z']
        ]);
        db.exec(sql);
        expect(statuses(db)).toEqual({
            a: 'APPROVED',
            b: 'APPROVED',
            c: 'APPROVED',
            d: 'APPROVED',
            e: 'DRAFT',
            f: 'DRAFT'
        });
        expect(indexExists(db)).toBe(true);
    });

    test('kolizja po mapowaniu przerywa migrację bez częściowego zapisu', () => {
        const db = boot();
        insert(db, [
            ['a', 'ACTIVE', '2026-01-01T00:00:00.000Z'],
            ['b', 'ARCHIVED', '2026-01-01T00:00:00.000Z']
        ]);
        expect(() => db.exec(sql)).toThrow(/guard_pricelist_duplicate_approved_date/);
        expect(statuses(db)).toEqual({ a: 'ACTIVE', b: 'ARCHIVED' });
        expect(indexExists(db)).toBe(false);
    });

    test('kilka DRAFTów z tą samą datą jest legalne', () => {
        const db = boot();
        insert(db, [
            ['a', 'DRAFT', '2026-01-01T00:00:00.000Z'],
            ['b', 'DRAFT', '2026-01-01T00:00:00.000Z']
        ]);
        db.exec(sql);
        expect(statuses(db)).toEqual({ a: 'DRAFT', b: 'DRAFT' });
        expect(indexExists(db)).toBe(true);
    });

    test('partial unique blokuje dwie APPROVED na tej samej dacie', () => {
        const db = boot();
        db.exec(sql);
        const stmt = db.prepare(
            'INSERT INTO "PricelistVersion" ("id","type","seq","version","status","effectiveFrom") ' +
                'VALUES (?,?,?,?,?,?)'
        );
        stmt.run('a', 'rury', 1, 'v1', 'APPROVED', '2026-01-01T00:00:00.000Z');
        expect(() =>
            stmt.run('b', 'rury', 2, 'v2', 'APPROVED', '2026-01-01T00:00:00.000Z')
        ).toThrow(/UNIQUE constraint failed/);
    });
});
