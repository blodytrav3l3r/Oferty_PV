import express from 'express';
import request from 'supertest';
import { createRateLimiter } from '../../src/middleware/rateLimiter';
import { getMetricsSnapshot, resetMetrics } from '../../src/utils/metrics';

function buildApp(maxHits: number, name?: string) {
    const app = express();
    app.post('/write', createRateLimiter({ windowMs: 60000, maxHits, name }), (_req, res) =>
        res.status(200).json({ ok: true })
    );
    return app;
}

/**
 * P0.6: kontrakt rate-limit — burst powyżej limitu -> 429 z Retry-After,
 * nagłówki X-RateLimit-*, GET nieobjęty limiterem mutacji.
 */
describe('P0.6 rate-limit matrix', () => {
    it('burst 3 przy maxHits=2 -> dwa 200 i 429 z Retry-After', async () => {
        const app = buildApp(2);
        expect((await request(app).post('/write')).status).toBe(200);
        const second = await request(app).post('/write');
        expect(second.status).toBe(200);
        expect(second.headers['x-ratelimit-limit']).toBe('2');
        expect(second.headers['x-ratelimit-remaining']).toBe('0');
        const third = await request(app).post('/write');
        expect(third.status).toBe(429);
        expect(third.headers['retry-after']).toBeDefined();
    });

    it('osobne instancje limitera nie dzielą bucketów', async () => {
        const a = buildApp(1);
        const b = buildApp(1);
        expect((await request(a).post('/write')).status).toBe(200);
        expect((await request(a).post('/write')).status).toBe(429);
        expect((await request(b).post('/write')).status).toBe(200);
    });

    it('RATE_LIMIT_MULT skaluje maxHits (serwer E2E), produkcja ignoruje', async () => {
        const prevNodeEnv = process.env.NODE_ENV;
        process.env.RATE_LIMIT_MULT = '3';
        try {
            const testApp = buildApp(10);
            const scaled = await request(testApp).post('/write');
            expect(scaled.headers['x-ratelimit-limit']).toBe('30');

            process.env.NODE_ENV = 'production';
            const prodApp = buildApp(10);
            const prod = await request(prodApp).post('/write');
            expect(prod.headers['x-ratelimit-limit']).toBe('10');
        } finally {
            delete process.env.RATE_LIMIT_MULT;
            process.env.NODE_ENV = prevNodeEnv;
        }
    });

    it('P2.2: odrzucenie 429 liczone w /metrics per nazwa', async () => {
        resetMetrics();
        const app = buildApp(1, 'p22-probe');
        expect((await request(app).post('/write')).status).toBe(200);
        expect((await request(app).post('/write')).status).toBe(429);
        expect((await request(app).post('/write')).status).toBe(429);
        const snap = getMetricsSnapshot();
        expect(snap.ratelimit.rejected).toBe(2);
        expect(snap.ratelimit.byName['p22-probe']).toBe(2);
    });
});
