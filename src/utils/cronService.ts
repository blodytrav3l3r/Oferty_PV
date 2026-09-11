/**
 * Cron Service — cykliczne zadania AI Learning Engine.
 *
 * Używamy czystego setInterval zamiast node-cron (zero nowych zależności).
 * Trial jest pasywny - żadne cykliczne zadanie nie wpływa na solver JS.
 */

import { logger } from './logger';
import { learningEngine } from '../services/telemetry/learning';

// ML Training Pipeline — dynamiczny import (unikamy circular deps)
function loadTrainingPipeline() {
    return import('../services/ml/TrainingPipeline').then((m) => m.trainingPipeline);
}

function loadSelfEvaluation() {
    return import('../services/ml/SelfEvaluation').then((m) => m.selfEvaluation);
}

class CronService {
    private intervals: Map<string, NodeJS.Timeout> = new Map();
    private running: Set<string> = new Set();
    private enabled: boolean = false;

    /**
     * Inicjalizacja - uruchamia zadania cykliczne.
     * Wywoływane raz przy starcie aplikacji.
     */
    init(): void {
        if (this.enabled) {
            logger.warn('CronService', 'Już zainicjalizowane');
            return;
        }
        this.enabled = true;

        // Co godzinę — analiza akceptacji użycia
        this.schedule('analyzeUsagePreferences', 60 * 60 * 1000, () => this.runUsageAnalysis());

        // Co 24h — pełny cykl LearningEngine
        this.schedule('fullLearningCycle', 24 * 60 * 60 * 1000, () => this.runFullCycle());

        // Co 4h — ML Training Pipeline (bramka shouldTrain decyduje, czy próba ma sens)
        this.schedule('mlTrainingPipeline', 4 * 60 * 60 * 1000, () => this.runMlTraining());

        // Co 24h — ML SelfEvaluation (A/B + auto-rollback)
        this.schedule('mlSelfEvaluation', 24 * 60 * 60 * 1000, () => this.runMlSelfEvaluation());

        // Co 24h — housekeeping historii treningów (retencja AiTrainingRun)
        this.schedule('dailyHousekeeping', 24 * 60 * 60 * 1000, () => this.runHousekeeping());

        // P1-B: co 24h — kontrola spójności FTS (tylko liczniki + warn, bez auto-rebuildu)
        this.schedule('ftsConsistencyCheck', 24 * 60 * 60 * 1000, () => this.runFtsCheck());

        logger.info('CronService', 'Cron zainicjalizowany (hourly + daily + ml)');
    }

    /**
     * Zaplanuj zadanie cykliczne.
     */
    schedule(name: string, intervalMs: number, task: () => Promise<void> | void): void {
        if (this.intervals.has(name)) {
            logger.warn('CronService', `Task ${name} już zarejestrowany`);
            return;
        }
        const id = setInterval(() => {
            if (this.running.has(name)) {
                logger.warn('CronService', `Pominięto ${name} — poprzedni run w toku`);
                return;
            }
            this.running.add(name);
            Promise.resolve()
                .then(() => task())
                .catch((err: unknown) => {
                    logger.error('CronService', `Błąd w ${name}: ${err}`);
                })
                .finally(() => this.running.delete(name));
        }, intervalMs);
        id.unref(); // nie blokuj procesu (ważne w testach)
        this.intervals.set(name, id);
        logger.info('CronService', `Zarejestrowano ${name} (co ${Math.round(intervalMs / 1000)}s)`);
    }

    /**
     * Zatrzymaj zadanie.
     */
    cancel(name: string): void {
        const id = this.intervals.get(name);
        if (id) {
            clearInterval(id);
            this.intervals.delete(name);
            logger.info('CronService', `Zatrzymano ${name}`);
        }
    }

    /**
     * Łagodne zatrzymanie przy wyłączaniu serwera.
     */
    shutdown(): void {
        this.intervals.forEach(function (id, name) {
            clearInterval(id);
            logger.info('CronService', `Wyczyszczono ${name}`);
        });
        this.intervals.clear();
        this.running.clear();
        this.enabled = false;
    }

