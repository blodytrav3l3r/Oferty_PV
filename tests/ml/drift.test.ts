/**
 * Testy monitoringu driftu (ETAP 6): feature (PSI vs baseline), prediction,
 * label (positiveRate). Oparte na mockach prismaClient — bez prawdziwej bazy.
 */

import { describe, expect, it, jest, beforeEach } from '@jest/globals';
import { FEATURE_NAMES } from '../../src/config/mlConstants';
import { buildFeatureDistributions } from '../../src/services/ml/featureDistributions';

const mockFindMany = jest.fn<any>();
const mockFindFirst = jest.fn<any>();
const mockGetTrainingUsersConfig = jest.fn<any>();
const mockFindEligibleLabeledFeatures = jest.fn<any>();
const mockGetProductionModel = jest.fn<any>();

jest.mock('../../src/prismaClient', () => {
    const prisma = {
        aiFeature: {
            findMany: (...args: any[]) => mockFindMany(...args)
        },
        ai_transition_snapshots: {
            findMany: (...args: any[]) => mockFindMany(...args)
        },
        aiRewardLog: {
            findMany: (...args: any[]) => mockFindMany(...args)
        },
        aiModel: {
            findFirst: (...args: any[]) => mockFindFirst(...args)
        },
        aiTrainingRun: {
            findFirst: (...args: any[]) => mockFindFirst(...args)
        }
    };
    return { __esModule: true, default: prisma };
});

jest.mock('../../src/utils/logger', () => ({
    logger: {
        info: jest.fn(),
        warn: jest.fn(),
        error: jest.fn()
    }
}));

jest.mock('../../src/services/ml/trainingUsers', () => ({
    getTrainingUsersConfig: (...args: any[]) => mockGetTrainingUsersConfig(...args),
    findEligibleLabeledFeatures: (...args: any[]) => mockFindEligibleLabeledFeatures(...args)
}));

jest.mock('../../src/services/ml/ModelRegistry', () => ({
    modelRegistry: { getProductionModel: (...args: any[]) => mockGetProductionModel(...args) }
}));

import {
    computeFeatureDrift,
    computePredictionDrift,
    computeLabelDrift,
    computeShadowStats,
    rawFeatureValue,
    buildDriftReport
} from '../../src/services/ml/driftService';
import { computeTrainingUserScopeFingerprint } from '../../src/services/ml/trainingLineage';
import type { StoredModel } from '../../src/services/ml/ModelRegistry';
import type { TransitionAggregates } from '../../src/services/ml/TrainingPipeline';

interface AiFeatureRow {
    id: string;
    telemetryId: string | null;
    createdAt: string;
    label: string;
    dn: number;
    heightMm: number;
    warehouse: string;
    wellType: string;
    hasReduction: boolean;
    hasPsiaBuda: boolean;
    hasStyczna: boolean;
    ringCount: number;
    connectionCount: number;
    transitionsAboveDennica: number;
    totalPrice: number;
    totalWeight: number;
    ringVariety: number;
    season: string;
    bottomType: string;
    topType: string;
    kinetaType: string | null;
    dennicaHeight: number | null;
    reward: number;
    decisionMs: number | null;
}

function makeFeature(overrides: Partial<AiFeatureRow>): AiFeatureRow {
    return {
        id: 'f-1',
        telemetryId: null,
        createdAt: new Date(Date.UTC(2026, 6, 1)).toISOString(),
        label: 'ACCEPTED',
        dn: 1000,
        heightMm: 2000,
        warehouse: 'KLB',
        wellType: 'standard',
        hasReduction: false,
        hasPsiaBuda: false,
        hasStyczna: false,
        ringCount: 2,
        connectionCount: 1,
        transitionsAboveDennica: 0,
        totalPrice: 5000,
        totalWeight: 3000,
        ringVariety: 0.5,
        season: 'summer',
        bottomType: 'preco',
        topType: 'standard',
        kinetaType: 'preco',
        dennicaHeight: 100,
        reward: 0,
        decisionMs: null,
        ...overrides
    };
}

