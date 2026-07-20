import { describe, expect, it, jest, beforeEach } from '@jest/globals';
import request from 'supertest';
import express from 'express';

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
    WRITE_LIMITER: (_req: any, _res: any, next: any) => next()
}));

const mockGetActiveModel = jest.fn<any>();
const mockGetModelCount = jest.fn<any>().mockResolvedValue(0);

jest.mock('../../src/services/ml/ModelRegistry', () => ({
    modelRegistry: {
        getActiveModel: (...args: any[]) => mockGetActiveModel(...args),
        getModelCount: (...args: any[]) => mockGetModelCount(...args)
    }
}));

jest.mock('../../src/services/telemetry/learning/KnowledgeBase', () => ({}));

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
            count: (...args: any[]) => mockTelemetryLogsCount(...args)
        },
        aiRewardLog: {
            count: jest.fn<any>().mockResolvedValue(0)
        }
    }
}));

jest.mock('../../src/services/auditService', () => ({
    logAudit: jest.fn()
}));

describe('POST /api/telemetry/ai/predict', () => {
    let app: express.Application;

    beforeEach(async () => {
        jest.clearAllMocks();
        const { default: router } = await import('../../src/routes/telemetryAiMl');
        app = express();
        app.use(express.json());
        app.use('/api/telemetry', router);
    });

    it('zwraca 200 i score z aktywnego modelu dla 15 cech', async () => {
        mockGetActiveModel.mockResolvedValue({
            id: 'model-v1',
            version: 'v1.0.0-test',
            weights: [
                0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9, 1.0, 1.1, 1.2, 1.3, 1.4, 1.5, 0, 0, 0,
                0, 0
            ],
            bias: 0.5,
            featureMins: [800, 500, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
            featureMaxs: [
                2000, 4000, 1, 1, 1, 1, 1, 1, 1, 20, 15, 15, 5000, 10000, 10, 3, 1, 1, 20000, 1
            ]
        });
        mockPredict.mockReturnValue(0.73);

        const res = await request(app)
            .post('/api/telemetry/ai/predict')
            .send({
                features: [
                    1000, 3000, 1, 0, 1, 0, 0, 0, 0, 3, 2, 1, 2500, 5000, 3, 1, 1, 1, 3000, 1
                ],
                wellType: 'standard',
                warehouse: 'KLB',
                dn: 1000,
                featureVersion: 'v5'
            });

        expect(res.status).toBe(200);
        expect(res.body).toHaveProperty('scores');
        expect(Array.isArray(res.body.scores)).toBe(true);
        expect(res.body.scores[0]).toHaveProperty('score', 0.73);
        expect(res.body.scores[0]).toHaveProperty('version', 'v1.0.0-test');
        expect(res.body).toHaveProperty('cached', false);
    });

    it('zwraca 400 dla zlej liczby cech (nie 15)', async () => {
        const res = await request(app)
            .post('/api/telemetry/ai/predict')
            .send({ features: [1, 2, 3] });

        expect(res.status).toBe(400);
        expect(res.body).toHaveProperty('error');
    });

    it('zwraca 400 gdy brakuje features', async () => {
        const res = await request(app)
            .post('/api/telemetry/ai/predict')
            .send({ wellType: 'standard' });

        expect(res.status).toBe(400);
    });

    it('zwraca 503 gdy brak aktywnego modelu', async () => {
        mockGetActiveModel.mockResolvedValue(null);

        const res = await request(app)
            .post('/api/telemetry/ai/predict')
            .send({
                features: [
                    1000, 3000, 1, 0, 1, 0, 0, 0, 0, 3, 2, 1, 2500, 5000, 3, 1, 1, 1, 3000, 1
                ]
            });

        expect(res.status).toBe(503);
        expect(res.body).toHaveProperty('error');
    });

    it('przyjmuje batch predict z wieloma kandydatami', async () => {
        mockGetActiveModel.mockResolvedValue({
            id: 'model-v1',
            version: 'v1.0.0-test',
            weights: new Array(20).fill(0.1),
            bias: 0,
            featureMins: new Array(20).fill(0),
            featureMaxs: new Array(20).fill(1)
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
                            1
                        ]
                    },
                    {
                        id: 2,
                        features: [
                            1200, 3500, 0, 1, 0, 1, 0, 0, 0, 4, 3, 2, 3000, 6000, 4, 1, 0, 1, 4200,
                            0
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
