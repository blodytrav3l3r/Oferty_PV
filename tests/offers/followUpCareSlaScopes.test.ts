/*
 * tests/offers/followUpCareSlaScopes.test.ts
 * P4 (ADR-016): progi SLA per zespół / per user z fallbackiem do globalnych.
 */
import { DatabaseSync } from 'node:sqlite';
import type { Prisma } from '../../generated/prisma';
import {
    getEffectiveSla,
    setScopedSla,
    setSlaConfig,
    getSlaUpdatedAt,
    getCareEtagInput,
    type CareUser
} from '../../src/services/careService';

const NOW = '2026-10-10T12:00:00.000Z';
const PRO: CareUser = { id: 'p1', role: 'pro', subUsers: ['u1'] };
const U1: CareUser = { id: 'u1', role: 'user', subUsers: [] };

function freshDb(): DatabaseSync {
    const db = new DatabaseSync(':memory:');
    db.exec(`CREATE TABLE care_sla_config (id TEXT PRIMARY KEY, "firstContactH" INTEGER, "staleD" INTEGER, "escalationH" INTEGER, "updatedBy" TEXT, "updatedAt" TEXT);
        CREATE TABLE care_sla_scopes ("scopeType" TEXT NOT NULL, "scopeId" TEXT NOT NULL, "firstContactH" INTEGER NOT NULL, "staleD" INTEGER NOT NULL, "escalationH" INTEGER NOT NULL, "updatedBy" TEXT, "updatedAt" TEXT,
            CONSTRAINT "care_sla_scopes_pkey" PRIMARY KEY ("scopeType", "scopeId"));
        CREATE TABLE offer_follow_ups (id TEXT PRIMARY KEY, "offerKind" TEXT, "offerId" TEXT, "createdByUserId" TEXT, "contactedAt" TEXT, "createdAt" TEXT, outcome TEXT, "nextContactAt" TEXT);
        CREATE TABLE care_states ("offerKind" TEXT NOT NULL, "offerId" TEXT NOT NULL, "snoozedUntil" TEXT, "doneAt" TEXT, "updatedBy" TEXT, "updatedAt" TEXT NOT NULL);
        CREATE TABLE care_notifications ("id" TEXT PRIMARY KEY, "userId" TEXT NOT NULL, "offerKind" TEXT NOT NULL, "offerId" TEXT NOT NULL, "type" TEXT NOT NULL, "readAt" TEXT, "createdAt" TEXT NOT NULL);
        CREATE TABLE offers_rel (id TEXT PRIMARY KEY, "userId" TEXT, "createdAt" TEXT, "updatedAt" TEXT);
        CREATE TABLE offers_studnie_rel (id TEXT PRIMARY KEY, "userId" TEXT, "createdAt" TEXT, "updatedAt" TEXT);
        CREATE TABLE document_shares (id TEXT PRIMARY KEY, "sharedWithUserId" TEXT, "documentType" TEXT, "documentId" TEXT);`);
    return db;
}

function fake(db: DatabaseSync) {
    const run = (q: Prisma.Sql) => {
        const raw = q as unknown as { sql: string; values: unknown[] };
        return { sql: raw.sql, values: raw.values };
    };
    return {
        $queryRaw: async <T>(...args: any[]): Promise<T> => {
            const { sql, values } = run(args[0] as Prisma.Sql);
            return db.prepare(sql).all(...(values as never[])) as unknown as T;
        },
        $executeRaw: async (...args: any[]): Promise<number> => {
            const { sql, values } = run(args[0] as Prisma.Sql);
            const info = db.prepare(sql).run(...(values as never[]));
            return Number(info.changes);
        }
    };
}

