import crypto from 'crypto';
import prisma from '../../prismaClient';
import { logger } from '../../utils/logger';
import { modelRegistry } from './ModelRegistry';
import { trainingPipeline, computeRocAuc } from './TrainingPipeline';
import { ML_CONFIG } from './trainingConfig';

export class SelfEvaluation {
    private lastRunAt: number = 0;
    private slidingWindow: Array<{ label: number; score: number }> = [];
    private readonly SLIDING_WINDOW_SIZE = 200;

    recordPredictionResult(actualLabel: number, predictedScore: number): void {
        this.slidingWindow.push({ label: actualLabel, score: predictedScore });
        if (this.slidingWindow.length > this.SLIDING_WINDOW_SIZE) {
            this.slidingWindow.shift();
        }
    }

    async checkAndRollbackIfNeeded(): Promise<{ rolledBack: boolean; slidingAuc: number | null }> {
        const window = this.slidingWindow;
        if (window.length < 10) {
            return { rolledBack: false, slidingAuc: null };
        }

        const scores = window.map((w) => w.score);
        const labels = window.map((w) => w.label);
        const slidingAuc = computeRocAuc(scores, labels);

        if (slidingAuc < ML_CONFIG.rollbackAucThreshold) {
            logger.warn(
                'SelfEvaluation',
                `Sliding AUC=${slidingAuc.toFixed(4)} < ${ML_CONFIG.rollbackAucThreshold} — auto-rollback`
            );
            const previous = await modelRegistry.rollbackToPrevious();
            if (previous) {
                logger.info('SelfEvaluation', `Auto-rollback do ${previous.version}`);
                this.slidingWindow = [];
                return { rolledBack: true, slidingAuc };
            }
        }
        return { rolledBack: false, slidingAuc };
    }

    async runDaily(): Promise<{ rolledBack: boolean; evaluationId?: string }> {
        logger.info('SelfEvaluation', 'Rozpoczynam codzienna samoocene...');

        const activeModel = await modelRegistry.getActiveModel();
        if (!activeModel) {
            logger.info('SelfEvaluation', 'Brak aktywnego modelu - pomijam');
            return { rolledBack: false };
        }

        const hoursSinceLast = (Date.now() - this.lastRunAt) / (1000 * 60 * 60);
        if (!this.lastRunAt || hoursSinceLast >= ML_CONFIG.minHoursSinceLastTrain) {
            this.lastRunAt = Date.now();
            const result = await trainingPipeline.run();
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
            logger.info(
                'SelfEvaluation',
                `Od ostatniego treningu ${hoursSinceLast.toFixed(1)}h < ${ML_CONFIG.minHoursSinceLastTrain}h — pomijam`
            );
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
                    `Promowano ${best.version} (AUC=${best.metrics.rocAuc})`
                );
                return { rolledBack: true };
            }
        }

        return { rolledBack: false };
    }
}

export const selfEvaluation = new SelfEvaluation();
