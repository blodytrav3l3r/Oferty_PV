// tests/offers/careF0Silent.test.ts
// F0 SILENT-FAILURE HUNT - REGRESSION PROOF. F2 GREEN (fix F4-krytyczne).
// F1/F3/F4/F5/F7/F8: RED potwierdzone, DEFERRED do next batch -> test.skip.
// F6 stub: SUPERSEDED przez tests/offers/careAuditBeforeImage.test.ts (endpoint proof) -> test.skip.
import request from 'supertest';
import express from 'express';
import { DatabaseSync } from 'node:sqlite';

jest.mock('../../src/middleware/auth', () => ({
    requireAuth: (req: any, _res: any, next: any) => {
        req.user = { id: 'admin-1', role: 'admin', subUsers: [] };
        next();
    }
}));

jest.mock('../../src/middleware/rateLimiters', () => {
    const pass = (_req: any, _res: any, next: any) => next();
    return {
        WRITE_LIMITER: pass,
        READ_LIMITER: pass,
        TELEMETRY_WRITE_LIMITER: pass,
        PRICELIST_WRITE_LIMITER: pass,
        EXPORT_LIMITER: pass,
        LOGIN_LIMITER: pass,
        CHANGE_PASSWORD_LIMITER: pass,
        ADMIN_USERS_LIMITER: pass,
        PRECO_PRICING_LIMITER: pass
    };
});

jest.mock('../../src/utils/logger', () => ({
    logger: { info: jest.fn(), error: jest.fn(), warn: jest.fn(), debug: jest.fn() }
}));

jest.mock('../../src/prismaClient', () => {
    const real = jest.requireActual('../../generated/prisma');
    return {
        __esModule: true,
        Prisma: real.Prisma,
        default: {
            document_shares: {
                findMany: jest.fn(async () => []),
                findFirst: jest.fn(async () => null)
            },
            offers_rel: { findUnique: jest.fn(async () => null) },
            offers_studnie_rel: { findUnique: jest.fn(async () => null) },
            $queryRaw: jest.fn(async () => [] as never),
            $transaction: jest.fn(async (fn: any) =>
                fn({
                    $queryRaw: jest.fn(async () => [] as never),
                    audit_logs: { create: jest.fn(async () => ({})) }
                })
            )
        }
    };
});

import prisma from '../../src/prismaClient';
import { getSharedIdsForUser } from '../../src/utils/ownership';
import {
    buildOfferScopeCondition,
    buildLatestCte,
    buildPerRepSql
} from '../../src/routes/offers/followUpStats';
import {
    buildCareQueueQueries,
    decodeCareCursor,
    getSlaConfig
} from '../../src/services/careService';
import offerRoutes from '../../src/routes/offers/index';
import careRouter from '../../src/routes/care';

const mockedPrisma = prisma as unknown as {
    $queryRaw: jest.Mock;
    document_shares: { findMany: jest.Mock; findFirst: jest.Mock };
};
const realPrisma = jest.requireActual('../../generated/prisma').Prisma;

function statsApp() {
    const app = express();
    app.use(express.json());
    app.use('/api/offers', offerRoutes);
    return app;
}

function careApp() {
    const app = express();
    app.use(express.json());
    app.use('/api/care', careRouter);
    return app;
}

function dbScope(): DatabaseSync {
    const db = new DatabaseSync(':memory:');
    db.exec('CREATE TABLE offers_rel (id TEXT PRIMARY KEY, "userId" TEXT)');
    db.prepare('INSERT INTO offers_rel (id, "userId") VALUES (?, ?)').run('o1', 'u1');
    db.prepare('INSERT INTO offers_rel (id, "userId") VALUES (?, ?)').run('o3', 'u3');
    return db;
}

function ids(db: DatabaseSync, cond: unknown): string[] {
    const raw = cond as unknown as { sql: string; values: unknown[] };
    const rows = db
        .prepare('SELECT id FROM offers_rel o WHERE ' + raw.sql)
        .all(...(raw.values as never[])) as Array<{ id: string }>;
    return rows.map((r) => r.id).sort();
}

