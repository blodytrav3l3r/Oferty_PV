import { describe, expect, it, jest, beforeEach } from '@jest/globals';
import request from 'supertest';
import express from 'express';
import { setWellScore, clearPredictionCache } from '../../src/services/ml/predictionCache';

jest.mock('../../src/utils/logger', () => ({
    logger: {
        info: jest.fn(),
        warn: jest.fn(),
        error: jest.fn()
    }
}));

jest.mock('../../src/middleware/auth', () => ({
    requireAuth: (_req: any, _res: any, next: any) => next(),
    requireAdmin: (_req: any, _res: any, next: any) => next()
}));

jest.mock('../../src/middleware/rateLimiters', () => ({
    WRITE_LIMITER: (_req: any, _res: any, next: any) => next(),
    READ_LIMITER: (_req: any, _res: any, next: any) => next()
}));

const mockGetActiveModel = jest.fn<any>();
const mockGetModelCount = jest.fn<any>().mockResolvedValue(0);
const mockComputeFeatureImportance = jest.fn<any>().mockResolvedValue([]);
const mockRollbackToPrevious = jest.fn<any>().mockResolvedValue(null);

jest.mock('../../src/services/ml/ModelRegistry', () => ({
    modelRegistry: {
        getActiveModel: (...args: any[]) => mockGetActiveModel(...args),
        getModelCount: (...args: any[]) => mockGetModelCount(...args),
        computeFeatureImportance: (...args: any[]) => mockComputeFeatureImportance(...args),
        rollbackToPrevious: (...args: any[]) => mockRollbackToPrevious(...args)
    }
}));

jest.mock('../../src/services/telemetry/learning/KnowledgeBase', () => ({
    KnowledgeBase: class {}
}));

const mockRecommendForDn = jest.fn<any>().mockResolvedValue([]);

jest.mock('../../src/services/telemetry/learning', () => ({
    recommendationEngine: {
        recommendForDn: (...args: any[]) => mockRecommendForDn(...args)
    }
}));

const mockGetStatus = jest.fn<any>().mockReturnValue({ running: false });
const mockCheckAndRollback = jest
    .fn<any>()
    .mockResolvedValue({ rolledBack: false, slidingAuc: null });
const mockRecordPredictionResult = jest.fn<any>();

jest.mock('../../src/services/ml/TrainingPipeline', () => ({
    trainingPipeline: {
        run: jest.fn<any>().mockResolvedValue({ trained: false }),
        getStatus: (...args: any[]) => mockGetStatus(...args)
    }
}));

jest.mock('../../src/services/ml/SelfEvaluation', () => ({
    selfEvaluation: {
        checkAndRollbackIfNeeded: (...args: any[]) => mockCheckAndRollback(...args),
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
        aiFeature: {
            findMany: jest.fn<any>().mockResolvedValue([]),
            count: jest.fn<any>().mockResolvedValue(0)
        },
        aiModel: {
            findFirst: jest.fn<any>(),
            findUnique: jest.fn<any>(),
            create: jest.fn<any>()
        },
        ai_telemetry_logs: {
            findMany: (...args: any[]) => mockTelemetryLogsFindMany(...args),
            count: (...args: any[]) => mockTelemetryLogsCount(...args),
            findFirst: (...args: any[]) => mockTelemetryLogsFindFirst(...args),
            update: jest.fn<any>().mockResolvedValue({})
        },
        aiRewardLog: {
            count: jest.fn<any>().mockResolvedValue(0)
        }
    }
}));

jest.mock('../../src/services/auditService', () => ({
    logAudit: jest.fn()
}));

