/*
 * tests/offers/careEtagMarkers.test.ts
 * P0.2: macierz unieważnień ETag (9 źródeł a–m, careService.ts:566-593).
 * Każde zdarzenie zmieniające widoczny stan panelu musi zmienić co najmniej
 * jeden marker; zdarzenia cudze (inny user) nie ruszają markerów per-user.
 * Chroni przyszłe optymalizacje agregatów (zwłaszcza zawężanie MAXów
 * i share-`l`, które celowo jest globalne).
 */
import { DatabaseSync } from 'node:sqlite';
import type { Prisma } from '../../generated/prisma';
import { getCareEtagInput } from '../../src/services/careService';

const T0 = '2026-10-01T00:00:00.000Z';
// IDX: 0:a 1:b 2:c 3:d 4:e 5:f 6:g 7:h 8:i 9:j 10:k 11:l 12:m

function seedDb(): DatabaseSync {
    const db = new DatabaseSync(':memory:');
    db.exec(`CREATE TABLE offer_follow_ups (id TEXT PRIMARY KEY, "offerKind" TEXT, "offerId" TEXT, "createdByUserId" TEXT, "contactedAt" TEXT, "createdAt" TEXT, "updatedAt" TEXT, outcome TEXT, "nextContactAt" TEXT);
        CREATE TABLE care_states ("offerKind" TEXT NOT NULL, "offerId" TEXT NOT NULL, "snoozedUntil" TEXT, "doneAt" TEXT, "updatedBy" TEXT, "updatedAt" TEXT NOT NULL,
            CONSTRAINT "care_states_pkey" PRIMARY KEY ("offerKind", "offerId"));
        CREATE TABLE care_notifications ("id" TEXT NOT NULL, "userId" TEXT NOT NULL, "offerKind" TEXT NOT NULL, "offerId" TEXT NOT NULL, "type" TEXT NOT NULL, "readAt" TEXT, "createdAt" TEXT NOT NULL,
            CONSTRAINT "care_notifications_pkey" PRIMARY KEY ("id"));
        CREATE TABLE offers_rel (id TEXT PRIMARY KEY, "userId" TEXT, "createdAt" TEXT, "updatedAt" TEXT);
        CREATE TABLE offers_studnie_rel (id TEXT PRIMARY KEY, "userId" TEXT, "createdAt" TEXT, "updatedAt" TEXT);
        CREATE TABLE care_sla_config (id TEXT PRIMARY KEY, "updatedAt" TEXT);
        CREATE TABLE care_sla_scopes ("scopeType" TEXT, "scopeId" TEXT, "updatedAt" TEXT);
        CREATE TABLE document_shares (id TEXT PRIMARY KEY);
        INSERT INTO offers_rel (id, "userId", "createdAt", "updatedAt") VALUES ('o1', 'u1', '${T0}', '${T0}');
        INSERT INTO offers_studnie_rel (id, "userId", "createdAt", "updatedAt") VALUES ('s1', 'u1', '${T0}', '${T0}');
        INSERT INTO offer_follow_ups (id, "offerKind", "offerId", "createdByUserId", "contactedAt", "createdAt", "updatedAt") VALUES ('f1', 'rury', 'o1', 'u1', '${T0}', '${T0}', '${T0}');
        INSERT INTO care_sla_config (id, "updatedAt") VALUES ('global', '${T0}');`);
    return db;
}

function adapter(db: DatabaseSync) {
    return {
        $queryRaw: async <T>(...args: any[]): Promise<T> => {
            const q = args[0] as Prisma.Sql;
            const raw = q as unknown as { sql: string; values: unknown[] };
            return db.prepare(raw.sql).all(...(raw.values as never[])) as unknown as T;
        }
    };
}

