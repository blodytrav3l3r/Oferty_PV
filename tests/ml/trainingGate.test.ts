/**
 * Testy bramki treningu ML (F1/F2): shouldTrain(), pre-flight w run(),
 * retencja AiTrainingRun. Plan: docs/plans/2026-09-11-ml-training-gate.md
 */

import { describe, expect, it, jest, beforeEach } from '@jest/globals';

const mockRunFindFirst = jest.fn<any>();
const mockRunCreate = jest.fn<any>();
const mockRunUpdate = jest.fn<any>();
const mockRunFindMany = jest.fn<any>();
const mockRunDeleteMany = jest.fn<any>();
const mockFeatureCount = jest.fn<any>();
const mockFeatureFindMany = jest.fn<any>();
const mockTelemetryFindMany = jest.fn<any>();
const mockSettingsFindUnique = jest.fn<any>();

jest.mock('../../src/prismaClient', () => ({
    __esModule: true,
    default: {
        aiTrainingRun: {
            findFirst: (...args: any[]) => mockRunFindFirst(...args),
            findMany: (...args: any[]) => mockRunFindMany(...args),
            create: (...args: any[]) => mockRunCreate(...args),
            update: (...args: any[]) => mockRunUpdate(...args),
            deleteMany: (...args: any[]) => mockRunDeleteMany(...args)
        },
        aiFeature: {
            count: (...args: any[]) => mockFeatureCount(...args),
            findMany: (...args: any[]) => mockFeatureFindMany(...args)
        },
        ai_telemetry_logs: {
            findMany: (...args: any[]) => mockTelemetryFindMany(...args)
        },
        settings: {
            findUnique: (...args: any[]) => mockSettingsFindUnique(...args)
        },
        aiModel: {
            findFirst: jest.fn<any>().mockResolvedValue(null),
            findMany: jest.fn<any>().mockResolvedValue([])
        }
    }
}));

jest.mock('../../src/utils/logger', () => ({
    logger: {
        info: jest.fn(),
        warn: jest.fn(),
        error: jest.fn()
    }
}));

const HOUR = 1000 * 60 * 60;

function successRow(finishedAgoMs: number): any {
    return {
        id: 'run-prev',
        status: 'SUCCESS',
        startedAt: new Date(Date.now() - finishedAgoMs - 60000).toISOString(),
        finishedAt: new Date(Date.now() - finishedAgoMs).toISOString()
    };
}

describe('shouldTrain() — pre-flight gate', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        // Domyślnie: allowlista nieskonfigurowana (fail-open → wszyscy).
        mockSettingsFindUnique.mockResolvedValue(null);
        mockRunFindFirst.mockResolvedValue(null);
    });

    it('already_running gdy trening w toku', async () => {
        const { trainingPipeline } = await import('../../src/services/ml/TrainingPipeline');
        (trainingPipeline as any).running = true;
        try {
            const gate = await trainingPipeline.shouldTrain();
            expect(gate).toEqual({ ok: false, reason: 'already_running' });
        } finally {
            (trainingPipeline as any).running = false;
        }
    });

    it('too_soon przy 3h59 od SUCCESS; OK przy 4h00', async () => {
        const { trainingPipeline } = await import('../../src/services/ml/TrainingPipeline');
        mockFeatureCount.mockResolvedValue(500);

        mockRunFindFirst.mockResolvedValue(successRow(3 * HOUR + 59 * 60 * 1000));
        const tooSoon = await trainingPipeline.shouldTrain();
        expect(tooSoon.ok).toBe(false);
        if (!tooSoon.ok) expect(tooSoon.reason).toMatch(/too_soon/);

        mockRunFindFirst.mockResolvedValue(successRow(4 * HOUR + 1000));
        const ok = await trainingPipeline.shouldTrain();
        expect(ok).toEqual({ ok: true });
    });

    it('granica danych: 49 → insufficient, 50 → OK (first-run, brak SUCCESS)', async () => {
        const { trainingPipeline } = await import('../../src/services/ml/TrainingPipeline');
        mockRunFindFirst.mockResolvedValue(null);

        mockFeatureCount.mockResolvedValue(49);
        const under = await trainingPipeline.shouldTrain();
        expect(under).toEqual({ ok: false, reason: 'insufficient_new_data:49' });

        mockFeatureCount.mockResolvedValue(50);
        const exact = await trainingPipeline.shouldTrain();
        expect(exact).toEqual({ ok: true });
    });

    it('allowlista: 100 nowych, 40 kwalifikujących → insufficient_new_data:40', async () => {
        const { trainingPipeline } = await import('../../src/services/ml/TrainingPipeline');
        mockRunFindFirst.mockResolvedValue(null);
        mockSettingsFindUnique.mockResolvedValue({
            key: 'ai_training_user_ids',
            value: JSON.stringify(['u1'])
        });
        mockFeatureFindMany.mockResolvedValue(
            Array.from({ length: 100 }, (_, i) => ({ telemetryId: `tel-${i}` }))
        );
        mockTelemetryFindMany.mockResolvedValue(
            Array.from({ length: 100 }, (_, i) => ({
                id: `tel-${i}`,
                userId: i < 40 ? 'u1' : 'u2'
            }))
        );

        const gate = await trainingPipeline.shouldTrain();

        expect(gate).toEqual({ ok: false, reason: 'insufficient_new_data:40' });
    });
});

