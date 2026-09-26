/**
 * GET /api/audit/:entityType/:entityId — clamp limit (ujemny limit nie daje 500).
 */
import request from 'supertest';
import express from 'express';
import auditRouter from '../src/routes/audit';

jest.mock('../src/middleware/auth', () => ({
    requireAuth: (req: any, _res: any, next: any) => {
        req.user = { id: 'u1', role: 'admin', subUsers: [] };
        next();
    }
}));

jest.mock('../src/utils/logger', () => ({
    logger: { info: jest.fn(), error: jest.fn(), warn: jest.fn() }
}));

jest.mock('../src/prismaClient', () => ({
    __esModule: true,
    default: {
        audit_logs: {
            count: jest.fn(async () => 0),
            findMany: jest.fn(async () => [])
        }
    }
}));

function createApp() {
    const app = express();
    app.use(express.json());
    app.use('/api/audit', auditRouter);
    return app;
}

describe('audit limit clamp', () => {
    test('limit=-5 → 200 z limitem 1 (bez 500 z Prisma)', async () => {
        const res = await request(createApp()).get('/api/audit/offer/abc?limit=-5');
        expect(res.status).toBe(200);
    });

    test('limit=1000 → 200 (cap MAX)', async () => {
        const res = await request(createApp()).get('/api/audit/offer/abc?limit=1000');
        expect(res.status).toBe(200);
    });
});
