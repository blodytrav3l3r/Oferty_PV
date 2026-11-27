import prisma from '../../src/prismaClient';
import { logger } from '../../src/utils/logger';
import {
    flushAiOperationalMetrics,
    getAiOperationalMetricsHistory
} from '../../src/services/ml/aiOperationalMetrics';
import {
    getMetricsSnapshot,
    recordAiInference,
    recordAiPredictionOutcome,
    recordAiRewardOutcome,
    resetMetrics
} from '../../src/utils/metrics';

describe('AI operational metrics persistence', () => {
    beforeEach(async () => {
        resetMetrics();
        await prisma.aiOperationalMetricBucket.deleteMany();
    });

    afterAll(async () => {
        await prisma.aiOperationalMetricBucket.deleteMany();
    });

    it('excludes expired rows and prunes them according to the 30-day policy', async () => {
        const expiredDay = new Date();
        expiredDay.setUTCDate(expiredDay.getUTCDate() - 31);
        expiredDay.setUTCHours(0, 0, 0, 0);
        await prisma.aiOperationalMetricBucket.create({
            data: {
                processId: 'expired-process',
                bucketDay: expiredDay,
                inferenceCount: 99,
                latencyHistogram: Array(12).fill(0),
                predictionOutcomes: Array(5).fill(0),
                rewardOutcomes: Array(7).fill(0)
            }
        });

        expect((await getAiOperationalMetricsHistory()).inference.n).toBe(0);
        recordAiInference(15);
        await flushAiOperationalMetrics();

        expect(
            await prisma.aiOperationalMetricBucket.count({
                where: { processId: 'expired-process' }
            })
        ).toBe(0);
    });

    it('keeps aggregate history from multiple process IDs in PostgreSQL', async () => {
        const bucketDay = new Date();
        bucketDay.setUTCHours(0, 0, 0, 0);
        await prisma.aiOperationalMetricBucket.create({
            data: {
                processId: 'process-before-restart',
                bucketDay,
                inferenceCount: 2,
                latencyHistogram: [0, 1, 1, ...Array(9).fill(0)],
                predictionOutcomes: [2, 0, 0, 0, 0],
                rewardOutcomes: [1, 0, 0, 0, 0, 0, 0]
            }
        });

        recordAiInference(7);
        recordAiInference(24);
        recordAiPredictionOutcome('validation_rejected');
        recordAiRewardOutcome('forbidden');
        await flushAiOperationalMetrics();

        const history = await getAiOperationalMetricsHistory();
        expect(history.status).toBe('ready');
        expect(history.inference.n).toBe(4);
        expect(history.inference.p50Ms).toBe(10);
        expect(history.predictions.byOutcome).toMatchObject({
            success: 2,
            validation_rejected: 1
        });
        expect(history.rewards.byOutcome).toMatchObject({ applied: 1, forbidden: 1 });
        expect(await prisma.aiOperationalMetricBucket.count()).toBe(2);
    });

    it('uses idempotent snapshots and recording stays available if persistence fails', async () => {
        recordAiInference(42);
        recordAiPredictionOutcome('success');
        expect(getMetricsSnapshot().ai.predictions.byOutcome.success).toBe(1);
        await flushAiOperationalMetrics();
        await flushAiOperationalMetrics();

        const rows = await prisma.aiOperationalMetricBucket.findMany();
        expect(rows).toHaveLength(1);
        expect(rows[0].inferenceCount).toBe(1);
        expect(rows[0].predictionOutcomes[0]).toBe(1);

        const warn = jest.spyOn(logger, 'warn').mockImplementation(() => undefined);
        const upsert = jest.spyOn(prisma.aiOperationalMetricBucket, 'upsert');
        upsert.mockRejectedValueOnce(new Error('test database unavailable'));
        expect(await flushAiOperationalMetrics()).toBe(false);
        recordAiPredictionOutcome('success');
        expect(getMetricsSnapshot().ai.predictions.byOutcome.success).toBe(2);
        upsert.mockRestore();
        warn.mockRestore();
    });

    it('rejects a persisted histogram with a noncanonical shape', async () => {
        const bucketDay = new Date();
        bucketDay.setUTCHours(0, 0, 0, 0);
        const warn = jest.spyOn(logger, 'warn').mockImplementation(() => undefined);
        await prisma.aiOperationalMetricBucket.create({
            data: {
                processId: 'malformed-process',
                bucketDay,
                inferenceCount: 1,
                latencyHistogram: Array(11).fill(0),
                predictionOutcomes: Array(5).fill(0),
                rewardOutcomes: Array(7).fill(0)
            }
        });
        expect((await getAiOperationalMetricsHistory()).status).toBe('unavailable');
        warn.mockRestore();
    });
});
