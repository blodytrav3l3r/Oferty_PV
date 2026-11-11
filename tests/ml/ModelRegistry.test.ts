/**
 * Testy behawioralne rejestru modeli ML (bez prawdziwej bazy — mock prismaClient).
 * Retencja rejestru ma osobny plik: ModelRegistryPrune.test.ts.
 */

const findFirst = jest.fn();
const findMany = jest.fn();
const findUnique = jest.fn();
const create = jest.fn();
const update = jest.fn();
const updateMany = jest.fn();
const deleteRecord = jest.fn();
const count = jest.fn();
const transaction = jest.fn();
const clearPredictionCache = jest.fn();

jest.mock('../../src/prismaClient', () => {
    const prisma: Record<string, unknown> = {
        aiModel: {
            findFirst: (...args: unknown[]) => findFirst(...args),
            findMany: (...args: unknown[]) => findMany(...args),
            findUnique: (...args: unknown[]) => findUnique(...args),
            create: (...args: unknown[]) => create(...args),
            update: (...args: unknown[]) => update(...args),
            updateMany: (...args: unknown[]) => updateMany(...args),
            delete: (...args: unknown[]) => deleteRecord(...args),
            count: (...args: unknown[]) => count(...args)
        }
    };
    prisma.$transaction = (cb: (client: unknown) => Promise<unknown>) => {
        transaction(cb);
        return cb(prisma);
    };
    return { __esModule: true, default: prisma };
});

jest.mock('../../src/services/ml/predictionCache', () => ({
    clearPredictionCache: (...args: unknown[]) => clearPredictionCache(...args)
}));

jest.mock('../../src/utils/logger', () => ({
    logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() }
}));

import {
    ModelRegistry,
    type ModelMetrics,
    type StoredModel
} from '../../src/services/ml/ModelRegistry';
import { AiModelState } from '../../src/services/ml/aiModelState';
import { FEATURE_NAMES } from '../../src/config/mlConstants';
import { ML_CONSTANTS } from '../../src/config/mlConstants';
import { logger } from '../../src/utils/logger';

const CURRENT_FV = ML_CONSTANTS.FEATURE_VERSION;

const metrics: ModelMetrics = {
    accuracy: 0.8,
    precision: 0.7,
    recall: 0.6,
    f1: 0.65,
    rocAuc: 0.9,
    trainSize: 100,
    valSize: 20
};

const model = {
    getWeights: () => [0.1, 0.2],
    getBias: () => 0.5
} as never;

interface ModelRecord {
    id: string;
    version: string;
    weights: string;
    bias: number;
    metrics: string;
    features: string;
    featureMins: string;
    featureMaxs: string;
    trainingRows: number;
    active: boolean;
    notes?: string | null;
    featureVersion: string | null;
    state: string | null;
    seed?: number | null;
    featureDistributions?: string | null;
    createdAt: string;
}

function record(overrides: Partial<ModelRecord> = {}): ModelRecord {
    return {
        id: 'm-1',
        version: 'v1.0.0-20260101-abcdef12',
        weights: JSON.stringify([0.1, 0.2]),
        bias: 0.5,
        metrics: JSON.stringify(metrics),
        features: JSON.stringify(['f1', 'f2']),
        featureMins: JSON.stringify([0, 0]),
        featureMaxs: JSON.stringify([1, 1]),
        trainingRows: 100,
        active: true,
        notes: null,
        featureVersion: CURRENT_FV,
        state: AiModelState.PRODUCTION,
        seed: 42,
        featureDistributions: null,
        createdAt: '2026-01-01T00:00:00.000Z',
        ...overrides
    };
}

const registry = new ModelRegistry();

beforeEach(() => {
    jest.clearAllMocks();
    jest.restoreAllMocks();
    create.mockImplementation(async (args: { data: Record<string, unknown> }) => ({
        ...record(),
        ...args.data
    }));
    count.mockResolvedValue(0);
    update.mockResolvedValue({});
    updateMany.mockResolvedValue({ count: 0 });
    deleteRecord.mockResolvedValue({});
    jest.spyOn(registry, 'pruneOldModels').mockResolvedValue({
        deletedCount: 0,
        deletedVersions: []
    });
});

