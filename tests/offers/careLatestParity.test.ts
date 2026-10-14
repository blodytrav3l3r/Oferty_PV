/*
 * tests/offers/careLatestParity.test.ts
 * P1: latest_followup (triggery) == reguła latest
 * (contactedAt DESC, createdAt DESC, id DESC) — niezależnie policzona w JS.
 * Pinuje kontrakt dualnej implementacji (CTE w followUpStats/searchUtils
 * liczą po staremu; careService czyta tabelę).
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

interface Fu {
    id: string;
    kind: string;
    offer: string;
    contacted: string;
    created: string;
}

function seedDb(rows: Fu[]): DatabaseSync {
    const db = new DatabaseSync(':memory:');
    db.exec(`CREATE TABLE offer_follow_ups (id TEXT PRIMARY KEY, "offerKind" TEXT, "offerId" TEXT, "createdByUserId" TEXT, "contactedAt" TEXT, "createdAt" TEXT, "updatedAt" TEXT, outcome TEXT, "nextContactAt" TEXT, note TEXT);
        CREATE TABLE offers_rel (id TEXT PRIMARY KEY);
        CREATE TABLE offers_studnie_rel (id TEXT PRIMARY KEY);`);
    db.exec(SQL);
    const ins = db.prepare(
        'INSERT INTO offer_follow_ups (id, "offerKind", "offerId", "createdByUserId", "contactedAt", "createdAt", outcome) VALUES (?,?,?,?,?,?,?)'
    );
    for (const r of rows) {
        ins.run(r.id, r.kind, r.offer, 'u1', r.contacted, r.created, 'OPEN');
    }
    return db;
}

// Niezależna implementacja reguły (JS, nie SQL).
function expected(rows: Fu[]): Map<string, string> {
    const byKey = new Map<string, Fu[]>();
    for (const r of rows) {
        const k = `${r.kind}:${r.offer}`;
        if (!byKey.has(k)) byKey.set(k, []);
        byKey.get(k)!.push(r);
    }
    const out = new Map<string, string>();
    for (const [k, list] of byKey) {
        list.sort((a, b) => {
            if (a.contacted !== b.contacted) return a.contacted < b.contacted ? 1 : -1;
            if (a.created !== b.created) return a.created < b.created ? 1 : -1;
            return a.id < b.id ? 1 : -1;
        });
        out.set(k, list[0].id);
    }
    return out;
}

function cached(db: DatabaseSync): Map<string, string> {
    const rows = db
        .prepare('SELECT "offerKind", "offerId", "followupId" FROM "latest_followup"')
        .all() as Array<{ offerKind: string; offerId: string; followupId: string }>;
    return new Map(rows.map((r) => [`${r.offerKind}:${r.offerId}`, r.followupId]));
}

describe('P1: latest_followup == reguła latest', () => {
    it('INSERTy: ties i backdaty wg reguły', () => {
        const rows: Fu[] = [
            {
                id: 'f1',
                kind: 'rury',
                offer: 'o1',
                contacted: '2026-10-01T00:00:00.000Z',
                created: '2026-10-01T00:00:00.000Z'
            },
            {
                id: 'f2',
                kind: 'rury',
                offer: 'o1',
                contacted: '2026-09-01T00:00:00.000Z',
                created: '2026-10-05T00:00:00.000Z'
            },
            {
                id: 'a1',
                kind: 'studnie',
                offer: 's1',
                contacted: '2026-10-01T00:00:00.000Z',
                created: '2026-10-01T00:00:00.000Z'
            },
            {
                id: 'a2',
                kind: 'studnie',
                offer: 's1',
                contacted: '2026-10-01T00:00:00.000Z',
                created: '2026-10-01T00:00:00.000Z'
            }
        ];
        const db = seedDb(rows);
        try {
            expect(cached(db)).toEqual(expected(rows));
        } finally {
            db.close();
        }
    });

    it('UPDATE-reorder i DELETE-latest promują wg reguły', () => {
        const rows: Fu[] = [
            {
                id: 'f1',
                kind: 'rury',
                offer: 'o1',
                contacted: '2026-10-01T00:00:00.000Z',
                created: '2026-10-01T00:00:00.000Z'
            },
            {
                id: 'f2',
                kind: 'rury',
                offer: 'o1',
                contacted: '2026-09-01T00:00:00.000Z',
                created: '2026-10-05T00:00:00.000Z'
            }
        ];
        const db = seedDb(rows);
        try {
            db.prepare('UPDATE offer_follow_ups SET "contactedAt" = ? WHERE "id" = ?').run(
                '2026-11-01T00:00:00.000Z',
                'f2'
            );
            rows.find((r) => r.id === 'f2')!.contacted = '2026-11-01T00:00:00.000Z';
            expect(cached(db)).toEqual(expected(rows));
            db.prepare('DELETE FROM offer_follow_ups WHERE "id" = ?').run('f2');
            expect(cached(db)).toEqual(expected(rows.filter((r) => r.id !== 'f2')));
        } finally {
            db.close();
        }
    });
});
