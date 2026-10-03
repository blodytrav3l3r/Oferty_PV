import { describe, expect, it, jest, beforeEach } from '@jest/globals';
import request from 'supertest';
import express from 'express';

const mockUser: any = { id: 'userA', username: 'userA', role: 'user', subUsers: [] };

jest.mock('../../src/utils/logger', () => ({
    logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn() }
}));

jest.mock('../../src/middleware/auth', () => ({
    requireAuth: (req: any, _res: any, next: any) => {
        req.user = { ...mockUser };
        next();
    },
    requireAdmin: (_req: any, _res: any, next: any) => next()
}));

jest.mock('../../src/middleware/rateLimiters', () => ({
    WRITE_LIMITER: (_req: any, _res: any, next: any) => next(),
    READ_LIMITER: (_req: any, _res: any, next: any) => next(),
    TELEMETRY_WRITE_LIMITER: (_req: any, _res: any, next: any) => next()
}));

const mockProcessAction = jest.fn<any>().mockResolvedValue({ applied: true });

jest.mock('../../src/services/ml/RewardCalculator', () => ({
    rewardCalculator: {
        processAction: (...args: any[]) => mockProcessAction(...args)
    }
}));

jest.mock('../../src/services/ml/SelfEvaluation', () => ({
    selfEvaluation: {
        checkAndRollbackIfNeeded: jest.fn<any>().mockResolvedValue({}),
        recordPredictionResult: jest.fn<any>()
    }
}));

jest.mock('../../src/services/ml/FeatureExtractor', () => ({
    featureExtractor: {
        updateLabelByTelemetry: jest.fn<any>().mockResolvedValue(undefined),
        getFeatureCount: jest.fn<any>().mockResolvedValue(24)
    }
}));

let mockLogsFindMany = jest.fn<any>().mockResolvedValue([]);
const mockOffersRelFindMany = jest.fn<any>().mockResolvedValue([]);
const mockOffersStudnieFindMany = jest.fn<any>().mockResolvedValue([]);

jest.mock('../../src/prismaClient', () => ({
    __esModule: true,
    default: {
        settings: {
            findUnique: jest.fn<any>().mockResolvedValue({
                key: 'feature_ai_ml_enabled',
                value: '"1"'
            })
        },
        aiFeature: { findMany: jest.fn<any>().mockResolvedValue([]) },
        ai_telemetry_logs: {
            findMany: (...args: any[]) => mockLogsFindMany(...args),
            findFirst: jest.fn<any>().mockResolvedValue(null),
            update: jest.fn<any>().mockResolvedValue({})
        },
        offers_rel: { findMany: (...args: any[]) => mockOffersRelFindMany(...args) },
        offers_studnie_rel: {
            findMany: (...args: any[]) => mockOffersStudnieFindMany(...args)
        }
    }
}));

jest.mock('../../src/services/auditService', () => ({
    logAudit: jest.fn()
}));

/**
 * D-011: reward-batch well-gate (jak single processRewardItem).
 * Batch ACCEPT/ADJUST/SWAP omijał gate własności studni — dowolny user
 * dopisywał sygnały ML do cudzej studni (label poisoning).
 */
