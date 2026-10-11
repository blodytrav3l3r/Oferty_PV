/*
 * tests/offers/followUpCareNotif.test.ts
 * P2: sync powiadomień (typy, dedup, auto-read) + lista/odczyt.
 */
import { DatabaseSync } from 'node:sqlite';
import type { Prisma } from '../../generated/prisma';
import {
    syncCareNotifications,
    listCareNotifications,
    markCareNotificationRead,
    markCareNotificationsRead,
    type CareUser
} from '../../src/services/careService';

const NOW = '2026-10-10T12:00:00.000Z';
const U1: CareUser = { id: 'u1', role: 'user', subUsers: [] };

function freshDb(): DatabaseSync {
    const db = new DatabaseSync(':memory:');
    db.exec(`CREATE TABLE offers_rel (id TEXT PRIMARY KEY, "userId" TEXT, "createdAt" TEXT, "offer_number" TEXT, "clientName" TEXT, "data" TEXT);
        CREATE TABLE offers_studnie_rel (id TEXT PRIMARY KEY, "userId" TEXT, "createdAt" TEXT, "offer_number" TEXT, "clientName" TEXT, "totalPrice" REAL, "data" TEXT);
        CREATE TABLE document_shares (id TEXT PRIMARY KEY, "sharedWithUserId" TEXT, "documentType" TEXT, "documentId" TEXT);
        CREATE TABLE care_states ("offerKind" TEXT NOT NULL, "offerId" TEXT NOT NULL, "snoozedUntil" TEXT, "doneAt" TEXT, "updatedBy" TEXT, "updatedAt" TEXT NOT NULL,
            CONSTRAINT "care_states_pkey" PRIMARY KEY ("offerKind", "offerId"));
        CREATE TABLE care_notifications ("id" TEXT NOT NULL, "userId" TEXT NOT NULL, "offerKind" TEXT NOT NULL, "offerId" TEXT NOT NULL, "type" TEXT NOT NULL, "readAt" TEXT, "createdAt" TEXT NOT NULL,
            CONSTRAINT "care_notifications_pkey" PRIMARY KEY ("id"));
        CREATE TABLE offer_follow_ups (id TEXT PRIMARY KEY, "offerKind" TEXT, "offerId" TEXT, "createdByUserId" TEXT, "contactedAt" TEXT, "createdAt" TEXT, outcome TEXT, "nextContactAt" TEXT);`);
    // o1: OPEN overdue 10d -> SLA_BREACH (też ESCALATION-kandydat, CASE wybiera pierwszy).
    // o2: OPEN termin za 2h -> CALLBACK_DUE. o3: brak historii -> CALLBACK_DUE.
    // o4: WON -> nic. o5: OPEN overdue ale snoozed -> nic.
    db.prepare('INSERT INTO offers_rel (id, "userId", "createdAt") VALUES (?,?,?)').run(
        'o1',
        'u1',
        '2026-09-01T00:00:00.000Z'
    );
    db.prepare('INSERT INTO offers_rel (id, "userId", "createdAt") VALUES (?,?,?)').run(
        'o2',
        'u1',
        '2026-10-09T00:00:00.000Z'
    );
    db.prepare('INSERT INTO offers_rel (id, "userId", "createdAt") VALUES (?,?,?)').run(
        'o3',
        'u1',
        '2026-10-10T00:00:00.000Z'
    );
    db.prepare('INSERT INTO offers_rel (id, "userId", "createdAt") VALUES (?,?,?)').run(
        'o4',
        'u1',
        '2026-10-09T00:00:00.000Z'
    );
    db.prepare('INSERT INTO offers_rel (id, "userId", "createdAt") VALUES (?,?,?)').run(
        'o5',
        'u1',
        '2026-10-09T00:00:00.000Z'
    );
    db.prepare('INSERT INTO offers_rel (id, "userId", "createdAt") VALUES (?,?,?)').run(
        'o6',
        'u1',
        '2026-09-01T00:00:00.000Z'
    );
    const fu = (
        id: string,
        offerId: string,
        outcome: string,
        next: string | null,
        contacted: string
    ) =>
        db
            .prepare(
                'INSERT INTO offer_follow_ups (id, "offerKind", "offerId", "createdByUserId", "contactedAt", "createdAt", outcome, "nextContactAt") VALUES (?,?,?,?,?,?,?,?)'
            )
            .run(id, 'rury', offerId, 'u1', contacted, contacted, outcome, next);
    fu('f1', 'o1', 'OPEN', '2026-09-30T10:00:00.000Z', '2026-09-30T10:00:00.000Z');
    fu('f2', 'o2', 'OPEN', '2026-10-10T14:00:00.000Z', '2026-10-09T10:00:00.000Z');
    fu('f4', 'o4', 'WON', null, '2026-10-09T10:00:00.000Z');
    fu('f5', 'o5', 'OPEN', '2026-09-30T10:00:00.000Z', '2026-09-30T10:00:00.000Z');
    fu('f6', 'o6', 'OPEN', '2026-09-30T10:00:00.000Z', '2026-09-30T10:00:00.000Z');
    db.prepare(
        'INSERT INTO care_states ("offerKind", "offerId", "snoozedUntil", "doneAt", "updatedBy", "updatedAt") VALUES (?,?,?,?,?,?)'
    ).run('rury', 'o5', '2026-10-12T00:00:00.000Z', null, 'u1', NOW);
    // o6: snooze wygasły wczoraj -> wraca do kandydatów.
    db.prepare(
        'INSERT INTO care_states ("offerKind", "offerId", "snoozedUntil", "doneAt", "updatedBy", "updatedAt") VALUES (?,?,?,?,?,?)'
    ).run('rury', 'o6', '2026-10-09T10:00:00.000Z', null, 'u1', NOW);
    return db;
}

