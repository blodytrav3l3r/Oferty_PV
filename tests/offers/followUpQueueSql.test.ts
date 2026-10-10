/*
 * tests/offers/followUpQueueSql.test.ts
 * P0.2 SQL kolejki opieki: latest (tie-break id DESC), scope mine/team/all,
 * dedup (offerKind,offerId), ORDER BY bucketWeight/COALESCE(next)/kind/id,
 * cursor base64, limit clamp, max 2 SELECT.
 */
import { DatabaseSync } from 'node:sqlite';
import type { Prisma } from '../../generated/prisma';
import {
    buildCareQueueQueries,
    clampCareLimit,
    decodeCareCursor,
    encodeCareCursor,
    getCareQueue,
    type CareUser
} from '../../src/services/careService';

const NOW = '2026-10-10T00:00:00.000Z';
const PAST = '2026-10-09T10:00:00.000Z';
const FUTURE = '2026-10-11T10:00:00.000Z';

const ADMIN: CareUser = { id: 'admin', role: 'admin', subUsers: [] };
const PRO: CareUser = { id: 'pro1', role: 'pro', subUsers: ['u1'] };
const U1: CareUser = { id: 'u1', role: 'user', subUsers: [] };
const U2: CareUser = { id: 'u2', role: 'user', subUsers: [] };

function freshDb(): DatabaseSync {
    const db = new DatabaseSync(':memory:');
    db.exec(`CREATE TABLE offers_rel (id TEXT PRIMARY KEY, "userId" TEXT);
        CREATE TABLE offers_studnie_rel (id TEXT PRIMARY KEY, "userId" TEXT);
        CREATE TABLE document_shares (id TEXT PRIMARY KEY, "sharedWithUserId" TEXT, "documentType" TEXT, "documentId" TEXT);
        CREATE TABLE care_states ("offerKind" TEXT NOT NULL, "offerId" TEXT NOT NULL, "snoozedUntil" TEXT, "doneAt" TEXT, "updatedBy" TEXT, "updatedAt" TEXT NOT NULL,
            CONSTRAINT "care_states_pkey" PRIMARY KEY ("offerKind", "offerId"));
        CREATE TABLE offer_follow_ups (id TEXT PRIMARY KEY, "offerKind" TEXT,
            "offerId" TEXT, "createdByUserId" TEXT, "contactedAt" TEXT,
            "createdAt" TEXT, outcome TEXT, "nextContactAt" TEXT);`);
    const offer = (kind: string, id: string, userId: string) =>
        db
            .prepare(
                kind === 'rury'
                    ? 'INSERT INTO offers_rel (id, "userId") VALUES (?, ?)'
                    : 'INSERT INTO offers_studnie_rel (id, "userId") VALUES (?, ?)'
            )
            .run(id, userId);
    // u1: o1 rury OPEN overdue, o2 rury OPEN future (3 wpisy = dedup),
    //     o3 studnie WON (remis czasow, wyzsze id wygrywa), o4 rury NO_CONTACT.
    // u2: o9 rury OPEN overdue (niewidoczne dla u1). pro1: o5 rury OPEN overdue.
    offer('rury', 'o1', 'u1');
    offer('rury', 'o2', 'u1');
    offer('studnie', 'o3', 'u1');
    offer('rury', 'o4', 'u1');
    offer('rury', 'o9', 'u2');
    offer('rury', 'o5', 'pro1');
    const fu = (
        id: string,
        kind: string,
        offerId: string,
        outcome: string,
        next: string | null,
        contacted = PAST
    ) =>
        db
            .prepare(
                `INSERT INTO offer_follow_ups (id, "offerKind", "offerId", "createdByUserId",
                 "contactedAt", "createdAt", outcome, "nextContactAt") VALUES (?,?,?,?,?,?,?,?)`
            )
            .run(id, kind, offerId, 'u1', contacted, contacted, outcome, next);
    fu('f1', 'rury', 'o1', 'OPEN', PAST);
    fu('f2a', 'rury', 'o2', 'OPEN', PAST);
    fu('f2b', 'rury', 'o2', 'OPEN', FUTURE, FUTURE);
    fu('f2c', 'rury', 'o2', 'OPEN', FUTURE, '2026-10-10T12:00:00.000Z');
    fu('aaa', 'studnie', 'o3', 'OPEN', PAST);
    fu('zzz', 'studnie', 'o3', 'WON', PAST);
    fu('f9', 'rury', 'o9', 'OPEN', PAST);
    fu('f5', 'rury', 'o5', 'OPEN', PAST);
    return db;
}

function rawAll(db: DatabaseSync, q: Prisma.Sql): Record<string, unknown>[] {
    const raw = q as unknown as { sql: string; values: unknown[] };
    const params = raw.values as (string | number | bigint | null)[];
    return db.prepare(raw.sql).all(...params) as Record<string, unknown>[];
}

function dataIds(db: DatabaseSync, user: CareUser, extra = {}): string[] {
    const { data } = buildCareQueueQueries(user, { nowIso: NOW, ...extra });
    return rawAll(db, data).map((r) => `${r.offerKind}:${r.offerId}`);
}

