import { describe, expect, it, jest, beforeEach } from '@jest/globals';
import request from 'supertest';
import express from 'express';
import {
    clearPredictionCache,
    issuePredictionProof,
    consumePredictionProof,
    claimPredictionProof,
    releasePredictionProof
} from '../../src/services/ml/predictionCache';
import { getMetricsSnapshot, resetMetrics } from '../../src/utils/metrics';

jest.mock('../../src/utils/logger', () => ({
    logger: {
        info: jest.fn(),
        warn: jest.fn(),
        error: jest.fn()
    }
}));

jest.mock('../../src/middleware/auth', () => ({
    // Harness tożsamości dla testów ownership: nagłówki x-test-userid /
    // x-test-role ustawiają req.user; bez nich zachowanie jak dotąd (brak usera).
    requireAuth: (req: any, _res: any, next: any) => {
        const testId = req.headers?.['x-test-userid'];
        if (testId) {
            req.user = {
                id: String(testId),
                role: String(req.headers?.['x-test-role'] || 'user'),
                subUsers: []
            };
        }
        next();
    },
    requireAdmin: (_req: any, _res: any, next: any) => next()
}));

jest.mock('../../src/middleware/rateLimiters', () => ({
    WRITE_LIMITER: (_req: any, _res: any, next: any) => next(),
    READ_LIMITER: (_req: any, _res: any, next: any) => next(),
    TELEMETRY_WRITE_LIMITER: (_req: any, _res: any, next: any) => next()
}));

const mockGetActiveModel = jest.fn<any>();
const mockGetModelCount = jest.fn<any>().mockResolvedValue(0);
const mockActivateModel = jest.fn<any>();
const mockComputeFeatureImportance = jest.fn<any>().mockResolvedValue([]);
const mockRollbackToPrevious = jest.fn<any>().mockResolvedValue(null);

jest.mock('../../src/services/ml/ModelRegistry', () => ({
    modelRegistry: {
        getActiveModel: (...args: any[]) => mockGetActiveModel(...args),
        getModelCount: (...args: any[]) => mockGetModelCount(...args),
        activateModel: (...args: any[]) => mockActivateModel(...args),
        computeFeatureImportance: (...args: any[]) => mockComputeFeatureImportance(...args),
        rollbackToPrevious: (...args: any[]) => mockRollbackToPrevious(...args)
    }
}));

const mockGetStatus = jest.fn<any>().mockReturnValue({ running: false });
const mockTrainingRun = jest.fn<any>().mockResolvedValue({ trained: false });
const mockEvaluateOnlineAuc = jest.fn<any>().mockResolvedValue({ slidingAuc: null });
const mockRecordPredictionResult = jest.fn<any>();

jest.mock('../../src/services/ml/TrainingPipeline', () => ({
    trainingPipeline: {
        run: (...args: any[]) => mockTrainingRun(...args),
        getStatus: (...args: any[]) => mockGetStatus(...args),
        gateStatus: jest.fn<any>().mockResolvedValue(null)
    }
}));

describe('POST /api/telemetry/ai/train', () => {
    it('busy result does not clear outstanding prediction proofs', async () => {
        const { default: router } = await import('../../src/routes/telemetryAiMl');
        const app = express();
        app.use(express.json());
        app.use('/api/telemetry', router);
        clearPredictionCache();
        const proof = issuePredictionProof('userA', 'well-busy', 0.8, 'model-active');
        mockTrainingRun.mockResolvedValue({ trained: false, reason: 'already_running' });

        const response = await request(app)
            .post('/api/telemetry/ai/train')
            .set({ 'x-test-userid': 'admin', 'x-test-role': 'admin' });

        expect(response.status).toBe(200);
        expect(response.body).toEqual({ trained: false, reason: 'already_running' });
        expect(consumePredictionProof(proof, 'userA', 'well-busy', 0.8)).toEqual({
            score: 0.8,
            version: 'model-active'
        });
    });
});

describe('POST /api/telemetry/ai/rollback', () => {
    let app: express.Application;

    beforeEach(async () => {
        jest.clearAllMocks();
        const { default: router } = await import('../../src/routes/telemetryAiMl');
        app = express();
        app.use(express.json());
        app.use('/api/telemetry', router);
    });

    it('przekazuje potwierdzone wersje do atomowej operacji rollbacku', async () => {
        mockRollbackToPrevious.mockResolvedValue({ id: 'restored', version: 'v-previous' });

        const response = await request(app)
            .post('/api/telemetry/ai/rollback')
            .set({ 'x-test-userid': 'admin', 'x-test-role': 'admin' })
            .send({ expectedActiveVersion: 'v-active', expectedPreviousVersion: 'v-previous' });

        expect(response.status).toBe(200);
        expect(mockRollbackToPrevious).toHaveBeenCalledWith('v-active', 'v-previous');
        expect(response.body).toMatchObject({ rolledBack: true, model: { version: 'v-previous' } });
    });

    it('zwraca 409, jeśli target zmienił się od odczytu przed potwierdzeniem', async () => {
        mockRollbackToPrevious.mockResolvedValue(null);

        const response = await request(app)
            .post('/api/telemetry/ai/rollback')
            .set({ 'x-test-userid': 'admin', 'x-test-role': 'admin' })
            .send({ expectedActiveVersion: 'v-active', expectedPreviousVersion: 'v-confirmed' });

        expect(response.status).toBe(409);
        expect(response.body).toEqual({ error: 'ROLLBACK_TARGET_CHANGED', rolledBack: false });
    });
});

describe('POST /api/telemetry/ai/models/:id/activate', () => {
    let app: express.Application;

    beforeEach(async () => {
        jest.clearAllMocks();
        const { default: router } = await import('../../src/routes/telemetryAiMl');
        app = express();
        app.use(express.json());
        app.use('/api/telemetry', router);
    });

    it('zwraca 400 dla odrzuconego modelu zamiast błędu serwera', async () => {
        mockActivateModel.mockRejectedValueOnce(
            new Error('Model REJECTED nie może być aktywowany — najpierw ręczny approve')
        );

        const response = await request(app)
            .post('/api/telemetry/ai/models/rejected/activate')
            .set({ 'x-test-userid': 'admin', 'x-test-role': 'admin' });

        expect(response.status).toBe(400);
        expect(response.body.error).toContain('Model REJECTED');
    });
});

