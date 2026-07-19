/**
 * Testy modułu TrainingPipeline i FeatureExtractor.
 */

import { describe, expect, it, jest, beforeEach } from '@jest/globals';
import { AcceptanceModel } from '../../src/services/ml/AcceptanceModel';

const mockFindMany = jest.fn<any>();
const mockFindFirst = jest.fn<any>();
const mockCreate = jest.fn<any>();
const mockCount = jest.fn<any>();

jest.mock('../../src/prismaClient', () => ({
    __esModule: true,
    default: {
        ai_telemetry_logs: { findMany: (...args: any[]) => mockFindMany(...args) },
        aiFeature: {
            findFirst: (...args: any[]) => mockFindFirst(...args),
            findMany: (...args: any[]) => mockFindMany(...args),
            create: (...args: any[]) => mockCreate(...args),
            count: (...args: any[]) => mockCount(...args)
        },
        aiModel: {
            findFirst: (...args: any[]) => mockFindFirst(...args),
            findUnique: jest.fn<any>(),
            findMany: jest.fn<any>(),
            create: jest.fn<any>(),
            update: jest.fn<any>(),
            count: jest.fn<any>()
        },
        aiRewardLog: { count: jest.fn<any>().mockResolvedValue(0) },
        users: { update: jest.fn<any>() }
    }
}));

jest.mock('../../src/utils/logger', () => ({
    logger: {
        info: jest.fn(),
        warn: jest.fn(),
        error: jest.fn()
    }
}));

describe('FeatureExtractor', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    it('extract() tworzy poprawny FeatureVector z rekordu telemetry', async () => {
        const { featureExtractor } = await import('../../src/services/ml/FeatureExtractor');

        const record = {
            id: 'test-1',
            dn: '1500',
            warehouse: 'KLB',
            wellType: 'standard',
            wellHeight: 3000,
            ringCount: 3,
            wasAccepted: true,
            wasRejected: false,
            wasModified: false,
            modificationCount: 0,
            totalPrice: 2500,
            totalWeight: 5000,
            allComponentIds: JSON.stringify([
                { productId: 'KDB-1500-1000' },
                { productId: 'KDB-1500-1000' },
                { productId: 'DDD-1500-500' }
            ]),
            appliedReductions: null,
            appliedKonus: JSON.stringify([{ productId: 'KNS-1500-500' }]),
            appliedSeals: JSON.stringify([{ productId: 'USZ-1500' }]),
            createdAt: '2026-07-01T12:00:00Z',
            solverSource: 'AUTO_JS',
            trainingEligible: true
        };

        const fv = featureExtractor.extract(record as any);

        expect(fv.dn).toBe(1500);
        expect(fv.heightMm).toBe(3000);
        expect(fv.warehouse).toBe('KLB');
        expect(fv.wellType).toBe('standard');
        expect(fv.hasReduction).toBe(false);
        expect(fv.hasPsiaBuda).toBe(false);
        expect(fv.hasStyczna).toBe(false);
        expect(fv.ringCount).toBeGreaterThanOrEqual(2);
        expect(fv.connectionCount).toBe(1);
        expect(fv.totalPrice).toBe(2500);
        expect(fv.totalWeight).toBe(5000);
        expect(fv.label).toBe('ACCEPTED');
        expect(fv.reward).toBe(1.0);
        expect(fv.season).toBe('summer');
    });

    it('extract() oznacza odrzucone jako REJECTED z reward=-1.0', async () => {
        const { featureExtractor } = await import('../../src/services/ml/FeatureExtractor');

        const fv = featureExtractor.extract({
            id: 'test-2',
            dn: '1200',
            warehouse: 'WL',
            wellType: 'psia_buda',
            wasAccepted: false,
            wasRejected: true,
            wasModified: false,
            allComponentIds: null,
            appliedReductions: null,
            appliedKonus: null,
            appliedSeals: null,
            createdAt: '2026-07-01T12:00:00Z',
            solverSource: 'AUTO_JS'
        } as any);

        expect(fv.label).toBe('REJECTED');
        expect(fv.reward).toBe(-1.0);
        expect(fv.wellType).toBe('psia_buda');
    });
});

describe('AcceptanceModel trening', () => {
    it('model potrafi odróżnić dobre od złych konfiguracji', () => {
        const model = new AcceptanceModel(3);

        const dataset = [
            { features: [1000, 500, 2], label: 1, weight: 1 },
            { features: [1200, 600, 3], label: 1, weight: 1 },
            { features: [1000, 400, 1], label: 1, weight: 1 },
            { features: [5000, 3000, 10], label: 0, weight: 1 },
            { features: [4000, 2500, 8], label: 0, weight: 1 },
            { features: [6000, 3500, 12], label: 0, weight: 1 }
        ];

        model.train(dataset, 0.01, 10000);

        const goodScore = model.predict([1000, 500, 2]);
        const badScore = model.predict([5000, 3000, 10]);

        expect(goodScore).toBeGreaterThan(0.5);
        expect(badScore).toBeLessThan(0.5);
        expect(goodScore).toBeGreaterThan(badScore);
    });

    it('forgetting krzywa zanika wykładniczo', () => {
        const lambda = 0.01;
        const ageDays = 69;
        const weight = Math.exp(-lambda * ageDays);
        expect(weight).toBeCloseTo(0.5, 1);

        const oldWeight = Math.exp(-lambda * 365);
        expect(oldWeight).toBeLessThan(0.03);

        const freshWeight = Math.exp(-lambda * 1);
        expect(freshWeight).toBeGreaterThan(0.99);
    });
});

describe('ModelRegistry', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    it('saveModel tworzy wpis w bazie', async () => {
        const { modelRegistry } = await import('../../src/services/ml/ModelRegistry');
        const { default: prisma } = await import('../../src/prismaClient');
        const createSpy = jest.fn<any>().mockResolvedValue({ id: 'saved-id' });
        (prisma.aiModel as any).create = createSpy;
        (prisma.aiModel as any).findFirst = jest.fn<any>().mockResolvedValue(null);

        const model = new AcceptanceModel(2);
        const version = await modelRegistry.saveModel(
            model,
            {
                accuracy: 0.95,
                precision: 0.94,
                recall: 0.93,
                f1: 0.93,
                rocAuc: 0.92,
                trainSize: 100,
                valSize: 25
            },
            ['dn', 'heightMm'],
            [0, 0],
            [2000, 5000],
            true
        );

        expect(version).toContain('v1.0.0-');
        expect(createSpy).toHaveBeenCalledTimes(1);
    });
});