/** Baseline: 100 wektorów treningowych ZNORMALIZOWANYCH (jak w pipeline) — dn w [0,1). */
function makeBaselineModel(): StoredModel {
    const trainVectors: number[][] = [];
    for (let i = 0; i < 100; i++) {
        const vec = FEATURE_NAMES.map((_, j) => (j === 0 ? i / 100 : j === 2 ? 1 : 0));
        trainVectors.push(vec);
    }
    return {
        id: 'm-1',
        version: 'v1.0.0-m-1',
        weights: [],
        bias: 0,
        metrics: {
            rocAuc: 0.8,
            accuracy: 0.8,
            precision: 0.8,
            recall: 0.8,
            f1: 0.8,
            trainSize: 100,
            valSize: 10
        },
        features: FEATURE_NAMES,
        featureMins: FEATURE_NAMES.map((_, j) => (j === 0 ? 500 : j === 2 ? 1 : 0)),
        featureMaxs: FEATURE_NAMES.map((_, j) => (j === 0 ? 3500 : j === 2 ? 1 : 1)),
        trainingRows: 100,
        active: true,
        createdAt: new Date().toISOString(),
        featureVersion: 'v7',
        featureDistributions: JSON.stringify(buildFeatureDistributions(FEATURE_NAMES, trainVectors))
    };
}

beforeEach(() => {
    mockFindMany.mockReset();
    mockFindFirst.mockReset();
    mockFindEligibleLabeledFeatures.mockReset();
    // Domyślny fallback: dodatkowe zapytania (ai_transition_snapshots) zwracają [].
    mockFindMany.mockResolvedValue([]);
    mockGetTrainingUsersConfig.mockResolvedValue({
        status: 'CONFIGURED',
        userIds: ['user-1'],
        legacyMigrated: false
    });
    mockFindEligibleLabeledFeatures.mockResolvedValue([]);
    mockFindFirst.mockResolvedValue({
        positiveRate: 0.5,
        finishedAt: '2026-11-27T10:00:00.000Z',
        lineageSnapshot: JSON.stringify({
            trainingUserScopeFingerprint: computeTrainingUserScopeFingerprint(['user-1'])
        })
    });
});