describe('GET /api/telemetry/ai/feature-importance', () => {
    let app: express.Application;

    beforeEach(async () => {
        jest.clearAllMocks();
        const { default: router } = await import('../../src/routes/telemetryAiMl');
        app = express();
        app.use(express.json());
        app.use('/api/telemetry', router);
    });

    it('does not present zero starter weights as trained feature importance', async () => {
        mockGetActiveModel.mockResolvedValueOnce({
            id: 'starter',
            version: 'v0.1.0-starter',
            trainingRows: 0,
            weights: [0, 0],
            featureMins: [0, 0],
            featureMaxs: [1, 1]
        });

        const response = await request(app)
            .get('/api/telemetry/ai/feature-importance')
            .set({ 'x-test-userid': 'admin', 'x-test-role': 'admin' });

        expect(response.status).toBe(503);
        expect(response.body).toEqual({ error: 'model_untrained' });
        expect(mockComputeFeatureImportance).not.toHaveBeenCalled();
    });
});

jest.mock('../../src/services/ml/SelfEvaluation', () => ({
    selfEvaluation: {
        evaluateOnlineAuc: (...args: any[]) => mockEvaluateOnlineAuc(...args),
        recordPredictionResult: (...args: any[]) => mockRecordPredictionResult(...args)
    }
}));

const mockProcessAction = jest.fn<any>().mockResolvedValue({ applied: true });

jest.mock('../../src/services/ml/RewardCalculator', () => ({
    rewardCalculator: {
        processAction: (...args: any[]) => mockProcessAction(...args)
    }
}));

const mockUpdateLabelByTelemetry = jest.fn<any>().mockResolvedValue(undefined);
const mockRewardTelemetryUpdate = jest.fn<any>().mockResolvedValue({ id: 'updated' });
const mockRewardFeatureUpdate = jest.fn<any>().mockResolvedValue({ count: 1 });
const mockRewardTransaction = {
    ai_telemetry_logs: { update: (...args: any[]) => mockRewardTelemetryUpdate(...args) },
    aiFeature: { updateMany: (...args: any[]) => mockRewardFeatureUpdate(...args) }
};

async function applyRewardTransaction(_event: unknown, onApplied?: (tx: unknown) => Promise<void>) {
    if (onApplied) await onApplied(mockRewardTransaction);
    return { applied: true };
}

jest.mock('../../src/services/ml/FeatureExtractor', () => ({
    featureExtractor: {
        updateLabelByTelemetry: (...args: any[]) => mockUpdateLabelByTelemetry(...args),
        getFeatureCount: jest.fn<any>().mockResolvedValue(24)
    }
}));

let mockPredict: jest.Mock<any>;

jest.mock('../../src/services/ml/AcceptanceModel', () => {
    mockPredict = jest.fn<any>();
    return {
        AcceptanceModel: jest.fn().mockImplementation(() => ({
            predict: (...args: any[]) => mockPredict(...args)
        }))
    };
});

let mockTelemetryLogsFindMany = jest.fn<any>().mockResolvedValue([]);
let mockTelemetryLogsCount = jest.fn<any>().mockResolvedValue(0);
let mockTelemetryLogsFindFirst = jest.fn<any>().mockResolvedValue(null);

jest.mock('../../src/prismaClient', () => ({
    __esModule: true,
    default: {
        // P0.5 fail-closed: guard czyta settings; testy logiki pracuja przy fladze ON ('"1"').
        settings: {
            findUnique: jest
                .fn<any>()
                .mockImplementation(async ({ where }: any) =>
                    where?.key === 'ai_training_user_ids'
                        ? { key: where.key, value: '["userA"]' }
                        : { key: 'feature_ai_ml_enabled', value: '"1"' }
                )
        },
        users: {
            findMany: jest
                .fn<any>()
                .mockImplementation(async ({ where }: any) =>
                    (where?.id?.in || []).map((id: string) => ({ id }))
                )
        },
        aiFeature: {
            findMany: jest.fn<any>().mockResolvedValue([]),
            findFirst: jest.fn<any>().mockResolvedValue(null),
            groupBy: jest.fn<any>().mockResolvedValue([]),
            count: jest.fn<any>().mockResolvedValue(0)
        },
        aiModel: {
            findFirst: jest.fn<any>(),
            findUnique: jest.fn<any>(),
            create: jest.fn<any>()
        },
        aiTrainingRun: { findFirst: jest.fn<any>().mockResolvedValue(null) },
        ai_telemetry_logs: {
            findMany: (...args: any[]) => mockTelemetryLogsFindMany(...args),
            count: (...args: any[]) => mockTelemetryLogsCount(...args),
            findFirst: (...args: any[]) => mockTelemetryLogsFindFirst(...args),
            update: jest.fn<any>().mockResolvedValue({})
        },
        offers_rel: { findUnique: jest.fn<any>().mockResolvedValue(null) },
        offers_studnie_rel: { findUnique: jest.fn<any>().mockResolvedValue(null) },
        ai_telemetry_events: {
            groupBy: jest.fn<any>().mockResolvedValue([])
        },
        aiRewardLog: {
            count: jest.fn<any>().mockResolvedValue(0)
        },
        audit_logs: { findMany: jest.fn<any>().mockResolvedValue([]) }
    }
}));

jest.mock('../../src/services/auditService', () => ({
    logAudit: jest.fn()
}));

describe('GET /api/telemetry/ai/ml-status', () => {
    it('exposes independent test ROC-AUC for the trained active model', async () => {
        const { default: router } = await import('../../src/routes/telemetryAiMl');
        const app = express();
        app.use(express.json());
        app.use('/api/telemetry', router);
        mockGetActiveModel.mockResolvedValueOnce({
            id: 'trained',
            version: 'v1-trained',
            trainingRows: 80,
            metrics: { rocAuc: 0.81, testRocAuc: 0.77 },
            featureMins: [],
            featureMaxs: []
        });
        mockGetModelCount.mockResolvedValueOnce(1);

        const response = await request(app)
            .get('/api/telemetry/ai/ml-status')
            .set({ 'x-test-userid': 'admin', 'x-test-role': 'admin' });

        expect(response.status).toBe(200);
        expect(response.body.activeModelMetrics).toMatchObject({
            rocAuc: 0.81,
            testRocAuc: 0.77
        });
    });
});

