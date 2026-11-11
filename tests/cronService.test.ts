const runFullCycle = jest.fn();
const shouldTrain = jest.fn();
const run = jest.fn();
const pruneTrainingRuns = jest.fn();
const runDaily = jest.fn();
const sweepExpiredDrafts = jest.fn();
const runBackup = jest.fn();
const ftsSyncStatus = jest.fn();
const getPricelistHealth = jest.fn();
const telemetryCount = jest.fn();
const knowledgeCount = jest.fn();

jest.mock('../src/utils/logger', () => ({
    logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() }
}));

jest.mock('../src/services/telemetry/learning', () => ({
    learningEngine: { runFullCycle: (...args: unknown[]) => runFullCycle(...args) }
}));

jest.mock('../src/services/ml/TrainingPipeline', () => ({
    trainingPipeline: {
        shouldTrain: (...args: unknown[]) => shouldTrain(...args),
        run: (...args: unknown[]) => run(...args)
    },
    pruneTrainingRuns: (...args: unknown[]) => pruneTrainingRuns(...args)
}));

jest.mock('../src/services/ml/SelfEvaluation', () => ({
    selfEvaluation: { runDaily: (...args: unknown[]) => runDaily(...args) }
}));

jest.mock('../src/services/drafts/draftService', () => ({
    sweepExpiredDrafts: (...args: unknown[]) => sweepExpiredDrafts(...args)
}));

jest.mock('../scripts/backup', () => ({
    runBackup: (...args: unknown[]) => runBackup(...args)
}));

jest.mock('../src/utils/postgresOfferSearchIndexes', () => ({
    ftsSyncStatus: (...args: unknown[]) => ftsSyncStatus(...args)
}));

jest.mock('../src/services/pricelist/health', () => ({
    getPricelistHealth: (...args: unknown[]) => getPricelistHealth(...args)
}));

jest.mock('../src/prismaClient', () => ({
    __esModule: true,
    default: {
        ai_telemetry_logs: { count: (...args: unknown[]) => telemetryCount(...args) },
        ai_knowledge_base: { count: (...args: unknown[]) => knowledgeCount(...args) }
    },
    Prisma: { empty: '', sql: () => '', raw: (s: string) => s, join: () => '' }
}));

import { cronService } from '../src/utils/cronService';
import { logger } from '../src/utils/logger';

const HOUR = 60 * 60 * 1000;

beforeEach(() => {
    jest.useFakeTimers();
    cronService.shutdown();
    jest.clearAllMocks();
    runFullCycle.mockResolvedValue({
        processed: 10,
        patternsDetected: 2,
        persistedToKb: 1,
        durationMs: 5
    });
    telemetryCount.mockResolvedValue(42);
    knowledgeCount.mockResolvedValue(7);
    shouldTrain.mockResolvedValue({ ok: true });
    run.mockResolvedValue({ trained: true, version: 'v2', metrics: { rocAuc: 0.9 } });
    pruneTrainingRuns.mockResolvedValue({ deleted: 3 });
    sweepExpiredDrafts.mockResolvedValue(4);
    runBackup.mockResolvedValue({ file: 'dump.sql', size: 2048, verification: 'OK' });
    runDaily.mockResolvedValue({ rolledBack: false });
    ftsSyncStatus.mockResolvedValue({
        inSync: true,
        tables: { rury: { fts: 1, offers: 1 }, studnie: { fts: 2, offers: 2 } }
    });
    getPricelistHealth.mockResolvedValue({ ok: true, violations: [] });
});

afterEach(() => {
    cronService.shutdown();
    jest.useRealTimers();
});

