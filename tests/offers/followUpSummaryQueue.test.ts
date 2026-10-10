/*
 * tests/offers/followUpSummaryQueue.test.ts
 * P0.3 kontrakt GET /api/care/summary + /api/care/queue (read-only, bez POST).
 */
import request from 'supertest';
import express from 'express';

jest.mock('../../src/middleware/auth', () => ({
    requireAuth: (req: any, _res: any, next: any) => {
        req.user = (globalThis as any).__careUser ?? { id: 'u1', role: 'user', subUsers: [] };
        next();
    }
}));

jest.mock('../../src/utils/logger', () => ({
    logger: { info: jest.fn(), error: jest.fn(), warn: jest.fn(), debug: jest.fn() }
}));

const summaryMock = jest.fn();
const queueMock = jest.fn();

jest.mock('../../src/services/careService', () => ({
    getCareSummary: (...a: unknown[]) => summaryMock(...a),
    getCareQueue: (...a: unknown[]) => queueMock(...a),
    clampCareLimit: jest.requireActual('../../src/services/careService').clampCareLimit
}));

// eslint-disable-next-line @typescript-eslint/no-require-imports
const careRoutes = require('../../src/routes/care').default;

function app() {
    const a = express();
    a.use('/api/care', careRoutes);
    return a;
}

describe('P0.3 care API read-only', () => {
    beforeEach(() => {
        summaryMock.mockReset();
        queueMock.mockReset();
        (globalThis as any).__careUser = { id: 'u1', role: 'user', subUsers: [] };
    });

    it('GET summary → DTO + 200', async () => {
        summaryMock.mockResolvedValue({
            noContact: 1,
            due: 2,
            openOk: 0,
            won: 1,
            lost: 0,
            totalCount: 4
        });
        const res = await request(app()).get('/api/care/summary?scope=mine');
        expect(res.status).toBe(200);
        expect(res.body.ok).toBe(true);
        expect(res.body.totalCount).toBe(4);
        expect(res.body.due).toBe(2);
    });

    it('GET queue → items ze statusem + totalCount', async () => {
        queueMock.mockResolvedValue({
            items: [
                {
                    offerKind: 'rury',
                    offerId: 'o1',
                    outcome: 'OPEN',
                    nextContactAt: '2026-10-09T10:00:00.000Z',
                    lastContactAt: '2026-10-09T10:00:00.000Z',
                    bucketWeight: 0
                }
            ],
            nextCursor: null,
            totalCount: 1
        });
        const res = await request(app()).get('/api/care/queue?scope=mine&limit=10');
        expect(res.status).toBe(200);
        expect(res.body.items).toHaveLength(1);
        expect(res.body.items[0].status).toBe('DUE');
        expect(res.body.totalCount).toBe(1);
    });

    it('scope=all nie-admin → 403 (nie silent downgrade)', async () => {
        const err = new Error('scope=all tylko dla admin') as Error & { status: number };
        err.status = 403;
        summaryMock.mockRejectedValue(err);
        const res = await request(app()).get('/api/care/summary?scope=all');
        expect(res.status).toBe(403);
    });

    it('zły scope → 400', async () => {
        const res = await request(app()).get('/api/care/summary?scope=xxx');
        expect(res.status).toBe(400);
    });
});