describe('ModelRegistry.saveModel', () => {
    it('aktywuje nowy model, dezaktywuje poprzedni i czyści cache predykcji', async () => {
        findFirst.mockResolvedValueOnce({ id: 'old', version: 'v0' });

        const version = await registry.saveModel(
            model,
            metrics,
            ['f1', 'f2'],
            [0, 0],
            [1, 1],
            true
        );

        expect(version).toMatch(/^v1\.0\.0-\d{8}-[0-9a-f]{8}$/);
        expect(update).toHaveBeenCalledWith({
            where: { id: 'old' },
            data: { active: false, state: AiModelState.ROLLED_BACK }
        });
        expect(create).toHaveBeenCalledWith({
            data: expect.objectContaining({
                active: true,
                state: AiModelState.APPROVED,
                featureVersion: CURRENT_FV,
                trainingRows: 100,
                weights: '[0.1,0.2]',
                bias: 0.5
            })
        });
        expect(clearPredictionCache).toHaveBeenCalledTimes(1);
        expect(logger.info).toHaveBeenCalledWith(
            'ModelRegistry',
            `Zapisano model ${version} (active=true, auc=0.9000)`
        );
    });

    it('zapisuje kandydata bez dezaktywacji, honorując jawny stan i notatkę', async () => {
        await registry.saveModel(
            model,
            metrics,
            ['f1'],
            [0],
            [1],
            false,
            'trening nocny',
            AiModelState.REJECTED,
            '{"f1":1}'
        );

        expect(findFirst).not.toHaveBeenCalled();
        expect(update).not.toHaveBeenCalled();
        expect(clearPredictionCache).not.toHaveBeenCalled();
        expect(create).toHaveBeenCalledWith({
            data: expect.objectContaining({
                active: false,
                state: AiModelState.REJECTED,
                notes: 'trening nocny',
                featureDistributions: '{"f1":1}'
            })
        });
    });

    it('kandydat bez jawnego stanu dostaje CANDIDATE', async () => {
        await registry.saveModel(model, metrics, ['f1'], [0], [1], false);

        expect(create).toHaveBeenCalledWith({
            data: expect.objectContaining({ state: AiModelState.CANDIDATE, notes: null })
        });
    });
});

describe('ModelRegistry.getActiveModel / getProductionModel', () => {
    it('zwraca model bieżącej wersji cech z sparsowanymi polami', async () => {
        findFirst.mockResolvedValueOnce(record());

        const active = await registry.getActiveModel();

        expect(findFirst).toHaveBeenCalledWith({
            where: { active: true, featureVersion: CURRENT_FV }
        });
        expect(active).toMatchObject({
            id: 'm-1',
            weights: [0.1, 0.2],
            bias: 0.5,
            features: ['f1', 'f2'],
            featureMins: [0, 0],
            featureMaxs: [1, 1],
            trainingRows: 100,
            active: true,
            state: AiModelState.PRODUCTION,
            seed: 42
        });
        expect(active?.metrics.rocAuc).toBe(0.9);
    });

    it('brak modelu daje null (bez fallbacku na starą wersję cech)', async () => {
        findFirst.mockResolvedValueOnce(null);

        expect(await registry.getActiveModel()).toBeNull();
    });

    it('uszkodzony JSON w rekordzie daje bezpieczne domyślne wartości', async () => {
        findFirst.mockResolvedValueOnce(
            record({
                weights: '{zle',
                metrics: '{zle',
                features: 'null',
                featureMins: '',
                featureMaxs: '{zle'
            })
        );

        const active = (await registry.getActiveModel()) as StoredModel;

        expect(active.weights).toEqual([]);
        expect(active.features).toEqual([]);
        expect(active.featureMins).toEqual([]);
        expect(active.featureMaxs).toEqual([]);
        expect(active.metrics).toEqual({
            accuracy: 0,
            precision: 0,
            recall: 0,
            f1: 0,
            rocAuc: 0,
            trainSize: 0,
            valSize: 0
        });
    });

    it('getProductionModel deleguje do aktywnego modelu', async () => {
        findFirst.mockResolvedValueOnce(record());
        await expect(registry.getProductionModel()).resolves.toMatchObject({ id: 'm-1' });
    });
});

