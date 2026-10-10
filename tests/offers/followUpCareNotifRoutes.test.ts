/*
 * tests/offers/followUpCareNotifRoutes.test.ts
 * P2 routes: GET /notifications (sync+lista) i POST read (guardy, bez DB).
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

const syncMock = jest.fn();
const listMock = jest.fn();
const markMock = jest.fn();

jest.mock('../../src/services/careService', () => {
    const actual = jest.requireActual('../../src/services/careService');
    return {
        ...actual,
        getSlaConfig: jest.fn(async () => ({ firstContactH: 24, staleD: 7, escalationH: 72 })),
        syncCareNotifications: (...a: unknown[]) => syncMock(...a),
        listCareNotifications: (...a: unknown[]) => listMock(...a),
        markCareNotificationRead: (...a: unknown[]) => markMock(...a)
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

describe('P2 notifications routes', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        (globalThis as any).__careUser = { id: 'u1', role: 'user', subUsers: [] };
        syncMock.mockResolvedValue({ inserted: 1, resolved: 0 });
        listMock.mockResolvedValue({
            items: [
                {
                    id: 'n1',
                    userId: 'u1',
                    offerKind: 'rury',
                    offerId: 'o1',
                    type: 'SLA_BREACH',
                    readAt: null,
                    createdAt: '2026-10-10T12:00:00.000Z'
                }
            ],
            unreadCount: 1
        });
    });

    it('GET → sync + lista + unreadCount', async () => {
        const res = await request(app()).get('/api/care/notifications?scope=mine');
        expect(res.status).toBe(200);
        expect(syncMock).toHaveBeenCalledTimes(1);
        expect(res.body.unreadCount).toBe(1);
        expect(res.body.items[0].type).toBe('SLA_BREACH');
    });

    it('POST read → 200; cudze/brak → 404', async () => {
        markMock.mockResolvedValueOnce(1);
        expect((await request(app()).post('/api/care/notifications/n1/read')).status).toBe(200);
        markMock.mockResolvedValueOnce(0);
        expect((await request(app()).post('/api/care/notifications/n1/read')).status).toBe(404);
    });

    it('scope=all nie-admin → 403 z serwisu', async () => {
        const err = new Error('scope=all tylko dla admin') as Error & { status: number };
        err.status = 403;
        syncMock.mockRejectedValueOnce(err);
        (globalThis as any).__careUser = { id: 'u1', role: 'user', subUsers: [] };
        const res = await request(app()).get('/api/care/notifications?scope=all');
        expect(res.status).toBe(403);
    });
});
