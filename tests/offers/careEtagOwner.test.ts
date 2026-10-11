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
    getCareSummary,
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

function flatSql(
    strings: TemplateStringsArray,
    values: unknown[]
): { sql: string; values: unknown[] } {
    let sql = '';
    const out: unknown[] = [];
    strings.forEach((s: string, i: number) => {
        sql += s;
        if (i < values.length) {
            const v = values[i] as unknown as { sql?: unknown; values?: unknown };
            if (v && typeof v === 'object' && typeof v.sql === 'string') {
                sql += v.sql;
                out.push(...((v.values as unknown[]) ?? []));
            } else {
                sql += '?';
                out.push(values[i]);
            }
        }
    });
    return { sql, values: out };
}

function fake(db: DatabaseSync) {
    return {
        $queryRaw: async <T>(...args: unknown[]): Promise<T> => {
            const a0 = args[0] as Prisma.Sql;
            const maybe = a0 as unknown as { sql?: unknown; values?: unknown };
            if (maybe && typeof maybe.sql === 'string') {
                const raw = maybe as unknown as { sql: string; values: unknown[] };
                return db.prepare(raw.sql).all(...(raw.values as never[])) as unknown as T;
            }
            // Wywołanie tag-template (db.$queryRaw`...${v}...`): strings + values,
            // zagnieżdżone Prisma.Sql spłaszczane (ten sam styl ? co sterownik).
            const flat = flatSql(a0 as unknown as TemplateStringsArray, args.slice(1));
            return db.prepare(flat.sql).all(...(flat.values as never[])) as unknown as T;
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

    it('nadanie shares zmienia wejscie ETag (brak wiecznego 304)', async () => {
        const db = freshDb();
        try {
            const f = fake(db);
            const before = await getCareEtagInput(f, 'u2');
            // Udostępnienie o1 (u1) dla u2 — u2 widzi nowy wiersz w kolejce.
            db.prepare(
                'INSERT INTO document_shares (id, "sharedWithUserId", "documentType", "documentId") VALUES (?, ?, ?, ?)'
            ).run('sh1', 'u2', 'offer', 'o1');
            const after = await getCareEtagInput(f, 'u2');
            expect(after).not.toEqual(before);
            expect(await queueIds(db, U2)).toEqual(['rury:o1']);
            // Revoke też unieważnia (COUNT spada) — brak wiecznego 304.
            db.prepare('DELETE FROM document_shares WHERE id = ?').run('sh1');
            const afterRevoke = await getCareEtagInput(f, 'u2');
            expect(afterRevoke).not.toEqual(after);
            expect(await queueIds(db, U2)).toEqual([]);
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

    it('hidePaused: jeden flag w summary i kolejce (parzystość liczników)', async () => {
        const db = freshDb();
        try {
            const f = fake(db);
            db.prepare(
                'INSERT INTO care_states ("offerKind", "offerId", "snoozedUntil", "doneAt", "updatedBy", "updatedAt") VALUES (?,?,?,?,?,?)'
            ).run('rury', 'o1', null, NOW, 'u1', NOW);
            // Default false: pauza widoczna w obu (totalCount zgodny).
            const s = await getCareSummary(f, U1, 'mine', NOW, {});
            const q = await getCareQueue(fake(db), U1, { nowIso: NOW });
            expect(s.totalCount).toBe(1);
            expect(q.totalCount).toBe(1);
            // hidePaused=true: oba wycinają pauzę.
            const s2 = await getCareSummary(f, U1, 'mine', NOW, { hidePaused: true });
            const q2 = await getCareQueue(fake(db), U1, { nowIso: NOW, hidePaused: true });
            expect(s2.totalCount).toBe(0);
            expect(q2.totalCount).toBe(0);
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