describe('ModelRegistry.getBestAuc / listModels / getModelCount', () => {
    it('zwraca najwyższe AUC, pomijając uszkodzone metryki, i -1 gdy brak', async () => {
        findMany.mockResolvedValueOnce([
            record({ id: 'a', metrics: JSON.stringify({ rocAuc: 0.7 }) }),
            record({ id: 'b', metrics: JSON.stringify({ rocAuc: 0.95 }) }),
            record({ id: 'c', metrics: '{zle' }),
            record({ id: 'd', metrics: JSON.stringify({}) })
        ]);
        await expect(registry.getBestAuc()).resolves.toBe(0.95);

        findMany.mockResolvedValueOnce([]);
        await expect(registry.getBestAuc()).resolves.toBe(-1);
    });

    it('listModels mapuje rekordy i loguje uszkodzone JSON-y', async () => {
        findMany.mockResolvedValueOnce([
            record(),
            record({ id: 'm-2', version: 'v2', metrics: '{zle', features: '{zle' })
        ]);

        const list = await registry.listModels(5);

        expect(findMany).toHaveBeenCalledWith({
            orderBy: { createdAt: 'desc' },
            take: 5
        });
        expect(list).toHaveLength(2);
        expect(list[0]).toMatchObject({ id: 'm-1', active: true, features: ['f1', 'f2'] });
        expect(list[1].metrics).toBeNull();
        expect(list[1].features).toEqual([]);
        expect(logger.warn).toHaveBeenCalledWith(
            'ModelRegistry',
            'Uszkodzone metryki JSON w modelu m-2 (version v2)'
        );
        expect(logger.warn).toHaveBeenCalledWith(
            'ModelRegistry',
            'Uszkodzona lista cech JSON w modelu m-2 (version v2)'
        );
    });

    it('getModelCount zwraca licznik z bazy', async () => {
        count.mockResolvedValueOnce(12);
        await expect(registry.getModelCount()).resolves.toBe(12);
        expect(count).toHaveBeenCalledWith();
    });
});

describe('ModelRegistry.rollbackToPrevious', () => {
    it('przywraca poprzedni model atomowo i czyści cache', async () => {
        const active = record({ id: 'current', active: true });
        const previous = record({ id: 'prev', version: 'v-prev', active: false });
        findFirst.mockResolvedValueOnce(active).mockResolvedValueOnce(previous);

        const restored = await registry.rollbackToPrevious();

        expect(transaction).toHaveBeenCalledTimes(1);
        expect(update).toHaveBeenCalledWith({
            where: { id: 'current' },
            data: { active: false, state: AiModelState.ROLLED_BACK }
        });
        expect(update).toHaveBeenCalledWith({
            where: { id: 'prev' },
            data: { active: true, state: AiModelState.PRODUCTION }
        });
        expect(clearPredictionCache).toHaveBeenCalledTimes(1);
        expect(restored).toMatchObject({ id: 'prev', active: false });
        expect(logger.info).toHaveBeenCalledWith('ModelRegistry', 'Rollback do modelu v-prev');
    });

    it('bez poprzedniego modelu loguje ostrzeżenie i zwraca null', async () => {
        findFirst.mockResolvedValueOnce(record({ id: 'current' })).mockResolvedValueOnce(null);

        await expect(registry.rollbackToPrevious()).resolves.toBeNull();
        expect(update).not.toHaveBeenCalled();
        expect(logger.warn).toHaveBeenCalledWith(
            'ModelRegistry',
            'Brak poprzedniego modelu — rollback niemozliwy'
        );
    });

    it('bez aktywnego modelu zwraca null bez logowania', async () => {
        findFirst.mockResolvedValueOnce(null).mockResolvedValueOnce(record({ id: 'prev' }));

        await expect(registry.rollbackToPrevious()).resolves.toBeNull();
        expect(update).not.toHaveBeenCalled();
        expect(logger.warn).not.toHaveBeenCalled();
    });
});

