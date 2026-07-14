import express from 'express';
import request from 'supertest';
import { securityHeaders, httpsRedirect } from '../src/middleware/security';

// ─── securityHeaders ────────────────────────────────────────────────

describe('securityHeaders', () => {
    let app: express.Application;

    beforeAll(() => {
        app = express();
        app.use(securityHeaders);
        app.get('/test', (_req, res) => res.json({ ok: true }));
    });

    it('powinien ustawić nagłówek X-Content-Type-Options', async () => {
        const res = await request(app).get('/test');
        expect(res.headers['x-content-type-options']).toBe('nosniff');
    });

    it('powinien ustawić nagłówek X-XSS-Protection', async () => {
        const res = await request(app).get('/test');
        expect(res.headers['x-xss-protection']).toBe('1; mode=block');
    });

    it('powinien ustawić nagłówek Referrer-Policy', async () => {
        const res = await request(app).get('/test');
        expect(res.headers['referrer-policy']).toBe('strict-origin-when-cross-origin');
    });

    it('powinien ustawić nagłówek Permissions-Policy', async () => {
        const res = await request(app).get('/test');
        expect(res.headers['permissions-policy']).toBe('camera=(), microphone=(), geolocation=()');
    });
});

// ─── httpsRedirect ──────────────────────────────────────────────────

describe('httpsRedirect', () => {
    it('nie powinien przekierowywać w trybie deweloperskim', async () => {
        const originalEnv = process.env.NODE_ENV;
        process.env.NODE_ENV = 'development';

        const app = express();
        app.use(httpsRedirect);
        app.get('/test', (_req, res) => res.json({ ok: true }));

        const res = await request(app).get('/test');
        expect(res.statusCode).toBe(200);

        process.env.NODE_ENV = originalEnv;
    });

    it('powinien przepuścić, gdy NODE_ENV nie jest ustawione na production', async () => {
        const originalEnv = process.env.NODE_ENV;
        delete process.env.NODE_ENV;

        const app = express();
        app.use(httpsRedirect);
        app.get('/test', (_req, res) => res.json({ ok: true }));

        const res = await request(app).get('/test');
        expect(res.statusCode).toBe(200);

        process.env.NODE_ENV = originalEnv;
    });
});