describe('computeFeatureDrift', () => {
    it('zwraca puste przy braku modelu produkcyjnego', async () => {
        expect(await computeFeatureDrift(null)).toEqual([]);
    });

    it('zwraca puste przy braku featureDistributions (legacy model)', async () => {
        const model = makeBaselineModel();
        model.featureDistributions = null;
        expect(await computeFeatureDrift(model)).toEqual([]);
    });

    it('PSI ~0 gdy bieżące dane identyczne z baseline', async () => {
        const model = makeBaselineModel();
        mockFindEligibleLabeledFeatures.mockResolvedValueOnce(
            Array.from({ length: 100 }, (_, i) =>
                makeFeature({ dn: 500 + i * 30, warehouse: 'KLB' })
            )
        );
        const report = await computeFeatureDrift(model);
        const dn = report.find((e) => e.feature === 'dn');
        expect(dn).toBeDefined();
        expect(dn!.psi).not.toBeNull();
        expect(dn!.psi!).toBeLessThan(0.2);
    });

    it('wysoki PSI dla cechy z przesunięciem rozkładu, sortuje po PSI desc', async () => {
        const model = makeBaselineModel();
        // dn poza zakresem baseline (wyżej niż 3500) — silny drift
        mockFindEligibleLabeledFeatures.mockResolvedValueOnce(
            Array.from({ length: 50 }, (_, i) => makeFeature({ dn: 5000 + i }))
        );
        const report = await computeFeatureDrift(model);
        expect(report.length).toBeGreaterThan(0);
        // pierwsza cecha ma najwyższy PSI
        const sorted = [...report].sort((a, b) => (b.psi ?? -1) - (a.psi ?? -1));
        expect(report[0].feature).toBe(sorted[0].feature);
        const dn = report.find((e) => e.feature === 'dn');
        expect(dn!.psi!).toBeGreaterThan(0.5);
    });

    it('transition* nie kończą jako null — agregaty z ai_transition_snapshots (join telemetryId==configId)', async () => {
        const model = makeBaselineModel();
        const features = [makeFeature({ id: 'f-1', telemetryId: 't-1' })];
        const snaps = [
            { configId: 't-1', dn: '1200', heightFromBottomMm: 300 },
            { configId: 't-1', dn: '800', heightFromBottomMm: 500 }
        ];
        mockFindEligibleLabeledFeatures.mockResolvedValueOnce(features);
        mockFindMany.mockResolvedValueOnce(snaps); // ai_transition_snapshots
        const report = await computeFeatureDrift(model);
        const byName = new Map(report.map((e) => [e.feature, e.psi]));
        const transitionFeatures = [
            'transitionCount',
            'maxTransitionDnMm',
            'minTransitionHeightMm',
            'maxTransitionHeightMm',
            'avgTransitionHeightMm'
        ];
        for (const name of transitionFeatures) {
            expect(byName.has(name)).toBe(true);
            expect(byName.get(name)).not.toBeNull();
        }
    });

    it('transition* zwracają 0 (nie null) gdy brak snapshotów dla telemetryId', async () => {
        const model = makeBaselineModel();
        const features = [makeFeature({ id: 'f-1', telemetryId: 't-1' })];
        mockFindEligibleLabeledFeatures.mockResolvedValueOnce(features);
        mockFindMany.mockResolvedValueOnce([]); // brak snapshotów
        const report = await computeFeatureDrift(model);
        const byName = new Map(report.map((e) => [e.feature, e.psi]));
        for (const name of [
            'transitionCount',
            'maxTransitionDnMm',
            'minTransitionHeightMm',
            'maxTransitionHeightMm',
            'avgTransitionHeightMm'
        ]) {
            expect(byName.has(name)).toBe(true);
            expect(byName.get(name)).not.toBeNull();
        }
    });

    it('pomija drift gdy aktualna allowlista różni się od zakresu treningu', async () => {
        mockGetTrainingUsersConfig.mockResolvedValue({
            status: 'CONFIGURED',
            userIds: ['different-user'],
            legacyMigrated: false
        });
        expect(await computeFeatureDrift(makeBaselineModel())).toEqual([]);
        expect(mockFindEligibleLabeledFeatures).not.toHaveBeenCalled();
    });

    it('pomija drift dla historycznego snapshotu bez fingerprintu', async () => {
        mockFindFirst.mockResolvedValueOnce({ positiveRate: 0.5, lineageSnapshot: '{}' });
        expect(await computeFeatureDrift(makeBaselineModel())).toEqual([]);
        expect(mockFindEligibleLabeledFeatures).not.toHaveBeenCalled();
    });

    it('filtruje feature drift przez allowlistę zgodną z modelem', async () => {
        const features = [makeFeature({ telemetryId: 'telemetry-1' })];
        mockFindEligibleLabeledFeatures.mockResolvedValueOnce(features);
        mockFindMany.mockResolvedValueOnce([]);
        await computeFeatureDrift(makeBaselineModel());
        expect(mockFindEligibleLabeledFeatures).toHaveBeenCalledWith(
            '2026-11-27T10:00:00.000Z',
            ['user-1'],
            500
        );
    });

    it('ocenia feature drift wyłącznie na danych zapisanych po zakończeniu treningu modelu', async () => {
        await computeFeatureDrift(makeBaselineModel());

        expect(mockFindEligibleLabeledFeatures).toHaveBeenCalledWith(
            '2026-11-27T10:00:00.000Z',
            ['user-1'],
            500
        );
    });

    it('pobiera okno próbek kwalifikując właściciela przed limitem bazy', async () => {
        await computeFeatureDrift(makeBaselineModel());

        expect(mockFindEligibleLabeledFeatures).toHaveBeenCalledWith(
            '2026-11-27T10:00:00.000Z',
            ['user-1'],
            500
        );
    });
});

