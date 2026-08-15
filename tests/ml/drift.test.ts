/**
 * Testy monitoringu driftu (ETAP 6): feature (PSI vs baseline), prediction,
 * label (positiveRate). Oparte na mockach prismaClient — bez prawdziwej bazy.
 */

import { describe, expect, it, jest, beforeEach } from '@jest/globals';
import { FEATURE_NAMES } from '../../src/config/mlConstants';
import { buildFeatureDistributions } from '../../src/services/ml/featureDistributions';

const mockFindMany = jest.fn<any>();
const mockFindFirst = jest.fn<any>();

jest.mock('../../src/prismaClient', () => {
    const prisma = {
        aiFeature: {
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

import {
    computeFeatureDrift,
    computePredictionDrift,
    computeLabelDrift,
    computeShadowStats
} from '../../src/services/ml/driftService';
import type { StoredModel } from '../../src/services/ml/ModelRegistry';

interface AiFeatureRow {
    id: string;
    createdAt: string;
    label: string;
    dn: number;
    heightMm: number;
    warehouse: string;
    wellType: string;
    hasReduction: boolean;
    hasPsiaBuda: boolean;
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
}

function makeFeature(overrides: Partial<AiFeatureRow>): AiFeatureRow {
    return {
        id: 'f-1',
        createdAt: new Date(Date.UTC(2026, 6, 1)).toISOString(),
        label: 'ACCEPTED',
        dn: 1000,
        heightMm: 2000,
        warehouse: 'KLB',
        wellType: 'standard',
        hasReduction: false,
        hasPsiaBuda: false,
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
        mockFindMany.mockResolvedValueOnce(
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
        mockFindMany.mockResolvedValueOnce(
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
});

describe('computePredictionDrift', () => {
    it('null gdy za mało próbek (poniżej 2 okien)', async () => {
        mockFindMany.mockResolvedValueOnce([{ scoreBefore: 0.5 }, { scoreBefore: 0.6 }]);
        const r = await computePredictionDrift();
        expect(r.psi).toBeNull();
        expect(r.currentSamples).toBe(0);
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
        mockFindMany.mockResolvedValueOnce(
            Array.from({ length: 40 }, () => makeFeature({ label: 'ACCEPTED' }))
        );
        mockFindFirst.mockResolvedValueOnce({ status: 'SUCCESS', positiveRate: 1.0 });
        const r = await computeLabelDrift();
        expect(r.currentPositiveRate).toBe(1);
        expect(r.trainingPositiveRate).toBe(1);
        expect(r.delta).toBe(0);
    });

    it('delta ujemna przy spadku akceptacji', async () => {
        mockFindMany.mockResolvedValueOnce(
            Array.from({ length: 40 }, () => makeFeature({ label: 'REJECTED' }))
        );
        mockFindFirst.mockResolvedValueOnce({ status: 'SUCCESS', positiveRate: 0.6 });
        const r = await computeLabelDrift();
        expect(r.currentPositiveRate).toBe(0);
        expect(r.delta).toBe(-0.6);
    });

    it('null przy braku etykiet lub braku udanego treningu', async () => {
        mockFindMany.mockResolvedValueOnce([]);
        mockFindFirst.mockResolvedValueOnce(null);
        const r = await computeLabelDrift();
        expect(r.currentPositiveRate).toBeNull();
        expect(r.trainingPositiveRate).toBeNull();
        expect(r.delta).toBeNull();
    });
});

describe('computeShadowStats', () => {
    it('null gdy brak modelu produkcyjnego', async () => {
        const r = await computeShadowStats(null);
        expect(r.shadowAuc).toBeNull();
        expect(r.productionVersion).toBeNull();
    });

    it('null gdy brak kandydata APPROVED', async () => {
        mockFindFirst.mockResolvedValueOnce(null);
        const r = await computeShadowStats(makeBaselineModel());
        expect(r.candidateVersion).toBeNull();
        expect(r.productionAuc).toBeNull();
    });

    it('liczy shadowAuc i productionAuc na wspólnych danych', async () => {
        const production = makeBaselineModel();
        // wagi modelu: dodatnie dla dn (wyższy dn = wyższy score)
        const weights = FEATURE_NAMES.map((name) => (name === 'dn' ? 1 : 0));
        production.weights = weights;
        production.bias = 0;

        // kandydat: ciężar ujemny dla dn (odwrotny ranking)
        mockFindFirst.mockResolvedValueOnce({
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
        });

        // 20 studni: mały dn → REJECTED, duży dn → ACCEPTED (pozytywna korelacja z wagą produkcji)
        const rows = Array.from({ length: 20 }, (_, i) =>
            makeFeature({ dn: 1000 + i * 100, label: i >= 10 ? 'ACCEPTED' : 'REJECTED' })
        );
        mockFindMany.mockResolvedValueOnce(rows);

        const r = await computeShadowStats(production);
        expect(r.candidateVersion).toBe('v1.1.0-cand');
        expect(r.samples).toBe(20);
        expect(r.productionAuc).not.toBeNull();
        // production (pozytywna waga dn) > kandydat (negatywna waga dn)
        expect(r.productionAuc!).toBeGreaterThan(r.shadowAuc!);
    });
});
