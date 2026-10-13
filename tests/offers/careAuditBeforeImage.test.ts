/*
 * tests/offers/careAuditBeforeImage.test.ts
 * F6: audyt musi nieść oldData = before-image sprzed write (snooze/done/reopen).
 * REGRESSION PROOF: RED na starym kodzie (prev po write), GREEN po fixie (prev przed write).
 */
import request from 'supertest';
import express from 'express';

jest.mock('../../src/middleware/auth', () => ({
    requireAuth: (req: any, _res: any, next: any) => {
        req.user = { id: 'u1', role: 'user', subUsers: [] };
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
    canWriteDoc: jest.fn(() => true),
    canReadWithShare: jest.fn(() => false)
}));

jest.mock('../../src/utils/idempotency', () => ({
    claimIdempotencyKey: jest.fn(async () => ({ action: 'proceed' })),
    completeIdempotencyKey: jest.fn(async () => undefined),
    idempotencyKeyFrom: jest.fn(() => null)
}));

const auditCreate = jest.fn();
const PRE_IMAGE = { snoozedUntil: '2026-10-20T00:00:00.000Z', doneAt: null };

/** Jak w followUpCareRoutes: route wymaga snoozedUntil w (now, now+28d]. */
const futureIso = (days: number): string => new Date(Date.now() + days * 86400000).toISOString();

jest.mock('../../src/services/careService', () => {
    const actual = jest.requireActual('../../src/services/careService');
    return {
        ...actual,
        // Stanowy stub: get czyta bieżący stan, set/clear mutują — weryfikuje KOLEJNOŚĆ
        // odczytu prev względem write (stary kod: set→get = post-image = RED).
        getCareState: jest.fn(async () => ({ ...((globalThis as any).__careStored ?? {}) })),
        setCareState: jest.fn(async (_tx: unknown, args: any) => {
            (globalThis as any).__careStored = {
                snoozedUntil: args.snoozedUntil ?? null,
                doneAt: args.doneAt ?? null
            };
            return {};
        }),
        clearCareState: jest.fn(async () => {
            (globalThis as any).__careStored = null;
            return {};
        }),
        getSlaConfig: jest.fn(async () => ({ firstContactH: 24, staleD: 7, escalationH: 72 }))
    };
});

jest.mock('../../src/prismaClient', () => ({
    __esModule: true,
    default: {
        offers_rel: {
            findUnique: jest.fn(async ({ where }: any) => ({ id: where.id, userId: 'u1' }))
        },
        offers_studnie_rel: {
            findUnique: jest.fn(async ({ where }: any) => ({ id: where.id, userId: 'u1' }))
        },
        $queryRaw: jest.fn(async () => [] as never),
        $transaction: jest.fn(async (fn: any) =>
            fn({
                audit_logs: { create: auditCreate },
                care_states: {},
                offers_rel: {
                    findUnique: jest.fn(async ({ where }: any) => ({ id: where.id, userId: 'u1' }))
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

describe('F6 audyt before-image', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        (globalThis as any).__careStored = { ...PRE_IMAGE };
    });

    it('done niesie oldData sprzed write', async () => {
        const res = await request(app()).post('/api/care/rury/o1/done').send({});
        expect(res.status).toBe(200);
        expect(auditCreate).toHaveBeenCalled();
        const arg = auditCreate.mock.calls[auditCreate.mock.calls.length - 1][0];
        expect(arg.data.action).toBe('done');
        expect(JSON.parse(arg.data.oldData)).toMatchObject({
            snoozedUntil: PRE_IMAGE.snoozedUntil
        });
        expect(arg.data.oldData).not.toBe(arg.data.newData);
    });

    it('snooze niesie oldData sprzed write', async () => {
        const res = await request(app())
            .post('/api/care/rury/o1/snooze')
            .send({ snoozedUntil: futureIso(3) });
        expect(res.status).toBe(200);
        const arg = auditCreate.mock.calls[auditCreate.mock.calls.length - 1][0];
        expect(arg.data.action).toBe('snooze');
        expect(JSON.parse(arg.data.oldData)).toMatchObject({
            snoozedUntil: PRE_IMAGE.snoozedUntil
        });
    });
});