describe('run() — pre-flight bez wiersza, force omija bramkę', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        mockSettingsFindUnique.mockResolvedValue(null);
        mockRunCreate.mockResolvedValue({ id: 'run-1' });
        mockRunUpdate.mockResolvedValue({ id: 'run-1' });
    });

    it('pre-flight skip nie tworzy wiersza AiTrainingRun', async () => {
        const { trainingPipeline } = await import('../../src/services/ml/TrainingPipeline');
        mockRunFindFirst.mockResolvedValue(null);
        mockFeatureCount.mockResolvedValue(0);

        const res = await trainingPipeline.run(false);

        expect(res).toEqual({ trained: false, reason: 'insufficient_new_data:0' });
        expect(mockRunCreate).not.toHaveBeenCalled();
    });

    it('force=true omija bramkę (too_soon w DB nie blokuje)', async () => {
        const { trainingPipeline } = await import('../../src/services/ml/TrainingPipeline');
        const { featureExtractor } = await import('../../src/services/ml/FeatureExtractor');
        jest.spyOn(featureExtractor, 'extractAndStore').mockResolvedValue(0);
        jest.spyOn(featureExtractor, 'resyncLabels').mockResolvedValue(0);
        jest.spyOn(featureExtractor, 'resyncFeatures').mockResolvedValue(0);
        // Świeży SUCCESS + 0 nowych: gate by odrzucił, force idzie dalej
        // (kończy na minFeatureCount — to próba z wierszem, nie pre-flight).
        mockRunFindFirst.mockResolvedValue(successRow(HOUR));
        mockFeatureCount.mockResolvedValue(0);

        const res = await trainingPipeline.run(true);

        expect(res.reason).not.toMatch(/too_soon/);
        expect(res.reason).not.toMatch(/insufficient_new_data/);
        expect(mockRunCreate).toHaveBeenCalled();
    });

    it('kontrakt re-checku: świeży SUCCESS → run() wraca bez wiersza', async () => {
        const { trainingPipeline } = await import('../../src/services/ml/TrainingPipeline');
        // Symuluje callera B po treningu callera A: SUCCESS sprzed minuty.
        mockRunFindFirst.mockResolvedValue(successRow(60 * 1000));
        mockFeatureCount.mockResolvedValue(500);

        const res = await trainingPipeline.run(false);

        expect(res.trained).toBe(false);
        expect(res.reason).toMatch(/too_soon/);
        expect(mockRunCreate).not.toHaveBeenCalled();
    });
});

describe('restart persistence — lastSuccessAt z DB, nie z RAM', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        mockSettingsFindUnique.mockResolvedValue(null);
        mockFeatureCount.mockResolvedValue(500);
    });

    it('nowa instancja TrainingPipeline widzi SUCCESS sprzed restartu', async () => {
        const { TrainingPipeline } = await import('../../src/services/ml/TrainingPipeline');
        mockRunFindFirst.mockResolvedValue(successRow(2 * HOUR));

        const fresh = new TrainingPipeline();
        const gate = await fresh.shouldTrain();

        expect(gate.ok).toBe(false);
        if (!gate.ok) expect(gate.reason).toMatch(/too_soon/);
    });
});