describe('POST /api/telemetry/ai/predict/batch', () => {
    let app: express.Application;

    beforeEach(async () => {
        jest.clearAllMocks();
        mockEvaluateOnlineAuc.mockResolvedValue({ slidingAuc: null });
        const { default: router } = await import('../../src/routes/telemetryAiMl');
        app = express();
        app.use(express.json());
        app.use('/api/telemetry', router);
    });

    it('przyjmuje batch predict z wieloma kandydatami', async () => {
        mockGetActiveModel.mockResolvedValue({
            id: 'model-v1',
            version: 'v1.0.0-test',
            weights: new Array(29).fill(0.1),
            bias: 0,
            featureMins: new Array(29).fill(0),
            featureMaxs: new Array(29).fill(1)
        });
        mockPredict.mockReturnValue(0.5);
        clearPredictionCache();

        const res = await request(app)
            .post('/api/telemetry/ai/predict/batch')
            .set({ 'x-test-userid': 'userA' })
            .send({
                candidates: [
                    {
                        id: 1,
                        wellId: 'well-1',
                        features: [
                            1000, 3000, 1, 0, 1, 0, 0, 0, 0, 3, 2, 1, 2500, 5000, 3, 1, 1, 1, 3000,
                            1, 0, 0, 1, 0, 2, 630, 0, 1800, 900
                        ]
                    },
                    {
                        id: 2,
                        features: [
                            1200, 3500, 0, 1, 0, 1, 0, 0, 0, 4, 3, 2, 3000, 6000, 4, 1, 0, 1, 4200,
                            0, 1, 0, 0, 0, 1, 400, 200, 200, 200
                        ]
                    }
                ]
            });

        expect(res.status).toBe(200);
        expect(res.body).toHaveProperty('scores');
        expect(Array.isArray(res.body.scores)).toBe(true);
        expect(res.body.scores).toHaveLength(2);
        expect(res.body.scores[0]).toHaveProperty('score', 0.5);
        expect(res.body.scores[0].predictionToken).toMatch(
            /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
        );
        expect(mockEvaluateOnlineAuc).toHaveBeenCalledTimes(1);
        expect(mockRollbackToPrevious).not.toHaveBeenCalled();
    });

    it('błąd diagnostyki AUC nie blokuje poprawnej predykcji', async () => {
        mockGetActiveModel.mockResolvedValue({
            id: 'model-v1',
            version: 'v1.0.0-test',
            weights: new Array(29).fill(0.1),
            bias: 0,
            featureMins: new Array(29).fill(0),
            featureMaxs: new Array(29).fill(1)
        });
        mockPredict.mockReturnValue(0.7);
        mockEvaluateOnlineAuc.mockRejectedValue(new Error('diagnostic unavailable'));
        const { logger } = (await import('../../src/utils/logger')) as any;

        const payload = {
            candidates: [{ id: 10, wellId: 'well-diagnostic', features: new Array(29).fill(0.5) }]
        };
        const sendPrediction = () =>
            request(app)
                .post('/api/telemetry/ai/predict/batch')
                .set({ 'x-test-userid': 'userA' })
                .send(payload);
        const [res, repeatedRes] = await Promise.all([sendPrediction(), sendPrediction()]);

        expect(res.status).toBe(200);
        expect(repeatedRes.status).toBe(200);
        expect(res.body.scores[0]).toMatchObject({ score: 0.7 });
        expect(res.body.scores[0].predictionToken).toMatch(
            /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
        );
        expect(mockRollbackToPrevious).not.toHaveBeenCalled();
        expect(logger.error).toHaveBeenCalledWith(
            'AiPredictBatchRoute',
            expect.stringContaining('Online AUC diagnostic failed')
        );
        expect(logger.error).toHaveBeenCalledTimes(1);
    });

    it('odrzuca zły wymiar cech przed wywołaniem diagnostyki AUC', async () => {
        mockGetActiveModel.mockResolvedValue({
            id: 'model-v1',
            version: 'v1.0.0-test',
            weights: new Array(29).fill(0.1),
            bias: 0,
            featureMins: new Array(29).fill(0),
            featureMaxs: new Array(29).fill(1)
        });

        const res = await request(app)
            .post('/api/telemetry/ai/predict/batch')
            .set({ 'x-test-userid': 'userA' })
            .send({ candidates: [{ id: 11, features: [0.5] }] });

        expect(res.status).toBe(400);
        expect(mockEvaluateOnlineAuc).not.toHaveBeenCalled();
        expect(mockRollbackToPrevious).not.toHaveBeenCalled();
    });

    it('batch predict z cache: drugi identyczny request dostaje cached: true', async () => {
        resetMetrics();
        mockGetActiveModel.mockResolvedValue({
            id: 'model-v1',
            version: 'v1.0.0-test',
            weights: new Array(29).fill(0.1),
            bias: 0,
            featureMins: new Array(29).fill(0),
            featureMaxs: new Array(29).fill(1)
        });
        mockPredict.mockReturnValue(0.42);

        const payload = {
            candidates: [
                {
                    id: 7,
                    features: [
                        1600, 3200, 1, 0, 0, 1, 0, 0, 0, 5, 3, 2, 4100, 7200, 4, 1, 1, 1, 8000, 0,
                        0, 0, 1, 0, 3, 500, 0, 1500, 750
                    ]
                }
            ]
        };

        const first = await request(app).post('/api/telemetry/ai/predict/batch').send(payload);
        expect(first.status).toBe(200);
        expect(first.body.scores[0].score).toBe(0.42);
        expect(first.body.scores[0]).not.toHaveProperty('cached');

        const second = await request(app).post('/api/telemetry/ai/predict/batch').send(payload);
        expect(second.status).toBe(200);
        expect(second.body.scores[0]).toHaveProperty('cached', true);
        expect(second.body.scores[0].score).toBe(0.42);
        expect(getMetricsSnapshot().ai.predictions.byOutcome.success).toBe(2);
        expect(getMetricsSnapshot().ai.inference.n).toBe(1);
    });

    it('P0.5 guard: brak flagi (null) → 503 OFF fail-closed', async () => {
        const prismaMock = (await import('../../src/prismaClient')).default as any;
        (prismaMock.settings.findUnique as jest.Mock<any>).mockResolvedValueOnce(null);
        const res = await request(app)
            .post('/api/telemetry/ai/predict/batch')
            .send({
                candidates: [{ id: 1, features: new Array(29).fill(0.5) }]
            });
        expect(res.status).toBe(503);
        expect(mockEvaluateOnlineAuc).not.toHaveBeenCalled();
    });
});