describe('rawFeatureValue (transition*)', () => {
    const agg: TransitionAggregates = {
        transitionCount: 2,
        maxTransitionDnMm: 1200,
        minTransitionHeightMm: 300,
        maxTransitionHeightMm: 500,
        avgTransitionHeightMm: 400
    };

    it('zwraca agregat (nie null) dla wszystkich 5 cech przejść gdy transAgg podany', () => {
        const f = makeFeature({ telemetryId: 't-1' });
        expect(rawFeatureValue(f, 'transitionCount', agg)).toBe(2);
        expect(rawFeatureValue(f, 'maxTransitionDnMm', agg)).toBe(1200);
        expect(rawFeatureValue(f, 'minTransitionHeightMm', agg)).toBe(300);
        expect(rawFeatureValue(f, 'maxTransitionHeightMm', agg)).toBe(500);
        expect(rawFeatureValue(f, 'avgTransitionHeightMm', agg)).toBe(400);
    });

    it('zwraca 0 (nie null) gdy brak transAgg — semantyka spójna z treningiem', () => {
        const f = makeFeature({ telemetryId: 't-1' });
        expect(rawFeatureValue(f, 'transitionCount')).toBe(0);
        expect(rawFeatureValue(f, 'maxTransitionDnMm')).toBe(0);
        expect(rawFeatureValue(f, 'minTransitionHeightMm')).toBe(0);
        expect(rawFeatureValue(f, 'maxTransitionHeightMm')).toBe(0);
        expect(rawFeatureValue(f, 'avgTransitionHeightMm')).toBe(0);
    });
});

describe('computePredictionDrift', () => {
    it('null gdy za mało próbek (poniżej 2 okien)', async () => {
        mockFindMany.mockResolvedValueOnce([{ scoreBefore: 0.5 }, { scoreBefore: 0.6 }]);
        const r = await computePredictionDrift();
        expect(r.psi).toBeNull();
        expect(r.currentSamples).toBe(0);
        expect(r.reliability).toBe('UNVERIFIED');
        expect(r.reason).toBe('client_score_unverified');
    });

    it('PSI ~0 gdy score stabilne', async () => {
        const rows = Array.from({ length: 200 }, (_, i) => ({
            scoreBefore: 0.5 + (i % 5) * 0.01
        }));
        mockFindMany.mockResolvedValueOnce(rows);
        const r = await computePredictionDrift();
        expect(r.psi).not.toBeNull();
        expect(r.psi!).toBeLessThan(0.2);
        expect(r.currentSamples).toBe(100);
        expect(r.baselineSamples).toBe(100);
        expect(r.reliability).toBe('UNVERIFIED');
    });

    it('wysoki PSI gdy bieżące score przesunięte względem historycznych', async () => {
        const rows = [
            ...Array.from({ length: 100 }, () => ({ scoreBefore: 0.1 })),
            ...Array.from({ length: 100 }, () => ({ scoreBefore: 0.9 }))
        ];
        mockFindMany.mockResolvedValueOnce(rows);
        const r = await computePredictionDrift();
        expect(r.psi!).toBeGreaterThan(0.5);
    });
});

