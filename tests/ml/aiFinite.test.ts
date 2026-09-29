import { describe, expect, it, jest, beforeEach } from '@jest/globals';
import request from 'supertest';
import express from 'express';
import {
    clearPredictionCache,
    predictionCacheSize,
    getWellScore
} from '../../src/services/ml/predictionCache';
import {
    offerItemSchema,
    wellComponentSchema,
    wellDataSchema
} from '../../src/validators/offerSchemas';
import {
    ruryOfferExportItemSchema,
    studnieOfferExportItemSchema
} from '../../src/validators/orderSchemas';

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
    READ_LIMITER: (_req: any, _res: any, next: any) => next(),
    TELEMETRY_WRITE_LIMITER: (_req: any, _res: any, next: any) => next()
}));

const mockGetActiveModel = jest.fn<any>();

jest.mock('../../src/services/ml/ModelRegistry', () => ({
    modelRegistry: {
        getActiveModel: (...args: any[]) => mockGetActiveModel(...args),
        getModelCount: jest.fn<any>().mockResolvedValue(0),
        computeFeatureImportance: jest.fn<any>().mockResolvedValue([]),
        rollbackToPrevious: jest.fn<any>().mockResolvedValue(null)
    }
}));

jest.mock('../../src/services/ml/TrainingPipeline', () => ({
    trainingPipeline: {
        run: jest.fn<any>().mockResolvedValue({ trained: false }),
        getStatus: jest.fn<any>().mockReturnValue({ running: false }),
        gateStatus: jest.fn<any>().mockResolvedValue(null)
    }
}));

jest.mock('../../src/services/ml/SelfEvaluation', () => ({
    selfEvaluation: {
        checkAndRollbackIfNeeded: jest.fn<any>().mockResolvedValue({ rolledBack: false }),
        recordPredictionResult: jest.fn<any>()
    }
}));

jest.mock('../../src/services/ml/RewardCalculator', () => ({
    rewardCalculator: {
        processAction: jest.fn<any>().mockResolvedValue({ applied: true })
    }
}));

