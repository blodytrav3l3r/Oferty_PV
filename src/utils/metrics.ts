/**
 * M: metryki in-process (bez Prometheusa na początek).
 * - request duration per endpoint (ring buffer 512, p50/p95/p99 na odczyt)
 * - DB query count + czas (zasilane z prisma $on query)
 * - DB contention counter (z errorHandler)
 * - event-loop lag (sampler 1 s), RSS
 * - metryki PDF doklejane w snapshocie (pdfEngine.getPdfMetrics)
 * Bounded: max 300 kluczy endpointów, ring 512 na klucz.
 */

const RING = 512;
const MAX_KEYS = 300;

interface EndpointStats {
    samples: Array<{ ms: number; serverError: boolean }>;
    count: number;
    errors: number;
    lastMs: number;
}

const endpoints = new Map<string, EndpointStats>();

let dbQueries = 0;
let dbMsTotal = 0;
let busyCount = 0;
// P0.4: licznik utraconych zapisów audytu (audit failure != business failure).
let auditFailures = 0;
// P2.2: odrzucenia rate-limitera per nazwa (observability brute-force).
const rateLimitedByName = new Map<string, number>();
let loopLagMs = 0;
let loopLagMax = 0;
let samplerStarted = false;
// L1: nieudane zapisy draftu raportowane przez klienta (kod przyczyny).
let draftFailures = 0;
const draftFailuresByReason = new Map<string, number>();

export const AI_PREDICTION_OUTCOMES = [
    'success',
    'validation_rejected',
    'model_unavailable',
    'invalid_score',
    'server_error'
] as const;
export const AI_REWARD_OUTCOMES = [
    'applied',
    'duplicate',
    'invalid',
    'not_found',
    'forbidden',
    'item_error',
    'request_error'
] as const;
export const AI_LATENCY_BUCKET_UPPER_BOUNDS_MS = [
    1, 5, 10, 25, 50, 100, 250, 500, 1000, 2500, 5000
] as const;
const MAX_AI_METRIC_DAYS_IN_MEMORY = 31;

export type AiPredictionOutcome = (typeof AI_PREDICTION_OUTCOMES)[number];
export type AiRewardOutcome = (typeof AI_REWARD_OUTCOMES)[number];

type AiOutcomeCounts<T extends string> = Record<T, number>;

const createAiPredictionCounts = (): AiOutcomeCounts<AiPredictionOutcome> => ({
    success: 0,
    validation_rejected: 0,
    model_unavailable: 0,
    invalid_score: 0,
    server_error: 0
});
const createAiRewardCounts = (): AiOutcomeCounts<AiRewardOutcome> => ({
    applied: 0,
    duplicate: 0,
    invalid: 0,
    not_found: 0,
    forbidden: 0,
    item_error: 0,
    request_error: 0
});

let aiInferenceSamples: number[] = [];
let aiInferenceCount = 0;
let aiPredictionOutcomes = createAiPredictionCounts();
let aiRewardOutcomes = createAiRewardCounts();
export interface AiOperationalMetricBucketSnapshot {
    bucketDay: Date;
    inferenceCount: number;
    latencyHistogram: number[];
    predictionOutcomes: number[];
    rewardOutcomes: number[];
}

const aiOperationalMetricBuckets = new Map<string, AiOperationalMetricBucketSnapshot>();

function getUtcDayStart(date = new Date()): Date {
    return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
}

function getCurrentAiOperationalMetricBucket(): AiOperationalMetricBucketSnapshot {
    const bucketDay = getUtcDayStart();
    const key = bucketDay.toISOString();
    const existing = aiOperationalMetricBuckets.get(key);
    if (existing) return existing;

    const created: AiOperationalMetricBucketSnapshot = {
        bucketDay,
        inferenceCount: 0,
        latencyHistogram: Array(AI_LATENCY_BUCKET_UPPER_BOUNDS_MS.length + 1).fill(0),
        predictionOutcomes: Array(AI_PREDICTION_OUTCOMES.length).fill(0),
        rewardOutcomes: Array(AI_REWARD_OUTCOMES.length).fill(0)
    };
    aiOperationalMetricBuckets.set(key, created);
    while (aiOperationalMetricBuckets.size > MAX_AI_METRIC_DAYS_IN_MEMORY) {
        const oldestKey = [...aiOperationalMetricBuckets.keys()].sort()[0];
        if (!oldestKey || oldestKey === key) break;
        aiOperationalMetricBuckets.delete(oldestKey);
    }
    return created;
}

