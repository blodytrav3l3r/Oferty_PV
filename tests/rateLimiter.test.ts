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

    describe('keyGenerator (E4b: IP + login)', () => {
        const loginKey = (req: any) => {
            const ip = req.ip || 'unknown';
            const raw = req.body?.username;
            const login = typeof raw === 'string' ? raw.trim().toLowerCase() : '';
            return login ? `${ip}|${login}` : ip;
        };
        const buildApp = () => {
            const app = express();
            app.use(express.json());
            app.use(createRateLimiter({ maxHits: 2, windowMs: 60000, keyGenerator: loginKey }));
            app.post('/login', (_req, res) => res.json({ ok: true }));
            return app;
        };

        it('ten sam IP + różne konta to osobne buckety', async () => {
            const app = buildApp();
            await request(app).post('/login').send({ username: 'ala' });
            await request(app).post('/login').send({ username: 'ala' });
            expect((await request(app).post('/login').send({ username: 'ala' })).statusCode).toBe(
                429
            );
            // Ola na tym samym IP ma świeży bucket
            expect((await request(app).post('/login').send({ username: 'ola' })).statusCode).toBe(
                200
            );
        });

        it('normalizuje case i białe znaki loginu', async () => {
            const app = buildApp();
            await request(app).post('/login').send({ username: 'Ala' });
            await request(app).post('/login').send({ username: ' ala ' });
            expect((await request(app).post('/login').send({ username: 'ALA' })).statusCode).toBe(
                429
            );
        });

        it('brak i malformed loginu spada na sam IP', async () => {
            const app = buildApp();
            await request(app).post('/login').send({});
            await request(app).post('/login').send({ username: 123 });
            expect((await request(app).post('/login').send({})).statusCode).toBe(429);
        });
    });
});