describe('computeLabelDrift', () => {
    it('delta 0 przy takim samym positiveRate', async () => {
        mockFindEligibleLabeledFeatures.mockResolvedValueOnce(
            Array.from({ length: 40 }, () => makeFeature({ label: 'ACCEPTED' }))
        );
        mockFindFirst.mockResolvedValueOnce({
            positiveRate: 1.0,
            finishedAt: '2026-11-27T10:00:00.000Z',
            lineageSnapshot: JSON.stringify({
                trainingUserScopeFingerprint: computeTrainingUserScopeFingerprint(['user-1'])
            })
        });
        const r = await computeLabelDrift(makeBaselineModel());
        expect(r.currentPositiveRate).toBe(1);
        expect(r.trainingPositiveRate).toBe(1);
        expect(r.delta).toBe(0);
    });

    it('delta ujemna przy spadku akceptacji', async () => {
        mockFindEligibleLabeledFeatures.mockResolvedValueOnce(
            Array.from({ length: 40 }, () => makeFeature({ label: 'REJECTED' }))
        );
        mockFindFirst.mockResolvedValueOnce({
            positiveRate: 0.6,
            finishedAt: '2026-11-27T10:00:00.000Z',
            lineageSnapshot: JSON.stringify({
                trainingUserScopeFingerprint: computeTrainingUserScopeFingerprint(['user-1'])
            })
        });
        const r = await computeLabelDrift(makeBaselineModel());
        expect(r.currentPositiveRate).toBe(0);
        expect(r.delta).toBe(-0.6);
    });

    it('null przy braku etykiet lub braku udanego treningu', async () => {
        mockFindMany.mockResolvedValueOnce([]);
        mockFindFirst.mockResolvedValueOnce(null);
        const r = await computeLabelDrift(makeBaselineModel());
        expect(r.currentPositiveRate).toBeNull();
        expect(r.trainingPositiveRate).toBeNull();
        expect(r.delta).toBeNull();
    });
});

describe('buildDriftReport training cohort status', () => {
    it('reports an unavailable matching training scope without mixing cohorts', async () => {
        mockGetProductionModel.mockResolvedValue(makeBaselineModel());
        mockFindFirst.mockResolvedValue(null);
        const report = await buildDriftReport();
        expect(report.trainingScope).toEqual({
            status: 'UNAVAILABLE',
            reason: 'no_matching_training_run',
            modelVersion: 'v1.0.0-m-1'
        });
        expect(report.feature).toEqual([]);
        expect(report.label.currentPositiveRate).toBeNull();
        expect(report.label.reason).toBe('no_matching_training_run');
    });

    it('marks legacy runs without finish time unavailable instead of evaluating old samples', async () => {
        mockGetProductionModel.mockResolvedValue(makeBaselineModel());
        mockFindFirst.mockResolvedValue({
            positiveRate: 0.5,
            finishedAt: null,
            lineageSnapshot: JSON.stringify({
                trainingUserScopeFingerprint: computeTrainingUserScopeFingerprint(['user-1'])
            })
        });

        const report = await buildDriftReport();

        expect(report.trainingScope).toMatchObject({
            status: 'UNAVAILABLE',
            reason: 'missing_training_completion_time'
        });
        expect(report.feature).toEqual([]);
        expect(report.label.reason).toBe('missing_training_completion_time');
    });
});