describe('GET /api/telemetry/ai/feature-importance', () => {
    let app: express.Application;

    beforeEach(async () => {
        jest.clearAllMocks();
        const { default: router } = await import('../../src/routes/telemetryAiMl');
        app = express();
        app.use(express.json());
        app.use('/api/telemetry', router);
    });

    it('zwraca 200 z malejącą listą cech gdy model aktywny', async () => {
        mockGetActiveModel.mockResolvedValue({
            id: 'model-v1',
            version: 'v1.0.0',
            weights: [0.5, -0.2, 0.1, 0.9, 0.3],
            bias: 0,
            features: ['a', 'b', 'c', 'd', 'e'],
            featureMins: [0, 0, 0, 0, 0],
            featureMaxs: [10, 10, 10, 10, 10],
            trainingRows: 20
        });
        mockComputeFeatureImportance.mockReturnValue([
            { featureName: 'd', importance: 9 },
            { featureName: 'a', importance: 5 },
            { featureName: 'e', importance: 3 },
            { featureName: 'b', importance: 2 },
            { featureName: 'c', importance: 1 }
        ]);

        const res = await request(app).get('/api/telemetry/ai/feature-importance');

        expect(res.status).toBe(200);
        expect(res.body).toHaveProperty('modelVersion', 'v1.0.0');
        expect(res.body.features).toHaveLength(5);
        expect(res.body.features[0].featureName).toBe('d');
        expect(res.body.features[0].importance).toBeGreaterThan(res.body.features[1].importance);
    });

    it('zwraca 503 gdy brak aktywnego modelu', async () => {
        mockGetActiveModel.mockResolvedValue(null);

        const res = await request(app).get('/api/telemetry/ai/feature-importance');

        expect(res.status).toBe(503);
        expect(res.body).toHaveProperty('error');
    });
});

