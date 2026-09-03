import { describe, expect, it, jest, beforeEach } from '@jest/globals';
import { isAiMlFlagOn, requireAiMlEnabled, AI_ML_FLAG_KEY } from '../src/middleware/aiMlGuard';
import aiMlRouter from '../src/routes/telemetryAiMl';
import aiDashboardRouter from '../src/routes/telemetryAiDashboard';

jest.mock('../src/utils/logger', () => ({
    logger: {
        info: jest.fn(),
        error: jest.fn(),
        warn: jest.fn()
    }
}));

const mockFindUnique = jest.fn<any>();
jest.mock('../src/prismaClient', () => ({
    __esModule: true,
    default: {
        settings: {
            findUnique: (...args: unknown[]) => (mockFindUnique as any)(...args)
        },
        aiRewardLog: { count: jest.fn<any>().mockResolvedValue(0) },
        aiFeature: {
            groupBy: jest.fn<any>().mockResolvedValue([]),
            count: jest.fn<any>().mockResolvedValue(0)
        },
        aiTrainingRun: { findFirst: jest.fn<any>().mockResolvedValue(null) },
        aiModel: { findFirst: jest.fn<any>().mockResolvedValue(null) },
        ai_telemetry_logs: {
            count: jest.fn<any>().mockResolvedValue(0),
            findMany: jest.fn<any>().mockResolvedValue([]),
            findFirst: jest.fn<any>().mockResolvedValue(null)
        }
    }
}));

jest.mock('../src/services/ml/ModelRegistry', () => ({
    modelRegistry: {
        getActiveModel: jest.fn<any>().mockResolvedValue(null),
        getModelCount: jest.fn<any>().mockResolvedValue(0),
        listModels: jest.fn<any>().mockResolvedValue([]),
        computeFeatureImportance: jest.fn<any>().mockReturnValue([])
    }
}));

jest.mock('../src/services/ml/TrainingPipeline', () => ({
    trainingPipeline: {
        getStatus: jest.fn<any>().mockReturnValue({ running: false }),
        run: jest.fn<any>().mockResolvedValue({ trained: false })
    }
}));

jest.mock('../src/services/ml/FeatureExtractor', () => ({
    featureExtractor: {
        getFeatureCount: jest.fn<any>().mockResolvedValue(0)
    }
}));

jest.mock('../src/services/ml/RewardCalculator', () => ({
    rewardCalculator: { processAction: jest.fn<any>().mockResolvedValue({ applied: true }) }
}));

jest.mock('../src/services/ml/SelfEvaluation', () => ({
    selfEvaluation: { recordPredictionResult: jest.fn() }
}));

jest.mock('../src/services/ml/predictionCache', () => ({
    cacheKey: jest.fn(),
    setCache: jest.fn(),
    getCached: jest.fn(),
    clearPredictionCache: jest.fn(),
    predictionCacheSize: jest.fn<any>().mockReturnValue(0),
    setWellScore: jest.fn(),
    getWellScore: jest.fn<any>().mockReturnValue(undefined)
}));

jest.mock('../src/services/auditService', () => ({
    logAudit: jest.fn<any>().mockResolvedValue(undefined)
}));

jest.mock('../src/services/telemetry/learning', () => ({
    learningEngine: {
        runFullCycle: jest.fn<any>().mockResolvedValue({}),
        getStatus: jest.fn<any>().mockResolvedValue({ lastRunAt: null })
    }
}));

jest.mock('../src/services/telemetry/learning/KnowledgeBase', () => ({
    KnowledgeBase: jest.fn().mockImplementation(() => ({
        getPatternsForDn: jest.fn<any>().mockResolvedValue([]),
        countPatterns: jest.fn<any>().mockResolvedValue(0),
        getStats: jest.fn<any>().mockResolvedValue({})
    }))
}));

/** Ścieżki mutujące/wykonujące — MUSZĄ mieć guard (żaden nie może go ominąć). */
const BLOCK_PATHS = [
    'POST /ai/predict/batch',
    'POST /ai/reward',
    'DELETE /ai/models/:id',
    'POST /ai/models/:id/activate',
    'POST /ai/models/:id/promote',
    'POST /ai/models/:id/approve',
    'POST /ai/train',
    'POST /ai/rollback',
    'POST /ai/learning/run'
];

function routeLayers(router: any) {
    return (router.stack || [])
        .filter((l: any) => l.route)
        .map((l: any) => ({
            key: `${Object.keys(l.route.methods)[0].toUpperCase()} ${l.route.path}`,
            fns: (l.route.stack || []).map((s: any) => s.name || s.handle?.name || '?')
        }));
}

function hasGuard(router: any, key: string): boolean {
    const hit = routeLayers(router).find((r: any) => r.key === key);
    return !!hit && hit.fns.includes('requireAiMlEnabled');
}

describe('aiMlGuard — semantyka flagi', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    it('brak rekordu = ON (backward compatible)', () => {
        expect(isAiMlFlagOn(null)).toBe(true);
        expect(isAiMlFlagOn(undefined)).toBe(true);
    });

    it('OFF tylko dla "0"/cytowanego "0"', () => {
        expect(isAiMlFlagOn({ value: '"0"' })).toBe(false);
        expect(isAiMlFlagOn({ value: '0' })).toBe(false);
        expect(isAiMlFlagOn({ value: '"1"' })).toBe(true);
        expect(isAiMlFlagOn({ value: '1' })).toBe(true);
    });

    it('OFF -> 503 {error:disabled}, next nie wołane', async () => {
        (mockFindUnique as any).mockResolvedValue({ value: '"0"' });
        const next = jest.fn();
        let status = 0;
        let body: unknown = null;
        const res: any = {
            status: (c: number) => {
                status = c;
                return { json: (b: unknown) => (body = b) };
            }
        };
        await (requireAiMlEnabled as any)({}, res, next);
        expect(status).toBe(503);
        expect(body).toEqual({ error: 'disabled' });
        expect(next).not.toHaveBeenCalled();
        expect(mockFindUnique).toHaveBeenCalledWith({
            where: { key: AI_ML_FLAG_KEY }
        });
    });

    it('ON -> next(), brak 503', async () => {
        (mockFindUnique as any).mockResolvedValue({ value: '"1"' });
        const next = jest.fn();
        const res: any = { status: jest.fn() };
        await (requireAiMlEnabled as any)({}, res, next);
        expect(next).toHaveBeenCalled();
    });
});

describe('aiMlGuard — pokrycie wszystkich endpointów BLOCK', () => {
    it.each(BLOCK_PATHS)('%s ma requireAiMlEnabled', (key) => {
        const [method, ...rest] = key.split(' ');
        const path = rest.join(' ');
        const inMl = hasGuard(aiMlRouter, `${method} ${path}`);
        const inDash = hasGuard(aiDashboardRouter, `${method} ${path}`);
        expect(inMl || inDash).toBe(true);
    });
});
