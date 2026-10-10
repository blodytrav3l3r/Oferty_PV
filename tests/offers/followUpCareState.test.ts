/*
 * tests/offers/followUpCareState.test.ts
 * P1: stan pilnowania (snooze/done rozłączne) + SLA default/upsert.
 */
import { DatabaseSync } from 'node:sqlite';
import type { Prisma } from '../../generated/prisma';
import {
    getCareState,
    setCareState,
    clearCareState,
    getSlaConfig,
    setSlaConfig,
    DEFAULT_SLA
} from '../../src/services/careService';

const NOW = '2026-10-10T12:00:00.000Z';

function freshDb(): DatabaseSync {
    const db = new DatabaseSync(':memory:');
    db.exec(`CREATE TABLE care_states ("offerKind" TEXT NOT NULL, "offerId" TEXT NOT NULL,
        "snoozedUntil" TEXT, "doneAt" TEXT, "updatedBy" TEXT, "updatedAt" TEXT NOT NULL,
        CONSTRAINT "care_states_pkey" PRIMARY KEY ("offerKind", "offerId"));
        CREATE TABLE care_sla_config ("id" TEXT NOT NULL, "firstContactH" INTEGER NOT NULL DEFAULT 24,
        "staleD" INTEGER NOT NULL DEFAULT 7, "escalationH" INTEGER NOT NULL DEFAULT 72,
        "updatedBy" TEXT, "updatedAt" TEXT,
        CONSTRAINT "care_sla_config_pkey" PRIMARY KEY ("id"));`);
    return db;
}

function fake(db: DatabaseSync) {
    return {
        $queryRaw: async <T>(...args: any[]): Promise<T> => {
            const q = args[0] as Prisma.Sql;
            const raw = q as unknown as { sql: string; values: unknown[] };
            return db.prepare(raw.sql).all(...(raw.values as never[])) as unknown as T;
        },

        $executeRaw: async (...args: any[]): Promise<number> => {
            const q = args[0] as Prisma.Sql;
            const raw = q as unknown as { sql: string; values: unknown[] };
            const r = db.prepare(raw.sql).run(...(raw.values as never[]));
            return Number(r.changes);
        }
    };
}

describe('P1 care state', () => {
    it('snooze i done rozłączne (upsert czyści drugie)', async () => {
        const db = freshDb();
        try {
            const f = fake(db);
            await setCareState(f, {
                offerKind: 'rury',
                offerId: 'o1',
                snoozedUntil: '2026-10-12T00:00:00.000Z',
                doneAt: null,
                updatedBy: 'u1',
                nowIso: NOW
            });
            let s = await getCareState(f, 'rury', 'o1');
            expect(s?.snoozedUntil).toBe('2026-10-12T00:00:00.000Z');
            expect(s?.doneAt).toBeNull();
            await setCareState(f, {
                offerKind: 'rury',
                offerId: 'o1',
                snoozedUntil: null,
                doneAt: NOW,
                updatedBy: 'u1',
                nowIso: NOW
            });
            s = await getCareState(f, 'rury', 'o1');
            expect(s?.doneAt).toBe(NOW);
            expect(s?.snoozedUntil).toBeNull();
            await clearCareState(f, 'rury', 'o1');
            expect(await getCareState(f, 'rury', 'o1')).toBeNull();
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

    it('opt-lock: nieaktualne expectedUpdatedAt → 409, świeże przechodzi', async () => {
        const db = freshDb();
        try {
            const f = fake(db);
            const s1 = await setCareState(f, {
                offerKind: 'rury',
                offerId: 'o1',
                snoozedUntil: '2026-10-12T00:00:00.000Z',
                doneAt: null,
                updatedBy: 'u1',
                nowIso: NOW
            });
            await expect(
                setCareState(f, {
                    offerKind: 'rury',
                    offerId: 'o1',
                    snoozedUntil: null,
                    doneAt: NOW,
                    updatedBy: 'u2',
                    nowIso: NOW,
                    expectedUpdatedAt: '2000-01-01T00:00:00.000Z'
                })
            ).rejects.toMatchObject({ status: 409 });
            // Przegrany nie nadpisał.
            expect((await getCareState(f, 'rury', 'o1'))?.updatedBy).toBe('u1');
            const s2 = await setCareState(f, {
                offerKind: 'rury',
                offerId: 'o1',
                snoozedUntil: null,
                doneAt: NOW,
                updatedBy: 'u2',
                nowIso: NOW,
                expectedUpdatedAt: s1.updatedAt
            });
            expect(s2.doneAt).toBe(NOW);
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

    it('SLA: default bez wiersza, upsert zapisuje', async () => {
        const db = freshDb();
        try {
            const f = fake(db);
            expect(await getSlaConfig(f)).toEqual(DEFAULT_SLA);
            await setSlaConfig(f, {
                firstContactH: 48,
                staleD: 10,
                escalationH: 96,
                updatedBy: 'admin',
                nowIso: NOW
            });
            expect(await getSlaConfig(f)).toEqual({
                firstContactH: 48,
                staleD: 10,
                escalationH: 96
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
});