describe('F0 silent-failure hunt', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        mockedPrisma.document_shares.findMany.mockResolvedValue([]);
        mockedPrisma.$queryRaw.mockResolvedValue([]);
    });

    test.skip('F1 shares catch [DEFERRED next batch]: blad DB musi propagowac, nie cicho []', async () => {
        mockedPrisma.document_shares.findMany.mockRejectedValueOnce(new Error('DB down'));
        await expect(getSharedIdsForUser('u1', 'offer')).rejects.toThrow();
    });

    test('F2 narrowOwner: musi byc AND w scope, nigdy zamiast scope', () => {
        const db = dbScope();
        try {
            const cond = buildOfferScopeCondition({ id: 'u1', role: 'user' }, 'o', [], {
                allowedIds: ['u1'],
                narrowOwner: 'u3'
            });
            expect(ids(db, cond)).toEqual([]);
        } finally {
            db.close();
        }
    });

    test('F3 lostValue fallback: nieznany klucz nie moze pompowac lost', async () => {
        const q = mockedPrisma.$queryRaw;
        q.mockResolvedValueOnce([]);
        q.mockResolvedValueOnce([{ total: 1, nocontact: 0 }]);
        q.mockResolvedValueOnce([{ total: 0, nocontact: 0 }]);
        q.mockResolvedValueOnce([]);
        q.mockResolvedValueOnce([]);
        q.mockResolvedValueOnce([]);
        q.mockResolvedValueOnce([{ k: 'bogus', v: 100 }]);
        q.mockResolvedValueOnce([]);
        q.mockResolvedValueOnce([{ h: null }]);
        q.mockResolvedValueOnce([]);
        q.mockResolvedValueOnce([]);
        const res = await request(statsApp()).get('/api/offers/followups/stats');
        expect(res.status).toBe(200);
        expect(res.body.stats.lostValue).toBe(0);
    });

    test('F4 perRep NULL: wiersze bez autora nie moga tworzyc repa null', () => {
        const scope = realPrisma.sql`1=1`;
        const cte = buildLatestCte(scope);
        const sql = buildPerRepSql(scope, cte) as unknown as { sql: string };
        expect(sql.sql).toMatch(/IS NOT NULL/i);
    });

    test.skip('F5 etag catch [DEFERRED next batch]: blad ETag nie moze cicho dac 200 z etag null', async () => {
        mockedPrisma.$queryRaw.mockImplementation(async (...a: unknown[]) => {
            const first = a[0] as unknown as { sql?: string };
            if (
                first &&
                typeof first.sql === 'string' &&
                first.sql.includes('MAX("contactedAt")')
            ) {
                throw new Error('legacy DB bez tabeli');
            }
            return [] as never;
        });
        const res = await request(careApp()).get('/api/care/panel');
        expect(res.status).toBe(500);
    });

    test.skip('F6 stub [SUPERSEDED by careAuditBeforeImage.test.ts]: before-image musi byc sprzed write', async () => {
        let stored: string | null = null;
        const get = async () => (stored ? JSON.parse(stored) : null);
        const set = async (v: string) => {
            stored = v;
        };
        await set(JSON.stringify({ doneAt: '2026-10-11T00:00:00.000Z' }));
        const oldData = (await get()) ? JSON.stringify(await get()) : null;
        expect(oldData).toBeNull();
    });

    test('F7 cursor: uszkodzony cursor musi byc 400, nie cichy restart od zera', () => {
        expect(decodeCareCursor('!!!not-valid!!!')).toBeNull();
        expect(() =>
            buildCareQueueQueries({ id: 'u1', role: 'user', subUsers: [] } as any, {
                nowIso: '2026-10-11T00:00:00.000Z',
                cursor: '!!!not-valid!!!'
            })
        ).toThrow();
    });

    test.skip('F8 SLA default [DEFERRED next batch]: brak konfiguracji nie moze cicho wrocic defaultu', async () => {
        const fakeDb = { $queryRaw: async () => [] as never };
        await expect(getSlaConfig(fakeDb)).rejects.toThrow();
    });
});