describe('P0.2 care queue SQL', () => {
    it('latest: przy remisie czasow wygrywa wyzsze id (o3 = WON, bucket 2)', () => {
        const db = freshDb();
        try {
            const { data } = buildCareQueueQueries(U1, { nowIso: NOW });
            const rows = rawAll(db, data);
            const o3 = rows.find((r) => r.offerId === 'o3') as Record<string, unknown>;
            expect(o3.outcome).toBe('WON');
            expect(Number(o3.bucketWeight)).toBe(2);
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

    it('dedup: o2 z 3 wpisami to 1 wiersz; COUNT DISTINCT = liczba ofert', async () => {
        const db = freshDb();
        try {
            const fake = {
                $queryRaw: async <T>(...args: unknown[]): Promise<T> =>
                    rawAll(db, args[0] as Prisma.Sql) as unknown as T
            };
            const res = await getCareQueue(fake, U1, { nowIso: NOW });
            expect(res.totalCount).toBe(4);
            expect(res.items).toHaveLength(4);
            expect(res.items.filter((i) => i.offerId === 'o2')).toHaveLength(1);
            // latest o2 = f2c (najpozniejszy contactedAt) -> OPEN future -> bucket 1.
            expect(res.items.find((i) => i.offerId === 'o2')?.bucketWeight).toBe(1);
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

    it('ORDER BY bucketWeight, COALESCE(next,9999), kind, id', () => {
        const db = freshDb();
        try {
            // u1: o1 bucket0 PAST, o4 bucket0 NULL(next->9999, ostatnie w buckecie),
            // o2 bucket1 FUTURE, o3 bucket2.
            expect(dataIds(db, U1)).toEqual(['rury:o1', 'rury:o4', 'rury:o2', 'studnie:o3']);
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

    it('scope: mine/team/all + 403 dla all bez admin', () => {
        const db = freshDb();
        try {
            expect(dataIds(db, U1)).toHaveLength(4);
            expect(dataIds(db, U1)).not.toContain('rury:o9');
            // team pro1 = pro1 + u1 (bez u2).
            const team = dataIds(db, PRO, { scope: 'team' });
            expect(team).toContain('rury:o5');
            expect(team).toContain('rury:o1');
            expect(team).not.toContain('rury:o9');
            // team dla user = 403.
            expect(() => buildCareQueueQueries(U2, { nowIso: NOW, scope: 'team' })).toThrow();
            // all admin = wszystko (4x u1 + o5 + o9).
            const { count } = buildCareQueueQueries(ADMIN, { nowIso: NOW, scope: 'all' });
            expect(Number(rawAll(db, count)[0].c)).toBe(6);
            // all bez admin = 403.
            expect(() => buildCareQueueQueries(U1, { nowIso: NOW, scope: 'all' })).toThrow();
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

    it('share: udostępniona oferta u2 widoczna dla u1 (read-only)', () => {
        const db = freshDb();
        try {
            db.prepare(
                'INSERT INTO document_shares (id, "sharedWithUserId", "documentType", "documentId") VALUES (?,?,?,?)'
            ).run('sh1', 'u1', 'offer', 'o9');
            expect(dataIds(db, U1)).toContain('rury:o9');
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

    it('cursor: strony lacznie daja calosc bez powtorzen; limit clamp', () => {
        const db = freshDb();
        try {
            const p1 = buildCareQueueQueries(U1, { nowIso: NOW, limit: 2 });
            const rows1 = rawAll(db, p1.data);
            expect(rows1).toHaveLength(3); // limit+1 = probka nastepnej strony
            const page1 = rows1.slice(0, 2);
            const last = page1[1] as Record<string, unknown>;
            const cursor = encodeCareCursor({
                w: Number(last.bucketWeight),
                n: last.next as string | null,
                k: last.offerKind as string,
                i: last.offerId as string
            });
            expect(decodeCareCursor(cursor)).toEqual({
                w: Number(last.bucketWeight),
                n: last.next,
                k: last.offerKind,
                i: last.offerId
            });
            expect(decodeCareCursor('!!!nie-base64!!!')).toBeNull();
            const p2 = buildCareQueueQueries(U1, { nowIso: NOW, limit: 2, cursor });
            const rows2 = rawAll(db, p2.data);
            const ids1 = page1.map((r) => `${r.offerKind}:${r.offerId}`);
            const ids2 = rows2.map((r) => `${r.offerKind}:${r.offerId}`);
            expect(new Set([...ids1, ...ids2]).size).toBe(4);
            expect(ids1.filter((x) => ids2.includes(x))).toHaveLength(0);
            expect([...ids1, ...ids2].sort()).toEqual(
                ['rury:o1', 'rury:o2', 'rury:o4', 'studnie:o3'].sort()
            );
            expect(clampCareLimit(200)).toBe(100);
            expect(clampCareLimit(undefined)).toBe(50);
            expect(clampCareLimit(0)).toBe(1);
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

    it('getCareQueue: max 2 SELECT (data + count)', async () => {
        let calls = 0;
        const db = freshDb();
        try {
            const fake = {
                $queryRaw: async <T>(...args: unknown[]): Promise<T> => {
                    calls += 1;
                    return rawAll(db, args[0] as Prisma.Sql) as unknown as T;
                }
            };
            const res = await getCareQueue(fake, U1, { nowIso: NOW, limit: 2 });
            expect(calls).toBe(2);
            expect(res.items).toHaveLength(2);
            expect(res.totalCount).toBe(4);
            expect(typeof res.nextCursor).toBe('string');
            const tail = await getCareQueue(fake, U1, {
                nowIso: NOW,
                limit: 10
            });
            expect(tail.nextCursor).toBeNull();
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
