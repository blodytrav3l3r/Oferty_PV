/**
 * Testy modułu TrainingPipeline i FeatureExtractor.
 */

import { describe, expect, it, jest, beforeEach } from '@jest/globals';
import { AcceptanceModel, TrainingNumericalError } from '../../src/services/ml/AcceptanceModel';

const mockFindMany = jest.fn<any>();
const mockFindFirst = jest.fn<any>();
const mockCreate = jest.fn<any>();
const mockCount = jest.fn<any>();
const mockUpdate = jest.fn<any>();
const mockUpdateMany = jest.fn<any>();
const mockTransitionFindMany = jest.fn<any>().mockResolvedValue([]);
const mockRunCreate = jest.fn<any>();
const mockRunUpdate = jest.fn<any>();

jest.mock('../../src/prismaClient', () => ({
    __esModule: true,
    default: {
        ai_telemetry_logs: { findMany: (...args: any[]) => mockFindMany(...args) },
        ai_transition_snapshots: {
            findMany: (...args: any[]) => mockTransitionFindMany(...args)
        },
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
        aiTrainingRun: {
            create: (...args: any[]) => mockRunCreate(...args),
            update: (...args: any[]) => mockRunUpdate(...args)
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

    it('resyncLabels używa kursora (createdAt, id) z orderBy array (A-18)', async () => {
        const { featureExtractor } = await import('../../src/services/ml/FeatureExtractor');
        mockFindMany
            // 1. ai_telemetry_logs.findMany — rekordy źródłowe z feedbackiem
            .mockResolvedValueOnce([
                { id: 'log-1', createdAt: '2026-07-01T12:00:00Z' },
                { id: 'log-2', createdAt: '2026-07-01T12:00:00Z' }
            ])
            // 2. aiFeature.findMany — bez istniejących (brak aktualizacji)
            .mockResolvedValueOnce([])
            // 3. kolejne iteracje pętli (kursor) — pusta lista kończy pętlę
            .mockResolvedValue([]);

        await featureExtractor.resyncLabels(2000);

        type FindManyArgs = {
            orderBy?: Array<Record<string, string>>;
            where?: { trainingEligible?: boolean; OR?: Array<Record<string, unknown>> };
        };
        const firstCall = mockFindMany.mock.calls[0][0] as FindManyArgs;
        /* Brak kursora przy pierwszym wywołaniu */
        expect(firstCall.orderBy).toEqual([{ createdAt: 'desc' }, { id: 'desc' }]);
        expect(firstCall.where?.trainingEligible).toBe(true);
        expect(firstCall.where?.OR).toBeUndefined();

        const secondCall = mockFindMany.mock.calls[2][0] as FindManyArgs;
        /* Kursor po (createdAt, id) — nie pomija rekordów z równym createdAt */
        expect(secondCall.where?.OR).toEqual([
            { createdAt: { lt: '2026-07-01T12:00:00Z' } },
            { createdAt: '2026-07-01T12:00:00Z', id: { lt: 'log-2' } }
        ]);
        expect(secondCall.orderBy).toEqual([{ createdAt: 'desc' }, { id: 'desc' }]);
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
            .mockResolvedValueOnce([{ id: 'feat-1', telemetryId: 'log-1', label: 'ACCEPTED' }])
            // 3. kolejne iteracje pętli (kursor) — pusta lista kończy pętlę
            .mockResolvedValue([]);
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

    it('extract() daje MODIFIED gdy decyzja z parentConfigId wskazuje sugestie (G3)', async () => {
        const { featureExtractor } = await import('../../src/services/ml/FeatureExtractor');

        const fv = featureExtractor.extract({
            id: 'test-decision-modified',
            dn: '1000',
            warehouse: 'KLB',
            wellType: 'standard',
            wasAccepted: false,
            wasRejected: false,
            wasModified: true,
            parentConfigId: 'suggestion-S123',
            allComponentIds: null,
            appliedReductions: null,
            appliedKonus: null,
            appliedSeals: null,
            createdAt: '2026-07-01T12:00:00Z',
            solverSource: 'MANUAL'
        } as any);

        expect(fv.label).toBe('MODIFIED');
        expect(fv.reward).toBe(-0.3);
    });

    it('extract() daje ACCEPTED_AFTER_MODIFICATION gdy ORDER_CONFIRM z parentConfigId (G3)', async () => {
        const { featureExtractor } = await import('../../src/services/ml/FeatureExtractor');

        const fv = featureExtractor.extract({
            id: 'test-decision-confirm',
            dn: '1000',
            warehouse: 'KLB',
            wellType: 'standard',
            wasAccepted: true,
            wasRejected: false,
            wasModified: true,
            parentConfigId: 'suggestion-S123',
            allComponentIds: null,
            appliedReductions: null,
            appliedKonus: null,
            appliedSeals: null,
            createdAt: '2026-07-01T12:00:00Z',
            solverSource: 'MANUAL'
        } as any);

        expect(fv.label).toBe('ACCEPTED_AFTER_MODIFICATION');
        expect(fv.reward).toBe(1.0);
    });

    it('extract() daje AAM dla sugestii AUTO z flagami acc+mod bez parentConfigId (G3)', async () => {
        const { featureExtractor } = await import('../../src/services/ml/FeatureExtractor');

        const fv = featureExtractor.extract({
            id: 'test-suggestion-confirmed',
            dn: '1000',
            warehouse: 'KLB',
            wellType: 'standard',
            wasAccepted: true,
            wasRejected: false,
            wasModified: true,
            allComponentIds: null,
            appliedReductions: null,
            appliedKonus: null,
            appliedSeals: null,
            createdAt: '2026-07-01T12:00:00Z',
            solverSource: 'AUTO_JS'
        } as any);

        expect(fv.label).toBe('ACCEPTED_AFTER_MODIFICATION');
        expect(fv.reward).toBe(1.0);
    });

    it('labelToTrainingWeight: ACCEPTED=1.0, AAM=0.5, MODIFIED=0.5, REJECTED=1.0, NO_FEEDBACK=0', async () => {
        const { labelToTrainingWeight } = await import('../../src/services/ml/FeatureExtractor');

        expect(labelToTrainingWeight('ACCEPTED')).toBe(1.0);
        expect(labelToTrainingWeight('ACCEPTED_AFTER_MODIFICATION')).toBe(0.5);
        expect(labelToTrainingWeight('MODIFIED')).toBe(0.5);
        expect(labelToTrainingWeight('REJECTED')).toBe(1.0);
        expect(labelToTrainingWeight('NO_FEEDBACK')).toBe(0.0);
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

describe('computeDatasetFingerprint (ETAP 1)', () => {
    it('ten sam dataset daje ten sam fingerprint niezależnie od kolejności rekordów', async () => {
        const { computeDatasetFingerprint } =
            await import('../../src/services/ml/TrainingPipeline');
        const records = [
            { id: 'a', timestamp: '2026-01-01', label: 'ACCEPTED' },
            { id: 'b', timestamp: '2026-01-02', label: 'REJECTED' },
            { id: 'c', timestamp: '2026-01-03', label: 'ACCEPTED' }
        ];
        const shuffled = [records[2], records[0], records[1]];
        expect(computeDatasetFingerprint(records, 'v7')).toBe(
            computeDatasetFingerprint(shuffled, 'v7')
        );
    });

    it('zmiana label/featureVersion zmienia fingerprint', async () => {
        const { computeDatasetFingerprint } =
            await import('../../src/services/ml/TrainingPipeline');
        const records = [{ id: 'a', timestamp: '2026-01-01', label: 'ACCEPTED' }];
        expect(computeDatasetFingerprint(records, 'v7')).not.toBe(
            computeDatasetFingerprint(records, 'v8')
        );
        expect(computeDatasetFingerprint(records, 'v7')).not.toBe(
            computeDatasetFingerprint([{ ...records[0], label: 'REJECTED' }], 'v7')
        );
    });
});

describe('Guardrail deploy (ETAP 5)', () => {
    let trainingPipeline: any;

    beforeAll(async () => {
        const mod = await import('../../src/services/ml/TrainingPipeline');
        trainingPipeline = mod.trainingPipeline;
    });

    const baseMetrics = {
        accuracy: 0.8,
        precision: 0.8,
        recall: 0.8,
        f1: 0.8,
        rocAuc: 0.9,
        prAuc: 0.85,
        logLoss: 0.3,
        ece: 0.05,
        trainSize: 280,
        valSize: 60
    };
    const production = {
        version: 'v1.0.0-prod',
        metrics: { ...baseMetrics, rocAuc: 0.88, logLoss: 0.25, ece: 0.03 }
    };

    it('pierwszy model (brak PRODUCTION) → APPROVED gdy absolutne progi spełnione', () => {
        const g = trainingPipeline.evaluateDeployGuard(baseMetrics, null, true);
        expect(g.ok).toBe(true);
    });

    it('pierwszy model → REJECTED gdy absolutne progi niespełnione (minPrAuc)', () => {
        const g = trainingPipeline.evaluateDeployGuard({ ...baseMetrics, prAuc: 0.3 }, null, true);
        expect(g.ok).toBe(false);
        expect(g.code).toBe('deploy_abs_insufficient');
    });

    it('kolejny model: AUC +0.02 i brak regresji → APPROVED', () => {
        const g = trainingPipeline.evaluateDeployGuard(
            { ...baseMetrics, rocAuc: 0.9, logLoss: 0.26, ece: 0.04 },
            production as any,
            false
        );
        expect(g.ok).toBe(true);
    });

    it('kolejny model: AUC poniżej production+0.01 → REJECTED (relatywna regresja AUC)', () => {
        // logLoss/ECE w normie — jedynym powodem REJECTED jest AUC < 0.88+0.01
        const g = trainingPipeline.evaluateDeployGuard(
            { ...baseMetrics, rocAuc: 0.885, logLoss: 0.26, ece: 0.04 },
            production as any,
            false
        );
        expect(g.ok).toBe(false);
        expect(g.code).toBe('deploy_rel_regression');
        expect(g.reason).toContain('auc=0.8850');
    });

    it('kolejny model: AUC dokładnie production+0.01 → przechodzi (operator >=)', () => {
        const g = trainingPipeline.evaluateDeployGuard(
            { ...baseMetrics, rocAuc: 0.89, logLoss: 0.26, ece: 0.04 },
            production as any,
            false
        );
        expect(g.ok).toBe(true);
        expect(g.code).toBe('ok');
    });

    it('kolejny model: AUC wzrost, ale logLoss regresja >0.02 → REJECTED (zasada braku regresji)', () => {
        const g = trainingPipeline.evaluateDeployGuard(
            { ...baseMetrics, rocAuc: 0.95, logLoss: 0.3 }, // production.logLoss=0.25 → 0.30 > 0.27
            production as any,
            false
        );
        expect(g.ok).toBe(false);
        expect(g.code).toBe('deploy_rel_regression');
    });

    it('kolejny model: AUC wzrost, ale ECE regresja >0.02 → REJECTED', () => {
        const g = trainingPipeline.evaluateDeployGuard(
            { ...baseMetrics, rocAuc: 0.95, ece: 0.1 }, // production.ece=0.03 → 0.10 > 0.05
            production as any,
            false
        );
        expect(g.ok).toBe(false);
        expect(g.code).toBe('deploy_rel_regression');
    });

    it('production bez nowych metryk (logLoss/ece null) → relatywne progi pomijane', () => {
        const legacy = {
            version: 'v0.1.0-starter',
            metrics: { rocAuc: 0.5, trainSize: 0, valSize: 0 }
        };
        const g = trainingPipeline.evaluateDeployGuard(
            { ...baseMetrics, rocAuc: 0.6 },
            legacy as any,
            false
        );
        // relAuc: 0.6 >= 0.5+0.01 → ok; logLoss/ece relatywne pomijane (null production)
        expect(g.ok).toBe(true);
    });
});

describe('Determinizm treningu (ETAP 2)', () => {
    it('ten sam dataset + hyperparametry → identyczne weights (SEED=42 jako metadata)', () => {
        const dataset = [
            { features: [1000, 500, 2], label: 1, weight: 1 },
            { features: [1200, 600, 3], label: 1, weight: 1 },
            { features: [1000, 400, 1], label: 1, weight: 1 },
            { features: [5000, 3000, 10], label: 0, weight: 1 },
            { features: [4000, 2500, 8], label: 0, weight: 1 },
            { features: [6000, 3500, 12], label: 0, weight: 1 }
        ];
        const m1 = new AcceptanceModel(3);
        m1.train(dataset, 0.01, 5000);
        const m2 = new AcceptanceModel(3);
        m2.train(dataset, 0.01, 5000);
        expect(m1.getWeights()).toEqual(m2.getWeights());
        expect(m1.getBias()).toBe(m2.getBias());
    });

    it('SEED=42 jest eksportowany jako stała (metadata/audyt)', async () => {
        const { SEED } = await import('../../src/services/ml/TrainingPipeline');
        expect(SEED).toBe(42);
    });
});

describe('Split 70/15/15 (ETAP 2)', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    it('guard rozmiaru → SKIPPED przy zbyt małym teście (n=250)', async () => {
        const { trainingPipeline } = await import('../../src/services/ml/TrainingPipeline');
        const { featureExtractor } = await import('../../src/services/ml/FeatureExtractor');
        const { default: prisma } = await import('../../src/prismaClient');
        jest.spyOn(featureExtractor, 'extractAndStore').mockResolvedValue(0);
        jest.spyOn(featureExtractor, 'resyncLabels').mockResolvedValue(0);
        jest.spyOn(featureExtractor, 'resyncFeatures').mockResolvedValue(0);
        (prisma.aiModel as any).findMany = jest.fn<any>().mockResolvedValue([]);
        // 250 rekordów: n < minDatasetForSplit (300) → SKIPPED przed balansem klas
        const mixed = Array.from({ length: 250 }, (_, i) => ({
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
            label: i % 2 === 0 ? 'ACCEPTED' : 'REJECTED',
            createdAt: `2026-07-${String((i % 28) + 1).padStart(2, '0')}T12:00:00Z`,
            telemetryId: `tel-${i}`
        }));
        mockFindMany.mockResolvedValue(mixed);

        const res = await trainingPipeline.run();

        expect(res.trained).toBe(false);
        expect(mockRunUpdate).toHaveBeenCalledWith(
            expect.objectContaining({
                data: expect.objectContaining({
                    status: 'SKIPPED',
                    error: expect.stringContaining('split_guard')
                })
            })
        );
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
    beforeEach(async () => {
        jest.clearAllMocks();
        // Testy A-14 ustawiają lastTrainedAt/mockCount na singletonie —
        // reset, by nie persistowały do pozostałych testów guardów.
        const { trainingPipeline } = await import('../../src/services/ml/TrainingPipeline');
        (trainingPipeline as any).lastTrainedAt = null;
        mockCount.mockResolvedValue(undefined);
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
            // Unikalne daty — run() sortuje desc + reverse (chronologicznie); bez tego
            // kolejność po reverse jest odwrócona i split 70/15/15 łapie złe rekordy.
            createdAt: new Date(Date.UTC(2026, 6, 1) + i * 86400000).toISOString(),
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

    it('za mało NOWYCH danych (A-14) → insufficient_new_data przy force=false', async () => {
        const { trainingPipeline } = await setupRun();
        mockFindMany.mockResolvedValue(
            Array.from({ length: 400 }, (_, i) => makeFeature('ACCEPTED', i))
        );
        // lastTrainedAt ustawiony wcześniej — aiFeature.count = brak nowych
        (trainingPipeline as any).lastTrainedAt = new Date(Date.UTC(2026, 8, 1)).toISOString();
        mockCount.mockResolvedValue(0);

        const res = await trainingPipeline.run(false);

        expect(res.trained).toBe(false);
        expect(res.reason).toMatch(/insufficient_new_data:0/);
    });

    it('A-14: force=true pomija guard nowych danych', async () => {
        const { trainingPipeline } = await setupRun();
        mockFindMany.mockResolvedValue(
            Array.from({ length: 400 }, (_, i) => makeFeature('ACCEPTED', i))
        );
        (trainingPipeline as any).lastTrainedAt = new Date(Date.UTC(2026, 8, 1)).toISOString();
        mockCount.mockResolvedValue(0);

        const res = await trainingPipeline.run(true);

        /* force omija insufficient_new_data — nie może to być przyczyna odmowy */
        expect(res.reason).not.toMatch(/insufficient_new_data/);
    });

    it('jedna klasa w treningu/val (same ACCEPTED) → insufficient_label_diversity', async () => {
        const { trainingPipeline } = await setupRun();
        // 400 rekordów: train/val (0..339) same ACCEPTED, test (340..399) z balansem
        // 30/30 — guarda rozmiaru przechodzi (n=400), ale trainClasses=1 → label diversity.
        // Uwaga: run() robi features.reverse() (po orderBy desc) — mock musi zwrócić
        // tablicę w kolejności DESC, żeby po reverse split był chronologiczny.
        const onlyAccepted = Array.from({ length: 340 }, (_, i) => makeFeature('ACCEPTED', i));
        const testBalanced = Array.from({ length: 60 }, (_, i) =>
            makeFeature(i % 2 === 0 ? 'ACCEPTED' : 'REJECTED', 400 + i)
        );
        mockFindMany.mockResolvedValue([...testBalanced, ...onlyAccepted]);

        const res = await trainingPipeline.run();

        expect(res.trained).toBe(false);
        expect(res.reason).toMatch(/insufficient_label_diversity:train=1/);
    });

    it('pierwszy model z AUC=0.5 (gorzej niż losowe) → deploy_abs_insufficient (gate minAuc>0.55)', async () => {
        const { trainingPipeline } = await setupRun();
        const mixed = Array.from({ length: 400 }, (_, i) =>
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
            trainSize: 280,
            valSize: 60
        };
        (trainingPipeline as any).evaluateModel = jest.fn<any>().mockReturnValue(metrics);

        const res = await trainingPipeline.run();

        expect(res.trained).toBe(false);
        expect(res.reason).toMatch(/deploy_abs_insufficient:auc=0.5/);
    });
});

describe('TrainingPipeline AiTrainingRun (ETAP 1)', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        mockRunCreate.mockResolvedValue({ id: 'run-1' });
        mockRunUpdate.mockResolvedValue({ id: 'run-1' });
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

    it('run() tworzy AiTrainingRun RUNNING na start i kończy SKIPPED przy za mało danych', async () => {
        const { trainingPipeline } = await import('../../src/services/ml/TrainingPipeline');
        const { featureExtractor } = await import('../../src/services/ml/FeatureExtractor');
        jest.spyOn(featureExtractor, 'extractAndStore').mockResolvedValue(0);
        jest.spyOn(featureExtractor, 'resyncLabels').mockResolvedValue(0);
        jest.spyOn(featureExtractor, 'resyncFeatures').mockResolvedValue(0);
        mockFindMany.mockResolvedValue([]);

        const res = await trainingPipeline.run();

        expect(res.trained).toBe(false);
        // create: RUNNING + seed 42 + featureVersion
        expect(mockRunCreate).toHaveBeenCalledWith(
            expect.objectContaining({
                data: expect.objectContaining({
                    status: 'RUNNING',
                    seed: 42,
                    featureVersion: expect.any(String),
                    deployed: false
                })
            })
        );
        // update: SKIPPED + finishedAt + powód
        expect(mockRunUpdate).toHaveBeenCalledWith(
            expect.objectContaining({
                data: expect.objectContaining({
                    status: 'SKIPPED',
                    finishedAt: expect.any(String),
                    error: expect.stringContaining('insufficient_data')
                })
            })
        );
    });

    it('run() kończy FAILED_ERROR przy wyjątku z ekstrakcji cech', async () => {
        const { trainingPipeline } = await import('../../src/services/ml/TrainingPipeline');
        const { featureExtractor } = await import('../../src/services/ml/FeatureExtractor');
        jest.spyOn(featureExtractor, 'extractAndStore').mockRejectedValue(
            new Error('extract crash')
        );

        const res = await trainingPipeline.run();

        expect(res.trained).toBe(false);
        expect(res.reason).toMatch(/failed_error:extract crash/);
        expect(mockRunUpdate).toHaveBeenCalledWith(
            expect.objectContaining({
                data: expect.objectContaining({
                    status: 'FAILED_ERROR',
                    error: 'failed_error:extract crash'
                })
            })
        );
    });

    it('run() kończy FAILED_VALIDATION gdy kandydat nie przechodzi gate AUC', async () => {
        const { trainingPipeline } = await import('../../src/services/ml/TrainingPipeline');
        const { featureExtractor } = await import('../../src/services/ml/FeatureExtractor');
        const { default: prisma } = await import('../../src/prismaClient');
        jest.spyOn(featureExtractor, 'extractAndStore').mockResolvedValue(0);
        jest.spyOn(featureExtractor, 'resyncLabels').mockResolvedValue(0);
        jest.spyOn(featureExtractor, 'resyncFeatures').mockResolvedValue(0);
        const mixed = Array.from({ length: 400 }, (_, i) =>
            makeFeature(i % 2 === 0 ? 'ACCEPTED' : 'REJECTED', i)
        );
        mockFindMany.mockResolvedValue(mixed);
        (prisma.aiModel as any).findMany = jest.fn<any>().mockResolvedValue([]);
        (trainingPipeline as any).evaluateModel = jest.fn<any>().mockReturnValue({
            accuracy: 0.5,
            precision: 0.5,
            recall: 0.5,
            f1: 0.5,
            rocAuc: 0.5,
            trainSize: 280,
            valSize: 60
        });

        const res = await trainingPipeline.run();

        expect(res.trained).toBe(false);
        expect(mockRunUpdate).toHaveBeenCalledWith(
            expect.objectContaining({
                data: expect.objectContaining({
                    status: 'FAILED_VALIDATION',
                    error: expect.stringContaining('deploy_abs_insufficient'),
                    deployed: false,
                    baselineAccuracy: 0.5,
                    positiveRate: 0.5
                })
            })
        );
    });

    it('run() mapuje TrainingNumericalError na FAILED_NUMERICAL', async () => {
        const { trainingPipeline } = await import('../../src/services/ml/TrainingPipeline');
        const { featureExtractor } = await import('../../src/services/ml/FeatureExtractor');
        const { default: prisma } = await import('../../src/prismaClient');
        const { AcceptanceModel } = await import('../../src/services/ml/AcceptanceModel');
        jest.spyOn(featureExtractor, 'extractAndStore').mockResolvedValue(0);
        jest.spyOn(featureExtractor, 'resyncLabels').mockResolvedValue(0);
        jest.spyOn(featureExtractor, 'resyncFeatures').mockResolvedValue(0);
        const mixed = Array.from({ length: 400 }, (_, i) =>
            makeFeature(i % 2 === 0 ? 'ACCEPTED' : 'REJECTED', i)
        );
        mockFindMany.mockResolvedValue(mixed);
        (prisma.aiModel as any).findMany = jest.fn<any>().mockResolvedValue([]);
        // Rzuć wyjątek numeryczny podczas treningu (przez przechwycenie train)
        jest.spyOn(AcceptanceModel.prototype, 'train').mockImplementation(() => {
            throw new TrainingNumericalError('non-finite at epoch 5/5000');
        });

        const res = await trainingPipeline.run();

        expect(res.trained).toBe(false);
        expect(res.reason).toMatch(/failed_numerical:/);
        expect(mockRunUpdate).toHaveBeenCalledWith(
            expect.objectContaining({
                data: expect.objectContaining({ status: 'FAILED_NUMERICAL' })
            })
        );
    });
});