describe('GET /api/telemetry/ai/health', () => {
    let app: express.Application;

    beforeEach(async () => {
        jest.clearAllMocks();
        const { default: router } = await import('../../src/routes/telemetryAiMl');
        app = express();
        app.use(express.json());
        app.use('/api/telemetry', router);
    });

    it('zwraca 200 i podstawowe pola gdy ML online', async () => {
        mockGetActiveModel.mockResolvedValue({
            id: 'model-v1',
            version: 'v1.0.0',
            metrics: {
                accuracy: 0.85,
                precision: 0.8,
                recall: 0.9,
                f1: 0.85,
                rocAuc: 0.82,
                trainSize: 100,
                valSize: 25
            },
            featureMins: [800, 500, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
            featureMaxs: [
                2000, 4000, 1, 1, 1, 1, 1, 1, 1, 20, 15, 15, 5000, 10000, 10, 3, 1, 1, 20000, 1
            ]
        });
        mockTelemetryLogsCount.mockResolvedValue(10);
        mockTelemetryLogsFindMany.mockResolvedValue([]);

        const res = await request(app).get('/api/telemetry/ai/health');

        expect(res.status).toBe(200);
        expect(res.body).toHaveProperty('mlOnline', true);
        expect(res.body).toHaveProperty('driftPct');
        expect(res.body).toHaveProperty('dataQuality');
        expect(res.body.dataQuality).toHaveProperty('totalLogs', 10);
    });

    it('zwraca świeżość z DB i zagregowane kategorie fallback z ostatnich 24h', async () => {
        const latestTelemetryAt = '2026-11-27T10:00:00.000Z';
        const latestFeatureAt = '2026-11-27T09:30:00.000Z';
        const prisma = (await import('../../src/prismaClient')).default as any;
        mockTelemetryLogsFindFirst.mockResolvedValue({ createdAt: latestTelemetryAt });
        prisma.aiFeature.findFirst.mockResolvedValue({ createdAt: latestFeatureAt });
        prisma.ai_telemetry_events.groupBy.mockResolvedValue([
            { changeReason: 'timeout', _count: { _all: 2 } },
            { changeReason: 'network_error', _count: { _all: 1 } },
            { changeReason: 'private-unexpected', _count: { _all: 99 } }
        ]);
        prisma.audit_logs.findMany.mockResolvedValue([
            { newData: JSON.stringify({ result: 'compatible', packageFingerprint: 'private-a' }) },
            { newData: JSON.stringify({ result: 'warning', modelVersion: 'private-v1' }) },
            { newData: JSON.stringify({ result: 'blocked' }) },
            { newData: '{invalid' }
        ]);

        const { default: router } = await import('../../src/routes/telemetryAiMl');
        const app = express();
        app.use(express.json());
        app.use('/api/telemetry', router);
        const res = await request(app).get('/api/telemetry/ai/health').expect(200);

        expect(res.body.dataFreshness).toEqual({
            lastTelemetryAt: latestTelemetryAt,
            lastFeatureAt: latestFeatureAt
        });
        expect(res.body.fallbacks24h).toEqual({
            total: 102,
            byReason: {
                timeout: 2,
                http_error: 0,
                empty_response: 0,
                partial_response: 0,
                network_error: 1,
                unspecified: 99
            }
        });
        expect(res.body.compatibility24h).toEqual({
            total: 4,
            truncated: false,
            byStatus: { compatible: 1, warning: 1, blocked: 1, unknown: 1 }
        });
        expect(JSON.stringify(res.body.compatibility24h)).not.toContain('private-');
        expect(prisma.audit_logs.findMany).toHaveBeenCalledWith(
            expect.objectContaining({
                where: expect.objectContaining({
                    entityType: 'ai_transfer',
                    action: 'TRANSFER_DRY_RUN',
                    createdAt: { gte: expect.any(String) }
                }),
                take: 501,
                select: { newData: true }
            })
        );
        expect(prisma.ai_telemetry_events.groupBy).toHaveBeenCalledWith(
            expect.objectContaining({
                by: ['changeReason'],
                where: expect.objectContaining({
                    eventType: 'fallback_triggered',
                    createdAt: { gte: expect.any(String) },
                    OR: expect.arrayContaining([
                        { changeReason: { in: expect.any(Array) } },
                        { changeReason: null }
                    ])
                })
            })
        );
        expect(mockTelemetryLogsFindFirst).toHaveBeenCalledWith(
            expect.objectContaining({ where: { createdAt: { not: null } } })
        );
    });

    it('nie psuje health gdy opcjonalne agregaty operacyjne są niedostępne', async () => {
        const prisma = (await import('../../src/prismaClient')).default as any;
        mockGetActiveModel.mockResolvedValue(null);
        mockTelemetryLogsCount.mockResolvedValue(0);
        mockTelemetryLogsFindFirst.mockResolvedValue(null);
        prisma.aiFeature.findFirst.mockResolvedValue(null);
        prisma.ai_telemetry_events.groupBy.mockRejectedValue(new Error('private-db-detail'));
        prisma.audit_logs.findMany.mockRejectedValue(new Error('private-audit-detail'));

        const { default: router } = await import('../../src/routes/telemetryAiMl');
        const app = express();
        app.use(express.json());
        app.use('/api/telemetry', router);
        const res = await request(app).get('/api/telemetry/ai/health').expect(200);

        expect(res.body.fallbacks24h).toBeNull();
        expect(res.body.compatibility24h).toBeNull();
        expect(JSON.stringify(res.body)).not.toContain('private-db-detail');
        expect(JSON.stringify(res.body)).not.toContain('private-audit-detail');
    });

    it('zwraca driftPct=null gdy brak aktywnego modelu', async () => {
        mockGetActiveModel.mockResolvedValue(null);

        const res = await request(app).get('/api/telemetry/ai/health');

        expect(res.status).toBe(200);
        expect(res.body).toHaveProperty('mlOnline', false);
        expect(res.body.driftPct).toBeNull();
    });

    it('model startowy bez próbek nie ma daty treningu ani pomiaru driftu', async () => {
        const prisma = (await import('../../src/prismaClient')).default as any;
        mockTelemetryLogsFindFirst.mockResolvedValue(null);
        prisma.aiFeature.findFirst.mockResolvedValue(null);
        prisma.ai_telemetry_events.groupBy.mockResolvedValue([]);
        prisma.audit_logs.findMany.mockResolvedValue([]);
        mockGetActiveModel.mockResolvedValue({
            version: 'v0.1.0-starter',
            trainingRows: 0,
            featureMins: [0],
            featureMaxs: [0]
        });
        const res = await request(app).get('/api/telemetry/ai/health').expect(200);
        expect(res.body).toMatchObject({
            mlOnline: true,
            modelTrained: false,
            lastTrainingAt: null,
            driftPct: null,
            dataFreshness: { lastTelemetryAt: null, lastFeatureAt: null },
            fallbacks24h: {
                total: 0,
                byReason: {
                    timeout: 0,
                    http_error: 0,
                    empty_response: 0,
                    partial_response: 0,
                    network_error: 0,
                    unspecified: 0
                }
            },
            compatibility24h: {
                total: 0,
                truncated: false,
                byStatus: { compatible: 0, warning: 0, blocked: 0, unknown: 0 }
            }
        });
    });

    it('zwraca driftPct=0 gdy wszystkie cechy w zakresie', async () => {
        mockGetActiveModel.mockResolvedValue({
            id: 'model-v1',
            version: 'v1.0.0',
            trainingRows: 100,
            metrics: {
                accuracy: 0.85,
                precision: 0.8,
                recall: 0.9,
                f1: 0.85,
                rocAuc: 0.82,
                trainSize: 100,
                valSize: 25
            },
            featureMins: [800, 500, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
            featureMaxs: [
                2000, 4000, 1, 1, 1, 1, 1, 1, 1, 20, 15, 15, 5000, 10000, 10, 3, 1, 1, 20000, 1
            ]
        });
        mockTelemetryLogsCount.mockResolvedValue(3);
        mockTelemetryLogsFindMany.mockResolvedValue([
            { featureSnapshot: JSON.stringify({ totalPrice: 2500, totalWeight: 5000 }) },
            { featureSnapshot: JSON.stringify({ totalPrice: 1500, totalWeight: 3000 }) },
            { featureSnapshot: JSON.stringify({ totalPrice: 3000, totalWeight: 6000 }) }
        ]);

        const res = await request(app).get('/api/telemetry/ai/health');

        expect(res.status).toBe(200);
        expect(res.body.driftPct).toBe(0);
    });

    it('zwraca driftPct>0 gdy ceny poza zakresem treningowym', async () => {
        mockGetActiveModel.mockResolvedValue({
            id: 'model-v1',
            version: 'v1.0.0',
            trainingRows: 100,
            metrics: {
                accuracy: 0.85,
                precision: 0.8,
                recall: 0.9,
                f1: 0.85,
                rocAuc: 0.82,
                trainSize: 100,
                valSize: 25
            },
            featureMins: [800, 500, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
            featureMaxs: [
                2000, 4000, 1, 1, 1, 1, 1, 1, 1, 20, 15, 15, 5000, 10000, 10, 3, 1, 1, 20000, 1
            ]
        });
        mockTelemetryLogsCount.mockResolvedValue(1);
        mockTelemetryLogsFindMany.mockResolvedValue([
            { featureSnapshot: JSON.stringify({ totalPrice: 9999, totalWeight: 5000 }) }
        ]);

        const res = await request(app).get('/api/telemetry/ai/health');

        expect(res.status).toBe(200);
        expect(res.body.driftPct).toBeGreaterThan(0);
    });
});

describe('POST /api/telemetry/ai/reward', () => {
    let app: express.Application;

    beforeEach(async () => {
        jest.clearAllMocks();
        mockProcessAction.mockImplementation(applyRewardTransaction);
        const { default: router } = await import('../../src/routes/telemetryAiMl');
        app = express();
        app.use(express.json());
        app.use('/api/telemetry', router);
    });

    it('zwraca 404 WELL_NOT_FOUND gdy wellId nie ma telemetrii (blokada reward farmingu)', async () => {
        mockTelemetryLogsFindFirst.mockResolvedValue(null);

        const res = await request(app).post('/api/telemetry/ai/reward').send({
            action: 'ACCEPT',
            wellId: 'well-fake-999',
            scoreBefore: 0.9,
            scoreAfter: 0.95,
            wasAiRanked: true
        });

        expect(res.status).toBe(404);
        expect(res.body).toHaveProperty('error', 'WELL_NOT_FOUND');
    });

    it('odrzuca Infinity/NaN w dn/scoreBefore/scoreAfter (finite)', async () => {
        const { rewardSchema } = await import('../../src/routes/telemetryAiMl');
        for (const v of [Infinity, -Infinity, NaN]) {
            expect(rewardSchema.safeParse({ action: 'ACCEPT', wellId: 'w1', dn: v }).success).toBe(
                false
            );
            expect(
                rewardSchema.safeParse({ action: 'ACCEPT', wellId: 'w1', scoreBefore: v }).success
            ).toBe(false);
            expect(
                rewardSchema.safeParse({ action: 'ACCEPT', wellId: 'w1', scoreAfter: v }).success
            ).toBe(false);
        }
    });

    it('zwraca 400 gdy scoreBefore poza zakresem [0,1]', async () => {
        const res = await request(app).post('/api/telemetry/ai/reward').send({
            action: 'ACCEPT',
            wellId: 'well-fake-999',
            scoreBefore: 1.5,
            wasAiRanked: true
        });

        expect(res.status).toBe(400);
        expect(res.body).toHaveProperty('error');
    });

    it('zwraca 400 gdy brak wymaganego wellId', async () => {
        const res = await request(app).post('/api/telemetry/ai/reward').send({
            action: 'ACCEPT',
            scoreBefore: 0.9,
            wasAiRanked: true
        });

        expect(res.status).toBe(400);
        expect(res.body).toHaveProperty('error');
    });

    it('ignoruje duplikat reward dla tej samej pary (wellId, action) — anti-poisoning', async () => {
        resetMetrics();
        mockTelemetryLogsFindFirst.mockResolvedValue({ id: 'log-1' });
        mockProcessAction.mockResolvedValue({ applied: false });

        const res = await request(app).post('/api/telemetry/ai/reward').send({
            action: 'ACCEPT',
            wellId: 'well-existing-1',
            scoreBefore: 0.9,
            wasAiRanked: true
        });

        expect(res.status).toBe(200);
        expect(res.body).toEqual({ status: 'ok', duplicate: true });
        expect(mockRecordPredictionResult).not.toHaveBeenCalled();
        expect(getMetricsSnapshot().ai.rewards.byOutcome.duplicate).toBe(1);
    });

    it('ACCEPT z tokenem serwerowym i wlascicielem allowlisty rejestruje AUC', async () => {
        mockTelemetryLogsFindFirst.mockResolvedValue({
            id: 'log-1',
            userId: 'userA',
            trainingEligible: true
        });
        clearPredictionCache();
        const predictionToken = issuePredictionProof('userA', 'well-1', 0.9, 'model-v1');

        const res = await request(app)
            .post('/api/telemetry/ai/reward')
            .set({ 'x-test-userid': 'userA' })
            .send({
                action: 'ACCEPT',
                wellId: 'well-1',
                scoreBefore: 0.9,
                wasAiRanked: true,
                predictionToken
            });

        expect(res.status).toBe(200);
        expect(res.body).toEqual({ status: 'ok' });
        expect(mockProcessAction).toHaveBeenCalledWith(
            expect.objectContaining({
                action: 'ACCEPT',
                wellId: 'well-1',
                scoreBefore: 0.9,
                wasAiRanked: true,
                verifiedPrediction: expect.objectContaining({
                    score: 0.9,
                    modelVersion: 'model-v1',
                    verifiedAt: expect.any(String)
                })
            }),
            expect.any(Function)
        );
        expect(mockRecordPredictionResult).toHaveBeenCalledWith(1, 0.9, 'model-v1');
    });

    it('nie zapisuje feedbacku bez pochodzenia, gdy proof jest już przetwarzany', async () => {
        mockTelemetryLogsFindFirst.mockResolvedValue({
            id: 'log-1',
            userId: 'userA',
            trainingEligible: true
        });
        clearPredictionCache();
        const predictionToken = issuePredictionProof('userA', 'well-busy-proof', 0.7, 'model-v1');
        const claim = claimPredictionProof(predictionToken, 'userA', 'well-busy-proof', 0.7);
        const response = await request(app)
            .post('/api/telemetry/ai/reward')
            .set({ 'x-test-userid': 'userA' })
            .send({
                action: 'ACCEPT',
                wellId: 'well-busy-proof',
                scoreBefore: 0.7,
                wasAiRanked: true,
                predictionToken
            });

        expect(claim).not.toBeNull();
        expect(response.status).toBe(500);
        expect(mockProcessAction).not.toHaveBeenCalled();
        expect(releasePredictionProof(predictionToken, claim!.claimId)).toBe(true);
    });

    it('zużywa proof także przy duplikacie, aby nie mógł zasilać innej akcji', async () => {
        mockTelemetryLogsFindFirst.mockResolvedValue({
            id: 'log-1',
            userId: 'userA',
            trainingEligible: true
        });
        mockProcessAction.mockResolvedValue({ applied: false });
        clearPredictionCache();
        const predictionToken = issuePredictionProof(
            'userA',
            'well-duplicate-proof',
            0.7,
            'model-v1'
        );

        const response = await request(app)
            .post('/api/telemetry/ai/reward')
            .set({ 'x-test-userid': 'userA' })
            .send({
                action: 'ACCEPT',
                wellId: 'well-duplicate-proof',
                scoreBefore: 0.7,
                wasAiRanked: true,
                predictionToken
            });

        expect(response.status).toBe(200);
        expect(response.body).toEqual({ status: 'ok', duplicate: true });
        expect(
            claimPredictionProof(predictionToken, 'userA', 'well-duplicate-proof', 0.7)
        ).toBeNull();
    });

    it('błąd diagnostyki AUC po zapisie feedbacku nie blokuje odpowiedzi sukcesu', async () => {
        mockTelemetryLogsFindFirst.mockResolvedValue({
            id: 'log-1',
            userId: 'userA',
            trainingEligible: true
        });
        mockRecordPredictionResult.mockImplementationOnce(() => {
            throw new Error('diagnostic unavailable');
        });
        clearPredictionCache();
        const predictionToken = issuePredictionProof('userA', 'well-auc-error', 0.7, 'model-v1');

        const response = await request(app)
            .post('/api/telemetry/ai/reward')
            .set({ 'x-test-userid': 'userA' })
            .send({
                action: 'ACCEPT',
                wellId: 'well-auc-error',
                scoreBefore: 0.7,
                wasAiRanked: true,
                predictionToken
            });

        expect(response.status).toBe(200);
        expect(response.body).toEqual({ status: 'ok' });
        expect(mockProcessAction).toHaveBeenCalled();
    });

    it('po błędzie zapisu feedbacku pozwala ponowić ten sam proof bez utraty pochodzenia', async () => {
        mockTelemetryLogsFindFirst.mockResolvedValue({
            id: 'log-1',
            userId: 'userA',
            trainingEligible: true
        });
        mockProcessAction
            .mockRejectedValueOnce(new Error('database unavailable'))
            .mockResolvedValueOnce({ applied: true });
        clearPredictionCache();
        const predictionToken = issuePredictionProof('userA', 'well-retry', 0.7, 'model-v1');
        const payload = {
            action: 'ACCEPT',
            wellId: 'well-retry',
            scoreBefore: 0.7,
            wasAiRanked: true,
            predictionToken
        };

        const failedResponse = await request(app)
            .post('/api/telemetry/ai/reward')
            .set({ 'x-test-userid': 'userA' })
            .send(payload);
        const retryResponse = await request(app)
            .post('/api/telemetry/ai/reward')
            .set({ 'x-test-userid': 'userA' })
            .send(payload);

        expect(failedResponse.status).toBe(500);
        expect(retryResponse.status).toBe(200);
        expect(mockProcessAction).toHaveBeenNthCalledWith(
            2,
            expect.objectContaining({
                verifiedPrediction: expect.objectContaining({
                    score: 0.7,
                    modelVersion: 'model-v1'
                })
            }),
            expect.any(Function)
        );
    });

    it('nie rejestruje predykcji z tokenem wydanym innemu uzytkownikowi', async () => {
        mockTelemetryLogsFindFirst.mockResolvedValue({
            id: 'log-1',
            userId: 'userA',
            trainingEligible: true
        });
        clearPredictionCache();
        const predictionToken = issuePredictionProof('userB', 'well-1', 0.9, 'model-v1');

        const res = await request(app)
            .post('/api/telemetry/ai/reward')
            .set({ 'x-test-userid': 'userA' })
            .send({
                action: 'ACCEPT',
                wellId: 'well-1',
                scoreBefore: 0.9,
                wasAiRanked: true,
                predictionToken
            });

        expect(res.status).toBe(200);
        expect(mockRecordPredictionResult).not.toHaveBeenCalled();
    });

    it('nie rejestruje predykcji dla wlasciciela spoza allowlisty treningowej', async () => {
        mockTelemetryLogsFindFirst.mockResolvedValue({
            id: 'log-1',
            userId: 'userB',
            trainingEligible: true
        });
        clearPredictionCache();
        const predictionToken = issuePredictionProof('userB', 'well-1', 0.9, 'model-v1');

        const res = await request(app)
            .post('/api/telemetry/ai/reward')
            .set({ 'x-test-userid': 'userB' })
            .send({
                action: 'ACCEPT',
                wellId: 'well-1',
                scoreBefore: 0.9,
                wasAiRanked: true,
                predictionToken
            });

        expect(res.status).toBe(200);
        expect(mockRecordPredictionResult).not.toHaveBeenCalled();
    });

    it('nie rejestruje predykcji gdy brak tokenu serwerowego', async () => {
        mockTelemetryLogsFindFirst.mockResolvedValue({ id: 'log-1' });
        clearPredictionCache();

        const res = await request(app).post('/api/telemetry/ai/reward').send({
            action: 'ACCEPT',
            wellId: 'well-1',
            scoreBefore: 0.9,
            wasAiRanked: true
        });

        expect(res.status).toBe(200);
        expect(mockRecordPredictionResult).not.toHaveBeenCalled();
    });

    it('MODIFY synchronizuje etykiete MODIFIED na najnowszym rekordzie telemetrii', async () => {
        mockTelemetryLogsFindFirst
            .mockResolvedValueOnce({ id: 'log-1', userId: 'userA', trainingEligible: true })
            .mockResolvedValueOnce({ id: 'latest-log', userId: 'userA', offerId: null });
        clearPredictionCache();
        const predictionToken = issuePredictionProof('userA', 'well-1', 0.8, 'model-v1');

        const res = await request(app)
            .post('/api/telemetry/ai/reward')
            .set({ 'x-test-userid': 'userA' })
            .send({
                action: 'MODIFY',
                wellId: 'well-1',
                scoreBefore: 0.8,
                scoreAfter: 0.6,
                wasAiRanked: true,
                predictionToken
            });

        expect(res.status).toBe(200);
        expect(mockRewardTelemetryUpdate).toHaveBeenCalledWith({
            where: { id: 'latest-log' },
            data: { wasModified: true }
        });
        expect(mockUpdateLabelByTelemetry).toHaveBeenCalledWith(
            'latest-log',
            'MODIFIED',
            mockRewardTransaction
        );
        expect(mockRecordPredictionResult).toHaveBeenCalledWith(0, 0.8, 'model-v1');
    });

    it('REJECT synchronizuje etykiete REJECTED i rejestruje predykcje negatywna', async () => {
        // Routing zamiast Once-queue (clearAllMocks nie czyści bazowych
        // mockResolvedValue z wcześniejszych testów — Once by się rozjechał).
        mockTelemetryLogsFindFirst.mockImplementation(async (args: any) => {
            if (args?.where?.id || args?.where?.solverSource) {
                return { id: 'latest-log', userId: 'userA', offerId: null };
            }
            return { id: 'log-1', userId: 'userA', trainingEligible: true };
        });
        clearPredictionCache();
        const predictionToken = issuePredictionProof('userA', 'well-1', 0.95, 'model-v1');

        const res = await request(app)
            .post('/api/telemetry/ai/reward')
            .set({ 'x-test-userid': 'userA' })
            .send({
                action: 'REJECT',
                wellId: 'well-1',
                scoreBefore: 0.95,
                wasAiRanked: true,
                predictionToken
            });

        expect(res.status).toBe(200);
        expect(mockRewardTelemetryUpdate).toHaveBeenCalledWith({
            where: { id: 'latest-log' },
            data: { wasRejected: true }
        });
        expect(mockUpdateLabelByTelemetry).toHaveBeenCalledWith(
            'latest-log',
            'REJECTED',
            mockRewardTransaction
        );
        expect(mockRecordPredictionResult).toHaveBeenCalledWith(0, 0.95, 'model-v1');
    });

    it('ACCEPT bez wasAiRanked nie rejestruje predykcji (sliding AUC)', async () => {
        mockTelemetryLogsFindFirst.mockResolvedValue({ id: 'log-1' });
        clearPredictionCache();

        const res = await request(app).post('/api/telemetry/ai/reward').send({
            action: 'ACCEPT',
            wellId: 'well-1'
        });

        expect(res.status).toBe(200);
        expect(mockRecordPredictionResult).not.toHaveBeenCalled();
    });
});

describe('GET /api/telemetry/ai/well-selections', () => {
    let app: express.Application;

    beforeEach(async () => {
        jest.clearAllMocks();
        const { default: router } = await import('../../src/routes/telemetryAiMl');
        app = express();
        app.use(express.json());
        app.use('/api/telemetry', router);
    });

    it('agreguje po wellId, sortuje po lastSeenAt desc i limituje findMany do 500', async () => {
        mockTelemetryLogsFindMany.mockResolvedValue([
            {
                wellId: 'well-1',
                dn: 'DN1000',
                warehouse: 'W1',
                aiVersion: 'v1',
                createdAt: '2026-09-20T10:00:00.000Z'
            },
            {
                wellId: 'well-1',
                dn: 'DN1000',
                warehouse: 'W1',
                aiVersion: 'v1',
                createdAt: '2026-09-21T10:00:00.000Z'
            },
            {
                wellId: 'well-2',
                dn: 'DN800',
                warehouse: 'W2',
                aiVersion: 'v1',
                createdAt: '2026-09-19T10:00:00.000Z'
            }
        ]);

        const res = await request(app).get('/api/telemetry/ai/well-selections');

        expect(res.status).toBe(200);
        expect(mockTelemetryLogsFindMany).toHaveBeenCalledWith(
            expect.objectContaining({
                where: { solverSource: 'AI_SUGGEST' },
                orderBy: { createdAt: 'desc' },
                take: 500
            })
        );
        expect(res.body).toEqual({
            totalWells: 2,
            totalSelections: 3,
            items: [
                expect.objectContaining({
                    wellId: 'well-1',
                    count: 2,
                    lastSeenAt: '2026-09-21T10:00:00.000Z'
                }),
                expect.objectContaining({ wellId: 'well-2', count: 1 })
            ]
        });
    });

    it('pomija logi bez wellId', async () => {
        mockTelemetryLogsFindMany.mockResolvedValue([
            { wellId: null, dn: null, warehouse: null, aiVersion: null, createdAt: null }
        ]);

        const res = await request(app).get('/api/telemetry/ai/well-selections');

        expect(res.status).toBe(200);
        expect(res.body).toEqual({ totalWells: 0, totalSelections: 0, items: [] });
    });
});

describe('POST /ai/reward ownership (P1 gate na ownerze targetu)', () => {
    let app: express.Application;

    beforeEach(async () => {
        jest.clearAllMocks();
        mockProcessAction.mockImplementation(applyRewardTransaction);
        const { default: router } = await import('../../src/routes/telemetryAiMl');
        app = express();
        app.use(express.json());
        app.use('/api/telemetry', router);
    });

    function asUser(userId: string, role = 'user') {
        return { 'x-test-userid': userId, 'x-test-role': role };
    }

    // well-exists (where.wellId bez where.id/solverSource) vs target — routing jak w route.
    function mockTarget(
        target: { id: string; userId: string | null; offerId?: string | null } | null
    ) {
        mockTelemetryLogsFindFirst.mockImplementation(async (args: any) => {
            if (args?.where?.id || args?.where?.solverSource) return target;
            return { id: 'log-w' };
        });
    }

    it('obcy REJECT na cudza sugestie → 403 FORBIDDEN, zero zapisow', async () => {
        mockTarget({ id: 'tel-b', userId: 'userB' });

        const res = await request(app)
            .post('/api/telemetry/ai/reward')
            .set(asUser('userA'))
            .send({ action: 'REJECT', wellId: 'well-1' });

        expect(res.status).toBe(403);
        expect(res.body).toEqual({ error: 'FORBIDDEN' });
        expect(mockProcessAction).not.toHaveBeenCalled();
        expect(mockRewardTelemetryUpdate).not.toHaveBeenCalled();
        expect(mockUpdateLabelByTelemetry).not.toHaveBeenCalled();
    });

    it('target-owner, nie wellId: cel B przy wlasnej sugestii A → 403', async () => {
        // parentConfigId wskazuje wprost sugestie B (A ma tez wlasna — gate patrzy na target).
        mockTarget({ id: 'tel-b', userId: 'userB' });

        const res = await request(app)
            .post('/api/telemetry/ai/reward')
            .set(asUser('userA'))
            .send({ action: 'REJECT', wellId: 'well-mixed', parentConfigId: 'tel-b' });

        expect(res.status).toBe(403);
        expect(mockRewardTelemetryUpdate).not.toHaveBeenCalled();
        expect(mockUpdateLabelByTelemetry).not.toHaveBeenCalled();
    });

    it('wlasny REJECT → 200 jak dotad (flaga + label na wlasnej sugestii)', async () => {
        mockTarget({ id: 'tel-a', userId: 'userA' });

        const res = await request(app)
            .post('/api/telemetry/ai/reward')
            .set(asUser('userA'))
            .send({ action: 'REJECT', wellId: 'well-1' });

        expect(res.status).toBe(200);
        expect(res.body).toEqual({ status: 'ok' });
        expect(mockProcessAction).toHaveBeenCalled();
        expect(mockRewardTelemetryUpdate).toHaveBeenCalledWith({
            where: { id: 'tel-a' },
            data: { wasRejected: true }
        });
        expect(mockUpdateLabelByTelemetry).toHaveBeenCalledWith(
            'tel-a',
            'REJECTED',
            mockRewardTransaction
        );
    });

    it('obcy MODIFY cudzej sugestii → 403 FORBIDDEN, zero zapisow (P1.1)', async () => {
        mockTarget({ id: 'tel-b', userId: 'userB' });

        const res = await request(app)
            .post('/api/telemetry/ai/reward')
            .set(asUser('userA'))
            .send({ action: 'MODIFY', wellId: 'well-1' });

        expect(res.status).toBe(403);
        expect(res.body).toEqual({ error: 'FORBIDDEN' });
        expect(mockProcessAction).not.toHaveBeenCalled();
        expect(mockUpdateLabelByTelemetry).not.toHaveBeenCalled();
    });

    it('legacy target z oferta innego wlasciciela → 403 przed zapisem', async () => {
        mockTarget({ id: 'tel-legacy', userId: null, offerId: 'offer-b' });
        const prisma = (await import('../../src/prismaClient')).default as any;
        prisma.offers_studnie_rel.findUnique.mockResolvedValue({ userId: 'userB' });

        const res = await request(app)
            .post('/api/telemetry/ai/reward')
            .set(asUser('userA'))
            .send({ action: 'REJECT', wellId: 'well-1' });

        expect(res.status).toBe(403);
        expect(mockProcessAction).not.toHaveBeenCalled();
        expect(mockRewardTelemetryUpdate).not.toHaveBeenCalled();
        expect(mockUpdateLabelByTelemetry).not.toHaveBeenCalled();
    });

    it('batch mieszany: wlasny applied, cudzy FORBIDDEN', async () => {
        // Batch prefetch: findMany routowane po where (existence vs parents vs sugestie).
        mockTelemetryLogsFindMany.mockImplementation(async (args: any) => {
            if (args?.where?.id?.in)
                return [
                    { id: 'tel-a', wellId: 'well-own', userId: 'userA' },
                    { id: 'tel-b', wellId: 'well-alien', userId: 'userB' }
                ];
            if (args?.where?.solverSource) return [];
            return [{ wellId: 'well-own' }, { wellId: 'well-alien' }];
        });
        mockTelemetryLogsFindFirst.mockImplementation(async (args: any) => {
            // resolveRewardTarget pyta po where.id (= parentConfigId z itemu).
            if (args?.where?.id === 'tel-b') return { id: 'tel-b', userId: 'userB' };
            if (args?.where?.id) return { id: 'tel-a', userId: 'userA' };
            return { id: 'log-w' };
        });

        const res = await request(app)
            .post('/api/telemetry/ai/reward-batch')
            .set(asUser('userA'))
            .send({
                items: [
                    { action: 'REJECT', wellId: 'well-own', parentConfigId: 'tel-a' },
                    { action: 'REJECT', wellId: 'well-alien', parentConfigId: 'tel-b' }
                ]
            });

        expect(res.status).toBe(200);
        expect(res.body.applied).toEqual(['well-own']);
        expect(res.body.rejected).toEqual([{ wellId: 'well-alien', reason: 'FORBIDDEN' }]);
        // Prefetch zamiast N× findFirst: zero odczytów per-item w batchu.
        expect(mockTelemetryLogsFindFirst).not.toHaveBeenCalled();
    });
});
