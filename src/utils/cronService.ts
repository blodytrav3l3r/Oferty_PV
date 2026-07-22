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

        // Co 15 minut — ML Training Pipeline
        this.schedule('mlTrainingPipeline', 15 * 60 * 1000, () => this.runMlTraining());

        // Co 24h — ML SelfEvaluation (A/B + auto-rollback)
        this.schedule('mlSelfEvaluation', 24 * 60 * 60 * 1000, () => this.runMlSelfEvaluation());

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
        const id = setInterval(function () {
            Promise.resolve()
                .then(function () {
                    return task();
                })
                .catch(function (err: unknown) {
                    logger.error('CronService', `Błąd w ${name}: ${err}`);
                });
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
        this.enabled = false;
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
