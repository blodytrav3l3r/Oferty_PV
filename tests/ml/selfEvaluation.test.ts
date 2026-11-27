import { describe, expect, it, jest, beforeEach } from '@jest/globals';
import { computeRocAuc } from '../../src/services/ml/TrainingPipeline';
import { logger } from '../../src/utils/logger';

jest.mock('../../src/utils/logger', () => ({
    logger: {
        info: jest.fn(),
        warn: jest.fn(),
        error: jest.fn()
    }
}));

const mockRollbackToPrevious = jest.fn<any>().mockResolvedValue(null);
const mockGetActiveModel = jest.fn<any>();
const mockPromoteBestModel = jest.fn<any>();
const mockShouldTrain = jest.fn<any>().mockResolvedValue({ ok: false, reason: 'too_soon' });

jest.mock('../../src/services/ml/ModelRegistry', () => ({
    modelRegistry: {
        rollbackToPrevious: (...args: any[]) => mockRollbackToPrevious(...args),
        getActiveModel: (...args: any[]) => mockGetActiveModel(...args),
        promoteBestModel: (...args: any[]) => mockPromoteBestModel(...args)
    }
}));

jest.mock('../../src/services/ml/TrainingPipeline', () => {
    const actual = jest.requireActual('../../src/services/ml/TrainingPipeline') as {
        computeRocAuc: (...args: number[]) => number;
    };
    return {
        computeRocAuc: (...args: number[]) => actual.computeRocAuc(...args),
        trainingPipeline: {
            run: jest.fn<any>().mockResolvedValue({ trained: false }),
            shouldTrain: (...args: any[]) => mockShouldTrain(...args)
        }
    };
});

jest.mock('../../src/prismaClient', () => ({
    __esModule: true,
    default: {
        aiEvaluation: {
            create: jest.fn<any>().mockResolvedValue({ id: 'eval' })
        }
    }
}));

describe('computeRocAuc', () => {
    it('separacja idealna daje AUC=1', () => {
        const auc = computeRocAuc([0.9, 0.8, 0.2, 0.1], [1, 1, 0, 0]);
        expect(auc).toBe(1);
    });

    it('klasyfikacja odwrócona daje AUC=0', () => {
        const auc = computeRocAuc([0.9, 0.8, 0.2, 0.1], [0, 0, 1, 1]);
        expect(auc).toBe(0);
    });

    it('n < 2 daje 0.5', () => {
        expect(computeRocAuc([0.5], [1])).toBe(0.5);
        expect(computeRocAuc([], [])).toBe(0.5);
    });

    it('brak pozytywów lub negatywów daje 0.5', () => {
        expect(computeRocAuc([0.9, 0.8, 0.7], [1, 1, 1])).toBe(0.5);
        expect(computeRocAuc([0.9, 0.8, 0.7], [0, 0, 0])).toBe(0.5);
    });

    it('losowy ranking daje wartość pośrednią (nie skrajną)', () => {
        const auc = computeRocAuc([0.9, 0.1, 0.8, 0.2, 0.7, 0.3], [1, 0, 0, 1, 0, 1]);
        expect(auc).toBeGreaterThan(0.1);
        expect(auc).toBeLessThan(0.9);
    });

    it("tie'y dostają średnią rangę (AUC nie zależy od kolejności przy saturowanym sigmoidzie)", () => {
        // Saturowany model daje identyczne predykcje — bez tie-correction AUC
        // był artefaktem kolejności rekordów (0 lub 1 zależnie od sortu).
        const scores = [0.9999, 0.9999, 0.9999, 0.9999, 0.9999, 0.9999];
        const labelsA = [1, 1, 1, 0, 0, 0];
        const labelsB = [1, 0, 0, 1, 1, 0];
        const aucA = computeRocAuc(scores, labelsA);
        const aucB = computeRocAuc(scores, labelsB);
        // Wszystkie równe → rankSum pozytywnych = średnia ranga grupy * pos,
        // AUC powinno być spójne dla obu permutacji i zależeć tylko od liczby
        // pozytywów (a nie ich kolejności).
        expect(aucA).toBe(0.5);
        expect(aucB).toBe(0.5);
    });

    it("częściowe tie'y uśredniają rangi (Mann-Whitney z tie-correction)", () => {
        // score 0.5 występuje 3× (2 pos, 1 neg) — średnia ranga = (2+3+4)/3 = 3.
        const scores = [0.9, 0.5, 0.5, 0.5, 0.1];
        const labels = [1, 1, 0, 1, 0];
        const auc = computeRocAuc(scores, labels);
        // Pos (3): 0.9(rank5) + 0.5(rank3) + 0.5(rank3) → rankSum=11.
        // auc = (11 - 3*4/2) / (3*2) = 5/6 ≈ 0.8333.
        expect(auc).toBe(0.8333);
    });
});

