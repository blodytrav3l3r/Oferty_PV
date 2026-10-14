/*
 * tests/offers/careSyncLoad.test.ts
 * P0+P1 planu poprawy opieki: pomiar syncCareNotifications.
 * Seed 400 ofert (in-memory, poniżej capa retencji 500), licznik
 * statementów + czas. P1: set-based => stała liczba statementów
 * niezależna od N (bound) + wyścig równoległych synców bez duplikatów.
 */
import { DatabaseSync } from 'node:sqlite';
import { ensureLatestFollowupFixture } from './careLatestFixture';
import type { Prisma } from '../../generated/prisma';
import {
    syncCareNotifications,
    resetCareSyncThrottleForTests,
    type CareUser
} from '../../src/services/careService';

const NOW = '2026-10-10T12:00:00.000Z';
const NOW2 = '2026-10-10T12:01:00.000Z';
const NOW3 = '2026-10-10T12:02:00.000Z';
const U1: CareUser = { id: 'u1', role: 'user', subUsers: [] };
const SLA = { firstContactH: 24, staleD: 7, escalationH: 72 };
const N = 400;

function seedDb(): DatabaseSync {
    const db = new DatabaseSync(':memory:');
    db.exec(`CREATE TABLE offers_rel (id TEXT PRIMARY KEY, "userId" TEXT, "createdAt" TEXT, "offer_number" TEXT, "clientName" TEXT, "data" TEXT);
        CREATE TABLE offers_studnie_rel (id TEXT PRIMARY KEY, "userId" TEXT, "createdAt" TEXT, "offer_number" TEXT, "clientName" TEXT, "totalPrice" REAL, "data" TEXT);
        CREATE TABLE document_shares (id TEXT PRIMARY KEY, "sharedWithUserId" TEXT, "documentType" TEXT, "documentId" TEXT);
        CREATE TABLE care_states ("offerKind" TEXT NOT NULL, "offerId" TEXT NOT NULL, "snoozedUntil" TEXT, "doneAt" TEXT, "updatedBy" TEXT, "updatedAt" TEXT NOT NULL,
            CONSTRAINT "care_states_pkey" PRIMARY KEY ("offerKind", "offerId"));
        CREATE TABLE care_notifications ("id" TEXT NOT NULL, "userId" TEXT NOT NULL, "offerKind" TEXT NOT NULL, "offerId" TEXT NOT NULL, "type" TEXT NOT NULL, "readAt" TEXT, "createdAt" TEXT NOT NULL,
            CONSTRAINT "care_notifications_pkey" PRIMARY KEY ("id"));
        CREATE UNIQUE INDEX "uq_carenotif_unread_per_offer" ON "care_notifications" ("userId", "offerKind", "offerId", "type") WHERE "readAt" IS NULL;`);
    const insOffer = db.prepare(
        'INSERT INTO offers_rel (id, "userId", "createdAt") VALUES (?,?,?)'
    );
    // Followups: tabela + dane.
    db.exec(
        `CREATE TABLE offer_follow_ups (id TEXT PRIMARY KEY, "offerKind" TEXT, "offerId" TEXT, "createdByUserId" TEXT, "contactedAt" TEXT, "createdAt" TEXT, outcome TEXT, "nextContactAt" TEXT);`
    );
    const insFuReal = db.prepare(
        'INSERT INTO offer_follow_ups (id, "offerKind", "offerId", "createdByUserId", "contactedAt", "createdAt", outcome, "nextContactAt") VALUES (?,?,?,?,?,?,?,?)'
    );
    for (let i = 0; i < N; i++) {
        const id = 'o' + i;
        insOffer.run(id, 'u1', '2026-09-01T00:00:00.000Z');
        if (i % 2 === 0) {
            // OPEN overdue 10d -> SLA_BREACH.
            insFuReal.run(
                'f' + i,
                'rury',
                id,
                'u1',
                '2026-09-30T10:00:00.000Z',
                '2026-09-30T10:00:00.000Z',
                'OPEN',
                '2026-09-30T10:00:00.000Z'
            );
        }
        // Nieparzyste: brak historii -> CALLBACK_DUE.
    }
    // P1: cache latest (triggery + backfill).
    ensureLatestFollowupFixture(db);
    return db;
}

// P0.3: throttle trzyma stan w module — reset przed każdym przypadkiem
// (również dla starszych testów, inaczej stan wycieka między nimi).
beforeEach(() => {
    resetCareSyncThrottleForTests();
});

