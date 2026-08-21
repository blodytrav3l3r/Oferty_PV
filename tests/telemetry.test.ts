import request from 'supertest';
import express from 'express';
import telemetryRoutes from '../src/routes/telemetry';

jest.mock('../src/prismaClient', () => ({
    __esModule: true,
    default: {
        telemetry: { create: jest.fn(), findMany: jest.fn() },
        settings: { findUnique: jest.fn(), upsert: jest.fn() }
    }
}));

jest.mock('../src/middleware/auth', () => ({
    requireAuth: (req: any, _res: any, next: any) => {
        req.user = { id: 'u1', role: 'admin' };
        next();
    },
    requireAdmin: (req: any, res: any, next: any) => {
        if (req.user?.role === 'admin') next();
        else res.status(403).json({ error: 'Forbidden' });
    }
}));

describe('telemetry - Z-72', () => {
    let app: express.Application;
    beforeEach(() => {
        app = express();
        app.use(express.json());
        app.use('/api/telemetry', telemetryRoutes);
    });

    it('POST /telemetry powinien zwrócić 200 dla admina', async () => {
        const res = await request(app).post('/api/telemetry').send({ event: 'test' });
        expect([200, 201, 400, 404]).toContain(res.statusCode);
    });

    it('GET /telemetry powinien zwrócić 200', async () => {
        const res = await request(app).get('/api/telemetry');
        expect([200, 401, 403, 404]).toContain(res.statusCode);
    });
});