function incrementArrayAt(values: number[], index: number): number[] {
    if (index < 0 || index >= values.length) return values;
    return values.map((value, itemIndex) =>
        itemIndex === index ? Math.min(Number.MAX_SAFE_INTEGER, value + 1) : value
    );
}

function recordAiLatencyBucket(ms: number): void {
    const daily = getCurrentAiOperationalMetricBucket();
    const bucketIndex = AI_LATENCY_BUCKET_UPPER_BOUNDS_MS.findIndex(
        (upperBound) => ms <= upperBound
    );
    const index = bucketIndex < 0 ? AI_LATENCY_BUCKET_UPPER_BOUNDS_MS.length : bucketIndex;
    aiOperationalMetricBuckets.set(daily.bucketDay.toISOString(), {
        ...daily,
        inferenceCount: Math.min(Number.MAX_SAFE_INTEGER, daily.inferenceCount + 1),
        latencyHistogram: incrementArrayAt(daily.latencyHistogram, index)
    });
}

function recordAiOutcomeBucket(kind: 'prediction' | 'reward', outcome: string): void {
    const outcomes = kind === 'prediction' ? AI_PREDICTION_OUTCOMES : AI_REWARD_OUTCOMES;
    const index = outcomes.indexOf(outcome as never);
    if (index < 0) return;
    const daily = getCurrentAiOperationalMetricBucket();
    aiOperationalMetricBuckets.set(daily.bucketDay.toISOString(), {
        ...daily,
        [kind === 'prediction' ? 'predictionOutcomes' : 'rewardOutcomes']: incrementArrayAt(
            kind === 'prediction' ? daily.predictionOutcomes : daily.rewardOutcomes,
            index
        )
    });
}

export function getAiOperationalMetricBuckets(): AiOperationalMetricBucketSnapshot[] {
    return [...aiOperationalMetricBuckets.values()]
        .sort((a, b) => a.bucketDay.getTime() - b.bucketDay.getTime())
        .map((bucket) => ({
            ...bucket,
            bucketDay: new Date(bucket.bucketDay),
            latencyHistogram: [...bucket.latencyHistogram],
            predictionOutcomes: [...bucket.predictionOutcomes],
            rewardOutcomes: [...bucket.rewardOutcomes]
        }));
}

export function acknowledgeAiOperationalMetricBuckets(bucketDays: string[]): void {
    const currentDay = getUtcDayStart().toISOString();
    for (const bucketDay of bucketDays) {
        if (bucketDay !== currentDay) aiOperationalMetricBuckets.delete(bucketDay);
    }
}

function pct(sorted: number[], p: number): number {
    if (sorted.length === 0) return 0;
    const idx = Math.max(0, Math.min(sorted.length - 1, Math.ceil((p / 100) * sorted.length) - 1));
    return sorted[idx];
}

/** Normalizacja ścieżki: UUID/liczby/ID Mongo-ish → :id (kardynalność). */
export function normalizePath(p: string): string {
    return p
        .split('?')[0]
        .replace(/\/[0-9a-fA-F]{8}-[0-9a-fA-F-]{4,}/g, '/:id')
        .replace(/\/\d+([/?]|$)/g, '/:id$1')
        .replace(/\/[^/]{20,}$/, '/:id');
}

const SKIP_PREFIXES = ['/health', '/metrics', '/api/docs', '/favicon'];

export function shouldSkip(path: string): boolean {
    if (
        SKIP_PREFIXES.some(
            (s) => path === s || path.startsWith(s + '/') || path.startsWith(s + '?')
        )
    )
        return true;
    return /\.(js|css|html|svg|png|ico|map|woff2?)($|\?)/.test(path);
}

function startSampler() {
    if (samplerStarted) return;
    samplerStarted = true;
    let last = Date.now();
    const timer = setInterval(() => {
        const now = Date.now();
        const lag = now - last - 1000;
        last = now;
        if (lag > 0) {
            loopLagMs = lag;
            if (lag > loopLagMax) loopLagMax = lag;
        }
    }, 1000);
    // Timer metryk nie trzyma procesu przy życiu.
    timer.unref?.();
}

export function recordRequest(
    method: string,
    path: string,
    status: number,
    ms: number,
    routeTemplate: string | null = path
): void {
    startSampler();
    if (shouldSkip(path)) return;
    const key = `${method} ${routeTemplate ? normalizePath(routeTemplate) : '(nierozpoznana trasa)'}`;
    let st = endpoints.get(key);
    if (!st) {
        if (endpoints.size >= MAX_KEYS) return;
        st = { samples: [], count: 0, errors: 0, lastMs: 0 };
        endpoints.set(key, st);
    }
    st.samples.push({ ms, serverError: status >= 500 });
    if (st.samples.length > RING) st.samples.shift();
    st.count++;
    if (status >= 500) st.errors++;
    st.lastMs = ms;
}

