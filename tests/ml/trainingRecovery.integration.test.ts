import { afterEach, describe, expect, it } from '@jest/globals';
import crypto from 'node:crypto';
import prisma from '../../src/prismaClient';
import { TrainingPipeline } from '../../src/services/ml/TrainingPipeline';

describe('TrainingPipeline recovery PostgreSQL', () => {
    let runId: string | null = null;

    afterEach(async () => {
        if (!runId) return;
        await prisma.aiTrainingRun.deleteMany({ where: { id: runId } });
        runId = null;
    });

    it('atomowo terminalizuje porzucony RUNNING i kolejny recovery jest idempotentny', async () => {
        const id = crypto.randomUUID();
        runId = id;
        await prisma.aiTrainingRun.create({
            data: {
                id,
                startedAt: new Date().toISOString(),
                status: 'RUNNING',
                datasetSize: 0,
                trainSize: 0,
                validationSize: 0,
                testSize: 0,
                featureVersion: 'test-feature-version',
                seed: 42,
                deployed: false
            }
        });

        const pipeline = new TrainingPipeline();

        await expect(pipeline.recoverInterruptedRuns()).resolves.toBe(1);
        await expect(pipeline.recoverInterruptedRuns()).resolves.toBe(0);

        await expect(prisma.aiTrainingRun.findUnique({ where: { id } })).resolves.toMatchObject({
            status: 'FAILED_INTERRUPTED',
            finishedAt: expect.any(String),
            error: 'interrupted_by_process_restart',
            deployed: false
        });
    });
});
