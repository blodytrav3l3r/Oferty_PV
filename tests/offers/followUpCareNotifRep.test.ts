/*
 * tests/offers/followUpCareNotifRep.test.ts
 * Faza B (A+C): sync z repOwner nie może dopisywać do skrzynki viewera.
 * REGRESSION PROOF: T1/T3 RED na starym kodzie (INSERT/DELETE przy preview),
 * GREEN po fixie (preview = zero efektów ubocznych w DB).
 * T2/T4 to kotwice (GREEN przed i po): pełny sync działa, lista self-only.
 */
import { DatabaseSync } from 'node:sqlite';
import type { Prisma } from '../../generated/prisma';
import {
    syncCareNotifications,
    listCareNotifications,
    type CareUser
} from '../../src/services/careService';

const NOW = '2026-10-10T12:00:00.000Z';
const PRO: CareUser = { id: 'p1', role: 'pro', subUsers: ['s1'] };
const SLA = { firstContactH: 24, staleD: 7, escalationH: 72 };

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
    // oA: oferta suba s1 bez kontaktu, stara -> kandydat SLA_BREACH dla repa s1.
    db.prepare('INSERT INTO offers_rel (id, "userId", "createdAt") VALUES (?,?,?)').run(
        'oA',
        's1',
        '2026-09-01T00:00:00.000Z'
    );
    return db;
}

function fake(db: DatabaseSync) {
    return {
        $queryRaw: async <T>(...args: any[]): Promise<T> => {
            const q = args[0] as Prisma.Sql;
            const raw = q as unknown as { sql: string; values: unknown[] };
            const rows = db.prepare(raw.sql).all(...(raw.values as never[]));
            return rows as unknown as T;
        }
    };
}

function mailboxCount(db: DatabaseSync, userId: string): number {
    return (
        db
            .prepare('SELECT COUNT(*) AS c FROM care_notifications WHERE "userId" = ?')
            .get(userId) as {
            c: number;
        }
    ).c;
}

describe('A+C preview repa bez zapisów', () => {
    it('T1 sync z repOwner nie dopisuje do skrzynki viewera', async () => {
        const db = freshDb();
        try {
            const r = await syncCareNotifications(fake(db), PRO, 'team', NOW, SLA, {
                repOwner: 's1'
            });
            expect(r.inserted).toBe(0);
            expect(mailboxCount(db, 'p1')).toBe(0);
        } finally {
            db.close();
        }
    });

    it('T2 kotwica: pełny sync bez repOwner nadal dopisuje', async () => {
        const db = freshDb();
        try {
            const r = await syncCareNotifications(fake(db), PRO, 'team', NOW, SLA);
            expect(r.inserted).toBe(1);
            expect(mailboxCount(db, 'p1')).toBe(1);
        } finally {
            db.close();
        }
    });

    it('T3 retencja przy preview nie kasuje wierszy viewera', async () => {
        const db = freshDb();
        try {
            db.prepare(
                'INSERT INTO care_notifications ("id", "userId", "offerKind", "offerId", "type", "readAt", "createdAt") VALUES (?,?,?,?,?,?,?)'
            ).run('old1', 'p1', 'rury', 'oX', 'CALLBACK_DUE', '2026-01-01T00:00:00.000Z', NOW);
            await syncCareNotifications(fake(db), PRO, 'team', NOW, SLA, { repOwner: 's1' });
            const old = db.prepare('SELECT id FROM care_notifications WHERE id = ?').get('old1') as
                { id: string } | undefined;
            expect(old?.id).toBe('old1');
        } finally {
            db.close();
        }
    });

    it('T4 kotwica: lista zawsze self-only', async () => {
        const db = freshDb();
        try {
            const ins = db.prepare(
                'INSERT INTO care_notifications ("id", "userId", "offerKind", "offerId", "type", "readAt", "createdAt") VALUES (?,?,?,?,?,?,?)'
            );
            ins.run('n1', 'p1', 'rury', 'oA', 'SLA_BREACH', null, NOW);
            ins.run('n2', 's1', 'rury', 'oA', 'SLA_BREACH', null, NOW);
            const { items } = await listCareNotifications(fake(db), 'p1', {
                unreadOnly: false,
                limit: 50
            });
            expect(items.map((i) => i.id)).toEqual(['n1']);
        } finally {
            db.close();
        }
    });
});