function fake(db: DatabaseSync) {
    return {
        $queryRaw: async <T>(...args: any[]): Promise<T> => {
            const q = args[0] as Prisma.Sql;
            const raw = q as unknown as { sql: string; values: unknown[] };
            return db.prepare(raw.sql).all(...(raw.values as never[])) as unknown as T;
        }
    };
}

const SLA = { firstContactH: 24, staleD: 7, escalationH: 72 };

describe('P2 sync powiadomień', () => {
    it('tworzy typy, pauza/terminal nic, rerun bez duplikatów', async () => {
        const db = freshDb();
        try {
            const f = fake(db);
            const r1 = await syncCareNotifications(f, U1, 'mine', NOW, SLA);
            expect(r1.inserted).toBe(4);
            const types = (await listCareNotifications(f, 'u1', { unreadOnly: false, limit: 50 }))
                .items;
            expect(types.find((t) => t.offerId === 'o1')?.type).toBe('SLA_BREACH');
            expect(types.find((t) => t.offerId === 'o2')?.type).toBe('CALLBACK_DUE');
            expect(types.find((t) => t.offerId === 'o3')?.type).toBe('CALLBACK_DUE');
            expect(types.find((t) => t.offerId === 'o4')).toBeUndefined();
            expect(types.find((t) => t.offerId === 'o5')).toBeUndefined();
            // o6: wygasły snooze wraca do pilnowania.
            expect(types.find((t) => t.offerId === 'o6')?.type).toBe('SLA_BREACH');
            // Wzbogacenie: klient zamiast surowego ID.
            db.prepare(
                'UPDATE offers_rel SET "clientName" = ?, "offer_number" = ? WHERE id = ?'
            ).run('Budimex', 'OF-1', 'o1');
            const enriched = (
                await listCareNotifications(f, 'u1', { unreadOnly: false, limit: 50 })
            ).items;
            expect(enriched.find((t) => t.offerId === 'o1')?.clientName).toBe('Budimex');
            expect(enriched.find((t) => t.offerId === 'o1')?.number).toBe('OF-1');
            // Rerun z późniejszym nowIso (licznik wstawek liczony po createdAt).
            const r2 = await syncCareNotifications(f, U1, 'mine', '2026-10-10T12:01:00.000Z', SLA);
            expect(r2.inserted).toBe(0);
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

    it('uq_carenotif_unread_per_offer: duplikat odrzucany przez constraint', async () => {
        const db = freshDb();
        try {
            db.exec(
                'CREATE UNIQUE INDEX "uq_carenotif_unread_per_offer" ON "care_notifications"("userId", "offerKind", "offerId", "type") WHERE "readAt" IS NULL;'
            );
            db.prepare(
                'INSERT INTO care_notifications ("id", "userId", "offerKind", "offerId", "type", "readAt", "createdAt") VALUES (?,?,?,?,?,?,?)'
            ).run('a', 'u1', 'rury', 'o1', 'SLA_BREACH', null, NOW);
            expect(() =>
                db
                    .prepare(
                        'INSERT INTO care_notifications ("id", "userId", "offerKind", "offerId", "type", "readAt", "createdAt") VALUES (?,?,?,?,?,?,?)'
                    )
                    .run('b', 'u1', 'rury', 'o1', 'SLA_BREACH', null, NOW)
            ).toThrow(/UNIQUE constraint failed/i);
            // Po oznaczeniu jako przeczytane ten sam typ może powstać na nowo.
            db.prepare('UPDATE care_notifications SET "readAt" = ? WHERE "id" = ?').run(NOW, 'a');
            db.prepare(
                'INSERT INTO care_notifications ("id", "userId", "offerKind", "offerId", "type", "readAt", "createdAt") VALUES (?,?,?,?,?,?,?)'
            ).run('c', 'u1', 'rury', 'o1', 'SLA_BREACH', null, NOW);
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

    it('retencja leniwa: stare przeczytane precz, cap 500', async () => {
        const db = freshDb();
        try {
            const f = fake(db);
            const ins = db.prepare(
                'INSERT INTO care_notifications ("id", "userId", "offerKind", "offerId", "type", "readAt", "createdAt") VALUES (?,?,?,?,?,?,?)'
            );
            ins.run(
                'old1',
                'u1',
                'rury',
                'ox',
                'SLA_BREACH',
                '2026-01-01T00:00:00.000Z',
                '2026-01-01T00:00:00.000Z'
            );
            for (let i = 0; i < 505; i++) {
                ins.run('u' + i, 'u1', 'rury', 'o' + i, 'CALLBACK_DUE', null, NOW);
            }
            await syncCareNotifications(f, U1, 'mine', NOW, SLA);
            const n = db
                .prepare('SELECT COUNT(*) AS c FROM care_notifications WHERE "userId" = ?')
                .get('u1') as { c: number };
            expect(n.c).toBeLessThanOrEqual(500);
            const old = db
                .prepare('SELECT COUNT(*) AS c FROM care_notifications WHERE "id" = ?')
                .get('old1') as { c: number };
            expect(old.c).toBe(0);
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

    it('lista unread + odczyt własnego, cudze 0', async () => {
        const db = freshDb();
        try {
            const f = fake(db);
            await syncCareNotifications(f, U1, 'mine', NOW, SLA);
            const { unreadCount } = await listCareNotifications(f, 'u1', {
                unreadOnly: true,
                limit: 50
            });
            expect(unreadCount).toBe(4);
            const first = (await listCareNotifications(f, 'u1', { unreadOnly: true, limit: 1 }))
                .items[0];
            expect(await markCareNotificationRead(f, 'u1', first.id, NOW)).toBe(1);
            expect(await markCareNotificationRead(f, 'u9', first.id, NOW)).toBe(0);
            expect(
                (await listCareNotifications(f, 'u1', { unreadOnly: true, limit: 50 })).unreadCount
            ).toBe(3);
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

    it('zbiorczy odczyt: własne zamyka, cudze pomija, puste 0', async () => {
        const db = freshDb();
        try {
            const f = fake(db);
            await syncCareNotifications(f, U1, 'mine', NOW, SLA);
            const all = (await listCareNotifications(f, 'u1', { unreadOnly: true, limit: 50 }))
                .items;
            expect(all.length).toBe(4);
            // Cudzy wiersz nie do ruszenia przez u1.
            db.prepare(
                'INSERT INTO care_notifications ("id", "userId", "offerKind", "offerId", "type", "readAt", "createdAt") VALUES (?,?,?,?,?,?,?)'
            ).run('alien', 'u9', 'rury', 'o1', 'SLA_BREACH', null, NOW);
            const read = await markCareNotificationsRead(
                f,
                'u1',
                [all[0].id, all[1].id, 'alien', 'brak'],
                NOW
            );
            expect(read).toBe(2);
            expect(
                (await listCareNotifications(f, 'u1', { unreadOnly: true, limit: 50 })).unreadCount
            ).toBe(2);
            expect(await markCareNotificationsRead(f, 'u1', [], NOW)).toBe(0);
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

    it('daty ISO-UTC przechodzą verbatim (kontrakt String, nie DateTime)', async () => {
        const db = freshDb();
        try {
            const f = fake(db);
            await syncCareNotifications(f, U1, 'mine', NOW, SLA);
            const rows = db
                .prepare('SELECT DISTINCT "createdAt" AS c FROM "care_notifications"')
                .all() as Array<{ c: string }>;
            expect(rows).toHaveLength(1);
            expect(rows[0].c).toBe(NOW);
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

    it('repOwner: podgląd nie zamyka wierszy spoza filtra', async () => {
        const ADMIN: CareUser = { id: 'admin', role: 'admin', subUsers: [] };
        const db = new DatabaseSync(':memory:');
        db.exec(`CREATE TABLE offers_rel (id TEXT PRIMARY KEY, "userId" TEXT, "createdAt" TEXT, "offer_number" TEXT, "clientName" TEXT);
        CREATE TABLE offers_studnie_rel (id TEXT PRIMARY KEY, "userId" TEXT, "createdAt" TEXT, "offer_number" TEXT, "clientName" TEXT, "totalPrice" REAL);
        CREATE TABLE document_shares (id TEXT PRIMARY KEY, "sharedWithUserId" TEXT, "documentType" TEXT, "documentId" TEXT);
        CREATE TABLE care_states ("offerKind" TEXT NOT NULL, "offerId" TEXT NOT NULL, "snoozedUntil" TEXT, "doneAt" TEXT, "updatedBy" TEXT, "updatedAt" TEXT NOT NULL,
            CONSTRAINT "care_states_pkey" PRIMARY KEY ("offerKind", "offerId"));
        CREATE TABLE care_notifications ("id" TEXT NOT NULL, "userId" TEXT NOT NULL, "offerKind" TEXT NOT NULL, "offerId" TEXT NOT NULL, "type" TEXT NOT NULL, "readAt" TEXT, "createdAt" TEXT NOT NULL,
            CONSTRAINT "care_notifications_pkey" PRIMARY KEY ("id"));
        CREATE TABLE offer_follow_ups (id TEXT PRIMARY KEY, "offerKind" TEXT, "offerId" TEXT, "createdByUserId" TEXT, "contactedAt" TEXT, "createdAt" TEXT, outcome TEXT, "nextContactAt" TEXT);`);
        try {
            const f = fake(db);
            const past = '2026-09-30T10:00:00.000Z';
            // oA (u1, OPEN due) + oB (u2, OPEN due ale done = stale).
            db.prepare('INSERT INTO offers_rel (id, "userId", "createdAt") VALUES (?,?,?)').run(
                'oA',
                'u1',
                past
            );
            db.prepare('INSERT INTO offers_rel (id, "userId", "createdAt") VALUES (?,?,?)').run(
                'oB',
                'u2',
                past
            );
            for (const [fid, oid] of [
                ['fA', 'oA'],
                ['fB', 'oB']
            ]) {
                db.prepare(
                    'INSERT INTO offer_follow_ups (id, "offerKind", "offerId", "createdByUserId", "contactedAt", "createdAt", outcome, "nextContactAt") VALUES (?,?,?,?,?,?,?,?)'
                ).run(fid, 'rury', oid, 'u1', past, past, 'OPEN', past);
            }
            db.prepare(
                'INSERT INTO care_states ("offerKind", "offerId", "snoozedUntil", "doneAt", "updatedBy", "updatedAt") VALUES (?,?,?,?,?,?)'
            ).run('rury', 'oB', null, NOW, 'u2', NOW);
            const old = '2026-10-09T00:00:00.000Z';
            db.prepare(
                'INSERT INTO care_notifications ("id", "userId", "offerKind", "offerId", "type", "readAt", "createdAt") VALUES (?,?,?,?,?,?,?)'
            ).run('nA', 'admin', 'rury', 'oA', 'CALLBACK_DUE', null, old);
            db.prepare(
                'INSERT INTO care_notifications ("id", "userId", "offerKind", "offerId", "type", "readAt", "createdAt") VALUES (?,?,?,?,?,?,?)'
            ).run('nB', 'admin', 'rury', 'oB', 'CALLBACK_DUE', null, old);
            // Podgląd repa u1: wiersz oB (stale, spoza filtra) ZOSTAJE nieprzeczytany.
            await syncCareNotifications(f, ADMIN, 'all', NOW, SLA, { repOwner: 'u1' });
            const unreadAfterRep = (
                await listCareNotifications(f, 'admin', { unreadOnly: true, limit: 50 })
            ).items.map((n) => n.offerId);
            expect(unreadAfterRep).toContain('oA');
            expect(unreadAfterRep).toContain('oB');
            // Pełny sync bez filtra: stale oB zamyka, żywe oA zostaje.
            await syncCareNotifications(f, ADMIN, 'all', '2026-10-10T13:00:00.000Z', SLA);
            const unreadAfterFull = (
                await listCareNotifications(f, 'admin', { unreadOnly: true, limit: 50 })
            ).items.map((n) => n.offerId);
            expect(unreadAfterFull).toContain('oA');
            expect(unreadAfterFull).not.toContain('oB');
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