describe('gateStatus() — strukturalny status dla dashboardu (F3)', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        mockSettingsFindUnique.mockResolvedValue(null);
        mockRunFindFirst.mockReset();
    });

    function mockGateReads(successRow: any, lastAttemptRow: any): void {
        mockRunFindFirst.mockImplementation((args: any) => {
            if (args && args.where && args.where.status === 'SUCCESS') {
                return Promise.resolve(successRow);
            }
            return Promise.resolve(lastAttemptRow);
        });
    }

    it('kształt OK przy braku SUCCESS: eligible, progi, lastAttempt null', async () => {
        const { trainingPipeline } = await import('../../src/services/ml/TrainingPipeline');
        mockGateReads(null, null);
        mockFeatureCount.mockResolvedValue(60);

        const s = await trainingPipeline.gateStatus();

        expect(s.eligible).toBe(true);
        expect(s.reason).toBe('ok');
        expect(s.newSinceLastTrain).toBe(60);
        expect(s.minNewData).toBe(50);
        expect(s.minHoursSinceLastTrain).toBe(4);
        expect(s.hoursSinceLastTrain).toBeNull();
        expect(s.lastSuccessAt).toBeNull();
        expect(s.nextEligibleAt).toBeNull();
        expect(s.lastAttempt).toBeNull();
        expect(s.running).toBe(false);
    });

    it('too_soon: nextEligibleAt = finishedAt + 4h + mapowanie lastAttempt', async () => {
        const { trainingPipeline } = await import('../../src/services/ml/TrainingPipeline');
        const finishedAt = new Date(Date.now() - 2 * HOUR).toISOString();
        mockGateReads(
            { id: 'run-s', status: 'SUCCESS', startedAt: finishedAt, finishedAt },
            {
                id: 'run-9',
                status: 'SKIPPED',
                error: 'split_guard:dataset=41,train=28,val=6,test=7,testPos=6,testNeg=1',
                startedAt: '2026-09-11T19:20:29.342Z',
                finishedAt: '2026-09-11T19:20:30.000Z'
            }
        );
        mockFeatureCount.mockResolvedValue(500);

        const s = await trainingPipeline.gateStatus();

        expect(s.eligible).toBe(false);
        expect(s.reason).toMatch(/too_soon/);
        expect(s.newSinceLastTrain).toBe(500);
        expect(s.hoursSinceLastTrain).toBeGreaterThan(1.9);
        expect(s.nextEligibleAt).toBe(
            new Date(new Date(finishedAt).getTime() + 4 * HOUR).toISOString()
        );
        expect(s.lastAttempt).toEqual({
            status: 'SKIPPED',
            reason: 'split_guard:dataset=41,train=28,val=6,test=7,testPos=6,testNeg=1',
            startedAt: '2026-09-11T19:20:29.342Z',
            finishedAt: '2026-09-11T19:20:30.000Z'
        });
    });

    it('already_running → eligible false bez liczenia na nowo', async () => {
        const { trainingPipeline } = await import('../../src/services/ml/TrainingPipeline');
        mockGateReads(null, null);
        mockFeatureCount.mockResolvedValue(60);
        (trainingPipeline as any).running = true;
        try {
            const s = await trainingPipeline.gateStatus();
            expect(s.eligible).toBe(false);
            expect(s.reason).toBe('already_running');
            expect(s.running).toBe(true);
        } finally {
            (trainingPipeline as any).running = false;
        }
    });
});

describe('pruneTrainingRuns — retencja 100', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    it('trzyma 100 najnowszych (startedAt DESC, id DESC), resztę kasuje', async () => {
        const { pruneTrainingRuns } = await import('../../src/services/ml/TrainingPipeline');
        const kept = Array.from({ length: 100 }, (_, i) => ({ id: `run-${i}` }));
        mockRunFindMany.mockResolvedValue(kept);
        mockRunDeleteMany.mockResolvedValue({ count: 5 });

        const res = await pruneTrainingRuns();

        expect(mockRunFindMany).toHaveBeenCalledWith(
            expect.objectContaining({
                orderBy: [{ startedAt: 'desc' }, { id: 'desc' }],
                take: 100
            })
        );
        expect(mockRunDeleteMany).toHaveBeenCalledWith({
            where: { id: { notIn: kept.map((r) => r.id) } }
        });
        expect(res).toEqual({ deleted: 5 });
    });

    it('pusta tabela → brak kasowania', async () => {
        const { pruneTrainingRuns } = await import('../../src/services/ml/TrainingPipeline');
        mockRunFindMany.mockResolvedValue([]);

        const res = await pruneTrainingRuns();

        expect(mockRunDeleteMany).not.toHaveBeenCalled();
        expect(res).toEqual({ deleted: 0 });
    });
});
