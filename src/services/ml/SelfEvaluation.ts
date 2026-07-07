import { logger } from '../../utils/logger';
import { modelRegistry } from './ModelRegistry';
import { trainingPipeline } from './TrainingPipeline';

export class SelfEvaluation {
    async runDaily(): Promise<{ rolledBack: boolean; evaluationId?: string }> {
        logger.info('SelfEvaluation', 'Rozpoczynam codzienna samoocene...');

        const activeModel = await modelRegistry.getActiveModel();
        if (!activeModel) {
            logger.info('SelfEvaluation', 'Brak aktywnego modelu - pomijam');
            return { rolledBack: false };
        }

        const result = await trainingPipeline.run();
        if (result.trained && result.metrics) {
            logger.info('SelfEvaluation', `Nowy model AUC=${result.metrics.rocAuc} - OK`);
            return { rolledBack: false };
        }

        if (activeModel.metrics.rocAuc < 0.65) {
            logger.warn(
                'SelfEvaluation',
                `ROC-AUC=${activeModel.metrics.rocAuc} < 0.65 - rollback`
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
