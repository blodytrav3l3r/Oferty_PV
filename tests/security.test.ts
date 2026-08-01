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

    it('powinien przekierować na HTTPS, gdy x-forwarded-proto=http w produkcji', async () => {
        const originalEnv = process.env.NODE_ENV;
        process.env.NODE_ENV = 'production';

        const app = express();
        app.set('trust proxy', 1);
        app.use(httpsRedirect);
        app.get('/test', (_req, res) => res.json({ ok: true }));

        const res = await request(app)
            .get('/test')
            .set('x-forwarded-proto', 'http')
            .set('host', 'oferty.example.pl');
        expect(res.statusCode).toBe(302);
        expect(res.headers.location).toBe('https://oferty.example.pl/test');

        process.env.NODE_ENV = originalEnv;
    });

    it('nie powinien przekierować, gdy x-forwarded-proto=https w produkcji', async () => {
        const originalEnv = process.env.NODE_ENV;
        process.env.NODE_ENV = 'production';

        const app = express();
        app.set('trust proxy', 1);
        app.use(httpsRedirect);
        app.get('/test', (_req, res) => res.json({ ok: true }));

        const res = await request(app)
            .get('/test')
            .set('x-forwarded-proto', 'https')
            .set('host', 'oferty.example.pl');
        expect(res.statusCode).toBe(200);

        process.env.NODE_ENV = originalEnv;
    });

    it('obsługuje listę w x-forwarded-proto (wiele proxy) — bierze pierwszy wpis', async () => {
        const originalEnv = process.env.NODE_ENV;
        process.env.NODE_ENV = 'production';

        const app = express();
        app.set('trust proxy', 2);
        app.use(httpsRedirect);
        app.get('/test', (_req, res) => res.json({ ok: true }));

        // Cloudflare → Nginx → App: pierwszy wpis HTTPS → bez przekierowania
        const res = await request(app)
            .get('/test')
            .set('x-forwarded-proto', 'https, http')
            .set('host', 'oferty.example.pl');
        expect(res.statusCode).toBe(200);

        process.env.NODE_ENV = originalEnv;
    });
});

// ─── HSTS ─────────────────────────────────────────────────────────────

describe('securityHeaders HSTS', () => {
    let originalEnv: string | undefined;

    beforeAll(() => {
        originalEnv = process.env.NODE_ENV;
    });

    afterAll(() => {
        process.env.NODE_ENV = originalEnv;
    });

    it('nie ustawia HSTS w trybie development', async () => {
        process.env.NODE_ENV = 'development';
        const app = express();
        app.use(securityHeaders);
        app.get('/test', (_req, res) => res.json({ ok: true }));

        const res = await request(app).get('/test');
        expect(res.headers['strict-transport-security']).toBeUndefined();
    });

    it('ustawia HSTS z max-age i includeSubDomains w produkcji', async () => {
        process.env.NODE_ENV = 'production';
        const app = express();
        app.use(securityHeaders);
        app.get('/test', (_req, res) => res.json({ ok: true }));

        const res = await request(app).get('/test');
        const hsts = res.headers['strict-transport-security'] as string;
        expect(hsts).toMatch(/max-age=\d+/);
        expect(hsts).toContain('includeSubDomains');
    });
});