describe('D-011 reward-batch ownership', () => {
    let app: express.Application;

    beforeEach(async () => {
        jest.clearAllMocks();
        mockUser.id = 'userA';
        mockUser.role = 'user';
        mockUser.subUsers = [];
        mockLogsFindMany.mockResolvedValue([]);
        mockOffersRelFindMany.mockResolvedValue([]);
        mockOffersStudnieFindMany.mockResolvedValue([]);
        mockProcessAction.mockResolvedValue({ applied: true });
        const { default: router } = await import('../../src/routes/telemetryAiMl');
        app = express();
        app.use(express.json({ limit: '50mb' }));
        app.use('/api/telemetry', router);
    });

    function mockExistence(
        rows: Array<{ wellId: string; userId?: string | null; offerId?: string | null }>
    ) {
        mockLogsFindMany.mockImplementation(async (args: any) => {
            if (args?.where?.wellId?.in) return rows;
            return [];
        });
    }

    it('wlasna studnia -> applied', async () => {
        mockExistence([{ wellId: 'w-moja', userId: 'userA' }]);
        const res = await request(app)
            .post('/api/telemetry/ai/reward-batch')
            .send({ items: [{ action: 'ACCEPT', wellId: 'w-moja' }] });
        expect(res.status).toBe(200);
        expect(res.body.applied).toEqual(['w-moja']);
        expect(res.body.rejected).toEqual([]);
        expect(mockProcessAction).toHaveBeenCalledTimes(1);
    });

    it('cudza studnia (ACCEPT) -> FORBIDDEN, brak zapisu i brak leaku', async () => {
        mockExistence([{ wellId: 'w-cudza', userId: 'userB', offerId: null }]);
        const res = await request(app)
            .post('/api/telemetry/ai/reward-batch')
            .send({ items: [{ action: 'ACCEPT', wellId: 'w-cudza' }] });
        expect(res.status).toBe(200);
        expect(res.body.applied).toEqual([]);
        expect(res.body.rejected).toEqual([{ wellId: 'w-cudza', reason: 'FORBIDDEN' }]);
        expect(mockProcessAction).not.toHaveBeenCalled();
        // Brak wycieku cudzych danych w odpowiedzi.
        expect(JSON.stringify(res.body)).not.toContain('userB');
    });

    it('cudza studnia (ADJUST/SWAP/MODIFY) -> FORBIDDEN', async () => {
        mockExistence([
            { wellId: 'w-1', userId: 'userB' },
            { wellId: 'w-2', userId: 'userB' },
            { wellId: 'w-3', userId: 'userB' }
        ]);
        const res = await request(app)
            .post('/api/telemetry/ai/reward-batch')
            .send({
                items: [
                    { action: 'ADJUST', wellId: 'w-1' },
                    { action: 'SWAP', wellId: 'w-2' },
                    { action: 'MODIFY', wellId: 'w-3' }
                ]
            });
        expect(res.status).toBe(200);
        expect(res.body.applied).toEqual([]);
        expect(res.body.rejected).toEqual([
            { wellId: 'w-1', reason: 'FORBIDDEN' },
            { wellId: 'w-2', reason: 'FORBIDDEN' },
            { wellId: 'w-3', reason: 'FORBIDDEN' }
        ]);
        expect(mockProcessAction).not.toHaveBeenCalled();
    });

    it('admin na cudza studnie -> applied (kontrakt canWriteDoc)', async () => {
        mockUser.role = 'admin';
        mockExistence([{ wellId: 'w-cudza', userId: 'userB' }]);
        const res = await request(app)
            .post('/api/telemetry/ai/reward-batch')
            .send({ items: [{ action: 'ACCEPT', wellId: 'w-cudza' }] });
        expect(res.status).toBe(200);
        expect(res.body.applied).toEqual(['w-cudza']);
        expect(mockProcessAction).toHaveBeenCalledTimes(1);
    });

    it('legacy bez wlasciciela i oferty -> dotychczasowy status (applied)', async () => {
        mockExistence([{ wellId: 'w-legacy' }]);
        const res = await request(app)
            .post('/api/telemetry/ai/reward-batch')
            .send({ items: [{ action: 'ACCEPT', wellId: 'w-legacy' }] });
        expect(res.status).toBe(200);
        expect(res.body.applied).toEqual(['w-legacy']);
    });

    it('wiersz z cudza oferta -> FORBIDDEN; z nieznana (draft) -> applied', async () => {
        mockExistence([
            { wellId: 'w-cudza-oferta', offerId: 'off-b' },
            { wellId: 'w-draft', offerId: 'off-draft' }
        ]);
        mockOffersStudnieFindMany.mockResolvedValue([{ id: 'off-b', userId: 'userB' }]);
        const res = await request(app)
            .post('/api/telemetry/ai/reward-batch')
            .send({
                items: [
                    { action: 'ACCEPT', wellId: 'w-cudza-oferta' },
                    { action: 'ACCEPT', wellId: 'w-draft' }
                ]
            });
        expect(res.status).toBe(200);
        expect(res.body.applied).toEqual(['w-draft']);
        expect(res.body.rejected).toEqual([{ wellId: 'w-cudza-oferta', reason: 'FORBIDDEN' }]);
    });
});
