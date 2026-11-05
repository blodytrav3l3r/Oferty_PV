// tests/offers/careF0Silent.test.ts
// F0 SILENT-FAILURE HUNT - REGRESSION PROOF. F2 GREEN (fix F4-krytyczne).
// F1/F3/F4/F5/F7/F8: regression contracts; F6 endpoint proof lives in careAuditBeforeImage.test.ts.
import request from 'supertest';
import express from 'express';

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
    const real = jest.requireActual('../../generated/prisma-postgres/client');
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
const realPrisma = jest.requireActual('../../generated/prisma-postgres/client').Prisma;

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

describe('F0 silent-failure hunt', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        mockedPrisma.document_shares.findMany.mockResolvedValue([]);
        mockedPrisma.$queryRaw.mockResolvedValue([]);
    });

    test('F1 shares catch [F1-500]: blad DB propaguje jako 500, nie cicho []', async () => {
        mockedPrisma.document_shares.findMany.mockRejectedValueOnce(new Error('DB down'));
        await expect(getSharedIdsForUser('u1', 'offer')).rejects.toThrow();
    });

    test('F2 narrowOwner: musi byc AND w scope, nigdy zamiast scope', () => {
        const cond = buildOfferScopeCondition({ id: 'u1', role: 'user' }, 'o', [], {
            allowedIds: ['u1'],
            narrowOwner: 'u3'
        }) as unknown as { sql: string; values: unknown[] };
        expect(cond.sql).toMatch(/\(.*"userId" IN \(.*\).*AND.*"userId" =/is);
        expect(cond.values).toEqual(['u1', 'u3']);
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

    test('F5 awaria pomocniczego ETag nie blokuje pobrania panelu', async () => {
        mockedPrisma.$queryRaw.mockImplementation(async (...a: unknown[]) => {
            const first = a[0] as unknown as { sql?: string };
            if (
                first &&
                typeof first.sql === 'string' &&
                first.sql.includes('(SELECT MAX("contactedAt")')
            ) {
                throw new Error('legacy DB bez tabeli');
            }
            return [] as never;
        });
        const res = await request(careApp()).get('/api/care/panel');
        expect(res.status).toBe(200);
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

    test('F8 SLA [F8-strict]: brak wiersza = default, uszkodzony wiersz = throw', async () => {
        const emptyDb = { $queryRaw: async () => [] as never };
        await expect(getSlaConfig(emptyDb)).resolves.toEqual({
            firstContactH: 24,
            staleD: 7,
            escalationH: 72
        });
        const corruptDb = {
            $queryRaw: async () => [{ firstContactH: 0, staleD: 'x', escalationH: null }] as never
        };
        await expect(getSlaConfig(corruptDb)).rejects.toThrow('Nieprawidłowa konfiguracja SLA');
    });
});
