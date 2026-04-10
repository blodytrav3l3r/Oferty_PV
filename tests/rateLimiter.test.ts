import express from 'express';
import request from 'supertest';
import { createRateLimiter } from '../src/middleware/rateLimiter';

describe('createRateLimiter', () => {
    it('should allow requests within limit', async () => {
        const app = express();
        app.use(createRateLimiter({ maxHits: 5, windowMs: 60000 }));
        app.get('/test', (_req, res) => res.json({ ok: true }));

        const res = await request(app).get('/test');
        expect(res.statusCode).toBe(200);
        expect(res.headers['x-ratelimit-limit']).toBe('5');
    });

    it('should set X-RateLimit-Remaining header', async () => {
        const app = express();
        app.use(createRateLimiter({ maxHits: 3, windowMs: 60000 }));
        app.get('/test', (_req, res) => res.json({ ok: true }));

        const res = await request(app).get('/test');
        expect(res.statusCode).toBe(200);
        expect(Number(res.headers['x-ratelimit-remaining'])).toBeGreaterThanOrEqual(0);
    });

    it('should block requests exceeding limit with 429', async () => {
        const app = express();
        app.use(createRateLimiter({ maxHits: 2, windowMs: 60000 }));
        app.get('/test', (_req, res) => res.json({ ok: true }));

        // First 2 requests should pass
        await request(app).get('/test');
        await request(app).get('/test');

        // 3rd request should be blocked
        const res = await request(app).get('/test');
        expect(res.statusCode).toBe(429);
        expect(res.body.error).toContain('Zbyt wiele prób');
    });

    it('should set Retry-After header when blocked', async () => {
        const app = express();
        app.use(createRateLimiter({ maxHits: 1, windowMs: 60000 }));
        app.get('/test', (_req, res) => res.json({ ok: true }));

        await request(app).get('/test'); // first pass
        const res = await request(app).get('/test'); // blocked

        expect(res.statusCode).toBe(429);
        expect(res.headers['retry-after']).toBeDefined();
        expect(Number(res.headers['retry-after'])).toBeGreaterThan(0);
    });

    it('should use custom error message', async () => {
        const customMessage = 'Custom rate limit msg';
        const app = express();
        app.use(createRateLimiter({ maxHits: 0, message: customMessage }));
        app.get('/test', (_req, res) => res.json({ ok: true }));

        const res = await request(app).get('/test');
        expect(res.statusCode).toBe(429);
        expect(res.body.error).toBe(customMessage);
    });

    it('should use default options when none provided', async () => {
        const app = express();
        app.use(createRateLimiter());
        app.get('/test', (_req, res) => res.json({ ok: true }));

        const res = await request(app).get('/test');
        expect(res.statusCode).toBe(200);
        expect(res.headers['x-ratelimit-limit']).toBe('15');
    });
});