describe('ModelRegistry.activateModel', () => {
    it('zwraca null dla nieistniejącego modelu', async () => {
        findUnique.mockResolvedValueOnce(null);
        await expect(registry.activateModel('brak')).resolves.toBeNull();
    });

    it('nie rusza bazy, gdy model już jest aktywny', async () => {
        findUnique.mockResolvedValueOnce(record({ active: true }));

        const active = await registry.activateModel('m-1');

        expect(active).toMatchObject({ id: 'm-1' });
        expect(transaction).not.toHaveBeenCalled();
    });

    it('odrzuca model spoza bieżącej wersji cech', async () => {
        findUnique.mockResolvedValueOnce(record({ active: false, featureVersion: 'v0' }));

        await expect(registry.activateModel('m-1')).rejects.toThrow(
            `Nie można aktywować modelu spoza bieżącej wersji cech (v0 != ${CURRENT_FV})`
        );
        expect(transaction).not.toHaveBeenCalled();
        expect(logger.warn).toHaveBeenCalledWith(
            'ModelRegistry',
            `Odrzucono aktywację modelu v1.0.0-20260101-abcdef12 (featureVersion=v0 != ${CURRENT_FV})`
        );
    });

    it('dezaktywuje poprzedni i aktywuje wybrany model', async () => {
        findUnique.mockResolvedValueOnce(record({ id: 'target', active: false }));
        findFirst.mockResolvedValueOnce({ id: 'old', version: 'v-old' });

        const activated = await registry.activateModel('target');

        expect(update).toHaveBeenCalledWith({
            where: { id: 'old' },
            data: { active: false, state: AiModelState.ROLLED_BACK }
        });
        expect(update).toHaveBeenCalledWith({
            where: { id: 'target' },
            data: { active: true, state: AiModelState.PRODUCTION }
        });
        expect(clearPredictionCache).toHaveBeenCalledTimes(1);
        expect(activated).toMatchObject({ id: 'target' });
    });

    it('aktywuje model, gdy w bazie nie ma żadnego aktywnego', async () => {
        findUnique.mockResolvedValueOnce(record({ id: 'target', active: false }));
        findFirst.mockResolvedValueOnce(null);

        await registry.activateModel('target');

        expect(update).toHaveBeenCalledTimes(1);
        expect(update).toHaveBeenCalledWith({
            where: { id: 'target' },
            data: { active: true, state: AiModelState.PRODUCTION }
        });
    });
});

describe('ModelRegistry.promoteModel', () => {
    it('zwraca null dla nieistniejącego modelu', async () => {
        findUnique.mockResolvedValueOnce(null);
        await expect(registry.promoteModel('brak')).resolves.toBeNull();
    });

    it('odrzuca model REJECTED', async () => {
        findUnique.mockResolvedValueOnce(record({ state: AiModelState.REJECTED }));

        await expect(registry.promoteModel('m-1')).rejects.toThrow(
            'Model REJECTED nie może być promowany'
        );
        expect(transaction).not.toHaveBeenCalled();
    });

    it('model już PRODUCTION zwraca bez transakcji', async () => {
        findUnique.mockResolvedValueOnce(record({ state: AiModelState.PRODUCTION }));

        await expect(registry.promoteModel('m-1')).resolves.toMatchObject({ id: 'm-1' });
        expect(transaction).not.toHaveBeenCalled();
    });

    it('odrzuca model spoza bieżącej wersji cech', async () => {
        findUnique.mockResolvedValueOnce(
            record({ state: AiModelState.APPROVED, featureVersion: 'stara' })
        );

        await expect(registry.promoteModel('m-1')).rejects.toThrow(/spoza bieżącej wersji cech/);
    });

    it('promuje APPROVED do PRODUCTION i wyłącza pozostałe aktywne', async () => {
        findUnique.mockResolvedValueOnce(record({ id: 'target', state: AiModelState.APPROVED }));
        findFirst.mockResolvedValueOnce({ id: 'old' });

        const promoted = await registry.promoteModel('target');

        expect(update).toHaveBeenCalledWith({
            where: { id: 'old' },
            data: { active: false, state: AiModelState.ROLLED_BACK }
        });
        expect(update).toHaveBeenCalledWith({
            where: { id: 'target' },
            data: { active: true, state: AiModelState.PRODUCTION }
        });
        expect(updateMany).toHaveBeenCalledWith({
            where: { active: true, id: { not: 'target' } },
            data: { active: false }
        });
        expect(clearPredictionCache).toHaveBeenCalledTimes(1);
        expect(promoted).toMatchObject({ id: 'target' });
    });

    it('brak stanu traktuje jak CANDIDATE i promuje', async () => {
        findUnique.mockResolvedValueOnce(record({ id: 'target', state: null }));
        findFirst.mockResolvedValueOnce(null);

        await expect(registry.promoteModel('target')).resolves.toMatchObject({ id: 'target' });
    });
});

