/**
 * M: metryki — normalizacja, ring buffer, p50/p95, busy, snapshot.
 */
import {
    normalizePath,
    shouldSkip,
    recordRequest,
    recordDbQuery,
    recordDbBusy,
    recordAuditFailure,
    recordDraftFailure,
    recordAiInference,
    recordAiPredictionOutcome,
    recordAiRewardOutcome,
    getMetricsSnapshot,
    getStorageSnapshot,
    resetMetrics
} from '../src/utils/metrics';

beforeEach(() => {
    resetMetrics();
});

describe('M metrics', () => {
    test('normalizePath zwija UUID i liczby w :id', () => {
        expect(normalizePath('/api/offers/123')).toBe('/api/offers/:id');
        expect(normalizePath('/api/x/550e8400-e29b-41d4-a716-446655440000')).toBe('/api/x/:id');
        expect(normalizePath('/api/offers/search?q=a')).toBe('/api/offers/search');
        expect(normalizePath('/health/ready')).toBe('/health/ready');
    });

    test('shouldSkip omija health/metryki/docs i statyki', () => {
        expect(shouldSkip('/health/ready')).toBe(true);
        expect(shouldSkip('/metrics')).toBe(true);
        expect(shouldSkip('/api/docs/x')).toBe(true);
        expect(shouldSkip('/js/app.js')).toBe(true);
        expect(shouldSkip('/api/offers/search')).toBe(false);
    });

    test('recordRequest liczy p50/p95/p99 i błędy 5xx', () => {
        for (let i = 1; i <= 100; i++) recordRequest('GET', '/api/a', 200, i);
        recordRequest('GET', '/api/a', 500, 5);
        const snap = getMetricsSnapshot();
        expect(snap.endpoints['GET /api/a'].n).toBe(101);
        expect(snap.endpoints['GET /api/a'].p50).toBe(50);
        expect(snap.endpoints['GET /api/a'].p95).toBe(95);
        expect(snap.endpoints['GET /api/a'].p99).toBe(99);
        expect(snap.endpoints['GET /api/a'].errors).toBe(1);
    });

    test('recordDbQuery sumuje czas; recordDbBusy liczy locki', () => {
        recordDbQuery(10);
        recordDbQuery(20);
        recordDbBusy();
        const snap = getMetricsSnapshot({ activeJobs: 1 });
        expect(snap.db.queries).toBe(2);
        expect(snap.db.msTotal).toBe(30);
        expect(snap.db.avgMs).toBe(15);
        expect(snap.db.busy).toBe(1);
        expect(snap.pdf).toEqual({ activeJobs: 1 });
        expect(snap.rssMB).toBeGreaterThan(0);
    });

    test('błędy ostatnich 512 próbek wygasają niezależnie od licznika procesu', () => {
        recordRequest('GET', '/api/a', 500, 1);
        for (let i = 0; i < 511; i++) recordRequest('GET', '/api/a', 200, 1);
        expect(getMetricsSnapshot().endpoints['GET /api/a']).toMatchObject({
            n: 512,
            errors: 1,
            recent: { n: 512, errors: 1 }
        });
        recordRequest('GET', '/api/a', 200, 1);
        expect(getMetricsSnapshot().endpoints['GET /api/a']).toMatchObject({
            n: 513,
            errors: 1,
            recent: { n: 512, errors: 0 }
        });
        resetMetrics();
        expect(getMetricsSnapshot().endpoints).toEqual({});
    });

    test('MAX_KEYS ogranicza kardynalność', () => {
        for (let i = 0; i < 400; i++) recordRequest('GET', `/api/ep${i}`, 200, 1);
        const snap = getMetricsSnapshot();
        expect(Object.keys(snap.endpoints).length).toBeLessThanOrEqual(300);
    });

    test('P0.4+P3: audit.failures i storage w snapshocie (nigdy throw)', () => {
        recordAuditFailure();
        recordAuditFailure();
        const snap = getMetricsSnapshot();
        expect(snap.audit.failures).toBe(2);
        expect(snap.storage).toHaveProperty('dbBytes');
        expect(snap.storage).toHaveProperty('backups');
        expect(snap.storage).toHaveProperty('lastBackupAt');
        const direct = getStorageSnapshot();
        expect(typeof direct.backups).toBe('number');
    });

    test('L1: drafts.failures liczy przyczyny osobno, reset zeruje', () => {
        recordDraftFailure('quota');
        recordDraftFailure('quota');
        recordDraftFailure('storage');
        const snap = getMetricsSnapshot();
        expect(snap.drafts.failures).toBe(3);
        expect(snap.drafts.byReason).toEqual({ quota: 2, storage: 1 });
        resetMetrics();
        expect(getMetricsSnapshot().drafts).toEqual({ failures: 0, byReason: {} });
    });

    test('AI: ograniczone percentyle czystej inferencji i stałe outcome’y resetują się', () => {
        for (let ms = 1; ms <= 100; ms++) recordAiInference(ms);
        recordAiPredictionOutcome('success');
        recordAiPredictionOutcome('validation_rejected');
        recordAiRewardOutcome('applied');
        recordAiRewardOutcome('forbidden');

        const snapshot = getMetricsSnapshot().ai;
        expect(snapshot.inference).toMatchObject({
            n: 100,
            p50: 50,
            p95: 95,
            p99: 99,
            lastMs: 100,
            recent: { n: 100 }
        });
        expect(snapshot.predictions).toEqual({
            total: 2,
            byOutcome: {
                success: 1,
                validation_rejected: 1,
                model_unavailable: 0,
                invalid_score: 0,
                server_error: 0
            }
        });
        expect(snapshot.rewards).toEqual({
            total: 2,
            byOutcome: {
                applied: 1,
                duplicate: 0,
                invalid: 0,
                not_found: 0,
                forbidden: 1,
                item_error: 0,
                request_error: 0
            }
        });

        resetMetrics();
        expect(getMetricsSnapshot().ai.predictions.total).toBe(0);
        expect(getMetricsSnapshot().ai.rewards.total).toBe(0);
        expect(getMetricsSnapshot().ai.inference.recent.n).toBe(0);
    });

    test('AI: bufor inferencji ma stały limit i nie przyjmuje wartości niefinitywnych', () => {
        for (let ms = 1; ms <= 513; ms++) recordAiInference(ms);
        recordAiInference(Number.POSITIVE_INFINITY);

        expect(getMetricsSnapshot().ai.inference).toMatchObject({
            n: 513,
            p50: 257,
            p95: 488,
            p99: 508,
            lastMs: 513,
            recent: { n: 512 }
        });

        recordAiPredictionOutcome('not_an_outcome' as never);
        expect(Object.keys(getMetricsSnapshot().ai.predictions.byOutcome)).toEqual([
            'success',
            'validation_rejected',
            'model_unavailable',
            'invalid_score',
            'server_error'
        ]);
    });
});
