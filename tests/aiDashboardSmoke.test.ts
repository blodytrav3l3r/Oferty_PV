import request from 'supertest';
import express from 'express';
import telemetryAiDashboardRoutes from '../src/routes/telemetryAiDashboard';

jest.mock('../src/middleware/auth', () => ({
    requireAuth: (req: any, _res: any, next: any) => {
        req.user = { id: 'test_admin_id', role: 'admin' };
        next();
    }
}));

jest.mock('../src/utils/logger', () => ({
    logger: { info: jest.fn(), error: jest.fn(), warn: jest.fn(), debug: jest.fn() }
}));

const app = express();
app.use(express.json());
app.use('/api/telemetry', telemetryAiDashboardRoutes);

describe('AI Dashboard Smoke — GET /api/telemetry/ai/knowledge/stats', () => {
    it('zwraca stats z wymaganymi polami', async () => {
        const res = await request(app)
            .get('/api/telemetry/ai/knowledge/stats');
        expect(res.status).toBe(200);
        expect(res.body).toHaveProperty('total');
        expect(res.body).toHaveProperty('active');
        expect(res.body).toHaveProperty('archived');
        expect(res.body).toHaveProperty('avgConfidence');
        expect(res.body).toHaveProperty('totalRecommendations');
        expect(res.body).toHaveProperty('acceptedRecommendations');
        expect(res.body).toHaveProperty('rejectedRecommendations');
        expect(res.body).toHaveProperty('byPatternType');
        expect(res.body).toHaveProperty('recentDetected');
    });
});

describe('AI Dashboard Smoke — GET /api/telemetry/ai/knowledge/patterns', () => {
    it('zwraca items z domyślnym DN (all_dn)', async () => {
        const res = await request(app)
            .get('/api/telemetry/ai/knowledge/patterns');
        expect(res.status).toBe(200);
        expect(res.body).toHaveProperty('items');
        expect(res.body).toHaveProperty('total');
        expect(res.body).toHaveProperty('dn');
        expect(res.body).toHaveProperty('minConfidence');
        expect(Array.isArray(res.body.items)).toBe(true);
    });

    it('zwraca items z DN filter', async () => {
        const res = await request(app)
            .get('/api/telemetry/ai/knowledge/patterns?dn=1200&minConfidence=0.1');
        expect(res.status).toBe(200);
        expect(res.body.dn).toBe('1200');
        expect(res.body.minConfidence).toBe(0.1);
    });
});

describe('AI Dashboard Smoke — GET /api/telemetry/ai/learning/status', () => {
    it('zwraca status learning engine', async () => {
        const res = await request(app)
            .get('/api/telemetry/ai/learning/status');
        expect(res.status).toBe(200);
        expect(res.body).toHaveProperty('initialized');
    });
});

describe('AI Dashboard Smoke — 403 bez admin roli', () => {
    it('GET /knowledge/stats zwraca 403 gdy nie admin', async () => {
        const nonAdminApp = express();
        nonAdminApp.use(express.json());

        jest.resetModules();
        jest.doMock('../src/middleware/auth', () => ({
            requireAuth: (req: any, _res: any, next: any) => {
                req.user = { id: 'test_user', role: 'user' };
                next();
            }
        }));

        const { default: routes } = await import('../src/routes/telemetryAiDashboard');
        nonAdminApp.use('/api/telemetry', routes);

        const res = await request(nonAdminApp)
            .get('/api/telemetry/ai/knowledge/stats');
        expect(res.status).toBe(403);
    });
});