describe('ModelRegistry.approveModel', () => {
    it('zwraca null dla nieistniejącego modelu', async () => {
        findUnique.mockResolvedValueOnce(null);
        await expect(registry.approveModel('brak', 'admin')).resolves.toBeNull();
    });

    it('odrzuca model, który nie jest REJECTED', async () => {
        findUnique.mockResolvedValueOnce(record({ state: AiModelState.APPROVED }));

        await expect(registry.approveModel('m-1', 'admin')).rejects.toThrow(
            'Override tylko dla modeli REJECTED (obecny stan: APPROVED)'
        );
        expect(update).not.toHaveBeenCalled();
    });

    it('przełącza REJECTED na APPROVED i dopisuje ślad admina', async () => {
        findUnique.mockResolvedValueOnce(
            record({ id: 'm-1', state: AiModelState.REJECTED, notes: 'stara notatka' })
        );

        const approved = await registry.approveModel('m-1', 'admin');

        expect(update).toHaveBeenCalledWith({
            where: { id: 'm-1' },
            data: {
                state: AiModelState.APPROVED,
                notes: expect.stringContaining('stara notatka\n[approve by admin @ ')
            }
        });
        const notes = (update.mock.calls[0][0] as { data: { notes: string } }).data.notes;
        expect(notes).toContain('manual override REJECTED → APPROVED');
        expect(approved).toMatchObject({ id: 'm-1', state: AiModelState.APPROVED });
        expect(logger.info).toHaveBeenCalledWith(
            'ModelRegistry',
            expect.stringContaining('Ręczny approve modelu')
        );
    });

    it('bez wcześniejszych notatek tworzy tylko nowy wpis', async () => {
        findUnique.mockResolvedValueOnce(
            record({ id: 'm-1', state: AiModelState.REJECTED, notes: null })
        );

        await registry.approveModel('m-1', 'admin');

        const notes = (update.mock.calls[0][0] as { data: { notes: string } }).data.notes;
        expect(notes.startsWith('[approve by admin @ ')).toBe(true);
    });
});

describe('ModelRegistry.promoteBestModel', () => {
    it('zwraca null bez modeli w bieżącej wersji cech', async () => {
        findMany.mockResolvedValueOnce([]);
        await expect(registry.promoteBestModel()).resolves.toBeNull();
    });

    it('pomija promocję, gdy żaden model nie ma metryk AUC', async () => {
        findMany.mockResolvedValueOnce([
            record({ id: 'a', metrics: '{zle' }),
            record({ id: 'b', metrics: JSON.stringify({}) })
        ]);

        await expect(registry.promoteBestModel()).resolves.toBeNull();
        expect(logger.warn).toHaveBeenCalledWith(
            'ModelRegistry',
            'Brak modelu z metrykami AUC>=0 — promocja pominięta'
        );
        expect(transaction).not.toHaveBeenCalled();
    });

    it('nie wykonuje transakcji, gdy najlepszy model jest już aktywny', async () => {
        const best = record({ id: 'best', active: true });
        findMany.mockResolvedValueOnce([best]);
        findFirst.mockResolvedValueOnce({ id: 'best' });

        await expect(registry.promoteBestModel()).resolves.toMatchObject({ id: 'best' });
        expect(transaction).not.toHaveBeenCalled();
    });

    it('promuje model o najwyższym AUC', async () => {
        const best = record({ id: 'best', metrics: JSON.stringify({ rocAuc: 0.99 }) });
        findMany.mockResolvedValueOnce([
            record({ id: 'slaby', metrics: JSON.stringify({ rocAuc: 0.5 }) }),
            best
        ]);
        findFirst.mockResolvedValueOnce({ id: 'old' });

        const promoted = await registry.promoteBestModel();

        expect(update).toHaveBeenCalledWith({
            where: { id: 'old' },
            data: { active: false, state: AiModelState.ROLLED_BACK }
        });
        expect(update).toHaveBeenCalledWith({
            where: { id: 'best' },
            data: { active: true, state: AiModelState.PRODUCTION }
        });
        expect(promoted).toMatchObject({ id: 'best' });
        expect(logger.info).toHaveBeenCalledWith(
            'ModelRegistry',
            'Promowano najlepszy model v1.0.0-20260101-abcdef12 (auc=0.99)'
        );
    });

    it('promuje najlepszy model, gdy nie ma aktywnego', async () => {
        findMany.mockResolvedValueOnce([record({ id: 'best' })]);
        findFirst.mockResolvedValueOnce(null);

        await registry.promoteBestModel();

        expect(update).toHaveBeenCalledTimes(1);
        expect(clearPredictionCache).toHaveBeenCalledTimes(1);
    });
});