describe('CronService — rejestracja zadań', () => {
    it('init rejestruje wszystkie zadania i blokuje podwójną inicjalizację', () => {
        cronService.init();

        const status = cronService.getStatus();
        expect(status.enabled).toBe(true);
        expect(status.runningTasks).toEqual([
            'analyzeUsagePreferences',
            'fullLearningCycle',
            'mlTrainingPipeline',
            'mlSelfEvaluation',
            'dailyHousekeeping',
            'dailyBackup',
            'ftsConsistencyCheck',
            'pricelistHealth'
        ]);

        cronService.init();
        expect(logger.warn).toHaveBeenCalledWith('CronService', 'Już zainicjalizowane');
        expect(cronService.getStatus().runningTasks).toHaveLength(8);
    });

    it('podwójna rejestracja tej samej nazwy jest ignorowana', () => {
        cronService.schedule('task', HOUR, jest.fn());
        cronService.schedule('task', HOUR, jest.fn());

        expect(logger.warn).toHaveBeenCalledWith('CronService', 'Task task już zarejestrowany');
        expect(cronService.getStatus().runningTasks).toEqual(['task']);
    });

    it('cancel zatrzymuje zadanie, shutdown czyści wszystko', () => {
        cronService.schedule('a', HOUR, jest.fn());
        cronService.schedule('b', HOUR, jest.fn());

        cronService.cancel('a');
        expect(logger.info).toHaveBeenCalledWith('CronService', 'Zatrzymano a');
        expect(cronService.getStatus().runningTasks).toEqual(['b']);

        cronService.cancel('nieistnieje');
        cronService.shutdown();
        expect(cronService.getStatus()).toEqual({ enabled: false, runningTasks: [] });
    });

    it('zadanie cykliczne wykonuje się po interwale', async () => {
        const task = jest.fn().mockResolvedValue(undefined);
        cronService.schedule('periodic', HOUR, task);

        await jest.advanceTimersByTimeAsync(HOUR);

        expect(task).toHaveBeenCalledTimes(1);
    });

    it('pomija run, gdy poprzedni jeszcze trwa', async () => {
        let release: () => void = () => undefined;
        const task = jest.fn(
            () =>
                new Promise<void>((resolve) => {
                    release = resolve;
                })
        );
        cronService.schedule('slow', HOUR, task);

        jest.advanceTimersByTime(HOUR);
        await Promise.resolve();
        jest.advanceTimersByTime(HOUR);
        await Promise.resolve();

        expect(task).toHaveBeenCalledTimes(1);
        expect(logger.warn).toHaveBeenCalledWith(
            'CronService',
            'Pominięto slow — poprzedni run w toku'
        );
        release();
    });

    it('błąd zadania jest logowany, a flaga running zwalniana', async () => {
        const task = jest.fn().mockRejectedValue(new Error('boom'));
        cronService.schedule('failing', HOUR, task);

        await jest.advanceTimersByTimeAsync(HOUR);
        await jest.advanceTimersByTimeAsync(HOUR);

        expect(task).toHaveBeenCalledTimes(2);
        expect(logger.error).toHaveBeenCalledWith('CronService', 'Błąd w failing: Error: boom');
    });
});

