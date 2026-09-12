import { describe, expect, it, jest, beforeEach } from '@jest/globals';
import request from 'supertest';
import express from 'express';
import { setWellScore, clearPredictionCache } from '../../src/services/ml/predictionCache';
import prisma from '../../src/prismaClient';

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

const mockGetStatus = jest.fn<any>().mockReturnValue({ running: false });
const mockCheckAndRollback = jest
    .fn<any>()
    .mockResolvedValue({ rolledBack: false, slidingAuc: null });
const mockRecordPredictionResult = jest.fn<any>();

jest.mock('../../src/services/ml/TrainingPipeline', () => ({
    trainingPipeline: {
        run: jest.fn<any>().mockResolvedValue({ trained: false }),
        getStatus: (...args: any[]) => mockGetStatus(...args),
        gateStatus: jest.fn<any>().mockResolvedValue(null)
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
        // Routing zamiast Once-queue (clearAllMocks nie czyści bazowych
        // mockResolvedValue z wcześniejszych testów — Once by się rozjechał).
        mockTelemetryLogsFindFirst.mockImplementation(async (args: any) => {
            if (args?.where?.id || args?.where?.solverSource) {
                return { id: 'latest-log', userId: 'userA' };
            }
            return { id: 'log-1' };
        });
        mockProcessAction.mockResolvedValue({ applied: true });
        clearPredictionCache();
        setWellScore('well-1', 0.95);

        const res = await request(app)
            .post('/api/telemetry/ai/reward')
            .set({ 'x-test-userid': 'userA' })
            .send({
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

describe('POST /ai/reward ownership (P1 gate na ownerze targetu)', () => {
    let app: express.Application;

    beforeEach(async () => {
        jest.clearAllMocks();
        mockProcessAction.mockResolvedValue({ applied: true });
        const { default: router } = await import('../../src/routes/telemetryAiMl');
        app = express();
        app.use(express.json());
        app.use('/api/telemetry', router);
    });

    function asUser(userId: string, role = 'user') {
        return { 'x-test-userid': userId, 'x-test-role': role };
    }

    // well-exists (where.wellId bez where.id/solverSource) vs target — routing jak w route.
    function mockTarget(target: { id: string; userId: string | null } | null) {
        mockTelemetryLogsFindFirst.mockImplementation(async (args: any) => {
            if (args?.where?.id || args?.where?.solverSource) return target;
            return { id: 'log-w' };
        });
    }

    const telemetryUpdate = () => (prisma.ai_telemetry_logs as any).update as jest.Mock;

    it('obcy REJECT na cudza sugestie → 403 FORBIDDEN, zero zapisow', async () => {
        mockTarget({ id: 'tel-b', userId: 'userB' });

        const res = await request(app)
            .post('/api/telemetry/ai/reward')
            .set(asUser('userA'))
            .send({ action: 'REJECT', wellId: 'well-1' });

        expect(res.status).toBe(403);
        expect(res.body).toEqual({ error: 'FORBIDDEN' });
        expect(mockProcessAction).not.toHaveBeenCalled();
        expect(telemetryUpdate()).not.toHaveBeenCalled();
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
        expect(telemetryUpdate()).not.toHaveBeenCalled();
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
        expect(telemetryUpdate()).toHaveBeenCalledWith(
            expect.objectContaining({ where: { id: 'tel-a' } })
        );
        expect(mockUpdateLabelByTelemetry).toHaveBeenCalledWith('tel-a', 'REJECTED');
    });

    it('obcy MODIFY bez zmian → 200 (zakres: tylko REJECT gateowany)', async () => {
        mockTarget({ id: 'tel-b', userId: 'userB' });

        const res = await request(app)
            .post('/api/telemetry/ai/reward')
            .set(asUser('userA'))
            .send({ action: 'MODIFY', wellId: 'well-1' });

        expect(res.status).toBe(200);
        expect(mockProcessAction).toHaveBeenCalled();
    });

    it('batch mieszany: wlasny applied, cudzy FORBIDDEN', async () => {
        mockTelemetryLogsFindMany.mockResolvedValue([
            { wellId: 'well-own' },
            { wellId: 'well-alien' }
        ]);
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
    });
});