describe('ModelRegistry.deleteModel', () => {
    it('zwraca null dla nieistniejącego modelu', async () => {
        findUnique.mockResolvedValueOnce(null);
        await expect(registry.deleteModel('brak')).resolves.toBeNull();
        expect(deleteRecord).not.toHaveBeenCalled();
    });

    it('odmawia usunięcia aktywnego modelu', async () => {
        findUnique.mockResolvedValueOnce(record({ active: true }));

        await expect(registry.deleteModel('m-1')).rejects.toThrow(
            'Nie można usunąć aktywnego modelu'
        );
        expect(deleteRecord).not.toHaveBeenCalled();
    });

    it('usuwa nieaktywny model i zwraca jego dane', async () => {
        findUnique.mockResolvedValueOnce(record({ id: 'm-9', active: false, version: 'v9' }));

        await expect(registry.deleteModel('m-9')).resolves.toMatchObject({ id: 'm-9' });
        expect(deleteRecord).toHaveBeenCalledWith({ where: { id: 'm-9' } });
        expect(logger.info).toHaveBeenCalledWith('ModelRegistry', 'Usunięto model v9');
    });
});

describe('ModelRegistry.ensureStarterModelExists', () => {
    it('zwraca istniejący aktywny model', async () => {
        findFirst.mockResolvedValueOnce(record());

        await expect(registry.ensureStarterModelExists()).resolves.toMatchObject({ id: 'm-1' });
        expect(count).not.toHaveBeenCalled();
        expect(create).not.toHaveBeenCalled();
    });

    it('promuje najlepszy model, gdy brak aktywnego, ale są modele bieżącej wersji', async () => {
        findFirst.mockResolvedValueOnce(null);
        count.mockResolvedValueOnce(2);
        jest.spyOn(registry, 'promoteBestModel').mockResolvedValueOnce({
            id: 'best'
        } as StoredModel);

        await expect(registry.ensureStarterModelExists()).resolves.toMatchObject({ id: 'best' });
        expect(create).not.toHaveBeenCalled();
    });

    it('tworzy model startowy z neutralnymi wagami, gdy rejestr jest pusty', async () => {
        findFirst.mockResolvedValueOnce(null);
        count.mockResolvedValueOnce(0);
        create.mockImplementationOnce(async (args: { data: Record<string, unknown> }) => ({
            ...record(),
            ...args.data
        }));

        const starter = await registry.ensureStarterModelExists();

        const data = (create.mock.calls[0][0] as { data: Record<string, unknown> }).data;
        expect(data).toMatchObject({
            version: 'v0.1.0-starter',
            bias: 0,
            trainingRows: 0,
            active: true,
            state: AiModelState.PRODUCTION,
            featureVersion: CURRENT_FV
        });
        expect(JSON.parse(data.weights as string)).toEqual(FEATURE_NAMES.map(() => 0));
        expect(JSON.parse(data.featureMaxs as string)).toEqual(FEATURE_NAMES.map(() => 1));
        expect(JSON.parse(data.features as string)).toEqual(FEATURE_NAMES);
        expect(starter.version).toBe('v0.1.0-starter');
        expect(logger.info).toHaveBeenCalledWith(
            'ModelRegistry',
            'Utworzono i aktywowano domyślny model startowy ML (v0.1.0-starter)'
        );
    });

    it('tworzy starter, gdy promocja najlepszego modelu się nie uda', async () => {
        findFirst.mockResolvedValueOnce(null);
        count.mockResolvedValueOnce(3);
        jest.spyOn(registry, 'promoteBestModel').mockResolvedValueOnce(null);

        await registry.ensureStarterModelExists();

        expect(create).toHaveBeenCalledTimes(1);
    });
});

describe('ModelRegistry.computeFeatureImportance', () => {
    it('sortuje cechy po wpływie i używa nazw z modelu', () => {
        const result = registry.computeFeatureImportance({
            ...(record() as unknown as StoredModel),
            weights: [0.1, 0.5, 0.2],
            features: ['mała', 'duża', ''],
            featureMins: [0, 0, 0],
            featureMaxs: [1, 2, 1]
        });

        expect(result).toEqual([
            { featureName: 'duża', importance: 1 },
            { featureName: 'feature_2', importance: 0.2 },
            { featureName: 'mała', importance: 0.1 }
        ]);
    });

    it('traktuje niefinitywny zakres jak zero', () => {
        const result = registry.computeFeatureImportance({
            ...(record() as unknown as StoredModel),
            weights: [0.5],
            features: ['f'],
            featureMins: [0],
            featureMaxs: [Number.POSITIVE_INFINITY]
        });

        expect(result).toEqual([{ featureName: 'f', importance: 0 }]);
    });
});
