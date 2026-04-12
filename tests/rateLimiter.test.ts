import express from 'express';
import request from 'supertest';
import { createRateLimiter } from '../src/middleware/rateLimiter';

describe('createRateLimiter', () => {
    it('powinien zezwalać na żądania w ramach limitu', async () => {
        const app = express();
        app.use(createRateLimiter({ maxHits: 5, windowMs: 60000 }));
        app.get('/test', (_req, res) => res.json({ ok: true }));

        const res = await request(app).get('/test');
        expect(res.statusCode).toBe(200);
        expect(res.headers['x-ratelimit-limit']).toBe('5');
    });

    it('powinien ustawiać nagłówek X-RateLimit-Remaining', async () => {
        const app = express();
        app.use(createRateLimiter({ maxHits: 3, windowMs: 60000 }));
        app.get('/test', (_req, res) => res.json({ ok: true }));

        const res = await request(app).get('/test');
        expect(res.statusCode).toBe(200);
        expect(Number(res.headers['x-ratelimit-remaining'])).toBeGreaterThanOrEqual(0);
    });

    it('powinien blokować żądania przekraczające limit błędem 429', async () => {
        const app = express();
        app.use(createRateLimiter({ maxHits: 2, windowMs: 60000 }));
        app.get('/test', (_req, res) => res.json({ ok: true }));

        // Pierwsze 2 żądania powinny przejść
        await request(app).get('/test');
        await request(app).get('/test');

        // Trzecie żądanie powinno zostać zablokowane
        const res = await request(app).get('/test');
        expect(res.statusCode).toBe(429);
        expect(res.body.error).toContain('Zbyt wiele prób');
    });

    it('powinien ustawiać nagłówek Retry-After przy blokadzie', async () => {
        const app = express();
        app.use(createRateLimiter({ maxHits: 1, windowMs: 60000 }));
        app.get('/test', (_req, res) => res.json({ ok: true }));

        await request(app).get('/test'); // first pass
        const res = await request(app).get('/test'); // blocked

        expect(res.statusCode).toBe(429);
        expect(res.headers['retry-after']).toBeDefined();
        expect(Number(res.headers['retry-after'])).toBeGreaterThan(0);
    });

    it('powinien używać własnego komunikatu o błędzie', async () => {
        const customMessage = 'Custom rate limit msg';
        const app = express();
        app.use(createRateLimiter({ maxHits: 0, message: customMessage }));
        app.get('/test', (_req, res) => res.json({ ok: true }));

        const res = await request(app).get('/test');
        expect(res.statusCode).toBe(429);
        expect(res.body.error).toBe(customMessage);
    });

    it('powinien używać domyślnych opcji, gdy nie podano żadnych', async () => {
        const app = express();
        app.use(createRateLimiter());
        app.get('/test', (_req, res) => res.json({ ok: true }));

        const res = await request(app).get('/test');
        expect(res.statusCode).toBe(200);
        expect(res.headers['x-ratelimit-limit']).toBe('15');
    });
});
