import { describe, expect, it, jest, beforeEach } from '@jest/globals';
import { computeRocAuc } from '../../src/services/ml/TrainingPipeline';

jest.mock('../../src/utils/logger', () => ({
    logger: {
        info: jest.fn(),
        warn: jest.fn(),
        error: jest.fn()
    }
}));

const mockRollbackToPrevious = jest.fn<any>().mockResolvedValue(null);

jest.mock('../../src/services/ml/ModelRegistry', () => ({
    modelRegistry: {
        rollbackToPrevious: (...args: any[]) => mockRollbackToPrevious(...args)
    }
}));

jest.mock('../../src/services/ml/TrainingPipeline', () => {
    const actual = jest.requireActual('../../src/services/ml/TrainingPipeline') as {
        computeRocAuc: (...args: number[]) => number;
    };
    return {
        computeRocAuc: (...args: number[]) => actual.computeRocAuc(...args),
        trainingPipeline: {
            run: jest.fn<any>().mockResolvedValue({ trained: false })
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

    it('checkAndRollbackIfNeeded zwraca null gdy window < 10', async () => {
        const ev = new SelfEvaluationClass();
        for (let i = 0; i < 5; i++) {
            ev.recordPredictionResult(1, 0.1);
        }
        const result = await ev.checkAndRollbackIfNeeded();
        expect(result).toEqual({ rolledBack: false, slidingAuc: null });
        expect(mockRollbackToPrevious).not.toHaveBeenCalled();
    });

    it('rollback przy sliding AUC < progu', async () => {
        const ev = new SelfEvaluationClass();
        // odwrócona klasyfikacja (pozytywy dostają niskie score) -> AUC=0 < 0.65
        for (let i = 0; i < 20; i++) {
            ev.recordPredictionResult(i % 2, i % 2 === 0 ? 0.9 : 0.1);
        }
        mockRollbackToPrevious.mockResolvedValue({ id: 'prev', version: 'v0.9.0' });
        const result = await ev.checkAndRollbackIfNeeded();
        expect(result.rolledBack).toBe(true);
        expect(result.slidingAuc).toBeLessThan(0.65);
        expect(mockRollbackToPrevious).toHaveBeenCalled();
        const status = ev as unknown as { slidingWindow: unknown[] };
        expect(status.slidingWindow.length).toBe(0);
    });

    it('brak rollbacku przy zdrowym AUC', async () => {
        const ev = new SelfEvaluationClass();
        for (let i = 0; i < 20; i++) {
            ev.recordPredictionResult(i % 2, i % 2 === 0 ? 0.1 : 0.9);
        }
        const result = await ev.checkAndRollbackIfNeeded();
        expect(result.rolledBack).toBe(false);
        expect(result.slidingAuc).toBeGreaterThanOrEqual(0.65);
        expect(mockRollbackToPrevious).not.toHaveBeenCalled();
    });

    it('brak poprzedniego modelu nie rzuca błędu', async () => {
        const ev = new SelfEvaluationClass();
        for (let i = 0; i < 20; i++) {
            ev.recordPredictionResult(i % 2, i % 2 === 0 ? 0.1 : 0.9);
        }
        mockRollbackToPrevious.mockResolvedValue(null);
        const result = await ev.checkAndRollbackIfNeeded();
        expect(result.rolledBack).toBe(false);
    });

    it('okno samych ACCEPT nie wyzwala rollbacku', async () => {
        const ev = new SelfEvaluationClass();
        for (let i = 0; i < 20; i++) {
            ev.recordPredictionResult(1, 0.5 + (i % 5) * 0.1);
        }
        const result = await ev.checkAndRollbackIfNeeded();
        expect(result.rolledBack).toBe(false);
        expect(result.slidingAuc).toBeNull();
        expect(mockRollbackToPrevious).not.toHaveBeenCalled();
    });

    it('okno samych REJECT (label=0) nie wyzwala rollbacku', async () => {
        const ev = new SelfEvaluationClass();
        for (let i = 0; i < 20; i++) {
            ev.recordPredictionResult(0, 0.2 + (i % 5) * 0.1);
        }
        const result = await ev.checkAndRollbackIfNeeded();
        expect(result.rolledBack).toBe(false);
        expect(result.slidingAuc).toBeNull();
        expect(mockRollbackToPrevious).not.toHaveBeenCalled();
    });
});