describe('P4 SLA per zespół/user', () => {
    it('fallback do globalnych bez wierszy zakresowych', async () => {
        const db = freshDb();
        try {
            const f = fake(db);
            expect(await getEffectiveSla(f, PRO, 'team')).toEqual({
                firstContactH: 24,
                staleD: 7,
                escalationH: 72,
                source: 'global'
            });
            expect((await getEffectiveSla(f, U1, 'mine')).source).toBe('global');
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

    it('team wygrywa dla scope=team, mine go ignoruje; izolacja zespołów', async () => {
        const db = freshDb();
        try {
            const f = fake(db);
            await setScopedSla(f, {
                scopeType: 'team',
                scopeId: 'p1',
                firstContactH: 12,
                staleD: 3,
                escalationH: 36,
                updatedBy: 'p1',
                nowIso: NOW
            });
            expect(await getEffectiveSla(f, PRO, 'team')).toEqual({
                firstContactH: 12,
                staleD: 3,
                escalationH: 36,
                source: 'team'
            });
            // Scope mine nie widzi progu zespołu.
            expect((await getEffectiveSla(f, PRO, 'mine')).source).toBe('global');
            // Obcy zespół nie widzi cudzego progu.
            const other: CareUser = { id: 'p9', role: 'pro', subUsers: [] };
            expect((await getEffectiveSla(f, other, 'team')).source).toBe('global');
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

    it('user overwrites dla mine + upsert nadpisuje', async () => {
        const db = freshDb();
        try {
            const f = fake(db);
            await setScopedSla(f, {
                scopeType: 'user',
                scopeId: 'u1',
                firstContactH: 6,
                staleD: 2,
                escalationH: 24,
                updatedBy: 'u1',
                nowIso: NOW
            });
            expect(await getEffectiveSla(f, U1, 'mine')).toEqual({
                firstContactH: 6,
                staleD: 2,
                escalationH: 24,
                source: 'user'
            });
            await setScopedSla(f, {
                scopeType: 'user',
                scopeId: 'u1',
                firstContactH: 8,
                staleD: 2,
                escalationH: 24,
                updatedBy: 'u1',
                nowIso: NOW
            });
            expect((await getEffectiveSla(f, U1, 'mine')).firstContactH).toBe(8);
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

    it('etag obejmuje tabelę zakresów', async () => {
        const db = freshDb();
        try {
            const f = fake(db);
            const before = await getCareEtagInput(f, 'u1');
            await setScopedSla(f, {
                scopeType: 'team',
                scopeId: 'p1',
                firstContactH: 12,
                staleD: 3,
                escalationH: 36,
                updatedBy: 'p1',
                nowIso: NOW
            });
            const after = await getCareEtagInput(f, 'u1');
            expect(after).not.toEqual(before);
            expect(after[8]).toBe(NOW);
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

describe('P4 fallback user+team i szczelnosc team-row', () => {
    it('user ze scope team -> global 24/7/72 (team tylko pro/admin)', async () => {
        const db = freshDb();
        try {
            const f = fake(db);
            expect(await getEffectiveSla(f, U1, 'team')).toEqual({
                firstContactH: 24,
                staleD: 7,
                escalationH: 72,
                source: 'global'
            });
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

    it('team-row p1 nie wycieka: czlonek zespolu i obcy pro -> global 24/7/72', async () => {
        const db = freshDb();
        try {
            const f = fake(db);
            await setScopedSla(f, {
                scopeType: 'team',
                scopeId: 'p1',
                firstContactH: 12,
                staleD: 3,
                escalationH: 36,
                updatedBy: 'p1',
                nowIso: NOW
            });
            // u1 jest w subUsers p1, ale scope team dla roli user zawsze spada do global.
            expect(await getEffectiveSla(f, U1, 'team')).toEqual({
                firstContactH: 24,
                staleD: 7,
                escalationH: 72,
                source: 'global'
            });
            const other: CareUser = { id: 'p9', role: 'pro', subUsers: [] };
            expect(await getEffectiveSla(f, other, 'team')).toEqual({
                firstContactH: 24,
                staleD: 7,
                escalationH: 72,
                source: 'global'
            });
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

    it('opt-lock: przestarzały expectedUpdatedAt → 409, świeży → 200', async () => {
        const db = freshDb();
        try {
            const f = fake(db);
            await setScopedSla(f, {
                scopeType: 'team',
                scopeId: 'p1',
                firstContactH: 12,
                staleD: 3,
                escalationH: 36,
                updatedBy: 'p1',
                nowIso: NOW
            });
            const v1 = await getSlaUpdatedAt(f, PRO, 'team');
            expect(v1).toBe(NOW);
            // Podmiana cudzą decyzją (nowszy updatedAt).
            db.prepare(
                'UPDATE "care_sla_scopes" SET "firstContactH" = ?, "updatedAt" = ? WHERE "scopeType" = ? AND "scopeId" = ?'
            ).run(10, '2026-10-11T00:00:00.000Z', 'team', 'p1');
            await expect(
                setScopedSla(f, {
                    scopeType: 'team',
                    scopeId: 'p1',
                    firstContactH: 12,
                    staleD: 3,
                    escalationH: 36,
                    updatedBy: 'p1',
                    nowIso: '2026-10-12T00:00:00.000Z',
                    expectedUpdatedAt: v1
                })
            ).rejects.toMatchObject({ status: 409, code: 'CARE_STATE_CONFLICT' });
            // Świeża wersja przechodzi i podbija znacznik.
            const next = await setScopedSla(f, {
                scopeType: 'team',
                scopeId: 'p1',
                firstContactH: 9,
                staleD: 3,
                escalationH: 36,
                updatedBy: 'p1',
                nowIso: '2026-10-12T00:00:00.000Z',
                expectedUpdatedAt: '2026-10-11T00:00:00.000Z'
            });
            expect(next.firstContactH).toBe(9);
            expect(await getSlaUpdatedAt(f, PRO, 'team')).toBe('2026-10-12T00:00:00.000Z');
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

    it('opt-lock: blind create bez wiersza przechodzi, z expected → 409', async () => {
        const db = freshDb();
        try {
            const f = fake(db);
            expect(await getSlaUpdatedAt(f, U1, 'mine')).toBeNull();
            await expect(
                setScopedSla(f, {
                    scopeType: 'user',
                    scopeId: 'u1',
                    firstContactH: 6,
                    staleD: 2,
                    escalationH: 24,
                    updatedBy: 'u1',
                    nowIso: NOW,
                    expectedUpdatedAt: NOW
                })
            ).rejects.toMatchObject({ status: 409 });
            const created = await setScopedSla(f, {
                scopeType: 'user',
                scopeId: 'u1',
                firstContactH: 6,
                staleD: 2,
                escalationH: 24,
                updatedBy: 'u1',
                nowIso: NOW
            });
            expect(created.firstContactH).toBe(6);
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

    it('opt-lock global: stale → 409 (setSlaConfig)', async () => {
        const db = freshDb();
        try {
            const f = fake(db);
            await setSlaConfig(f, {
                firstContactH: 24,
                staleD: 7,
                escalationH: 72,
                updatedBy: 'a',
                nowIso: NOW
            });
            await expect(
                setSlaConfig(f, {
                    firstContactH: 20,
                    staleD: 7,
                    escalationH: 72,
                    updatedBy: 'a',
                    nowIso: '2026-10-12T00:00:00.000Z',
                    expectedUpdatedAt: '2000-01-01T00:00:00.000Z'
                })
            ).rejects.toMatchObject({ status: 409, code: 'CARE_STATE_CONFLICT' });
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