describe('POST /api/telemetry/ai/predict/batch', () => {
    let app: express.Application;

    beforeEach(async () => {
        jest.clearAllMocks();
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

        const res = await request(app)
            .post('/api/telemetry/ai/predict/batch')
            .send({
                candidates: [
                    {
                        id: 1,
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
    });

    it('batch predict z cache: drugi identyczny request dostaje cached: true', async () => {
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
            featureMaxs: [10, 10, 10, 10, 10]
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

    it('zwraca driftPct=null gdy brak aktywnego modelu', async () => {
        mockGetActiveModel.mockResolvedValue(null);

        const res = await request(app).get('/api/telemetry/ai/health');

        expect(res.status).toBe(200);
        expect(res.body).toHaveProperty('mlOnline', false);
        expect(res.body.driftPct).toBeNull();
    });

    it('zwraca driftPct=0 gdy wszystkie cechy w zakresie', async () => {
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
        const { default: router } = await import('../../src/routes/telemetryAiMl');
        app = express();
        app.use(express.json());
        app.use('/api/telemetry', router);
    });

    it('zwraca 400 WELL_NOT_FOUND gdy wellId nie ma telemetrii (blokada reward farmingu)', async () => {
        mockTelemetryLogsFindFirst.mockResolvedValue(null);

        const res = await request(app).post('/api/telemetry/ai/reward').send({
            action: 'ACCEPT',
            wellId: 'well-fake-999',
            scoreBefore: 0.9,
            scoreAfter: 0.95,
            wasAiRanked: true
        });

        expect(res.status).toBe(400);
        expect(res.body).toHaveProperty('error', 'WELL_NOT_FOUND');
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
    });

    it('ACCEPT z wasAiRanked zapisuje nagrode i rejestruje predykcje (1, serwerowy score)', async () => {
        mockTelemetryLogsFindFirst.mockResolvedValue({ id: 'log-1' });
        mockProcessAction.mockResolvedValue({ applied: true });
        clearPredictionCache();
        setWellScore('well-1', 0.9);

        const res = await request(app).post('/api/telemetry/ai/reward').send({
            action: 'ACCEPT',
            wellId: 'well-1',
            scoreBefore: 0.9,
            wasAiRanked: true
        });

        expect(res.status).toBe(200);
        expect(res.body).toEqual({ status: 'ok' });
        expect(mockProcessAction).toHaveBeenCalledWith(
            expect.objectContaining({
                action: 'ACCEPT',
                wellId: 'well-1',
                scoreBefore: 0.9,
                wasAiRanked: true
            })
        );
        expect(mockRecordPredictionResult).toHaveBeenCalledWith(1, 0.9);
    });

    it('nie rejestruje predykcji gdy kliencki scoreBefore nie zgadza sie z serwerowym (anti-poisoning)', async () => {
        mockTelemetryLogsFindFirst.mockResolvedValue({ id: 'log-1' });
        clearPredictionCache();
        setWellScore('well-1', 0.9);

        const res = await request(app).post('/api/telemetry/ai/reward').send({
            action: 'ACCEPT',
            wellId: 'well-1',
            scoreBefore: 0.01,
            wasAiRanked: true
        });

        expect(res.status).toBe(200);
        expect(mockRecordPredictionResult).not.toHaveBeenCalled();
    });

    it('nie rejestruje predykcji gdy brak serwerowego score dla wellId (studnia nie przeszla przez AI)', async () => {
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
            .mockResolvedValueOnce({ id: 'log-1' }) // telemetryWell
            .mockResolvedValueOnce({ id: 'latest-log' }); // najnowszy rekord studni
        mockProcessAction.mockResolvedValue({ applied: true });
        clearPredictionCache();
        setWellScore('well-1', 0.8);

        const res = await request(app).post('/api/telemetry/ai/reward').send({
            action: 'MODIFY',
            wellId: 'well-1',
            scoreBefore: 0.8,
            scoreAfter: 0.6,
            wasAiRanked: true
        });

        expect(res.status).toBe(200);
        expect(mockUpdateLabelByTelemetry).toHaveBeenCalledWith('latest-log', 'MODIFIED');
        expect(mockRecordPredictionResult).toHaveBeenCalledWith(0, 0.8);
    });

    it('REJECT synchronizuje etykiete REJECTED i rejestruje predykcje negatywna', async () => {
        mockTelemetryLogsFindFirst
            .mockResolvedValueOnce({ id: 'log-1' }) // telemetryWell
            .mockResolvedValueOnce({ id: 'latest-log' }); // najnowszy rekord studni
        mockProcessAction.mockResolvedValue({ applied: true });
        clearPredictionCache();
        setWellScore('well-1', 0.95);

        const res = await request(app).post('/api/telemetry/ai/reward').send({
            action: 'REJECT',
            wellId: 'well-1',
            scoreBefore: 0.95,
            wasAiRanked: true
        });

        expect(res.status).toBe(200);
        expect(mockUpdateLabelByTelemetry).toHaveBeenCalledWith('latest-log', 'REJECTED');
        expect(mockRecordPredictionResult).toHaveBeenCalledWith(0, 0.95);
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

describe('GET /api/telemetry/ai/kb-suggestions', () => {
    let app: express.Application;

    beforeEach(async () => {
        jest.clearAllMocks();
        const { default: router } = await import('../../src/routes/telemetryAiMl');
        app = express();
        app.use(express.json());
        app.use('/api/telemetry', router);
    });

    it('zwraca sugestie z bazy wiedzy dla DN', async () => {
        mockRecommendForDn.mockResolvedValue([
            {
                pattern: {
                    patternKey: '1000|sub|DDD-1000-500->DDD-1000-600',
                    patternType: 'dennica_swap',
                    description: 'Substitution DDD-1000-500 -> DDD-1000-600 w 1000',
                    confidence: 0.6,
                    hitCount: 4,
                    recommendation: {
                        removed: 'DDD-1000-500',
                        added: 'DDD-1000-600',
                        type: 'substitution'
                    }
                },
                score: 0.7
            }
        ]);

        const res = await request(app).get('/api/telemetry/ai/kb-suggestions?dn=1000');

        expect(res.status).toBe(200);
        expect(res.body.suggestions).toHaveLength(1);
        expect(res.body.suggestions[0]).toMatchObject({
            patternType: 'dennica_swap',
            confidence: 0.6,
            recommendation: { removed: 'DDD-1000-500', added: 'DDD-1000-600', type: 'substitution' }
        });
        expect(mockRecommendForDn).toHaveBeenCalledWith(expect.objectContaining({ dn: '1000' }), 5);
    });

    it('zwraca pustą listę gdy baza wiedzy pusta', async () => {
        mockRecommendForDn.mockResolvedValue([]);

        const res = await request(app).get('/api/telemetry/ai/kb-suggestions?dn=1000');

        expect(res.status).toBe(200);
        expect(res.body.suggestions).toEqual([]);
    });
});
