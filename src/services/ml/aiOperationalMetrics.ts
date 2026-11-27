import { randomUUID } from 'node:crypto';
import prisma from '../../prismaClient';
import { logger } from '../../utils/logger';
import {
    AI_LATENCY_BUCKET_UPPER_BOUNDS_MS,
    AI_PREDICTION_OUTCOMES,
    AI_REWARD_OUTCOMES,
    acknowledgeAiOperationalMetricBuckets,
    getAiOperationalMetricBuckets,
    type AiPredictionOutcome,
    type AiRewardOutcome
} from '../../utils/metrics';

const RETENTION_DAYS = 30;
const FLUSH_INTERVAL_MS = 60_000;
const MAX_HISTORY_ROWS = 10_000;
const WARNING_COOLDOWN_MS = 5 * 60_000;
const HISTOGRAM_SIZE = AI_LATENCY_BUCKET_UPPER_BOUNDS_MS.length + 1;

export interface AiOperationalMetricsHistory {
    status: 'ready' | 'unavailable';
    windowDays: number;
    truncated: boolean;
    updatedAt: string | null;
    inference: {
        n: number;
        p50Ms: number | null;
        p95Ms: number | null;
        p99Ms: number | null;
        p50Overflow: boolean;
        p95Overflow: boolean;
        p99Overflow: boolean;
        overflowSamples: number;
    };
    predictions: { total: number; byOutcome: Record<AiPredictionOutcome, number> };
    rewards: { total: number; byOutcome: Record<AiRewardOutcome, number> };
}

const emptyHistory = (
    status: AiOperationalMetricsHistory['status']
): AiOperationalMetricsHistory => ({
    status,
    windowDays: RETENTION_DAYS,
    truncated: false,
    updatedAt: null,
    inference: {
        n: 0,
        p50Ms: null,
        p95Ms: null,
        p99Ms: null,
        p50Overflow: false,
        p95Overflow: false,
        p99Overflow: false,
        overflowSamples: 0
    },
    predictions: {
        total: 0,
        byOutcome: Object.fromEntries(AI_PREDICTION_OUTCOMES.map((key) => [key, 0])) as Record<
            AiPredictionOutcome,
            number
        >
    },
    rewards: {
        total: 0,
        byOutcome: Object.fromEntries(AI_REWARD_OUTCOMES.map((key) => [key, 0])) as Record<
            AiRewardOutcome,
            number
        >
    }
});

const processId = randomUUID();
let timer: NodeJS.Timeout | null = null;
let inFlightFlush: Promise<boolean> | null = null;
let lastPrunedDay: string | null = null;
let lastWarningAt = 0;

function logPersistenceWarning(): void {
    const now = Date.now();
    if (now - lastWarningAt < WARNING_COOLDOWN_MS) return;
    lastWarningAt = now;
    logger.warn(
        'AiOperationalMetrics',
        'Nie udało się odświeżyć trwałej historii metryk AI; pomiary predykcji pozostają aktywne.'
    );
}

function getUtcDayKey(date: Date): string {
    return new Date(
        Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate())
    ).toISOString();
}

function getRetentionCutoff(now = new Date()): Date {
    return new Date(now.getTime() - RETENTION_DAYS * 24 * 60 * 60 * 1000);
}

function makeQuantile(
    histogram: number[],
    sampleCount: number,
    percentile: number
): {
    value: number | null;
    overflow: boolean;
} {
    if (sampleCount <= 0) return { value: null, overflow: false };
    const target = Math.ceil((percentile / 100) * sampleCount);
    let cumulative = 0;
    for (let index = 0; index < histogram.length; index++) {
        cumulative += histogram[index];
        if (cumulative >= target) {
            const overflow = index === AI_LATENCY_BUCKET_UPPER_BOUNDS_MS.length;
            return {
                value: overflow ? null : AI_LATENCY_BUCKET_UPPER_BOUNDS_MS[index],
                overflow
            };
        }
    }
    throw new Error('AI metric latency histogram does not match its sample count');
}

function addCounters(target: number[], source: number[], expectedLength: number): number[] {
    if (source.length !== expectedLength || target.length !== expectedLength) {
        throw new Error('AI metric counter bucket has an unexpected shape');
    }
    return target.map((value, index) => value + source[index]);
}

function readOutcomes<T extends string>(keys: readonly T[], values: number[]): Record<T, number> {
    if (values.length !== keys.length)
        throw new Error('AI metric outcome bucket has an unexpected shape');
    return Object.fromEntries(keys.map((key, index) => [key, values[index]])) as Record<T, number>;
}

function sumCounters(values: Record<string, number>): number {
    return Object.values(values).reduce((total, value) => total + value, 0);
}

async function pruneExpiredBuckets(now: Date): Promise<void> {
    const today = getUtcDayKey(now);
    if (lastPrunedDay === today) return;
    await prisma.aiOperationalMetricBucket.deleteMany({
        where: { bucketDay: { lt: getRetentionCutoff(now) } }
    });
    lastPrunedDay = today;
}

