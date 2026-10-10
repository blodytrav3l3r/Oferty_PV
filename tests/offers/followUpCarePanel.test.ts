/*
 * tests/offers/followUpCarePanel.test.ts
 * P2 planu poprawy: GET /api/care/panel — pakiet w 1 requeście + ETag/304.
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

const etagMock = jest.fn();
const summaryMock = jest.fn();
const queueMock = jest.fn();
const slaMock = jest.fn();
const syncMock = jest.fn();
const listMock = jest.fn();

jest.mock('../../src/services/careService', () => {
    const actual = jest.requireActual('../../src/services/careService');
    return {
        ...actual,
        getCareEtagInput: (...a: unknown[]) => etagMock(...a),
        getCareSummary: (...a: unknown[]) => summaryMock(...a),
        getCareQueue: (...a: unknown[]) => queueMock(...a),
        getSlaConfig: (...a: unknown[]) => slaMock(...a),
        syncCareNotifications: (...a: unknown[]) => syncMock(...a),
        listCareNotifications: (...a: unknown[]) => listMock(...a),
        buildCareQueueView: (items: unknown[]) => items
    };
});

// eslint-disable-next-line @typescript-eslint/no-require-imports
const careRoutes = require('../../src/routes/care').default;

function app() {
    const a = express();
    a.use(express.json());
    a.use('/api/care', careRoutes);
    return a;
}

describe('P2 GET /api/care/panel', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        (globalThis as any).__careUser = { id: 'u1', role: 'user', subUsers: [] };
        etagMock.mockResolvedValue(['a', null, null, null, null, null, null, null]);
        summaryMock.mockResolvedValue({
            noContact: 1,
            due: 0,
            openOk: 0,
            won: 0,
            lost: 0,
            abandoned: 0,
            totalCount: 1
        });
        queueMock.mockResolvedValue({
            items: [{ offerId: 'o1' }],
            nextCursor: null,
            totalCount: 1
        });
        slaMock.mockResolvedValue({ firstContactH: 24, staleD: 7, escalationH: 72 });
        syncMock.mockResolvedValue({ inserted: 0, resolved: 0 });
        listMock.mockResolvedValue({ items: [], unreadCount: 0 });
    });

    it('200 z pakietem + nagłówek ETag', async () => {
        const res = await request(app()).get('/api/care/panel?scope=mine');
        expect(res.status).toBe(200);
        expect(res.headers.etag).toMatch(/^"care-[0-9a-f]{40}"$/);
        expect(res.body.ok).toBe(true);
        expect(res.body.etag).toBe(res.headers.etag);
        expect(res.body.summary.totalCount).toBe(1);
        expect(res.body.queue.totalCount).toBe(1);
        expect(res.body.notifications.unreadCount).toBe(0);
        expect(res.body.sla.firstContactH).toBe(24);
    });

    it('If-None-Match = ETag → 304 bez body', async () => {
        const first = await request(app()).get('/api/care/panel?scope=mine');
        const etag = first.headers.etag as string;
        const second = await request(app())
            .get('/api/care/panel?scope=mine')
            .set('If-None-Match', etag);
        expect(second.status).toBe(304);
    });

    it('zły scope → 400; scope=all nie-admin → 403', async () => {
        expect((await request(app()).get('/api/care/panel?scope=zzz')).status).toBe(400);
        const err = new Error('scope=all tylko dla admin') as Error & { status: number };
        err.status = 403;
        summaryMock.mockRejectedValueOnce(err);
        expect((await request(app()).get('/api/care/panel?scope=all')).status).toBe(403);
    });
});