describe('SelfEvaluation - sliding window', () => {
    let SelfEvaluationClass: typeof import('../../src/services/ml/SelfEvaluation').SelfEvaluation;

    beforeEach(async () => {
        jest.clearAllMocks();
        mockGetActiveModel.mockResolvedValue({
            id: 'model-current',
            version: 'model-current',
            metrics: { rocAuc: 0.1 }
        });
        mockPromoteBestModel.mockResolvedValue({
            id: 'model-old',
            version: 'v-old',
            metrics: { rocAuc: 0.8 }
        });
        mockShouldTrain.mockResolvedValue({ ok: false, reason: 'too_soon' });
        const mod = await import('../../src/services/ml/SelfEvaluation');
        SelfEvaluationClass = mod.SelfEvaluation;
    });

    it('recordPredictionResult przycina okno do 200 wpisów', () => {
        const ev = new SelfEvaluationClass();
        for (let i = 0; i < 250; i++) {
            ev.recordPredictionResult(i % 2, 0.5);
        }
        const status = ev as unknown as { slidingWindow: unknown[] };
        expect(status.slidingWindow.length).toBe(200);
    });

    it('czyści okno przy zmianie wersji modelu, by nie mieszać wyników AUC', () => {
        const ev = new SelfEvaluationClass();
        ev.recordPredictionResult(1, 0.9, 'model-v1');
        ev.recordPredictionResult(0, 0.1, 'model-v2');
        const status = ev as unknown as {
            slidingWindow: Array<{ label: number; score: number; modelVersion: string }>;
        };

        expect(status.slidingWindow).toEqual([{ label: 0, score: 0.1, modelVersion: 'model-v2' }]);
    });

    it('nie cofa nowego modelu na podstawie okna AUC poprzedniej wersji', async () => {
        const ev = new SelfEvaluationClass();
        for (let i = 0; i < 20; i++) {
            ev.recordPredictionResult(i % 2, i % 2 === 0 ? 0.9 : 0.1, 'model-v1');
        }
        mockGetActiveModel.mockResolvedValue({ id: 'model-v2', version: 'model-v2' });

        await expect(ev.evaluateOnlineAuc()).resolves.toEqual({ slidingAuc: null });

        expect(mockRollbackToPrevious).not.toHaveBeenCalled();
        expect((ev as unknown as { slidingWindow: unknown[] }).slidingWindow).toHaveLength(0);
    });

    it('evaluateOnlineAuc zwraca null gdy window < 10', async () => {
        const ev = new SelfEvaluationClass();
        for (let i = 0; i < 5; i++) {
            ev.recordPredictionResult(1, 0.1);
        }
        const result = await ev.evaluateOnlineAuc();
        expect(result).toEqual({ slidingAuc: null });
        expect(mockRollbackToPrevious).not.toHaveBeenCalled();
    });

    it('słabe online AUC pozostaje diagnostyczne i nie zmienia aktywnego modelu', async () => {
        const ev = new SelfEvaluationClass();
        let activeModel = {
            id: 'model-current',
            version: 'model-current',
            metrics: { rocAuc: 0.9 }
        };
        mockGetActiveModel.mockImplementation(async () => activeModel);
        mockRollbackToPrevious.mockImplementation(async () => {
            activeModel = { id: 'model-old', version: 'model-old', metrics: { rocAuc: 0.8 } };
            return activeModel;
        });
        const before = await mockGetActiveModel();
        // odwrócona klasyfikacja (pozytywy dostają niskie score) -> AUC=0 < 0.65
        for (let i = 0; i < 20; i++) {
            ev.recordPredictionResult(i % 2, i % 2 === 0 ? 0.9 : 0.1, 'model-current');
        }
        const result = await ev.evaluateOnlineAuc();
        const after = await mockGetActiveModel();
        expect(result.slidingAuc).toBe(0);
        expect(result.slidingAuc).toBeLessThan(0.65);
        expect(after).toMatchObject({ id: before.id, version: before.version });
        expect(mockRollbackToPrevious).not.toHaveBeenCalled();
        expect(logger.warn).toHaveBeenCalledWith(
            'SelfEvaluation',
            expect.stringContaining('rollback online wyłączony')
        );
    });

    it('brak rollbacku przy zdrowym AUC', async () => {
        const ev = new SelfEvaluationClass();
        for (let i = 0; i < 20; i++) {
            ev.recordPredictionResult(i % 2, i % 2 === 0 ? 0.1 : 0.9, 'model-current');
        }
        const result = await ev.evaluateOnlineAuc();
        expect(result.slidingAuc).toBeGreaterThanOrEqual(0.65);
        expect(mockRollbackToPrevious).not.toHaveBeenCalled();
    });

    it('ogranicza powtarzane ostrzeżenia o słabym AUC do jednego na okno czasowe', async () => {
        const ev = new SelfEvaluationClass();
        let now = Date.now();
        const nowSpy = jest.spyOn(Date, 'now').mockImplementation(() => now);
        for (let i = 0; i < 20; i++) {
            ev.recordPredictionResult(i % 2, i % 2 === 0 ? 0.9 : 0.1, 'model-current');
        }
        try {
            await ev.evaluateOnlineAuc();
            await ev.evaluateOnlineAuc();
            expect(logger.warn).toHaveBeenCalledTimes(1);

            now += 5 * 60 * 1000;
            await ev.evaluateOnlineAuc();
            expect(logger.warn).toHaveBeenCalledTimes(2);
        } finally {
            nowSpy.mockRestore();
        }
    });

    it('okno samych ACCEPT nie wyzwala rollbacku', async () => {
        const ev = new SelfEvaluationClass();
        for (let i = 0; i < 20; i++) {
            ev.recordPredictionResult(1, 0.5 + (i % 5) * 0.1, 'model-current');
        }
        const result = await ev.evaluateOnlineAuc();
        expect(result.slidingAuc).toBeNull();
        expect(mockRollbackToPrevious).not.toHaveBeenCalled();
    });

    it('okno samych REJECT (label=0) nie wyzwala rollbacku', async () => {
        const ev = new SelfEvaluationClass();
        for (let i = 0; i < 20; i++) {
            ev.recordPredictionResult(0, 0.2 + (i % 5) * 0.1, 'model-current');
        }
        const result = await ev.evaluateOnlineAuc();
        expect(result.slidingAuc).toBeNull();
        expect(mockRollbackToPrevious).not.toHaveBeenCalled();
    });

    it('nie promuje modelu, kiedy inny trening już zajmuje pipeline', async () => {
        const ev = new SelfEvaluationClass();
        mockShouldTrain.mockResolvedValue({
            ok: false,
            reason: 'already_running'
        });

        await expect(ev.runDaily()).resolves.toEqual({ rolledBack: false });

        expect(mockPromoteBestModel).not.toHaveBeenCalled();
    });

    it('runDaily nadal promuje najlepszy model na podstawie oceny modelu po treningu', async () => {
        const ev = new SelfEvaluationClass();

        await expect(ev.runDaily()).resolves.toEqual({ rolledBack: true });

        expect(mockPromoteBestModel).toHaveBeenCalledTimes(1);
    });
});