export function recordDbQuery(ms: number): void {
    dbQueries++;
    dbMsTotal += ms;
}

/** Wołane z errorHandler przy błędach DB typu locked/busy. */
export function recordDbBusy(): void {
    busyCount++;
}

/** Wołane z auditService przy nieudanym zapisie logu audytu. */
export function recordAuditFailure(): void {
    auditFailures++;
}

/** Wołane z rateLimiter przy odpowiedzi 429 (nazwa limitera lub 'default'). */
export function recordRateLimited(name: string): void {
    rateLimitedByName.set(name, (rateLimitedByName.get(name) ?? 0) + 1);
}

/** L1: nieudany zapis draftu po stronie klienta (kod przyczyny, bez treści). */
export function recordDraftFailure(reason: string): void {
    draftFailures++;
    draftFailuresByReason.set(reason, (draftFailuresByReason.get(reason) ?? 0) + 1);
}

/**
 * Pure model.predict duration in ms. Only the last RING observations are kept;
 * aggregate endpoints/outcomes use bounded, compile-time category keys.
 */
export function recordAiInference(ms: number): void {
    if (!Number.isFinite(ms) || ms < 0) return;
    aiInferenceSamples = [...aiInferenceSamples, ms].slice(-RING);
    aiInferenceCount = Math.min(Number.MAX_SAFE_INTEGER, aiInferenceCount + 1);
    recordAiLatencyBucket(ms);
}

function incrementAiOutcome<T extends string>(
    counts: AiOutcomeCounts<T>,
    outcome: T
): AiOutcomeCounts<T> {
    if (!Object.prototype.hasOwnProperty.call(counts, outcome)) return counts;
    return { ...counts, [outcome]: Math.min(Number.MAX_SAFE_INTEGER, counts[outcome] + 1) };
}

export function recordAiPredictionOutcome(outcome: AiPredictionOutcome): void {
    aiPredictionOutcomes = incrementAiOutcome(aiPredictionOutcomes, outcome);
    recordAiOutcomeBucket('prediction', outcome);
}

export function recordAiRewardOutcome(outcome: AiRewardOutcome): void {
    aiRewardOutcomes = incrementAiOutcome(aiRewardOutcomes, outcome);
    recordAiOutcomeBucket('reward', outcome);
}

export interface StorageSnapshot {
    dbBytes: number | null;
    walBytes: number | null;
    backups: number;
    lastBackupAt: string | null;
}

export interface MetricsSnapshot {
    uptimeSec: number;
    rssMB: number;
    loopLagMs: number;
    loopLagMaxMs: number;
    db: { queries: number; msTotal: number; avgMs: number; busy: number };
    audit: { failures: number };
    ratelimit: { rejected: number; byName: Record<string, number> };
    storage: StorageSnapshot;
    drafts: { failures: number; byReason: Record<string, number> };
    ai: {
        inference: {
            n: number;
            p50: number;
            p95: number;
            p99: number;
            lastMs: number;
            recent: { n: number };
        };
        predictions: { total: number; byOutcome: AiOutcomeCounts<AiPredictionOutcome> };
        rewards: { total: number; byOutcome: AiOutcomeCounts<AiRewardOutcome> };
    };
    endpoints: Record<
        string,
        {
            n: number;
            p50: number;
            p95: number;
            p99: number;
            errors: number;
            lastMs: number;
            recent: { n: number; errors: number };
        }
    >;
    pdf: Record<string, unknown>;
    fts: Record<string, unknown>;
}

