/**
 * M: metryki — normalizacja, ring buffer, p50/p95, busy, snapshot.
 */
import {
    normalizePath,
    shouldSkip,
    recordRequest,
    recordDbQuery,
    recordDbBusy,
    getMetricsSnapshot,
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

    test('recordRequest liczy p50/p95 i błędy 5xx', () => {
        for (let i = 1; i <= 100; i++) recordRequest('GET', '/api/a', 200, i);
        recordRequest('GET', '/api/a', 500, 5);
        const snap = getMetricsSnapshot();
        expect(snap.endpoints['GET /api/a'].n).toBe(101);
        expect(snap.endpoints['GET /api/a'].p50).toBe(50);
        expect(snap.endpoints['GET /api/a'].p95).toBe(95);
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

    test('MAX_KEYS ogranicza kardynalność', () => {
        for (let i = 0; i < 400; i++) recordRequest('GET', `/api/ep${i}`, 200, 1);
        const snap = getMetricsSnapshot();
        expect(Object.keys(snap.endpoints).length).toBeLessThanOrEqual(300);
    });
});
