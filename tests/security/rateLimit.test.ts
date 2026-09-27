import express from 'express';
import request from 'supertest';
import { createRateLimiter } from '../../src/middleware/rateLimiter';

function buildApp(maxHits: number) {
    const app = express();
    app.post('/write', createRateLimiter({ windowMs: 60000, maxHits }), (_req, res) =>
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
});
