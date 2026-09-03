import { describe, expect, it, jest } from '@jest/globals';
import request from 'supertest';
import express from 'express';
import featureFlagsRouter from '../src/routes/featureFlags';

jest.mock('../src/utils/logger', () => ({
    logger: {
        info: jest.fn(),
        error: jest.fn(),
        warn: jest.fn()
    }
}));

jest.mock('../src/services/auditService', () => ({
    logAudit: jest.fn<any>().mockResolvedValue(undefined)
}));

jest.mock('../src/prismaClient', () => ({
    __esModule: true,
    default: {
        settings: {
            findUnique: jest.fn<any>().mockResolvedValue(null),
            upsert: jest.fn<any>().mockResolvedValue({})
        }
    }
}));

const userRole = { role: 'user' as 'user' | 'admin' };

jest.mock('../src/middleware/auth', () => ({
    requireAuth: (req: any, _res: any, next: any) => {
        req.user = { id: 'u1', role: userRole.role };
        next();
    },
    requireAdmin: (req: any, res: any, next: any) => {
        if (req.user?.role !== 'admin') {
            res.status(403).json({ error: 'Brak uprawnień' });
            return;
        }
        next();
    },
    AuthenticatedRequest: {}
}));

function buildApp() {
    const app = express();
    app.use(express.json());
    app.use('/api/feature-flags', featureFlagsRouter);
    return app;
}

describe('featureFlags POST /audit — A-17 requireAdmin', () => {
    it('non-admin dostaje 403 (audit poisoning blocked)', async () => {
        userRole.role = 'user';
        const app = buildApp();
        const res = await request(app)
            .post('/api/feature-flags/audit')
            .send({ entityType: 'studnia_oferta', entityId: 'x1', action: 'export.transfer' });
        expect(res.status).toBe(403);
    });

    it('admin moze zapisac wpis audytu', async () => {
        userRole.role = 'admin';
        const app = buildApp();
        const res = await request(app)
            .post('/api/feature-flags/audit')
            .send({ entityType: 'studnia_oferta', entityId: 'x1', action: 'export.transfer' });
        expect(res.status).toBe(200);
        expect(res.body).toEqual({ ok: true });
    });

    it('brak wymaganych pol -> 400', async () => {
        userRole.role = 'admin';
        const app = buildApp();
        const res = await request(app)
            .post('/api/feature-flags/audit')
            .send({ entityType: 'studnia_oferta' });
        expect(res.status).toBe(400);
    });

    it('GET / dostepny dla kazdego zalogowanego (frontend feature flag)', async () => {
        userRole.role = 'user';
        const app = buildApp();
        const res = await request(app).get('/api/feature-flags');
        expect(res.status).toBe(200);
        expect(res.body).toEqual({
            import_export_enabled: false,
            pz_stable_id: true,
            ai_ml_enabled: true
        });
    });
});
