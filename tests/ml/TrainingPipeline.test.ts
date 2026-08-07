/**
 * Testy modułu TrainingPipeline i FeatureExtractor.
 */

import { describe, expect, it, jest, beforeEach } from '@jest/globals';
import { AcceptanceModel } from '../../src/services/ml/AcceptanceModel';

const mockFindMany = jest.fn<any>();
const mockFindFirst = jest.fn<any>();
const mockCreate = jest.fn<any>();
const mockCount = jest.fn<any>();
const mockUpdate = jest.fn<any>();
const mockUpdateMany = jest.fn<any>();

jest.mock('../../src/prismaClient', () => ({
    __esModule: true,
    default: {
        ai_telemetry_logs: { findMany: (...args: any[]) => mockFindMany(...args) },
        aiFeature: {
            findFirst: (...args: any[]) => mockFindFirst(...args),
            findMany: (...args: any[]) => mockFindMany(...args),
            create: (...args: any[]) => mockCreate(...args),
            update: (...args: any[]) => mockUpdate(...args),
            updateMany: (...args: any[]) => mockUpdateMany(...args),
            count: (...args: any[]) => mockCount(...args)
        },
        aiModel: {
            findFirst: (...args: any[]) => mockFindFirst(...args),
            findUnique: jest.fn<any>(),
            // saveModel woła pruneOldModels — findMany/deleteMany muszą mieć sensowne odpowiedzi
            findMany: jest.fn<any>().mockResolvedValue([]),
            create: jest.fn<any>(),
            update: jest.fn<any>(),
            count: jest.fn<any>(),
            deleteMany: jest.fn<any>().mockResolvedValue({ count: 0 })
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

    it('updateLabelByTelemetry ustawia etykiete negatywna (REJECTED) w aiFeature', async () => {
        const { featureExtractor } = await import('../../src/services/ml/FeatureExtractor');
        await featureExtractor.updateLabelByTelemetry('telemetry-1', 'REJECTED');
        expect(mockUpdateMany).toHaveBeenCalledWith({
            where: { telemetryId: 'telemetry-1' },
            data: { label: 'REJECTED', reward: -1.0 }
        });
    });

    it('updateLabelByTelemetry pomija brak telemetryId', async () => {
        const { featureExtractor } = await import('../../src/services/ml/FeatureExtractor');
        mockUpdateMany.mockClear();
        await featureExtractor.updateLabelByTelemetry(null, 'REJECTED');
        await featureExtractor.updateLabelByTelemetry(undefined, 'REJECTED');
        expect(mockUpdateMany).not.toHaveBeenCalled();
    });

    it('resyncLabels nadpisuje ACCEPTED na MODIFIED gdy feedback sie zmienil', async () => {
        const { featureExtractor } = await import('../../src/services/ml/FeatureExtractor');
        mockFindMany
            // 1. ai_telemetry_logs.findMany — rekordy źródłowe z feedbackiem
            .mockResolvedValueOnce([
                { id: 'log-1', wasRejected: false, wasModified: true, modificationCount: 2 }
            ])
            // 2. aiFeature.findMany — już wyekstrahowane (stara etykieta ACCEPTED)
            .mockResolvedValueOnce([{ id: 'feat-1', telemetryId: 'log-1', label: 'ACCEPTED' }]);
        mockUpdate.mockResolvedValue({ id: 'feat-1' });

        const updated = await featureExtractor.resyncLabels();
        expect(updated).toBe(1);
        expect(mockUpdate).toHaveBeenCalledWith({
            where: { id: 'feat-1' },
            data: { label: 'MODIFIED', reward: -0.3 }
        });
    });

    it('extract() daje NO_FEEDBACK gdy brak jakiegokolwiek feedbacku (K2)', async () => {
        const { featureExtractor } = await import('../../src/services/ml/FeatureExtractor');

        const fv = featureExtractor.extract({
            id: 'test-nf',
            dn: '1000',
            warehouse: 'KLB',
            wellType: 'standard',
            wasAccepted: false,
            wasRejected: false,
            wasModified: false,
            allComponentIds: null,
            appliedReductions: null,
            appliedKonus: null,
            appliedSeals: null,
            createdAt: '2026-07-01T12:00:00Z',
            solverSource: 'AUTO_JS'
        } as any);

        expect(fv.label).toBe('NO_FEEDBACK');
        expect(fv.reward).toBe(0.0);
    });

    it('extract() nie klasyfikuje konfiguracji MANUAL jako MODIFIED (G2)', async () => {
        const { featureExtractor } = await import('../../src/services/ml/FeatureExtractor');

        const fv = featureExtractor.extract({
            id: 'test-manual',
            dn: '1000',
            warehouse: 'KLB',
            wellType: 'standard',
            wasAccepted: false,
            wasRejected: false,
            wasModified: true,
            allComponentIds: null,
            appliedReductions: null,
            appliedKonus: null,
            appliedSeals: null,
            createdAt: '2026-07-01T12:00:00Z',
            solverSource: 'MANUAL'
        } as any);

        expect(fv.label).toBe('NO_FEEDBACK');
        expect(fv.reward).toBe(0.0);
    });

    it('extract() traktuje wasAccepted=true jako ACCEPTED nawet przy MANUAL (G2)', async () => {
        const { featureExtractor } = await import('../../src/services/ml/FeatureExtractor');

        const fv = featureExtractor.extract({
            id: 'test-manual-accepted',
            dn: '1000',
            warehouse: 'KLB',
            wellType: 'standard',
            wasAccepted: true,
            wasRejected: false,
            wasModified: false,
            allComponentIds: null,
            appliedReductions: null,
            appliedKonus: null,
            appliedSeals: null,
            createdAt: '2026-07-01T12:00:00Z',
            solverSource: 'MANUAL'
        } as any);

        expect(fv.label).toBe('ACCEPTED');
        expect(fv.reward).toBe(1.0);
    });
});

describe('predictionCache', () => {
    it('clear() opróżnia cache po TTL-cechach', async () => {
        const { setCache, getCached, clearPredictionCache } =
            await import('../../src/services/ml/predictionCache');

        setCache('k1', { result: [{ score: 0.9, version: 'v1' }], timestamp: Date.now() });
        expect(getCached('k1')).toBeDefined();

        clearPredictionCache();
        expect(getCached('k1')).toBeUndefined();
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
        // saveModel używa $transaction — wykonaj callback z prisma jako tx,
        // aby mocki aiModel.create/findFirst działały wewnątrz transakcji.
        (prisma as any).$transaction = async (cb: (tx: any) => Promise<any>) => cb(prisma);

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

describe('TrainingPipeline.run() — guardy (K6)', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    function makeFeature(label: string, i = 0): any {
        return {
            dn: 1000,
            heightMm: 3000,
            warehouse: 'KLB',
            wellType: 'standard',
            hasReduction: false,
            hasPsiaBuda: false,
            hasStyczna: false,
            ringCount: 3,
            connectionCount: 2,
            transitionsAboveDennica: 1,
            totalPrice: 2500 + i,
            totalWeight: 5000 + i,
            ringVariety: 1,
            season: 'summer',
            bottomType: 'unknown',
            topType: 'unknown',
            kinetaType: '',
            dennicaHeight: 0,
            label,
            createdAt: '2026-07-01T12:00:00Z',
            telemetryId: `tel-${i}`
        };
    }

    async function setupRun(): Promise<any> {
        const { trainingPipeline } = await import('../../src/services/ml/TrainingPipeline');
        const { featureExtractor } = await import('../../src/services/ml/FeatureExtractor');
        const { default: prisma } = await import('../../src/prismaClient');
        // run() woła pre-treningowe kroki ekstrakcji — wyciszamy je (realny
        // FeatureExtractor testowany osobno w tym pliku).
        const spies = [
            jest.spyOn(featureExtractor, 'extractAndStore').mockResolvedValue(0),
            jest.spyOn(featureExtractor, 'resyncLabels').mockResolvedValue(0),
            jest.spyOn(featureExtractor, 'resyncFeatures').mockResolvedValue(0)
        ];
        // getBestAuc: brak poprzednich modeli → isFirstModel=true (próg >0.5)
        (prisma.aiModel as any).findMany = jest.fn<any>().mockResolvedValue([]);
        return { trainingPipeline, prisma, spies };
    }

    it('za mało danych (< minFeatureCountForTraining) → insufficient_data', async () => {
        const { trainingPipeline } = await setupRun();
        mockFindMany.mockResolvedValue([]);

        const res = await trainingPipeline.run();

        expect(res.trained).toBe(false);
        expect(res.reason).toMatch(/insufficient_data/);
    });

    it('jedna klasa w treningu/val (same ACCEPTED) → insufficient_label_diversity', async () => {
        const { trainingPipeline } = await setupRun();
        const onlyAccepted = Array.from({ length: 120 }, (_, i) => makeFeature('ACCEPTED', i));
        mockFindMany.mockResolvedValue(onlyAccepted);

        const res = await trainingPipeline.run();

        expect(res.trained).toBe(false);
        expect(res.reason).toMatch(/insufficient_label_diversity:train=1/);
    });

    it('pierwszy model z AUC=0.5 (gorzej niż losowe) → auc_insufficient (gate >0.5)', async () => {
        const { trainingPipeline } = await setupRun();
        const mixed = Array.from({ length: 200 }, (_, i) =>
            makeFeature(i % 2 === 0 ? 'ACCEPTED' : 'REJECTED', i)
        );
        mockFindMany.mockResolvedValue(mixed);
        // Wymuś zdegenerowany AUC=0.5 — prawdziwy trening na syntetycznych danych
        // mógłby przypadkiem przekroczyć 0.5 (test nie może być flaky).
        const metrics = {
            accuracy: 0.5,
            precision: 0.5,
            recall: 0.5,
            f1: 0.5,
            rocAuc: 0.5,
            trainSize: 96,
            valSize: 24
        };
        (trainingPipeline as any).evaluateModel = jest.fn<any>().mockReturnValue(metrics);

        const res = await trainingPipeline.run();

        expect(res.trained).toBe(false);
        expect(res.reason).toMatch(/auc_insufficient:0.5/);
    });
});
