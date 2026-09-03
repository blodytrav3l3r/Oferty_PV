import { describe, expect, it, jest, beforeEach } from '@jest/globals';
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

const mockLogAudit = jest.fn<any>().mockResolvedValue(undefined);
jest.mock('../src/services/auditService', () => ({
    logAudit: (...args: unknown[]) => (mockLogAudit as any)(...args)
}));

const mockFindUnique = jest.fn<any>();
const mockUpsert = jest.fn<any>().mockResolvedValue({});
jest.mock('../src/prismaClient', () => ({
    __esModule: true,
    default: {
        settings: {
            findUnique: (...args: unknown[]) => (mockFindUnique as any)(...args),
            upsert: (...args: unknown[]) => (mockUpsert as any)(...args)
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

function flagStore(aiMlOn: boolean) {
    (mockFindUnique as any).mockImplementation(async ({ where }: any) => {
        if (where.key === 'feature_ai_ml_enabled') {
            return { value: aiMlOn ? '"1"' : '"0"' };
        }
        if (where.key === 'feature_pz_stable_id') return null;
        return { value: '"1"' };
    });
}

describe('feature-flags AI/ML kill-switch', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        (mockUpsert as any).mockResolvedValue({});
        userRole.role = 'user';
    });

    it('GET zwraca ai_ml_enabled=true gdy flaga ON', async () => {
        flagStore(true);
        const res = await request(buildApp()).get('/api/feature-flags');
        expect(res.status).toBe(200);
        expect(res.body.ai_ml_enabled).toBe(true);
    });

    it('GET zwraca ai_ml_enabled=false gdy flaga OFF', async () => {
        flagStore(false);
        const res = await request(buildApp()).get('/api/feature-flags');
        expect(res.status).toBe(200);
        expect(res.body.ai_ml_enabled).toBe(false);
    });

    it('PUT non-admin -> 403', async () => {
        userRole.role = 'user';
        flagStore(true);
        const res = await request(buildApp())
            .put('/api/feature-flags/ai-ml')
            .send({ enabled: false });
        expect(res.status).toBe(403);
    });

    it('PUT odrzuca enabled nie-boolean (string/number)', async () => {
        userRole.role = 'admin';
        flagStore(true);
        for (const bad of [{ enabled: 'false' }, { enabled: 0 }, { enabled: 1 }, {}]) {
            const res = await request(buildApp()).put('/api/feature-flags/ai-ml').send(bad);
            expect(res.status).toBe(400);
        }
    });

    it('PUT admin przelacza OFF i audytuje old->new', async () => {
        userRole.role = 'admin';
        flagStore(true);
        const res = await request(buildApp())
            .put('/api/feature-flags/ai-ml')
            .send({ enabled: false });
        expect(res.status).toBe(200);
        expect(res.body).toEqual({ success: true, enabled: false });
        expect(mockUpsert).toHaveBeenCalledWith({
            where: { key: 'feature_ai_ml_enabled' },
            create: { key: 'feature_ai_ml_enabled', value: '"0"' },
            update: { value: '"0"' }
        });
        expect(mockLogAudit).toHaveBeenCalledWith(
            'settings',
            'feature_ai_ml_enabled',
            'u1',
            'feature_flag.changed',
            { newValue: false, key: 'feature_ai_ml_enabled' },
            { oldValue: true }
        );
    });

    it('PUT admin przelacza ON (z OFF)', async () => {
        userRole.role = 'admin';
        flagStore(false);
        const res = await request(buildApp())
            .put('/api/feature-flags/ai-ml')
            .send({ enabled: true });
        expect(res.status).toBe(200);
        expect(res.body).toEqual({ success: true, enabled: true });
        expect(mockLogAudit).toHaveBeenCalledWith(
            'settings',
            'feature_ai_ml_enabled',
            'u1',
            'feature_flag.changed',
            { newValue: true, key: 'feature_ai_ml_enabled' },
            { oldValue: false }
        );
    });
});
