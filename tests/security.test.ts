import express from 'express';
import helmet from 'helmet';
import request from 'supertest';
import { securityHeaders, httpsRedirect, buildHelmetOptions } from '../src/middleware/security';

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

    it('preferuje PUBLIC_BASE_URL nad nagłówkiem Host', async () => {
        const originalEnv = process.env.NODE_ENV;
        const originalBase = process.env.PUBLIC_BASE_URL;
        process.env.NODE_ENV = 'production';
        process.env.PUBLIC_BASE_URL = 'https://oferty.example.pl';

        const app = express();
        app.set('trust proxy', 1);
        app.use(httpsRedirect);
        app.get('/test', (_req, res) => res.json({ ok: true }));

        const res = await request(app)
            .get('/test')
            .set('x-forwarded-proto', 'http')
            .set('host', 'evil.example.com');
        expect(res.statusCode).toBe(302);
        expect(res.headers.location).toBe('https://oferty.example.pl/test');

        process.env.NODE_ENV = originalEnv;
        if (originalBase === undefined) delete process.env.PUBLIC_BASE_URL;
        else process.env.PUBLIC_BASE_URL = originalBase;
    });

    it('nie przekierowuje przy nieprawidłowym Host (ochrona przed open-redirect)', async () => {
        const originalEnv = process.env.NODE_ENV;
        const originalBase = process.env.PUBLIC_BASE_URL;
        process.env.NODE_ENV = 'production';
        delete process.env.PUBLIC_BASE_URL;

        const app = express();
        app.set('trust proxy', 1);
        app.use(httpsRedirect);
        app.get('/test', (_req, res) => res.json({ ok: true }));

        const res = await request(app)
            .get('/test')
            .set('x-forwarded-proto', 'http')
            .set('host', 'evil..com');
        expect(res.statusCode).toBe(200);
        expect(res.headers.location).toBeUndefined();

        process.env.NODE_ENV = originalEnv;
        if (originalBase !== undefined) process.env.PUBLIC_BASE_URL = originalBase;
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

// ─── Tryb awaryjny HTTP (HTTPS_ENABLED=false, ADR-017) ────────────────

describe('HTTPS_ENABLED=false — tryb awaryjny HTTP', () => {
    const originalEnv = process.env.NODE_ENV;
    const originalHttpsEnabled = process.env.HTTPS_ENABLED;

    beforeEach(() => {
        process.env.NODE_ENV = 'production';
        process.env.HTTPS_ENABLED = 'false';
    });

    afterEach(() => {
        process.env.NODE_ENV = originalEnv;
        if (originalHttpsEnabled === undefined) delete process.env.HTTPS_ENABLED;
        else process.env.HTTPS_ENABLED = originalHttpsEnabled;
    });

    function createApp(): express.Application {
        const app = express();
        // Kolejność jak w src/app.ts: helmet → securityHeaders → redirect.
        app.use(helmet(buildHelmetOptions()));
        app.use(securityHeaders);
        app.use(httpsRedirect);
        app.get('/test', (_req, res) => res.json({ ok: true }));
        return app;
    }

    it('nie przekierowuje HTTP na HTTPS (brak 302)', async () => {
        const res = await request(createApp()).get('/test');
        expect(res.statusCode).toBe(200);
        expect(res.headers.location).toBeUndefined();
    });

    it('nie wysyła nagłówka Strict-Transport-Security', async () => {
        const res = await request(createApp()).get('/test');
        expect(res.headers['strict-transport-security']).toBeUndefined();
    });

    it('CSP bez upgrade-insecure-requests', async () => {
        const res = await request(createApp()).get('/test');
        const csp = String(res.headers['content-security-policy'] || '');
        expect(csp).not.toContain('upgrade-insecure-requests');
        // Reszta zabezpieczeń CSP musi zostać — wyłączamy tylko transport, nie security.
        expect(csp).toContain("default-src 'self'");
        expect(csp).toContain("script-src 'self'");
    });

    it('X-Content-Type-Options i Referrer-Policy dalej działają', async () => {
        const res = await request(createApp()).get('/test');
        expect(res.headers['x-content-type-options']).toBe('nosniff');
        expect(res.headers['referrer-policy']).toBe('strict-origin-when-cross-origin');
    });
});

describe('HTTPS_ENABLED=true — regresja trybu normalnego', () => {
    const originalEnv = process.env.NODE_ENV;
    const originalHttpsEnabled = process.env.HTTPS_ENABLED;

    beforeEach(() => {
        process.env.NODE_ENV = 'production';
        delete process.env.HTTPS_ENABLED;
    });

    afterEach(() => {
        process.env.NODE_ENV = originalEnv;
        if (originalHttpsEnabled === undefined) delete process.env.HTTPS_ENABLED;
        else process.env.HTTPS_ENABLED = originalHttpsEnabled;
    });

    function createApp(): express.Application {
        const app = express();
        // Kolejność jak w src/app.ts: helmet → securityHeaders → redirect.
        app.use(helmet(buildHelmetOptions()));
        app.use(securityHeaders);
        app.use(httpsRedirect);
        app.get('/test', (_req, res) => res.json({ ok: true }));
        return app;
    }

    it('dalej przekierowuje HTTP na HTTPS', async () => {
        process.env.PUBLIC_BASE_URL = 'https://sok.example.com';
        const res = await request(createApp()).get('/test').set('host', 'sok.example.com');
        delete process.env.PUBLIC_BASE_URL;
        expect(res.statusCode).toBe(302);
        expect(res.headers.location).toBe('https://sok.example.com/test');
    });

    it('dalej wysyła HSTS i upgrade-insecure-requests', async () => {
        const res = await request(createApp()).get('/test').set('x-forwarded-proto', 'https');
        expect(String(res.headers['strict-transport-security'] || '')).toMatch(/max-age=\d+/);
        expect(String(res.headers['content-security-policy'] || '')).toContain(
            'upgrade-insecure-requests'
        );
    });
});