describe('CronService — zadania', () => {
    it('runFullCycle loguje podsumowanie', async () => {
        await cronService.runFullCycle();
        expect(logger.info).toHaveBeenCalledWith(
            'CronService',
            '[fullCycle] processed=10, patterns=2, persisted=1, ms=5'
        );
    });

    it('runFullCycle loguje błąd', async () => {
        runFullCycle.mockRejectedValueOnce(new Error('x'));
        await cronService.runFullCycle();
        expect(logger.error).toHaveBeenCalledWith('CronService', '[fullCycle] failed: Error: x');
    });

    it('runUsageAnalysis loguje liczniki telemetrii i wzorców', async () => {
        await cronService.runUsageAnalysis();
        expect(telemetryCount).toHaveBeenCalled();
        expect(knowledgeCount).toHaveBeenCalled();
        expect(logger.info).toHaveBeenCalledWith(
            'CronService',
            '[usageAnalysis] telemetry=42, patterns=7'
        );
    });

    it('runUsageAnalysis loguje błąd', async () => {
        telemetryCount.mockRejectedValueOnce(new Error('db'));
        await cronService.runUsageAnalysis();
        expect(logger.error).toHaveBeenCalledWith(
            'CronService',
            '[usageAnalysis] failed: Error: db'
        );
    });

    it('runMlTraining pomija przy zamkniętej bramce', async () => {
        shouldTrain.mockResolvedValueOnce({ ok: false, reason: 'za mało danych' });

        await cronService.runMlTraining();

        expect(run).not.toHaveBeenCalled();
        expect(logger.info).toHaveBeenCalledWith(
            'CronService',
            '[mlTraining] pomijam: za mało danych'
        );
    });

    it('runMlTraining loguje nowy model po treningu', async () => {
        await cronService.runMlTraining();
        expect(logger.info).toHaveBeenCalledWith(
            'CronService',
            '[mlTraining] nowy model v2 AUC=0.9'
        );
    });

    it('runMlTraining loguje pominięcie treningu', async () => {
        run.mockResolvedValueOnce({ trained: false, reason: 'brak poprawy' });
        await cronService.runMlTraining();
        expect(logger.info).toHaveBeenCalledWith(
            'CronService',
            '[mlTraining] pomijam: brak poprawy'
        );
    });

    it('runMlTraining loguje błąd', async () => {
        shouldTrain.mockRejectedValueOnce(new Error('ml'));
        await cronService.runMlTraining();
        expect(logger.error).toHaveBeenCalledWith('CronService', '[mlTraining] failed: Error: ml');
    });

    it('runHousekeeping: pruna treningów i draftów', async () => {
        await cronService.runHousekeeping();
        expect(logger.info).toHaveBeenCalledWith(
            'CronService',
            '[housekeeping] prune AiTrainingRun: usunięto 3'
        );
        expect(logger.info).toHaveBeenCalledWith(
            'CronService',
            '[housekeeping] prune drafts: usunięto 4'
        );
    });

    it('runHousekeeping: błędy obu kroków nie przerywają pracy', async () => {
        pruneTrainingRuns.mockRejectedValueOnce(new Error('p'));
        sweepExpiredDrafts.mockRejectedValueOnce(new Error('d'));

        await cronService.runHousekeeping();

        expect(logger.error).toHaveBeenCalledWith('CronService', '[housekeeping] failed: Error: p');
        expect(logger.error).toHaveBeenCalledWith(
            'CronService',
            '[housekeeping] drafts failed: Error: d'
        );
    });

    it('runBackupJob loguje rozmiar i weryfikację', async () => {
        await cronService.runBackupJob();
        expect(logger.info).toHaveBeenCalledWith(
            'CronService',
            '[backup] OK: dump.sql (2.0 KB, OK)'
        );
    });

    it('runBackupJob loguje błąd bez rzucania', async () => {
        runBackup.mockRejectedValueOnce(new Error('pg_dump'));
        await expect(cronService.runBackupJob()).resolves.toBeUndefined();
        expect(logger.error).toHaveBeenCalledWith('CronService', '[backup] failed: Error: pg_dump');
    });

    it('runMlSelfEvaluation: rollback i sukces', async () => {
        runDaily.mockResolvedValueOnce({ rolledBack: true });
        await cronService.runMlSelfEvaluation();
        expect(logger.warn).toHaveBeenCalledWith(
            'CronService',
            '[mlSelfEvaluation] rollback wykonany'
        );

        runDaily.mockResolvedValueOnce({ rolledBack: false });
        await cronService.runMlSelfEvaluation();
        expect(logger.info).toHaveBeenCalledWith('CronService', '[mlSelfEvaluation] OK');
    });

    it('runMlSelfEvaluation loguje błąd', async () => {
        runDaily.mockRejectedValueOnce(new Error('eval'));
        await cronService.runMlSelfEvaluation();
        expect(logger.error).toHaveBeenCalledWith(
            'CronService',
            '[mlSelfEvaluation] failed: Error: eval'
        );
    });

    it('runFtsCheck: OK i rozjazd', async () => {
        await cronService.runFtsCheck();
        expect(logger.info).toHaveBeenCalledWith('CronService', '[ftsCheck] OK: rury 1, studnie 2');

        ftsSyncStatus.mockResolvedValueOnce({
            inSync: false,
            tables: { rury: { fts: 1, offers: 2 }, studnie: { fts: 2, offers: 3 } }
        });
        await cronService.runFtsCheck();
        expect(logger.warn).toHaveBeenCalledWith(
            'CronService',
            expect.stringContaining('[ftsCheck] ROZJAZD FTS: rury 1/2, studnie 2/3')
        );
    });

    it('runFtsCheck loguje błąd', async () => {
        ftsSyncStatus.mockRejectedValueOnce(new Error('fts'));
        await cronService.runFtsCheck();
        expect(logger.error).toHaveBeenCalledWith('CronService', '[ftsCheck] failed: Error: fts');
    });

    it('runPricelistHealthCheck: OK i naruszenia', async () => {
        await cronService.runPricelistHealthCheck();
        expect(logger.info).toHaveBeenCalledWith(
            'CronService',
            '[pricelistHealth] OK: 1 aktywna wersja na typ'
        );

        getPricelistHealth.mockResolvedValueOnce({
            ok: false,
            violations: [
                { type: 'rury', code: 'MULTIPLE_ACTIVE' },
                { type: 'studnie', code: 'NO_ACTIVE' }
            ]
        });
        await cronService.runPricelistHealthCheck();
        expect(logger.warn).toHaveBeenCalledWith(
            'CronService',
            '[pricelistHealth] NARUSZENIA: rury/MULTIPLE_ACTIVE, studnie/NO_ACTIVE'
        );
    });

    it('runPricelistHealthCheck loguje błąd', async () => {
        getPricelistHealth.mockRejectedValueOnce(new Error('health'));
        await cronService.runPricelistHealthCheck();
        expect(logger.error).toHaveBeenCalledWith(
            'CronService',
            '[pricelistHealth] failed: Error: health'
        );
    });
});