jest.mock('../../src/services/ml/FeatureExtractor', () => ({
    featureExtractor: {
        updateLabelByTelemetry: jest.fn<any>().mockResolvedValue(undefined),
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

jest.mock('../../src/prismaClient', () => ({
    __esModule: true,
    default: {
        settings: {
            findUnique: jest.fn<any>().mockResolvedValue({
                key: 'feature_ai_ml_enabled',
                value: '"1"'
            })
        },
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
            findMany: jest.fn<any>().mockResolvedValue([]),
            count: jest.fn<any>().mockResolvedValue(0),
            findFirst: jest.fn<any>().mockResolvedValue(null),
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

const FEATS = (fill = 0.5): number[] => new Array(29).fill(fill);

function mockModel(): void {
    mockGetActiveModel.mockResolvedValue({
        id: 'model-v1',
        version: 'v1.0.0-test',
        weights: new Array(29).fill(0.1),
        bias: 0,
        featureMins: new Array(29).fill(0),
        featureMaxs: new Array(29).fill(1)
    });
}

describe('aiFinite: NaN/Inf nie wchodzi ani nie wychodzi z /ai/predict/batch', () => {
    let app: express.Application;

    beforeEach(async () => {
        jest.clearAllMocks();
        clearPredictionCache();
        const { default: router } = await import('../../src/routes/telemetryAiMl');
        app = express();
        app.use(express.json());
        app.use('/api/telemetry', router);
    });

    it('non-finite w features (JSON: null) → 400, zero cache, model nie wołany', async () => {
        mockModel();
        const res = await request(app)
            .post('/api/telemetry/ai/predict/batch')
            .send({
                candidates: [
                    { id: 1, wellId: 'well-finite-1', features: [...FEATS().slice(0, 28), null] }
                ]
            });
        expect(res.status).toBe(400);
        expect(mockPredict).not.toHaveBeenCalled();
        expect(predictionCacheSize()).toBe(0);
        expect(getWellScore('well-finite-1')).toBeUndefined();
    });

    it('model zwraca NaN → 422, zero wpisu cache, ranking nietknięty', async () => {
        mockModel();
        mockPredict.mockReturnValue(NaN);
        const res = await request(app)
            .post('/api/telemetry/ai/predict/batch')
            .send({
                candidates: [{ id: 1, wellId: 'well-nan-1', features: FEATS() }]
            });
        expect(res.status).toBe(422);
        expect(res.body).toMatchObject({ error: 'NON_FINITE_SCORE', candidateId: 1 });
        expect(res.body).not.toHaveProperty('scores');
        expect(predictionCacheSize()).toBe(0);
        expect(getWellScore('well-nan-1')).toBeUndefined();
    });

    it('model zwraca Infinity → 422, zero wpisu cache', async () => {
        mockModel();
        mockPredict.mockReturnValue(Infinity);
        const res = await request(app)
            .post('/api/telemetry/ai/predict/batch')
            .send({ candidates: [{ id: 2, features: FEATS(0.7) }] });
        expect(res.status).toBe(422);
        expect(predictionCacheSize()).toBe(0);
    });

    it('atomowość: drugi kandydat psuje → pierwszy też nie ląduje w cache', async () => {
        mockModel();
        const f1 = FEATS();
        const f2 = [...FEATS()];
        f2[0] = 0.9;
        mockPredict.mockReturnValueOnce(0.5).mockReturnValueOnce(NaN);
        const res = await request(app)
            .post('/api/telemetry/ai/predict/batch')
            .send({
                candidates: [
                    { id: 1, wellId: 'well-atom-1', features: f1 },
                    { id: 2, wellId: 'well-atom-2', features: f2 }
                ]
            });
        expect(res.status).toBe(422);
        expect(predictionCacheSize()).toBe(0);
        expect(getWellScore('well-atom-1')).toBeUndefined();
        expect(getWellScore('well-atom-2')).toBeUndefined();
    });

    it('valid bez zmian: 200, score, cache i ranking działają', async () => {
        mockModel();
        mockPredict.mockReturnValue(0.7);
        const res = await request(app)
            .post('/api/telemetry/ai/predict/batch')
            .send({
                candidates: [{ id: 1, wellId: 'well-ok-1', features: FEATS() }]
            });
        expect(res.status).toBe(200);
        expect(res.body.scores[0]).toMatchObject({ id: 1, score: 0.7 });
        expect(predictionCacheSize()).toBe(1);
        expect(getWellScore('well-ok-1')).toBe(0.7);
    });
});

describe('aiFinite: rabaty 0-100 finite (oferty + zamówienia)', () => {
    it.each([offerItemSchema, wellComponentSchema, wellDataSchema])(
        'rabat valid przechodzi, >100/<0/NaN/Inf odpada',
        (schema) => {
            const base =
                schema === offerItemSchema
                    ? { productId: 'p1', quantity: 1 }
                    : schema === wellComponentSchema
                      ? {}
                      : {};
            expect(schema.safeParse({ ...base, discount: 50 }).success).toBe(true);
            expect(schema.safeParse({ ...base }).success).toBe(true);
            expect(schema.safeParse({ ...base, discount: 101 }).success).toBe(false);
            expect(schema.safeParse({ ...base, discount: -1 }).success).toBe(false);
            expect(schema.safeParse({ ...base, discount: NaN }).success).toBe(false);
            expect(schema.safeParse({ ...base, discount: Infinity }).success).toBe(false);
        }
    );

    it('rabaty eksportu zamówień: 0-100 + null, >100 odpada', () => {
        const ruryBase = { productId: 'p1', name: 'Rura', unitPrice: 10, quantity: 1 };
        const studnieBase = { productName: 'S1', quantity: 1, price: 10 };
        expect(ruryOfferExportItemSchema.safeParse({ ...ruryBase, discount: 20 }).success).toBe(
            true
        );
        expect(
            studnieOfferExportItemSchema.safeParse({ ...studnieBase, discount: 20 }).success
        ).toBe(true);
        expect(ruryOfferExportItemSchema.safeParse({ ...ruryBase, discount: 101 }).success).toBe(
            false
        );
        expect(
            studnieOfferExportItemSchema.safeParse({ ...studnieBase, discount: 101 }).success
        ).toBe(false);
        // null/'' z formularzy → brak rabatu (jak dotąd)
        expect(ruryOfferExportItemSchema.safeParse({ ...ruryBase, discount: null }).success).toBe(
            true
        );
    });
});
