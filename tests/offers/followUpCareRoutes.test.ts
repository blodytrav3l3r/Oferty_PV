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
    WRITE_LIMITER: (_req: any, _res: any, next: any) => next(),
    READ_LIMITER: (_req: any, _res: any, next: any) => next()
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
const scopedSlaUpsert = jest.fn();
const effectiveSlaMock = jest.fn();
const stateDelete = jest.fn();

/** Daty wzgledem realnego now (route waliduje snoozedUntil w (now, now+28d]).
 * Sztywne daty gniły — testy HTTP przechodzily wczoraj, dziś 400. */
const futureIso = (days: number): string => new Date(Date.now() + days * 86400000).toISOString();

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
        })),
        setScopedSla: (...a: unknown[]) => scopedSlaUpsert(...a),
        getEffectiveSla: (...a: unknown[]) => effectiveSlaMock(...a),
        getSlaUpdatedAt: jest.fn(async () => null)
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
            fn({
                audit_logs: { create: auditCreate },
                care_states: {},
                offers_rel: {
                    findUnique: jest.fn(async ({ where }: any) =>
                        where.id === 'nope' || (globalThis as any).__txGone === where.id
                            ? null
                            : {
                                  id: where.id,
                                  userId:
                                      (globalThis as any).__txOwner?.[where.id] ??
                                      (where.id === 'cudza' ? 'u9' : 'u1')
                              }
                    )
                },
                offers_studnie_rel: {
                    findUnique: jest.fn(async ({ where }: any) => ({ id: where.id, userId: 'u1' }))
                }
            })
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
            .send({ snoozedUntil: futureIso(3) });
        expect(res.status).toBe(403);
    });

    it('snooze nieistniejącej → 404', async () => {
        const res = await request(app())
            .post('/api/care/rury/nope/snooze')
            .send({ snoozedUntil: futureIso(3) });
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

    it('snooze >28d → 400, 28d przechodzi', async () => {
        const res = await request(app())
            .post('/api/care/rury/o1/snooze')
            .send({ snoozedUntil: futureIso(30) });
        expect(res.status).toBe(400);
        const ok = await request(app())
            .post('/api/care/rury/o1/snooze')
            .send({ snoozedUntil: futureIso(28) });
        expect(ok.status).toBe(200);
    });

    it('TOCTOU: właściciel zmieniony w tx → 403, brak zapisu', async () => {
        (globalThis as any).__txOwner = { o1: 'u9' };
        try {
            const res = await request(app())
                .post('/api/care/rury/o1/snooze')
                .send({ snoozedUntil: futureIso(3) });
            expect(res.status).toBe(403);
            expect(stateUpsert).not.toHaveBeenCalled();
        } finally {
            delete (globalThis as any).__txOwner;
        }
    });

    it('TOCTOU: oferta zniknęła w tx → 404', async () => {
        (globalThis as any).__txGone = 'o1';
        try {
            const res = await request(app()).post('/api/care/rury/o1/done').send({});
            expect(res.status).toBe(404);
        } finally {
            delete (globalThis as any).__txGone;
        }
    });

    it('audyt niesie oldData (before-image stanu)', async () => {
        await request(app()).post('/api/care/rury/o1/done').send({});
        expect(auditCreate).toHaveBeenCalled();
        const arg = auditCreate.mock.calls[auditCreate.mock.calls.length - 1][0];
        expect(arg.data.entityType).toBe('care_state');
        expect('oldData' in arg.data).toBe(true);
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

    it('PUT sla scope: user dla siebie OK, team dla user → 403, pro team OK', async () => {
        scopedSlaUpsert.mockResolvedValue({ firstContactH: 12, staleD: 3, escalationH: 36 });
        const mine = await request(app())
            .put('/api/care/sla')
            .send({ firstContactH: 12, staleD: 3, escalationH: 36, scopeType: 'user' });
        expect(mine.status).toBe(200);
        expect(mine.body.scopeType).toBe('user');
        expect(scopedSlaUpsert).toHaveBeenCalledWith(
            expect.anything(),
            expect.objectContaining({ scopeType: 'user', scopeId: 'u1' })
        );
        const teamDenied = await request(app())
            .put('/api/care/sla')
            .send({ firstContactH: 12, staleD: 3, escalationH: 36, scopeType: 'team' });
        expect(teamDenied.status).toBe(403);
        (globalThis as any).__careUser = { id: 'p1', role: 'pro', subUsers: ['u1'] };
        const teamOk = await request(app())
            .put('/api/care/sla')
            .send({ firstContactH: 12, staleD: 3, escalationH: 36, scopeType: 'team' });
        expect(teamOk.status).toBe(200);
        expect(scopedSlaUpsert).toHaveBeenCalledWith(
            expect.anything(),
            expect.objectContaining({ scopeType: 'team', scopeId: 'p1' })
        );
    });

    it('GET sla zwraca source (global/team/user)', async () => {
        effectiveSlaMock.mockResolvedValue({
            firstContactH: 24,
            staleD: 7,
            escalationH: 72,
            source: 'global'
        });
        const res = await request(app()).get('/api/care/sla?scope=mine');
        expect(res.status).toBe(200);
        expect(res.body.source).toBe('global');
        expect(effectiveSlaMock).toHaveBeenCalledWith(
            expect.anything(),
            expect.objectContaining({ id: 'u1' }),
            'mine'
        );
    });

    it('PUT sla ze starym expectedUpdatedAt → 409', async () => {
        (globalThis as any).__careUser = { id: 'admin', role: 'admin', subUsers: [] };
        try {
            scopedSlaUpsert.mockRejectedValueOnce(
                Object.assign(new Error('Progi zmienione przez kogoś innego'), {
                    status: 409,
                    code: 'CARE_STATE_CONFLICT'
                })
            );
            const res = await request(app()).put('/api/care/sla').send({
                firstContactH: 12,
                staleD: 3,
                escalationH: 36,
                scopeType: 'team',
                expectedUpdatedAt: '2020-01-01T00:00:00.000Z'
            });
            expect(res.status).toBe(409);
            expect(res.body.error).toBe('Progi zmienione przez kogoś innego');
        } finally {
            (globalThis as any).__careUser = { id: 'u1', role: 'user', subUsers: [] };
        }
    });

    it('reopen niesie expectedUpdatedAt do clearCareState; zły format → 400', async () => {
        const ok = await request(app())
            .post('/api/care/rury/o1/reopen')
            .send({ expectedUpdatedAt: '2026-10-09T00:00:00.000Z' });
        expect(ok.status).toBe(200);
        expect(stateDelete).toHaveBeenCalled();
        const args = stateDelete.mock.calls[stateDelete.mock.calls.length - 1] as unknown[];
        expect(args[3]).toBe('2026-10-09T00:00:00.000Z');
        stateDelete.mockClear();
        const bare = await request(app()).post('/api/care/rury/o1/reopen').send({});
        expect(bare.status).toBe(200);
        expect((stateDelete.mock.calls[0] as unknown[])[3]).toBeUndefined();
        const bad = await request(app())
            .post('/api/care/rury/o1/reopen')
            .send({ expectedUpdatedAt: 123 });
        expect(bad.status).toBe(400);
    });

    it('snooze z przestarzałym expectedUpdatedAt → 409', async () => {
        stateUpsert.mockRejectedValueOnce(
            Object.assign(new Error('Stan zmieniony przez kogoś innego'), {
                status: 409,
                code: 'CARE_STATE_CONFLICT'
            })
        );
        const res = await request(app())
            .post('/api/care/rury/o1/snooze')
            .send({
                snoozedUntil: futureIso(3),
                expectedUpdatedAt: '2026-10-09T00:00:00.000Z'
            });
        expect(res.status).toBe(409);
        expect(res.body.error).toBe('Stan zmieniony przez kogoś innego');
    });
});