describe('computeShadowStats', () => {
    it('null gdy brak modelu produkcyjnego', async () => {
        const r = await computeShadowStats(null);
        expect(r.shadowAuc).toBeNull();
        expect(r.productionVersion).toBeNull();
    });

    it('null gdy brak kandydata APPROVED', async () => {
        mockFindFirst
            .mockResolvedValueOnce({
                positiveRate: 0.5,
                finishedAt: '2026-11-27T10:00:00.000Z',
                lineageSnapshot: JSON.stringify({
                    trainingUserScopeFingerprint: computeTrainingUserScopeFingerprint(['user-1'])
                })
            })
            .mockResolvedValueOnce(null);
        const r = await computeShadowStats(makeBaselineModel());
        expect(r.candidateVersion).toBeNull();
        expect(r.productionAuc).toBeNull();
    });

    it('wyłącza Shadow AUC, gdy aktywnego zakresu treningowego nie można potwierdzić', async () => {
        mockGetTrainingUsersConfig.mockResolvedValueOnce({
            status: 'CONFIGURED',
            userIds: ['different-user'],
            legacyMigrated: false
        });

        const r = await computeShadowStats(makeBaselineModel());

        expect(r.shadowAuc).toBeNull();
        expect(r.reason).toBe('allowlist_scope_changed');
        expect(mockFindEligibleLabeledFeatures).not.toHaveBeenCalled();
    });

    it('liczy shadowAuc i productionAuc na wspólnych danych', async () => {
        const production = makeBaselineModel();
        // wagi modelu: dodatnie dla dn (wyższy dn = wyższy score)
        const weights = FEATURE_NAMES.map((name) => (name === 'dn' ? 1 : 0));
        production.weights = weights;
        production.bias = 0;

        // kandydat: ciężar ujemny dla dn (odwrotny ranking)
        const candidate = {
            id: 'cand',
            version: 'v1.1.0-cand',
            weights: JSON.stringify(FEATURE_NAMES.map((name) => (name === 'dn' ? -1 : 0))),
            bias: 0,
            featureMins: JSON.stringify(production.featureMins),
            featureMaxs: JSON.stringify(production.featureMaxs),
            state: 'APPROVED',
            active: false,
            featureVersion: 'v7',
            createdAt: new Date().toISOString()
        };
        const trainingRun = {
            positiveRate: 0.5,
            finishedAt: '2026-11-27T10:00:00.000Z',
            lineageSnapshot: JSON.stringify({
                trainingUserScopeFingerprint: computeTrainingUserScopeFingerprint(['user-1'])
            })
        };
        mockFindFirst
            .mockResolvedValueOnce(trainingRun)
            .mockResolvedValueOnce(candidate)
            .mockResolvedValueOnce(trainingRun);

        // 20 studni: mały dn → REJECTED, duży dn → ACCEPTED (pozytywna korelacja z wagą produkcji)
        const rows = Array.from({ length: 20 }, (_, i) =>
            makeFeature({ dn: 1000 + i * 100, label: i >= 10 ? 'ACCEPTED' : 'REJECTED' })
        );
        mockFindEligibleLabeledFeatures.mockResolvedValueOnce(rows);

        const r = await computeShadowStats(production);
        expect(r.candidateVersion).toBe('v1.1.0-cand');
        expect(r.samples).toBe(20);
        expect(r.productionAuc).not.toBeNull();
        // production (pozytywna waga dn) > kandydat (negatywna waga dn)
        expect(r.productionAuc!).toBeGreaterThan(r.shadowAuc!);
        expect(mockFindEligibleLabeledFeatures).toHaveBeenCalledWith(
            '2026-11-27T10:00:00.000Z',
            ['user-1'],
            500
        );
    });

    it('porównuje modele dopiero na próbkach po późniejszym z ich treningów', async () => {
        const production = makeBaselineModel();
        const candidate = {
            id: 'cand-later',
            version: 'v1.1.0-cand-later',
            weights: JSON.stringify(FEATURE_NAMES.map(() => 0)),
            bias: 0,
            featureMins: JSON.stringify(production.featureMins),
            featureMaxs: JSON.stringify(production.featureMaxs),
            state: 'APPROVED',
            active: false,
            featureVersion: 'v8',
            createdAt: new Date().toISOString()
        };
        const trainingRun = (finishedAt: string) => ({
            positiveRate: 0.5,
            finishedAt,
            lineageSnapshot: JSON.stringify({
                trainingUserScopeFingerprint: computeTrainingUserScopeFingerprint(['user-1'])
            })
        });
        mockFindFirst
            .mockResolvedValueOnce(trainingRun('2026-11-27T10:00:00.000Z'))
            .mockResolvedValueOnce(candidate)
            .mockResolvedValueOnce(trainingRun('2026-11-27T12:00:00.000Z'));
        mockFindEligibleLabeledFeatures.mockResolvedValueOnce(
            Array.from({ length: 20 }, (_, index) =>
                makeFeature({
                    id: `later-${index}`,
                    dn: 1000 + index * 100,
                    label: index >= 10 ? 'ACCEPTED' : 'REJECTED'
                })
            )
        );

        await computeShadowStats(production);

        expect(mockFindEligibleLabeledFeatures).toHaveBeenCalledWith(
            '2026-11-27T12:00:00.000Z',
            ['user-1'],
            500
        );
    });
});