describe('P0+P1: sync 400 ofert set-based', () => {
    it('inserted=N, rerun=0, stała liczba statementów', async () => {
        const db = seedDb();
        let statements = 0;
        const f = {
            $queryRaw: async <T>(...args: any[]): Promise<T> => {
                statements += 1;
                const q = args[0] as Prisma.Sql;
                const raw = q as unknown as { sql: string; values: unknown[] };
                return db.prepare(raw.sql).all(...(raw.values as never[])) as unknown as T;
            }
        };
        try {
            const t0 = Date.now();
            const r1 = await syncCareNotifications(f, U1, 'mine', NOW, SLA);
            const ms1 = Date.now() - t0;
            expect(r1.inserted).toBe(N);
            // P1: INSERT + COUNT + UPDATE..RETURNING + 2×retencja = 5, margines 3.
            expect(statements).toBeLessThanOrEqual(8);

            console.log(
                `BASELINE sync1: inserted=${r1.inserted} statements=${statements} ms=${ms1}`
            );
            const before = statements;
            const t1 = Date.now();
            const r2 = await syncCareNotifications(f, U1, 'mine', NOW2, SLA);
            const ms2 = Date.now() - t1;
            expect(r2.inserted).toBe(0);
            expect(statements - before).toBeLessThanOrEqual(8);

            console.log(
                `BASELINE sync2-rerun: inserted=0 statements=${statements - before} ms=${ms2}`
            );
        } finally {
            db.close();
        }
    }, 120000);

    it('wyścig dwóch synców: suma inserted=N, brak błędów i duplikatów', async () => {
        const db = seedDb();
        const f = {
            $queryRaw: async <T>(...args: any[]): Promise<T> => {
                const q = args[0] as Prisma.Sql;
                const raw = q as unknown as { sql: string; values: unknown[] };
                return db.prepare(raw.sql).all(...(raw.values as never[])) as unknown as T;
            }
        };
        try {
            const [a, b] = await Promise.all([
                syncCareNotifications(f, U1, 'mine', NOW2, SLA),
                syncCareNotifications(f, U1, 'mine', NOW3, SLA)
            ]);
            expect(a.inserted + b.inserted).toBe(N);
            const cnt = db
                .prepare(
                    'SELECT COUNT(*) AS c FROM "care_notifications" WHERE "userId" = ? AND "readAt" IS NULL'
                )
                .get('u1') as unknown as { c: number };
            expect(cnt.c).toBe(N);
        } finally {
            db.close();
        }
    }, 120000);
});

describe('P0.3: throttle syncu per skrzynka', () => {
    it('natychmiastowy rerun: skip bez statementów (throttled)', async () => {
        const db = seedDb();
        let statements = 0;
        const f = {
            $queryRaw: async <T>(...args: any[]): Promise<T> => {
                statements += 1;
                const q = args[0] as Prisma.Sql;
                const raw = q as unknown as { sql: string; values: unknown[] };
                return db.prepare(raw.sql).all(...(raw.values as never[])) as unknown as T;
            }
        };
        try {
            const r1 = await syncCareNotifications(f, U1, 'mine', NOW, SLA);
            expect(r1.inserted).toBe(N);
            expect(r1.skipped).toBeUndefined();
            const before = statements;
            const r2 = await syncCareNotifications(f, U1, 'mine', NOW2, SLA);
            expect(r2.inserted).toBe(0);
            expect(r2.skipped).toBe('throttled');
            expect(statements - before).toBe(0);
        } finally {
            db.close();
        }
    }, 120000);

    it('degraded run (błędy wewnątrz) też stempluje: rerun to skip', async () => {
        const db = seedDb();
        let statements = 0;
        let calls = 0;
        const f = {
            $queryRaw: async <T>(...args: any[]): Promise<T> => {
                statements += 1;
                calls += 1;
                // Pierwszy statement pada — sync degraduje do zer (fallbacks),
                // ale przebieg liczy się jako wykonany (stempel).
                if (calls === 1) throw new Error('boom');
                const q = args[0] as Prisma.Sql;
                const raw = q as unknown as { sql: string; values: unknown[] };
                return db.prepare(raw.sql).all(...(raw.values as never[])) as unknown as T;
            }
        };
        try {
            const r1 = await syncCareNotifications(f, U1, 'mine', NOW, SLA);
            expect(r1.inserted).toBe(0);
            expect(r1.skipped).toBeUndefined();
            const before = statements;
            const r2 = await syncCareNotifications(f, U1, 'mine', NOW2, SLA);
            expect(r2.skipped).toBe('throttled');
            expect(statements - before).toBe(0);
        } finally {
            db.close();
        }
    }, 120000);

    it('współbieżne synci: drugi czeka i dostaje skip, suma inserted=N', async () => {
        const db = seedDb();
        const f = {
            $queryRaw: async <T>(...args: any[]): Promise<T> => {
                const q = args[0] as Prisma.Sql;
                const raw = q as unknown as { sql: string; values: unknown[] };
                return db.prepare(raw.sql).all(...(raw.values as never[])) as unknown as T;
            }
        };
        try {
            const [a, b] = await Promise.all([
                syncCareNotifications(f, U1, 'mine', NOW2, SLA),
                syncCareNotifications(f, U1, 'mine', NOW3, SLA)
            ]);
            expect(a.inserted + b.inserted).toBe(N);
            const cnt = db
                .prepare(
                    'SELECT COUNT(*) AS c FROM "care_notifications" WHERE "userId" = ? AND "readAt" IS NULL'
                )
                .get('u1') as unknown as { c: number };
            expect(cnt.c).toBe(N);
        } finally {
            db.close();
        }
    }, 120000);
});
