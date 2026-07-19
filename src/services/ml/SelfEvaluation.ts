import crypto from 'crypto';
import prisma from '../../prismaClient';
import { logger } from '../../utils/logger';
import { modelRegistry } from './ModelRegistry';
import { trainingPipeline } from './TrainingPipeline';
import { ML_CONFIG } from './trainingConfig';

export class SelfEvaluation {
    private lastRunAt: number = 0;

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
                `ROC-AUC=${activeModel.metrics.rocAuc} < ${ML_CONFIG.rollbackAucThreshold} - rollback`
            );
            const previous = await modelRegistry.rollbackToPrevious();
            if (previous) {
                logger.info(
                    'SelfEvaluation',
                    `Rollback do ${previous.version} (AUC=${previous.metrics.rocAuc})`
                );
                return { rolledBack: true };
            }
        }

        return { rolledBack: false };
    }
}

export const selfEvaluation = new SelfEvaluation();