async function persistBuckets(): Promise<boolean> {
    const snapshots = getAiOperationalMetricBuckets();
    try {
        for (const snapshot of snapshots) {
            await prisma.aiOperationalMetricBucket.upsert({
                where: {
                    processId_bucketDay: { processId, bucketDay: snapshot.bucketDay }
                },
                create: {
                    processId,
                    bucketDay: snapshot.bucketDay,
                    inferenceCount: snapshot.inferenceCount,
                    latencyHistogram: snapshot.latencyHistogram,
                    predictionOutcomes: snapshot.predictionOutcomes,
                    rewardOutcomes: snapshot.rewardOutcomes
                },
                update: {
                    inferenceCount: snapshot.inferenceCount,
                    latencyHistogram: snapshot.latencyHistogram,
                    predictionOutcomes: snapshot.predictionOutcomes,
                    rewardOutcomes: snapshot.rewardOutcomes
                }
            });
        }
        await pruneExpiredBuckets(new Date());
        acknowledgeAiOperationalMetricBuckets(
            snapshots.map((snapshot) => snapshot.bucketDay.toISOString())
        );
        return true;
    } catch {
        logPersistenceWarning();
        return false;
    }
}

/** Background, idempotent daily rollups; never called from prediction or feedback handlers. */
export function flushAiOperationalMetrics(): Promise<boolean> {
    if (inFlightFlush) return inFlightFlush;
    inFlightFlush = persistBuckets().finally(() => {
        inFlightFlush = null;
    });
    return inFlightFlush;
}

export function startAiOperationalMetricsPersistence(): void {
    if (timer) return;
    timer = setInterval(() => {
        void flushAiOperationalMetrics();
    }, FLUSH_INTERVAL_MS);
    timer.unref?.();
    void flushAiOperationalMetrics();
}

export async function stopAiOperationalMetricsPersistence(): Promise<void> {
    if (timer) clearInterval(timer);
    timer = null;
    await flushAiOperationalMetrics();
}

/** Admin-only endpoint adapter; missing/invalid storage degrades to unavailable, never a fake zero. */
export async function getAiOperationalMetricsHistory(): Promise<AiOperationalMetricsHistory> {
    try {
        const now = new Date();
        const rows = await prisma.aiOperationalMetricBucket.findMany({
            where: { bucketDay: { gte: getRetentionCutoff(now) } },
            orderBy: { bucketDay: 'desc' },
            take: MAX_HISTORY_ROWS,
            select: {
                bucketDay: true,
                inferenceCount: true,
                latencyHistogram: true,
                predictionOutcomes: true,
                rewardOutcomes: true,
                updatedAt: true
            }
        });
        const history = emptyHistory('ready');
        const latencyHistogram = Array(HISTOGRAM_SIZE).fill(0) as number[];
        let latestUpdate = 0;
        for (const row of rows) {
            history.inference.n += row.inferenceCount;
            const combinedLatency = addCounters(
                latencyHistogram,
                row.latencyHistogram,
                HISTOGRAM_SIZE
            );
            combinedLatency.forEach((value, index) => {
                latencyHistogram[index] = value;
            });
            const predictions = addCounters(
                Object.values(history.predictions.byOutcome),
                row.predictionOutcomes,
                AI_PREDICTION_OUTCOMES.length
            );
            history.predictions.byOutcome = readOutcomes(AI_PREDICTION_OUTCOMES, predictions);
            const rewards = addCounters(
                Object.values(history.rewards.byOutcome),
                row.rewardOutcomes,
                AI_REWARD_OUTCOMES.length
            );
            history.rewards.byOutcome = readOutcomes(AI_REWARD_OUTCOMES, rewards);
            latestUpdate = Math.max(latestUpdate, row.updatedAt.getTime());
        }

        history.truncated = rows.length === MAX_HISTORY_ROWS;
        history.updatedAt = latestUpdate > 0 ? new Date(latestUpdate).toISOString() : null;
        history.predictions.total = sumCounters(history.predictions.byOutcome);
        history.rewards.total = sumCounters(history.rewards.byOutcome);
        if (history.inference.n !== latencyHistogram.reduce((total, count) => total + count, 0)) {
            throw new Error('AI metric latency sample count is inconsistent');
        }
        const p50 = makeQuantile(latencyHistogram, history.inference.n, 50);
        const p95 = makeQuantile(latencyHistogram, history.inference.n, 95);
        const p99 = makeQuantile(latencyHistogram, history.inference.n, 99);
        history.inference.p50Ms = p50.value;
        history.inference.p50Overflow = p50.overflow;
        history.inference.p95Ms = p95.value;
        history.inference.p95Overflow = p95.overflow;
        history.inference.p99Ms = p99.value;
        history.inference.p99Overflow = p99.overflow;
        history.inference.overflowSamples = latencyHistogram[HISTOGRAM_SIZE - 1];
        return history;
    } catch {
        logPersistenceWarning();
        return emptyHistory('unavailable');
    }
}
