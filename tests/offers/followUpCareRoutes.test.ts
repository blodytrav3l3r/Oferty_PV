/*
 * tests/offers/followUpCareRoutes.test.ts
 * P1 routes: guardy 403/404/400 + SLA tylko admin (bez DB).
 */
import request from 'supertest';
import express from 'express';

jest.mock('../../src/middleware/auth', () => ({
    requireAuth: (req: any, _res: any, next: any) => {
        req.user = (globalThis as any).__careUser ?? { id: 'u1', role: 'user', subUsers: [] };
        next();
    }
}));

jest.mock('../../src/middleware/rateLimiters', () => ({
    WRITE_LIMITER: (_req: any, _res: any, next: any) => next()
}));

jest.mock('../../src/utils/logger', () => ({
    logger: { info: jest.fn(), error: jest.fn(), warn: jest.fn(), debug: jest.fn() }
}));

jest.mock('../../src/utils/ownership', () => ({
    canWriteDoc: jest.fn((_user: any, ownerId: string) => ownerId === 'u1'),
    canReadWithShare: jest.fn(() => false)
}));

jest.mock('../../src/utils/idempotency', () => ({
    claimIdempotencyKey: jest.fn(async () => ({ action: 'proceed' })),
    completeIdempotencyKey: jest.fn(async () => undefined),
    idempotencyKeyFrom: jest.fn(() => null)
}));

const auditCreate = jest.fn();
const stateUpsert = jest.fn();
const stateDelete = jest.fn();

jest.mock('../../src/services/careService', () => {
    const actual = jest.requireActual('../../src/services/careService');
    return {
        ...actual,
        getCareState: jest.fn(async () => null),
        setCareState: (...a: unknown[]) => stateUpsert(...a),
        clearCareState: (...a: unknown[]) => stateDelete(...a),
        getSlaConfig: jest.fn(async () => ({ firstContactH: 24, staleD: 7, escalationH: 72 })),
        setSlaConfig: jest.fn(async (_db: unknown, cfg: any) => ({
            firstContactH: cfg.firstContactH,
            staleD: cfg.staleD,
            escalationH: cfg.escalationH
        }))
    };
});

jest.mock('../../src/prismaClient', () => ({
    __esModule: true,
    default: {
        offers_rel: {
            findUnique: jest.fn(async ({ where }: any) =>
                where.id === 'nope'
                    ? null
                    : { id: where.id, userId: where.id === 'cudza' ? 'u9' : 'u1' }
            )
        },
        offers_studnie_rel: {
            findUnique: jest.fn(async ({ where }: any) => ({ id: where.id, userId: 'u1' }))
        },
        $transaction: jest.fn(async (fn: any) =>
            fn({ audit_logs: { create: auditCreate }, care_states: {} })
        )
    }
}));

// eslint-disable-next-line @typescript-eslint/no-require-imports
const careRoutes = require('../../src/routes/care').default;

function app() {
    const a = express();
    a.use(express.json());
    a.use('/api/care', careRoutes);
    return a;
}

describe('P1 care routes guardy', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        (globalThis as any).__careUser = { id: 'u1', role: 'user', subUsers: [] };
    });

    it('snooze cudzej oferty → 403', async () => {
        const res = await request(app())
            .post('/api/care/rury/cudza/snooze')
            .send({ snoozedUntil: '2026-10-12T00:00:00.000Z' });
        expect(res.status).toBe(403);
    });

    it('snooze nieistniejącej → 404', async () => {
        const res = await request(app())
            .post('/api/care/rury/nope/snooze')
            .send({ snoozedUntil: '2026-10-12T00:00:00.000Z' });
        expect(res.status).toBe(404);
    });

    it('snooze złą datą / przeszłością → 400', async () => {
        const bad = await request(app())
            .post('/api/care/rury/o1/snooze')
            .send({ snoozedUntil: '10/10/2026' });
        expect(bad.status).toBe(400);
        const past = await request(app())
            .post('/api/care/rury/o1/snooze')
            .send({ snoozedUntil: '2020-01-01T00:00:00.000Z' });
        expect(past.status).toBe(400);
    });

    it('snooze >14d → 400', async () => {
        const res = await request(app())
            .post('/api/care/rury/o1/snooze')
            .send({ snoozedUntil: '2026-12-01T00:00:00.000Z' });
        expect(res.status).toBe(400);
    });

    it('PUT sla nie-admin → 403, admin OK', async () => {
        const denied = await request(app())
            .put('/api/care/sla')
            .send({ firstContactH: 48, staleD: 10, escalationH: 96 });
        expect(denied.status).toBe(403);
        (globalThis as any).__careUser = { id: 'admin', role: 'admin', subUsers: [] };
        const ok = await request(app())
            .put('/api/care/sla')
            .send({ firstContactH: 48, staleD: 10, escalationH: 96 });
        expect(ok.status).toBe(200);
        expect(ok.body.sla.firstContactH).toBe(48);
    });
});