    /**
     * P1-B: kontrola spójności FTS vs tabele biznesowe.
     * Tylko odczyt + warn. Rebuild wyłącznie na żądanie (POST /api/admin/fts-rebuild).
     */
    async runFtsCheck(): Promise<void> {
        try {
            const { ftsSyncStatus } = await import('./fts5Sync');
            const st = await ftsSyncStatus();
            if (!st.inSync) {
                logger.warn(
                    'CronService',
                    `[ftsCheck] ROZJAZD FTS: rury ${st.tables.rury.fts}/${st.tables.rury.offers}, ` +
                        `studnie ${st.tables.studnie.fts}/${st.tables.studnie.offers}, ` +
                        `brakujące: ${st.missingIds.length} — rebuild: POST /api/admin/fts-rebuild`
                );
            } else {
                logger.info(
                    'CronService',
                    `[ftsCheck] OK: rury ${st.tables.rury.fts}, studnie ${st.tables.studnie.fts}`
                );
            }
        } catch (e) {
            logger.error('CronService', `[ftsCheck] failed: ${e}`);
        }
    }

    /**
     * Pełny cykl LearningEngine: odczytaj historyczną telemetry, wykryj wzorce,
     * zapisz do KnowledgeBase.
     */
    async runFullCycle(): Promise<void> {
        try {
            logger.info('CronService', '[fullCycle] start');
            const summary = await learningEngine.runFullCycle();
            logger.info(
                'CronService',
                '[fullCycle] processed=' +
                    summary.processed +
                    ', patterns=' +
                    summary.patternsDetected +
                    ', persisted=' +
                    summary.persistedToKb +
                    ', ms=' +
                    summary.durationMs
            );
        } catch (e) {
            logger.error('CronService', `[fullCycle] failed: ${e}`);
        }
    }

    /**
     * Analiza ustawień użytkowania (co godzinę).
     * Lekka sonda — sprawdza liczbę rekordów telemetry bez pełnego pipeline.
     */
    async runUsageAnalysis(): Promise<void> {
        try {
            logger.info('CronService', '[usageAnalysis] start');
            const { default: prisma } = await import('../prismaClient');
            const telemetryCount = await prisma.ai_telemetry_logs.count();
            const patternCount = await prisma.ai_knowledge_base.count();
            logger.info(
                'CronService',
                `[usageAnalysis] telemetry=${telemetryCount}, patterns=${patternCount}`
            );
        } catch (e) {
            logger.error('CronService', `[usageAnalysis] failed: ${e}`);
        }
    }

    async runMlTraining(): Promise<void> {
        try {
            const pipeline = await loadTrainingPipeline();
            // Pre-flight gate: lekka decyzja przed ciężkim pipeline'em.
            // Odrzucenie nie tworzy wiersza AiTrainingRun (D5).
            const gate = await pipeline.shouldTrain();
            if (!gate.ok) {
                logger.info('CronService', `[mlTraining] pomijam: ${gate.reason}`);
                return;
            }
            const result = await pipeline.run();
            if (result.trained) {
                logger.info(
                    'CronService',
                    `[mlTraining] nowy model ${result.version} AUC=${result.metrics?.rocAuc}`
                );
            } else {
                logger.info('CronService', `[mlTraining] pomijam: ${result.reason}`);
            }
        } catch (e) {
            logger.error('CronService', `[mlTraining] failed: ${e}`);
        }
    }

    /**
     * Housekeeping (F2): retencja historii treningów. Niezależny od semantyki
     * treningu — awaria pruna nie dotyka ścieżki treningowej.
     */
    async runHousekeeping(): Promise<void> {
        try {
            const { pruneTrainingRuns } = await import('../services/ml/TrainingPipeline');
            const res = await pruneTrainingRuns();
            logger.info(
                'CronService',
                `[housekeeping] prune AiTrainingRun: usunięto ${res.deleted}`
            );
        } catch (e) {
            logger.error('CronService', `[housekeeping] failed: ${e}`);
        }
    }

    async runMlSelfEvaluation(): Promise<void> {
        try {
            const evaluation = await loadSelfEvaluation();
            const result = await evaluation.runDaily();
            if (result.rolledBack) {
                logger.warn('CronService', '[mlSelfEvaluation] rollback wykonany');
            } else {
                logger.info('CronService', '[mlSelfEvaluation] OK');
            }
        } catch (e) {
            logger.error('CronService', `[mlSelfEvaluation] failed: ${e}`);
        }
    }

    getStatus(): {
        enabled: boolean;
        runningTasks: string[];
    } {
        return {
            enabled: this.enabled,
            runningTasks: Array.from(this.intervals.keys())
        };
    }
}

export const cronService = new CronService();
