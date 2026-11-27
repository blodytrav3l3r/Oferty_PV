import crypto from 'crypto';
import prisma from '../../prismaClient';
import { logger } from '../../utils/logger';
import { modelRegistry } from './ModelRegistry';
import { trainingPipeline, computeRocAuc } from './TrainingPipeline';
import { ML_CONFIG } from './trainingConfig';
import { ML_CONSTANTS } from '../../config/mlConstants';

export class SelfEvaluation {
    private slidingWindow: Array<{ label: number; score: number; modelVersion: string }> = [];
    private readonly SLIDING_WINDOW_SIZE = 200;
    private featureVersion: string = ML_CONSTANTS.FEATURE_VERSION;
    private windowModelVersion: string | null = null;
    // Mutex + agregacja diagnostyki: równoległe wywołania z predict/batch
    // współdzielą jedno odczytanie modelu i jedną ewaluację okna.
    private evaluationPromise: Promise<{ slidingAuc: number | null }> | null = null;
    private lastLowAucWarning: { modelVersion: string; loggedAt: number } | null = null;
    private readonly LOW_AUC_WARNING_INTERVAL_MS = 5 * 60 * 1000;

    recordPredictionResult(
        actualLabel: number,
        predictedScore: number,
        modelVersion = 'unknown'
    ): void {
        // Zmiana wersji cech (FEATURE_VERSION) unieważnia historyczne predykcje —
        // okno czyścimy, by sliding AUC nie mieszał wektorów z różnych wersji cech.
        if (ML_CONSTANTS.FEATURE_VERSION !== this.featureVersion) {
            this.slidingWindow = [];
            this.windowModelVersion = null;
            this.featureVersion = ML_CONSTANTS.FEATURE_VERSION;
        }
        if (this.windowModelVersion !== modelVersion) {
            this.slidingWindow = [];
            this.windowModelVersion = modelVersion;
        }
        this.slidingWindow = [
            ...this.slidingWindow,
            { label: actualLabel, score: predictedScore, modelVersion }
        ];
        if (this.slidingWindow.length > this.SLIDING_WINDOW_SIZE) {
            this.slidingWindow = this.slidingWindow.slice(-this.SLIDING_WINDOW_SIZE);
        }
    }

    async evaluateOnlineAuc(): Promise<{ slidingAuc: number | null }> {
        if (this.evaluationPromise) return this.evaluationPromise;
        this.evaluationPromise = this._evaluateOnlineAuc().finally(() => {
            this.evaluationPromise = null;
        });
        return this.evaluationPromise;
    }

    private async _evaluateOnlineAuc(): Promise<{ slidingAuc: number | null }> {
        const window = this.slidingWindow;
        if (window.length < 10) {
            return { slidingAuc: null };
        }

        const activeModel = await modelRegistry.getActiveModel();
        if (!activeModel || this.windowModelVersion !== activeModel.version) {
            this.slidingWindow = [];
            this.windowModelVersion = activeModel?.version ?? null;
            return { slidingAuc: null };
        }

        const scores = window.map((w) => w.score);
        const labels = window.map((w) => w.label);

        // Okno z tylko jedną klasą (np. same ACCEPT) nie ma sensu dla AUC —
        // computeRocAuc zwracałoby wtedy degeneracyjne 0.5 bez sygnału jakości.
        if (labels.every((l) => l === 1) || labels.every((l) => l === 0)) {
            return { slidingAuc: null };
        }

        const slidingAuc = computeRocAuc(scores, labels);

        if (slidingAuc < ML_CONFIG.rollbackAucThreshold) {
            const now = Date.now();
            const warningIsDue =
                !this.lastLowAucWarning ||
                this.lastLowAucWarning.modelVersion !== activeModel.version ||
                now - this.lastLowAucWarning.loggedAt >= this.LOW_AUC_WARNING_INTERVAL_MS;
            if (warningIsDue) {
                logger.warn(
                    'SelfEvaluation',
                    `Sliding AUC=${slidingAuc.toFixed(4)} < ${ML_CONFIG.rollbackAucThreshold} — rollback online wyłączony do czasu weryfikacji pochodzenia danych`
                );
                this.lastLowAucWarning = { modelVersion: activeModel.version, loggedAt: now };
            }
        } else {
            this.lastLowAucWarning = null;
        }
        return { slidingAuc };
    }

    async runDaily(): Promise<{ rolledBack: boolean; evaluationId?: string }> {
        logger.info('SelfEvaluation', 'Rozpoczynam codzienna samoocene...');

        const activeModel = await modelRegistry.getActiveModel();
        if (!activeModel) {
            logger.info('SelfEvaluation', 'Brak aktywnego modelu - pomijam');
            return { rolledBack: false };
        }

        // Bramka SSoT z TrainingPipeline (trwałe lastSuccessAt z DB zamiast
        // in-memory lastRunAt — przetrwa restart; decyzja spójna z cronem).
        const gate = await trainingPipeline.shouldTrain();
        if (!gate.ok && gate.reason === 'already_running') {
            logger.info('SelfEvaluation', 'Trening już trwa — pomijam samoocenę');
            return { rolledBack: false };
        }
        if (gate.ok) {
            const result = await trainingPipeline.run();
            if (result.reason === 'already_running') return { rolledBack: false };
            if (result.trained && result.metrics) {
                await prisma.aiEvaluation.create({
                    data: {
                        id: crypto.randomUUID(),
                        modelVersion: result.version || 'unknown',
                        acceptance: result.metrics.accuracy,
                        decisionMsAvg: 0,
                        rewardsAvg: 0,
                        totalDecisions: result.metrics.trainSize + result.metrics.valSize,
                        triggeredAt: new Date().toISOString()
                    }
                });
                logger.info('SelfEvaluation', `Nowy model AUC=${result.metrics.rocAuc} - OK`);
                return { rolledBack: false };
            }
        } else {
            logger.info('SelfEvaluation', `Bramka treningu: ${gate.reason} — pomijam`);
        }

        if (activeModel.metrics.rocAuc < ML_CONFIG.rollbackAucThreshold) {
            logger.warn(
                'SelfEvaluation',
                `ROC-AUC=${activeModel.metrics.rocAuc} < ${ML_CONFIG.rollbackAucThreshold} - promocja najlepszego modelu`
            );
            const best = await modelRegistry.promoteBestModel();
            if (best && best.id !== activeModel.id) {
                logger.info(
                    'SelfEvaluation',
                    `Promowano najlepszy model (AUC=${best.metrics.rocAuc})`
                );
                return { rolledBack: true };
            }
        }

        return { rolledBack: false };
    }
}

export const selfEvaluation = new SelfEvaluation();