export function getMetricsSnapshot(
    pdf: Record<string, unknown> = {},
    fts: Record<string, unknown> = { queued: 0, done: 0, failed: 0, depth: 0 }
): MetricsSnapshot {
    const eps: MetricsSnapshot['endpoints'] = {};
    for (const [key, st] of endpoints) {
        const sorted = st.samples.map((sample) => sample.ms).sort((a, b) => a - b);
        eps[key] = {
            n: st.count,
            p50: +pct(sorted, 50).toFixed(1),
            p95: +pct(sorted, 95).toFixed(1),
            p99: +pct(sorted, 99).toFixed(1),
            errors: st.errors,
            lastMs: +st.lastMs.toFixed(1),
            recent: {
                n: st.samples.length,
                errors: st.samples.filter((sample) => sample.serverError).length
            }
        };
    }
    const sortedAiInference = [...aiInferenceSamples].sort((a, b) => a - b);
    const predictionOutcomes = { ...aiPredictionOutcomes };
    const rewardOutcomes = { ...aiRewardOutcomes };
    return {
        uptimeSec: Math.round(process.uptime()),
        rssMB: Math.round(process.memoryUsage().rss / 1024 / 1024),
        loopLagMs: loopLagMs,
        loopLagMaxMs: loopLagMax,
        db: {
            queries: dbQueries,
            msTotal: Math.round(dbMsTotal),
            avgMs: dbQueries > 0 ? +(dbMsTotal / dbQueries).toFixed(2) : 0,
            busy: busyCount
        },
        audit: { failures: auditFailures },
        ratelimit: {
            rejected: [...rateLimitedByName.values()].reduce((a, b) => a + b, 0),
            byName: Object.fromEntries(rateLimitedByName)
        },
        storage: getStorageSnapshot(),
        drafts: {
            failures: draftFailures,
            byReason: Object.fromEntries(draftFailuresByReason)
        },
        ai: {
            inference: {
                n: aiInferenceCount,
                p50: +pct(sortedAiInference, 50).toFixed(1),
                p95: +pct(sortedAiInference, 95).toFixed(1),
                p99: +pct(sortedAiInference, 99).toFixed(1),
                lastMs: +(aiInferenceSamples[aiInferenceSamples.length - 1] ?? 0).toFixed(1),
                recent: { n: aiInferenceSamples.length }
            },
            predictions: {
                total: Object.values(predictionOutcomes).reduce((sum, count) => sum + count, 0),
                byOutcome: predictionOutcomes
            },
            rewards: {
                total: Object.values(rewardOutcomes).reduce((sum, count) => sum + count, 0),
                byOutcome: rewardOutcomes
            }
        },
        endpoints: eps,
        pdf,
        fts
    };
}

/**
 * P3: storage do dashboardu operacyjnego — synchroniczny odczyt fs
 * (/metrics jest admin-only i wołany rzadko; brak I/O na gorącej ścieżce).
 * Zwraca lokalne pliki kopii. /metrics uzupełnia rozmiar bazy pomiarem PostgreSQL.
 * Przy błędzie odczytu katalogu zwraca wartości puste.
 */
export function getStorageSnapshot(): StorageSnapshot {
    const empty: StorageSnapshot = {
        dbBytes: null,
        walBytes: null,
        backups: 0,
        lastBackupAt: null
    };
    try {
        // Lazy importy: metrics.ts nie może ciągnąć paths na starcie testów.
        // eslint-disable-next-line @typescript-eslint/no-require-imports
        const fs = require('fs') as typeof import('fs');
        // eslint-disable-next-line @typescript-eslint/no-require-imports
        const path = require('path') as typeof import('path');
        // eslint-disable-next-line @typescript-eslint/no-require-imports
        const { resolveDataDir } = require('./paths') as typeof import('./paths');
        const dataDir: string = resolveDataDir();
        const out: StorageSnapshot = { ...empty };
        const backupDir = path.join(dataDir, 'backups');
        try {
            const files: string[] = fs
                .readdirSync(backupDir)
                .filter((f: string) => f.endsWith('.dump'));
            out.backups = files.length;
            let latest = 0;
            for (const f of files) {
                try {
                    const mt = fs.statSync(path.join(backupDir, f)).mtimeMs;
                    if (mt > latest) latest = mt;
                } catch {
                    // pojedynczy uszkodzony wpis nie psuje całości
                }
            }
            if (latest > 0) out.lastBackupAt = new Date(latest).toISOString();
        } catch {
            // brak katalogu backupów — zostają zera
        }
        return out;
    } catch {
        return empty;
    }
}

/** Reset do testów. */
export function resetMetrics(): void {
    endpoints.clear();
    dbQueries = 0;
    dbMsTotal = 0;
    busyCount = 0;
    auditFailures = 0;
    rateLimitedByName.clear();
    loopLagMs = 0;
    loopLagMax = 0;
    draftFailures = 0;
    draftFailuresByReason.clear();
    aiInferenceSamples = [];
    aiInferenceCount = 0;
    aiPredictionOutcomes = createAiPredictionCounts();
    aiRewardOutcomes = createAiRewardCounts();
    aiOperationalMetricBuckets.clear();
}
