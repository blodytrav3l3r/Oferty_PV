/*
 * tests/offers/careEtagOwner.test.ts
 * Zmiana opiekuna oferty MUSI unieważniać ETag panelu (inaczej żywy Pulpit
 * dostaje 304 w kółko i nie widać przeniesienia oferty).
 */
import { DatabaseSync } from 'node:sqlite';
import type { Prisma } from '../../generated/prisma';
import {
    buildCareQueueQueries,
    getCareEtagInput,
    getCareQueue,
    type CareUser
} from '../../src/services/careService';

const NOW = '2026-10-10T00:00:00.000Z';
const T0 = '2026-10-01T00:00:00.000Z';
const T1 = '2026-10-11T00:00:00.000Z';
const U1: CareUser = { id: 'u1', role: 'user', subUsers: [] };
const U2: CareUser = { id: 'u2', role: 'user', subUsers: [] };
const ADMIN: CareUser = { id: 'admin', role: 'admin', subUsers: [] };

function freshDb(): DatabaseSync {
    const db = new DatabaseSync(':memory:');
    db.exec(`CREATE TABLE offers_rel (id TEXT PRIMARY KEY, "userId" TEXT, "createdAt" TEXT, "updatedAt" TEXT, "offer_number" TEXT, "clientName" TEXT, "data" TEXT);
        CREATE TABLE offers_studnie_rel (id TEXT PRIMARY KEY, "userId" TEXT, "createdAt" TEXT, "updatedAt" TEXT, "offer_number" TEXT, "clientName" TEXT, "totalPrice" REAL, "data" TEXT);
        CREATE TABLE document_shares (id TEXT PRIMARY KEY, "sharedWithUserId" TEXT, "documentType" TEXT, "documentId" TEXT);
        CREATE TABLE care_states ("offerKind" TEXT NOT NULL, "offerId" TEXT NOT NULL, "snoozedUntil" TEXT, "doneAt" TEXT, "updatedBy" TEXT, "updatedAt" TEXT NOT NULL,
            CONSTRAINT "care_states_pkey" PRIMARY KEY ("offerKind", "offerId"));
        CREATE TABLE offer_follow_ups (id TEXT PRIMARY KEY, "offerKind" TEXT, "offerId" TEXT, "createdByUserId" TEXT, "contactedAt" TEXT, "createdAt" TEXT, outcome TEXT, "nextContactAt" TEXT, note TEXT);
        CREATE TABLE care_notifications ("id" TEXT PRIMARY KEY, "userId" TEXT NOT NULL, "offerKind" TEXT NOT NULL, "offerId" TEXT NOT NULL, "type" TEXT NOT NULL, "readAt" TEXT, "createdAt" TEXT NOT NULL);
        CREATE TABLE care_sla_config (id TEXT PRIMARY KEY, "firstContactH" INTEGER, "staleD" INTEGER, "escalationH" INTEGER, "updatedBy" TEXT, "updatedAt" TEXT);
        CREATE TABLE care_sla_scopes ("scopeType" TEXT NOT NULL, "scopeId" TEXT NOT NULL, "firstContactH" INTEGER NOT NULL, "staleD" INTEGER NOT NULL, "escalationH" INTEGER NOT NULL, "updatedBy" TEXT, "updatedAt" TEXT,
            CONSTRAINT "care_sla_scopes_pkey" PRIMARY KEY ("scopeType", "scopeId"));`);
    db.prepare(
        'INSERT INTO offers_rel (id, "userId", "createdAt", "updatedAt") VALUES (?, ?, ?, ?)'
    ).run('o1', 'u1', T0, T0);
    db.prepare(
        `INSERT INTO offer_follow_ups (id, "offerKind", "offerId", "createdByUserId",
         "contactedAt", "createdAt", outcome, "nextContactAt") VALUES (?,?,?,?,?,?,?,?)`
    ).run('f1', 'rury', 'o1', 'u1', T0, T0, 'OPEN', null);
    return db;
}

function fake(db: DatabaseSync) {
    return {
        $queryRaw: async <T>(...args: unknown[]): Promise<T> => {
            const q = args[0] as Prisma.Sql;
            const raw = q as unknown as { sql: string; values: unknown[] };
            return db.prepare(raw.sql).all(...(raw.values as never[])) as unknown as T;
        }
    };
}

async function queueIds(db: DatabaseSync, user: CareUser): Promise<string[]> {
    const res = await getCareQueue(fake(db), user, { nowIso: NOW });
    return res.items.map((i) => `${i.offerKind}:${i.offerId}`);
}

describe('ETag panelu a zmiana opiekuna', () => {
    it('widocznosc idzie za wlascicielem (po userId, nie po autorze)', async () => {
        const db = freshDb();
        try {
            expect(await queueIds(db, U1)).toEqual(['rury:o1']);
            expect(await queueIds(db, U2)).toEqual([]);
            // Kartoteka: assign u1 -> u2 (kolumna userId + bump updatedAt).
            db.prepare('UPDATE offers_rel SET "userId" = ?, "updatedAt" = ? WHERE id = ?').run(
                'u2',
                T1,
                'o1'
            );
            expect(await queueIds(db, U2)).toEqual(['rury:o1']);
            expect(await queueIds(db, U1)).toEqual([]);
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

    it('assign zmienia wejscie ETag (brak wiecznego 304)', async () => {
        const db = freshDb();
        try {
            const f = fake(db);
            const before = await getCareEtagInput(f, 'u1');
            db.prepare('UPDATE offers_rel SET "userId" = ?, "updatedAt" = ? WHERE id = ?').run(
                'u2',
                T1,
                'o1'
            );
            const after = await getCareEtagInput(f, 'u1');
            expect(after).not.toEqual(before);
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

    it('scope=all + repOwner: tylko oferty repa (nie 1=1)', () => {
        const db = freshDb();
        try {
            db.prepare(
                'INSERT INTO offers_rel (id, "userId", "createdAt", "updatedAt") VALUES (?, ?, ?, ?)'
            ).run('o2', 'u2', T0, T0);
            db.prepare(
                `INSERT INTO offer_follow_ups (id, "offerKind", "offerId", "createdByUserId",
                 "contactedAt", "createdAt", outcome, "nextContactAt") VALUES (?,?,?,?,?,?,?,?)`
            ).run('f2', 'rury', 'o2', 'u2', T0, T0, 'OPEN', null);
            const { data } = buildCareQueueQueries(ADMIN, {
                nowIso: NOW,
                scope: 'all',
                repOwner: 'u1'
            });
            const raw = data as unknown as { sql: string; values: unknown[] };
            const rows = db.prepare(raw.sql).all(...(raw.values as never[])) as Array<{
                offerId: string;
            }>;
            expect(rows.map((r) => r.offerId)).toEqual(['o1']);
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
