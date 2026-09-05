import { describe, expect, it, jest, beforeEach } from '@jest/globals';
import request from 'supertest';
import express from 'express';

jest.mock('../../src/utils/logger', () => ({
    logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn() }
}));

jest.mock('../../src/middleware/auth', () => ({
    requireAuth: (_req: any, _res: any, next: any) => next(),
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
let mockLogsFindFirst = jest.fn<any>().mockResolvedValue(null);

jest.mock('../../src/prismaClient', () => ({
    __esModule: true,
    default: {
        aiFeature: { findMany: jest.fn<any>().mockResolvedValue([]) },
        ai_telemetry_logs: {
            findMany: (...args: any[]) => mockLogsFindMany(...args),
            findFirst: (...args: any[]) => mockLogsFindFirst(...args),
            update: jest.fn<any>().mockResolvedValue({})
        }
    }
}));

jest.mock('../../src/services/auditService', () => ({
    logAudit: jest.fn()
}));

const item = (wellId: string) => ({ action: 'ACCEPT', wellId });

describe('POST /api/telemetry/ai/reward-batch', () => {
    let app: express.Application;

    beforeEach(async () => {
        jest.clearAllMocks();
        mockLogsFindMany.mockResolvedValue([]);
        mockLogsFindFirst.mockResolvedValue(null);
        mockProcessAction.mockResolvedValue({ applied: true });
        const { default: router } = await import('../../src/routes/telemetryAiMl');
        app = express();
        app.use(express.json({ limit: '50mb' }));
        app.use('/api/telemetry', router);
    });

    it('500 items → OK; 501 → 400 (twardy cap)', async () => {
        const items = Array.from({ length: 500 }, (_, i) => item(`w${i}`));
        mockLogsFindMany.mockResolvedValue(items.map((x) => ({ wellId: x.wellId })));
        const ok = await request(app).post('/api/telemetry/ai/reward-batch').send({ items });
        expect(ok.status).toBe(200);
        expect(ok.body.applied).toHaveLength(500);

        const tooMany = await request(app)
            .post('/api/telemetry/ai/reward-batch')
            .send({ items: Array.from({ length: 501 }, (_, i) => item(`w${i}`)) });
        expect(tooMany.status).toBe(400);
    });

    it('mieszany batch: applied + duplicate + WELL_NOT_FOUND, jeden zły nie uwala reszty', async () => {
        mockLogsFindMany.mockResolvedValue([{ wellId: 'w-ok' }, { wellId: 'w-dup' }]);
        mockProcessAction.mockImplementation(async (a: any) =>
            a.wellId === 'w-dup' ? { applied: false } : { applied: true }
        );
        const res = await request(app)
            .post('/api/telemetry/ai/reward-batch')
            .send({ items: [item('w-ok'), item('w-dup'), item('w-missing')] });
        expect(res.status).toBe(200);
        expect(res.body.applied).toEqual(['w-ok']);
        expect(res.body.duplicates).toEqual(['w-dup']);
        expect(res.body.rejected).toEqual([{ wellId: 'w-missing', reason: 'WELL_NOT_FOUND' }]);
    });

    it('jeden findMany IN dla całego batcha (brak N× lookupów)', async () => {
        mockLogsFindMany.mockResolvedValue([{ wellId: 'w1' }, { wellId: 'w2' }]);
        await request(app)
            .post('/api/telemetry/ai/reward-batch')
            .send({ items: [item('w1'), item('w2'), item('w3')] });
        expect(mockLogsFindMany).toHaveBeenCalledTimes(1);
        expect(mockLogsFindMany).toHaveBeenCalledWith(
            expect.objectContaining({ where: { wellId: { in: ['w1', 'w2', 'w3'] } } })
        );
        // findFirst per-item TYLKO w gałęzi MODIFY/REJECT nie występuje dla ACCEPT
        expect(mockLogsFindFirst).not.toHaveBeenCalled();
    });

    it('pusty batch → 400 (min 1 item)', async () => {
        const res = await request(app).post('/api/telemetry/ai/reward-batch').send({ items: [] });
        expect(res.status).toBe(400);
    });
});