describe('P0.2: macierz unieważnień ETag', () => {
    it('nowy follow-up rusza a/b/m, reszta stoi', async () => {
        const db = seedDb();
        try {
            const f = adapter(db);
            const before = await getCareEtagInput(f, 'u1');
            db.prepare(
                'INSERT INTO offer_follow_ups (id, "offerKind", "offerId", "createdByUserId", "contactedAt", "createdAt", "updatedAt") VALUES (?,?,?,?,?,?,?)'
            ).run(
                'f2',
                'rury',
                'o1',
                'u1',
                '2026-10-02T00:00:00.000Z',
                '2026-10-02T00:00:00.000Z',
                '2026-10-02T00:00:00.000Z'
            );
            const after = await getCareEtagInput(f, 'u1');
            expect(after[0]).not.toBe(before[0]);
            expect(after[1]).not.toBe(before[1]);
            expect(after[12]).not.toBe(before[12]);
            for (const i of [2, 3, 4, 5, 6, 7, 8, 9, 10, 11]) expect(after[i]).toBe(before[i]);
        } finally {
            db.close();
        }
    });

    it('snooze/done (care_states) rusza tylko c', async () => {
        const db = seedDb();
        try {
            const f = adapter(db);
            const before = await getCareEtagInput(f, 'u1');
            db.prepare(
                'INSERT INTO care_states ("offerKind", "offerId", "updatedAt") VALUES (?,?,?)'
            ).run('rury', 'o1', '2026-10-03T00:00:00.000Z');
            const after = await getCareEtagInput(f, 'u1');
            expect(after[2]).not.toBe(before[2]);
            for (const i of [0, 1, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12])
                expect(after[i]).toBe(before[i]);
        } finally {
            db.close();
        }
    });

    it('sync insert (d) i odczyt (e) ruszają markery skrzynki', async () => {
        const db = seedDb();
        try {
            const f = adapter(db);
            const before = await getCareEtagInput(f, 'u1');
            db.prepare(
                'INSERT INTO care_notifications ("id", "userId", "offerKind", "offerId", "type", "createdAt") VALUES (?,?,?,?,?,?)'
            ).run('n1', 'u1', 'rury', 'o1', 'SLA_BREACH', '2026-10-04T00:00:00.000Z');
            const mid = await getCareEtagInput(f, 'u1');
            expect(mid[3]).not.toBe(before[3]);
            db.prepare('UPDATE care_notifications SET "readAt" = ? WHERE "id" = ?').run(
                '2026-10-05T00:00:00.000Z',
                'n1'
            );
            const after = await getCareEtagInput(f, 'u1');
            expect(after[4]).not.toBe(mid[4]);
        } finally {
            db.close();
        }
    });

    it('cudzy odczyt nie rusza mojego e', async () => {
        const db = seedDb();
        try {
            const f = adapter(db);
            db.prepare(
                'INSERT INTO care_notifications ("id", "userId", "offerKind", "offerId", "type", "createdAt", "readAt") VALUES (?,?,?,?,?,?,?)'
            ).run('n9', 'u2', 'rury', 'o1', 'SLA_BREACH', '2026-10-04T00:00:00.000Z', null);
            const before = await getCareEtagInput(f, 'u1');
            db.prepare('UPDATE care_notifications SET "readAt" = ? WHERE "id" = ?').run(
                '2026-10-06T00:00:00.000Z',
                'n9'
            );
            const after = await getCareEtagInput(f, 'u1');
            expect(after[4]).toBe(before[4]);
        } finally {
            db.close();
        }
    });

    it('nowa oferta (f), edycja oferty (j), share (l), SLA (h) ruszają swoje markery', async () => {
        const db = seedDb();
        try {
            const f = adapter(db);
            const before = await getCareEtagInput(f, 'u1');
            db.prepare('INSERT INTO offers_rel (id, "createdAt", "updatedAt") VALUES (?,?,?)').run(
                'o2',
                '2026-10-07T00:00:00.000Z',
                '2026-10-07T00:00:00.000Z'
            );
            db.prepare('UPDATE offers_rel SET "updatedAt" = ? WHERE "id" = ?').run(
                '2026-10-08T00:00:00.000Z',
                'o1'
            );
            db.prepare('INSERT INTO document_shares (id) VALUES (?)').run('sh1');
            db.prepare('UPDATE care_sla_config SET "updatedAt" = ? WHERE "id" = ?').run(
                '2026-10-09T00:00:00.000Z',
                'global'
            );
            const after = await getCareEtagInput(f, 'u1');
            expect(after[5]).not.toBe(before[5]);
            expect(after[9]).not.toBe(before[9]);
            expect(after[11]).not.toBe(before[11]);
            expect(after[7]).not.toBe(before[7]);
        } finally {
            db.close();
        }
    });
});
